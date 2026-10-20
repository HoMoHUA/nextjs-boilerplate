"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, type Group, type MeshStandardMaterial } from "three";
import { Books, DeskLamp, Mug, Plant } from "./Furniture";
import { FurnitureAsset } from "./studio/FurnitureAsset";
import { Cable, Fabric, mutedSage, Oak, OakTop, Rod, Surface, type V3 } from "./studio/FurnitureSurfaces";

import type { CoffeeSample } from "@/lib/office/interactions";

const FRAME = "#353c36";
const LINEN = "#e8e0d2";

export function soft(color: string, k = 0.55) {
  return `#${new Color(color).lerp(new Color("#ffffff"), k).getHexString()}`;
}

function codeTexture(seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 768; canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#252d2c"; ctx.fillRect(0, 0, 768, 1024);
  ctx.fillStyle = "#1e2625"; ctx.fillRect(0, 0, 38, 1024);
  ctx.fillStyle = "#333e3a"; ctx.fillRect(38, 0, 134, 1024);
  ctx.fillStyle = "#adb5a5"; ctx.font = "15px monospace"; ctx.fillText("ARKLYN / STUDIO", 57, 34);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 4 === 0 ? "#b3bdab" : "#79867c";
    ctx.fillRect(56 + (i % 3) * 6, 70 + i * 27, 65 + (i * 17 % 30), 5);
  }
  const code = ["export async function studio() {", "  const context = await readProject();", "  const direction = context.design;", "", "  return createWorkspace({", "    name: 'A calmer place to work',", "    materials: ['oak', 'linen'],", "    light: { warmth: 0.82 },", "    objects: direction.map((item) => {", "      return refine(item, context);", "    }),", "  });", "}", "", "// Thoughtful details, shared progress", "const result = await studio();"];
  const tones = ["#b7c2b0", "#d2bea1", "#8ba7a4", "#a7b5a2", "#c2a984"];
  ctx.font = "17px monospace";
  for (let i = 0; i < 48; i++) {
    ctx.fillStyle = "#64726c"; ctx.fillText(String(i + 1).padStart(2, " "), 184, 30 + i * 22);
    ctx.fillStyle = tones[(i + seed) % tones.length]; ctx.fillText(code[(i + seed) % code.length], 226, 30 + i * 22);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace; texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(1, 0.55);
  return texture;
}

let sharedKeyboard: CanvasTexture | undefined;
export function keyboardTexture() {
  if (sharedKeyboard) return sharedKeyboard;
  const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 320;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#333b36"; ctx.fillRect(0, 0, 1024, 320);
  const rows = ["1234567890−=⌫", "QWERTYUIOP[]", "ASDFGHJKL;'", "⇧ZXCVBNM,./⇧", "⌃⌥⌘      ⌘⌥◀▲▼▶"];
  rows.forEach((row, r) => {
    const offset = [18, 35, 49, 22, 22][r], y = 14 + r * 59;
    for (let i = 0; i < row.length; i++) {
      if (r === 4 && i > 2 && i < 9) continue;
      const x = offset + i * 68;
      ctx.fillStyle = "#151d18"; ctx.beginPath(); ctx.roundRect(x, y + 3, 60, 51, 5); ctx.fill();
      ctx.fillStyle = r === 0 ? "#697268" : "#626c61"; ctx.beginPath(); ctx.roundRect(x + 2, y, 56, 48, 5); ctx.fill();
      ctx.fillStyle = "#e2e4d8"; ctx.font = "20px sans-serif"; ctx.fillText(row[i], x + 10, y + 22);
    }
  });
  ctx.fillStyle = "#626c61"; ctx.beginPath(); ctx.roundRect(225, 250, 400, 47, 5); ctx.fill();
  sharedKeyboard = new CanvasTexture(canvas); sharedKeyboard.colorSpace = SRGBColorSpace; sharedKeyboard.anisotropy = 8;
  return sharedKeyboard;
}

export function Keyboard({ position, scale = 1 }: { position: V3; scale?: number }) {
  const map = useMemo(() => keyboardTexture(), []);
  return <group position={position} scale={scale} rotation={[0.035, 0, 0]}>
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.5, 0.023, 0.166]} radius={0.009} castShadow><Surface color="#5d665b" roughness={0.45} metalness={0.15} /></RoundedBox>
    <mesh position={[0, 0.0122, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.481, 0.151]} /><meshStandardMaterial map={map} roughness={0.71} /></mesh>
  </group>;
}

export function Mouse({ position }: { position: V3 }) {
  return <group position={position}>
    <mesh scale={[0.044, 0.023, 0.068]} castShadow><sphereGeometry args={[1, 20, 14]} /><Surface color="#414a40" roughness={0.47} /></mesh>
    <mesh position={[0, 0.0215, 0.003]} scale={[0.0038, 0.004, 0.012]}><sphereGeometry args={[1, 8, 6]} /><Surface color="#a7afa0" metalness={0.4} /></mesh>
    <Cable points={[[0, 0.022, 0.009], [0, 0.019, 0.045], [0, 0.009, 0.06]]} radius={0.0007} color="#242b24" />
  </group>;
}

/** A slim display on an articulated arm, facing its seated owner at -Z. */
export function DeskMonitor({ position, rotation = 0, seed, on, active, width = 0.74 }: { position: V3; rotation?: number; seed: number; on: boolean; active: boolean; width?: number }) {
  const texture = useMemo(() => codeTexture(seed), [seed]);
  useEffect(() => () => texture.dispose(), [texture]);
  const material = useRef<MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    const current = material.current; if (!current) return;
    if (current.map && active) current.map.offset.y = (current.map.offset.y + dt * 0.035) % 1;
    current.emissiveIntensity += ((on ? (active ? 0.4 : 0.18) : 0) - current.emissiveIntensity) * Math.min(1, dt * 3);
  });
  const height = width * 0.585;
  return <group position={position} rotation={[0, Math.PI + rotation, 0]}>
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.09, 0.027, 0.105]} radius={0.008} position={[0.13, 0.006, -0.07]} castShadow><Surface color={FRAME} metalness={0.5} roughness={0.35} /></RoundedBox>
    <Rod from={[0.13, 0.01, -0.07]} to={[0.13, 0.26, -0.07]} radius={0.017} />
    <Rod from={[0.13, 0.25, -0.07]} to={[-0.03, 0.32, -0.09]} radius={0.022} />
    <Rod from={[-0.03, 0.32, -0.09]} to={[0, 0.4, -0.035]} radius={0.018} />
    <Cable points={[[0.13, 0.015, -0.09], [0.15, 0.2, -0.09], [-0.035, 0.28, -0.11], [0, 0.39, -0.05]]} />
    <group position={[0, 0.2 + height / 2, 0]} rotation={[-0.035, 0, 0]}>
      <RoundedBox smoothness={2} bevelSegments={2} args={[width, height, 0.029]} radius={0.009} castShadow><Surface color="#313632" roughness={0.36} metalness={0.15} /></RoundedBox>
      <RoundedBox smoothness={2} bevelSegments={2} args={[width * 0.68, height * 0.66, 0.037]} radius={0.02} position={[0, -0.015, -0.027]} castShadow><Surface color="#646c60" roughness={0.56} metalness={0.15} /></RoundedBox>
      <mesh userData={{unbatchable:true}} position={[0, 0.004, 0.0151]}><planeGeometry args={[width - 0.026, height - 0.032]} /><meshStandardMaterial ref={material} color={on ? "#d9e1d8" : "#171e1a"} map={on ? texture : null} emissive="#d9e0d2" emissiveMap={on ? texture : null} emissiveIntensity={on ? 0.1 : 0} roughness={0.33} /></mesh>
      <mesh position={[0, -height / 2 + 0.009, 0.016]}><circleGeometry args={[0.0026, 10]} /><meshStandardMaterial color={on ? "#b9c9a3" : "#657260"} emissive="#b9c9a3" emissiveIntensity={on ? 0.5 : 0} /></mesh>
      <RoundedBox smoothness={2} bevelSegments={2} args={[0.07, 0.022, 0.003]} radius={0.003} position={[0, -0.04, -0.047]}><Surface color="#7b8274" roughness={0.4} /></RoundedBox>
    </group>
  </group>;
}

/** Seat top stays at .455 so existing seated actors retain their alignment. */
export function OfficeChair({ position = [0, 0, 0], rotation = 0, cushion = "#a5ad91", executive = false }: { position?: V3; rotation?: number; cushion?: string; executive?: boolean }) {
  return <group position={position} rotation={[0, rotation, 0]}><FurnitureAsset model={executive ? "executive-chair" : "chair"} fabricColor={mutedSage(cushion, executive ? 1 : 0)} /></group>;
}

function PersonalItem({ kind, position }: { kind: number; position: V3; color: string }) {
  switch (kind % 5) {
    case 0: return <Plant position={position} scale={0.19} seed={kind} />;
    case 1: return <group position={position} rotation={[0, 0.22, 0]}>
      <RoundedBox smoothness={2} bevelSegments={2} args={[0.17, 0.14, 0.013]} radius={0.003} position={[0, 0.078, 0]} rotation={[-0.13, 0, 0]} castShadow><Oak color="#8b6d48" /></RoundedBox>
      <mesh position={[0, 0.079, -0.008]} rotation={[0.13, Math.PI, 0]}><planeGeometry args={[0.14, 0.11]} /><Surface color="#e2d2b6" /></mesh>
      <mesh position={[-0.019, 0.075, -0.01]} rotation={[0, Math.PI, 0]}><circleGeometry args={[0.033, 24]} /><Surface color="#839178" /></mesh>
      <Rod from={[0, 0.07, 0.009]} to={[0, 0.007, 0.048]} radius={0.003} color="#927551" />
    </group>;
    case 2: return <Books position={position} scale={0.42} stacked />;
    case 3: return <DeskLamp position={position} scale={0.43} />;
    default: return <group position={position}>
      <mesh position={[0, 0.045, 0]} castShadow><cylinderGeometry args={[0.035, 0.029, 0.09, 20, 1, true]} /><meshStandardMaterial color="#9b7550" roughness={0.65} side={2} /></mesh>
      {[0, 1, 2, 3].map((i) => <Rod key={i} from={[(i - 1.5) * 0.012, 0.028, 0]} to={[(i - 1.5) * 0.019, 0.15 + i % 2 * 0.018, i % 2 * 0.012]} radius={0.003} color={["#b79668", "#334538", "#b6ad94", "#614e3c"][i]} metalness={0} />)}
      <RoundedBox smoothness={2} bevelSegments={2} args={[0.095, 0.005, 0.09]} radius={0.003} position={[0.1, 0.004, 0.02]} rotation={[0, 0.12, 0]}><Surface color="#e3cc91" roughness={1} /></RoundedBox>
    </group>;
  }
}

interface Props { seed: number; color?: string; lead?: boolean; active?: boolean; deskProp?: "none"|"book"|"notebook"|"tablet" }

/** Original desk footprint and origin are retained for routing and actor motion. */
export function Workstation({ seed, color, lead = false, active = false, deskProp }: Props) {
  const occupied = Boolean(color), width = lead ? 2.1 : 1.6, top = 0.8, centerZ = 0.64;
  return <group>
    <OakTop width={width} depth={0.74} position={[0, top, centerZ]} grommets />
    {[-1, 1].map((sign) => <group key={sign} position={[sign * (width / 2 - 0.085), 0, centerZ]}>
      {[-0.285, 0.285].map((z) => <RoundedBox smoothness={2} bevelSegments={2} key={z} args={[0.043, 0.755, 0.043]} radius={0.006} position={[0, 0.4, z]} castShadow><Surface color={FRAME} metalness={0.55} roughness={0.38} /></RoundedBox>)}
      <RoundedBox smoothness={2} bevelSegments={2} args={[0.043, 0.037, 0.61]} radius={0.006} position={[0, 0.76, 0]} castShadow><Surface color={FRAME} metalness={0.55} /></RoundedBox>
      {[-0.285, 0.285].map((z) => <mesh key={z} position={[0, 0.012, z]}><cylinderGeometry args={[0.026, 0.026, 0.025, 12]} /><Surface color="#242c25" roughness={0.8} /></mesh>)}
    </group>)}
    <RoundedBox smoothness={2} bevelSegments={2} args={[width - 0.18, 0.058, 0.035]} radius={0.004} position={[0, 0.715, 0.93]} castShadow><Surface color={FRAME} metalness={0.5} /></RoundedBox>
    <RoundedBox smoothness={2} bevelSegments={2} args={[width * 0.65, 0.033, 0.12]} radius={0.006} position={[0, 0.687, 0.92]}><Surface color="#40473f" metalness={0.4} /></RoundedBox>
    <Cable points={[[0.1, 0.815, 0.91], [0.18, 0.8, 0.98], [0.2, 0.69, 0.98], [0.42, 0.68, 0.93]]} radius={0.003} />
    {[-1, 1].map((sign) => <mesh key={sign} position={[sign * (width / 2 - 0.16), 0.8226, centerZ + 0.26]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.025, 0.032, 20]} /><Surface color="#6b7062" metalness={0.65} roughness={0.35} /></mesh>)}
    <group position={[width / 2 - 0.3, 0, centerZ + 0.04]}>
      <RoundedBox smoothness={2} bevelSegments={2} args={[0.385, 0.613, 0.57]} radius={0.009} position={[0, 0.335, 0]} castShadow receiveShadow><Surface color="#514d3d" roughness={0.8} /></RoundedBox>
      {[[0.145, 0.225], [0.348, 0.162], [0.522, 0.162]].map(([y, height], i) => <group key={i}>
        <RoundedBox smoothness={2} bevelSegments={2} args={[0.373, height, 0.025]} radius={0.004} position={[0, y, -0.29]} castShadow><Oak color={i === 0 ? "#b69162" : "#bc996d"} /></RoundedBox>
        <RoundedBox smoothness={2} bevelSegments={2} args={[0.11, 0.012, 0.018]} radius={0.004} position={[0, y + height / 2 - 0.028, -0.309]}><Surface color="#5e6457" roughness={0.32} metalness={0.65} /></RoundedBox>
      </group>)}
      <mesh position={[0, 0.027, 0]}><boxGeometry args={[0.335, 0.05, 0.49]} /><Surface color="#3c4137" /></mesh>
    </group>
    <RoundedBox smoothness={2} bevelSegments={2} args={[0.89, 0.006, 0.36]} radius={0.003} position={[0.08, top + 0.027, 0.48]} receiveShadow><Fabric color={occupied ? mutedSage(color!) : "#b9b29c"} /></RoundedBox>
    <Keyboard position={[-0.02, top + 0.043, 0.44]} />
    <Mouse position={[0.4, top + 0.044, 0.46]} />
    {lead ? <><DeskMonitor position={[-0.42, top + 0.024, 0.86]} rotation={-0.22} seed={seed} on={occupied} active={active} /><DeskMonitor position={[0.42, top + 0.024, 0.86]} rotation={0.22} seed={seed + 3} on={occupied} active={active} /></> : <DeskMonitor position={[0, top + 0.024, 0.86]} seed={seed} on={occupied} active={active} />}
    {occupied && <>
      <group position={[0.58, top + 0.025, 0.6]} scale={0.77}><Mug position={[0, 0, 0]} /></group>
      {deskProp === undefined ? <PersonalItem kind={seed} position={[-width / 2 + 0.17, top + 0.025, 0.78]} color={color!} /> : deskProp !== "none" && <group position={[-width/2+.23,top+.04,.66]} rotation={[0,-.15,0]}>
        {deskProp === "book" ? <Books position={[0,0,0]} scale={.38} stacked /> : <>
          <RoundedBox args={[.25,.018,.32]} radius={.006} smoothness={2} bevelSegments={2} castShadow><Surface color={deskProp === "tablet" ? "#353f38" : "#c2ad83"} /></RoundedBox>
          <mesh position={[0,.0095,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.22,.28]}/><Surface color={deskProp === "tablet" ? "#8daba2" : "#e9e0cc"}/></mesh>
          {deskProp === "notebook" && <Rod from={[-.09,.013,-.1]} to={[-.09,.013,.1]} radius={.003} color="#4c5544"/>}
        </>}
      </group>}
      {lead && <PersonalItem kind={seed + 2} position={[width / 2 - 0.19, top + 0.025, 0.89]} color={color!} />}
      <group position={[-width / 2 + 0.23, top + 0.025, 0.43]} rotation={[0, -0.12, 0]}>
        <RoundedBox smoothness={2} bevelSegments={2} args={[0.23, 0.012, 0.17]} radius={0.004} castShadow><Surface color="#e7dfca" roughness={0.9} /></RoundedBox>
        <Rod from={[-0.07, 0.014, 0.045]} to={[0.07, 0.014, 0.045]} radius={0.004} color="#4c5544" />
      </group>
    </>}
    <OfficeChair position={occupied ? [0, 0, -0.02] : [0, 0, 0.2]} rotation={occupied ? 0 : 0.15} cushion={color ?? LINEN} executive={lead} />
  </group>;
}

export function CoffeeStation({ position, rotation = 0, coffeeRef }: { position: V3; rotation?: number; coffeeRef?: React.RefObject<CoffeeSample|null> }) {
  const cup = useRef<Group>(null), brew = useRef<Group>(null);
  useFrame(() => {
    const sample = coffeeRef?.current;
    if (cup.current) cup.current.visible = !sample?.carrying;
    if (brew.current) brew.current.visible = !!sample?.brew;
  });
  return <group position={position} rotation={[0, rotation, 0]}>
    <RoundedBox smoothness={2} bevelSegments={2} args={[1.59, 0.9, 0.73]} radius={0.01} position={[0, 0.52, 0]} castShadow receiveShadow><Oak color="#99764f" /></RoundedBox>
    <mesh position={[0, 0.055, 0]}><boxGeometry args={[1.46, 0.11, 0.66]} /><Surface color="#494b3e" /></mesh>
    <OakTop width={1.66} depth={0.8} thickness={0.054} position={[0, 1.02, 0]} color="#c1a17a" />
    {[-0.4, 0.4].map((x) => <group key={x}>
      <RoundedBox smoothness={2} bevelSegments={2} args={[0.773, 0.866, 0.022]} radius={0.004} position={[x, 0.516, 0.372]} castShadow><Oak color="#a18157" /></RoundedBox>
      <Rod from={[x - 0.12, 0.895, 0.392]} to={[x + 0.12, 0.895, 0.392]} radius={0.008} color="#4e5548" />
    </group>)}
    <group position={[-0.36, 1.048, -0.06]}><FurnitureAsset model="espresso" /></group>
    <group ref={cup} userData={{unbatchable:true}} position={[-0.36, 1.125, 0.18]} scale={0.62}><Mug position={[0, 0, 0]} /></group>
    <group ref={brew} userData={{unbatchable:true}} visible={false}>
      <mesh position={[-.36,1.244,.18]}><cylinderGeometry args={[.004,.005,.05,8]} /><meshStandardMaterial color="#754326" roughness={.3} /></mesh>
      {[0,1,2].map(i => <mesh key={i} position={[-.36+i*.014,1.39+i*.045,.18]} scale={[.025,.055,.025]}><sphereGeometry args={[1,8,6]} /><meshStandardMaterial color="#f8f2e8" transparent opacity={.09-i*.02} depthWrite={false} /></mesh>)}
    </group>
    {[0, 1].map((i) => <group key={i} position={[0.21 + i * 0.18, 1.048, 0.17]} scale={0.68}><Mug position={[0, 0, 0]} /></group>)}
    <mesh position={[0.45, 1.068, -0.12]} castShadow><cylinderGeometry args={[0.13, 0.14, 0.035, 32]} /><Surface color="#c9b38b" roughness={0.85} /></mesh>
    <mesh position={[0.46, 1.18, -0.12]} castShadow><cylinderGeometry args={[0.073, 0.071, 0.21, 24]} /><Surface color="#c6b79c" roughness={0.8} /></mesh>
    <mesh position={[0.46, 1.292, -0.12]}><cylinderGeometry args={[0.078, 0.078, 0.02, 24]} /><Oak color="#92724b" /></mesh>
    <Plant position={[0.69, 1.048, -0.14]} scale={0.2} seed={4} />
  </group>;
}
