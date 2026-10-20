import {Bone,BufferGeometry,DataTexture,DetachedBindMode,DoubleSide,Float32BufferAttribute,FloatType,Matrix3,Matrix4,Mesh,MeshStandardMaterial,RGBAFormat,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3,type Group,type Object3D} from 'three';
export interface RigidCharacterBatch {mesh:SkinnedMesh<BufferGeometry,MeshStandardMaterial>;sourceMeshes:number;update:()=>void;dispose:()=>void}
/** Low-only matte surfaces. Rigid weights retain the existing authored joints.
 * Source geometry/materials stay shared; only the batch owns disposable buffers.
 */
export function batchRigidCharacter(root:Group):RigidCharacterBatch|null {
 root.updateWorldMatrix(true,true);
 const sources:Mesh<BufferGeometry,MeshStandardMaterial>[]=[],originalVisibility:boolean[]=[];
 function visit(o:Object3D){
  if(o.userData.unbatchable)return;
  if(o instanceof Mesh&&!(o instanceof SkinnedMesh)&&!Array.isArray(o.material)){
   const m=o.material as MeshStandardMaterial,g=o.geometry;
   if(m.isMeshStandardMaterial&&!m.transparent&&m.opacity===1&&g.attributes.position&&g.attributes.normal){sources.push(o as Mesh<BufferGeometry,MeshStandardMaterial>);originalVisibility.push(o.visible);}
  }
  for(const child of o.children)visit(child);
 }
 for(const child of root.children)visit(child);
 if(!sources.length)return null;
 const inverseRoot=new Matrix4().copy(root.matrixWorld).invert(),bones:Bone[]=[],inverses:Matrix4[]=[];
 const position:number[]=[],normal:number[]=[],color:number[]=[],skinIndex:number[]=[],skinWeight:number[]=[];
 const p=new Vector3(),n=new Vector3();
 for(const [boneIndex,source] of sources.entries()){
  const matrix=new Matrix4().multiplyMatrices(inverseRoot,source.matrixWorld),normalMatrix=new Matrix3().getNormalMatrix(matrix);
  const bone=new Bone();bone.matrixAutoUpdate=false;bone.matrixWorldAutoUpdate=false;bone.matrixWorld.copy(matrix);bones.push(bone);inverses.push(matrix.clone().invert());
  const g=source.geometry,count=g.index?.count??g.attributes.position.count,mirrored=matrix.determinant()<0;
  for(let i=0;i<count;i++){
   const corner=i%3,ordered=mirrored&&corner!==0?i+(corner===1?1:-1):i,index=g.index?.getX(ordered)??ordered;
   p.fromBufferAttribute(g.attributes.position,index).applyMatrix4(matrix);n.fromBufferAttribute(g.attributes.normal,index).applyNormalMatrix(normalMatrix);
   position.push(p.x,p.y,p.z);normal.push(n.x,n.y,n.z);
   const c=source.material.color,vc=source.material.vertexColors?g.attributes.color:undefined;
   color.push(c.r*(vc?.getX(index)??1),c.g*(vc?.getY(index)??1),c.b*(vc?.getZ(index)??1));
   skinIndex.push(boneIndex,0,0,0);skinWeight.push(1,0,0,0);
  }
 }
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new Float32BufferAttribute(position,3));geometry.setAttribute('normal',new Float32BufferAttribute(normal,3));geometry.setAttribute('color',new Float32BufferAttribute(color,3));
 geometry.setAttribute('skinIndex',new Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(skinWeight,4));
 const material=new MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.86,metalness:0,side:DoubleSide});
 const mesh=new SkinnedMesh(geometry,material),skeleton=new Skeleton(bones,inverses);
 // Standard skinning transforms normals directly, which is incorrect for the
 // animated shin/body scales in this rig. Upload each rigid bone's true normal
 // matrix; three texels per bone, no extra render pass or draw call.
 const normalData=new Float32Array(bones.length*12),normalTexture=new DataTexture(normalData,3,bones.length,RGBAFormat,FloatType);
 const delta=new Matrix4(),deltaNormal=new Matrix3();
 material.onBeforeCompile=shader=>{
  shader.uniforms.rigidNormalTexture={value:normalTexture};
  shader.vertexShader='uniform sampler2D rigidNormalTexture;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <skinnormal_vertex>',`
    #ifdef USE_SKINNING
      int rigidBone = int( skinIndex.x );
      mat3 rigidNormalMatrix = mat3(
        texelFetch( rigidNormalTexture, ivec2( 0, rigidBone ), 0 ).xyz,
        texelFetch( rigidNormalTexture, ivec2( 1, rigidBone ), 0 ).xyz,
        texelFetch( rigidNormalTexture, ivec2( 2, rigidBone ), 0 ).xyz
      );
      objectNormal = rigidNormalMatrix * objectNormal;
    #endif
  `);
 };
 material.customProgramCacheKey=()=> 'office-low-rigid-normal-v1';
 mesh.name='Low rigid character batch';mesh.userData.unbatchable=true;mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;
 mesh.bindMode=DetachedBindMode;mesh.bind(skeleton,new Matrix4());
 sources.forEach(s=>{s.visible=false;});root.add(mesh);
 function update(){
  root.updateWorldMatrix(true,true);inverseRoot.copy(root.matrixWorld).invert();
  sources.forEach((source,i)=>{
   let visible=originalVisibility[i];for(let parent=source.parent;parent&&parent!==root;parent=parent.parent)visible=visible&&parent.visible;
   if(visible)bones[i].matrixWorld.multiplyMatrices(inverseRoot,source.matrixWorld);else bones[i].matrixWorld.makeScale(0,0,0);
  });
  skeleton.update();
  for(let i=0;i<bones.length;i++){
   delta.multiplyMatrices(bones[i].matrixWorld,skeleton.boneInverses[i]);deltaNormal.getNormalMatrix(delta);
   for(let col=0;col<3;col++)for(let row=0;row<3;row++)normalData[i*12+col*4+row]=deltaNormal.elements[col*3+row];
  }
  normalTexture.needsUpdate=true;
 }
 update();
 return{mesh,sourceMeshes:sources.length,update,dispose(){root.remove(mesh);sources.forEach((s,i)=>{s.visible=originalVisibility[i];});geometry.dispose();material.dispose();normalTexture.dispose();skeleton.dispose();}};
}
