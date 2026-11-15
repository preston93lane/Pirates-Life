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
  constructor(keepUV = false) { this.parts = []; this.keepUV = keepUV; }
  // p = position, r = euler rotation, s = scale (number or [x,y,z]), j = per-face brightness jitter
  add(geo, color, p = [0, 0, 0], r = [0, 0, 0], s = 1, j = 0.06) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (geo.index) geo.dispose();
    if (!this.keepUV) g.deleteAttribute('uv'); else if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
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

// ---------- procedural building textures (drawn once to canvases; tinted by vertex colour) ----------
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const R = (a, b) => a + Math.random() * (b - a);
const grey = (v, a = 1) => `rgba(${v},${v},${v},${a})`;
const speckle = (x, w, h, n, a) => { for (let i = 0; i < n; i++) { x.fillStyle = grey(Math.random() < 0.5 ? 0 : 255, R(0.02, a)); x.fillRect(R(0, w), R(0, h), R(1, 5), R(1, 5)); } };
const DRAW = {
  plaster(x, w, h) { x.fillStyle = '#e9e5dc'; x.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { x.fillStyle = grey(Math.random() < 0.6 ? 60 : 255, R(0.03, 0.09)); x.beginPath(); x.ellipse(R(0, w), R(0, h), R(6, 34), R(4, 20), R(0, 3), 0, 7); x.fill(); } speckle(x, w, h, 900, 0.1); x.strokeStyle = grey(40, 0.35); x.lineWidth = 1; for (let i = 0; i < 5; i++) { let px = R(0, w), py = R(0, h); x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += R(-9, 9); py += R(4, 13); x.lineTo(px, py); } x.stroke(); } },
  planks(x, w, h) { const n = 8, bh = h / n; for (let i = 0; i < n; i++) { const v = Math.round(R(178, 232)); x.fillStyle = grey(v); x.fillRect(0, i * bh, w, bh); for (let k = 0; k < 26; k++) { x.fillStyle = grey(Math.random() < 0.5 ? 0 : 255, R(0.03, 0.1)); x.fillRect(R(0, w), i * bh + R(2, bh - 2), R(20, 110), 1); } x.fillStyle = grey(20, 0.75); x.fillRect(0, i * bh, w, 2); x.fillStyle = grey(255, 0.18); x.fillRect(0, i * bh + 2, w, 1); const j = R(20, w - 20); x.fillStyle = grey(20, 0.6); x.fillRect(j, i * bh, 2, bh); x.fillStyle = grey(30, 0.8); for (const d of [-7, 7]) { x.beginPath(); x.arc(j + d, i * bh + bh / 2, 1.6, 0, 7); x.fill(); } } },
  stone(x, w, h) { x.fillStyle = '#7f7b72'; x.fillRect(0, 0, w, h); const rows = 6, rh = h / rows; for (let r = 0; r < rows; r++) { let px = -R(0, 40); while (px < w) { const bw = R(38, 78), v = Math.round(R(168, 236)); x.fillStyle = grey(v); x.beginPath(); x.roundRect(px + 2, r * rh + 2, bw - 4, rh - 4, 5); x.fill(); x.fillStyle = grey(255, 0.16); x.fillRect(px + 4, r * rh + 3, bw - 8, 2); x.fillStyle = grey(0, 0.16); x.fillRect(px + 4, r * rh + rh - 6, bw - 8, 3); px += bw; } } speckle(x, w, h, 700, 0.12); },
  shingle(x, w, h) { const rows = 8, rh = h / rows, tw = w / 8; for (let r = 0; r < rows; r++) for (let i = -1; i < 9; i++) { const px = i * tw + (r % 2 ? tw / 2 : 0), v = Math.round(R(170, 236)); x.fillStyle = grey(v); x.fillRect(px, r * rh, tw - 1, rh); const g = x.createLinearGradient(0, r * rh, 0, (r + 1) * rh); g.addColorStop(0, grey(0, 0.38)); g.addColorStop(0.35, grey(0, 0)); g.addColorStop(1, grey(255, 0.12)); x.fillStyle = g; x.fillRect(px, r * rh, tw - 1, rh); x.fillStyle = grey(0, 0.5); x.fillRect(px + tw - 1, r * rh, 1, rh); } },
  thatch(x, w, h) { x.fillStyle = '#d9d0b0'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { x.strokeStyle = grey(Math.random() < 0.5 ? 40 : 255, R(0.05, 0.22)); x.lineWidth = R(0.6, 1.6); const px = R(0, w), py = R(0, h); x.beginPath(); x.moveTo(px, py); x.lineTo(px + R(-3, 3), py + R(10, 34)); x.stroke(); } for (let b = 0; b < 4; b++) { const g = x.createLinearGradient(0, b * 64, 0, b * 64 + 14); g.addColorStop(0, grey(0, 0.4)); g.addColorStop(1, grey(0, 0)); x.fillStyle = g; x.fillRect(0, b * 64, w, 14); } },
  window(x, w, h) { x.fillStyle = '#2a1e15'; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffd98c'); g.addColorStop(1, '#d9862e'); x.fillStyle = g; x.fillRect(7, 7, w - 14, h - 14); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(9, 9, w * 0.3, h * 0.25); x.fillStyle = '#2a1e15'; x.fillRect(w / 2 - 2, 0, 4, h); x.fillRect(0, h / 2 - 2, w, 4); x.fillRect(0, h * 0.26, w, 2); x.fillRect(0, h * 0.74, w, 2); },
  door(x, w, h) { x.fillStyle = '#4a3423'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { x.fillStyle = grey(0, R(0.05, 0.28)); x.fillRect(i * w / 4, 0, w / 4 - 2, h); x.fillStyle = grey(0, 0.6); x.fillRect((i + 1) * w / 4 - 2, 0, 2, h); } x.fillStyle = '#1d1f21'; x.fillRect(0, h * 0.18, w, 7); x.fillRect(0, h * 0.72, w, 7); x.beginPath(); x.arc(w * 0.8, h * 0.5, 4, 0, 7); x.fill(); x.strokeStyle = '#1b130d'; x.lineWidth = 5; x.strokeRect(0, 0, w, h); },
};
let HULL = null;
// Ship timbers: planking texture tinted by vertex colour, both sides drawn.
export function hullMat() { if (!HULL) HULL = new THREE.MeshLambertMaterial({ map: kitMats().planks.map, vertexColors: true, flatShading: true, side: THREE.DoubleSide }); return HULL; }
let GROUND = null;
// Terrain: vertex colours carry the land's colour; a tiling noise texture adds grit up close.
export function groundMat() {
  if (!GROUND) GROUND = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#e2e0da'; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { x.fillStyle = grey(Math.random() < 0.55 ? 30 : 255, R(0.03, 0.1)); x.beginPath(); x.ellipse(R(0, w), R(0, h), R(3, 22), R(2, 12), R(0, 3), 0, 7); x.fill(); } speckle(x, w, h, 2600, 0.16); }) });
  return GROUND;
}
export function setGlow(k) { if (KIT_MAT) KIT_MAT.window.emissiveIntensity = 0.35 + k * 1.6; }
let KIT_MAT = null;
function kitMats() {
  if (KIT_MAT) return KIT_MAT;
  KIT_MAT = { plain: MAT };
  for (const k of ['plaster', 'planks', 'stone', 'shingle', 'thatch']) KIT_MAT[k] = new THREE.MeshLambertMaterial({ map: canvasTex(256, 256, DRAW[k]), vertexColors: true, flatShading: true });
  KIT_MAT.window = new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, DRAW.window, false), emissive: 0x7a4a14, emissiveMap: null, flatShading: true });
  KIT_MAT.door = new THREE.MeshLambertMaterial({ map: canvasTex(64, 128, DRAW.door, false), flatShading: true });
  return KIT_MAT;
}
// Give a (non-indexed) part UVs from its world position, so textures tile at a constant real-world size.
export function boxUV(g, scale = 1 / 2.6, swapFlat = false) {
  const p = g.attributes.position, uv = g.attributes.uv, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
    const flat = Math.abs(n.y) > 0.92, hl = Math.hypot(n.x, n.z) || 1, tx = n.z / hl, tz = -n.x / hl;
    for (let k = 0; k < 3; k++) { const v = k === 0 ? a : k === 1 ? b : c; if (flat) { if (swapFlat) uv.setXY(i + k, v.z * scale, v.x * scale * 1.6); else uv.setXY(i + k, v.x * scale, v.z * scale); } else uv.setXY(i + k, (v.x * tx + v.z * tz) * scale, (v.y / hl) * scale); }
  }
}
// A Mesher that sorts parts into textured materials by colour (or an explicit kind). Same add() signature.
export class Kit {
  constructor(kinds = {}) { this.kinds = kinds; this.m = {}; this.origin = null; }
  add(geo, color, p, r, s, j, kind) {
    kind = kind || this.kinds[color] || 'plain';
    const own = kind === 'window' || kind === 'door', mm = this.m[kind] || (this.m[kind] = new Mesher(kind !== 'plain'));
    mm.add(geo, own ? 0xffffff : color, p, r, s, own ? 0 : j);
    const g = mm.parts[mm.parts.length - 1];
    if (this.origin) g.applyMatrix4(this.origin);
    if (kind !== 'plain' && !own) boxUV(g);
    return this;
  }
  mesh() { const grp = new THREE.Group(), mats = kitMats(); for (const k in this.m) grp.add(new THREE.Mesh(this.m[k].build(), mats[k])); return grp; }
}
