"use client";

import type { IntegrationStatus, Room } from "@/lib/types";
import { useOnline } from "./WebAppSupport";

/** Connection metadata without changing the office layout or inventing progress. */
export function ConnectionStatus({ status, room, compact = false }: {
  status?: IntegrationStatus; room: Room; compact?: boolean;
}) {
  const online = useOnline();
  const phase = status?.phase ?? "connecting";
  const label = !online ? "Offline · reconnect to send messages" : phase === "synced" ? "Telegram synced" : phase === "error" ? "Telegram sync error" : "Connecting Telegram…";
  const bots = status?.bots.map((bot) =>
    `${bot.backend === "hermes" ? "Hermes" : "Claude Code"} ${bot.username ? `@${bot.username.replace(/^@/, "")}` : "bot"}: ${bot.ok ? "connected" : "offline"}`,
  ).join(" · ") || "Bot connections pending";
  const delivery = room.telegram?.delivery === "posting" ? "Posting to Telegram…"
    : room.telegram?.delivery === "queued" ? "Delivery queued · awaiting a real reply"
    : room.telegram?.delivery === "error" ? `Delivery error: ${room.telegram.error}` : undefined;
  return (
    <div role="status" aria-live="polite" className={`shrink-0 border-y border-line/70 bg-surface/40 py-1.5 text-[11px] text-muted ${compact ? "px-3" : "mx-6 mt-3 rounded-lg border px-3"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className={`inline-flex items-center gap-1.5 ${phase === "error" ? "text-danger" : ""}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${phase === "synced" ? "bg-[#3f7d5a]" : phase === "error" ? "bg-[#b4513e]" : "bg-[#c98a12]"}`} />
          {label}
        </span>
        <span>{status?.group?.name ?? "Group pending"}</span>
        {room.telegram && <span>Topic {room.telegram.topicId}</span>}
      </div>
      <div className="break-words">{bots}</div>
      {status?.error && <div className="break-words text-danger">{status.error} · last synced rooms retained</div>}
      {delivery && <div className={`break-words ${room.telegram?.delivery === "error" ? "text-danger" : ""}`}>{delivery}</div>}
    </div>
  );
}
