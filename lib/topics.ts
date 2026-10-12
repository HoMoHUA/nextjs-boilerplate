import type { IntegrationSnapshot } from "./types";

export const topicRoomId = (topicId: string) => `tg-topic-${topicId}`;
type SourceRoom = IntegrationSnapshot["rooms"][number];
/** Compatibility for snapshots from older brokers, never deduplicate local rooms. */
export function canonicalTopics(sources: SourceRoom[]): SourceRoom[] {
  const topics = new Map<string, SourceRoom>();
  for (const source of sources) {
    const id = topicRoomId(source.topicId);
    const previous = topics.get(id);
    topics.set(id, previous ? {
      ...previous, sessionId: previous.sessionId ?? (source.backend === "hermes" ? source.sessionId : undefined),
      ccSessionId: previous.ccSessionId ?? source.ccSessionId ?? (source.backend === "claude-code" ? source.sessionId : undefined),
      messages: [...previous.messages, ...source.messages], steps: [...previous.steps, ...source.steps],
      agents: [...(previous.agents ?? []), ...(source.agents ?? [])], busy: previous.busy || source.busy,
      lastMessageAt: Math.max(previous.lastMessageAt ?? 0, source.lastMessageAt ?? 0),
      deletedMessageIds: [...(previous.deletedMessageIds ?? []), ...(source.deletedMessageIds ?? [])],
    } : { ...source, id, backend: "hermes", ccSessionId: source.ccSessionId ?? (source.backend === "claude-code" ? source.sessionId : undefined),
      sessionId: source.backend === "hermes" ? source.sessionId : undefined });
  }
  return [...topics.values()];
}
