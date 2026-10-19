"use client";

import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace } from "three";

/** Independent UV transforms; never mutate drei's shared texture cache. */
export function useStudioTexture(kind: "oak" | "fabric" | "plaster", repeatX = 1, repeatY = 1, rotation = 0) {
  const original = useTexture(`/textures/studio/${kind}.jpg`);
  const texture = useMemo(() => {
    const map = original.clone();
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.center.set(0.5, 0.5);
    map.rotation = rotation;
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
    map.needsUpdate = true;
    return map;
  }, [original, repeatX, repeatY, rotation]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
