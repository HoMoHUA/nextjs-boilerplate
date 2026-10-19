import { AVATAR_CATALOG as catalog, MAX_AVATAR_RECORDS, MAX_IMPORT_BYTES, MAX_SEED_LENGTH } from "./catalog";
import type { AvatarAppearanceV2, AvatarPreferences, ValidationResult } from "./types";

type Rule = "color" | "seed" | "boolean" | 2 | readonly string[] | { [key: string]: Rule };
const appearanceRule: Rule = {
  schemaVersion: 2, seed: "seed",
  face: { shape: catalog.faceShapes, skinColor: "color", eyes: catalog.eyes, eyebrows: catalog.eyebrows, nose: catalog.noses, mouth: catalog.mouths, beard: catalog.beards },
  hair: { style: catalog.hairStyles, color: "color" },
  body: { proportions: catalog.proportions },
  outfit: { style: catalog.outfits, topColor: "color", accentColor: "color", pantsColor: "color", shoes: catalog.shoes, shoeColor: "color" },
  accessories: { glasses: catalog.glasses, headphones: "boolean", watch: "boolean", deskProp: catalog.deskProps },
};

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function validTopicIdentity(groupId: unknown, topicId: unknown): groupId is string {
  return typeof groupId === "string" && /^-?\d{1,20}$/.test(groupId) && typeof topicId === "string" && /^\d{1,20}$/.test(topicId);
}

function closedKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function check(value: unknown, rule: Rule): string | undefined {
  if (rule === "color") return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? undefined : "Invalid color";
  if (rule === "seed") return typeof value === "string" && value.length > 0 && value.length <= MAX_SEED_LENGTH && !/[\x00-\x1f\x7f]/.test(value) ? undefined : "Invalid appearance seed";
  if (rule === "boolean") return typeof value === "boolean" ? undefined : "Invalid appearance option";
  if (rule === 2) return value === 2 ? undefined : "Unsupported appearance version";
  if (Array.isArray(rule)) return typeof value === "string" && rule.includes(value) ? undefined : "Invalid appearance option";
  const fields = rule as Record<string, Rule>;
  if (!isPlainRecord(value) || !closedKeys(value, Object.keys(fields))) return "Invalid appearance fields";
  for (const [key, field] of Object.entries(fields)) {
    const error = check(value[key], field);
    if (error) return error;
  }
}

export function validateAppearance(value: unknown): ValidationResult<AvatarAppearanceV2> {
  const error = check(value, appearanceRule);
  return error ? { ok: false, error } : { ok: true, value: structuredClone(value) as AvatarAppearanceV2 };
}

export function validateAvatarPreferences(value: unknown): ValidationResult<AvatarPreferences> {
  if (!isPlainRecord(value) || !closedKeys(value, ["schemaVersion", "renderer", "quality", "reducedMotion", "topicAppearances"])) return { ok: false, error: "Invalid appearance preferences" };
  for (const [key, rule] of Object.entries({ schemaVersion: 2, renderer: catalog.renderers, quality: catalog.qualities, reducedMotion: catalog.reducedMotion } satisfies Record<string, Rule>)) {
    const error = check(value[key], rule);
    if (error) return { ok: false, error };
  }
  const records = value.topicAppearances;
  if (!isPlainRecord(records) || Reflect.ownKeys(records).length > MAX_AVATAR_RECORDS) return { ok: false, error: "Too many or invalid appearance records" };
  const parsed: AvatarPreferences["topicAppearances"] = {};
  for (const [key, record] of Object.entries(records)) {
    if (!isPlainRecord(record) || !closedKeys(record, ["groupId", "topicId", "appearance"]) || !validTopicIdentity(record.groupId, record.topicId) || key !== `telegram:${record.groupId}:${record.topicId}`) return { ok: false, error: "Invalid topic appearance identity" };
    const appearance = validateAppearance(record.appearance);
    if (!appearance.ok) return appearance;
    parsed[key] = { groupId: record.groupId, topicId: record.topicId as string, appearance: appearance.value };
  }
  return { ok: true, value: { schemaVersion: 2, renderer: value.renderer as AvatarPreferences["renderer"], quality: value.quality as AvatarPreferences["quality"], reducedMotion: value.reducedMotion as AvatarPreferences["reducedMotion"], topicAppearances: parsed } };
}

/** Import only this closed schema; no office state, connection settings or messages. */
export function parseAvatarPreferences(json: string): ValidationResult<AvatarPreferences> {
  if (json.length > MAX_IMPORT_BYTES || new TextEncoder().encode(json).byteLength > MAX_IMPORT_BYTES) return { ok: false, error: "Appearance file is too large" };
  try { return validateAvatarPreferences(JSON.parse(json)); }
  catch { return { ok: false, error: "Invalid appearance JSON" }; }
}
