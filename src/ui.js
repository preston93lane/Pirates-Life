// HUD and menus. Plain DOM over the canvas.
import * as THREE from 'three';
import { SHIP_CLASSES, SHIP_UPGRADES, MAX_UPGRADE, SWORDS, GUNS, GOODS, BUILDINGS, MAX_BUILDING, ISLANDS, ISLAND, ZONES, WORLD_R, RANKS, xpFor, PROD_CAP_HOURS, LOOK_OPTS, PETS, FACTIONS, PORT_FACTION, AMMO, SWIVEL, FLAGS, JOLLY, DEEDS, BOUNTIES, BOMB, HANDS, GRADES, STATIONS, AMMO_PACK, TREE, TREE_BRANCH, POINTS_PER_RANK, STORES } from './data.js';
import { createMap } from './map.js';
import { flagTexture } from './ship.js';
import { shipStats, playerStats, cargoUsed, can, pay, upgradeCost, buildingCost, repairCost, costText, buyPrice, sellPrice, SAIL_COLORS, pending, clearSave, writeSave, isWanted, standing, addRep, bribeCost, freshUps, exportSave, importSave, makeHand, hireCost, addMorale, moraleWord, crewBonus, sk, feat, skillPoints, nodeRank, nodeOpen, storesFull, storesCost } from './state.js';
import { heightAt, nearestIsland, refreshBase } from './world.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { clamp, dist2 } from './util.js';

const ICON = {
  fire: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  up: '<path d="M5 14l7-7 7 7M5 20l7-7 7 7"/>', down: '<path d="M5 5l7 7 7-7M5 11l7 7 7-7"/>',
  sword: '<path d="M20 3l1 1-11 12-2-2L20 3z"/><path d="M6 12l6 6M4 20l4-4"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/>',
  dodge: '<path d="M3 12h12M11 7l5 5-5 5M20 5v14"/>',
  gun: '<path d="M2 8h15l3 1v3h-9l-1.5 2.5H7L5.5 19H2.5L4 13H2z"/>',
  ball: '<circle cx="12" cy="12" r="6.5"/><path d="M8.5 9.5a4.5 4.5 0 0 1 3-1.6"/>', aim: '<circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  quest: '<path d="M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h3"/>', person: '<circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7"/>', ship: '<path d="M3 16h18l-2.5 5h-13zM12 16V3M12 4l6 9h-6M12 6l-5 7h5"/>', crew: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.5 2.5-6 6-6s6 2.5 6 6M15 14.5c3.5-.5 7 1.5 7 5.5"/>', paw: '<circle cx="7" cy="9" r="1.8"/><circle cx="12" cy="6.5" r="1.8"/><circle cx="17" cy="9" r="1.8"/><path d="M7.5 17c0-3 2-5 4.5-5s4.5 2 4.5 5c0 2-2 2.5-4.5 2.5S7.5 19 7.5 17z"/>', scales: '<path d="M12 3v18M6 21h12M4 7h16M4 7l-2.5 6a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z"/>', flag: '<path d="M5 21V3M5 4h13l-3 4.5 3 4.5H5"/>', friends: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5M17 5.5a3 3 0 0 1 0 5.5M19 14.5c2 .8 3 2.6 3 5.5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>', map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
  whirl: '<path d="M12 4a8 8 0 1 1-7.5 5.2M4 4v5.5h5.5"/><path d="M12 9v6"/>',
  rum: '<path d="M10 2h4v4l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/><path d="M8 13h8"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 13c0 4 3 7 7 7s7-3 7-7M8.5 11h7"/>',
  board: '<path d="M4 20L20 4M14 4h6v6M4 9l4 4M9 4l4 4"/>', talk: '<path d="M4 5h16v10H10l-5 4v-4H4z"/>',
  chest: '<path d="M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9H3zM3 12h18M12 11v3"/>', dig: '<path d="M14 3l7 7-3 3-7-7zM12.5 9.5L3 19l2 2 9.5-9.5"/>',
  build: '<path d="M3 21h18M5 21V10l7-6 7 6v11M10 21v-6h4v6"/>',
  log: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9zM16 9l5 6M21 9l-5 6"/>',
};
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createUI(game) {
  const ui = { dirty: true, panel: null, floats: [], miniT: 0, hintT: 0 };
  const el = {}; ['hud', 'hpFill', 'hpText', 'pGold', 'pTimber', 'pIron', 'pHold', 'wanted', 'qTitle', 'qText', 'target', 'tName', 'tFill', 'toasts', 'mini', 'place', 'btnMenu', 'btnMute', 'seaBtns', 'landBtns', 'stnBar', 'bAtk', 'bFire', 'bShoot', 'bDodge', 'rumN', 'sailPips', 'speed', 'rlP', 'rlS', 'ctx', 'hint', 'floats', 'flash', 'banner', 'panel', 'title', 'fade', 'btnContinue', 'btnNew', 'bAmmo', 'ammoN', 'bSwivel', 'quest', 'bSkill', 'bombN'].forEach((k) => { el[k] = $(k); });
  for (const s of document.querySelectorAll('[data-icon]')) s.innerHTML = svg(s.dataset.icon);
  el.pGold.dataset.l = 'Gold'; el.pTimber.dataset.l = 'Timber'; el.pIron.dataset.l = 'Iron'; el.pHold.dataset.l = 'Hold';
  const S = () => game.save, mctx = el.mini.getContext('2d'), v3 = new THREE.Vector3();
  const sheet = { h2: el.panel.querySelector('h2'), nav: el.panel.querySelector('nav'), body: el.panel.querySelector('.body') };

  ui.toast = (msg, type = '') => {
    const d = document.createElement('div'); d.className = `toast ${type}`; d.textContent = msg; el.toasts.appendChild(d);
    while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 3600);
  };
  ui.floatText = (x, y, z, text, color = '#fff', big = false) => {
    if (ui.floats.length > 16) { const o = ui.floats.shift(); o.el.remove(); }
    const d = document.createElement('div'); d.className = `float${big ? ' big' : ''}`; d.textContent = text; d.style.color = color; el.floats.appendChild(d);
    ui.floats.push({ el: d, x, y, z, t: 0 });
  };
  ui.flash = (kind = '') => { el.flash.className = kind; void el.flash.offsetWidth; el.flash.classList.add('on'); };
  ui.bolt = () => ui.flash('bolt'); ui.trance = () => ui.flash('trance');
  let bannerT = null;
  ui.banner = (small, title, text) => {
    el.banner.querySelector('small').textContent = small; el.banner.querySelector('b').textContent = title; el.banner.querySelector('p').textContent = text || '';
    el.banner.hidden = false; clearTimeout(bannerT); bannerT = setTimeout(() => { el.banner.hidden = true; }, 6500);
  };
  ui.hint = (text, secs = 9) => { el.hint.textContent = text; el.hint.hidden = false; ui.hintT = secs; };
  ui.fade = (on) => el.fade.classList.toggle('on', on);
  ui.showTitle = (hasSave) => { el.title.hidden = false; el.hud.hidden = true; el.btnContinue.hidden = !hasSave; };
  ui.hideTitle = () => { el.title.hidden = true; el.hud.hidden = false; };
  ui.setMute = () => {};

  // ---------- per-frame HUD ----------
  ui.update = (dt) => {
    const s = S(), mode = game.mode, sea = game.sea, land = game.land, onFoot = mode !== 'sea';
    el.seaBtns.hidden = onFoot; el.landBtns.hidden = !onFoot; el.stnBar.hidden = mode !== 'sea' && mode !== 'deck';
    { const key = s.station + ':' + (sea.stn ? sea.stn.k : ''); if (ui.stnKey !== key) { ui.stnKey = key; for (const b of el.stnBar.children) { b.classList.toggle('on', b.dataset.k === s.station && !sea.stn); b.classList.toggle('wait', !!sea.stn && b.dataset.k === sea.stn.k); } } }
    const hull = mode === 'sea' || mode === 'deck', hp = hull ? sea.player.hp : land.player.hp, max = hull ? sea.player.maxHp : land.player.maxHp;
    el.hpFill.style.transform = `scaleX(${clamp(hp / max, 0, 1)})`; el.hpFill.parentElement.classList.toggle('ship', hull);
    el.hpText.textContent = `${hull ? 'HULL ' : ''}${Math.ceil(hp)} / ${max}`;
    el.pGold.textContent = s.gold; el.pTimber.textContent = s.timber; el.pIron.textContent = s.iron; el.pHold.textContent = `${cargoUsed(s)}/${sea.player.stats.cargo}`;
    el.wanted.hidden = !isWanted(s); el.wanted.textContent = s.rep.navy <= -60 ? 'HUNTED' : 'WANTED';
    if (ui.dirty) { const o = game.quests.objective(); el.qTitle.textContent = o.title; el.qText.textContent = o.short; ui.dirty = false; }
    const t = onFoot ? land.focus : sea.target;
    el.target.hidden = !t;
    if (t) { el.tName.textContent = (t.captain ? `${t.captain}'s ` : '') + (t.name || t.def.name) + (t.surrendered ? ' (surrendered)' : t.sailHp < 0.6 ? ' (crippled)' : t.burn > 0 ? ' (ablaze)' : ''); el.tFill.style.transform = `scaleX(${clamp(t.hp / t.maxHp, 0, 1)})`; }
    if (!onFoot) {
      const p = sea.player, r = p.stats.reload;
      el.rlP.firstChild.style.setProperty('--p', 1 - clamp(p.reload[1] / r, 0, 1)); el.rlS.firstChild.style.setProperty('--p', 1 - clamp(p.reload[-1] / r, 0, 1));
      let ready = false; if (t) { const b = p.bearing(t.x, t.z); ready = b.off < 0.5 && b.dist < p.stats.range && p.reload[b.side] <= 0; }
      el.bFire.classList.toggle('ready', ready);
      el.sailPips.children[0].classList.toggle('on', p.sail >= 0.5); el.sailPips.children[1].classList.toggle('on', p.sail >= 1);
      el.speed.textContent = `${Math.max(0, p.speed * 1.2).toFixed(0)} kn`;
      el.ammoN.textContent = s.shot === 'round' ? AMMO.round.short : `${AMMO[s.shot].short} ${s.ammo[s.shot] || 0}`; el.bSwivel.hidden = !s.swivel; el.bSwivel.classList.toggle('cool', sea.swivelCd > 0); el.bSwivel.style.setProperty('--cd', clamp((sea.swivelCd || 0) / 2.8, 0, 1));
    } else {
      const p = land.player, st = playerStats(s), g = land.gun;
      el.landBtns.classList.toggle('gun', !!g); if (ui.gunLbl !== !!g) { ui.gunLbl = !!g; el.bAtk.querySelector('em').textContent = g ? 'FIRE' : 'STRIKE'; el.bAtk.querySelector('.ic').innerHTML = svg(g ? 'fire' : 'sword'); }
      el.bAtk.classList.toggle('cool', !!g && g.cd > 0); el.bAtk.style.setProperty('--cd', g ? clamp(g.cd / (g.max || 1), 0, 1) : 0);
      el.bShoot.classList.toggle('cool', p.gunT > 0); el.bShoot.style.setProperty('--cd', clamp(p.gunT / st.gunReload, 0, 1));
      el.bDodge.classList.toggle('cool', p.cdRoll > 0); el.bDodge.style.setProperty('--cd', clamp(p.cdRoll / 0.85, 0, 1));
      el.rumN.textContent = s.rum; el.bombN.textContent = s.bombs; el.bSkill.classList.toggle('cool', p.cdWhirl > 0); el.bSkill.style.setProperty('--cd', clamp((p.cdWhirl || 0) / 7, 0, 1));
    }
    // context button
    const c = game.ctx;
    el.ctx.hidden = !c;
    if (c && ui.ctxKey !== c.label + (c.sub || '')) { ui.ctxKey = c.label + (c.sub || ''); el.ctx.querySelector('.ic').innerHTML = svg(c.icon); el.ctx.querySelector('b').textContent = c.label; el.ctx.querySelector('small').textContent = c.sub || ''; }
    if (ui.hintT > 0) { ui.hintT -= dt; if (ui.hintT <= 0) el.hint.hidden = true; }
    // floating numbers
    const W = el.hud.clientWidth, H = el.hud.clientHeight;
    for (let i = ui.floats.length - 1; i >= 0; i--) {
      const f = ui.floats[i]; f.t += dt;
      if (f.t > 0.9) { f.el.remove(); ui.floats.splice(i, 1); continue; }
      v3.set(f.x, f.y + f.t * 1.6, f.z).project(game.camera);
      f.el.style.transform = `translate(${((v3.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v3.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%, -50%)`;
      f.el.style.opacity = v3.z > 1 ? 0 : clamp((0.9 - f.t) * 3, 0, 1);
    }
    ui.miniT -= dt; if (ui.miniT <= 0) { ui.miniT = 0.2; drawMini(); el.btnMenu.classList.toggle('hot', game.quests.pendingClaims() > 0); }
  };

  function drawMini() {
    const c = mctx, Z = 232, sea = game.sea, onFoot = game.mode !== 'sea', me = onFoot ? game.land.player : sea.player, R = onFoot ? 120 : S().pet === 'parrot' ? 640 : 430, k = Z / (2 * R);
    c.clearRect(0, 0, Z, Z); c.save(); c.beginPath(); c.arc(Z / 2, Z / 2, Z / 2, 0, 7); c.clip();
    c.fillStyle = 'rgba(14,44,54,.78)'; c.fillRect(0, 0, Z, Z);
    c.translate(Z / 2, Z / 2); c.scale(-k, -k); c.translate(-me.x, -me.z);
    c.drawImage(game.world.chart, -WORLD_R, -WORLD_R, WORLD_R * 2, WORLD_R * 2);
    const dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, z, r / k, 0, 7); c.fill(); };
    if (!onFoot) {
      for (const s of sea.ships) if (s.alive) dot(s.x, s.z, 5, s.faction === 'merchant' ? '#d9c79a' : s.faction === 'navy' ? (isWanted(S()) || s.provoked ? '#e0524a' : '#7fa3d6') : '#e0524a');
      for (const l of sea.loot) dot(l.x, l.z, 3.5, '#e9c46a');
      if (sea.kraken) for (const a of sea.kraken.arms) if (a.alive) dot(a.x, a.z, 4, '#c678a0');
    } else {
      for (const a of game.land.actors) if (a.alive && a.state !== 'buried') dot(a.x, a.z, 4.5, a.team ? '#e0524a' : '#6fae84');
      const isl = game.land.isl;
      for (const q of game.land.pois) if (q.seen && !q.done) dot(q.x, q.z, 5, '#fff2a8');
      if (isl && !game.land.cave) { dot(isl.boat.x, isl.boat.z, 6, '#7fd0d6'); for (const n of isl.npcs) dot(n.x, n.z, 4.5, '#e9c46a'); }
    }
    const h = onFoot ? me.face : me.heading, sx = Math.sin(h), cz = Math.cos(h), a = 11 / k;
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(me.x + sx * a, me.z + cz * a); c.lineTo(me.x - sx * a * 0.7 + cz * a * 0.6, me.z - cz * a * 0.7 - sx * a * 0.6); c.lineTo(me.x - sx * a * 0.7 - cz * a * 0.6, me.z - cz * a * 0.7 + sx * a * 0.6); c.fill();
    c.restore();
    const m = game.quests.marker();
    if (S().course && dist2(me.x, me.z, S().course.x, S().course.z) < 90) { S().course = null; ui.toast('You have reached your course marker.', 'dim'); }
    if (m) {
      let dx = -(m.x - me.x) * k, dy = -(m.z - me.z) * k; const d = Math.hypot(dx, dy), lim = Z / 2 - 14;
      if (d > lim) { dx *= lim / d; dy *= lim / d; }
      c.save(); c.translate(Z / 2 + dx, Z / 2 + dy); c.rotate(Math.PI / 4); c.fillStyle = '#e9c46a'; c.strokeStyle = '#0c1316'; c.lineWidth = 3; c.fillRect(-8, -8, 16, 16); c.strokeRect(-8, -8, 16, 16); c.restore();
    }
    c.fillStyle = '#e6dcc2'; c.font = '700 20px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('N', Z / 2, 24);
    // place name
    let name = 'Open sea';
    if (game.mode === 'board') name = 'Boarding'; else if (game.mode === 'deck') name = 'On deck'; else if (game.land.cave) name = 'Cave';
    else if (onFoot && game.land.isl) name = game.land.isl.name;
    else { const n = nearestIsland(me.x, me.z); if (n.d < 220 && S().seen[n.isl.id]) name = n.isl.name; else if (sea.zone) name = ZONES[sea.zone].name; }
    el.place.textContent = name;
  }

  // ---------- panels ----------
  const costHtml = (c) => `<span class="cost${can(S(), c) ? '' : ' no'}">${costText(c)}</span>`;
  const pips = (n, max) => `<span class="pips">${Array.from({ length: max }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const row = (name, sub, right) => `<div class="row"><div><b>${name}</b><small>${sub}</small></div>${right}</div>`;
  const btn = (label, act, arg = '', cls = '', dis = false) => `<button type="button" class="btn ${cls}" data-do="${act}" data-arg="${esc(arg)}"${dis ? ' disabled' : ''}>${label}</button>`;
  const rewardText = (r) => [r.gold && `${r.gold} gold`, r.xp && `${r.xp} infamy`, r.timber && `${r.timber} timber`, r.iron && `${r.iron} iron`].filter(Boolean).join(' · ');

  const VIEWS = {
    tavern: {
      tabs: ['Jobs', 'Hands', 'Games', 'Bounties', 'Bar'],
      Games() {
        const s = S(), g = ui.g, die = (n) => `<span class="die">${'⚀⚁⚂⚃⚄⚅'[n - 1]}</span>`, FACE = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
        const stakes = (k) => [10, 50, 250].map((b) => btn(`${b} gold`, 'play', `${k}:${b}`, 'go', s.gold < b)).join(' ');
        if (!g) return '<p>A corner table, a guttering candle, and people who would love your money.</p>'
          + row("Liar's Dice", 'Five dice each, hidden under a cup. Bid how many of a face are on the table in all. Raise, or call the other a liar.', stakes('liar'))
          + row('Twenty-One', 'Draw cards toward 21 without going over. Beat the dealer. A two-card 21 pays half again.', stakes('21'))
          + row('Crown and Anchor', "The sailor's game. Back one of six signs. Three dice roll: each one showing your sign pays your stake.", stakes('ca'))
          + row('Arm wrestle', 'The big fellow by the fire takes all comers. Three bouts: pick when to heave and when to hold.', stakes('arm'));
        const end = g.over ? `<p><b>${esc(g.over)}</b></p><p>${btn('Play again', 'play', `${g.kind}:${g.bet}`, 'go', s.gold < g.bet)} ${btn('Leave the table', 'gquit')}</p>` : '';
        if (g.kind === 'liar') {
          const valid = !g.bid || g.pc > g.bid.c || (g.pc === g.bid.c && g.pf > g.bid.f);
          return `<p>Stake: ${g.bet} gold. Faces count as they show; no wilds.</p><h3>Your dice</h3><p class="dice">${g.mine.map(die).join('')}</p><h3>Their dice</h3><p class="dice">${g.over ? g.theirs.map(die).join('') : '<span class="die">▢</span>'.repeat(5)}</p>`
            + `<p>${g.log.map(esc).join('<br>')}</p>`
            + (g.over ? end : `<div class="choices">${btn('−', 'ld', 'c-')}<b style="align-self:center">${g.pc}</b>${btn('+', 'ld', 'c+')} ${[1, 2, 3, 4, 5, 6].map((f) => btn('⚀⚁⚂⚃⚄⚅'[f - 1], 'ld', `f${f}`, g.pf === f ? 'go' : '')).join('')}</div><p>${btn(`Bid ${g.pc} ${FACE[g.pf - 1]}`, 'ld', 'bid', 'go', !valid)} ${btn('Call liar!', 'ld', 'call', 'bad', !g.bid)}</p>`);
        }
        if (g.kind === '21') {
          const card = (c) => `<span class="card${c.s > 1 ? ' red' : ''}">${['A', 2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K'][c.r - 1]}${'♠♣♥♦'[c.s]}</span>`;
          return `<p>Stake: ${g.bet} gold.</p><h3>Dealer${g.over ? ` (${total(g.dealer)})` : ''}</h3><p class="dice">${g.over ? g.dealer.map(card).join('') : card(g.dealer[0]) + '<span class="card">?</span>'}</p><h3>You (${total(g.me)})</h3><p class="dice">${g.me.map(card).join('')}</p>`
            + (g.over ? end : `<p>${btn('Hit', 'bj', 'hit', 'go')} ${btn('Stand', 'bj', 'stand')}</p>`);
        }
        if (g.kind === 'ca') {
          const SYM = ['♛ Crown', '⚓ Anchor', '♥ Heart', '♦ Diamond', '♠ Spade', '♣ Club'];
          return `<p>Stake: ${g.bet} gold. Pick your sign.</p>${g.roll ? `<p class="dice">${g.roll.map((r) => `<span class="card${r === 2 || r === 3 ? ' red' : ''}">${SYM[r][0]}</span>`).join('')}</p>` : ''}`
            + (g.over ? end : `<div class="choices">${SYM.map((n, i) => btn(n, 'ca', i)).join('')}</div>`);
        }
        return `<p>Stake: ${g.bet} gold. Best of three. Heave beats Hold, Hold beats Feint, Feint beats Heave.</p><p>You ${g.w} · Him ${g.l}</p><p>${g.log.map(esc).join('<br>')}</p>`
          + (g.over ? end : `<p>${btn('Heave', 'arm', 0, 'go')} ${btn('Hold', 'arm', 1)} ${btn('Feint', 'arm', 2)}</p>`);
      },
      Hands(p) {
        const s = S(), st = shipStats(s), list = hireOffers(p.isl.id), full = s.crew.length >= st.berths;
        return `<div class="stat"><div><small>Your crew</small><b>${s.crew.length} / ${st.berths} berths</b></div><div><small>Morale</small><b>${moraleWord(s.morale)}</b></div></div><p>Sailors looking for a ship. Each has a trade. Green hands are cheap; veterans cost far more and do far more. New faces drift in every so often.</p>`
          + (list.length ? list.map((o, i) => row(`${esc(o.name)} · ${GRADES[o.g].name} ${HANDS[o.role].name}`, HANDS[o.role].perk(GRADES[o.g].k), `${costHtml({ gold: hireCost(o) })}${btn('Hire', 'hire', i, 'go', full || s.gold < hireCost(o))}`)).join('') : '<p class="note">Nobody else is looking for work here right now. Try another port, or come back later.</p>')
          + (full ? '<p class="note">Every berth is taken. Fit crew berths at a shipwright, build Crew Quarters at your hideout, buy a bigger ship, or dismiss someone (Menu, Crew).</p>' : '');
      },
      Bounties() {
        const s = S();
        return '<p>Named captains with a price on them. Take one poster at a time. Each returns stronger, and worth more, after you collect.</p>'
          + BOUNTIES.map((b) => { const n = s.bountyDone[b.id] || 0, pay = Math.round(b.gold * (1 + 0.25 * n)), on = s.bounty && s.bounty.id === b.id;
            return row(`${esc(b.captain)}${n ? ` (collected ${n}x)` : ''}`, `Sails the ${esc(b.ship)}, a ${b.cls} with ${b.guns} guns a side.`, `<span class="cost">${pay} gold</span>${on ? btn('Drop', 'dropbounty', '', 'bad') : s.level < b.level ? `<span class="cost no">Rank ${b.level}</span>` : btn('Hunt', 'bounty', b.id, 'go', !!s.bounty)}`); }).join('');
      },
      Jobs(p) {
        const s = S(), o = game.quests.objective(), f = PORT_FACTION[p.isl.id], cold = s.rep[f] <= -20, offers = cold ? [] : game.quests.offers(p.isl.id);
        const repText = (j) => Object.entries(j.rep || {}).filter(([, v]) => v > 0).map(([k, v]) => `+${v} ${FACTIONS[k].name}`).join(' · ');
        return `<h3>${esc(o.title)}</h3><p>${esc(o.text)}</p><p class="note">${esc(o.short)}</p>
          <h3>On the board</h3>${cold ? `<p class="note">"Not for you. The ${FACTIONS[f].name} want nothing to do with you." Raise your standing with them first (Menu, Factions).</p>` : offers.map((j, i) => row(esc(j.title), `${esc(j.text)}${repText(j) ? `<i>${repText(j)}</i>` : ''}`, `<span class="cost">${rewardText(j.reward)}</span>${btn('Take', 'accept', i, 'go')}`)).join('')}
          ${s.jobs.length ? `<h3>Your jobs</h3>${s.jobs.map((j) => row(esc(j.title), esc(game.quests.shortText(j.obj) + game.quests.progress(j.obj, j.n)), btn('Drop', 'abandon', j.id, 'bad'))).join('')}` : ''}`;
      },
      Bar(p) {
        const s = S(), bounty = bribeCost(s), port = p.isl.id;
        const full = storesFull(s), sc = storesCost(s);
        return row('Fill the stores', `Food ${Math.floor(s.food)}/${full.food} · Water ${Math.floor(s.water)}/${full.water} · Limes ${Math.floor(s.limes)}/${full.limes}. The crew eat and drink while you sail. Run dry and morale falls; no limes brings scurvy.`, `${costHtml({ gold: sc })}${btn('Fill', 'stores', '', 'go', !sc || s.gold < 1)}`)
          + row('Bottle of rum', `Drink in a fight to close your wounds. You carry ${s.rum}.`, `${costHtml({ gold: 30 })}${btn('Buy', 'rum', '', '', s.gold < 30 || s.rum >= 9)}`)
          + row('A stained chart', `Someone's buried secret. You hold ${s.maps.length} of 3 maps.`, `${costHtml({ gold: 220 })}${btn('Buy', 'chart', '', '', s.gold < 220 || s.maps.length >= 3)}`)
          + Object.entries(PETS).filter(([k, d]) => d.port === port && !s.pets[k]).map(([k, d]) => row(d.name, d.perk, `${costHtml({ gold: d.price })}${btn('Buy', 'pet', k, 'go', s.gold < d.price)}`)).join('')
          + (bounty > 0 ? row('Bribe the harbour clerk', `Cools the Royal Navy toward you (now ${standing(s.rep.navy)}, ${s.rep.navy}).`, `${costHtml({ gold: bounty })}${btn('Pay', 'bribe', '', '', s.gold < bounty)}`) : '')
          + (s.hostages.length ? `<h3>Prisoners in your brig</h3>${s.hostages.map((h, i) => { const d = ransomDeal(port, h); return row(`Captain of the ${esc(h.from)}`, d.text, `<span class="cost">${d.gold} gold</span>${btn(d.label, 'ransom', i, 'go')}`); }).join('')}` : '')
          + `<p class="note" style="margin-top:12px">"Sink a ship and they will fear your name. Board her and you keep the whole cargo. And a captain in irons is worth more than his sword."</p>`;
      },
    },
    shipwright: {
      tabs: ['Refit', 'Armoury', 'Ships', 'Colours'],
      Armoury() {
        const s = S();
        return '<p>Your broadside fires whatever is loaded. Switch shot at sea with the shot button beside FIRE. Fitting the guns for a special shot is the dear part; after that you buy it by the keg. Each gun fired uses one.</p>'
          + Object.entries(AMMO).map(([k, a]) => row(a.name, a.desc, k === 'round' ? '<span class="cost">Never runs out</span>' : s.armory[k] ? `<span class="cost">${s.ammo[k] || 0} aboard<br>${AMMO_PACK[k].n} for ${AMMO_PACK[k].gold} gold</span>${btn('Buy', 'keg', k, 'go', s.gold < AMMO_PACK[k].gold || (s.ammo[k] || 0) >= 200)}` : `${costHtml(a)}${btn('Fit', 'ammo', k, 'go', !can(s, a))}`)).join('')
          + row(SWIVEL.name, SWIVEL.desc, s.swivel ? '<span class="cost">Fitted</span>' : `${costHtml(SWIVEL)}${btn('Fit', 'swivel', '', 'go', !can(s, SWIVEL))}`);
      },
      Refit() {
        const s = S(), st = shipStats(s), rc = repairCost(s);
        return `<div class="stat"><div><small>Hull</small><b>${Math.round(s.ship.hp * st.maxHp)} / ${st.maxHp}</b></div><div><small>Speed</small><b>${(st.speed * 1.2).toFixed(1)} kn</b></div><div><small>Guns a side</small><b>${st.guns}</b></div><div><small>Hold</small><b>${st.cargo}</b></div><div><small>Hands</small><b>${st.crew} / ${st.berths}</b></div><div><small>Brig cells</small><b>${st.brig}</b></div></div>`
          + row('Repair the hull', rc ? 'Patch every hole and scrape the keel. Bigger and better-fitted ships cost more to mend.' : 'She is sound.', `${costHtml({ gold: rc })}${btn('Repair', 'repair', '', 'go', !rc || s.gold < rc)}`)
          + Object.entries(SHIP_UPGRADES).map(([k, u]) => { const lv = s.ship.up[k], c = upgradeCost(s, k), full = lv >= MAX_UPGRADE; return row(`${u.name}${pips(lv, MAX_UPGRADE)}`, u.desc, full ? '<span class="cost">Complete</span>' : `${costHtml(c)}${btn('Fit', 'upgrade', k, '', !can(s, c))}`); }).join('');
      },
      Ships() {
        const s = S();
        return Object.entries(SHIP_CLASSES).map(([k, c]) => {
          const owned = !!s.owned[k], cur = s.ship.cls === k, locked = s.level < c.level;
          const right = cur ? '<span class="cost">Your ship</span>' : owned ? btn('Sail her', 'switch', k, 'go') : locked ? `<span class="cost no">Rank ${c.level} needed</span>` : `${costHtml({ gold: c.price })}${btn('Buy', 'buyship', k, 'go', s.gold < c.price)}`;
          return row(`${c.name} · ${c.role}`, `${c.guns} guns a side · hull ${c.hp} · ${(c.speed * 1.2).toFixed(0)} kn · hold ${c.cargo} · ${c.berths} berths`, right);
        }).join('') + '<p class="note" style="margin-top:12px">Upgrades stay with the hull they were fitted to.</p>';
      },
      Colours() { const s = S(); return `<p>Choose your sailcloth. Purely for show.</p><div class="swatches">${Object.entries(SAIL_COLORS).map(([k, c]) => `<button type="button" data-do="sail" data-arg="${k}" class="${s.ship.sail === k ? 'on' : ''}" style="background:#${c.toString(16).padStart(6, '0')}" aria-label="${k} sails"></button>`).join('')}</div>`; },
    },
    smith: {
      tabs: ['Blades', 'Firearms'],
      Blades() { const s = S(); return SWORDS.map((w, i) => row(w.name, `${w.dmg} damage a stroke`, i === s.sword ? '<span class="cost">In hand</span>' : i < s.sword ? '<span class="cost">Owned</span>' : `${costHtml(w)}${btn('Forge', 'sword', i, '', !can(s, w))}`)).join(''); },
      Firearms() { const s = S(); return row(`${BOMB.name} (you carry ${s.bombs} of ${BOMB.max})`, BOMB.desc, `${costHtml(BOMB)}${btn('Buy', 'flask', '', 'go', s.gold < BOMB.gold || s.bombs >= BOMB.max)}`) + GUNS.map((w, i) => row(w.name, `${w.dmg} damage · ${w.reload.toFixed(1)}s reload`, i === s.gun ? '<span class="cost">In hand</span>' : i < s.gun ? '<span class="cost">Owned</span>' : `${costHtml(w)}${btn('Buy', 'gun', i, '', !can(s, w))}`)).join(''); },
    },
    market: {
      tabs: [],
      main(p) {
        const s = S(), port = p.isl.id, cap = shipStats(s).cargo, used = cargoUsed(s);
        return `<p>Hold: <b>${used} / ${cap}</b>${s.questCargo ? ` (${s.questCargo} is job cargo)` : ''} · Gold: <b style="color:var(--gold)">${s.gold}</b></p><table class="goods"><tr><th>Goods</th><th>Have</th><th>Buy</th><th></th><th>Sell</th><th></th></tr>${Object.keys(GOODS).map((g) => { const have = s.cargo[g] || 0, bp = buyPrice(port, g), sp = sellPrice(port, g); return `<tr><td>${GOODS[g].name}</td><td>${have}</td><td>${bp}</td><td>${btn('+1', 'buy', g, '', s.gold < bp || used >= cap)}</td><td>${sp}</td><td>${btn('All', 'sell', g, 'go', !have)}</td></tr>`; }).join('')}</table><p class="note" style="margin-top:10px">Prices differ in every port. Buy where it is cheap, sell where it is dear.</p>`;
      },
    },
    build: {
      tabs: [],
      main(p) {
        const s = S(), b = BUILDINGS[p.id], lv = s.base.b[p.id] || 0, c = buildingCost(s, p.id), full = lv >= MAX_BUILDING, pend = pending(s);
        return `<p>${b.desc}</p><div class="stat"><div><small>Level</small><b>${lv} / ${MAX_BUILDING}</b></div><div><small>Now</small><b>${lv ? b.fx(lv) : 'Not built'}</b></div>${full ? '' : `<div><small>Next</small><b>${b.fx(lv + 1)}</b></div>`}</div>`
          + (full ? '<p class="note">Fully built.</p>' : row(lv ? 'Upgrade' : 'Build', 'Paid from your stores.', `${costHtml(c)}${btn(lv ? 'Upgrade' : 'Build', 'build', p.id, 'go', !can(s, c))}`))
          + `<p class="note" style="margin-top:12px">The cove works while you are away, up to ${PROD_CAP_HOURS} hours. Waiting to collect: ${pend.gold} gold, ${pend.timber} timber, ${pend.iron} iron.</p>`;
      },
    },
    menu: {
      tabs: ['Menu', 'Quests', 'Command', 'Skills', 'Orders', 'Deeds', 'Captain', 'Gear', 'Ship', 'Crew', 'Pets', 'Factions', 'Flags', 'Friends', 'Help', 'Settings'],
      Menu() {
        const s = S(), st = shipStats(s), o = game.quests.objective(), d = game.quests.daily(), ready = d.tasks.filter((t) => t.n >= t.goal && !t.claimed).length + (d.login ? 0 : 1), deeds = DEEDS.filter((x) => !s.deeds[x.id] && x.stat(s) >= x.goal).length;
        const tile = (tab, ic, sub, hot) => `<button type="button" class="tile${hot ? ' hot' : ''}" ${tab === 'Map' ? 'data-do="map"' : `data-tab="${tab}"`}>${svg(ic)}<b>${tab}</b><small>${esc(sub)}</small></button>`;
        return `<div class="tiles">${[
          tile('Quests', 'quest', o.title), tile('Map', 'map', 'Chart, legend, set a course'), tile('Orders', 'quest', ready ? `${ready} to claim` : `Day ${d.streak} · ${d.tasks.filter((t) => t.claimed).length}/3 done`, ready > 0), tile('Deeds', 'chest', deeds ? `${deeds} to claim` : `${Object.keys(s.deeds).length} of ${DEEDS.length} done`, deeds > 0), tile('Captain', 'person', `Rank ${s.level} ${RANKS[Math.min(RANKS.length - 1, s.level - 1)]}`), tile('Skills', 'sword', skillPoints(s) > 0 ? `${skillPoints(s)} points to spend` : 'Your skill tree', skillPoints(s) > 0),
          tile('Gear', 'sword', SWORDS[s.sword].name), tile('Ship', 'ship', `${st.cls.name} · hull ${Math.round(s.ship.hp * 100)}%`), tile('Crew', 'crew', `${s.crew.length}/${st.berths} hands · ${s.hostages.length}/${st.brig} prisoners`), tile('Command', 'anchor', `${STATIONS[s.station].name} · crew ${moraleWord(s.morale).toLowerCase()}`, s.morale < 25),
          tile('Pets', 'paw', s.pet ? PETS[s.pet].name : 'None with you'), tile('Factions', 'scales', isWanted(s) ? `Navy: ${standing(s.rep.navy)}` : 'Who trusts you', isWanted(s)), tile('Flags', 'flag', `Flying: ${FLAGS[s.flag]}`),
          tile('Friends', 'friends', 'Comes with online play'), tile('Help', 'talk', 'How to play'), tile('Settings', 'gear', 'Sound, graphics, backup'),
        ].join('')}</div>`;
      },
      Quests() { const s = S(), o = game.quests.objective(); return `<h3>Story: ${esc(o.title)}</h3><p>${esc(o.text)}</p><p class="note">Next: ${esc(o.short)}</p><h3>Jobs (${s.jobs.length} of 3)</h3>${s.jobs.length ? s.jobs.map((j) => row(esc(j.title), esc(game.quests.shortText(j.obj) + game.quests.progress(j.obj, j.n)), `<span class="cost">${rewardText(j.reward)}</span>${btn('Drop', 'abandon', j.id, 'bad')}`)).join('') : '<p class="note">None taken. Tavern keepers in every port post work on their boards.</p>'}<p style="margin-top:12px">${btn('Open the chart', 'map', '', 'go')}</p>`; },
      Captain() {
        const s = S(), ps = playerStats(s), l = s.look, hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
        const sw = (key, opts) => `<div class="swatches">${Object.entries(opts).map(([k, c]) => `<button type="button" data-do="look" data-arg="${key}:${k}" class="${String(l[key]) === k ? 'on' : ''}" style="background:${hex(c)}" aria-label="${key} ${k}"></button>`).join('')}</div>`;
        return `<div class="stat"><div><small>Rank ${s.level}</small><b>${RANKS[Math.min(RANKS.length - 1, s.level - 1)]}</b></div><div><small>Infamy</small><b>${s.xp} / ${xpFor(s.level)}</b></div><div><small>Health</small><b>${ps.maxHp}</b></div><div><small>Ships sunk</small><b>${s.stats.sunk}</b></div><div><small>Ships boarded</small><b>${s.stats.boarded}</b></div><div><small>Foes slain</small><b>${s.stats.kills}</b></div><div><small>Treasures dug</small><b>${s.stats.dug}</b></div></div>`
          + `<h3>Coat</h3>${sw('coat', LOOK_OPTS.coat)}<h3>Sash</h3>${sw('sash', LOOK_OPTS.sash)}<h3>Skin</h3>${sw('skin', LOOK_OPTS.skin)}<h3>Hat</h3><div class="choices">${Object.entries(LOOK_OPTS.hat).map(([k, n]) => btn(n, 'look', `hat:${k}`, l.hat === k ? 'go' : '')).join('')}</div>`;
      },
      Gear() {
        const s = S(), w = SWORDS[s.sword], g = GUNS[s.gun], nw = SWORDS[s.sword + 1], ng = GUNS[s.gun + 1];
        return `<h3>Weapons</h3>${row(w.name, `Blade · ${w.dmg} damage a stroke${nw ? ` · next: ${nw.name} (${costText(nw)})` : ' · the finest there is'}`, '<span class="cost">In hand</span>')}${row(g.name, `Firearm · ${g.dmg} damage · ${g.reload.toFixed(1)}s reload${ng ? ` · next: ${ng.name} (${costText(ng)})` : ' · the finest there is'}`, '<span class="cost">In hand</span>')}<p class="note">Blacksmiths in every port forge better blades and sell firearms.</p>`
          + `<h3>Carried</h3><div class="stat"><div><small>Rum</small><b>${s.rum}</b></div><div><small>Gold</small><b>${s.gold}</b></div><div><small>Timber</small><b>${s.timber}</b></div><div><small>Iron</small><b>${s.iron}</b></div></div>`
          + `<h3>Treasure maps (${s.maps.length} of 3)</h3>${s.maps.length ? `<div class="maps">${s.maps.map((m, i) => `<figure><canvas class="chart" data-map="${i}" width="360" height="360"></canvas><figcaption>${ISLAND[m.island].name}. The X marks it; the anchor marks the landing.</figcaption></figure>`).join('')}</div>` : '<p class="note">None. Taverns sell them, and bottles drift at sea.</p>'}`;
      },
      Ship() {
        const s = S(), st = shipStats(s), cargo = Object.keys(s.cargo).filter((g) => s.cargo[g]);
        return `<div class="stat"><div><small>${st.cls.name}</small><b>Hull ${Math.round(s.ship.hp * st.maxHp)} / ${st.maxHp}</b></div><div><small>Speed</small><b>${(st.speed * 1.2).toFixed(1)} kn</b></div><div><small>Guns a side</small><b>${st.guns}</b></div><div><small>Hold</small><b>${cargoUsed(s)} / ${st.cargo}</b></div><div><small>Boarders</small><b>${st.crew}</b></div><div><small>Brig cells</small><b>${st.brig}</b></div></div>`
          + `<h3>Shot</h3>${Object.entries(AMMO).map(([k, a]) => row(a.name, a.desc, k !== 'round' && !s.armory[k] ? '<span class="cost no">Not aboard</span>' : s.shot === k ? '<span class="cost">Loaded</span>' : btn('Load', 'shot', k, 'go'))).join('')}${row(SWIVEL.name, SWIVEL.desc, s.swivel ? '<span class="cost">Fitted</span>' : '<span class="cost no">Not fitted</span>')}`
          + `<h3>Fittings</h3>${Object.entries(SHIP_UPGRADES).map(([k, u]) => row(`${u.name}${pips(s.ship.up[k], MAX_UPGRADE)}`, u.desc, '')).join('')}<p class="note">Shipwrights in every port sell shot, fittings, repairs and larger ships.</p>`
          + `<h3>In the hold</h3><p>${cargo.length ? cargo.map((g) => `${s.cargo[g]} ${GOODS[g].name.toLowerCase()}`).join(', ') : 'Empty.'}${s.questCargo ? ` Plus ${s.questCargo} crates of job cargo.` : ''}</p>`;
      },
      Crew() {
        const s = S(), st = shipStats(s), b = crewBonus(s), n = s.crew.filter((h) => h.ashore).length, pct = (v) => Math.round(v * 100);
        return `<div class="stat"><div><small>Hands</small><b>${s.crew.length} / ${st.berths}</b></div><div><small>Morale</small><b>${moraleWord(s.morale)}</b></div><div><small>Landing party</small><b>${Math.min(3, n)} / 3</b></div><div><small>Brig</small><b>${s.hostages.length} / ${st.brig}</b></div></div>`
          + `<p>Crew adds: cannons +${pct(b.dmg)}%, reload +${pct(b.reload)}%, speed +${pct(b.speed)}%, hull mending ${b.repair.toFixed(1)}/s, plunder +${pct(b.loot)}%. Up to eight hands board beside you. Up to three you pick go ashore with you. If one dies, he is gone and morale drops. Hire more at any tavern (Hands).</p>`
          + (s.crew.length ? s.crew.map((h) => row(`${esc(h.name)} · ${GRADES[h.g].name} ${HANDS[h.role].name}`, HANDS[h.role].perk(GRADES[h.g].k), `${btn(h.ashore ? 'Ashore ✓' : 'Ashore', 'ashore', h.id, h.ashore ? 'go' : '', !h.ashore && n >= 3)}${btn('Dismiss', 'dismiss', h.id, 'bad')}`)).join('') : '<p class="note">You sail alone. Taverns have hands for hire.</p>')
          + `<h3>Prisoners</h3>${s.hostages.length ? s.hostages.map((h) => row(`Captain of the ${esc(h.from)}`, 'Ransom him at any tavern. Some ports pay more, or pay in favour.', `<span class="cost">about ${h.value} gold</span>`)).join('') : `<p class="note">${st.brig ? 'The cells are empty. Board a ship, or accept a surrender and take a prisoner.' : 'No brig yet. A shipwright can fit cells (Refit, Brig cells) so you can take captains for ransom.'}</p>`}`;
      },
      Skills() {
        const s = S(), pts = skillPoints(s), sel = ui.treeSel, Y = (y) => 12.5 + y * 25;
        let out = `<div class="stat"><div><small>Rank</small><b>${s.level}</b></div><div><small>Points to spend</small><b>${pts}</b></div></div><p>Each rank earns ${POINTS_PER_RANK} points. Start at the top star of a constellation and work down a fork. Deeper stars cost more. Tap a star to read it.</p>`;
        for (const b in TREE_BRANCH) {
          const ids = Object.keys(TREE).filter((k) => TREE[k].b === b);
          out += `<h3>${TREE_BRANCH[b]}</h3><div class="tree"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${ids.filter((k) => TREE[k].req).map((k) => { const n = TREE[k], p = TREE[n.req], lit = nodeRank(s, k) > 0; return `<path d="M${p.x} ${Y(p.y)} C${p.x} ${Y(p.y) + 12} ${n.x} ${Y(n.y) - 12} ${n.x} ${Y(n.y)}" fill="none" stroke="${lit ? '#e9c46a' : nodeOpen(s, k) ? '#8a8672' : '#3a4448'}" stroke-width="${lit ? 2 : 1.2}" vector-effect="non-scaling-stroke"/>`; }).join('')}</svg>`
            + ids.map((k) => { const n = TREE[k], r = nodeRank(s, k), open = nodeOpen(s, k), max = n.cost.length, next = n.cost[r]; return `<button type="button" class="node${r ? ' owned' : ''}${!open ? ' locked' : r < max && pts >= next ? ' can' : ''}${sel === k ? ' sel' : ''}" style="left:${n.x}%;top:${Y(n.y)}%" data-do="node" data-arg="${k}">${esc(n.name)}<small>${r}/${max}${r < max ? ` · ${next} pt${next > 1 ? 's' : ''}` : ' · done'}</small></button>`; }).join('') + '</div>';
          if (sel && TREE[sel].b === b) { const n = TREE[sel], r = nodeRank(s, sel), max = n.cost.length, open = nodeOpen(s, sel); out += `<div class="nodeinfo"><b>${esc(n.name)}</b> (${r}/${max})<br>${esc(n.desc)}${!open ? `<br><i>Needs ${TREE[n.req].name} at rank ${n.need}.</i>` : ''}<p>${r >= max ? '<span class="cost">Mastered</span>' : btn(`Learn for ${n.cost[r]} point${n.cost[r] > 1 ? 's' : ''}`, 'learn', sel, 'go', !open || pts < n.cost[r])}</p></div>`; }
        }
        return out;
      },
      Command() {
        const s = S(), sea = game.sea, n = Math.max(1, s.crew.length), rumN = Math.ceil(n / 2), share = 25 * n, cargo = Object.values(s.cargo).reduce((a, c) => a + c, 0);
        return `<div class="stat"><div><small>Morale</small><b>${moraleWord(s.morale)} (${Math.round(s.morale)})</b></div><div><small>Hands</small><b>${s.crew.length}</b></div><div><small>Food</small><b>${Math.floor(s.food)}</b></div><div><small>Water</small><b>${Math.floor(s.water)}</b></div><div><small>Limes</small><b>${Math.floor(s.limes)}${s.scurvy > 9 ? ' (scurvy!)' : ''}</b></div></div><div class="bar2"><i style="width:${Math.round(s.morale)}%"></i></div><p>A happy crew sails faster and loads quicker. Wins raise morale. Lost hands, sinking and defeat lower it. Below 20 hands desert in port. At zero they mutiny. Keep food, water and limes aboard: fill the stores at any tavern.</p>`
          + '<h3>Stations</h3>' + Object.entries(STATIONS).map(([k, d]) => row(d.name, d.desc, btn(game.sea.stn && game.sea.stn.k === k ? 'Moving…' : s.station === k && !game.sea.stn ? 'Set ✓' : 'Order', 'station', k, s.station === k && !game.sea.stn ? 'go' : ''))).join('')
          + '<h3>Orders</h3>'
          + row('Fire at will', 'Gunners fire the broadside themselves whenever an enemy bears. Works while you walk the deck too.', btn(s.atWill ? 'On ✓' : 'Off', 'atwill', '', s.atWill ? 'go' : ''))
          + row('Double-shot the guns', 'Next broadside hits 60% harder, but scatters and takes longer to reload.', btn(sea.double ? 'Loaded ✓' : 'Load', 'dshot', '', sea.double ? 'go' : '', !!sea.double))
          + row('Brace for impact', 'Halves damage to the hull for 10 seconds.', btn(sea.braceT > 0 ? 'Braced ✓' : sea.braceCd > 0 ? `${Math.ceil(sea.braceCd)}s` : 'Brace', 'brace', '', '', sea.braceCd > 0))
          + row('Lighten ship', `Throw all ${cargo} cargo overboard to run 20% faster for a while.`, btn('Jettison', 'lighten', '', 'bad', cargo < 1))
          + row('Rum ration', `Break out ${rumN} rum for the hands. Morale +12. You carry ${s.rum}.`, btn('Pour', 'ration', '', '', s.rum < rumN || s.morale >= 100))
          + row('Share out the plunder', `${share} gold between the hands. Morale +20.`, `${costHtml({ gold: share })}${btn('Pay', 'share', '', '', s.gold < share || s.morale >= 100)}`);
      },
      Pets() {
        const s = S();
        return '<p>One companion sails with you at a time.</p>' + Object.entries(PETS).map(([k, d]) => row(d.name, s.pets[k] ? d.perk : `${d.perk} <i>${d.how}</i>`, !s.pets[k] ? '<span class="cost no">Not found yet</span>' : s.pet === k ? `<span class="cost">With you</span>${btn('Leave', 'takepet', '')}` : btn('Take along', 'takepet', k, 'go'))).join('');
      },
      Factions() {
        const s = S(), b = bribeCost(s);
        return '<p>At <b>Hostile</b> a faction attacks on sight and its port gives you no work. At <b>Hunted</b> the navy sends hunters that outgun you.</p>'
          + Object.entries(FACTIONS).map(([k, f]) => `<div class="row col"><div><b>${f.name} · ${standing(s.rep[k])} (${s.rep[k]})</b><div class="meter"><i style="left:${(s.rep[k] + 100) / 2}%"></i></div><small>${f.blurb}</small></div></div>`).join('')
          + (b > 0 ? `<p class="note">A tavern clerk will take ${b} gold to cool the navy down.</p>` : '');
      },
      Flags() {
        const s = S(), prev = (kind) => `<img class="flagPrev" alt="" src="${flagTexture(kind, s.jolly).image.toDataURL()}">`;
        const fx = { pirate: 'Your true colours. 25% more infamy, and crews lose their nerve sooner. Everyone knows what you are.', merchant: 'The navy takes you for a trader and leaves you be, until you come close.', navy: 'Navy ships take you for one of their own, until you come close.', bloodwater: 'Bloodwater ships take you for one of the gang, until you come close.' };
        return '<p>Fly false colours to slip past. Any ship that gets close may see through it, and firing your guns gives you away at once.</p>'
          + Object.entries(FLAGS).map(([k, n]) => `<div class="row">${prev(k)}<div><b>${n}</b><small>${fx[k]}</small></div>${k !== 'pirate' && !s.flags[k] ? '<span class="cost no">Board one of their ships to take it</span>' : s.flag === k ? '<span class="cost">Flying</span>' : btn('Hoist', 'flag', k, 'go')}</div>`).join('')
          + `<h3>Your colours</h3><div class="swatches">${Object.entries(JOLLY.field).map(([k, c]) => `<button type="button" data-do="jolly" data-arg="field:${k}" class="${s.jolly.field === k ? 'on' : ''}" style="background:${c}" aria-label="${k} field"></button>`).join('')}</div><div class="choices" style="margin-top:10px">${Object.entries(JOLLY.emblem).map(([k, n]) => btn(n, 'jolly', `emblem:${k}`, s.jolly.emblem === k ? 'go' : '')).join('')}</div>`;
      },
      Friends() { return '<p>Friends, crews and raiding other captains arrive with online play. That needs accounts and servers, which come after the solo game is deeper.</p><p class="note">Your captain, ship and hideout are saved on this device and will carry over when online play arrives.</p>'; },
      Orders() {
        const d = game.quests.daily(), dr = game.quests.dailyReward(), all = d.tasks.every((t) => t.claimed);
        return `<p>Three new orders every day. Come back on consecutive days to build your streak.</p>`
          + row(`Day ${d.streak} at sea`, 'Your share for turning up. Bigger each day, with a purse every seventh.', d.login ? '<span class="cost">Taken</span>' : `<span class="cost">${rewardText(game.quests.loginReward())}</span>${btn('Claim', 'login', '', 'go')}`)
          + d.tasks.map((t, i) => row(esc(game.quests.dailyText(t)), `${Math.min(t.n, t.goal)} of ${t.goal}`, t.claimed ? '<span class="cost">Done</span>' : `<span class="cost">${rewardText(dr)}</span>${btn('Claim', 'daily', i, 'go', t.n < t.goal)}`)).join('')
          + row("Finish all three", 'A bonus chest for clearing the day.', d.bonus ? '<span class="cost">Taken</span>' : `<span class="cost">${rewardText(game.quests.bonusReward())}</span>${btn('Claim', 'bonus', '', 'go', !all)}`);
      },
      Deeds() {
        const s = S();
        return '<p>Long goals. Each pays once.</p>' + DEEDS.map((d) => { const n = Math.min(d.stat(s), d.goal), done = n >= d.goal;
          return row(`${d.name}${s.deeds[d.id] ? ' ✓' : ''}`, `${d.text} · ${n} of ${d.goal}`, s.deeds[d.id] ? '<span class="cost">Claimed</span>' : `<span class="cost">${rewardText(d.reward)}</span>${btn('Claim', 'deed', d.id, 'go', !done)}`); }).join('');
      },
      Help() {
        return '<h3>At sea</h3><p>Steer with the left thumb. SAIL and REEF set your speed. FIRE shoots the side facing your target, so turn until she sits off your beam. On open water at full sail the trade winds speed you up.</p>'
          + '<h3>Taking ships</h3><p><b>Sink</b> for the most infamy and little loot. <b>Board</b> (hull under 42%, pull alongside) for all the loot. Break their nerve and they <b>surrender</b>: fire shot and your black flag help. Chain shot stops runners. Hooks board from range.</p>'
          + '<h3>On foot</h3><p>STRIKE chains three blows. WHIRL spins and cuts everyone around you. Powder flasks burst on a group. Hold BLOCK just before a hit to parry and stagger. A red mark means block or parry; an orange mark means DODGE. SHOOT is one strong shot on a long reload. Rum heals.</p>'
          + '<h3>Getting richer</h3><p>Story chapters and tavern jobs pay best early. Buy goods where they are cheap and sell where they are dear (tap a port on the chart). Build the hideout: it earns while you are away. Daily orders, deeds and bounties never run out.</p>'
          + '<h3>Staying alive</h3><p>Watch your standing in Factions. A Wanted captain is attacked by the navy; a Hunted one is chased by ships that outgun him. Bribe a clerk, do navy jobs, or fly false colours.</p>';
      },
      Settings(p) {
        const g = S().gfx, code = p.backup ? exportSave(S()) : '';
        return row('Sound', 'Everything: cannon, steel, surf and music.', btn(S().muted ? 'Turn on' : 'Turn off', 'mute'))
          + row('Full screen', 'Hide the browser bars. On iPhone, use Share, then Add to Home Screen instead: the game then opens with no bars at all.', btn(document.fullscreenElement ? 'Leave' : 'Go full screen', 'fullscreen'))
          + row('Music', 'Fiddle and drum. Changes for sailing, towns, night and battle.', btn(S().music === false ? 'Turn on' : 'Turn off', 'music'))
          + row('Graphics', { auto: 'Auto: lowers sharpness by itself if the phone struggles.', low: 'Low: fastest. Softer picture, fewer particles.', high: 'High: sharpest picture, always.' }[g], btn({ auto: 'Auto', low: 'Low', high: 'High' }[g], 'gfx'))
          + row('Start over', 'Erases this voyage for good.', p.confirm ? `${btn('Yes, erase', 'wipe', '', 'bad')}${btn('Keep', 'nowipe')}` : btn('New voyage', 'askwipe', '', 'bad'))
          + `<h3>Backup</h3><p>Your voyage lives on this device only. A backup code lets you keep it safe or move it to another device.</p>${p.backup ? `<textarea id="backupOut" class="code" rows="3" readonly>${code}</textarea><p>${btn('Copy code', 'copy', '', 'go')}</p>` : `<p>${btn('Show my backup code', 'backup')}</p>`}<textarea id="backupIn" class="code" rows="2" placeholder="Paste a backup code here to restore it"></textarea><p>${btn('Restore from code', 'restore', '', 'bad')}</p>`
          + '<h3>Controls</h3><p><b>Touch:</b> left thumb steers the ship and moves on foot. Drag anywhere else to look. Flick the stick up or down to set sail. Tap the compass for the chart.</p><p><b>Keys:</b> WASD move · Space fire or strike · Q block · Shift dodge · F shoot · R rum · E use · X / Z sails · C change shot · V swivel gun · M menu · N chart.</p>';
      },
    },
    welcome: {
      tabs: [],
      main(p) {
        const d = game.quests.daily(), o = game.quests.objective(), w = p.pend, cove = w.gold + w.timber + w.iron > 0;
        return `<h3>Day ${d.streak} at sea</h3>` + row('Your share for today', 'Come back tomorrow for a bigger one.', d.login ? '<span class="cost">Taken</span>' : `<span class="cost">${rewardText(game.quests.loginReward())}</span>${btn('Claim', 'login', '', 'go')}`)
          + (cove ? `<p>Your cove has been working: <b>${[w.gold && `${w.gold} gold`, w.timber && `${w.timber} timber`, w.iron && `${w.iron} iron`].filter(Boolean).join(', ')}</b> waits at Rogue's Rest.</p>` : '')
          + `<h3>Where you left off</h3><p><b>${esc(o.title)}.</b> ${esc(o.short)}</p><h3>Today's orders</h3>${d.tasks.map((t) => `<p>${t.claimed ? '✓' : '•'} ${esc(game.quests.dailyText(t))} (${Math.min(t.n, t.goal)}/${t.goal})</p>`).join('')}<p>${btn('Set sail', 'closepanel', '', 'go')}</p>`;
      },
    },
    prize: {
      tabs: [],
      main(p) {
        const s = S(), sh = p.ship, room = s.hostages.length < shipStats(s).brig;
        return `<p>The ${esc(sh.name)} has struck her colours. Her crew stand with their hands open.</p>`
          + row('Take the cargo, spare the crew', 'Most of her cargo, a little infamy, and the least ill will. She sails away.', btn('Spare', 'prize', 'spare', 'go'))
          + row('Take the cargo and her captain', room ? 'The same cargo, plus a prisoner to ransom. Her faction will resent it more.' : 'You have no free brig cell. Shipwrights fit them.', btn('Take him', 'prize', 'prisoner', '', !room))
          + row('Sink her anyway', 'The most infamy, the least loot, and the worst reputation.', btn('Sink', 'prize', 'sink', 'bad'));
      },
    },
  };
  // what a port will give for a prisoner
  // ----- tavern games -----
  const total = (cards) => { let t = 0, aces = 0; for (const c of cards) { t += c.r > 10 ? 10 : c.r === 1 ? 11 : c.r; if (c.r === 1) aces++; } while (t > 21 && aces) { t -= 10; aces--; } return t; };
  function settle(mult, msg) { const s = S(), g = ui.g, d = Math.round(g.bet * mult); s.gold = Math.max(0, s.gold + d); g.over = msg; if (d > 0) { audio.coin(); s.stats.gambled = (s.stats.gambled || 0) + d; } else if (d < 0) audio.bad(); }
  function hireOffers(port) {
    const s = S();
    if (!s.hire || s.hire.port !== port || Date.now() - s.hire.t > 10 * 60000) {
      const roles = Object.keys(HANDS), list = [];
      for (let i = 0; i < 5; i++) { const r = Math.random(), g = r < 0.5 ? 0 : r < 0.85 || s.level < 3 ? 1 : 2; list.push(makeHand(i === 0 ? 'deckhand' : roles[1 + Math.floor(Math.random() * (roles.length - 1))], i === 0 ? 0 : g)); }
      s.hire = { port, t: Date.now(), list };
    }
    return s.hire.list;
  }
  function ransomDeal(port, h) {
    if (port === 'regal' && h.faction === 'pirate') return { label: 'Hand over', gold: Math.round(h.value * 0.6), rep: { navy: 18, guild: 5 }, text: 'The navy pays a bounty for Bloodwater captains and thinks better of you.' };
    if (port === 'shoals' && h.faction === 'navy') return { label: 'Sell', gold: Math.round(h.value * 1.25), rep: { smug: 8, blood: 14, navy: -6 }, text: 'The smugglers pass navy officers to the Bloodwater for a fat price.' };
    if (port === 'regal' && h.faction === 'navy') return { label: 'Return', gold: Math.round(h.value * 0.5), rep: { navy: 10 }, text: 'Hand the officer back. A small purse and some goodwill.' };
    return { label: 'Ransom', gold: h.value, rep: {}, text: 'His friends will pay to have him back.' };
  }

  const ACTIONS = {
    accept(i, p) { const err = game.quests.accept(p.isl.id, +i); if (err) ui.toast(err, 'warn'); else audio.good(); },
    abandon(id) { game.quests.abandon(id); },
    rum() { if (pay(S(), { gold: 30 })) { S().rum++; audio.coin(); } },
    hire(i) { const s = S(), o = s.hire.list[+i]; if (!o || s.crew.length >= shipStats(s).berths || !pay(s, { gold: hireCost(o) })) return; s.hire.list.splice(+i, 1); o.ashore = (HANDS[o.role].land || o.role === 'deckhand') && s.crew.filter((h) => h.ashore).length < 3; s.crew.push(o); game.sea.refreshStats(); audio.good(); ui.toast(`${o.name} signs your articles.`, 'gold'); },
    dismiss(id) { const s = S(), k = s.crew.findIndex((h) => h.id === id); if (k >= 0) { const h = s.crew.splice(k, 1)[0]; game.sea.refreshStats(); audio.ui(); ui.toast(`${h.name} is paid off.`, 'dim'); } },
    ashore(id) { const s = S(), h = s.crew.find((x) => x.id === id); if (h) { h.ashore = !h.ashore; audio.ui(); } },
    station(k) { game.orderStation(k); },
    atwill() { const s = S(); s.atWill = !s.atWill; audio.ui(); },
    dshot() { game.sea.double = true; audio.ui(); ui.toast('The guns are double-shotted.', 'gold'); },
    brace() { const sea = game.sea; sea.braceT = 10; sea.braceCd = 45; audio.ui(); ui.toast('"Brace! Brace!"', 'warn'); },
    lighten() { const s = S(); s.cargo = {}; game.sea.lightT = 75; audio.ui(); ui.toast('The cargo goes over the side. She leaps ahead.', 'warn'); },
    ration() { const s = S(), n = Math.ceil(Math.max(1, s.crew.length) / 2); if (s.rum >= n) { s.rum -= n; addMorale(s, 12); game.sea.refreshStats(); audio.good(); ui.toast('A cheer goes up from the hands.', 'gold'); } },
    share() { const s = S(); if (pay(s, { gold: 25 * Math.max(1, s.crew.length) })) { addMorale(s, 20); game.sea.refreshStats(); audio.coin(); ui.toast('Coin in every palm. The crew would follow you anywhere.', 'gold'); } },
    flask() { const s = S(); if (s.bombs < BOMB.max + (feat(s, 'powder') ? 3 : 0) && pay(s, BOMB)) { s.bombs++; audio.coin(); } },
    chart() { const s = S(); if (pay(s, { gold: 220 })) { const isl = ISLANDS.filter((i) => i.kind !== 'hideout')[Math.floor(Math.random() * 8)]; s.maps.push({ island: isl.id, spot: Math.random() < 0.5 ? 0 : 1, tier: 2 }); audio.coin(); ui.toast(`The chart shows ${isl.name}. See Maps in your log.`, 'gold'); } },
    bribe() { const s = S(); if (pay(s, { gold: bribeCost(s) })) { s.rep.navy = -15; audio.coin(); ui.toast('The clerk loses some paperwork. The navy cools toward you.', 'gold'); } },
    ransom(i, p) { const s = S(), h = s.hostages[+i], d = ransomDeal(p.isl.id, h); s.hostages.splice(+i, 1); s.gold += d.gold; game.emit('ransom', {}); for (const f in d.rep) addRep(s, f, d.rep[f]); audio.coin(); ui.toast(`${d.gold} gold for the captain of the ${h.from}.`, 'gold'); },
    ammo(k) { const s = S(); if (pay(s, AMMO[k])) { s.armory[k] = true; s.ammo[k] = AMMO_PACK[k].n; s.shot = k; audio.good(); } },
    keg(k) { const s = S(); if (pay(s, { gold: AMMO_PACK[k].gold })) { s.ammo[k] = (s.ammo[k] || 0) + AMMO_PACK[k].n; audio.coin(); } },
    stores() { const s = S(), full = storesFull(s); for (const k of ['water', 'food', 'limes']) { const want = Math.max(0, Math.ceil(full[k] - s[k])), n = Math.min(want, Math.floor(s.gold / STORES[k].gold)); s[k] += n; s.gold -= n * STORES[k].gold; } s.scurvy = s.limes > 0 ? 0 : s.scurvy; audio.coin(); ui.toast('Casks and barrels go down the hatch.', 'gold'); },
    node(k) { ui.treeSel = k; audio.ui(); },
    learn(k) { const s = S(), n = TREE[k], r = nodeRank(s, k); if (r < n.cost.length && nodeOpen(s, k) && skillPoints(s) >= n.cost[r]) { s.tree[k] = r + 1; game.sea.refreshStats(); if (game.land.player) game.land.player.maxHp = playerStats(s).maxHp; audio.good(); if (n.feat) ui.toast(`Learned: ${n.name}.`, 'gold'); } },
    play(a) { const s = S(), [kind, b] = a.split(':'), bet = +b; if (s.gold < bet) return; audio.ui(); const d5 = () => Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 6)).sort();
      if (kind === 'liar') ui.g = { kind, bet, mine: d5(), theirs: d5(), bid: null, pc: 1, pf: 2, log: ['You bid first.'], over: null };
      else if (kind === '21') { const deck = []; for (let sx = 0; sx < 4; sx++) for (let r = 1; r <= 13; r++) deck.push({ r, s: sx }); deck.sort(() => Math.random() - 0.5); ui.g = { kind, bet, deck, me: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], over: null }; if (total(ui.g.me) === 21) settle(total(ui.g.dealer) === 21 ? 0 : 1.5, total(ui.g.dealer) === 21 ? 'Both 21. A push.' : 'Twenty-one on the deal!'); }
      else if (kind === 'ca') ui.g = { kind, bet, roll: null, over: null };
      else ui.g = { kind, bet, w: 0, l: 0, log: ['He grins and plants his elbow.'], over: null }; },
    gquit() { ui.g = null; },
    ld(a) { const g = ui.g; if (!g || g.over) return; const cnt = (arr, f) => arr.filter((x) => x === f).length, FACE = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
      if (a === 'c-') g.pc = Math.max(1, g.pc - 1); else if (a === 'c+') g.pc = Math.min(10, g.pc + 1); else if (a[0] === 'f') g.pf = +a[1];
      const resolve = (caller) => { const b = g.bid, tot = cnt(g.mine, b.f) + cnt(g.theirs, b.f), honest = tot >= b.c, win = honest ? b.who === 'you' : caller === 'you'; g.log.push(`${caller === 'you' ? 'You call' : 'They call'} liar. There are ${tot} ${FACE[b.f - 1]} on the table.`); settle(win ? 1 : -1, win ? `You take the pot: +${g.bet} gold.` : `You lose ${g.bet} gold.`); };
      if (a === 'call' && g.bid) return resolve('you');
      if (a !== 'bid') return; if (g.bid && !(g.pc > g.bid.c || (g.pc === g.bid.c && g.pf > g.bid.f))) return;
      g.bid = { c: g.pc, f: g.pf, who: 'you' }; g.log = [`You bid ${g.pc} ${FACE[g.pf - 1]}.`];
      const need = g.bid.c - cnt(g.theirs, g.bid.f); let pr = 0; for (let k = Math.max(0, need); k <= 5; k++) pr += [1, 5, 10, 10, 5, 1][k] * Math.pow(1 / 6, k) * Math.pow(5 / 6, 5 - k);
      if (need > 0 && pr < 0.2 + Math.random() * 0.18) return resolve('them');
      let fa = 1; for (let f = 2; f <= 6; f++) if (cnt(g.theirs, f) >= cnt(g.theirs, fa)) fa = f;
      const c2 = fa > g.bid.f ? g.bid.c : g.bid.c + 1;
      if (c2 - cnt(g.theirs, fa) > 2 + (Math.random() < 0.3 ? 1 : 0)) return resolve('them');
      g.bid = { c: c2, f: fa, who: 'them' }; g.log.push(`They bid ${c2} ${FACE[fa - 1]}.`); if (fa < 6) { g.pc = c2; g.pf = fa + 1; } else { g.pc = c2 + 1; g.pf = fa; } },
    bj(a) { const g = ui.g; if (!g || g.over) return; audio.ui();
      if (a === 'hit') { g.me.push(g.deck.pop()); if (total(g.me) > 21) settle(-1, `Bust. You lose ${g.bet} gold.`); return; }
      while (total(g.dealer) < 17) g.dealer.push(g.deck.pop());
      const m = total(g.me), d = total(g.dealer); settle(d > 21 || m > d ? 1 : m === d ? 0 : -1, d > 21 ? `Dealer busts. +${g.bet} gold.` : m > d ? `You win ${g.bet} gold.` : m === d ? 'A push. Stakes returned.' : `Dealer wins. You lose ${g.bet} gold.`); },
    ca(i) { const g = ui.g; if (!g || g.over) return; g.roll = [0, 0, 0].map(() => Math.floor(Math.random() * 6)); const n = g.roll.filter((r) => r === +i).length; settle(n ? n : -1, n ? `${n} of your sign. You win ${g.bet * n} gold.` : `None. You lose ${g.bet} gold.`); },
    arm(i) { const g = ui.g; if (!g || g.over) return; const N = ['Heave', 'Hold', 'Feint'], him = Math.floor(Math.random() * 3), me = +i, r = (him - me + 3) % 3; // r==1: I beat him
      g.log = [`You ${N[me].toLowerCase()}. He ${N[him].toLowerCase()}s.`]; if (r === 1) { g.w++; g.log.push('His arm gives an inch.'); } else if (r === 2) { g.l++; g.log.push('Your knuckles dip toward the candle.'); } else g.log.push('Neither arm moves.');
      audio.ui(); if (g.w >= 2) settle(1, `His hand hits the table. +${g.bet} gold.`); else if (g.l >= 2) settle(-1, `He pins you. You lose ${g.bet} gold.`); },
    swivel() { const s = S(); if (pay(s, SWIVEL)) { s.swivel = true; audio.good(); ui.toast('Swivel gun fitted. Drag to aim the ring, then tap SWIVEL.', 'gold'); } },
    shot(k) { S().shot = k; audio.ui(); },
    flag(k) { game.setFlag(k); audio.ui(); },
    jolly(arg) { const [k, v] = arg.split(':'); S().jolly[k] = v; if (S().flag === 'pirate') game.setFlag('pirate'); audio.ui(); },
    prize(how, p) { const sh = p.ship; ui.close(); game.prize(sh, how); },
    map() { ui.close(); ui.map.open(); },
    repair() { const s = S(); if (pay(s, { gold: repairCost(s) })) { s.ship.hp = 1; game.sea.player.hp = game.sea.player.maxHp; audio.good(); } },
    upgrade(k) { const s = S(); if (s.ship.up[k] < MAX_UPGRADE && pay(s, upgradeCost(s, k))) { s.ship.up[k]++; game.sea.refreshStats(); audio.good(); } },
    buyship(k) { const s = S(); if (pay(s, { gold: SHIP_CLASSES[k].price })) { s.owned[k] = freshUps(); ACTIONS.switch(k); } },
    switch(k) { const s = S(); s.ship.cls = k; s.ship.up = s.owned[k]; s.ship.hp = 1; game.swapShip(); audio.good(); ui.toast(`You take command of the ${SHIP_CLASSES[k].name}.`, 'gold'); },
    sail(k) { S().ship.sail = k; game.sea.player.model.sailMat.color.set(SAIL_COLORS[k]); audio.ui(); },
    sword(i) { const s = S(); if (pay(s, SWORDS[i])) { s.sword = +i; game.land.refreshGear(); audio.good(); } },
    gun(i) { const s = S(); if (pay(s, GUNS[i])) { s.gun = +i; audio.good(); } },
    buy(g, p) { const s = S(), bp = buyPrice(p.isl.id, g); if (cargoUsed(s) < shipStats(s).cargo && pay(s, { gold: bp })) { s.cargo[g] = (s.cargo[g] || 0) + 1; audio.coin(); } },
    sell(g, p) { const s = S(), n = s.cargo[g] || 0; if (n) { s.gold += n * sellPrice(p.isl.id, g); game.emit('sell', { gold: n * sellPrice(p.isl.id, g) }); s.cargo[g] = 0; audio.coin(); } },
    build(id) { const s = S(); if ((s.base.b[id] || 0) < MAX_BUILDING && pay(s, buildingCost(s, id))) { const p = pending(s); s.gold += p.gold; s.timber += p.timber; s.iron += p.iron; s.base.t = Date.now(); s.base.b[id] = (s.base.b[id] || 0) + 1; refreshBase(game.world, s); game.sea.refreshStats(); audio.good(); game.emit('build', { building: id }); } },
    look(arg) { const [k, v] = arg.split(':'); S().look[k] = k === 'skin' ? +v : v; game.applyLook(); audio.ui(); },
    pet(k) { const s = S(); if (pay(s, { gold: PETS[k].price })) { s.pets[k] = true; s.pet = k; game.land.setPet(); audio.good(); ui.toast(`${PETS[k].name} joins your crew.`, 'gold'); } },
    takepet(k) { S().pet = k || null; game.land.setPet(); audio.ui(); },
    mute() { const s = S(); s.muted = !s.muted; audio.setMuted(s.muted); ui.setMute(); },
    askwipe(_, p) { p.confirm = true; }, nowipe(_, p) { p.confirm = false; },
    wipe() { clearSave(); game.restart(); },
    login() { game.quests.claimLogin(); }, daily(i) { game.quests.claimDaily(+i); }, bonus() { game.quests.claimBonus(); }, deed(id) { game.quests.claimDeed(id); },
    bounty(id, p) { const err = game.quests.takeBounty(id, p.isl.id); if (err) ui.toast(err, 'warn'); else { audio.good(); ui.toast('Poster taken. Your compass points to where she was last seen.', 'gold'); } },
    dropbounty() { S().bounty = null; },
    fullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else game.goFull(true); },
    music() { const s = S(); s.music = s.music === false; audio.setMusic(s.music); },
    gfx() { const o = ['auto', 'low', 'high']; game.setGfx(o[(o.indexOf(S().gfx) + 1) % 3]); },
    backup(_, p) { p.backup = true; },
    copy() { const t = $('backupOut'); if (!t) return; const done = () => ui.toast('Backup code copied. Keep it somewhere safe.', 'gold'); try { navigator.clipboard.writeText(t.value).then(done, () => { t.select(); ui.toast('Select the code and copy it.', 'dim'); }); } catch (e) { t.select(); ui.toast('Select the code and copy it.', 'dim'); } },
    restore() { const t = $('backupIn'), s = t && importSave(t.value); if (!s) ui.toast('That code does not look right. Paste the whole backup code.', 'warn'); else game.restore(s); },
    closepanel() { ui.close(); },
  };

  function render() {
    const p = ui.panel; if (!p) return;
    const view = VIEWS[p.kind];
    sheet.h2.innerHTML = `${esc(p.title)}${p.sub ? `<small>${esc(p.sub)}</small>` : ''}`;
    $('panelBack').hidden = !(p.kind === 'menu' && p.tab !== 'Menu');
    sheet.nav.innerHTML = view.tabs.map((t) => `<button type="button" data-tab="${t}" class="${t === p.tab ? 'on' : ''}">${t}</button>`).join('');
    sheet.body.innerHTML = (view[p.tab] || view.main)(p);
    const cv = sheet.body.querySelector('#chartCv'); if (cv) drawChart(cv);
    for (const m of sheet.body.querySelectorAll('[data-map]')) drawTreasureMap(m, S().maps[+m.dataset.map]);
    const on = sheet.nav.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    ui.dirty = true;
  }
  ui.open = (kind, title, sub, extra = {}) => { ui.panel = Object.assign({ kind, title, sub, tab: VIEWS[kind].tabs[0] || 'main' }, extra); el.panel.hidden = false; game.paused = true; for (const k in input.pressed) input.pressed[k] = false; input.move.x = input.move.y = 0; audio.ui(); render(); sheet.body.scrollTop = 0; };
  ui.close = () => { if (!ui.panel) return; ui.panel = null; el.panel.hidden = true; game.paused = false; for (const k in input.pressed) input.pressed[k] = false; writeSave(S()); };
  ui.openTown = (isl, npc) => { game.emit('talk', { npc: npc.id }); ui.open(npc.kind, `${npc.name}`, `${npc.role}, ${isl.name}`, { isl }); };
  ui.openBuild = (id) => ui.open('build', BUILDINGS[id].name, "Rogue's Rest", { id });
  ui.openMenu = (tab) => { ui.open('menu', 'Menu', ''); if (tab) { ui.panel.tab = tab; render(); } };
  ui.openWelcome = (pend) => ui.open('welcome', 'Welcome back, Captain', '', { pend });
  ui.openPrize = (ship) => ui.open('prize', 'A prize', ship.name, { ship });
  ui.map = createMap(game, $);
  el.mini.addEventListener('click', () => { if (game.started && !game.paused) ui.map.open(); });
  el.quest.addEventListener('click', () => { if (game.started && !game.paused) ui.openMenu('Quests'); });
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyN' && game.started && !/INPUT|TEXTAREA/.test(e.target.tagName || '')) { if (ui.map.isOpen()) ui.map.close(); else if (!game.paused) ui.map.open(); } if (e.code === 'Escape' && ui.map.isOpen()) ui.map.close(); });
  el.panel.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || !ui.panel) { if (e.target === el.panel) ui.close(); return; }
    if (t.id === 'panelClose') return ui.close();
    if (t.id === 'panelBack') { ui.panel.tab = 'Menu'; audio.ui(); sheet.body.scrollTop = 0; return render(); }
    if (t.dataset.tab) { ui.panel.tab = t.dataset.tab; audio.ui(); sheet.body.scrollTop = 0; return render(); }
    if (t.dataset.do) { const keep = sheet.body.scrollTop; ACTIONS[t.dataset.do](t.dataset.arg || '', ui.panel); if (ui.panel) { render(); sheet.body.scrollTop = keep; } }
  });
  el.btnMenu.addEventListener('click', () => ui.openMenu());
  el.banner.addEventListener('click', () => { el.banner.hidden = true; });
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && ui.panel) ui.close(); });

  // ---------- charts ----------
  function drawChart(cv) {
    const c = cv.getContext('2d'), Z = cv.width, k = Z / (2 * WORLD_R * 1.04), s = S(), X = (x) => Z / 2 - x * k, Y = (z) => Z / 2 - z * k;
    c.fillStyle = '#d6c595'; c.fillRect(0, 0, Z, Z);
    c.strokeStyle = 'rgba(90,70,40,.18)'; c.lineWidth = 1; for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo((i * Z) / 8, 0); c.lineTo((i * Z) / 8, Z); c.moveTo(0, (i * Z) / 8); c.lineTo(Z, (i * Z) / 8); c.stroke(); }
    for (const isl of ISLANDS) if (s.seen[isl.id]) { c.save(); c.beginPath(); c.arc(X(isl.x), Y(isl.z), isl.r * 1.35 * k, 0, 7); c.clip(); c.translate(Z / 2, Z / 2); c.scale(-k, -k); c.drawImage(game.world.chart, -WORLD_R, -WORLD_R, WORLD_R * 2, WORLD_R * 2); c.restore(); }
    c.textAlign = 'center';
    for (const id in ZONES) { const z = ZONES[id]; c.strokeStyle = 'rgba(120,40,30,.5)'; c.setLineDash([6, 6]); c.beginPath(); c.arc(X(z.x), Y(z.z), z.r * k, 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(120,40,30,.8)'; c.font = 'italic 17px Georgia, serif'; c.fillText(z.name, X(z.x), Y(z.z) + 5); }
    for (const isl of ISLANDS) { c.fillStyle = '#3a2a18'; c.font = s.seen[isl.id] ? '19px Georgia, serif' : 'italic 16px Georgia, serif'; c.fillText(s.seen[isl.id] ? isl.name : '?', X(isl.x), Y(isl.z) + isl.r * k + 20); }
    const m = game.quests.marker(); if (m) { c.save(); c.translate(X(m.x), Y(m.z)); c.rotate(Math.PI / 4); c.fillStyle = '#b7302a'; c.fillRect(-8, -8, 16, 16); c.restore(); }
    const p = game.sea.player; c.save(); c.translate(X(p.x), Y(p.z)); c.rotate(p.heading + Math.PI); c.fillStyle = '#12202a'; c.beginPath(); c.moveTo(0, 14); c.lineTo(8, -9); c.lineTo(-8, -9); c.fill(); c.restore();
    c.fillStyle = '#3a2a18'; c.font = '700 22px Georgia, serif'; c.fillText('N', Z - 30, 36); c.beginPath(); c.moveTo(Z - 30, 44); c.lineTo(Z - 30, 70); c.strokeStyle = '#3a2a18'; c.lineWidth = 2; c.stroke();
  }
  function drawTreasureMap(cv, m) {
    const isl = ISLAND[m.island], Z = cv.width, c = cv.getContext('2d'), img = c.createImageData(Z, Z), e = isl.ext;
    for (let j = 0; j < Z; j++) for (let i = 0; i < Z; i++) {
      const h = heightAt(isl.x - ((i + 0.5) / Z * 2 - 1) * e, isl.z - ((j + 0.5) / Z * 2 - 1) * e), q = (j * Z + i) * 4;
      let r = 214, g = 197, b = 149;
      if (h > 0) { const t = clamp(h / isl.h, 0, 1), band = Math.floor(h / 4) % 2; r = 150 - t * 60 - band * 8; g = 120 - t * 52 - band * 8; b = 78 - t * 36 - band * 6; } else if (h > -3) { r = 190; g = 178; b = 138; }
      img.data[q] = r; img.data[q + 1] = g; img.data[q + 2] = b; img.data[q + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    const X = (x) => Z / 2 - ((x - isl.x) / e) * (Z / 2), Y = (z) => Z / 2 - ((z - isl.z) / e) * (Z / 2), d = isl.digs[m.spot];
    c.strokeStyle = '#a3201a'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(X(d.x) - 11, Y(d.z) - 11); c.lineTo(X(d.x) + 11, Y(d.z) + 11); c.moveTo(X(d.x) + 11, Y(d.z) - 11); c.lineTo(X(d.x) - 11, Y(d.z) + 11); c.stroke();
    c.strokeStyle = '#12202a'; c.lineWidth = 3; const ax = X(isl.boat.x), ay = Y(isl.boat.z); c.beginPath(); c.arc(ax, ay - 9, 4, 0, 7); c.moveTo(ax, ay - 5); c.lineTo(ax, ay + 10); c.moveTo(ax - 8, ay + 3); c.quadraticCurveTo(ax, ay + 14, ax + 8, ay + 3); c.stroke();
    c.setLineDash([5, 7]); c.lineWidth = 2; c.strokeStyle = 'rgba(60,40,20,.6)'; c.beginPath(); c.moveTo(X(isl.landing.x), Y(isl.landing.z)); c.lineTo(X(d.x), Y(d.z)); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#3a2a18'; c.font = '700 20px Georgia, serif'; c.textAlign = 'center'; c.fillText('N', Z - 22, 28);
    void dist2;
  }
  return ui;
}
