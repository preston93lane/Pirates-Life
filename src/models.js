// Loads the sorted model library from public/models. Each file is fetched once and copied for every use.
// If a file cannot load (for example inside the single-file artifact, which has no models folder),
// callers get null and draw their own fallback.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();

// The whole glTF (scene plus animation clips), fetched once.
export function loadGltf(path) {
  if (!cache.has(path)) {
    cache.set(path, new Promise((resolve) => {
      loader.load(`models/${path}`, resolve, undefined, () => resolve(null));
    }));
  }
  return cache.get(path);
}

// A fresh copy of a model's scene. Rigged bodies need the rig-aware clone so their bones stay linked.
export function loadModel(path) {
  return loadGltf(path).then((g) => (g ? cloneRig(g.scene) : null));
}

// Put a model on the ground at (x, y, z), turned by rot (radians) and scaled by s.
export async function placeModel(parent, path, x, y, z, rot = 0, s = 1) {
  const m = await loadModel(path);
  if (!m) return null;
  m.position.set(x, y, z); m.rotation.y = rot; m.scale.setScalar(s);
  parent.add(m);
  return m;
}
