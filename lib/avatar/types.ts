import type { AVATAR_CATALOG } from "./catalog";

type Option<K extends keyof typeof AVATAR_CATALOG> = (typeof AVATAR_CATALOG)[K][number];
export type AvatarQuality = Option<"qualities">;
export type AvatarRendererVersion = Option<"renderers">;
export interface AvatarAppearanceV2 {
  schemaVersion: 2;
  seed: string;
  face: {
    shape: Option<"faceShapes">;
    skinColor: string;
    eyes: Option<"eyes">;
    eyebrows: Option<"eyebrows">;
    nose: Option<"noses">;
    mouth: Option<"mouths">;
    beard: Option<"beards">;
  };
  hair: { style: Option<"hairStyles">; color: string };
  body: { proportions: Option<"proportions"> };
  outfit: {
    style: Option<"outfits">;
    topColor: string;
    accentColor: string;
    pantsColor: string;
    shoes: Option<"shoes">;
    shoeColor: string;
  };
  accessories: {
    glasses: Option<"glasses">;
    headphones: boolean;
    watch: boolean;
    deskProp: Option<"deskProps">;
  };
}
export interface TopicIdentity { groupId: string; topicId: string }
export interface TopicAppearanceRecord extends TopicIdentity { appearance: AvatarAppearanceV2 }
export interface AvatarPreferences {
  schemaVersion: 2;
  renderer: AvatarRendererVersion;
  quality: AvatarQuality;
  reducedMotion: Option<"reducedMotion">;
  topicAppearances: Record<string, TopicAppearanceRecord>;
}
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };
