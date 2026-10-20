import assert from 'node:assert/strict';
import {BoxGeometry,BufferAttribute,DataTexture,DoubleSide,Group,Matrix3,Mesh,MeshStandardMaterial,ShaderLib,Vector3,type WebGLRenderer} from 'three';
import {batchRigidCharacter} from './rigid-batch';
const root=new Group(),joint=new Group(),hand=new Group(),excluded=new Group();
root.position.set(4,.2,-3);root.add(joint,excluded);joint.position.y=1;joint.add(hand);hand.position.x=.5;
const geometry=new BoxGeometry(.2,.3,.1),material=new MeshStandardMaterial({color:'#785234'});
geometry.rotateY(.4).rotateX(.3); // Sloped normals expose scale errors that axis-aligned faces hide.
const limb=new Mesh(geometry,material);hand.add(limb);hand.scale.x=-1;
const glass=new Mesh(geometry,new MeshStandardMaterial({transparent:true,opacity:.4}));joint.add(glass);
excluded.userData.unbatchable=true;const prop=new Mesh(geometry,material);excluded.add(prop);
let sharedDisposals=0;geometry.addEventListener('dispose',()=>sharedDisposals++);material.addEventListener('dispose',()=>sharedDisposals++);
root.updateWorldMatrix(true,true);
const batch=batchRigidCharacter(root);assert.ok(batch);assert.equal(batch.sourceMeshes,1);assert.equal(limb.visible,false);assert.equal(glass.visible,true);assert.equal(prop.visible,true);
assert.equal(batch.mesh.material.side,DoubleSide,'preserve double-sided authored hair/face surfaces');
const shader={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{}} as Parameters<typeof batch.mesh.material.onBeforeCompile>[0];
batch.mesh.material.onBeforeCompile(shader,{} as WebGLRenderer);
const normalTexture=shader.uniforms.rigidNormalTexture?.value as DataTexture;
assert.ok(normalTexture,'animated inverse-transpose normal matrices reach the actual material uniform');
function expected(i:number){const index=geometry.index!.getX(i);return limb.localToWorld(new Vector3().fromBufferAttribute(geometry.attributes.position as BufferAttribute,index));}
function actual(i:number){const p=new Vector3().fromBufferAttribute(batch!.mesh.geometry.attributes.position as BufferAttribute,i);batch!.mesh.applyBoneTransform(i,p);return batch!.mesh.localToWorld(p);}
// Negative determinant reverses triangle winding when baked into one draw.
const order=[0,2,1];
for(const angle of [0,.4,1.2]){
 joint.rotation.z=angle;joint.scale.y=angle===0?1.98:1;root.scale.set(1,1.06,1.35);batch.update();
 for(let i=0;i<3;i++)assert.ok(actual(i).distanceTo(expected(order[i]))<1e-6,'batched rigid vertex follows its actual animated source');
 const data=normalTexture.image.data as Float32Array,normalDelta=new Matrix3().fromArray([data[0],data[1],data[2],data[4],data[5],data[6],data[8],data[9],data[10]]);
 const shaded=new Vector3().fromBufferAttribute(batch.mesh.geometry.attributes.normal as BufferAttribute,0).applyMatrix3(normalDelta).applyMatrix3(new Matrix3().getNormalMatrix(root.matrixWorld)).normalize();
 const original=new Vector3().fromBufferAttribute(geometry.attributes.normal as BufferAttribute,geometry.index!.getX(0)).applyNormalMatrix(new Matrix3().getNormalMatrix(limb.matrixWorld));
 assert.ok(shaded.distanceTo(original)<1e-6,'animated nonuniform scale preserves actual inverse-transpose source normals');
}
hand.visible=false;batch.update();assert.ok(actual(0).distanceTo(actual(1))<1e-6,'hidden interaction variant collapses instead of showing an extra hand');
hand.visible=true;batch.update();assert.ok(actual(0).distanceTo(actual(1))>.05,'interaction variant can become visible again');
const color=batch.mesh.geometry.attributes.color;assert.ok(Math.abs(color.getX(0)-material.color.r)<1e-6);
let ownedDisposals=0;batch.mesh.geometry.addEventListener('dispose',()=>ownedDisposals++);batch.mesh.material.addEventListener('dispose',()=>ownedDisposals++);normalTexture.addEventListener('dispose',()=>ownedDisposals++);
batch.dispose();assert.equal(ownedDisposals,3);assert.equal(sharedDisposals,0);assert.equal(limb.visible,true);assert.ok(!root.children.includes(batch.mesh));
console.log('PASS Low rigid skinning: actual joint transforms, nonuniform scale, mirrored winding, variant visibility, colors and owned-resource cleanup');
