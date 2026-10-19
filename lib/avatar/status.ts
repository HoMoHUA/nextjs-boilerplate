import type { IntegrationStatus, Room } from "../types";
export type VisualActivity = "idle" | "processing" | "waiting" | "unknown";
/** A queue, response or worker exit does not establish model execution/success. */
export function topicVisualActivity(room: Room, integration: IntegrationStatus | undefined, now = Date.now()): VisualActivity {
  const age = now - (integration?.observedAt ?? integration?.updatedAt ?? 0);
  if (integration?.phase !== "synced" || !integration.updatedAt || age > 45000 || age < -5000) return "unknown";
  // Runtime worker labels can be inferred from a trace modified up to 30 min
  // ago. Only the broker's active-turn token (busy) establishes live typing.
  if (room.telegram?.busy) return "processing";
  if (room.telegram?.delivery === "posting" || room.telegram?.delivery === "queued" || room.telegram?.awaitingReplies?.length || room.telegram?.awaitingReply) return "waiting";
  return "idle";
}
