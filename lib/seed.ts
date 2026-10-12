import type { Agent, AgentLook, AgentSource, Backend, OfficeState, Room } from "./types";

let counter = 0;
export const uid = (p = "id") =>
  `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const look = (l: Partial<AgentLook>): AgentLook => ({
  skin: "#f6c9a8", hair: "#7a4a2b", hairStyle: "short", shirt: "#3f7d5a",
  accent: "#f08a6c", pants: "#e9e1d3", glasses: false, ...l,
});

export const LOOK_PRESETS: AgentLook[] = [
  look({ hair: "#8a5532", hairStyle: "short", shirt: "#3f7d5a", accent: "#ef8b6e", pants: "#ece4d6", glasses: true }),
  look({ hair: "#f4dfae", hairStyle: "curly", shirt: "#f3d66b", accent: "#f6e7a6", pants: "#efe8d8" }),
  look({ hair: "#f2733a", hairStyle: "fluffy", shirt: "#e9679a", accent: "#f4a6c4", pants: "#8b96c9", glasses: true }),
  look({ skin: "#8d5a3b", hair: "#2a1d18", hairStyle: "bun", shirt: "#f4d36b", accent: "#7b8fd6", pants: "#5b6b8f", glasses: true }),
  look({ skin: "#f2c6a0", hair: "#2f2a33", hairStyle: "bob", shirt: "#6c8ee8", accent: "#b9c8f6", pants: "#3d4660" }),
  look({ skin: "#c98f6a", hair: "#3b2a22", hairStyle: "buzz", shirt: "#ef7b5b", accent: "#ffd2c2", pants: "#4a5568" }),
];

const agent = (
  name: string, title: string, persona: string, lookIdx: number,
  isLead = false, source?: AgentSource, subagentId?: string,
): Agent => ({
  id: uid("ag"), name, title, persona, isLead, status: "idle",
  look: LOOK_PRESETS[lookIdx % LOOK_PRESETS.length], source, subagentId,
});

/** Stable look for a subagent that shows up at runtime. */
export function lookFor(key: string): AgentLook {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return LOOK_PRESETS[h % LOOK_PRESETS.length];
}

export const slug = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";

const emptyRoom = (name: string, emoji: string, agents: Agent[], backend: Backend = "hermes"): Room => ({
  backend, id: uid("room"), name, emoji, agents,
  messages: [], steps: [], approvals: [], outputs: [], startedAt: Date.now(), unread: false,
});

/** Independent workspaces only; connected rooms are supplied by the broker. */
export function seedState(): OfficeState {
  const hermes = agent("Hermes", "Lead · Generalist", "You coordinate work and delegate when needed.", 0, true);
  const rooms: Room[] = [
    emptyRoom("Arklyn Workspace", "🏡", [hermes]),
    emptyRoom("Claude Code crew", "🧑‍💻", [
      agent("Claude Code", "Main thread · Orchestrator", "You coordinate the work and delegate to subagents.", 4, true),
      agent("Explore", "Built-in · Codebase search", "", 1, false, "builtin", "Explore"),
      agent("Plan", "Built-in · Architect", "", 3, false, "builtin", "Plan"),
      agent("Rex", "Code Reviewer", "You review code changes for bugs, security issues and readability. Be specific and cite file:line.", 2, false, "office", "reviewer"),
    ], "claude-code"),
  ];
  return {
    rooms, activeRoomId: rooms[0].id, view: "room", selectedAgentId: hermes.id, targetAgentId: hermes.id,
    rightTab: "inspector", schedules: [], theme: "cream", roomsCollapsed: false,
    panelCollapsed: false, focusOutputId: null, fx: [],
  };
}
