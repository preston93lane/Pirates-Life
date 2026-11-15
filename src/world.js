// The static world: sky, ocean, island terrain, towns, fort, ruins, hideout. Also height and collision queries.
import * as THREE from 'three';
import { ISLANDS, WORLD_R, BUILDINGS } from './data.js';
import { fbm, noise, smooth, lerp, clamp, rng, WAVES, TAU, SEA } from './util.js';
import { Mesher, MAT, box, cyl, cone, ball } from './geo.js';
import { staticFigure } from './character.js';

export const PAL = {
  fog: 0xb6b09d, zenith: 0x3a5d76, horizon: 0xcdbd9e, sun: 0xffdfae, deep: 0x0c2f3f, shallow: 0x2f8f8c, abyss: 0x0a2733,
  sand: 0xcbb98b, wetSand: 0x9c8f6c, grass: 0x586a36, dryGrass: 0x7b7a45, jungle: 0x3d5430, rock: 0x6d665b, darkRock: 0x4b4741, dirt: 0x8d7757,
  timber: 0x5c4733, darkTimber: 0x3a2e24, plank: 0x8a6d4b, plaster: 0xbcae90, white: 0xd2c9b4, stone: 0x7f7c74, slate: 0x3b3f45, tile: 0x7c4230, thatch: 0x8f7d4d,
  lit: 0xffc66e, iron: 0x2b2d30, canvas: 0xd9cdb0, red: 0x7d1f1a, copper: 0xa8643a, bone: 0xcfc7b0,
};
export const SUN_DIR = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();

const N = 84; // terrain grid resolution per island
export const platforms = []; // walkable raised rectangles: piers, and ship decks while boarding

function heightRaw(isl, x, z) {
  const d = Math.hypot(x - isl.x, z - isl.z);
  const warp = 0.78 + 0.44 * fbm(x * 0.006 + isl.seed, z * 0.006 - isl.seed, 3);
  const t = 1 - d / (isl.r * warp);
  let h;
  if (t < 0) h = Math.max(-14, -1.5 + t * 34);
  else {
    const n = fbm(x * 0.017 + isl.seed * 3.1, z * 0.017 + isl.seed, 4);
    h = -1.5 + smooth(0, 0.16, t) * 3.4 + smooth(0.14, 0.8, t) * isl.h * (0.18 + 1.5 * n * n);
  }
  for (const f of isl.flats) {
    const w = smooth(f.r * 1.4, f.r * 0.85, Math.hypot(x - f.x, z - f.z));
    if (w > 0) h = lerp(h, f.y, w);
  }
  return h;
}

export function islandAt(x, z) {
  for (const i of ISLANDS) if (Math.abs(x - i.x) < i.ext && Math.abs(z - i.z) < i.ext) return i;
  return null;
}
export function heightAt(x, z) {
  const i = islandAt(x, z);
  if (!i) return -14;
  const gx = (x - i.x + i.ext) / i.cell, gz = (z - i.z + i.ext) / i.cell;
  const ix = Math.min(N - 1, gx | 0), iz = Math.min(N - 1, gz | 0), fx = gx - ix, fz = gz - iz, H = i.grid, s = N + 1;
  return lerp(lerp(H[iz * s + ix], H[iz * s + ix + 1], fx), lerp(H[(iz + 1) * s + ix], H[(iz + 1) * s + ix + 1], fx), fz);
}
export function groundAt(x, z) {
  let h = heightAt(x, z);
  for (const p of platforms) {
    const dx = x - p.x, dz = z - p.z, s = Math.sin(p.ang), c = Math.cos(p.ang);
    if (Math.abs(dx * s + dz * c) <= p.hl && Math.abs(dx * c - dz * s) <= p.hw && p.top > h) h = p.top;
  }
  return h;
}
export function nearestIsland(x, z) {
  let best = null, bd = 1e9;
  for (const i of ISLANDS) { const d = Math.hypot(x - i.x, z - i.z) - i.r; if (d < bd) { bd = d; best = i; } }
  return { isl: best, d: bd };
}

// ---------- island planning (where things go) ----------
const SITE = { town: [0.46, 52, 2.6], hideout: [0.42, 44, 2.6], fort: [0.36, 42, 3.2], ruins: [0.2, 32, 6], crab: [0.12, 28, 2.4], islet: [0, 0, 0] };

function plan(isl) {
  isl.dir = [Math.sin(isl.land), Math.cos(isl.land)];
  isl.perp = [Math.cos(isl.land), -Math.sin(isl.land)];
  isl.ext = isl.r * 1.32; isl.cell = (isl.ext * 2) / N;
  const [k, fr, fy] = SITE[isl.kind];
  isl.site = { x: isl.x + isl.dir[0] * isl.r * k, z: isl.z + isl.dir[1] * isl.r * k };
  isl.flats = fr ? [{ x: isl.site.x, z: isl.site.z, r: fr, y: fy }] : [];
  if (isl.kind === 'town') { // a bandit camp on the far side
    isl.camp = { x: isl.x - isl.dir[0] * isl.r * 0.42, z: isl.z - isl.dir[1] * isl.r * 0.42 };
    isl.flats.push({ x: isl.camp.x, z: isl.camp.z, r: 14, y: 4 });
  }
  isl.grid = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) isl.grid[j * (N + 1) + i] = heightRaw(isl, isl.x - isl.ext + i * isl.cell, isl.z - isl.ext + j * isl.cell);

  // landing beach: walk in from the sea along the landing bearing until dry sand
  let ld = isl.ext;
  for (; ld > 0; ld -= 1) if (heightAt(isl.x + isl.dir[0] * ld, isl.z + isl.dir[1] * ld) > 0.9) break;
  const at = (d, side = 0) => ({ x: isl.x + isl.dir[0] * d + isl.perp[0] * side, z: isl.z + isl.dir[1] * d + isl.perp[1] * side });
  isl.landing = at(ld - 2);
  isl.pier = Object.assign(at(ld + 15), { ang: isl.land, hl: 18, hw: 1.8, top: 1.3 });
  isl.boat = at(ld + 30);
  isl.anchor = Object.assign(at(ld + 46, 12), { heading: isl.land + Math.PI / 2 });
  platforms.push(isl.pier);

  isl.colliders = []; isl.npcs = []; isl.chests = []; isl.digs = []; isl.spawns = []; isl.plots = [];
  const R = rng(isl.seed * 977);
  isl.rand = R;
  const local = (u, v) => ({ x: isl.site.x + isl.dir[0] * u + isl.perp[0] * v, z: isl.site.z + isl.dir[1] * u + isl.perp[1] * v });
  isl.local = local;
  const spot = (minH, maxH, avoid = 16) => {
    for (let n = 0; n < 200; n++) {
      const a = R() * TAU, d = Math.sqrt(R()) * isl.r, x = isl.x + Math.sin(a) * d, z = isl.z + Math.cos(a) * d, h = heightAt(x, z);
      if (h < minH || h > maxH) continue;
      if (Math.hypot(x - isl.landing.x, z - isl.landing.z) < avoid * 2) continue;
      if (isl.flats.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 4)) continue;
      return { x, z };
    }
    return { x: isl.x, z: isl.z };
  };
  isl.spot = spot;
  for (let i = 0; i < 2; i++) isl.digs.push(spot(1.2, 9));
  const nChest = isl.kind === 'islet' ? 1 : 3;
  for (let i = 0; i < nChest; i++) isl.chests.push(Object.assign(spot(2, 40), { id: `${isl.id}:${i}`, tier: isl.kind === 'town' ? 1 : 2 }));

  const sp = (foe, p) => isl.spawns.push({ foe, x: p.x, z: p.z });
  if (isl.kind === 'town') {
    for (let i = 0; i < 3; i++) sp('brigand', { x: isl.camp.x + Math.sin(i * 2.1) * 5, z: isl.camp.z + Math.cos(i * 2.1) * 5 });
    isl.chests.push({ x: isl.camp.x, z: isl.camp.z, id: `${isl.id}:camp`, tier: 2 });
  } else if (isl.kind === 'ruins') {
    for (let i = 0; i < 9; i++) sp('skeleton', local(Math.sin(i * 0.7) * (10 + (i % 3) * 7), Math.cos(i * 0.7) * (10 + (i % 3) * 7)));
    sp('brute', local(-4, 0));
    isl.chests.push(Object.assign(local(-9, 0), { id: 'bones:idol', tier: 4 }));
  } else if (isl.kind === 'crab') {
    for (let i = 0; i < 8; i++) sp('crab', spot(0.6, 3, 6));
    sp('crabking', local(0, 0));
    isl.chests.push(Object.assign(local(-10, 4), { id: 'crab:hoard', tier: 3 }));
  } else if (isl.kind === 'fort') {
    [[14, 10], [14, -10], [4, 16], [4, -16], [-6, 6]].forEach((p) => sp('brigand', local(p[0], p[1])));
    [[20, 14], [20, -14], [-12, -12]].forEach((p) => sp('marksman', local(p[0], p[1])));
    sp('brute', local(-8, -4)); sp('captain', local(-14, 2));
    isl.vault = local(-19, 0);
  } else if (isl.id === 'tooth') {
    for (let i = 0; i < 3; i++) sp('skeleton', { x: isl.chests[0].x + Math.sin(i * 2.1) * 4, z: isl.chests[0].z + Math.cos(i * 2.1) * 4 });
    isl.chests[0].tier = 3;
  } else if (isl.id === 'gull') {
    for (let i = 0; i < 2; i++) sp('crab', spot(0.6, 3, 4));
  } else if (isl.kind === 'hideout') {
    Object.keys(BUILDINGS).forEach((id, i) => { const a = (i / 6) * TAU + 0.5; isl.plots.push(Object.assign(local(Math.sin(a) * 26, Math.cos(a) * 26), { id, face: a })); });
  }
}

// ---------- terrain mesh ----------
function terrainMesh(isl) {
  const s = N + 1, pos = new Float32Array(s * s * 3), col = new Float32Array(s * s * 3), idx = [];
  const c = new THREE.Color(), c2 = new THREE.Color(), H = isl.grid;
  const tintA = isl.kind === 'ruins' ? PAL.jungle : isl.kind === 'crab' ? PAL.dryGrass : PAL.grass;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const k = j * s + i, x = isl.x - isl.ext + i * isl.cell, z = isl.z - isl.ext + j * isl.cell, h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    const hx = H[j * s + Math.min(N, i + 1)] - H[j * s + Math.max(0, i - 1)], hz = H[Math.min(N, j + 1) * s + i] - H[Math.max(0, j - 1) * s + i];
    const slope = Math.hypot(hx, hz) / (2 * isl.cell), n = noise(x * 0.09, z * 0.09);
    if (h < 0.1) c.set(PAL.wetSand).lerp(c2.set(PAL.abyss), smooth(0.1, -7, h));
    else if (h < 1.7) c.set(PAL.sand).lerp(c2.set(PAL.wetSand), smooth(0.9, 0.1, h) * 0.8);
    else {
      c.set(tintA).lerp(c2.set(PAL.dryGrass), n * 0.6);
      c.lerp(c2.set(PAL.sand), smooth(2.6, 1.7, h));
      c.lerp(c2.set(isl.kind === 'fort' ? 0x6a4a3c : PAL.rock), smooth(0.45, 0.8, slope));
      c.lerp(c2.set(PAL.darkRock), smooth(isl.h * 0.75, isl.h * 1.1, h) * 0.7);
    }
    for (const f of isl.flats) c.lerp(c2.set(PAL.dirt), smooth(f.r, f.r * 0.6, Math.hypot(x - f.x, z - f.z)) * 0.85);
    const v = 0.93 + n * 0.14;
    col[k * 3] = c.r * v; col[k * 3 + 1] = c.g * v; col[k * 3 + 2] = c.b * v;
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * s + i, b = a + 1, d = a + s, e = d + 1;
    if (Math.max(H[a], H[b], H[d], H[e]) < -13.5) continue;
    if ((i + j) & 1) idx.push(a, d, b, b, d, e); else idx.push(a, d, e, a, e, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, MAT);
}

// ---------- reusable prop geometry ----------
function palmGeo() {
  const m = new Mesher();
  let x = 0, y = 0;
  for (let i = 0; i < 4; i++) { const lean = 0.1 + i * 0.07; m.add(cyl(0.2 - i * 0.025, 0.24 - i * 0.025, 1.9, 5), 0x6e5a40, [x + Math.sin(lean) * 0.9, y + 0.9, 0], [0, 0, -lean]); x += Math.sin(lean) * 1.8; y += Math.cos(lean) * 1.8; }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, droop = 0.35 + (i % 2) * 0.3, L = 3.4;
    const g = cone(0.55, L, 4); g.scale(1, 1, 0.16); g.translate(0, L / 2, 0);
    m.add(g, i % 2 ? 0x46602f : 0x567236, [x, y, 0], [0, a, -(Math.PI / 2 + droop) + Math.PI], 1, 0.12);
  }
  m.add(ball(0.32), 0x4a3a28, [x, y - 0.1, 0]);
  return m.build();
}
function treeGeo() {
  const m = new Mesher();
  m.add(cyl(0.22, 0.38, 4.2, 5), 0x4f4030, [0, 2.1, 0]);
  m.add(ball(2.3), 0x35502d, [0, 5.2, 0], [0.3, 0.2, 0], [1, 0.72, 1], 0.14);
  m.add(ball(1.6), 0x40602f, [1.3, 4.3, 0.6], [0, 1, 0], [1, 0.7, 1], 0.14);
  m.add(ball(1.5), 0x2f4a2b, [-1.2, 4.5, -0.7], [1, 0, 0], [1, 0.7, 1], 0.14);
  return m.build();
}
function rockGeo() { const m = new Mesher(); m.add(new THREE.DodecahedronGeometry(1, 0), 0x77706a, [0, 0.3, 0], [0.4, 0.2, 0.1], [1, 0.7, 0.85], 0.1); return m.build(); }
function bushGeo() { const m = new Mesher(); m.add(ball(1), 0x4a6232, [0, 0.45, 0], [0, 0, 0], [1, 0.6, 1], 0.14); m.add(ball(0.7), 0x3c5530, [0.7, 0.35, 0.3], [1, 1, 0], [1, 0.6, 1], 0.14); return m.build(); }

function scatter(group, isl, geo, count, minH, maxH, sMin, sMax, colR) {
  const mesh = new THREE.InstancedMesh(geo, MAT, count), d = new THREE.Object3D(), R = isl.rand;
  let n = 0;
  for (let i = 0; i < count; i++) {
    const p = isl.spot(minH, maxH, 5);
    if (p.x === isl.x && p.z === isl.z) continue;
    d.position.set(p.x, heightAt(p.x, p.z) - 0.05, p.z); d.rotation.set(0, R() * TAU, 0); d.scale.setScalar(lerp(sMin, sMax, R())); d.updateMatrix();
    mesh.setMatrixAt(n++, d.matrix);
    if (colR) isl.colliders.push({ x: p.x, z: p.z, r: colR * d.scale.x });
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  group.add(mesh);
}

// ---------- structures ----------
function house(m, isl, p, w, d, h, wall, roof, o = {}) {
  const y = heightAt(p.x, p.z) - 0.2, rot = o.rot ?? Math.atan2(isl.site.x - p.x, isl.site.z - p.z), fx = Math.sin(rot), fz = Math.cos(rot);
  m.add(box(w, h + 0.4, d), wall, [p.x, y + h / 2, p.z], [0, rot, 0], 1, 0.08);
  const rg = cone(0.7071, 1, 4); rg.rotateY(Math.PI / 4);
  const rh = o.roofH ?? Math.min(w, d) * 0.55;
  m.add(rg, roof, [p.x, y + h + 0.2 + rh / 2, p.z], [0, rot, 0], [w * 1.16, rh, d * 1.16], 0.1);
  m.add(box(1.2, 2, 0.2), PAL.darkTimber, [p.x + fx * (d / 2), y + 1.2, p.z + fz * (d / 2)], [0, rot, 0]);
  const wn = Math.max(1, Math.floor(w / 3.2));
  for (let i = 0; i < wn; i++) for (let f = 0; f < (h > 5 ? 2 : 1); f++) {
    const off = (i - (wn - 1) / 2) * 2.6 + (wn === 1 ? 1.9 : 0);
    if (f === 0 && Math.abs(off) < 1.2) continue;
    m.add(box(0.8, 0.9, 0.16), o.dark ? PAL.iron : PAL.lit, [p.x + fx * (d / 2) + fz * off, y + 1.9 + f * 2.7, p.z + fz * (d / 2) - fx * off], [0, rot, 0], 1, 0);
  }
  if (o.chimney) m.add(box(0.9, 2.4, 0.9), PAL.stone, [p.x - fz * w * 0.3, y + h + 1.3, p.z + fx * w * 0.3], [0, rot, 0]);
  isl.colliders.push({ x: p.x, z: p.z, r: Math.max(w, d) * 0.52 });
  return { front: { x: p.x + fx * (d / 2 + 2.2), z: p.z + fz * (d / 2 + 2.2) }, rot };
}
function barrel(m, x, z, s = 1) { m.add(cyl(0.38 * s, 0.38 * s, 0.9 * s, 7), PAL.timber, [x, heightAt(x, z) + 0.45 * s, z]); }
function crate(m, x, z, s = 1, rot = 0) { m.add(box(0.9 * s, 0.9 * s, 0.9 * s), PAL.plank, [x, heightAt(x, z) + 0.45 * s, z], [0, rot, 0]); }
function lamp(m, x, z) { const y = heightAt(x, z); m.add(cyl(0.07, 0.09, 3, 5), PAL.iron, [x, y + 1.5, z]); m.add(box(0.36, 0.44, 0.36), PAL.lit, [x, y + 3.1, z], [0, 0, 0], 1, 0); m.add(cone(0.34, 0.26, 4), PAL.iron, [x, y + 3.45, z]); }

function pier(m, isl) {
  const p = isl.pier, s = Math.sin(p.ang), c = Math.cos(p.ang);
  m.add(box(p.hw * 2, 0.25, p.hl * 2), PAL.plank, [p.x, p.top - 0.13, p.z], [0, p.ang, 0], 1, 0.1);
  for (let u = -p.hl + 1; u <= p.hl; u += 5.6) for (const v of [-p.hw + 0.2, p.hw - 0.2]) {
    const x = p.x + s * u + c * v, z = p.z + c * u - s * v, top = p.top + (u > p.hl - 2 ? 1.1 : 0.3), bottom = Math.min(heightAt(x, z), -0.5) - 0.6;
    m.add(cyl(0.2, 0.22, top - bottom, 5), PAL.darkTimber, [x, (top + bottom) / 2, z]);
  }
  // rowboat at the pier head
  const b = isl.boat;
  m.add(box(1.5, 0.5, 3.6), PAL.timber, [b.x + c * 2.6, 0.15, b.z - s * 2.6], [0, p.ang, 0]);
  m.add(box(1.1, 0.2, 3.1), PAL.darkTimber, [b.x + c * 2.6, 0.36, b.z - s * 2.6], [0, p.ang, 0]);
}

function town(m, isl, group) {
  const L = isl.local, theme = isl.id === 'regal' ? { wall: PAL.white, roof: PAL.tile, alt: PAL.stone } : isl.id === 'shoals' ? { wall: PAL.darkTimber, roof: 0x2d2b2a, alt: PAL.timber } : { wall: PAL.plaster, roof: PAL.slate, alt: PAL.timber };
  const npc = (kind, name, role, b, look) => {
    const fig = staticFigure(look); fig.position.set(b.front.x, heightAt(b.front.x, b.front.z), b.front.z); fig.rotation.y = b.rot; group.add(fig);
    isl.npcs.push({ id: `${isl.id}:${kind}`, kind, name, role, x: b.front.x, z: b.front.z }); isl.colliders.push({ x: b.front.x, z: b.front.z, r: 0.5 });
  };
  const names = { saltmere: ['Mara', 'Old Tobias', 'Brenna', 'Quill'], regal: ['Mr. Finch', 'Master Hale', 'Sgt. Dobbs', 'Widow Ames'], shoals: ['One-Eye Sal', 'Rook', 'The Dutchman', 'Nan'] }[isl.id];
  npc('tavern', names[0], 'Tavern keeper', house(m, isl, L(-24, 0), 13, 9, 6.2, theme.wall, theme.roof, { chimney: true }), 'keeper');
  npc('shipwright', names[1], 'Shipwright', house(m, isl, L(22, -24), 10, 7, 3.8, theme.alt, theme.roof), 'wright');
  npc('smith', names[2], 'Blacksmith', house(m, isl, L(-4, -30), 8, 7, 3.6, PAL.stone, theme.roof, { chimney: true, dark: true }), 'smith');
  npc('market', names[3], 'Merchant', house(m, isl, L(-2, 30), 9, 6, 3.4, theme.wall, PAL.thatch), 'merchant');
  [[-38, 24, 7, 6, 3.4], [-40, -22, 6, 6, 3.6], [-44, 2, 6, 7, 5.6], [20, 28, 7, 5, 3.2], [36, 6, 5, 5, 3]].forEach(([u, v, w, d, h], i) => house(m, isl, L(u, v), w, d, h, i % 2 ? theme.alt : theme.wall, i % 2 ? PAL.thatch : theme.roof));
  // well, lamps, clutter
  const c = L(2, 0), cy = heightAt(c.x, c.z);
  m.add(cyl(1.3, 1.4, 0.9, 8), PAL.stone, [c.x, cy + 0.45, c.z]); m.add(cyl(0.09, 0.09, 2.4, 4), PAL.timber, [c.x - 1.1, cy + 1.6, c.z]); m.add(cyl(0.09, 0.09, 2.4, 4), PAL.timber, [c.x + 1.1, cy + 1.6, c.z]); m.add(cone(1.7, 0.9, 4), PAL.slate, [c.x, cy + 3.2, c.z], [0, 0.78, 0]);
  isl.colliders.push({ x: c.x, z: c.z, r: 1.6 });
  [[10, 10], [10, -10], [-12, 12], [-12, -12], [30, -8]].forEach(([u, v]) => { const p = L(u, v); lamp(m, p.x, p.z); });
  [[14, 24, 1], [15.2, 24.6, 0.8], [26, -14, 1], [-16, 6, 1], [28, -16, 0.9]].forEach(([u, v, s]) => { const p = L(u, v); barrel(m, p.x, p.z, s); });
  [[5, 33, 1], [6.3, 33.4, 0.7], [27, -20, 1.1], [-10, -25, 0.8]].forEach(([u, v, s], i) => { const p = L(u, v); crate(m, p.x, p.z, s, i); });
  // market awning, ship frame on the slip
  const a = L(4, 25), ay = heightAt(a.x, a.z);
  m.add(box(5, 0.12, 3), isl.id === 'regal' ? 0x2f5d63 : PAL.red, [a.x, ay + 2.5, a.z], [0.18, Math.atan2(isl.site.x - a.x, isl.site.z - a.z), 0]);
  const sl = L(32, -26), sy = heightAt(sl.x, sl.z);
  for (let i = -3; i <= 3; i++) m.add(box(0.25, 1.6 - Math.abs(i) * 0.15, 3.4 - Math.abs(i) * 0.4), PAL.plank, [sl.x + isl.perp[0] * i * 1.3, sy + 1, sl.z + isl.perp[1] * i * 1.3], [0, isl.land + Math.PI / 2, 0]);
  m.add(box(0.4, 0.4, 9), PAL.timber, [sl.x, sy + 0.3, sl.z], [0, isl.land + Math.PI / 2, 0]);
  if (isl.id === 'regal') { // navy watchtower with a flag
    const t = L(-6, 0), ty = heightAt(t.x, t.z);
    const w = L(-52, -34); m.add(cyl(3.2, 3.8, 12, 8), PAL.stone, [w.x, heightAt(w.x, w.z) + 6, w.z]); m.add(cyl(3.7, 3.7, 1.2, 8), PAL.stone, [w.x, heightAt(w.x, w.z) + 12.4, w.z]);
    m.add(cyl(0.08, 0.08, 6, 4), PAL.timber, [w.x, heightAt(w.x, w.z) + 16, w.z]); m.add(box(2.4, 1.4, 0.06), 0x27406b, [w.x + 1.25, heightAt(w.x, w.z) + 18.2, w.z]);
    isl.colliders.push({ x: w.x, z: w.z, r: 4 }); void t; void ty;
  }
  // bandit camp
  const k = isl.camp, ky = heightAt(k.x, k.z);
  m.add(cone(2.4, 2.6, 4), 0x6f6448, [k.x + 5, ky + 1.3, k.z + 2], [0, 0.5, 0]); m.add(cone(2.2, 2.4, 4), 0x5d5540, [k.x - 4, ky + 1.2, k.z + 4], [0, 1.2, 0]);
  m.add(cone(0.7, 0.9, 5), 0xff9a3c, [k.x + 1.5, ky + 0.45, k.z - 3], [0, 0, 0], 1, 0); m.add(cyl(1, 1.1, 0.25, 7), PAL.darkRock, [k.x + 1.5, ky + 0.1, k.z - 3]);
}

function fort(m, isl) {
  const s = isl.site, gate = isl.land;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * TAU; if (Math.abs(((a - gate + Math.PI * 3) % TAU) - Math.PI) < 0.17) continue;
    const x = s.x + Math.sin(a) * 31, z = s.z + Math.cos(a) * 31, y = heightAt(x, z), hgt = 4.4 + (i % 3) * 0.3;
    m.add(cyl(0.12, 0.62, hgt, 5), i % 2 ? PAL.timber : PAL.darkTimber, [x, y + hgt / 2 - 0.3, z], [0, i, 0], 1, 0.1);
    if (i % 2 === 0) isl.colliders.push({ x, z, r: 1.15 });
  }
  for (const side of [-1, 1]) { // gate towers
    const a = gate + side * 0.26, x = s.x + Math.sin(a) * 31, z = s.z + Math.cos(a) * 31, y = heightAt(x, z);
    m.add(box(3.4, 8, 3.4), PAL.darkTimber, [x, y + 4, z], [0, a, 0], 1, 0.1); m.add(cone(3, 2.2, 4), 0x2d2b2a, [x, y + 9.1, z], [0, a + 0.78, 0]);
    m.add(box(1.6, 1.1, 0.06), PAL.red, [x, y + 11, z], [0, a, 0]);
    isl.colliders.push({ x, z, r: 2.3 });
  }
  house(m, isl, isl.local(-24, 0), 12, 8, 5.2, PAL.darkTimber, 0x2d2b2a, { dark: true });
  [[6, 12], [0, -14], [-10, 14]].forEach(([u, v], i) => { const p = isl.local(u, v), y = heightAt(p.x, p.z); m.add(cone(2.6, 2.8, 4), i % 2 ? 0x5d5540 : 0x6b3a30, [p.x, y + 1.4, p.z], [0, i, 0]); isl.colliders.push({ x: p.x, z: p.z, r: 1.8 }); });
  [[8, -4], [9.2, -3], [-4, 10], [-16, -8], [-15, -9.3]].forEach(([u, v], i) => { const p = isl.local(u, v); i % 2 ? crate(m, p.x, p.z, 1, i) : barrel(m, p.x, p.z); });
}

function ruins(m, isl) {
  const s = isl.site;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, x = s.x + Math.sin(a) * 19, z = s.z + Math.cos(a) * 19, y = heightAt(x, z), broken = i % 3 === 1, hgt = broken ? 2.6 : 7;
    m.add(cyl(0.75, 0.9, hgt, 7), 0x8a857a, [x, y + hgt / 2, z], [0, 0, 0], 1, 0.1); m.add(box(2.1, 0.5, 2.1), 0x79756b, [x, y + 0.25, z]);
    if (!broken) m.add(box(2.2, 0.6, 2.2), 0x79756b, [x, y + hgt + 0.3, z]);
    else m.add(cyl(0.75, 0.75, 2.4, 7), 0x8a857a, [x + 2.2, y + 0.7, z + 1], [1.5, a, 0.2]);
    isl.colliders.push({ x, z, r: 1.2 });
  }
  const p = isl.local(-13, 0), y = heightAt(p.x, p.z);
  for (let i = 0; i < 4; i++) m.add(box(12 - i * 2.4, 0.7, 9 - i * 1.6), i % 2 ? 0x79756b : 0x8a857a, [p.x, y + 0.35 + i * 0.7, p.z], [0, isl.land, 0], 1, 0.08);
  isl.colliders.push({ x: p.x - isl.dir[0] * 2, z: p.z - isl.dir[1] * 2, r: 3 });
  const R = isl.rand;
  for (let i = 0; i < 7; i++) { const q = isl.local((R() - 0.5) * 44, (R() - 0.5) * 44), qy = heightAt(q.x, q.z); m.add(box(1.4, 0.8, 0.3), 0x6f6b62, [q.x, qy + 0.4, q.z], [0.1, R() * 3, 0.1]); }
}

function crabNest(m, isl) {
  const s = isl.site, R = isl.rand;
  for (let i = 0; i < 9; i++) { const a = R() * TAU, d = 8 + R() * 16, x = s.x + Math.sin(a) * d, z = s.z + Math.cos(a) * d; m.add(ball(0.8 + R() * 0.7), 0xb9a98a, [x, heightAt(x, z) + 0.2, z], [R(), R(), 0], [1, 0.7, 1]); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, x = s.x + Math.sin(a) * 24, z = s.z + Math.cos(a) * 24, y = heightAt(x, z); m.add(cone(0.7, 5 + (i % 2) * 2, 5), PAL.bone, [x, y + 2.2, z], [0.25 * Math.cos(a), 0, -0.25 * Math.sin(a)]); }
}

// Hideout buildings are rebuilt whenever the save changes.
const BUILD_DRAW = {
  vault(m, l) { m.add(box(5 + l, 3 + l * 0.5, 5 + l), PAL.stone, [0, 1.5 + l * 0.25, 0], [0, 0, 0], 1, 0.1); m.add(box(1.4, 2.1, 0.3), PAL.iron, [0, 1.05, 2.5 + l * 0.5]); m.add(box(5.6 + l, 0.5, 5.6 + l), PAL.darkRock, [0, 3.2 + l * 0.5, 0]); },
  lumber(m, l) { m.add(box(5, 0.2, 4), PAL.thatch, [0, 2.8, 0], [0.12, 0, 0]); for (const [x, z] of [[-2.2, -1.7], [2.2, -1.7], [-2.2, 1.7], [2.2, 1.7]]) m.add(cyl(0.14, 0.14, 2.9, 5), PAL.timber, [x, 1.45, z]); for (let i = 0; i < 3 + l * 3; i++) m.add(cyl(0.3, 0.3, 3.6, 6), i % 2 ? PAL.timber : 0x7a6247, [3.6 + (i % 3) * 0.62 - Math.floor(i / 3) * 0.3 * 0, 0.3 + Math.floor(i / 3) * 0.55, (i % 2) * 0.1], [Math.PI / 2, 0, 0]); },
  mine(m, l) { m.add(ball(3.6 + l * 0.4), PAL.rock, [0, 0.9, -1.5], [0.4, 0.3, 0], [1.2, 0.8, 1], 0.12); m.add(box(2.4, 2.4, 0.5), 0x121212, [0, 1.2, 1.3], [0, 0, 0], 1, 0); m.add(box(0.3, 2.6, 0.5), PAL.timber, [-1.3, 1.3, 1.5]); m.add(box(0.3, 2.6, 0.5), PAL.timber, [1.3, 1.3, 1.5]); m.add(box(3.1, 0.3, 0.5), PAL.timber, [0, 2.6, 1.5]); for (let i = 0; i < l; i++) m.add(box(1, 0.7, 1.4), PAL.iron, [2.6 + i * 1.3, 0.5, 3]); },
  still(m, l) { m.add(box(4.4, 2.8, 3.6), PAL.timber, [-1, 1.4, 0], [0, 0, 0], 1, 0.1); const r = cone(0.7071, 1, 4); r.rotateY(Math.PI / 4); m.add(r, PAL.thatch, [-1, 3.5, 0], [0, 0, 0], [5.2, 1.6, 4.3]); m.add(cyl(0.8, 1, 1.6 + l * 0.3, 8), PAL.copper, [2.6, 0.8 + l * 0.15, 0.4]); m.add(cone(0.8, 1, 8), PAL.copper, [2.6, 2.1 + l * 0.3, 0.4]); for (let i = 0; i < l * 2; i++) m.add(cyl(0.38, 0.38, 0.9, 7), 0x6b4a30, [2 + (i % 3) * 0.85, 0.45, 2.4 + Math.floor(i / 3) * 0.8]); },
  quarters(m, l) { m.add(box(5 + l * 1.5, 2.8, 4.2), PAL.plank, [0, 1.4, 0], [0, 0, 0], 1, 0.1); const r = cone(0.7071, 1, 4); r.rotateY(Math.PI / 4); m.add(r, PAL.slate, [0, 3.7, 0], [0, 0, 0], [6 + l * 1.7, 1.8, 5]); m.add(box(1.1, 1.9, 0.2), PAL.darkTimber, [0, 0.95, 2.1]); m.add(box(0.8, 0.8, 0.16), PAL.lit, [1.8, 1.7, 2.1], [0, 0, 0], 1, 0); },
  battery(m, l) { m.add(cyl(3.6, 4, 1.4, 8), PAL.stone, [0, 0.7, 0], [0, 0, 0], 1, 0.1); for (let i = 0; i < l; i++) { const x = (i - (l - 1) / 2) * 1.9; m.add(cyl(0.2, 0.28, 2.2, 6), PAL.iron, [x, 1.9, 1.6], [Math.PI / 2 - 0.12, 0, 0]); m.add(box(0.8, 0.5, 1.1), PAL.timber, [x, 1.6, 1]); } },
};
export function refreshBase(world, save) {
  const isl = world.byId.rest;
  if (world.baseMesh) { world.scene.remove(world.baseMesh); world.baseMesh.geometry.dispose(); }
  isl.colliders = isl.colliders.filter((c) => !c.base);
  const all = new Mesher();
  for (const p of isl.plots) {
    const lvl = save.base.b[p.id] || 0, y = heightAt(p.x, p.z), m = new Mesher();
    if (lvl) { BUILD_DRAW[p.id](m, lvl); isl.colliders.push({ x: p.x, z: p.z, r: 3.4, base: true }); }
    else { for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) m.add(cyl(0.08, 0.1, 1.1, 4), PAL.timber, [x, 0.55, z]); m.add(box(1.3, 0.8, 0.1), PAL.plank, [0, 1.5, 3.4]); m.add(cyl(0.07, 0.07, 1.8, 4), PAL.timber, [0, 0.9, 3.4]); }
    const g = m.build(); g.rotateY(p.face + Math.PI); g.translate(p.x, y - 0.1, p.z); all.parts.push(g);
  }
  const s = isl.site, sy = heightAt(s.x, s.z);
  all.add(cyl(1.2, 1.3, 0.3, 7), PAL.darkRock, [s.x, sy + 0.1, s.z]); all.add(cone(0.8, 1.1, 5), 0xff9a3c, [s.x, sy + 0.7, s.z], [0, 0, 0], 1, 0);
  all.add(cyl(0.1, 0.12, 9, 5), PAL.timber, [s.x + 4, sy + 4.5, s.z]); all.add(box(2.6, 1.6, 0.06), 0x161616, [s.x + 5.35, sy + 8, s.z]);
  world.baseMesh = all.mesh(); world.scene.add(world.baseMesh);
}

export function chestMesh(tier = 1) {
  const g = new THREE.Group(), wood = tier >= 3 ? 0x3f2c22 : PAL.timber, band = tier >= 3 ? 0xc79a3a : PAL.iron;
  const b = new Mesher(); b.add(box(1, 0.5, 0.64), wood, [0, 0.25, 0]); b.add(box(1.04, 0.1, 0.68), band, [0, 0.42, 0]); b.add(box(0.14, 0.5, 0.68), band, [-0.33, 0.25, 0]); b.add(box(0.14, 0.5, 0.68), band, [0.33, 0.25, 0]);
  const l = new Mesher(); l.add(box(1, 0.24, 0.64), wood, [0, 0.12, 0.32]); l.add(box(0.14, 0.26, 0.68), band, [-0.33, 0.12, 0.32]); l.add(box(0.14, 0.26, 0.68), band, [0.33, 0.12, 0.32]); l.add(box(0.16, 0.2, 0.08), band, [0, 0.02, 0.66]);
  const lid = l.mesh(); lid.position.set(0, 0.5, -0.32);
  g.add(b.mesh(), lid); g.userData.lid = lid;
  return g;
}

// ---------- sky and ocean ----------
const WAVE_GLSL = WAVES.map((w, i) => `  { vec2 d = vec2(${w[0].toFixed(3)}, ${w[1].toFixed(3)}); float k = ${(TAU / w[2]).toFixed(5)}; float ph = dot(p, d) * k + uTime * ${(w[4] * TAU / w[2]).toFixed(5)}; h += ${w[3].toFixed(3)} * sin(ph); g += d * (${w[3].toFixed(3)} * k * cos(ph)); }`).join('\n');
const OCEAN_VERT = `
uniform float uTime; uniform float uAmp; varying vec3 vW; varying float vH;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0); vec2 p = wp.xz; float h = 0.0; vec2 g = vec2(0.0);
${WAVE_GLSL}
  h *= uAmp;
  wp.y += h; vH = h; vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const OCEAN_FRAG = `
uniform float uTime; uniform float uAmp; uniform vec3 uSun, uSunCol, uDeep, uShallow, uZenith, uHorizon, uFog; uniform float uFogD; uniform vec3 uIsles[${ISLANDS.length}];
varying vec3 vW; varying float vH;
void main() {
  vec2 p = vW.xz; float h = 0.0; vec2 g = vec2(0.0);
${WAVE_GLSL}
  g *= uAmp;
  float dist = length(cameraPosition - vW);
  float det = 1.0 / (1.0 + dist * 0.012);
  for (int i = 0; i < 6; i++) {
    float fi = float(i); vec2 d = vec2(cos(fi * 2.4 + 0.7), sin(fi * 2.4 + 0.7)); float k = 0.55 + fi * 0.33;
    g += d * (0.085 * det * cos(dot(p, d) * k + uTime * (1.1 + fi * 0.37)));
  }
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(cameraPosition - vW);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 r = reflect(-v, n); r.y = abs(r.y);
  vec3 sky = mix(uHorizon, uZenith, clamp(r.y * 1.5, 0.0, 1.0));
  float shore = 0.0;
  for (int i = 0; i < ${ISLANDS.length}; i++) { float d = distance(p, uIsles[i].xy); shore = max(shore, 1.0 - smoothstep(uIsles[i].z * 0.8, uIsles[i].z * 1.25, d)); }
  vec3 base = mix(uDeep, uShallow, clamp(vH * 0.22 + 0.16 + shore * 0.55, 0.0, 1.0));
  base *= 0.75 + 0.35 * max(dot(n, uSun), 0.0);
  vec3 col = mix(base, sky, fres * 0.8);
  col += uSunCol * (pow(max(dot(r, uSun), 0.0), 220.0) * 1.6 + pow(max(dot(r, uSun), 0.0), 24.0) * 0.12);
  float crest = smoothstep(0.62 * uAmp, 1.05 * uAmp, vH + g.x * 0.5) * clamp(0.35 + 0.65 * sin(p.x * 1.7 + p.y * 2.3 + uTime) * sin(p.x * -0.83 + p.y * 1.21 - uTime * 0.7), 0.0, 1.0);
  col = mix(col, vec3(0.92, 0.94, 0.9), crest * 0.5 * det * 2.0);
  float f = 1.0 - exp(-uFogD * uFogD * dist * dist);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, mix(mix(0.74, 0.98, fres), 1.0, f));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const SKY_FRAG = `
uniform vec3 uSun, uSunCol, uZenith, uHorizon, uFog; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir); float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.55));
  float s = max(dot(d, uSun), 0.0);
  col += uSunCol * (pow(s, 900.0) * 3.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.18);
  col = mix(uFog, col, smoothstep(-0.02, 0.16, y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function oceanGeo(half, seg) {
  const s = seg + 1, pos = new Float32Array(s * s * 3), idx = [];
  const w = (u) => Math.sign(u) * Math.pow(Math.abs(u), 1.7) * half;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const k = (j * s + i) * 3; pos[k] = w((i / seg) * 2 - 1); pos[k + 1] = 0; pos[k + 2] = w((j / seg) * 2 - 1); }
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * s + i; idx.push(a, a + s, a + 1, a + 1, a + s, a + s + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}

export function createWorld(scene) {
  const world = { scene, byId: {}, time: 0 };
  const C = (h) => new THREE.Color(h);
  scene.fog = new THREE.FogExp2(PAL.fog, 0.00135);
  scene.background = C(PAL.fog);
  const hemi = new THREE.HemisphereLight(0xdfe6ea, 0x7a7060, 2.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.5); sun.position.copy(SUN_DIR).multiplyScalar(100); scene.add(sun);

  const shared = { uAmp: { value: 1 }, uTime: { value: 0 }, uSun: { value: SUN_DIR }, uSunCol: { value: C(PAL.sun) }, uZenith: { value: C(PAL.zenith) }, uHorizon: { value: C(PAL.horizon) }, uFog: { value: C(PAL.fog) } };
  world.sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 24, 12), new THREE.ShaderMaterial({ uniforms: shared, side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: SKY_FRAG }));
  world.sky.renderOrder = -10; world.sky.frustumCulled = false; scene.add(world.sky);

  for (const isl of ISLANDS) plan(isl);
  world.ocean = new THREE.Mesh(oceanGeo(2600, 150), new THREE.ShaderMaterial({
    uniforms: Object.assign({ uDeep: { value: C(PAL.deep) }, uShallow: { value: C(PAL.shallow) }, uFogD: { value: scene.fog.density }, uIsles: { value: ISLANDS.map((i) => new THREE.Vector3(i.x, i.z, i.r)) } }, shared),
    vertexShader: OCEAN_VERT, fragmentShader: OCEAN_FRAG, transparent: true, depthWrite: false,
  }));
  world.ocean.frustumCulled = false; world.ocean.renderOrder = 1; scene.add(world.ocean);
  world.abyss = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PAL.abyss }));
  world.abyss.position.y = -13.6; scene.add(world.abyss);

  const palm = palmGeo(), tree = treeGeo(), rock = rockGeo(), bush = bushGeo();
  for (const isl of ISLANDS) {
    world.byId[isl.id] = isl;
    const g = new THREE.Group(); isl.group = g; scene.add(g);
    g.add(terrainMesh(isl));
    const m = new Mesher();
    pier(m, isl);
    if (isl.kind === 'town') town(m, isl, g);
    if (isl.kind === 'fort') fort(m, isl);
    if (isl.kind === 'ruins') ruins(m, isl);
    if (isl.kind === 'crab') crabNest(m, isl);
    g.add(m.mesh());
    const dense = isl.kind === 'ruins' ? 1.5 : isl.kind === 'crab' || isl.kind === 'islet' ? 0.5 : 1;
    scatter(g, isl, palm, Math.round(isl.r * 0.34 * dense), 1.3, 7, 0.8, 1.35, 0.35);
    if (isl.r > 100) scatter(g, isl, tree, Math.round(isl.r * 0.3 * dense), 5, isl.h * 0.9, 0.8, 1.5, 0.5);
    scatter(g, isl, rock, Math.round(isl.r * 0.12) + 4, 0.2, 60, 0.6, 2.4, 0.9);
    scatter(g, isl, bush, Math.round(isl.r * 0.22 * dense), 2, 30, 0.6, 1.3, 0);
  }

  // chart of the whole archipelago, used by the minimap and the map screen
  const S = 320, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = (i / S * 2 - 1) * WORLD_R, z = (j / S * 2 - 1) * WORLD_R, h = heightAt(x, z), k = (j * S + i) * 4;
    if (h > 0) { const t = clamp(h / 26, 0, 1); img.data[k] = 92 - t * 34; img.data[k + 1] = 74 - t * 30; img.data[k + 2] = 48 - t * 22; img.data[k + 3] = 255; }
    else if (h > -5) { img.data[k] = 120; img.data[k + 1] = 104; img.data[k + 2] = 70; img.data[k + 3] = 70; }
  }
  ctx.putImageData(img, 0, 0); world.chart = cv;

  // weather: 0 = fair, 1 = full storm
  const fair = { fog: C(PAL.fog), zen: C(PAL.zenith), hor: C(PAL.horizon), sun: C(PAL.sun), deep: C(PAL.deep) };
  const foul = { fog: C(0x444c52), zen: C(0x1c252c), hor: C(0x4f585c), sun: C(0x30302c), deep: C(0x081a22) };
  world.weather = 0;
  world.setWeather = (k) => {
    world.weather = k; const o = world.ocean.material.uniforms;
    shared.uFog.value.copy(fair.fog).lerp(foul.fog, k); shared.uZenith.value.copy(fair.zen).lerp(foul.zen, k); shared.uHorizon.value.copy(fair.hor).lerp(foul.hor, k);
    shared.uSunCol.value.copy(fair.sun).lerp(foul.sun, k); o.uDeep.value.copy(fair.deep).lerp(foul.deep, k);
    scene.fog.color.copy(shared.uFog.value); scene.background.copy(shared.uFog.value); scene.fog.density = 0.00135 + k * 0.0021; o.uFogD.value = scene.fog.density;
    hemi.intensity = 2.1 - k * 1.0; sun.intensity = 2.5 - k * 2.0; SEA.amp = 1 + k * 1.5; shared.uAmp.value = SEA.amp;
  };
  world.update = (dt, cam) => {
    world.time += dt; shared.uTime.value = world.time;
    world.ocean.position.set(cam.x, 0, cam.z); world.abyss.position.set(cam.x, -13.6, cam.z); world.sky.position.copy(cam);
  };
  return world;
}
