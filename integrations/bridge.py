#!/usr/bin/env python3
"""Loopback-only Arklin Team Telegram bridge. Never polls or reconfigures bots."""
from datetime import datetime, timezone
import math
import re

GROUP_ID = -1004374108988
USER_ID = 1763778996


def timestamp(value):
    try:
        if isinstance(value, str) and not re.fullmatch(r'[0-9.]+', value):
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
            value = dt.replace(tzinfo=dt.tzinfo or timezone.utc).timestamp()
        value = float(value)
        return value if math.isfinite(value) and value >= 0 else 0.0
    except (ValueError, TypeError, OverflowError):
        return 0.0


def select_sessions(index, known_topics):
    """Scope BOTH routing key and origin; prefer owner-specific routes."""
    selected, ranks = {}, {}
    pattern = re.compile(rf'agent:main:telegram:group:{GROUP_ID}:([1-9][0-9]*)(?::{USER_ID})?')
    for key, value in sorted(index.items()):
        match = pattern.fullmatch(key)
        if not match or not isinstance(value, dict):
            continue
        topic = match[1]
        origin = value.get('origin') or {}
        if (topic not in known_topics or not isinstance(origin, dict)
                or origin.get('platform') != 'telegram' or origin.get('chat_type') != 'group'
                or str(origin.get('chat_id')) != str(GROUP_ID)
                or str(origin.get('user_id')) != str(USER_ID)
                or str(origin.get('thread_id')) != topic
                or value.get('session_key', key) != key
                or not isinstance(value.get('session_id'), str)
                or not re.fullmatch(r'[A-Za-z0-9_-]{1,150}', value['session_id'])):
            continue
        rank = (key.endswith(':' + str(USER_ID)), timestamp(value.get('updated_at')), value['session_id'])
        if topic not in ranks or rank > ranks[topic]:
            selected[topic], ranks[topic] = value, rank
    return selected


import asyncio
import contextlib
import hmac
import ipaddress
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import time
from aiohttp import ClientSession, ClientTimeout, web
from telethon import TelegramClient, functions, types, utils

HERMES_HOME = Path('/root/.hermes')  # explicit default profile; never follows another profile
SESSION_SOURCE = Path('/root/.telegram_sessions/telethon_user.session')
SESSION_COPY = Path('/var/lib/arklyn-office/telegram.session')
FORUM_TTL = 60
SNAPSHOT_TTL = 5


class BridgeError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


# Standalone redaction avoids importing gateway/provider initialization code.
_SECRET_PATTERNS = [
    re.compile(r'-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----', re.S),
    re.compile(r'\b[0-9]{6,15}:[A-Za-z0-9_-]{25,}\b'),
    re.compile(r'\b(?:sk-|ghp_|github_pat_|xox[baprs]-|AKIA)[A-Za-z0-9_-]{12,}\b'),
    re.compile(r'(?i)\bBearer\s+[A-Za-z0-9._~+/-]+=*'),
    re.compile(r'(?i)(?:https?|postgres(?:ql)?|mysql|redis)://[^\s/@:]+:[^\s/@]+@'),
    re.compile(r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b'),
    re.compile(r'''(?ix)["']?\b[A-Z0-9_]*(?:TOKEN|PASSWORD|PASSWD|SECRET|API[_-]?KEY|API[_-]?HASH|AUTH[_-]?KEY|COOKIE|AUTHORIZATION)[A-Z0-9_]*\b["']?\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s,;\}\]]+)'''),
]
_KNOWN_SECRETS = ()


def redact(value):
    text = value if isinstance(value, str) else ''
    for secret in _KNOWN_SECRETS:
        text = text.replace(secret, '[REDACTED]')
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub('[REDACTED]', text)
    return text


def safe_text(value, limit=12000):
    return redact(value).encode('utf-8', 'replace').decode('utf-8')[:limit]


def visible_content(value):
    if isinstance(value, str):
        if value.lstrip().startswith(('[', '{')):
            try:
                value = json.loads(value)
            except (ValueError, TypeError):
                return value
        else:
            return value
    if isinstance(value, list):
        return '\n'.join(b['text'] for b in value if isinstance(b, dict)
                         and b.get('type') in ('text', 'input_text', 'output_text')
                         and isinstance(b.get('text'), str))
    return ''  # never stringify arbitrary objects, tool/reasoning blocks or metadata


def normalize_messages(rows):
    by_id = {}
    for row in rows:
        if row.get('role') not in ('user', 'assistant'):
            continue
        content = safe_text(visible_content(row.get('content')))
        if not content.strip():
            continue
        mid = safe_text(str(row['id']), 200)
        item = {'id': mid, 'role': 'agent' if row['role'] == 'assistant' else 'user',
                'content': content, 'ts': timestamp(row.get('timestamp', row.get('ts'))) * 1000}
        rank = (item['ts'], item['role'], item['content'])
        if mid not in by_id or rank > (by_id[mid]['ts'], by_id[mid]['role'], by_id[mid]['content']):
            by_id[mid] = item
    return sorted(by_id.values(), key=lambda m: (m['ts'], m['id']))[-80:]


def read_json(path):
    try:
        value = json.loads(Path(path).read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def read_hermes(path, selected):
    result = {}
    try:
        with contextlib.closing(sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=2)) as db:
            db.row_factory = sqlite3.Row
            db.execute('PRAGMA query_only=ON')
            for topic, entry in selected.items():
                sid = entry['session_id']
                row = db.execute('''SELECT id, model FROM sessions WHERE id=? AND source='telegram'
                    AND CAST(chat_id AS TEXT)=? AND CAST(thread_id AS TEXT)=?
                    AND CAST(user_id AS TEXT)=? AND COALESCE(hidden,0)=0''',
                    (sid, str(GROUP_ID), topic, str(USER_ID))).fetchone()
                if not row:
                    continue
                rows = db.execute('''SELECT id, role, content, timestamp FROM messages
                    WHERE session_id=? AND active=1 AND role IN ('user','assistant')
                    AND COALESCE(_compressed_summary,0)=0
                    AND (display_kind IS NULL OR display_kind IN ('message','steer'))
                    ORDER BY timestamp DESC, id DESC LIMIT 240''', (sid,)).fetchall()
                messages = normalize_messages([dict(r) for r in rows])
                for message in messages:
                    message['id'] = 'hermes-' + sid + '-' + message['id']
                override = entry.get('model_override')
                model = override.get('model') if isinstance(override, dict) else row['model']
                busy = bool(entry.get('active_turn_token'))
                steps = []
                if busy:
                    steps = [{'id': 'hermes-' + sid + '-turn', 'title': 'Agent working',
                              'description': 'Current gateway turn is active', 'status': 'running',
                              'ts': timestamp(entry.get('active_turn_started_at')) * 1000}]
                result[topic] = {'sessionId': sid, 'messages': messages, 'steps': steps, 'busy': busy}
                if isinstance(model, str) and model:
                    result[topic]['model'] = safe_text(model, 200)
    except (sqlite3.Error, OSError):
        raise BridgeError('Hermes transcript unavailable', 503) from None
    return result


def parse_room(room_id):
    match = re.fullmatch(r'tg-(hermes|claude-code)-([1-9][0-9]{0,9})', room_id) if isinstance(room_id, str) else None
    if not match or int(match[2]) > 2147483647:
        raise BridgeError('Invalid roomId')
    return match[1], match[2]


def send_text(text, username):
    if not isinstance(text, str) or not text.strip():
        raise BridgeError('Nonempty text required')
    if not isinstance(username, str) or not re.fullmatch(r'[A-Za-z0-9_]{5,32}', username):
        raise BridgeError('Bot unavailable', 503)
    text = text.strip()
    if re.search(r'(?m)^\s*(?:@[A-Za-z0-9_]+\s+)?/', text):
        raise BridgeError('Slash commands are forbidden')
    if '\x00' in text or re.search(r'@[A-Za-z0-9_]+', text):
        raise BridgeError('Bot mentions in text are forbidden; routing is server-owned')
    routed = '@' + username + ' ' + text
    if len(routed.encode('utf-16-le')) // 2 > 4096:
        raise BridgeError('Text exceeds Telegram message limit')
    return routed


def copy_session(source, target):
    """Consistent SQLite backup, never opens the live session for writing."""
    source, target = Path(source), Path(target)
    if source.resolve() == target.resolve() or target.is_symlink():
        raise BridgeError('Unsafe session path', 503)
    if target.exists():
        if not target.is_file():
            raise BridgeError('Unsafe session path', 503)
        target.chmod(0o600)
        return
    if not target.parent.is_dir():
        raise BridgeError('Create /var/lib/arklyn-office before starting broker', 503)
    fd, tmp = tempfile.mkstemp(prefix='.telegram-', dir=target.parent)
    os.close(fd)
    try:
        with contextlib.closing(sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True, timeout=5)) as src:
            with contextlib.closing(sqlite3.connect(tmp)) as dst:
                src.backup(dst)
        os.chmod(tmp, 0o600)
        os.replace(tmp, target)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(tmp)


def read_env(path):
    result = {}
    for line in Path(path).read_text().splitlines():
        key, sep, value = line.strip().removeprefix('export ').partition('=')
        if sep and key and not key.startswith('#'):
            result[key] = value.strip().strip('"').strip("'")
    return result


async def list_topics(client, group):
    """MTProto full pagination; General may require explicit by-ID lookup."""
    topics = {}
    offset_date, offset_id, offset_topic = None, 0, 0
    seen_offsets = set()
    while True:
        page = await client(functions.messages.GetForumTopicsRequest(
            peer=group, offset_date=offset_date, offset_id=offset_id,
            offset_topic=offset_topic, limit=100))
        batch = [t for t in page.topics if hasattr(t, 'title')]
        for topic in batch:
            topics[str(topic.id)] = {'name': safe_text(topic.title, 500),
                                     'closed': bool(getattr(topic, 'closed', False))}
        if not batch or len(batch) < 100:
            break
        last = batch[-1]
        dates = {m.id: m.date for m in page.messages if hasattr(m, 'date')}
        offset_date = last.date if getattr(page, 'order_by_create_date', False) else dates.get(last.top_message, last.date)
        offset_id, offset_topic = last.top_message, last.id
        cursor = (offset_date, offset_id, offset_topic)
        if cursor in seen_offsets:
            raise BridgeError('Forum pagination did not advance', 503)
        seen_offsets.add(cursor)
    if '1' not in topics:
        page = await client(functions.messages.GetForumTopicsByIDRequest(peer=group, topics=[1]))
        for topic in page.topics:
            if getattr(topic, 'id', None) == 1 and hasattr(topic, 'title'):
                topics['1'] = {'name': safe_text(topic.title, 500), 'closed': bool(getattr(topic, 'closed', False))}
    return dict(sorted(topics.items(), key=lambda item: int(item[0])))


class Broker:
    def __init__(self):
        self.client = None
        self.http = None
        self.group = None
        self.topics = {}
        self.bots = []
        self.bot_ids = {}
        self._telegram_cache = {}
        self._telegram_slots = asyncio.Semaphore(1)
        self.tokens = {}
        self._forum_at = -float('inf')
        self._snapshot_at = -float('inf')
        self._snapshot = None
        self._forum_lock = asyncio.Lock()
        self._snapshot_lock = asyncio.Lock()
        self.local_ok = True

    def check_group(self):
        if self.group is None or self.group.id != 4374108988:
            raise BridgeError('Approved group unavailable', 503)

    async def start(self):
        global _KNOWN_SECRETS
        auth = read_json('/root/.telegram_sessions/auth_state.json')
        api_id = os.environ.get('TELEGRAM_API_ID') or auth.get('api_id')
        api_hash = os.environ.get('TELEGRAM_API_HASH') or auth.get('api_hash')
        if not api_id or not api_hash:
            raise BridgeError('Telegram application credentials unavailable', 503)
        hermes_env = read_env(HERMES_HOME / '.env')
        claude_env = read_env('/root/claude_bot/.env')
        self.tokens = {'hermes': hermes_env.get('TELEGRAM_BOT_TOKEN', ''),
                       'claude-code': claude_env.get('BOT_TOKEN', '')}
        credential_values = [v for k, v in {**hermes_env, **claude_env}.items()
                             if re.search(r'token|password|secret|key|hash', k, re.I)]
        _KNOWN_SECRETS = tuple(sorted({v for v in [api_hash, os.environ.get('ARKLYN_BRIDGE_KEY'), *credential_values]
                                      if isinstance(v, str) and len(v) >= 8}, key=lambda v: (-len(v), v)))
        copy_session(SESSION_SOURCE, SESSION_COPY)
        self.client = TelegramClient(str(SESSION_COPY), int(api_id), api_hash,
                                     receive_updates=False, flood_sleep_threshold=0)
        await self.client.connect()
        if not await self.client.is_user_authorized():
            raise BridgeError('Telegram session unauthorized; no interactive login attempted', 503)
        me = await self.client.get_me()
        if me.id != USER_ID:
            raise BridgeError('Telegram session user is outside approved scope', 503)
        self.group = await self.client.get_entity(GROUP_ID)
        if utils.get_peer_id(self.group) != GROUP_ID or not getattr(self.group, 'forum', False):
            raise BridgeError('Approved forum not found', 503)
        self.http = ClientSession(timeout=ClientTimeout(total=15))
        await self.refresh_forum()

    async def bot_call(self, backend, method, payload=None):
        # URLs contain credentials: NEVER log exceptions, URLs, or raw responses.
        token = self.tokens.get(backend)
        if not token:
            return None
        try:
            async with self.http.post(f'https://api.telegram.org/bot{token}/{method}', json=payload or {}) as response:
                data = await response.json()
                return data.get('result') if data.get('ok') else None
        except (Exception,):
            return None

    async def bot_identity(self, backend):
        identity = await self.bot_call(backend, 'getMe')
        bot = {'backend': backend, 'username': '', 'ok': False}
        if not isinstance(identity, dict) or not identity.get('is_bot'):
            return bot
        username = identity.get('username', '')
        if not re.fullmatch(r'[A-Za-z0-9_]{5,32}', username):
            return bot
        bot['username'] = username
        self.bot_ids[backend] = identity['id']
        member = await self.bot_call(backend, 'getChatMember', {'chat_id': GROUP_ID, 'user_id': identity['id']})
        if isinstance(member, dict):
            bot['ok'] = member.get('status') in ('creator','administrator','member') or (
                member.get('status') == 'restricted' and member.get('is_member') is True)
        if not bot['ok']:
            try:
                entity = await self.client.get_entity(username)
                if entity.id != identity['id']:
                    return bot
                participant = (await self.client(functions.channels.GetParticipantRequest(self.group, entity))).participant
                bot['ok'] = not isinstance(participant, (types.ChannelParticipantLeft, types.ChannelParticipantBanned))
            except Exception:
                pass
        return bot

    async def refresh_forum(self):
        async with self._forum_lock:
            if time.monotonic() - self._forum_at < FORUM_TTL:
                return
            self.check_group()
            topics = await list_topics(self.client, self.group)
            bots = await asyncio.gather(self.bot_identity('hermes'), self.bot_identity('claude-code'))
            self.topics, self.bots = topics, bots
            self._forum_at = time.monotonic()

    async def recent_messages(self, backend, topic):
        """Read one bounded group-history batch, not one Telegram request per topic."""
        bot_id = self.bot_ids.get(backend)
        if not bot_id:
            return []
        cache_key = 'group-history'
        cached = self._telegram_cache.get(cache_key)
        if not cached or time.monotonic() - cached[0] >= 15:
            async with self._telegram_slots:
                cached = self._telegram_cache.get(cache_key)
                if not cached or time.monotonic() - cached[0] >= 15:
                    posts = await self.client.get_messages(GROUP_ID, limit=100)
                    cached = (time.monotonic(), posts)
                    self._telegram_cache[cache_key] = cached
        posts = cached[1]
        username = next((b['username'] for b in self.bots if b['backend'] == backend), '')
        messages = []
        for post in posts:
            reply = getattr(post, 'reply_to', None)
            root = (getattr(reply, 'reply_to_top_id', None) or getattr(reply, 'reply_to_msg_id', None)) if reply and getattr(reply, 'forum_topic', False) else 1
            if str(root or 1) != topic:
                continue
            sender = getattr(post, 'sender_id', None)
            if sender not in (USER_ID, bot_id):
                continue
            text = getattr(post, 'raw_text', '') or ''
            if sender == USER_ID:
                mention = re.match(r'^@([A-Za-z0-9_]+)\s+', text)
                if mention and mention[1].lower() != username.lower():
                    continue
                text = re.sub(r'^@' + re.escape(username) + r'\s+', '', text, flags=re.I)
            text = safe_text(text)
            if not text.strip() or text.lstrip().startswith('/'):
                continue
            messages.append({'id': str(post.id), 'role': 'user' if sender == USER_ID else 'agent',
                             'content': text, 'ts': timestamp(post.date.timestamp()) * 1000})
        messages.sort(key=lambda m: (m['ts'], int(m['id'])))
        return messages[-80:]

    def read_local(self):
        index = read_json(HERMES_HOME / 'sessions/sessions.json')
        selected = select_sessions(index, set(self.topics))
        hermes = read_hermes(HERMES_HOME / 'state.db', selected)
        # Never project another group's Claude sessions or unscoped active_session_id.
        state = read_json('/root/claude_bot/session_state.json')
        sessions = state.get('chat_sessions', {})
        claude = {}
        if isinstance(sessions, dict):
            for topic in self.topics:
                sid = sessions.get(f'{GROUP_ID}_{topic}') or (sessions.get(f'{GROUP_ID}_0') if topic == '1' else None)
                if isinstance(sid, str) and re.fullmatch(r'[0-9a-fA-F-]{36}', sid):
                    claude[topic] = {'sessionId': sid}
        return hermes, claude

    async def snapshot(self):
        async with self._snapshot_lock:
            if self._snapshot is not None and time.monotonic() - self._snapshot_at < SNAPSHOT_TTL:
                return self._snapshot
            await self.refresh_forum()
            self.check_group()
            hermes, claude = await asyncio.to_thread(self.read_local)
            rooms = []
            for bot in self.bots:
                if bot['backend'] == 'claude-code' and not bot['ok']:
                    continue
                backend = bot['backend']
                for topic, info in self.topics.items():
                    room = {'id': f'tg-{backend}-{topic}', 'name': info['name'], 'backend': backend,
                            'topicId': topic, 'messages': [], 'steps': [], 'busy': False}
                    room.update((hermes if backend == 'hermes' else claude).get(topic, {}))
                    rooms.append(room)
            async def sync_room(room):
                if self.bot_ids.get(room['backend']):
                    recent = await self.recent_messages(room['backend'], room['topicId'])
                    if recent:
                        room['messages'] = recent
            await asyncio.gather(*(sync_room(room) for room in rooms))
            rooms.sort(key=lambda room: (room['backend'] != 'hermes', int(room['topicId'])))
            self._snapshot = {'group': {'id': str(GROUP_ID), 'name': safe_text(self.group.title, 500)},
                              'bots': self.bots, 'rooms': rooms, 'updatedAt': time.time() * 1000}
            self._snapshot_at = time.monotonic()
            return self._snapshot

    async def send(self, room_id, text):
        backend, topic = parse_room(room_id)
        await self.refresh_forum()
        self.check_group()
        if topic not in self.topics:
            raise BridgeError('Unknown forum topic', 404)
        if self.topics[topic].get('closed'):
            raise BridgeError('Forum topic is closed', 409)
        bot = next((b for b in self.bots if b['backend'] == backend and b['ok']), None)
        if bot is None:
            raise BridgeError('Bot is not available in approved group', 503)
        routed = send_text(text, bot['username'])
        # Topic 1 is ordinary General, not a reply to message 1.
        message = await self.client.send_message(GROUP_ID, routed, reply_to=None if topic == '1' else int(topic),
                                                 parse_mode=None, formatting_entities=[types.MessageEntityMention(offset=0, length=len(bot['username']) + 1)])
        try:
            stored = await self.client.get_messages(GROUP_ID, ids=message.id)
            reply = getattr(stored, 'reply_to', None)
            stored_topic = (getattr(reply, 'reply_to_top_id', None) or getattr(reply, 'reply_to_msg_id', None)) if reply else 1
            if stored is None or stored.raw_text != routed or stored_topic != int(topic):
                raise ValueError('Delivery mismatch')
        except Exception:
            raise BridgeError('Message submitted but readback not verified; do not resend automatically', 502) from None
        self._telegram_cache.pop('group-history', None)
        self._snapshot_at = -float('inf')
        return {'ok': True, 'messageId': str(message.id), 'topicId': topic, 'roomId': room_id}

    async def close(self):
        if self.http:
            await self.http.close()
        if self.client:
            await self.client.disconnect()


def json_response(value, status=200):
    return web.Response(text=json.dumps(value, ensure_ascii=False, allow_nan=False), status=status,
                        content_type='application/json', headers={'Cache-Control': 'no-store'})


async def request_body(request):
    try:
        body = await request.json()
    except (ValueError, UnicodeError):
        raise BridgeError('Invalid JSON body') from None
    if not isinstance(body, dict):
        raise BridgeError('JSON object required')
    return body


import signal
import uuid


def claude_cwd():
    # Only operator environment can change this; HTTP clients cannot choose cwd.
    return Path(os.environ.get('CLAUDE_CODE_CWD', '/var/lib/arklyn-office/workspace')).resolve()


def claude_child_env():
    allowed = {'PATH', 'LANG', 'LC_ALL', 'TZ', 'TERM', 'TMPDIR', 'SSL_CERT_FILE', 'SSL_CERT_DIR'}
    env = {k: v for k, v in os.environ.items() if k in allowed}
    env.update({'HOME': '/root', 'CLAUDE_AGENT_SDK_CLIENT_APP': 'arklyn-office/1.0'})
    return env


def claude_command(body):
    if set(body) - {'prompt', 'systemAppend', 'subagents', 'sessionId'}:
        raise BridgeError('Unexpected Claude fields')
    prompt, append, agents = body.get('prompt'), body.get('systemAppend', ''), body.get('subagents', {})
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 100000 or '\x00' in prompt:
        raise BridgeError('Nonempty prompt up to 100000 characters required')
    if not isinstance(append, str) or len(append) > 50000 or '\x00' in append:
        raise BridgeError('Invalid systemAppend')
    if not isinstance(agents, dict) or len(agents) > 40:
        raise BridgeError('Invalid subagents')
    clean = {}
    for name, definition in sorted(agents.items()):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', name) or not isinstance(definition, dict) or set(definition) != {'description', 'prompt'}:
            raise BridgeError('Invalid subagent definition')
        if any(not isinstance(definition[k], str) or len(definition[k]) > 12000 or '\x00' in definition[k] for k in ('description', 'prompt')):
            raise BridgeError('Invalid subagent text')
        clean[name] = {'description': definition['description'], 'prompt': definition['prompt']}
    args = ['/usr/bin/claude', '--print', '--output-format', 'stream-json', '--verbose',
            '--include-partial-messages', '--forward-subagent-text', '--permission-mode', 'default',
            '--permission-prompts', 'none', '--max-turns', '40', '--append-system-prompt', append,
            '--agents', json.dumps(clean, ensure_ascii=False)]
    session_id = body.get('sessionId')
    if session_id is not None:
        if not isinstance(session_id, str) or not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', session_id):
            raise BridgeError('sessionId must be a UUID')
        uuid.UUID(session_id)
        args.extend(['--resume', session_id])
    model = os.environ.get('CLAUDE_CODE_MODEL', '')
    if model:
        if not re.fullmatch(r'[A-Za-z0-9._:/-]{1,150}', model):
            raise BridgeError('Invalid server Claude model', 503)
        args.extend(['--model', model])
    return args, prompt


def file_subagents(cwd, home=Path('/root')):
    found = {}
    for directory, source in [(Path(cwd) / '.claude/agents', 'project'), (Path(home) / '.claude/agents', 'user')]:
        for path in sorted(directory.glob('*.md')):
            try:
                if path.is_symlink() or path.stat().st_size > 100000:
                    continue
                text = path.read_text(encoding='utf-8')
            except (OSError, UnicodeError):
                continue
            front = re.match(r'^---\s*\n(.*?)\n---', text, re.S)
            fm = {}
            if front:
                for line in front[1].splitlines():
                    match = re.match(r'^([\w-]+)\s*:\s*(.*)$', line)
                    if match:
                        fm[match[1]] = match[2].strip().strip('"').strip("'")
            name = fm.get('name', path.stem)
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', name):
                continue
            found.setdefault(name, {'id': name, 'name': name, 'description': safe_text(fm.get('description', ''), 2000), 'source': source})
    return [found[key] for key in sorted(found)]


class ClaudeEvents:
    """Allowlisted OfficeEvent projection; never returns raw CLI envelopes."""
    def __init__(self):
        self.owners, self.current = {}, {}
        self.tracked, self.ended, self.streamed, self.pending, self.seen_assistant = set(), set(), set(), set(), set()
        self.result_seen = False

    def handle(self, message):
        events = []
        parent = message.get('parent_tool_use_id') or None
        agent = self.owners.get(parent) if parent else None
        kind = message.get('type')

        def end(tid, summary, ok):
            if tid in self.owners and tid not in self.ended:
                self.ended.add(tid)
                events.append({'type':'subagent_end', 'toolUseId':tid, 'agent':self.owners[tid],
                               'summary':safe_text(summary, 400), 'ok':bool(ok)})

        if kind == 'system':
            subtype = message.get('subtype')
            tid = message.get('tool_use_id')
            if subtype == 'init':
                events.append({'type':'session', 'id':safe_text(message.get('session_id'), 150),
                               'agents':[safe_text(a, 80) for a in message.get('agents', []) if isinstance(a, str)]})
            elif subtype == 'task_started' and tid and message.get('subagent_type'):
                self.tracked.add(tid)
                if tid not in self.owners:
                    self.owners[tid] = safe_text(message['subagent_type'], 80)
                    events.append({'type':'subagent_start','toolUseId':tid,'agent':self.owners[tid],
                                   'task':safe_text(message.get('description'))})
            elif subtype == 'task_notification':
                end(tid, message.get('summary'), message.get('status') == 'completed')
        elif kind == 'stream_event':
            event = message.get('event') or {}
            if event.get('type') == 'message_start':
                self.current[parent] = (event.get('message') or {}).get('id')
                self.pending.discard(parent)
            delta = event.get('delta') or {}
            if event.get('type') == 'content_block_delta' and delta.get('type') == 'text_delta':
                mid = self.current.get(parent)
                if mid:
                    self.streamed.add((parent, mid))
                self.pending.add(parent)
                events.append({'type':'text','agent':agent,'parent':parent,'delta':safe_text(delta.get('text'))})
        elif kind == 'assistant':
            msg = message.get('message') or {}
            mid = msg.get('id')
            identity = (parent, mid)
            streamed = identity in self.streamed or parent in self.pending
            for block in msg.get('content', []):
                if not isinstance(block, dict):
                    continue
                block_key = (parent, mid, block.get('type'), block.get('id') or block.get('text'))
                if mid and block_key in self.seen_assistant:
                    continue
                if mid:
                    self.seen_assistant.add(block_key)
                if block.get('type') == 'text' and not streamed:
                    events.append({'type':'text','agent':agent,'parent':parent,
                                   'delta':safe_text(block.get('text')) + ('\n' if parent else '')})
                elif block.get('type') == 'tool_use':
                    data = block.get('input') or {}
                    if not isinstance(data, dict):
                        data = {}
                    tid, name = block.get('id'), block.get('name')
                    if name in ('Agent', 'Task') and isinstance(data.get('subagent_type'), str) and tid:
                        if tid not in self.owners:
                            self.owners[tid] = safe_text(data['subagent_type'], 80)
                            events.append({'type':'subagent_start','toolUseId':tid,'agent':self.owners[tid],
                                           'task':safe_text(data.get('description', data.get('prompt')))})
                    else:
                        detail = next((data[k] for k in ['file_path','path','pattern','command','url','query','description'] if isinstance(data.get(k), str)), '')
                        events.append({'type':'tool','agent':agent,'parent':parent,'name':safe_text(name, 150), 'detail':safe_text(detail, 120)})
            self.pending.discard(parent)
        elif kind == 'user':
            content = (message.get('message') or {}).get('content')
            for block in content if isinstance(content, list) else []:
                if isinstance(block, dict) and block.get('type') == 'tool_result':
                    tid = block.get('tool_use_id')
                    text = visible_content(block.get('content'))
                    if tid not in self.tracked and not re.match(r'^Async agent launched', text.strip(), re.I):
                        end(tid, text, not block.get('is_error'))
        elif kind == 'result':
            self.result_seen = True
            ok = message.get('subtype') == 'success' and not message.get('is_error')
            events.append({'type':'result','ok':ok,
                           'text':safe_text(message.get('result') if ok else 'Claude Code stopped: ' + str(message.get('subtype'))),
                           'costUsd':timestamp(message.get('total_cost_usd')), 'sessionId':safe_text(message.get('session_id'), 150)})
        return events


async def stop_child(process):
    # Kill entire isolated process group, including MCP/subagent grandchildren.
    for sig in (signal.SIGTERM, signal.SIGKILL):
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, sig)
        try:
            await asyncio.wait_for(process.wait(), 3)
            if sig == signal.SIGTERM:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
            return
        except asyncio.TimeoutError:
            pass


def install_claude_routes(app):
    active = set()

    async def agents(request):
        cwd = claude_cwd()
        return json_response({'enabled':os.environ.get('CLAUDE_CODE_ENABLED', 'true') != 'false',
                              'cwd':str(cwd), 'permissionMode':'default',
                              'agents':await asyncio.to_thread(file_subagents, cwd)})

    async def stream(request):
        if os.environ.get('CLAUDE_CODE_ENABLED', 'true') == 'false':
            raise BridgeError('Claude Code disabled', 503)
        args, prompt = claude_command(await request_body(request))
        if len(active) >= 2:
            raise BridgeError('Two Claude calls are already active', 429)
        token = object()
        active.add(token)
        process = None
        drain_task = read_task = None
        response = web.StreamResponse(headers={'Content-Type':'text/event-stream; charset=utf-8',
                                               'Cache-Control':'no-cache, no-transform', 'X-Accel-Buffering':'no'})
        async def emit(event):
            await response.write(('data: ' + json.dumps(event, ensure_ascii=False, allow_nan=False) + '\n\n').encode())
        try:
            cwd = claude_cwd()
            cwd.mkdir(parents=True, exist_ok=True, mode=0o700)
            process = await asyncio.create_subprocess_exec(*args, stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=str(cwd),
                env=claude_child_env(), start_new_session=True, limit=2000000)
            await response.prepare(request)
            async def discard_stderr():
                while await process.stderr.read(8192):
                    pass  # stderr can contain OAuth/token URLs; never return/log it
            drain_task = asyncio.create_task(discard_stderr())
            async with asyncio.timeout(800):
                process.stdin.write(prompt.encode('utf-8'))
                await process.stdin.drain()
                process.stdin.close()
                mapper = ClaudeEvents()
                while True:
                    if request.transport is None or request.transport.is_closing():
                        raise ConnectionResetError()
                    if read_task is None:
                        read_task = asyncio.create_task(process.stdout.readline())
                    completed, _ = await asyncio.wait({read_task}, timeout=1)
                    if not completed:
                        await response.write(b': keepalive\n\n')
                        continue
                    line = read_task.result()
                    read_task = None
                    if not line:
                        break
                    try:
                        message = json.loads(line)
                    except ValueError:
                        continue
                    if isinstance(message, dict):
                        for event in mapper.handle(message):
                            await emit(event)
                code = await process.wait()
                if code != 0 or not mapper.result_seen:
                    await emit({'type':'error','message':'Claude Code exited without completion' if code else 'Claude Code returned no result'})
            await emit({'type':'done'})
        except (ConnectionError, asyncio.CancelledError):
            raise
        except Exception as exc:
            if not response.prepared:
                raise BridgeError('Unable to start Claude Code', 503) from None
            with contextlib.suppress(ConnectionError):
                await emit({'type':'error', 'message':'Claude Code timed out' if isinstance(exc, TimeoutError) else 'Claude Code stream failed'})
                await emit({'type':'done'})
        finally:
            if process:
                await asyncio.shield(stop_child(process))
            for task in (drain_task, read_task):
                if task:
                    task.cancel()
                    with contextlib.suppress(asyncio.CancelledError, Exception):
                        await task
            active.discard(token)
        return response

    app.router.add_get('/claude/agents', agents)
    app.router.add_post('/claude', stream)


def make_app(broker, key):
    if not isinstance(key, str) or len(key) < 32:
        raise BridgeError('ARKLYN_BRIDGE_KEY must contain at least 32 characters', 503)

    @web.middleware
    async def protection(request, handler):
        try:
            if not request.remote or not ipaddress.ip_address(request.remote).is_loopback:
                raise BridgeError('Loopback connections only', 403)
            provided = request.headers.get('Authorization', '').encode('utf-8')
            if not hmac.compare_digest(provided, ('Bearer ' + key).encode('utf-8')):
                raise BridgeError('Unauthorized', 401)
            return await handler(request)
        except BridgeError as exc:
            return json_response({'ok': False, 'error': str(exc)}, exc.status)
        except web.HTTPException:
            raise
        except Exception as exc:
            import logging
            logging.error('Bridge request failed: %s: %s', type(exc).__name__, safe_text(str(exc), 300))
            return json_response({'ok': False, 'error': 'Bridge operation unavailable'}, 503)

    app = web.Application(middlewares=[protection], client_max_size=200000)

    async def health(request):
        return json_response({'status': 'ok' if broker.group is not None else 'degraded',
                              'telegram': broker.client is not None, 'groupId': str(GROUP_ID),
                              'claude': Path('/usr/bin/claude').is_file()})

    async def snapshot(request):
        return json_response(await broker.snapshot())

    async def send(request):
        body = await request_body(request)
        if set(body) - {'roomId', 'text'}:
            raise BridgeError('Unexpected send fields')
        return json_response(await broker.send(body.get('roomId'), body.get('text')))

    app.router.add_get('/health', health)
    app.router.add_get('/snapshot', snapshot)
    app.router.add_post('/send', send)
    install_claude_routes(app)
    return app


async def application():
    key = os.environ.get('ARKLYN_BRIDGE_KEY', '')
    broker = Broker()
    app = make_app(broker, key)
    async def cleanup(app):
        try:
            yield
        finally:
            await broker.close()
    app.cleanup_ctx.append(cleanup)
    try:
        await asyncio.wait_for(broker.start(), timeout=90)
    except Exception:
        await broker.close()
        # Do not expose credentials through exception text/tracebacks.
        raise BridgeError('Telegram bridge startup failed; verify session, scope and network', 503) from None
    return app


if __name__ == '__main__':
    import logging
    os.umask(0o077)
    logging.getLogger('telethon').setLevel(logging.CRITICAL)
    try:
        web.run_app(application(), host='127.0.0.1', port=8643, access_log=None,
                    print=None, handler_cancellation=True, shutdown_timeout=10)
    except BridgeError as exc:
        raise SystemExit(str(exc)) from None
