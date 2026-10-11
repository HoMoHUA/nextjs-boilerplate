"use client";

import { useSyncExternalStore } from "react";
import { streamChat } from "./hermes-client";
import { extractOutput, parseDirectives, stripDirectives, toChatMessages } from "./protocol";
import { seedState, uid } from "./seed";
import type { Agent, AgentStatus, OfficeState, Room, Step } from "./types";

const STORAGE_KEY = "hermes-office-v1";
const APPROVAL_TTL = 10 * 60 * 1000;
const MAX_DELEGATION_DEPTH = 2;

let state: OfficeState = seedState();
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const getState = () => state;

export function setState(fn: (s: OfficeState) => OfficeState) {
  state = fn(state);
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 400);
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot = state;
export function useOffice(): OfficeState {
  return useSyncExternalStore(subscribe, getState, () => serverSnapshot);
}

function persist() {
  try {
    const clean: OfficeState = {
      ...state,
      rooms: state.rooms.map((r) => ({
        ...r,
        messages: r.messages.filter((m) => !m.streaming),
        steps: r.steps.map((s) => (s.status === "running" ? { ...s, status: "done" as const } : s)),
        agents: r.agents.map((a) => (a.status === "working" ? { ...a, status: "idle" as const } : a)),
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // storage unavailable — state stays in memory
  }
}

export function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as OfficeState;
      if (Array.isArray(saved.rooms) && saved.rooms.length) setState(() => ({ ...seedState(), ...saved }));
    }
  } catch {
    // ignore corrupted storage
  }
}

export function resetOffice() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  setState(() => seedState());
}

/* ---------- helpers ---------- */

export const activeRoom = (s: OfficeState) => s.rooms.find((r) => r.id === s.activeRoomId) ?? s.rooms[0];
export const leadOf = (r: Room) => r.agents.find((a) => a.isLead) ?? r.agents[0];

export function updateRoom(roomId: string, fn: (r: Room) => Room) {
  setState((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === roomId ? fn(r) : r)) }));
}

function setAgentStatus(roomId: string, agentId: string, status: AgentStatus) {
  updateRoom(roomId, (r) => ({
    ...r,
    agents: r.agents.map((a) => (a.id === agentId ? { ...a, status } : a)),
  }));
}

function patchStep(roomId: string, stepId: string, patch: Partial<Step>) {
  updateRoom(roomId, (r) => ({ ...r, steps: r.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }));
}

/* ---------- actions ---------- */

export const actions = {
  selectRoom(id: string) {
    setState((s) => {
      const room = s.rooms.find((r) => r.id === id);
      const lead = room ? leadOf(room) : undefined;
      return {
        ...s,
        activeRoomId: id,
        view: "room",
        selectedAgentId: lead?.id ?? null,
        targetAgentId: lead?.id ?? null,
        rooms: s.rooms.map((r) => (r.id === id ? { ...r, unread: false } : r)),
      };
    });
  },
  set<K extends keyof OfficeState>(key: K, value: OfficeState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  },
  selectAgent(id: string) {
    setState((s) => ({ ...s, selectedAgentId: id, targetAgentId: id, rightTab: "inspector" }));
  },
  addRoom(name: string, emoji: string, agents: Agent[]) {
    const room: Room = {
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
    };
    setState((s) => ({ ...s, rooms: [...s.rooms, room] }));
    actions.selectRoom(room.id);
  },
  removeRoom(id: string) {
    setState((s) => {
      const rooms = s.rooms.filter((r) => r.id !== id);
      if (!rooms.length) return s;
      return {
        ...s,
        rooms,
        schedules: s.schedules.filter((x) => x.roomId !== id),
        activeRoomId: s.activeRoomId === id ? rooms[0].id : s.activeRoomId,
      };
    });
  },
  renameRoom(id: string, name: string, emoji: string) {
    updateRoom(id, (r) => ({ ...r, name, emoji }));
  },
  setAgents(roomId: string, agents: Agent[]) {
    updateRoom(roomId, (r) => ({ ...r, agents }));
  },
  clearRoom(roomId: string) {
    updateRoom(roomId, (r) => ({
      ...r,
      messages: [],
      steps: [],
      approvals: [],
      outputs: [],
      startedAt: Date.now(),
      agents: r.agents.map((a) => ({ ...a, status: "idle" })),
    }));
  },

  async approve(roomId: string, approvalId: string) {
    const room = getState().rooms.find((r) => r.id === roomId);
    const apr = room?.approvals.find((a) => a.id === approvalId);
    if (!room || !apr) return;
    updateRoom(roomId, (r) => ({
      ...r,
      approvals: r.approvals.map((a) => (a.id === approvalId ? { ...a, status: "approved" } : a)),
      outputs: r.outputs.map((o) => (o.id === apr.outputId ? { ...o, status: "approved" } : o)),
      agents: r.agents.map((a) => (a.id === apr.agentId ? { ...a, status: "done" } : a)),
    }));
    const agent = room.agents.find((a) => a.id === apr.agentId);
    if (agent) await sendMessage(roomId, `Approved ✅ — "${apr.text}". Go ahead and finalize it.`, agent.id);
  },

  reject(roomId: string, approvalId: string) {
    updateRoom(roomId, (r) => ({
      ...r,
      approvals: r.approvals.map((a) => (a.id === approvalId ? { ...a, status: "rejected" } : a)),
      agents: r.agents.map((a) =>
        r.approvals.find((x) => x.id === approvalId)?.agentId === a.id ? { ...a, status: "idle" } : a,
      ),
    }));
  },

  reviewFirst(roomId: string, approvalId: string) {
    const apr = getState().rooms.find((r) => r.id === roomId)?.approvals.find((a) => a.id === approvalId);
    setState((s) => ({ ...s, rightTab: "output", panelCollapsed: false, focusOutputId: apr?.outputId ?? null }));
  },

  expireApprovals() {
    const now = Date.now();
    const anyExpired = getState().rooms.some((r) =>
      r.approvals.some((a) => a.status === "pending" && a.expiresAt < now),
    );
    if (!anyExpired) return;
    setState((s) => ({
      ...s,
      rooms: s.rooms.map((r) => ({
        ...r,
        approvals: r.approvals.map((a) =>
          a.status === "pending" && a.expiresAt < now ? { ...a, status: "expired" } : a,
        ),
      })),
    }));
  },
};

/* ---------- orchestration ---------- */

const controllers = new Map<string, AbortController>();

export function stopAgent(agentId: string) {
  controllers.get(agentId)?.abort();
}

export async function sendMessage(roomId: string, text: string, targetAgentId?: string | null) {
  const room = getState().rooms.find((r) => r.id === roomId);
  if (!room || !text.trim()) return;

  // "@Name ..." overrides the target
  let body = text.trim();
  let target = room.agents.find((a) => a.id === targetAgentId) ?? leadOf(room);
  const mention = /^@(\S+)\s*/.exec(body);
  if (mention) {
    const found = room.agents.find((a) => a.name.toLowerCase() === mention[1].toLowerCase());
    if (found) {
      target = found;
      body = body.slice(mention[0].length) || body;
    }
  }

  updateRoom(roomId, (r) => ({
    ...r,
    messages: [...r.messages, { id: uid("msg"), role: "user", content: body, ts: Date.now() }],
  }));
  await runAgent(roomId, target.id, undefined, 0);
}

async function runAgent(roomId: string, agentId: string, delegatedTask: string | undefined, depth: number, from?: string) {
  const room = getState().rooms.find((r) => r.id === roomId);
  const agent = room?.agents.find((a) => a.id === agentId);
  if (!room || !agent) return;

  controllers.get(agentId)?.abort();
  const ctrl = new AbortController();
  controllers.set(agentId, ctrl);

  setAgentStatus(roomId, agentId, "working");
  const msgId = uid("msg");
  const workStepId = uid("st");
  updateRoom(roomId, (r) => ({
    ...r,
    messages: [...r.messages, { id: msgId, role: "agent", agentId, content: "", ts: Date.now(), streaming: true }],
    steps: [
      ...r.steps
        .filter((s) => !(s.agentId === agentId && s.status === "pending"))
        .map((s) => (s.agentId === agentId && s.status === "running" ? { ...s, status: "done" as const, progress: 100 } : s)),
      {
        id: uid("st"),
        agentId,
        title: "Read your message",
        description: from ? `Carried over from ${from}` : "Picked up the request",
        status: "done",
        ts: Date.now(),
        handoff: Boolean(from),
      },
      { id: workStepId, agentId, title: "Still working", description: "Thinking…", status: "running", progress: 3, ts: Date.now() },
    ],
  }));

  const extra = delegatedTask ? `${from ?? "Your lead"} delegated this task to you: ${delegatedTask}` : undefined;
  let full = "";
  let seenSteps = 0;

  try {
    await streamChat(
      toChatMessages(room, agent, extra),
      (chunk) => {
        full += chunk;
        const steps = parseDirectives(full).filter((d) => d.kind === "step");
        const newSteps = steps.slice(seenSteps);
        seenSteps = steps.length;
        updateRoom(roomId, (r) => ({
          ...r,
          messages: r.messages.map((m) => (m.id === msgId ? { ...m, content: stripDirectives(full) } : m)),
          steps: [
            ...r.steps.filter((s) => s.id !== workStepId),
            ...newSteps.map((d) => ({
              id: uid("st"),
              agentId,
              title: d.kind === "step" ? d.title : "",
              description: d.kind === "step" ? d.description : "",
              status: "done" as const,
              ts: Date.now(),
            })),
            {
              ...(r.steps.find((s) => s.id === workStepId) as Step),
              description: stripDirectives(full).split("\n").pop()?.slice(0, 90) || "Thinking…",
              progress: Math.min(95, 3 + full.length / 12),
            },
          ],
        }));
      },
      ctrl.signal,
    );
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    updateRoom(roomId, (r) => ({
      ...r,
      messages: r.messages.map((m) =>
        m.id === msgId
          ? {
              ...m,
              streaming: false,
              error: !aborted,
              content: aborted ? stripDirectives(full) || "Stopped." : `⚠️ ${(err as Error).message}`,
            }
          : m,
      ),
    }));
    patchStep(roomId, workStepId, { status: "done", title: aborted ? "Stopped" : "Failed", progress: 100 });
    setAgentStatus(roomId, agentId, "idle");
    controllers.delete(agentId);
    return;
  }
  controllers.delete(agentId);

  const directives = parseDirectives(full);
  const outputBody = extractOutput(full);
  const outputTitle = directives.find((d) => d.kind === "output");
  const approvals = directives.filter((d) => d.kind === "approval");
  const delegations = directives.filter((d) => d.kind === "delegate");
  const outputId = outputBody ? uid("out") : undefined;

  updateRoom(roomId, (r) => ({
    ...r,
    unread: getState().activeRoomId !== roomId,
    messages: r.messages.map((m) => (m.id === msgId ? { ...m, content: stripDirectives(full), streaming: false } : m)),
    steps: r.steps.map((s) =>
      s.id === workStepId ? { ...s, status: "done", title: "Finished", description: "Reply delivered", progress: 100 } : s,
    ),
    outputs: outputId
      ? [
          ...r.outputs,
          {
            id: outputId,
            agentId,
            title: outputTitle?.kind === "output" ? outputTitle.title : "Output",
            content: outputBody ?? "",
            status: approvals.length ? "draft" : "approved",
            ts: Date.now(),
          },
        ]
      : r.outputs,
    approvals: [
      ...r.approvals,
      ...approvals.map((d) => ({
        id: uid("apr"),
        agentId,
        text: d.kind === "approval" ? d.text : "",
        outputId,
        createdAt: Date.now(),
        expiresAt: Date.now() + APPROVAL_TTL,
        status: "pending" as const,
      })),
    ],
  }));
  setAgentStatus(roomId, agentId, approvals.length ? "needs_you" : "done");

  if (depth >= MAX_DELEGATION_DEPTH) return;
  const fresh = getState().rooms.find((r) => r.id === roomId);
  await Promise.all(
    delegations.map((d) => {
      if (d.kind !== "delegate") return;
      const mate = fresh?.agents.find((a) => a.name.toLowerCase() === d.agent.toLowerCase() && a.id !== agentId);
      if (!mate) return;
      updateRoom(roomId, (r) => ({
        ...r,
        steps: [
          ...r.steps,
          { id: uid("st"), agentId: mate.id, title: "More coming", description: d.task, status: "pending", ts: Date.now() },
        ],
      }));
      return runAgent(roomId, mate.id, d.task, depth + 1, agent.name);
    }),
  );
}
