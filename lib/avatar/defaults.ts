import { lookFor } from "../seed";
import type { AgentLook, HairStyle } from "../types";
import { validTopicIdentity } from "./validate";
import type { AvatarAppearanceV2, AvatarPreferences } from "./types";

export function topicAppearanceKey(groupId: string, topicId: string): string {
  if (!validTopicIdentity(groupId, topicId)) throw new Error("Invalid topic appearance identity");
  return `telegram:${groupId}:${topicId}`;
}

/** New objects at every level; legacy presets are shared and must stay immutable. */
export function fromLegacyLook(look: AgentLook, seed: string): AvatarAppearanceV2 {
  return {
    schemaVersion: 2, seed,
    face: { shape: "oval", skinColor: look.skin, eyes: "soft", eyebrows: "soft", nose: "rounded", mouth: "neutral", beard: "none" },
    hair: { style: look.hairStyle, color: look.hair },
    body: { proportions: "average" },
    outfit: { style: ["curly", "bun", "fluffy"].includes(look.hairStyle) ? "tshirt" : "shirt", topColor: look.shirt, accentColor: look.accent, pantsColor: look.pants, shoes: "casual", shoeColor: "#443c36" },
    accessories: { glasses: look.glasses ? "round" : "none", headphones: look.hairStyle === "buzz", watch: false, deskProp: "none" },
  };
}

export function defaultAppearance(groupId: string, topicId: string): AvatarAppearanceV2 {
  const seed = topicAppearanceKey(groupId, topicId);
  return fromLegacyLook(lookFor(seed), seed);
}

/** Temporary P1 adapter. Other face/outfit/accessory fields await P2/P3 models. */
export function toLegacyLook(appearance: AvatarAppearanceV2): AgentLook {
  const hair: Record<AvatarAppearanceV2["hair"]["style"], HairStyle> = {
    short: "short", curly: "curly", fluffy: "fluffy", bun: "bun", bob: "bob", buzz: "buzz",
    wavy: "fluffy", "side-part": "short", ponytail: "bun",
  };
  return { skin: appearance.face.skinColor, hair: appearance.hair.color, hairStyle: hair[appearance.hair.style], shirt: appearance.outfit.topColor, accent: appearance.outfit.accentColor, pants: appearance.outfit.pantsColor, glasses: appearance.accessories.glasses !== "none" };
}

export function defaultAvatarPreferences(): AvatarPreferences {
  return { schemaVersion: 2, renderer: "v2", quality: "auto", reducedMotion: "system", topicAppearances: {} };
}
