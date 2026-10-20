/** Closed data vocabulary; all choices have local model/scene representations. Visual acceptance remains separate. */
export const AVATAR_CATALOG = {
  faceShapes: ["round", "oval", "angular"],
  eyes: ["soft", "wide", "narrow"],
  eyebrows: ["soft", "straight", "arched"],
  noses: ["small", "rounded"],
  mouths: ["neutral", "soft-smile"],
  beards: ["none", "stubble", "short"],
  hairStyles: ["short", "curly", "fluffy", "bun", "bob", "buzz", "wavy", "side-part", "ponytail"],
  proportions: ["compact", "average", "tall"],
  outfits: ["tshirt", "hoodie", "shirt", "light-jacket"],
  shoes: ["sneakers", "casual"],
  glasses: ["none", "round", "square", "oval"],
  deskProps: ["none", "tablet", "notebook", "book"],
  renderers: ["v1", "v2"],
  qualities: ["auto", "low", "medium", "high"],
  reducedMotion: ["system", "on", "off"],
} as const;

export const MAX_AVATAR_RECORDS = 512;
// Enough for all 512 bounded records, including multibyte seeds; still finite.
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_SEED_LENGTH = 128;
/** Fixed project asset; user data never chooses a URL or filename. */
export const CHARACTER_ASSET = "/models/studio/characters.glb";
export const RENDERED_HAIR_STYLES = ["short", "curly", "fluffy", "bun", "bob", "buzz", "wavy", "side-part", "ponytail"] as const;
