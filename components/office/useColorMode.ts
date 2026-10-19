"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { resolveColorMode } from "@/lib/color-mode";
const query = "(prefers-color-scheme: dark)";
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
export function useColorMode(preference: unknown) {
  const initial = useRef(true);
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
  const mode = resolveColorMode(preference, systemDark);
  useEffect(() => {
    // Preserve the pre-hydration choice until the store has restored saved state.
    const bootstrap = document.documentElement.dataset.colorMode;
    const applied = initial.current && (bootstrap === "light" || bootstrap === "dark") ? bootstrap : mode;
    initial.current = false;
    document.documentElement.dataset.colorMode = applied;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", applied === "dark" ? "#11161b" : "#f3f4f3");
  }, [mode]);
  return mode;
}
