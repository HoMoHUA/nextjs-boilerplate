// Offline asset census; this is not a GPU benchmark or a renderer draw-call count.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const root = new URL('../', import.meta.url);
const files = ['characters', 'chair', 'executive-chair', 'espresso', 'lounge', 'mug', 'plant'];
const assets = [];
let characterParts;
for (const name of files) {
  const path = `public/models/studio/${name === 'characters' ? name : `furniture-${name}`}.glb`;
  const bytes = await readFile(new URL(path, root));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const unique = new Set();
  let triangles = 0;
  let meshes = 0;
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    const geometry = object.geometry;
    for (const attr of ['position', 'normal', 'uv']) {
      assert.ok(geometry.attributes[attr], `${path}: missing ${attr}`);
      assert.ok(Array.from(geometry.attributes[attr].array).every(Number.isFinite), `${path}: non-finite ${attr}`);
    }
    if (geometry.index) {
      assert.ok(Array.from(geometry.index.array).every(i => i < geometry.attributes.position.count), `${path}: invalid index`);
    }
    if (!unique.has(geometry)) {
      unique.add(geometry);
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    }
  });
  assets.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), meshes, uniqueGeometries: unique.size, storedTriangles: triangles });
  if (name === 'characters') {
    characterParts = new Map(gltf.scene.children.map(part => {
      let count = 0;
      part.traverse(mesh => { if (mesh.isMesh) count += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3; });
      return [part.name, count];
    }));
  }
}

const count = part => {
  assert.ok(characterParts.has(part), `Character part missing: ${part}`);
  return characterParts.get(part);
};
// Mirror the actual component's part multiplicities; no shadow/effect passes.
const fixed = ['pelvis', 'torso', 'tee', 'collar', 'torso_details', 'neck', 'face', 'ears', 'eyelids', 'eyes', 'brows', 'mouth'].reduce((n, part) => n + count(part), 0)
  + 2 * ['thigh', 'shin', 'shoe', 'upperarm', 'hand'].reduce((n, part) => n + count(part), 0);
const variants = ['short', 'curly', 'fluffy', 'bun', 'bob', 'buzz'].flatMap(hair => [false, true].map(glasses => {
  const short = ['curly', 'fluffy', 'bun'].includes(hair);
  const triangles = fixed + count(`hair_${hair}`) + 2 * (count(short ? 'forearm_bare' : 'forearm_sleeve') + (short ? 0 : count('cuff')))
    + (glasses ? count('glasses') : 0) + (hair === 'buzz' ? count('headphones') : 0);
  return { hair, glasses, triangles, exceedsProvisionalHigh: triangles > 12000 };
}));
const minimum = Math.min(...variants.map(v => v.triangles));
const maximum = Math.max(...variants.map(v => v.triangles));
const report = {
  schemaVersion: 1,
  source: 'GLTFLoader static census of local authored studio assets',
  limitations: ['No frame time, draw calls, GPU memory, loading time or real-device measurements.', 'Visible totals exclude environment, preview, shadow and effect passes.', 'Counts mirror current Character.tsx, including its legacy hairstyle-dependent sleeves/headphones.'],
  totalAssetBytes: assets.reduce((n, asset) => n + asset.bytes, 0),
  assets, characterVariants: variants,
  visibleCharacterGeometry: [1, 6, 12].map(characters => ({ characters, minimumTriangles: minimum * characters, maximumTriangles: maximum * characters })),
  provisionalTargetsPerCharacter: { low: 3000, medium: 7000, high: 12000 },
  conclusion: 'Current characters exceed the provisional High geometry target. P6 LOD/profiling and real-device acceptance remain required.',
};
const output = new URL('docs/benchmarks/avatar-assets.json', root);
await mkdir(new URL('.', output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Validated ${assets.length} GLBs; ${minimum}–${maximum} triangles/character; wrote ${fileURLToPath(output)}`);
