# Hermes Office

A 3D virtual office (Next.js + three.js / react-three-fiber) for your [hermes-agent](https://github.com/NousResearch/hermes-agent) team: chat rooms per team, chibi agents at their desks, a live “what it is actually doing” timeline, approval requests (“Needs you”), outputs and the full thread.

## Connect your hermes-agent

1. Enable hermes-agent’s OpenAI-compatible API server in `~/.hermes/.env`:
   ```
   API_SERVER_ENABLED=true
   API_SERVER_KEY=your-secret
   ```
2. Start the gateway: `hermes gateway` (listens on `http://127.0.0.1:8642`).
3. In this project: `cp .env.example .env.local` and set `HERMES_API_URL` / `HERMES_API_KEY`.
4. `npm install && npm run dev` → http://localhost:3000

Without `HERMES_API_URL` the office runs in **demo** mode with simulated replies. The header shows `live`, `offline` or `demo`.

The browser never sees your key: requests go through `app/api/hermes` which proxies `POST /v1/chat/completions` (streaming).

## How agents drive the office

Each agent is a persona (name, role, instructions) sent to hermes-agent as the system prompt. Agents can embed markers in their replies, which are hidden from the chat and drive the UI:

| Marker | Effect |
| --- | --- |
| `[[STEP: title \| description]]` | Adds a step to the “What it is actually doing” timeline |
| `[[OUTPUT: title]]` | The text after it becomes an output in the Output tab |
| `[[NEEDS_APPROVAL: summary]]` | Shows the “Needs you” bubble above the agent with Review first / Approve (10 min timer) |
| `[[DELEGATE: Name \| task]]` | The lead hands a sub-task to a teammate, who then runs automatically |

Protocol and prompt building live in `lib/protocol.ts`; orchestration in `lib/store.ts`.

## Features

- Rooms (teams) with create / edit / delete, Lounge overview, Schedule room (recurring prompts while the tab is open)
- Manage team: names, roles, instructions, lead, hair style, colors, glasses
- Inspector / Output / Thread panels, `@Name` mentions, file attachments (text files), stop a running agent
- Office themes, state saved in localStorage
