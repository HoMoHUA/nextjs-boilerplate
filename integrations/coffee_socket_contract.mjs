import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
const source=await readFile('lib/office/navigation.ts','utf8');
const code=ts.transpile(source,{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});
const {COFFEE_BUTTON}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const b=await readFile('public/models/studio/furniture-espresso.glb');
const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
// The amber lamp occupies the center of the physical brew button. Compare its
// front surface to the shared world target, not the neighboring control dial.
const led=scene.getObjectByName('espresso__studio_amber_led');assert.ok(led,'authored brew button lamp exists');
const box=new Box3().setFromObject(led),center=box.getCenter(new Vector3());
const actual=new Vector3(6.1-.36+center.x,1.048+center.y,-5.25-.06+box.max.z);
assert.ok(actual.distanceTo(new Vector3(...COFFEE_BUTTON))<.001,'button IK target matches the authored button surface');
console.log('PASS espresso button target matches the actual authored GLB surface');
