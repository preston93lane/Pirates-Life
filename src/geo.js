// Geometry helpers: build many coloured primitives into one flat-shaded mesh (one draw call).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
export const MAT_2S = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);
export const ball = (r, detail = 0) => new THREE.IcosahedronGeometry(r, detail);

export function paint(g, color, jitter = 0) {
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i += 3) {
    const k = jitter ? 1 + (Math.random() * 2 - 1) * jitter : 1;
    for (let j = 0; j < 3 && i + j < n; j++) { col[(i + j) * 3] = _c.r * k; col[(i + j) * 3 + 1] = _c.g * k; col[(i + j) * 3 + 2] = _c.b * k; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export class Mesher {
  constructor() { this.parts = []; }
  // p = position, r = euler rotation, s = scale (number or [x,y,z]), j = per-face brightness jitter
  add(geo, color, p = [0, 0, 0], r = [0, 0, 0], s = 1, j = 0.06) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (geo.index) geo.dispose();
    g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
    if (color !== null) paint(g, color, j);
    if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
    g.applyMatrix4(_m.compose(_p.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s));
    this.parts.push(g);
    return this;
  }
  build() {
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    return g;
  }
  mesh(mat = MAT) { return new THREE.Mesh(this.build(), mat); }
}

// Build a raw triangle soup from an array of [x,y,z] triples (already ordered counter-clockwise).
export function soup(points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points.flat()), 3));
  g.computeVertexNormals();
  return g;
}
