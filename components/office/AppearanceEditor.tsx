"use client";
import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Agent, OfficeState, Room } from '@/lib/types';
import type { AvatarAppearanceV2 } from '@/lib/avatar/types';
import { AVATAR_CATALOG as options, MAX_IMPORT_BYTES } from '@/lib/avatar/catalog';
import { defaultAppearance, fromLegacyLook, toLegacyLook, topicAppearanceKey } from '@/lib/avatar/defaults';
import { readAvatarPreferences } from '@/lib/avatar/storage';
import { validateAppearance } from '@/lib/avatar/validate';
import { actions } from '@/lib/store';
import { Character, type Motion } from './Character';
import { StudioBoundary } from './StudioBoundary';
import { ContextRecovery } from './StudioQuality';
import { StudioQualityContext } from './StudioQuality';
function download(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function PreviewReady({onReady}:{onReady:()=>void}) {
  const frames=useRef(0),reported=useRef(false);
  useFrame(({scene})=>{if(reported.current)return;let meshes=0;scene.traverse(object=>{if("isMesh" in object)meshes++;});if(meshes&&++frames.current>=3){reported.current=true;onReady();}});
  return null;
}
export function AppearanceEditor({s,onClose}:{s:OfficeState;onClose:()=>void}){
  const targets=s.rooms.flatMap<{key:string;room:Room;agent:Agent|null;label:string}>(r=>r.telegram?[{key:r.id,room:r,agent:null,label:r.name}]:r.agents.filter(a=>!a.runtime).map(a=>({key:`${r.id}:${a.id}`,room:r,agent:a,label:`${r.name} · ${a.name}`})));
  const [key,setKey]=useState(()=>targets.find(t=>t.room.id===s.activeRoomId)?.key??targets[0]?.key??'');
  const target=targets.find(t=>t.key===key);
  const stored=readAvatarPreferences(s.avatarPreferences);
  const initial=(k:string)=>{const t=targets.find(t=>t.key===k);if(!t)return defaultAppearance('0','0');if(t.room.telegram){const {groupId,topicId}=t.room.telegram;return structuredClone(stored.preferences.topicAppearances[topicAppearanceKey(groupId,topicId)]?.appearance??defaultAppearance(groupId,topicId));}const parsed=validateAppearance(t.agent!.appearance);return parsed.ok?parsed.value:fromLegacyLook(t.agent!.look,t.key);};
  const [draft,setDraft]=useState<AvatarAppearanceV2>(()=>initial(key));
  const [reset,setReset]=useState(false),[message,setMessage]=useState(''),[invalidColors,setInvalidColors]=useState<Record<string,string>>({});
  const file=useRef<HTMLInputElement>(null);
  const [previewReady,setPreviewReady]=useState(false);
  const motion=useRef<Motion>({walking:false,seated:false,talking:false,look:null,celebrateAt:0});
  const look=useMemo(()=>toLegacyLook(draft),[draft]);
  const disabledRenderer=process.env.NEXT_PUBLIC_AVATAR_V2_ENABLED === "false";
  const previousRenderer=disabledRenderer||(!!target?.room.telegram&&stored.preferences.renderer === "v1");
  const blocked=previousRenderer||(!!target?.room.telegram&&!!stored.issue);
  function update(section:Exclude<keyof AvatarAppearanceV2,'schemaVersion'|'seed'>,field:string,value:unknown){setDraft(d=>({...d,[section]:{...d[section],[field]:value}}));setReset(false);setMessage('');}
  function select(section:Exclude<keyof AvatarAppearanceV2,'schemaVersion'|'seed'>,field:string,label:string,values:readonly string[]){return <label className="flex flex-col gap-1 text-[12px]" key={`${section}-${field}`}>{label}<select aria-label={label} value={String((draft[section] as unknown as Record<string,unknown>)[field])} disabled={blocked} onChange={e=>update(section,field,e.target.value)} className="min-h-11 rounded-lg border border-line bg-inset px-2">{values.map(v=><option key={v} value={v}>{v.replaceAll('-',' ')}</option>)}</select></label>;}
  function color(section:'face'|'hair'|'outfit',field:string,label:string){const id=`${section}.${field}`,value=String((draft[section] as unknown as Record<string,unknown>)[field]);return <label className="flex flex-col gap-1 text-[12px]" key={id}>{label}<input aria-label={label} value={invalidColors[id]??value} disabled={blocked} maxLength={7} spellCheck={false} aria-invalid={invalidColors[id]!==undefined} onChange={e=>{const v=e.target.value;if(/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(v)){setInvalidColors(old=>{const next={...old};delete next[id];return next;});update(section,field,v);}else setInvalidColors(old=>({...old,[id]:v}));}} className="min-h-11 rounded-lg border border-line bg-inset px-2 aria-invalid:border-red-500"/></label>;}
  if(!target)return <p>No editable characters are available.</p>;
  return <div className="space-y-4">
    <label className="flex flex-col gap-1 text-[13px]">Character<select aria-label="Appearance character" value={key} onChange={e=>{setKey(e.target.value);setDraft(initial(e.target.value));setReset(false);setMessage('');setInvalidColors({});}} className="min-h-11 rounded-xl border border-line bg-inset px-3">{targets.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
    <div aria-label="Appearance preview" data-preview-ready={previewReady} className="relative h-64 overflow-hidden rounded-xl bg-inset"><StudioBoundary agents={[]} selectedId={null} onSelect={()=>{}}><Canvas dpr={1} camera={{position:[0,1.15,3.3],fov:39}}><ContextRecovery/><ambientLight intensity={1.5}/><directionalLight position={[3,5,4]} intensity={2}/><StudioQualityContext.Provider value="medium"><Suspense fallback={null}><PreviewReady onReady={()=>setPreviewReady(true)}/><group position={[0,-.8,0]}><Character appearance={draft} look={look} status="idle" seed={1} reducedMotion motion={motion}/></group></Suspense></StudioQualityContext.Provider><OrbitControls target={[0,.15,0]} enablePan={false} minDistance={2} maxDistance={5}/></Canvas></StudioBoundary>{!previewReady&&<p role="status" className="pointer-events-none absolute inset-0 grid place-items-center text-[12px] text-muted">Opening character preview…</p>}</div>
    <p className="text-[12px] text-muted">Preview only. Save applies changes to this character. Cancel discards this draft.</p>
    {blocked&&<p role="alert" className="text-[13px] text-muted">{previousRenderer ? "The previous character renderer is enabled. Appearance editing resumes when the current renderer is enabled." : "Stored appearance settings use an unsupported or invalid version. The original data is preserved; export it for recovery."}</p>}
    <fieldset disabled={blocked} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {select('face','shape','Face',options.faceShapes)}{select('face','eyes','Eyes',options.eyes)}{select('face','eyebrows','Eyebrows',options.eyebrows)}{select('face','nose','Nose',options.noses)}{select('face','mouth','Expression',options.mouths)}{select('face','beard','Beard',options.beards)}
      {select('hair','style','Hair',options.hairStyles)}{select('body','proportions','Build',options.proportions)}{select('outfit','style','Outfit',options.outfits)}{select('outfit','shoes','Shoes',options.shoes)}{select('accessories','glasses','Glasses',options.glasses)}{select('accessories','deskProp','Desk item',options.deskProps)}
      {color('face','skinColor','Skin color')}{color('hair','color','Hair color')}{color('outfit','topColor','Top color')}{color('outfit','accentColor','Accent color')}{color('outfit','pantsColor','Trouser color')}{color('outfit','shoeColor','Shoe color')}
      {(['headphones','watch']as const).map(field=><label key={field} className="flex min-h-11 items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.accessories[field]} onChange={e=>update('accessories',field,e.target.checked)}/>{field}</label>)}
    </fieldset>
    {Object.keys(invalidColors).length>0&&<p role="alert" className="text-[12px] text-red-600">Use a HEX color such as #405b41. Preview keeps the last valid color.</p>}
    <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Import appearance file" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size>MAX_IMPORT_BYTES){setMessage('Appearance file is too large.');return;}try{const parsed=validateAppearance(JSON.parse(await f.text()));if(!parsed.ok){setMessage(parsed.error);return;}setDraft(parsed.value);setReset(false);setInvalidColors({});setMessage('Imported into preview. Save to apply.');}catch{setMessage('Invalid appearance JSON.');}}}/>
    <div className="sticky bottom-0 flex flex-wrap gap-2 bg-surface py-3 text-[13px]">
      <button disabled={blocked||Object.keys(invalidColors).length>0} onClick={()=>{const result=actions.saveAvatar(target.room.id,target.agent?.id??null,draft,reset);if(result.ok)onClose();else setMessage(result.error);}} className="min-h-11 rounded-xl bg-accent px-4 text-white disabled:opacity-40">Save appearance</button>
      <button onClick={onClose} className="min-h-11 rounded-xl border border-line px-4">Cancel</button>
      <button disabled={blocked} onClick={()=>{setDraft(target.room.telegram?defaultAppearance(target.room.telegram.groupId,target.room.telegram.topicId):(()=>{const parsed=validateAppearance(target.agent!.appearanceBaseline);return parsed.ok?parsed.value:fromLegacyLook(target.agent!.look,target.key);})());setReset(true);setInvalidColors({});setMessage('Default preview. Save to reset this character.');}} className="min-h-11 rounded-xl border border-line px-4 disabled:opacity-40">Reset</button>
      <button disabled={blocked} onClick={()=>file.current?.click()} className="min-h-11 rounded-xl border border-line px-4 disabled:opacity-40">Import appearance</button>
      <button onClick={()=>download('appearance.json',draft)} className="min-h-11 rounded-xl border border-line px-4">Export appearance</button>
      {stored.issue&&<button onClick={()=>download('appearance-recovery.json',s.avatarPreferences)} className="min-h-11 rounded-xl border border-line px-4">Export original settings</button>}
    </div>
    {message&&<p role="status" className="text-[13px] text-muted">{message}</p>}
  </div>;
}
