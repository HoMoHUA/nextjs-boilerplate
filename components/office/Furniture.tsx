"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type MeshStandardMaterial } from "three";
import { FurnitureAsset } from "./studio/FurnitureAsset";
import { Cable, Fabric, Oak, OakTop, Rod, Surface, type V3 } from "./studio/FurnitureSurfaces";

const METAL = "#424a3e";

function makeChartTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 640;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#eee9dc"; ctx.fillRect(0, 0, 1024, 640);
  ctx.fillStyle = "#3e5144"; ctx.font = "500 36px sans-serif"; ctx.fillText("STUDIO / PROJECT NOTES", 55, 72);
  ctx.fillStyle = "#8c907c"; ctx.font = "19px sans-serif"; ctx.fillText("Ideas in progress, made together.", 56, 110);
  ctx.strokeStyle = "#d0d1c1"; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(60, 250 + i * 60); ctx.lineTo(480, 250 + i * 60); ctx.stroke(); }
  const bars = [130, 175, 165, 245, 270, 320];
  bars.forEach((height, i) => { ctx.fillStyle = i % 2 ? "#a6b198" : "#687f68"; ctx.fillRect(75 + i * 65, 540 - height, 40, height); });
  ctx.fillStyle = "#b3ac8c"; ctx.font = "20px sans-serif"; ctx.fillText("RESEARCH     DESIGN     BUILD", 78, 582);
  ctx.fillStyle = "#dcd8c7"; ctx.fillRect(570, 176, 370, 345);
  ctx.strokeStyle = "#6f856c"; ctx.lineWidth = 5; ctx.beginPath();
  [[605, 440], [660, 402], [708, 415], [765, 340], [825, 315], [900, 245]].forEach(([x, y], i) => ctx[i ? "lineTo" : "moveTo"](x, y)); ctx.stroke();
  ctx.fillStyle = "#6d7d66"; ctx.font = "23px sans-serif"; ctx.fillText("Small steps. Better work.", 594, 580);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}

function makeScreenTexture(seed: number) {
  const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 512;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#29342f"; ctx.fillRect(0, 0, 640, 512);
  ctx.fillStyle = "#39453a"; ctx.fillRect(0, 0, 122, 512);
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = ["#a6b49d", "#c8b58e", "#8aa8a3"][(seed + i) % 3]; ctx.font = "14px monospace";
    ctx.fillText(["const studio = await create();", "  design: materials.refine(),", "  return context.progress;", "// Work, together."][(i + seed) % 4], 150 + i % 3 * 12, 28 + i * 22);
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Fallback export for isolated furniture previews; the room owns its parquet floor. */
export function Floor({ color }: { color: string }) {
  return <group><RoundedBox smoothness={2} bevelSegments={2} args={[15.5, 0.22, 12.5]} radius={0.05} position={[0, -0.11, 0]} receiveShadow><Oak color={color} /></RoundedBox></group>;
}

export function Whiteboard({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const texture = useMemo(() => makeChartTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={position} rotation={[0, rotation, 0]}>
    {[-1.34, 1.34].map((x) => <group key={x}>
      <Rod from={[x, 0.1, -0.3]} to={[x, 1.92, -0.06]} radius={0.028} />
      <Rod from={[x - 0.02, 0.07, -0.48]} to={[x + 0.02, 0.07, 0.48]} radius={0.035} />
      {[-0.4, 0.4].map((z) => <mesh key={z} position={[x, 0.055, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.055, 0.055, 0.035, 16]} /><Surface color="#333d32" /></mesh>)}
    </group>)}
    <RoundedBox smoothness={2} bevelSegments={2} args={[3.6, 2.3, 0.14]} radius={0.032} position={[0, 2.5, 0]} castShadow><Oak color="#a38b63" /></RoundedBox>
    <mesh position={[0, 2.5, 0.073]}><planeGeometry args={[3.43, 2.13]} /><meshStandardMaterial map={texture} roughness={0.74} /></mesh>
    <RoundedBox smoothness={2} bevelSegments={2} args={[1.55, 0.035, 0.13]} radius={0.012} position={[0, 1.355, 0.09]} castShadow><Surface color={METAL} metalness={0.6} /></RoundedBox>
    <Rod from={[-0.49, 1.39, 0.09]} to={[-0.21, 1.39, 0.09]} radius={0.018} color="#5c6c56" metalness={0} />
  </group>;
}

export function Chair({ position, rotation = 0, color = "#a1ac90" }: { position: V3; rotation?: number; color?: string }) {
  return <group position={position} rotation={[0, rotation, 0]} scale={1.38}><FurnitureAsset model="chair" fabricColor={color} /></group>;
}

export function Monitor({ position, rotation = 0, seed = 0, wide = 1, active = false }: { position: V3; rotation?: number; seed?: number; wide?: number; active?: boolean }) {
  const texture = useMemo(() => makeScreenTexture(seed), [seed]); const material = useRef<MeshStandardMaterial>(null);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((_, dt) => { if (material.current?.map && active) material.current.map.offset.y = (material.current.map.offset.y + dt * 0.035) % 1; });
  return <group position={position} rotation={[0, rotation, 0]}>
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.4, 0.025, 0.28]} radius={0.014} position={[0, 0.02, -0.02]} castShadow><Surface color={METAL} metalness={0.5} /></RoundedBox>
    <Rod from={[0, 0.025, -0.05]} to={[0, 0.52, -0.05]} radius={0.024} />
    <RoundedBox smoothness={2} bevelSegments={2} args={[1.25 * wide, 0.72, 0.043]} radius={0.014} position={[0, 0.65, 0]} castShadow><Surface color={METAL} roughness={0.34} /></RoundedBox>
    <mesh position={[0, 0.65, 0.023]}><planeGeometry args={[1.21 * wide, 0.674]} /><meshStandardMaterial ref={material} map={texture} emissiveMap={texture} emissive="#d7decc" emissiveIntensity={active ? 0.3 : 0.1} roughness={0.3} /></mesh>
  </group>;
}

export function Desk({ position, rotation = 0, size = [2.6, 1.3] as [number, number] }: { position: V3; rotation?: number; size?: [number, number] }) {
  const [width, depth] = size;
  return <group position={position} rotation={[0, rotation, 0]}>
    <OakTop width={width} depth={depth} thickness={0.065} position={[0, 1.02, 0]} grommets />
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Rod key={`${x}:${z}`} from={[x * (width / 2 - 0.12), 0.04, z * (depth / 2 - 0.12)]} to={[x * (width / 2 - 0.12), 0.98, z * (depth / 2 - 0.12)]} radius={0.032} />))}
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.5, 0.73, depth - 0.2]} radius={0.015} position={[width / 2 - 0.45, 0.4, 0]} castShadow><Oak color="#ab895b" /></RoundedBox>
    {[0.3, 0.55].map((y) => <RoundedBox smoothness={2} bevelSegments={2} key={y} args={[0.475, 0.011, 0.01]} radius={0.003} position={[width / 2 - 0.45, y, depth / 2 - 0.092]}><Surface color="#5c5d47" /></RoundedBox>)}
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.7, 0.028, 0.22]} radius={0.008} position={[0, 1.075, depth / 2 - 0.3]}><Surface color="#65715f" /></RoundedBox>
    <mesh position={[0.5, 1.08, depth / 2 - 0.3]} scale={[0.06, 0.03, 0.085]}><sphereGeometry args={[1, 18, 12]} /><Surface color={METAL} /></mesh>
  </group>;
}

export function RoundTable({ position }: { position: V3 }) {
  return <group position={position}>
    <mesh position={[0, 0.918, 0]} castShadow receiveShadow><cylinderGeometry args={[1.48, 1.5, 0.105, 80]} /><Oak color="#c1a477" /></mesh>
    <mesh position={[0, 0.9711, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1.477, 80]} /><Oak color="#ccb084" /></mesh>
    {[0, 1, 2, 3].map((i) => {
      const angle = i * Math.PI / 2 + 0.3;
      return <Rod key={i} from={[Math.cos(angle) * 1.02, 0.035, Math.sin(angle) * 1.02]} to={[Math.cos(angle) * 0.75, 0.87, Math.sin(angle) * 0.75]} radius={0.041} />;
    })}
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.5, 0.025, 0.37]} radius={0.012} position={[0.08, 0.983, 0.16]} rotation={[0, 0.12, 0]}><Fabric color="#c2b69c" /></RoundedBox>
    <Plant position={[0.05, 0.996, 0.13]} scale={0.23} seed={3} />
    <Books position={[0.65, 0.978, 0.08]} scale={0.65} stacked />
  </group>;
}

const BOOK_COLORS = ["#6d7d63", "#d8cdb5", "#ad815d", "#d9d4c3", "#3c4f48"];

/** Separate page blocks, linen covers and spines give books a readable silhouette. */
export function Books({ position, scale = 1, stacked = false }: { position: V3; scale?: number; stacked?: boolean }) {
  return <group position={position} scale={scale}>
    {[0, 1, 2, 3, 4].map((i) => <group key={i} position={stacked ? [0, 0.025 + i * 0.065, 0] : [(i - 2) * 0.105, 0.2 + i % 2 * 0.025, 0]} rotation={stacked ? [0, i * 0.09, 0] : [0, 0, i === 4 ? -0.09 : 0]}>
      {[-1, 1].map((sign) => <mesh key={sign} position={stacked ? [0, sign * 0.027, 0] : [sign * 0.039, 0, 0]} castShadow><boxGeometry args={stacked ? [0.48 - i % 2 * 0.06, 0.006, 0.33] : [0.006, 0.4 + i % 2 * 0.05, 0.31]} /><Surface color={BOOK_COLORS[i]} roughness={0.9} /></mesh>)}
      <mesh position={stacked ? [0.008, 0, 0.005] : [0, 0, -0.005]}><boxGeometry args={stacked ? [0.45 - i % 2 * 0.06, 0.046, 0.31] : [0.071, 0.38 + i % 2 * 0.05, 0.29]} /><Surface color="#e1dbc8" roughness={1} /></mesh>
      <mesh position={stacked ? [0, 0, -0.162] : [0, 0, 0.159]}><boxGeometry args={stacked ? [0.48 - i % 2 * 0.06, 0.057, 0.012] : [0.083, 0.4 + i % 2 * 0.05, 0.014]} /><Surface color={BOOK_COLORS[i]} roughness={0.9} /></mesh>
      {!stacked && <mesh position={[0, 0.1, 0.167]}><planeGeometry args={[0.043, 0.013]} /><Surface color="#c9c4aa" /></mesh>}
    </group>)}
  </group>;
}

export function Bookshelf({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0.73, -0.413]} castShadow><boxGeometry args={[3.2, 1.35, 0.045]} /><Oak color="#90704c" /></mesh>
    {[0.1, 0.68, 1.37].map((y) => <RoundedBox smoothness={2} bevelSegments={2} key={y} args={[3.2, 0.064, 0.9]} radius={0.008} position={[0, y, 0]} castShadow receiveShadow><Oak color="#ad8e64" /></RoundedBox>)}
    {[-1.57, -0.52, 0.52, 1.57].map((x) => <mesh key={x} position={[x, 0.735, 0]} castShadow><boxGeometry args={[0.06, 1.3, 0.89]} /><Oak color="#ac8b60" /></mesh>)}
    <mesh position={[0, 0.045, 0]}><boxGeometry args={[3.06, 0.09, 0.76]} /><Surface color="#4b4b3a" /></mesh>
    <Books position={[-1.03, 0.14, 0.14]} scale={1.1} />
    <Books position={[0.04, 0.74, 0.13]} scale={1.1} />
    <Books position={[1.04, 0.14, 0.08]} scale={0.88} stacked />
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.72, 0.35, 0.59]} radius={0.016} position={[0.04, 0.32, 0.02]} castShadow><Fabric color="#a8a897" /></RoundedBox>
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.18, 0.035, 0.012]} radius={0.006} position={[0.04, 0.36, 0.325]}><Surface color="#6e745f" /></RoundedBox>
    <mesh position={[-1.03, 0.94, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[0.18, 0.072, 16, 36]} /><Surface color="#d2c8af" roughness={0.64} /></mesh>
    <Plant position={[1.07, 0.72, 0.02]} scale={0.27} seed={7} />
    <Plant position={[-1.03, 1.405, 0.02]} scale={0.37} seed={4} />
    <Books position={[0.61, 1.405, -0.02]} scale={0.94} stacked />
    <mesh position={[-0.13, 1.55, 0.03]} castShadow><cylinderGeometry args={[0.09, 0.14, 0.29, 32]} /><Surface color="#d9cbb2" roughness={0.6} /></mesh>
  </group>;
}

export function Armchair({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <FurnitureAsset model="lounge" />
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.39, 0.36, 0.125]} radius={0.06} position={[0.16, 0.77, -0.24]} rotation={[-0.1, -0.18, 0.19]} castShadow><Fabric color="#ab7756" /></RoundedBox>
  </group>;
}

/** Balanced metal arms, visible pivot joints and a hollow warm reflector. */
export function DeskLamp({ position, scale = 1 }: { position: V3; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh position={[0, 0.025, 0]} castShadow><cylinderGeometry args={[0.15, 0.16, 0.05, 32]} /><Surface color={METAL} metalness={0.65} roughness={0.33} /></mesh>
    <Rod from={[0, 0.05, 0]} to={[-0.1, 0.61, -0.08]} radius={0.018} />
    <Rod from={[-0.1, 0.61, -0.08]} to={[0.31, 0.91, 0.02]} radius={0.015} />
    <Rod from={[-0.057, 0.07, -0.01]} to={[-0.147, 0.6, -0.08]} radius={0.007} />
    <Cable points={[[0, 0.03, 0], [-0.13, 0.34, -0.08], [-0.12, 0.62, -0.1], [0.1, 0.85, 0], [0.32, 0.91, 0.02]]} radius={0.006} color="#2c352c" />
    {[[0, 0.07, 0], [-0.1, 0.61, -0.08], [0.31, 0.91, 0.02]].map((p, i) => <mesh key={i} position={p as V3} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.037, 0.037, 0.052, 20]} /><Surface color="#718066" metalness={0.6} /></mesh>)}
    <group position={[0.32, 0.89, 0.02]} rotation={[0, 0, -0.28]}>
      <mesh position={[0, -0.045, 0]} castShadow><cylinderGeometry args={[0.068, 0.15, 0.18, 32, 1, true]} /><meshStandardMaterial color="#6b755e" metalness={0.4} roughness={0.41} side={2} /></mesh>
      <mesh position={[0, -0.133, 0]} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[0.131, 0.15, 32]} /><Surface color="#c9ba8a" metalness={0.4} /></mesh>
      <mesh position={[0, -0.07, 0]}><sphereGeometry args={[0.035, 16, 10]} /><meshStandardMaterial color="#fff1ce" emissive="#ffdb8e" emissiveIntensity={1.25} roughness={0.4} /></mesh>
    </group>
  </group>;
}

export function SideCabinet({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <RoundedBox smoothness={2} bevelSegments={2} args={[1, 0.96, 0.8]} radius={0.013} position={[0, 0.52, 0]} castShadow><Oak color="#a98a60" /></RoundedBox>
    <mesh position={[0, 0.055, 0]}><boxGeometry args={[0.89, 0.11, 0.68]} /><Surface color="#4a4c3c" /></mesh>
    {[0.34, 0.78].map((y) => <RoundedBox smoothness={2} bevelSegments={2} key={y} args={[0.945, 0.418, 0.022]} radius={0.005} position={[0, y, 0.409]} castShadow><Oak color="#b6986a" /></RoundedBox>)}
    {[0.43, 0.87].map((y) => <Rod key={y} from={[-0.12, y, 0.433]} to={[0.12, y, 0.433]} radius={0.008} color={METAL} />)}
    <DeskLamp position={[-0.2, 1.015, -0.07]} scale={1.02} />
    <Books position={[0.22, 1.015, 0.16]} scale={0.5} stacked />
  </group>;
}

export function Cabinet({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <RoundedBox smoothness={2} bevelSegments={2} args={[1.2, 0.88, 0.75]} radius={0.012} position={[0, 0.51, 0]} castShadow><Oak color="#9c7c54" /></RoundedBox>
    <mesh position={[0, 0.06, 0]}><boxGeometry args={[1.08, 0.12, 0.66]} /><Surface color="#4a503f" /></mesh>
    {[-0.295, 0.295].map((x) => <group key={x}><RoundedBox smoothness={2} bevelSegments={2} args={[0.577, 0.835, 0.024]} radius={0.005} position={[x, 0.51, 0.385]} castShadow><Oak color="#b18f61" /></RoundedBox><Rod from={[x + (x > 0 ? -0.22 : 0.22), 0.58, 0.408]} to={[x + (x > 0 ? -0.22 : 0.22), 0.78, 0.408]} radius={0.008} /></group>)}
    <Books position={[-0.2, 0.966, 0]} scale={0.65} stacked />
    <Plant position={[0.36, 0.968, -0.08]} scale={0.27} seed={2} />
  </group>;
}

/** Authored broad leaves have stems, curved surfaces and raised midribs. */
export function Plant({ position, scale = 1, seed = 0 }: { position: V3; scale?: number; seed?: number }) {
  return <group position={position} scale={scale}><group rotation={[0, seed * 1.1, 0]}><FurnitureAsset model="plant" /></group></group>;
}

/** Hollow fired ceramic and visible coffee; steam belongs to active brewing. */
export function Mug({ position }: { position: V3 }) {
  return <group position={position}><FurnitureAsset model="mug" /></group>;
}

let rugMap: CanvasTexture | undefined;
function rugTexture() {
  if (rugMap) return rugMap;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#b8ad94"; ctx.fillRect(0, 0, 512, 512);
  let random = 82; const rand = () => { random = (random * 1664525 + 1013904223) >>> 0; return random / 4294967296; };
  for (let i = 0; i < 34000; i++) { const value = 135 + Math.floor(rand() * 75); ctx.fillStyle = `rgba(${value + 18},${value + 12},${value},0.42)`; ctx.fillRect(rand() * 512, rand() * 512, 0.6, 2.3); }
  for (let i = 0; i < 256; i++) { ctx.strokeStyle = i % 2 ? "#bdb29c44" : "#847c6c33"; ctx.beginPath(); ctx.moveTo(0, i * 2); ctx.lineTo(512, i * 2); ctx.stroke(); }
  rugMap = new CanvasTexture(canvas); rugMap.colorSpace = SRGBColorSpace; rugMap.wrapS = rugMap.wrapT = RepeatWrapping; rugMap.repeat.set(7, 7); rugMap.anisotropy = 8;
  return rugMap;
}

export function Rug({ position, radius = 2.2, color = "#e6dccd" }: { position: V3; radius?: number; color?: string }) {
  const texture = useMemo(() => rugTexture(), []);
  return <group position={position}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[radius, 96]} /><meshStandardMaterial color={color} map={texture} bumpMap={texture} bumpScale={0.016} roughness={1} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow><torusGeometry args={[radius - 0.012, 0.014, 5, 96]} /><Fabric color="#a6977c" /></mesh>
  </group>;
}
