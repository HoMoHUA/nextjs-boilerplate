export type AgentStatus = "idle" | "working" | "needs_you" | "done";
export type HairStyle = "short" | "curly" | "fluffy" | "bun" | "bob" | "buzz";
export type Pose = "stand" | "sit" | "type" | "tablet";
export type Backend = "hermes" | "claude-code";
/** Where a Claude Code subagent definition comes from. */
export type AgentSource = "office" | "file" | "builtin";

export interface AgentLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  accent: string;
  pants: string;
  glasses: boolean;
}

export interface Agent {
  id: string;
  name: string;
  /** Short role label, e.g. "Right Hand · Generalist" */
  title: string;
  /** Extra instructions appended to this agent's system prompt */
  persona: string;
  isLead: boolean;
  status: AgentStatus;
  look: AgentLook;
  /** Claude Code subagent type (defaults to the lower-cased name). */
  subagentId?: string;
  /** office = defined here and sent to Claude Code; file = .claude/agents/*.md; builtin = Explore, Plan, … */
  source?: AgentSource;
  /** Live one-liner of what the agent is doing right now (e.g. "Read · app/page.tsx"). */
  activity?: string;
  backend?: Backend;
  kind?: "bot" | "subagent";
  runtime?: boolean;
  /** Scene-only representative of a Telegram topic, never a send target. */
  topicRoomId?: string;
  /** Presentation only; never a routing or execution signal. */
  visualActivity?: import("./avatar/status").VisualActivity;
}

export interface Message {
  id: string;
  role: "user" | "agent" | "system";
  agentId?: string;
  content: string;
  ts: number;
  streaming?: boolean;
  error?: boolean;
  editedAt?: number;
  senderId?: string;
  senderName?: string;
  media?: { type: string; name?: string };
  optimistic?: boolean;
  backend?: Backend;
}

export type StepStatus = "done" | "running" | "pending";

export interface Step {
  id: string;
  agentId: string;
  title: string;
  description: string;
  status: StepStatus;
  progress?: number;
  ts: number;
  /** Highlights the step as a hand-off from another agent */
  handoff?: boolean;
}

export interface Approval {
  id: string;
  agentId: string;
  text: string;
  outputId?: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "rejected" | "expired";
}

export interface Output {
  id: string;
  agentId: string;
  title: string;
  content: string;
  status: "draft" | "approved";
  ts: number;
}

export interface IntegrationSnapshot {
  group: { id: string | number; name: string };
  bots: { backend: Backend; username: string; ok: boolean }[];
  rooms: {
    id: string;
    name: string;
    backend: Backend;
    topicId: string;
    sessionId?: string;
    ccSessionId?: string;
    model?: string;
    lastMessageAt?: number;
    lastMessageId?: string;
    preview?: string;
    messages: Message[];
    agents?: { id: string; name: string; title: string; backend?: Backend; status: AgentStatus; activity?: string; kind: "bot" | "subagent" }[];
    steps: { id: string; agentId?: string; title: string; description: string; status: "done" | "running"; ts: number }[];
    busy: boolean;
    historyLoaded?: boolean;
    hasMore?: boolean;
    before?: string | null;
    deletedMessageIds?: string[];
  }[];
  updatedAt: number;
}

export interface TelegramBinding {
  groupId: string;
  topicId: string;
  sessionId?: string;
  model?: string;
  busy: boolean;
  delivery?: "posting" | "queued" | "error";
  error?: string;
  /** Only unobserved optimistic messages are retained alongside snapshots. */
  pendingMessages: { clientId: string; messageId?: string; content: string; ts: number; priorUserIds: string[]; backend?: Backend }[];
  awaitingReply?: { messageId?: string; ts: number; priorAgentIds: string[]; backend?: Backend };
  awaitingReplies?: { messageId?: string; ts: number; priorAgentIds: string[]; backend: Backend; clientId: string }[];
  historyLoaded?: boolean;
  historyLoading?: boolean;
  historyError?: string;
  hasMore?: boolean;
  before?: string | null;
  deletedMessageIds?: string[];
}

export interface IntegrationStatus {
  phase: "connecting" | "synced" | "error";
  group?: IntegrationSnapshot["group"];
  bots: IntegrationSnapshot["bots"];
  updatedAt?: number;
  /** Browser receipt time; independent of backend clock and content-change time. */
  observedAt?: number;
  error?: string;
}

export interface Room {
  id: string;
  name: string;
  emoji: string;
  agents: Agent[];
  messages: Message[];
  steps: Step[];
  approvals: Approval[];
  outputs: Output[];
  startedAt: number;
  unread: boolean;
  backend: Backend;
  telegram?: TelegramBinding;
  lastMessageAt?: number;
  lastMessageId?: string;
  preview?: string;
  /** Claude Code session to resume, so the room keeps its context. */
  ccSessionId?: string;
  costUsd?: number;
}

export interface Schedule {
  id: string;
  roomId: string;
  agentId: string;
  prompt: string;
  everyMinutes: number;
  nextRunAt: number;
  enabled: boolean;
}

/** Short-lived scene effects (not persisted). */
export interface Fx {
  id: string;
  kind: "handoff" | "celebrate";
  roomId: string;
  from?: string;
  to?: string;
  agentId?: string;
  ts: number;
}

export type SceneTheme = "cream" | "mint" | "lavender" | "sky";

export interface OfficeState {
  rooms: Room[];
  activeRoomId: string;
  view: "room" | "lounge" | "schedule";
  selectedAgentId: string | null;
  targetAgentId: string | null;
  rightTab: "inspector" | "output" | "thread";
  schedules: Schedule[];
  theme: SceneTheme;
  colorMode?: import("./color-mode").ColorMode;
  motionPreference?: "system" | "reduced" | "full";
  roomsCollapsed: boolean;
  panelCollapsed: boolean;
  focusOutputId: string | null;
  fx: Fx[];
  integrations?: IntegrationStatus;
  /** Undefined = all topics; an empty array deliberately hides all. Browser-local preference. */
  visibleTopicIds?: string[];
  /** Untrusted, versioned browser-local JSON. Unknown versions stay intact for recovery. */
  avatarPreferences?: unknown;
}
