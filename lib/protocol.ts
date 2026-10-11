import type { Agent, Message, Room } from "./types";

/**
 * Office protocol: hermes-agent embeds these markers in its replies. They are
 * hidden from the chat and drive the 3D office (steps, approvals, hand-offs).
 */
export const PROTOCOL = `Office protocol — put these markers on their own lines when relevant. They are hidden from the chat and drive the office UI:
[[STEP: short title | one-line description]]  before each meaningful step of work you take.
[[OUTPUT: title]]  when your reply contains a deliverable (draft, plan, code, report). Put the deliverable right after the marker.
[[NEEDS_APPROVAL: one-sentence summary]]  when the human must approve something before it goes live.
[[DELEGATE: AgentName | task]]  hand a sub-task to a teammate (lead only).`;

const MARKERS = `Office protocol — put these markers on their own lines when relevant. They are hidden from the chat and drive the office UI:
[[STEP: short title | one-line description]]  before each meaningful step of work you take.
[[OUTPUT: title]]  when your reply contains a deliverable (draft, plan, code, report). Put the deliverable right after the marker.
[[NEEDS_APPROVAL: one-sentence summary]]  when the human must approve something before it goes live.`;

export const subagentType = (a: Agent) => a.subagentId || a.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Appended to Claude Code's own system prompt for the main thread (the room's lead). */
export function claudeCodeSystemAppend(room: Room, lead: Agent): string {
  const mates = room.agents
    .filter((a) => a.id !== lead.id)
    .map((a) => `- ${a.name} → subagent_type "${subagentType(a)}": ${a.title}`)
    .join("\n");
  return [
    `In this session you are ${lead.name}, ${lead.title}, leading the "${room.name}" team in a virtual office. ${lead.persona}`,
    mates ? `Your teammates are Claude Code subagents. Delegate work to them with the Agent tool:\n${mates}` : "",
    "Delegate whenever a teammate fits the task; run independent sub-tasks in parallel. Reply concisely in the language the human writes in.",
    MARKERS,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Subagent definitions for teammates defined in the office (file and built-in ones already exist in Claude Code). */
export function claudeCodeSubagents(room: Room, lead: Agent) {
  const out: Record<string, { description: string; prompt: string }> = {};
  for (const a of room.agents) {
    if (a.id === lead.id || (a.source && a.source !== "office")) continue;
    out[subagentType(a)] = {
      description: `${a.name} — ${a.title}. ${a.persona}`.trim(),
      prompt: [`You are ${a.name}, ${a.title}, on the "${room.name}" team.`, a.persona, MARKERS].filter(Boolean).join("\n\n"),
    };
  }
  return out;
}

export function systemPrompt(room: Room, agent: Agent): string {
  const roster = room.agents
    .map((a) => `- ${a.name}${a.isLead ? " (LEAD)" : ""}: ${a.title}`)
    .join("\n");
  return [
    `You are ${agent.name}, ${agent.title}, working on the "${room.name}" team inside a virtual office.`,
    agent.persona,
    `Your team:\n${roster}`,
    `You talk with your human manager through the team chat. Be concise and reply in the language the human writes in.`,
    PROTOCOL,
    agent.isLead
      ? "As the lead, delegate parts of bigger tasks to teammates with DELEGATE markers."
      : "Do not delegate; do the work yourself.",
  ].join("\n\n");
}

/** Converts the room thread into OpenAI chat messages from the point of view of `agent`. */
export function toChatMessages(room: Room, agent: Agent, extra?: string) {
  const name = (id?: string) => room.agents.find((a) => a.id === id)?.name ?? "Agent";
  const history = room.messages
    .filter((m: Message) => !m.streaming && !m.error && m.role !== "system")
    .slice(-30)
    .map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : m.agentId === agent.id
          ? { role: "assistant" as const, content: m.content }
          : { role: "user" as const, content: `[${name(m.agentId)} said]: ${m.content}` },
    );
  const msgs = [{ role: "system" as const, content: systemPrompt(room, agent) }, ...history];
  if (extra) msgs.push({ role: "user", content: extra });
  return msgs;
}

export type Directive =
  | { kind: "step"; title: string; description: string }
  | { kind: "output"; title: string }
  | { kind: "approval"; text: string }
  | { kind: "delegate"; agent: string; task: string };

const RE = /\[\[\s*(STEP|OUTPUT|NEEDS_APPROVAL|DELEGATE)\s*:\s*([\s\S]*?)\]\]/g;

export function parseDirectives(text: string): Directive[] {
  const out: Directive[] = [];
  for (const m of text.matchAll(RE)) {
    const [a, b = ""] = m[2].split("|").map((s) => s.trim());
    if (m[1] === "STEP") out.push({ kind: "step", title: a, description: b });
    else if (m[1] === "OUTPUT") out.push({ kind: "output", title: a });
    else if (m[1] === "NEEDS_APPROVAL") out.push({ kind: "approval", text: m[2].trim() });
    else out.push({ kind: "delegate", agent: a, task: b || a });
  }
  return out;
}

/** Removes markers (complete or still streaming) from visible text. */
export function stripDirectives(text: string): string {
  return text
    .replace(RE, "")
    .replace(/\[\[[^\]]*$/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Text that follows the OUTPUT marker, i.e. the deliverable. */
export function extractOutput(text: string): string | null {
  const m = /\[\[\s*OUTPUT\s*:[^\]]*\]\]([\s\S]*)/.exec(text);
  return m ? stripDirectives(m[1]) : null;
}
