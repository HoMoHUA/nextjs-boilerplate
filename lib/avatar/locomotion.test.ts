import assert from 'node:assert/strict';
import {footTarget,solveLeg} from './locomotion';
for(let i=0;i<400;i++)for(const side of [0,1]){
 const distance=i/200,target=footTarget(distance,side),body=-.065+Math.abs(Math.sin(distance*8))*.018;
 const y=.6+body-.014-target.lift,pose=solveLeg(y,target.z);
 assert.ok(pose.reachable);const ankleY=.6+body-.3*Math.cos(pose.hip)-.286*Math.cos(pose.hip+pose.knee);
 const ankleZ=-.3*Math.sin(pose.hip)-.286*Math.sin(pose.hip+pose.knee);
 assert.ok(Math.abs(ankleY-(.014+target.lift))<1e-9,'sole contacts ground or intentional swing lift');
 assert.ok(Math.abs(ankleZ-target.z)<1e-9);assert.equal(pose.hip+pose.knee+pose.foot,0);
}
for(const fps of [30,60,120]){let distance=.02;const start=distance+footTarget(distance,0).z;for(let i=0;i<fps/10;i++){distance+=.1/fps;const t=footTarget(distance,0);assert.ok(t.stance);assert.ok(Math.abs(distance+t.z-start)<1e-12,'stance foot stays planted on straight ground');}}
console.log('PASS reachable articulated legs, ground contact, flat soles and distance-based stance locking at 30/60/120 FPS');
