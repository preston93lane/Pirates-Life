// Low-poly people (and crabs): built from a few jointed parts and animated procedurally.
import * as THREE from 'three';
import { damp, clamp, lerp, smooth } from './util.js';
import { Mesher } from './geo.js';

const SKIN = [0xb98a66, 0x8f6547, 0xc79b78, 0x6e4a35];
let playerLook = null;
export function setPlayerLook(l) { playerLook = l; }
const LOOKS = {
  player: { coat: 0x2a3f55, shirt: 0xc4b99d, pants: 0x2a2622, boots: 0x16120f, hat: 'tricorn', hatC: 0x14161a, tails: true, sash: 0x7d1f1a, weapon: 'cutlass', gun: true },
  crew: { coat: 0x4a3b2c, shirt: 0xa89f88, pants: 0x3b3a36, boots: 0x1c1713, hat: 'bandana', hatC: 0x2f5d63, weapon: 'cutlass' },
  brigand: { coat: 0x4d3c2d, shirt: 0x8a7a62, pants: 0x3d3832, boots: 0x16120f, hat: 'bandana', hatC: 0x6b1c18, weapon: 'cutlass', blade: 0x8c8a84 },
  marksman: { coat: 0x4c4636, shirt: 0x4c4636, pants: 0x2f2a26, boots: 0x16120f, hat: 'wide', hatC: 0x2b2520, tails: true, weapon: 'musket' },
  brute: { coat: null, shirt: null, pants: 0x33302b, boots: 0x16120f, hat: 'none', bulk: 1.3, sash: 0x6b1c18, weapon: 'axe' },
  captain: { coat: 0x5a1512, shirt: 0xc4b99d, pants: 0x1c1a19, boots: 0x0f0d0c, hat: 'tricorn', hatC: 0x0f0f10, tails: true, sash: 0xb58a2e, weapon: 'cutlass', blade: 0xd8dcdf },
  soldier: { coat: 0x27406b, shirt: 0x27406b, pants: 0xc4bca6, boots: 0x16120f, hat: 'shako', hatC: 0x14161a, sash: 0xc4bca6, weapon: 'cutlass' },
  skeleton: { bone: true, thin: 0.5, pants: 0x34352c, hat: 'rag', hatC: 0x3d2a26, weapon: 'cutlass', blade: 0x7a6a58 },
  keeper: { coat: 0x6b3a30, shirt: 0xc4b99d, pants: 0x3b3a36, boots: 0x1c1713, hat: 'none', hair: 0x5a2d1c, apron: 0xb9b09a },
  wright: { coat: null, shirt: 0x8c7a5a, pants: 0x4a3b2c, boots: 0x1c1713, hat: 'wide', hatC: 0x6e5a40, apron: 0x5c4733 },
  smith: { coat: null, shirt: null, pants: 0x2f2a26, boots: 0x16120f, hat: 'none', hair: 0x1a1512, bulk: 1.15, apron: 0x3a2e24 },
  merchant: { coat: 0x2f5d63, shirt: 0xc4b99d, pants: 0x2a2622, boots: 0x16120f, hat: 'wide', hatC: 0x1c1a19, tails: true, sash: 0xb58a2e },
  crab: { crab: true },
};

const mats = new Map();
const mat = (c) => { let m = mats.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c, flatShading: true }); mats.set(c, m); } return m; };
const geos = new Map();
const G = (key, make) => { let g = geos.get(key); if (!g) { g = make(); geos.set(key, g); } return g; };
const limb = (rt, rb, len) => G(`l${rt.toFixed(3)}:${rb.toFixed(3)}:${len}`, () => new THREE.CylinderGeometry(rt, rb, len, 6).translate(0, -len / 2, 0));
const bx = (w, h, d, ox = 0, oy = 0, oz = 0) => G(`b${w}:${h}:${d}:${ox}:${oy}:${oz}`, () => new THREE.BoxGeometry(w, h, d).translate(ox, oy, oz));
const part = (g, color, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(g, mat(color)); m.position.set(x, y, z); parent.add(m); return m; };
const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

function weaponMesh(kind, parent, blade = 0xb9bdc1) {
  if (kind === 'cutlass') {
    part(bx(0.03, 0.74, 0.085, 0, 0.47, 0), blade, parent); part(bx(0.03, 0.26, 0.07, 0, 0.13, 0), blade, parent, 0, 0.82, 0.0).rotation.x = -0.22;
    part(bx(0.06, 0.05, 0.24, 0, 0.09, 0), 0x8a6a2c, parent); part(bx(0.045, 0.16, 0.045, 0, 0, 0), 0x241a12, parent);
  } else if (kind === 'axe') {
    part(bx(0.07, 1.25, 0.07, 0, 0.5, 0), 0x4a3828, parent); part(bx(0.05, 0.42, 0.46, 0, 1.0, 0.2), 0x7c7f82, parent);
  } else if (kind === 'musket') {
    part(bx(0.06, 1.25, 0.09, 0, 0.42, 0), 0x4a3424, parent); part(bx(0.035, 0.7, 0.035, 0, 0.9, -0.02), 0x2b2d30, parent);
  } else if (kind === 'pistol') {
    part(bx(0.05, 0.3, 0.06, 0, 0.16, 0), 0x2b2d30, parent); part(bx(0.05, 0.08, 0.14, 0, 0.0, -0.05), 0x4a3424, parent);
  }
}

function buildCrab() {
  const root = new THREE.Group(), P = {}, shell = 0x7c3626, dark = 0x4f2219;
  const body = joint(root, 0, 0.5, 0); P.body = body;
  const s = part(G('crabshell', () => new THREE.IcosahedronGeometry(0.62, 1).scale(1.3, 0.48, 1)), shell, body);
  part(G('crabbelly', () => new THREE.IcosahedronGeometry(0.5, 0).scale(1.2, 0.3, 0.9)), 0xb9a07a, body, 0, -0.14, 0); void s;
  for (const sx of [-1, 1]) { part(limb(0.03, 0.03, 0.22), dark, body, sx * 0.2, 0.42, 0.45); part(G('crabeye', () => new THREE.IcosahedronGeometry(0.06, 0)), 0x0d0d0d, body, sx * 0.2, 0.44, 0.45); }
  P.legs = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const j = joint(body, sx * 0.62, -0.05, (i - 1) * 0.36 - 0.05); j.rotation.z = sx * 1.05; j.userData = { sx, i };
    part(limb(0.06, 0.04, 0.62), dark, j); const k = joint(j, 0, -0.6, 0); k.rotation.z = -sx * 1.3; part(limb(0.04, 0.015, 0.5), dark, k); P.legs.push(j);
  }
  P.claws = [];
  for (const sx of [-1, 1]) {
    const j = joint(body, sx * 0.55, 0.02, 0.42); j.rotation.x = -Math.PI / 2; j.rotation.z = sx * 0.35; j.userData = { sx };
    part(limb(0.08, 0.07, 0.5), shell, j); part(G('crabclaw', () => new THREE.IcosahedronGeometry(0.2, 0).scale(0.8, 1.5, 0.9)), shell, j, 0, -0.66, 0); part(bx(0.06, 0.3, 0.1), dark, j, 0.1 * sx, -0.86, 0); P.claws.push(j);
  }
  const sh = new THREE.Mesh(G('shadow', () => new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2)), SHADOW); sh.position.y = 0.04; sh.scale.setScalar(2.2); root.add(sh);
  const c = { root, P, anim: { state: 'idle', u: 0, i: 0, ph: 0, t: 0, speed: 0 }, height: 1.1 };
  c.update = (dt) => {
    const a = c.anim; a.t += dt;
    if (a.state === 'run') a.ph += dt * 13;
    for (const l of P.legs) l.rotation.y = a.state === 'run' ? Math.sin(a.ph + l.userData.i * 2.1 + (l.userData.sx > 0 ? 0 : Math.PI)) * 0.45 : 0;
    let raise = 0, snap = 0;
    if (a.state === 'attack') { raise = a.u < 0.3 ? a.u / 0.3 : 1 - smooth(0.3, 0.5, a.u); snap = smooth(0.3, 0.45, a.u) * (1 - smooth(0.6, 1, a.u)); }
    for (const k of P.claws) { k.rotation.x = damp(k.rotation.x, -Math.PI / 2 - raise * 1.1 + snap * 0.5, 22, dt); k.position.z = damp(k.position.z, 0.42 + snap * 0.5, 22, dt); }
    body.position.y = 0.5 + (a.state === 'run' ? Math.abs(Math.sin(a.ph)) * 0.04 : Math.sin(a.t * 2) * 0.015) + raise * 0.12;
    body.rotation.x = a.state === 'dead' ? damp(body.rotation.x, Math.PI, 8, dt) : -raise * 0.25 + (a.state === 'stagger' ? -0.3 : 0);
    if (a.state === 'dead') body.position.y = 0.25;
  };
  return c;
}

export function buildCharacter(lookName, opts = {}) {
  let L = LOOKS[lookName];
  if (L.crab) return buildCrab();
  if (lookName === 'player' && playerLook) L = Object.assign({}, L, playerLook);
  const thin = L.thin || 1, bulk = L.bulk || 1, skin = L.bone ? 0xcfc7b0 : SKIN[(L.skinI ?? opts.seed ?? (Math.random() * 4)) % 4 | 0];
  const sleeve = L.bone ? skin : L.coat ?? L.shirt ?? skin, chest = L.bone ? skin : L.coat ?? L.shirt ?? skin;
  const root = new THREE.Group(), P = {};
  P.pivot = joint(root, 0, 0.92, 0); const inner = joint(P.pivot, 0, -0.92, 0);
  P.hips = joint(inner, 0, 0.92, 0); P.torso = joint(P.hips, 0, 0, 0);
  // torso
  const tg = G(`torso${bulk}:${thin}`, () => new THREE.CylinderGeometry(0.27 * bulk * (L.bone ? 0.7 : 1), 0.2 * bulk * (L.bone ? 0.45 : 1), 0.58, 6).scale(1, 1, 0.62).translate(0, 0.29, 0));
  part(tg, chest, P.torso);
  if (L.bone) for (let i = 0; i < 3; i++) part(bx(0.36, 0.035, 0.2), 0x9d957f, P.torso, 0, 0.22 + i * 0.11, 0);
  if (L.shirt && L.coat) part(bx(0.16 * bulk, 0.4, 0.06), L.shirt, P.torso, 0, 0.33, 0.16 * bulk);
  if (L.apron) part(bx(0.34 * bulk, 0.62, 0.05), L.apron, P.torso, 0, 0.12, 0.17 * bulk);
  if (L.sash) part(G(`sash${bulk}`, () => new THREE.CylinderGeometry(0.215 * bulk, 0.215 * bulk, 0.09, 6).scale(1, 1, 0.66)), L.sash, P.torso, 0, 0.05, 0);
  if (L.tails) part(G(`tails${bulk}`, () => new THREE.CylinderGeometry(0.21 * bulk, 0.33 * bulk, 0.52, 6, 1, true).scale(1, 1, 0.72)), L.coat, P.hips, 0, -0.24, -0.02).material = mat2(L.coat);
  else part(G(`pelvis${bulk}:${thin}`, () => new THREE.CylinderGeometry(0.2 * bulk * (L.bone ? 0.5 : 1), 0.19 * bulk * (L.bone ? 0.6 : 1), 0.2, 6).scale(1, 1, 0.62)), L.pants, P.hips, 0, -0.08, 0);
  // head
  P.head = joint(P.torso, 0, 0.6, 0);
  part(G('head', () => new THREE.IcosahedronGeometry(0.125, 1).scale(1, 1.14, 1.04)), skin, P.head, 0, 0.13, 0);
  if (L.bone) { part(bx(0.05, 0.05, 0.03), 0x101010, P.head, -0.045, 0.15, 0.115); part(bx(0.05, 0.05, 0.03), 0x101010, P.head, 0.045, 0.15, 0.115); part(bx(0.1, 0.06, 0.08), skin, P.head, 0, 0.02, 0.07); }
  if (L.hair) part(G('hair', () => new THREE.IcosahedronGeometry(0.135, 1).scale(1, 0.9, 1.05)), L.hair, P.head, 0, 0.17, -0.02);
  if (L.hat === 'tricorn') { part(G('tri', () => new THREE.CylinderGeometry(0.31, 0.27, 0.05, 3).rotateY(Math.PI)), L.hatC, P.head, 0, 0.235, 0); part(G('tricrown', () => new THREE.CylinderGeometry(0.115, 0.135, 0.11, 6)), L.hatC, P.head, 0, 0.3, 0); }
  if (L.hat === 'wide') { part(G('brim', () => new THREE.CylinderGeometry(0.27, 0.27, 0.025, 8)), L.hatC, P.head, 0, 0.235, 0); part(G('crown', () => new THREE.CylinderGeometry(0.1, 0.135, 0.15, 6)), L.hatC, P.head, 0, 0.31, 0); }
  if (L.hat === 'shako') part(G('shako', () => new THREE.CylinderGeometry(0.12, 0.13, 0.2, 6)), L.hatC, P.head, 0, 0.33, 0);
  if (L.hat === 'bandana' || L.hat === 'rag') { part(G('band', () => new THREE.IcosahedronGeometry(0.133, 1).scale(1, 0.62, 1.05)), L.hatC, P.head, 0, 0.2, -0.005); part(bx(0.06, 0.16, 0.04), L.hatC, P.head, 0.07, 0.13, -0.14); }
  // arms
  const arm = (sx) => {
    const a = joint(P.torso, sx * 0.3 * bulk * (L.bone ? 0.8 : 1), 0.52, 0);
    part(limb(0.075 * thin * bulk, 0.062 * thin * bulk, 0.3), sleeve, a);
    const f = joint(a, 0, -0.3, 0); part(limb(0.058 * thin * bulk, 0.05 * thin * bulk, 0.27), L.coat ? sleeve : skin, f);
    part(G('hand', () => new THREE.IcosahedronGeometry(0.055, 0)), skin, f, 0, -0.3, 0);
    return [a, f, joint(f, 0, -0.31, 0)];
  };
  [P.armR, P.foreR, P.weapon] = arm(-1); [P.armL, P.foreL, P.gun] = arm(1);
  if (L.weapon) weaponMesh(L.weapon, P.weapon, opts.blade ?? L.blade);
  if (L.gun) { weaponMesh('pistol', P.gun); P.gun.visible = false; }
  // legs
  const leg = (sx) => {
    const l = joint(inner, sx * 0.11 * bulk, 0.92, 0); part(limb(0.1 * thin * bulk, 0.078 * thin * bulk, 0.46), L.pants, l);
    const s = joint(l, 0, -0.46, 0); part(limb(0.074 * thin * bulk, 0.062 * thin * bulk, 0.42), L.bone ? skin : L.boots, s); part(bx(0.12, 0.08, 0.25, 0, 0, 0.05), L.bone ? skin : L.boots, s, 0, -0.42, 0);
    return [l, s];
  };
  [P.legR, P.shinR] = leg(-1); [P.legL, P.shinL] = leg(1);
  if (!L.bone) { // the small things that make a figure read as a person
    part(limb(0.055, 0.065, 0.1), skin, P.torso, 0, 0.66, 0); // neck
    part(bx(0.09, 0.07, 0.03), 0xc79a3a, P.torso, 0, 0.05, 0.135 * bulk); // belt buckle
    for (const s of [P.shinL, P.shinR]) part(limb(0.092 * bulk, 0.08 * bulk, 0.1), L.boots, s);
    if (L.coat) { part(bx(0.34 * bulk, 0.1, 0.1), L.coat, P.torso, 0, 0.6, -0.1); for (const f of [P.foreL, P.foreR]) part(limb(0.07 * bulk, 0.07 * bulk, 0.07), L.shirt || L.coat, f, 0, -0.19, 0); }
    if (L.weapon) { const st = part(bx(0.06, 0.74, 0.03), 0x2a1d14, P.torso, 0, 0.3, 0.165 * bulk); st.rotation.z = 0.62; } // baldric
    const seed = (L.skinI ?? opts.seed ?? Math.random() * 4) * 7 % 3;
    if (lookName !== 'player' && seed > 1.4 && !L.apron) part(bx(0.16, 0.1, 0.08), 0x2a1d14, P.head, 0, 0.045, 0.085); // beard
    if (lookName === 'captain' || lookName === 'soldier') for (const sx of [-1, 1]) part(bx(0.13, 0.04, 0.14), 0xc79a3a, P.torso, sx * 0.29 * bulk, 0.585, 0);
    if (lookName === 'captain') part(bx(0.04, 0.26, 0.12), 0x8a2a22, P.head, 0.14, 0.36, -0.06).rotation.z = -0.5; // hat feather
  }
  if (!opts.noShadow) { const sh = new THREE.Mesh(G('shadow', () => new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2)), SHADOW); sh.position.y = 0.04; root.add(sh); }

  const armed = !!L.weapon, c = { root, P, anim: { state: 'idle', u: 0, i: 0, ph: 0, t: 0, speed: 0 }, height: 1.85 };
  const cur = {}, T = {};
  const KEYS = ['hipY', 'tX', 'tY', 'aRx', 'aRz', 'fRx', 'wRx', 'wRz', 'aLx', 'aLz', 'fLx', 'lLx', 'lRx', 'sLx', 'sRx'];
  for (const k of KEYS) cur[k] = 0;
  const ATK = [ // [windup pose, follow-through pose]
    [{ tY: -0.85, aRx: -1.35, aRz: -0.95, fRx: -0.35, wRx: 1.5 }, { tY: 0.9, tX: 0.15, aRx: -1.25, aRz: 0.75, fRx: -0.15, wRx: 1.6 }],
    [{ tY: 0.75, aRx: -1.3, aRz: 0.95, fRx: -0.6, wRx: 1.5 }, { tY: -0.85, tX: 0.12, aRx: -1.25, aRz: -0.8, fRx: -0.1, wRx: 1.6 }],
    [{ tY: -0.25, tX: -0.18, aRx: -2.8, aRz: -0.1, fRx: -0.7, wRx: 1.0 }, { tY: 0.2, tX: 0.4, aRx: -0.75, aRz: 0.15, fRx: -0.1, wRx: 1.9 }],
  ];
  const GUARD = armed ? { aRx: -0.45, aRz: -0.12, fRx: -0.95, wRx: 1.15, aLx: 0.1, aLz: 0.12, fLx: -0.25 } : { aRz: -0.08, aLz: 0.08, fRx: -0.12, fLx: -0.12 };
  c.update = (dt) => {
    const a = c.anim; a.t += dt;
    for (const k of KEYS) T[k] = GUARD[k] || 0;
    let rate = 16;
    if (a.state === 'idle') { T.tX = Math.sin(a.t * 1.7) * 0.02; T.hipY = Math.sin(a.t * 1.7) * 0.008; }
    else if (a.state === 'run') {
      a.ph += dt * (4.2 + a.speed * 1.55); const s = Math.sin(a.ph), k = clamp(a.speed / 5, 0.35, 1.1);
      T.lLx = -s * 0.95 * k; T.lRx = s * 0.95 * k; T.sLx = Math.max(0, Math.cos(a.ph)) * 1.2 * k; T.sRx = Math.max(0, -Math.cos(a.ph)) * 1.2 * k;
      T.aLx = s * 0.7 * k; T.fLx = -0.5; T.tX = 0.16 * k; T.tY = s * 0.12; T.hipY = Math.abs(Math.cos(a.ph)) * 0.05 - 0.03;
      if (!armed) { T.aRx = -s * 0.7 * k; T.fRx = -0.5; } else T.aRx += -s * 0.15;
      rate = 22;
    } else if (a.state === 'attack') {
      const [w, f] = ATK[a.i % 3], u = a.u; rate = 30;
      const set = (pose, amt) => { for (const k in pose) T[k] = lerp(T[k], pose[k], amt); };
      if (u < 0.3) set(w, smooth(0, 0.3, u)); else { set(w, 1); set(f, smooth(0.3, 0.5, u)); const back = smooth(0.62, 1, u); for (const k of KEYS) T[k] = lerp(T[k], GUARD[k] || 0, back); }
      T.lLx = -0.35; T.lRx = 0.3; T.sRx = 0.25; T.hipY = -0.05;
    } else if (a.state === 'block') { T.aRx = -1.25; T.aRz = 0.55; T.fRx = -1.3; T.wRx = 0.5; T.wRz = 1.1; T.tX = 0.06; T.hipY = -0.06; T.lLx = -0.25; T.lRx = 0.2; rate = 26; }
    else if (a.state === 'stagger') { T.tX = -0.45; T.aRx = 0.3; T.aRz = -0.7; T.aLz = 0.7; T.aLx = 0.3; T.lLx = 0.3; T.hipY = -0.08; rate = 24; }
    else if (a.state === 'shoot') { T.aLx = -1.5 + smooth(0.15, 0.3, a.u) * 0.5 * (1 - smooth(0.3, 0.8, a.u)); T.aLz = -0.1; T.fLx = -0.05; T.tY = -0.35; rate = 28; }
    else if (a.state === 'aim') { T.aRx = -1.45; T.fRx = -0.1; T.wRx = 1.55; T.aLx = -1.2; T.aLz = -0.5; T.fLx = -0.6; T.tY = 0.25; }
    else if (a.state === 'dig') { const s = Math.sin(a.t * 9); T.tX = 0.75 + s * 0.15; T.aRx = -0.9 - s * 0.5; T.aLx = -0.9 - s * 0.5; T.fRx = -0.4; T.fLx = -0.4; T.hipY = -0.2; T.lLx = -0.5; T.lRx = -0.5; T.sLx = 0.9; T.sRx = 0.9; }
    else if (a.state === 'roll') { T.tX = 0.9; T.lLx = -1.6; T.lRx = -1.6; T.sLx = 1.9; T.sRx = 1.9; T.aRx = -0.9; T.aLx = -0.9; T.hipY = -0.3; rate = 30; }
    else if (a.state === 'whirl') { T.aRx = -1.45; T.aRz = -1.25; T.fRx = -0.05; T.wRx = 1.6; T.tX = 0.18; T.hipY = -0.1; T.lLx = -0.4; T.lRx = 0.35; rate = 32; }
    else if (a.state === 'throw') { T.aLx = -2.6 + smooth(0.2, 0.5, a.u) * 2.0; T.aLz = -0.2; T.fLx = -0.4; T.tY = -0.3 + smooth(0.2, 0.5, a.u) * 0.6; rate = 28; }
    for (const k of KEYS) cur[k] = damp(cur[k], T[k], rate, dt);
    P.hips.position.y = 0.92 + cur.hipY; P.torso.rotation.set(cur.tX, cur.tY, 0);
    P.armR.rotation.set(cur.aRx, 0, cur.aRz); P.foreR.rotation.x = cur.fRx; P.weapon.rotation.set(cur.wRx, 0, cur.wRz);
    P.armL.rotation.set(cur.aLx, 0, cur.aLz); P.foreL.rotation.x = cur.fLx; P.gun.rotation.x = 1.5;
    P.legL.rotation.x = cur.lLx; P.legR.rotation.x = cur.lRx; P.shinL.rotation.x = cur.sLx; P.shinR.rotation.x = cur.sRx;
    if (L.gun) P.gun.visible = a.state === 'shoot';
    if (a.state === 'roll') { P.pivot.rotation.x = a.u * Math.PI * 2; P.pivot.position.y = 0.92 - Math.sin(a.u * Math.PI) * 0.35; }
    else if (a.state === 'dead') { const k = Math.min(1, a.t / 0.45); P.pivot.rotation.x = -k * k * (Math.PI / 2); P.pivot.position.y = 0.92 - k * 0.78; }
    else { P.pivot.rotation.x = 0; P.pivot.position.y = 0.92; }
    P.pivot.rotation.y = a.state === 'whirl' ? a.u * Math.PI * 2 : 0;
  };
  c.setBlade = (color) => { P.weapon.children[0].material = mat(color); P.weapon.children[1].material = mat(color); };
  c.update(0.016);
  return c;
}
const mats2 = new Map();
function mat2(c) { let m = mats2.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c, flatShading: true, side: THREE.DoubleSide }); mats2.set(c, m); } return m; }

// A posed, merged copy: one draw call. Used for townsfolk and deck crew.
export function staticFigure(lookName, pose = 'idle') {
  const c = buildCharacter(lookName, { noShadow: true });
  c.anim.state = pose; for (let i = 0; i < 30; i++) c.update(0.05);
  c.root.updateMatrixWorld(true);
  const m = new Mesher();
  c.root.traverseVisible((o) => { if (o.isMesh) { m.add(o.geometry.clone(), o.material.color, [0, 0, 0], [0, 0, 0], 1, 0.03); m.parts[m.parts.length - 1].applyMatrix4(o.matrixWorld); } });
  return m.mesh();
}

// Companion animals. Simple merged bodies; the parrot gets flapping wings.
export function buildPet(kind) {
  const root = new THREE.Group(), body = new THREE.Group(), m = new Mesher(); root.add(body);
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  let wings = null;
  if (kind === 'parrot') {
    m.add(new THREE.IcosahedronGeometry(0.13, 0), 0xb7302a, [0, 0, 0], [0, 0, 0], [1, 1.35, 1]); m.add(new THREE.IcosahedronGeometry(0.095, 0), 0xc23a30, [0, 0.2, 0.05]);
    m.add(new THREE.ConeGeometry(0.04, 0.12, 4), 0xe9c46a, [0, 0.19, 0.17], [1.9, 0, 0]); m.add(B(0.07, 0.03, 0.3), 0x2b5fa8, [0, -0.16, -0.2], [0.5, 0, 0]);
    wings = [-1, 1].map((sx) => { const g = new THREE.Group(); g.position.set(sx * 0.1, 0.06, 0); const w = new Mesher(); w.add(B(0.3, 0.025, 0.2), 0x2b5fa8, [sx * 0.15, 0, -0.02]); w.add(B(0.14, 0.03, 0.16), 0xe9c46a, [sx * 0.07, 0.005, 0]); g.add(w.mesh()); body.add(g); return g; });
  } else {
    const k = kind === 'cat' ? 0.62 : 1, fur = kind === 'cat' ? 0x45403a : 0x86633f, dark = kind === 'cat' ? 0x2c2925 : 0x55402b;
    m.add(B(0.28 * k, 0.28 * k, 0.72 * k), fur, [0, 0.46 * k, 0]); m.add(B(0.25 * k, 0.24 * k, 0.26 * k), fur, [0, 0.68 * k, 0.42 * k]); m.add(B(0.13 * k, 0.11 * k, 0.18 * k), kind === 'cat' ? 0xcfc7b0 : dark, [0, 0.63 * k, 0.6 * k]);
    for (const sx of [-1, 1]) { m.add(kind === 'cat' ? new THREE.ConeGeometry(0.05, 0.12, 4) : B(0.07, 0.15, 0.08), dark, [sx * 0.09 * k, 0.86 * k, 0.38 * k]); for (const sz of [-1, 1]) m.add(B(0.085 * k, 0.34 * k, 0.085 * k), dark, [sx * 0.095 * k, 0.17 * k, sz * 0.27 * k]); }
    m.add(B(0.055 * k, 0.055 * k, 0.36 * k), dark, [0, (kind === 'cat' ? 0.72 : 0.62) * k, -0.46 * k], [kind === 'cat' ? -1.1 : -0.6, 0, 0]);
  }
  body.add(m.mesh());
  const sh = new THREE.Mesh(G('shadow', () => new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2)), SHADOW); sh.position.y = 0.04; sh.scale.setScalar(kind === 'parrot' ? 0.3 : 0.7); if (kind !== 'parrot') root.add(sh);
  let t = Math.random() * 9;
  return { root, kind, update(dt, moving) { t += dt; if (wings) { const f = 0.25 + Math.sin(t * 24) * 0.85; wings[0].rotation.z = f; wings[1].rotation.z = -f; body.position.y = Math.sin(t * 5) * 0.06; } else { body.position.y = moving ? Math.abs(Math.sin(t * 13)) * 0.13 : 0; body.rotation.x = moving ? Math.sin(t * 13) * 0.1 : 0; } } };
}
export { SKIN };
