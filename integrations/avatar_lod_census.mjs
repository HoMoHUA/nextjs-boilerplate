import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
const reports=[];
for(const [level,budget] of [['low',3000],['medium',7000],['high',12000]]){
 const bytes=await readFile(`public/models/studio/characters-${level}.glb`);
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const parts=new Map();
 for(const child of scene.children){let count=0;child.traverse(m=>{if(!m.isMesh)return;const g=m.geometry;for(const name of ['position','normal','uv']){assert.ok(g.attributes[name],`${level}/${child.name} missing ${name}`);assert.ok(Array.from(g.attributes[name].array).every(Number.isFinite));}if(g.index)assert.ok(Array.from(g.index.array).every(i=>i<g.attributes.position.count));count+=(g.index?.count??g.attributes.position.count)/3;});parts.set(child.name,count);}
 const c=n=>{assert.ok(parts.has(n),`${level}: missing ${n}`);return parts.get(n);};
 const max=names=>Math.max(...names.map(c));
 // Low rigid batching submits collapsed inactive hand variants too. Count those
 // vertices/triangles conservatively, even though they cover no screen pixels.
 const hands=['hand','hand_grip','hand_point'];
 const handCost=c('hand')+(level==='low'?hands.reduce((s,n)=>s+c(n),0):max(hands));
 const fixed=['pelvis','torso','neck','ears','eyelids','eyes','brows'].reduce((s,n)=>s+c(n),0)+2*['thigh','shin','upperarm'].reduce((s,n)=>s+c(n),0)+handCost;
 const grip=new Box3().setFromObject(scene.getObjectByName('hand_grip')),point=new Box3().setFromObject(scene.getObjectByName('hand_point'));
 assert.ok(grip.min.y>-.33,`${level}: gripping fingers must curl back toward the palm`);
 assert.ok(Math.abs(point.min.y+.37)<.015,`${level}: index tip must match the .37 reach socket`);
 assert.ok(Math.abs(grip.max.y+.222)<.015&&Math.abs(point.max.y+.222)<.015,`${level}: interaction hands retain the shared wrist origin`);
 let tip=new Vector3(0,Infinity,0);
 scene.getObjectByName('hand_point').traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){const p=new Vector3().fromBufferAttribute(a,i);m.localToWorld(p);if(p.y<tip.y)tip=p;}});
 assert.ok(Math.hypot(tip.x,tip.z)<.015,`${level}: pointing fingertip must lie on the IK reach axis`);
 const face=max(['face','face_round','face_angular','face_small_nose','face_round_small_nose','face_angular_small_nose']);
 const outfit=Math.max(c('tee')+c('collar')+c('torso_details'),c('hoodie_details'))+2*Math.max(c('forearm_bare'),c('forearm_sleeve')+c('cuff'));
 const worst=fixed+face+outfit+2*max(['shoe','shoe_sneakers'])+max(['mouth','mouth_smile'])+max(['beard_stubble','beard_short','beard_stubble_round','beard_short_round','beard_stubble_angular','beard_short_angular'])+max(['hair_short','hair_curly','hair_fluffy','hair_bun','hair_bob','hair_buzz','hair_wavy','hair_side-part','hair_ponytail'])+max(['glasses','glasses_square','glasses_oval'])+c('headphones')+c('watch')+c('pen');
 reports.push({level,bytes:bytes.length,parts:parts.size,worstCaseTriangles:worst,inactiveRigidHandVariantsIncluded:level==='low',budget,withinBudget:worst<=budget});
}
await writeFile('docs/benchmarks/avatar-lods.json',JSON.stringify({source:'Static GLTFLoader census, actual rig multiplicities plus all optional accessories; excludes props/shadow passes, not a physical-device FPS benchmark',levels:reports},null,2)+'\n');
console.log(reports);for(const r of reports)assert.ok(r.withinBudget,`${r.level} exceeds ${r.budget}`);
