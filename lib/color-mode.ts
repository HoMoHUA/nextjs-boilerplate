import type { SceneTheme } from "./types";
export type ColorMode = "system" | "light" | "dark";
export type ResolvedColorMode = "light" | "dark";
export const normalizeColorMode = (value: unknown): ColorMode => value === "light" || value === "dark" ? value : "system";
export const resolveColorMode = (value: unknown, systemDark: boolean): ResolvedColorMode => normalizeColorMode(value) === "system" ? (systemDark ? "dark" : "light") : value as ResolvedColorMode;

const walls: Record<SceneTheme, string> = { cream: "#f6eddf", mint: "#e1e9dc", lavender: "#eae1e9", sky: "#e3e9e8" };
const nightWalls: Record<SceneTheme, string> = { cream: "#34403c", mint: "#2e403b", lavender: "#3b3846", sky: "#303f4b" };
export function scenePalette(mode: ResolvedColorMode, theme: SceneTheme) {
  const dark = mode === "dark";
  return {
    wall: dark ? nightWalls[theme] : walls[theme], gardenTint: dark ? "#40536a" : "#e4e6d2",
    floorTint: dark ? 0.68 : 1, plinth: dark ? "#38413a" : "#a39175",
    sunIntensity: dark ? 1.65 : 3.4, sunColor: dark ? "#ffd5a0" : "#fff0d6",
    ambientIntensity: dark ? 0.28 : 0.1, fillIntensity: dark ? 0.65 : 0.4,
    skyColor: dark ? "#bdcee5" : "#fff9ec", groundColor: dark ? "#655b51" : "#af9981",
    environmentIntensity: dark ? 0.35 : 0.45,
  };
}
