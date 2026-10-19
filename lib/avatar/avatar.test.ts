import assert from "node:assert/strict";
import { LOOK_PRESETS, lookFor } from "../seed";
import { defaultAppearance, fromLegacyLook, topicAppearanceKey, toLegacyLook } from "./defaults";
import { MAX_AVATAR_RECORDS, MAX_IMPORT_BYTES } from "./catalog";
import { parseAvatarPreferences, validateAppearance, validateAvatarPreferences } from "./validate";
import { createTopicLookResolver, initializeAvatarPreferences, readAvatarPreferences, resetAppearance, resolveTopicLook, saveAppearance } from "./storage";
import type { AvatarAppearanceV2, AvatarPreferences } from "./types";

const binding = { groupId: "-1004374108988", topicId: "23" };
const other = { ...binding, groupId: "-1004374108989" };
const key = topicAppearanceKey(binding.groupId, binding.topicId);
const migrated = () => initializeAvatarPreferences(undefined, [binding, other], true) as AvatarPreferences;
const good = (value: unknown): AvatarAppearanceV2 => {
  const result = validateAppearance(value);
  assert.equal(result.ok, true);
  return result.value;
};

assert.equal(key, "telegram:-1004374108988:23");
assert.notEqual(key, topicAppearanceKey(other.groupId, other.topicId));
assert.equal(topicAppearanceKey("-001", "0023"), "telegram:-001:0023", "preserve identifier strings exactly");
assert.throws(() => topicAppearanceKey("bad:group", "23"));
assert.throws(() => topicAppearanceKey("1", "23/../file"));
assert.deepEqual(defaultAppearance(binding.groupId, binding.topicId), defaultAppearance(binding.groupId, binding.topicId));
assert.notEqual(defaultAppearance(binding.groupId, binding.topicId).seed, defaultAppearance(other.groupId, other.topicId).seed);

for (const look of LOOK_PRESETS) {
  assert.deepEqual(toLegacyLook(fromLegacyLook(look, key)), look, "all six legacy looks survive migration");
}
const legacy = lookFor("topic:23");
const preferences = migrated();
const projectionSource = migrated();
const resolveProjection = createTopicLookResolver(projectionSource);
projectionSource.topicAppearances[key].appearance.outfit.topColor = "#000000";
assert.deepEqual(resolveProjection(binding.groupId, binding.topicId), legacy, "a prepared projection owns a validated snapshot and does not read mutable drafts");
const privateBinding = { ...binding, pendingMessages: [{ content: "private message" }], token: "private token" };
assert.equal(JSON.stringify(initializeAvatarPreferences(undefined, [privateBinding], true)).includes("private"), false, "migration projects identity fields only");
assert.deepEqual(resolveTopicLook(preferences, binding.groupId, binding.topicId), legacy);
assert.deepEqual(initializeAvatarPreferences(preferences, [binding, other], true), preferences, "migration is idempotent");
preferences.topicAppearances[key].appearance.outfit.topColor = "#112233";
assert.equal(lookFor("topic:23").shirt, legacy.shirt, "do not mutate shared legacy presets");
assert.equal(preferences.topicAppearances[topicAppearanceKey(other.groupId, other.topicId)].appearance.outfit.topColor, legacy.shirt, "no nested reference sharing between topics");

const appearance = good(defaultAppearance(binding.groupId, binding.topicId));
for (const invalid of [
  { ...appearance, face: { ...appearance.face, skinColor: "url(secret)" } },
  { ...appearance, hair: { ...appearance.hair, style: "remote-model" } },
  { ...appearance, body: { proportions: "giant" } },
  { ...appearance, seed: "x".repeat(129) },
  { ...appearance, seed: "" },
  { ...appearance, backend: "hermes", prompt: "do something" },
  { ...appearance, face: { ...appearance.face, secret: "cookie" } },
  { ...appearance, accessories: { ...appearance.accessories, watch: "yes" } },
  { schemaVersion: 2 }, null, [],
]) assert.equal(validateAppearance(invalid).ok, false);
const invalidColor = validateAppearance({ ...appearance, face: { ...appearance.face, skinColor: "red" } });
assert.deepEqual(invalidColor, { ok: false, error: "Invalid color" });
assert.equal(validateAppearance({ ...appearance, face: { ...appearance.face, skinColor: "#abc" } }).ok, true);
const validated = good(appearance);
validated.hair.color = "#abcdef";
assert.notEqual(appearance.hair.color, validated.hair.color, "validation returns an independent draft");
assert.equal(validateAvatarPreferences(migrated()).ok, true);
assert.equal(validateAvatarPreferences({ ...migrated(), topicAppearances: { [key]: { ...binding, topicId: "24", appearance } } }).ok, false, "key must match record identity");
assert.equal(validateAvatarPreferences({ ...migrated(), quality: "ultra" }).ok, false);
assert.equal(validateAvatarPreferences({ ...migrated(), token: "secret" }).ok, false);
const tooMany = Object.fromEntries(Array.from({ length: MAX_AVATAR_RECORDS + 1 }, (_, i) => [topicAppearanceKey("1", String(i)), { groupId: "1", topicId: String(i), appearance }]));
assert.equal(validateAvatarPreferences({ ...migrated(), topicAppearances: tooMany }).ok, false);
const maximumRecords = Object.fromEntries(Object.entries(tooMany).slice(0, MAX_AVATAR_RECORDS));
assert.equal(parseAvatarPreferences(JSON.stringify({ ...migrated(), topicAppearances: maximumRecords })).ok, true, "valid maximum-size preferences can round-trip through the JSON boundary");
const crowdedTopics = Array.from({ length: MAX_AVATAR_RECORDS + 1 }, (_, i) => ({ groupId: "1", topicId: String(i) }));
assert.equal(initializeAvatarPreferences(undefined, crowdedTopics, true), undefined, "over-limit migration keeps the legacy fallback for every topic instead of migrating only some");
assert.equal(saveAppearance(undefined, binding, appearance).ok, false, "editing before successful initialization must not rehash other legacy topics");
assert.equal(resetAppearance(undefined, binding).ok, false);
assert.equal(parseAvatarPreferences(" ".repeat(MAX_IMPORT_BYTES + 1)).ok, false);
assert.equal(parseAvatarPreferences("not json").ok, false);
assert.equal(parseAvatarPreferences(JSON.stringify(migrated())).ok, true);

const custom = good(appearance);
custom.outfit.topColor = "#224466";
const saved = saveAppearance(migrated(), binding, custom);
const privateSave = saveAppearance(migrated(), privateBinding, custom);
assert.equal(JSON.stringify(privateSave).includes("private"), false, "save cannot copy unrelated topic data");
assert.equal(saved.ok, true);
assert.equal(resolveTopicLook(saved.value, binding.groupId, binding.topicId).shirt, "#224466");
custom.outfit.topColor = "#ffffff";
assert.equal(resolveTopicLook(saved.value, binding.groupId, binding.topicId).shirt, "#224466", "save owns its data, not the draft reference");
const before = JSON.stringify(saved.value);
assert.equal(saveAppearance(saved.value, binding, { ...custom, outfit: { ...custom.outfit, topColor: "invalid" } }).ok, false);
assert.equal(JSON.stringify(saved.value), before, "invalid save retains last valid value");
const downgraded = { ...saved.value, renderer: "v1" as const };
assert.deepEqual(resolveTopicLook(downgraded, binding.groupId, binding.topicId), legacy, "V1 display adapter uses legacy look");
assert.equal(downgraded.topicAppearances[key].appearance.outfit.topColor, "#224466", "downgrade retains V2 data");
assert.equal(resolveTopicLook({ ...downgraded, renderer: "v2" }, binding.groupId, binding.topicId).shirt, "#224466");
const reset = resetAppearance(saved.value, binding);
assert.equal(reset.ok, true);
assert.equal(Object.hasOwn(reset.value.topicAppearances, key), false);
assert.deepEqual(reset.value.topicAppearances[topicAppearanceKey(other.groupId, other.topicId)], saved.value.topicAppearances[topicAppearanceKey(other.groupId, other.topicId)]);
assert.deepEqual(initializeAvatarPreferences(reset.value, [binding], false), reset.value, "reset remains removed on future snapshots");
assert.deepEqual(resolveTopicLook(reset.value, binding.groupId, binding.topicId), toLegacyLook(defaultAppearance(binding.groupId, binding.topicId)));

for (const unknown of [{ schemaVersion: 77, futureData: { preserve: "yes" } }, { schemaVersion: 2, quality: "broken" }]) {
  const original = JSON.stringify(unknown);
  assert.equal(initializeAvatarPreferences(unknown, [binding], true), unknown, "preserve unsupported raw schema");
  assert.equal(readAvatarPreferences(unknown).issue !== undefined, true);
  assert.deepEqual(resolveTopicLook(unknown, binding.groupId, binding.topicId), legacy, "safe unsupported fallback");
  assert.equal(saveAppearance(unknown, binding, appearance).ok, false);
  assert.equal(resetAppearance(unknown, binding).ok, false);
  assert.equal(JSON.stringify(unknown), original);
}
console.log("PASS avatar domain: stable keys/defaults, six-look migration, clone isolation, strict validation/limits, Save/Reset, downgrade and unsupported-schema preservation");
