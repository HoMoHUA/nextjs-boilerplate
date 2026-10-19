"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let installPrompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const subscribeInstall = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const subscribeOnline = (listener: () => void) => {
  window.addEventListener("online", listener); window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
};
export function useOnline() { return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true); }

export function WebAppSupport() {
  useEffect(() => {
    const available = (event: Event) => { event.preventDefault(); installPrompt = event as InstallPrompt; notify(); };
    const installed = () => { installPrompt = null; notify(); };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        // Browser use remains available if installation is restricted by policy.
      });
    }
    return () => { window.removeEventListener("beforeinstallprompt", available); window.removeEventListener("appinstalled", installed); };
  }, []);
  return null;
}

export function WebAppSettings() {
  const prompt = useSyncExternalStore(subscribeInstall, () => installPrompt, () => null);
  const [message, setMessage] = useState("");
  return <section dir="ltr" className="mb-6 border-b border-line pb-5">
    <h3 className="text-[14px] font-semibold">Install Arklyn Office</h3>
    <p className="mt-2 text-[13px] text-muted">Open your office as a standalone app from your home screen.</p>
    {prompt ? <button className="mt-3 min-h-11 rounded-xl bg-action px-4 text-[13px] font-semibold text-white" onClick={async () => {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        setMessage(choice.outcome === "accepted" ? "Installation requested. Follow your browser’s instructions." : "You can install later from the browser menu.");
      } catch { setMessage("Use your browser menu to install this office."); }
      finally { installPrompt = null; notify(); }
    }}>Install app</button> : <p className="mt-2 text-[12px] text-muted">Desktop and Android: browser menu → Install app. iPhone and iPad: Share → Add to Home Screen. Availability depends on your browser.</p>}
    {message && <p role="status" className="mt-2 text-[12px]">{message}</p>}
    <p className="mt-2 text-[12px] text-muted">Messages require a connection. Offline drafts are not queued or sent automatically.</p>
  </section>;
}
