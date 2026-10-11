export type AgentStatus = "idle" | "working" | "needs_you" | "done";
export type HairStyle = "short" | "curly" | "fluffy" | "bun" | "bob" | "buzz";
export type Pose = "stand" | "sit" | "type" | "tablet";

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
}

export interface Message {
  id: string;
  role: "user" | "agent" | "system";
  agentId?: string;
  content: string;
  ts: number;
  streaming?: boolean;
  error?: boolean;
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
  roomsCollapsed: boolean;
  panelCollapsed: boolean;
  focusOutputId: string | null;
}
