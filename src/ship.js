// Ship models (lofted hull, masts, sails, guns) and the sailing physics shared by player and AI ships.
import * as THREE from 'three';
import { clamp, damp, smooth, waveHeight, wrapAngle } from './util.js';
import { Mesher, MAT_2S, box, cyl, soup, paint } from './geo.js';
import { heightAt } from './world.js';
import { staticFigure } from './character.js';
import { WORLD_R } from './data.js';

export const STYLES = {
  player: { hull: 0x40301f, trim: 0x9a772f, sail: 0xd9cdb0, flag: 0x121212 },
  pirate: { hull: 0x2a2420, trim: 0x6b1c18, sail: 0x74241f, flag: 0x8a1f1a },
  merchant: { hull: 0x5f4a34, trim: 0xb9a77c, sail: 0xcfc3a2, flag: 0xb58a2e },
  navy: { hull: 0x2b3038, trim: 0xcfc8b0, sail: 0xe3ddcc, flag: 0x27406b },
  ghost: { hull: 0x6a8f84, trim: 0x9fe0c8, sail: 0x9fd8c4, flag: 0x9fe0c8 },
};
const GHOST_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 0.8, emissive: 0x1d5446 });
const flagTex = new Map();
// Flags are drawn to small canvases: faction colours, a white flag, and the player's own design.
export function flagTexture(kind, jolly) {
  const key = kind === 'pirate' ? `p:${jolly.field}:${jolly.emblem}` : kind; let t = flagTex.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = 96; c.height = 64; const x = c.getContext('2d');
  const fill = (col) => { x.fillStyle = col; x.fillRect(0, 0, 96, 64); };
  if (kind === 'navy') { fill('#27406b'); x.fillStyle = '#e6e0cf'; x.fillRect(0, 25, 96, 14); x.fillRect(38, 0, 16, 64); x.fillStyle = '#a3261f'; x.fillRect(0, 29, 96, 6); x.fillRect(43, 0, 6, 64); }
  else if (kind === 'merchant') { for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#e0d6bb' : '#b58a2e'; x.fillRect(0, i * 16, 96, 16); } x.fillStyle = '#2a3f55'; x.fillRect(0, 0, 36, 32); }
  else if (kind === 'bloodwater') { fill('#7d1f1a'); x.fillStyle = '#120c0b'; x.beginPath(); x.moveTo(48, 8); x.quadraticCurveTo(70, 40, 48, 54); x.quadraticCurveTo(26, 40, 48, 8); x.fill(); }
  else if (kind === 'white') fill('#ece8dc');
  else if (kind === 'ghost') fill('#9fe0c8');
  else {
    const F = { black: '#141414', blood: '#7d1f1a', sea: '#1f4a4f', bone: '#d9cdb0' }[jolly.field] || '#141414', ink = jolly.field === 'bone' ? '#141414' : '#e6dcc2';
    fill(F); x.fillStyle = ink; x.strokeStyle = ink; x.lineWidth = 6; x.lineCap = 'round';
    const line = (a, b, c2, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); };
    if (jolly.emblem === 'swords') { line(26, 52, 70, 12); line(70, 52, 26, 12); x.lineWidth = 4; line(28, 38, 40, 50); line(68, 38, 56, 50); }
    else if (jolly.emblem === 'hourglass') { x.beginPath(); x.moveTo(30, 10); x.lineTo(66, 10); x.lineTo(48, 32); x.lineTo(66, 54); x.lineTo(30, 54); x.lineTo(48, 32); x.closePath(); x.fill(); }
    else if (jolly.emblem === 'crown') { x.beginPath(); x.moveTo(26, 48); x.lineTo(26, 20); x.lineTo(37, 34); x.lineTo(48, 14); x.lineTo(59, 34); x.lineTo(70, 20); x.lineTo(70, 48); x.closePath(); x.fill(); x.strokeStyle = F; x.lineWidth = 3; line(50, 14, 44, 30); line(44, 30, 52, 48); }
    else { line(28, 58, 68, 42); line(28, 42, 68, 58); x.beginPath(); x.arc(48, 24, 15, 0, 7); x.fill(); x.fillRect(39, 32, 18, 12); x.fillStyle = F; x.beginPath(); x.arc(42, 24, 4, 0, 7); x.arc(54, 24, 4, 0, 7); x.fill(); x.fillRect(46, 31, 4, 5); }
  }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; flagTex.set(key, t); return t;
}
const FACTION_FLAG = { pirate: 'bloodwater', merchant: 'merchant', navy: 'navy', ghost: 'ghost' };
const sailGeos = new Map();
function sailGeo(w, h) {
  const key = `${w.toFixed(1)}:${h.toFixed(1)}`; let g = sailGeos.get(key);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h, 4, 3).toNonIndexed(); g.translate(0, -h / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5, v = -p.getY(i) / h; p.setZ(i, Math.sin(u * Math.PI) * (0.25 + Math.sin(v * Math.PI) * 0.75) * w * 0.16); p.setX(i, p.getX(i) * (0.86 + 0.14 * v)); }
    g.deleteAttribute('uv'); g.computeVertexNormals(); paint(g, 0xffffff, 0.07); sailGeos.set(key, g);
  }
  return g;
}

export function buildShipModel(cls, style, opts = {}) {
  const L = cls.len, B = cls.beam, fb = 1.25 + B * 0.13, draft = 0.9 + B * 0.1, deckY = fb - 0.72, S = 14;
  const hb = (t) => (B / 2) * (t < 0.22 ? 0.66 + 0.34 * smooth(0, 0.22, t) : t < 0.55 ? 1 : 1 - Math.pow((t - 0.55) / 0.45, 1.9));
  const gy = (t) => fb + (t < 0.4 ? 1.0 * Math.pow((0.4 - t) / 0.4, 2) : 0.8 * Math.pow((t - 0.4) / 0.6, 2));
  const ring = (t) => { const h = hb(t), k = -draft * (1 - smooth(0.72, 1, t)), g = gy(t); return [[0, k], [h * 0.68, k * 0.55], [h * 0.98, 0.3], [h, g - 0.5], [h, g]]; };
  const z = (t) => (t - 0.5) * L;
  const strips = [[], [], [], []], deck = [];
  for (let i = 0; i < S; i++) {
    const t0 = i / S, t1 = (i + 1) / S, a = ring(t0), b = ring(t1), z0 = z(t0), z1 = z(t1);
    for (let k = 0; k < 4; k++) for (const sx of [1, -1]) {
      const p = [sx * a[k][0], a[k][1], z0], q = [sx * a[k + 1][0], a[k + 1][1], z0], r = [sx * b[k + 1][0], b[k + 1][1], z1], s = [sx * b[k][0], b[k][1], z1];
      strips[k].push(p, q, r, p, r, s);
    }
    const w0 = hb(t0) * 0.985, w1 = hb(t1) * 0.985;
    deck.push([-w0, deckY, z0], [w0, deckY, z0], [w1, deckY, z1], [-w0, deckY, z0], [w1, deckY, z1], [-w1, deckY, z1]);
  }
  const m = new Mesher(), st = ring(0), tar = 0x1b1816;
  const transom = [];
  for (let k = 0; k < 4; k++) transom.push([st[k][0], st[k][1], z(0)], [-st[k][0], st[k][1], z(0)], [-st[k + 1][0], st[k + 1][1], z(0)], [st[k][0], st[k][1], z(0)], [-st[k + 1][0], st[k + 1][1], z(0)], [st[k + 1][0], st[k + 1][1], z(0)]);
  m.add(soup(strips[0]), tar, undefined, undefined, 1, 0.05); m.add(soup(strips[1]), tar, undefined, undefined, 1, 0.08);
  m.add(soup(strips[2]), style.hull, undefined, undefined, 1, 0.1); m.add(soup(strips[3]), style.trim, undefined, undefined, 1, 0.06);
  m.add(soup(transom), style.hull, undefined, undefined, 1, 0.08); m.add(soup(deck), 0x93795a, undefined, undefined, 1, 0.09);
  // quarterdeck, stern windows, lantern, wheel
  const qd = L * 0.2, qw = B * 0.74;
  m.add(box(qw, 1.25, qd), 0x80684c, [0, deckY + 0.6, z(0) + qd / 2 + 0.1], [0, 0, 0], 1, 0.08);
  for (let i = -1; i <= 1; i++) m.add(box(0.7, 0.55, 0.1), 0xffc66e, [i * qw * 0.3, deckY + 0.55, z(0) - 0.03], [0, 0, 0], 1, 0);
  m.add(box(0.3, 0.5, 0.3), 0xffc66e, [0, gy(0) + 0.9, z(0) + 0.1], [0, 0, 0], 1, 0); m.add(cyl(0.04, 0.04, 0.9, 4), 0x2b2d30, [0, gy(0) + 0.3, z(0) + 0.1]);
  m.add(cyl(0.5, 0.5, 0.08, 8), 0x4a3828, [0, deckY + 2.0, z(0) + qd * 0.75], [Math.PI / 2, 0, 0]); m.add(box(0.14, 0.9, 0.14), 0x4a3828, [0, deckY + 1.6, z(0) + qd * 0.75 - 0.15]);
  // bowsprit
  m.add(cyl(0.1, 0.16, L * 0.3, 5), 0x4a3828, [0, gy(1) + 0.75, z(1) + L * 0.08], [1.2, 0, 0]);
  // guns
  const gunZ = [], guns = opts.guns ?? cls.guns;
  for (let i = 0; i < guns; i++) {
    const t = 0.3 + (guns === 1 ? 0.2 : (i / (guns - 1)) * 0.42), gz = z(t), w = hb(t); gunZ.push({ z: gz, x: w });
    for (const sx of [1, -1]) { m.add(cyl(0.13, 0.18, 1.3, 6), 0x202224, [sx * (w - 0.1), deckY + 0.5, gz], [0, 0, sx * -Math.PI / 2]); m.add(box(0.7, 0.3, 0.6), 0x4a3828, [sx * (w - 0.7), deckY + 0.22, gz]); }
  }
  // masts, yards, shrouds
  const mastT = cls.masts === 1 ? [0.56] : cls.masts === 2 ? [0.38, 0.69] : [0.25, 0.5, 0.75];
  const sails = [], mastTop = [];
  mastT.forEach((t, i) => {
    const mid = i === Math.floor(mastT.length / 2) || cls.masts === 1, h = L * (mid ? 0.98 : 0.84) + 2, mz = z(t);
    m.add(cyl(0.11, 0.24, h, 6), 0x4a3828, [0, deckY + h / 2, mz]); mastTop.push([0, deckY + h, mz]);
    m.add(cyl(0.5, 0.42, 0.3, 7), 0x3a2e24, [0, deckY + h * 0.62, mz]);
    const w1 = B * 1.5, h1 = h * 0.4, w2 = B * 1.15, h2 = h * 0.27, y1 = deckY + h * 0.58, y2 = deckY + h * 0.92;
    for (const [w, y] of [[w1, y1], [w2, y2]]) m.add(cyl(0.07, 0.07, w * 1.04, 5), 0x3a2e24, [0, y, mz + 0.3], [0, 0, Math.PI / 2]);
    sails.push({ w: w1, h: h1, y: y1 - 0.1, z: mz + 0.36 }, { w: w2, h: h2, y: y2 - 0.1, z: mz + 0.36 });
    for (const sx of [1, -1]) m.add(soup([[0, deckY + h * 0.6, mz], [sx * hb(t), gy(t), mz - 1.4], [sx * hb(t), gy(t), mz - 0.2]]), 0x1c1917);
  });
  const hullMesh = new THREE.Mesh(m.build(), style === STYLES.ghost ? GHOST_MAT : MAT_2S);
  const group = new THREE.Group(); group.rotation.order = 'YXZ'; group.add(hullMesh);
  const sailMat = new THREE.MeshLambertMaterial({ color: style.sail, vertexColors: true, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: style === STYLES.ghost ? 0.75 : 1, emissive: style === STYLES.ghost ? 0x1d5446 : 0 });
  const sailMeshes = sails.map((s) => { const sm = new THREE.Mesh(sailGeo(s.w, s.h), sailMat); sm.position.set(0, s.y, s.z); sm.renderOrder = 2; group.add(sm); return sm; });
  // jib
  const fm = mastTop[mastTop.length - 1], jib = new THREE.Mesh(paint(soup([[0, fm[1] * 0.86, fm[2] + 0.3], [0.5, gy(1) + 1.6, z(1) + L * 0.17], [0.2, deckY + 2.2, fm[2] + 1.2]]), 0xffffff, 0), sailMat);
  group.add(jib);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2).translate(-1.7, 0, 0), new THREE.MeshLambertMaterial({ map: flagTexture(opts.flag || FACTION_FLAG[opts.faction] || 'white', opts.jolly), side: THREE.DoubleSide }));
  jib.renderOrder = 2;
  const top = mastTop[Math.floor(mastTop.length / 2)]; flag.position.set(0, top[1] - 1.2, top[2]); flag.rotation.y = Math.PI / 2; group.add(flag);
  if (opts.crew !== false) {
    const looks = { player: ['crew', 'crew'], pirate: ['brigand', 'brigand'], merchant: ['crew', 'wright'], navy: ['soldier', 'soldier'], ghost: ['skeleton', 'skeleton'] }[opts.faction || 'player'];
    looks.forEach((lk, i) => { const f = staticFigure(lk); f.position.set((i ? 1 : -1) * B * 0.22, deckY, z(0.45 + i * 0.22)); f.rotation.y = i ? 1.2 : -1.5; group.add(f); });
    const helm = staticFigure(opts.faction === 'player' || !opts.faction ? 'player' : looks[0]); helm.position.set(0, deckY + 1.22, z(0) + qd * 0.75 - 0.75); group.add(helm);
    if (opts.faction === 'player' || !opts.faction) group.userData.helm = helm;
  }
  return { group, sailMeshes, jib, flag, sailMat, gunZ, deckY, fb, hb, L, B };
}

export class Ship {
  constructor(cls, style, o = {}) {
    this.cls = cls; this.model = buildShipModel(cls, style, o); this.group = this.model.group;
    this.x = o.x || 0; this.z = o.z || 0; this.heading = o.heading || 0; this.speed = 0; this.rudder = 0; this.sail = 0; this.sailVis = 0;
    this.maxSpeed = o.speed || cls.speed; this.turnRate = o.turn || cls.turn; this.maxHp = o.hp || cls.hp; this.hp = this.maxHp;
    this.alive = true; this.sinkT = 0; this.reload = { 1: 0, [-1]: 0 }; this.pitch = 0; this.roll = 0; this.aground = false; this.frozen = false; this.lean = 0;
    this.radius = cls.len * 0.5; this.sailHp = 1; this.burn = 0;
  }
  get fx() { return Math.sin(this.heading); }
  get fz() { return Math.cos(this.heading); }
  // world position of a point given in ship space (lx to port, lz forward)
  at(lx, lz) { const s = this.fx, c = this.fz; return [this.x + s * lz + c * lx, this.z + c * lz - s * lx]; }
  // ship-space coordinates of a world point
  local(x, z) { const dx = x - this.x, dz = z - this.z, s = this.fx, c = this.fz; return [dx * c - dz * s, dx * s + dz * c]; }
  update(dt, time) {
    const g = this.group, len = this.cls.len, beam = this.cls.beam;
    if (!this.alive) {
      this.sinkT += dt; this.speed = damp(this.speed, 0, 1, dt);
      this.x += this.fx * this.speed * dt; this.z += this.fz * this.speed * dt;
      g.position.set(this.x, waveHeight(this.x, this.z, time) * 0.4 - this.sinkT * this.sinkT * 0.22, this.z);
      g.rotation.set(this.pitch - this.sinkT * 0.07, this.heading, this.roll + this.sinkT * 0.11);
      return;
    }
    if (!this.frozen) {
      const target = this.maxSpeed * this.sail * (0.45 + 0.55 * clamp(this.hp / this.maxHp + 0.3, 0, 1)) * (0.3 + 0.7 * this.sailHp);
      this.speed = damp(this.speed, target, target > this.speed ? 0.42 : 0.6, dt);
      const turn = this.turnRate * (0.55 + 0.45 * this.sailHp) * this.rudder * (0.28 + 0.72 * clamp(this.speed / this.maxSpeed, 0, 1));
      this.heading = wrapAngle(this.heading - turn * dt); this.lean = damp(this.lean, turn * 0.22, 2, dt);
      let nx = this.x + this.fx * this.speed * dt, nz = this.z + this.fz * this.speed * dt;
      // run aground?
      const bx = nx + this.fx * len * 0.45, bz = nz + this.fz * len * 0.45;
      this.aground = false;
      if (heightAt(bx, bz) > -1.7) { this.aground = true; this.speed = Math.min(this.speed, 0) - 1.5; nx = this.x - this.fx * 2.5 * dt; nz = this.z - this.fz * 2.5 * dt; }
      else if (heightAt(nx, nz) > -1.7) { this.aground = true; this.speed *= 0.5; }
      const d = Math.hypot(nx, nz); if (d > WORLD_R) { nx *= WORLD_R / d; nz *= WORLD_R / d; this.edge = true; } else this.edge = false;
      this.x = nx; this.z = nz;
    } else this.speed = 0;
    const hb = waveHeight(this.x + this.fx * len * 0.4, this.z + this.fz * len * 0.4, time), hs = waveHeight(this.x - this.fx * len * 0.4, this.z - this.fz * len * 0.4, time);
    const hp = waveHeight(this.x + this.fz * beam * 0.5, this.z - this.fx * beam * 0.5, time), hq = waveHeight(this.x - this.fz * beam * 0.5, this.z + this.fx * beam * 0.5, time);
    const k = this.frozen ? 0.25 : 0.6;
    this.pitch = damp(this.pitch, -Math.atan2(hb - hs, len * 0.8) * k, 3, dt); this.roll = damp(this.roll, Math.atan2(hp - hq, beam) * k * 0.7 + this.lean, 3, dt);
    this.y = (hb + hs + hp + hq) * 0.25 * (this.frozen ? 0.25 : 0.55);
    g.position.set(this.x, this.y, this.z); g.rotation.set(this.pitch, this.heading, this.roll);
    this.sailVis = damp(this.sailVis, this.sail, 2.5, dt);
    const sv = 0.16 + 0.84 * this.sailVis;
    this.model.sailMeshes.forEach((s, i) => { s.scale.y = sv; s.visible = i % 2 === 0 ? this.sailHp > 0.3 : this.sailHp > 0.62; });
    this.model.jib.visible = this.sailHp > 0.45;
    this.model.flag.rotation.y = Math.PI / 2 + Math.sin(time * 3 + this.x) * 0.25;
    for (const s of [1, -1]) if (this.reload[s] > 0) this.reload[s] -= dt;
  }
  // world-space muzzle positions for one broadside (side: 1 = port, -1 = starboard)
  muzzles(side) { return this.model.gunZ.map((g) => { const [x, z] = this.at(side * (g.x + 0.5), g.z); return { x, y: (this.y || 0) + this.model.deckY + 0.5, z }; }); }
  // which side faces a world point, and how far off the beam it is (0 = dead abeam)
  bearing(x, z) { const [lx, lz] = this.local(x, z); return { side: lx >= 0 ? 1 : -1, off: Math.abs(Math.atan2(lz, Math.abs(lx))), dist: Math.hypot(lx, lz) }; }
  hitTest(x, y, z) { if (y > (this.y || 0) + this.model.fb + 3 || y < -2) return false; const [lx, lz] = this.local(x, z); return Math.abs(lx) < this.cls.beam * 0.55 && Math.abs(lz) < this.cls.len * 0.5; }
  setFlag(kind, jolly) { this.model.flag.material.map = flagTexture(kind, jolly); this.model.flag.material.needsUpdate = true; }
  // fade the canvas so it does not block the view of a deck fight
  fadeSails(on) { const m = this.model.sailMat; m.opacity = on ? 0.16 : this.isPlayer ? 0.72 : this.faction === 'ghost' ? 0.75 : 1; m.depthWrite = !on && !this.isPlayer; }
  dispose(scene) { scene.remove(this.group); this.group.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.keep && o === this.group.children[0]) o.geometry.dispose(); }); this.model.sailMat.dispose(); }
}
