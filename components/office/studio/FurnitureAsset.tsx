"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Color, Mesh, MeshStandardMaterial } from "three";
import { useFurnitureTexture } from "./FurnitureSurfaces";

export type FurnitureModel = "chair" | "executive-chair" | "lounge" | "plant" | "mug" | "espresso";

/** GLB geometry is shared; material copies allow a restrained fabric variation per seat. */
export function FurnitureAsset({ model, fabricColor }: { model: FurnitureModel; fabricColor?: string }) {
  const { scene } = useGLTF(`/models/studio/furniture-${model}.glb`);
  const fabric = useFurnitureTexture("fabric", [3, 3]);
  const oak = useFurnitureTexture("oak", [1.3, 1.3]);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const materials = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = child.receiveShadow = true;
      const prepare = (source: MeshStandardMaterial) => {
        let material = materials.get(source);
        if (material) return material;
        material = source.clone();
        if (source.name.includes("fabric")) {
          material.map = fabric;
          material.bumpMap = fabric;
          material.bumpScale = 0.008;
          material.roughness = 0.96;
          if (fabricColor && !source.name.includes("edge")) material.color = new Color(fabricColor);
        }
        if (source.name.includes("oak")) {
          material.map = oak;
          material.bumpMap = oak;
          material.bumpScale = 0.006;
        }
        materials.set(source, material);
        return material;
      };
      child.material = Array.isArray(child.material) ? child.material.map((material) => prepare(material as MeshStandardMaterial)) : prepare(child.material as MeshStandardMaterial);
    });
    return { clone, materials: Array.from(materials.values()) };
  }, [scene, fabric, oak, fabricColor]);
  useEffect(() => () => object.materials.forEach((material) => material.dispose()), [object]);
  return <primitive object={object.clone} dispose={null} />;
}
