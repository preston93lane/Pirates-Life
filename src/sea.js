// Everything afloat: the player's ship, AI ships, cannon fire, salvage, the Kraken.
import * as THREE from 'three';
import { Ship, STYLES } from './ship.js';
import { SHIP_CLASSES, SEA_FOES, ISLANDS, ZONES, WORLD_R, GOODS } from './data.js';
import { shipStats, SAIL_COLORS, cargoUsed, grant } from './state.js';
import { clamp, angleDiff, wrapAngle, rand, pick, dist2, waveHeight, TAU, damp } from './util.js';
void wrapAngle;
import { heightAt, nearestIsland } from './world.js';
import { input } from './input.js';
import { audio } from './audio.js';

const G = 20, MUZZLE_V = 100, MAX_BALLS = 110;

export function createSea(game) {
  const { scene, fx } = game;
  const sea = { ships: [], player: null, loot: [], balls: [], pending: [], target: null, kraken: null, spawnT: 0, targetT: 0, bottleT: 60, zone: null };

  const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 6, 5), new THREE.MeshBasicMaterial({ color: 0x151515 }), MAX_BALLS);
  ballMesh.frustumCulled = false; ballMesh.count = 0; scene.add(ballMesh);
  const dummy = new THREE.Object3D();
  const crateGeo = new THREE.BoxGeometry(1.5, 1.1, 1.5), crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6d4b, flatShading: true });
  const bottleMat = new THREE.MeshLambertMaterial({ color: 0x3f7a5c, flatShading: true, emissive: 0x123524 });

  // ---------- player ship ----------
  sea.makePlayer = () => {
    const s = game.save, st = shipStats(s), old = sea.player;
    const style = Object.assign({}, STYLES.player, { sail: SAIL_COLORS[s.ship.sail] || SAIL_COLORS.bone });
    const p = new Ship(st.cls, style, { faction: 'player', hp: st.maxHp, speed: st.speed, turn: st.turn });
    p.isPlayer = true; p.name = 'Your ship'; p.faction = 'player';
    if (old) { p.x = old.x; p.z = old.z; p.heading = old.heading; scene.remove(old.group); }
    else if (s.pos) { p.x = s.pos.x; p.z = s.pos.z; p.heading = s.pos.h; }
    else { const a = ISLANDS[0].anchor; p.x = a.x; p.z = a.z; p.heading = a.heading; }
    p.hp = Math.max(1, Math.round(st.maxHp * s.ship.hp)); p.stats = st;
    scene.add(p.group); sea.player = p; p.update(0, game.time);
    return p;
  };
  sea.refreshStats = () => { const p = sea.player, st = shipStats(game.save), frac = p.hp / p.maxHp; p.stats = st; p.maxHp = st.maxHp; p.hp = Math.round(st.maxHp * frac); p.maxSpeed = st.speed; p.turnRate = st.turn; };

  // ---------- AI ships ----------
  function openWater(cx, cz, rMin, rMax) {
    for (let i = 0; i < 40; i++) {
      const a = rand(TAU), d = rand(rMin, rMax), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
      if (Math.hypot(x, z) > WORLD_R - 150 || heightAt(x, z) > -12 || nearestIsland(x, z).d < 70) continue;
      return { x, z };
    }
    return null;
  }
  sea.spawn = (type, at) => {
    const def = SEA_FOES[type], p = sea.player, pos = at || openWater(p.x, p.z, 330, 780);
    if (!pos) return null;
    const lv = 1 + 0.05 * (game.save.level - 1);
    const sh = new Ship(SHIP_CLASSES[def.cls], STYLES[def.faction], { faction: def.faction, guns: def.guns, hp: Math.round(def.hp * lv), speed: SHIP_CLASSES[def.cls].speed * (def.flee ? 0.86 : 0.9) });
    Object.assign(sh, { x: pos.x, z: pos.z, heading: rand(TAU), type, def, name: def.name, faction: def.faction, dmg: def.dmg * lv, reloadTime: 5.2, provoked: false, way: null, wayT: 0, crew: def.crew.slice() });
    scene.add(sh.group); sea.ships.push(sh); sh.update(0, game.time);
    return sh;
  };
  function populate() {
    const lv = game.save.level, count = (f) => sea.ships.filter((s) => s.alive && s.faction === f).length;
    if (count('merchant') < 3) sea.spawn('merchant');
    if (count('pirate') < (lv >= 3 ? 4 : 3)) sea.spawn(lv >= 3 && Math.random() < 0.4 ? 'pirate2' : 'pirate');
    if (count('navy') < 2) { const r = ISLANDS.find((i) => i.id === 'regal'), pos = openWater(r.x, r.z, 280, 520); if (pos && dist2(pos.x, pos.z, sea.player.x, sea.player.z) > 300) sea.spawn(lv >= 6 && Math.random() < 0.5 ? 'navy2' : 'navy', pos); }
    const z = ZONES.reach, bossReady = (id) => !game.save.bosses[id] || Date.now() - game.save.bosses[id] > 20 * 60000;
    if (bossReady('ghost') && !count('ghost') && dist2(sea.player.x, sea.player.z, z.x, z.z) < z.r + 150) { const pos = openWater(z.x, z.z, 0, z.r * 0.6); if (pos) { sea.spawn('ghost', pos); game.toast('A pale ship moves in the fog…', 'warn'); } }
    const m = ZONES.maw;
    if (bossReady('kraken') && !sea.kraken && dist2(sea.player.x, sea.player.z, m.x, m.z) < m.r * 0.7) spawnKraken({ boss: true });
  }

  function hostile(sh) {
    if (sh.faction === 'pirate' || sh.faction === 'ghost') return true;
    if (sh.faction === 'navy') return sh.provoked || game.save.wanted > 0;
    return false;
  }
  function steer(sh, dt) {
    const p = sea.player, d = dist2(sh.x, sh.z, p.x, p.z), toP = Math.atan2(p.x - sh.x, p.z - sh.z);
    let want = sh.heading, sail = 0.55;
    const aggro = hostile(sh) && p.alive && game.mode !== 'land' && d < (sh.provoked ? 520 : 330);
    if (sh.def.flee && sh.provoked && d < 420) { want = toP + Math.PI; sail = 1; }
    else if (aggro) {
      if (d > 105) { want = toP; sail = 1; }
      else {
        const side = angleDiff(sh.heading, toP) > 0 ? -1 : 1; // keep the player on whichever beam is nearer
        want = toP + side * (Math.PI / 2 + (d < 50 ? 0.5 : d > 85 ? -0.35 : 0)); sail = d < 60 ? 0.45 : 0.7;
      }
      const b = sh.bearing(p.x, p.z);
      if (b.off < 0.4 && b.dist < 125 && sh.reload[b.side] <= 0) fire(sh, b.side, p);
    } else {
      sh.wayT -= dt;
      if (!sh.way || sh.wayT <= 0 || dist2(sh.x, sh.z, sh.way.x, sh.way.z) < 60) { sh.way = openWater(sh.x, sh.z, 250, 700) || { x: 0, z: 300 }; sh.wayT = 70; }
      want = Math.atan2(sh.way.x - sh.x, sh.way.z - sh.z);
    }
    // keep off the rocks and inside the chart
    const probe = (ang, dist) => heightAt(sh.x + Math.sin(ang) * dist, sh.z + Math.cos(ang) * dist) > -3.5;
    if (probe(sh.heading, 45) || probe(sh.heading, 90) || sh.aground) { const l = probe(sh.heading + 0.8, 80), r = probe(sh.heading - 0.8, 80); want = sh.heading + (l && !r ? -1.4 : 1.4); sail = Math.min(sail, 0.5); if (sh.aground) sh.way = null; }
    if (Math.hypot(sh.x, sh.z) > WORLD_R - 140) want = Math.atan2(-sh.x, -sh.z);
    sh.rudder = clamp(-angleDiff(sh.heading, want) * 2.2, -1, 1); sh.sail = sail;
  }

  // ---------- gunnery ----------
  function fire(sh, side, target) {
    if (sh.reload[side] > 0 || !sh.alive) return false;
    sh.reload[side] = sh.isPlayer ? sh.stats.reload : sh.reloadTime;
    if (sh.isPlayer) sea.deaf = 6; // gunfire drowns out a siren's song
    const out = Math.atan2(sh.fz * side, -sh.fx * side); // world bearing of the beam normal
    sh.muzzles(side).forEach((m, i) => sea.pending.push({ t: i * 0.07 + rand(0.05), sh, side, i, out, target }));
    return true;
  }
  function shoot(q) {
    const sh = q.sh; if (!sh.alive) return;
    const m = sh.muzzles(q.side)[q.i]; if (!m) return;
    let ang = q.out, d = 85;
    const t = q.target;
    if (t && t.alive !== false) {
      let tx = t.x, tz = t.z; d = dist2(m.x, m.z, tx, tz);
      if (t.speed) { const ft = d / (MUZZLE_V * 0.96); tx += t.fx * t.speed * ft; tz += t.fz * t.speed * ft; d = dist2(m.x, m.z, tx, tz); }
      ang = q.out + clamp(angleDiff(q.out, Math.atan2(tx - m.x, tz - m.z)), -0.5, 0.5);
    }
    const spread = sh.isPlayer ? 0.022 : 0.05;
    ang += rand(-spread, spread);
    const el = 0.5 * Math.asin(clamp((G * d) / (MUZZLE_V * MUZZLE_V), 0, 0.9)) + rand(-0.006, 0.01) + (m.y > 2 ? -Math.atan2(m.y - 1.5, d) * 0.6 : 0);
    const dx = Math.sin(ang), dz = Math.cos(ang), ce = Math.cos(el);
    if (sea.balls.length < MAX_BALLS) sea.balls.push({ x: m.x, y: m.y, z: m.z, vx: dx * ce * MUZZLE_V, vy: Math.sin(el) * MUZZLE_V, vz: dz * ce * MUZZLE_V, own: sh, dmg: sh.isPlayer ? sh.stats.dmg : sh.dmg, life: 4 });
    fx.smoke(m.x + dx, m.y, m.z + dz, [dx, 0, dz], 7);
    const dc = dist2(m.x, m.z, game.camera.position.x, game.camera.position.z);
    audio.cannon(clamp(1.1 - dc / 420, 0.08, 1) * 0.6);
    if (sh.isPlayer) game.shake(0.12);
  }
  sea.damage = (sh, dmg, by, x, y, z) => {
    if (!sh.alive) return;
    sh.hp -= dmg;
    fx.splinters(x, y, z, 10);
    audio.crack(clamp(1.1 - dist2(x, z, game.camera.position.x, game.camera.position.z) / 380, 0.1, 1));
    if (sh.isPlayer) { game.shake(0.5); game.ui.flash(); }
    else if (by && by.isPlayer) {
      if (!sh.provoked && (sh.faction === 'merchant' || sh.faction === 'navy')) { game.save.wanted = Math.min(600, game.save.wanted + (sh.faction === 'navy' ? 240 : 150)); game.toast('You are Wanted. The navy will hunt you.', 'warn'); }
      sh.provoked = true; game.ui.floatText(x, y + 3, z, Math.round(dmg), '#ffd28a');
    }
    if (sh.hp <= 0) sink(sh, by);
  };
  function sink(sh, by) {
    sh.hp = 0; sh.alive = false;
    for (let i = 0; i < 5; i++) fx.splinters(sh.x + rand(-4, 4), 2, sh.z + rand(-4, 4), 8);
    fx.splash(sh.x, sh.z, 2.5); audio.crack(1);
    if (sh.isPlayer) { game.playerSunk(); return; }
    if (sea.target === sh) sea.target = null;
    if (by && by.isPlayer) { dropLoot(sh, 0.6); game.reward({ xp: sh.def.xp }, `${sh.name} sunk`); game.save.stats.sunk++; game.emit('sink', { faction: sh.faction, type: sh.type }); if (sh.def.boss) game.emit('boss', { boss: sh.type }); }
  }
  function lootOf(sh, share) {
    const d = sh.def, out = { gold: Math.round(rand(d.gold[0], d.gold[1]) * share), timber: Math.round(rand(4, 12) * share * (d.cls === 'sloop' ? 1 : 2)), iron: Math.round(rand(1, 6) * share * (d.cls === 'sloop' ? 1 : 2)), goods: {} };
    for (let i = 0; i < Math.round(d.goods * share); i++) { const g = pick(Object.keys(GOODS)); out.goods[g] = (out.goods[g] || 0) + 1; }
    return out;
  }
  sea.lootOf = lootOf;
  function dropLoot(sh, share) {
    const all = lootOf(sh, share), n = sh.def.cls === 'sloop' ? 2 : 3, goods = Object.entries(all.goods);
    for (let i = 0; i < n; i++) {
      const c = { gold: Math.round(all.gold / n), timber: Math.round(all.timber / n), iron: Math.round(all.iron / n), goods: {} };
      goods.forEach(([g, q], k) => { if (k % n === i) c.goods[g] = q; });
      addLoot(sh.x + rand(-9, 9), sh.z + rand(-9, 9), 'crate', c);
    }
  }
  function addLoot(x, z, kind, contents) {
    const mesh = new THREE.Mesh(kind === 'crate' ? crateGeo : new THREE.CylinderGeometry(0.22, 0.3, 1, 6), kind === 'crate' ? crateMat : bottleMat);
    mesh.rotation.set(rand(-0.3, 0.3), rand(TAU), rand(-0.3, 0.3)); scene.add(mesh);
    sea.loot.push({ x, z, kind, contents, mesh, life: 150, ph: rand(TAU) });
  }
  sea.takeLoot = (c, label) => {
    const s = game.save, parts = [];
    if (c.gold) parts.push(`${c.gold} gold`); if (c.timber) parts.push(`${c.timber} timber`); if (c.iron) parts.push(`${c.iron} iron`);
    grant(s, c);
    let left = 0;
    for (const g in c.goods || {}) { const room = sea.player.stats.cargo - cargoUsed(s), take = Math.min(room, c.goods[g]); if (take > 0) { s.cargo[g] = (s.cargo[g] || 0) + take; parts.push(`${take} ${GOODS[g].name.toLowerCase()}`); } left += c.goods[g] - take; }
    if (c.map) { s.maps.push(c.map); parts.push(`a treasure map (${ISLANDS.find((i) => i.id === c.map.island).name})`); }
    if (parts.length) game.toast(`${label}: ${parts.join(', ')}`, 'gold');
    if (left > 0) game.toast('Hold is full. Some cargo was left behind.', 'warn');
    audio.coin();
  };

  // ---------- the Kraken ----------
  function spawnKraken(o) {
    const p = sea.player, k = { arms: [], t: 0, next: 3, cx: p.x, cz: p.z, boss: o.boss }, n = o.boss ? 6 : 4, hp = o.boss ? 70 : 42;
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a2c3c, flatShading: true }), under = new THREE.MeshLambertMaterial({ color: 0x8a5a66, flatShading: true });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.3, root = new THREE.Group(), segs = []; let parent = root;
      for (let j = 0; j < 9; j++) {
        const r0 = 1.5 - j * 0.14, r1 = 1.5 - (j + 1) * 0.14, g = new THREE.Group(); g.position.y = j ? 2.3 : 0;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 2.4, 7).translate(0, 1.2, 0), j % 2 ? under : mat); g.add(m); parent.add(g); parent = g; segs.push(g);
      }
      scene.add(root);
      k.arms.push({ a, r: 24 + (i % 2) * 5, root, segs, hp, maxHp: hp, alive: true, state: 'rise', t: 0, x: 0, z: 0, ph: rand(TAU), name: 'Kraken arm', speed: 0, flash: 0 });
    }
    if (!o.boss) for (const a of k.arms) a.root.scale.setScalar(0.72);
    sea.kraken = k; audio.roar(); game.toast(o.boss ? 'THE KRAKEN HAS YOU. Shoot the arms!' : 'Something vast grips the keel. Shoot the arms!', 'warn'); game.shake(1.2);
  }
  function updateKraken(dt) {
    const k = sea.kraken, p = sea.player; if (!k) return;
    k.t += dt; k.next -= dt; k.cx = damp(k.cx, p.x, 2, dt); k.cz = damp(k.cz, p.z, 2, dt);
    let alive = 0;
    for (const a of k.arms) {
      a.t += dt; a.x = k.cx + Math.sin(a.a) * a.r; a.z = k.cz + Math.cos(a.a) * a.r;
      let y = -3, lean = 0.02;
      if (a.state === 'rise') { y = -24 + Math.min(1, a.t / 1.6) * 21; if (a.t > 1.6) { a.state = 'idle'; a.t = 0; } if (Math.random() < 0.3) fx.splash(a.x + rand(-2, 2), a.z + rand(-2, 2), 1.2); }
      else if (a.state === 'wind') { lean = -0.07 * Math.min(1, a.t / 1.1); if (a.t > 1.25) { a.state = 'slam'; a.t = 0; } }
      else if (a.state === 'slam') { lean = -0.07 + Math.min(1, a.t / 0.3) * 0.33; if (a.t > 0.3 && !a.hit) { a.hit = true; fx.splash(p.x, p.z, 2.4); audio.crack(1); if (dist2(a.x, a.z, p.x, p.z) < a.r + 10) { sea.damage(p, 13, null, p.x, 3, p.z); } } if (a.t > 0.9) { a.state = 'idle'; a.t = 0; a.hit = false; } }
      else if (a.state === 'dead') { y = -3 - a.t * 7; lean = 0.1; if (a.t > 3.2) a.root.visible = false; }
      if (a.alive) alive++;
      a.root.position.set(a.x, y + waveHeight(a.x, a.z, game.time) * 0.3, a.z); a.root.rotation.y = Math.atan2(p.x - a.x, p.z - a.z);
      a.segs.forEach((s, j) => { s.rotation.x = Math.sin(k.t * 1.3 + j * 0.6 + a.ph) * 0.07 + lean; s.rotation.z = Math.cos(k.t * 1.1 + j * 0.5 + a.ph) * 0.07; });
      if (a.flash > 0) { a.flash -= dt; a.root.scale.setScalar(1 + a.flash * 0.3); }
    }
    if (k.next <= 0) { const idle = k.arms.filter((a) => a.alive && a.state === 'idle'); if (idle.length) { const a = pick(idle); a.state = 'wind'; a.t = 0; } k.next = rand(1.6, 3.2); }
    if (!alive && !k.done) {
      k.done = true; k.doneT = 0; audio.good();
      if (k.boss) { game.save.bosses.kraken = Date.now(); game.reward({ gold: 1200, xp: 600, iron: 60 }, 'The Kraken sinks back into the dark'); game.emit('boss', { boss: 'kraken' }); }
      else game.reward({ gold: 320, xp: 170, iron: 20 }, 'The beast lets go and sinks away');
    }
    if (k.done) { k.doneT += dt; if (k.doneT > 4) { for (const a of k.arms) scene.remove(a.root); sea.kraken = null; } }
    else if (k.boss && dist2(p.x, p.z, ZONES.maw.x, ZONES.maw.z) > ZONES.maw.r + 260) { for (const a of k.arms) scene.remove(a.root); sea.kraken = null; }
  }
  function hitArm(a, dmg, x, y, z) {
    a.hp -= dmg; a.flash = 0.25; fx.blood(x, y, z, 10, 0x3a1626); audio.hit(0.8); game.ui.floatText(x, y + 2, z, Math.round(dmg), '#ffd28a');
    if (a.hp <= 0) { a.alive = false; a.state = 'dead'; a.t = 0; if (sea.target === a) sea.target = null; fx.splash(a.x, a.z, 2); audio.roar(); }
  }


  // ---------- events at sea: storms, sirens, a kraken from below ----------
  const sirenMat = new THREE.MeshBasicMaterial({ color: 0xa8ecd8 }), sirenRock = new THREE.MeshLambertMaterial({ color: 0x4b4741, flatShading: true });
  function startEvent(type) {
    const p = sea.player;
    if (type === 'storm') { sea.event = { type, t: 0, dur: rand(45, 60), bolt: 5, warn: 0 }; game.toast('Storm coming. Reef your sails or the rigging will tear.', 'warn'); audio.thunder(); }
    else if (type === 'kraken') spawnKraken({ boss: false });
    else {
      const pos = openWater(p.x + p.fx * 240, p.z + p.fz * 240, 40, 130); if (!pos) return;
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6 + i * 0.7, 0), sirenRock); r.position.set(Math.sin(i * 1.3) * 4.5, 0.4 - i * 0.2, Math.cos(i * 1.3) * 4.5); r.rotation.set(i, i * 2, 0); g.add(r); }
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 6), sirenMat), h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), sirenMat); b.position.set(Math.sin(i * 2.1) * 2.8, 3.1, Math.cos(i * 2.1) * 2.8); h.position.set(b.position.x, 4.05, b.position.z); g.add(b, h); }
      g.position.set(pos.x, 0, pos.z); scene.add(g);
      sea.event = { type, t: 0, x: pos.x, z: pos.z, group: g, hp: 45, maxHp: 45, alive: true, name: 'Siren rocks', speed: 0, song: 0 };
      game.toast("A song drifts over the water. The helm pulls toward it. Fire your guns to break the spell.", 'warn');
    }
  }
  function endEvent() { const e = sea.event; if (!e) return; if (e.group) scene.remove(e.group); if (e.type === 'storm') game.world.setWeather(0); if (sea.target === e) sea.target = null; sea.event = null; sea.eventT = rand(80, 140); }
  function hitSiren(dmg, x, y, z) {
    const e = sea.event; e.hp -= dmg; fx.dust(x, y, z, 10, 0x8a8478); game.ui.floatText(x, y + 2, z, Math.round(dmg), '#ffd28a');
    if (e.hp <= 0) { e.alive = false; fx.splash(e.x, e.z, 3); game.reward({ gold: 260, xp: 90 }, 'The song dies. Pearls wash off the rocks'); endEvent(); }
  }
  function updateEvent(dt, active) {
    const p = sea.player, e = sea.event; sea.deaf = Math.max(0, (sea.deaf || 0) - dt);
    if (!e) {
      if (!active || sea.kraken) return;
      sea.eventT = (sea.eventT ?? rand(50, 90)) - dt;
      if (sea.eventT > 0) return;
      sea.eventT = 12;
      if (game.save.story.i < 2 || sea.zone || nearestIsland(p.x, p.z).d < 170 || p.speed < 4) return;
      if (sea.ships.some((s) => s.alive && (hostile(s) || s.provoked) && dist2(s.x, s.z, p.x, p.z) < 340)) return;
      const r = Math.random(); sea.eventT = rand(80, 140);
      startEvent(sea.forceEvent || (r < 0.42 ? 'storm' : r < 0.74 || game.save.level < 3 ? 'siren' : 'kraken')); sea.forceEvent = null;
      return;
    }
    e.t += dt;
    if (e.type === 'storm') {
      const k = clamp(Math.min(e.t / 7, (e.dur - e.t) / 7), 0, 1); game.world.setWeather(k);
      const c = game.camera.position;
      for (let i = 0; i < Math.round(k * 16); i++) fx.emit(c.x + rand(-45, 45), c.y + rand(4, 26), c.z + rand(-45, 45), { color: 0xcfd8dc, speed: 0, dir: [9, -48, 3], life: 0.55, size: 0.3, alpha: 0.55, spread: 0 });
      if (active && p.alive) {
        p.heading += Math.sin(e.t * 0.9) * 0.05 * k * dt + Math.sin(e.t * 2.3) * 0.03 * k * dt;
        if (p.sail >= 1 && k > 0.5) { p.hp -= 2.4 * dt; e.warn -= dt; if (e.warn <= 0) { e.warn = 6; game.toast('The rigging is tearing! Reef your sails.', 'warn'); game.shake(0.3); } if (p.hp <= 0) { p.hp = 1; p.sail = 0.5; } }
        e.bolt -= dt;
        if (e.bolt <= 0 && k > 0.4) { e.bolt = rand(4, 9); game.ui.bolt(); audio.thunder(); game.shake(0.35); }
      }
      if (e.t >= e.dur) { endEvent(); if (active) game.reward({ xp: 45 }, 'You rode out the storm'); }
    } else if (e.type === 'siren') {
      const d = dist2(p.x, p.z, e.x, e.z);
      e.group.position.y = waveHeight(e.x, e.z, game.time) * 0.3;
      if (active && p.alive) {
        e.song -= dt; if (e.song <= 0) { e.song = 2.6; audio.siren(clamp(1.2 - d / 420, 0.15, 1)); }
        if (sea.deaf <= 0 && d < 460) { p.heading += clamp(angleDiff(p.heading, Math.atan2(e.x - p.x, e.z - p.z)), -1, 1) * 0.42 * dt; if (Math.random() < dt * 0.5) game.ui.trance(); }
        if (d < 17) { sea.damage(p, 34, null, p.x, 2, p.z); game.toast("Dashed on the sirens' rocks!", 'warn'); p.speed = -4; endEvent(); return; }
      }
      if (e.t > 80 || d > 560) { endEvent(); if (active) game.toast('The song fades behind you.', 'dim'); }
    }
  }
  sea.startEvent = (type) => { endEvent(); if (type !== 'none') startEvent(type); };

  // ---------- frame update ----------
  function control(dt) {
    const p = sea.player;
    p.rudder = damp(p.rudder, clamp(input.move.x * 1.4, -1, 1), 5, dt);
    const y = input.move.y, x = Math.abs(input.move.x);
    if (Math.abs(y) < 0.4) sea.flick = false;
    if (!sea.flick && Math.abs(y) > 0.82 && x < 0.5) { sea.flick = true; sea.setSail(y > 0 ? 1 : -1); }
    if (input.take('sailUp')) sea.setSail(1);
    if (input.take('sailDown')) sea.setSail(-1);
    if (sea.kraken && !sea.kraken.done) p.speed = Math.min(p.speed, 2.5);
    if (input.take('primary')) {
      const t = sea.target; let side;
      if (t) side = p.bearing(t.x, t.z).side;
      else { const cy = game.cam.yaw; side = Math.sin(cy) * p.fz - Math.cos(cy) * p.fx > 0 ? 1 : -1; }
      if (!fire(p, side, t) && p.reload[-side] <= 0 && !t) fire(p, -side, null);
    }
    if (p.edge && !sea.edgeT) { game.toast('The charts end here. Turn back.', 'warn'); sea.edgeT = 6; }
    if (sea.edgeT) sea.edgeT = Math.max(0, sea.edgeT - dt);
  }
  sea.setSail = (d) => { const p = sea.player, v = clamp(Math.round(p.sail * 2) + d, 0, 2) / 2; if (v !== p.sail) { p.sail = v; audio.ui(); game.toast(['Sails furled', 'Half sail', 'Full sail'][v * 2], 'dim'); } };

  function pickTarget() {
    const p = sea.player; let best = null, bs = 1e9;
    const consider = (t, boost) => { if (t.alive === false) return; const d = dist2(p.x, p.z, t.x, t.z); if (d > 260) return; const s = d - boost; if (s < bs) { bs = s; best = t; } };
    for (const s of sea.ships) if (s.alive) consider(s, (hostile(s) || s.provoked ? 140 : 0) + (s === sea.target ? 40 : 0));
    if (sea.kraken) for (const a of sea.kraken.arms) if (a.alive && a.state !== 'rise') { const b = p.bearing(a.x, a.z); consider(a, 300 - b.off * 60); }
    if (sea.event && sea.event.type === 'siren' && sea.event.alive) consider(sea.event, 120);
    sea.target = best;
  }

  sea.context = () => {
    const p = sea.player, t = sea.target;
    if (t && t.def && t.alive && !sea.kraken) {
      const d = dist2(p.x, p.z, t.x, t.z);
      if (t.hp < t.maxHp * 0.42 && d < 42 && p.speed < 11) return { label: 'Board', icon: 'board', run: () => game.board(t) };
    }
    if (p.speed < 11 && !sea.kraken) for (const isl of ISLANDS) if (dist2(p.x, p.z, isl.anchor.x, isl.anchor.z) < 95) return { label: `Go ashore`, sub: isl.name, icon: 'anchor', run: () => game.goAshore(isl) };
    return null;
  };

  sea.update = (dt, active) => {
    const p = sea.player, time = game.time;
    if (active && p.alive) control(dt);
    for (const s of sea.ships) { if (s.alive && !s.frozen) { if (active) steer(s, dt); else { s.sail = 0; s.rudder = 0; } } s.update(dt, time); }
    p.update(dt, time);
    // hulls push apart
    if (active) for (let i = 0; i < sea.ships.length; i++) {
      const a = sea.ships[i]; if (!a.alive) continue;
      for (let j = i; j < sea.ships.length + 1; j++) {
        const b = j === sea.ships.length ? p : sea.ships[j]; if (b === a || !b.alive) continue;
        const d = dist2(a.x, a.z, b.x, b.z), min = (a.radius + b.radius) * 0.62;
        if (d < min && d > 0.01) { const k = (min - d) / d * 0.5, dx = (a.x - b.x) * k, dz = (a.z - b.z) * k; a.x += dx; a.z += dz; b.x -= dx; b.z -= dz; a.speed *= 0.96; b.speed *= 0.96; }
      }
    }
    // queued gun fire, then balls in flight
    for (let i = sea.pending.length - 1; i >= 0; i--) { const q = sea.pending[i]; q.t -= dt; if (q.t <= 0) { sea.pending.splice(i, 1); shoot(q); } }
    let n = 0;
    for (let i = sea.balls.length - 1; i >= 0; i--) {
      const b = sea.balls[i]; b.life -= dt;
      let dead = b.life <= 0;
      const steps = Math.max(1, Math.ceil((dt * MUZZLE_V) / 2.2)), sdt = dt / steps;
      for (let q = 0; q < steps && !dead; q++) {
      b.vy -= G * sdt; b.x += b.vx * sdt; b.y += b.vy * sdt; b.z += b.vz * sdt;
      if (!dead && b.y < 0.2) { fx.splash(b.x, b.z, 0.8); if (Math.random() < 0.4) audio.splash(clamp(1 - dist2(b.x, b.z, p.x, p.z) / 200, 0, 1)); dead = true; }
      if (!dead && heightAt(b.x, b.z) > b.y) { fx.dust(b.x, b.y, b.z, 8); dead = true; }
      if (!dead) {
        for (const s of sea.ships) if (s !== b.own && s.alive && !(b.own !== p && !s.isPlayer) && s.hitTest(b.x, b.y, b.z)) { sea.damage(s, b.dmg, b.own, b.x, b.y, b.z); dead = true; break; }
        if (!dead && b.own !== p && p.alive && p.hitTest(b.x, b.y, b.z)) { sea.damage(p, b.dmg, b.own, b.x, b.y, b.z); dead = true; }
        if (!dead && sea.kraken && b.own === p) for (const a of sea.kraken.arms) if (a.alive && a.state !== 'rise' && b.y < 20 && dist2(b.x, b.z, a.x, a.z) < 3.2) { hitArm(a, b.dmg, b.x, b.y, b.z); dead = true; break; }
        if (!dead && sea.event && sea.event.type === 'siren' && b.own === p && dist2(b.x, b.z, sea.event.x, sea.event.z) < 9 && b.y < 9) { hitSiren(b.dmg, b.x, b.y, b.z); dead = true; }
      }
      }
      if (dead) { sea.balls.splice(i, 1); continue; }
      dummy.position.set(b.x, b.y, b.z); dummy.updateMatrix(); ballMesh.setMatrixAt(n++, dummy.matrix);
    }
    ballMesh.count = n; ballMesh.instanceMatrix.needsUpdate = true;
    // salvage
    for (let i = sea.loot.length - 1; i >= 0; i--) {
      const l = sea.loot[i]; l.life -= dt;
      l.mesh.position.set(l.x, waveHeight(l.x, l.z, time) * 0.55 + (l.kind === 'crate' ? 0.15 : 0.1) + Math.sin(time * 2 + l.ph) * 0.08, l.z); l.mesh.rotation.y += dt * 0.3;
      const near = active && dist2(l.x, l.z, p.x, p.z) < p.radius + (game.save.pet === 'parrot' ? 14 : 5);
      if (near) sea.takeLoot(l.contents, l.kind === 'crate' ? 'Salvage' : 'Bottle');
      if (near || l.life <= 0) { scene.remove(l.mesh); sea.loot.splice(i, 1); }
    }
    // remove sunk ships
    for (let i = sea.ships.length - 1; i >= 0; i--) { const s = sea.ships[i]; if (!s.alive && s.sinkT > 9) { s.dispose(scene); sea.ships.splice(i, 1); } }
    updateKraken(dt);
    updateEvent(dt, active);
    // wakes
    const cam = game.camera.position;
    for (const s of [p, ...sea.ships]) if (s.alive && s.speed > 2.5 && dist2(s.x, s.z, cam.x, cam.z) < 380 && Math.random() < s.speed * dt * 1.6) {
      const [wx, wz] = s.at(rand(-1, 1) * s.cls.beam * 0.3, -s.cls.len * 0.5); fx.wake(wx, wz, s.cls.beam / 5);
      if (Math.random() < 0.5) { const [bx, bz] = s.at(rand(-1, 1) * 1.2, s.cls.len * 0.46); fx.emit(bx, 0.6, bz, { n: 1, color: 0xf2f6f2, speed: 2.5, up: 2, gravity: 9, life: 0.7, size: 0.9, grow: 1, alpha: 0.7, spread: 1 }); }
    }
    for (const s of sea.ships) if (s.alive && s.hp < s.maxHp * 0.42 && Math.random() < dt * 6) fx.fire(s.x + rand(-2, 2), s.model.deckY + 1.5, s.z + rand(-2, 2), 2);
    if (p.alive && p.hp < p.maxHp * 0.3 && Math.random() < dt * 5) fx.fire(p.x + rand(-2, 2), p.model.deckY + 1.5, p.z + rand(-2, 2), 2);
    if (!active) return;
    sea.spawnT -= dt; if (sea.spawnT <= 0) { sea.spawnT = 2.5; populate(); }
    sea.targetT -= dt; if (sea.targetT <= 0) { sea.targetT = 0.3; pickTarget(); }
    if (game.save.wanted > 0) game.save.wanted = Math.max(0, game.save.wanted - dt);
    // discovery
    for (const isl of ISLANDS) if (!game.save.seen[isl.id] && dist2(p.x, p.z, isl.x, isl.z) < isl.r + 170) { game.save.seen[isl.id] = true; game.reward({ xp: 25 }, `Discovered ${isl.name}`); game.emit('visit', { island: isl.id }); }
    let zone = null; for (const id in ZONES) { const z = ZONES[id]; if (dist2(p.x, p.z, z.x, z.z) < z.r) zone = id; }
    if (zone !== sea.zone) { sea.zone = zone; if (zone) game.toast(`Entering ${ZONES[zone].name}`, 'warn'); }
    // drifting bottles with treasure maps
    sea.bottleT -= dt;
    if (sea.bottleT <= 0) { sea.bottleT = rand(100, 170); if (game.save.maps.length < 2 && game.save.story.i > 2) { const pos = openWater(p.x + p.fx * 160, p.z + p.fz * 160, 0, 60); if (pos) { const isl = pick(ISLANDS.filter((i) => i.kind !== 'hideout')); addLoot(pos.x, pos.z, 'bottle', { map: { island: isl.id, spot: Math.random() < 0.5 ? 0 : 1, tier: 2 } }); } } }
  };

  sea.fire = fire;
  return sea;
}
