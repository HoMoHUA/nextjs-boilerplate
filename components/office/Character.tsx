"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { AgentLook, AgentStatus, HairStyle, Pose } from "@/lib/types";

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

function Head({ look }: { look: AgentLook }) {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.46, 32, 24]} />
        <Mat color={look.skin} rough={0.55} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.45, -0.02, 0]}>
            <sphereGeometry args={[0.09, 12, 10]} />
            <Mat color={look.skin} />
          </mesh>
          {/* eyes */}
          <mesh position={[s * 0.15, 0.0, 0.42]}>
            <sphereGeometry args={[0.055, 14, 12]} />
            <meshStandardMaterial color="#221a17" roughness={0.2} />
          </mesh>
          <mesh position={[s * 0.15 + 0.018, 0.022, 0.468]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* cheeks */}
          <mesh position={[s * 0.26, -0.12, 0.35]} scale={[1, 0.6, 0.4]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color="#f29a8a" transparent opacity={0.55} />
          </mesh>
          {look.glasses && (
            <mesh position={[s * 0.15, 0.0, 0.47]}>
              <torusGeometry args={[0.1, 0.014, 8, 28]} />
              <meshStandardMaterial color="#e8e8ea" metalness={0.3} roughness={0.3} />
            </mesh>
          )}
        </group>
      ))}
      {look.glasses && (
        <mesh position={[0, 0.02, 0.5]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
          <meshStandardMaterial color="#e8e8ea" />
        </mesh>
      )}
      <mesh position={[0, -0.08, 0.455]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <Mat color={look.skin} />
      </mesh>
      <mesh position={[0, -0.19, 0.42]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.012, 0.06, 4, 8]} />
        <meshStandardMaterial color="#8c3b32" />
      </mesh>
      <Hair look={look} />
    </group>
  );
}

export interface CharacterProps {
  look: AgentLook;
  pose: Pose;
  status: AgentStatus;
  position: [number, number, number];
  rotation: number;
  seed: number;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function Character({ look, pose, status, position, rotation, seed, onClick, children }: CharacterProps) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);

  const seated = pose !== "stand";
  const hip = seated ? 0.62 : 0.62;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.7;
    const working = status === "working";
    if (body.current) body.current.position.y = Math.sin(t * 2) * 0.012 + (working ? Math.abs(Math.sin(t * 6)) * 0.02 : 0);
    if (head.current) {
      head.current.rotation.z = Math.sin(t * 0.9) * 0.05;
      head.current.rotation.x = pose === "type" || pose === "tablet" ? 0.15 : Math.sin(t * 0.7) * 0.04;
      head.current.rotation.y = status === "needs_you" ? Math.sin(t * 1.4) * 0.25 + 0.2 : Math.sin(t * 0.5) * 0.08;
    }
    if (armL.current && armR.current) {
      if (pose === "type") {
        armL.current.rotation.set(-1.25 + Math.sin(t * (working ? 16 : 5)) * 0.08, 0, 0.12);
        armR.current.rotation.set(-1.25 + Math.cos(t * (working ? 16 : 5)) * 0.08, 0, -0.12);
      } else if (pose === "tablet") {
        armL.current.rotation.set(-0.95, 0, 0.35);
        armR.current.rotation.set(-0.95 + Math.sin(t * 3) * (working ? 0.1 : 0.02), 0, -0.35);
      } else if (pose === "stand") {
        // presenting gesture
        armL.current.rotation.set(Math.sin(t * 1.1) * 0.05, 0, 0.18);
        armR.current.rotation.set(-0.5 + Math.sin(t * 1.6) * 0.25, 0, -0.6 + Math.sin(t * 1.6) * 0.15);
      } else {
        armL.current.rotation.set(-0.55 + Math.sin(t * 1.2) * 0.04, 0, 0.12);
        armR.current.rotation.set(-0.55 + Math.cos(t * 1.2) * 0.04, 0, -0.12);
      }
    }
  });

  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]}>
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
        {/* legs */}
        {[-1, 1].map((s) =>
          seated ? (
            <group key={s}>
              <mesh position={[s * 0.13, hip, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <capsuleGeometry args={[0.12, 0.32, 6, 12]} />
                <Mat color={look.pants} />
              </mesh>
              <mesh position={[s * 0.13, 0.33, 0.42]} castShadow>
                <capsuleGeometry args={[0.1, 0.3, 6, 12]} />
                <Mat color={look.pants} />
              </mesh>
              <mesh position={[s * 0.13, 0.07, 0.5]} castShadow>
                <boxGeometry args={[0.18, 0.12, 0.3]} />
                <Mat color="#3a3434" />
              </mesh>
            </group>
          ) : (
            <group key={s}>
              <mesh position={[s * 0.13, 0.38, 0]} castShadow>
                <capsuleGeometry args={[0.11, 0.4, 6, 12]} />
                <Mat color={look.pants} />
              </mesh>
              <mesh position={[s * 0.13, 0.07, 0.06]} castShadow>
                <boxGeometry args={[0.18, 0.12, 0.3]} />
                <Mat color="#3a3434" />
              </mesh>
            </group>
          ),
        )}

        {/* torso */}
        <mesh position={[0, hip + 0.32, 0]} castShadow>
          <capsuleGeometry args={[0.27, 0.32, 8, 20]} />
          <Mat color={look.shirt} />
        </mesh>
        <mesh position={[0, hip + 0.42, 0.2]} scale={[1, 1.2, 0.5]}>
          <sphereGeometry args={[0.14, 14, 12]} />
          <Mat color={look.accent} />
        </mesh>

        {/* arms */}
        {[
          [-1, armL],
          [1, armR],
        ].map(([s, ref]) => (
          <group key={s as number} ref={ref as React.RefObject<Group>} position={[(s as number) * 0.33, hip + 0.55, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.3, 6, 12]} />
              <Mat color={look.shirt} />
            </mesh>
            <mesh position={[0, -0.42, 0]} castShadow>
              <sphereGeometry args={[0.085, 12, 10]} />
              <Mat color={look.skin} />
            </mesh>
          </group>
        ))}

        <group ref={head} position={[0, hip + 1.1, 0]}>
          <Head look={look} />
        </group>

        {pose === "tablet" && (
          <mesh position={[0, hip + 0.35, 0.45]} rotation={[-0.9, 0, 0]} castShadow>
            <boxGeometry args={[0.5, 0.36, 0.03]} />
            <meshStandardMaterial color="#d9dde6" roughness={0.3} />
          </mesh>
        )}
      </group>
      {children}
    </group>
  );
}
