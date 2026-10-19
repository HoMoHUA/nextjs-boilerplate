"use client";

import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { BoxGeometry, Color, Float32BufferAttribute, SRGBColorSpace, Vector2, type BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Books, Plant } from "./Furniture";
import { Surface, useFurnitureTexture, type V3 } from "./studio/FurnitureSurfaces";

type Board = { size: V3; position: V3; color: string; bevel?: number };

const LEFT = -7.36;
const WIDTH = 4.28;
const CENTER = LEFT + WIDTH / 2;
const FRONT = -5.6;

/** Independent fronts and shelves, batched with subtle timber color variations. */
function joineryGeometry() {
  const parts: Board[] = [
    { size: [WIDTH, 0.87, 0.45], position: [CENTER, 0.545, -5.88], color: "#8a7256", bevel: 0.007 },
    { size: [WIDTH + 0.04, 0.054, 0.52], position: [CENTER, 1.022, FRONT - 0.26], color: "#c3a17c", bevel: 0.009 },
    { size: [0.055, 0.91, 0.5], position: [LEFT + 0.025, 0.555, -5.86], color: "#baa084", bevel: 0.005 },
    { size: [0.055, 0.91, 0.5], position: [LEFT + WIDTH - 0.025, 0.555, -5.86], color: "#b89a76", bevel: 0.005 },
  ];
  const tones = ["#b28e69", "#bd9d78", "#ad8a65", "#bea07c", "#b79772", "#bfa07b"];
  const bayWidth = (WIDTH - 0.1) / 6;
  for (let i = 0; i < 6; i++) {
    const x = LEFT + 0.05 + bayWidth * (i + 0.5);
    if (i === 2 || i === 3) {
      for (let drawer = 0; drawer < 3; drawer++) {
        parts.push({ size: [bayWidth - 0.012, 0.272, 0.024], position: [x, 0.272 + drawer * 0.282, FRONT - 0.023], color: tones[i], bevel: 0.003 });
      }
    } else {
      parts.push({ size: [bayWidth - 0.012, 0.837, 0.024], position: [x, 0.554, FRONT - 0.023], color: tones[i], bevel: 0.004 });
    }
  }
  for (const y of [1.65, 2.65]) {
    parts.push({ size: [WIDTH - 0.06, 0.062, 0.34], position: [CENTER, y, -5.895], color: "#b29473", bevel: 0.008 });
    // A shallow back rail gives each floating shelf a clean wall junction.
    parts.push({ size: [WIDTH - 0.09, 0.11, 0.025], position: [CENTER, y + 0.046, -6.035], color: "#a88d6d", bevel: 0.004 });
  }
  // Recessed frame around the botanical photograph, clear of both shelves.
  const artX = -5.14, artY = 2.155;
  for (const sign of [-1, 1]) {
    parts.push({ size: [0.031, 0.82, 0.042], position: [artX + sign * 0.356, artY, -6.005], color: "#9c7955", bevel: 0.003 });
    parts.push({ size: [0.742, 0.031, 0.042], position: [artX, artY + sign * 0.3945, -6.005], color: "#9c7955", bevel: 0.003 });
  }
  const geometries = parts.map(({ size, position, color, bevel = 0.003 }) => {
    const geometry = new RoundedBoxGeometry(...size, 1, bevel);
    geometry.translate(...position);
    const tone = new Color(color);
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = tone.r; colors[i + 1] = tone.g; colors[i + 2] = tone.b; }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return geometry;
  });
  const merged = mergeGeometries(geometries, false)!;
  geometries.forEach((geometry) => geometry.dispose());
  return merged;
}

function hardwareGeometry() {
  const parts: BufferGeometry[] = [];
  const bayWidth = (WIDTH - 0.1) / 6;
  for (let i = 0; i < 6; i++) {
    const x = LEFT + 0.05 + bayWidth * (i + 0.5);
    const heights = i === 2 || i === 3 ? [0.37, 0.652, 0.934] : [0.894];
    for (const y of heights) {
      parts.push(new BoxGeometry(0.19, 0.011, 0.018).translate(x, y, FRONT - 0.01));
    }
  }
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach((part) => part.dispose());
  return geometry;
}

function BotanicalPrint() {
  const source = useTexture("/textures/studio/garden.jpg");
  const photograph = useMemo(() => {
    const texture = source.clone();
    // A portrait crop from the left of the garden photograph reads as framed art.
    texture.repeat.set(0.39, 0.92);
    texture.offset.set(0.29, 0.04);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }, [source]);
  useEffect(() => () => photograph.dispose(), [photograph]);
  return <group position={[-5.14, 2.155, -5.981]}>
    <mesh receiveShadow><planeGeometry args={[0.688, 0.767]} /><Surface color="#e6decb" roughness={0.9} /></mesh>
    <mesh position={[0, 0.015, 0.001]}><planeGeometry args={[0.525, 0.615]} /><meshStandardMaterial map={photograph} color="#d8decb" roughness={0.83} /></mesh>
  </group>;
}

const SMALL_VASE = [[0, 0], [0.085, 0], [0.107, 0.025], [0.108, 0.11], [0.09, 0.17], [0.054, 0.2], [0.048, 0.24], [0.038, 0.24], [0.043, 0.205], [0.08, 0.16], [0.095, 0.1]].map(([x, y]) => new Vector2(x, y));
const TALL_VASE = [[0, 0], [0.09, 0], [0.13, 0.05], [0.14, 0.16], [0.11, 0.28], [0.06, 0.33], [0.057, 0.39], [0.044, 0.39], [0.045, 0.33], [0.09, 0.27]].map(([x, y]) => new Vector2(x, y));

function Ceramics() {
  return <group>
    <mesh position={[-3.45, 1.681, -5.875]} castShadow receiveShadow>
      <latheGeometry args={[SMALL_VASE, 24]} />
      <Surface color="#d2c6af" roughness={0.68} />
    </mesh>
    <mesh position={[-3.75, 2.681, -5.88]} castShadow>
      <latheGeometry args={[TALL_VASE, 28]} />
      <Surface color="#b7b8a0" roughness={0.72} />
    </mesh>
    <mesh position={[-4.06, 2.71, -5.855]} castShadow><cylinderGeometry args={[0.14, 0.1, 0.06, 24]} /><Surface color="#d6c5a6" roughness={0.84} /></mesh>
    <mesh position={[-3.77, 1.714, -5.845]} castShadow><cylinderGeometry args={[0.107, 0.085, 0.067, 24]} /><Surface color="#a09178" roughness={0.8} /></mesh>
  </group>;
}

/** Rear-left storage stays behind z=-5.60; the walking aisle starts in front. */
export function StudioJoinery() {
  const oak = useFurnitureTexture("oak", [1.3, 1.3]);
  const woodGeometry = useMemo(() => joineryGeometry(), []);
  const handles = useMemo(() => hardwareGeometry(), []);
  useEffect(() => () => { woodGeometry.dispose(); handles.dispose(); }, [woodGeometry, handles]);
  return <group name="Rear studio built-in joinery">
    <mesh geometry={woodGeometry} castShadow receiveShadow><meshStandardMaterial map={oak} vertexColors roughness={0.66} /></mesh>
    <mesh position={[CENTER, 0.06, -5.9]} receiveShadow><boxGeometry args={[WIDTH - 0.15, 0.12, 0.35]} /><Surface color="#655b47" roughness={0.87} /></mesh>
    <mesh geometry={handles}><Surface color="#635d48" roughness={0.34} metalness={0.65} /></mesh>
    <BotanicalPrint />
    <Plant position={[-6.86, 1.05, -5.87]} scale={0.29} seed={8} />
    <Books position={[-5.92, 1.05, -5.865]} scale={0.72} stacked />
    <Plant position={[-3.42, 2.681, -5.87]} scale={0.25} seed={10} />
    <Plant position={[-6.9, 2.681, -5.88]} scale={0.24} seed={5} />
    <Books position={[-6.01, 1.681, -5.9]} scale={0.8} />
    <Books position={[-4.36, 1.681, -5.9]} scale={0.75} />
    <Books position={[-5.36, 2.681, -5.89]} scale={0.7} stacked />
    <Ceramics />
  </group>;
}
