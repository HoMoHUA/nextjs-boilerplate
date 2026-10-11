"use client";

import { useRef, useState } from "react";
import { actions, leadOf, sendMessage } from "@/lib/store";
import type { OfficeState, Room } from "@/lib/types";
import { Paperclip, Send } from "./icons";

export function ChatBar({ s, room }: { s: OfficeState; room: Room }) {
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = room.agents.find((a) => a.id === s.targetAgentId) ?? leadOf(room);
  const busy = target?.status === "working";

  const submit = () => {
    const body = attachment ? `${text}\n\n--- Attached file: ${attachment.name} ---\n${attachment.content.slice(0, 20000)}` : text;
    if (!body.trim() || !target) return;
    setText("");
    setAttachment(null);
    sendMessage(room.id, body, target.id);
  };

  return (
    <div className="relative flex w-full max-w-[640px] items-center gap-3 rounded-[18px] bg-white/90 px-4 py-3 shadow-[0_10px_30px_rgba(20,22,30,0.07)] backdrop-blur">
      <div className="relative">
        <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-1.5 rounded-full bg-[#16171d] px-3 py-1.5 text-[13px] font-semibold text-white">
          <span className={`h-2 w-2 rounded-full ${busy ? "animate-pulse bg-[#f5b942]" : "bg-[#ff6b6b]"}`} />@{target?.name}
        </button>
        {menu && (
          <div className="absolute bottom-11 left-0 z-30 w-56 overflow-hidden rounded-xl border border-[#eceef2] bg-white py-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
            {room.agents.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  actions.selectAgent(a.id);
                  setMenu(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[#f4f5f8]"
              >
                <span>
                  <b>@{a.name}</b> <span className="text-[#8b8f99]">{a.title}</span>
                </span>
                {a.isLead && <span className="text-[10px] text-[#8b8f99]">LEAD</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {attachment && (
          <div className="mb-1 flex items-center gap-2 text-[11px] text-[#4f7cf5]">
            📎 {attachment.name}
            <button onClick={() => setAttachment(null)} className="text-[#9a9ea8]">✕</button>
          </div>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder="Say anything — the agent replies for real"
          className="w-full bg-transparent text-[14.5px] text-[#1d1f26] outline-none placeholder:text-[#9a9ea8]"
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
      <button onClick={() => fileRef.current?.click()} className="text-[#3a3d47] hover:text-black" aria-label="Attach file">
        <Paperclip />
      </button>
      <button onClick={submit} className="text-[#3a3d47] hover:text-black" aria-label="Send">
        <Send />
      </button>
    </div>
  );
}
