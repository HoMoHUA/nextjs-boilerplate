"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, OrthographicCamera, useProgress } from "@react-three/drei";
import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping, PCFShadowMap, Vector3, type Group } from "three";
import { actions } from "@/lib/store";
import type { Agent, Approval, Fx, Room, SceneTheme } from "@/lib/types";
import { ApprovalCard } from "./ApprovalCard";
import { Character, type Motion } from "./Character";
import { Confetti, StatusRing } from "./Effects";
import { Armchair, Bookshelf, Cabinet, Mug, Plant, RoundTable, Rug, SideCabinet, Whiteboard } from "./Furniture";
import { Anchor, Overlay, Projector } from "./Overlay";
import { CoffeeStation, OfficeChair, Workstation } from "./Workstation";
import { StaticStudio } from "./StaticStudio";
import { StudioEnvironment } from "./StudioEnvironment";
import { StudioPostProcessing } from "./StudioPostProcessing";
import { StudioJoinery } from "./StudioJoinery";
import { StudioBoundary } from "./StudioBoundary";
import { scenePalette, type ResolvedColorMode } from "@/lib/color-mode";
import { adaptQuality, QUALITY_PROFILES, qualityPreference, type QualityLevel } from "@/lib/avatar/quality";
import type { AvatarQuality } from "@/lib/avatar/types";
import { ContextRecovery, QualityMonitor, RendererStats, StudioQualityContext, type StudioStats } from "./StudioQuality";
import { IdleDirector, type IdleGesture } from "@/lib/office/idle";
import { TrafficDirector, type HandoffSample } from "@/lib/office/traffic";
import { MeetingDirector, type MeetingActorSample } from "@/lib/office/meetings";
import { CoffeeDirector, type CoffeeSample } from "@/lib/office/interactions";
import { DESKS, SPOTS, TABLE, meetingSeat, routeBetween, type Spot, type XZ } from "@/lib/office/navigation";
import { dampFactor, motionIdentitySeed } from "@/lib/avatar/motion";
import { useMotionPreferences, type MotionPreference } from "./useMotionPreferences";

export const THEME_FLOOR: Record<SceneTheme, string> = {
  cream: "#f1e8dc",
  mint: "#e1efe6",
  lavender: "#e9e5f4",
  sky: "#e1ebf6",
};

const THEME_RUG: Record<SceneTheme, string> = {
  cream: "#e8dccb",
  mint: "#d3e6da",
  lavender: "#dcd6ec",
  sky: "#d2e0ef",
};

const S = 1.35; // agents and their workstations are modelled in chibi units, scaled up
const HEAD_Y = 1.69 * S;
// Drei recaptures the cube map when its children change. Stable children avoid
// recapturing reflections for statistics, labels or coffee phase UI updates.
const StudioReflections=memo(function StudioReflections({intensity}:{intensity:number}){
  return <Environment resolution={64} frames={1} environmentIntensity={intensity}>
    <Lightformer form="rect" intensity={2} color="#fff5e6" scale={[12,7,1]} position={[2,5,-5]} target={[0,0,0]}/>
    <Lightformer form="rect" intensity={.7} color="#e4edff" scale={[10,8,1]} position={[0,6,8]} target={[0,0,0]}/>
  </Environment>;
});
/**
 * Phones: frame the occupied seats instead of the whole floor, so agents stay
 * big enough to read. Re-fits when the viewport or the team changes.
 */
function FitToAgents({ spots, padTop, padBottom, padRight }: { spots: Spot[]; padTop: number; padBottom: number; padRight: number }) {
  const size = useThree((st) => st.size);
  const get = useThree((st) => st.get);
  const controlState = useThree((st) => st.controls);
  const key = spots.map((sp) => sp.pos.join(",")).join("|");
  useEffect(() => {
    const { camera, controls } = get();
    const ctl = controls as unknown as { target: Vector3; update: () => void } | null;
    if (!spots.length) return;
    const pts: Vector3[] = [];
    for (const sp of spots)
      for (const dx of [-1.3, 1.3])
        for (const dz of [-0.9, 1.4])
          for (const y of [0, 3.3]) pts.push(new Vector3(sp.pos[0] + dx, y, sp.pos[2] + dz));
    const center = pts.reduce((a, p) => a.add(p), new Vector3()).multiplyScalar(1 / pts.length).setY(0.8);
    camera.position.copy(center).add(new Vector3(20, 17, 20));
    camera.lookAt(center);
    camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      const v = p.clone().applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    // shift so the box is centred in the free area between the top buttons and the bottom sheet
    const availH = size.height - padTop - padBottom;
    const availW = size.width - padRight;
    const zoom = Math.min(availW / (maxX - minX + 1.2), availH / (maxY - minY + 1.2));
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const offPx = (padBottom - padTop) / 2 / zoom; // move the view down by the sheet's share
    const offX = padRight / 2 / zoom; // and left by the side panel's share
    const shift = right.multiplyScalar((minX + maxX) / 2 + offX).add(up.multiplyScalar((minY + maxY) / 2 - offPx));
    const target = center.clone().add(shift);
    camera.position.copy(target).add(new Vector3(20, 17, 20));
    camera.lookAt(target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    if (ctl) {
      ctl.target.copy(target);
      ctl.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, get, controlState, key, padTop, padBottom, padRight]);
  return null;
}

function ResponsiveZoom() {
  const size = useThree((st) => st.size);
  const get = useThree((st) => st.get);
  const controlState = useThree((st) => st.controls);
  useEffect(() => {
    const { camera, controls } = get();
    const target = new Vector3(0, 0.8, -0.15);
    camera.position.copy(target).add(new Vector3(20, 17, 20));
    camera.lookAt(target);
    camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [-7.9, 7.9]) for (const z of [-6.5, 6.3]) for (const y of [-0.45, 3.95]) {
      const p = new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    target.add(right.multiplyScalar((minX + maxX) / 2)).add(up.multiplyScalar((minY + maxY) / 2));
    camera.position.copy(target).add(new Vector3(20, 17, 20));
    camera.lookAt(target);
    camera.zoom = Math.min((size.width - 24) / (maxX - minX), (size.height - 60) / (maxY - minY));
    camera.updateProjectionMatrix();
    const ctl = controls as unknown as { target: Vector3; update: () => void } | null;
    if (ctl) { ctl.target.copy(target); ctl.update(); }
  }, [size, get, controlState]);
  return null;
}

function StudioLoader() {
  const { active } = useProgress();
  if (!active) return null;
  return <div role="status" className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-inset/85 text-[13px] text-muted">Opening the studio…</div>;
}

function Label({ name, tag, active, compact, onClick, topicRoomId }: { name: string; tag: string; active: boolean; compact: boolean; onClick: () => void; topicRoomId?:string }) {
  return (
    <button
      onClick={onClick}
      data-topic-room={topicRoomId}
      title={name}
      aria-label={topicRoomId ? name : undefined}
      className={`max-w-[170px] flex items-center gap-1.5 whitespace-nowrap rounded-full border-strong font-semibold shadow-sm transition hover:-translate-y-px ${
        compact ? "border px-1.5 py-px text-[10.5px]" : "border-[1.5px] px-2.5 py-[3px] text-[12.5px]"
      } ${
        active ? "bg-accent-soft text-ink" : "bg-surface text-ink"
      }`}
    >
      <span dir="auto" className="min-w-0 truncate">{name}</span>
      {!topicRoomId && !compact && <span className="text-[11px] font-normal tracking-wide text-ink">{tag}</span>}
    </button>
  );
}

const TOOL_ICON: Record<string, string> = {
  Read: "📖",
  Write: "✍️",
  Edit: "✏️",
  Bash: "⌨️",
  Grep: "🔎",
  Glob: "🗂️",
  WebSearch: "🌐",
  WebFetch: "🌐",
  Agent: "🤝",
  Task: "🤝",
  TodoWrite: "📝",
};

/** What a working agent is doing right now: the current tool, or typing dots. */
function Activity({ activity }: { activity?: string }) {
  if (!activity)
    return (
      <div className="flex gap-1 rounded-full bg-surface px-2.5 py-1.5 shadow-md">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    );
  const tool = activity.split(" · ")[0];
  return (
    <div className="flex max-w-[220px] items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-[11.5px] text-ink shadow-md">
      <span>{TOOL_ICON[tool] ?? "🛠️"}</span>
      <span className="truncate">{activity}</span>
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
    </div>
  );
}

function SpeechBubble({ room, approval, agent, compact, onMinimize }: { room: Room; approval: Approval; agent: Agent; compact: boolean; onMinimize: () => void }) {
  return (
    <div
      className={`relative animate-[pop_.35s_ease-out] border-strong bg-surface shadow-[0_18px_40px_rgba(20,22,30,0.12)] ${
        compact ? "rounded-[20px] border-2 p-3" : "rounded-[28px] border-[3px] p-5"
      }`}
    >
      <button
        onClick={onMinimize}
        title="Later — keep it in Needs you"
        aria-label="Minimize"
        className="absolute -right-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full border-2 border-strong bg-surface text-[13px] font-bold leading-none text-ink hover:bg-inset"
      >
        –
      </button>
      <ApprovalCard roomId={room.id} approval={approval} agent={agent} variant={compact ? "compact" : "bubble"} />
      <svg className="absolute -bottom-[26px] left-[62%]" width="44" height="30" viewBox="0 0 44 30">
        <path d="M2 0 C 14 6, 20 14, 18 28 C 26 18, 34 8, 42 0" fill="#fff" stroke="#16171d" strokeWidth="3" strokeLinejoin="round" />
        <rect x="0" y="0" width="44" height="3" fill="#fff" />
      </svg>
    </div>
  );
}

/** Name tag, live activity, "needs you" marker and approval bubble for one agent. */
function AgentOverlays({
  room,
  agent,
  tag,
  selected,
  bubble,
  compact,
  onMinimize,
}: {
  room: Room;
  agent: Agent;
  tag: string;
  selected: boolean;
  bubble?: Approval;
  compact: boolean;
  onMinimize: (id: string) => void;
}) {
  return (
    <>
      <Overlay id={`${agent.id}:label`} z={10} clamp>
        <Label name={agent.name} topicRoomId={agent.topicRoomId} tag={tag} active={selected} compact={compact} onClick={() => agent.topicRoomId ? actions.selectRoom(agent.topicRoomId) : actions.selectAgent(agent.id)} />
      </Overlay>
      {agent.status === "working" && (
        <Overlay id={`${agent.id}:above`} z={15}>
          <Activity activity={compact ? undefined : agent.activity} />
        </Overlay>
      )}
      {(agent.visualActivity === "waiting" || agent.visualActivity === "unknown") && <Overlay id={`${agent.id}:above`} z={15}>
        <span className="rounded-full bg-surface px-2 py-1 text-[11px] text-muted shadow-sm">{agent.visualActivity === "waiting" ? "Waiting for a reply" : "Status unavailable"}</span>
      </Overlay>}
      {agent.status === "needs_you" && !bubble && (
        <Overlay id={`${agent.id}:above`} z={15}>
          <button
            onClick={() => agent.topicRoomId ? actions.selectRoom(agent.topicRoomId) : actions.selectAgent(agent.id)}
            className="grid h-7 w-7 animate-bounce place-items-center rounded-full bg-[#f5a524] text-[15px] font-black text-white shadow-md"
            title={`${agent.name} needs you`}
          >
            !
          </button>
        </Overlay>
      )}
      {bubble && (
        <Overlay id={`${agent.id}:bubble`} z={30} ax={0.62} ay={1} clamp>
          <SpeechBubble room={room} approval={bubble} agent={agent} compact={compact} onMinimize={() => onMinimize(bubble.id)} />
        </Overlay>
      )}
    </>
  );
}

interface ActorProps {
  agent: Agent;
  spot: Spot;
  reducedMotion: boolean;
  paused:boolean;
  selectedColor: string;
  selected: boolean;
  idleRef:React.RefObject<Map<string,IdleGesture>>;
  handoffRef: React.RefObject<HandoffSample|null>;
  celebrateAt: number;
  lookAt: Vector3 | null;
  coffeeRef: React.RefObject<CoffeeSample | null>;
  meetingRef: React.RefObject<Map<string,MeetingActorSample>>;
}

/** One agent: sits at their seat, and on a hand-off stands up, walks the aisles to a teammate, talks, and comes back. */
function AgentActor({ agent, spot, reducedMotion, paused, selectedColor, selected, handoffRef, celebrateAt, lookAt, coffeeRef, meetingRef, idleRef }: ActorProps) {
  const group = useRef<Group>(null);
  const motion = useRef<Motion>({ walking: false, seated: true, talking: false, look: null, celebrateAt: 0 });

  useEffect(() => {
    motion.current.look = lookAt;
  }, [lookAt]);
  useEffect(() => {
    motion.current.celebrateAt = celebrateAt;
  }, [celebrateAt]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || paused) return;
    const m = motion.current;
    let x = spot.pos[0];
    let z = spot.pos[2];
    let facing = spot.rot;
    let walking = false;
    let seated = true;
    let talking = false;

    const handoff = reducedMotion ? null : handoffRef.current;
    if(handoff?.owner === agent.id){x=handoff.x;z=handoff.z;facing=handoff.heading;walking=handoff.walking;seated=handoff.seated;talking=handoff.talking;}

    const visit = reducedMotion ? null : coffeeRef.current;
    m.idleGesture=idleRef.current.get(agent.id);
    m.noteTarget=undefined;
    m.hand = undefined;
    m.carrying = false;
    if (visit?.owner === agent.id) {
      x = visit.x; z = visit.z; facing = visit.heading;
      seated = visit.seated; walking = visit.walking; talking = false;
      m.hand = visit.hand;
      m.carrying = visit.carrying;
      m.station = !visit.walking && !visit.seated && visit.phase !== "stand" && visit.phase !== "sip";
    } else m.station = false;
    const meeting = reducedMotion ? null : meetingRef.current.get(agent.id);
    if(meeting){x=meeting.x;z=meeting.z;facing=meeting.heading;walking=meeting.walking;seated=meeting.seated;talking=meeting.talking;m.hand=undefined;m.carrying=false;m.station=false;m.idleGesture=undefined;m.noteTarget=meeting.noteTarget;}
    const moved = Math.hypot(x - g.position.x, z - g.position.z);
    m.distance = (m.distance ?? 0) + (walking ? moved / S : 0);
    g.position.set(x, spot.pos[1], z);
    let diff = facing - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * dampFactor(9, dt);
    m.walking = walking;
    m.seated = seated;
    m.talking = talking;
  });

  return (
    <group ref={group} position={spot.pos} rotation={[0, spot.rot, 0]} scale={S}>
      <StatusRing status={agent.status} selected={selected} selectedColor={selectedColor} reducedMotion={reducedMotion} />
      <Character paused={paused} look={agent.look} appearance={agent.appearance} renderer={agent.renderer} status={agent.status} seed={motionIdentitySeed(agent.id)} reducedMotion={reducedMotion} motion={motion} onClick={() => agent.topicRoomId ? actions.selectRoom(agent.topicRoomId) : actions.selectAgent(agent.id)}>
        <Anchor id={`${agent.id}:label`} position={[0, 0.15, 0.25]} />
        <Anchor id={`${agent.id}:above`} position={[0, 2.45, 0]} />
        <Anchor id={`${agent.id}:break`} position={[0, 2.45, 0]} />
        <Anchor id={`${agent.id}:bubble`} position={[0, 2.6, 0]} />
      </Character>
    </group>
  );
}

/** Runs before actors, with a paused decorative clock and a single shared reservation. */
function CoffeeController({agents, coffeeRef, meetingRef, handoffRef, meeting, enabled, fx, routes, idleRef, paused, onPhase, onMeeting}: {
  agents:Agent[];coffeeRef:React.RefObject<CoffeeSample|null>;meetingRef:React.RefObject<Map<string,MeetingActorSample>>;
  handoffRef:React.RefObject<HandoffSample|null>;meeting:Room["planningMeeting"];enabled:boolean;fx:Fx[];
  routes:Map<string,{from:number;to:number;route:XZ[]}>;idleRef:React.RefObject<Map<string,IdleGesture>>;paused:boolean;onPhase:(sample:CoffeeSample|null)=>void;onMeeting:(phase:string|null)=>void;
}) {
  const [director] = useState(() => new CoffeeDirector());
  const [meetings] = useState(() => new MeetingDirector());
  const [traffic] = useState(() => new TrafficDirector());
  const [idle] = useState(() => new IdleDirector());
  const lastPhase=useRef<string|null>(null),lastMeeting=useRef<string|null>(null);
  useFrame((_,dt) => {
    if(paused)return;
    const now=Date.now();
    traffic.enqueue(fx.flatMap(f=>{const route=routes.get(f.id);return f.kind === "handoff" && route ? [{id:f.id,owner:agents[route.from].id,route:route.route,face:[SPOTS[route.to%SPOTS.length].pos[0],SPOTS[route.to%SPOTS.length].pos[2]] as XZ,ts:f.ts}] : [];}),now);
    const meetingActive=!!meeting && meeting.status === "active" && meeting.expiresAt > now;
    handoffRef.current=traffic.step(dt,!director.active&&!meetings.inProgress,enabled);
    const meetingInput=traffic.pending && meeting ? {...meeting,status:"cancelled" as const} : meeting;
    meetingRef.current=meetings.step(dt,meetingInput,agents.map((a,i)=>({id:a.id,spot:SPOTS[i%SPOTS.length],working:a.status === "working" || a.status === "needs_you"})),now,enabled&&!director.active&&!traffic.active);
    coffeeRef.current = director.step(dt, agents.map((agent,i) => ({id:agent.id,spot:SPOTS[i % SPOTS.length],
      idle:process.env.NEXT_PUBLIC_AVATAR_V2_ENABLED !== "false" && agent.renderer !== "v1" && agent.status === "idle" && (!agent.visualActivity || agent.visualActivity === "idle")})), enabled, traffic.pending||meetingActive||meetings.inProgress);
    idleRef.current=idle.step(dt,agents.map(a=>({id:a.id,idle:a.status === "idle" && (!a.visualActivity || a.visualActivity === "idle") && coffeeRef.current?.owner!==a.id && !meetingRef.current.has(a.id) && handoffRef.current?.owner!==a.id})),enabled);
    const meetingPhase=meetings.phase ?? (meetingActive&&meetings.id!==meeting?.id ? "waiting" : null);
    if(lastMeeting.current!==meetingPhase){lastMeeting.current=meetingPhase;onMeeting(meetingPhase);}
    const key=coffeeRef.current?`${coffeeRef.current.owner}:${coffeeRef.current.phase}`:"";
    if(key!==lastPhase.current){lastPhase.current=key;onPhase(coffeeRef.current?{...coffeeRef.current}:null);}
  });
  return null;
}

export default function OfficeScene({
  room,
  selectedId,
  theme,
  colorMode = "light",
  motionPreference = "system",
  quality = "auto",
  fx,
  compact = false,
  padBottom = 70,
  padRight = 0,
}: {
  room: Room;
  selectedId: string | null;
  theme: SceneTheme;
  colorMode?: ResolvedColorMode;
  motionPreference?: MotionPreference;
  quality?: AvatarQuality;
  fx: Fx[];
  compact?: boolean;
  /** Phone only: screen space covered by the bottom sheet / side panel, kept out of the framing. */
  padBottom?: number;
  padRight?: number;
}) {
  const { reduced, visible } = useMotionPreferences(motionPreference);
  const coffeeRef = useRef<CoffeeSample | null>(null);
  const meetingRef = useRef(new Map<string,MeetingActorSample>());
  const handoffRef=useRef<HandoffSample|null>(null);
  const idleRef=useRef(new Map<string,IdleGesture>());
  const [paused,setPaused]=useState(false);
  const [meetingPhase,setMeetingPhase]=useState<string|null>(null);
  const [stats,setStats]=useState<StudioStats|null>(null);
  const [coffeeStatus,setCoffeeStatus]=useState<CoffeeSample|null>(null);
  const [automaticQuality,setAutomaticQuality] = useState<QualityLevel>(compact ? "low" : "medium");
  const lastQualityChange = useRef(0);
  const preference=qualityPreference(quality), level=preference === "auto" ? automaticQuality : preference;
  const profile=QUALITY_PROFILES[level];
  const ordered = useMemo(() => [...room.agents].sort((a, b) => Number(b.isLead) - Number(a.isLead)), [room.agents]);
  const spotOf = (i: number) => SPOTS[i % SPOTS.length];
  const indexOf = (id?: string) => ordered.findIndex((a) => a.id === id);

  // approval bubbles the human folded away (they stay in "Needs you" and as a "!" marker)
  const [minimized, setMinimized] = useState<string[]>([]);
  const pending = room.approvals.filter((a) => a.status === "pending" && !minimized.includes(a.id));
  const bubbleApproval = pending[pending.length - 1];
  const roomFx = fx.filter((f) => f.roomId === room.id);

  // everyone glances at the agent who is working (the first one, if several)
  const workingIdx = ordered.findIndex((a) => a.status === "working");
  const lookAt = useMemo(() => {
    if (workingIdx < 0) return null;
    const p = SPOTS[workingIdx % SPOTS.length].pos;
    return new Vector3(p[0], HEAD_Y, p[2]);
  }, [workingIdx]);

  // routes for current hand-offs, keyed by fx id (stable objects so actors don't restart)
  const routes = useMemo(() => {
    const out = new Map<string, { from: number; to: number; route: XZ[] }>();
    for (const f of fx) {
      if (f.kind !== "handoff" || f.roomId !== room.id) continue;
      const a = ordered.findIndex((x) => x.id === f.from);
      const b = ordered.findIndex((x) => x.id === f.to);
      if (a < 0 || b < 0 || a === b) continue;
      const route = routeBetween(SPOTS[a % SPOTS.length], SPOTS[b % SPOTS.length]);
      if (route) out.set(f.id, { from: a, to: b, route });
    }
    return out;
  }, [fx, ordered, room.id]);

  const tags = new Map<string, string>();
  let n = 0;
  for (const a of ordered) tags.set(a.id, a.isLead ? "LEAD" : `AGENT ${++n}`);

  // which agent (if any) owns each desk
  const deskOwner = DESKS.map((_, i) => ordered[i]);
  const lighting = scenePalette(colorMode, theme);

  return (
    <div data-scene-mode={colorMode} data-scene-quality={level} data-scene-paused={paused} data-meeting-phase={meetingPhase??"idle"} data-render-calls={stats?.calls} data-render-triangles={stats?.triangles} data-render-geometries={stats?.geometries} data-render-textures={stats?.textures} data-coffee-phase={coffeeStatus?.phase??"idle"} data-coffee-owner={coffeeStatus?.owner??""} className="relative h-full w-full overflow-hidden">
      <StudioBoundary agents={ordered} selectedId={selectedId} onSelect={(agent) => agent.topicRoomId ? actions.selectRoom(agent.topicRoomId) : actions.selectAgent(agent.id)}>
      <Canvas frameloop={!visible ? "never" : paused ? "demand" : "always"} shadows={profile.shadowSize > 0} dpr={[1, profile.dpr]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; gl.shadowMap.type = PCFShadowMap; }}
        onPointerMissed={() => (document.body.style.cursor = "")}>
        <StudioQualityContext.Provider value={level}>
        <ContextRecovery />
        <RendererStats onSample={setStats}/>
        <QualityMonitor onSample={(ms,stable) => {
          if(preference !== "auto" || performance.now()-lastQualityChange.current<8000)return;
          const next=adaptQuality(level,ms,stable,compact);
          if(next!==level){lastQualityChange.current=performance.now();setAutomaticQuality(next);}
        }} />
        <Suspense fallback={null}>
        <OrthographicCamera makeDefault position={[20, 17, 20]} near={-50} far={200} zoom={50} />
        {compact || room.telegram ? <FitToAgents spots={[...ordered.map((_, i) => spotOf(i)), {pos:[5.75,0,-4.5],rot:Math.PI,kind:"desk"}]} padTop={16} padBottom={padBottom} padRight={padRight} /> : <ResponsiveZoom />}
        <Projector />
        <CoffeeController key={room.id} agents={ordered} coffeeRef={coffeeRef} meetingRef={meetingRef} handoffRef={handoffRef} idleRef={idleRef} routes={routes} meeting={room.telegram ? undefined : room.planningMeeting} enabled={!reduced && visible}
          fx={roomFx} paused={paused} onPhase={setCoffeeStatus} onMeeting={setMeetingPhase} />
        <OrbitControls
          makeDefault
          zoomToCursor
          target={[0.2, 0.6, -0.2]}
          enablePan={compact}
          screenSpacePanning
          enableDamping
          dampingFactor={0.08}
          minZoom={20}
          maxZoom={140}
          minPolarAngle={0.6}
          maxPolarAngle={1.15}
          minAzimuthAngle={0.2}
          maxAzimuthAngle={1.35}
        />

        <StudioReflections intensity={lighting.environmentIntensity}/>
        <hemisphereLight args={[lighting.skyColor, lighting.groundColor, 0.6]} />
        <ambientLight intensity={lighting.ambientIntensity} />
        <directionalLight
          position={[4, 5.5, -10]}
          intensity={lighting.sunIntensity}
          color={lighting.sunColor}
          castShadow
          shadow-mapSize={[profile.shadowSize || 512, profile.shadowSize || 512]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0002}
          shadow-normalBias={0.025}
          shadow-radius={3}
        />
        <directionalLight position={[8, 6, 10]} intensity={lighting.fillIntensity} color="#c7dcfa" />

        <StaticStudio version={`${colorMode}:${theme}:${ordered.map(a=>`${a.id}:${a.look.shirt}:${a.status}:${a.appearance?.accessories.deskProp}`).join("|")}`}>
        <StudioEnvironment theme={theme} colorMode={colorMode} />
        <StudioJoinery />
        <Rug position={[TABLE[0], 0.012, TABLE[1]]} radius={2.25} color={THEME_RUG[theme]} />

        {/* left wall zone: whiteboard and filing cabinet next to the lead */}
        <Whiteboard position={[-7.0, 0, -1.2]} rotation={Math.PI / 2} />
        <Cabinet position={[-7.0, 0, -4.2]} rotation={Math.PI / 2} />

        {/* personal desks: one per agent, laid out in rows */}
        {DESKS.map((spot, i) => {
          const owner = deskOwner[i];
          return (
            <group key={i} position={spot.pos} rotation={[0, spot.rot, 0]} scale={S}>
              <Workstation seed={i + 1} color={owner?.look.shirt} lead={spot.kind === "lead"} active={owner?.status === "working"} deskProp={owner?.appearance?.accessories.deskProp} />
            </group>
          );
        })}

        {/* meeting corner */}
        <RoundTable position={[TABLE[0], 0, TABLE[1]]} />
        <Mug position={[TABLE[0] + 0.5, 0.98, TABLE[1] - 0.4]} />
        {[.8,-.8,2.35,-2.35].map(a=><group key={`notepad-${a}`} position={[TABLE[0]+Math.sin(a)*1.33,.979,TABLE[1]+Math.cos(a)*1.33]} rotation={[0,a,0]}>
          <mesh receiveShadow><boxGeometry args={[.28,.01,.22]}/><meshStandardMaterial color="#e5dcc4" roughness={.94}/></mesh>
          {[0,1,2].map(i=><mesh key={i} position={[.015,.0055,-.05+i*.025]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.16,.0018]}/><meshStandardMaterial color="#999a84"/></mesh>)}
        </group>)}
        {[0.8, -0.8, 2.35, -2.35].map((a, i) => {
          const sp = meetingSeat(a);
          return (
            <group key={i} position={sp.pos} rotation={[0, sp.rot, 0]} scale={S}>
              <OfficeChair />
            </group>
          );
        })}

        {/* lounge and coffeeRef */}
        <CoffeeStation position={[6.1, 0, -5.25]} coffeeRef={coffeeRef} />
        <Bookshelf position={[3.8, 0, 5.0]} />
        <group position={[6.2, 0, 3.0]} scale={1.25}>
          <Armchair position={[0, 0, 0]} rotation={-2.4} />
        </group>
        <SideCabinet position={[6.8, 0, 0.9]} rotation={-Math.PI / 2} />
        <Plant position={[7.0, 0, -2.6]} scale={1.0} seed={2} />
        <Plant position={[-7.0, 0, 5.6]} scale={1.0} seed={3} />
        <Plant position={[7.0, 0, 5.4]} scale={0.85} seed={4} />
        <Plant position={[0.6, 0, 5.2]} scale={0.75} seed={5} />
        <Plant position={[-2.4, 1.15, -5.85]} scale={0.38} seed={6} />
        <Plant position={[3.8, 1.15, -5.85]} scale={0.38} seed={7} />
        <Plant position={[5.25, 1.11, 5.91]} scale={0.4} seed={8} />
        <Plant position={[6.85, 1.11, 5.91]} scale={0.44} seed={9} />

        </StaticStudio>

        {/* agents */}
        {ordered.map((agent, i) => {
          const cheer = roomFx.filter((f) => f.kind === "celebrate" && f.agentId === agent.id).pop();
          return (
            <AgentActor
              key={agent.id}
              agent={agent}
              coffeeRef={coffeeRef}
              meetingRef={meetingRef}
              idleRef={idleRef}
              spot={spotOf(i)}
              reducedMotion={reduced}
              paused={paused}
              selectedColor={colorMode === "dark" ? "#cedbd2" : "#16171d"}
              selected={selectedId === agent.id}
              handoffRef={handoffRef}
              celebrateAt={cheer?.ts ?? 0}
              lookAt={agent.status === "working" ? null : lookAt}
            />
          );
        })}

        {/* hand-off papers (thrown on arrival) and celebrations */}
        {!reduced && roomFx.map((f) => {
          if (f.kind === "handoff") return null;
          const i = indexOf(f.agentId);
          if (i < 0) return null;
          const p = spotOf(i).pos;
          return <Confetti key={f.id} at={[p[0], 2.8, p[2]]} ts={f.ts} />;
        })}
        {profile.ao && <StudioPostProcessing />}
        </Suspense>
        </StudioQualityContext.Provider>
      </Canvas>
      <StudioLoader />
      {meetingPhase && <span role="status" className="absolute right-16 top-3 z-20 rounded-xl border border-line bg-surface/90 px-3 py-2 text-[11px] text-muted shadow-sm">{meetingPhase === "waiting" ? "Waiting for meeting seats" : meetingPhase === "gathering" ? "Planning meeting · gathering" : meetingPhase === "returning" ? "Returning to work" : "Planning meeting"}</span>}
      <button type="button" aria-label={paused ? "Resume scene animation" : "Pause scene animation"} aria-pressed={paused} onClick={()=>setPaused(p=>!p)} title={paused ? "Resume scene animation" : "Pause scene animation"} className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full border border-line bg-surface/90 text-sm text-ink shadow-sm"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">{paused?<path d="M6 3.5v13l10-6.5z"/>:<><rect x="5" y="3.5" width="3" height="13" rx=".7"/><rect x="12" y="3.5" width="3" height="13" rx=".7"/></>}</svg></button>
      <div className="pointer-events-none absolute inset-0">
        {coffeeStatus && <Overlay id={`${coffeeStatus.owner}:break`} z={12}><span className="rounded-full bg-surface px-2 py-1 text-[11px] text-muted shadow-sm">Coffee break{coffeeStatus.brew ? " · brewing" : ""}</span></Overlay>}
        {ordered.map((agent) => (
          <AgentOverlays
            key={agent.id}
            room={room}
            agent={agent}
            tag={tags.get(agent.id) ?? ""}
            selected={selectedId === agent.id}
            bubble={bubbleApproval?.agentId === agent.id ? bubbleApproval : undefined}
            compact={compact}
            onMinimize={(id) => setMinimized((xs) => [...xs, id])}
          />
        ))}
      </div>
      </StudioBoundary>
    </div>
  );
}
