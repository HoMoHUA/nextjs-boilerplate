import assert from "node:assert/strict";
import { dampFactor, motionIdentitySeed, motionProfile, sampleMotion, relativeGazeYaw } from "./motion";
assert.equal(motionIdentitySeed("topic-avatar:23"), motionIdentitySeed("topic-avatar:23"));
assert.notEqual(motionIdentitySeed("topic-avatar:23"), motionIdentitySeed("topic-avatar:99"));
const a = motionProfile(motionIdentitySeed("Ari")), b = motionProfile(motionIdentitySeed("Mina"));
assert.notDeepEqual(a,b);
for (const fps of [30,60,120]) {
  let value=0;
  for(let i=0;i<fps;i++) value+=(1-value)*dampFactor(8,1/fps);
  assert.ok(Math.abs(value-(1-Math.exp(-8)))<1e-10,"same transition at 30/60/120 FPS");
}
assert.equal(dampFactor(8,10),dampFactor(8,.05),"resume delta is bounded");
const samples=Array.from({length:1200},(_,i)=>sampleMotion(a,i/20,true,false));
assert.ok(samples.some(sample=>sample.typing===0),"processing has natural pauses");
assert.ok(samples.some(sample=>sample.typing!==0));
assert.ok(samples.some(sample=>sample.gaze===0));
assert.ok(samples.some(sample=>sample.gaze>0));
assert.notDeepEqual(samples.slice(0,200),samples.slice(400,600),"subsequent time windows do not repeat the same loop");
assert.equal(sampleMotion(a,4,false,false).typing,0,"idle never pretends to type");
const reduced=sampleMotion(a,4,true,true);
assert.equal(reduced.breath,0);assert.equal(reduced.typing,0);assert.equal(reduced.gaze,0);assert.equal(reduced.gesture,0);
assert.ok(Math.abs(relativeGazeYaw(-Math.PI+.1,Math.PI-.1)-.2)<1e-8,"correct relative gaze across wrapped body heading");
assert.ok(Math.abs(relativeGazeYaw(2,0))<=.45);
console.log("PASS identity-based non-repeating motion windows, typing pauses, bounded gaze/delta, Reduced motion and frame-independent damping");
