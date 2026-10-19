"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { RoundedBox, useTexture } from "@react-three/drei";
import { Color, InstancedMesh, Object3D, SRGBColorSpace } from "three";
import type { SceneTheme } from "@/lib/types";
import { useStudioTexture } from "./studio/materials";
import { scenePalette, type ResolvedColorMode } from "@/lib/color-mode";

type V3 = [number, number, number];

/** Board gaps and staggered joints are real geometry, batched into one draw. */
function OakFloor({ tint, plinth }: { tint: number; plinth: string }) {
  const map = useStudioTexture("oak", 1.3, 0.32, Math.PI / 2);
  const boards = useMemo(() => {
    const items: { x: number; z: number; width: number; tone: string }[] = [];
    for (let row = 0; row < 20; row++) {
      const start = -7.56 - (row % 3) * 1.03;
      for (let column = 0; column < 7; column++) {
        const left = Math.max(-7.56, start + column * 3.09);
        const right = Math.min(7.56, start + (column + 1) * 3.09);
        if (right <= left) continue;
        items.push({ x: (left + right) / 2, z: -5.92 + row * 0.606,
          width: right - left - 0.012, tone: ["#eee2cc", "#e6d3b5", "#f7ebd7", "#eddec7", "#e8d7bd"][(row * 7 + column * 3) % 5] });
      }
    }
    return items;
  }, []);
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    for (const [i, board] of boards.entries()) {
      dummy.position.set(board.x, -0.036, board.z);
      dummy.scale.set(board.width, 0.072, 0.595);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new Color(board.tone).multiplyScalar(tint));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boards, tint]);
  return (
    <group>
      <RoundedBox args={[15.7, 0.32, 12.55]} radius={0.1} smoothness={3} position={[0, -0.235, -0.16]} receiveShadow>
        <meshStandardMaterial color={plinth} roughness={0.85} />
      </RoundedBox>
      <instancedMesh ref={ref} args={[undefined, undefined, boards.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={map} roughness={0.7} />
      </instancedMesh>
    </group>
  );
}

function Plaster({ position, size, color }: { position: V3; size: V3; color: string }) {
  const map = useStudioTexture("plaster", size[0] / 3, size[1] / 3);
  return (
    <RoundedBox position={position} args={size} radius={0.035} smoothness={2} castShadow receiveShadow>
      <meshStandardMaterial color={color} map={map} roughness={0.94} />
    </RoundedBox>
  );
}

function WindowWall({ tint }: { tint: string }) {
  const source = useTexture("/textures/studio/garden.jpg");
  const garden = useMemo(() => {
    const map = source.clone();
    map.colorSpace = SRGBColorSpace;
    // Match the long window aperture without stretching the garden vertically.
    map.repeat.set(1, 0.5);
    map.offset.set(0, 0.25);
    return map;
  }, [source]);
  useEffect(() => () => garden.dispose(), [garden]);
  return (
    <group>
      {/* The outside stays behind the glazing, with no network assets at runtime. */}
      <mesh position={[2.1, 2.38, -6.19]}>
        <planeGeometry args={[9.8, 2.48]} />
        <meshBasicMaterial map={garden} color={tint} toneMapped={false} />
      </mesh>
      {[-2.8, -0.35, 2.1, 4.55, 7].map((x) => (
        <mesh key={x} position={[x, 2.38, -6.1]} castShadow>
          <boxGeometry args={[0.055, 2.58, 0.065]} />
          <meshStandardMaterial color="#464941" metalness={0.45} roughness={0.4} />
        </mesh>
      ))}
      {[1.12, 3.65].map((y) => (
        <mesh key={y} position={[2.1, y, -6.1]} castShadow>
          <boxGeometry args={[9.88, 0.065, 0.09]} />
          <meshStandardMaterial color="#464941" metalness={0.45} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[2.1, 2.38, -6.08]}>
        <planeGeometry args={[9.8, 2.45]} />
        <meshPhysicalMaterial color="#e7f3eb" transparent opacity={0.06} roughness={0.12} metalness={0.05} />
      </mesh>
      <WindowSill />
    </group>
  );
}

function WindowSill() {
  const oak = useStudioTexture("oak", 3, 0.5);
  return <RoundedBox args={[10.02, 0.09, 0.44]} radius={0.025} position={[2.1, 1.1, -5.95]} castShadow receiveShadow>
    <meshStandardMaterial map={oak} color="#dfc6a2" roughness={0.65} />
  </RoundedBox>;
}

function WallPanel({ x, z, width, height = 0.95 }: { x: number; z: number; width: number; height?: number }) {
  const oak = useStudioTexture("oak", width / 2.5, 0.8);
  return <mesh position={[x, height / 2, z]} castShadow receiveShadow>
    <boxGeometry args={[width, height, 0.12]} />
    <meshStandardMaterial map={oak} color="#b79874" roughness={0.65} />
  </mesh>;
}

function LoungeRug() {
  const weave = useStudioTexture("fabric", 8, 8);
  return <RoundedBox args={[3.6, 0.018, 3.8]} radius={0.008} smoothness={2} bevelSegments={2}
    position={[5.3, 0.01, 3.65]} rotation={[0, -0.08, 0]} receiveShadow>
    <meshStandardMaterial color="#c9bea9" map={weave} bumpMap={weave} bumpScale={0.007} roughness={1} />
  </RoundedBox>;
}

/** Architecture sits outside the existing desk, walking and topic hit targets. */
export function StudioEnvironment({ theme, colorMode }: { theme: SceneTheme; colorMode: ResolvedColorMode }) {
  const palette = scenePalette(colorMode, theme);
  const wall = palette.wall;
  return (
    <group name="Arklyn studio architecture">
      <OakFloor tint={palette.floorTint} plinth={palette.plinth} />
      <LoungeRug />
      <Plaster position={[-7.6, 1.8, -3.5]} size={[0.22, 3.6, 5.7]} color={wall} />
      <Plaster position={[-5.25, 1.8, -6.18]} size={[4.9, 3.6, 0.24]} color={wall} />
      <Plaster position={[7.35, 1.8, -6.18]} size={[0.5, 3.6, 0.24]} color={wall} />
      <Plaster position={[2.1, 0.55, -6.18]} size={[9.8, 1.1, 0.24]} color={wall} />
      <Plaster position={[2.1, 3.73, -6.18]} size={[10, 0.2, 0.3]} color={wall} />
      <WindowWall tint={palette.gardenTint} />
      <WallPanel x={2.1} z={-6.02} width={9.8} />
      <Plaster position={[-7.6, 0.5, 3.2]} size={[0.22, 1, 5.65]} color={wall} />
      <Plaster position={[6.2, 0.55, 5.91]} size={[2.6, 1.1, 0.22]} color={wall} />
      {/* Plinth and wall cap profiles make the cutaway read as architecture. */}
      <mesh position={[-7.45, 0.07, -3.5]}>
        <boxGeometry args={[0.07, 0.13, 5.6]} />
        <meshStandardMaterial color="#bda685" roughness={0.7} />
      </mesh>
      <mesh position={[2.1, 0.065, -5.91]}>
        <boxGeometry args={[9.8, 0.13, 0.06]} />
        <meshStandardMaterial color="#947b5b" roughness={0.7} />
      </mesh>
    </group>
  );
}
