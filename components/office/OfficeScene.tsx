"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { Vector3, type Group } from "three";
import { actions } from "@/lib/store";
import type { Agent, Approval, Fx, Pose, Room, SceneTheme } from "@/lib/types";
import { ApprovalCard } from "./ApprovalCard";
import { Character, type Motion } from "./Character";
import { Confetti, PaperFlight, StatusRing } from "./Effects";
import { Anchor, Overlay, Projector } from "./Overlay";
import { Armchair, Bookshelf, Cabinet, Chair, Desk, Floor, Monitor, Mug, Plant, RoundTable, Rug, SideCabinet, Whiteboard } from "./Furniture";

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

const AGENT_SCALE = 1.35;
const HEAD_Y = 2.3; // world height of a standing agent's head (scaled)

interface Spot {
  pos: [number, number, number];
  rot: number;
  pose: Pose;
  chair?: boolean;
}

/** Where agents sit/stand. The lead always takes the first spot (by the whiteboard). */
const SPOTS: Spot[] = [
  { pos: [-3.9, 0, 0.9], rot: 0.9, pose: "stand" },
  { pos: [-0.2, 0, 3.6], rot: -2.3, pose: "sit", chair: true },
  { pos: [0.2, 0, -2.2], rot: -Math.PI / 2, pose: "type", chair: true },
  { pos: [4.2, -0.12, -3.5], rot: -0.9, pose: "tablet" },
  { pos: [-0.4, 0, 1.4], rot: -0.87, pose: "sit", chair: true },
  { pos: [-2.9, 0, 4.2], rot: 2.6, pose: "sit", chair: true },
  { pos: [1.3, 0, 1.0], rot: 0.5, pose: "stand" },
  { pos: [5.4, 0, 0.2], rot: -0.7, pose: "stand" },
];

function ResponsiveZoom() {
  const size = useThree((st) => st.size);
  const get = useThree((st) => st.get);
  useEffect(() => {
    const { camera } = get();
    camera.zoom = Math.min(size.width / 17, size.height / 13);
    camera.updateProjectionMatrix();
  }, [size, get]);
  return null;
}

function Label({ name, tag, active, onClick }: { name: string; tag: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-[#16171d] px-2.5 py-[3px] text-[12.5px] font-semibold shadow-sm transition hover:-translate-y-px ${
        active ? "bg-[#c9d4ff] text-[#16171d]" : "bg-white text-[#16171d]"
      }`}
    >
      {name}
      <span className="text-[11px] font-normal tracking-wide text-[#3d404b]">{tag}</span>
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

function SpeechBubble({ room, approval, agent }: { room: Room; approval: Approval; agent: Agent }) {
  return (
    <div className="relative animate-[pop_.35s_ease-out] rounded-[28px] border-[3px] border-[#16171d] bg-white p-5 shadow-[0_18px_40px_rgba(20,22,30,0.12)]">
      <ApprovalCard roomId={room.id} approval={approval} agent={agent} variant="bubble" />
      <svg className="absolute -bottom-[26px] left-[62%]" width="44" height="30" viewBox="0 0 44 30">
        <path d="M2 0 C 14 6, 20 14, 18 28 C 26 18, 34 8, 42 0" fill="#fff" stroke="#16171d" strokeWidth="3" strokeLinejoin="round" />
        <rect x="0" y="0" width="44" height="3" fill="#fff" />
      </svg>
    </div>
  );
}

interface ActorProps {
  agent: Agent;
  spot: Spot;
  index: number;
  selected: boolean;
  handoff?: { to: [number, number, number]; ts: number };
  celebrateAt: number;
  lookAt: Vector3 | null;
}

/** Name tag, live activity, "needs you" marker and approval bubble for one agent. */
function AgentOverlays({ room, agent, tag, selected, bubble }: { room: Room; agent: Agent; tag: string; selected: boolean; bubble?: Approval }) {
  return (
    <>
      <Overlay id={`${agent.id}:label`} z={10}>
        <Label name={agent.name} tag={tag} active={selected} onClick={() => actions.selectAgent(agent.id)} />
      </Overlay>
      {agent.status === "working" && (
        <Overlay id={`${agent.id}:above`} z={15}>
          <Activity activity={agent.activity} />
        </Overlay>
      )}
      {agent.status === "needs_you" && !bubble && (
        <Overlay id={`${agent.id}:above`} z={15}>
          <button
            onClick={() => actions.selectAgent(agent.id)}
            className="grid h-7 w-7 animate-bounce place-items-center rounded-full bg-[#f5a524] text-[15px] font-black text-white shadow-md"
            title={`${agent.name} needs you`}
          >
            !
          </button>
        </Overlay>
      )}
      {bubble && (
        <Overlay id={`${agent.id}:bubble`} z={30} ax={0.62} ay={1} clamp>
          <SpeechBubble room={room} approval={bubble} agent={agent} />
        </Overlay>
      )}
    </>
  );
}

/** One agent in the office: positions it and walks it over to a teammate on hand-offs. */
function AgentActor({ agent, spot, index, selected, handoff, celebrateAt, lookAt }: ActorProps) {
  const group = useRef<Group>(null);
  const motion = useRef<Motion>({ walking: false, look: null, celebrateAt: 0 });

  useEffect(() => {
    motion.current.look = lookAt;
  }, [lookAt]);
  useEffect(() => {
    motion.current.celebrateAt = celebrateAt;
  }, [celebrateAt]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const [bx, by, bz] = spot.pos;
    let x = bx;
    let z = bz;
    let facing = spot.rot;
    let walking = false;

    if (handoff && spot.pose === "stand") {
      const age = (Date.now() - handoff.ts) / 1000;
      const dx = handoff.to[0] - bx;
      const dz = handoff.to[2] - bz;
      const dist = Math.hypot(dx, dz);
      const reach = Math.max(0, dist - 1.7) / (dist || 1);
      const toward = Math.atan2(dx, dz);
      const ease = (k: number) => k * k * (3 - 2 * k);
      let k = 0;
      if (age < 1.6) {
        k = ease(age / 1.6);
        walking = true;
        facing = toward;
      } else if (age < 3.6) {
        k = 1;
        facing = toward;
      } else if (age < 5.2) {
        k = 1 - ease((age - 3.6) / 1.6);
        walking = true;
        facing = toward + Math.PI;
      }
      x = bx + dx * reach * k;
      z = bz + dz * reach * k;
    }

    g.position.set(x, by + (spot.chair ? 0.02 : 0), z);
    let diff = facing - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * 8);
    motion.current.walking = walking;
  });

  const labelY = spot.pose === "stand" ? 2.45 : 2.25;
  return (
    <group>
      {spot.chair && (
        <group position={spot.pos} scale={AGENT_SCALE}>
          <Chair position={[0, 0, 0]} rotation={spot.rot + Math.PI} />
        </group>
      )}
      <group ref={group} position={spot.pos} rotation={[0, spot.rot, 0]} scale={AGENT_SCALE}>
        <StatusRing status={agent.status} selected={selected} />
        <Character
          look={agent.look}
          pose={spot.pose}
          status={agent.status}
          seed={index}
          motion={motion}
          onClick={() => actions.selectAgent(agent.id)}
        >
          <Anchor id={`${agent.id}:label`} position={[0, 0.05, 0.3]} />
          <Anchor id={`${agent.id}:above`} position={[0, labelY + 0.35, 0]} />
          <Anchor id={`${agent.id}:bubble`} position={[0, labelY + 0.6, 0]} />
        </Character>
      </group>
    </group>
  );
}

export default function OfficeScene({ room, selectedId, theme, fx }: { room: Room; selectedId: string | null; theme: SceneTheme; fx: Fx[] }) {
  const ordered = useMemo(() => [...room.agents].sort((a, b) => Number(b.isLead) - Number(a.isLead)), [room.agents]);
  const spotOf = (i: number) => SPOTS[i % SPOTS.length];
  const posOf = (id?: string): [number, number, number] | null => {
    const i = ordered.findIndex((a) => a.id === id);
    return i < 0 ? null : spotOf(i).pos;
  };

  const pending = room.approvals.filter((a) => a.status === "pending");
  const bubbleApproval = pending[pending.length - 1];
  const roomFx = fx.filter((f) => f.roomId === room.id);
  const anyWorking = room.agents.some((a) => a.status === "working");

  // everyone glances at the agent who is working (the first one, if several)
  const workingIdx = ordered.findIndex((a) => a.status === "working");
  const lookAt = useMemo(() => {
    if (workingIdx < 0) return null;
    const p = SPOTS[workingIdx % SPOTS.length].pos;
    return new Vector3(p[0], HEAD_Y, p[2]);
  }, [workingIdx]);

  const tags = new Map<string, string>();
  let n = 0;
  for (const a of ordered) tags.set(a.id, a.isLead ? "LEAD" : `AGENT ${++n}`);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} onPointerMissed={() => (document.body.style.cursor = "")}>
        <OrthographicCamera makeDefault position={[20, 17, 20]} near={-50} far={200} zoom={50} />
        <ResponsiveZoom />
        <Projector />
        <OrbitControls
          target={[0, 0.5, 0]}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minZoom={25}
          maxZoom={120}
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
        <Rug position={[-1.7, 0.012, 2.6]} radius={2.7} color={THEME_RUG[theme]} />
        <ContactShadows position={[0, 0.015, 0]} scale={18} opacity={0.35} blur={2.2} far={4} />

        {/* furniture */}
        <Whiteboard position={[-5.7, 0, -0.4]} rotation={Math.PI / 2 - 0.25} />
        <RoundTable position={[-1.7, 0, 2.6]} />
        <Mug position={[-1.0, 0.98, 2.0]} />
        <Desk position={[-1.6, 0, -2.2]} rotation={Math.PI / 2} size={[3.2, 1.4]} />
        <Monitor position={[-2.0, 1.06, -2.8]} rotation={Math.PI / 2} seed={1} active={anyWorking} />
        <Monitor position={[-2.0, 1.06, -1.5]} rotation={Math.PI / 2 - 0.2} seed={2} active={anyWorking} />
        <Monitor position={[-1.3, 1.06, -2.3]} rotation={-Math.PI / 2} seed={3} active={anyWorking} />
        <Mug position={[-1.1, 1.06, -1.0]} />
        <Cabinet position={[-4.2, 0, -4.9]} />
        <Chair position={[-3.1, 0, -4.4]} rotation={0.3} />
        <SideCabinet position={[2.6, 0, -4.9]} rotation={0.15} />
        <group position={[4.2, 0, -3.5]} scale={1.3}>
          <Armchair position={[0, 0, 0]} rotation={-0.9} />
        </group>
        <Bookshelf position={[2.9, 0, 3.1]} rotation={-0.15} />
        <Plant position={[-6.6, 0, -5.3]} scale={1.25} seed={1} />
        <Plant position={[6.5, 0, -5.1]} scale={1.05} seed={2} />
        <Plant position={[-6.5, 0, 5.1]} scale={0.95} seed={3} />
        <Plant position={[6.5, 0, 5.0]} scale={0.8} seed={4} />

        {/* agents */}
        {ordered.map((agent, i) => {
          const spot = spotOf(i);
          const handoffFx = roomFx.filter((f) => f.kind === "handoff" && f.from === agent.id).pop();
          const to = posOf(handoffFx?.to);
          const cheer = roomFx.filter((f) => f.kind === "celebrate" && f.agentId === agent.id).pop();
          return (
            <AgentActor
              key={agent.id}
              agent={agent}
              spot={spot}
              index={i}
              selected={selectedId === agent.id}
              handoff={handoffFx && to ? { to, ts: handoffFx.ts } : undefined}
              celebrateAt={cheer?.ts ?? 0}
              lookAt={agent.status === "working" ? null : lookAt}
            />
          );
        })}

        {/* hand-off papers and celebrations */}
        {roomFx.map((f) => {
          if (f.kind === "handoff") {
            const a = posOf(f.from);
            const b = posOf(f.to);
            if (!a || !b) return null;
            return <PaperFlight key={f.id} from={[a[0], 2.1, a[2]]} to={[b[0], 1.9, b[2]]} ts={f.ts} />;
          }
          const p = posOf(f.agentId);
          return p ? <Confetti key={f.id} at={[p[0], 2.6, p[2]]} ts={f.ts} /> : null;
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
          />
        ))}
      </div>
    </div>
  );
}
