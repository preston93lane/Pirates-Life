// Loads the sorted model library from public/models. Each model is fetched once, then copied for every use.
// If a file cannot load (for example inside the single-file artifact, which has no models folder),
// callers get null and draw their own fallback.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

export function loadModel(path) {
  if (!cache.has(path)) {
    cache.set(path, new Promise((resolve) => {
      loader.load(`models/${path}`, (g) => resolve(g.scene), undefined, () => resolve(null));
    }));
  }
  return cache.get(path).then((s) => (s ? s.clone(true) : null));
}

// Put a model on the ground at (x, y, z), turned by rot (radians) and scaled by s.
export async function placeModel(parent, path, x, y, z, rot = 0, s = 1) {
  const m = await loadModel(path);
  if (!m) return null;
  m.position.set(x, y, z); m.rotation.y = rot; m.scale.setScalar(s);
  m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  parent.add(m);
  return m;
}
