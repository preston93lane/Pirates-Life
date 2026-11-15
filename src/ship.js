// Ship models (lofted hull, masts, sails, guns) and the sailing physics shared by player and AI ships.
import * as THREE from 'three';
import { clamp, damp, smooth, waveHeight, wrapAngle } from './util.js';
import { Mesher, box, cyl, cone, soup, paint, boxUV, hullMat } from './geo.js';
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

const tri = (pts) => paint(soup(pts), 0xffffff, 0.06);
export function buildShipModel(cls, style, opts = {}) {
  const L = cls.len, B = cls.beam, fat = cls.fat || 0, decks = cls.decks || 1, rig = cls.rig || 'square';
  const fb = 1.25 + B * 0.13 + (decks - 1) * 1.15, draft = 0.9 + B * 0.1, deckY = fb - 0.72, S = 16;
  const bowT = (cls.sharp ? 0.42 : 0.55) + fat * 0.12, sw = 0.66 + fat * 0.22;
  const hb = (t) => (B / 2) * (t < 0.22 ? sw + (1 - sw) * smooth(0, 0.22, t) : t < bowT ? 1 : 1 - Math.pow((t - bowT) / (1 - bowT), 1.7 + fat * 1.3));
  const castle = cls.castle ?? 1.25, fore = cls.fore || 0, qd = L * (castle > 2 ? 0.27 : 0.2), fl = fore ? L * 0.15 : 0;
  const gy = (t) => fb + (t < 0.4 ? (0.7 + castle * 0.3) * Math.pow((0.4 - t) / 0.4, 2) : (0.8 + fore * 0.35) * Math.pow((t - 0.4) / 0.6, 2));
  const ring = (t) => { const h = hb(t), k = -draft * (1 - smooth(0.72, 1, t)), g = gy(t); return [[0, k], [h * 0.68, k * 0.55], [h * 0.98, 0.3], [h * (decks > 1 ? 1.03 : 1), g - (decks > 1 ? 1.9 : 1.0)], [h, g - 0.45], [h, g]]; };
  const z = (t) => (t - 0.5) * L;
  const strips = [[], [], [], [], []], deck = [];
  for (let i = 0; i < S; i++) {
    const t0 = i / S, t1 = (i + 1) / S, a = ring(t0), b = ring(t1), z0 = z(t0), z1 = z(t1);
    for (let k = 0; k < 5; k++) for (const sx of [1, -1]) {
      const p = [sx * a[k][0], a[k][1], z0], q = [sx * a[k + 1][0], a[k + 1][1], z0], r = [sx * b[k + 1][0], b[k + 1][1], z1], s = [sx * b[k][0], b[k][1], z1];
      strips[k].push(p, q, r, p, r, s);
    }
    const w0 = hb(t0) * 0.985, w1 = hb(t1) * 0.985;
    deck.push([-w0, deckY, z0], [w0, deckY, z0], [w1, deckY, z1], [-w0, deckY, z0], [w1, deckY, z1], [-w1, deckY, z1]);
  }
  const m = new Mesher(true), st = ring(0), tar = 0x1b1816, wood = 0x4a3828, dark = 0x3a2e24, lit = 0xffc66e, gold = 0xc79a3a, iron = 0x202224;
  const transom = [];
  for (let k = 0; k < 5; k++) transom.push([st[k][0], st[k][1], z(0)], [-st[k][0], st[k][1], z(0)], [-st[k + 1][0], st[k + 1][1], z(0)], [st[k][0], st[k][1], z(0)], [-st[k + 1][0], st[k + 1][1], z(0)], [st[k + 1][0], st[k + 1][1], z(0)]);
  const cols = [style.bottom || tar, tar, style.hull, style.band || style.hull, style.trim];
  strips.forEach((sp, k) => m.add(soup(sp), cols[k], undefined, undefined, 1, 0.07));
  m.add(soup(transom), style.hull, undefined, undefined, 1, 0.08); m.add(soup(deck), 0xa58a66, undefined, undefined, 1, 0.07);
  // stern castle with gallery windows, rails, lanterns and the wheel
  const qw = B * (0.74 + fat * 0.1), qz = z(0) + qd / 2 + 0.1, top = deckY + castle;
  m.add(box(qw, castle, qd), 0x80684c, [0, deckY + castle / 2, qz], [0, 0, 0], 1, 0.06);
  for (let r = 0; r < (castle > 2 ? 2 : 1); r++) for (let i = -2; i <= 2; i++) if (Math.abs(i) < 2 || B > 8) m.add(box(0.62, 0.6, 0.12), lit, [i * qw * 0.2, deckY + 0.55 + r * 1.25, z(0) - 0.04], [0, 0, 0], 1, 0);
  if (cls.gild) { m.add(box(qw * 1.02, 0.22, 0.2), gold, [0, top + 0.1, z(0) - 0.05]); m.add(box(qw * 1.02, 0.16, 0.2), gold, [0, deckY + 0.05, z(0) - 0.05]); }
  for (const sx of [-1, 1]) { m.add(box(0.1, 0.1, qd), dark, [sx * qw / 2, top + 0.8, qz]); for (let i = 0; i <= 3; i++) m.add(box(0.1, 0.8, 0.1), dark, [sx * qw / 2, top + 0.4, z(0) + 0.2 + (i / 3) * (qd - 0.3)]); }
  m.add(box(qw, 0.1, 0.1), dark, [0, top + 0.8, z(0) + qd + 0.05]);
  const nl = castle > 2 ? 3 : 1; for (let i = 0; i < nl; i++) { const lx = (i - (nl - 1) / 2) * qw * 0.36; m.add(box(0.34, 0.52, 0.34), lit, [lx, top + 1.75, z(0) + 0.1], [0, 0, 0], 1, 0); m.add(cyl(0.04, 0.04, 1.5, 4), iron, [lx, top + 0.75, z(0) + 0.1]); }
  const hz = z(0) + qd * 0.72;
  m.add(cyl(0.55, 0.55, 0.08, 8), wood, [0, top + 0.95, hz], [Math.PI / 2, 0, 0]); m.add(box(0.14, 0.95, 0.14), wood, [0, top + 0.48, hz - 0.15]);
  for (const sx of [-1, 1]) m.add(box(0.9, 0.16, castle * 1.3 + 0.4), 0x80684c, [sx * qw * 0.3, deckY + castle * 0.5, z(0) + qd + castle * 0.55], [-0.72, 0, 0]); // stairs
  // forecastle
  if (fore) { m.add(box(B * 0.62, fore, fl), 0x80684c, [0, deckY + fore / 2, z(1) - fl * 0.72], [0, 0, 0], 1, 0.06); m.add(box(B * 0.62, 0.1, 0.1), dark, [0, deckY + fore + 0.7, z(1) - fl * 1.2]); }
  // bowsprit, beak, figurehead, anchors
  m.add(cyl(0.1, 0.17, L * 0.3, 5), wood, [0, gy(1) + 0.75, z(1) + L * 0.08], [1.2, 0, 0]);
  if (cls.beak) m.add(box(0.5, 0.35, L * 0.16), style.trim, [0, gy(1) - 0.2, z(1) + L * 0.06], [-0.18, 0, 0]);
  if (cls.gild) m.add(cone(0.34, 1.5, 5), gold, [0, gy(1) - 0.1, z(1) + 0.5], [1.9, 0, 0]);
  for (const sx of [-1, 1]) { m.add(box(0.12, 1.1, 0.12), iron, [sx * hb(0.86) * 1.04, gy(0.86) - 0.7, z(0.86)]); m.add(box(0.12, 0.12, 0.8), iron, [sx * hb(0.86) * 1.04, gy(0.86) - 1.25, z(0.86)]); }
  // deck furniture: hatch grating, capstan, ship's boat
  m.add(box(B * 0.28, 0.16, L * 0.1), 0x2a211a, [0, deckY + 0.08, z(0.47)]); m.add(cyl(0.42, 0.5, 0.8, 8), wood, [0, deckY + 0.4, z(0.62)]); m.add(cyl(0.6, 0.6, 0.1, 8), dark, [0, deckY + 0.85, z(0.62)]);
  if (L > 28) { m.add(box(1.5, 0.5, 4), 0x6a5238, [B * 0.16, deckY + 0.45, z(0.38)]); m.add(box(1.1, 0.12, 3.5), dark, [B * 0.16, deckY + 0.72, z(0.38)]); }
  // guns: an open battery on deck, and a lower gun deck on the biggest ships
  const gunZ = [], guns = opts.guns ?? cls.guns, top0 = fore ? 0.8 - 0.15 : 0.74, per = decks > 1 ? Math.ceil(guns / 2) : guns;
  for (let i = 0; i < guns; i++) {
    const low = decks > 1 && i >= per, n = low ? guns - per : per, j = low ? i - per : i;
    const t = 0.3 + (n === 1 ? 0.2 : (j / (n - 1)) * (top0 - 0.3)) + (low ? 0.02 : 0), gz = z(t), w = hb(t), y = low ? deckY - 0.75 : deckY + 0.5;
    gunZ.push({ z: gz, x: w });
    for (const sx of [1, -1]) {
      m.add(cyl(0.13, 0.19, low ? 0.9 : 1.3, 6), iron, [sx * (w + (low ? 0.3 : -0.1)), y, gz], [0, 0, sx * -Math.PI / 2]);
      if (low) m.add(box(0.1, 0.5, 0.6), style.trim, [sx * (w + 0.06), y + 0.5, gz], [0, 0, sx * 0.5]); else m.add(box(0.7, 0.3, 0.6), wood, [sx * (w - 0.7), deckY + 0.22, gz]);
    }
  }
  // masts and rig
  const nm = cls.masts, mastT = nm === 1 ? [0.56] : nm === 2 ? [0.38, 0.69] : [0.27, 0.51, 0.76];
  const sailDefs = [], mastTop = [], rake = cls.rake || 0;
  mastT.forEach((t, i) => {
    const mid = i === Math.floor(nm / 2) || nm === 1, mz = z(t), base = t < 0.22 ? top : deckY;
    const h = (rig === 'lateen' ? L * 0.62 : rig === 'gaff' ? L * (mid ? 0.95 : 0.86) : L * (mid ? 0.98 : 0.84)) * (cls.tall || 1) + 2;
    m.add(cyl(0.11, 0.25, h, 6), wood, [0, base + h / 2, mz - Math.sin(rake) * h / 2], [-rake, 0, 0]);
    const tz = mz - Math.sin(rake) * h; mastTop.push([0, base + h, tz]);
    for (const sx of [1, -1]) { for (const dz of [-1.5, -0.6, 0.3]) m.add(soup([[0, base + h * 0.62, mz], [sx * hb(t), gy(t), mz + dz], [sx * hb(t), gy(t), mz + dz + 0.14]]), 0x1c1917); }
    m.add(box(0.06, 0.5, 1.6), style.trim, [0, base + h + 0.3, tz - 0.8]); // pennant
    if (rig === 'square') {
      m.add(cyl(0.55, 0.45, 0.3, 7), dark, [0, base + h * 0.62, mz]);
      const rows = cls.tall ? [[1.5, 0.36, 0.52], [1.2, 0.26, 0.8], [0.85, 0.16, 0.985]] : [[1.5, 0.4, 0.58], [1.15, 0.27, 0.92]];
      for (const [wk, hk, yk] of rows) { const w = B * wk, y = base + h * yk; m.add(cyl(0.07, 0.07, w * 1.04, 5), dark, [0, y, mz + 0.3], [0, 0, Math.PI / 2]); sailDefs.push({ geo: sailGeo(w, h * hk), x: 0, y: y - 0.1, z: mz + 0.36, ry: 0 }); }
    } else if (rig === 'gaff') {
      const bl = L * 0.3, yb = 1.6, yt = h * 0.7, pk = h * 0.2; // boom length, heights above the base
      m.add(cyl(0.08, 0.1, bl, 5), dark, [0, base + yb, mz - bl / 2], [Math.PI / 2, 0, 0]); m.add(cyl(0.06, 0.08, bl * 0.8, 5), dark, [0, base + yt + pk / 2, mz - bl * 0.36], [Math.PI / 2 - 0.35, 0, 0]);
      sailDefs.push({ geo: tri([[0, 0, 0], [0, yb - yt, 0], [0, yb - yt, -bl * 0.96], [0, 0, 0], [0, yb - yt, -bl * 0.96], [0, pk, -bl * 0.74]]), x: 0, y: base + yt, z: mz - 0.1, ry: 0.3 });
      sailDefs.push({ geo: tri([[0, 0, 0], [0, -h * 0.24, 0], [0, -h * 0.22 + pk, -bl * 0.7]]), x: 0, y: base + h * 0.97, z: mz - 0.1, ry: 0.3 });
    } else {
      const yl = L * 0.5; // lateen yard: low forward, high aft
      m.add(cyl(0.06, 0.09, yl * 1.5, 5), dark, [0, base + h * 0.78, mz - yl * 0.12], [Math.PI / 2 - 0.62, 0, 0]);
      sailDefs.push({ geo: tri([[0, -h * 0.38, yl * 0.5], [0, h * 0.36, -yl * 0.72], [0, -h * 0.66, -yl * 0.5]]), x: 0, y: base + h * 0.78, z: mz - yl * 0.12, ry: 0.3 });
    }
  });
  const hullGeo = m.build(); boxUV(hullGeo, 1 / 3.2, true);
  const hullMesh = new THREE.Mesh(hullGeo, style === STYLES.ghost ? GHOST_MAT : hullMat());
  const group = new THREE.Group(); group.rotation.order = 'YXZ'; group.add(hullMesh);
  const ghost = style === STYLES.ghost;
  const sailMat = new THREE.MeshLambertMaterial({ color: style.sail, vertexColors: true, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: ghost ? 0.75 : 1, emissive: ghost ? 0x1d5446 : 0 });
  const sailMeshes = sailDefs.map((s) => { const sm = new THREE.Mesh(s.geo, sailMat); sm.position.set(s.x, s.y, s.z); sm.rotation.y = s.ry; sm.renderOrder = 2; group.add(sm); return sm; });
  // headsails
  const fm = mastTop[mastTop.length - 1], bs = [0.3, gy(1) + 1.7, z(1) + L * 0.19], jg = [[0, fm[1] * 0.86, fm[2] + 0.3], bs, [0.2, deckY + 2.2, fm[2] + 1.2]];
  if (rig !== 'lateen' && L > 24) jg.push([0, fm[1] * 0.66, fm[2] + 0.3], [0.2, gy(1) + 1.2, z(1) + L * 0.08], [0.2, deckY + 2.1, fm[2] + 2.4]);
  const jib = new THREE.Mesh(tri(jg), sailMat); jib.renderOrder = 2; group.add(jib);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2).translate(-1.7, 0, 0), new THREE.MeshLambertMaterial({ map: flagTexture(opts.flag || FACTION_FLAG[opts.faction] || 'white', opts.jolly), side: THREE.DoubleSide }));
  const ft = mastTop[Math.floor(mastTop.length / 2)]; flag.position.set(0, ft[1] - 1.2, ft[2]); flag.rotation.y = Math.PI / 2; group.add(flag);
  if (opts.crew !== false) {
    const mine = opts.faction === 'player' || !opts.faction;
    const looks = { player: ['crew', 'crew'], pirate: ['brigand', 'brigand'], merchant: ['crew', 'wright'], navy: ['soldier', 'soldier'], ghost: ['skeleton', 'skeleton'] }[opts.faction || 'player'];
    looks.forEach((lk, i) => { const f = staticFigure(lk); f.position.set((i ? 1 : -1) * B * 0.26, deckY, z(0.42 + i * 0.24)); f.rotation.y = i ? 1.2 : -1.5; group.add(f); if (mine) (group.userData.hands = group.userData.hands || []).push(f); });
    const helm = staticFigure(mine ? 'player' : looks[0]); helm.position.set(0, top, hz - 0.75); group.add(helm);
    if (mine) group.userData.helm = helm;
  }
  // where people can walk: the open deck between the stern castle and the forecastle
  const walk = { z0: z(0) + qd + 0.5, z1: Math.min(z(0.9), z(1) - fl * 1.25 - 0.3) };
  return { group, sailMeshes, jib, flag, sailMat, gunZ, deckY, fb, hb, L, B, walk, helmAt: { x: 0, y: top, z: hz - 0.75 }, top };
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
