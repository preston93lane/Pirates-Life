// Entry point: renderer, camera, the frame loop, and switching between sea, shore and boarding.
import * as THREE from 'three';
import { createWorld, refreshBase, PAL, groundAt } from './world.js';
import { createFx } from './fx.js';
import { createSea } from './sea.js';
import { createLand } from './land.js';
import { createUI } from './ui.js';
import { createQuests } from './quests.js';
import { input, initInput } from './input.js';
import { audio } from './audio.js';
import { newSave, loadSave, writeSave, grant, deathTax, lookSpec, shipStats, pending, addMorale, playerStats } from './state.js';
import { setPlayerLook, staticFigure } from './character.js';
import { ISLANDS, ISLAND, RANKS, FLAGS, RANSOM, FOG_N, WORLD_R } from './data.js';
import { clamp, damp, rand, waveHeight, dist2 } from './util.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c'), root = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 1, 0.3, 1750);

const game = {
  scene, camera, renderer, input, time: 0, mode: 'sea', started: false, paused: false, ctx: null, stop: 0,
  cam: { yaw: 0, pitch: 0.3, off: 0, shake: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), lookT: 0 },
  save: loadSave() || newSave(), hadSave: false,
};
game.hadSave = !!loadSave();
game.world = createWorld(scene);
game.fx = createFx(scene, PAL.fog);
game.ui = createUI(game);
game.quests = createQuests(game);
game.sea = createSea(game);
game.land = createLand(game);
setPlayerLook(lookSpec(game.save));
window.__game = game; // handy for debugging and automated tests

game.toast = (m, t) => game.ui.toast(m, t);
game.shake = (v) => { game.cam.shake = Math.min(1.6, game.cam.shake + v); };
game.hitStop = (s) => { game.stop = Math.max(game.stop, s); };
game.emit = (evt, d) => game.quests.on(evt, d || {});
game.cheer = (d) => { const s = game.save, before = s.morale; addMorale(s, d); game.sea.refreshStats(); if (before >= 25 && s.morale < 25) game.toast('The crew are muttering. Share out some gold or rum (Menu, Command) before hands start to desert.', 'warn'); };
game.reward = (r, label) => {
  if (!r) return;
  const s = game.save, before = s.level, up = grant(s, r);
  const parts = [r.gold && `${r.gold} gold`, r.timber && `${r.timber} timber`, r.iron && `${r.iron} iron`, r.xp && `${r.xp} infamy`].filter(Boolean).join(', ');
  if (label) { game.toast(parts ? `${label}: ${parts}` : label, 'gold'); audio.coin(); }
  if (up || s.level > before) { game.ui.banner(`Rank ${s.level}`, RANKS[Math.min(RANKS.length - 1, s.level - 1)], 'Your name carries further. You have skill points to spend (Menu, Skills).'); audio.good(); game.sea.refreshStats(); if (game.land.player) game.land.player.maxHp = playerStats(s).maxHp; }
};

// ---------- mode switches ----------
let busy = false;
function fade(fn) {
  if (busy) return; busy = true; game.ui.fade(true);
  setTimeout(() => { fn(); for (const k in input.pressed) input.pressed[k] = false; setTimeout(() => { game.ui.fade(false); busy = false; }, 120); }, 340);
}
game.fade = fade;
game.goAshore = (isl) => fade(() => {
  const p = game.sea.player, a = isl.anchor;
  p.x = a.x; p.z = a.z; p.heading = a.heading; p.speed = 0; p.sail = 0; p.rudder = 0; p.frozen = true;
  game.land.enter(isl); game.mode = 'land'; game.cam.yaw = isl.land + Math.PI; game.cam.pitch = 0.3;
  game.save.seen[isl.id] = true; game.save.home = isl.kind === 'town' ? isl.id : game.save.home;
  { const s = game.save; if (isl.kind === 'town' && s.morale < 20 && s.crew.length > 1 && Math.random() < 0.6) { const h = s.crew.splice(Math.floor(Math.random() * s.crew.length), 1)[0]; game.sea.refreshStats(); game.toast(`${h.name} has had enough and slips away into ${isl.name}. Morale is too low.`, 'warn'); } }
  if (!game.save.tipLand) { game.save.tipLand = true; game.ui.hint('STRIKE to attack. Hold BLOCK just before a blow lands to parry. DODGE when the mark above a foe glows orange.', 12); }
  save();
});
game.setSail = () => fade(() => { game.land.leave(); game.mode = 'sea'; game.sea.player.frozen = false; game.cam.off = 0; game.cam.pitch = 0.3; save(); });
game.walkDeck = () => fade(() => { if (game.mode !== 'sea') return; game.land.enterDeck(); game.mode = 'deck'; game.cam.yaw = game.sea.player.heading; game.cam.pitch = 0.45; game.tip2('deck', 'You are on deck. The ship holds her course, or the first mate sails if you set one on the chart. Stand on the hatch to patch the hull. Tap Take the helm to steer again.'); });
game.takeHelm = () => fade(() => { if (game.mode !== 'deck') return; game.land.leave(); game.mode = 'sea'; game.cam.off = 0; game.cam.pitch = 0.3; });
// Pay a pilot to take you straight to a port you know.
game.fastTravel = (isl, cost) => {
  const s = game.save, sea = game.sea, p = sea.player;
  if (game.mode === 'board' || sea.kraken) return game.toast('Not in the middle of a fight.', 'warn');
  if (sea.ships.some((x) => x.alive && (x.provoked || x.hunter) && dist2(x.x, x.z, p.x, p.z) < 420)) return game.toast('Enemies are too close to slip away.', 'warn');
  if (s.gold < cost) return game.toast('Not enough gold for the pilot.', 'warn');
  fade(() => { s.gold -= cost; if (game.mode !== 'sea') game.land.leave(); game.mode = 'sea'; sea.mate = null; s.course = null; p.x = isl.anchor.x; p.z = isl.anchor.z; p.heading = isl.anchor.heading; p.speed = 0; p.sail = 0; p.frozen = false; game.cam.off = 0; game.world.tod = (game.world.tod + 0.12) % 1; sea.startEvent('none'); game.toast(`The pilot brings you in at ${isl.name}.`, 'gold'); save(); });
};
game.board = (enemy) => fade(() => { if (game.mode === 'deck') game.land.leave(); else if (game.mode !== 'sea') return; game.land.enterBoarding(enemy); game.mode = 'board'; game.cam.yaw = game.land.player.face; game.cam.pitch = 0.62; });
// Take their captain if there is a free cell in the brig.
game.capture = (sh) => {
  const s = game.save, value = RANSOM[sh.type];
  if (!value || s.hostages.length >= shipStats(s).brig) return false;
  s.hostages.push({ faction: sh.faction, from: sh.name, value: Math.round(value * (0.85 + Math.random() * 0.3)) }); return true;
};
function takeColours(sh) {
  const s = game.save, flag = { merchant: 'merchant', navy: 'navy', pirate: 'bloodwater' }[sh.faction];
  if (flag && !s.flags[flag]) { s.flags[flag] = true; game.toast(`You keep their colours. You can now fly the ${FLAGS[flag]} flag (Menu, Flags).`, 'gold'); }
}
// Boarding and winning: every scrap of loot, their flag, a prisoner if you have a cell; less infamy than sinking.
game.boardingWon = (enemy) => {
  const sea = game.sea;
  sea.takeLoot(sea.lootOf(enemy, 1.0), 'Plunder'); game.reward({ xp: sea.infamy(enemy.def.xp * 0.8) }, `${enemy.name} taken`); game.save.stats.boarded++;
  sea.offend(enemy, 'board'); takeColours(enemy); game.emit('board', {}); game.cheer(6);
  if (game.capture(enemy)) game.toast('Their captain goes in irons in your brig. Ransom him at a tavern.', 'gold');
  setTimeout(() => fade(() => {
    game.land.leave(); game.mode = 'sea'; enemy.hp = 0; enemy.alive = false; if (sea.target === enemy) sea.target = null;
    game.emit('sink', { faction: enemy.faction, type: enemy.type }); if (enemy.def.boss) { game.save.bosses[enemy.type] = Date.now(); game.emit('boss', { boss: enemy.type }); }
    save();
  }), 900);
};
// A ship that struck her colours: spare her, take a prisoner too, or send her down anyway.
game.prize = (sh, how) => {
  const sea = game.sea;
  if (how === 'sink') { sea.sink(sh, sea.player); return; }
  sea.takeLoot(sea.lootOf(sh, 0.8), 'Prize cargo'); game.reward({ xp: sea.infamy(sh.def.xp * 0.5) }, `${sh.name} yielded`); takeColours(sh); game.cheer(3);
  if (how === 'prisoner' && game.capture(sh)) { sea.offend(sh, 'board'); game.toast('Their captain goes in irons in your brig.', 'gold'); } else sea.offend(sh, 'spare');
  sh.surrendered = false; sh.released = true; sh.provoked = false; sh.sail = 1; if (sea.target === sh) sea.target = null;
  game.emit('sink', { faction: sh.faction, type: sh.type }); save();
};
game.setFlag = (kind) => { const s = game.save; s.flag = kind; game.sea.player.setFlag(kind, s.jolly); for (const sh of game.sea.ships) sh.sus = 0; };
// fog of war on the chart
game.fog = new Uint8Array(FOG_N * FOG_N);
game.reveal = (x, z, r) => {
  const cell = (WORLD_R * 2) / FOG_N, n = Math.ceil(r / cell);
  const cx = Math.floor((x + WORLD_R) / cell), cz = Math.floor((z + WORLD_R) / cell);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const gx = cx + i, gz = cz + j; if (gx < 0 || gz < 0 || gx >= FOG_N || gz >= FOG_N) continue; if (Math.hypot(i, j) * cell <= r + cell * 0.5) game.fog[gz * FOG_N + gx] = 1; }
};
// Losing twice in a row quietly softens enemy blows for a while, so a bad run does not become a wall.
const mercy = () => { const s = game.save, before = Math.floor(s.mercy || 0); s.mercy = Math.min(3, (s.mercy || 0) + 1); if (Math.floor(s.mercy) > before && s.mercy >= 2) game.toast('The sea goes a little easier on you for now.', 'dim'); };
game.tip2 = (id, text, secs = 12) => { const s = game.save; if (s.tips[id]) return; s.tips[id] = true; setTimeout(() => game.ui.hint(text, secs), 700); };
game.tip = (id, text, secs = 10) => { const s = game.save; if (s.tips[id] || game.mode !== 'sea') return; s.tips[id] = true; game.ui.hint(text, secs); };
game.playerFell = () => setTimeout(() => fade(() => {
  mercy(); game.cheer(-5); const loss = deathTax(game.save);
  if (game.mode === 'board') {
    const e = game.land.boarding.enemy, p = game.sea.player; game.land.leave(); game.mode = 'sea';
    p.hp = Math.max(10, p.hp - p.maxHp * 0.25); [p.x, p.z] = p.at(0, -120); e.provoked = true;
    game.toast(`Your crew drags you back aboard and cuts the lines. Lost ${loss} gold.`, 'warn');
  } else { game.land.enter(game.land.isl); game.toast(`You wake on the beach, lighter by ${loss} gold.`, 'warn'); }
}), 1700);
game.playerSunk = () => setTimeout(() => fade(() => {
  if (game.mode === 'deck') { game.land.leave(); game.mode = 'sea'; }
  mercy(); addMorale(game.save, -12); const s = game.save, loss = deathTax(s), home = ISLAND[s.home || 'saltmere'], sea = game.sea;
  for (const g in s.cargo) s.cargo[g] = Math.floor(s.cargo[g] / 2);
  s.ship.hp = 0.6; s.pos = { x: home.anchor.x, z: home.anchor.z, h: home.anchor.heading };
  game.scene.remove(sea.player.group); sea.player = null; sea.makePlayer(); sea.target = null; game.cam.off = 0; game.land.dockPet(); if (sea.kraken) { for (const a of sea.kraken.arms) scene.remove(a.root); sea.kraken = null; } sea.startEvent && sea.event && sea.startEvent('none');
  game.toast(`Your ship went down. Fishermen pulled you out near ${home.name}. Lost ${loss} gold and half your cargo.`, 'warn'); save();
}), 2600);
game.swapShip = () => { const sea = game.sea, isl = game.land.isl; sea.makePlayer(); const p = sea.player; if (isl) { p.x = isl.anchor.x; p.z = isl.anchor.z; p.heading = isl.anchor.heading; p.frozen = true; } if (!game.land.kind) game.land.dockPet(); };
game.applyLook = () => { setPlayerLook(lookSpec(game.save)); game.land.refreshLook(); const helm = game.sea.player.group.userData.helm; if (helm) { const f = staticFigure('player'); helm.geometry.dispose(); helm.geometry = f.geometry; } };
game.restore = (s) => { game.ui.close(); const sea = game.sea; if (game.mode !== 'sea') game.land.leave(); for (const sh of sea.ships) scene.remove(sh.group); sea.ships = []; for (const l of sea.loot) scene.remove(l.mesh); sea.loot = []; game.mode = 'sea'; begin(s); save(); game.toast('Voyage restored from your backup code.', 'gold'); };
game.restart = () => { game.ui.close(); const sea = game.sea; if (game.mode !== 'sea') game.land.leave(); for (const s of sea.ships) scene.remove(s.group); sea.ships = []; for (const l of sea.loot) scene.remove(l.mesh); sea.loot = []; game.mode = 'sea'; begin(newSave()); game.started = false; game.hadSave = false; game.ui.showTitle(false); };

function save() {
  const s = game.save, p = game.sea.player;
  if (p && p.alive) { s.pos = { x: p.x, z: p.z, h: p.heading }; s.ship.hp = clamp(p.hp / p.maxHp, 0.05, 1); }
  s.fog = Array.from(game.fog).join(''); s.tod = game.world.tod;
  writeSave(s);
}
function begin(s) {
  game.save = s; const sea = game.sea; setPlayerLook(lookSpec(s));
  game.world.tod = s.tod ?? 0.42;
  game.fog.fill(0); for (let i = 0; i < s.fog.length && i < game.fog.length; i++) game.fog[i] = s.fog[i] === '1' ? 1 : 0;
  for (const id in s.seen) if (ISLAND[id]) game.reveal(ISLAND[id].x, ISLAND[id].z, ISLAND[id].r + 120);
  if (sea.player) { scene.remove(sea.player.group); sea.player = null; }
  game.setGfx();
  sea.makePlayer(); game.land.refreshLook(); game.land.setPet(); refreshBase(game.world, s); game.quests.begin(); game.ui.dirty = true; game.ui.setMute(); game.cam.off = 0;
}

// ---------- camera ----------
function updateCamera(dt) {
  const c = game.cam, lx = input.look.x, ly = input.look.y; input.look.x = input.look.y = 0;
  if (lx || ly) c.lookT = 2.5; else c.lookT -= dt;
  let tx, ty, tz, dist;
  if (!game.started) { const p = game.sea.player; c.off += dt * 0.06; c.yaw = p.heading + 2.3 + c.off; c.pitch = 0.16; tx = p.x; ty = 5; tz = p.z; dist = 46; }
  else if (game.mode === 'sea') {
    const p = game.sea.player; c.off -= lx * 0.006; c.pitch = clamp(c.pitch + ly * 0.004, 0.1, 1.0);
    c.yaw = p.heading + c.off; tx = p.x; ty = 5 + p.cls.len * 0.1; tz = p.z; dist = 24 + p.cls.len * 1.15;
  } else if (game.mode === 'deck' && game.land.gun) { // looking along the barrel
    const g = game.land.gun, sh = game.sea.player, mz = sh.muzzles(g.side)[g.i];
    g.aim = clamp(g.aim - lx * 0.004, -0.6, 0.6); g.range = clamp(g.range - ly * 0.35, 25, 150);
    c.yaw = g.face; c.pitch = 0.3; tx = mz.x; ty = mz.y + 1.2; tz = mz.z; dist = 6.5;
  } else {
    const p = game.land.player; c.yaw -= lx * 0.007; c.pitch = clamp(c.pitch + ly * 0.004, 0.05, 1.1);
    if (c.lookT <= 0 && p.alive) c.yaw -= input.move.x * 1.15 * dt;
    tx = p.x; ty = p.y + 1.55; tz = p.z; dist = game.mode === 'board' ? 15 : game.mode === 'deck' ? 12 : 8;
  }
  const k = game.started ? 1 - Math.exp(-12 * dt) : 1;
  c.look.x += (tx - c.look.x) * k; c.look.y += (ty - c.look.y) * k; c.look.z += (tz - c.look.z) * k;
  if (Math.abs(tx - c.look.x) > 60) c.look.set(tx, ty, tz);
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  let x = c.look.x - Math.sin(c.yaw) * cp * dist, y = c.look.y + sp * dist, z = c.look.z - Math.cos(c.yaw) * cp * dist;
  const floor = Math.max(groundAt(x, z) + 0.9, waveHeight(x, z, game.time) + 1.2);
  if (y < floor) y = floor;
  if (c.shake > 0.001) { const s = c.shake * 0.5; x += rand(-s, s); y += rand(-s, s); z += rand(-s, s); c.shake = damp(c.shake, 0, 7, dt); }
  camera.position.set(x, y, z); camera.lookAt(c.look.x, c.look.y + (game.mode === 'sea' ? 0 : 0.2), c.look.z);
}

// ---------- sizing ----------
let pr = Math.min(window.devicePixelRatio || 1, 2), slow = 0, fast = 0;
game.setGfx = (v) => { if (v) game.save.gfx = v; const g = game.save.gfx; pr = g === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2); game.fx.thin = g === 'low'; slow = 0; resize(); };
function resize() {
  const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 76 : 58; camera.updateProjectionMatrix();
  game.fx.setScale((h * pr) / (2 * Math.tan((camera.fov * Math.PI) / 360)));
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.ResizeObserver) new ResizeObserver(resize).observe(root);

// ---------- frame loop ----------
let last = performance.now(), saveT = 0, moodT = 0;
// pick the tune that fits the moment, and scatter a few ship and shore sounds
function soundscape(dt) {
  moodT -= dt; if (moodT > 0) return; moodT = 1.2;
  const sea = game.sea, land = game.land, m = game.mode, t = sea.target;
  const fight = m === 'board' || sea.kraken || (m !== 'sea' && m !== 'deck' && land.player && land.player.combat > 0) || ((m === 'sea' || m === 'deck') && t && t.def && (t.provoked || t.hunter) && !t.surrendered);
  audio.mood(fight ? 'battle' : m === 'land' && land.isl && land.isl.kind === 'town' && !land.cave ? 'town' : game.world.night > 0.6 || land.cave ? 'night' : 'sail');
  if ((m === 'sea' || m === 'deck') && Math.random() < 0.22) audio.creak();
  if (game.world.night < 0.3 && !land.cave && Math.random() < 0.07) audio.gull();
}
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.1, (now - last) / 1000); last = now;
  // drop resolution if the device is struggling
  if (raw > 0.03) { slow++; fast = 0; } else { fast++; if (fast > 240) slow = 0; }
  if (slow > 45 && pr > 1 && game.save.gfx === 'auto') { pr = Math.max(1, pr - 0.25); slow = 0; resize(); }
  let dt = Math.min(0.05, raw);
  if (game.stop > 0) { game.stop -= raw; dt = 0; }
  const running = game.started && !game.paused && !busy;
  if (running || !game.started) game.time += dt;
  if (running) {
    const sim = dt;
    game.sea.update(sim, game.mode === 'sea' || game.mode === 'deck');
    if (game.mode !== 'sea') game.land.update(sim);
    if (game.mode === 'land') game.reveal(game.land.player.x, game.land.player.z, 200);
    game.ctx = game.mode === 'sea' ? game.sea.context() : game.land.context();
    if (input.take('ctx') && game.ctx) { audio.ui(); game.ctx.run(); }
    if (input.take('menu')) game.ui.openMenu();
    if (input.take('cmd')) game.ui.openMenu('Command');
    game.fx.dim = game.world.cave ? 0.4 : 1 - 0.45 * game.world.night;
    if (game.mode === 'sea') { input.pressed.skill = input.pressed.bomb = false; }
    if (game.mode !== 'sea') { input.pressed.sailUp = input.pressed.sailDown = input.pressed.ammo = input.pressed.swivel = false; }
    game.ui.update(raw); soundscape(raw);
    saveT += raw; if (saveT > 15) { saveT = 0; save(); }
  } else if (!game.started) game.sea.update(dt, false);
  game.fx.update(dt);
  updateCamera(raw);
  game.world.update(game.started && game.paused ? 0 : dt, camera.position);
  renderer.render(scene, camera);
}

// ---------- boot ----------
initInput($('touch'), $('stick'), $('knob'));
begin(game.save);
resize();
game.ui.showTitle(game.hadSave);
// Fill the whole screen where the browser allows it (not iPhone Safari, and not inside an embedding page).
game.goFull = (tell) => { try { const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; if (!f) { if (tell) game.toast('This browser cannot go full screen. Add the game to your Home Screen instead.', 'warn'); return; } const r = f.call(el); if (r && r.then) r.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ } }).catch(() => { if (tell) game.toast('Full screen is blocked here. Open the game at its own address.', 'warn'); }); } catch (e) { /* ignore */ } };
function start(fresh) {
  if (window.self === window.top && !window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches && !navigator.standalone) game.goFull(false);
  audio.init(game.save.muted); audio.setMusic(game.save.music !== false);
  if (fresh) begin(newSave());
  game.started = true; game.ui.hideTitle(); game.cam.off = 0; game.cam.pitch = 0.3;
  const o = game.quests.objective(); game.ui.banner(game.save.story.i ? 'Current chapter' : 'Chapter one', o.title, o.text);
  if (!fresh && game.save.story.i > 0) game.ui.openWelcome(pending(game.save));
  if (!game.save.tipSea) { game.save.tipSea = true; game.sea.player.sail = 0; setTimeout(() => game.mode === 'sea' && game.ui.hint('Left thumb steers. Tap SAIL to raise canvas. FIRE shoots the broadside that faces your target. Sail close to any island and tap Go ashore.', 14), 6000); }
  if (dist2(game.sea.player.x, game.sea.player.z, ISLANDS[0].anchor.x, ISLANDS[0].anchor.z) < 30 && game.save.story.i === 0) game.sea.spawn('pirate', { x: ISLANDS[0].anchor.x + 60, z: ISLANDS[0].anchor.z - 330 });
  save();
}
$('btnNew').addEventListener('click', () => start(true));
$('btnContinue').addEventListener('click', () => start(false));
document.addEventListener('visibilitychange', () => { if (document.hidden && game.started) save(); last = performance.now(); });
requestAnimationFrame(frame);
