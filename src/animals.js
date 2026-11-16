// Wild animals of the islands, built in code: deer, boar, goats and rabbits that bolt when you come close,
// and wolves and bears that come for you. Each has four legs that walk, a tail, and a head that turns.
import * as THREE from 'three';
import { Mesher, box, cyl, ball, cone } from './geo.js';
import { groundAt, heightAt } from './world.js';
import { ISLANDS } from './data.js';
import { rand, pick, TAU, damp, dist2, angleDiff, turnToward } from './util.js';

// size, colours, speed, whether it runs from you, and whether it attacks
const KIND = {
  deer: { s: 1.0, fur: 0x9a6a3c, belly: 0xd9c4a0, speed: 4.2, flee: true, hp: 0 },
  boar: { s: 0.8, fur: 0x4a3a2c, belly: 0x5a4a3a, speed: 3.4, flee: true, hp: 0, tusk: true },
  goat: { s: 0.85, fur: 0xd8d2c4, belly: 0xc0b8a8, speed: 3.6, flee: true, hp: 0, horn: true },
  rabbit: { s: 0.3, fur: 0xb8a68a, belly: 0xe2d8c2, speed: 4.8, flee: true, hp: 0, ears: 1.8 },
  wolf: { s: 0.95, fur: 0x6a6660, belly: 0xa8a29a, speed: 4.6, flee: false, hp: 40, dmg: 12, reach: 1.8 },
  bear: { s: 1.5, fur: 0x4a3626, belly: 0x6a5238, speed: 3.0, flee: false, hp: 90, dmg: 22, reach: 2.6 },
};
// which animals an island of each biome has, and how many per 100 units of radius
const BIOME = {
  temperate: [['deer', 2], ['boar', 1.5], ['rabbit', 2], ['goat', 0.6], ['wolf', 0.6]],
  jungle: [['boar', 2], ['bear', 0.4], ['wolf', 0.5], ['rabbit', 1]],
  dry: [['goat', 1.5], ['rabbit', 1.5], ['wolf', 0.3]],
};

function build(kind) {
  const K = KIND[kind], s = K.s, m = new Mesher(), root = new THREE.Group(), legs = [];
  const body = new THREE.Group(); root.add(body);
  const bodyLen = 1.0 * s, bodyH = 0.5 * s;
  m.add(box(0.55 * s, bodyH, bodyLen), K.fur, [0, 0.95 * s, 0]);
  m.add(box(0.5 * s, 0.25 * s, bodyLen * 0.85), K.belly, [0, 0.75 * s, 0]);
  // neck and head, on a joint so the head can turn
  const neck = new THREE.Group(); neck.position.set(0, 1.12 * s, bodyLen * 0.42); body.add(neck); root.userData.head = neck;
  neck.add(new THREE.Mesh(box(0.22 * s, 0.5 * s, 0.22 * s).translate(0, 0.2 * s, 0), mat(K.fur)));
  const head = new THREE.Group(); head.position.set(0, 0.45 * s, 0.05 * s); neck.add(head);
  head.add(new THREE.Mesh(box(0.3 * s, 0.3 * s, 0.4 * s).translate(0, 0.02 * s, 0.12 * s), mat(K.fur)));
  head.add(new THREE.Mesh(box(0.16 * s, 0.14 * s, 0.2 * s).translate(0, -0.02 * s, 0.36 * s), mat(K.belly)));
  for (const sx of [-1, 1]) head.add(new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 6, 4).translate(sx * 0.1 * s, 0.07 * s, 0.26 * s), mat(0x111111)));
  if (K.ears) { for (const sx of [-1, 1]) head.add(new THREE.Mesh(box(0.06 * s, 0.22 * s * K.ears, 0.06 * s).translate(sx * 0.07 * s, 0.22 * s, 0), mat(K.fur))); }
  else if (kind === 'deer') for (const sx of [-1, 1]) { head.add(new THREE.Mesh(box(0.04 * s, 0.32 * s, 0.04 * s).translate(sx * 0.12 * s, 0.32 * s, -0.04 * s).rotateZ(sx * 0.4), mat(0x5a3e24))); }
  else if (K.horn) for (const sx of [-1, 1]) head.add(new THREE.Mesh(cone(0.03 * s, 0.14 * s, 4).translate(sx * 0.08 * s, 0.22 * s, 0.05 * s), mat(0x8a7a5a)));
  else if (K.tusk) for (const sx of [-1, 1]) head.add(new THREE.Mesh(cone(0.03 * s, 0.14 * s, 4).rotateX(-0.6).translate(sx * 0.1 * s, -0.08 * s, 0.25 * s), mat(0xe9e0c8)));
  else if (kind === 'wolf' || kind === 'bear') { head.add(new THREE.Mesh(cone(0.04 * s, 0.1 * s, 4).translate(0.07 * s, 0.2 * s, -0.02 * s), mat(K.fur))); head.add(new THREE.Mesh(cone(0.04 * s, 0.1 * s, 4).translate(-0.07 * s, 0.2 * s, -0.02 * s), mat(K.fur))); }
  // tail
  const tail = new THREE.Group(); tail.position.set(0, 1.05 * s, -bodyLen * 0.5); body.add(tail); root.userData.tail = tail;
  tail.add(new THREE.Mesh(box(0.08 * s, 0.08 * s, 0.3 * s).translate(0, 0, -0.15 * s), mat(K.belly)));
  // four legs on hip joints, long for the deer and short for the boar
  const legH = (kind === 'boar' || kind === 'wolf' ? 0.55 : kind === 'bear' ? 0.6 : 0.8) * s;
  for (const [x, z] of [[-0.18, 0.36], [0.18, 0.36], [-0.18, -0.36], [0.18, -0.36]].map(([a, b]) => [a * s, b * s * (bodyLen / 1)])) {
    const hip = new THREE.Group(); hip.position.set(x, 0.85 * s, z); body.add(hip);
    hip.add(new THREE.Mesh(box(0.12 * s, legH, 0.12 * s).translate(0, -legH / 2, 0), mat(K.fur)));
    hip.add(new THREE.Mesh(box(0.13 * s, 0.07 * s, 0.2 * s).translate(0, -legH - 0.02 * s, 0.04 * s), mat(0x2a2420)));
    legs.push({ hip, phase: (x > 0) !== (z > 0) ? 0 : Math.PI });
  }
  root.add(new THREE.Mesh(new THREE.CircleGeometry(0.5 * s, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false })));
  root.children[root.children.length - 1].position.y = 0.04;
  return { root, body, legs, K, s, legH, bodyLen };
}
const matCache = new Map();
function mat(c) { let m = matCache.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c, flatShading: true }); matCache.set(c, m); } return m; }

export function createAnimals(game) {
  const herd = [];
  for (const isl of ISLANDS) {
    if (isl.kind === 'hideout' || isl.kind === 'town' || isl.navy || isl.r < 60) continue;
    const grp = isl.group; if (!grp) continue;
    const table = BIOME[isl.biome] || BIOME.temperate;
    for (const [kind, per] of table) {
      const n = Math.round((isl.r / 100) * per * (kind === 'rabbit' ? 2 : 1));
      for (let i = 0; i < n; i++) {
        const a = build(kind); grp.add(a.root);
        const p = isl.spot(0.8, isl.h * 1.1, 12);
        herd.push({ a, isl, kind, x: p.x, z: p.z, face: rand(TAU), state: 'graze', wait: rand(1, 6), tx: p.x, tz: p.z, t: 0, hp: a.K.hp, alive: true, cd: 0, phase: rand(TAU) });
      }
    }
  }
  function update(dt) {
    const p = game.sea.player, onLand = game.mode === 'land' || game.mode === 'deck';
    const pl = game.land.player;
    for (const h of herd) {
      const near = Math.hypot(game.camera.position.x - h.isl.x, game.camera.position.z - h.isl.z) < 480;
      h.a.root.visible = near && h.alive; if (!near || !h.alive) continue;
      const K = h.a.K, px = game.mode === 'land' && pl ? pl.x : null, pz = game.mode === 'land' && pl ? pl.z : null;
      const dPlayer = px === null ? 1e9 : Math.hypot(px - h.x, pz - h.z);
      h.cd -= dt;
      // prey runs when you come near; predators come for you
      if (K.flee && dPlayer < 14) { h.state = 'flee'; h.wait = 2; }
      if (!K.flee && dPlayer < 26 && h.state !== 'attack') { h.state = 'chase'; }
      let speed = 0, want = null;
      if (h.state === 'flee') { want = Math.atan2(h.x - px, h.z - pz); speed = K.speed; if (dPlayer > 30) h.state = 'graze'; }
      else if (h.state === 'chase') {
        want = Math.atan2(px - h.x, pz - h.z); speed = K.speed;
        if (dPlayer < K.reach) { h.state = 'attack'; h.t = 0; }
        if (dPlayer > 60) h.state = 'graze';
      } else if (h.state === 'attack') {
        h.t += dt; want = Math.atan2(px - h.x, pz - h.z);
        if (h.t > 0.6 && h.cd <= 0 && dPlayer < K.reach + 0.5) { h.cd = 1.4; if (game.mode === 'land' && pl.alive) game.land.hurtFrom(K.dmg, h); }
        if (dPlayer > K.reach + 1.5) h.state = 'chase';
      } else { // graze: wander
        h.wait -= dt;
        if (h.wait <= 0) { const q = h.isl.spot(0.8, h.isl.h * 1.1, 12); h.tx = q.x; h.tz = q.z; h.wait = rand(3, 8); }
        const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz);
        if (d > 1) { want = Math.atan2(dx, dz); speed = K.speed * 0.3; }
      }
      if (want !== null) h.face = turnToward(h.face, want, 4 * dt);
      if (speed > 0) {
        const nx = h.x + Math.sin(h.face) * speed * dt, nz = h.z + Math.cos(h.face) * speed * dt;
        if (heightAt(nx, nz) > 0.2 && h.isl.colliders.every((c) => Math.hypot(nx - c.x, nz - c.z) > c.r + 0.6)) { h.x = nx; h.z = nz; }
      }
      h.phase += dt * (speed > 0 ? speed * 3.2 : 0);
      const a = h.a;
      a.root.position.set(h.x, groundAt(h.x, h.z), h.z); a.root.rotation.y = h.face;
      a.legs.forEach((l, i) => { l.hip.rotation.x = speed > 0 ? Math.sin(h.phase + l.phase) * 0.5 : 0; });
      a.root.userData.head.rotation.x = damp(a.root.userData.head.rotation.x, speed > 0 ? 0.15 : Math.sin(game.time * 0.9 + h.phase) * 0.12 - 0.05, 4, dt);
      a.root.userData.tail.rotation.y = Math.sin(game.time * 3 + h.phase) * 0.3;
      a.body.position.y = speed > 0 ? Math.abs(Math.sin(h.phase)) * 0.05 : 0;
    }
  }
  return { update, count: herd.length, herd };
}
