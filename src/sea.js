// Everything afloat: the player's ship, AI ships, cannon fire, salvage, the Kraken.
import * as THREE from 'three';
import { Ship, STYLES } from './ship.js';
import { SHIP_CLASSES, SEA_FOES, ISLANDS, ZONES, WORLD_R, GOODS, AMMO, BOUNTIES } from './data.js';
import { shipStats, SAIL_COLORS, cargoUsed, grant, addRep } from './state.js';
import { clamp, angleDiff, wrapAngle, rand, pick, dist2, waveHeight, TAU, damp, smooth } from './util.js';
void wrapAngle;
import { heightAt, nearestIsland } from './world.js';
import { input } from './input.js';
import { audio } from './audio.js';

const G = 20, MUZZLE_V = 100, MAX_BALLS = 110;

export function createSea(game) {
  const { scene, fx } = game;
  const sea = { ships: [], player: null, loot: [], balls: [], pending: [], target: null, kraken: null, spawnT: 0, targetT: 0, bottleT: 60, zone: null };

  const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_BALLS);
  const BALL_COL = { round: new THREE.Color(0x151515), chain: new THREE.Color(0x77777a), fire: new THREE.Color(0xff7a1f), grapple: new THREE.Color(0xc9b58a) };
  ballMesh.setColorAt(0, BALL_COL.round);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe9c46a, transparent: true, opacity: 0.85, depthTest: false, fog: false }));
  ring.renderOrder = 4; ring.visible = false; scene.add(ring);
  ballMesh.frustumCulled = false; ballMesh.count = 0; scene.add(ballMesh);
  const dummy = new THREE.Object3D();
  const crateGeo = new THREE.BoxGeometry(1.5, 1.1, 1.5), crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6d4b, flatShading: true });
  const bottleMat = new THREE.MeshLambertMaterial({ color: 0x3f7a5c, flatShading: true, emissive: 0x123524 });

  // ---------- player ship ----------
  sea.makePlayer = () => {
    const s = game.save, st = shipStats(s), old = sea.player;
    const style = Object.assign({}, STYLES.player, { sail: SAIL_COLORS[s.ship.sail] || SAIL_COLORS.bone });
    const p = new Ship(st.cls, style, { faction: 'player', hp: st.maxHp, speed: st.speed, turn: st.turn, flag: s.flag, jolly: s.jolly });
    p.isPlayer = true; p.name = 'Your ship'; p.faction = 'player'; p.fadeSails(false); // your own canvas is slightly see-through so it never hides the fight
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
    Object.assign(sh, { x: pos.x, z: pos.z, heading: rand(TAU), type, def, name: def.name, faction: def.faction, dmg: def.dmg * lv, reloadTime: 5.2, provoked: false, way: null, wayT: 0, crew: def.crew.slice(),
      morale: ({ merchant: 0.55, pirate: 0.95, navy: 1.25 }[def.faction] || 9) - (game.save.flag === 'pirate' ? 0.12 : 0) - (p.cls.len > SHIP_CLASSES[def.cls].len ? 0.15 : 0) });
    if (type === 'hunter') { sh.hunter = true; sh.provoked = true; sh.maxHp = sh.hp = Math.max(sh.hp, Math.round(p.maxHp * 1.7)); }
    scene.add(sh.group); sea.ships.push(sh); sh.update(0, game.time);
    return sh;
  };
  function populate() {
    const lv = game.save.level, count = (f) => sea.ships.filter((s) => s.alive && s.faction === f).length;
    if (count('merchant') < 3) sea.spawn('merchant');
    if (count('pirate') < (lv >= 3 ? 4 : 3)) sea.spawn(lv >= 3 && Math.random() < 0.4 ? 'pirate2' : 'pirate');
    if (count('navy') < 2) { const r = ISLANDS.find((i) => i.id === 'regal'), pos = openWater(r.x, r.z, 280, 520); if (pos && dist2(pos.x, pos.z, sea.player.x, sea.player.z) > 300) sea.spawn(lv >= 6 && Math.random() < 0.5 ? 'navy2' : 'navy', pos); }
    if (game.save.rep.navy <= -60 && !sea.ships.some((s) => s.alive && s.hunter)) { sea.hunterT = (sea.hunterT ?? 20) - 2.5; if (sea.hunterT <= 0) { const pos = openWater(sea.player.x, sea.player.z, 460, 680); if (pos && sea.spawn('hunter', pos)) { sea.hunterT = 100; game.toast('A navy hunter has your scent. She outguns you.', 'warn'); } } }
    const bt = game.save.bounty;
    if (bt && !sea.ships.some((s) => s.type === bt.id)) { const sh = sea.spawn(bt.id, openWater(bt.x, bt.z, 0, 140) || { x: bt.x, z: bt.z }); if (sh) { const k = 1 + 0.25 * (game.save.bountyDone[bt.id] || 0); sh.provoked = true; sh.maxHp = sh.hp = Math.round(sh.hp * k); sh.dmg *= 1 + 0.1 * (k - 1) * 4; sh.captain = BOUNTIES.find((b) => b.id === bt.id).captain; } }
    const z = ZONES.reach, bossReady = (id) => !game.save.bosses[id] || Date.now() - game.save.bosses[id] > 20 * 60000;
    if (bossReady('ghost') && !count('ghost') && dist2(sea.player.x, sea.player.z, z.x, z.z) < z.r + 150) { const pos = openWater(z.x, z.z, 0, z.r * 0.6); if (pos) { sea.spawn('ghost', pos); game.toast('A pale ship moves in the fog…', 'warn'); } }
    const m = ZONES.maw;
    if (bossReady('kraken') && !sea.kraken && dist2(sea.player.x, sea.player.z, m.x, m.z) < m.r * 0.7) spawnKraken({ boss: true });
  }

  // would this ship attack us if it knew who we were?
  function grudge(sh) {
    if (sh.surrendered || sh.released) return false;
    if (sh.faction === 'ghost') return true;
    const r = game.save.rep;
    return sh.faction === 'pirate' ? sh.provoked || r.blood <= -20 : sh.faction === 'navy' ? sh.provoked || r.navy <= -20 : false;
  }
  // does the flag we fly fool it?
  function disguised(sh) {
    const f = game.save.flag;
    if (sea.exposed > 0 || sh.provoked || sh.saw || sh.hunter) return false;
    return sh.faction === 'navy' ? f === 'navy' || f === 'merchant' : sh.faction === 'pirate' ? f === 'bloodwater' : false;
  }
  function hostile(sh) {
    return grudge(sh) && !disguised(sh);
  }
  function steer(sh, dt) {
    const p = sea.player, d = dist2(sh.x, sh.z, p.x, p.z), toP = Math.atan2(p.x - sh.x, p.z - sh.z);
    let want = sh.heading, sail = 0.55;
    if (sh.surrendered) { sh.sail = 0; sh.rudder = 0; return; }
    if (!sh.saw && d < 115 && grudge(sh) && disguised(sh)) { sh.sus = (sh.sus || 0) + dt * (d < 60 ? 0.42 : 0.15); if (sh.sus > 1) { sh.saw = true; game.toast(`The ${sh.name} has seen through your false colours!`, 'warn'); } }
    const aggro = hostile(sh) && p.alive && game.mode !== 'land' && d < (sh.hunter ? 3000 : sh.provoked ? 520 : 330);
    if (sh.released || (sh.def.flee && sh.provoked && d < 420)) { want = toP + Math.PI; sail = 1; if (sh.released && d > 520) sh.gone = true; }
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
    if (sh.isPlayer) { sea.deaf = 6; sea.exposed = 45; } // gunfire drowns out a siren's song, and gives away false colours
    const kind = sh.isPlayer ? game.save.shot : 'round';
    const out = Math.atan2(sh.fz * side, -sh.fx * side); // world bearing of the beam normal
    sh.muzzles(side).forEach((m, i) => sea.pending.push({ t: i * 0.07 + rand(0.05), sh, side, i, out, target, kind }));
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
    if (sea.balls.length < MAX_BALLS) sea.balls.push({ x: m.x, y: m.y, z: m.z, vx: dx * ce * MUZZLE_V, vy: Math.sin(el) * MUZZLE_V, vz: dz * ce * MUZZLE_V, own: sh, dmg: sh.isPlayer ? sh.stats.dmg : sh.dmg * (1 - 0.13 * (game.save.mercy || 0)), life: 4, kind: q.kind || 'round' });
    fx.smoke(m.x + dx, m.y, m.z + dz, [dx, 0, dz], 7);
    const dc = dist2(m.x, m.z, game.camera.position.x, game.camera.position.z);
    audio.cannon(clamp(1.1 - dc / 420, 0.08, 1) * 0.6);
    if (sh.isPlayer) game.shake(0.12);
  }
  // How each faction takes it when you attack, sink, board or spare one of their ships.
  const REP = {
    attack: { merchant: { guild: -10, navy: -8 }, navy: { navy: -15 } },
    sink: { merchant: { guild: -14, navy: -10 }, navy: { navy: -22, smug: 6, blood: 3 }, pirate: { blood: -8, navy: 5, guild: 5 } },
    board: { merchant: { guild: -9, navy: -6 }, navy: { navy: -16, smug: 6, blood: 3 }, pirate: { blood: -6, navy: 5, guild: 5 } },
    spare: { merchant: { guild: -3, navy: -3 }, navy: { navy: -8, smug: 3 }, pirate: { blood: -2, navy: 2, guild: 2 } },
  };
  sea.offend = (sh, what) => {
    const t = (REP[what] || {})[sh.faction]; if (!t) return;
    let crossed = false; for (const f in t) if (addRep(game.save, f, t[f]) && f === 'navy') crossed = true;
    if (crossed) game.toast(game.save.rep.navy <= -60 ? 'The navy has put a price on your head. Hunters are coming.' : 'You are Wanted. Navy ships will attack on sight.', 'warn');
    game.ui.dirty = true;
  };
  // infamy is worth more under your own flag
  sea.infamy = (base) => Math.round(base * (game.save.flag === 'pirate' ? 1.25 : 1));
  function checkSurrender(sh) {
    if (sh.surrendered || !sh.def || sh.def.boss || sh.hunter || sh.hp <= 0 || sh.frozen) return;
    if (sh.hp < sh.maxHp * 0.6 && sh.morale <= 0) { sh.surrendered = true; sh.sail = 0; sh.burn = 0; sh.setFlag('white'); game.emit('yield', {}); audio.good(); game.toast(`The ${sh.name} strikes her colours. Pull alongside to take the prize.`, 'gold'); }
  }
  function hook(sh) {
    if (sea.hookT > 0 || !sh.def) return; sea.hookT = 2;
    const p = sea.player;
    if (sh.surrendered) game.toast('She has already struck her colours.', 'dim');
    else if (sh.hp <= sh.maxHp * 0.7 && dist2(p.x, p.z, sh.x, sh.z) < 120 && !sea.kraken) { game.toast('The hooks bite. Haul her in!', 'gold'); game.board(sh); }
    else game.toast('They cut the lines. Wear her down to 70% hull first.', 'dim');
  }
  sea.damage = (sh, dmg, by, x, y, z, kind = 'round') => {
    if (!sh.alive) return;
    const mine = by && by.isPlayer && !sh.isPlayer;
    if (kind === 'grapple') { if (mine) { sh.provoked = true; hook(sh); } return; }
    if (kind === 'chain') { dmg *= 0.25; sh.sailHp = Math.max(0.2, sh.sailHp - 0.1); }
    if (kind === 'fire') { dmg *= 0.5; sh.burn = Math.min(14, sh.burn + 4.5); }
    sh.hp -= dmg;
    fx.splinters(x, y, z, 10);
    audio.crack(clamp(1.1 - dist2(x, z, game.camera.position.x, game.camera.position.z) / 380, 0.1, 1));
    if (sh.isPlayer) { game.shake(0.5); game.ui.flash(); }
    else if (mine) {
      if (!sh.provoked) sea.offend(sh, 'attack');
      sh.provoked = true; sh.morale -= (dmg / sh.maxHp) * 1.6 + (kind === 'chain' ? 0.04 : 0);
      game.ui.floatText(x, y + 3, z, kind === 'chain' ? 'Rigging' : Math.round(dmg), kind === 'fire' ? '#ff9a4a' : '#ffd28a');
      checkSurrender(sh);
    }
    if (sh.hp <= 0) sink(sh, by);
  };
  function sink(sh, by) {
    sh.hp = 0; sh.alive = false;
    for (let i = 0; i < 5; i++) fx.splinters(sh.x + rand(-4, 4), 2, sh.z + rand(-4, 4), 8);
    fx.splash(sh.x, sh.z, 2.5); audio.crack(1);
    if (sh.isPlayer) { game.playerSunk(); return; }
    if (sea.target === sh) sea.target = null;
    if (by && by.isPlayer) { // sinking pays the most infamy and the least loot
      dropLoot(sh, 0.35); game.reward({ xp: sea.infamy(sh.def.xp * 1.5) }, `${sh.name} sunk`); game.save.stats.sunk++; sea.offend(sh, 'sink');
      game.emit('sink', { faction: sh.faction, type: sh.type }); if (sh.def.boss) game.emit('boss', { boss: sh.type });
    }
  }
  sea.sink = sink;
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
    if (type === 'storm') { sea.event = { type, t: 0, dur: rand(85, 115), bolt: 5, warn: 0, inside: 0, r: 400, x: p.x + p.fx * 330, z: p.z + p.fz * 330, vx: -p.fx * rand(3, 6) + rand(-3, 3), vz: -p.fz * rand(3, 6) + rand(-3, 3) }; game.toast('Storm ahead. Steer around it, or reef your sails inside it.', 'warn'); audio.thunder(); }
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
      e.x += e.vx * dt; e.z += e.vz * dt;
      const k = clamp(Math.min(e.t / 7, (e.dur - e.t) / 7), 0, 1) * (1 - smooth(e.r * 0.5, e.r, dist2(p.x, p.z, e.x, e.z))); game.world.setWeather(k);
      if (k > 0.5) e.inside += dt;
      const c = game.camera.position;
      for (let i = 0; i < Math.round(k * 16); i++) fx.emit(c.x + rand(-45, 45), c.y + rand(4, 26), c.z + rand(-45, 45), { color: 0xcfd8dc, speed: 0, dir: [9, -48, 3], life: 0.55, size: 0.3, alpha: 0.55, spread: 0 });
      if (active && p.alive) {
        p.heading += Math.sin(e.t * 0.9) * 0.05 * k * dt + Math.sin(e.t * 2.3) * 0.03 * k * dt;
        if (p.sail >= 1 && k > 0.5) { p.hp -= 2.4 * dt; e.warn -= dt; if (e.warn <= 0) { e.warn = 6; game.toast('The rigging is tearing! Reef your sails.', 'warn'); game.shake(0.3); } if (p.hp <= 0) { p.hp = 1; p.sail = 0.5; } }
        e.bolt -= dt;
        if (e.bolt <= 0 && k > 0.4) { e.bolt = rand(4, 9); game.ui.bolt(); audio.thunder(); game.shake(0.35); }
      }
      if (e.t >= e.dur) { const rode = e.inside > 12; endEvent(); if (active && rode) { game.reward({ xp: 45 }, 'You rode out the storm'); game.emit('storm', {}); } }
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
    // trade winds: a quiet crossing at full sail gets faster, so long trips do not drag
    const calm = p.sail >= 1 && !sea.kraken && game.world.weather < 0.2 && !sea.ships.some((s) => s.alive && (hostile(s) || s.provoked) && dist2(s.x, s.z, p.x, p.z) < 420);
    sea.wind = damp(sea.wind || 0, calm ? 1 : 0, calm ? 0.3 : 2.5, dt); p.maxSpeed = p.stats.speed * (1 + 0.75 * sea.wind);
    if (sea.wind > 0.6) { game.tip('wind', 'Open water and full sail: the trade winds carry you much faster. They drop when enemies are near.'); if (Math.random() < dt * 6) fx.emit(p.x + rand(-30, 30), rand(2, 9), p.z + rand(-30, 30), { color: 0xffffff, speed: 0, dir: [p.fx * 30, 0, p.fz * 30], life: 0.5, size: 0.28, alpha: 0.35, spread: 0 }); }
    if (sea.target && sea.target.def && (hostile(sea.target) || sea.target.provoked)) game.tip('foe', 'Enemy ship. Turn so she sits off your side, then FIRE. Sink her for infamy, or wear her down and board for the whole cargo.', 12);
    if (p.hp < p.maxHp * 0.45) game.tip('hull', 'Your hull is low. Run with full sail and repair at a shipwright. If you sink you keep your ship, but lose some gold and cargo.', 12);
    if (cargoUsed(game.save) > 0) game.tip('cargo', 'You carry goods. Markets pay different prices: tap a port on the chart to see what sells dear there.', 12);
    if (sea.kraken && !sea.kraken.done) p.speed = Math.min(p.speed, 2.5);
    if (input.take('primary')) {
      const t = sea.target; let side;
      if (t) side = p.bearing(t.x, t.z).side;
      else { const cy = game.cam.yaw; side = Math.sin(cy) * p.fz - Math.cos(cy) * p.fx > 0 ? 1 : -1; }
      if (!fire(p, side, t) && p.reload[-side] <= 0 && !t) fire(p, -side, null);
    }
    if (input.take('ammo')) { const kinds = Object.keys(AMMO).filter((k) => k === 'round' || game.save.armory[k]), s = game.save; s.shot = kinds[(kinds.indexOf(s.shot) + 1) % kinds.length]; audio.ui(); game.toast(kinds.length > 1 ? `Loading ${AMMO[s.shot].name.toLowerCase()}` : 'Only round shot aboard. Shipwrights sell more.', 'dim'); }
    // swivel gun: aimed by looking; the ring shows where the shot will land
    sea.swivelCd = Math.max(0, (sea.swivelCd || 0) - dt);
    ring.visible = !!game.save.swivel;
    if (ring.visible) {
      const c = game.cam, range = 22 + 115 * Math.pow(clamp(1 - (c.pitch - 0.1) / 0.9, 0, 1), 1.3);
      let ax = p.x + Math.sin(c.yaw) * range, az = p.z + Math.cos(c.yaw) * range;
      for (const s of sea.ships) if (s.alive && dist2(s.x, s.z, ax, az) < s.radius + 6) { ax = s.x; az = s.z; }
      ring.position.set(ax, waveHeight(ax, az, game.time) + 0.4, az); ring.material.opacity = sea.swivelCd > 0 ? 0.3 : 0.9;
      if (input.take('swivel') && sea.swivelCd <= 0) {
        sea.swivelCd = 2.8; sea.exposed = 45; sea.deaf = 6;
        const my = (p.y || 0) + p.model.deckY + 1.6, d = dist2(p.x, p.z, ax, az), ang = Math.atan2(ax - p.x, az - p.z), el = 0.5 * Math.asin(clamp((G * d) / (MUZZLE_V * MUZZLE_V), 0, 0.9)) - Math.atan2(my - 1, d) * 0.5, dx = Math.sin(ang), dz = Math.cos(ang), ce = Math.cos(el);
        sea.balls.push({ x: p.x + dx * 2, y: my, z: p.z + dz * 2, vx: dx * ce * MUZZLE_V, vy: Math.sin(el) * MUZZLE_V, vz: dz * ce * MUZZLE_V, own: p, dmg: p.stats.dmg * 1.6, life: 4, kind: game.save.shot });
        fx.smoke(p.x + dx * 3, my, p.z + dz * 3, [dx, 0, dz], 6); audio.cannon(0.45); game.shake(0.1);
      }
    } else input.pressed.swivel = false;
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
      if (t.surrendered) { if (d < 80 && p.speed < 12) return { label: 'Take the prize', sub: t.name, icon: 'chest', run: () => game.ui.openPrize(t) }; }
      else if (t.hp < t.maxHp * 0.42 && d < 50 && p.speed < 11) return { label: 'Board', sub: t.name, icon: 'board', run: () => game.board(t) };
    }
    if (p.speed < 11 && !sea.kraken) for (const isl of ISLANDS) if (dist2(p.x, p.z, isl.anchor.x, isl.anchor.z) < 95) return { label: `Go ashore`, sub: isl.name, icon: 'anchor', run: () => game.goAshore(isl) };
    return null;
  };

  sea.update = (dt, active) => {
    const p = sea.player, time = game.time;
    if (active && p.alive) control(dt);
    for (const s of sea.ships) { if (s.alive && !s.frozen) { if (active) steer(s, dt); else { s.sail = 0; s.rudder = 0; } } s.update(dt, time); }
    p.update(dt, time);
    sea.exposed = Math.max(0, (sea.exposed || 0) - dt); sea.hookT = Math.max(0, (sea.hookT || 0) - dt);
    for (const s of sea.ships) if (s.alive && s.burn > 0 && !s.frozen) {
      s.burn -= dt; s.hp -= 3.2 * dt; s.morale -= dt * 0.06;
      if (Math.random() < dt * 12) fx.fire(s.x + rand(-3, 3), s.model.deckY + 1.5, s.z + rand(-3, 3), 2);
      if (s.hp <= 0) sink(s, p); else checkSurrender(s);
    }
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
        for (const s of sea.ships) if (s !== b.own && s.alive && !(b.own !== p && !s.isPlayer) && s.hitTest(b.x, b.y, b.z)) { sea.damage(s, b.dmg, b.own, b.x, b.y, b.z, b.kind); dead = true; break; }
        if (!dead && b.own !== p && p.alive && p.hitTest(b.x, b.y, b.z)) { sea.damage(p, b.dmg, b.own, b.x, b.y, b.z); dead = true; }
        if (!dead && sea.kraken && b.own === p) for (const a of sea.kraken.arms) if (a.alive && a.state !== 'rise' && b.y < 20 && dist2(b.x, b.z, a.x, a.z) < 3.2) { hitArm(a, b.dmg, b.x, b.y, b.z); dead = true; break; }
        if (!dead && sea.event && sea.event.type === 'siren' && b.own === p && dist2(b.x, b.z, sea.event.x, sea.event.z) < 9 && b.y < 9) { hitSiren(b.dmg, b.x, b.y, b.z); dead = true; }
      }
      }
      if (dead) { sea.balls.splice(i, 1); continue; }
      if (b.kind === 'fire' && Math.random() < 0.6) fx.emit(b.x, b.y, b.z, { color: 0xff8a2a, speed: 0.5, life: 0.35, size: 0.9, grow: -1.5, spread: 0.2 });
      dummy.position.set(b.x, b.y, b.z); dummy.scale.setScalar(b.kind === 'chain' ? 1.6 : 1); dummy.updateMatrix(); ballMesh.setColorAt(n, BALL_COL[b.kind] || BALL_COL.round); ballMesh.setMatrixAt(n++, dummy.matrix);
    }
    ballMesh.count = n; ballMesh.instanceMatrix.needsUpdate = true; ballMesh.instanceColor.needsUpdate = true;
    // salvage
    for (let i = sea.loot.length - 1; i >= 0; i--) {
      const l = sea.loot[i]; l.life -= dt;
      l.mesh.position.set(l.x, waveHeight(l.x, l.z, time) * 0.55 + (l.kind === 'crate' ? 0.15 : 0.1) + Math.sin(time * 2 + l.ph) * 0.08, l.z); l.mesh.rotation.y += dt * 0.3;
      const near = active && dist2(l.x, l.z, p.x, p.z) < p.radius + (game.save.pet === 'parrot' ? 14 : 5);
      if (near) sea.takeLoot(l.contents, l.kind === 'crate' ? 'Salvage' : 'Bottle');
      if (near || l.life <= 0) { scene.remove(l.mesh); sea.loot.splice(i, 1); }
    }
    // remove sunk ships
    for (let i = sea.ships.length - 1; i >= 0; i--) { const s = sea.ships[i]; if ((!s.alive && s.sinkT > 9) || s.gone) { if (sea.target === s) sea.target = null; s.dispose(scene); sea.ships.splice(i, 1); } }
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
    sea.fogT = (sea.fogT || 0) - dt; if (sea.fogT <= 0) { sea.fogT = 0.5; game.reveal(p.x, p.z, game.save.pet === 'parrot' ? 430 : 310); }
    // discovery
    for (const isl of ISLANDS) if (!game.save.seen[isl.id] && dist2(p.x, p.z, isl.x, isl.z) < isl.r + 170) { game.save.seen[isl.id] = true; game.reward({ xp: 25 }, `Discovered ${isl.name}`); game.emit('visit', { island: isl.id }); }
    let zone = null; for (const id in ZONES) { const z = ZONES[id]; if (dist2(p.x, p.z, z.x, z.z) < z.r) zone = id; }
    if (zone !== sea.zone) { sea.zone = zone; if (zone) game.toast(`Entering ${ZONES[zone].name}`, 'warn'); }
    // drifting bottles with treasure maps
    sea.bottleT -= dt;
    if (sea.bottleT <= 0) { sea.bottleT = rand(100, 170); if (game.save.maps.length < 2 && game.save.story.i > 2) { const pos = openWater(p.x + p.fx * 160, p.z + p.fz * 160, 0, 60); if (pos) { const isl = pick(ISLANDS.filter((i) => i.kind !== 'hideout')); addLoot(pos.x, pos.z, 'bottle', { map: { island: isl.id, spot: Math.random() < 0.5 ? 0 : 1, tier: 2 } }); } } }
  };

  sea.fire = fire; sea.openWater = openWater;
  return sea;
}
