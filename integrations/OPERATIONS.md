# Arklyn Office — deployed server operations

## Actual deployment
- URL: `https://office.arklyn.ir`.
- Source: `/opt/arklyn-office`; web build is Next.js standalone.
- Web daemon `arklyn-office.service`: unprivileged `arklyn-office` OS account, `127.0.0.1:3101`, existing Nginx proxy and Let's Encrypt certificate.
- Internal `arklyn-office-hermes-api.service`: installed Hermes API adapter only on `127.0.0.1:8642`, default profile `/root/.hermes`. It does not start a second Telegram poller or replace/restart the existing Hermes gateway.
- Internal `arklyn-office-bridge.service`: authenticated loopback `127.0.0.1:8643`, canonical Telegram messages and server-side Claude CLI. Independent Claude rooms use `/var/lib/arklyn-office/workspace`, normal permission mode, no bypass.
- Secrets: root-only `/etc/arklyn-office/web.env` and `backend.env`. Never commit, print, or share these files. Login is delivered privately to the owner; do not rerun `deliver_login.py` needlessly.
- Persistent private Telethon session: `/var/lib/arklyn-office/telegram.session`, mode0600. The original owner session is never modified.

## Connected group boundaries
Only Arklin/Arklyn Team `-1004374108988` and owner `1763778996` are enabled. Other groups are not projected into Office.
- Hermes `@HoMoExBot`: Office sends with an explicit Telegram mention entity to the existing gateway. Original profile/model/session continuity stays under that gateway.
- Claude Code `@ClaudeCode_pro_bot`: added to this group with basic administrator status only to receive ordinary addressed messages (no delete/invite/pin/promote/ban/topic-management permissions). Scoped middleware only admits the owner's explicit mentions/replies, rejects bot loops, and serializes per-topic execution.
- Existing Claude Workspace group routing remains intact. New Team sessions never inherit or replace its global active session. Bot source backup: `/root/claude_bot/backups/bot.before-arklyn-office.py`. The drop-in `/etc/systemd/system/claude-bot.service.d/arklyn-office.conf` only suppresses restart announcements.
- General may arrive as missing message_thread_id; its bot state key is `_0` while the Office topic is `1`.
- Connected rooms are authoritative views, not local editable copies; local clear/delete/backend/team changes are guarded. Browser schedules cannot silently inject into connected group topics. Office-only teams/preferences/schedules retain the original browser-local storage semantics.

## Verify
```
python3 /opt/arklyn-office/integrations/verify_office.py
/root/.telegram_env/bin/python -m unittest discover -s /opt/arklyn-office/integrations -p test_bridge.py -v
/root/.telegram_env/bin/python /opt/arklyn-office/integrations/test_claude_routing.py
uv run --with playwright python /opt/arklyn-office/integrations/qa_browser.py
```
`verify_telegram.py` sends real connectivity messages in General; run only when a real chat test is intended. Browser QA temporarily maps the hostname to loopback in an isolated Chromium process, so it verifies the deployed UI and TLS, not global DNS propagation.

## Status and logs
```
systemctl status arklyn-office arklyn-office-bridge arklyn-office-hermes-api
journalctl -u arklyn-office.service -n 50 --no-pager
journalctl -u arklyn-office-bridge.service -n 50 --no-pager
journalctl -u arklyn-office-hermes-api.service -n 50 --no-pager
```

## Updating this deployment
Do not run the generic Docker/Caddy `deploy/setup.sh` against this existing Nginx/systemd deployment. Checkpoint source in Git, preserve `/etc/arklyn-office`, run tests, then build as the app user:
```
runuser -u arklyn-office -- env HOME=/var/lib/arklyn-office NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1200 npm --prefix /opt/arklyn-office run build -- --webpack
cp -a /opt/arklyn-office/.next/static/. /opt/arklyn-office/.next/standalone/.next/static/
cp -a /opt/arklyn-office/public/. /opt/arklyn-office/.next/standalone/public/
systemctl restart arklyn-office.service
```
For Python bridge changes restart only `arklyn-office-bridge.service`; for scoped bot-source changes run its routing tests and restart only `claude-bot.service`. Never restart the live Hermes gateway as part of an Office frontend deployment.

## Live topic contract
- One canonical `tg-topic-N` room per actual forum topic, ordered by latest Telegram message date/ID. Existing legacy send aliases remain accepted; topic 7785 is only relabeled in the browser.
- The copied user session receives MTProto new/edit/delete events. `/stream` is an authenticated SSE feed; the client reconnects and only uses bounded polling as a fallback. Never add a second Bot API poller.
- `/history?roomId=tg-topic-N&before=ID` reads only the selected topic and paginates older messages. General starts at its own latest message in group history; its cursor skips already scanned group windows.
- Canonical message IDs, sender identities, captions and attachment metadata are used, not internal model transcripts. Actual file/photo bytes are not served yet.
- The private bounded SQLite cache is `/var/lib/arklyn-office/private/threads.sqlite` (root0700 parent, root0600 file). Keep tombstones for evicted messages and live edits outside the latest history window. Use Telegram edit timestamps to reject stale history overwrites.
- The shared Telegram office uses ONE character per selected topic, named exactly after the Telegram topic. Native bot/worker descriptors remain routing and activity metadata, not scene characters. Clicking a topic character opens its own canonical thread; the actual Hermes/Claude send target remains separate. Independent local rooms keep their agent-based scenes.
- Client loading flags are transient: derive them from live request controllers, not browser storage, so interrupted history requests cannot permanently block a reopened thread.
- Browser-local `visibleTopicIds` controls the office, Room list and Lounge: undefined means all; an empty array means none. Hide without deleting data. Paginate selected scene topics in groups of 12 to avoid overlapping seats; keep appearance and seating keyed to numeric topic identity, not recency. Raw topic names are used in scene/selector/list; Hojat's Team is a header-only alias for topic7785.
- Telegram rooms use occupied-seat camera fitting and clamped labels. Preserve selection and loaded older pages while new messages reorder the Room list.
- Explicit Tailwind `@source` paths cover components/lib. If fresh utilities are absent despite correct sources, verify the generated CSS and rebuild with only this project's stale Webpack cache moved aside; do not mistake a cached successful build for updated CSS.
- Browser API requests in Playwright must use `page.evaluate(fetch(...))` when Chromium uses a hostname-to-loopback override; APIRequestContext ignores that browser mapping and may expose cookies in exception traces.

Additional checks:
```
/root/.telegram_env/bin/python -m unittest discover -s /opt/arklyn-office/integrations -p 'test*bridge.py' -v
/root/.telegram_env/bin/python -m unittest discover -s /opt/arklyn-office/integrations -p test_runtime_agents.py -v
node /opt/arklyn-office/integrations/run_topic_tests.cjs
node /opt/arklyn-office/integrations/run_topic_tests.cjs ../lib/topic-office.test.ts
uv run --with playwright python /opt/arklyn-office/integrations/qa_topic_selection.py
uv run --with playwright python /opt/arklyn-office/integrations/qa_topics.py
```
`qa_topics.py` verifies a real temporary bot message, its edit and its deletion without requesting a model turn. It removes exactly its own diagnostic message. Compare topic counts with the actual API, not old fixed totals.

## Integration invariants
- Client timestamps are milliseconds; Python database/Telegram timestamps must be converted.
- POST messageId equals the canonical Telegram snapshot ID exactly. Database IDs are not delivery acknowledgements.
- Fetch one bounded group-history batch shared across rooms, not GetReplies per room per browser tick. Cache it and serialize refresh; otherwise Telegram FloodWait will break sync.
- Preserve explicit `MessageEntityMention` when sending. Plain `@username` characters are not equivalent to Telegram mention entities.
- Keep stderr, OAuth values, bot-token URLs, raw tool/reasoning envelopes and hidden DB messages out of HTTP responses and logs.

## DNS
Query every delegated nameserver when a new hostname intermittently returns NXDOMAIN. A stale authoritative `dns4.mizbanfadns.net` zone can disagree with dns1–dns3 even after TLS succeeds. DNS provider cluster synchronization is outside this deployment; never replace the owner's records or global server resolvers to conceal that issue.
