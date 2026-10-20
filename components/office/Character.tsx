"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Color, Matrix4, MeshPhysicalMaterial, Quaternion, Vector3, type Group, type Material, type Mesh, type MeshStandardMaterial } from "three";
import type { AgentLook, AgentStatus } from "@/lib/types";
import { Mug } from "./Furniture";
import { COFFEE_BUTTON, COFFEE_CUP } from "@/lib/office/navigation";
import { useStudioTexture } from "./studio/materials";
import { dampFactor, motionProfile, relativeGazeYaw, sampleMotion } from "@/lib/avatar/motion";

import type { AvatarAppearanceV2 } from "@/lib/avatar/types";
import { LegacyCharacter } from "./LegacyCharacter";
import { useStudioQuality } from "./StudioQuality";
import { drinkingGrip, mugHandleOffset } from "@/lib/avatar/coffee-contact";
import { footTarget, solveLeg } from "@/lib/avatar/locomotion";
import type { IdleGesture } from "@/lib/office/idle";
import { validateAppearance } from "@/lib/avatar/validate";
import { CHARACTER_LODS } from "@/lib/avatar/quality";
const V2_ENABLED = process.env.NEXT_PUBLIC_AVATAR_V2_ENABLED !== "false";

/** Each instance owns its colors; the authored geometry stays shared and cached. */
function useCharacterParts(look: AgentLook, shoeColor?:string) {
  const quality=useStudioQuality();
  const { scene } = useGLTF(CHARACTER_LODS[quality]);
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
      shoe: new Color(shoeColor ?? "#443c36"),
      beard_stubble: new Color(look.skin).lerp(new Color(look.hair),.38),
      beard_short: new Color(look.hair).lerp(new Color(look.skin),.18),
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
  }, [parts, fabric, look.skin, look.shirt, look.accent, look.pants, look.hair, shoeColor]);
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
  distance?: number;
  station?: boolean;
  idleGesture?:IdleGesture;
  noteTarget?:[number,number,number];
  hand?: "rest" | "button" | "cup" | "sip" | "carry";
  carrying?: boolean;
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
  appearance?: AvatarAppearanceV2;
  renderer?: "v1" | "v2";
  status: AgentStatus;
  seed: number;
  reducedMotion?: boolean;
  paused?: boolean;
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
export function Character(props: CharacterProps) {
  const appearance=useMemo(()=>{const parsed=validateAppearance(props.appearance);return parsed.ok?parsed.value:undefined;},[props.appearance]);
  return !V2_ENABLED || props.renderer === "v1" ? <LegacyCharacter {...props} /> : <StudioCharacter {...props} appearance={appearance} />;
}

function StudioCharacter({ look, appearance, status, seed, reducedMotion = false, paused = false, motion, onClick, children }: CharacterProps) {
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
  const carriedCup = useRef<Group>(null);
  const pencil=useRef<Group>(null);
  const cupTilt=useRef(0);
  const cupRotation=useMemo(()=>new Quaternion(),[]);
  const cupMatrix=useMemo(()=>new Matrix4(),[]);
  const cupScale=useMemo(()=>new Vector3(.621,.621,.621),[]);
  const tiltAxis=useMemo(()=>new Vector3(1,0,0),[]);
  const handTarget = useMemo(() => new Vector3(), []);
  const armDirection = useMemo(() => new Vector3(), []);
  const elbowPosition = useMemo(() => new Vector3(), []);
  const bend = useMemo(() => new Vector3(), []);
  const rotation = useMemo(() => new Quaternion(), []);
  const down = useMemo(() => new Vector3(0,-1,0), []);
  const footPositions=useRef([0,0]);
  const sit = useRef(1); // 1 = seated, 0 = standing (smoothed)

  const { parts, materials } = useCharacterParts(look, appearance?.outfit.shoeColor);
  const shape = useMemo(() => appearance ? {faceWidth:1,torsoWidth:appearance.body.proportions === "compact" ? 1.08 : appearance.body.proportions === "tall" ? .94 : 1} : physique(look), [look,appearance]);
  const part = (name: string) => {
    const source = parts.get(name);
    if (!source) return null;
    return source.map((primitive) => {
      const material = Array.isArray(primitive.material)
        ? primitive.material.map((original) => materials.get(original.name)!)
        : materials.get(primitive.material.name)!;
      const smallNostrils=(name === "mouth" || name === "mouth_smile") && appearance?.face.nose === "small" && !Array.isArray(primitive.material) && primitive.material.name === "skin_warm";
      return <mesh key={primitive.uuid} position={smallNostrils ? [0,0,-.025] : [0,0,0]} scale={smallNostrils ? [.8,1,1] : 1} geometry={primitive.geometry} material={material} castShadow receiveShadow dispose={null} />;
    });
  };

  const shortSleeves = appearance ? appearance.outfit.style === "tshirt" : ["curly","bun","fluffy"].includes(look.hairStyle);

  useFrame((_, dt) => {
    if(paused)return;
    elapsed.current += Math.max(0, Math.min(.05, dt));
    const t = elapsed.current + profile.phase;
    const m = motion.current;
    const k = dampFactor(8, dt);
    cupTilt.current=approach(cupTilt.current,m.hand === "sip" ? .28 : 0,dampFactor(7,dt));
    const sample = sampleMotion(profile, elapsed.current, status === "working", reducedMotion);
    sit.current = reducedMotion ? (m.seated ? 1 : 0) : approach(sit.current, m.seated ? 1 : 0, dampFactor(5, dt));
    const seated = sit.current;
    const walking = m.walking;
    const working = status === "working";
    const sinceCheer = (Date.now() - m.celebrateAt) / 1000;
    const cheering = !reducedMotion && sinceCheer >= 0 && sinceCheer < 1.6;

    // body bob
    if (body.current) {
      let y = sample.breath;
      y -= .015*(1-seated);
      if (walking) y += Math.abs(Math.sin((m.distance ?? 0) * 8)) * 0.018-.05;
      if (cheering) y += Math.max(0, Math.sin(sinceCheer * Math.PI * 2.5)) * 0.3 * (1 - sinceCheer / 1.6) * (1 - seated * 0.5);
      body.current.position.y = approach(body.current.position.y,y,dampFactor(12,dt));
    }
    if (torso.current) {
      // lean in to type, lean back to relax
      const lean = (m.station || m.noteTarget ? .25 : 0) - (m.idleGesture?.kind === "stretch" ? m.idleGesture.strength*.1 : 0) + seated * (working ? 0.12 : status === "idle" ? -0.06 + sample.posture : 0) + (walking ? 0.06 : 0);
      torso.current.rotation.x = approach(torso.current.rotation.x, lean, k);
    }

    // legs: hip/knee angles blend between sitting and standing; walking swings them
    const swing = walking && !reducedMotion ? Math.sin((m.distance ?? 0) * 8) : 0;
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
      const foot=feet.current[i];
      if (foot) {
        foot.position.y = -.286 - .251 * seated + (appearance?.outfit.shoes === "sneakers" ? .008*seated : 0);
        if(seated<.1 && hip && knee){
          const target=walking?footTarget(m.distance??0,i):{z:0,lift:0};
          footPositions.current[i]=walking?target.z:approach(footPositions.current[i],0,k);
          const sole=appearance?.outfit.shoes === "sneakers" ? .022 : .014;
          const pose=solveLeg(hip.position.y+(body.current?.position.y??0)-sole-target.lift,footPositions.current[i],-foot.position.y);
          hip.rotation.x=pose.hip;knee.rotation.x=pose.knee;foot.rotation.x=pose.foot;
        }else foot.rotation.x=approach(foot.rotation.x,0,k);
      }
    }

    // blink every few seconds; raise brows when waiting on the human
    if (eyes.current) eyes.current.scale.y = sample.blink;
    if (brows.current) brows.current.position.y = approach(brows.current.position.y, status === "needs_you" ? 0.03 : 0, k);

    if (head.current && root.current) {
      let yaw = m.idleGesture?.kind === "look-away" ? m.idleGesture.strength*.34 : status === "needs_you" ? sample.gesture * .3 : sample.posture * 2;
      if (m.look && !walking && sample.gaze > 0) {
        root.current.getWorldPosition(tmp);
        const world = Math.atan2(m.look.x - tmp.x, m.look.z - tmp.z);
        root.current.getWorldDirection(forward);
        yaw = relativeGazeYaw(world, Math.atan2(forward.x, forward.z)) * sample.gaze;
      }
      head.current.rotation.y = approach(head.current.rotation.y, yaw, dampFactor(4, dt));
      head.current.rotation.z = sample.posture;
      head.current.rotation.x = approach(head.current.rotation.x, m.noteTarget || m.idleGesture?.kind === "desk-check" ? .25 : working && seated > 0.5 ? 0.12 : sample.posture, k);
    }

    // arms: [shoulderX, shoulderZ(outward), elbowX] per side
    for (let i = 0; i < 2; i++) {
      if(i === 1 && (m.noteTarget || (m.hand && m.hand !== "rest")) && !reducedMotion)continue;
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
      } else if(m.idleGesture?.kind === "stretch") {
        sx=-.15;sz=.12+m.idleGesture.strength*1.4;ex=-.2-m.idleGesture.strength*.6;
      } else if(m.idleGesture?.kind === "desk-check" && i === 0) {
        sx=-.25-m.idleGesture.strength*.3;sz=.12;ex=-.2-m.idleGesture.strength*1.2;
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
        sh.rotation.y = approach(sh.rotation.y, 0, k);
        sh.rotation.x = approach(sh.rotation.x, sx, k);
        sh.rotation.z = approach(sh.rotation.z, sz * s, k);
      }
      if (el) {el.rotation.x = approach(el.rotation.x, ex, k);el.rotation.y=approach(el.rotation.y,0,k);el.rotation.z=approach(el.rotation.z,0,k);}
    }
    // A two-bone reach uses the actual transformed shoulder, not a guessed arm pose.
    // The left hand reaches the machine. Both segments keep their authored lengths.
    const sh = shoulders.current[1], el = elbows.current[1];
    if (sh && el && torso.current && (m.noteTarget || (m.hand && m.hand !== "rest")) && !reducedMotion) {
      if(m.noteTarget)handTarget.fromArray(m.noteTarget).add(new Vector3(Math.sin(t*8)*.012,0,Math.sin(t*5)*.009));
      else if (m.hand === "button") handTarget.fromArray(COFFEE_BUTTON);
      else if (m.hand === "cup") handTarget.fromArray(COFFEE_CUP).add(new Vector3(.065,.07,0));
      else if (m.hand === "carry" && root.current) {
        handTarget.set(-.17,1.12,.42);root.current.localToWorld(handTarget);
      } else if(head.current && root.current) {
        // Follow the actual lip socket through body height, head movement and torso lean.
        handTarget.set(0,-.145,.185);head.current.localToWorld(handTarget);
        root.current.getWorldDirection(forward);
        handTarget.fromArray(drinkingGrip([handTarget.x,handTarget.y,handTarget.z],[forward.x,forward.y,forward.z],cupTilt.current));
      }
      torso.current.updateWorldMatrix(true,false);
      torso.current.worldToLocal(handTarget);
      handTarget.sub(sh.position);
      const distance = Math.min(.535, Math.max(.04,handTarget.length()));
      armDirection.copy(handTarget).normalize();
      const upper=.26, lower=.28, a=(upper*upper-lower*lower+distance*distance)/(2*distance);
      bend.set(-1,0,0).addScaledVector(armDirection,-armDirection.x * -1).normalize();
      elbowPosition.copy(armDirection).multiplyScalar(a).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-a*a)));
      rotation.setFromUnitVectors(down, elbowPosition.clone().normalize());
      sh.quaternion.slerp(rotation,dampFactor(14,dt));
      armDirection.copy(handTarget).clampLength(.04,.535).sub(elbowPosition).normalize();
      armDirection.applyQuaternion(rotation.invert());
      rotation.setFromUnitVectors(down,armDirection);
      el.quaternion.slerp(rotation,dampFactor(14,dt));
    }
    if(pencil.current && el){
      pencil.current.visible=!!m.noteTarget && !reducedMotion;
      el.getWorldQuaternion(rotation);pencil.current.quaternion.copy(rotation.invert());
    }
    if (carriedCup.current) {
      carriedCup.current.visible = !!m.carrying && !reducedMotion;
      // Keep the open cup upright as the articulated wrist rotates.
      if (el) {
        handTarget.set(0,-.28,0);
        const handle=mugHandleOffset(cupTilt.current);
        el.localToWorld(handTarget).sub(new Vector3(...handle));
        cupRotation.setFromAxisAngle(tiltAxis,cupTilt.current);
        cupMatrix.compose(handTarget,cupRotation,cupScale);
        // Exact inverse-parent attachment keeps the cup rigid across nonuniform body proportions.
        carriedCup.current.matrix.copy(el.matrixWorld).invert().multiply(cupMatrix);
        carriedCup.current.matrixWorldNeedsUpdate=true;
      }
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
              <group ref={(el) => { feet.current[i] = el; }} position={[0, -0.24, 0]}>{part(appearance?.outfit.shoes === "sneakers" ? "shoe_sneakers" : "shoe")}</group>
            </group>
          </group>
        ))}
        <group ref={torso} position={[0, HIP + 0.05, 0]} scale={[1,appearance?.body.proportions === "compact" ? .94 : appearance?.body.proportions === "tall" ? 1.06 : 1,1]}>
          <group scale={[shape.torsoWidth, 1, 1]}>
            {part("torso")}
            {(!appearance || appearance.outfit.style === "light-jacket") && part("tee")}
            {(!appearance || ["shirt","light-jacket"].includes(appearance.outfit.style)) && part("collar")}
            {(!appearance || ["shirt","light-jacket"].includes(appearance.outfit.style)) && part("torso_details")}
            {appearance?.outfit.style === "hoodie" && part("hoodie_details")}
          </group>
          {part("neck")}
          {[1, -1].map((s, i) => (
            <group key={s} ref={(el) => { shoulders.current[i] = el; }} position={[s * 0.27, 0.55, 0]}>
              {part("upperarm")}
              <group ref={(el) => { elbows.current[i] = el; }} position={[0, -0.26, 0]}>
                {part(shortSleeves ? "forearm_bare" : "forearm_sleeve")}
                {!shortSleeves && part("cuff")}
                {appearance?.accessories.watch && i === 1 && part("watch")}
                <group scale={[s, 1, 1]}>{part("hand")}</group>
                {i === 1 && <group ref={pencil} visible={false} position={[0,-.28,0]}>{part("pen")}</group>}
                {i === 1 && <group ref={carriedCup} matrixAutoUpdate={false} visible={false} position={[-.048,-.33,.015]} scale={.46}><Mug position={[0,0,0]} /></group>}
              </group>
            </group>
          ))}
          <group ref={head} position={[0, 1.04, 0]}>
            <group scale={[shape.faceWidth, 1, 1]}>
              {part(`${appearance?.face.shape === "round" ? "face_round" : appearance?.face.shape === "angular" ? "face_angular" : "face"}${appearance?.face.nose === "small" ? "_small_nose" : ""}`)}
              {part("ears")}
              {part("eyelids")}
              <group ref={eyes} position={[0, 0.015, 0]}>
                <group position={[0, -0.015, 0]} scale={[1,appearance?.face.eyes === "wide" ? 1.18 : appearance?.face.eyes === "narrow" ? .72 : 1,1]}>{part("eyes")}</group>
              </group>
              <group ref={brows} scale={[1,appearance?.face.eyebrows === "straight" ? .6 : appearance?.face.eyebrows === "arched" ? 1.3 : 1,1]}>{part("brows")}</group>
              {part(appearance?.face.mouth === "soft-smile" ? "mouth_smile" : "mouth")}
              {appearance && appearance.face.beard !== "none" && part(`beard_${appearance.face.beard}${appearance.face.shape === "oval" ? "" : `_${appearance.face.shape}`}`)}
              {part(`hair_${appearance?.hair.style ?? look.hairStyle}`)}
              {look.glasses && part(appearance?.accessories.glasses === "square" ? "glasses_square" : appearance?.accessories.glasses === "oval" ? "glasses_oval" : "glasses")}
              {(appearance ? appearance.accessories.headphones : look.hairStyle === "buzz") && part("headphones")}
            </group>
          </group>
        </group>
      </group>
      {children}
    </group>
  );
}
