import type { Agent, IntegrationSnapshot, OfficeState, Room } from "./types";
import { createTopicLookResolver } from "./avatar/storage";

export const TOPICS_PER_PAGE = 12;
export const topicVisible = (s:OfficeState, id:string) => s.visibleTopicIds === undefined || s.visibleTopicIds.includes(id);
export const visibleRooms = (s:OfficeState):Room[] => s.rooms.filter(r=>!r.telegram || topicVisible(s,r.telegram.topicId));
export const visibleTopics = (s:OfficeState):Room[] => visibleRooms(s).filter(r=>!!r.telegram).sort((a,b)=>Number(a.telegram!.topicId)-Number(b.telegram!.topicId));
export const topicAvatarId = (roomId:string) => `topic-avatar:${roomId}`;
export function topicActors(s:OfficeState):Agent[] {
  const resolveLook = createTopicLookResolver(s.avatarPreferences);
  return visibleTopics(s).map(room=>{
    const working=room.telegram!.busy || room.agents.some(a=>a.status=== "working");
    return {id:topicAvatarId(room.id),topicRoomId:room.id,name:room.name,title:"Telegram topic",persona:"",isLead:false,
      status:working?"working":room.agents.some(a=>a.status==="needs_you")?"needs_you":"idle",
      look:resolveLook(room.telegram!.groupId,room.telegram!.topicId),runtime:true,
      activity:working?room.agents.find(a=>a.status==="working")?.activity || "Topic is processing":undefined};
  });
}


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
