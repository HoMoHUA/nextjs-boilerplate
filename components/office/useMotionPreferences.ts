"use client";
import { useEffect, useSyncExternalStore } from "react";
export type MotionPreference = "system" | "reduced" | "full";
const query = "(prefers-reduced-motion: reduce)";
function subscribeMotion(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const subscribeVisibility = (listener: () => void) => { document.addEventListener("visibilitychange", listener); return () => document.removeEventListener("visibilitychange", listener); };
export function useMotionPreferences(preference: unknown) {
  const systemReduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia(query).matches, () => false);
  const visible = useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => true);
  const reduced = preference === "reduced" || (preference !== "full" && systemReduced);
  useEffect(() => { document.documentElement.dataset.reducedMotion = String(reduced); }, [reduced]);
  return { reduced, visible };
}
