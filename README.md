# Arklyn Office

A living 3D virtual office (Next.js + three.js / react-three-fiber) for your AI agent teams. Each chat room is a team: chibi agents sit at their desks, type while they work, walk over to hand off tasks, ask for your approval with a speech bubble, and celebrate when you approve. The dashboard shows what every agent is actually doing, their outputs and the full thread.

Two backends, chosen per room:

| Backend | What runs | Delegation |
| --- | --- | --- |
| **hermes-agent** | Your [hermes-agent](https://github.com/NousResearch/hermes-agent) through its OpenAI-compatible API server | The lead hands tasks to teammates with `[[DELEGATE: …]]` markers |
| **Claude Code** | Claude Code through the [Agent SDK](https://code.claude.com/docs/en/agent-sdk) | Native **subagents**: the lead is the main thread, teammates are subagents it calls with the Agent tool |

## Documents

| File | For |
| --- | --- |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Production runbook (written so the hermes agent can execute it): server checks, DNS, hermes API server, deploy, verify, operations |
| [`docs/TELEGRAM_PROMPT.md`](docs/TELEGRAM_PROMPT.md) | Ready-to-send message for the hermes Telegram bot (Persian + English) |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Architecture, data model, design tokens, 3D scene system and step-by-step recipes for adding elements |

## Production in short

```bash
sudo deploy/setup.sh --domain office.example.com --email you@example.com --hermes-key <API_SERVER_KEY>
sudo deploy/verify.sh --domain office.example.com --password '<password>'
```

Docker + Caddy (automatic HTTPS), password login, health check at `/api/health`. Details in `docs/HANDOFF.md`.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in what you use
npm run dev                  # http://localhost:3000
```

Without any configuration, hermes rooms run in **demo** mode with simulated replies, so you can try the office right away.

### Connect hermes-agent

1. In `~/.hermes/.env`: `API_SERVER_ENABLED=true` and `API_SERVER_KEY=your-secret`
2. Start it: `hermes gateway` (listens on `http://127.0.0.1:8642`)
3. In `.env.local`: `HERMES_API_URL=http://127.0.0.1:8642/v1` and `HERMES_API_KEY=your-secret`

### Connect Claude Code (subagents)

1. Log in once with `claude` (or set `ANTHROPIC_API_KEY`) on the machine that runs the office.
2. Set `CLAUDE_CODE_CWD` to the project Claude Code should work in. Its `.claude/agents/*.md` subagents (and `~/.claude/agents/`) are loaded automatically.
3. Use the **Claude Code crew** room, or create a room and pick the *Claude Code* backend. In **Manage team** you can add built-in subagents (Explore, Plan, general-purpose), import subagents from `.claude/agents`, or define new ones (their instructions become the subagent prompt).

When Claude Code calls a subagent the room doesn't have yet, it walks into the office as a new agent. Each subagent gets its own reply, steps (every tool it uses: Read, Grep, Bash, …) and a report in **Output**. Background subagents are supported. The room keeps its Claude Code session, so follow-up messages have context. Optional: `CLAUDE_CODE_MODEL`, `CLAUDE_CODE_PERMISSION_MODE` (default `acceptEdits`), `CLAUDE_CODE_MAX_TURNS`.

The Claude Code backend needs the CLI on the machine running the app, so it is turned off automatically on serverless hosts such as Vercel.

API keys never reach the browser: the browser talks to `app/api/hermes` and `app/api/claude-code`, which call the backends server-side.

## Office markers

Agents can put these markers in their replies. They are hidden from the chat and drive the office:

| Marker | Effect |
| --- | --- |
| `[[STEP: title \| description]]` | Adds a step to “What it is actually doing” |
| `[[OUTPUT: title]]` | The text after it becomes an output in the Output tab |
| `[[NEEDS_APPROVAL: summary]]` | Shows the “Needs you” bubble with Review first / Approve (10 min timer) |
| `[[DELEGATE: Name \| task]]` | hermes rooms: the lead hands a sub-task to a teammate |

## Code map

- `components/office/OfficeScene.tsx` – the 3D office: spots, walking hand-offs, overlays
- `components/office/Character.tsx`, `Furniture.tsx`, `Effects.tsx` – agents, furniture, paper/confetti/status rings
- `components/office/Overlay.tsx` – name tags and bubbles pinned to the 3D scene
- `lib/store.ts` – state and orchestration for both backends
- `lib/protocol.ts` – prompts, subagent definitions and the marker parser
- `app/api/claude-code/route.ts` – Agent SDK bridge: turns SDK messages into office events (subagent start/finish, tools, text)
- `app/api/hermes/route.ts` – hermes-agent proxy (and demo mode)
