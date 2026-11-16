// Life around the islands: gull flocks wheeling overhead, and fish breaking the water near the ship.
import * as THREE from 'three';
import { ISLANDS } from './data.js';
import { waveHeight, rand, TAU } from './util.js';

const wingMat = new THREE.MeshLambertMaterial({ color: 0xf1efe8, flatShading: true, side: THREE.DoubleSide });
const beakMat = new THREE.MeshLambertMaterial({ color: 0xd9a03a, flatShading: true });
const wingGeo = new THREE.BufferGeometry();
wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.5, 0, -0.1, 0, 0, 0.25, 0, 0, 0, -0.5, 0, -0.1, 0, 0, 0.25, 0, 0, 0.25, 0, 0, 0, 0.5, 0, -0.1, 0.5, 0, -0.1, 0, 0, 0.25, 0, 0, 0.25, 0, 0, 0, 0, 0, 0.25, -0.5, 0, -0.1, -0.5, 0, -0.1, 0, 0, 0.25, -0.5, 0, -0.1, 0, 0, 0, 0, 0, 0.25], 3));
wingGeo.computeVertexNormals();

export function createWildlife(game) {
  const { scene } = game, flocks = [];
  // a few gulls per big island, circling high above it
  for (const isl of ISLANDS) {
    if (isl.r < 70 || isl.kind === 'islet' && Math.random() < 0.5) continue;
    const g = new THREE.Group(); scene.add(g);
    const birds = [];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Group(), l = new THREE.Mesh(wingGeo, wingMat), r = new THREE.Mesh(wingGeo, wingMat);
      l.scale.x = -1; r.position.set(0, 0, 0); const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), beakMat); beak.rotation.x = Math.PI / 2; beak.position.z = 0.2;
      b.add(l, r, beak); b.scale.setScalar(2.1); g.add(b); birds.push({ b, l, r, ph: rand(TAU), off: rand(0, 1.2) });
    }
    flocks.push({ isl, g, birds, a: rand(TAU), rad: isl.r * (0.9 + rand(0.3)), h: 26 + rand(12), spd: 0.09 + rand(0.05) });
  }
  // fish: a splash on the water every few seconds, near the ship and the coast
  let fishT = 0;
  function update(dt) {
    const p = game.sea.player, cam = game.camera.position;
    for (const f of flocks) {
      const near = Math.hypot(cam.x - f.isl.x, cam.z - f.isl.z) < 1100; f.g.visible = near;
      if (!near) continue;
      f.a += dt * f.spd; const cx = f.isl.x, cz = f.isl.z;
      for (const bd of f.birds) {
        const a = f.a + bd.off, x = cx + Math.sin(a) * f.rad, z = cz + Math.cos(a) * f.rad, y = f.h + Math.sin(a * 2 + bd.ph) * 2;
        bd.b.position.set(x, y, z); bd.b.rotation.y = a + Math.PI / 2 + Math.PI; bd.b.rotation.z = Math.sin(a * 3) * 0.1;
        const flap = Math.sin(game.time * 9 + bd.ph) * 0.6; bd.l.rotation.z = flap; bd.r.rotation.z = -flap;
      }
    }
    fishT -= dt;
    if (fishT <= 0 && game.mode !== 'land' && game.mode !== 'board' && p.speed > 1) {
      fishT = rand(3, 7);
      const a = rand(TAU), d = rand(40, 120), x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      if (waveHeight(x, z, game.time) > -1) return;
      game.fx.splash(x, z, 0.35);
    }
  }
  return { update };
}
