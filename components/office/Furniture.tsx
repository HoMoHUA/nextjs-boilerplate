"use client";

import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace } from "three";

const WHITE = "#f7f4ef";
const WOOD = "#e8d6bc";
const GREY = "#cfd2d8";
const DARK = "#2d2f36";

type V3 = [number, number, number];

const M = ({ c, r = 0.55, m = 0 }: { c: string; r?: number; m?: number }) => (
  <meshStandardMaterial color={c} roughness={r} metalness={m} />
);

function makeChartTexture() {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 400;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fbfcff";
  g.fillRect(0, 0, 640, 400);
  g.fillStyle = "#e3e8f3";
  for (let i = 0; i < 4; i++) g.fillRect(36, 40 + i * 22, 180 - i * 30, 9);
  // bars
  const bars = [60, 95, 80, 140, 120, 175];
  bars.forEach((h, i) => {
    g.fillStyle = i % 2 ? "#4f7cf5" : "#9db6fb";
    g.fillRect(40 + i * 34, 360 - h, 22, h);
  });
  // line chart
  g.strokeStyle = "#4f7cf5";
  g.lineWidth = 5;
  g.beginPath();
  [190, 230, 210, 260, 235, 280, 300].forEach((y, i) => g[i ? "lineTo" : "moveTo"](300 + i * 46, 560 - y));
  g.stroke();
  g.strokeStyle = "#c4cfe6";
  g.lineWidth = 2;
  g.strokeRect(290, 220, 310, 150);
  // pie
  g.fillStyle = "#cfdcfc";
  g.beginPath();
  g.arc(470, 110, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#4f7cf5";
  g.beginPath();
  g.moveTo(470, 110);
  g.arc(470, 110, 70, -Math.PI / 2, Math.PI * 0.35);
  g.closePath();
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function makeScreenTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#24262d";
  g.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = (i + seed) % 3 === 0 ? "#6f8cff" : "#4a4e5a";
    g.fillRect(16 + ((i * 13 + seed * 7) % 30), 16 + i * 15, 60 + ((i * 37 + seed * 11) % 140), 6);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function Floor({ color }: { color: string }) {
  return (
    <group>
      <RoundedBox args={[15.5, 1.1, 12.5]} radius={0.5} smoothness={4} position={[0, -0.55, 0]} receiveShadow>
        <M c={color} r={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14.6, 11.6]} />
        <M c={color} r={0.95} />
      </mesh>
    </group>
  );
}

export function Whiteboard({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const tex = useMemo(() => makeChartTexture(), []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.4, 0.12, 0.9]} radius={0.05} position={[0, 0.06, 0]} castShadow receiveShadow>
        <M c={WHITE} />
      </RoundedBox>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.16, 1.7, 0.16]} />
        <M c={WHITE} />
      </mesh>
      <RoundedBox args={[3.6, 2.3, 0.14]} radius={0.07} position={[0, 2.5, 0]} castShadow>
        <M c={WHITE} />
      </RoundedBox>
      <mesh position={[0, 2.5, 0.075]}>
        <planeGeometry args={[3.35, 2.08]} />
        <meshStandardMaterial map={tex} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function Chair({ position, rotation = 0, color = WHITE }: { position: V3; rotation?: number; color?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.28, 0.06, Math.sin((i / 5) * Math.PI * 2) * 0.28]} rotation={[0, -(i / 5) * Math.PI * 2, 0]} castShadow>
          <boxGeometry args={[0.55, 0.05, 0.07]} />
          <M c={GREY} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
        <M c={GREY} m={0.4} r={0.3} />
      </mesh>
      <RoundedBox args={[0.78, 0.14, 0.72]} radius={0.06} position={[0, 0.56, 0]} castShadow receiveShadow>
        <M c={color} />
      </RoundedBox>
      <RoundedBox args={[0.74, 0.85, 0.12]} radius={0.06} position={[0, 1.05, -0.36]} rotation={[-0.08, 0, 0]} castShadow>
        <M c={color} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.08, 0.06, 0.5]} radius={0.02} position={[s * 0.42, 0.85, -0.02]} castShadow>
          <M c={color} />
        </RoundedBox>
      ))}
    </group>
  );
}

export function Monitor({ position, rotation = 0, seed = 0, wide = 1 }: { position: V3; rotation?: number; seed?: number; wide?: number }) {
  const tex = useMemo(() => makeScreenTexture(seed), [seed]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.42, 0.04, 0.3]} radius={0.015} position={[0, 0.02, 0]} castShadow>
        <M c={DARK} />
      </RoundedBox>
      <mesh position={[0, 0.25, -0.05]}>
        <boxGeometry args={[0.07, 0.45, 0.05]} />
        <M c={DARK} />
      </mesh>
      <RoundedBox args={[1.25 * wide, 0.72, 0.06]} radius={0.02} position={[0, 0.65, 0]} castShadow>
        <M c={DARK} r={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.65, 0.032]}>
        <planeGeometry args={[1.17 * wide, 0.64]} />
        <meshStandardMaterial map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.25} roughness={0.25} />
      </mesh>
    </group>
  );
}

export function Desk({ position, rotation = 0, size = [2.6, 1.3] as [number, number] }: { position: V3; rotation?: number; size?: [number, number] }) {
  const [w, d] = size;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[w, 0.08, d]} radius={0.03} position={[0, 1.02, 0]} castShadow receiveShadow>
        <M c={WOOD} r={0.6} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.08, 1.0, d - 0.1]} radius={0.02} position={[s * (w / 2 - 0.1), 0.5, 0]} castShadow>
          <M c={WHITE} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.5, 0.75, d - 0.2]} radius={0.04} position={[w / 2 - 0.45, 0.4, 0]} castShadow>
        <M c={WHITE} />
      </RoundedBox>
      {/* keyboard + mouse */}
      <RoundedBox args={[0.7, 0.03, 0.22]} radius={0.01} position={[0, 1.075, d / 2 - 0.3]}>
        <M c="#f2f2f2" />
      </RoundedBox>
      <mesh position={[0.5, 1.08, d / 2 - 0.3]} scale={[1, 0.5, 1.4]}>
        <sphereGeometry args={[0.06, 12, 10]} />
        <M c="#f2f2f2" />
      </mesh>
    </group>
  );
}

export function RoundTable({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.65, 0.7, 0.06, 32]} />
        <M c={WOOD} />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.38, 0.85, 32]} />
        <M c={WOOD} />
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, 0.12, 48]} />
        <M c={WOOD} r={0.6} />
      </mesh>
      {/* conference speaker */}
      <group position={[0.1, 0.98, 0.15]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.24, 0.12, 24]} />
          <M c={WHITE} />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow>
          <sphereGeometry args={[0.16, 20, 16]} />
          <M c="#e9e9ec" r={0.3} />
        </mesh>
        <mesh position={[0, 0.25, 0.14]}>
          <sphereGeometry args={[0.07, 14, 12]} />
          <M c={DARK} r={0.2} />
        </mesh>
      </group>
    </group>
  );
}

export function Bookshelf({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const books = [
    ["#e8e4dc", 0.12],
    ["#d9d2c5", 0.1],
    ["#f4f1ea", 0.14],
    ["#cbd5e6", 0.11],
  ] as const;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[3.2, 1.4, 0.9]} radius={0.08} position={[0, 0.7, 0]} castShadow receiveShadow>
        <M c={WHITE} />
      </RoundedBox>
      {[0.42, 0.98].map((y) => (
        <mesh key={y} position={[0.4, y, 0.2]}>
          <boxGeometry args={[2.1, 0.42, 0.55]} />
          <M c="#e9e4dc" r={0.9} />
        </mesh>
      ))}
      {books.map(([c, w], i) => (
        <mesh key={i} position={[-0.3 + i * 0.16, 1.02, 0.25]} rotation={[0, 0, i === 3 ? 0.3 : 0]} castShadow>
          <boxGeometry args={[w, 0.36, 0.42]} />
          <M c={c} />
        </mesh>
      ))}
      {books.map(([c, w], i) => (
        <mesh key={`b${i}`} position={[0.6 + i * 0.15, 0.46, 0.25]} castShadow>
          <boxGeometry args={[w, 0.36, 0.42]} />
          <M c={c} />
        </mesh>
      ))}
      {/* vase */}
      <mesh position={[-1.1, 1.55, 0]} castShadow>
        <torusGeometry args={[0.17, 0.07, 14, 28]} />
        <M c={WHITE} r={0.3} />
      </mesh>
      {/* laptop on top */}
      <group position={[0.6, 1.42, 0]} rotation={[0, -0.3, 0]}>
        <RoundedBox args={[0.9, 0.04, 0.6]} radius={0.015} castShadow>
          <M c={GREY} m={0.3} r={0.35} />
        </RoundedBox>
      </group>
    </group>
  );
}

export function Armchair({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.2, 0.5, 1.1]} radius={0.15} position={[0, 0.3, 0]} castShadow receiveShadow>
        <M c={WHITE} />
      </RoundedBox>
      <RoundedBox args={[1.2, 0.9, 0.25]} radius={0.12} position={[0, 0.85, -0.45]} castShadow>
        <M c={WHITE} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.22, 0.45, 1.05]} radius={0.1} position={[s * 0.55, 0.7, 0]} castShadow>
          <M c={WHITE} />
        </RoundedBox>
      ))}
    </group>
  );
}

export function SideCabinet({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.0, 1.0, 0.8]} radius={0.08} position={[0, 0.5, 0]} castShadow receiveShadow>
        <M c={WOOD} />
      </RoundedBox>
      <mesh position={[0, 0.55, 0.41]}>
        <boxGeometry args={[0.8, 0.02, 0.01]} />
        <M c="#cdb89a" />
      </mesh>
      {/* lamp */}
      <mesh position={[-0.25, 1.05, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.06, 20]} />
        <M c={WHITE} />
      </mesh>
      <mesh position={[-0.25, 1.55, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.0, 8]} />
        <M c={WHITE} />
      </mesh>
      <mesh position={[-0.05, 2.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
        <M c={WHITE} />
      </mesh>
      <mesh position={[0.15, 1.97, 0]}>
        <coneGeometry args={[0.13, 0.16, 20, 1, true]} />
        <meshStandardMaterial color={WHITE} emissive="#fff3d6" emissiveIntensity={0.4} side={2} />
      </mesh>
      {/* small device */}
      <RoundedBox args={[0.3, 0.12, 0.25]} radius={0.03} position={[0.25, 1.07, 0.1]} castShadow>
        <M c="#f2f2f2" />
      </RoundedBox>
    </group>
  );
}

export function Cabinet({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.2, 0.95, 0.75]} radius={0.06} position={[0, 0.475, 0]} castShadow receiveShadow>
        <M c={WHITE} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.3, 0.4]} radius={0.04} position={[-0.2, 1.1, 0]} castShadow>
        <M c="#ececec" />
      </RoundedBox>
    </group>
  );
}
