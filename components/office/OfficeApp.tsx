"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { actions, activeRoom, getState, hydrate, sendMessage, setState, useOffice } from "@/lib/store";
import { ChatBar } from "./ChatBar";
import { ArrowLeft, Calendar, Logo, Office, Palette, Sliders } from "./icons";
import { SettingsModal, TeamEditor, ThemeModal, useHermesHealth } from "./Modals";
import { RightPanel } from "./RightPanel";
import { RoomPanel } from "./RoomPanel";
import { LoungeView, ScheduleView } from "./Views";

const OfficeScene = dynamic(() => import("./OfficeScene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[13px] text-[#9a9ea8]">Building the office…</div>,
});

function useClock(startedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h} : ${pad(m)}` : `${pad(m)} : ${pad(sec % 60)}`;
}

/** Runs due schedules and expires stale approvals once per 15 s. */
function useTicker() {
  useEffect(() => {
    const t = setInterval(() => {
      actions.expireApprovals();
      const now = Date.now();
      for (const x of getState().schedules) {
        if (!x.enabled || x.nextRunAt > now) continue;
        setState((s) => ({
          ...s,
          schedules: s.schedules.map((y) => (y.id === x.id ? { ...y, nextRunAt: now + y.everyMinutes * 60000 } : y)),
        }));
        sendMessage(x.roomId, x.prompt, x.agentId);
      }
    }, 15000);
    return () => clearInterval(t);
  }, []);
}

const railBtn = "grid h-12 w-12 place-items-center rounded-[14px] transition";

export default function OfficeApp() {
  const s = useOffice();
  const room = activeRoom(s);
  const clock = useClock(room.startedAt);
  const health = useHermesHealth();
  const [modal, setModal] = useState<null | "new" | "team" | "settings" | "theme">(null);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);

  useEffect(() => hydrate(), []);
  useTicker();

  const live = health?.mode === "live" && health.ok;
  const title = s.view === "lounge" ? "Lounge" : s.view === "schedule" ? "Schedule room" : room.name;
  const subtitle =
    s.view === "room"
      ? `${room.agents.length} agents · ${room.outputs.length} outputs`
      : s.view === "lounge"
        ? `${s.rooms.length} teams · ${s.rooms.reduce((n, r) => n + r.agents.length, 0)} agents`
        : `${s.schedules.length} schedules`;
  const editRoom = s.rooms.find((r) => r.id === editRoomId);

  return (
    <div className="relative flex h-screen min-h-[720px] w-full overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#eef3ea_0%,#f4f4f2_45%,#f2f3f5_100%)] text-[#1d1f26]">
      {/* soft background blobs */}
      <div className="pointer-events-none absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-[#dfe9d6]/60 blur-3xl" />
      <div className="pointer-events-none absolute right-20 top-1/3 h-[420px] w-[420px] rounded-full bg-[#e6e9f4]/70 blur-3xl" />

      {/* icon rail */}
      <nav className="relative z-10 flex w-[108px] shrink-0 flex-col items-center border-r border-[#e2e3e6] pt-10">
        <Logo />
        <div className="mt-14 flex flex-col gap-5">
          <button onClick={() => actions.set("view", "room")} className={`${railBtn} bg-[#1f4fd6] text-white shadow-[0_8px_20px_rgba(31,79,214,0.35)]`} aria-label="Office">
            <Office />
          </button>
          <button onClick={() => setModal("theme")} className={`${railBtn} bg-white/80 text-[#3a3d47] shadow-sm hover:bg-white`} aria-label="Theme">
            <Palette />
          </button>
          <button onClick={() => setModal("settings")} className={`${railBtn} bg-white/80 text-[#3a3d47] shadow-sm hover:bg-white`} aria-label="Settings">
            <Sliders />
          </button>
        </div>
      </nav>

      <div className="relative z-10 flex min-w-0 flex-1 gap-8 pl-5 pr-10">
        <RoomPanel
          s={s}
          onNewRoom={() => setModal("new")}
          onEditRoom={(id) => {
            setEditRoomId(id);
            setModal("team");
          }}
        />

        {/* center */}
        <main className="relative flex min-w-0 flex-1 flex-col pt-10">
          <header className="flex items-start justify-between px-6">
            <div>
              <h1 className="text-[25px] font-bold tracking-tight">{title}</h1>
              <p className="text-[12.5px] text-[#7a7e89]">{subtitle}</p>
            </div>
            <div className="mt-5 flex items-center gap-4 text-[14px]">
              <span className={`flex items-center gap-1.5 ${live ? "text-[#1f9d63]" : "text-[#c98a12]"}`} title={health?.error ?? ""}>
                <span className={`h-2 w-2 rounded-full ${live ? "bg-[#1fbf6f]" : "bg-[#f0b429]"}`} />
                {live ? "live" : health?.mode === "live" ? "offline" : "demo"}
              </span>
              {s.view === "room" && <span className="tabular-nums text-[#4e525d]">{clock}</span>}
            </div>
          </header>

          <div className="relative min-h-0 flex-1">
            {s.view === "room" && <OfficeScene room={room} selectedId={s.selectedAgentId} theme={s.theme} />}
            {s.view === "lounge" && <div className="h-full pt-6"><LoungeView s={s} /></div>}
            {s.view === "schedule" && <div className="h-full pt-6"><ScheduleView s={s} /></div>}

            {s.view === "room" && (
              <>
                <button onClick={() => actions.set("view", "lounge")} className="absolute bottom-4 left-6 flex items-center gap-2 rounded-full border border-[#d9dbe0] bg-white/80 px-4 py-1.5 text-[14.5px] backdrop-blur hover:bg-white">
                  <ArrowLeft /> Lounge
                </button>
                <div className="absolute bottom-4 right-6 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditRoomId(room.id);
                      setModal("team");
                    }}
                    className="rounded-full border border-[#d9dbe0] bg-white/80 px-4 py-1.5 text-[14.5px] backdrop-blur hover:bg-white"
                  >
                    Manage team
                  </button>
                  <button onClick={() => actions.set("view", "schedule")} className="grid h-9 w-9 place-items-center rounded-full border border-[#d9dbe0] bg-white/80 backdrop-blur hover:bg-white" aria-label="Schedule">
                    <Calendar />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-center pb-6 pt-4">{s.view === "room" && <ChatBar s={s} room={room} />}</div>
        </main>

        <RightPanel s={s} room={room} />
      </div>

      {modal === "new" && <TeamEditor onClose={() => setModal(null)} />}
      {modal === "team" && editRoom && <TeamEditor key={editRoom.id} room={editRoom} onClose={() => setModal(null)} />}
      {modal === "settings" && <SettingsModal health={health} onClose={() => setModal(null)} />}
      {modal === "theme" && <ThemeModal s={s} onClose={() => setModal(null)} />}
    </div>
  );
}
