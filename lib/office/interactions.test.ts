import assert from 'node:assert/strict';
import { CoffeeDirector } from './interactions';
import { SPOTS } from './navigation';
const visitors=SPOTS.map((spot,i)=>({id:`agent-${i}`,spot,idle:true}));
function run(){const d=new CoffeeDirector(),owners:string[]=[],phases=new Set<string>();let last='';for(let i=0;i<20000;i++){const s=d.step(.05,visitors,true);if(s){phases.add(s.phase);if(s.owner!==last){owners.push(s.owner);last=s.owner;}}}return{owners,phases};}
const a=run(),b=run();assert.deepEqual(a,b,'replay is deterministic');
for(const p of ['stand','outbound','prepare','press','brew','pickup','sip','replace','return','sit'])assert.ok(a.phases.has(p),p);
assert.ok(a.owners.length>3);for(let i=1;i<a.owners.length;i++)assert.notEqual(a.owners[i],a.owners[i-1]);
const d=new CoffeeDirector();let sample;for(let i=0;i<3000;i++){sample=d.step(.05,visitors,true);if(sample?.phase==='outbound'&&sample.distance>2)break;}
assert.ok(sample);const position=[sample.x,sample.z];const time=d.time;assert.equal(d.step(100,visitors,false),null);assert.equal(d.time,time,'hidden/reduced clock pauses');
const interrupted=d.step(0,visitors.map(v=>({...v,idle:false})),true)!;
assert.equal(interrupted.phase,'return');assert.deepEqual([interrupted.x,interrupted.z],position,'work preemption never teleports');assert.equal(interrupted.brew,false);
for(let i=0;i<2000;i++)d.step(.05,visitors.map(v=>({...v,idle:false})),true);
assert.equal(d.active,null);assert.equal(d.step(.05,visitors.map(v=>({...v,idle:false})),true),null,'no pretend breaks while working');
console.log('PASS coffee phases, deterministic replay, shared reservation, cooldown, pause and safe work interruption');

const sipDirector=new CoffeeDirector();let sip;
for(let i=0;i<5000;i++){sip=sipDirector.step(.05,visitors,true);if(sip?.phase==='sip')break;}
assert.equal(sip?.carrying,true);
const replace=sipDirector.step(0,visitors.map(v=>({...v,idle:false})),true)!;
assert.equal(replace.phase,'replace');assert.equal(replace.carrying,true,'interruption puts a held cup back before leaving');
for(let i=0;i<29;i++)sipDirector.step(.05,visitors.map(v=>({...v,idle:false})),true);
assert.equal(sipDirector.step(.05,visitors.map(v=>({...v,idle:false})),true)?.carrying,false);
console.log('PASS held-cup interruption reserves time to replace the cup');
