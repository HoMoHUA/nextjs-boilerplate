"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { actions, activeRoom, getState, hydrate, sendMessage, setState, startIntegrationPolling, useOffice } from "@/lib/store";
import { ChatBar } from "./ChatBar";
import { ConnectionStatus } from "./ConnectionStatus";
import { ArrowLeft, Calendar, Logo, Office, Palette, Sliders } from "./icons";
import { SettingsModal, TeamEditor, ThemeModal, useBackends } from "./Modals";
import { MobileSheet, RightPanel } from "./RightPanel";
import { RoomPanel } from "./RoomPanel";
import { TopicPicker } from "./TopicPicker";
import { topicActors, topicAvatarId, TOPICS_PER_PAGE } from "@/lib/topics";
import { LoungeView, ScheduleView } from "./Views";
import { useColorMode } from "./useColorMode";
import { WebAppSupport } from "./WebAppSupport";
import { useMotionPreferences } from "./useMotionPreferences";

const OfficeScene = dynamic(() => import("./OfficeScene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[13px] text-muted">Building the office…</div>,
});

function useClock(startedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h} : ${pad(m)}` : `${pad(m)} : ${pad(sec % 60)}`;
}

/** Runs due schedules and expires stale approvals once per 15 s. */
function useTicker() {
  useEffect(() => {
    const t = setInterval(() => {
      if (!navigator.onLine) return;
      actions.expireApprovals();
      if (getState().fx.some((f) => Date.now() - f.ts > 8000))
        setState((s) => ({ ...s, fx: s.fx.filter((f) => Date.now() - f.ts < 8000) }));
      const now = Date.now();
      for (const x of getState().schedules) {
        if (!x.enabled || x.nextRunAt > now) continue;
        const room = getState().rooms.find((r) => r.id === x.roomId);
        // Connected topics use existing server schedules, never browser injection.
        if (!room || room.telegram || room.agents.some((a) => a.status === "working")) continue;
        setState((s) => ({
          ...s,
          schedules: s.schedules.map((y) => (y.id === x.id ? { ...y, nextRunAt: now + y.everyMinutes * 60000 } : y)),
        }));
        sendMessage(x.roomId, x.prompt, x.agentId);
      }
    }, 15000);
    return () => clearInterval(t);
  }, []);
}

const railBtn = "grid h-12 w-12 place-items-center rounded-[14px] transition";

const PHONE = "(max-width: 767px), (max-height: 500px)";
const LANDSCAPE_PHONE = "(max-height: 500px)";
/** Media query as state; false during SSR/hydration, then follows the viewport. */
function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function Menu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

export default function OfficeApp() {
  const s = useOffice();
  const colorMode = useColorMode(s.colorMode);
  useMotionPreferences(s.motionPreference);
  const room = activeRoom(s);
  const clock = useClock(room.startedAt);
  const { health, claudeCode } = useBackends();
  const [modal, setModal] = useState<null | "new" | "team" | "settings" | "theme" | "topics">(null);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);

  const phone = useMedia(PHONE);
  const landscape = useMedia(LANDSCAPE_PHONE);
  const [drawer, setDrawer] = useState(false);
  const [topicPage,setTopicPage]=useState(0);
  const actors=topicActors(s);
  const topicKey=actors.map(a=>a.id).join("|");
  const pageCount=Math.max(1,Math.ceil(actors.length/TOPICS_PER_PAGE));
  const page=Math.min(topicPage,pageCount-1);
  const topicEmpty=!!room.telegram && actors.length===0;
  const sceneRoom=room.telegram ? {...room,id:"telegram-topic-office",agents:actors.slice(page*TOPICS_PER_PAGE,(page+1)*TOPICS_PER_PAGE),approvals:[],steps:[],outputs:[]} : room;
  const sceneSelected=room.telegram ? topicAvatarId(room.id) : s.selectedAgentId;
  const openTopics=()=>{setDrawer(false);setModal("topics");};
  useEffect(()=>{
    const index=actors.findIndex(a=>a.topicRoomId===s.activeRoomId);
    if(index>=0)setTopicPage(Math.floor(index/TOPICS_PER_PAGE));
    // Projection order is keyed by topic identity, not status or recency updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[s.activeRoomId,topicKey]);
  const topicPager=room.telegram && pageCount>1 ? <div dir="ltr" className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-line bg-surface/95 p-2 text-[11px] shadow-sm">
    <button aria-label="Previous topic page" disabled={page===0} onClick={()=>setTopicPage(page-1)} className="h-8 rounded-lg px-2 disabled:opacity-30">←</button>
    <span>Topics · {page+1} / {pageCount}</span>
    <button aria-label="Next topic page" disabled={page===pageCount-1} onClick={()=>setTopicPage(page+1)} className="h-8 rounded-lg px-2 disabled:opacity-30">→</button>
  </div> : null;
  const emptyTopics=topicEmpty ? <div className="absolute inset-0 z-10 grid place-items-center p-6"><div dir="ltr" className="max-w-sm rounded-2xl bg-surface/95 p-5 text-center shadow-sm"><p className="text-[14px]">No topics selected for display.</p><button onClick={openTopics} className="mt-3 min-h-11 rounded-xl bg-accent px-4 text-[13px] text-white">Select topics</button></div></div> : null;

  useEffect(() => {
    hydrate();
    // smaller screens: fold the side panels so the office gets the space
    if (window.innerWidth < 1440) actions.set("roomsCollapsed", true);
    if (window.innerWidth < 1280) actions.set("panelCollapsed", true);
    return startIntegrationPolling();
  }, []);
  useTicker();

  const targetBackend = room.telegram ? room.agents.find(a=>a.id===s.targetAgentId)?.backend ?? room.backend : room.backend;
  const cc = targetBackend === "claude-code";
  const bot = s.integrations?.bots.find((b) => b.backend === targetBackend);
  const badge = room.telegram
    ? { ok: s.integrations?.phase === "synced" && !!bot?.ok,
        label: cc ? "Claude Code · Telegram" : "Hermes · Telegram", hint: (!cc && room.telegram.model) || `Topic ${room.telegram.topicId}` }
    : cc
    ? claudeCode?.enabled
      ? { ok: true, label: "claude code", hint: claudeCode.cwd ?? "" }
      : { ok: false, label: claudeCode ? "disabled" : "…", hint: "CLAUDE_CODE_ENABLED=false" }
    : health?.mode === "live"
      ? { ok: health.ok, label: health.ok ? "live" : "offline", hint: health.error ?? health.model ?? "" }
      : { ok: false, label: "demo", hint: "Set HERMES_API_URL to connect hermes-agent" };
  const working = (room.telegram ? actors : room.agents).filter(a=>a.status === "working").length;
  const title = s.view === "lounge" ? "Lounge" : s.view === "schedule" ? "Schedule room" : topicEmpty || room.telegram?.topicId === "7785" ? "Hojat's Team" : room.name;
  const subtitle =
    s.view === "room"
      ? [
          room.telegram ? `${actors.length} topics` : `${room.agents.length} agents`,
          room.telegram ? "" : `${room.outputs.length} outputs`,
          working ? `${working} working` : "",
          room.costUsd ? `$${room.costUsd.toFixed(2)}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : s.view === "lounge"
        ? `${s.rooms.length} teams · ${s.rooms.reduce((n, r) => n + r.agents.length, 0)} agents`
        : `${s.schedules.length} schedules`;
  const editRoom = s.rooms.find((r) => r.id === editRoomId);
  const scheduleState = { ...s, rooms: s.rooms.filter((r) => !r.telegram),
    schedules: s.schedules.filter((x) => s.rooms.some((r) => r.id === x.roomId && !r.telegram)) };
  const chat = (compact = false) => topicEmpty ? <button onClick={openTopics} className="min-h-11 rounded-xl bg-surface px-4 text-[13px] shadow-sm">Select office topics to get started</button> : (
    <fieldset disabled={room.telegram?.delivery === "posting"} className={`min-w-0 border-0 p-0 ${compact ? "w-full" : "w-full max-w-[640px]"} ${room.telegram ? "[&_button[aria-label=Stop]]:hidden" : ""}`}>
      <ChatBar s={s} room={room} compact={compact} />
    </fieldset>
  );

  const modals = (
    <>
      <WebAppSupport />
      {modal === "topics" && <TopicPicker s={s} onClose={()=>setModal(null)}/>}
      {modal === "new" && <TeamEditor onClose={() => setModal(null)} />}
      {modal === "team" && editRoom && !editRoom.telegram && <TeamEditor key={editRoom.id} room={editRoom} onClose={() => setModal(null)} />}
      {modal === "settings" && <SettingsModal health={health} claudeCode={claudeCode} onClose={() => setModal(null)} />}
      {modal === "theme" && <ThemeModal s={s} onClose={() => setModal(null)} />}
    </>
  );
  const openTeam = () => {
    if (room.telegram) return;
    setEditRoomId(room.id);
    setModal("team");
  };

  if (phone)
    return (
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden office-shell text-ink">
        {/* top bar */}
        <header className={`z-20 flex shrink-0 items-center gap-2 px-3 ${landscape ? "pb-1 pt-1.5" : "pb-2 pt-[max(10px,env(safe-area-inset-top))]"}`}>
          <button onClick={() => setDrawer(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface/80 shadow-sm" aria-label="Rooms">
            <Menu />
          </button>
          <Logo className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {s.view === "room" && <span className="text-[17px]">{room.emoji}</span>}
              <h1 className="truncate text-[17px] font-bold tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              {s.view === "room" && (
                <span className={`flex items-center gap-1 ${badge.ok ? "text-success" : "text-warning"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${badge.ok ? "animate-pulse bg-[#1fbf6f]" : "bg-[#f0b429]"}`} />
                  {badge.label}
                </span>
              )}
              <span className="truncate">{subtitle}</span>
              {s.view === "room" && <span className="ml-auto shrink-0 tabular-nums">{clock}</span>}
            </div>
          </div>
          <button onClick={() => setModal("settings")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface/80 shadow-sm" aria-label="Settings">
            <Sliders />
          </button>
        </header>

        <ConnectionStatus status={s.integrations} room={room} compact />

        {/* office + bottom sheet */}
        <main className="relative min-h-0 flex-1">
          {s.view === "room" && <OfficeScene room={sceneRoom} selectedId={sceneSelected} theme={s.theme} colorMode={colorMode} motionPreference={s.motionPreference} quality={s.qualityPreference} fx={s.fx} compact padBottom={landscape ? 12 : 70} padRight={landscape ? 56 : 0} />}
          {s.view === "lounge" && <div className="h-full overflow-y-auto px-3 pb-20 pt-2"><LoungeView s={s} /></div>}
          {s.view === "schedule" && <div className="h-full overflow-y-auto px-3 pb-20 pt-2"><ScheduleView s={scheduleState} /></div>}
          {s.view === "room" && (
            <div className={`absolute top-2 z-20 flex gap-2 ${landscape ? "left-3 flex-col" : "right-3 flex-col"}`}>
              <button onClick={() => actions.set("view", "lounge")} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface/85 shadow-sm backdrop-blur" aria-label="Lounge">
                <ArrowLeft />
              </button>
              <button onClick={room.telegram ? openTopics : openTeam} title={room.telegram ? "Select topics" : "Manage team"} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface/85 text-[17px] shadow-sm backdrop-blur disabled:opacity-40" aria-label={room.telegram ? "Select topics" : "Manage team"}>
                👥
              </button>
              <button onClick={() => actions.set("view", "schedule")} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface/85 shadow-sm backdrop-blur" aria-label="Schedule">
                <Calendar />
              </button>
              <button onClick={() => setModal("theme")} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface/85 shadow-sm backdrop-blur" aria-label="Theme">
                <Palette />
              </button>
            </div>
          )}
          {s.view === "room" && topicPager}
          {s.view === "room" && emptyTopics}
          {!topicEmpty && <MobileSheet s={s} room={room} side={landscape} />}
        </main>

        {/* chat */}
        <div className={`z-30 shrink-0 bg-inset/95 px-3 backdrop-blur ${landscape ? "pb-1.5 pt-1" : "pb-[max(10px,env(safe-area-inset-bottom))] pt-2"}`}>
          {chat(true)}
        </div>

        {/* rooms drawer */}
        <div className={`fixed inset-0 z-40 transition ${drawer ? "pointer-events-auto" : "pointer-events-none"}`} inert={!drawer}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity ${drawer ? "opacity-100" : "opacity-0"}`} onClick={() => setDrawer(false)} />
          <div
            className={`absolute inset-y-0 left-0 w-[86vw] max-w-[340px] bg-inset shadow-2xl transition-transform duration-300 ${drawer ? "translate-x-0" : "-translate-x-full"}`}
          >
            <RoomPanel s={s} onTopics={openTopics} drawer onClose={() => setDrawer(false)} onNewRoom={() => setModal("new")} onEditRoom={(id) => { setEditRoomId(id); setModal("team"); }} />
          </div>
        </div>
        {modals}
      </div>
    );

  return (
    <div className="relative flex h-screen min-h-[720px] w-full overflow-hidden office-shell text-ink">
      {/* soft background blobs */}
      <div className="pointer-events-none absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-[var(--glow-a)]/60 blur-3xl" />
      <div className="pointer-events-none absolute right-20 top-1/3 h-[420px] w-[420px] rounded-full bg-[var(--glow-b)]/70 blur-3xl" />

      {/* icon rail */}
      <nav className="relative z-10 flex w-[84px] shrink-0 min-[1800px]:w-[108px] flex-col items-center border-r border-line pt-10">
        <Logo />
        <div className="mt-14 flex flex-col gap-5">
          <button onClick={() => actions.set("view", "room")} className={`${railBtn} bg-accent text-white shadow-[0_8px_20px_rgba(31,79,214,0.35)]`} aria-label="Office">
            <Office />
          </button>
          <button onClick={() => setModal("theme")} className={`${railBtn} bg-surface/80 text-ink shadow-sm hover:bg-surface`} aria-label="Theme">
            <Palette />
          </button>
          <button onClick={() => setModal("settings")} className={`${railBtn} bg-surface/80 text-ink shadow-sm hover:bg-surface`} aria-label="Settings">
            <Sliders />
          </button>
        </div>
      </nav>

      <div className="relative z-10 flex min-w-0 flex-1 gap-6 pl-4 pr-6 min-[1800px]:gap-8 min-[1800px]:pl-5 min-[1800px]:pr-10">
        <RoomPanel
          s={s}
          onTopics={openTopics}
          onNewRoom={() => setModal("new")}
          onEditRoom={(id) => {
            setEditRoomId(id);
            setModal("team");
          }}
        />

        {/* center */}
        <main className="relative flex min-w-0 flex-1 flex-col pt-10">
          <header className="flex items-start justify-between px-6">
            <div>
              <h1 className="text-[25px] font-bold tracking-tight">{title}</h1>
              <p className="text-[12.5px] text-muted">{subtitle}</p>
            </div>
            <div className="mt-5 flex items-center gap-4 text-[14px]">
              {s.view === "room" && (
                <span className={`flex items-center gap-1.5 ${badge.ok ? "text-success" : "text-warning"}`} title={badge.hint}>
                  <span className={`h-2 w-2 rounded-full ${badge.ok ? "animate-pulse bg-[#1fbf6f]" : "bg-[#f0b429]"}`} />
                  {badge.label}
                </span>
              )}
              {s.view === "room" && <span className="tabular-nums text-muted">{clock}</span>}
            </div>
          </header>

          <ConnectionStatus status={s.integrations} room={room} />
          <div className="relative min-h-0 flex-1">
            {s.view === "room" && <OfficeScene room={sceneRoom} selectedId={sceneSelected} theme={s.theme} colorMode={colorMode} motionPreference={s.motionPreference} quality={s.qualityPreference} fx={s.fx} />}
            {s.view === "lounge" && <div className="h-full pt-6"><LoungeView s={s} /></div>}
            {s.view === "schedule" && <div className="h-full pt-6"><ScheduleView s={scheduleState} /></div>}

            {s.view === "room" && topicPager}
            {s.view === "room" && emptyTopics}
            {s.view === "room" && (
              <>
                <button onClick={() => actions.set("view", "lounge")} className="absolute bottom-4 left-6 flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-1.5 text-[14.5px] backdrop-blur hover:bg-surface">
                  <ArrowLeft /> Lounge
                </button>
                <div className="absolute bottom-4 right-6 flex items-center gap-2">
                  <button
                    onClick={room.telegram ? openTopics : openTeam}
                    title={room.telegram ? "Select topics" : "Manage team"}
                    className="rounded-full border border-line bg-surface/80 px-4 py-1.5 text-[14.5px] backdrop-blur hover:bg-surface disabled:opacity-40"
                  >
                    {room.telegram ? "Select topics" : "Manage team"}
                  </button>
                  <button onClick={() => actions.set("view", "schedule")} className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface/80 backdrop-blur hover:bg-surface" aria-label="Schedule">
                    <Calendar />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-center pb-6 pt-4">{s.view === "room" && chat()}</div>
        </main>

        {!topicEmpty && <RightPanel s={s} room={room} />}
      </div>

      {modals}
    </div>
  );
}
