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
