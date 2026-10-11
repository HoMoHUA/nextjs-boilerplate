"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useEffect } from "react";
import { actions } from "@/lib/store";
import type { Pose, Room, SceneTheme } from "@/lib/types";
import { ApprovalCard } from "./ApprovalCard";
import { Character } from "./Character";
import { Armchair, Bookshelf, Cabinet, Chair, Desk, Floor, Monitor, RoundTable, SideCabinet, Whiteboard } from "./Furniture";

export const THEME_FLOOR: Record<SceneTheme, string> = {
  cream: "#f1e8dc",
  mint: "#e1efe6",
  lavender: "#e9e5f4",
  sky: "#e1ebf6",
};

const AGENT_SCALE = 1.35;

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
  { pos: [-3.2, 0, -2.2], rot: Math.PI / 2, pose: "type", chair: true },
  { pos: [-2.9, 0, 4.2], rot: 2.6, pose: "sit", chair: true },
];

function ResponsiveZoom() {
  const size = useThree((st) => st.size);
  const get = useThree((st) => st.get);
  useEffect(() => {
    const { camera } = get();
    camera.zoom = Math.min(size.width / 18.5, size.height / 14);
    camera.updateProjectionMatrix();
  }, [size, get]);
  return null;
}

function Label({ name, tag, active, onClick }: { name: string; tag: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-[3px] text-[12.5px] font-semibold shadow-sm transition ${
        active ? "border-[#16171d] bg-[#c9d4ff] text-[#16171d]" : "border-[#16171d] bg-white text-[#16171d]"
      }`}
    >
      {name}
      <span className="text-[11px] font-normal tracking-wide text-[#3d404b]">{tag}</span>
    </button>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 rounded-full bg-white px-2.5 py-1.5 shadow-md">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4f7cf5]" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

export default function OfficeScene({ room, selectedId, theme }: { room: Room; selectedId: string | null; theme: SceneTheme }) {
  const ordered = [...room.agents].sort((a, b) => Number(b.isLead) - Number(a.isLead));
  const pending = room.approvals.filter((a) => a.status === "pending");
  const bubbleApproval = pending[pending.length - 1];
  let n = 0;

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} onPointerMissed={() => (document.body.style.cursor = "")}>
      <OrthographicCamera makeDefault position={[20, 17, 20]} near={-50} far={200} zoom={50} />
      <ResponsiveZoom />
      <OrbitControls
        target={[0, 0.5, 0]}
        enablePan={false}
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
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
        shadow-radius={6}
      />
      <directionalLight position={[-8, 6, -4]} intensity={0.35} />

      <Floor color={THEME_FLOOR[theme]} />
      <ContactShadows position={[0, 0.01, 0]} scale={18} opacity={0.35} blur={2.2} far={4} />

      {/* furniture */}
      <Whiteboard position={[-5.7, 0, -0.4]} rotation={Math.PI / 2 - 0.25} />
      <RoundTable position={[-1.7, 0, 2.6]} />
      <Desk position={[-1.6, 0, -2.2]} rotation={Math.PI / 2} size={[3.2, 1.4]} />
      <Monitor position={[-2.0, 1.06, -2.8]} rotation={Math.PI / 2} seed={1} />
      <Monitor position={[-2.0, 1.06, -1.5]} rotation={Math.PI / 2 - 0.2} seed={2} />
      <Monitor position={[-1.3, 1.06, -2.3]} rotation={-Math.PI / 2} seed={3} />
      <Cabinet position={[-4.2, 0, -4.9]} />
      <Chair position={[-3.1, 0, -4.4]} rotation={0.3} />
      <SideCabinet position={[2.6, 0, -4.9]} rotation={0.15} />
      <group position={[4.2, 0, -3.5]} scale={1.3}><Armchair position={[0, 0, 0]} rotation={-0.9} /></group>
      <Bookshelf position={[2.9, 0, 3.1]} rotation={-0.15} />

      {/* agents */}
      {ordered.map((agent, i) => {
        const spot = SPOTS[i % SPOTS.length];
        const idx = n++;
        const tag = agent.isLead ? "LEAD" : `AGENT ${idx}`;
        const labelY = spot.pose === "stand" ? 2.45 : 2.25;
        const showBubble = bubbleApproval?.agentId === agent.id;
        return (
          <group key={agent.id} position={spot.pos} scale={AGENT_SCALE}>
            {spot.chair && <Chair position={[0, 0, 0]} rotation={spot.rot + Math.PI} />}
            <Character
              look={agent.look}
              pose={spot.pose}
              status={agent.status}
              position={[0, spot.chair ? 0.02 : 0, 0]}
              rotation={spot.rot}
              seed={i}
              onClick={() => actions.selectAgent(agent.id)}
            >
              <Html position={[0, -0.05, 0.9]} center zIndexRange={[20, 0]}>
                <Label name={agent.name} tag={tag} active={selectedId === agent.id} onClick={() => actions.selectAgent(agent.id)} />
              </Html>
              {agent.status === "working" && (
                <Html position={[0, labelY + 0.35, 0]} center zIndexRange={[20, 0]}>
                  <TypingDots />
                </Html>
              )}
              {showBubble && (
                <Html position={[0, labelY + 0.6, 0]} zIndexRange={[40, 30]} style={{ transform: "translate(-62%, -100%)" }}>
                  <div className="relative rounded-[28px] border-[3px] border-[#16171d] bg-white p-5 shadow-[0_18px_40px_rgba(20,22,30,0.12)]">
                    <ApprovalCard roomId={room.id} approval={bubbleApproval} agent={agent} variant="bubble" />
                    <svg className="absolute -bottom-[26px] left-[62%]" width="44" height="30" viewBox="0 0 44 30">
                      <path d="M2 0 C 14 6, 20 14, 18 28 C 26 18, 34 8, 42 0" fill="#fff" stroke="#16171d" strokeWidth="3" strokeLinejoin="round" />
                      <rect x="0" y="0" width="44" height="3" fill="#fff" />
                    </svg>
                  </div>
                </Html>
              )}
            </Character>
          </group>
        );
      })}
    </Canvas>
  );
}
