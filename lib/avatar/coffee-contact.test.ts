import assert from 'node:assert/strict';
import {drinkingGrip,mugHandleOffset} from './coffee-contact';
for(const tilt of [0,.1,.28]){
 const mouth:[number,number,number]=[1,2,3],hand=drinkingGrip(mouth,[0,0,-1],tilt),handle=mugHandleOffset(tilt),base=hand.map((n,i)=>n-handle[i]);
 const rim=[base[0],base[1]+.1118*Math.cos(tilt)-.05*Math.sin(tilt),base[2]+.1118*Math.sin(tilt)+.05*Math.cos(tilt)];
 for(let i=0;i<3;i++)assert.ok(Math.abs(rim[i]-mouth[i])<1e-12,'tilted rim reaches the actual lip socket');
}
console.log('PASS authored mug grip and tilted rim contact with the live lip socket');
