// Player save data, derived stats and the economy. No rendering in here.
import { LOOK_OPTS, SHIP_CLASSES, SHIP_UPGRADES, SWORDS, GUNS, BUILDINGS, PROD_CAP_HOURS, GOODS, PORT_PRICES, xpFor, RANKS } from './data.js';

const KEY = 'pirates-life-save-v1';

export function newSave() {
  return {
    v: 1, gold: 120, timber: 0, iron: 0, rum: 2, xp: 0, level: 1,
    ship: { cls: 'sloop', up: { hull: 0, sails: 0, cannons: 0, hold: 0, crew: 0 }, hp: 1, sail: 'bone' },
    owned: { sloop: { hull: 0, sails: 0, cannons: 0, hold: 0, crew: 0 } },
    sword: 0, gun: 0,
    cargo: {}, questCargo: 0,
    story: { i: 0, n: 0, given: false }, jobs: [], offers: {}, maps: [],
    seen: { saltmere: true }, chests: {}, bosses: {},
    base: { b: {}, t: Date.now() }, raidAt: 0,
    look: { coat: 'navy', sash: 'red', hat: 'tricorn', skin: 0 }, pets: {}, pet: null,
    wanted: 0, pos: null, stats: { sunk: 0, boarded: 0, kills: 0, dug: 0 }, muted: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.v === 1 ? Object.assign(newSave(), s) : null;
  } catch (e) { return null; }
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ } }
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

export const SAIL_COLORS = { bone: 0xd9cdb0, tar: 0x2a2826, blood: 0x7d1f1a, sea: 0x2f5d63, gold: 0xb58a2e };

export function shipStats(s) {
  const c = SHIP_CLASSES[s.ship.cls], u = s.ship.up;
  return {
    cls: c, maxHp: Math.round(c.hp * (1 + 0.18 * u.hull)), speed: c.speed * (1 + 0.05 * u.sails), turn: c.turn * (1 + 0.05 * u.sails),
    guns: c.guns, dmg: 9 * (1 + 0.15 * u.cannons), reload: 4.2 * (1 - 0.07 * u.cannons), range: 150,
    cargo: Math.round(c.cargo * (1 + 0.25 * u.hold)), crew: c.crew + Math.floor(u.crew / 2) + (s.base.b.quarters || 0),
  };
}
export function playerStats(s) {
  return { maxHp: 100 + (s.level - 1) * 8, sword: SWORDS[s.sword].dmg, gun: GUNS[s.gun].dmg, gunReload: GUNS[s.gun].reload };
}
export const rankName = (s) => RANKS[Math.min(RANKS.length - 1, Math.floor((s.level - 1) / 1))] || RANKS[RANKS.length - 1];
export const cargoUsed = (s) => Object.values(s.cargo).reduce((a, b) => a + b, 0) + s.questCargo;

export function addXp(s, n) {
  s.xp += n; let up = false;
  while (s.xp >= xpFor(s.level)) { s.xp -= xpFor(s.level); s.level++; up = true; }
  return up;
}

export function can(s, cost) { return s.gold >= (cost.gold || 0) && s.timber >= (cost.timber || 0) && s.iron >= (cost.iron || 0); }
export function pay(s, cost) { if (!can(s, cost)) return false; s.gold -= cost.gold || 0; s.timber -= cost.timber || 0; s.iron -= cost.iron || 0; return true; }
export function grant(s, r) {
  if (!r) return false;
  s.gold += Math.round((r.gold || 0) * (s.pet === 'cat' ? 1.15 : 1)); s.timber += r.timber || 0; s.iron += r.iron || 0; s.rum += r.rum || 0;
  return r.xp ? addXp(s, r.xp) : false;
}
const scale = (def, lvl, k = 1.5) => { const m = Math.pow(lvl + 1, k); return { gold: Math.round(def.gold * m), timber: Math.round((def.timber || 0) * m), iron: Math.round((def.iron || 0) * m) }; };
export const upgradeCost = (s, track) => scale(SHIP_UPGRADES[track], s.ship.up[track]);
export const buildingCost = (s, id) => scale(BUILDINGS[id], s.base.b[id] || 0, 1.7);
export const repairCost = (s) => Math.ceil((1 - s.ship.hp) * shipStats(s).maxHp * 0.6);
export const costText = (c) => [c.gold && `${c.gold} gold`, c.timber && `${c.timber} timber`, c.iron && `${c.iron} iron`].filter(Boolean).join(' · ') || 'Free';

export function buyPrice(port, good) { return Math.round(GOODS[good].price * PORT_PRICES[port][good]); }
export function sellPrice(port, good) { return Math.round(GOODS[good].price * PORT_PRICES[port][good] * 0.88); }

// Hideout production accrued since last collection (real time, capped).
export function pending(s) {
  const hours = Math.min(PROD_CAP_HOURS, (Date.now() - s.base.t) / 3600000);
  const out = { gold: 0, timber: 0, iron: 0 };
  for (const id in s.base.b) { const p = BUILDINGS[id].prod; if (p) for (const k in p) out[k] += Math.floor(p[k] * s.base.b[id] * hours); }
  return out;
}
export function collect(s) { const p = pending(s); if (p.gold + p.timber + p.iron > 0) { grant(s, p); s.base.t = Date.now(); } return p; }

// Gold lost when you fall in a fight. The vault protects a share.
export function deathTax(s) { const safe = (s.base.b.vault || 0) * 0.25; const loss = Math.floor(s.gold * 0.15 * (1 - safe)); s.gold -= loss; return loss; }

// The captain's chosen look, as overrides for the character builder.
export function lookSpec(s) {
  const l = s.look, sash = LOOK_OPTS.sash[l.sash];
  return { coat: LOOK_OPTS.coat[l.coat], sash, hat: l.hat, hatC: l.hat === 'bandana' ? sash : 0x14161a, hair: l.hat === 'none' ? 0x2a1d14 : undefined, skinI: l.skin };
}
