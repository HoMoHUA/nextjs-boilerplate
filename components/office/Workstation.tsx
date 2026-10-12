"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, type MeshStandardMaterial } from "three";
import { Mug } from "./Furniture";

/**
 * A personal workstation, in the same local units as a Character (which sits
 * at the origin facing +z): desk, office chair, monitor(s), keyboard, desk
 * mat in the owner's color and a couple of personal items.
 */

type V3 = [number, number, number];
const WHITE = "#f7f4ef";
const FRAME = "#e4e6ea";
const WOOD = "#e9d6bb";
const DARK = "#2a2c33";

const M = ({ c, r = 0.55, m = 0 }: { c: string; r?: number; m?: number }) => <meshStandardMaterial color={c} roughness={r} metalness={m} />;

/** Lighter, desaturated version of a color for cushions and mats. */
export function soft(color: string, k = 0.55) {
  return "#" + new Color(color).lerp(new Color("#ffffff"), k).getHexString();
}

function codeTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1f2128";
  g.fillRect(0, 0, 256, 512);
  const colors = ["#6f8cff", "#4a4e5a", "#4a4e5a", "#8fd19e", "#4a4e5a", "#f0b86e", "#c792ea"];
  for (let i = 0; i < 32; i++) {
    g.fillStyle = colors[(i * 7 + seed) % colors.length];
    g.fillRect(14 + ((i * 13 + seed * 7) % 44), 10 + i * 15.6, 36 + ((i * 37 + seed * 11) % 150), 6);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1, 0.34);
  return t;
}

function keyboardTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 80;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4f4f6";
  g.fillRect(0, 0, 256, 80);
  g.fillStyle = "#dcdde2";
  for (let r = 0; r < 4; r++)
    for (let k = 0; k < 14; k++) {
      const w = r === 3 && k > 3 && k < 9 ? 0 : 14;
      if (w) g.fillRect(6 + k * 17.6, 6 + r * 18, w, 13);
    }
  g.fillRect(6 + 4 * 17.6, 6 + 3 * 18, 5 * 17.6 - 4, 13);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Monitor facing -z (toward the person sitting at the desk). The screen scrolls code while `active`. */
export function DeskMonitor({ position, rotation = 0, seed, on, active, width = 0.74 }: { position: V3; rotation?: number; seed: number; on: boolean; active: boolean; width?: number }) {
  const tex = useMemo(() => codeTexture(seed), [seed]);
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    const mm = mat.current;
    if (!mm) return;
    if (mm.map && active) mm.map.offset.y = (mm.map.offset.y + dt * 0.12) % 1;
    mm.emissiveIntensity = mm.emissiveIntensity + ((on ? (active ? 0.6 : 0.28) : 0) - mm.emissiveIntensity) * Math.min(1, dt * 3);
  });
  const h = width * 0.58;
  return (
    <group position={position} rotation={[0, Math.PI + rotation, 0]}>
      <RoundedBox args={[0.28, 0.02, 0.2]} radius={0.008} position={[0, 0.01, -0.02]} castShadow>
        <M c={FRAME} r={0.35} m={0.2} />
      </RoundedBox>
      <mesh position={[0, 0.17, -0.06]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[0.05, 0.32, 0.025]} />
        <M c={FRAME} r={0.35} m={0.2} />
      </mesh>
      <group position={[0, 0.2 + h / 2, 0]}>
        <RoundedBox args={[width, h, 0.035]} radius={0.012} castShadow>
          <M c={DARK} r={0.35} />
        </RoundedBox>
        {/* back housing seen from the camera */}
        <RoundedBox args={[width * 0.6, h * 0.6, 0.04]} radius={0.015} position={[0, -0.01, -0.03]}>
          <M c="#f1f2f4" r={0.4} />
        </RoundedBox>
        <mesh position={[0, 0, 0.0185]}>
          <planeGeometry args={[width - 0.04, h - 0.04]} />
          <meshStandardMaterial ref={mat} color={on ? "#ffffff" : "#26272d"} map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

/** Office chair (local units, seat top ≈ 0.46). `cushion` tints the seat and back. */
export function OfficeChair({ position = [0, 0, 0], rotation = 0, cushion = "#eceae6", executive = false }: { position?: V3; rotation?: number; cushion?: string; executive?: boolean }) {
  const backH = executive ? 0.78 : 0.56;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* star base with casters */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        return (
          <group key={i} rotation={[0, -a, 0]}>
            <mesh position={[0.15, 0.06, 0]} rotation={[0, 0, 0.12]} castShadow>
              <boxGeometry args={[0.3, 0.035, 0.05]} />
              <M c="#cfd2d8" r={0.3} m={0.4} />
            </mesh>
            <mesh position={[0.29, 0.03, 0]}>
              <sphereGeometry args={[0.032, 10, 8]} />
              <M c={DARK} r={0.4} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.028, 0.035, 0.32, 12]} />
        <M c="#cfd2d8" r={0.25} m={0.5} />
      </mesh>
      {/* seat */}
      <RoundedBox args={[0.56, 0.06, 0.52]} radius={0.025} position={[0, 0.37, -0.02]} castShadow>
        <M c={FRAME} r={0.5} />
      </RoundedBox>
      <RoundedBox args={[0.54, 0.07, 0.5]} radius={0.035} position={[0, 0.42, -0.02]} castShadow receiveShadow>
        <M c={cushion} r={0.85} />
      </RoundedBox>
      {/* backrest */}
      <group position={[0, 0.42, -0.3]} rotation={[-0.12, 0, 0]}>
        <mesh position={[0, 0.12, -0.02]}>
          <boxGeometry args={[0.05, 0.26, 0.04]} />
          <M c="#cfd2d8" r={0.3} m={0.4} />
        </mesh>
        <RoundedBox args={[0.52, backH, 0.07]} radius={0.04} position={[0, 0.2 + backH / 2, 0]} castShadow>
          <M c={FRAME} r={0.5} />
        </RoundedBox>
        <RoundedBox args={[0.46, backH - 0.08, 0.05]} radius={0.03} position={[0, 0.2 + backH / 2, 0.04]}>
          <M c={cushion} r={0.85} />
        </RoundedBox>
      </group>
      {/* armrests */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.3, 0.42, -0.04]}>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.035, 0.2, 0.035]} />
            <M c="#cfd2d8" r={0.3} m={0.4} />
          </mesh>
          <RoundedBox args={[0.07, 0.035, 0.3]} radius={0.015} position={[0, 0.215, 0.02]} castShadow>
            <M c={DARK} r={0.6} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

function PersonalItem({ kind, position, color }: { kind: number; position: V3; color: string }) {
  switch (kind % 5) {
    case 0: // succulent
      return (
        <group position={position}>
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.05, 0.1, 16]} />
            <M c={color} r={0.5} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.3) * 0.03, 0.13, Math.sin(i * 1.3) * 0.03]} rotation={[Math.sin(i) * 0.5, i, Math.cos(i) * 0.5]} scale={[0.025, 0.06, 0.025]}>
              <sphereGeometry args={[1, 8, 6]} />
              <M c="#6aa77a" r={0.7} />
            </mesh>
          ))}
        </group>
      );
    case 1: // photo frame
      return (
        <group position={position} rotation={[0, 0.5, 0]}>
          <mesh position={[0, 0.08, 0]} rotation={[-0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.16, 0.13, 0.015]} />
            <M c={WHITE} />
          </mesh>
          <mesh position={[0, 0.08, -0.009]} rotation={[-0.2, Math.PI, 0]}>
            <planeGeometry args={[0.12, 0.09]} />
            <M c={soft(color, 0.2)} />
          </mesh>
        </group>
      );
    case 2: // books
      return (
        <group position={position} rotation={[0, 0.3, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.02 + i * 0.035, 0]} rotation={[0, i * 0.15, 0]} castShadow>
              <boxGeometry args={[0.22, 0.03, 0.16]} />
              <M c={[color, "#e9e4dc", "#cbd5e6"][i]} />
            </mesh>
          ))}
        </group>
      );
    case 3: // desk lamp
      return (
        <group position={position}>
          <mesh position={[0, 0.01, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 0.02, 16]} />
            <M c={WHITE} />
          </mesh>
          <mesh position={[0, 0.16, -0.02]} rotation={[0.25, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.3, 6]} />
            <M c={WHITE} />
          </mesh>
          <mesh position={[0, 0.3, 0.05]} rotation={[1.1, 0, 0]}>
            <coneGeometry args={[0.06, 0.09, 16, 1, true]} />
            <meshStandardMaterial color={WHITE} emissive="#fff2cf" emissiveIntensity={0.5} side={2} />
          </mesh>
        </group>
      );
    default: // pen cup + sticky notes
      return (
        <group position={position}>
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.1, 12]} />
            <M c={color} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[(i - 1) * 0.015, 0.12, 0]} rotation={[0, 0, (i - 1) * 0.2]}>
              <cylinderGeometry args={[0.006, 0.006, 0.12, 6]} />
              <M c={["#4f7cf5", "#ef6b8a", DARK][i]} />
            </mesh>
          ))}
          <mesh position={[0.1, 0.005, 0.02]} rotation={[-Math.PI / 2, 0, 0.3]}>
            <planeGeometry args={[0.08, 0.08]} />
            <M c="#ffe58a" r={0.9} />
          </mesh>
        </group>
      );
  }
}

interface Props {
  seed: number;
  /** The owner's color (desk mat, chair cushion, items). Undefined = free desk. */
  color?: string;
  lead?: boolean;
  /** Monitor scrolls while the owner works. */
  active?: boolean;
}

export function Workstation({ seed, color, lead = false, active = false }: Props) {
  const kbd = useMemo(() => keyboardTexture(), []);
  const occupied = Boolean(color);
  const tint = color ?? "#d9d6d0";
  const w = lead ? 2.1 : 1.6;
  const top = 0.8;
  const dz = 0.64; // desk center
  return (
    <group>
      {/* desk */}
      <RoundedBox args={[w, 0.045, 0.74]} radius={0.018} position={[0, top, dz]} castShadow receiveShadow>
        <M c={WOOD} r={0.55} />
      </RoundedBox>
      {/* frame legs */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 - 0.08), 0, dz]}>
          <mesh position={[0, top / 2, 0]} castShadow>
            <boxGeometry args={[0.05, top - 0.02, 0.05]} />
            <M c={FRAME} r={0.35} m={0.3} />
          </mesh>
          <RoundedBox args={[0.07, 0.03, 0.66]} radius={0.012} position={[0, 0.015, 0]}>
            <M c={FRAME} r={0.35} m={0.3} />
          </RoundedBox>
        </group>
      ))}
      <mesh position={[0, top - 0.09, dz + 0.3]}>
        <boxGeometry args={[w - 0.2, 0.12, 0.02]} />
        <M c={FRAME} r={0.4} m={0.2} />
      </mesh>
      {/* drawer pedestal */}
      <group position={[w / 2 - 0.3, 0, dz + 0.04]}>
        <RoundedBox args={[0.38, 0.62, 0.6]} radius={0.03} position={[0, 0.33, 0]} castShadow receiveShadow>
          <M c={WHITE} />
        </RoundedBox>
        {[0.2, 0.4, 0.56].map((y) => (
          <mesh key={y} position={[0, y, -0.305]}>
            <boxGeometry args={[0.14, 0.02, 0.01]} />
            <M c="#c9ccd3" r={0.3} m={0.4} />
          </mesh>
        ))}
      </group>

      {/* desk mat, keyboard, mouse */}
      <RoundedBox args={[0.9, 0.008, 0.36]} radius={0.004} position={[0.08, top + 0.026, 0.48]} receiveShadow>
        <M c={soft(tint, occupied ? 0.45 : 0.75)} r={0.95} />
      </RoundedBox>
      <group position={[-0.02, top + 0.04, 0.44]}>
        <RoundedBox args={[0.5, 0.025, 0.16]} radius={0.01} castShadow>
          <M c="#f4f4f6" r={0.4} />
        </RoundedBox>
        <mesh position={[0, 0.0135, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.48, 0.14]} />
          <meshStandardMaterial map={kbd} roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[0.4, top + 0.045, 0.46]} scale={[0.045, 0.025, 0.07]}>
        <sphereGeometry args={[1, 14, 10]} />
        <M c="#f4f4f6" r={0.4} />
      </mesh>

      {/* monitors */}
      {lead ? (
        <>
          <DeskMonitor position={[-0.42, top + 0.02, 0.86]} rotation={-0.22} seed={seed} on={occupied} active={active} />
          <DeskMonitor position={[0.42, top + 0.02, 0.86]} rotation={0.22} seed={seed + 3} on={occupied} active={active} />
        </>
      ) : (
        <DeskMonitor position={[0, top + 0.02, 0.86]} seed={seed} on={occupied} active={active} />
      )}

      {/* personal items */}
      {occupied && (
        <>
          <Mug position={[0.58, top + 0.02, 0.62]} />
          <PersonalItem kind={seed} position={[-w / 2 + 0.2, top + 0.025, 0.78]} color={tint} />
          {lead && <PersonalItem kind={seed + 2} position={[w / 2 - 0.22, top + 0.025, 0.9]} color={tint} />}
        </>
      )}

      {/* chair: pulled out for its owner, tucked in when the desk is free */}
      <OfficeChair position={occupied ? [0, 0, -0.02] : [0, 0, 0.2]} rotation={occupied ? 0 : 0.15} cushion={occupied ? soft(tint, 0.3) : "#eceae6"} executive={lead} />
    </group>
  );
}

/** Small coffee corner: counter, machine and cups. */
export function CoffeeStation({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.6, 1.0, 0.75]} radius={0.05} position={[0, 0.5, 0]} castShadow receiveShadow>
        <M c={WHITE} />
      </RoundedBox>
      <RoundedBox args={[1.66, 0.05, 0.8]} radius={0.02} position={[0, 1.02, 0]} castShadow>
        <M c={WOOD} />
      </RoundedBox>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.55, 0.38]}>
          <boxGeometry args={[0.02, 0.6, 0.01]} />
          <M c="#d9dbe0" />
        </mesh>
      ))}
      {/* espresso machine */}
      <group position={[-0.35, 1.05, -0.05]}>
        <RoundedBox args={[0.5, 0.55, 0.42]} radius={0.05} position={[0, 0.275, 0]} castShadow>
          <M c="#3a3c44" r={0.35} m={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.42, 0.212]}>
          <planeGeometry args={[0.36, 0.1]} />
          <meshStandardMaterial color="#1a1b20" emissive="#7cc4ff" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 0.2, 0.24]}>
          <cylinderGeometry args={[0.03, 0.03, 0.08, 10]} />
          <M c="#cfd2d8" m={0.6} r={0.25} />
        </mesh>
      </group>
      <Mug position={[-0.3, 1.05, 0.25]} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0.3 + i * 0.16, 1.1, 0.05]} castShadow>
          <cylinderGeometry args={[0.06, 0.05, 0.12, 14]} />
          <M c={["#f4f1ea", "#cbd5e6", "#f08a6c"][i]} />
        </mesh>
      ))}
    </group>
  );
}
