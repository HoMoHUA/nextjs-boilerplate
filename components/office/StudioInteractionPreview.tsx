"use client";
import {Canvas,useFrame} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {Suspense,useRef,useState} from 'react';
import {Character,type Motion} from './Character';
import {CoffeeStation} from './Workstation';
import {StudioBoundary} from './StudioBoundary';
import {ContextRecovery,StudioQualityContext} from './StudioQuality';
import {CoffeeDirector,type CoffeeSample} from '@/lib/office/interactions';
import {SPOTS} from '@/lib/office/navigation';
import {fromLegacyLook,toLegacyLook} from '@/lib/avatar/defaults';
const look={skin:'#ecc09b',hair:'#292320',hairStyle:'bun' as const,shirt:'#d9c6a5',accent:'#e1d6bf',pants:'#45473e',glasses:false};
function Pose({pose,build,onReady}:{build:'compact'|'average'|'tall';pose:'press'|'brew'|'sip'|'replace';onReady:()=>void}){
 const [sample]=useState(()=>{const director=new CoffeeDirector();let result:CoffeeSample|null=null;for(let i=0;i<10000;i++){result=director.step(.05,[{id:'contact-fixture',spot:SPOTS[1],idle:true}],true);if(result?.phase===pose)break;}if(!result||result.phase!==pose)throw new Error('Unreachable contact fixture');return result;});
 const coffeeRef=useRef<CoffeeSample|null>(sample),motion=useRef<Motion>({walking:false,seated:false,talking:false,look:null,celebrateAt:0,hand:sample.hand,carrying:sample.carrying,station:pose!=='sip'});
 const frames=useRef(0),ready=useRef(false);
 useFrame(()=>{if(!ready.current&&++frames.current>=45){ready.current=true;onReady();}});
 const appearance=fromLegacyLook(look,'contact-fixture');appearance.body.proportions=build;
 return <><group position={[sample.x,0,sample.z]} rotation={[0,Math.PI,0]} scale={1.35}><Character look={toLegacyLook(appearance)} appearance={appearance} status="idle" seed={41} motion={motion}/></group><CoffeeStation position={[6.1,0,-5.25]} coffeeRef={coffeeRef}/></>;
}
/** Local visual regression fixture: no Office store, backend calls or model requests. */
export function StudioInteractionPreview({pose,build='average'}:{build?:'compact'|'average'|'tall';pose:'press'|'brew'|'sip'|'replace'}){
 const [ready,setReady]=useState(false);
 return <main className="h-dvh bg-[#192325] text-[#eef0e9]" data-contact-pose={pose} data-contact-ready={ready}>
  <div className="absolute left-5 top-4 z-10 rounded-xl bg-[#192325]/90 px-4 py-3 text-sm">Local contact fixture · {pose} · {build}</div>
  <StudioBoundary agents={[]} selectedId={null} onSelect={()=>{}}><Canvas shadows dpr={1} camera={{position:[8.4,2.75,-2.45],fov:42}}><ContextRecovery/><ambientLight intensity={1.25}/><hemisphereLight args={['#f7ebda','#68726a',1.2]}/><directionalLight position={[8,6,-1]} intensity={2.4} color="#fff1db" castShadow shadow-mapSize={[1024,1024]}/><StudioQualityContext.Provider value="high"><Suspense fallback={null}><Pose key={`${pose}:${build}`} pose={pose} build={build} onReady={()=>setReady(true)}/></Suspense></StudioQualityContext.Provider><mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[30,30]}/><meshStandardMaterial color="#8b806c" roughness={.95}/></mesh><OrbitControls target={[5.8,1.35,-4.9]} enablePan={false}/></Canvas></StudioBoundary>
 </main>;
}
