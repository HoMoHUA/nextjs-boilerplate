"use client";
import {useLayoutEffect,useRef,type ReactNode} from 'react';
import type {Group} from 'three';
import {batchStatic} from '@/lib/office/static-batch';
export function StaticStudio({version,children}:{version:string;children:ReactNode}){
 const root=useRef<Group>(null);
 useLayoutEffect(()=>{if(!root.current)return;const batch=batchStatic(root.current);return()=>batch.dispose();},[version]);
 return <group ref={root}>{children}</group>;
}
