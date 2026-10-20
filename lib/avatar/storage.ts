import { lookFor } from "../seed";
import type { AgentLook } from "../types";
import { MAX_AVATAR_RECORDS } from "./catalog";
import { defaultAppearance, defaultAvatarPreferences, fromLegacyLook, topicAppearanceKey, toLegacyLook } from "./defaults";
import { isPlainRecord, validTopicIdentity, validateAppearance, validateAvatarPreferences } from "./validate";
import type { AvatarAppearanceV2, AvatarPreferences, TopicIdentity, ValidationResult } from "./types";

export function readAvatarPreferences(raw: unknown): { preferences: AvatarPreferences; issue?: "invalid" | "future-version" } {
  if (raw === undefined) return { preferences: defaultAvatarPreferences() };
  const parsed = validateAvatarPreferences(raw);
  if (parsed.ok) return { preferences: parsed.value };
  return { preferences: defaultAvatarPreferences(), issue: isPlainRecord(raw) && raw.schemaVersion !== 2 ? "future-version" : "invalid" };
}

/** Capture existing looks once. Missing records afterwards mean deterministic defaults,
 * including Reset; snapshots must never recreate a removed override. */
export function initializeAvatarPreferences(raw: unknown, topics: TopicIdentity[], legacy: boolean): unknown {
  if (raw !== undefined) return raw; // Keep even malformed/future data recoverable.
  const preferences = defaultAvatarPreferences();
  for (const topic of topics) {
    if (!validTopicIdentity(topic.groupId, topic.topicId)) continue;
    const key = topicAppearanceKey(topic.groupId, topic.topicId);
    // An incomplete migration would rehash the remaining legacy topics. Keep
    // the whole legacy fallback instead of silently migrating only some.
    if (!Object.hasOwn(preferences.topicAppearances, key) && Object.keys(preferences.topicAppearances).length >= MAX_AVATAR_RECORDS) return undefined;
    preferences.topicAppearances[key] = { groupId: topic.groupId, topicId: topic.topicId, appearance: legacy ? fromLegacyLook(lookFor(`topic:${topic.topicId}`), key) : defaultAppearance(topic.groupId, topic.topicId) };
  }
  return preferences;
}

/** Validate/clone once per scene projection, rather than once per actor. */
export function createTopicLookResolver(raw: unknown): (groupId: string, topicId: string) => AgentLook {
  const { preferences, issue } = readAvatarPreferences(raw);
  return (groupId, topicId) => {
    if (!validTopicIdentity(groupId, topicId) || raw === undefined || issue || preferences.renderer === "v1") return { ...lookFor(`topic:${topicId}`) };
    const appearance = preferences.topicAppearances[topicAppearanceKey(groupId, topicId)]?.appearance ?? defaultAppearance(groupId, topicId);
    return toLegacyLook(appearance);
  };
}

export function createTopicPresentationResolver(raw:unknown) {
  const {preferences,issue}=readAvatarPreferences(raw);
  return (groupId:string,topicId:string):{look:AgentLook;appearance?:AvatarAppearanceV2;renderer:"v1"|"v2"} => {
    if(!validTopicIdentity(groupId,topicId)||raw===undefined||issue||preferences.renderer==="v1")
      return {look:{...lookFor(`topic:${topicId}`)},renderer:"v1"};
    const appearance=structuredClone(preferences.topicAppearances[topicAppearanceKey(groupId,topicId)]?.appearance??defaultAppearance(groupId,topicId));
    return {look:toLegacyLook(appearance),appearance,renderer:"v2"};
  };
}

export function resolveTopicLook(raw: unknown, groupId: string, topicId: string): AgentLook {
  return createTopicLookResolver(raw)(groupId, topicId);
}

function editable(raw: unknown): ValidationResult<AvatarPreferences> {
  if (raw === undefined) return { ok: false, error: "Appearance settings must be initialized before editing." };
  const parsed = validateAvatarPreferences(raw);
  return parsed.ok ? parsed : { ok: false, error: "Stored appearance settings cannot be edited by this version. Keep the original data for recovery." };
}

/** Caller must select an existing authorized topic; this pure helper grants no access. */
export function saveAppearance(raw: unknown, topic: TopicIdentity, candidate: unknown): ValidationResult<AvatarPreferences> {
  if (!validTopicIdentity(topic.groupId, topic.topicId)) return { ok: false, error: "Invalid topic appearance identity" };
  const parsed = editable(raw);
  if (!parsed.ok) return parsed;
  const appearance = validateAppearance(candidate);
  if (!appearance.ok) return appearance;
  const key = topicAppearanceKey(topic.groupId, topic.topicId);
  if (!Object.hasOwn(parsed.value.topicAppearances, key) && Object.keys(parsed.value.topicAppearances).length >= MAX_AVATAR_RECORDS) return { ok: false, error: "Too many appearance records" };
  parsed.value.topicAppearances[key] = { groupId: topic.groupId, topicId: topic.topicId, appearance: appearance.value };
  return parsed;
}

export function resetAppearance(raw: unknown, topic: TopicIdentity): ValidationResult<AvatarPreferences> {
  if (!validTopicIdentity(topic.groupId, topic.topicId)) return { ok: false, error: "Invalid topic appearance identity" };
  const parsed = editable(raw);
  if (!parsed.ok) return parsed;
  delete parsed.value.topicAppearances[topicAppearanceKey(topic.groupId, topic.topicId)];
  return parsed;
}
