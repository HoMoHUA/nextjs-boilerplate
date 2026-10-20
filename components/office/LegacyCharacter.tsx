"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Color, MeshPhysicalMaterial, Vector3, type Group, type Material, type Mesh, type MeshStandardMaterial } from "three";
import type { AgentLook, AgentStatus } from "@/lib/types";
import { useStudioTexture } from "./studio/materials";
import { dampFactor, motionProfile, relativeGazeYaw, sampleMotion } from "@/lib/avatar/motion";

const MODEL_URL = "/models/studio/characters-v1.glb";

/** Each instance owns its colors; the authored geometry stays shared and cached. */
function useCharacterParts(look: AgentLook) {
  const { scene } = useGLTF(MODEL_URL);
  const fabric = useStudioTexture("fabric", 6, 6);
  const parts = useMemo(() => {
    const meshes = new Map<string, Mesh[]>();
    for (const object of scene.children) {
      const primitives: Mesh[] = [];
      object.traverse((child) => {
        if ((child as Mesh).isMesh) primitives.push(child as Mesh);
      });
      meshes.set(object.name, primitives);
    }
    return meshes;
  }, [scene]);
  const materials = useMemo(() => {
    const colors: Record<string, Color> = {
      skin: new Color(look.skin),
      skin_warm: new Color(look.skin).lerp(new Color("#a65d4a"), 0.22),
      lips: new Color(look.skin).lerp(new Color("#8e4c43"), 0.45),
      shirt: new Color(look.shirt),
      shirt_shadow: new Color(look.shirt).multiplyScalar(0.78),
      accent: new Color(look.accent).lerp(new Color("#f3eadd"), 0.25),
      pants: new Color(look.pants),
      pants_shadow: new Color(look.pants).multiplyScalar(0.78),
      hair: new Color(look.hair),
      hair_highlight: new Color(look.hair).lerp(new Color("#bb9368"), 0.13),
    };
    const palette = new Map<string, Material>();
    for (const mesh of [...parts.values()].flat()) {
      for (const original of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (palette.has(original.name)) continue;
        let copy = original.clone() as MeshStandardMaterial;
        if (colors[original.name]) copy.color.copy(colors[original.name]);
        if (/^(shirt|pants|accent)/.test(original.name)) {
          const woven = new MeshPhysicalMaterial({ color: copy.color, roughness: 0.94,
            bumpMap: fabric, bumpScale: 0.001, sheen: 0.65,
            sheenColor: copy.color, sheenRoughness: 0.85 });
          copy.dispose();
          copy = woven;
        }
        palette.set(original.name, copy);
      }
    }
    return palette;
  }, [parts, fabric, look.skin, look.shirt, look.accent, look.pants, look.hair]);
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  return { parts, materials };
}

/** Stable physique variation comes from the look, independently of animation. */
function physique(look: AgentLook) {
  let hash = 0;
  for (const char of `${look.hairStyle}:${look.skin}:${look.hair}:${look.shirt}`) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return { faceWidth: 0.97 + ((hash >>> 2) % 7) * 0.01, torsoWidth: 0.97 + ((hash >>> 6) % 7) * 0.01 };
}

/** Mutable motion state shared with the scene (walking and sitting are driven from outside). */
export interface Motion {
  walking: boolean;
  /** true while the agent is in their chair */
  seated: boolean;
  /** Talking with a teammate after walking over (gesturing). */
  talking: boolean;
  /** World-space point the head glances at, or null. */
  look: Vector3 | null;
  /** Date.now() of the last celebration, 0 if none. */
  celebrateAt: number;
}

export interface CharacterProps {
  look: AgentLook;
  status: AgentStatus;
  seed: number;
  reducedMotion?: boolean;
  motion: React.RefObject<Motion>;
  onClick?: () => void;
  children?: React.ReactNode;
}

const tmp = new Vector3();
const forward = new Vector3();
const HIP = 0.6;

type Joint = Group | null;
const approach = (cur: number, target: number, k: number) => cur + (target - cur) * k;

/**
 * Authored adult proportions with articulated local joint origins. The scene
 * continues to drive sitting, typing, walking, waving and celebrations.
 */
export function LegacyCharacter({ look, status, seed, reducedMotion = false, motion, onClick, children }: CharacterProps) {
  const profile = useMemo(() => motionProfile(seed), [seed]);
  const elapsed = useRef(0);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const brows = useRef<Group>(null);
  const hips = useRef<Joint[]>([null, null]);
  const knees = useRef<Joint[]>([null, null]);
  const shins = useRef<Joint[]>([null, null]);
  const feet = useRef<Joint[]>([null, null]);
  const shoulders = useRef<Joint[]>([null, null]);
  const elbows = useRef<Joint[]>([null, null]);
  const sit = useRef(1); // 1 = seated, 0 = standing (smoothed)

  const { parts, materials } = useCharacterParts(look);
  const shape = useMemo(() => physique(look), [look]);
  const part = (name: string) => {
    const source = parts.get(name);
    if (!source) return null;
    return source.map((primitive) => {
      const material = Array.isArray(primitive.material)
        ? primitive.material.map((original) => materials.get(original.name)!)
        : materials.get(primitive.material.name)!;
      return <mesh key={primitive.uuid} geometry={primitive.geometry} material={material} castShadow receiveShadow dispose={null} />;
    });
  };

  const shortSleeves = look.hairStyle === "curly" || look.hairStyle === "bun" || look.hairStyle === "fluffy";

  useFrame((_, dt) => {
    elapsed.current += Math.max(0, Math.min(.05, dt));
    const t = elapsed.current + profile.phase;
    const m = motion.current;
    const k = dampFactor(8, dt);
    const sample = sampleMotion(profile, elapsed.current, status === "working", reducedMotion);
    sit.current = approach(sit.current, m.seated ? 1 : 0, dampFactor(5, dt));
    const seated = sit.current;
    const walking = m.walking;
    const working = status === "working";
    const sinceCheer = (Date.now() - m.celebrateAt) / 1000;
    const cheering = !reducedMotion && sinceCheer >= 0 && sinceCheer < 1.6;

    // body bob
    if (body.current) {
      let y = sample.breath;
      if (walking) y += Math.abs(Math.sin(t * 9)) * 0.04;
      if (cheering) y += Math.max(0, Math.sin(sinceCheer * Math.PI * 2.5)) * 0.3 * (1 - sinceCheer / 1.6) * (1 - seated * 0.5);
      body.current.position.y = y;
    }
    if (torso.current) {
      // lean in to type, lean back to relax
      const lean = seated * (working ? 0.12 : status === "idle" ? -0.06 + sample.posture : 0) + (walking ? 0.06 : 0);
      torso.current.rotation.x = approach(torso.current.rotation.x, lean, k);
    }

    // legs: hip/knee angles blend between sitting and standing; walking swings them
    const swing = walking && !reducedMotion ? Math.sin(t * profile.gaitRate) : 0;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const hip = hips.current[i];
      const knee = knees.current[i];
      const tap = seated > 0.5 && working ? Math.max(0, Math.sin(t * 2.2 + i * 2)) * 0.025 * sample.typing : 0;
      if (hip) {
        hip.rotation.x = approach(hip.rotation.x, -Math.PI / 2 * seated + swing * s * 0.6 * (1 - seated), k);
        hip.position.y = HIP - 0.05 * seated;
      }
      if (knee) knee.rotation.x = approach(knee.rotation.x, (Math.PI / 2) * seated + (walking ? Math.max(0, -swing * s) * 0.9 : 0) - tap, k);
      // The compact standing rig keeps the original aisle envelope. Seated
      // trousers extend to the floor while shoes retain their authored shape.
      if (shins.current[i]) shins.current[i]!.scale.y = 1 + 0.98 * seated;
      if (feet.current[i]) feet.current[i]!.position.y = 0.011 - 0.251 * seated;
    }

    // blink every few seconds; raise brows when waiting on the human
    if (eyes.current) eyes.current.scale.y = sample.blink;
    if (brows.current) brows.current.position.y = approach(brows.current.position.y, status === "needs_you" ? 0.03 : 0, k);

    if (head.current && root.current) {
      let yaw = status === "needs_you" ? sample.gesture * .3 : sample.posture * 2;
      if (m.look && !walking && sample.gaze > 0) {
        root.current.getWorldPosition(tmp);
        const world = Math.atan2(m.look.x - tmp.x, m.look.z - tmp.z);
        root.current.getWorldDirection(forward);
        yaw = relativeGazeYaw(world, Math.atan2(forward.x, forward.z)) * sample.gaze;
      }
      head.current.rotation.y = approach(head.current.rotation.y, yaw, dampFactor(4, dt));
      head.current.rotation.z = sample.posture;
      head.current.rotation.x = approach(head.current.rotation.x, working && seated > 0.5 ? 0.12 : sample.posture, k);
    }

    // arms: [shoulderX, shoulderZ(outward), elbowX] per side
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1; // +1 = right (+x)
      let sx = 0.05;
      let sz = 0.12;
      let ex = -0.2;
      if (cheering) {
        sx = 0;
        sz = 2.6 + Math.sin(t * 14) * 0.2;
        ex = -0.3;
      } else if (walking) {
        sx = -swing * s * 0.55;
        ex = -0.45;
      } else if (m.talking && s === 1) {
        sx = -1.1 + Math.sin(t * 2.4) * 0.2;
        sz = 0.2;
        ex = -0.5 + Math.sin(t * 3.1) * 0.25;
      } else if (status === "needs_you" && s === 1 && sample.gesture > 0) {
        sx = -0.2;
        sz = 0.2 + sample.gesture * 1.3;
        ex = -0.6;
      } else if (seated > 0.5 && working) {
        sx = -0.45;
        sz = 0.18;
        ex = -1.15 + Math.sin(t * (12.5+i*.7) + i * 1.7) * 0.065 * sample.typing;
      } else if (seated > 0.5) {
        sx = -0.25;
        sz = 0.2;
        ex = -1.0 + sample.posture;
      }
      const sh = shoulders.current[i];
      const el = elbows.current[i];
      if (sh) {
        sh.rotation.x = approach(sh.rotation.x, sx, k);
        sh.rotation.z = approach(sh.rotation.z, sz * s, k);
      }
      if (el) el.rotation.x = approach(el.rotation.x, ex, k);
    }
  });

  return (
    <group ref={root} dispose={null}>
      <group
        ref={body}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <group position={[0, HIP + 0.02, 0]}>{part("pelvis")}</group>
        {[1, -1].map((s, i) => (
          <group key={s} ref={(el) => { hips.current[i] = el; }} position={[s * 0.115, HIP - 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            {part("thigh")}
            <group ref={(el) => { knees.current[i] = el; }} position={[0, -0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <group ref={(el) => { shins.current[i] = el; }} scale={[1, 1.98, 1]}>{part("shin")}</group>
              <group ref={(el) => { feet.current[i] = el; }} position={[0, -0.24, 0]}>{part("shoe")}</group>
            </group>
          </group>
        ))}
        <group ref={torso} position={[0, HIP + 0.05, 0]}>
          <group scale={[shape.torsoWidth, 1, 1]}>
            {part("torso")}
            {part("tee")}
            {part("collar")}
            {part("torso_details")}
          </group>
          {part("neck")}
          {[1, -1].map((s, i) => (
            <group key={s} ref={(el) => { shoulders.current[i] = el; }} position={[s * 0.27, 0.55, 0]}>
              {part("upperarm")}
              <group ref={(el) => { elbows.current[i] = el; }} position={[0, -0.26, 0]}>
                {part(shortSleeves ? "forearm_bare" : "forearm_sleeve")}
                {!shortSleeves && part("cuff")}
                <group scale={[s, 1, 1]}>{part("hand")}</group>
              </group>
            </group>
          ))}
          <group ref={head} position={[0, 1.04, 0]}>
            <group scale={[shape.faceWidth, 1, 1]}>
              {part("face")}
              {part("ears")}
              {part("eyelids")}
              <group ref={eyes} position={[0, 0.015, 0]}>
                <group position={[0, -0.015, 0]}>{part("eyes")}</group>
              </group>
              <group ref={brows}>{part("brows")}</group>
              {part("mouth")}
              {part(`hair_${look.hairStyle}`)}
              {look.glasses && part("glasses")}
              {look.hairStyle === "buzz" && part("headphones")}
            </group>
          </group>
        </group>
      </group>
      {children}
    </group>
  );
}


