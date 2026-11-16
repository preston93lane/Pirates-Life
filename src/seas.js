// The new seas. Each gate sits in the starter sea. Its chart shows three stars; sail to them in order
// and the gate opens. Sail through, and you come out in the new sea, with a gate there that takes you home.
import * as THREE from 'three';
import { LIM, WORLD_R, CHARTS } from './data.js';
import { heightAt } from './world.js';
import { dist2 } from './util.js';

const GATES = [
  { id: 'ember', chart: 'hunter', at: { x: -1000, z: 700 }, far: { x: -2250, z: 1520 }, limit: 3600, name: 'The Ember Gate' },
  { id: 'frost', chart: 'wolf', at: { x: 1150, z: -1000 }, far: { x: 2600, z: 1950 }, limit: 3600, name: 'The Frost Gate' },
];
const STAR_GAP = 150;
const starMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, fog: false });
const starDim = new THREE.MeshBasicMaterial({ color: 0x6a6040, fog: false, transparent: true, opacity: 0.6 });
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x5a5852, flatShading: true });
const runeMat = new THREE.MeshBasicMaterial({ color: 0xe9c46a, fog: false });

export function createSeas(game) {
  const { scene } = game, gates = [];
  for (const g of GATES) {
    // the path: three stars in a line that leads in to the gate; the last sits on the gate itself
    const dx = g.at.x - g.far.x, dz = g.at.z - g.far.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const path = [{ x: g.at.x + ux * 170 + uz * 40, z: g.at.z + uz * 170 - ux * 40 }, { x: g.at.x + ux * 85 - uz * 30, z: g.at.z + uz * 85 + ux * 30 }, { x: g.at.x, z: g.at.z }];
    const grp = new THREE.Group(); scene.add(grp);
    const pillars = [-1, 1].map((side) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 16, 8), stoneMat); const x = g.at.x + uz * 14 * side, z = g.at.z - ux * 14 * side; m.position.set(x, heightAt(x, z) + 8, z); grp.add(m); return m; });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(32, 3, 4), stoneMat); lintel.position.set(g.at.x, 17, g.at.z); lintel.rotation.y = Math.atan2(ux, uz); grp.add(lintel);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), runeMat); orb.position.set(g.at.x, 21, g.at.z); grp.add(orb);
    const starMeshes = path.map((p) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), starDim); m.position.set(p.x, 3, p.z); grp.add(m); return m; });
    gates.push({ g, grp, path, starMeshes, pillars, orb, prog: 0, open: false });
  }
  const sea = { gates, region: null, ready: null };
  function update(dt) {
    const p = game.sea.player, s = game.save;
    if (!p || game.mode !== 'sea' && game.mode !== 'deck') return;
    for (const G of gates) {
      const has = !!(s.charts && s.charts[G.g.chart]);
      s.gates = s.gates || {}; const st = s.gates[G.g.id] || { prog: 0, open: false }; s.gates[G.g.id] = st;
      const visible = has || st.open;
      G.starMeshes.forEach((m, k) => { m.visible = visible; m.material = k < st.prog || st.open ? starMat : starDim; });
      G.orb.material = st.open ? runeMat : starDim;
      if (has && !st.open && st.prog < 3) {
        const q = G.path[st.prog];
        if (dist2(p.x, p.z, q.x, q.z) < 50) { st.prog++; game.toast(st.prog < 3 ? `The star ${st.prog} of ${CHARTS[G.g.chart].name} is reached. Follow the path on.` : `${CHARTS[G.g.chart].name} lines up. The gate opens.`, 'gold'); if (st.prog === 3) { st.open = true; game.reward({ xp: 120 }, `${G.g.name} opens`); } }
      }
      if (st.open && dist2(p.x, p.z, G.g.at.x, G.g.at.z) < 42 && !sea.passing) sea.pass(G.g, 'to');
    }
    // the far gates lead home, and are always open
    if (sea.region) { const G = sea.region; if (dist2(p.x, p.z, G.far.x, G.far.z) < 42 && !sea.passing) sea.pass(G, 'home'); }
  }
  sea.pass = (g, dir) => {
    sea.passing = true;
    game.fade(() => {
      const p = game.sea.player;
      if (dir === 'to') { LIM.r = g.limit; sea.region = g; p.x = g.far.x + 60; p.z = g.far.z; game.toast(`You pass through ${g.name}. The sea here is strange and unmapped.`, 'warn'); }
      else { LIM.r = WORLD_R; sea.region = null; p.x = game.world.byId.saltmere.anchor.x; p.z = game.world.byId.saltmere.anchor.z; game.toast('You come home through the gate.', 'gold'); }
      p.speed = 0; p.sail = 0; p.heading = 0;
      setTimeout(() => { sea.passing = false; }, 2500);
    });
  };
  return { update, gates };
}
