"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { CatmullRomCurve3, Color, ExtrudeGeometry, Quaternion, RepeatWrapping, Shape, SRGBColorSpace, Texture, Vector3 } from "three";

export type V3 = [number, number, number];

const textureVariants = new Map<string, Texture>();

/** Reuse the same small, tileable surface maps across the entire furniture set. */
export function useFurnitureTexture(kind: "oak" | "fabric", repeat: [number, number] = [1, 1]) {
  const source = useTexture(`/textures/studio/${kind}.jpg`);
  const [repeatX, repeatY] = repeat;
  const key = `${kind}:${repeatX}:${repeatY}`;
  return useMemo(() => {
    let texture = textureVariants.get(key);
    if (!texture) {
      texture = source.clone();
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      textureVariants.set(key, texture);
    }
    return texture;
  }, [source, key, repeatX, repeatY]);
}

export function Oak({ color = "#c8a477", roughness = 0.59 }: { color?: string; roughness?: number }) {
  const map = useFurnitureTexture("oak", [1.3, 1.3]);
  return <meshStandardMaterial color={color} map={map} roughness={roughness} bumpMap={map} bumpScale={0.009} />;
}

export function Fabric({ color = "#b8b8a0" }: { color?: string }) {
  const map = useFurnitureTexture("fabric", [3, 3]);
  return <meshStandardMaterial color={color} map={map} roughness={0.96} bumpMap={map} bumpScale={0.012} />;
}

export function Surface({ color, roughness = 0.5, metalness = 0 }: { color: string; roughness?: number; metalness?: number }) {
  return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />;
}

/** A proper swept, rounded wooden top with real cable apertures. */
export function OakTop({ width, depth, thickness = 0.045, position = [0, 0, 0], grommets = false, color }: { width: number; depth: number; thickness?: number; position?: V3; grommets?: boolean; color?: string }) {
  const geometry = useMemo(() => {
    const shape = new Shape();
    const r = Math.min(0.065, depth * 0.1);
    const x = -width / 2, y = -depth / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + depth - r);
    shape.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
    shape.lineTo(x + r, y + depth);
    shape.quadraticCurveTo(x, y + depth, x, y + depth - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    if (grommets) {
      for (const sign of [-1, 1]) {
        const hole = new Shape();
        hole.absarc(sign * (width / 2 - 0.16), -depth / 2 + 0.11, 0.026, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    }
    const result = new ExtrudeGeometry(shape, { depth: thickness - 0.008, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.004, bevelThickness: 0.004, curveSegments: 8 });
    result.rotateX(-Math.PI / 2);
    result.translate(0, -thickness / 2 + 0.004, 0);
    return result;
  }, [width, depth, thickness, grommets]);
  return <mesh geometry={geometry} position={position} castShadow receiveShadow><Oak color={color} /></mesh>;
}

/** Metal struts follow endpoints rather than approximating joints with boxes. */
export function Rod({ from, to, radius = 0.012, color = "#383d38", metalness = 0.65 }: { from: V3; to: V3; radius?: number; color?: string; metalness?: number }) {
  const transform = useMemo(() => {
    const a = new Vector3(...from), b = new Vector3(...to);
    const delta = b.clone().sub(a);
    return { midpoint: a.add(b).multiplyScalar(0.5), length: delta.length(), quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()) };
  }, [from, to]);
  return <mesh position={transform.midpoint} quaternion={transform.quaternion} castShadow={radius >= 0.012}><cylinderGeometry args={[radius, radius, transform.length, 10]} /><Surface color={color} metalness={metalness} roughness={0.32} /></mesh>;
}

export function Cable({ points, radius = 0.004, color = "#383b36" }: { points: V3[]; radius?: number; color?: string }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map((p) => new Vector3(...p))), [points]);
  return <mesh><tubeGeometry args={[curve, 18, radius, 5, false]} /><Surface color={color} roughness={0.7} /></mesh>;
}

export function mutedSage(color: string, variation = 0) {
  return `#${new Color(color).lerp(new Color(variation ? "#c8c6af" : "#8f9a7e"), 0.86).getHexString()}`;
}
