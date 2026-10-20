import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Raycaster,Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
async function load(level,path){const b=await readFile(path??`public/models/studio/characters-${level}.glb`);const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);return scene;}
const high=await load('high'),low=await load('low',process.argv[2]),reports=[];
for(const style of ['short','curly','fluffy','bun','bob','buzz','wavy','side-part','ponytail']){
 let expected=0,misses=0;
 for(let p=1;p<20;p++)for(let t=0;t<72;t++){
  const phi=p*Math.PI/40,theta=t*Math.PI/36,v=new Vector3(Math.sin(phi)*Math.sin(theta),Math.cos(phi),Math.sin(phi)*Math.cos(theta));
  const ray=new Raycaster(v.clone(),v.clone().negate());
  const hf=ray.intersectObject(high.getObjectByName('face'),true)[0],hh=ray.intersectObject(high.getObjectByName(`hair_${style}`),true)[0];
  // Test the continuous upper cap above the authored forehead hairline.
  // Wisps/fringe below .18 may disappear in Low, as the LOD contract allows;
  // their angular coverage must not be confused with holes in the scalp cap.
  if(!hf||!hh||hh.point.y<.18||hh.distance>hf.distance-.003)continue;
  expected++;const lf=ray.intersectObject(low.getObjectByName('face'),true)[0],lh=ray.intersectObject(low.getObjectByName(`hair_${style}`),true)[0];
  if(lf&&(!lh||lh.distance>lf.distance+.001))misses++;
 }
 assert.ok(expected>100,`${style}: enough actual High cap coverage to compare`);
 reports.push({style,coveredReferenceRays:expected,lowScalpBreakthroughs:misses});
}
console.log(reports);
assert.ok(reports.every(r=>r.lowScalpBreakthroughs===0),'Low hair must not expose scalp where the High cap has clear coverage');
console.log('PASS nine Low hairstyles retain sampled High upper-cap coverage; this does not replace all appearance-combination visual acceptance');
