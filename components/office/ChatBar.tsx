"use client";

import { useRef, useState } from "react";
import { actions, leadOf, sendMessage, stopAgent } from "@/lib/store";
import type { OfficeState, Room } from "@/lib/types";
import { Paperclip, Send, Stop } from "./icons";
import { useOnline } from "./WebAppSupport";

export function ChatBar({ s, room, compact = false }: { s: OfficeState; room: Room; compact?: boolean }) {
  const online = useOnline();
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = room.agents.find((a) => a.id === s.targetAgentId) ?? leadOf(room);
  const busy = target?.status === "working";
  const roomBusy = room.agents.some((a) => a.status === "working");
  // a Claude Code room runs one turn at a time; hermes agents can be messaged in parallel
  const locked = !online || (room.telegram ? room.telegram.delivery === "posting" || !target?.backend || target.kind !== "bot" : room.backend === "claude-code" && roomBusy);

  const submit = () => {
    if (locked) return;
    const body = attachment ? `${text}\n\n--- Attached file: ${attachment.name} ---\n${attachment.content.slice(0, 20000)}` : text;
    if (!body.trim() || !target) return;
    setText("");
    setAttachment(null);
    sendMessage(room.id, body, target.id);
  };

  return (
    <div
      className={`relative flex w-full items-center bg-surface/90 shadow-[0_10px_30px_rgba(20,22,30,0.07)] backdrop-blur ${
        compact ? "gap-2 rounded-[16px] px-2.5 py-2" : "max-w-[640px] gap-3 rounded-[18px] px-4 py-3"
      }`}
    >
      <div className="relative">
        <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-1.5 rounded-full bg-action px-3 py-1.5 text-[13px] font-semibold text-white">
          <span className={`h-2 w-2 rounded-full ${busy ? "animate-pulse bg-[#f5b942]" : "bg-[#ff6b6b]"}`} />@{target?.name}
        </button>
        {menu && (
          <div className="absolute bottom-11 left-0 z-30 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
            {room.agents.filter(a=>!room.telegram || (a.kind === "bot" && a.backend)).map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  actions.set("targetAgentId", a.id);
                  actions.set("selectedAgentId", a.id);
                  setMenu(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-inset"
              >
                <span>
                  <b>@{a.name}</b> <span className="text-muted">{a.title}</span>
                </span>
                {a.isLead && <span className="text-[10px] text-muted">LEAD</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {attachment && (
          <div className="mb-1 flex items-center gap-2 text-[11px] text-link">
            📎 {attachment.name}
            <button onClick={() => setAttachment(null)} className="text-muted">✕</button>
          </div>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder={!online ? "Reconnect to send a message…" : room.telegram ? `Message "${room.name}"…` :
            locked
              ? compact
                ? `${leadOf(room)?.name} is working…`
                : `${leadOf(room)?.name} is working — stop it or wait for the reply`
              : compact
                ? "Message the team…"
                : "Say anything — the agent replies for real"
          }
          className="w-full bg-transparent text-[16px] md:text-[14.5px] text-ink outline-none placeholder:text-muted"
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".txt,.md,.csv,.json,.ts,.tsx,.js,.py,.html,.css,.yaml,.yml,.log"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setAttachment({ name: f.name, content: await f.text() });
          e.target.value = "";
        }}
      />
      <button onClick={() => fileRef.current?.click()} className="text-ink hover:text-ink" aria-label="Attach file">
        <Paperclip />
      </button>
      {roomBusy && !room.telegram && (
        <button
          onClick={() => room.agents.filter((a) => a.status === "working").forEach((a) => stopAgent(a.id))}
          className="grid h-7 w-7 place-items-center rounded-full bg-danger-soft text-danger hover:bg-danger-soft"
          aria-label="Stop"
          title="Stop"
        >
          <Stop />
        </button>
      )}
      <button onClick={submit} disabled={locked} className="text-ink hover:text-ink disabled:opacity-30" aria-label="Send">
        <Send />
      </button>
    </div>
  );
}
