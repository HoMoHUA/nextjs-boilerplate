"use client";

import { useEffect, useState } from "react";
import { actions } from "@/lib/store";
import type { Agent, Approval } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";

export function useCountdown(expiresAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, expiresAt - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { left, label: `${m}m ${s}s Left` };
}

export function NeedsYouBadge() {
  return (
    <span className="rounded-[4px] bg-action px-1.5 py-[3px] text-[10px] font-bold tracking-wide text-white">
      NEEDS YOU
    </span>
  );
}

interface Props {
  roomId: string;
  approval: Approval;
  agent?: Agent;
  variant: "bubble" | "panel" | "compact";
}

export function ApprovalCard({ roomId, approval, agent, variant }: Props) {
  const { label } = useCountdown(approval.expiresAt);
  const compact = variant === "compact";
  const bubble = variant === "bubble" || compact;

  return (
    <div className={compact ? "w-[236px]" : bubble ? "w-[370px]" : ""}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NeedsYouBadge />
          {!bubble && agent && (
            <span className="flex items-center gap-1 text-[12px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8d9cf6]" /> {agent.name} is waiting on you
            </span>
          )}
        </div>
        <span className="rounded bg-inset px-1.5 py-0.5 text-[10px] text-muted">{label}</span>
      </div>

      <div className={`mt-3 flex gap-3 ${bubble ? "" : "mt-4"}`}>
        {variant === "bubble" && agent && (
          <div className="flex shrink-0 flex-col items-center">
            <AgentAvatar look={agent.look} size={46} />
            <span className="mt-0.5 flex items-center gap-1 text-[12.5px] font-medium text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8d9cf6]" />
              {agent.name}
            </span>
          </div>
        )}
        <p className={`leading-[1.5] text-ink ${compact ? "line-clamp-3 text-[12.5px]" : "text-[14.5px]"}`}>
          {compact && agent && <b className="font-semibold">{agent.name}: </b>}
          {approval.text}
        </p>
      </div>

      <div className={`flex gap-2 ${compact ? "mt-2.5" : "mt-4"} ${bubble ? "" : "justify-end"}`}>
        <button
          onClick={() => actions.reviewFirst(roomId, approval.id)}
          className={`${bubble ? "flex-1" : "px-4"} rounded-full border border-line bg-surface ${compact ? "py-1.5 text-[12.5px]" : "py-2 text-[14.5px]"} text-ink transition hover:bg-inset`}
        >
          Review first
        </button>
        <button
          onClick={() => actions.approve(roomId, approval.id)}
          className={`${bubble ? "flex-1" : "px-4"} rounded-full border border-line bg-surface ${compact ? "py-1.5 text-[12.5px]" : "py-2 text-[14.5px]"} font-semibold text-link transition hover:bg-accent-soft`}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
