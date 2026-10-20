"use client";
import { createContext, useContext, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { QualityLevel } from '@/lib/avatar/quality';
import { useEffect, useState } from 'react';
export const StudioQualityContext=createContext<QualityLevel>('medium');
export const useStudioQuality=()=>useContext(StudioQualityContext);
export function QualityMonitor({onSample}:{onSample:(ms:number,seconds:number)=>void}){
  const elapsed=useRef(0),frames=useRef(0),stable=useRef(0);
  useFrame((_,dt)=>{
    if(dt<=0||dt>1)return;
    elapsed.current+=dt;frames.current++;
    if(elapsed.current>=3){const ms=elapsed.current/frames.current*1000;stable.current=ms<18?stable.current+elapsed.current:0;onSample(ms,stable.current);elapsed.current=0;frames.current=0;}
  });
  return null;
}
/** Explicitly enter the existing accessible fallback after a lost GPU context. */
export function ContextRecovery(){
  const canvas=useThree(s=>s.gl.domElement),[lost,setLost]=useState(false);
  useEffect(()=>{const handler=(event:Event)=>{event.preventDefault();setLost(true);};canvas.addEventListener('webglcontextlost',handler);return()=>canvas.removeEventListener('webglcontextlost',handler);},[canvas]);
  if(lost)throw new Error('Studio WebGL context lost');
  return null;
}

import {addAfterEffect} from '@react-three/fiber';
import type {WebGLRenderer} from 'three';
export interface StudioStats {calls:number;triangles:number;geometries:number;textures:number}
/** Aggregate all passes for this renderer, sampled after rendering without taking over its frame loop. */
function monitorRendererStats(gl:WebGLRenderer,onSample:(stats:StudioStats)=>void){
 const previous=gl.info.autoReset;gl.info.autoReset=false;let last=0;
 const stop=addAfterEffect(()=>{const now=performance.now();if(now-last>3000){last=now;onSample({calls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures});}gl.info.reset();});
 return()=>{stop();gl.info.autoReset=previous;};
}
export function RendererStats({onSample}:{onSample:(stats:StudioStats)=>void}){
 const gl=useThree(s=>s.gl),latest=useRef(onSample);
 useEffect(()=>{latest.current=onSample;},[onSample]);
 useEffect(()=>monitorRendererStats(gl,stats=>latest.current(stats)),[gl]);return null;
}
