import { query, type AgentDefinition, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { claudeCodeConfig } from "@/lib/claude-code-server";
import type { OfficeEvent } from "@/lib/office-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

interface Body {
  prompt: string;
  systemAppend: string;
  /** Office teammates exposed as programmatic subagents (id → definition). */
  subagents: Record<string, { description: string; prompt: string }>;
  sessionId?: string;
}

const DELEGATION_TOOLS = new Set(["Agent", "Task"]);

/** Variables that would bind the spawned CLI to a parent Claude Code session (e.g. when the office runs inside one). */
const PARENT_SESSION_VARS = ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_REMOTE_SESSION_ID", "CLAUDE_CODE_CHILD_SESSION"];

function childEnv(): Record<string, string> {
  const env: Record<string, string> = { CLAUDE_AGENT_SDK_CLIENT_APP: "hermes-office/1.0" };
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !PARENT_SESSION_VARS.includes(k)) env[k] = v;
  return env;
}

/** Background subagents answer the Agent call at once with this notice; their real end is the task notification. */
const isAsyncLaunch = (text: string) => /^Async agent launched/i.test(text.trim());

function summarize(input: Record<string, unknown>): string {
  const v = input.file_path ?? input.path ?? input.pattern ?? input.command ?? input.url ?? input.query ?? input.description;
  return typeof v === "string" ? v.slice(0, 120) : "";
}

/**
 * Runs one Claude Code turn through the Agent SDK and converts its messages to
 * office events (text deltas, tool steps, subagent start/finish) streamed as SSE.
 */
export async function POST(req: Request) {
  const cfg = claudeCodeConfig();
  if (!cfg.enabled) return new Response("Claude Code backend is disabled (CLAUDE_CODE_ENABLED=false)", { status: 400 });
  const body = (await req.json()) as Body;

  const agents: Record<string, AgentDefinition> = {};
  for (const [id, a] of Object.entries(body.subagents ?? {})) agents[id] = { description: a.description, prompt: a.prompt };

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: OfficeEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      // tool_use id of an Agent/Task call → subagent name, so nested messages can be attributed
      const owners = new Map<string, string>();
      // subagents whose end is reported by a task notification (sync and background alike)
      const tracked = new Set<string>();
      const ended = new Set<string>();
      const end = (toolUseId: string, summary: string, ok: boolean) => {
        if (ended.has(toolUseId)) return;
        ended.add(toolUseId);
        send({ type: "subagent_end", toolUseId, agent: owners.get(toolUseId)!, summary, ok });
      };
      const ownerOf = (parent: string | null) => (parent ? (owners.get(parent) ?? null) : null);

      const handle = (m: SDKMessage) => {
        switch (m.type) {
          case "system":
            if (m.subtype === "init") send({ type: "session", id: m.session_id, agents: m.agents ?? [] });
            else if (m.subtype === "task_started" && m.tool_use_id && m.subagent_type) {
              tracked.add(m.tool_use_id);
              if (!owners.has(m.tool_use_id)) {
                owners.set(m.tool_use_id, m.subagent_type);
                send({ type: "subagent_start", toolUseId: m.tool_use_id, agent: m.subagent_type, task: m.description });
              }
            } else if (m.subtype === "task_progress" && m.tool_use_id && owners.has(m.tool_use_id)) {
              send({ type: "subagent_progress", toolUseId: m.tool_use_id, agent: owners.get(m.tool_use_id)!, text: m.summary || m.description, tool: m.last_tool_name });
            } else if (m.subtype === "task_notification" && m.tool_use_id && owners.has(m.tool_use_id)) {
              end(m.tool_use_id, m.summary, m.status === "completed");
            }
            break;
          case "stream_event": {
            const ev = m.event;
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta")
              send({ type: "text", agent: ownerOf(m.parent_tool_use_id), parent: m.parent_tool_use_id, delta: ev.delta.text });
            break;
          }
          case "assistant": {
            const agent = ownerOf(m.parent_tool_use_id);
            for (const block of m.message.content) {
              if (block.type === "text" && m.parent_tool_use_id) {
                // subagent text is forwarded whole (no partial stream for nested agents)
                send({ type: "text", agent, parent: m.parent_tool_use_id, delta: block.text + "\n" });
              } else if (block.type === "tool_use") {
                const input = (block.input ?? {}) as Record<string, unknown>;
                if (DELEGATION_TOOLS.has(block.name) && typeof input.subagent_type === "string") {
                  if (!owners.has(block.id)) {
                    owners.set(block.id, input.subagent_type);
                    send({ type: "subagent_start", toolUseId: block.id, agent: input.subagent_type, task: String(input.description ?? input.prompt ?? "") });
                  }
                } else send({ type: "tool", agent, parent: m.parent_tool_use_id, name: block.name, detail: summarize(input) });
              }
            }
            break;
          }
          case "user": {
            const content = m.message.content;
            if (Array.isArray(content))
              for (const block of content)
                if (block.type === "tool_result" && owners.has(block.tool_use_id)) {
                  const text = Array.isArray(block.content)
                    ? block.content.map((c) => (c.type === "text" ? c.text : "")).join("")
                    : String(block.content ?? "");
                  // tracked subagents end on their task notification (the tool result of a background one arrives at launch)
                  if (!tracked.has(block.tool_use_id) && !isAsyncLaunch(text)) end(block.tool_use_id, text.slice(0, 400), !block.is_error);
                }
            break;
          }
          case "result":
            send({
              type: "result",
              ok: m.subtype === "success",
              text: m.subtype === "success" ? m.result : `Claude Code stopped: ${m.subtype}`,
              costUsd: m.total_cost_usd,
              sessionId: m.session_id,
            });
            break;
        }
      };

      try {
        for await (const m of query({
          prompt: body.prompt,
          options: {
            cwd: cfg.cwd,
            model: cfg.model,
            permissionMode: cfg.permissionMode,
            allowDangerouslySkipPermissions: cfg.permissionMode === "bypassPermissions",
            maxTurns: cfg.maxTurns,
            systemPrompt: { type: "preset", preset: "claude_code", append: body.systemAppend },
            agents,
            settingSources: ["user", "project", "local"],
            includePartialMessages: true,
            forwardSubagentText: true,
            resume: body.sessionId,
            abortController: abort,
            env: childEnv(),
          },
        })) {
          handle(m);
        }
      } catch (err) {
        if (!abort.signal.aborted) send({ type: "error", message: (err as Error).message });
      }
      send({ type: "done" });
      controller.close();
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
