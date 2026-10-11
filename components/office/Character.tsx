"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import type { AgentLook, AgentStatus, HairStyle } from "@/lib/types";

const Mat = ({ color, rough = 0.65 }: { color: string; rough?: number }) => (
  <meshStandardMaterial color={color} roughness={rough} metalness={0} />
);

/** Deterministic points on the upper part of a sphere, used to build hair. */
function hairPoints(style: HairStyle): { p: [number, number, number]; r: number }[] {
  const out: { p: [number, number, number]; r: number }[] = [];
  const n = style === "curly" ? 70 : style === "fluffy" ? 46 : 0;
  const R = style === "curly" ? 0.47 : 0.5;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 1.45; // 1 → -0.45
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.399963;
    const x = Math.cos(th) * rad;
    const z = Math.sin(th) * rad;
    if (z > 0.55 && y < 0.55) continue; // keep the face clear
    const r = style === "curly" ? 0.13 + ((i * 7) % 5) * 0.008 : 0.17 + ((i * 3) % 4) * 0.015;
    out.push({ p: [x * R, y * R + 0.06, z * R - 0.02], r });
  }
  return out;
}

function Hair({ look }: { look: AgentLook }) {
  const pts = useMemo(() => hairPoints(look.hairStyle), [look.hairStyle]);
  const c = look.hair;
  switch (look.hairStyle) {
    case "curly":
    case "fluffy":
      return (
        <group>
          {pts.map((h, i) => (
            <mesh key={i} position={h.p} castShadow>
              <sphereGeometry args={[h.r, 14, 12]} />
              <Mat color={c} rough={0.85} />
            </mesh>
          ))}
        </group>
      );
    case "bun":
      return (
        <group>
          <mesh position={[0, 0.1, -0.04]} scale={[1.04, 0.86, 1.04]} castShadow>
            <sphereGeometry args={[0.48, 28, 20, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
            <Mat color={c} rough={0.85} />
          </mesh>
          <mesh position={[0, 0.6, -0.08]} castShadow>
            <sphereGeometry args={[0.24, 20, 16]} />
            <Mat color={c} rough={0.9} />
          </mesh>
          <mesh position={[0, 0.3, -0.02]} rotation={[-0.5, 0, 0]}>
            <torusGeometry args={[0.43, 0.035, 10, 40]} />
            <Mat color={"#7b8fd6"} />
          </mesh>
        </group>
      );
    case "bob":
      return (
        <mesh position={[0, 0.02, -0.05]} scale={[1.08, 1.0, 1.06]} castShadow>
          <sphereGeometry args={[0.49, 28, 20, 0, Math.PI * 2, 0, Math.PI / 1.45]} />
          <Mat color={c} rough={0.8} />
        </mesh>
      );
    case "buzz":
      return (
        <mesh position={[0, 0.06, -0.02]} castShadow>
          <sphereGeometry args={[0.475, 28, 20, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
          <Mat color={c} rough={0.95} />
        </mesh>
      );
    default:
      return (
        <group>
          <mesh position={[0, 0.1, -0.05]} scale={[1.05, 0.9, 1.05]} castShadow>
            <sphereGeometry args={[0.48, 28, 20, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
            <Mat color={c} rough={0.8} />
          </mesh>
          {[-0.22, -0.05, 0.12, 0.27].map((x, i) => (
            <mesh key={i} position={[x, 0.3 - Math.abs(x) * 0.2, 0.3]} rotation={[0.5, 0, x]} castShadow>
              <sphereGeometry args={[0.15, 14, 12]} />
              <Mat color={c} rough={0.8} />
            </mesh>
          ))}
        </group>
      );
  }
}

function Head({ look, eyesRef, browsRef }: { look: AgentLook; eyesRef: React.RefObject<Group | null>; browsRef: React.RefObject<Group | null> }) {
  return (
    <group>
      <mesh castShadow scale={[1, 0.95, 0.97]}>
        <sphereGeometry args={[0.44, 36, 28]} />
        <Mat color={look.skin} rough={0.55} />
      </mesh>
      {/* ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.43, -0.03, 0.02]} scale={[0.6, 1, 0.8]}>
          <sphereGeometry args={[0.09, 14, 12]} />
          <Mat color={look.skin} rough={0.55} />
        </mesh>
      ))}
      {/* eyes: white, iris, highlight (the group is scaled on y to blink) */}
      <group ref={eyesRef} position={[0, 0.0, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.155, 0, 0.375]}>
            <mesh scale={[1, 1.18, 0.55]}>
              <sphereGeometry args={[0.072, 18, 14]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.006, 0.03]} scale={[1, 1.1, 0.6]}>
              <sphereGeometry args={[0.05, 16, 12]} />
              <meshStandardMaterial color="#2b1d18" roughness={0.15} />
            </mesh>
            <mesh position={[0.016, 0.02, 0.06]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}
      </group>
      {/* eyebrows */}
      <group ref={browsRef}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.155, 0.125, 0.395]} rotation={[0, 0, Math.PI / 2 + s * 0.12]}>
            <capsuleGeometry args={[0.016, 0.075, 4, 8]} />
            <Mat color={look.hair} rough={0.9} />
          </mesh>
        ))}
      </group>
      {/* cheeks */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.25, -0.1, 0.33]} scale={[1, 0.6, 0.35]}>
          <sphereGeometry args={[0.065, 12, 10]} />
          <meshStandardMaterial color="#f29a8a" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
      {/* nose + smile */}
      <mesh position={[0, -0.055, 0.425]} scale={[1.1, 0.9, 1]}>
        <sphereGeometry args={[0.032, 10, 8]} />
        <Mat color={look.skin} rough={0.5} />
      </mesh>
      <mesh position={[0, -0.125, 0.395]} rotation={[0.25, 0, Math.PI]}>
        <torusGeometry args={[0.048, 0.011, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#8c3b32" roughness={0.5} />
      </mesh>
      {look.glasses && (
        <group position={[0, 0.0, 0.43]}>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[s * 0.155, 0, 0]}>
                <torusGeometry args={[0.092, 0.013, 8, 28]} />
                <meshStandardMaterial color="#d8d9de" metalness={0.4} roughness={0.3} />
              </mesh>
              <mesh position={[s * 0.155, 0, -0.005]}>
                <circleGeometry args={[0.088, 24]} />
                <meshStandardMaterial color="#dff1ff" transparent opacity={0.18} depthWrite={false} />
              </mesh>
              {/* temple arm back to the ear */}
              <mesh position={[s * 0.33, 0.01, -0.18]} rotation={[0, s * 0.35, 0]}>
                <boxGeometry args={[0.012, 0.012, 0.36]} />
                <meshStandardMaterial color="#d8d9de" metalness={0.4} roughness={0.3} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.01, 0.01, 0.075, 6]} />
            <meshStandardMaterial color="#d8d9de" />
          </mesh>
        </group>
      )}
      <Hair look={look} />
      {look.hairStyle === "buzz" && <Headphones />}
    </group>
  );
}

function Headphones() {
  return (
    <group>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0.06, 0]}>
        <torusGeometry args={[0.47, 0.03, 8, 32, Math.PI]} />
        <meshStandardMaterial color="#2d2f36" roughness={0.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.47, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.08, 20]} />
          <meshStandardMaterial color="#2d2f36" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Mutable motion state shared with the scene (walking and sitting are driven from outside). */
export interface Motion {
  walking: boolean;
  /** true while the agent is in their chair */
  seated: boolean;
  /** Talking with a teammate after walking over (gesturing). */
  talking: boolean;
  /** World-space point the head glances at, or null. */
  look: Vector3 | null;
  /** Date.now() of the last celebration, 0 if none. */
  celebrateAt: number;
}

export interface CharacterProps {
  look: AgentLook;
  status: AgentStatus;
  seed: number;
  motion: React.RefObject<Motion>;
  onClick?: () => void;
  children?: React.ReactNode;
}

const tmp = new Vector3();
const HIP = 0.6;

type Joint = Group | null;
const approach = (cur: number, target: number, k: number) => cur + (target - cur) * k;

/**
 * A chibi agent with jointed legs (hip/knee) and arms (shoulder/elbow), so it
 * can sit at its desk, type, stand up, walk over, wave and cheer.
 */
export function Character({ look, status, seed, motion, onClick, children }: CharacterProps) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const brows = useRef<Group>(null);
  const hips = useRef<Joint[]>([null, null]);
  const knees = useRef<Joint[]>([null, null]);
  const shoulders = useRef<Joint[]>([null, null]);
  const elbows = useRef<Joint[]>([null, null]);
  const sit = useRef(1); // 1 = seated, 0 = standing (smoothed)

  const shortSleeves = look.hairStyle === "curly" || look.hairStyle === "bun" || look.hairStyle === "fluffy";

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + seed * 1.7;
    const m = motion.current;
    const k = Math.min(1, dt * 8);
    sit.current = approach(sit.current, m.seated ? 1 : 0, Math.min(1, dt * 5));
    const seated = sit.current;
    const walking = m.walking;
    const working = status === "working";
    const sinceCheer = (Date.now() - m.celebrateAt) / 1000;
    const cheering = sinceCheer >= 0 && sinceCheer < 1.6;

    // body bob
    if (body.current) {
      let y = Math.sin(t * 2) * 0.008;
      if (walking) y += Math.abs(Math.sin(t * 9)) * 0.04;
      if (cheering) y += Math.max(0, Math.sin(sinceCheer * Math.PI * 2.5)) * 0.3 * (1 - sinceCheer / 1.6) * (1 - seated * 0.5);
      body.current.position.y = y;
    }
    if (torso.current) {
      // lean in to type, lean back to relax
      const lean = seated * (working ? 0.12 : status === "idle" ? -0.08 : 0) + (walking ? 0.06 : 0);
      torso.current.rotation.x = approach(torso.current.rotation.x, lean, k);
    }

    // legs: hip/knee angles blend between sitting and standing; walking swings them
    const swing = walking ? Math.sin(t * 9) : 0;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const hip = hips.current[i];
      const knee = knees.current[i];
      const tap = seated > 0.5 && working ? Math.max(0, Math.sin(t * 3 + i * 2)) * 0.06 : 0;
      if (hip) hip.rotation.x = approach(hip.rotation.x, -Math.PI / 2 * seated + swing * s * 0.6 * (1 - seated), k);
      if (knee) knee.rotation.x = approach(knee.rotation.x, (Math.PI / 2) * seated + (walking ? Math.max(0, -swing * s) * 0.9 : 0) - tap, k);
    }

    // blink every few seconds; raise brows when waiting on the human
    if (eyes.current) eyes.current.scale.y = (t * 0.31 + seed * 0.13) % 1 > 0.965 ? 0.1 : 1;
    if (brows.current) brows.current.position.y = approach(brows.current.position.y, status === "needs_you" ? 0.03 : 0, k);

    if (head.current && root.current) {
      let yaw = status === "needs_you" ? 0.55 + Math.sin(t * 1.4) * 0.15 : Math.sin(t * 0.5) * 0.1;
      if (m.look && !walking && Math.sin(t * 0.45) > 0.2) {
        root.current.getWorldPosition(tmp);
        const world = Math.atan2(m.look.x - tmp.x, m.look.z - tmp.z);
        let rel = world - root.current.rotation.y;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        yaw = Math.max(-1, Math.min(1, rel));
      }
      head.current.rotation.y = approach(head.current.rotation.y, yaw, Math.min(1, dt * 4));
      head.current.rotation.z = Math.sin(t * 0.9) * 0.04;
      head.current.rotation.x = approach(head.current.rotation.x, working && seated > 0.5 ? 0.12 : Math.sin(t * 0.7) * 0.04, k);
    }

    // arms: [shoulderX, shoulderZ(outward), elbowX] per side
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1; // +1 = right (+x)
      let sx = 0.05;
      let sz = 0.12;
      let ex = -0.2;
      if (cheering) {
        sx = 0;
        sz = 2.6 + Math.sin(t * 14) * 0.2;
        ex = -0.3;
      } else if (walking) {
        sx = -swing * s * 0.55;
        ex = -0.45;
      } else if (m.talking && s === 1) {
        sx = -1.1 + Math.sin(t * 2.4) * 0.2;
        sz = 0.2;
        ex = -0.5 + Math.sin(t * 3.1) * 0.25;
      } else if (status === "needs_you" && s === 1) {
        sx = -0.2;
        sz = 2.5;
        ex = -0.6 + Math.sin(t * 8) * 0.45;
      } else if (seated > 0.5 && working) {
        sx = -0.45;
        sz = 0.18;
        ex = -1.15 + Math.sin(t * 15 + i * 1.7) * 0.07;
      } else if (seated > 0.5) {
        sx = -0.25;
        sz = 0.2;
        ex = -1.0 + Math.sin(t * 1.2 + i) * 0.03;
      }
      const sh = shoulders.current[i];
      const el = elbows.current[i];
      if (sh) {
        sh.rotation.x = approach(sh.rotation.x, sx, k);
        sh.rotation.z = approach(sh.rotation.z, sz * s, k);
      }
      if (el) el.rotation.x = approach(el.rotation.x, ex, k);
    }
  });

  return (
    <group ref={root}>
      <group
        ref={body}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        {/* pelvis */}
        <mesh position={[0, HIP + 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.17, 0.2, 8, 16]} />
          <Mat color={look.pants} />
        </mesh>

        {/* legs: hip joint → thigh → knee joint → shin → shoe */}
        {[1, -1].map((s, i) => (
          <group key={s} ref={(el) => { hips.current[i] = el; }} position={[s * 0.13, HIP, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <capsuleGeometry args={[0.105, 0.2, 6, 14]} />
              <Mat color={look.pants} />
            </mesh>
            <group ref={(el) => { knees.current[i] = el; }} position={[0, -0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh position={[0, -0.12, 0]} castShadow>
                <capsuleGeometry args={[0.09, 0.17, 6, 14]} />
                <Mat color={look.pants} />
              </mesh>
              <group position={[0, -0.255, 0.05]}>
                <mesh scale={[0.115, 0.075, 0.17]} castShadow>
                  <sphereGeometry args={[1, 16, 12]} />
                  <Mat color="#3a3434" rough={0.45} />
                </mesh>
                <mesh position={[0, -0.04, 0]}>
                  <boxGeometry args={[0.2, 0.025, 0.3]} />
                  <Mat color="#f2efe9" />
                </mesh>
              </group>
            </group>
          </group>
        ))}

        {/* torso (pivots at the hips to lean) */}
        <group ref={torso} position={[0, HIP + 0.05, 0]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <capsuleGeometry args={[0.255, 0.28, 10, 22]} />
            <Mat color={look.shirt} />
          </mesh>
          {/* belt */}
          <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.235, 0.03, 8, 28]} />
            <Mat color={look.pants} />
          </mesh>
          {/* inner tee / front panel */}
          <mesh position={[0, 0.36, 0.2]} scale={[1, 1.35, 0.45]}>
            <sphereGeometry args={[0.12, 16, 12]} />
            <Mat color={look.accent} />
          </mesh>
          {/* collar */}
          <mesh position={[0, 0.555, 0]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
            <torusGeometry args={[0.13, 0.04, 8, 24]} />
            <Mat color={look.shirt} rough={0.5} />
          </mesh>
          {/* neck */}
          <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.075, 0.08, 0.12, 14]} />
            <Mat color={look.skin} />
          </mesh>

          {/* arms: shoulder joint → upper arm → elbow joint → forearm → hand */}
          {[1, -1].map((s, i) => (
            <group key={s} ref={(el) => { shoulders.current[i] = el; }} position={[s * 0.3, 0.5, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[0.09, 14, 12]} />
                <Mat color={look.shirt} />
              </mesh>
              <mesh position={[0, -0.13, 0]} castShadow>
                <capsuleGeometry args={[0.078, 0.15, 6, 12]} />
                <Mat color={look.shirt} />
              </mesh>
              <group ref={(el) => { elbows.current[i] = el; }} position={[0, -0.26, 0]}>
                <mesh position={[0, -0.1, 0]} castShadow>
                  <capsuleGeometry args={[0.068, 0.13, 6, 12]} />
                  <Mat color={shortSleeves ? look.skin : look.shirt} />
                </mesh>
                <mesh position={[0, -0.22, 0.01]} castShadow>
                  <sphereGeometry args={[0.078, 14, 12]} />
                  <Mat color={look.skin} />
                </mesh>
              </group>
            </group>
          ))}

          <group ref={head} position={[0, 1.04, 0]}>
            <Head look={look} eyesRef={eyes} browsRef={brows} />
          </group>
        </group>
      </group>
      {children}
    </group>
  );
}
