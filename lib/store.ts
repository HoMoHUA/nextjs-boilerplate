"use client";

import { useSyncExternalStore } from "react";
import { streamChat } from "./hermes-client";
import { readOfficeEvents, type OfficeEvent } from "./office-events";
import {
  claudeCodeSubagents,
  claudeCodeSystemAppend,
  extractOutput,
  parseDirectives,
  stripDirectives,
  subagentType,
  toChatMessages,
} from "./protocol";
import { lookFor, seedState, uid } from "./seed";
import { canonicalTopics, topicVisible } from "./topics";
import type { Agent, AgentStatus, Fx, IntegrationSnapshot, OfficeState, Room, Step } from "./types";

const STORAGE_KEY = "arklyn-office-v3";
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
      fx: [],
      rooms: state.rooms.map((r) => r.telegram ? r : ({
        ...r,
        messages: r.messages.filter((m) => !m.streaming),
        steps: r.steps.map((s) => (s.status === "running" ? { ...s, status: "done" as const } : s)),
        agents: r.agents.map((a) => ({ ...a, activity: undefined, status: a.status === "working" ? ("idle" as const) : a.status })),
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
      if (Array.isArray(saved.rooms) && saved.rooms.length)
        setState(() => ({
          ...seedState(),
          ...saved,
          fx: [],
          visibleTopicIds:Array.isArray(saved.visibleTopicIds) ? [...new Set(saved.visibleTopicIds.filter(id=>typeof id==="string"))] : undefined,
          integrations: { phase: "connecting", bots: [] },
          activeRoomId: saved.rooms.some((r) => r.id === saved.activeRoomId) ? saved.activeRoomId : saved.rooms[0].id,
          rooms: saved.rooms.map((r) => ({ ...r, backend: r.backend ?? "hermes",
            ...(r.telegram?.delivery === "posting" ? {
              telegram: { ...r.telegram, delivery: "error" as const,
                error: "Page closed during posting; delivery is unconfirmed. Check Telegram before retrying.", awaitingReply: undefined },
              agents: r.agents.map((a) => ({ ...a, status: "idle" as const, activity: undefined })),
            } : {}),
          })),
        }));
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

/* ---------- authoritative Telegram snapshots ---------- */

let initialIntegrationSelection = true;
let userSelectedRoom = false;
const telegramPosts = new Set<string>();

export const isTelegramPosting = (roomId: string) => telegramPosts.has(roomId);

function connectedRoom(snapshot: IntegrationSnapshot, source: IntegrationSnapshot["rooms"][number], previous?: Room): Room {
  const agentId = (id: string) => `${source.id}:${id}`;
  const descriptors = source.agents ?? snapshot.bots.filter(b => b.ok).map(b => ({id:b.backend,name:b.username,title:b.backend,backend:b.backend,status:"idle" as const,kind:"bot" as const}));
  const agents: Agent[] = [...new Map(descriptors.map(a => [a.id,a])).values()].map(a => ({
    ...a, id:agentId(a.id), name:a.id === "hermes" ? "Hermes" : a.id === "claude-code" ? "Claude Code" : a.name,
    persona:"",isLead:a.id === "hermes" || (!descriptors.some(x=>x.id === "hermes") && a.id === "claude-code"),
    look:previous?.agents.find(x=>x.id === agentId(a.id))?.look ?? lookFor(a.id), runtime:true,
  }));
  const deleted = new Set([...(previous?.telegram?.deletedMessageIds ?? []),...(source.deletedMessageIds ?? [])]);
  const previousMessages = previous?.messages.filter(m => /^\d+$/.test(m.id)) ?? [];
  const authoritative = [...new Map([...previousMessages,...source.messages].map(m=>[m.id,{
    ...m, agentId:m.role === "agent" ? (m.agentId?.startsWith(source.id+":") ? m.agentId : agentId(m.agentId ?? "hermes")) : undefined,
  }])).values()].filter(m=>!deleted.has(m.id)).sort((a,b)=>a.ts-b.ts || a.id.localeCompare(b.id,undefined,{numeric:true}));
  const pendingMessages = (previous?.telegram?.pendingMessages ?? []).filter(p => !authoritative.some(m =>
    p.messageId ? m.id === p.messageId : m.role === "user" && !p.priorUserIds.includes(m.id) && m.ts >= p.ts-5000 &&
      (m.content === p.content || m.content === `@${snapshot.bots.find(b=>b.backend === (p.backend ?? "hermes"))?.username} ${p.content}`)));
  const waits = previous?.telegram?.awaitingReplies ?? (previous?.telegram?.awaitingReply ? [{...previous.telegram.awaitingReply,backend:previous.telegram.awaitingReply.backend ?? previous.backend,clientId:"legacy"}] : []);
  const awaitingReplies = waits.filter(wait => {
    const sent=authoritative.find(m=>m.id === wait.messageId);
    return !sent || !authoritative.some(m=>m.role === "agent" && m.agentId === agentId(wait.backend) && !wait.priorAgentIds.includes(m.id) && m.ts >= sent.ts && Number(m.id)>Number(sent.id));
  });
  const delivery = telegramPosts.has(source.id) ? "posting" : previous?.telegram?.delivery === "error" ? "error" : awaitingReplies.length ? "queued" : undefined;
  return {
    id:source.id,name:source.name,emoji:"🏡",backend:"hermes",
    agents,messages:[...authoritative,...pendingMessages.map(p=>({id:p.clientId,role:"user" as const,content:p.content,ts:p.ts,optimistic:true,senderName:"You",backend:p.backend})),...(previous?.messages.filter(m=>m.error) ?? [])],
    steps:source.steps.map(s=>({...s,agentId:agentId(s.agentId ?? "hermes"),progress:s.status === "done" ? 100 : undefined})),
    approvals:[],outputs:[],startedAt:previous?.startedAt ?? authoritative[0]?.ts ?? Date.now(),
    lastMessageAt:source.lastMessageAt ?? authoritative.at(-1)?.ts ?? 0,lastMessageId:source.lastMessageId,preview:source.preview ?? authoritative.at(-1)?.content,
    ccSessionId:source.ccSessionId,unread:previous?.unread || (getState().activeRoomId !== source.id && !!previous && authoritative.some(m=>!previous.messages.some(old=>old.id===m.id))),
    telegram:{groupId:String(snapshot.group.id),topicId:source.topicId,sessionId:source.sessionId,model:source.model,busy:source.busy,
      delivery,error:previous?.telegram?.error,pendingMessages,awaitingReplies,deletedMessageIds:[...deleted],
      historyLoaded:previous?.telegram?.historyLoaded ?? false,historyLoading:historyControllers.has(source.id),
      historyError:previous?.telegram?.historyError,hasMore:previous?.telegram?.hasMore ?? true,before:previous?.telegram?.before ?? null},
  };
}

export function mergeIntegrations(snapshot: IntegrationSnapshot) {
  if (snapshot.updatedAt < (getState().integrations?.updatedAt ?? 0)) return;
  setState(s => {
    const connected=canonicalTopics(snapshot.rooms).map(r=>connectedRoom(snapshot,r,s.rooms.find(old=>old.id === r.id) ?? s.rooms.find(old=>old.telegram?.topicId === r.topicId)));
    connected.sort((a,b)=>(b.lastMessageAt ?? 0)-(a.lastMessageAt ?? 0) || Number(b.lastMessageId ?? 0)-Number(a.lastMessageId ?? 0) || a.id.localeCompare(b.id));
    const rooms=[...connected,...s.rooms.filter(r=>!r.telegram)];
    if (!rooms.length) return {...s,integrations:{phase:"synced",group:snapshot.group,bots:snapshot.bots,updatedAt:snapshot.updatedAt}};
    const previousActive=s.rooms.find(r=>r.id===s.activeRoomId);
    const visible=connected.filter(r=>topicVisible(s,r.telegram!.topicId));
    const migrated=previousActive?.telegram ? visible.find(r=>r.telegram?.topicId===previousActive.telegram?.topicId) : undefined;
    const initial=initialIntegrationSelection && !userSelectedRoom ? visible.find(r=>r.telegram?.topicId === "7785") ?? visible[0] : undefined;
    if(connected.length)initialIntegrationSelection=false;
    const active=initial ?? migrated ?? (previousActive?.telegram && visible.length ? visible[0] : rooms.find(r=>r.id===s.activeRoomId)) ?? rooms[0];
    const validSelected=active.agents.some(a=>a.id===s.selectedAgentId);
    const validTarget=active.agents.some(a=>a.id===s.targetAgentId && a.backend && a.kind==="bot");
    const preferred=active.agents.find(a=>a.backend===previousActive?.backend && a.kind==="bot") ?? leadOf(active);
    return {...s,rooms,activeRoomId:active.id,selectedAgentId:validSelected?s.selectedAgentId:preferred?.id ?? null,
      targetAgentId:validTarget?s.targetAgentId:preferred?.id ?? null,
      rightTab:active.telegram && (initial || active.id!==s.activeRoomId) ? "thread" : s.rightTab,
      integrations:{phase:"synced",group:snapshot.group,bots:snapshot.bots,updatedAt:snapshot.updatedAt}};
  });
}

const historyControllers=new Map<string,AbortController>();
export async function loadTopicHistory(roomId:string,older=false,force=false) {
  const room=getState().rooms.find(r=>r.id===roomId);
  if(!room?.telegram || room.telegram.historyLoading || (!older && room.telegram.historyLoaded && !force) || (older && !room.telegram.hasMore))return;
  historyControllers.get(roomId)?.abort();
  const ctrl=new AbortController();historyControllers.set(roomId,ctrl);
  const deadline=setTimeout(()=>ctrl.abort(),25000);
  updateRoom(roomId,r=>({...r,telegram:{...r.telegram!,historyLoading:true,historyError:undefined}}));
  try {
    const q=new URLSearchParams({roomId});if(older && room.telegram.before)q.set("before",room.telegram.before);
    const response=await fetch(`/api/integrations/history?${q}`,{signal:ctrl.signal,cache:"no-store"});
    if(!response.ok)throw new Error(`History unavailable (${response.status})`);
    const page=await response.json() as {roomId:string;messages:Room["messages"];hasMore:boolean;before:string|null};
    if(page.roomId!==roomId || !Array.isArray(page.messages))throw new Error("Invalid history response");
    if(ctrl.signal.aborted)return;
    updateRoom(roomId,r=>{
      const deleted=new Set(r.telegram?.deletedMessageIds ?? []);
      const entries=new Map(r.messages.map(m=>[m.id,m]));
      for(const message of page.messages){
        const current=entries.get(message.id);
        if(current && (current.editedAt ?? current.ts)>=(message.editedAt ?? message.ts))continue;
        entries.set(message.id,{...message,agentId:message.role==="agent"?`${roomId}:${message.agentId ?? "hermes"}`:undefined});
      }
      const messages=[...entries.values()].filter(m=>!deleted.has(m.id)).sort((a,b)=>a.ts-b.ts || a.id.localeCompare(b.id,undefined,{numeric:true}));
      return {...r,messages,telegram:{...r.telegram!,historyLoading:false,historyLoaded:true,hasMore:older || !r.telegram?.historyLoaded ? page.hasMore : r.telegram.hasMore,before:older || !r.telegram?.historyLoaded ? page.before : r.telegram.before}};
    });
  } catch(error){if(!ctrl.signal.aborted || historyControllers.get(roomId)===ctrl)updateRoom(roomId,r=>({...r,telegram:{...r.telegram!,historyLoading:false,historyError:error instanceof Error && error.name!=="AbortError" ? error.message : "History request interrupted; retry."}}));}
  finally{clearTimeout(deadline);if(historyControllers.get(roomId)===ctrl)historyControllers.delete(roomId);}
}

/** Real event stream; bounded HTTP polling only while it is unavailable. */
export function startIntegrationPolling():()=>void {
  let stopped=false,polling=false,live=false,first=true;
  let controller:AbortController|undefined;
  const apply=(snapshot:IntegrationSnapshot)=>{
    if(stopped || !Array.isArray(snapshot.rooms) || !Number.isFinite(snapshot.updatedAt))return;
    mergeIntegrations(snapshot);
    const room=activeRoom(getState());if(room?.telegram && topicVisible(getState(),room.telegram.topicId))void loadTopicHistory(room.id,false,first);
    first=false;
  };
  async function poll(){
    if(stopped || polling || live)return;
    polling=true;controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),20000);
    try{const response=await fetch("/api/integrations",{signal:controller.signal,cache:"no-store"});if(!response.ok)throw new Error(`Telegram sync failed (${response.status})`);apply(await response.json());}
    catch(error){if(!stopped && !live)setState(s=>({...s,integrations:{...s.integrations,bots:s.integrations?.bots ?? [],phase:"error",error:error instanceof Error?error.message:"Sync interrupted"}}));}
    finally{clearTimeout(timer);polling=false;}
  }
  setState(s=>({...s,integrations:{...s.integrations,bots:s.integrations?.bots ?? [],phase:"connecting"}}));
  void poll();
  const stream=new EventSource("/api/integrations/stream");
  stream.addEventListener("snapshot",event=>{live=true;try{apply(JSON.parse((event as MessageEvent).data));}catch{live=false;}});
  stream.onerror=()=>{live=false;if(!stopped){setState(s=>({...s,integrations:{...s.integrations,bots:s.integrations?.bots ?? [],phase:"connecting",error:"Live connection reconnecting"}}));void poll();}};
  const timer=setInterval(()=>void poll(),15000);
  return ()=>{stopped=true;stream.close();controller?.abort();clearInterval(timer);for(const ctrl of historyControllers.values())ctrl.abort();historyControllers.clear();};
}

/* ---------- actions ---------- */

export const actions = {
  setTopicVisibility(ids:string[]|undefined) {
    const known=new Set(getState().rooms.flatMap(r=>r.telegram?[r.telegram.topicId]:[]));
    const visibleTopicIds=ids===undefined?undefined:[...new Set(ids.filter(id=>known.has(id)))];
    setState(s=>({...s,visibleTopicIds}));
    const s=getState(),current=activeRoom(s);
    if(current?.telegram && !topicVisible(s,current.telegram.topicId)){
      const fallback=s.rooms.find(r=>r.telegram && topicVisible(s,r.telegram.topicId));
      if(fallback)actions.selectRoom(fallback.id);
    }
  },
  selectRoom(id: string) {
    if (!getState().rooms.some(r=>r.id===id && (!r.telegram || topicVisible(getState(),r.telegram.topicId)))) return;
    userSelectedRoom = true;
    setState((s) => {
      const room = s.rooms.find((r) => r.id === id);
      const lead = room ? leadOf(room) : undefined;
      return {
        ...s,
        activeRoomId: id,
        view: "room",
        rightTab: room?.telegram ? "thread" : s.rightTab,
        selectedAgentId: lead?.id ?? null,
        targetAgentId: lead?.id ?? null,
        rooms: s.rooms.map((r) => (r.id === id ? { ...r, unread: false } : r)),
      };
    });
    void loadTopicHistory(id);
  },
  set<K extends keyof OfficeState>(key: K, value: OfficeState[K]) {
    if (key === "activeRoomId") userSelectedRoom = true;
    setState((s) => ({ ...s, [key]: value }));
  },
  selectAgent(id: string) {
    setState((s) => ({ ...s, selectedAgentId: id, targetAgentId: activeRoom(s)?.telegram && activeRoom(s).agents.find(a=>a.id===id)?.kind!=="bot" ? s.targetAgentId : id, rightTab: "inspector" }));
  },
  addRoom(name: string, emoji: string, agents: Agent[], backend: Room["backend"] = "hermes") {
    const room: Room = {
      backend,
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
    if (getState().rooms.find((r) => r.id === id)?.telegram) return;
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
  renameRoom(id: string, name: string, emoji: string, backend?: Room["backend"]) {
    if (getState().rooms.find((r) => r.id === id)?.telegram) return;
    updateRoom(id, (r) => ({ ...r, name, emoji, backend: backend ?? r.backend, ccSessionId: backend && backend !== r.backend ? undefined : r.ccSessionId }));
  },
  setAgents(roomId: string, agents: Agent[]) {
    if (getState().rooms.find((r) => r.id === roomId)?.telegram) return;
    updateRoom(roomId, (r) => ({ ...r, agents }));
  },
  clearRoom(roomId: string) {
    if (getState().rooms.find((r) => r.id === roomId)?.telegram) return;
    updateRoom(roomId, (r) => ({
      ...r,
      messages: [],
      steps: [],
      approvals: [],
      outputs: [],
      startedAt: Date.now(),
      ccSessionId: undefined,
      costUsd: 0,
      agents: r.agents.map((a) => ({ ...a, status: "idle", activity: undefined })),
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
    pushFx({ kind: "celebrate", roomId, agentId: apr.agentId });
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

const APPROVAL_TTL_MS = APPROVAL_TTL;

function pushFx(fx: Omit<Fx, "id" | "ts">) {
  setState((s) => ({ ...s, fx: [...s.fx.filter((f) => Date.now() - f.ts < 8000), { ...fx, id: uid("fx"), ts: Date.now() }] }));
}

function setActivity(roomId: string, agentId: string, activity?: string) {
  updateRoom(roomId, (r) => ({ ...r, agents: r.agents.map((a) => (a.id === agentId ? { ...a, activity } : a)) }));
}

/**
 * One agent producing one reply: owns its chat message and timeline steps,
 * parses office markers while text streams in, and turns the final text into
 * outputs and approvals. Used by both backends.
 */
class AgentRun {
  readonly msgId = uid("msg");
  readonly workStepId = uid("st");
  text = "";
  private seenSteps = 0;
  finished = false;
  /** When set, a long reply without an OUTPUT marker is kept as an output with this title (subagent reports). */
  reportTitle?: string;

  constructor(
    readonly roomId: string,
    readonly agentId: string,
    from?: string,
    task?: string,
  ) {
    setAgentStatus(roomId, agentId, "working");
    const now = Date.now();
    updateRoom(roomId, (r) => ({
      ...r,
      messages: [...r.messages, { id: this.msgId, role: "agent", agentId, content: "", ts: now, streaming: true }],
      steps: [
        ...r.steps
          .filter((s) => !(s.agentId === agentId && s.status === "pending"))
          .map((s) => (s.agentId === agentId && s.status === "running" ? { ...s, status: "done" as const, progress: 100 } : s)),
        {
          id: uid("st"),
          agentId,
          title: "Read your message",
          description: from ? `Carried over from ${from}${task ? ` · ${task.slice(0, 80)}` : ""}` : "Picked up the request",
          status: "done",
          ts: now,
          handoff: Boolean(from),
        },
        { id: this.workStepId, agentId, title: "Still working", description: "Thinking…", status: "running", progress: 3, ts: now },
      ],
    }));
  }

  append(delta: string) {
    this.text += delta;
    const full = this.text;
    const steps = parseDirectives(full).filter((d) => d.kind === "step");
    const fresh = steps.slice(this.seenSteps);
    this.seenSteps = steps.length;
    const visible = stripDirectives(full);
    updateRoom(this.roomId, (r) => ({
      ...r,
      messages: r.messages.map((m) => (m.id === this.msgId ? { ...m, content: visible } : m)),
      steps: this.withWorkStep(r.steps, fresh.map((d) => (d.kind === "step" ? [d.title, d.description] : ["", ""])), {
        description: visible.split("\n").filter(Boolean).pop()?.slice(0, 90) || "Thinking…",
        progress: Math.min(92, 3 + full.length / 14),
      }),
    }));
  }

  /** A tool call (Read, Grep, Bash, …) becomes a finished step and the agent's live activity. */
  tool(name: string, detail: string) {
    const label = detail ? `${name} · ${detail}` : name;
    setActivity(this.roomId, this.agentId, label);
    updateRoom(this.roomId, (r) => {
      const cur = r.steps.find((s) => s.id === this.workStepId);
      return {
        ...r,
        steps: this.withWorkStep(r.steps, [[`Used ${name}`, detail]], {
          description: label.slice(0, 90),
          progress: Math.min(92, (cur?.progress ?? 3) + 6),
        }),
      };
    });
  }

  /** Inserts new finished steps before the running step and patches it. */
  private withWorkStep(steps: Step[], added: string[][], patch: Partial<Step>): Step[] {
    const cur = steps.find((s) => s.id === this.workStepId);
    const rest = steps.filter((s) => s.id !== this.workStepId);
    const now = Date.now();
    const extra: Step[] = added.map(([title, description]) => ({ id: uid("st"), agentId: this.agentId, title, description, status: "done", ts: now }));
    return cur ? [...rest, ...extra, { ...cur, ...patch }] : [...rest, ...extra];
  }

  /** Finalizes the reply. `fallback` is used when no text streamed (e.g. a subagent's summary). */
  finish(fallback?: string) {
    if (this.finished) return [];
    this.finished = true;
    if (!this.text.trim() && fallback) this.text = fallback;
    const full = this.text;
    const directives = parseDirectives(full);
    const visible = stripDirectives(full);
    const report = !extractOutput(full) && this.reportTitle && visible.length > 200;
    const outputBody = report ? visible : extractOutput(full);
    const outputTitle = directives.find((d) => d.kind === "output");
    const approvals = directives.filter((d) => d.kind === "approval");
    const outputId = outputBody ? uid("out") : undefined;
    const now = Date.now();

    updateRoom(this.roomId, (r) => ({
      ...r,
      unread: getState().activeRoomId !== this.roomId,
      messages: visible
        ? r.messages.map((m) => (m.id === this.msgId ? { ...m, content: visible, streaming: false } : m))
        : r.messages.filter((m) => m.id !== this.msgId),
      steps: r.steps.map((s) =>
        s.id === this.workStepId ? { ...s, status: "done", title: "Finished", description: "Reply delivered", progress: 100 } : s,
      ),
      outputs: outputId
        ? [
            ...r.outputs,
            {
              id: outputId,
              agentId: this.agentId,
              title: outputTitle?.kind === "output" ? outputTitle.title : report ? this.reportTitle! : "Output",
              content: outputBody ?? "",
              status: approvals.length ? "draft" : "approved",
              ts: now,
            },
          ]
        : r.outputs,
      approvals: [
        ...r.approvals,
        ...approvals.map((d) => ({
          id: uid("apr"),
          agentId: this.agentId,
          text: d.kind === "approval" ? d.text : "",
          outputId,
          createdAt: now,
          expiresAt: now + APPROVAL_TTL_MS,
          status: "pending" as const,
        })),
      ],
      agents: r.agents.map((a) =>
        a.id === this.agentId ? { ...a, status: approvals.length ? "needs_you" : "done", activity: undefined } : a,
      ),
    }));
    return directives.filter((d) => d.kind === "delegate");
  }

  fail(message: string, aborted: boolean) {
    if (this.finished) return;
    this.finished = true;
    updateRoom(this.roomId, (r) => ({
      ...r,
      messages: r.messages.map((m) =>
        m.id === this.msgId
          ? { ...m, streaming: false, error: !aborted, content: aborted ? stripDirectives(this.text) || "Stopped." : `⚠️ ${message}` }
          : m,
      ),
      steps: r.steps.map((s) =>
        s.id === this.workStepId ? { ...s, status: "done", title: aborted ? "Stopped" : "Failed", description: message.slice(0, 90), progress: 100 } : s,
      ),
      agents: r.agents.map((a) => (a.id === this.agentId ? { ...a, status: "idle", activity: undefined } : a)),
    }));
  }
}

const controllers = new Map<string, AbortController>();

/** Stops whatever is running for this agent (in a Claude Code room the whole room's turn). */
export function stopAgent(agentId: string) {
  const room = getState().rooms.find((r) => r.agents.some((a) => a.id === agentId));
  // There is no broker cancellation API; never fake stopping a server turn.
  if (room?.telegram) return;
  const ctrl = controllers.get(agentId) ?? (room ? controllers.get(room.id) : undefined);
  if (ctrl) return ctrl.abort();
  // nothing is running (e.g. restored or demo state): just settle the agent
  if (room)
    updateRoom(room.id, (r) => ({
      ...r,
      agents: r.agents.map((a) => (a.id === agentId ? { ...a, status: "idle", activity: undefined } : a)),
      steps: r.steps.map((st) =>
        st.agentId === agentId && st.status !== "done" ? { ...st, status: "done", title: "Stopped", progress: 100 } : st,
      ),
    }));
}

async function sendTelegramMessage(room: Room, text: string, targetId?:string|null) {
  const target=room.agents.find(a=>a.id===targetId) ?? leadOf(room);
  if(!target?.backend || target.kind!=="bot" || telegramPosts.has(room.id))return;
  const backend=target.backend;
  telegramPosts.add(room.id);
  const clientId=uid("tg-pending"),ts=Date.now();
  const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),30000);
  const wait={clientId,backend,ts,priorAgentIds:room.messages.filter(m=>m.role==="agent").map(m=>m.id)};
  updateRoom(room.id,r=>({...r,messages:[...r.messages,{id:clientId,role:"user",content:text,ts,optimistic:true,senderName:"You",backend}],
    telegram:{...r.telegram!,delivery:"posting",error:undefined,pendingMessages:[...r.telegram!.pendingMessages,{clientId,content:text,ts,backend,priorUserIds:r.messages.filter(m=>m.role==="user").map(m=>m.id)}],awaitingReplies:[...(r.telegram!.awaitingReplies ?? []),wait]}}));
  try {
    const response=await fetch("/api/integrations/send",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({roomId:room.id,text,backend})});
    const result=await response.json() as {ok?:boolean;messageId?:string;roomId?:string;error?:string};
    if(!response.ok || result.ok!==true || !result.messageId || result.roomId!==room.id)throw new Error(result.error || `Telegram post failed (${response.status})`);
    const messageId=String(result.messageId);
    updateRoom(room.id,r=>{
      const observed=r.messages.find(m=>m.id===messageId);
      const replied=observed && r.messages.some(m=>m.role==="agent" && m.agentId===target.id && !wait.priorAgentIds.includes(m.id) && m.ts>=observed.ts && Number(m.id)>Number(messageId));
      const awaitingReplies=(r.telegram!.awaitingReplies ?? []).flatMap(w=>w.clientId!==clientId ? [w] : replied ? [] : [{...w,messageId}]);
      return {...r,messages:observed?r.messages.filter(m=>m.id!==clientId):r.messages,telegram:{...r.telegram!,delivery:awaitingReplies.length?"queued":undefined,awaitingReplies,
        pendingMessages:r.telegram!.pendingMessages.flatMap(p=>p.clientId!==clientId?[p]:observed?[]:[{...p,messageId}])}};
    });
  }catch(error){
    const message=error instanceof Error && error.name!=="AbortError" ? error.message : "Delivery unconfirmed. Check Telegram before retrying.";
    updateRoom(room.id,r=>({...r,messages:[...r.messages.filter(m=>m.id!==clientId),{id:uid("tg-error"),role:"system",content:`Telegram delivery error: ${message}`,ts:Date.now(),error:true}],
      telegram:{...r.telegram!,delivery:"error",error:message,pendingMessages:r.telegram!.pendingMessages.filter(p=>p.clientId!==clientId),awaitingReplies:r.telegram!.awaitingReplies?.filter(w=>w.clientId!==clientId)}}));
  }finally{clearTimeout(deadline);telegramPosts.delete(room.id);}
}

export async function sendMessage(roomId: string, text: string, targetAgentId?: string | null) {
  const room = getState().rooms.find((r) => r.id === roomId);
  if (!room || !text.trim()) return;
  if (room.telegram) return sendTelegramMessage(room, text.trim(), targetAgentId);

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
  if (room.backend === "claude-code") await runClaudeCode(roomId, body, target.id);
  else await runHermes(roomId, target.id, undefined, 0);
}

/* ----- hermes-agent (OpenAI-compatible) ----- */

async function runHermes(roomId: string, agentId: string, delegatedTask: string | undefined, depth: number, from?: string) {
  const room = getState().rooms.find((r) => r.id === roomId);
  const agent = room?.agents.find((a) => a.id === agentId);
  if (!room || !agent) return;

  controllers.get(agentId)?.abort();
  const ctrl = new AbortController();
  controllers.set(agentId, ctrl);

  const run = new AgentRun(roomId, agentId, from, delegatedTask);
  const extra = delegatedTask ? `${from ?? "Your lead"} delegated this task to you: ${delegatedTask}` : undefined;
  try {
    await streamChat(toChatMessages(room, agent, extra), (chunk) => run.append(chunk), ctrl.signal);
  } catch (err) {
    run.fail((err as Error).message, (err as Error).name === "AbortError");
    controllers.delete(agentId);
    return;
  }
  controllers.delete(agentId);
  const delegations = run.finish();

  if (depth >= MAX_DELEGATION_DEPTH) return;
  const fresh = getState().rooms.find((r) => r.id === roomId);
  await Promise.all(
    delegations.map((d) => {
      if (d.kind !== "delegate") return;
      const mate = fresh?.agents.find((a) => a.name.toLowerCase() === d.agent.toLowerCase() && a.id !== agentId);
      if (!mate) return;
      pushFx({ kind: "handoff", roomId, from: agentId, to: mate.id });
      updateRoom(roomId, (r) => ({
        ...r,
        steps: [...r.steps, { id: uid("st"), agentId: mate.id, title: "More coming", description: d.task, status: "pending", ts: Date.now() }],
      }));
      return runHermes(roomId, mate.id, d.task, depth + 1, agent.name);
    }),
  );
}

/* ----- Claude Code (Agent SDK) with subagents ----- */

/** Finds the office agent for a subagent type, adding one to the room when Claude Code uses a subagent the room doesn't have yet. */
function agentForSubagent(roomId: string, type: string): string {
  const room = getState().rooms.find((r) => r.id === roomId)!;
  const key = type.toLowerCase();
  const found = room.agents.find((a) => subagentType(a).toLowerCase() === key || a.name.toLowerCase() === key);
  if (found) return found.id;
  const agent: Agent = {
    id: uid("ag"),
    name: type.charAt(0).toUpperCase() + type.slice(1),
    title: "Claude Code subagent",
    persona: "",
    isLead: false,
    status: "idle",
    look: lookFor(type),
    source: "builtin",
    subagentId: type,
  };
  updateRoom(roomId, (r) => ({ ...r, agents: [...r.agents, agent] }));
  return agent.id;
}

async function runClaudeCode(roomId: string, text: string, targetAgentId: string) {
  const room = getState().rooms.find((r) => r.id === roomId);
  if (!room) return;
  const lead = leadOf(room);
  const target = room.agents.find((a) => a.id === targetAgentId) ?? lead;
  const prompt =
    target.id === lead.id ? text : `Delegate this to the "${subagentType(target)}" subagent (${target.name}) with the Agent tool:\n\n${text}`;

  controllers.get(roomId)?.abort();
  const ctrl = new AbortController();
  controllers.set(roomId, ctrl);

  // The lead's run; a new one starts when it keeps talking after a turn ended (e.g. a background subagent reported back).
  let main = new AgentRun(roomId, lead.id);
  const leadRun = () => (main.finished ? (main = new AgentRun(roomId, lead.id)) : main);
  const subs = new Map<string, AgentRun>(); // tool_use id → run

  const runFor = (parent: string | null) => (parent ? subs.get(parent) : undefined) ?? leadRun();

  try {
    const res = await fetch("/api/claude-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        prompt,
        systemAppend: claudeCodeSystemAppend(room, lead),
        subagents: claudeCodeSubagents(room, lead),
        sessionId: room.ccSessionId,
      }),
    });
    if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `Claude Code request failed (${res.status})`);

    await readOfficeEvents(res, (e: OfficeEvent) => {
      switch (e.type) {
        case "session":
          updateRoom(roomId, (r) => ({ ...r, ccSessionId: e.id }));
          break;
        case "text":
          runFor(e.parent).append(e.delta);
          break;
        case "tool":
          runFor(e.parent).tool(e.name, e.detail);
          break;
        case "subagent_start": {
          if (subs.has(e.toolUseId)) break;
          const agentId = agentForSubagent(roomId, e.agent);
          pushFx({ kind: "handoff", roomId, from: lead.id, to: agentId });
          leadRun().tool("Agent", `${e.agent} · ${e.task}`.slice(0, 80));
          const run = new AgentRun(roomId, agentId, lead.name, e.task);
          run.reportTitle = e.task ? e.task.charAt(0).toUpperCase() + e.task.slice(1) : "Report";
          subs.set(e.toolUseId, run);
          break;
        }
        case "subagent_progress":
          if (e.tool) subs.get(e.toolUseId)?.tool(e.tool, e.text.slice(0, 60));
          break;
        case "subagent_end": {
          const run = subs.get(e.toolUseId);
          if (run) run.finish(e.summary);
          break;
        }
        case "result":
          updateRoom(roomId, (r) => ({ ...r, ccSessionId: e.sessionId, costUsd: (r.costUsd ?? 0) + (e.costUsd ?? 0) }));
          if (main.finished) break;
          if (!e.ok) main.fail(e.text, false);
          else {
            // the lead's text streams in pieces between tool calls; fall back to the final answer
            if (!main.text.trim()) main.append(e.text);
            main.finish();
          }
          break;
        case "error":
          leadRun().fail(e.message, false);
          break;
        case "done":
          for (const run of subs.values()) run.finish();
          if (!main.finished) main.finish();
          break;
      }
    });
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    for (const run of subs.values()) run.fail((err as Error).message, aborted);
    main.fail((err as Error).message, aborted);
  } finally {
    controllers.delete(roomId);
  }
}
