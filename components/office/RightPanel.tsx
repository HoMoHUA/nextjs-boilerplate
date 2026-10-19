"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { topicActors } from "@/lib/topics";
import { actions, leadOf, stopAgent, loadTopicHistory } from "@/lib/store";
import type { Agent, AgentStatus, OfficeState, Room, Step } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";
import { ApprovalCard } from "./ApprovalCard";
import { Check, ChevronLeft, ChevronRight, Stop } from "./icons";
import { Markdown } from "./Markdown";

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "READY",
  working: "WORKING",
  needs_you: "NEEDS YOU",
  done: "DONE",
};

const STATUS_TEXT: Record<AgentStatus, string> = {
  idle: "Waiting for a task. Type anything in the chat bar below.",
  working: "Working on it right now — follow the steps below.",
  needs_you: "Waiting on your approval before continuing.",
  done: "Finished the last task. Send another one any time.",
};

const panel = "rounded-[16px] bg-surface/80 shadow-[0_1px_2px_rgba(20,22,30,0.04),0_10px_30px_rgba(20,22,30,0.05)] backdrop-blur";
const sectionTitle = "mb-3 text-[12px] font-semibold tracking-wider text-muted";

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className={`${panel} px-4 py-4`}>
      <div className="flex items-center gap-2.5">
        <AgentAvatar look={agent.look} size={34} />
        <span className="text-[15px] font-semibold text-ink">{agent.name}</span>
        <span className="truncate text-[11.5px] text-muted">{agent.title}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {agent.status === "working" && !agent.runtime && (
            <button onClick={() => stopAgent(agent.id)} title="Stop" className="rounded p-0.5 text-danger hover:bg-red-50">
              <Stop />
            </button>
          )}
          <span className="rounded-[5px] border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted">
            {STATUS_LABEL[agent.status]}
          </span>
        </span>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">{agent.topicRoomId ? "Follow this topic’s actual messages and activity. Choose the reply engine in the message bar." : agent.runtime && agent.kind === "subagent" ? "Recorded runtime worker · read-only. New tasks are delegated by its lead agent." : STATUS_TEXT[agent.status]}</p>
    </div>
  );
}

function StepIcon({ step }: { step: Step }) {
  if (step.status === "running")
    return (
      <span className="relative grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-accent-line bg-surface">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-line border-t-transparent" />
      </span>
    );
  if (step.status === "pending")
    return (
      <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-dashed border-line bg-surface text-[9px] text-muted">
        •••
      </span>
    );
  return (
    <span className={`grid h-[22px] w-[22px] place-items-center rounded-full text-white ${step.handoff ? "bg-[#1f9d63]" : "bg-action"}`}>
      {step.handoff ? <span className="h-2 w-2 rounded-full bg-surface" /> : <Check />}
    </span>
  );
}

function Timeline({ room }: { room: Room }) {
  const steps = room.steps.slice(-8);
  const name = (id: string) => room.agents.find((a) => a.id === id)?.name ?? "Agent";
  if (!steps.length)
    return <div className={`${panel} px-5 py-6 text-[13px] text-muted`}>Nothing yet — send a task and you’ll see every step here.</div>;
  return (
    <div className={`${panel} px-5 py-5`}>
      <ol className="relative">
        {steps.map((s, i) => (
          <li key={s.id} className="relative flex gap-4 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[10.5px] top-6 h-[calc(100%-18px)] w-px bg-line" />}
            <div className="relative z-10 shrink-0 pt-0.5">
              <StepIcon step={s} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[12px]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5ccf6a]" />
                <span className="font-semibold text-ink">{name(s.agentId)}</span>
                <span className="text-muted">agent</span>
              </div>
              <div className={`mt-1 text-[13.5px] font-semibold ${s.status === "done" ? "text-ink" : "text-muted"}`}>{s.title}</div>
              <div className="mt-0.5 line-clamp-2 text-[11.5px] text-muted">{s.description || "Step description"}</div>
              {s.status === "running" && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${s.progress ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] text-muted">{Math.round(s.progress ?? 0)} %</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Inspector({ s, room }: { s: OfficeState; room: Room }) {
  const agent = room.telegram ? topicActors({...s,rooms:[room],visibleTopicIds:undefined})[0] : room.agents.find(a=>a.id===s.selectedAgentId) ?? leadOf(room);
  const pending = room.approvals.filter((a) => a.status === "pending");
  return (
    <div className="flex flex-col gap-8">
      {agent && <AgentCard agent={agent} />}
      <section>
        <h3 className={sectionTitle}>NEEDS YOU</h3>
        {pending.length ? (
          <div className="flex flex-col gap-3">
            {pending.map((a) => (
              <div key={a.id} className="rounded-[16px] border border-accent-line bg-gradient-to-b from-white to-[#f1f5ff] px-4 py-4 shadow-[0_10px_30px_rgba(43,92,246,0.08)]">
                <ApprovalCard roomId={room.id} approval={a} agent={room.agents.find((x) => x.id === a.agentId)} variant="panel" />
              </div>
            ))}
          </div>
        ) : (
          <div className={`${panel} px-5 py-4 text-[13px] text-muted`}>Nothing waiting on you.</div>
        )}
      </section>
      <section>
        <h3 className={sectionTitle}>WHAT IT IS ACTUALLY DOING</h3>
        <Timeline room={room} />
      </section>
    </div>
  );
}

function Outputs({ s, room }: { s: OfficeState; room: Room }) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (s.focusOutputId) refs.current[s.focusOutputId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [s.focusOutputId]);
  if (!room.outputs.length) return <div className={`${panel} px-5 py-6 text-[13px] text-muted`}>No outputs yet.</div>;
  return (
    <div className="flex flex-col gap-3">
      {[...room.outputs].reverse().map((o) => {
        const agent = room.agents.find((a) => a.id === o.agentId);
        const apr = room.approvals.find((a) => a.outputId === o.id && a.status === "pending");
        return (
          <div key={o.id} ref={(el) => { refs.current[o.id] = el; }} className={`${panel} px-4 py-4 ${s.focusOutputId === o.id ? "ring-2 ring-[#4f7cf5]/50" : ""}`}>
            <div className="flex items-center gap-2">
              {agent && <AgentAvatar look={agent.look} size={26} />}
              <span className="truncate text-[13.5px] font-semibold text-ink">{o.title}</span>
              <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${o.status === "approved" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                {o.status === "approved" ? "APPROVED" : "DRAFT"}
              </span>
            </div>
            <div className="mt-3 max-h-80 overflow-auto text-[12.5px] leading-relaxed text-ink">
              <Markdown text={o.content} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => navigator.clipboard?.writeText(o.content)} className="rounded-full border border-line px-3 py-1 text-[12px] text-muted hover:bg-inset">
                Copy
              </button>
              {apr && (
                <>
                  <button onClick={() => actions.reject(room.id, apr.id)} className="rounded-full border border-line px-3 py-1 text-[12px] text-muted hover:bg-inset">
                    Reject
                  </button>
                  <button onClick={() => actions.approve(room.id, apr.id)} className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-link hover:bg-accent-soft">
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Thread({ room }: { room: Room }) {
  const root=useRef<HTMLDivElement>(null),nearBottom=useRef(true);
  const before=useRef<{roomId:string;first?:string;last?:string;height:number}|null>(null);
  const scroller=()=>{let node=root.current?.parentElement;while(node && !/auto|scroll/.test(getComputedStyle(node).overflowY))node=node.parentElement;return node;};
  useEffect(()=>{const node=scroller();const scroll=()=>{if(node)nearBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<100;};node?.addEventListener("scroll",scroll,{passive:true});return()=>node?.removeEventListener("scroll",scroll);},[room.id]);
  const first=room.messages[0],last=room.messages.at(-1);
  useLayoutEffect(()=>{
    const node=scroller();if(!node)return;
    const previous=before.current;
    if(!previous || previous.roomId!==room.id){node.scrollTop=node.scrollHeight;nearBottom.current=true;}
    else if(previous.first!==first?.id && previous.last===last?.id)node.scrollTop+=node.scrollHeight-previous.height;
    else if(nearBottom.current || last?.optimistic)node.scrollTop=node.scrollHeight;
    before.current={roomId:room.id,first:first?.id,last:last?.id,height:node.scrollHeight};
  },[room.id,first?.id,last?.id,last?.content,room.messages.length,last?.optimistic]);
  const time=(ts:number)=>ts?new Date(ts).toLocaleString("en-US", {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"";
  return <div ref={root} data-testid="topic-thread" className="flex min-w-0 flex-col gap-3">
    {room.telegram && <div className="flex flex-col items-center gap-2 text-[12px]">
      {room.telegram.hasMore && <button disabled={room.telegram.historyLoading} onClick={()=>void loadTopicHistory(room.id,true)} className="rounded-full border border-line bg-surface px-4 py-2 disabled:opacity-40">Load older messages</button>}
      {room.telegram.historyLoading && <span role="status">Loading topic messages…</span>}
      {room.telegram.historyError && <button className="text-red-700" onClick={()=>void loadTopicHistory(room.id,false,true)}>{room.telegram.historyError} · Retry</button>}
    </div>}
    {!room.messages.length && !room.telegram?.historyLoading && <div className={`${panel} px-5 py-6 text-[13px] text-muted`}>No messages yet.</div>}
    {room.messages.map(m=>{
      const agent=room.agents.find(a=>a.id===m.agentId);
      if(m.role==="user")return <div key={m.id} data-message-id={m.id} className="ml-6 max-w-full self-end break-words rounded-[16px] rounded-br-[4px] bg-action px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
        <div className="mb-1 text-[10px] text-white/70">{m.senderName ?? "You"} · {time(m.ts)}{m.optimistic ? " · Sending…" : ""}</div>
        <div dir="auto" className="whitespace-pre-wrap">{m.content}</div>
        {m.media && <div className="mt-1 text-[11px] text-white/70">📎 {m.media.name ?? m.media.type}</div>}
      </div>;
      return <div key={m.id} data-message-id={m.id} className="mr-4 flex min-w-0 gap-2">
        {agent && <span className="shrink-0"><AgentAvatar look={agent.look} size={28}/></span>}
        <div className={`min-w-0 break-words rounded-[16px] rounded-tl-[4px] px-3.5 py-2.5 text-[13px] leading-relaxed ${m.error ? "bg-red-50 text-red-700" : "bg-surface/90 text-ink shadow-sm"}`}>
          <div className="mb-1 text-[11px] font-semibold text-muted">{agent?.name ?? m.senderName ?? (m.role==="system"?"System":"Bot")} · {time(m.ts)}</div>
          <div dir="auto">{m.content ? <Markdown text={m.content}/> : m.streaming ? "typing…" : null}</div>
          {m.media && <div className="mt-1 text-[11px]">📎 {m.media.name ?? m.media.type}</div>}
        </div>
      </div>;
    })}
  </div>;
}

const TABS = [
  ["inspector", "Inspector"],
  ["output", "Output"],
  ["thread", "Thread"],
] as const;

/** Inspector / Output / Thread content for the active room (shared by the side panel and the mobile sheet). */
export function PanelContent({ s, room }: { s: OfficeState; room: Room }) {
  return (
    <>
      {s.view !== "room" && (
        <button
          onClick={() => actions.selectRoom(room.id)}
          className="mb-4 flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1.5 text-[12.5px] text-ink shadow-sm hover:bg-surface"
        >
          <span>{room.emoji}</span>
          <span className="font-semibold">{room.name}</span>
          <span className="text-muted">· open room</span>
        </button>
      )}
      {s.rightTab === "inspector" && <Inspector s={s} room={room} />}
      {s.rightTab === "output" && <Outputs s={s} room={room} />}
      {s.rightTab === "thread" && <Thread room={room} />}
    </>
  );
}

/** Bottom sheet for phones: a peek bar with the tabs that expands over the office. */
export function MobileSheet({ s, room, side = false }: { s: OfficeState; room: Room; side?: boolean }) {
  const open = !s.panelCollapsed;
  const needs = room.approvals.filter((a) => a.status === "pending").length;
  const startY = useRef<number | null>(null);
  if (side) return <SidePanel s={s} room={room} open={open} needs={needs} />;
  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[22px] border-t border-white/70 bg-inset/95 shadow-[0_-12px_30px_rgba(20,22,30,0.08)] backdrop-blur-md transition-[height] duration-300 ease-out ${
        open ? "h-[72%]" : "h-[60px]"
      }`}
      onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (startY.current === null) return;
        const dy = e.changedTouches[0].clientY - startY.current;
        startY.current = null;
        if (dy < -40 && !open) actions.set("panelCollapsed", false);
        if (dy > 60 && open) actions.set("panelCollapsed", true);
      }}
    >
      <button onClick={() => actions.set("panelCollapsed", open)} className="mx-auto mt-1.5 h-1.5 w-11 shrink-0 rounded-full bg-line" aria-label={open ? "Collapse panel" : "Expand panel"} />
      <div className="flex shrink-0 items-center gap-1 px-3 pt-1.5">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              actions.set("rightTab", id);
              actions.set("panelCollapsed", false);
            }}
            className={`relative h-9 rounded-full px-4 text-[13.5px] transition ${open && s.rightTab === id ? "bg-action font-semibold text-white" : "text-ink"}`}
          >
            {label}
            {id === "inspector" && needs > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ea2b2b] px-1 text-[10px] font-bold text-white">{needs}</span>
            )}
          </button>
        ))}
        <button onClick={() => actions.set("panelCollapsed", open)} className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-surface/80 shadow-sm" aria-label="Toggle panel">
          <ChevronRight className={`transition-transform ${open ? "rotate-90" : "-rotate-90"}`} />
        </button>
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4">
          <PanelContent s={s} room={room} />
        </div>
      )}
    </div>
  );
}

const TAB_ICON: Record<(typeof TABS)[number][0], string> = { inspector: "🔍", output: "📄", thread: "💬" };

/** Landscape phones: the panel slides in from the right edge instead of from the bottom. */
function SidePanel({ s, room, open, needs }: { s: OfficeState; room: Room; open: boolean; needs: number }) {
  return (
    <div
      className={`absolute inset-y-0 right-0 z-30 flex border-l border-white/70 bg-inset/95 shadow-[-12px_0_30px_rgba(20,22,30,0.08)] backdrop-blur-md transition-[width] duration-300 ${
        open ? "w-[min(400px,62vw)]" : "w-[56px]"
      }`}
    >
      <div className="flex w-[56px] shrink-0 flex-col items-center gap-2 py-2">
        <button onClick={() => actions.set("panelCollapsed", open)} className="grid h-9 w-9 place-items-center rounded-full bg-surface/80 shadow-sm" aria-label="Toggle panel">
          <ChevronLeft className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            title={label}
            aria-label={label}
            onClick={() => {
              actions.set("rightTab", id);
              actions.set("panelCollapsed", false);
            }}
            className={`relative grid h-9 w-9 place-items-center rounded-full text-[16px] ${open && s.rightTab === id ? "bg-action" : "bg-surface/80"}`}
          >
            {TAB_ICON[id]}
            {id === "inspector" && needs > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ea2b2b] px-1 text-[10px] font-bold text-white">{needs}</span>
            )}
          </button>
        ))}
      </div>
      {open && (
        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain py-3 pr-3">
          <PanelContent s={s} room={room} />
        </div>
      )}
    </div>
  );
}

export function RightPanel({ s, room }: { s: OfficeState; room: Room }) {
  if (s.panelCollapsed)
    return (
      <div className="flex w-14 justify-center pt-10">
        <button onClick={() => actions.set("panelCollapsed", false)} className="grid h-12 w-12 place-items-center rounded-full bg-surface/70 shadow-sm hover:bg-surface" aria-label="Expand panel">
          <ChevronLeft />
        </button>
      </div>
    );

  return (
    <aside className="flex w-[340px] shrink-0 flex-col pt-10 max-[1279px]:absolute max-[1279px]:inset-y-0 max-[1279px]:right-0 max-[1279px]:z-40 max-[1279px]:bg-inset/95 max-[1279px]:px-5 max-[1279px]:shadow-[-20px_0_40px_rgba(20,22,30,0.08)] max-[1279px]:backdrop-blur-md min-[1800px]:w-[380px]">
      <div className="flex items-center gap-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => actions.set("rightTab", id)}
            className={`h-12 rounded-full px-5 text-[14.5px] transition min-[1800px]:px-6 ${s.rightTab === id ? "bg-action font-semibold text-white" : "text-ink hover:bg-surface/60"}`}
          >
            {label}
          </button>
        ))}
        <button onClick={() => actions.set("panelCollapsed", true)} className="ml-auto grid h-12 w-12 place-items-center rounded-full bg-surface/70 shadow-sm hover:bg-surface" aria-label="Collapse panel">
          <ChevronRight />
        </button>
      </div>
      <div className="mt-8 flex-1 overflow-y-auto pb-8 pr-1">
        <PanelContent s={s} room={room} />
      </div>
    </aside>
  );
}
