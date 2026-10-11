"use client";

import { useState } from "react";
import { actions } from "@/lib/store";
import type { OfficeState, Room } from "@/lib/types";
import { ChevronLeft, ChevronRight, Dots, Plus } from "./icons";

const card =
  "rounded-[14px] border border-white/70 bg-white/75 shadow-[0_1px_2px_rgba(20,22,30,0.04),0_8px_24px_rgba(20,22,30,0.04)] backdrop-blur";

function RoomMenu({ room, onEdit }: { room: Room; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((v) => !v)} className="rounded-md p-1 text-[#4a4d57] hover:bg-black/5" aria-label="Room menu">
        <Dots />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-40 overflow-hidden rounded-xl border border-[#eceef2] bg-white py-1 text-[13px] shadow-xl" onMouseLeave={() => setOpen(false)}>
          {[
            ["Rename / edit team", onEdit],
            ["Clear conversation", () => actions.clearRoom(room.id)],
            ["Delete room", () => confirm(`Delete "${room.name}"?`) && actions.removeRoom(room.id)],
          ].map(([label, fn]) => (
            <button
              key={label as string}
              onClick={() => {
                setOpen(false);
                (fn as () => void)();
              }}
              className="block w-full px-3 py-2 text-left hover:bg-[#f4f5f8]"
            >
              {label as string}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RoomPanel({ s, onNewRoom, onEditRoom }: { s: OfficeState; onNewRoom: () => void; onEditRoom: (id: string) => void }) {
  const working = s.rooms.reduce((n, r) => n + r.agents.filter((a) => a.status === "working").length, 0);
  const activeTeams = s.rooms.filter((r) => r.messages.length > 0).length;
  const runningSchedules = s.schedules.filter((x) => x.enabled).length;
  const activeIdx = s.rooms.findIndex((r) => r.id === s.activeRoomId) + 1;

  if (s.roomsCollapsed) {
    return (
      <div className="flex w-14 flex-col items-center pt-10">
        <button onClick={() => actions.set("roomsCollapsed", false)} className="grid h-12 w-12 place-items-center rounded-full bg-white/70 shadow-sm hover:bg-white" aria-label="Expand rooms">
          <ChevronRight />
        </button>
        <div className="mt-6 flex flex-col gap-3">
          {s.rooms.map((r) => (
            <button key={r.id} title={r.name} onClick={() => actions.selectRoom(r.id)} className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${r.id === s.activeRoomId && s.view === "room" ? "bg-white shadow ring-1 ring-[#4f7cf5]/40" : "bg-white/60"}`}>
              {r.emoji}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <aside className="flex w-[272px] shrink-0 flex-col pt-10 min-[1800px]:w-[320px]">
      <div className="flex items-center gap-4">
        <button onClick={() => actions.set("roomsCollapsed", true)} className="grid h-12 w-12 place-items-center rounded-full bg-white/70 shadow-sm hover:bg-white" aria-label="Collapse rooms">
          <ChevronLeft />
        </button>
        <h2 className="text-[24px] font-light tracking-tight text-[#20222a]">Chat Rooms</h2>
      </div>

      <div className="mt-8 flex flex-col gap-5">
        <button onClick={() => actions.set("view", "lounge")} className={`${card} flex items-center gap-4 px-5 py-5 text-left transition hover:bg-white ${s.view === "lounge" ? "ring-1 ring-[#4f7cf5]/50" : ""}`}>
          <span className="text-[34px] leading-none">☕</span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold text-[#1d1f26]">Lounge</span>
            <span className="block truncate text-[11.5px] text-[#7a7e89]">
              {activeTeams} active {activeTeams === 1 ? "team" : "teams"} · {working} at work
            </span>
          </span>
        </button>
        <button onClick={() => actions.set("view", "schedule")} className={`${card} flex items-center gap-4 px-5 py-5 text-left transition hover:bg-white ${s.view === "schedule" ? "ring-1 ring-[#4f7cf5]/50" : ""}`}>
          <span className="text-[34px] leading-none">⏰</span>
          <span>
            <span className="block text-[14.5px] font-semibold text-[#1d1f26]">Schedule room</span>
            <span className="block text-[11.5px] text-[#7a7e89]">
              {runningSchedules} running · {s.schedules.length} total
            </span>
          </span>
        </button>
      </div>

      <div className="mt-9 flex items-center justify-between text-[12px] font-medium tracking-wider text-[#5d6170]">
        <span>ROOM LIST</span>
        <span className="font-normal text-[#9a9ea8]">
          {activeIdx} / {s.rooms.length}
        </span>
      </div>

      <button onClick={onNewRoom} className="mt-4 flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#9fb4ee] bg-white/40 py-2.5 text-[14.5px] text-[#2a2d36] transition hover:bg-white/80">
        <Plus /> New chat room
      </button>

      <div className="mt-5 flex flex-col gap-3 overflow-y-auto pb-6 pr-1">
        {s.rooms.map((r) => {
          const active = r.id === s.activeRoomId && s.view === "room";
          const alert = r.unread || r.approvals.some((a) => a.status === "pending");
          return (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => actions.selectRoom(r.id)}
              onKeyDown={(e) => e.key === "Enter" && actions.selectRoom(r.id)}
              className={`${card} relative flex cursor-pointer items-center gap-4 px-5 py-5 transition hover:bg-white ${active ? "!border-[#a9bdf6] bg-white ring-1 ring-[#4f7cf5]/30" : ""}`}
            >
              {alert && !active && <span className="absolute left-2 top-2 h-3 w-3 rounded-full bg-[#ea2b2b]" />}
              <span className="text-[30px] leading-none">{r.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-[#1d1f26]">{r.name}</span>
                <span className="block text-[11.5px] text-[#7a7e89]">
                  {r.agents.length} agents · {r.outputs.length} outputs
                </span>
              </span>
              <RoomMenu room={r} onEdit={() => onEditRoom(r.id)} />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
