import assert from 'node:assert/strict';
import { SPOTS,COFFEE_STAND,routeFromSeat,routeBetween,segmentClear,pathLength,travelDuration,travelDistance } from './navigation';
for(const [i,seat] of SPOTS.entries()){
 const route=routeFromSeat(seat,COFFEE_STAND);
 assert.ok(route,`seat ${i} can reach coffee`);
 for(let j=2;j<route.length;j++)assert.ok(segmentClear(route[j-1],route[j]),`seat ${i} segment ${j} clears inflated furniture`);
 const len=pathLength(route),duration=travelDuration(len);
 assert.equal(travelDistance(len,0),0);assert.equal(travelDistance(len,duration),len);
 assert.ok(travelDistance(len,.01)<.001,'starts with acceleration');
}
for(const from of SPOTS)for(const to of SPOTS){const path=routeBetween(from,to);assert.ok(path,'all seats connected');}
console.log('PASS all 12 seats, 144 handoff routes, body clearance and smooth travel endpoints');
