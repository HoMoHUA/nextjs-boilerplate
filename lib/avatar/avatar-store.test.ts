import assert from "node:assert/strict";
import { getState, hydrate, mergeIntegrations, setState } from "../store";
import { lookFor, seedState } from "../seed";
import { topicActors } from "../topics";
import { defaultAppearance, topicAppearanceKey, toLegacyLook } from "./defaults";
import { initializeAvatarPreferences, saveAppearance } from "./storage";
import type { AvatarPreferences } from "./types";
import type { IntegrationSnapshot, OfficeState, Room } from "../types";

const key = "arklyn-office-v3";
const binding = { groupId: "-1004374108988", topicId: "23" };
const seed = seedState();
const room: Room = { ...seed.rooms[0], id: "tg-topic-23", name: "نام واقعی", agents: [
  { ...seed.rooms[0].agents[0], id: "tg-topic-23:hermes", backend: "hermes", kind: "bot" },
  { ...seed.rooms[0].agents[0], id: "tg-topic-23:claude-code", backend: "claude-code", kind: "bot", name: "Claude Code", isLead: false },
], messages: [{ id: "2", role: "user", content: "متن اصلی", ts: 2 }],
telegram: { ...binding, busy: false, pendingMessages: [], historyLoaded: true, before: "2", deletedMessageIds: ["1"] } };
const legacy: OfficeState = { ...seed, rooms: [room, seed.rooms[0]], activeRoomId: room.id, selectedAgentId: room.agents[0].id, targetAgentId: room.agents[1].id };
const memory = new Map<string, string>();
const storage: Storage = {
  get length() { return memory.size; },
  clear: () => memory.clear(), key: index => [...memory.keys()][index] ?? null,
  getItem: name => memory.get(name) ?? null,
  setItem: (name, value) => { memory.set(name, value); }, removeItem: name => { memory.delete(name); },
};
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalFetch = globalThis.fetch;
let requests = 0;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
globalThis.fetch = async () => { requests++; throw new Error("Appearance operations must not use the network"); };
const reload = (state: OfficeState) => {
  storage.setItem(key, JSON.stringify(state));
  setState(() => seedState());
  hydrate();
};
const persist = () => new Promise(resolve => setTimeout(resolve, 500));
const snapshot = (updatedAt: number): IntegrationSnapshot => ({
  group: { id: binding.groupId, name: "Source group" }, bots: [], updatedAt,
  rooms: [{ id: room.id, topicId: "23", name: "Renamed source topic", backend: "hermes", busy: false,
    agents: [{ id: "hermes", name: "Hermes", title: "bot", backend: "hermes", kind: "bot", status: "idle" },
      { id: "claude-code", name: "Claude Code", title: "bot", backend: "claude-code", kind: "bot", status: "idle" }],
    messages: [{ id: "1", role: "user", content: "deleted message must not return", ts: 1 }, { id: "3", role: "agent", agentId: "claude-code", content: "fresh reply", ts: 3 }], steps: [], lastMessageAt: 3 },
    { id: "tg-topic-99", topicId: "99", name: "New source topic", backend: "hermes", busy: false, messages: [], steps: [] }],
});

async function main() {
  try {
    reload(legacy);
    assert.equal((getState().avatarPreferences as AvatarPreferences).schemaVersion, 2, "hydrate adds versioned appearance preferences");
    assert.deepEqual(topicActors(getState())[0].look, lookFor("topic:23"), "migration must not rehash existing appearance");
    assert.equal(getState().targetAgentId, room.agents[1].id);
    assert.deepEqual(getState().rooms[1], JSON.parse(JSON.stringify(legacy.rooms[1])), "local room remains agent-based after JSON round-trip");
    const custom = defaultAppearance(binding.groupId, binding.topicId);
    custom.outfit.topColor = "#123456";
    custom.hair.color = "#654321";
    const saved = saveAppearance(getState().avatarPreferences, binding, custom);
    assert.equal(saved.ok, true);
    setState(s => ({ ...s, avatarPreferences: saved.value }));
    assert.equal(topicActors(getState())[0].look.shirt, "#123456", "projection uses saved appearance");
    const appearanceBefore = JSON.stringify(getState().avatarPreferences);
    mergeIntegrations(snapshot(100));
    const state = getState();
    assert.equal(JSON.stringify(state.avatarPreferences), appearanceBefore, "snapshot never overwrites appearance");
    const actor = topicActors(state).find(a => a.topicRoomId === room.id)!;
    assert.equal(actor.name, "Renamed source topic");
    assert.equal(actor.id, "topic-avatar:tg-topic-23");
    assert.equal(actor.look.shirt, "#123456");
    assert.equal(state.targetAgentId, room.agents[1].id, "scene-only appearance does not replace native send target");
    assert.deepEqual(state.rooms.find(r => r.id === room.id)!.messages.map(m => m.id), ["2", "3"]);
    assert.deepEqual(state.rooms.find(r => r.id === room.id)!.telegram?.deletedMessageIds, ["1"]);
    assert.deepEqual(topicActors(state).find(a => a.topicRoomId === "tg-topic-99")!.look, toLegacyLook(defaultAppearance(binding.groupId, "99")), "new topics use group/topic defaults");
    assert.equal(state.rooms.find(r => r.id === room.id)!.messages[0].content, "متن اصلی");
    await persist();
    reload(JSON.parse(storage.getItem(key)!) as OfficeState);
    assert.equal(topicActors(getState()).find(a => a.topicRoomId === room.id)!.look.shirt, "#123456", "custom appearance survives actual persistence/hydrate path");
    setState(s => ({ ...s, visibleTopicIds: [] }));
    await persist();
    reload(JSON.parse(storage.getItem(key)!) as OfficeState);
    assert.deepEqual(getState().visibleTopicIds, []);
    assert.equal(topicActors(getState()).length, 0);
    assert.equal(getState().rooms.find(r => r.id === room.id)!.messages.length, 2, "none does not delete history");

    const future = { schemaVersion: 99, opaqueFutureData: { preserve: ["original"] } };
    reload({ ...legacy, avatarPreferences: future });
    mergeIntegrations(snapshot(200));
    await persist();
    assert.deepEqual(JSON.parse(storage.getItem(key)!).avatarPreferences, future, "future version survives hydrate/snapshot/persist unchanged");
    assert.deepEqual(topicActors(getState()).find(a => a.topicRoomId === room.id)!.look, lookFor("topic:23"));

    const withoutHydrate = { ...legacy, avatarPreferences: undefined };
    setState(() => withoutHydrate);
    mergeIntegrations(snapshot(300));
    const captured = getState().avatarPreferences as AvatarPreferences;
    assert.deepEqual(captured.topicAppearances[topicAppearanceKey(binding.groupId, binding.topicId)].appearance,
      (initializeAvatarPreferences(undefined, [binding], true) as AvatarPreferences).topicAppearances[topicAppearanceKey(binding.groupId, binding.topicId)].appearance,
      "snapshot migration also protects already-visible legacy topics");
    await persist();
    assert.equal(requests, 0, "appearance lifecycle never sends Telegram/model requests");
    console.log("PASS avatar store: legacy/custom/future reload, snapshot/defaults, actual names/history/tombstones/none/native targets and zero network requests");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
