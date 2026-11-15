// Everything on foot: walking islands, sword and gun combat, boarding fights, chests, digging, talking.
import * as THREE from 'three';
import { buildCharacter, buildPet, staticFigure } from './character.js';
import { FOES, ISLANDS, BUILDINGS, SWORDS, PETS, CAVE_FOES, HANDS, GRADES } from './data.js';
import { playerStats, shipStats, collect, deathTax, grant, isWanted, addMorale, crewBonus, feat } from './state.js';
import { clamp, angleDiff, turnToward, rand, pick, dist2, damp, TAU } from './util.js';
import { groundAt, heightAt, platforms, chestMesh, refreshBase, CAVE } from './world.js';
import { input } from './input.js';
import { audio } from './audio.js';

const ATK_DUR = [0.4, 0.4, 0.54], HIT_U = 0.42, REACH = 2.5;
const BLADES = [0x8c8a84, 0xb9bdc1, 0xd8dcdf, 0x6f7f95, 0x9fd0e8];
const barBg = new THREE.SpriteMaterial({ color: 0x1a1210, fog: false, depthWrite: false });
const barFg = new THREE.SpriteMaterial({ color: 0xb3261e, fog: false, depthWrite: false });
const barAlly = new THREE.SpriteMaterial({ color: 0x4c8a6a, fog: false, depthWrite: false });
const markGeo = new THREE.OctahedronGeometry(0.15), markRed = new THREE.MeshBasicMaterial({ color: 0xff3b2a, fog: false }), markHeavy = new THREE.MeshBasicMaterial({ color: 0xffa51f, fog: false });
const lineGeo = new THREE.BoxGeometry(0.035, 0.035, 1), lineMat = new THREE.MeshBasicMaterial({ color: 0xff3b2a, transparent: true, opacity: 0.7, depthWrite: false });
const glintMat = new THREE.MeshLambertMaterial({ color: 0xd9c070, emissive: 0x6a5a20, flatShading: true });
const moundGeo = new THREE.ConeGeometry(0.9, 0.35, 6), moundMat = new THREE.MeshLambertMaterial({ color: 0x5e4a33, flatShading: true });

export function createLand(game) {
  const { scene, fx } = game;
  const land = { pois: [], bombs: [], cave: null, actors: [], player: null, isl: null, kind: null, focus: null, chests: [], mounds: [], boarding: null, tokens: 0 };

  function makeActor(key, x, z, team, lvl = 1) {
    const def = FOES[key], ch = buildCharacter(def.look), sc = def.scale || 1;
    ch.root.scale.setScalar(sc);
    const a = { key, def, ch, x, z, y: groundAt(x, z), face: rand(TAU), team, hp: Math.round(def.hp * lvl), maxHp: Math.round(def.hp * lvl), dmg: def.dmg * lvl, state: 'idle', t: 0, cd: rand(0.3, 1.4), alive: true, radius: 0.42 * (def.look === 'crab' ? 1.5 : 1) * sc, kx: 0, kz: 0, home: { x, z }, strafe: Math.random() < 0.5 ? 1 : -1 };
    const h = ch.height + 0.35;
    a.bg = new THREE.Sprite(barBg); a.bg.scale.set(1.0 / sc + 0.04, 0.12 / sc, 1); a.bg.position.y = h; a.bg.visible = false;
    a.bar = new THREE.Sprite(team ? barFg : barAlly); a.bar.scale.set(1.0 / sc, 0.08 / sc, 1); a.bar.position.y = h; a.bar.visible = false; a.bar.renderOrder = 5; a.bg.renderOrder = 4;
    a.mark = new THREE.Mesh(markGeo, def.heavy ? markHeavy : markRed); a.mark.position.y = h + 0.35; a.mark.visible = false;
    ch.root.add(a.bg, a.bar, a.mark);
    if (def.ranged) { a.line = new THREE.Mesh(lineGeo, lineMat); a.line.visible = false; scene.add(a.line); }
    scene.add(ch.root); land.actors.push(a); place(a);
    return a;
  }
  const place = (a) => { a.ch.root.position.set(a.x, a.y, a.z); a.ch.root.rotation.y = a.face; };
  function removeActor(a) { scene.remove(a.ch.root); if (a.line) scene.remove(a.line); }

  // ----- the captain's torch: lit in caves and after dark -----
  const torch = new THREE.Group(), torchLight = new THREE.PointLight(0xffb469, 0, 46, 1.25);
  { const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.75, 5), new THREE.MeshLambertMaterial({ color: 0x4a3420, flatShading: true })), flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), new THREE.MeshBasicMaterial({ color: 0xffb040, fog: false }));
    stick.position.y = 0.3; flame.position.y = 0.82; torch.add(stick, flame); torch.userData.flame = flame; torch.visible = false; scene.add(torch, torchLight); }
  function updateTorch(dt) {
    const p = land.player, lit = !!land.kind && p && (land.cave || game.world.night > 0.3), want = !lit ? 0 : land.cave ? 60 : 34 * Math.min(1, game.world.night * 1.6);
    torchLight.intensity = damp(torchLight.intensity, want, 6, dt); torch.visible = lit && land.gun == null;
    if (!p) return;
    const s = Math.sin(p.face), c = Math.cos(p.face);
    torch.position.set(p.x - c * 0.42 + s * 0.28, p.y + 1.15, p.z + s * 0.42 + c * 0.28); torch.rotation.set(0.25, p.face, 0.2);
    torchLight.position.set(p.x + s * 0.4, p.y + 2.6, p.z + c * 0.4);
    const fl = torch.userData.flame; fl.scale.setScalar(0.85 + Math.random() * 0.35);
    if (torch.visible && Math.random() < dt * 9) fx.emit(torch.position.x, torch.position.y + 0.95, torch.position.z, { n: 1, color: 0xffa040, lit: true, speed: 0.3, up: 1.4, life: 0.45, size: 0.4, grow: -0.5, spread: 0.08 });
  }
  land.torchOff = () => { torchLight.intensity = 0; torch.visible = false; };
  // ----- hired hands who fight beside you -----
  function spawnHands(list, at) {
    const s = game.save, lvl = 1 + 0.07 * (s.level - 1);
    list.forEach((h, i) => { const d = HANDS[h.role], [x, z] = at(i, list.length), a = makeActor(d.foe, x, z, 0, lvl * GRADES[h.g].fight * d.fight); a.hand = h; a.state = 'chase'; a.face = land.player.face; a.bar.visible = a.bg.visible = true; });
  }
  const worth = (h) => GRADES[h.g].fight * HANDS[h.role].fight * (HANDS[h.role].land ? 1.6 : 1);
  function landingParty() { const p = land.player, list = game.save.crew.filter((h) => h.ashore).slice(0, feat(game.save, 'born') ? 4 : 3); spawnHands(list, (i) => [p.x + Math.sin(p.face + 2 + i * 1.1) * 2, p.z + Math.cos(p.face + 2 + i * 1.1) * 2]); }
  function handFell(a) {
    const s = game.save, h = a.hand, heal = crewBonus(s).heal;
    if (!s.crew.includes(h)) return;
    if (heal > 0 && Math.random() < Math.min(0.85, 0.3 + heal)) { game.toast(`${h.name} is down, but your surgeon says they will pull through.`, 'dim'); return; }
    s.crew.splice(s.crew.indexOf(h), 1); addMorale(s, -10); game.sea.refreshStats(); audio.bad();
    game.toast(`${h.name} the ${HANDS[h.role].name.toLowerCase()} is dead. The crew take it hard.`, 'warn');
  }

  function ensurePlayer() {
    if (land.player) return land.player;
    const ch = buildCharacter('player', { seed: 0, blade: BLADES[game.save.sword] });
    const p = { isPlayer: true, ch, x: 0, z: 0, y: 0, face: 0, team: 0, hp: 1, maxHp: 1, state: 'free', t: 0, alive: true, radius: 0.42, kx: 0, kz: 0, cdRoll: 0, gunT: 0, combat: 0, blockT: 0, def: { name: 'You' } };
    land.player = p; return p;
  }
  land.refreshLook = () => { // rebuild the captain's model after a change of clothes
    const p = land.player; if (!p) return;
    const shown = !!p.ch.root.parent; scene.remove(p.ch.root);
    p.ch = buildCharacter('player', { blade: BLADES[game.save.sword] }); if (shown) { scene.add(p.ch.root); place(p); }
  };
  // ----- companion animal -----
  land.setPet = () => {
    if (land.pet) { land.pet.m.root.removeFromParent(); land.pet = null; }
    const kind = game.save.pet; if (!kind) return;
    land.pet = { kind, m: buildPet(kind), x: 0, z: 0, y: 0, face: 0, cd: 2, going: null, told: false };
    if (land.kind) { const p = land.player; land.pet.x = p.x + 1; land.pet.z = p.z + 1; scene.add(land.pet.m.root); } else land.dockPet();
  };
  land.dockPet = () => { // ride on the quarterdeck while at sea
    const pet = land.pet, sh = game.sea.player; if (!pet || !sh) return;
    sh.group.add(pet.m.root); pet.m.root.position.set(sh.cls.beam * 0.2, sh.model.top + (pet.kind === 'parrot' ? 1.4 : 0), sh.model.helmAt.z + 0.4); pet.m.root.rotation.set(0, 0.6, 0);
  };
  function updatePet(dt) {
    const pet = land.pet, p = land.player; if (!pet) return;
    pet.cd -= dt;
    const fly = pet.kind === 'parrot', f = land.focus, isl = land.isl;
    let tx = p.x - Math.sin(p.face) * 1.1 - Math.cos(p.face) * 0.9, tz = p.z - Math.cos(p.face) * 1.1 + Math.sin(p.face) * 0.9, speed = 7.5;
    if (fly) { tx = p.x - Math.cos(p.face) * 0.5; tz = p.z + Math.sin(p.face) * 0.5; speed = 10; }
    if (pet.kind === 'dog' && isl && !f) for (const m of game.save.maps) if (m.island === isl.id) { const d = isl.digs[m.spot]; if (dist2(p.x, p.z, d.x, d.z) < 45) { tx = d.x; tz = d.z; speed = 6.5; if (!pet.told) { pet.told = true; audio.bark(); game.toast('Your dog has caught a scent. Follow it!', 'gold'); } } }
    if (pet.kind !== 'cat' && f && f.alive && pet.cd <= 0 && p.alive) { pet.going = f; pet.cd = fly ? 6 : 3.2; }
    if (pet.going) {
      const g = pet.going; tx = g.x; tz = g.z; speed = 13;
      if (!g.alive) pet.going = null;
      else if (dist2(pet.x, pet.z, g.x, g.z) < 1.1 + g.radius) {
        pet.going = null; const lvl = game.save.level;
        if (fly) { audio.squawk(); hurtFoe(g, 4 + lvl, { x: pet.x, z: pet.z, team: 0 }, false); if (g.alive && !g.def.heavy && !g.def.boss) { release(g); g.state = 'stagger'; g.t = 1.1; g.ch.anim.state = 'stagger'; } }
        else { audio.bark(); hurtFoe(g, 6 + lvl * 2, { x: pet.x, z: pet.z, team: 0 }, false); }
      }
    }
    const dx = tx - pet.x, dz = tz - pet.z, d = Math.hypot(dx, dz), moving = d > 0.35;
    if (d > 30) { pet.x = tx; pet.z = tz; }
    else if (moving) { const s = Math.min(d, speed * dt * (d > 4 ? 1.5 : 1)); pet.x += (dx / d) * s; pet.z += (dz / d) * s; pet.face = turnToward(pet.face, Math.atan2(dx, dz), 12 * dt); }
    const g = groundAt(pet.x, pet.z); pet.y = damp(pet.y, Math.max(g, -0.3) + (fly ? (pet.going ? 1.2 : 1.9) : 0), 10, dt);
    pet.m.root.position.set(pet.x, pet.y, pet.z); pet.m.root.rotation.set(0, pet.face, 0); pet.m.update(dt, moving || fly);
  }
  function petAshore() { const pet = land.pet, p = land.player; if (!pet) return; pet.x = p.x + 1; pet.z = p.z - 1; pet.y = p.y; pet.told = false; pet.going = null; scene.add(pet.m.root); }
  land.refreshGear = () => { if (land.player) land.player.ch.setBlade(BLADES[game.save.sword]); };

  // ---------- entering and leaving ----------
  function clear() {
    for (const a of land.actors) removeActor(a);
    land.actors = [];
    for (const c of land.chests) scene.remove(c.mesh);
    for (const m of land.mounds) scene.remove(m);
    for (const q of land.pois) if (q.mesh) scene.remove(q.mesh);
    land.chests = []; land.mounds = []; land.pois = []; land.focus = null; land.tokens = 0;
  }
  function spawnPlayer(x, z, face) {
    const p = ensurePlayer(), st = playerStats(game.save);
    Object.assign(p, { x, z, y: groundAt(x, z), face, maxHp: st.maxHp, hp: st.maxHp, state: 'free', t: 0, alive: true, kx: 0, kz: 0, combat: 0 });
    p.ch.anim.state = 'idle'; p.ch.anim.t = 0; scene.add(p.ch.root); place(p);
  }
  land.enter = (isl, at) => {
    clear(); land.isl = isl; land.kind = 'land'; land.cave = null; game.world.cave = false;
    const s = game.save, now = Date.now(), lvl = 1 + 0.07 * (s.level - 1);
    if (at) spawnPlayer(at.x, at.z + 3.5, 0); else spawnPlayer(isl.landing.x, isl.landing.z, isl.land + Math.PI);
    // chance encounters: nothing shows on the compass until you are nearly on top of it
    if (isl.kind !== 'hideout') {
      const spots = isl.pois.slice().sort(() => Math.random() - 0.5).slice(0, 2 + (Math.random() < 0.5 ? 1 : 0));
      for (const sp of spots) {
        const type = pick(['cache', 'cache', 'castaway', 'shrine', 'ambush', 'ambush']), y = heightAt(sp.x, sp.z), q = { type, x: sp.x, z: sp.z, seen: false, done: false, mesh: null };
        if (type === 'cache') { q.mesh = new THREE.Mesh(moundGeo, glintMat); q.mesh.position.set(sp.x, y + 0.08, sp.z); }
        else if (type === 'castaway') { q.mesh = staticFigure('crew'); q.mesh.position.set(sp.x, y, sp.z); q.mesh.rotation.y = rand(TAU); }
        else if (type === 'shrine') { q.mesh = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 6), moundMat), gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), glintMat); st.position.y = 1.1; gem.position.y = 2.7; q.mesh.add(st, gem); q.mesh.position.set(sp.x, y, sp.z); }
        if (q.mesh) scene.add(q.mesh);
        land.pois.push(q);
      }
    }
    isl.cleared = isl.cleared || {};
    const raidReady = now - s.raidAt > 20 * 60000;
    isl.spawns.forEach((sp, i) => {
      if (isl.cleared[i] && now - isl.cleared[i] < 10 * 60000) return;
      if (sp.foe === 'crabking' && s.bosses.crabking && now - s.bosses.crabking < 20 * 60000) return;
      if (isl.kind === 'fort' && !raidReady) return;
      const a = makeActor(sp.foe, sp.x, sp.z, 1, lvl); a.spawnI = i;
      if (sp.foe === 'skeleton') { a.state = 'buried'; a.ch.root.visible = false; }
    });
    if (isl.id === 'regal' && isWanted(s)) { for (let i = 0; i < 4; i++) { const a = makeActor('soldier', isl.site.x + isl.dir[0] * 18 + rand(-6, 6), isl.site.z + isl.dir[1] * 18 + rand(-6, 6), 1, lvl); a.state = 'chase'; } game.toast('The garrison knows your face!', 'warn'); }
    for (const c of isl.chests) addChest(c, !!s.chests[c.id]);
    if (isl.vault) addChest({ x: isl.vault.x, z: isl.vault.z, id: 'vault', tier: 4, vault: true }, !raidReady);
    for (const m of s.maps) if (m.island === isl.id) { const d = isl.digs[m.spot], mesh = new THREE.Mesh(moundGeo, moundMat); mesh.position.set(d.x, heightAt(d.x, d.z) + 0.1, d.z); scene.add(mesh); land.mounds.push(mesh); }
    petAshore(); landingParty();
    if (isl.kind === 'hideout') { const p = collect(s); if (p.gold + p.timber + p.iron > 0) game.toast(`The cove produced: ${[p.gold && `${p.gold} gold`, p.timber && `${p.timber} timber`, p.iron && `${p.iron} iron`].filter(Boolean).join(', ')}`, 'gold'); }
  };
  function addChest(c, open) {
    const mesh = chestMesh(c.tier); mesh.position.set(c.x, heightAt(c.x, c.z), c.z); mesh.rotation.y = (c.x * 7 + c.z) % TAU; if (c.tier >= 3) mesh.scale.setScalar(1.25);
    mesh.userData.lid.rotation.x = open ? -1.9 : 0; scene.add(mesh); land.chests.push({ c, mesh, open });
  }
  // the walkable part of a ship's deck, as a platform that follows the ship
  function deckPlat(sh) { const w = sh.model.walk, mid = (w.z0 + w.z1) / 2, [x, z] = sh.at(0, mid); return { x, z, ang: sh.heading, hl: (w.z1 - w.z0) / 2, hw: sh.cls.beam * 0.44 + 0.45, top: (sh.y || 0) + sh.model.deckY, ship: sh, mid }; }
  // ----- caves: one shared room, filled by whichever island you entered from -----
  land.enterCave = () => game.fade(() => {
    const isl = land.isl, s = game.save, lvl = 1 + 0.07 * (s.level - 1), c = CAVE, fresh = !s.caves[isl.id] || Date.now() - s.caves[isl.id] > 30 * 60000;
    clear(); land.isl = isl; land.cave = { isl }; game.world.cave = true;
    spawnPlayer(c.x, c.z - c.hl + 2.5, 0); game.cam.yaw = 0; game.cam.pitch = 0.5;
    if (fresh) (CAVE_FOES[isl.id] || ['skeleton', 'skeleton']).forEach((k, i, arr) => { const a = makeActor(k, c.x + Math.sin(i * 2.3) * 6, c.z + 2 + (i / arr.length) * 10, 1, lvl); a.face = Math.PI; });
    addChest({ x: c.x, z: c.z + c.hl - 3, id: `cave:${isl.id}`, tier: 3, cave: isl.id }, !fresh);
    petAshore(); landingParty(); game.toast(fresh ? 'Something moves in the dark.' : 'The cave is quiet. You cleared it not long ago.', fresh ? 'warn' : 'dim');
  });
  land.exitCave = () => game.fade(() => { const isl = land.isl; land.enter(isl, isl.caveAt); game.cam.yaw = 0; });
  // ----- powder flasks -----
  const bombGeo = new THREE.IcosahedronGeometry(0.16, 0), bombMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, flatShading: true });
  function throwBomb(p) {
    const s = game.save, f = land.focus, d = f ? Math.min(11, dist2(p.x, p.z, f.x, f.z)) : 8, ang = f ? Math.atan2(f.x - p.x, f.z - p.z) : p.face;
    s.bombs--; p.face = ang; p.state = 'throw'; p.t = 0;
    const mesh = new THREE.Mesh(bombGeo, bombMat); scene.add(mesh);
    land.bombs.push({ mesh, x0: p.x, z0: p.z, y0: p.y + 1.7, x1: p.x + Math.sin(ang) * d, z1: p.z + Math.cos(ang) * d, t: -0.22, dur: 0.6 });
  }
  function updateBombs(dt) {
    for (let i = land.bombs.length - 1; i >= 0; i--) {
      const b = land.bombs[i]; b.t += dt; const u = clamp(b.t / b.dur, 0, 1), gy = groundAt(b.x1, b.z1);
      b.mesh.visible = b.t > 0; b.mesh.position.set(b.x0 + (b.x1 - b.x0) * u, b.y0 + (gy - b.y0) * u + Math.sin(u * Math.PI) * 2.6, b.z0 + (b.z1 - b.z0) * u);
      if (b.t > 0 && Math.random() < 0.5) fx.sparks(b.mesh.position.x, b.mesh.position.y + 0.15, b.mesh.position.z, 1, 0xffb347);
      if (u >= 1) {
        scene.remove(b.mesh); land.bombs.splice(i, 1);
        fx.smoke(b.x1, gy + 0.6, b.z1, null, 14); fx.fire(b.x1, gy + 0.5, b.z1, 8); fx.dust(b.x1, gy + 0.2, b.z1, 12); audio.cannon(0.7); game.shake(0.7);
        const dmg = (70 + game.save.level * 10) * (feat(game.save, 'powder') ? 1.3 : 1);
        for (const a of land.actors) if (a.alive && a.team === 1 && a.state !== 'buried' && dist2(a.x, a.z, b.x1, b.z1) < 3.8 + a.radius) hurtFoe(a, dmg * rand(0.85, 1.1), { x: b.x1, z: b.z1, isPlayer: true, team: 0 }, true);
      }
    }
  }
  land.enterBoarding = (enemy) => {
    clear(); land.isl = null; land.kind = 'board';
    const ps = game.sea.player, side = ps.bearing(enemy.x, enemy.z).side, s = game.save, lvl = 1 + 0.07 * (s.level - 1);
    enemy.heading = ps.heading; [enemy.x, enemy.z] = ps.at(side * (ps.cls.beam / 2 + enemy.cls.beam / 2 + 0.15), 0);
    ps.fadeSails(true); enemy.fadeSails(true);
    ps.frozen = enemy.frozen = true; ps.speed = enemy.speed = 0; ps.sail = enemy.sail = 0; ps.lean = enemy.lean = 0;
    const plat = (sh) => deckPlat(sh);
    land.boarding = { enemy, plats: [plat(ps), plat(enemy)], won: false, t: 0 };
    platforms.push(...land.boarding.plats);
    const [px, pz] = ps.at(-side * 0.8, (ps.model.walk.z0 + ps.model.walk.z1) / 2); spawnPlayer(px, pz, ps.heading + side * Math.PI / 2);
    spawnHands(s.crew.slice().sort((a, b) => worth(b) - worth(a)).slice(0, 8), (i, n) => ps.at(-side * 0.5, (ps.model.walk.z0 + ps.model.walk.z1) / 2 + (i - (n - 1) / 2) * 2.2));
    enemy.crew.forEach((k, i) => { const [x, z] = enemy.at(rand(-1, 1) * enemy.cls.beam * 0.25, enemy.model.walk.z0 + 1 + (i / Math.max(1, enemy.crew.length - 1)) * (enemy.model.walk.z1 - enemy.model.walk.z0 - 2)); const a = makeActor(k, x, z, 1, lvl); a.state = 'chase'; a.face = land.player.face + Math.PI; });
    petAshore();
    game.toast('Board her! Cut them down!', 'warn');
  };
  // Walk your own deck while she sails. Positions are kept in ship space so you ride along.
  land.enterDeck = () => {
    clear(); land.isl = null; land.kind = 'deck';
    const sh = game.sea.player; land.deck = deckPlat(sh); platforms.push(land.deck);
    const [x, z] = sh.at(0, land.deck.mid); spawnPlayer(x, z, sh.heading); land.lx = 0; land.lz = land.deck.mid; land.lh = sh.heading;
    if (sh.group.userData.helm) sh.group.userData.helm.visible = !!sea().mate; sh.fadeSails(true);
  };
  const sea = () => game.sea;
  function rideDeck(before) {
    const sh = game.sea.player, d = land.deck, p = land.player;
    if (before) { const dh = angleDiff(land.lh, sh.heading), [dx, dz] = sh.at(0, d.mid); d.x = dx; d.z = dz; d.ang = sh.heading; d.top = (sh.y || 0) + sh.model.deckY; [p.x, p.z] = sh.at(land.lx, land.lz); p.face += dh; game.cam.yaw += dh; land.lh = sh.heading; }
    else [land.lx, land.lz] = sh.local(p.x, p.z);
  }
  land.leave = () => {
    clear();
    if (land.deck) { const i = platforms.indexOf(land.deck); if (i >= 0) platforms.splice(i, 1); land.deck = null; const sh = game.sea.player; if (sh.group.userData.helm) sh.group.userData.helm.visible = true; sh.fadeSails(false); }
    if (land.player) scene.remove(land.player.ch.root);
    if (land.boarding) { for (const p of land.boarding.plats) { const i = platforms.indexOf(p); if (i >= 0) platforms.splice(i, 1); } game.sea.player.frozen = false; land.boarding.enemy.frozen = false; game.sea.player.fadeSails(false); land.boarding.enemy.fadeSails(false); land.boarding = null; }
    land.kind = null; land.isl = null; land.gun = null; land.torchOff(); land.dockPet();
  };

  // ---------- movement ----------
  function walk(a, dx, dz) {
    const ok = (x, z) => groundAt(x, z) > -0.6 && (!(land.boarding || land.kind === 'deck' || land.cave) || groundAt(x, z) > 0.5);
    let nx = a.x + dx, nz = a.z + dz;
    if (!ok(nx, nz)) { if (ok(nx, a.z)) nz = a.z; else if (ok(a.x, nz)) nx = a.x; else return; }
    if (land.isl && !land.cave) for (const c of land.isl.colliders) { const d = dist2(nx, nz, c.x, c.z), m = c.r + a.radius; if (d < m && d > 0.001) { nx = c.x + ((nx - c.x) / d) * m; nz = c.z + ((nz - c.z) / d) * m; } }
    if (!ok(nx, nz)) return;
    a.x = nx; a.z = nz;
  }
  function settle(a, dt) {
    if (Math.abs(a.kx) + Math.abs(a.kz) > 0.05) { walk(a, a.kx * dt, a.kz * dt); a.kx = damp(a.kx, 0, 9, dt); a.kz = damp(a.kz, 0, 9, dt); }
    const g = groundAt(a.x, a.z); a.y = Math.abs(g - a.y) > 1.5 ? g : damp(a.y, g, 18, dt);
    place(a); a.ch.update(dt);
  }
  const chest = (a) => ({ x: a.x, y: a.y + 1.25 * (a.def.scale || 1) * (a.def.look === 'crab' ? 0.45 : 1), z: a.z });

  // ---------- damage ----------
  function hurtFoe(a, dmg, from, crit) {
    if (!a.alive) return;
    a.hp -= dmg; a.bar.visible = a.bg.visible = true; a.bar.scale.x = Math.max(0.001, (a.hp / a.maxHp)) / (a.def.scale || 1);
    const c = chest(a);
    if (a.def.look === 'skeleton') fx.dust(c.x, c.y, c.z, 6, 0xcfc7b0); else fx.blood(c.x, c.y, c.z, crit ? 12 : 7, a.def.look === 'crab' ? 0x5b7a3a : 0x6b1512);
    if (from && from.isPlayer) game.ui.floatText(c.x, c.y + 0.9, c.z, Math.round(dmg), crit ? '#ffb347' : '#ffe6b0', crit);
    if (from) { const d = dist2(a.x, a.z, from.x, from.z) || 1, k = a.def.boss ? 0.6 : a.def.heavy ? 1.5 : 4; a.kx = ((a.x - from.x) / d) * k; a.kz = ((a.z - from.z) / d) * k; }
    if (a.state === 'idle' || a.state === 'buried') wake(a);
    if (a.hp <= 0) return kill(a, from);
    if (!a.def.heavy && !a.def.boss && !a.def.mini && a.state !== 'stagger' && (a.state !== 'wind' || crit)) { release(a); a.state = 'stagger'; a.t = crit ? 0.7 : 0.28; a.ch.anim.state = 'stagger'; }
  }
  function wake(a) { if (a.state === 'buried') { a.ch.root.visible = true; a.state = 'rise'; a.t = 0; fx.dust(a.x, a.y + 0.2, a.z, 10); } else if (a.state === 'idle') a.state = 'chase'; }
  function release(a) { if (a.token) { a.token = false; land.tokens = Math.max(0, land.tokens - 1); } a.mark.visible = false; if (a.line) a.line.visible = false; }
  function kill(a, from) {
    a.alive = false; a.hp = 0; release(a); a.state = 'dead'; a.t = 0; a.ch.anim.state = 'dead'; a.ch.anim.t = 0; a.bar.visible = a.bg.visible = false;
    if (land.focus === a) land.focus = null;
    if (a.hand) handFell(a);
    if (a.team === 1) {
      const s = game.save, d = a.def; s.stats.kills++;
      if (land.isl && a.spawnI !== undefined) land.isl.cleared[a.spawnI] = Date.now();
      if (from && (from.isPlayer || from.team === 0)) { const gold = Math.round(rand(d.gold[0], d.gold[1])); game.reward({ gold, xp: d.xp }, d.boss ? `${d.name} is dead` : null); if (gold) game.ui.floatText(a.x, a.y + 2.2, a.z, `+${gold}`, '#e9c46a'); }
      game.emit('kill', { foe: a.key, island: land.isl && land.isl.id });
      if (d.boss) { s.bosses[a.key] = Date.now(); game.emit('boss', { boss: a.key }); audio.good(); }
    }
  }
  function hurtPlayer(dmg, from, heavy) {
    const p = land.player; if (!p.alive) return;
    dmg *= 1 - 0.13 * (game.save.mercy || 0);
    p.hp -= dmg; p.combat = 6; game.ui.flash(); game.shake(heavy ? 0.8 : 0.4); audio.hit(1);
    const c = chest(p); fx.blood(c.x, c.y, c.z, 8);
    if (from) { const d = dist2(p.x, p.z, from.x, from.z) || 1, k = heavy ? 9 : 3; p.kx = ((p.x - from.x) / d) * k; p.kz = ((p.z - from.z) / d) * k; }
    if (p.hp <= 0 && feat(game.save, 'wind') && Date.now() - (p.windAt || 0) > 180000) { p.windAt = Date.now(); p.hp = p.maxHp * 0.4; game.toast('Second wind! You refuse to fall.', 'gold'); audio.good(); return; }
    if (p.hp <= 0) { p.hp = 0; p.alive = false; p.state = 'dead'; p.ch.anim.state = 'dead'; p.ch.anim.t = 0; audio.bad(); game.playerFell(); }
    else if (heavy && p.state !== 'roll') { p.state = 'stagger'; p.t = 0.4; }
  }

  // ---------- the player ----------
  function findFocus(range, dirx, dirz) {
    const p = land.player; let best = null, bs = 1e9;
    for (const a of land.actors) {
      if (!a.alive || a.team !== 1 || a.state === 'buried') continue;
      const d = dist2(p.x, p.z, a.x, a.z) - a.radius; if (d > range) continue;
      const dot = ((a.x - p.x) * dirx + (a.z - p.z) * dirz) / (d + a.radius + 0.01);
      const s = d - dot * 3 - (a === land.focus ? 1.5 : 0);
      if (s < bs) { bs = s; best = a; }
    }
    return best;
  }
  function swing(p, i) {
    p.state = 'attack'; p.t = 0; p.atk = i; p.hitDone = false; p.queued = false; audio.swish(); p.combat = Math.max(p.combat, 3);
    if (land.focus && dist2(p.x, p.z, land.focus.x, land.focus.z) < 7) p.face = Math.atan2(land.focus.x - p.x, land.focus.z - p.z);
  }
  function updatePlayer(dt) {
    const p = land.player, an = p.ch.anim, s = game.save, st = playerStats(s);
    const jx = input.move.x, jy = input.move.y, jm = Math.min(1, Math.hypot(jx, jy)), cy = game.cam.yaw;
    let mx = Math.sin(cy) * jy - Math.cos(cy) * jx, mz = Math.cos(cy) * jy + Math.sin(cy) * jx;
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    p.cdRoll -= dt; p.gunT -= dt; p.combat -= dt; p.t += dt; p.cdWhirl = (p.cdWhirl || 0) - dt;
    if (!p.alive) { settle(p, dt); return; }
    if (land.gun) { for (const k of ['dodge', 'skill', 'bomb', 'shoot', 'rum']) input.pressed[k] = false; p.state = 'free'; p.face = land.gun.face; an.state = 'idle'; land.focus = null; settle(p, dt); return; }
    const fdx = jm > 0.2 ? mx : Math.sin(p.face), fdz = jm > 0.2 ? mz : Math.cos(p.face);
    land.focus = findFocus(10, fdx, fdz);
    const f = land.focus;
    if (p.combat <= 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.05 * dt);

    const free = p.state === 'free' || p.state === 'block';
    if (free || (p.state === 'attack' && p.t / ATK_DUR[p.atk] > 0.3)) {
      if (input.take('dodge') && p.cdRoll <= 0) {
        p.state = 'roll'; p.t = 0; p.cdRoll = 0.85; p.rx = jm > 0.25 ? mx : Math.sin(p.face); p.rz = jm > 0.25 ? mz : Math.cos(p.face); p.face = Math.atan2(p.rx, p.rz); audio.swish();
      }
    }
    if (free) {
      if (input.take('skill')) { if (p.cdWhirl > 0) game.toast('Catch your breath first', 'dim'); else { p.state = 'whirl'; p.t = 0; p.cdWhirl = feat(s, 'whirl') ? 4 : 7; p.hitDone = false; audio.swish(); p.combat = Math.max(p.combat, 3); } }
      else if (input.take('bomb')) { if (s.bombs > 0) throwBomb(p); else game.toast('No powder flasks. Blacksmiths sell them.', 'dim'); }
      else if (input.take('primary')) swing(p, 0);
      else if (input.take('shoot')) {
        if (p.gunT > 0) game.toast('Still reloading', 'dim');
        else { const t = findFocus(30, Math.sin(p.face), Math.cos(p.face)); p.state = 'shoot'; p.t = 0; p.shotAt = t; p.fired = false; if (t) p.face = Math.atan2(t.x - p.x, t.z - p.z); }
      } else if (input.take('rum')) {
        if (s.rum > 0 && p.hp < p.maxHp) { s.rum--; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (0.55 + Math.min(0.4, crewBonus(s).heal * 0.4))); audio.good(); game.toast('You drink the rum. Wounds fade.', 'dim'); fx.sparks(p.x, p.y + 1.6, p.z, 10, 0x9fe0a8); }
        else game.toast(s.rum > 0 ? 'You are not hurt' : 'No rum left', 'dim');
      } else if (input.down.block) { if (p.state !== 'block') { p.state = 'block'; p.blockT = 0; } }
      else p.state = 'free';
    }

    if (p.state === 'free' || p.state === 'block') {
      const blocking = p.state === 'block', sp = (blocking ? 2.0 : 5.7) * jm;
      if (blocking) p.blockT += dt;
      if (jm > 0.08) { walk(p, mx * sp * dt, mz * sp * dt); if (!blocking || !f) p.face = turnToward(p.face, Math.atan2(mx, mz), 12 * dt); }
      if (blocking && f) p.face = turnToward(p.face, Math.atan2(f.x - p.x, f.z - p.z), 10 * dt);
      an.state = blocking ? 'block' : jm > 0.08 ? 'run' : 'idle'; an.speed = sp;
      if (an.state === 'run' && Math.random() < dt * 5) fx.dust(p.x, p.y + 0.1, p.z, 1);
    } else if (p.state === 'attack') {
      const dur = ATK_DUR[p.atk], u = p.t / dur; an.state = 'attack'; an.i = p.atk; an.u = Math.min(1, u);
      if (u < 0.45) {
        if (f) { const d = dist2(p.x, p.z, f.x, f.z); p.face = turnToward(p.face, Math.atan2(f.x - p.x, f.z - p.z), 14 * dt); if (d > 1.5 + f.radius && d < 7) walk(p, Math.sin(p.face) * 8 * dt, Math.cos(p.face) * 8 * dt); }
        else walk(p, Math.sin(p.face) * 3 * dt, Math.cos(p.face) * 3 * dt);
      }
      if (u >= HIT_U && !p.hitDone) {
        p.hitDone = true; let any = false;
        for (const a of land.actors) {
          if (!a.alive || a.team !== 1 || a.state === 'buried') continue;
          const d = dist2(p.x, p.z, a.x, a.z); if (d > REACH + a.radius) continue;
          if (Math.abs(angleDiff(p.face, Math.atan2(a.x - p.x, a.z - p.z))) > 1.15 && d > 1) continue;
          const crit = a.state === 'stagger' && a.parried; hurtFoe(a, st.sword * (p.atk === 2 ? 1.5 : 1) * (crit ? 1.8 : 1) * rand(0.9, 1.1), p, crit); any = true;
        }
        if (any) { audio.hit(0.9); game.hitStop(p.atk === 2 ? 0.07 : 0.04); game.shake(p.atk === 2 ? 0.35 : 0.18); }
      }
      if (input.take('primary')) p.queued = true;
      if ((u > 0.7 && p.queued) || u >= 1) { if (p.queued) swing(p, (p.atk + 1) % 3); else { p.state = 'free'; } }
    } else if (p.state === 'roll') {
      const u = p.t / 0.5; an.state = 'roll'; an.u = Math.min(1, u); walk(p, p.rx * 9.5 * (1 - u * 0.5) * dt, p.rz * 9.5 * (1 - u * 0.5) * dt);
      if (u >= 1) p.state = 'free';
    } else if (p.state === 'whirl') { // spin and cut everything around you
      const u = p.t / 0.6; an.state = 'whirl'; an.u = Math.min(1, u);
      if (u >= 0.35 && !p.hitDone) {
        p.hitDone = true; let any = false;
        for (const a of land.actors) if (a.alive && a.team === 1 && a.state !== 'buried' && dist2(p.x, p.z, a.x, a.z) < 3.4 + a.radius) { hurtFoe(a, st.sword * 1.4 * rand(0.9, 1.1), p, false); any = true; }
        fx.dust(p.x, p.y + 0.3, p.z, 10); if (any) { audio.hit(1); game.hitStop(0.06); game.shake(0.4); }
      }
      if (u >= 1) p.state = 'free';
    } else if (p.state === 'throw') { an.state = 'throw'; an.u = Math.min(1, p.t / 0.45); if (p.t > 0.45) p.state = 'free'; }
    else if (p.state === 'shoot') {
      an.state = 'shoot'; an.u = Math.min(1, p.t / 0.5);
      if (p.t > 0.14 && !p.fired) {
        p.fired = true; p.gunT = st.gunReload; const t = p.shotAt, from = { x: p.x + Math.sin(p.face) * 0.7, y: p.y + 1.45, z: p.z + Math.cos(p.face) * 0.7 };
        const to = t && t.alive ? chest(t) : { x: p.x + Math.sin(p.face) * 30, y: p.y + 1.4, z: p.z + Math.cos(p.face) * 30 };
        fx.tracer(from, to); fx.smoke(from.x, from.y, from.z, [Math.sin(p.face) * 0.4, 0, Math.cos(p.face) * 0.4], 5); audio.shot(1); game.shake(0.3);
        if (t && t.alive) hurtFoe(t, st.gun * rand(0.92, 1.08), p, true);
      }
      if (p.t > 0.5) p.state = 'free';
    } else if (p.state === 'stagger') { an.state = 'stagger'; if (p.t > 0) { p.t = -1; } p.stag = (p.stag || 0) + dt; if (p.stag > 0.4) { p.stag = 0; p.state = 'free'; } }
    else if (p.state === 'dig') {
      an.state = 'dig'; if (Math.random() < dt * 7) { fx.dust(p.x + Math.sin(p.face) * 0.8, p.y + 0.2, p.z + Math.cos(p.face) * 0.8, 3, 0x7b6548); } p.digS = (p.digS || 0) + dt; if (p.digS > 0.42) { p.digS = 0; audio.dig(); }
      if (p.t > 2.4) { p.state = 'free'; p.digDone(); }
    }
    settle(p, dt);
  }
  const iframes = (p) => p.state === 'roll' && p.t > 0.03 && p.t < 0.4;

  // ---------- everyone else ----------
  function nearestEnemyOf(a) {
    let best = null, bd = 1e9; const p = land.player;
    if (a.team === 1 && p.alive) { best = p; bd = dist2(a.x, a.z, p.x, p.z) * 0.8; }
    for (const b of land.actors) if (b.alive && b.team !== a.team && b.state !== 'buried') { if (a.team === 0 && land.kind === 'land' && (b.state === 'idle' || dist2(b.x, b.z, p.x, p.z) > 16)) continue; const d = dist2(a.x, a.z, b.x, b.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  function strike(a, t) {
    const d = dist2(a.x, a.z, t.x, t.z), reach = 1.9 * (a.def.scale || 1) + a.radius + t.radius + 0.5;
    if (d > reach || Math.abs(angleDiff(a.face, Math.atan2(t.x - a.x, t.z - a.z))) > 1.0) return;
    if (!t.isPlayer) { if (t.team === 1) hurtFoe(t, a.dmg * rand(0.9, 1.1), a, false); else { t.hp -= a.dmg; t.bar.visible = t.bg.visible = true; t.bar.scale.x = Math.max(0.001, t.hp / t.maxHp); fx.blood(t.x, t.y + 1.2, t.z, 5); if (t.hp <= 0) kill(t, a); } audio.hit(0.4); return; }
    const c = chest(t);
    if (iframes(t)) { game.ui.floatText(c.x, c.y + 1, c.z, 'Dodged', '#cfe8d8'); return; }
    const facing = Math.abs(angleDiff(t.face, Math.atan2(a.x - t.x, a.z - t.z))) < 1.7;
    if (t.state === 'block' && facing) {
      if (a.def.heavy) { hurtPlayer(a.dmg * 0.5, a, true); game.ui.floatText(c.x, c.y + 1, c.z, 'Guard broken', '#ffa51f'); audio.clang(1); return; }
      audio.clang(1); fx.sparks(c.x + Math.sin(t.face) * 0.6, c.y + 0.2, c.z + Math.cos(t.face) * 0.6, 12); t.combat = 6;
      if (t.blockT < 0.28) { a.state = 'stagger'; a.t = 1.5; a.parried = true; a.ch.anim.state = 'stagger'; release(a); game.ui.floatText(c.x, c.y + 1, c.z, 'PARRY', '#ffd28a', true); game.hitStop(0.09); game.shake(0.3); }
      else { t.kx = Math.sin(a.face) * 3; t.kz = Math.cos(a.face) * 3; }
      return;
    }
    hurtPlayer(a.dmg * rand(0.9, 1.1), a, !!a.def.heavy);
  }
  function updateFoe(a, dt) {
    const an = a.ch.anim, p = land.player; a.t += dt; a.cd -= dt;
    if (a.state === 'dead') { if (a.t > 3) a.y -= dt * 0.6; if (a.t > 5.5) { removeActor(a); a.gone = true; } a.ch.root.position.y = a.y; a.ch.update(dt); return; }
    if (a.state === 'buried') { if (dist2(a.x, a.z, p.x, p.z) < 13) wake(a); return; }
    if (a.state === 'rise') { const k = Math.min(1, a.t / 0.8); a.ch.root.position.set(a.x, a.y - (1 - k) * 1.7, a.z); a.ch.update(dt); if (k >= 1) a.state = 'chase'; return; }
    const t = nearestEnemyOf(a);
    if (a.state === 'idle') {
      an.state = 'idle';
      if (t && dist2(a.x, a.z, t.x, t.z) < (a.def.boss ? 26 : 17)) { a.state = 'chase'; if (a.def.boss) { audio.roar(); game.shake(0.8); } }
      settle(a, dt); return;
    }
    if (a.team === 0 && land.kind === 'land' && a.state !== 'stagger' && (!t || dist2(a.x, a.z, p.x, p.z) > 24)) { // stay with the captain
      const d = dist2(a.x, a.z, p.x, p.z), to = Math.atan2(p.x - a.x, p.z - a.z); release(a); a.state = 'chase';
      if (d > 45) { a.x = p.x - Math.sin(p.face) * 2; a.z = p.z - Math.cos(p.face) * 2; a.y = groundAt(a.x, a.z); }
      else if (d > 3.4) { const sp = d > 9 ? 7 : 5; a.face = turnToward(a.face, to, 8 * dt); walk(a, Math.sin(to) * sp * dt, Math.cos(to) * sp * dt); an.state = 'run'; an.speed = sp; } else an.state = 'idle';
      if (a.hp < a.maxHp) { a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.03 * dt); a.bar.scale.x = Math.max(0.001, a.hp / a.maxHp) / (a.def.scale || 1); }
      settle(a, dt); return;
    }
    if (!t) { an.state = 'idle'; release(a); if (a.state !== 'stagger') a.state = 'chase'; settle(a, dt); return; }
    const d = dist2(a.x, a.z, t.x, t.z), to = Math.atan2(t.x - a.x, t.z - a.z), sc = a.def.scale || 1, reach = 1.5 * sc + a.radius + t.radius;
    if (a.state === 'stagger') { an.state = 'stagger'; if (a.t >= 0) { a.t = -a.t; } if (a.t > -0.02) { a.state = 'chase'; a.parried = false; a.cd = Math.max(a.cd, 0.3); } settle(a, dt); return; }
    if (a.def.ranged) {
      if (a.state === 'chase') {
        a.face = turnToward(a.face, to, 6 * dt);
        const mv = d > 17 ? 1 : d < 7 ? -0.8 : 0;
        if (mv) walk(a, Math.sin(to) * a.def.speed * mv * dt, Math.cos(to) * a.def.speed * mv * dt); else walk(a, Math.cos(to) * a.strafe * 1.2 * dt, -Math.sin(to) * a.strafe * 1.2 * dt);
        an.state = mv ? 'run' : 'idle'; an.speed = a.def.speed;
        if (a.cd <= 0 && d < 24) { a.state = 'wind'; a.t = 0; a.aim = { x: t.x, z: t.z }; }
      } else if (a.state === 'wind') {
        an.state = 'aim'; a.mark.visible = a.team === 1;
        if (a.t < a.def.tele - 0.28) { a.face = turnToward(a.face, to, 8 * dt); a.aim = { x: t.x, z: t.z }; }
        const from = { x: a.x + Math.sin(a.face) * 0.6, y: a.y + 1.42, z: a.z + Math.cos(a.face) * 0.6 }, L = 26;
        a.line.visible = a.team === 1; a.line.position.set(from.x + Math.sin(a.face) * L / 2, from.y, from.z + Math.cos(a.face) * L / 2); a.line.rotation.y = a.face; a.line.scale.z = L; a.line.material.opacity = 0.35 + 0.5 * (a.t / a.def.tele);
        if (a.t >= a.def.tele) {
          release(a); a.state = 'chase'; a.cd = rand(2.4, 3.6); audio.shot(0.7); fx.smoke(from.x, from.y, from.z, [Math.sin(a.face) * 0.4, 0, Math.cos(a.face) * 0.4], 5);
          const hit = dist2(t.x, t.z, a.aim.x, a.aim.z) < 1.5 && !(t.isPlayer && iframes(t));
          const end = hit ? chest(t) : { x: from.x + Math.sin(a.face) * L, y: from.y, z: from.z + Math.cos(a.face) * L }; fx.tracer(from, end);
          if (hit) { if (t.isPlayer) hurtPlayer(a.dmg * (t.state === 'block' ? 0.5 : 1), a, false); else if (t.team === 1) hurtFoe(t, a.dmg * rand(0.9, 1.1), a, false); else { t.hp -= a.dmg; t.bar.visible = t.bg.visible = true; t.bar.scale.x = Math.max(0.001, t.hp / t.maxHp); if (t.hp <= 0) kill(t, a); } }
          else if (t.isPlayer) game.ui.floatText(t.x, t.y + 2.2, t.z, 'Missed', '#cfe8d8');
        }
      }
      settle(a, dt); return;
    }
    if (a.state === 'chase') {
      a.face = turnToward(a.face, to, 7 * dt);
      const want = t.isPlayer && !a.token && land.tokens >= 2 ? reach + 2.2 : reach - 0.25;
      if (d > want + 0.15) { walk(a, Math.sin(to) * a.def.speed * dt, Math.cos(to) * a.def.speed * dt); an.state = 'run'; an.speed = a.def.speed; }
      else if (d < want - 0.9) { walk(a, -Math.sin(to) * 2 * dt, -Math.cos(to) * 2 * dt); an.state = 'run'; an.speed = 2; }
      else { an.state = 'idle'; if (t.isPlayer && !a.token && land.tokens >= 2) walk(a, Math.cos(to) * a.strafe * 1.4 * dt, -Math.sin(to) * a.strafe * 1.4 * dt); }
      if (d <= reach + 0.2 && a.cd <= 0 && (!t.isPlayer || a.token || land.tokens < 2)) { if (t.isPlayer && !a.token) { a.token = true; land.tokens++; } a.state = 'wind'; a.t = 0; a.atkI = (a.atkI || 0) + 1; }
    } else if (a.state === 'wind') {
      an.state = 'attack'; an.i = a.def.heavy ? 2 : a.atkI; an.u = 0.3 * Math.min(1, a.t / a.def.tele); a.mark.visible = a.team === 1; a.mark.rotation.y += dt * 6;
      if (a.t < a.def.tele - 0.16) a.face = turnToward(a.face, to, 5 * dt);
      if (a.def.boss && a.t > a.def.tele * 0.5 && d > reach) walk(a, Math.sin(a.face) * 7 * dt, Math.cos(a.face) * 7 * dt);
      if (a.t >= a.def.tele) { a.state = 'strike'; a.t = 0; a.mark.visible = false; audio.swish(); strike(a, t); if (a.def.heavy) { fx.dust(a.x + Math.sin(a.face) * 1.5 * sc, a.y + 0.2, a.z + Math.cos(a.face) * 1.5 * sc, 10); game.shake(0.25); } }
    } else if (a.state === 'strike') {
      an.state = 'attack'; an.u = 0.3 + Math.min(0.7, (a.t / 0.55) * 0.7);
      if (a.t > 0.55) { release(a); a.state = 'chase'; a.cd = rand(0.5, 1.5) * (a.team === 0 ? 0.8 : 1); }
    }
    settle(a, dt);
  }

  // ---------- interactions ----------
  function chestLoot(tier) {
    const r = { gold: Math.round(rand(40, 90) * [0, 1, 2.2, 4.5, 9][tier]), timber: tier >= 2 ? Math.round(rand(8, 20) * tier) : 0, iron: tier >= 2 ? Math.round(rand(5, 12) * tier) : 0, rum: Math.random() < 0.5 ? 1 : 0, xp: 15 * tier };
    return r;
  }
  function openChest(ch) {
    ch.open = true; const s = game.save; game.emit('chest', {}); audio.good(); fx.sparks(ch.c.x, heightAt(ch.c.x, ch.c.z) + 0.8, ch.c.z, 16, 0xffd978);
    if (ch.c.cave) { s.caves[ch.c.cave] = Date.now(); const r = chestLoot(3); r.gold = Math.round(r.gold * 1.4); game.reward(r, 'The cave hoard is yours'); if (Math.random() < 0.6) { s.bombs = Math.min(6, s.bombs + 2); game.toast('Two powder flasks were packed in with it.', 'gold'); } }
    else if (ch.c.vault) { s.raidAt = Date.now(); game.reward({ gold: Math.round(rand(700, 950) * (1 + s.level * 0.08)), iron: 60, timber: 60, xp: 150 }, "Bloodwater's vault is yours"); game.emit('raid', { island: land.isl.id }); }
    else { s.chests[ch.c.id] = true; if (ch.c.id === 'bones:idol' && !s.pets.parrot) { s.pets.parrot = true; if (!s.pet) { s.pet = 'parrot'; land.setPet(); } game.ui.banner('New companion', PETS.parrot.name, 'A scarlet bird drops from the idol onto your shoulder. ' + PETS.parrot.perk); } const r = chestLoot(ch.c.tier); game.reward(r, r.rum ? 'Chest opened (and a bottle of rum)' : 'Chest opened'); }
  }
  land.context = () => {
    const p = land.player, isl = land.isl, s = game.save;
    if (!p || !p.alive || p.state === 'dig') return null;
    if (land.kind === 'board') return null;
    if (land.kind === 'deck') {
      const sh = game.sea.player, need = sh.maxHp - sh.hp;
      if (land.gun) return { label: 'Leave the gun', icon: 'person', run: () => { land.gun = null; game.cam.yaw = sh.heading; game.cam.pitch = 0.45; } };
      for (let i = 0; i < sh.model.gunZ.length; i++) { const g = sh.model.gunZ[i]; if (Math.abs(land.lz - g.z) < 1.3 && Math.abs(land.lx) > g.x - 2.4) { const side = land.lx > 0 ? 1 : -1; return { label: 'Man this gun', sub: `${side > 0 ? 'Port' : 'Starboard'} gun ${i + 1}: aim and fire it yourself`, icon: 'fire', run: () => { land.gun = { side, i, aim: 0, range: 90, face: 0 }; land.lx = side * Math.max(0.6, g.x - 1.1); land.lz = g.z; game.tip2('gun', 'You are on the gun. Drag or use the stick to swing it left and right and to set the range. The ring shows where the ball lands. Tap FIRE.'); } }; } }
      if (Math.abs(land.lz - (0.47 - 0.5) * sh.cls.len) < 2.2 && Math.abs(land.lx) < 2.2 && need > 4 && s.timber > 0) return { label: 'Repair hull', sub: `${s.timber} timber aboard`, icon: 'build', run: () => { const n = Math.min(5, s.timber, Math.ceil(need / 5)); s.timber -= n; sh.hp = Math.min(sh.maxHp, sh.hp + n * 5); audio.dig(); game.toast(`Patched the hull with ${n} timber.`, 'gold'); } };
      return { label: 'Take the helm', icon: 'anchor', run: () => game.takeHelm() };
    }
    if (land.cave) {
      const dng = land.actors.some((a) => a.alive && a.team === 1);
      for (const ch of land.chests) if (!ch.open && dist2(p.x, p.z, ch.c.x, ch.c.z) < 2.8) return dng ? { label: 'Enemies near', icon: 'chest', run: () => game.toast('Deal with them first', 'dim') } : { label: 'Open the hoard', icon: 'chest', run: () => openChest(ch) };
      if (p.z < CAVE.z - CAVE.hl + 4) return { label: 'Leave the cave', icon: 'anchor', run: () => land.exitCave() };
      return null;
    }
    if (isl.caveAt && dist2(p.x, p.z, isl.caveAt.x, isl.caveAt.z + 2.5) < 4.5) return { label: 'Enter the cave', icon: 'board', run: () => land.enterCave() };
    for (const q of land.pois) if (!q.done && q.type !== 'ambush' && dist2(p.x, p.z, q.x, q.z) < 3.2) {
      if (q.type === 'cache') return { label: 'Dig here', sub: 'Something glints in the sand', icon: 'dig', run: () => { p.state = 'dig'; p.t = 0; p.digDone = () => { q.done = true; scene.remove(q.mesh); audio.good(); game.reward({ gold: Math.round(rand(60, 160) * (1 + s.level * 0.1)), xp: 25, rum: Math.random() < 0.4 ? 1 : 0 }, 'A hidden cache'); if (Math.random() < 0.3) { s.bombs = Math.min(6, s.bombs + 1); game.toast('And a powder flask.', 'gold'); } game.emit('chest', {}); }; } };
      if (q.type === 'castaway') return { label: 'Help the castaway', icon: 'talk', run: () => { q.done = true; audio.good(); const roll = Math.random(); if (roll < 0.4 && s.maps.length < 3) { const i2 = pick(ISLANDS.filter((i) => i.kind !== 'hideout')); s.maps.push({ island: i2.id, spot: Math.random() < 0.5 ? 0 : 1, tier: 2 }); game.toast(`"Bless you. Take this: I buried it on ${i2.name}." You get a treasure map.`, 'gold'); } else { game.reward({ gold: Math.round(rand(50, 120)), xp: 30 }, '"Bless you, Captain." He presses his last coins on you'); } s.rep.guild = Math.min(100, s.rep.guild + 3); } };
      if (q.type === 'shrine') return { label: 'Touch the idol', sub: 'It hums faintly', icon: 'talk', run: () => { q.done = true; if (Math.random() < 0.65) { s.bless = Date.now() + 10 * 60000; audio.good(); fx.sparks(q.x, p.y + 2.6, q.z, 24, 0x9fe0d0); game.toast('The idol warms. Your blade bites 25% deeper for ten minutes.', 'gold'); } else { audio.bad(); game.toast('The ground splits. The dead take offence.', 'warn'); for (let i = 0; i < 3; i++) { const a = makeActor('skeleton', q.x + Math.sin(i * 2.1) * 4, q.z + Math.cos(i * 2.1) * 4, 1, 1 + 0.07 * (s.level - 1)); a.state = 'rise'; a.t = 0; } } } };
    }
    const danger = land.actors.some((a) => a.alive && a.team === 1 && a.state !== 'idle' && a.state !== 'buried' && dist2(a.x, a.z, p.x, p.z) < 14);
    for (const n of isl.npcs) if (dist2(p.x, p.z, n.x, n.z) < 3.4) return { label: 'Talk', sub: `${n.name}, ${n.role}`, icon: 'talk', run: () => game.ui.openTown(isl, n) };
    for (const ch of land.chests) if (!ch.open && dist2(p.x, p.z, ch.c.x, ch.c.z) < 2.6) return danger ? { label: 'Enemies near', icon: 'chest', run: () => game.toast('Deal with them first', 'dim') } : { label: ch.c.vault ? 'Break vault' : 'Open chest', icon: 'chest', run: () => openChest(ch) };
    for (const m of s.maps) if (m.island === isl.id) {
      const d = isl.digs[m.spot];
      if (dist2(p.x, p.z, d.x, d.z) < 3.2) return { label: 'Dig', icon: 'dig', run: () => { p.state = 'dig'; p.t = 0; p.digDone = () => { s.maps.splice(s.maps.indexOf(m), 1); s.stats.dug++; land.mounds.forEach((x) => scene.remove(x)); const t = m.tier; audio.good(); fx.sparks(p.x, p.y + 0.6, p.z, 20, 0xffd978); game.reward({ gold: Math.round(rand(220, 320) * t), iron: 12 * t, timber: 12 * t, xp: 60 * t, rum: 1 }, 'Buried treasure!'); game.emit('dig', { island: isl.id }); }; } };
    }
    if (dist2(p.x, p.z, isl.boat.x, isl.boat.z) < 6 || dist2(p.x, p.z, isl.landing.x, isl.landing.z) < 3.5) return { label: 'Set sail', icon: 'anchor', run: () => game.setSail() };
    for (const pl of isl.plots) if (dist2(p.x, p.z, pl.x, pl.z) < 6.5) return { label: s.base.b[pl.id] ? 'Upgrade' : 'Build', sub: BUILDINGS[pl.id].name, icon: 'build', run: () => game.ui.openBuild(pl.id) };
    return null;
  };
  // how close is the nearest map mark (for the "getting warmer" hint)
  land.digHint = () => { const p = land.player, isl = land.isl; if (!isl) return null; let best = null; for (const m of game.save.maps) if (m.island === isl.id) { const d = dist2(p.x, p.z, isl.digs[m.spot].x, isl.digs[m.spot].z); if (best === null || d < best) best = d; } return best; };

  land.update = (dt) => {
    const p = land.player;
    if (land.boarding) for (const pl of land.boarding.plats) pl.top = (pl.ship.y || 0) + pl.ship.model.deckY;
    if (land.kind === 'deck') rideDeck(true);
    updatePlayer(dt);
    if (land.kind === 'deck') rideDeck(false);
    for (const a of land.actors) updateFoe(a, dt);
    updatePet(dt); updateBombs(dt); updateTorch(dt);
    // chance encounters reveal themselves only when you are close; ambushers spring out
    for (const q of land.pois) {
      if (q.done) continue; const d = dist2(p.x, p.z, q.x, q.z);
      if (!q.seen && d < 30 && q.type !== 'ambush') { q.seen = true; game.toast({ cache: 'Something glints nearby.', castaway: 'Someone is calling for help nearby.', shrine: 'An old idol stands nearby.' }[q.type], 'dim'); }
      if (q.type === 'ambush' && d < 11) { q.done = true; game.toast('Ambush!', 'warn'); audio.bad(); const lv = 1 + 0.07 * (game.save.level - 1), boss = Math.random() < 0.3; for (let i = 0; i < 3; i++) { const a = makeActor(boss && i === 0 ? 'chief' : i === 2 ? 'marksman' : 'brigand', q.x + Math.sin(i * 2.1) * 5, q.z + Math.cos(i * 2.1) * 5, 1, lv); a.state = 'chase'; } }
      if (q.type === 'cache' && q.seen && Math.random() < dt * 3) fx.sparks(q.x, heightAt(q.x, q.z) + 0.5, q.z, 1, 0xffe9a0);
    }
    // keep bodies from overlapping
    const all = land.actors.filter((a) => a.alive && a.state !== 'buried'); all.push(p);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], d = dist2(a.x, a.z, b.x, b.z), m = a.radius + b.radius;
      if (d < m && d > 0.001) { const k = ((m - d) / d) * 0.5, dx = (a.x - b.x) * k, dz = (a.z - b.z) * k, wa = a.def.boss ? 0 : 1, wb = b.def.boss ? 0 : 1; if (!(a.isPlayer && a.state === 'roll') && !(b.isPlayer && b.state === 'roll')) { walk(a, dx * wa, dz * wa); walk(b, -dx * wb, -dz * wb); } }
    }
    land.actors = land.actors.filter((a) => !a.gone);
    for (const ch of land.chests) if (ch.open) ch.mesh.userData.lid.rotation.x = damp(ch.mesh.userData.lid.rotation.x, -1.9, 6, dt);
    if (land.boarding && !land.boarding.won && p.alive && !land.actors.some((a) => a.alive && a.team === 1)) { land.boarding.won = true; land.boarding.t = 0; audio.good(); }
    if (land.boarding && land.boarding.won) { land.boarding.t += dt; if (land.boarding.t > 1.3 && !land.boarding.done) { land.boarding.done = true; game.boardingWon(land.boarding.enemy); } }
  };
  land.respawn = () => { const isl = land.isl; land.enter(isl); const loss = deathTax(game.save); return loss; };
  land.grant = grant; land.pick = pick; land.refreshBase = () => refreshBase(game.world, game.save); land.SWORDS = SWORDS; land.ISLANDS = ISLANDS;
  return land;
}
