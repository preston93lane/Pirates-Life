// The static world: sky, ocean, island terrain, towns, fort, ruins, hideout. Also height and collision queries.
import * as THREE from 'three';
import { FOLK } from './data.js';
import { ISLANDS, WORLD_R, BUILDINGS } from './data.js';
import { fbm, noise, smooth, lerp, clamp, rng, WAVES, TAU, SEA } from './util.js';
import { Mesher, Kit, MAT, box, cyl, cone, ball, groundMat, setGlow } from './geo.js';
import { staticFigure } from './character.js';
import { loadGltf, placeModel } from './models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const NAT = 'medieval/nature/';

export const PAL = {
  fog: 0xb6b09d, zenith: 0x3a5d76, horizon: 0xcdbd9e, sun: 0xffdfae, deep: 0x0c2f3f, shallow: 0x2f8f8c, abyss: 0x0a2733,
  sand: 0xcbb98b, wetSand: 0x9c8f6c, grass: 0x586a36, dryGrass: 0x7b7a45, jungle: 0x3d5430, rock: 0x6d665b, darkRock: 0x4b4741, dirt: 0x8d7757,
  timber: 0x5c4733, darkTimber: 0x3a2e24, plank: 0x8a6d4b, plaster: 0xbcae90, white: 0xd2c9b4, stone: 0x7f7c74, slate: 0x3b3f45, tile: 0x7c4230, thatch: 0x8f7d4d,
  lit: 0xffc66e, iron: 0x2b2d30, canvas: 0xd9cdb0, red: 0x7d1f1a, copper: 0xa8643a, bone: 0xcfc7b0,
};
const KINDS = { [PAL.plaster]: 'plaster', [PAL.white]: 'plaster', [PAL.timber]: 'planks', [PAL.darkTimber]: 'planks', [PAL.plank]: 'planks', 0x80684c: 'planks', [PAL.stone]: 'stone', [PAL.darkRock]: 'stone', 0x8a857a: 'stone', 0x79756b: 'stone', 0x6f6b62: 'stone', [PAL.slate]: 'shingle', [PAL.tile]: 'shingle', 0x2d2b2a: 'shingle', [PAL.thatch]: 'thatch', [PAL.lit]: 'window' };
export const SUN_DIR = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();

const N = 100; // terrain grid resolution per island
export const platforms = []; // walkable raised rectangles: piers, ship decks, the cave floor
export const TAV = { x: 4200, z: 400, ang: 0, hl: 10, hw: 8, top: 3 }; // one shared tavern room
export const CAVE = { x: 4200, z: 0, ang: 0, hl: 17, hw: 11, top: 3 }; // one shared cave room, far outside the chart
const MOUNT = { bones: 1.5, tooth: 1.6, regal: 0.8, saltmere: 0.6, blood: 0.5, rest: 0.45, crab: 0.15, gull: 0.3, shoals: 0.4 };

// >0 inside the island. Several lobes make headlands; bays bite coves out of the coast.
function coast(isl, x, z) {
  const warp = 0.8 + 0.4 * fbm(x * 0.006 + isl.seed, z * 0.006 - isl.seed, 3);
  let t = -9;
  for (const L of isl.lobes) t = Math.max(t, 1 - Math.hypot(x - L.x, z - L.z) / (L.r * warp));
  for (const B of isl.bays) { const cut = 1 - Math.hypot(x - B.x, z - B.z) / (B.r * warp); if (cut > 0) t = Math.min(t, 0.1 - cut * 1.2); }
  return t;
}
function heightRaw(isl, x, z) {
  const t = coast(isl, x, z);
  let h;
  if (t < 0) h = Math.max(-14, -1.5 + t * 30);
  else {
    const n = fbm(x * 0.017 + isl.seed * 3.1, z * 0.017 + isl.seed, 4), ridge = 1 - Math.abs(2 * fbm(x * 0.0085 - isl.seed, z * 0.0085 + isl.seed * 2, 3) - 1);
    h = -1.5 + smooth(0, 0.16, t) * 3.4 + smooth(0.14, 0.8, t) * isl.h * (0.18 + 1.5 * n * n) + smooth(0.25, 0.85, t) * isl.h * (MOUNT[isl.id] || 0.3) * Math.pow(ridge, 2.2) * 1.6;
  }
  for (const f of isl.flats) {
    const w = smooth(f.r * (f.soft || 1.4), f.r * 0.85, Math.hypot(x - f.x, z - f.z));
    if (w > 0) h = lerp(h, f.y, w);
  }
  return h;
}

export function islandAt(x, z) {
  for (const i of ISLANDS) if (Math.abs(x - i.x) < i.ext && Math.abs(z - i.z) < i.ext) return i;
  return null;
}
export function heightAt(x, z) {
  let best = -14;
  for (const i of ISLANDS) {
    if (!(Math.abs(x - i.x) < i.ext && Math.abs(z - i.z) < i.ext)) continue;
    const gx = (x - i.x + i.ext) / i.cell, gz = (z - i.z + i.ext) / i.cell;
    const ix = Math.min(N - 1, gx | 0), iz = Math.min(N - 1, gz | 0), fx = gx - ix, fz = gz - iz, H = i.grid, s = N + 1;
    const h = lerp(lerp(H[iz * s + ix], H[iz * s + ix + 1], fx), lerp(H[(iz + 1) * s + ix], H[(iz + 1) * s + ix + 1], fx), fz);
    if (h > best) best = h;
  }
  return best;
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
  isl.ext = isl.r * 1.8; isl.cell = (isl.ext * 2) / N;
  // coastline: a main body plus headlands, with a cove bitten out, all kept clear of the landing beach
  const LR = rng(isl.seed * 131), off = (lo) => isl.land + (lo + LR() * (Math.PI - lo) * 0.9) * (LR() < 0.5 ? -1 : 1);
  isl.lobes = [{ x: isl.x, z: isl.z, r: isl.r }]; isl.bays = [];
  for (let i = 0; i < (isl.r > 100 ? 2 : 1); i++) { const an = off(1.15), d = isl.r * (0.55 + LR() * 0.25); isl.lobes.push({ x: isl.x + Math.sin(an) * d, z: isl.z + Math.cos(an) * d, r: isl.r * (0.42 + LR() * 0.22) }); }
  if (isl.r > 90) { const an = off(1.4), d = isl.r * 0.98; isl.bays.push({ x: isl.x + Math.sin(an) * d, z: isl.z + Math.cos(an) * d, r: isl.r * 0.34 }); }
  const [k, fr, fy] = SITE[isl.kind];
  isl.site = { x: isl.x + isl.dir[0] * isl.r * k, z: isl.z + isl.dir[1] * isl.r * k };
  isl.flats = fr ? [{ x: isl.site.x, z: isl.site.z, r: fr, y: fy }] : [];
  if (isl.kind === 'town') { // a bandit camp on the far side
    isl.camp = { x: isl.x - isl.dir[0] * isl.r * 0.42, z: isl.z - isl.dir[1] * isl.r * 0.42 };
    if (isl.id === 'regal') { isl.navy = { x: isl.camp.x, z: isl.camp.z, S: 38, rot: isl.land, name: 'Fort Regal' }; let top = 8; for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU; for (const rr of [18, 34, 48]) top = Math.max(top, heightRaw(isl, isl.camp.x + Math.sin(an) * rr, isl.camp.z + Math.cos(an) * rr)); } isl.flats.push({ x: isl.camp.x, z: isl.camp.z, r: 33, soft: 2.4, y: Math.min(44, top + 2) }); }
    else isl.flats.push({ x: isl.camp.x, z: isl.camp.z, r: 14, y: 4 });
  }
  if (isl.id === 'gull') { isl.navy = { x: isl.x, z: isl.z, S: 20, rot: isl.land, name: 'Gull Battery' }; isl.flats = [{ x: isl.x, z: isl.z, r: 18, y: 4.5 }]; }
  if (isl.navy) { const n = isl.navy, s = Math.sin(n.rot), c = Math.cos(n.rot); n.at = (lx, lz) => ({ x: n.x + s * lz + c * lx, z: n.z + c * lz - s * lx }); }
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
      const a = R() * TAU, d = Math.sqrt(R()) * isl.r * 1.55, x = isl.x + Math.sin(a) * d, z = isl.z + Math.cos(a) * d, h = heightAt(x, z);
      if (h < minH || h > maxH) continue;
      if (Math.hypot(x - isl.landing.x, z - isl.landing.z) < avoid * 2) continue;
      if (isl.flats.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 4)) continue;
      return { x, z };
    }
    return { x: isl.x, z: isl.z };
  };
  isl.spot = spot;
  for (let i = 0; i < 2; i++) isl.digs.push(spot(1.2, 9));
  isl.pois = []; for (let i = 0; i < 5; i++) isl.pois.push(spot(1.6, 30, 22)); // places where chance encounters can turn up
  if (isl.cave) isl.caveAt = spot(4, 60, 30);
  const nChest = isl.kind === 'islet' ? 1 : 3;
  for (let i = 0; i < nChest; i++) isl.chests.push(Object.assign(spot(2, 40), { id: `${isl.id}:${i}`, tier: isl.kind === 'town' ? 1 : 2 }));

  const sp = (foe, p) => isl.spawns.push({ foe, x: p.x, z: p.z });
  isl.biome = isl.jungle ? 'jungle' : isl.kind === 'crab' ? 'dry' : 'temperate';
  if (isl.navy) { // a garrison far stronger than any bandit camp
    const n = isl.navy, big = n.S > 30, h = n.S / 2 - 3.5, nv = (foe, lx, lz) => { const p = n.at(lx, lz); isl.spawns.push({ foe, x: p.x, z: p.z, navy: true }); };
    (big ? [[-8, 6], [8, 6], [-11, -3], [11, -3], [0, 1], [-4, -9], [4, -9], [0, 11]] : [[-4, 3], [4, 3], [0, -2], [0, 6]]).forEach(([x, z]) => nv('soldier', x, z));
    (big ? [[-h, h], [h, h], [-h, -h], [h, -h]] : [[-h, h], [h, h]]).forEach(([x, z]) => nv('rifleman', x, z));
    if (big) { nv('brute', -5, -12); nv('commandant', 0, -h + 4); } else nv('captain', 0, -h + 3);
    isl.navyVault = n.at(0, -h + 0.5);
  }
  if (isl.kind === 'town' && isl.navy) { /* the fort stands where a camp would be */ }
  else if (isl.kind === 'town') {
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
  // wild hostiles roam every island away from the ports, matched to its biome. Placed last so nothing else moves.
  if (isl.kind !== 'town' && isl.kind !== 'hideout' && !isl.navy) {
    const pick = isl.biome === 'jungle' ? ['brigand', 'brigand', 'marksman'] : isl.biome === 'dry' ? ['crab', 'crab', 'brigand'] : ['brigand', 'marksman', 'brigand'];
    const n = Math.max(2, Math.round(isl.r / 26));
    for (let i = 0; i < n; i++) { const p = spot(1.2, isl.h * 1.2, 16); isl.spawns.push({ foe: pick[i % pick.length], x: p.x, z: p.z, wild: true }); }
  }
}

// ---------- terrain mesh ----------
function terrainMesh(isl) {
  const s = N + 1, pos = new Float32Array(s * s * 3), col = new Float32Array(s * s * 3), uv = new Float32Array(s * s * 2), idx = [];
  const c = new THREE.Color(), c2 = new THREE.Color(), H = isl.grid;
  const tintA = isl.jungle ? PAL.jungle : isl.kind === 'crab' ? PAL.dryGrass : PAL.grass;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const k = j * s + i, x = isl.x - isl.ext + i * isl.cell, z = isl.z - isl.ext + j * isl.cell, h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uv[k * 2] = x / 9; uv[k * 2 + 1] = z / 9;
    const hx = H[j * s + Math.min(N, i + 1)] - H[j * s + Math.max(0, i - 1)], hz = H[Math.min(N, j + 1) * s + i] - H[Math.max(0, j - 1) * s + i];
    const slope = Math.hypot(hx, hz) / (2 * isl.cell), n = noise(x * 0.09, z * 0.09);
    if (h < 0.1) c.set(PAL.wetSand).lerp(c2.set(PAL.abyss), smooth(0.1, -7, h));
    else if (h < 1.7) c.set(PAL.sand).lerp(c2.set(PAL.wetSand), smooth(0.9, 0.1, h) * 0.8);
    else {
      c.set(tintA).lerp(c2.set(PAL.dryGrass), n * 0.6);
      c.lerp(c2.set(PAL.sand), smooth(2.6, 1.7, h));
      c.lerp(c2.set(isl.kind === 'fort' ? 0x6a4a3c : PAL.rock), smooth(0.45, 0.8, slope));
      c.lerp(c2.set(PAL.darkRock), smooth(isl.h * 0.8, isl.h * 1.5, h) * 0.75);
      c.lerp(c2.set(0x9a958a), smooth(isl.h * 1.7, isl.h * 2.4, h) * 0.6);
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
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, groundMat());
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
function jungleTreeGeo() {
  const m = new Mesher();
  m.add(cyl(0.25, 0.5, 9, 6), 0x4a3c2c, [0, 4.5, 0], [0, 0, 0.04]);
  for (let i = 0; i < 3; i++) m.add(cone(3.4 - i * 0.7, 1.6, 7), i % 2 ? 0x2c4a2a : 0x355a2e, [0.2 * i, 8 + i * 1.5, 0], [0, i, 0], [1, 1, 1], 0.16);
  for (let i = 0; i < 4; i++) m.add(box(0.07, 3.5, 0.07), 0x2f4426, [Math.sin(i * 1.7) * 2, 6.6, Math.cos(i * 1.7) * 2]); // hanging vines
  return m.build();
}
function fernGeo() { const m = new Mesher(); for (let i = 0; i < 11; i++) { const g = cone(0.2, 1.3, 3); g.scale(1, 1, 0.35); g.translate(0, 0.65, 0); m.add(g, i % 2 ? 0x4f7a3a : 0x3f6a34, [0, 0.05, 0], [i < 6 ? 1.05 : 0.5, (i / (i < 6 ? 6 : 5)) * TAU + (i < 6 ? 0 : 0.5), 0], i < 6 ? 1 : 0.8, 0.1); } m.add(ball(0.22), 0x35502d, [0, 0.12, 0], [0, 0, 0], [1, 0.6, 1]); return m.build(); }
function deadTreeGeo() { const m = new Mesher(), c = 0x8a8072; m.add(cyl(0.1, 0.32, 5.4, 6), c, [0, 2.7, 0], [0, 0, 0.08]); const br = [[0.9, 4.2, 0, -0.9, 2.6], [-0.7, 3.5, 0.2, 0.8, 2.2], [0.3, 4.9, -0.6, -0.4, 1.9], [-0.5, 5.2, 0.4, 0.5, 1.7], [0.6, 3.0, 0.5, -1.2, 1.5]]; for (const [x, y, z, rz, L] of br) { m.add(cyl(0.03, 0.09, L, 4), c, [x, y, z], [z, 0, rz]); m.add(cyl(0.015, 0.04, L * 0.6, 3), c, [x + Math.sin(-rz) * L * 0.55, y + L * 0.5, z], [z * 2, 0, rz * 0.4]); } return m.build(); }
function rockGeo() { const m = new Mesher(); m.add(new THREE.DodecahedronGeometry(1, 0), 0x77706a, [0, 0.3, 0], [0.4, 0.2, 0.1], [1, 0.7, 0.85], 0.1); return m.build(); }
function bushGeo() { const m = new Mesher(); m.add(ball(1), 0x4a6232, [0, 0.45, 0], [0, 0, 0], [1, 0.6, 1], 0.14); m.add(ball(0.7), 0x3c5530, [0.7, 0.35, 0.3], [1, 1, 0], [1, 0.6, 1], 0.14); return m.build(); }

// Hills and mountains on the big islands, reeds in the shallows, dead trees on the cursed ones. Placed last, so nothing else moves.
function dressScenery(isl, g) {
  const rnd = Math.random, hi = isl.h > 20;
  const hills = hi ? ['hills_A_trees', 'hills_B_trees', 'mountain_A_grass_trees', 'mountain_B_grass_trees'] : ['hill_single_A', 'hill_single_B', 'hills_A_trees'];
  const n = Math.round(isl.r / 90);
  for (let i = 0; i < n; i++) { const p = isl.spot(2, isl.h * 0.9, 14); placeModel(g, NAT + hills[Math.floor(rnd() * hills.length)] + '.gltf', p.x, heightAt(p.x, p.z) - 0.3, p.z, rnd() * TAU, (isl.r / 240) * (0.8 + rnd() * 0.4)); }
  for (let i = 0; i < Math.round(isl.r / 35); i++) { const p = isl.spot(-1.4, 0.4, 8); placeModel(g, NAT + (rnd() < 0.5 ? 'waterplant_A' : 'waterlily_A') + '.gltf', p.x, heightAt(p.x, p.z) - 0.15, p.z, rnd() * TAU, 1.1 + rnd() * 0.6); }
  if (isl.kind === 'ruins' || isl.kind === 'islet' || isl.kind === 'crab') for (let i = 0; i < 4; i++) { const p = isl.spot(1.5, 30, 12); placeModel(g, NAT + 'tree_dead_medium.gltf', p.x, heightAt(p.x, p.z) - 0.1, p.z, rnd() * TAU, 1.1); }
}

// Swap a scatter's procedural shape for a real model, keeping its size and every position. Used once the file has loaded.
function dressWith(mesh, procGeo, file) {
  procGeo.computeBoundingBox(); const pb = procGeo.boundingBox, H = pb.max.y - pb.min.y;
  loadGltf(file).then((g) => {
    if (!g) return;
    const parts = []; let mat = null;
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => { if (o.isMesh) { const x = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); parts.push(x.toNonIndexed()); mat = mat || o.material; } });
    if (!parts.length) return;
    const merged = mergeGeometries(parts); merged.computeBoundingBox(); const bb = merged.boundingBox, s = H / Math.max(0.01, bb.max.y - bb.min.y);
    merged.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); merged.scale(s, s, s); merged.computeVertexNormals();
    const old = mesh.geometry; mesh.geometry = merged; mesh.material = mat; old.dispose();
  });
}
function scatter(group, isl, geo, count, minH, maxH, sMin, sMax, colR, block) {
  const mesh = new THREE.InstancedMesh(geo, MAT, count), d = new THREE.Object3D(), R = isl.rand;
  let n = 0;
  for (let i = 0; i < count; i++) {
    const p = isl.spot(minH, maxH, 5);
    if (p.x === isl.x && p.z === isl.z) continue;
    if (!block && isl.blocks.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < b.r + 1.6)) continue; // never plant inside a boulder or a wall
    d.position.set(p.x, heightAt(p.x, p.z) - 0.05, p.z); d.rotation.set(0, R() * TAU, 0); d.scale.setScalar(lerp(sMin, sMax, R())); d.updateMatrix();
    mesh.setMatrixAt(n++, d.matrix);
    if (colR) isl.colliders.push({ x: p.x, z: p.z, r: colR * d.scale.x });
    if (block) isl.blocks.push({ x: p.x, z: p.z, r: d.scale.x });
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  group.add(mesh);
  return mesh;
}

// ---------- structures ----------
function house(m, isl, p, w, d, h, wall, roof, o = {}) {
  const y = heightAt(p.x, p.z) - 0.2, rot = o.rot ?? Math.atan2(isl.site.x - p.x, isl.site.z - p.z), fx = Math.sin(rot), fz = Math.cos(rot);
  const at = (lx, ly, lz) => [p.x + fx * lz + fz * lx, y + ly, p.z + fz * lz - fx * lx]; // house-local to world
  m.add(box(w + 0.3, 0.7, d + 0.3), PAL.stone, at(0, 0.35, 0), [0, rot, 0], 1, 0.08);
  m.add(box(w, h, d), wall, at(0, 0.6 + h / 2, 0), [0, rot, 0], 1, 0.05);
  const framed = wall === PAL.plaster || wall === PAL.white;
  if (framed) { // half-timber frame
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(box(0.3, h, 0.3), PAL.darkTimber, at(sx * w / 2, 0.6 + h / 2, sz * d / 2), [0, rot, 0]);
    for (const sz of [-1, 1]) { m.add(box(w, 0.26, 0.2), PAL.darkTimber, at(0, 0.6 + h - 0.13, sz * (d / 2 + 0.02)), [0, rot, 0]); if (h > 5) m.add(box(w, 0.26, 0.2), PAL.darkTimber, at(0, 0.6 + h * 0.5, sz * (d / 2 + 0.02)), [0, rot, 0]); }
    for (const sx of [-1, 1]) m.add(box(0.2, 0.26, d), PAL.darkTimber, at(sx * (w / 2 + 0.02), 0.6 + h - 0.13, 0), [0, rot, 0]);
  }
  const rg = cone(0.7071, 1, 4); rg.rotateY(Math.PI / 4);
  const rh = o.roofH ?? Math.min(w, d) * 0.6;
  m.add(rg, roof, at(0, 0.6 + h + rh / 2, 0), [0, rot, 0], [w * 1.2, rh, d * 1.2], 0.06);
  m.add(box(1.3, 2.2, 0.16), PAL.darkTimber, at(0, 0.6 + 1.1, d / 2 + 0.04), [0, rot, 0], 1, 0, 'door');
  m.add(box(1.7, 0.2, 0.3), PAL.darkTimber, at(0, 0.6 + 2.35, d / 2 + 0.08), [0, rot, 0]);
  const floors = h > 5 ? 2 : 1, win = (lx, ly, lz, ry) => { if (o.dark) m.add(box(0.9, 1.0, 0.14), PAL.iron, at(lx, ly, lz), [0, rot + ry, 0], 1, 0); else { m.add(box(0.95, 1.15, 0.14), PAL.lit, at(lx, ly, lz), [0, rot + ry, 0], 1, 0, 'window'); m.add(box(1.2, 0.12, 0.26), PAL.darkTimber, at(lx, ly - 0.64, lz), [0, rot + ry, 0]); } };
  const wn = Math.max(2, Math.floor(w / 2.8));
  for (let f = 0; f < floors; f++) for (let i = 0; i < wn; i++) { const off = (i - (wn - 1) / 2) * (w / wn); if (f === 0 && Math.abs(off) < 1.5) continue; win(off, 0.6 + 1.5 + f * 2.8, d / 2 + 0.03, 0); }
  for (const sx of [-1, 1]) for (let f = 0; f < floors; f++) win(sx * (w / 2 + 0.03), 0.6 + 1.5 + f * 2.8, 0, Math.PI / 2);
  if (o.chimney) { m.add(box(1, rh + 1.6, 1), PAL.stone, at(-w * 0.3, 0.6 + h + rh / 2 + 0.3, -d * 0.12), [0, rot, 0]); m.add(box(1.25, 0.25, 1.25), PAL.darkRock, at(-w * 0.3, 0.6 + h + rh + 1.15, -d * 0.12), [0, rot, 0]); }
  if (o.sign) { m.add(box(0.12, 0.12, 1.5), PAL.iron, at(w * 0.32, 0.6 + 3.1, d / 2 + 0.7), [0, rot, 0]); m.add(box(1.0, 0.7, 0.08), o.sign, at(w * 0.32, 0.6 + 2.6, d / 2 + 1.2), [0, rot + Math.PI / 2, 0]); }
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

// A painted board that hangs over a shop door, so every building says what it is.
const signTex = new Map();
function signSprite(text) {
  let t = signTex.get(text);
  if (!t) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#2a1d14'; c.fillRect(0, 0, 256, 64); c.strokeStyle = '#b58a2e'; c.lineWidth = 4; c.strokeRect(4, 4, 248, 56); c.fillStyle = '#e9c46a'; c.font = '700 30px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 128, 34); if (text === '!') { c.clearRect(0, 0, 256, 64); c.fillStyle = '#e9c46a'; c.font = '700 60px Georgia, serif'; c.fillText('!', 128, 36); } t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; signTex.set(text, t); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t })); s.scale.set(4.4, 1.1, 1); return s;
}
const frameAt = (p, rot) => { const fx = Math.sin(rot), fz = Math.cos(rot), y = heightAt(p.x, p.z); return (lx, ly, lz) => [p.x + fx * lz + fz * lx, y + ly, p.z + fz * lz - fx * lx]; };
function road(m, isl, u0, v0, u1, v1, w, col = 0x8a857a) {
  const a = isl.local(u0, v0), b = isl.local(u1, v1), len = Math.hypot(b.x - a.x, b.z - a.z), x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
  m.add(box(w, 0.14, len + w * 0.5), col, [x, heightAt(x, z) + 0.05, z], [0, Math.atan2(b.x - a.x, b.z - a.z), 0], 1, 0.03, col === 0x80684c ? 'planks' : 'stone');
}
function torchPost(m, x, z) { const y = heightAt(x, z); m.add(cyl(0.07, 0.1, 2.4, 5), PAL.darkTimber, [x, y + 1.2, z]); m.add(cone(0.22, 0.5, 5), 0xff9a3c, [x, y + 2.65, z], [0, 0, 0], 1, 0, 'plain'); }

function town(m, isl, group) {
  const L = isl.local, id = isl.id, toSite = (p) => Math.atan2(isl.site.x - p.x, isl.site.z - p.z), aD = isl.land, aP = Math.atan2(isl.perp[0], isl.perp[1]);
  const theme = id === 'regal' ? { wall: PAL.white, roof: PAL.tile, alt: PAL.stone } : id === 'shoals' ? { wall: PAL.darkTimber, roof: 0x2d2b2a, alt: PAL.timber } : { wall: PAL.plaster, roof: PAL.slate, alt: PAL.timber };
  const names = { saltmere: { tavern: 'Mara', shipwright: 'Old Tobias', smith: 'Brenna', market: 'Quill' }, regal: { tavern: 'Mr. Finch', shipwright: 'Master Hale', market: 'Widow Ames' }, shoals: { tavern: 'One-Eye Sal', smith: 'The Dutchman', market: 'Nan' } }[id];
  const ROLE = { tavern: ['Tavern keeper', 'keeper', 'TAVERN'], shipwright: ['Shipwright', 'wright', 'SHIPWRIGHT'], smith: ['Blacksmith', 'smith', 'BLACKSMITH'], market: ['Merchant', 'merchant', 'MARKET'] };
  const npc = (kind, b, signY = 5.4) => {
    const [role, look, label] = ROLE[kind], door = kind === 'tavern';
    if (!door) { const fig = staticFigure(look); fig.position.set(b.front.x, heightAt(b.front.x, b.front.z), b.front.z); fig.rotation.y = b.rot; group.add(fig); isl.colliders.push({ x: b.front.x, z: b.front.z, r: 0.5 }); }
    isl.npcs.push({ id: `${id}:${kind}`, kind, name: names[kind], role, x: b.front.x, z: b.front.z, door });
    const sg = signSprite(label), sp = b.sign || b.front; sg.position.set(sp.x, heightAt(sp.x, sp.z) + signY, sp.z); group.add(sg);
  };
  // ---- the four trades, each with a shape of its own ----
  const tavern = (p, rot, big = 1) => { // tall, lit, barrels and a bench by the door
    const b = house(m, isl, p, 13 * big, 9, 6.2, theme.wall, theme.roof, { chimney: true, sign: 0xb58a2e, rot }), F = frameAt(p, rot);
    for (const sx of [-1, 1]) { const q = F(sx * 3.2, 0, 5.4); lamp(m, q[0], q[2]); const k = F(sx * 5.2, 0, 5.2); barrel(m, k[0], k[2], 1.1); }
    m.add(box(2.4, 0.14, 0.5), PAL.timber, F(-4, 1.05, 5.6), [0, rot, 0]); m.add(box(0.14, 0.45, 0.4), PAL.darkTimber, F(-5, 0.82, 5.6), [0, rot, 0]); m.add(box(0.14, 0.45, 0.4), PAL.darkTimber, F(-3, 0.82, 5.6), [0, rot, 0]);
    return b;
  };
  const smithy = (p, rot, wall = PAL.stone) => { // squat stone, big chimney, a glowing forge and an anvil under a lean-to
    const b = house(m, isl, p, 8, 7, 3.6, wall, theme.roof, { chimney: true, rot }), F = frameAt(p, rot);
    m.add(box(4.4, 0.16, 3.6), PAL.darkTimber, F(6.2, 3.3, 1.2), [0.12, rot, 0]); for (const [x, z] of [[8.2, 2.8], [8.2, -0.4]]) m.add(cyl(0.12, 0.12, 3.2, 5), PAL.timber, F(x, 1.6, z));
    m.add(box(1.6, 1.3, 1.6), PAL.stone, F(5.4, 0.65, -0.2), [0, rot, 0]); m.add(box(1.0, 0.5, 0.2), 0xff7a2a, F(5.4, 0.85, 0.65), [0, rot, 0], 1, 0, 'plain'); m.add(box(1.2, 2.4, 1.2), PAL.stone, F(5.4, 2.4, -0.4), [0, rot, 0]);
    m.add(box(0.5, 0.6, 0.5), PAL.timber, F(6.6, 0.3, 2.2), [0, rot, 0]); m.add(box(0.9, 0.3, 0.36), PAL.iron, F(6.6, 0.75, 2.2), [0, rot, 0], 1, 0, 'plain');
    isl.colliders.push({ x: F(5.4, 0, -0.2)[0], z: F(5.4, 0, -0.2)[2], r: 1.3 });
    return b;
  };
  const shipyard = (p, rot) => { // an open shed over a hull in frame, with timber stacked beside it
    const F = frameAt(p, rot);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(cyl(0.18, 0.2, 5, 5), PAL.darkTimber, F(sx * 5, 2.5, sz * 3.4));
    for (const sx of [-1, 1]) m.add(box(5.6, 0.2, 8), theme.roof, F(sx * 2.6, 5.6, 0), [0, rot, sx * -0.4], 1, 0.04);
    m.add(box(0.4, 0.4, 9.5), PAL.timber, F(0, 0.5, 0), [0, rot + Math.PI / 2, 0]);
    for (let i = -3; i <= 3; i++) for (const sz of [-1, 1]) m.add(box(0.22, 2.2 - Math.abs(i) * 0.2, 0.22), PAL.plank, F(i * 1.3, 1.3, sz * (1.5 - Math.abs(i) * 0.18)), [sz * -0.35, rot, 0]);
    for (let i = 0; i < 4; i++) m.add(box(0.3, 0.3, 5), PAL.plank, F(7.4, 0.2 + (i >> 1) * 0.32, -1 + (i % 2) * 0.4), [0, rot + 0.05 * i, 0]);
    const k = F(-7, 0, 2); barrel(m, k[0], k[2]); const k2 = F(-7.6, 0, 0.6); crate(m, k2[0], k2[2], 1, 0.3);
    isl.colliders.push({ x: p.x, z: p.z, r: 3.2 });
    const f = F(0, 0, 5.6); return { front: { x: f[0], z: f[2] }, rot, sign: { x: F(0, 0, 3.6)[0], z: F(0, 0, 3.6)[2] } };
  };
  const stalls = (p, rot, cols) => { // open stalls under bright awnings, piled with goods
    const F = frameAt(p, rot);
    cols.forEach((col, i) => { const x = (i - (cols.length - 1) / 2) * 5.2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(cyl(0.08, 0.08, sz > 0 ? 2.5 : 3, 4), PAL.timber, F(x + sx * 2, sz > 0 ? 1.25 : 1.5, sz * 1.3));
      m.add(box(4.6, 0.1, 3.2), col, F(x, 2.85, 0), [0.18, rot, 0], 1, 0, 'plain'); m.add(box(4, 0.16, 1.3), PAL.plank, F(x, 1.0, 0.6), [0, rot, 0]); m.add(box(3.8, 0.9, 1.1), PAL.timber, F(x, 0.5, 0.6), [0, rot, 0]);
      for (let k = 0; k < 4; k++) m.add(ball(0.2), [0xc9a94a, 0x8a2a22, 0x4f7a3a, 0xc79a3a][(k + i) % 4], F(x - 1.2 + k * 0.8, 1.22, 0.6), [0, 0, 0], 1, 0, 'plain');
      isl.colliders.push({ x: F(x, 0, 0.3)[0], z: F(x, 0, 0.3)[2], r: 2.1 }); });
    const c1 = F(-cols.length * 2.6 - 1.4, 0, 0.4), c2 = F(cols.length * 2.6 + 1.2, 0, 0.2); crate(m, c1[0], c1[2], 1.1, 0.4); barrel(m, c2[0], c2[2]);
    const f = F(0, 0, 3.4); return { front: { x: f[0], z: f[2] }, rot };
  };
  const homes = (list, two) => list.forEach(([u, v, w, d, h, rot], i) => house(m, isl, L(u, v), w, d, h, i % 2 ? theme.alt : theme.wall, i % 3 === 1 ? PAL.thatch : theme.roof, rot === undefined ? {} : { rot, chimney: two && i % 2 === 0 }));
  const well = (u, v) => { const c = L(u, v), cy = heightAt(c.x, c.z); m.add(cyl(1.3, 1.4, 0.9, 8), PAL.stone, [c.x, cy + 0.45, c.z]); m.add(cyl(0.09, 0.09, 2.4, 4), PAL.timber, [c.x - 1.1, cy + 1.6, c.z]); m.add(cyl(0.09, 0.09, 2.4, 4), PAL.timber, [c.x + 1.1, cy + 1.6, c.z]); m.add(cone(1.7, 0.9, 4), PAL.slate, [c.x, cy + 3.2, c.z], [0, 0.78, 0]); isl.colliders.push({ x: c.x, z: c.z, r: 1.6 }); };

  if (id === 'saltmere') { // a market village round a cobbled square
    const c = L(0, 0); m.add(cyl(14, 14, 0.14, 18), 0x8a857a, [c.x, heightAt(c.x, c.z) + 0.05, c.z]);
    road(m, isl, 13, 0, 47, 0, 5); road(m, isl, 0, -13, 0, -30, 3.6, 0x79756b); road(m, isl, 0, 13, 0, 28, 3.6, 0x79756b); road(m, isl, -13, 0, -22, 0, 3.6, 0x79756b);
    well(0, 0);
    npc('tavern', tavern(L(-28, 0), aD));
    npc('smith', smithy(L(-3, -34), aP));
    npc('market', stalls(L(0, 31), aP + Math.PI, [PAL.red, 0xc9a94a, 0x2f5d63]), 4.6);
    npc('shipwright', shipyard(L(36, -24), aP), 7.2);
    homes([[-38, 24, 7, 6, 3.4], [-40, -22, 6, 6, 3.6], [-17, 20, 6, 6, 3.4], [-18, -19, 6, 5, 3.2], [20, 22, 7, 5, 3.2], [36, 12, 5, 5, 3], [19, -16, 6, 5, 3.3]]);
    [[10, 10], [10, -10], [-10, 10], [-10, -10], [30, 4]].forEach(([u, v]) => { const p = L(u, v); lamp(m, p.x, p.z); });
    [[14, 24, 1], [26, -14, 1], [-16, 6, 1]].forEach(([u, v, s]) => { const p = L(u, v); barrel(m, p.x, p.z, s); });
  } else if (id === 'regal') { // a proper navy town: paved streets on a grid, a church, the governor's house
    road(m, isl, 47, 0, -30, 0, 7, 0x9a958a); road(m, isl, 8, -40, 8, 40, 6, 0x9a958a); road(m, isl, -18, -30, -18, 30, 4.5, 0x8a857a);
    const f = L(8, 0), fy = heightAt(f.x, f.z); m.add(cyl(3, 3.2, 0.7, 10), PAL.stone, [f.x, fy + 0.4, f.z]); m.add(cyl(2.6, 2.6, 0.1, 10), 0x4f8f9a, [f.x, fy + 0.72, f.z], [0, 0, 0], 1, 0, 'plain'); m.add(cyl(0.3, 0.45, 2.4, 6), PAL.stone, [f.x, fy + 1.6, f.z]); m.add(ball(0.55), PAL.stone, [f.x, fy + 3, f.z]); isl.colliders.push({ x: f.x, z: f.z, r: 3.3 });
    npc('tavern', tavern(L(22, -12.5), aP));
    npc('market', stalls(L(22, 13), aP + Math.PI, [0x27406b, PAL.white, 0x27406b, PAL.red]), 4.6);
    npc('shipwright', shipyard(L(40, -27), aP), 7.2);
    // the governor's house, with a columned porch and the flag
    const g = L(-40, 0); house(m, isl, g, 18, 10, 7.4, PAL.white, PAL.tile, { rot: aD, chimney: true }); const G = frameAt(g, aD);
    for (let i = -2; i <= 2; i++) if (i) m.add(cyl(0.34, 0.38, 6, 8), PAL.white, G(i * 2.6, 3.6, 6.6)); m.add(box(13, 0.5, 2.4), PAL.white, G(0, 6.8, 6.2), [0, aD, 0]); m.add(box(13, 0.3, 2.6), PAL.stone, G(0, 0.5, 6.2), [0, aD, 0]);
    m.add(cyl(0.08, 0.08, 7, 4), PAL.timber, G(0, 14, 0)); m.add(box(2.6, 1.5, 0.06), 0x27406b, G(1.4, 16.6, 0), [0, aD, 0], 1, 0, 'plain');
    // church with a steeple
    const ch = L(-32, -27); house(m, isl, ch, 8, 14, 6, PAL.white, PAL.slate, { rot: aD }); const C = frameAt(ch, aD);
    m.add(box(4, 13, 4), PAL.white, C(0, 7, 8.2), [0, aD, 0], 1, 0.03); m.add(cone(3.2, 6, 4), PAL.slate, C(0, 16.5, 8.2), [0, aD + 0.78, 0]); m.add(box(0.14, 1.6, 0.14), PAL.iron, C(0, 20.2, 8.2)); m.add(box(0.9, 0.14, 0.14), PAL.iron, C(0, 20.4, 8.2), [0, aD, 0]);
    isl.colliders.push({ x: C(0, 0, 8.2)[0], z: C(0, 0, 8.2)[2], r: 2.6 });
    // terraced townhouses facing the streets
    homes([[-3, -12, 7, 7, 6.4, aP], [-10.5, -12, 7, 7, 6, aP], [-3, 12, 7, 7, 6, aP + Math.PI], [-10.5, 12, 7, 7, 6.4, aP + Math.PI], [-26, 12, 7, 7, 6, aP + Math.PI], [34, 12.5, 8, 7, 5.6, aP + Math.PI], [34, -12.5, 9, 7, 4.2, aP],
      [17, -30, 7, 6, 5.8, aD + Math.PI], [-1, -30, 7, 6, 5.8, aD], [17, 30, 7, 6, 5.8, aD + Math.PI], [-1, 30, 7, 6, 5.8, aD], [-30, 28, 7, 6, 3.6, aD]], true);
    for (let u = -24; u <= 40; u += 16) for (const v of [-4.6, 4.6]) { if (Math.abs(u - 8) < 5) continue; const p = L(u, v); lamp(m, p.x, p.z); }
    [[41, 8, 1], [42.2, 9, 0.8], [28, -22, 1]].forEach(([u, v, s]) => { const p = L(u, v); barrel(m, p.x, p.z, s); }); [[44, 10, 1.1], [30, -24, 0.9]].forEach(([u, v, s], i) => { const p = L(u, v); crate(m, p.x, p.z, s, i); });
  } else { // Black Shoals: a smugglers' shanty of boardwalks, crooked shacks and a tavern in a beached wreck
    const PL = 0x80684c; road(m, isl, 47, 0, 20, 4, 3.4, PL); road(m, isl, 20, 4, 0, -6, 3.2, PL); road(m, isl, 0, -6, -22, 2, 3, PL); road(m, isl, 0, -6, -4, -27, 2.8, PL); road(m, isl, 20, 4, 23, 24, 2.8, PL);
    const tp = L(-30, 4), tb = tavern(tp, aD, 1.15), T = frameAt(tp, aD); // the wreck: a bow, a broken mast, rags of sail
    m.add(cone(4.6, 9, 4), PAL.darkTimber, T(-11.5, 3.4, 0), [0, aD, Math.PI / 2], [1, 1, 0.9], 0.05); m.add(cyl(0.28, 0.36, 15, 6), PAL.timber, T(3, 12, -1), [0.06, 0, 0.1]); m.add(cyl(0.1, 0.12, 8, 4), PAL.timber, T(3, 15, -1), [0, aD, Math.PI / 2 + 0.2]); m.add(box(5, 3.4, 0.06), 0x8a8474, T(3.4, 13, -0.9), [0, aD, 0.2], 1, 0.1, 'plain');
    npc('tavern', tb);
    npc('smith', smithy(L(-6, -33), aP, PAL.darkTimber));
    npc('market', stalls(L(24, 29), aP + Math.PI, [0x2d2b2a, 0x5a1512]), 4.6);
    const R = isl.rand; [[12, -14, 5, 5, 3], [24, -10, 5, 4, 2.8], [-14, -14, 5, 5, 3], [-14, 16, 6, 5, 3], [4, 14, 5, 4, 2.8], [-38, -18, 5, 5, 3.2], [36, 14, 4, 5, 2.8], [8, 30, 5, 4, 2.8], [-26, 26, 5, 5, 3]].forEach(([u, v, w, d, h], i) => { const p = L(u, v); house(m, isl, p, w, d, h, i % 2 ? PAL.timber : PAL.darkTimber, i % 3 ? PAL.thatch : 0x2d2b2a, { rot: toSite(p) + (R() - 0.5) * 1.2, dark: i % 4 === 0 }); });
    const bf = L(-9, 7), by = heightAt(bf.x, bf.z); m.add(cyl(1.3, 1.5, 0.3, 8), PAL.darkRock, [bf.x, by + 0.15, bf.z]); m.add(cone(0.9, 1.5, 6), 0xff9a3c, [bf.x, by + 0.9, bf.z], [0, 0, 0], 1, 0, 'plain'); for (let i = 0; i < 3; i++) m.add(box(0.2, 0.2, 1.8), PAL.darkTimber, [bf.x, by + 0.4, bf.z], [0.5, i * 2.1, 0]); isl.colliders.push({ x: bf.x, z: bf.z, r: 1.5 });
    [[18, 8], [2, -10], [-20, -2], [-6, -22], [22, 20], [40, 3]].forEach(([u, v]) => { const p = L(u, v); torchPost(m, p.x, p.z); });
    for (let i = 0; i < 3; i++) { const p = L(30 + i * 3.2, -20), y = heightAt(p.x, p.z); m.add(cyl(0.07, 0.07, 2.6, 4), PAL.timber, [p.x, y + 1.3, p.z]); if (i) m.add(box(3.2, 1.4, 0.04), 0x6a6a58, [p.x - isl.dir[0] * 1.6, y + 1.8, p.z - isl.dir[1] * 1.6], [0, aD + Math.PI / 2, 0], 1, 0.12, 'plain'); } // drying nets
    [[14, 2, 1], [15, 3.2, 0.8], [-2, -20, 1], [26, 18, 1]].forEach(([u, v, s]) => { const p = L(u, v); barrel(m, p.x, p.z, s); }); [[10, -4, 1], [-18, 8, 0.9], [27, 16, 1.1]].forEach(([u, v, s], i) => { const p = L(u, v); crate(m, p.x, p.z, s, i); });
  }
  // townsfolk with something to ask of a captain
  for (const f of FOLK) if (f.isl === id) { const p = L(f.at[0], f.at[1]), fig = staticFigure(f.look); fig.position.set(p.x, heightAt(p.x, p.z), p.z); fig.rotation.y = toSite(p) + 0.6; group.add(fig);
    isl.npcs.push({ id: `${id}:folk:${f.id}`, kind: 'folk', folk: f.id, name: f.name, role: f.role, x: p.x, z: p.z }); isl.colliders.push({ x: p.x, z: p.z, r: 0.5 });
    const mk = signSprite('!'); mk.scale.set(0.9, 0.9, 1); mk.position.set(p.x, heightAt(p.x, p.z) + 2.7, p.z); group.add(mk); }
  if (isl.navy) return;
  // bandit camp
  const k = isl.camp, ky = heightAt(k.x, k.z);
  m.add(cone(2.4, 2.6, 4), 0x6f6448, [k.x + 5, ky + 1.3, k.z + 2], [0, 0.5, 0]); m.add(cone(2.2, 2.4, 4), 0x5d5540, [k.x - 4, ky + 1.2, k.z + 4], [0, 1.2, 0]);
  m.add(cone(0.7, 0.9, 5), 0xff9a3c, [k.x + 1.5, ky + 0.45, k.z - 3], [0, 0, 0], 1, 0); m.add(cyl(1, 1.1, 0.25, 7), PAL.darkRock, [k.x + 1.5, ky + 0.1, k.z - 3]);
}

// A stone navy fort: curtain walls, corner towers, a gate, barracks and guns. The strongroom is at the back.
function navyFort(m, isl, group) {
  const n = isl.navy, S = n.S, h = S / 2, F = frameAt({ x: n.x, z: n.z }, n.rot), big = S > 30, wallH = big ? 6.5 : 5;
  const wall = (lx, lz, len, along) => { m.add(box(along ? len : 1.8, wallH, along ? 1.8 : len), PAL.stone, F(lx, wallH / 2, lz), [0, n.rot, 0], 1, 0.04); for (let t = -len / 2 + 0.9; t < len / 2; t += 2.4) m.add(box(along ? 1.2 : 2, 0.9, along ? 2 : 1.2), PAL.stone, F(lx + (along ? t : 0), wallH + 0.45, lz + (along ? 0 : t)), [0, n.rot, 0]);
    for (let t = -len / 2 + 0.8; t <= len / 2; t += 1.7) { const q = F(lx + (along ? t : 0), 0, lz + (along ? 0 : t)); isl.colliders.push({ x: q[0], z: q[2], r: 1.1 }); } };
  wall(0, -h, S, true); wall(-h, 0, S, false); wall(h, 0, S, false);
  const gw = (S - 6) / 2; wall(-(3 + gw / 2), h, gw, true); wall(3 + gw / 2, h, gw, true); // the gate gap faces the island
  m.add(box(6.4, 1.2, 2.2), PAL.stone, F(0, wallH + 0.2, h), [0, n.rot, 0]); m.add(box(2.6, 4.6, 0.3), PAL.darkTimber, F(-4.2, 2.3, h + 1.6), [0, n.rot + 0.9, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const q = F(sx * h, 0, sz * h); m.add(cyl(3, 3.4, wallH + 3, 10), PAL.stone, [q[0], q[1] + (wallH + 3) / 2, q[2]]); m.add(cyl(3.5, 3.5, 1, 10), PAL.darkRock, [q[0], q[1] + wallH + 3.4, q[2]]); isl.colliders.push({ x: q[0], z: q[2], r: 3.5 }); }
  const fl = F(-h, 0, h); m.add(cyl(0.09, 0.09, 7, 4), PAL.timber, [fl[0], fl[1] + wallH + 7, fl[2]]); m.add(box(2.8, 1.6, 0.06), 0x27406b, [fl[0] + 1.5, fl[1] + wallH + 9.6, fl[2]], [0, 0, 0], 1, 0, 'plain');
  // barracks and the strongroom
  const bp = F(big ? -9 : -4.5, 0, big ? -4 : -1); house(m, isl, { x: bp[0], z: bp[2] }, big ? 9 : 6, big ? 14 : 7, 3.6, PAL.stone, PAL.slate, { rot: n.rot + Math.PI / 2 });
  if (big) { const b2 = F(10, 0, -3); house(m, isl, { x: b2[0], z: b2[2] }, 8, 10, 3.6, PAL.stone, PAL.slate, { rot: n.rot - Math.PI / 2, chimney: true }); }
  // guns on the seaward wall, shot piled by them
  for (let i = -1; i <= 1; i++) { if (!big && i) continue; const q = F(i * 7, 0, -h + 3.4); m.add(cyl(0.3, 0.38, 2.6, 7), PAL.iron, [q[0], q[1] + 0.8, q[2]], [Math.PI / 2 - 0.08, n.rot + Math.PI, 0], 1, 0, 'plain'); m.add(box(1.1, 0.5, 1.6), PAL.timber, [q[0], q[1] + 0.35, q[2]], [0, n.rot, 0]); const b = F(i * 7 + 1.4, 0, -h + 4.4); for (let k = 0; k < 3; k++) m.add(ball(0.2), PAL.iron, [b[0] + k * 0.36, b[1] + 0.2, b[2]], [0, 0, 0], 1, 0, 'plain'); isl.colliders.push({ x: q[0], z: q[2], r: 1 }); }
  const sg = signSprite(n.name.toUpperCase()), gp = F(0, 0, h + 1); sg.position.set(gp[0], gp[1] + wallH + 2.6, gp[2]); group.add(sg);
  for (const sx of [-1, 1]) { const q = F(sx * 4.4, 0, h + 2.4); torchPost(m, q[0], q[2]); }
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
const BASE_MODEL = { vault: 'building_tower_base_green', lumber: 'building_lumbermill_green', mine: 'building_mine_green', still: 'building_market_green', quarters: 'building_barracks_green', battery: 'building_tower_catapult_green' };
export function refreshBase(world, save) {
  const isl = world.byId.rest, token = (world.baseToken = (world.baseToken || 0) + 1);
  for (const m of world.baseModels || []) world.scene.remove(m);
  world.baseModels = [];
  if (world.baseMesh) { world.scene.remove(world.baseMesh); world.baseMesh.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
  isl.colliders = isl.colliders.filter((c) => !c.base);
  const all = new Kit(KINDS);
  for (const p of isl.plots) {
    const lvl = save.base.b[p.id] || 0, y = heightAt(p.x, p.z);
    all.origin = new THREE.Matrix4().makeRotationY(p.face + Math.PI).setPosition(p.x, y - 0.1, p.z);
    if (lvl) { // the built, real model; the hand-made one stays as a fallback
      isl.colliders.push({ x: p.x, z: p.z, r: 3.4, base: true });
      placeModel(world.scene, 'medieval/buildings/green/' + BASE_MODEL[p.id] + '.gltf', p.x, y - 0.1, p.z, p.face + Math.PI, 1.05 + 0.07 * lvl).then((m) => { if (m && world.baseToken === token) world.baseModels.push(m); else if (m) world.scene.remove(m); });
      if (!BASE_MODEL[p.id]) BUILD_DRAW[p.id](all, lvl);
    }
    else { for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) all.add(cyl(0.08, 0.1, 1.1, 4), PAL.timber, [x, 0.55, z]); all.add(box(1.3, 0.8, 0.1), PAL.plank, [0, 1.5, 3.4]); all.add(cyl(0.07, 0.07, 1.8, 4), PAL.timber, [0, 0.9, 3.4]); }
  }
  all.origin = null;
  const s = isl.site, sy = heightAt(s.x, s.z);
  all.add(cyl(1.2, 1.3, 0.3, 7), PAL.darkRock, [s.x, sy + 0.1, s.z]); all.add(cone(0.8, 1.1, 5), 0xff9a3c, [s.x, sy + 0.7, s.z], [0, 0, 0], 1, 0);
  all.add(cyl(0.1, 0.12, 9, 5), PAL.timber, [s.x + 4, sy + 4.5, s.z]); all.add(box(2.6, 1.6, 0.06), 0x161616, [s.x + 5.35, sy + 8, s.z]);
  world.baseMesh = all.mesh(); world.scene.add(world.baseMesh);
  if (world.onBase) world.onBase();
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
uniform float uTime; uniform float uAmp; uniform float uLight; uniform vec3 uSun, uSunCol, uDeep, uShallow, uZenith, uHorizon, uFog; uniform float uFogD; uniform vec3 uIsles[${ISLANDS.length}];
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
  base *= (0.75 + 0.35 * max(dot(n, uSun), 0.0)) * uLight;
  vec3 col = mix(base, sky, fres * 0.8);
  col += uSunCol * (pow(max(dot(r, uSun), 0.0), 220.0) * 1.6 + pow(max(dot(r, uSun), 0.0), 24.0) * 0.12);
  float crest = smoothstep(0.62 * uAmp, 1.05 * uAmp, vH + g.x * 0.5) * (0.5 + 0.5 * sin(p.x * 0.9 + p.y * 1.3 + uTime + 1.8 * sin(p.x * 0.37 - p.y * 0.51 + uTime * 0.6)));
  col = mix(col, (uHorizon * 0.7 + uSunCol * 0.4), crest * 0.22 * det * 2.0);
  float f = 1.0 - exp(-uFogD * uFogD * dist * dist);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, mix(mix(0.74, 0.98, fres), 1.0, f));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const SKY_FRAG = `
uniform vec3 uSun, uSunCol, uZenith, uHorizon, uFog; uniform float uNight; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir); float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.55));
  float s = max(dot(d, uSun), 0.0);
  col += uSunCol * (pow(s, 900.0) * 3.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.18);
  // stars come out at night
  vec3 q = floor(d * 190.0); float star = step(0.991, fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453)) * uNight * smoothstep(0.05, 0.35, y);
  col += vec3(star);
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

  const shared = { uLight: { value: 1 }, uNight: { value: 0 }, uAmp: { value: 1 }, uTime: { value: 0 }, uSun: { value: SUN_DIR }, uSunCol: { value: C(PAL.sun) }, uZenith: { value: C(PAL.zenith) }, uHorizon: { value: C(PAL.horizon) }, uFog: { value: C(PAL.fog) } };
  world.sky = new THREE.Mesh(new THREE.SphereGeometry(1350, 24, 12), new THREE.ShaderMaterial({ uniforms: shared, side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: SKY_FRAG }));
  world.sky.renderOrder = -10; world.sky.frustumCulled = false; scene.add(world.sky);

  for (const isl of ISLANDS) plan(isl);
  world.ocean = new THREE.Mesh(oceanGeo(1500, 140), new THREE.ShaderMaterial({
    uniforms: Object.assign({ uDeep: { value: C(PAL.deep) }, uShallow: { value: C(PAL.shallow) }, uFogD: { value: scene.fog.density }, uIsles: { value: ISLANDS.map((i) => new THREE.Vector3(i.x, i.z, i.r)) } }, shared),
    vertexShader: OCEAN_VERT, fragmentShader: OCEAN_FRAG, transparent: true, depthWrite: false,
  }));
  world.ocean.frustumCulled = false; world.ocean.renderOrder = 1; scene.add(world.ocean);
  world.abyss = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PAL.abyss }));
  world.abyss.position.y = -13.6; scene.add(world.abyss);

  const palm = palmGeo(), tree = treeGeo(), rock = rockGeo(), bush = bushGeo(), jtree = jungleTreeGeo(), fern = fernGeo(), dead = deadTreeGeo();
  for (const isl of ISLANDS) {
    world.byId[isl.id] = isl;
    const g = new THREE.Group(); isl.group = g; scene.add(g);
    g.add(terrainMesh(isl));
    const m = new Kit(KINDS);
    pier(m, isl);
    if (isl.kind === 'town') town(m, isl, g);
    if (isl.kind === 'fort') fort(m, isl);
    if (isl.kind === 'ruins') ruins(m, isl);
    if (isl.kind === 'crab') crabNest(m, isl);
    if (isl.navy) navyFort(m, isl, g);
    dressScenery(isl, g);
    // biomes: jungle, dry scrub, or temperate woods. Away from the ports the forest is dense.
    const wild = isl.kind === 'town' ? 1 : 3.5;
    const dense = (isl.jungle ? 1.5 : isl.kind === 'crab' || isl.kind === 'islet' ? 0.5 : 1) * wild;
    g.add(m.mesh());
    isl.blocks = isl.colliders.filter((c) => c.r > 1.4).map((c) => ({ x: c.x, z: c.z, r: c.r }));
    dressWith(scatter(g, isl, rock, Math.round(isl.r * 0.12) + 4, 0.2, 60, 0.6, 2.4, 0.62, true), rock, NAT + 'rock_single_B.gltf');
    dressWith(scatter(g, isl, rock, Math.round(isl.r * 0.1), isl.h * 0.8, 200, 2, 5, 0.7, true), rock, NAT + 'rock_single_D.gltf'); // crags up high
    dressWith(scatter(g, isl, palm, Math.round(isl.r * 0.34 * dense), 1.3, 7, 0.8, 1.35, 0.35), palm, NAT + 'tree_single_A.gltf');
    if (isl.r > 100) dressWith(scatter(g, isl, tree, Math.round(isl.r * 0.3 * dense), 5, isl.h * 0.9, 0.8, 1.5, 0.5), tree, NAT + 'trees_A_medium.gltf');
    if (isl.r > 100 && wild > 1) dressWith(scatter(g, isl, tree, Math.round(isl.r * 0.2 * wild), 5, isl.h * 0.9, 0.8, 1.5, 0.5), tree, NAT + 'trees_A_medium.gltf');
    dressWith(scatter(g, isl, bush, Math.round(isl.r * 0.22 * dense), 2, 30, 0.6, 1.3, 0), bush, NAT + 'trees_A_small.gltf');
    scatter(g, isl, fern, Math.round(isl.r * 0.28 * dense), 1.8, 40, 0.8, 1.5, 0);
    if (isl.jungle) dressWith(scatter(g, isl, jtree, Math.round(isl.r * 0.42 * wild), 4, isl.h * 1.4, 0.8, 1.5, 0.5), jtree, NAT + 'trees_B_large.gltf');
    if (isl.kind === 'ruins' || isl.kind === 'islet' || isl.kind === 'crab') scatter(g, isl, dead, 8, 1.5, 40, 0.8, 1.4, 0.3);
    if (isl.caveAt) { const c = isl.caveAt, cy = heightAt(c.x, c.z), k = new Kit(KINDS); // cave mouth
      for (const [dx, sc] of [[-2.6, 2.6], [2.6, 2.8], [0, 2.2]]) k.add(new THREE.DodecahedronGeometry(1, 0), PAL.darkRock, [c.x + dx, cy + (dx ? 1.6 : 4.4), c.z], [dx, dx * 2, 0.3], [sc, dx ? sc * 1.3 : 1.4, sc], 0.1, 'plain');
      k.add(box(3.4, 3.6, 0.6), 0x050505, [c.x, cy + 1.7, c.z - 0.9], [0, 0, 0], 1, 0, 'plain'); g.add(k.mesh()); isl.colliders.push({ x: c.x, z: c.z - 1.6, r: 2.2 }); }
  }

  // chart of the whole archipelago, used by the minimap and the map screen
  const S = 640, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = (i / S * 2 - 1) * WORLD_R, z = (j / S * 2 - 1) * WORLD_R, h = heightAt(x, z), k = (j * S + i) * 4;
    if (h > 0) { const t = clamp(h / 26, 0, 1); img.data[k] = 92 - t * 34; img.data[k + 1] = 74 - t * 30; img.data[k + 2] = 48 - t * 22; img.data[k + 3] = 255; }
    else if (h > -5) { img.data[k] = 120; img.data[k + 1] = 104; img.data[k + 2] = 70; img.data[k + 3] = 70; }
  }
  ctx.putImageData(img, 0, 0); world.chart = cv;

  // ----- the cave room (shared by every cave mouth) -----
  platforms.push(CAVE);
  { const k = new Kit(KINDS), c = CAVE;
    k.add(box(c.hw * 2 + 8, 1, c.hl * 2 + 8), 0x6a6258, [c.x, c.top - 0.5, c.z], [0, 0, 0], 1, 0.1, 'stone');
    for (let i = 0; i < 34; i++) { const t = (i / 34) * TAU, x = c.x + Math.sin(t) * (c.hw + 3.5), z = c.z + Math.cos(t) * (c.hl + 3.5), s = 3 + (i % 3) * 0.9; k.add(new THREE.DodecahedronGeometry(1, 0), i % 2 ? 0x5e574e : 0x4c463f, [x, c.top + s * 0.9, z], [i, i * 2, i * 0.5], [s, s * 1.9, s], 0.12, 'plain'); }
    for (let i = 0; i < 9; i++) k.add(cone(0.5 + (i % 3) * 0.3, 2 + (i % 4), 5), 0x665e55, [c.x + Math.sin(i * 2.4) * (c.hw - 1.5), c.top + 1 + (i % 4) * 0.5, c.z + Math.cos(i * 1.7) * (c.hl - 2)], [0, i, 0], 1, 0.1, 'plain');
    for (let i = 0; i < 6; i++) { const x = c.x + (i % 2 ? 1 : -1) * (c.hw - 0.5), z = c.z + (Math.floor(i / 2) - 1) * 10; k.add(cyl(0.08, 0.08, 1.6, 4), PAL.timber, [x, c.top + 1.4, z]); k.add(cone(0.28, 0.6, 5), 0xff9a3c, [x, c.top + 2.5, z], [0, 0, 0], 1, 0, 'plain'); }
    for (let i = 0; i < 7; i++) k.add(cone(0.3, 1.3, 4), 0x5fd0c0, [c.x + Math.sin(i * 1.9) * 7, c.top + 0.6, c.z + Math.cos(i * 2.7) * 12], [0.3 * Math.sin(i), i, 0.3 * Math.cos(i)], 1, 0, 'plain');
    const room = k.mesh(); scene.add(room); world.caveRoom = room;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(30, 12, 8), new THREE.MeshBasicMaterial({ color: 0x2a221a, side: THREE.BackSide, fog: false })); dome.scale.y = 0.55; dome.position.set(c.x, c.top, c.z); scene.add(dome);
  }

  // ----- the tavern room (shared by every tavern door) -----
  platforms.push(TAV);
  { const k = new Kit(KINDS), c = TAV, W = c.hw, H = c.hl, at = (x, y, z) => [c.x + x, c.top + y, c.z + z];
    k.add(box(W * 2 + 2, 1, H * 2 + 2), PAL.plank, at(0, -0.5, 0), [0, 0, 0], 1, 0.03);
    for (const sx of [-1, 1]) k.add(box(0.5, 3.6, H * 2 + 1), PAL.timber, at(sx * (W + 0.25), 1.8, 0)); k.add(box(W * 2 + 1, 3.6, 0.5), PAL.timber, at(0, 1.8, H + 0.25));
    for (const sx of [-1, 1]) k.add(box(W - 1.2, 3.6, 0.5), PAL.timber, at(sx * (W / 2 + 0.8), 1.8, -H - 0.25)); k.add(box(2.6, 0.5, 0.6), PAL.darkTimber, at(0, 3.3, -H - 0.25));
    for (let i = -2; i <= 2; i++) k.add(box(W * 2 + 0.6, 0.3, 0.3), PAL.darkTimber, at(0, 3.6, i * 4)); // beams
    k.add(box(10, 1.1, 0.9), PAL.darkTimber, at(0, 0.55, 6.4)); k.add(box(10.4, 0.12, 1.2), PAL.plank, at(0, 1.16, 6.4)); // the bar
    k.add(box(9, 0.12, 0.5), PAL.darkTimber, at(0, 1.7, H - 0.3)); k.add(box(9, 0.12, 0.5), PAL.darkTimber, at(0, 2.5, H - 0.3));
    for (let i = 0; i < 14; i++) k.add(cyl(0.09, 0.11, 0.42, 6), [0x3f7a5c, 0x7a4a2a, 0x8a2a22, 0xc9a94a][i % 4], at(-4.2 + (i % 7) * 1.4, i < 7 ? 1.97 : 2.77, H - 0.3), [0, 0, 0], 1, 0, 'plain');
    for (const x of [-3.6, 3.6]) k.add(cyl(0.5, 0.5, 1.1, 8), PAL.timber, at(x, 1.75, 6.4), [Math.PI / 2, 0, 0]); // kegs on the bar
    c.tables = [[-4.4, -3.2], [4.4, -3.2], [0, 1.6]];
    // tables, chairs and rugs are placed by land.js from the model library (with a fallback there)
    k.add(box(0.8, 2.6, 3.2), PAL.stone, at(-W + 0.3, 1.3, 5.6)); k.add(box(0.5, 1.2, 1.8), 0x0d0b0a, at(-W + 0.75, 0.6, 5.6), [0, 0, 0], 1, 0, 'plain'); k.add(cone(0.5, 0.9, 5), 0xff9a3c, at(-W + 0.9, 0.5, 5.6), [0, 0, 0], 1, 0, 'plain'); // hearth
    for (const [x, z] of [[-W + 0.3, -4], [W - 0.3, -4], [W - 0.3, 3], [-W + 0.3, 0.5], [-3, H - 0.1], [3, H - 0.1]]) k.add(box(0.36, 0.46, 0.36), PAL.lit, at(x, 2.5, z), [0, 0, 0], 1, 0);
    for (const [x, z, s] of [[W - 1, H - 1.2, 1.2], [W - 2.2, H - 1, 1], [-W + 1, -H + 1.2, 1.1]]) k.add(cyl(0.4 * s, 0.4 * s, 0.95 * s, 7), PAL.timber, at(x, 0.48 * s, z));
    scene.add(k.mesh());
    const dome = new THREE.Mesh(new THREE.SphereGeometry(34, 12, 8), new THREE.MeshBasicMaterial({ color: 0x1c130c, side: THREE.BackSide, fog: false })); dome.scale.y = 0.6; dome.position.set(c.x, c.top, c.z); scene.add(dome);
  }

  // ----- time of day and weather -----
  const KEY = {
    night: { fog: C(0x31425c), zen: C(0x101a30), hor: C(0x3d5278), sun: C(0xb4c6ee), deep: C(0x0c2436), hemi: 1.85, sunI: 1.45, sky: C(0x9db0dc), n: 1 },
    dawn: { fog: C(0xc59a7c), zen: C(0x46506e), hor: C(0xe8a670), sun: C(0xffb070), deep: C(0x0d2a3a), hemi: 1.9, sunI: 2.0, sky: C(0xe6c8b0), n: 0.3 },
    day: { fog: C(PAL.fog), zen: C(PAL.zenith), hor: C(PAL.horizon), sun: C(PAL.sun), deep: C(PAL.deep), hemi: 2.1, sunI: 2.5, sky: C(0xdfe6ea), n: 0 },
  };
  const foul = { fog: C(0x444c52), zen: C(0x1c252c), hor: C(0x4f585c), sun: C(0x30302c), deep: C(0x081a22) };
  const cur = { fog: C(0), zen: C(0), hor: C(0), sun: C(0), deep: C(0) };
  const SEG = [[0, 'night', 'night'], [0.2, 'night', 'dawn'], [0.27, 'dawn', 'day'], [0.36, 'day', 'day'], [0.64, 'day', 'dawn'], [0.73, 'dawn', 'night'], [0.8, 'night', 'night'], [1, 'night', 'night']];
  world.weather = 0; world.tod = 0.42; world.cave = false; world.night = 0;
  world.setWeather = (k) => { world.weather = k; SEA.amp = 1 + k * 1.5; shared.uAmp.value = SEA.amp; };
  function applySky() {
    const t = world.tod; let i = 0; while (i < SEG.length - 2 && t >= SEG[i + 1][0]) i++;
    const A = KEY[SEG[i][1]], B = KEY[SEG[i][2]], f = clamp((t - SEG[i][0]) / (SEG[i + 1][0] - SEG[i][0]), 0, 1), k = world.weather, o = world.ocean.material.uniforms;
    for (const n of ['fog', 'zen', 'hor', 'sun', 'deep']) cur[n].copy(A[n]).lerp(B[n], f).lerp(foul[n], k * (n === 'sun' ? 0.8 : 1));
    let hemiI = lerp(A.hemi, B.hemi, f) * (1 - k * 0.45), sunI = lerp(A.sunI, B.sunI, f) * (1 - k * 0.8), dens = 0.00135 + k * 0.0021;
    world.night = lerp(A.n, B.n, f);
    if (world.cave) { cur.fog.set(0x2a221a); hemiI = 2.5; sunI = 0.9; dens = 0.004; if (world.tavern) { cur.fog.set(0x1c130c); hemiI = 3.2; sunI = 1.2; dens = 0.002; } }
    shared.uFog.value.copy(cur.fog); shared.uZenith.value.copy(cur.zen); shared.uHorizon.value.copy(cur.hor); shared.uSunCol.value.copy(cur.sun); o.uDeep.value.copy(cur.deep);
    shared.uNight.value = world.night * (1 - k); shared.uLight.value = clamp(hemiI / 2.1, 0.3, 1);
    scene.fog.color.copy(cur.fog); scene.background.copy(cur.fog); scene.fog.density = dens; o.uFogD.value = dens;
    hemi.intensity = hemiI; hemi.color.copy(A.sky).lerp(B.sky, f); if (world.cave) hemi.color.set(0xffc890); sun.intensity = sunI; sun.color.copy(cur.sun);
    // the sun crosses the sky by day; the moon takes over at night
    const th = (t - 0.25) * TAU, up = Math.sin(th);
    if (up > -0.08) SUN_DIR.set(-Math.cos(th) * 0.8, Math.max(0.06, up) * 0.9, -0.55).normalize(); else SUN_DIR.set(Math.cos(th) * 0.7, -up * 0.7 + 0.15, 0.5).normalize();
    sun.position.copy(SUN_DIR).multiplyScalar(100);
    setGlow(world.cave ? 1 : world.night);
  }
  let cullT = 0;
  world.update = (dt, cam) => {
    world.time += dt; shared.uTime.value = world.time; world.tod = (world.tod + dt / 780) % 1;
    world.ocean.position.set(cam.x, 0, cam.z); world.abyss.position.set(cam.x, -13.6, cam.z); world.sky.position.copy(cam);
    applySky();
    // far islands are hidden; mid-distance islands drop their trees and buildings
    cullT -= dt; if (cullT <= 0) { cullT = 0.4; for (const isl of ISLANDS) { const d = Math.hypot(cam.x - isl.x, cam.z - isl.z) - isl.r * 1.5; isl.group.visible = d < 1150; const near = d < 640; for (let i = 1; i < isl.group.children.length; i++) isl.group.children[i].visible = near; } world.ocean.visible = !world.cave; }
  };
  return world;
}
