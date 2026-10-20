import {BufferAttribute,BufferGeometry,Color,Matrix4,Mesh,type Group,type Material,type MeshStandardMaterial,type Texture} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
function textureKey(texture:Texture|null){return texture?[texture.source.uuid,texture.repeat.toArray(),texture.offset.toArray(),texture.center.toArray(),texture.rotation,texture.colorSpace,texture.wrapS,texture.wrapT].join(':'):'';}
/** Bake only explicitly static meshes. Source geometry/materials are never mutated/disposed. */
export function batchStatic(root:Group){
 root.updateWorldMatrix(true,true);
 const inverse=new Matrix4().copy(root.matrixWorld).invert();
 const groups=new Map<string,{material:MeshStandardMaterial;sources:Mesh[];geometries:BufferGeometry[]}>();
 function visit(object:import('three').Object3D){
  if(object.userData.unbatchable||!object.visible)return;
  if((object as Mesh).isMesh&&!(object as Mesh&{isInstancedMesh?:boolean}).isInstancedMesh){
   const mesh=object as Mesh,material=mesh.material as MeshStandardMaterial;
   if(!Array.isArray(mesh.material)&&material.isMeshStandardMaterial&&!material.transparent&&!material.emissive.getHex()&&mesh.geometry.attributes.position&&mesh.geometry.attributes.normal){
    const key=JSON.stringify([material.type,material.roughness,material.metalness,material.side,material.flatShading,material.alphaTest,material.opacity,material.depthWrite,material.bumpScale,textureKey(material.map),textureKey(material.bumpMap),textureKey(material.normalMap),material.normalScale?.toArray(),material.envMapIntensity,mesh.castShadow,mesh.receiveShadow,
      ...['sheen','sheenRoughness','clearcoat','clearcoatRoughness','transmission'].map(k=>(material as unknown as Record<string,unknown>)[k]),(material as unknown as {sheenColor?:Color}).sheenColor?.getHex()]);
    let group=groups.get(key);if(!group){group={material,sources:[],geometries:[]};groups.set(key,group);}
    const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),geometry=new BufferGeometry();
    for(const name of ['position','normal','uv'])if(source.attributes[name])geometry.setAttribute(name,source.attributes[name].clone());
    if(!geometry.attributes.uv)geometry.setAttribute('uv',new BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
    geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
    const colors=new Float32Array(geometry.attributes.position.count*3),existing=source.attributes.color;
    for(let i=0;i<geometry.attributes.position.count;i++){colors[i*3]=material.color.r*(existing?.getX(i)??1);colors[i*3+1]=material.color.g*(existing?.getY(i)??1);colors[i*3+2]=material.color.b*(existing?.getZ(i)??1);}
    geometry.setAttribute('color',new BufferAttribute(colors,3));source.dispose();group.geometries.push(geometry);group.sources.push(mesh);
   }
  }
  for(const child of object.children)visit(child);
 }
 for(const child of root.children)visit(child);
 const owned:{mesh:Mesh;material:Material;geometry:BufferGeometry;sources:Mesh[]}[]=[];
 for(const group of groups.values()){
  if(group.sources.length<2){group.geometries.forEach(g=>g.dispose());continue;}
  const geometry=mergeGeometries(group.geometries,false);group.geometries.forEach(g=>g.dispose());if(!geometry)continue;
  const material=group.material.clone();material.color.set('#ffffff');material.vertexColors=true;
  const mesh=new Mesh(geometry,material);mesh.castShadow=group.sources[0].castShadow;mesh.receiveShadow=group.sources[0].receiveShadow;mesh.name='Batched static studio';
  group.sources.forEach(source=>{source.visible=false;});root.add(mesh);owned.push({mesh,material,geometry,sources:group.sources});
 }
 return{sourceMeshes:owned.reduce((s,g)=>s+g.sources.length,0),batchMeshes:owned.length,dispose(){for(const group of owned){group.sources.forEach(source=>{source.visible=true;});root.remove(group.mesh);group.geometry.dispose();group.material.dispose();}}};
}
