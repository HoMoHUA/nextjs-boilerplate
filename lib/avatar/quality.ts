import type { AvatarQuality } from './types';
export type QualityLevel=Exclude<AvatarQuality,'auto'>;
export const QUALITY_PROFILES={low:{dpr:1,shadowSize:0,ao:false,triangles:3000},medium:{dpr:1.25,shadowSize:1024,ao:false,triangles:7000},high:{dpr:1.5,shadowSize:2048,ao:true,triangles:12000}} as const;
export function qualityPreference(raw:unknown):AvatarQuality{return raw==='low'||raw==='medium'||raw==='high'?raw:'auto';}
/** Three-second windows, asymmetric thresholds and eight-second cooldown prevent oscillation. */
export function adaptQuality(level:QualityLevel,ms:number,stableSeconds:number,compact:boolean):QualityLevel {
  if(ms>29)return level==='high'?'medium':'low';
  if(ms<18&&stableSeconds>=20&&!compact)return level==='low'?'medium':'high';
  return level;
}
export const CHARACTER_LODS:Record<QualityLevel,string>={low:'/models/studio/characters-low.glb',medium:'/models/studio/characters-medium.glb',high:'/models/studio/characters-high.glb'};
