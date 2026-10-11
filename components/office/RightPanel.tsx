"use client";

import { useEffect, useRef } from "react";
import { actions, leadOf, stopAgent } from "@/lib/store";
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

const panel = "rounded-[16px] bg-white/80 shadow-[0_1px_2px_rgba(20,22,30,0.04),0_10px_30px_rgba(20,22,30,0.05)] backdrop-blur";
const sectionTitle = "mb-3 text-[12px] font-semibold tracking-wider text-[#4e525d]";

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className={`${panel} px-4 py-4`}>
      <div className="flex items-center gap-2.5">
        <AgentAvatar look={agent.look} size={34} />
        <span className="text-[15px] font-semibold text-[#1d1f26]">{agent.name}</span>
        <span className="truncate text-[11.5px] text-[#7a7e89]">{agent.title}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {agent.status === "working" && (
            <button onClick={() => stopAgent(agent.id)} title="Stop" className="rounded p-0.5 text-[#e04848] hover:bg-red-50">
              <Stop />
            </button>
          )}
          <span className="rounded-[5px] border border-[#dfe1e6] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#4e525d]">
            {STATUS_LABEL[agent.status]}
          </span>
        </span>
      </div>
      <p className="mt-2 text-[12.5px] text-[#6c707b]">{STATUS_TEXT[agent.status]}</p>
    </div>
  );
}

function StepIcon({ step }: { step: Step }) {
  if (step.status === "running")
    return (
      <span className="relative grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-[#2b5cf6] bg-white">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#2b5cf6] border-t-transparent" />
      </span>
    );
  if (step.status === "pending")
    return (
      <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-dashed border-[#b9bcc5] bg-white text-[9px] text-[#9a9ea8]">
        •••
      </span>
    );
  return (
    <span className={`grid h-[22px] w-[22px] place-items-center rounded-full text-white ${step.handoff ? "bg-[#1f9d63]" : "bg-[#16171d]"}`}>
      {step.handoff ? <span className="h-2 w-2 rounded-full bg-white" /> : <Check />}
    </span>
  );
}

function Timeline({ room }: { room: Room }) {
  const steps = room.steps.slice(-8);
  const name = (id: string) => room.agents.find((a) => a.id === id)?.name ?? "Agent";
  if (!steps.length)
    return <div className={`${panel} px-5 py-6 text-[13px] text-[#8b8f99]`}>Nothing yet — send a task and you’ll see every step here.</div>;
  return (
    <div className={`${panel} px-5 py-5`}>
      <ol className="relative">
        {steps.map((s, i) => (
          <li key={s.id} className="relative flex gap-4 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[10.5px] top-6 h-[calc(100%-18px)] w-px bg-[#d9dbe0]" />}
            <div className="relative z-10 shrink-0 pt-0.5">
              <StepIcon step={s} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[12px]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5ccf6a]" />
                <span className="font-semibold text-[#1d1f26]">{name(s.agentId)}</span>
                <span className="text-[#a0a3ac]">agent</span>
              </div>
              <div className={`mt-1 text-[13.5px] font-semibold ${s.status === "done" ? "text-[#1d1f26]" : "text-[#7a7e89]"}`}>{s.title}</div>
              <div className="mt-0.5 line-clamp-2 text-[11.5px] text-[#7a7e89]">{s.description || "Step description"}</div>
              {s.status === "running" && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#e3e5ea]">
                    <div className="h-full rounded-full bg-[#2b5cf6] transition-all" style={{ width: `${s.progress ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] text-[#9a9ea8]">{Math.round(s.progress ?? 0)} %</span>
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
  const agent = room.agents.find((a) => a.id === s.selectedAgentId) ?? leadOf(room);
  const pending = room.approvals.filter((a) => a.status === "pending");
  return (
    <div className="flex flex-col gap-8">
      {agent && <AgentCard agent={agent} />}
      <section>
        <h3 className={sectionTitle}>NEEDS YOU</h3>
        {pending.length ? (
          <div className="flex flex-col gap-3">
            {pending.map((a) => (
              <div key={a.id} className="rounded-[16px] border border-[#b9cbfb] bg-gradient-to-b from-white to-[#f1f5ff] px-4 py-4 shadow-[0_10px_30px_rgba(43,92,246,0.08)]">
                <ApprovalCard roomId={room.id} approval={a} agent={room.agents.find((x) => x.id === a.agentId)} variant="panel" />
              </div>
            ))}
          </div>
        ) : (
          <div className={`${panel} px-5 py-4 text-[13px] text-[#8b8f99]`}>Nothing waiting on you.</div>
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
  if (!room.outputs.length) return <div className={`${panel} px-5 py-6 text-[13px] text-[#8b8f99]`}>No outputs yet.</div>;
  return (
    <div className="flex flex-col gap-3">
      {[...room.outputs].reverse().map((o) => {
        const agent = room.agents.find((a) => a.id === o.agentId);
        const apr = room.approvals.find((a) => a.outputId === o.id && a.status === "pending");
        return (
          <div key={o.id} ref={(el) => { refs.current[o.id] = el; }} className={`${panel} px-4 py-4 ${s.focusOutputId === o.id ? "ring-2 ring-[#4f7cf5]/50" : ""}`}>
            <div className="flex items-center gap-2">
              {agent && <AgentAvatar look={agent.look} size={26} />}
              <span className="truncate text-[13.5px] font-semibold text-[#1d1f26]">{o.title}</span>
              <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${o.status === "approved" ? "bg-[#e3f6ea] text-[#1f9d63]" : "bg-[#fff4dc] text-[#b07a10]"}`}>
                {o.status === "approved" ? "APPROVED" : "DRAFT"}
              </span>
            </div>
            <div className="mt-3 max-h-80 overflow-auto text-[12.5px] leading-relaxed text-[#3a3d47]">
              <Markdown text={o.content} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => navigator.clipboard?.writeText(o.content)} className="rounded-full border border-[#e3e5ea] px-3 py-1 text-[12px] text-[#4e525d] hover:bg-[#f5f6f8]">
                Copy
              </button>
              {apr && (
                <>
                  <button onClick={() => actions.reject(room.id, apr.id)} className="rounded-full border border-[#e3e5ea] px-3 py-1 text-[12px] text-[#4e525d] hover:bg-[#f5f6f8]">
                    Reject
                  </button>
                  <button onClick={() => actions.approve(room.id, apr.id)} className="rounded-full border border-[#e3e5ea] px-3 py-1 text-[12px] font-semibold text-[#2156f3] hover:bg-[#eef3ff]">
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
  const end = useRef<HTMLDivElement>(null);
  const last = room.messages[room.messages.length - 1];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [room.messages.length, last?.content]);
  if (!room.messages.length) return <div className={`${panel} px-5 py-6 text-[13px] text-[#8b8f99]`}>No messages yet.</div>;
  return (
    <div className="flex flex-col gap-3">
      {room.messages.map((m) => {
        const agent = room.agents.find((a) => a.id === m.agentId);
        if (m.role === "user")
          return (
            <div key={m.id} className="ml-10 self-end rounded-[16px] rounded-br-[4px] bg-[#16171d] px-3.5 py-2.5 text-[13px] leading-relaxed text-white whitespace-pre-wrap">
              {m.content}
            </div>
          );
        return (
          <div key={m.id} className="mr-6 flex gap-2">
            {agent && <span className="shrink-0"><AgentAvatar look={agent.look} size={28} /></span>}
            <div className={`min-w-0 rounded-[16px] rounded-tl-[4px] px-3.5 py-2.5 text-[13px] leading-relaxed ${m.error ? "bg-red-50 text-red-700" : "bg-white/90 text-[#2a2d36] shadow-sm"}`}>
              <div className="mb-0.5 text-[11px] font-semibold text-[#6c707b]">{agent?.name ?? "Agent"}</div>
              {m.content ? <Markdown text={m.content} /> : m.streaming ? <span className="text-[#9a9ea8]">typing…</span> : null}
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

export function RightPanel({ s, room }: { s: OfficeState; room: Room }) {
  if (s.panelCollapsed)
    return (
      <div className="flex w-14 justify-center pt-10">
        <button onClick={() => actions.set("panelCollapsed", false)} className="grid h-12 w-12 place-items-center rounded-full bg-white/70 shadow-sm hover:bg-white" aria-label="Expand panel">
          <ChevronLeft />
        </button>
      </div>
    );

  const tabs = [
    ["inspector", "Inspector"],
    ["output", "Output"],
    ["thread", "Thread"],
  ] as const;
  return (
    <aside className="flex w-[340px] shrink-0 flex-col pt-10 min-[1800px]:w-[380px]">
      <div className="flex items-center gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => actions.set("rightTab", id)}
            className={`h-12 rounded-full px-5 text-[14.5px] transition min-[1800px]:px-6 ${s.rightTab === id ? "bg-[#16171d] font-semibold text-white" : "text-[#2a2d36] hover:bg-white/60"}`}
          >
            {label}
          </button>
        ))}
        <button onClick={() => actions.set("panelCollapsed", true)} className="ml-auto grid h-12 w-12 place-items-center rounded-full bg-white/70 shadow-sm hover:bg-white" aria-label="Collapse panel">
          <ChevronRight />
        </button>
      </div>
      <div className="mt-8 flex-1 overflow-y-auto pb-8 pr-1">
        {s.view !== "room" && (
          <button
            onClick={() => actions.selectRoom(room.id)}
            className="mb-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-[12.5px] text-[#3a3d47] shadow-sm hover:bg-white"
          >
            <span>{room.emoji}</span>
            <span className="font-semibold">{room.name}</span>
            <span className="text-[#9a9ea8]">· open room</span>
          </button>
        )}
        {s.rightTab === "inspector" && <Inspector s={s} room={room} />}
        {s.rightTab === "output" && <Outputs s={s} room={room} />}
        {s.rightTab === "thread" && <Thread room={room} />}
      </div>
    </aside>
  );
}
