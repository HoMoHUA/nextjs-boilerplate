"""Read-only/local broker tests; never sends Telegram test messages."""
import asyncio
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
import bridge


def entry(topic='11', sid='session1', user=bridge.USER_ID, group=bridge.GROUP_ID, updated=100):
    key = f'agent:main:telegram:group:{group}:{topic}:{user}'
    return key, {'session_key': key, 'session_id': sid, 'updated_at': updated,
                 'origin': {'platform': 'telegram', 'chat_type': 'group', 'chat_id': str(group),
                            'thread_id': topic, 'user_id': str(user)}}


class ScopeTests(unittest.TestCase):
    def test_index_selects_latest_owner_session_per_known_topic(self):
        good = entry(); latest = entry(sid='session2', updated=200)
        legacy_key, legacy = entry(sid='old', updated=300)
        legacy_key = legacy_key.rsplit(':', 1)[0]; legacy['session_key'] = legacy_key
        data = dict([good, (legacy_key, legacy), entry(group=-1004381135749), entry(user=55), entry(topic='99')])
        # A latest owner routing entry wins over legacy even when legacy is newer.
        data[latest[0]] = latest[1]
        self.assertEqual(bridge.select_sessions(data, {'11'}), {'11': latest[1]})
        latest[1]['origin']['chat_id'] = '-1004381135749'
        self.assertEqual(bridge.select_sessions({latest[0]: latest[1]}, {'11'}), {})


class SafetyTests(unittest.TestCase):
    def test_malformed_rooms_and_slash_commands_rejected(self):
        for rid in ['tg-hermes-0', 'tg-hermes-01', 'tg-hermes--1', 'tg-hermes-11x',
                    'tg-claude-11', 'tg-hermes-11\n', 'tg-hermes-2147483648', None]:
            with self.subTest(rid=rid), self.assertRaises(bridge.BridgeError):
                bridge.parse_room(rid)
        self.assertEqual(bridge.parse_room('tg-claude-code-11'), ('claude-code', '11'))
        for text in ['/reset', '  /model x', '@bot /reset', 'hello\n/reset', '', 12, 'x' * 4096]:
            with self.subTest(text=str(text)[:20]), self.assertRaises(bridge.BridgeError):
                bridge.send_text(text, 'validbot')
        self.assertEqual(bridge.send_text('plain **text**', 'validbot'), '@validbot plain **text**')

    def test_normalization_redaction_dedupe_and_caps_are_deterministic(self):
        secret = 'sk-' + 'A' * 40
        rows = [{'id': str(i), 'role': 'user', 'content': f'msg{i}', 'timestamp': i} for i in range(90)]
        rows += [{'id': 'secret', 'role': 'assistant', 'content': json.dumps([
                    {'type': 'text', 'text': 'API_KEY=foobar Authorization: Bearer abc.def.ghi ' + secret},
                    {'type': 'thinking', 'thinking': 'PRIVATE_THOUGHT'}]), 'timestamp': 100},
                 {'id': 'tool', 'role': 'tool', 'content': 'HIDDEN_TOOL', 'timestamp': 101},
                 {'id': 'long', 'role': 'assistant', 'content': 'x' * 13000, 'timestamp': 102},
                 {'id': 'nan', 'role': 'user', 'content': 'safe', 'timestamp': float('nan')}]
        rows += [rows[0], rows[-4]]
        first = bridge.normalize_messages(rows)
        self.assertEqual(first, bridge.normalize_messages(list(reversed(rows))))
        self.assertEqual(len(first), 80)
        encoded = json.dumps(first, allow_nan=False)
        for bad in [secret, 'foobar', 'abc.def.ghi', 'PRIVATE_THOUGHT', 'HIDDEN_TOOL']:
            self.assertNotIn(bad, encoded)
        self.assertTrue(all(len(m['content']) <= 12000 for m in first))
        self.assertEqual(len({m['id'] for m in first}), len(first))
        for s in ['1234567890:' + 'A' * 35, 'password="my secret"', 'https://u:pw@host/',
                  '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----']:
            self.assertNotEqual(bridge.redact(s), s)

    def test_readonly_db_and_index_scope_both_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'state.db'
            c = sqlite3.connect(path)
            c.executescript('''CREATE TABLE sessions (id TEXT, source TEXT, user_id TEXT, chat_id TEXT,
                 thread_id TEXT, hidden INTEGER, model TEXT);
                 CREATE TABLE messages (id INTEGER, session_id TEXT, role TEXT, content TEXT,
                 timestamp REAL, active INTEGER, _compressed_summary INTEGER, display_kind TEXT);''')
            c.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?)',
                      ('session1', 'telegram', str(bridge.USER_ID), str(bridge.GROUP_ID), '11', 0, 'model1'))
            for i, role, active, kind in [(1,'user',1,None),(2,'assistant',1,None),
                                         (3,'tool',1,None),(4,'assistant',0,None),(5,'user',1,'hidden')]:
                c.execute('INSERT INTO messages VALUES (?,?,?,?,?,?,?,?)',
                          (i,'session1',role,'visible' if i < 3 else 'FORBIDDEN',i,active,0,kind))
            c.commit(); c.close()
            data = bridge.read_hermes(path, {'11': entry()[1]})
            self.assertEqual([m['role'] for m in data['11']['messages']], ['user','agent'])
            c = sqlite3.connect(path); c.execute('UPDATE sessions SET chat_id=?', ('-1004381135749',)); c.commit(); c.close()
            self.assertEqual(bridge.read_hermes(path, {'11': entry()[1]}), {})

    def test_session_copy_is_private_and_source_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, dst = Path(tmp) / 'original.session', Path(tmp) / 'copy.session'
            c = sqlite3.connect(src); c.execute('CREATE TABLE x (v TEXT)'); c.execute("INSERT INTO x VALUES ('value')"); c.commit(); c.close()
            before = src.read_bytes()
            bridge.copy_session(src, dst)
            self.assertEqual(dst.stat().st_mode & 0o777, 0o600)
            self.assertEqual(src.read_bytes(), before)
            self.assertEqual(sqlite3.connect(dst).execute('SELECT v FROM x').fetchone()[0], 'value')


class BrokerTests(unittest.IsolatedAsyncioTestCase):
    def make_broker(self):
        broker = bridge.Broker()
        broker.client = SimpleNamespace(
            send_message=AsyncMock(return_value=SimpleNamespace(id=123)),
            get_messages=AsyncMock(return_value=SimpleNamespace(id=123, raw_text='@hermesbot hello',
                reply_to=SimpleNamespace(reply_to_top_id=11, reply_to_msg_id=11))))
        broker.group = SimpleNamespace(id=4374108988, title='Arklin Team')
        broker.topics = {'1': {'name': 'General'}, '11': {'name': 'Design'}}
        broker.bots = [{'backend': 'hermes', 'username': 'hermesbot', 'ok': True},
                       {'backend': 'claude-code', 'username': 'claudebot', 'ok': False}]
        broker.refresh_forum = AsyncMock()
        return broker

    async def test_send_only_known_room_and_approved_group(self):
        b = self.make_broker()
        for room in ['tg-hermes-99', 'tg-claude-code-11']:
            with self.assertRaises(bridge.BridgeError):
                await b.send(room, 'hello')
        b.client.send_message.assert_not_awaited()
        result = await b.send('tg-hermes-11', 'hello')
        self.assertEqual(result, {'ok': True, 'messageId': '123', 'topicId': '11', 'roomId': 'tg-hermes-11'})
        b.client.send_message.assert_awaited_once_with(bridge.GROUP_ID, '@hermesbot hello', reply_to=11, parse_mode=None, formatting_entities=[bridge.types.MessageEntityMention(offset=0, length=10)])
        b.client.get_messages.assert_awaited_once_with(bridge.GROUP_ID, ids=123)
        b.client.send_message.reset_mock()
        b.client.get_messages.return_value.reply_to = None
        await b.send('tg-hermes-1', 'hello')
        b.client.send_message.assert_awaited_once_with(bridge.GROUP_ID, '@hermesbot hello', reply_to=None, parse_mode=None, formatting_entities=[bridge.types.MessageEntityMention(offset=0, length=10)])
        b.group.id = 4381135749
        with self.assertRaises(bridge.BridgeError):
            await b.send('tg-hermes-11', 'hello')

    async def test_snapshot_no_claude_rooms_without_membership(self):
        b = self.make_broker()
        b.read_local = lambda: ({}, {})
        snap = await b.snapshot()
        self.assertEqual([r['id'] for r in snap['rooms']], ['tg-topic-1','tg-topic-11'])
        self.assertTrue(all([a['id'] for a in r['agents']] == ['hermes'] for r in snap['rooms']))
        self.assertEqual(snap['group'], {'id': str(bridge.GROUP_ID), 'name': 'Arklin Team'})
        json.dumps(snap, allow_nan=False)
        self.assertIs(snap, await b.snapshot())

    async def test_full_forum_pagination_includes_general(self):
        b = self.make_broker()
        def topic(i):
            return SimpleNamespace(id=i, title=f'Topic{i}', date=datetime(2026,1,1,tzinfo=timezone.utc), top_message=i+100, closed=False)
        pages = [SimpleNamespace(topics=[topic(i) for i in range(2,102)], messages=[], count=101, order_by_create_date=True),
                 SimpleNamespace(topics=[topic(102)], messages=[], count=101, order_by_create_date=True),
                 SimpleNamespace(topics=[topic(1)], messages=[])]
        client = AsyncMock(side_effect=pages)
        topics = await bridge.list_topics(client, b.group)
        self.assertEqual(len(topics), 102)
        self.assertIn('1', topics)
        request = client.await_args_list[1].args[0]
        self.assertEqual(request.offset_topic, 101)
        self.assertEqual(request.offset_id, 201)

    async def test_http_bearer_and_invalid_json(self):
        from aiohttp.test_utils import TestClient, TestServer
        b = self.make_broker(); b.read_local = lambda: ({}, {})
        app = bridge.make_app(b, 'a' * 32)
        async with TestClient(TestServer(app)) as client:
            self.assertEqual((await client.get('/health')).status, 401)
            headers = {'Authorization': 'Bearer ' + 'a' * 32}
            health = await client.get('/health', headers=headers)
            self.assertEqual(health.status, 200)
            self.assertEqual((await health.json())['status'], 'ok')
            self.assertEqual((await client.post('/send', headers=headers, data='oops')).status, 400)
            self.assertEqual((await client.post('/send', headers=headers, json={'roomId':'tg-hermes-99','text':'hi'})).status, 404)


class ClaudeTests(unittest.IsolatedAsyncioTestCase):
    def test_cli_args_are_safe_and_resume_is_uuid_only(self):
        body = {'prompt': '--dangerously-skip-permissions; whoami', 'systemAppend': 'system',
                'subagents': {'reviewer': {'description':'Reviews', 'prompt':'Review code'}},
                'sessionId': '00112233-4455-6677-8899-aabbccddeeff'}
        args, prompt = bridge.claude_command(body)
        self.assertEqual(args[0], '/usr/bin/claude')
        self.assertEqual(prompt, body['prompt'])
        self.assertNotIn(body['prompt'], args)
        self.assertEqual(args[args.index('--permission-mode')+1], 'default')
        self.assertEqual(args[args.index('--max-turns')+1], '40')
        self.assertIn('--resume', args)
        self.assertNotIn('--dangerously-skip-permissions', args)
        for extra in [{'cwd':'/root'}, {'sessionId':'../../bad'}, {'subagents':{'a':{'prompt':'p','description':'d','tools':['Bash']}}}]:
            with self.assertRaises(bridge.BridgeError):
                bridge.claude_command({**body, **extra})
        env = bridge.claude_child_env()
        self.assertEqual(env['HOME'], '/root')
        self.assertNotIn('ARKLYN_BRIDGE_KEY', env)

    def test_stream_mapping_dedupes_text_and_tracks_subagents(self):
        mapper = bridge.ClaudeEvents()
        events = []
        def handle(value): events.extend(mapper.handle(value))
        handle({'type':'system','subtype':'init','session_id':'sid','agents':['reviewer']})
        handle({'type':'stream_event','event':{'type':'message_start','message':{'id':'m1'}}})
        handle({'type':'stream_event','event':{'type':'content_block_delta','delta':{'type':'text_delta','text':'hello'}}})
        handle({'type':'assistant','message':{'id':'m1','content':[{'type':'text','text':'hello'},
            {'type':'thinking','thinking':'HIDDEN'}, {'type':'tool_use','id':'t1','name':'Agent',
            'input':{'subagent_type':'reviewer','description':'Check'}}]}})
        handle({'type':'assistant','parent_tool_use_id':'t1','message':{'id':'m2','content':[{'type':'text','text':'nested'}]}})
        handle({'type':'user','message':{'content':[{'type':'tool_result','tool_use_id':'t1','content':'done'}]}})
        handle({'type':'system','subtype':'task_notification','tool_use_id':'t1','summary':'done','status':'completed'})
        handle({'type':'result','subtype':'success','result':'hello','total_cost_usd':0.1,'session_id':'sid'})
        self.assertEqual([e['delta'] for e in events if e['type']=='text'], ['hello','nested\n'])
        self.assertEqual(len([e for e in events if e['type']=='subagent_end']), 1)
        self.assertEqual(events[3]['agent'], 'reviewer')
        self.assertNotIn('HIDDEN', json.dumps(events))
        json.dumps(events, allow_nan=False)

    def test_repeated_assistant_id_preserves_distinct_tool_blocks(self):
        mapper = bridge.ClaudeEvents()
        first = {'type':'assistant','message':{'id':'same','content':[{'type':'text','text':'one'}]}}
        second = {'type':'assistant','message':{'id':'same','content':[{'type':'tool_use','id':'tool1','name':'Read','input':{'path':'file'}}]}}
        self.assertEqual(mapper.handle(first)[0]['type'], 'text')
        self.assertEqual(mapper.handle(second)[0]['type'], 'tool')
        self.assertEqual(mapper.handle(second), [])

    async def test_sse_cap_two_and_disconnect_kills_child(self):
        from aiohttp.test_utils import TestClient, TestServer
        from unittest.mock import patch
        import sys
        b = BrokerTests().make_broker()
        children = []
        original = asyncio.create_subprocess_exec
        async def spawn(*args, **kwargs):
            proc = await original(*args, **kwargs)
            children.append(proc)
            return proc
        headers = {'Authorization':'Bearer ' + 'a' * 32}
        with tempfile.TemporaryDirectory() as tmp, patch.dict(bridge.os.environ, {'CLAUDE_CODE_CWD':tmp}):
            app = bridge.make_app(b, 'a' * 32)
            with patch.object(bridge, 'claude_command', return_value=([sys.executable,'-c','import time; time.sleep(30)'], 'fixture')), patch.object(asyncio, 'create_subprocess_exec', side_effect=spawn):
                async with TestClient(TestServer(app)) as client:
                    first = await client.post('/claude', headers=headers, json={'prompt':'fixture'})
                    second = await client.post('/claude', headers=headers, json={'prompt':'fixture'})
                    third = await client.post('/claude', headers=headers, json={'prompt':'fixture'})
                    self.assertEqual(third.status, 429)
                    self.assertEqual(len(children), 2)
                    first.close(); second.close()
                    await asyncio.wait_for(asyncio.gather(*(p.wait() for p in children)), 6)
                    self.assertTrue(all(p.returncode != 0 for p in children))

    async def test_sse_exercises_real_child_without_real_claude_prompt(self):
        from aiohttp.test_utils import TestClient, TestServer
        from unittest.mock import patch
        import sys
        b = BrokerTests().make_broker()
        b.read_local = lambda: ({}, {})
        headers = {'Authorization': 'Bearer ' + 'a' * 32}
        # Exercise subprocess pipes/SSE with a local controlled fixture, never the actual CLI.
        script = 'import sys,json; sys.stdin.read(); print(json.dumps({"type":"result","subtype":"success","result":"fixture","session_id":"sid","total_cost_usd":0}));'
        with tempfile.TemporaryDirectory() as tmp, patch.dict(bridge.os.environ, {'CLAUDE_CODE_CWD': tmp}):
            app = bridge.make_app(b, 'a' * 32)
            with patch.object(bridge, 'claude_command', return_value=([sys.executable, '-c', script], 'fixture')):
                async with TestClient(TestServer(app)) as client:
                    response = await client.post('/claude', headers=headers, json={'prompt':'fixture'})
                    self.assertEqual(response.status, 200)
                    events = [json.loads(x[6:]) for x in (await response.text()).splitlines() if x.startswith('data: ')]
                    self.assertEqual([e['type'] for e in events], ['result','done'])
                    self.assertEqual(events[0]['text'], 'fixture')
                    cfg = await (await client.get('/claude/agents', headers=headers)).json()
                    self.assertEqual(cfg['permissionMode'], 'default')
                    self.assertEqual(cfg['cwd'], tmp)


from datetime import datetime, timezone
if __name__ == '__main__':
    unittest.main()
