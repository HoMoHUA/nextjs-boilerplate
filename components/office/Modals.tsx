"use client";

import { useEffect, useState } from "react";
import { actions, resetOffice } from "@/lib/store";
import { LOOK_PRESETS, uid } from "@/lib/seed";
import type { Agent, HairStyle, OfficeState, Room, SceneTheme } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";
import { X } from "./icons";
import { THEME_FLOOR } from "./OfficeScene";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#16171d]/25 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-[22px] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#1d1f26]">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-[#f4f5f8]" aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const input = "w-full rounded-lg border border-[#e3e5ea] px-3 py-2 text-[13.5px] outline-none focus:border-[#4f7cf5]";
const HAIR: HairStyle[] = ["short", "curly", "fluffy", "bun", "bob", "buzz"];
const EMOJIS = ["📣", "🚀", "🧪", "✨", "🚧", "💼", "📊", "🎨", "🛠️", "📚", "🧠", "🌱"];

function newAgent(i: number, lead = false): Agent {
  return {
    id: uid("ag"),
    name: lead ? "Lead" : `Agent ${i}`,
    title: lead ? "Team Lead" : "Specialist",
    persona: "",
    isLead: lead,
    status: "idle",
    look: LOOK_PRESETS[i % LOOK_PRESETS.length],
  };
}

/** Create a room or edit an existing room's name and agents. */
export function TeamEditor({ room, onClose }: { room?: Room; onClose: () => void }) {
  const [name, setName] = useState(room?.name ?? "New team");
  const [emoji, setEmoji] = useState(room?.emoji ?? "💼");
  const [agents, setAgents] = useState<Agent[]>(room?.agents ?? [newAgent(0, true), newAgent(1), newAgent(2)]);

  const patch = (id: string, p: Partial<Agent>) => setAgents((xs) => xs.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const save = () => {
    const clean = agents.filter((a) => a.name.trim());
    if (!clean.length) return;
    if (!clean.some((a) => a.isLead)) clean[0] = { ...clean[0], isLead: true };
    if (room) {
      actions.renameRoom(room.id, name, emoji);
      actions.setAgents(room.id, clean);
    } else actions.addRoom(name, emoji, clean);
    onClose();
  };

  return (
    <Modal title={room ? "Manage team" : "New chat room"} onClose={onClose}>
      <div className="flex gap-3">
        <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className={`${input} w-20 text-xl`}>
          {EMOJIS.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Room name" />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {agents.map((a, i) => (
          <div key={a.id} className="rounded-2xl border border-[#eceef2] p-4">
            <div className="flex items-start gap-3">
              <AgentAvatar look={a.look} size={48} />
              <div className="grid flex-1 grid-cols-2 gap-2">
                <input value={a.name} onChange={(e) => patch(a.id, { name: e.target.value })} className={input} placeholder="Name" />
                <input value={a.title} onChange={(e) => patch(a.id, { title: e.target.value })} className={input} placeholder="Role" />
                <textarea
                  value={a.persona}
                  onChange={(e) => patch(a.id, { persona: e.target.value })}
                  className={`${input} col-span-2 h-16 resize-none`}
                  placeholder="Instructions for this agent (sent to hermes-agent as part of the system prompt)"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[#6c707b]">
              <label className="flex items-center gap-1">
                <input type="radio" checked={a.isLead} onChange={() => setAgents((xs) => xs.map((x) => ({ ...x, isLead: x.id === a.id })))} /> Lead
              </label>
              <select value={a.look.hairStyle} onChange={(e) => patch(a.id, { look: { ...a.look, hairStyle: e.target.value as HairStyle } })} className="rounded border border-[#e3e5ea] px-1 py-0.5">
                {HAIR.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
              {(["hair", "skin", "shirt", "pants"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1">
                  {k}
                  <input type="color" value={a.look[k]} onChange={(e) => patch(a.id, { look: { ...a.look, [k]: e.target.value } })} className="h-5 w-6 cursor-pointer" />
                </label>
              ))}
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={a.look.glasses} onChange={(e) => patch(a.id, { look: { ...a.look, glasses: e.target.checked } })} /> glasses
              </label>
              <button onClick={() => setAgents((xs) => xs.filter((x) => x.id !== a.id))} className="ml-auto text-[#e04848]" disabled={agents.length < 2}>
                Remove
              </button>
            </div>
            {i === 5 && <p className="mt-2 text-[11px] text-[#b07a10]">The office has 6 spots — more agents will share seats.</p>}
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-between">
        <button onClick={() => setAgents((xs) => [...xs, newAgent(xs.length)])} className="rounded-full border border-dashed border-[#9fb4ee] px-4 py-2 text-[13px]">
          + Add agent
        </button>
        <button onClick={save} className="rounded-full bg-[#16171d] px-5 py-2 text-[13.5px] font-semibold text-white">
          {room ? "Save" : "Create room"}
        </button>
      </div>
    </Modal>
  );
}

type Health = { mode: "demo" | "live"; ok: boolean; model: string | null; error?: string | null };

export function useHermesHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/hermes/health")
        .then((r) => r.json())
        .then((h) => alive && setHealth(h))
        .catch(() => alive && setHealth({ mode: "live", ok: false, model: null, error: "unreachable" }));
    check();
    const t = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return health;
}

export function SettingsModal({ health, onClose }: { health: Health | null; onClose: () => void }) {
  return (
    <Modal title="hermes-agent connection" onClose={onClose}>
      <div className="rounded-xl bg-[#f6f7f9] p-4 text-[13px]">
        <div>
          Mode: <b>{health?.mode ?? "…"}</b> {health?.mode === "live" && (health.ok ? "✅ connected" : `❌ ${health.error ?? "error"}`)}
        </div>
        {health?.model && <div>Model: <b>{health.model}</b></div>}
      </div>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-[#3a3d47]">
        <li>
          In <code>~/.hermes/.env</code> enable the API server: <code>API_SERVER_ENABLED=true</code> and <code>API_SERVER_KEY=your-secret</code>
        </li>
        <li>
          Start it: <code>hermes gateway</code> (listens on <code>http://127.0.0.1:8642</code>)
        </li>
        <li>
          In this project create <code>.env.local</code> with <code>HERMES_API_URL=http://127.0.0.1:8642/v1</code> and <code>HERMES_API_KEY=your-secret</code>, then restart <code>npm run dev</code>.
        </li>
      </ol>
      <p className="mt-3 text-[12px] text-[#8b8f99]">Without HERMES_API_URL the office runs in demo mode with simulated replies.</p>
      <button
        onClick={() => {
          if (confirm("Reset all rooms, messages and outputs?")) {
            resetOffice();
            onClose();
          }
        }}
        className="mt-6 rounded-full border border-[#f2c4c4] px-4 py-2 text-[13px] text-[#e04848]"
      >
        Reset office data
      </button>
    </Modal>
  );
}

export function ThemeModal({ s, onClose }: { s: OfficeState; onClose: () => void }) {
  return (
    <Modal title="Office theme" onClose={onClose}>
      <div className="grid grid-cols-4 gap-3">
        {(Object.keys(THEME_FLOOR) as SceneTheme[]).map((t) => (
          <button key={t} onClick={() => actions.set("theme", t)} className={`rounded-2xl border-2 p-3 text-[13px] capitalize ${s.theme === t ? "border-[#16171d]" : "border-transparent"}`}>
            <div className="mb-2 h-14 rounded-xl" style={{ background: THEME_FLOOR[t] }} />
            {t}
          </button>
        ))}
      </div>
    </Modal>
  );
}
