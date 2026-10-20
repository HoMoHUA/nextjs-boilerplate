import assert from 'node:assert/strict';
import {TrafficDirector} from './traffic';
const traffic=new TrafficDirector(),events=[{id:'1',owner:'A',route:[[0,0],[4,0]] as [number,number][],face:[5,0]as[number,number],ts:100},{id:'2',owner:'B',route:[[4,0],[0,0]]as[number,number][],face:[-1,0]as[number,number],ts:100}];
traffic.enqueue(events,100);traffic.enqueue(events,100);assert.equal(traffic.queue.length,2,'duplicates never replay');
assert.equal(traffic.step(.05,false,true),null,'wait for an existing coffee/meeting reservation');
const owners=new Set<string>();for(let i=0;i<1000;i++){const s=traffic.step(.05,true,true);if(s)owners.add(s.owner);}
assert.deepEqual([...owners],['A','B']);assert.equal(traffic.active,null);assert.equal(traffic.pending,false);
traffic.enqueue(events,100);assert.equal(traffic.pending,false);
traffic.enqueue([{...events[0],id:'old',ts:-40000}],100);assert.equal(traffic.pending,false);
console.log('PASS serialized handoff queue, shared aisle reservation, stale/duplicate suppression');
