// Townspeople who go about their business: walking from place to place, stopping to talk to each other, never in your way.
// They are scenery. You cannot talk to them, and they never fight.
import * as THREE from 'three';
import { buildCharacter } from './character.js';
import { groundAt, heightAt } from './world.js';
import { ISLANDS } from './data.js';
import { rand, pick, TAU, damp } from './util.js';

const LOOKS = ['keeper', 'wright', 'smith', 'merchant', 'crew', 'brigand', 'marksman'];
const COUNT = { saltmere: 12, regal: 10, shoals: 9 };

export function createTownFolk(game) {
  const walkers = [];
  for (const isl of ISLANDS) {
    if (isl.kind !== 'town' || !isl.local) continue;
    const grp = game.world.byId[isl.id].group;
    for (let i = 0; i < (COUNT[isl.id] || 8); i++) {
      const ch = buildCharacter(pick(LOOKS), { noShadow: false });
      ch.root.scale.setScalar(0.94 + rand(0.12));
      grp.add(ch.root);
      const w = { isl, ch, x: 0, z: 0, tx: 0, tz: 0, wait: rand(0, 4), speed: 1.2 + rand(1.1), face: 0, moving: false };
      w.x = 0; w.z = 0; pickSpot(w, true);
      walkers.push(w);
    }
  }
  // a spot to walk to: on the streets and squares, clear of houses, the well and the fountain
  function pickSpot(w, first) {
    const isl = w.isl;
    for (let t = 0; t < 40; t++) {
      const u = rand(-44, 44), v = rand(-32, 32), p = isl.local(u, v);
      if (heightAt(p.x, p.z) < 0.25) continue;
      if (isl.colliders.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r + 1.2)) continue;
      if (isl.npcs.some((n) => Math.hypot(p.x - n.x, p.z - n.z) < 1.5)) continue;
      w.tx = p.x; w.tz = p.z; return;
    }
    if (first) { const p = isl.local(0, 0); w.x = p.x; w.z = p.z; } // a town square, if nothing else fits
    w.tx = w.x; w.tz = w.z;
  }
  function update(dt) {
    const cam = game.camera.position;
    for (const w of walkers) {
      const isl = w.isl, near = Math.hypot(cam.x - isl.x, cam.z - isl.z) < 420;
      w.ch.root.visible = near;
      if (!near) continue;
      const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
      if (w.wait > 0 || d < 0.6) {
        w.moving = false; w.wait -= dt; w.ch.anim.state = 'idle';
        if (w.wait <= 0 && d < 0.6) { w.wait = rand(2, 7); pickSpot(w); }
      } else {
        w.moving = true; const nx = w.x + (dx / d) * w.speed * dt, nz = w.z + (dz / d) * w.speed * dt;
        // step around anything in the way: give up on that goal and wait a moment
        if (isl.colliders.some((c) => Math.hypot(nx - c.x, nz - c.z) < c.r + 0.8)) { w.wait = rand(0.5, 1.5); pickSpot(w); }
        else { w.x = nx; w.z = nz; }
        w.face = Math.atan2(dx, dz);
        w.ch.anim.state = 'run'; w.ch.anim.speed = w.speed;
      }
      w.ch.root.position.set(w.x, groundAt(w.x, w.z), w.z);
      w.ch.root.rotation.y = damp(w.ch.root.rotation.y, w.face, 6, dt);
      w.ch.update(dt);
    }
  }
  return { update, count: walkers.length };
}

// Hired workers at your hideout. One per level of each working building: lumber hands fetch logs from the palms,
// miners carry ore from the rocks, and the others tend their building. They are scenery, like the townspeople.
export function createWorkers(game) {
  const world = game.world, isl = world.byId.rest;
  let crew = [];
  const LOAD = { lumber: 'log', mine: 'ore', still: 'cask', quarters: 'pack', battery: 'shot', vault: 'coin' };
  const cargoMat = { log: 0x7a5a36, ore: 0x6a6a72, cask: 0x8a5a2a, pack: 0x9a8a6a, shot: 0x2b2d30, coin: 0xe9c46a };
  function clear() { for (const w of crew) w.ch.root.removeFromParent(); crew = []; }
  function spawn() {
    clear();
    const save = game.save, here = world.byId.rest;
    for (const pl of isl.plots) {
      const lvl = save.base.b[pl.id] || 0;
      for (let i = 0; i < lvl; i++) {
        const ch = buildCharacter(pick(['crew', 'brigand', 'merchant', 'keeper']), { noShadow: false });
        const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), new THREE.MeshLambertMaterial({ color: cargoMat[LOAD[pl.id]] || 0x888888, flatShading: true }));
        cargo.position.set(0, 1.25, 0.45); cargo.visible = false; ch.root.add(cargo);
        here.group.add(ch.root);
        const home = { x: pl.x + Math.sin(pl.face) * 4, z: pl.z + Math.cos(pl.face) * 4 };
        crew.push({ pl, ch, cargo, home, x: home.x, z: home.z, tx: home.x, tz: home.z, phase: 'home', wait: rand(1, 5), speed: 1.6 + rand(0.8), face: 0, phase0: rand(1) });
      }
    }
  }
  // the work site for a worker: a palm to chop, a rock to dig, or a spot near the building to tend
  function site(w) {
    if (w.pl.id === 'lumber') { const c = pick(isl.colliders.filter((c) => c.r < 1.5 && !c.base)); if (c) return { x: c.x + 1.2, z: c.z }; }
    if (w.pl.id === 'mine') { const b = pick(isl.blocks || []); if (b) return { x: b.x + 1.5, z: b.z }; }
    return { x: w.home.x + rand(-4, 4), z: w.home.z + rand(-4, 4) };
  }
  function update(dt) {
    const cam = game.camera.position, near = Math.hypot(cam.x - isl.x, cam.z - isl.z) < 420;
    for (const w of crew) {
      w.ch.root.visible = near; if (!near) continue;
      const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
      if (d > 0.5 && w.wait <= 0) {
        const nx = w.x + (dx / d) * w.speed * dt, nz = w.z + (dz / d) * w.speed * dt;
        if (!isl.colliders.some((c) => !c.base && Math.hypot(nx - c.x, nz - c.z) < c.r + 0.6) || w.phase === 'home') { w.x = nx; w.z = nz; }
        w.face = Math.atan2(dx, dz); w.ch.anim.state = 'run'; w.ch.anim.speed = w.speed;
      } else {
        w.ch.anim.state = 'idle'; w.wait -= dt;
        if (w.phase === 'out' && d <= 0.5) { w.ch.anim.state = 'attack'; w.ch.anim.i = 0; w.ch.anim.u = (game.time * 0.9 + w.phase0) % 1; } // chopping or digging
        if (w.wait <= 0) {
          if (w.phase === 'home' && w.pl.id !== 'vault' && w.pl.id !== 'battery') { w.phase = 'out'; w.tx = site(w).x; w.tz = site(w).z; w.wait = 0; }
          else if (w.phase === 'out') { w.phase = 'back'; w.wait = 1.5 + rand(1); w.cargo.visible = true; }
          else if (w.phase === 'back') { w.phase = 'home'; w.tx = w.home.x; w.tz = w.home.z; w.cargo.visible = false; w.wait = rand(2, 4); }
          else { w.phase = 'out'; w.tx = site(w).x; w.tz = site(w).z; w.wait = rand(1, 3); }
        }
        if (w.phase === 'back' && w.wait > 0) { w.ch.anim.state = 'idle'; } // work done, then back home
      }
      w.ch.root.position.set(w.x, groundAt(w.x, w.z), w.z);
      w.ch.root.rotation.y = damp(w.ch.root.rotation.y, w.face, 6, dt);
      w.ch.update(dt);
    }
  }
  return { spawn, update, count: () => crew.length };
}
