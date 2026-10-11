import type { Agent, AgentLook, OfficeState, Room } from "./types";

let counter = 0;
export const uid = (p = "id") =>
  `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const look = (l: Partial<AgentLook>): AgentLook => ({
  skin: "#f6c9a8",
  hair: "#7a4a2b",
  hairStyle: "short",
  shirt: "#3f7d5a",
  accent: "#f08a6c",
  pants: "#e9e1d3",
  glasses: false,
  ...l,
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
  name: string,
  title: string,
  persona: string,
  lookIdx: number,
  isLead = false,
): Agent => ({
  id: uid("ag"),
  name,
  title,
  persona,
  isLead,
  status: "idle",
  look: LOOK_PRESETS[lookIdx % LOOK_PRESETS.length],
});

const emptyRoom = (name: string, emoji: string, agents: Agent[]): Room => ({
  id: uid("room"),
  name,
  emoji,
  agents,
  messages: [],
  steps: [],
  approvals: [],
  outputs: [],
  startedAt: Date.now(),
  unread: false,
});

export function seedState(): OfficeState {
  const now = Date.now();

  const ara = agent("Ara", "Right Hand · Generalist", "You coordinate the team, break work down and delegate.", 0, true);
  const miro = agent("Miro", "Researcher · Strategist", "You research markets, channels and audiences and write plans.", 1);
  const noa = agent("Noa", "Copywriter", "You write launch copy, emails and social posts in a warm, crisp voice.", 2);
  const sol = agent("Sol", "Analyst · Designer", "You analyse numbers and propose visual direction.", 3);
  noa.status = "needs_you";
  miro.status = "working";

  const marketing = emptyRoom("Marketing team", "📣", [ara, miro, noa, sol]);
  marketing.startedAt = now - (11 * 60 + 7) * 1000;
  const planId = uid("out");
  marketing.outputs = [
    {
      id: planId,
      agentId: noa.id,
      title: "September channel plan — launch copy",
      content:
        "Headline: Meet the office that works while you sleep.\n\nSub: Your AI team plans, drafts and ships — you just approve.\n\nChannels: Newsletter (Tue), LinkedIn (Wed), X thread (Thu), Product Hunt (next Mon).",
      status: "draft",
      ts: now - 60_000,
    },
    {
      id: uid("out"),
      agentId: miro.id,
      title: "Audience research notes",
      content: "Top segments: solo founders, small agencies, ops leads.\nBest performing channel last month: newsletter (CTR 4.1%).",
      status: "approved",
      ts: now - 300_000,
    },
  ];
  marketing.approvals = [
    {
      id: uid("apr"),
      agentId: noa.id,
      text: "September channel plan is drafted. The launch copy needs your approval before it goes live.",
      outputId: planId,
      createdAt: now - 2_000,
      expiresAt: now + 598_000,
      status: "pending",
    },
  ];
  marketing.steps = [
    { id: uid("st"), agentId: miro.id, title: "Read your message", description: "Parsed the brief for the September launch.", status: "done", ts: now - 400_000 },
    { id: uid("st"), agentId: miro.id, title: "Read your message", description: "Pulled last month's channel numbers.", status: "done", ts: now - 300_000 },
    { id: uid("st"), agentId: miro.id, title: "Read your message", description: "Carried over from Ara · latest output Approved. Running it", status: "done", ts: now - 200_000, handoff: true },
    { id: uid("st"), agentId: miro.id, title: "Still working", description: "Drafting the channel calendar.", status: "running", progress: 57, ts: now - 60_000 },
    { id: uid("st"), agentId: miro.id, title: "More coming", description: "Will hand the calendar to Sol for visuals.", status: "pending", ts: now },
  ];
  marketing.messages = [
    { id: uid("msg"), role: "user", content: "Plan the September launch across our channels.", ts: now - 420_000 },
    { id: uid("msg"), role: "agent", agentId: ara.id, content: "On it — Miro takes research and the calendar, Noa drafts the launch copy, Sol will prep visuals.", ts: now - 410_000 },
    { id: uid("msg"), role: "agent", agentId: noa.id, content: "September channel plan is drafted. The launch copy needs your approval before it goes live.", ts: now - 2_000 },
  ];

  const rooms: Room[] = [
    marketing,
    emptyRoom("New project leading team", "🚀", [
      agent("Kai", "Project Lead", "You own scope, timeline and risks for new projects.", 4, true),
      agent("Lin", "Planner", "You turn goals into milestones and tasks.", 1),
      agent("Rui", "Researcher", "You research prior art and competitors.", 5),
    ]),
    emptyRoom("Dev & QA team", "🧪", [
      agent("Dex", "Tech Lead", "You design systems and review code.", 5, true),
      agent("Ivy", "Engineer", "You implement features and fix bugs.", 2),
      agent("Qin", "QA Engineer", "You write test plans and find bugs.", 3),
    ]),
    emptyRoom("Product & Design team", "✨", [
      agent("Mae", "Product Lead", "You write specs and prioritise the roadmap.", 3, true),
      agent("Ezra", "UX Designer", "You design flows and critique UI.", 0),
      agent("Pia", "UX Writer", "You write microcopy.", 1),
    ]),
    emptyRoom("Ops & Admin team", "🚧", [
      agent("Oli", "Ops Lead", "You run operations, vendors and processes.", 4, true),
      agent("Bea", "Admin", "You handle scheduling, docs and inboxes.", 2),
      agent("Tom", "Finance", "You track budgets and invoices.", 5),
    ]),
  ];
  rooms[3].unread = true;
  rooms[4].unread = true;

  return {
    rooms,
    activeRoomId: marketing.id,
    view: "room",
    selectedAgentId: ara.id,
    targetAgentId: ara.id,
    rightTab: "inspector",
    schedules: [],
    theme: "cream",
    roomsCollapsed: false,
    panelCollapsed: false,
    focusOutputId: null,
  };
}
