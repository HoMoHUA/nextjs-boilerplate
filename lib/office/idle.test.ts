import assert from 'node:assert/strict';
import {IdleDirector} from './idle';
function replay(){const d=new IdleDirector(),kinds:string[]=[],starts:number[]=[];let last='';for(let i=0;i<20000;i++){const g=d.step(.05,[{id:'A',idle:true}],true).get('A');if(g&&g.kind!==last){kinds.push(g.kind);starts.push(d.time);last=g.kind;}}return{kinds,starts};}
assert.deepEqual(replay(),replay());assert.equal(new Set(replay().kinds).size,3);for(let i=1;i<replay().kinds.length;i++)assert.notEqual(replay().kinds[i],replay().kinds[i-1]);
const d=new IdleDirector();for(let i=0;i<1000;i++)d.step(.05,[{id:'A',idle:true}],true);assert.equal(d.step(.05,[{id:'A',idle:false}],true).size,0);const time=d.time;d.step(100,[{id:'A',idle:true}],false);assert.equal(d.time,time);
console.log('PASS weighted idle variety, no consecutive repetition, deterministic replay and work/hidden interruption');
