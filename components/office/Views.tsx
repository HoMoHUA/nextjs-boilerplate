"use client";

import { useState } from "react";
import { actions, setState } from "@/lib/store";
import { uid } from "@/lib/seed";
import type { OfficeState } from "@/lib/types";
import { visibleRooms, topicActors } from "@/lib/topics";
import { AgentAvatar } from "./AgentAvatar";

const card = "rounded-[18px] bg-surface/80 p-5 shadow-[0_10px_30px_rgba(20,22,30,0.05)] backdrop-blur";

export function LoungeView({ s }: { s: OfficeState }) {
  return (
    <div className="h-full overflow-y-auto px-2 pb-10">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visibleRooms(s).map((r) => {
          const pending = r.approvals.filter((a) => a.status === "pending").length;
          const last = r.messages[r.messages.length - 1];
          const actors=r.telegram ? topicActors({...s,rooms:[r],visibleTopicIds:undefined}) : r.agents;
          return (
            <button key={r.id} onClick={() => actions.selectRoom(r.id)} className={`${card} text-left transition hover:-translate-y-0.5 hover:bg-surface`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{r.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">{r.name}</div>
                  <div className="text-[12px] text-muted">
                    {r.telegram ? "Telegram topic" : `${r.agents.length} agents · ${r.outputs.length} outputs`}
                  </div>
                </div>
                {pending > 0 && <span className="rounded bg-action px-1.5 py-0.5 text-[10px] font-bold text-white">{pending} NEEDS YOU</span>}
              </div>
              <div className="mt-4 flex gap-2">
                {actors.map((a) => (
                  <div key={a.id} className="flex flex-col items-center gap-1">
                    <AgentAvatar look={a.look} size={36} />
                    <span className="text-[11px] text-muted">{a.name}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${a.status === "working" ? "animate-pulse bg-accent" : a.status === "needs_you" ? "bg-[#ea2b2b]" : "bg-[#5ccf6a]"}`} />
                  </div>
                ))}
              </div>
              <p className="mt-3 line-clamp-2 text-[12.5px] text-muted">{last ? last.content : "No conversation yet."}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScheduleView({ s }: { s: OfficeState }) {
  const [roomId, setRoomId] = useState(s.rooms[0]?.id ?? "");
  const room = s.rooms.find((r) => r.id === roomId) ?? s.rooms[0];
  const [agentId, setAgentId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [every, setEvery] = useState(60);
  const input = "rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent-line";

  const add = () => {
    if (!prompt.trim() || !room) return;
    const agent = room.agents.find((a) => a.id === agentId) ?? room.agents[0];
    setState((st) => ({
      ...st,
      schedules: [
        ...st.schedules,
        { id: uid("sch"), roomId: room.id, agentId: agent.id, prompt, everyMinutes: Math.max(1, every), nextRunAt: Date.now() + every * 60000, enabled: true },
      ],
    }));
    setPrompt("");
  };

  return (
    <div className="mx-auto h-full max-w-[720px] overflow-y-auto px-2 pb-10">
      <div className={card}>
        <h3 className="text-[15px] font-semibold">Schedule a recurring task</h3>
        <p className="mt-1 text-[12px] text-muted">Runs while this office is open in a browser tab. For server-side jobs use hermes-agent’s own cron.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <select className={input} value={room?.id} onChange={(e) => setRoomId(e.target.value)}>
            {s.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.emoji} {r.name}
              </option>
            ))}
          </select>
          <select className={input} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {room?.agents.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.name}
              </option>
            ))}
          </select>
          <textarea className={`${input} col-span-2 h-20 resize-none`} placeholder="e.g. Summarize today's metrics and flag anything unusual" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <label className="flex items-center gap-2 text-[13px]">
            every <input type="number" min={1} className={`${input} w-24`} value={every} onChange={(e) => setEvery(Number(e.target.value))} /> minutes
          </label>
          <button onClick={add} className="justify-self-end rounded-full bg-action px-5 py-2 text-[13px] font-semibold text-white">
            Add schedule
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {s.schedules.map((x) => {
          const r = s.rooms.find((y) => y.id === x.roomId);
          const a = r?.agents.find((y) => y.id === x.agentId);
          return (
            <div key={x.id} className={`${card} flex items-center gap-4`}>
              <span className="text-2xl">{r?.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{x.prompt}</div>
                <div className="text-[12px] text-muted">
                  {r?.name} · @{a?.name} · every {x.everyMinutes} min · next {new Date(x.nextRunAt).toLocaleTimeString("en-US")}
                </div>
              </div>
              <button
                onClick={() => setState((st) => ({ ...st, schedules: st.schedules.map((y) => (y.id === x.id ? { ...y, enabled: !y.enabled } : y)) }))}
                className={`rounded-full px-3 py-1 text-[12px] ${x.enabled ? "bg-success-soft text-success" : "bg-inset text-muted"}`}
              >
                {x.enabled ? "Running" : "Paused"}
              </button>
              <button onClick={() => setState((st) => ({ ...st, schedules: st.schedules.filter((y) => y.id !== x.id) }))} className="text-[12px] text-danger">
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
