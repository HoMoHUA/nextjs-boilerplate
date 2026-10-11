"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import type { AgentStatus } from "@/lib/types";

type V3 = [number, number, number];

const RING: Record<AgentStatus, string | null> = {
  idle: null,
  working: "#4f7cf5",
  needs_you: "#f5a524",
  done: "#2fbf71",
};

/** Soft glowing ring on the floor under an agent, colored by status. */
export function StatusRing({ status, selected }: { status: AgentStatus; selected: boolean }) {
  const mat = useRef<MeshBasicMaterial>(null);
  const color = RING[status] ?? (selected ? "#16171d" : null);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const pulse = status === "working" || status === "needs_you" ? 0.35 + Math.sin(clock.elapsedTime * 4) * 0.15 : 0.3;
    mat.current.opacity = pulse;
  });
  if (!color) return null;
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.62, 0.8, 48]} />
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

/** A sheet of paper that flies in an arc from one agent to another when work is handed off. */
export function PaperFlight({ from, to, ts }: { from: V3; to: V3; ts: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const k = ((Date.now() - ts) / 1000 - 0.9) / 1.2; // starts once the lead is on the way
    g.visible = k > 0 && k < 1;
    if (!g.visible) return;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    g.position.set(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e + Math.sin(Math.PI * k) * 1.6, from[2] + (to[2] - from[2]) * e);
    g.rotation.set(Math.sin(clock.elapsedTime * 9) * 0.4, clock.elapsedTime * 5, Math.cos(clock.elapsedTime * 7) * 0.3);
  });
  return (
    <group ref={ref} visible={false}>
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.012, 0.56]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.04, 0.008, -0.16 + i * 0.12]}>
          <boxGeometry args={[0.26 - i * 0.05, 0.004, 0.035]} />
          <meshBasicMaterial color="#9db6fb" />
        </mesh>
      ))}
    </group>
  );
}

const CONFETTI = ["#4f7cf5", "#f5a524", "#2fbf71", "#ef6b8a", "#9b7bf0", "#ffd166"];

/** Little burst of confetti above an agent (e.g. after an approval). */
export function Confetti({ at, ts }: { at: V3; ts: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        const sp = 1.4 + ((i * 37) % 10) / 8;
        return { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 3.2 + ((i * 53) % 10) / 5, color: CONFETTI[i % CONFETTI.length], spin: 4 + (i % 5) };
      }),
    [],
  );
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const t = (Date.now() - ts) / 1000;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = pieces[i];
      m.visible = t > 0 && t < 2.2;
      if (!m.visible) return;
      m.position.set(at[0] + p.vx * t, at[1] + p.vy * t - 4.2 * t * t, at[2] + p.vz * t);
      m.rotation.set(t * p.spin, t * p.spin * 0.7, 0);
    });
  });
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
          <boxGeometry args={[0.1, 0.02, 0.16]} />
          <meshBasicMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
}
