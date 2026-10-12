"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3, type Group } from "three";
import { actions } from "@/lib/store";
import type { Agent, Approval, Fx, Room, SceneTheme } from "@/lib/types";
import { ApprovalCard } from "./ApprovalCard";
import { Character, type Motion } from "./Character";
import { Confetti, PaperFlight, StatusRing } from "./Effects";
import { Armchair, Bookshelf, Cabinet, Floor, Mug, Plant, RoundTable, Rug, SideCabinet, Whiteboard } from "./Furniture";
import { Anchor, Overlay, Projector } from "./Overlay";
import { CoffeeStation, OfficeChair, Workstation } from "./Workstation";

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
const WALK_SPEED = 2.4; // world units per second
const STAND_UP = 0.45;
const TALK = 2.2;

type XZ = [number, number];

interface Spot {
  pos: [number, number, number];
  rot: number;
  kind: "lead" | "desk" | "meeting";
}

const TABLE: XZ = [-4.4, 4.0];
const meetingSeat = (a: number): Spot => {
  const x = TABLE[0] + Math.sin(a) * 1.75;
  const z = TABLE[1] + Math.cos(a) * 1.75;
  return { pos: [x, 0, z], rot: Math.atan2(TABLE[0] - x, TABLE[1] - z), kind: "meeting" };
};

/**
 * Seats in assignment order: the lead's desk, then one personal desk per
 * agent, then the meeting table for anyone beyond that. Everyone at a desk
 * faces +z, so the aisles behind the rows stay free for walking.
 */
const ROW_A = -5.0;
const ROW_B = 0.4;
const DESKS: Spot[] = [
  { pos: [-4.6, 0, ROW_B], rot: 0, kind: "lead" },
  { pos: [-1.6, 0, ROW_B], rot: 0, kind: "desk" },
  { pos: [1.3, 0, ROW_B], rot: 0, kind: "desk" },
  { pos: [-1.6, 0, ROW_A], rot: 0, kind: "desk" },
  { pos: [1.3, 0, ROW_A], rot: 0, kind: "desk" },
  { pos: [4.2, 0, ROW_B], rot: 0, kind: "desk" },
  { pos: [4.2, 0, ROW_A], rot: 0, kind: "desk" },
  { pos: [-4.6, 0, ROW_A], rot: 0, kind: "desk" },
];
const SPOTS: Spot[] = [...DESKS, ...[0.8, -0.8, 2.35, -2.35].map(meetingSeat)];

/** Walking route between two seats along the aisles behind the desk rows and the gaps between desks. */
function routeBetween(from: Spot, to: Spot): XZ[] {
  const [fx, , fz] = from.pos;
  const [tx, , tz] = to.pos;
  const behind = (sp: Spot): XZ => (sp.kind === "meeting" ? [sp.pos[0] + (sp.pos[0] - TABLE[0]) * 0.35, sp.pos[2] + (sp.pos[2] - TABLE[1]) * 0.35] : [sp.pos[0], sp.pos[2] - 1.15]);
  const start = behind(from);
  const pts: XZ[] = [[fx, fz], start];
  if (to.kind === "meeting") {
    pts.push([start[0], 2.2], [behind(to)[0], 2.2], behind(to));
    return pts;
  }
  const gapX = tx - 1.45; // the gap left of the target's desk
  const meet: XZ = [tx - 0.95, tz - 0.45];
  if (from.kind === "meeting") pts.push([start[0], 2.2], [gapX, 2.2]);
  else pts.push([gapX, start[1]]);
  pts.push([gapX, meet[1]], meet);
  return pts;
}

function pathLength(pts: XZ[]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return d;
}

/** Point and heading at distance `d` along the route. */
function along(pts: XZ[], d: number): { x: number; z: number; heading: number } {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const seg = Math.hypot(bx - ax, bz - az);
    if (d <= seg || i === pts.length - 1) {
      const k = seg ? Math.min(1, d / seg) : 1;
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, heading: Math.atan2(bx - ax, bz - az) };
    }
    d -= seg;
  }
  return { x: pts[0][0], z: pts[0][1], heading: 0 };
}

/** Timeline of a hand-off: stand up, walk over, talk, walk back, sit down. */
function handoffTiming(route: XZ[]) {
  const walk = pathLength(route) / WALK_SPEED;
  const arrive = STAND_UP + walk;
  return { walk, arrive, leave: arrive + TALK, end: arrive + TALK + walk + STAND_UP };
}

/**
 * Phones: frame the occupied seats instead of the whole floor, so agents stay
 * big enough to read. Re-fits when the viewport or the team changes.
 */
function FitToAgents({ spots, padTop, padBottom, padRight }: { spots: Spot[]; padTop: number; padBottom: number; padRight: number }) {
  const size = useThree((st) => st.size);
  const get = useThree((st) => st.get);
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
  }, [size, get, key, padTop, padBottom, padRight]);
  return null;
}

function ResponsiveZoom() {
  const size = useThree((st) => st.size);
  const get = useThree((st) => st.get);
  useEffect(() => {
    const { camera } = get();
    const portrait = size.height > size.width * 1.05;
    // portrait phones crop the empty floor corners so the agents stay readable
    camera.zoom = portrait ? size.width / 12.5 : Math.min(size.width / 16.5, size.height / 12.5);
    camera.updateProjectionMatrix();
  }, [size, get]);
  return null;
}

function Label({ name, tag, active, compact, onClick, topicRoomId }: { name: string; tag: string; active: boolean; compact: boolean; onClick: () => void; topicRoomId?:string }) {
  return (
    <button
      onClick={onClick}
      data-topic-room={topicRoomId}
      title={name}
      aria-label={topicRoomId ? name : undefined}
      className={`max-w-[170px] flex items-center gap-1.5 whitespace-nowrap rounded-full border-[#16171d] font-semibold shadow-sm transition hover:-translate-y-px ${
        compact ? "border px-1.5 py-px text-[10.5px]" : "border-[1.5px] px-2.5 py-[3px] text-[12.5px]"
      } ${
        active ? "bg-[#c9d4ff] text-[#16171d]" : "bg-white text-[#16171d]"
      }`}
    >
      <span dir="auto" className="min-w-0 truncate">{name}</span>
      {!topicRoomId && !compact && <span className="text-[11px] font-normal tracking-wide text-[#3d404b]">{tag}</span>}
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
      <div className="flex gap-1 rounded-full bg-white px-2.5 py-1.5 shadow-md">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4f7cf5]" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    );
  const tool = activity.split(" · ")[0];
  return (
    <div className="flex max-w-[220px] items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11.5px] text-[#3a3d47] shadow-md">
      <span>{TOOL_ICON[tool] ?? "🛠️"}</span>
      <span className="truncate">{activity}</span>
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#4f7cf5]" />
    </div>
  );
}

function SpeechBubble({ room, approval, agent, compact, onMinimize }: { room: Room; approval: Approval; agent: Agent; compact: boolean; onMinimize: () => void }) {
  return (
    <div
      className={`relative animate-[pop_.35s_ease-out] border-[#16171d] bg-white shadow-[0_18px_40px_rgba(20,22,30,0.12)] ${
        compact ? "rounded-[20px] border-2 p-3" : "rounded-[28px] border-[3px] p-5"
      }`}
    >
      <button
        onClick={onMinimize}
        title="Later — keep it in Needs you"
        aria-label="Minimize"
        className="absolute -right-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full border-2 border-[#16171d] bg-white text-[13px] font-bold leading-none text-[#16171d] hover:bg-[#f4f5f8]"
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
  index: number;
  selected: boolean;
  handoff?: { route: XZ[]; face: XZ; ts: number };
  celebrateAt: number;
  lookAt: Vector3 | null;
}

/** One agent: sits at their seat, and on a hand-off stands up, walks the aisles to a teammate, talks, and comes back. */
function AgentActor({ agent, spot, index, selected, handoff, celebrateAt, lookAt }: ActorProps) {
  const group = useRef<Group>(null);
  const motion = useRef<Motion>({ walking: false, seated: true, talking: false, look: null, celebrateAt: 0 });
  const timing = useMemo(() => (handoff ? handoffTiming(handoff.route) : null), [handoff]);

  useEffect(() => {
    motion.current.look = lookAt;
  }, [lookAt]);
  useEffect(() => {
    motion.current.celebrateAt = celebrateAt;
  }, [celebrateAt]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const m = motion.current;
    let x = spot.pos[0];
    let z = spot.pos[2];
    let facing = spot.rot;
    let walking = false;
    let seated = true;
    let talking = false;

    if (handoff && timing) {
      const age = (Date.now() - handoff.ts) / 1000;
      const len = pathLength(handoff.route);
      if (age < timing.end) seated = age > timing.end - STAND_UP * 0.6 || age < STAND_UP * 0.3;
      if (age >= STAND_UP && age < timing.arrive) {
        const p = along(handoff.route, (age - STAND_UP) * WALK_SPEED);
        [x, z, facing, walking] = [p.x, p.z, p.heading, true];
      } else if (age >= timing.arrive && age < timing.leave) {
        const p = along(handoff.route, len);
        [x, z, talking] = [p.x, p.z, true];
        facing = Math.atan2(handoff.face[0] - x, handoff.face[1] - z);
      } else if (age >= timing.leave && age < timing.end - STAND_UP) {
        const back = [...handoff.route].reverse();
        const p = along(back, (age - timing.leave) * WALK_SPEED);
        [x, z, facing, walking] = [p.x, p.z, p.heading, true];
      }
    }

    g.position.set(x, spot.pos[1], z);
    let diff = facing - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * 9);
    m.walking = walking;
    m.seated = seated;
    m.talking = talking;
  });

  return (
    <group ref={group} position={spot.pos} rotation={[0, spot.rot, 0]} scale={S}>
      <StatusRing status={agent.status} selected={selected} />
      <Character look={agent.look} status={agent.status} seed={index} motion={motion} onClick={() => agent.topicRoomId ? actions.selectRoom(agent.topicRoomId) : actions.selectAgent(agent.id)}>
        <Anchor id={`${agent.id}:label`} position={[0, 0.15, 0.25]} />
        <Anchor id={`${agent.id}:above`} position={[0, 2.45, 0]} />
        <Anchor id={`${agent.id}:bubble`} position={[0, 2.6, 0]} />
      </Character>
    </group>
  );
}

export default function OfficeScene({
  room,
  selectedId,
  theme,
  fx,
  compact = false,
  padBottom = 70,
  padRight = 0,
}: {
  room: Room;
  selectedId: string | null;
  theme: SceneTheme;
  fx: Fx[];
  compact?: boolean;
  /** Phone only: screen space covered by the bottom sheet / side panel, kept out of the framing. */
  padBottom?: number;
  padRight?: number;
}) {
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
      out.set(f.id, { from: a, to: b, route: routeBetween(SPOTS[a % SPOTS.length], SPOTS[b % SPOTS.length]) });
    }
    return out;
  }, [fx, ordered, room.id]);

  const tags = new Map<string, string>();
  let n = 0;
  for (const a of ordered) tags.set(a.id, a.isLead ? "LEAD" : `AGENT ${++n}`);

  // which agent (if any) owns each desk
  const deskOwner = DESKS.map((_, i) => ordered[i]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} onPointerMissed={() => (document.body.style.cursor = "")}>
        <OrthographicCamera makeDefault position={[20, 17, 20]} near={-50} far={200} zoom={50} />
        {compact || room.telegram ? <FitToAgents spots={ordered.map((_, i) => spotOf(i))} padTop={16} padBottom={padBottom} padRight={padRight} /> : <ResponsiveZoom />}
        <Projector />
        <OrbitControls
          makeDefault
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

        <hemisphereLight args={["#ffffff", "#e2d3bf", 0.9]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[6, 14, 8]}
          intensity={2.1}
          color="#fff8ef"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0005}
          shadow-radius={6}
        />
        <directionalLight position={[-8, 6, -4]} intensity={0.35} color="#eef2ff" />

        <Floor color={THEME_FLOOR[theme]} />
        <Rug position={[TABLE[0], 0.012, TABLE[1]]} radius={2.25} color={THEME_RUG[theme]} />
        <ContactShadows position={[0, 0.015, 0]} scale={18} opacity={0.35} blur={2.2} far={4} />

        {/* left wall zone: whiteboard and filing cabinet next to the lead */}
        <Whiteboard position={[-7.0, 0, -1.2]} rotation={Math.PI / 2} />
        <Cabinet position={[-7.0, 0, -4.4]} rotation={Math.PI / 2} />

        {/* personal desks: one per agent, laid out in rows */}
        {DESKS.map((spot, i) => {
          const owner = deskOwner[i];
          if (!owner) return null;
          return (
            <group key={i} position={spot.pos} rotation={[0, spot.rot, 0]} scale={S}>
              <Workstation seed={i + 1} color={owner?.look.shirt} lead={spot.kind === "lead"} active={owner?.status === "working"} />
            </group>
          );
        })}

        {/* meeting corner */}
        <RoundTable position={[TABLE[0], 0, TABLE[1]]} />
        <Mug position={[TABLE[0] + 0.5, 0.98, TABLE[1] - 0.4]} />
        {[0.8, -0.8, 2.35, -2.35].map((a, i) => {
          const sp = meetingSeat(a);
          return (
            <group key={i} position={sp.pos} rotation={[0, sp.rot, 0]} scale={S}>
              <OfficeChair />
            </group>
          );
        })}

        {/* lounge and coffee */}
        <CoffeeStation position={[6.6, 0, -5.2]} />
        <Bookshelf position={[3.8, 0, 5.0]} />
        <group position={[6.2, 0, 3.0]} scale={1.25}>
          <Armchair position={[0, 0, 0]} rotation={-2.4} />
        </group>
        <SideCabinet position={[6.8, 0, 0.9]} rotation={-Math.PI / 2} />
        <Plant position={[-7.0, 0, -5.8]} scale={1.1} seed={1} />
        <Plant position={[7.0, 0, -2.6]} scale={1.0} seed={2} />
        <Plant position={[-7.0, 0, 5.6]} scale={1.0} seed={3} />
        <Plant position={[7.0, 0, 5.4]} scale={0.85} seed={4} />
        <Plant position={[0.6, 0, 5.2]} scale={0.75} seed={5} />

        {/* agents */}
        {ordered.map((agent, i) => {
          let handoff: ActorProps["handoff"];
          for (const f of roomFx) {
            const r = routes.get(f.id);
            if (f.kind === "handoff" && r && r.from === i) {
              const to = spotOf(r.to).pos;
              handoff = { route: r.route, face: [to[0], to[2]], ts: f.ts };
            }
          }
          const cheer = roomFx.filter((f) => f.kind === "celebrate" && f.agentId === agent.id).pop();
          return (
            <AgentActor
              key={agent.id}
              agent={agent}
              spot={spotOf(i)}
              index={i}
              selected={selectedId === agent.id}
              handoff={handoff}
              celebrateAt={cheer?.ts ?? 0}
              lookAt={agent.status === "working" ? null : lookAt}
            />
          );
        })}

        {/* hand-off papers (thrown on arrival) and celebrations */}
        {roomFx.map((f) => {
          if (f.kind === "handoff") {
            const r = routes.get(f.id);
            if (!r) return null;
            const end = r.route[r.route.length - 1];
            const to = spotOf(r.to).pos;
            const t = handoffTiming(r.route);
            return <PaperFlight key={f.id} from={[end[0], 1.9, end[1]]} to={[to[0], 1.5, to[2]]} ts={f.ts + (t.arrive - 0.6) * 1000} />;
          }
          const i = indexOf(f.agentId);
          if (i < 0) return null;
          const p = spotOf(i).pos;
          return <Confetti key={f.id} at={[p[0], 2.8, p[2]]} ts={f.ts} />;
        })}
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
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
    </div>
  );
}
