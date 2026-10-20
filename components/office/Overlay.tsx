"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group, type Object3D } from "three";

/**
 * HTML overlays pinned to points in the 3D scene. Overlays are ordinary DOM in
 * the page's React tree (no extra React roots), and a projector inside the
 * canvas moves them every frame by writing `transform` directly.
 */
const anchors = new Map<string, Object3D>();
/** `ax`/`ay` pick the point of the element that sits on the anchor (0.5/0.5 = centered, 0.62/1 = above, a bit left). */
const elements = new Map<string, { el: HTMLDivElement; ax: number; ay: number; clamp: boolean; width: number; height: number }>();
const tmp = new Vector3();

/** An invisible point in the scene an overlay with the same id follows. */
export function Anchor({ id, position }: { id: string; position: [number, number, number] }) {
  const ref = useRef<Group>(null);
  useEffect(() => {
    const obj = ref.current;
    if (!obj) return;
    anchors.set(id, obj);
    return () => {
      if (anchors.get(id) === obj) anchors.delete(id);
    };
  }, [id]);
  return <group ref={ref} position={position} />;
}

/** Projects every anchor to screen space once per frame. Render it inside the Canvas. */
export function Projector() {
  useFrame(({ camera, size }) => {
    for (const [id, item] of elements) {
      const obj = anchors.get(id);
      if (!obj) {
        item.el.style.visibility = "hidden";
        continue;
      }
      obj.getWorldPosition(tmp).project(camera);
      const w = item.width;
      const h = item.height;
      let x = ((tmp.x + 1) / 2) * size.width - item.ax * w;
      let y = ((1 - tmp.y) / 2) * size.height - item.ay * h;
      if (item.clamp) {
        // keep big cards (the approval bubble) inside the office view
        x = Math.min(Math.max(8, x), size.width - w - 8);
        y = Math.min(Math.max(8, y), size.height - h - 8);
      }
      item.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      item.el.style.visibility = "visible";
    }
  });
  return null;
}

/** DOM content that follows the anchor with the same id. Render it next to the Canvas, inside a positioned container. */
export function Overlay({
  id,
  ax = 0.5,
  ay = 0.5,
  clamp = false,
  z = 10,
  children,
}: {
  id: string;
  ax?: number;
  ay?: number;
  clamp?: boolean;
  z?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const item = { el, ax, ay, clamp, width: el.offsetWidth, height: el.offsetHeight };
    elements.set(id, item);
    const observer = new ResizeObserver(() => { item.width = el.offsetWidth; item.height = el.offsetHeight; });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (elements.get(id)?.el === el) elements.delete(id);
    };
  }, [id, ax, ay, clamp]);
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0" style={{ visibility: "hidden", zIndex: z, willChange: "transform" }}>
      <div className="pointer-events-auto">{children}</div>
    </div>
  );
}
