// HUD and menus. Plain DOM over the canvas.
import * as THREE from 'three';
import { SHIP_CLASSES, SHIP_UPGRADES, MAX_UPGRADE, SWORDS, GUNS, GOODS, BUILDINGS, MAX_BUILDING, ISLANDS, ISLAND, ZONES, WORLD_R, RANKS, xpFor, PROD_CAP_HOURS, LOOK_OPTS, PETS } from './data.js';
import { shipStats, playerStats, cargoUsed, can, pay, upgradeCost, buildingCost, repairCost, costText, buyPrice, sellPrice, SAIL_COLORS, pending, clearSave, writeSave } from './state.js';
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
  const el = {}; ['hud', 'hpFill', 'hpText', 'pGold', 'pTimber', 'pIron', 'pHold', 'wanted', 'qTitle', 'qText', 'target', 'tName', 'tFill', 'toasts', 'mini', 'place', 'btnMenu', 'btnMute', 'seaBtns', 'landBtns', 'bFire', 'bShoot', 'bDodge', 'rumN', 'sailPips', 'speed', 'rlP', 'rlS', 'ctx', 'hint', 'floats', 'flash', 'banner', 'panel', 'title', 'fade', 'btnContinue', 'btnNew'].forEach((k) => { el[k] = $(k); });
  for (const s of document.querySelectorAll('[data-icon]')) s.innerHTML = svg(s.dataset.icon);
  el.btnMenu.innerHTML = svg('log');
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
  ui.setMute = () => { el.btnMute.innerHTML = svg(S().muted ? 'mute' : 'sound'); };

  // ---------- per-frame HUD ----------
  ui.update = (dt) => {
    const s = S(), mode = game.mode, sea = game.sea, land = game.land, onFoot = mode !== 'sea';
    el.seaBtns.hidden = onFoot; el.landBtns.hidden = !onFoot;
    const hp = onFoot ? land.player.hp : sea.player.hp, max = onFoot ? land.player.maxHp : sea.player.maxHp;
    el.hpFill.style.transform = `scaleX(${clamp(hp / max, 0, 1)})`; el.hpFill.parentElement.classList.toggle('ship', !onFoot);
    el.hpText.textContent = `${onFoot ? '' : 'HULL '}${Math.ceil(hp)} / ${max}`;
    el.pGold.textContent = s.gold; el.pTimber.textContent = s.timber; el.pIron.textContent = s.iron; el.pHold.textContent = `${cargoUsed(s)}/${sea.player.stats.cargo}`;
    el.wanted.hidden = !(s.wanted > 0);
    if (ui.dirty) { const o = game.quests.objective(); el.qTitle.textContent = o.title; el.qText.textContent = o.short; ui.dirty = false; }
    const t = onFoot ? land.focus : sea.target;
    el.target.hidden = !t;
    if (t) { el.tName.textContent = t.name || t.def.name; el.tFill.style.transform = `scaleX(${clamp(t.hp / t.maxHp, 0, 1)})`; }
    if (!onFoot) {
      const p = sea.player, r = p.stats.reload;
      el.rlP.firstChild.style.setProperty('--p', 1 - clamp(p.reload[1] / r, 0, 1)); el.rlS.firstChild.style.setProperty('--p', 1 - clamp(p.reload[-1] / r, 0, 1));
      let ready = false; if (t) { const b = p.bearing(t.x, t.z); ready = b.off < 0.5 && b.dist < p.stats.range && p.reload[b.side] <= 0; }
      el.bFire.classList.toggle('ready', ready);
      el.sailPips.children[0].classList.toggle('on', p.sail >= 0.5); el.sailPips.children[1].classList.toggle('on', p.sail >= 1);
      el.speed.textContent = `${Math.max(0, p.speed * 1.2).toFixed(0)} kn`;
    } else {
      const p = land.player, st = playerStats(s);
      el.bShoot.classList.toggle('cool', p.gunT > 0); el.bShoot.style.setProperty('--cd', clamp(p.gunT / st.gunReload, 0, 1));
      el.bDodge.classList.toggle('cool', p.cdRoll > 0); el.bDodge.style.setProperty('--cd', clamp(p.cdRoll / 0.85, 0, 1));
      el.rumN.textContent = s.rum;
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
    ui.miniT -= dt; if (ui.miniT <= 0) { ui.miniT = 0.2; drawMini(); }
  };

  function drawMini() {
    const c = mctx, Z = 232, sea = game.sea, onFoot = game.mode !== 'sea', me = onFoot ? game.land.player : sea.player, R = onFoot ? 120 : S().pet === 'parrot' ? 640 : 430, k = Z / (2 * R);
    c.clearRect(0, 0, Z, Z); c.save(); c.beginPath(); c.arc(Z / 2, Z / 2, Z / 2, 0, 7); c.clip();
    c.fillStyle = 'rgba(14,44,54,.78)'; c.fillRect(0, 0, Z, Z);
    c.translate(Z / 2, Z / 2); c.scale(-k, -k); c.translate(-me.x, -me.z);
    c.drawImage(game.world.chart, -WORLD_R, -WORLD_R, WORLD_R * 2, WORLD_R * 2);
    const dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, z, r / k, 0, 7); c.fill(); };
    if (!onFoot) {
      for (const s of sea.ships) if (s.alive) dot(s.x, s.z, 5, s.faction === 'merchant' ? '#d9c79a' : s.faction === 'navy' ? (S().wanted > 0 || s.provoked ? '#e0524a' : '#7fa3d6') : '#e0524a');
      for (const l of sea.loot) dot(l.x, l.z, 3.5, '#e9c46a');
      if (sea.kraken) for (const a of sea.kraken.arms) if (a.alive) dot(a.x, a.z, 4, '#c678a0');
    } else {
      for (const a of game.land.actors) if (a.alive && a.state !== 'buried') dot(a.x, a.z, 4.5, a.team ? '#e0524a' : '#6fae84');
      const isl = game.land.isl;
      if (isl) { dot(isl.boat.x, isl.boat.z, 6, '#7fd0d6'); for (const n of isl.npcs) dot(n.x, n.z, 4.5, '#e9c46a'); }
    }
    const h = onFoot ? me.face : me.heading, sx = Math.sin(h), cz = Math.cos(h), a = 11 / k;
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(me.x + sx * a, me.z + cz * a); c.lineTo(me.x - sx * a * 0.7 + cz * a * 0.6, me.z - cz * a * 0.7 - sx * a * 0.6); c.lineTo(me.x - sx * a * 0.7 - cz * a * 0.6, me.z - cz * a * 0.7 + sx * a * 0.6); c.fill();
    c.restore();
    const m = game.quests.marker();
    if (m) {
      let dx = -(m.x - me.x) * k, dy = -(m.z - me.z) * k; const d = Math.hypot(dx, dy), lim = Z / 2 - 14;
      if (d > lim) { dx *= lim / d; dy *= lim / d; }
      c.save(); c.translate(Z / 2 + dx, Z / 2 + dy); c.rotate(Math.PI / 4); c.fillStyle = '#e9c46a'; c.strokeStyle = '#0c1316'; c.lineWidth = 3; c.fillRect(-8, -8, 16, 16); c.strokeRect(-8, -8, 16, 16); c.restore();
    }
    c.fillStyle = '#e6dcc2'; c.font = '700 20px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('N', Z / 2, 24);
    // place name
    let name = 'Open sea';
    if (game.mode === 'board') name = 'Boarding';
    else if (onFoot) name = game.land.isl.name;
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
      tabs: ['Jobs', 'Bar'],
      Jobs(p) {
        const s = S(), o = game.quests.objective(), offers = game.quests.offers(p.isl.id);
        return `<h3>${esc(o.title)}</h3><p>${esc(o.text)}</p><p class="note">${esc(o.short)}</p>
          <h3>On the board</h3>${offers.map((j, i) => row(esc(j.title), esc(j.text), `<span class="cost">${rewardText(j.reward)}</span>${btn('Take', 'accept', i, 'go')}`)).join('')}
          ${s.jobs.length ? `<h3>Your jobs</h3>${s.jobs.map((j) => row(esc(j.title), esc(game.quests.shortText(j.obj) + game.quests.progress(j.obj, j.n)), btn('Drop', 'abandon', j.id, 'bad'))).join('')}` : ''}`;
      },
      Bar() {
        const s = S(), bounty = Math.ceil(s.wanted * 1.5);
        return row('Bottle of rum', `Drink in a fight to close your wounds. You carry ${s.rum}.`, `${costHtml({ gold: 30 })}${btn('Buy', 'rum', '', '', s.gold < 30 || s.rum >= 9)}`)
          + row('A stained chart', `Someone's buried secret. You hold ${s.maps.length} of 3 maps.`, `${costHtml({ gold: 220 })}${btn('Buy', 'chart', '', '', s.gold < 220 || s.maps.length >= 3)}`)
          + Object.entries(PETS).filter(([k, d]) => d.port === ui.panel.isl.id && !s.pets[k]).map(([k, d]) => row(d.name, d.perk, `${costHtml({ gold: d.price })}${btn('Buy', 'pet', k, 'go', s.gold < d.price)}`)).join('')
          + (s.wanted > 0 ? row('Bribe the harbour clerk', 'Clears your Wanted status with the navy.', `${costHtml({ gold: bounty })}${btn('Pay', 'bribe', '', '', s.gold < bounty)}`) : '')
          + `<p class="note" style="margin-top:12px">"Bloodwater sloops fly red sails. Merchants run. The navy only minds you once you have given them cause."</p>`;
      },
    },
    shipwright: {
      tabs: ['Refit', 'Ships', 'Colours'],
      Refit() {
        const s = S(), st = shipStats(s), rc = repairCost(s);
        return `<div class="stat"><div><small>Hull</small><b>${Math.round(s.ship.hp * st.maxHp)} / ${st.maxHp}</b></div><div><small>Speed</small><b>${(st.speed * 1.2).toFixed(1)} kn</b></div><div><small>Guns a side</small><b>${st.guns}</b></div><div><small>Hold</small><b>${st.cargo}</b></div><div><small>Boarders</small><b>${st.crew}</b></div></div>`
          + row('Repair the hull', rc ? 'Patch every hole and scrape the keel.' : 'She is sound.', `${costHtml({ gold: rc })}${btn('Repair', 'repair', '', 'go', !rc || s.gold < rc)}`)
          + Object.entries(SHIP_UPGRADES).map(([k, u]) => { const lv = s.ship.up[k], c = upgradeCost(s, k), full = lv >= MAX_UPGRADE; return row(`${u.name}${pips(lv, MAX_UPGRADE)}`, u.desc, full ? '<span class="cost">Complete</span>' : `${costHtml(c)}${btn('Fit', 'upgrade', k, '', !can(s, c))}`); }).join('');
      },
      Ships() {
        const s = S();
        return Object.entries(SHIP_CLASSES).map(([k, c]) => {
          const owned = !!s.owned[k], cur = s.ship.cls === k, locked = s.level < c.level;
          const right = cur ? '<span class="cost">Your ship</span>' : owned ? btn('Sail her', 'switch', k, 'go') : locked ? `<span class="cost no">Rank ${c.level} needed</span>` : `${costHtml({ gold: c.price })}${btn('Buy', 'buyship', k, 'go', s.gold < c.price)}`;
          return row(c.name, `${c.guns} guns a side · hull ${c.hp} · ${(c.speed * 1.2).toFixed(0)} kn · hold ${c.cargo} · ${c.crew} boarders`, right);
        }).join('') + '<p class="note" style="margin-top:12px">Upgrades stay with the hull they were fitted to.</p>';
      },
      Colours() { const s = S(); return `<p>Choose your sailcloth. Purely for show.</p><div class="swatches">${Object.entries(SAIL_COLORS).map(([k, c]) => `<button type="button" data-do="sail" data-arg="${k}" class="${s.ship.sail === k ? 'on' : ''}" style="background:#${c.toString(16).padStart(6, '0')}" aria-label="${k} sails"></button>`).join('')}</div>`; },
    },
    smith: {
      tabs: ['Blades', 'Firearms'],
      Blades() { const s = S(); return SWORDS.map((w, i) => row(w.name, `${w.dmg} damage a stroke`, i === s.sword ? '<span class="cost">In hand</span>' : i < s.sword ? '<span class="cost">Owned</span>' : `${costHtml(w)}${btn('Forge', 'sword', i, '', !can(s, w))}`)).join(''); },
      Firearms() { const s = S(); return GUNS.map((w, i) => row(w.name, `${w.dmg} damage · ${w.reload.toFixed(1)}s reload`, i === s.gun ? '<span class="cost">In hand</span>' : i < s.gun ? '<span class="cost">Owned</span>' : `${costHtml(w)}${btn('Buy', 'gun', i, '', !can(s, w))}`)).join(''); },
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
      tabs: ['Log', 'Chart', 'Maps', 'Captain', 'Look', 'Pets', 'Settings'],
      Look() {
        const l = S().look, hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
        const sw = (key, opts) => `<div class="swatches">${Object.entries(opts).map(([k, c]) => `<button type="button" data-do="look" data-arg="${key}:${k}" class="${String(l[key]) === k ? 'on' : ''}" style="background:${hex(c)}" aria-label="${key} ${k}"></button>`).join('')}</div>`;
        return `<h3>Coat</h3>${sw('coat', LOOK_OPTS.coat)}<h3>Sash</h3>${sw('sash', LOOK_OPTS.sash)}<h3>Skin</h3>${sw('skin', LOOK_OPTS.skin)}<h3>Hat</h3><div class="choices">${Object.entries(LOOK_OPTS.hat).map(([k, n]) => btn(n, 'look', `hat:${k}`, l.hat === k ? 'go' : '')).join('')}</div><p class="note" style="margin-top:12px">Sail colours are chosen at any shipwright.</p>`;
      },
      Pets() {
        const s = S();
        return '<p>One companion sails with you at a time.</p>' + Object.entries(PETS).map(([k, d]) => row(d.name, s.pets[k] ? d.perk : `${d.perk} <i>${d.how}</i>`, !s.pets[k] ? '<span class="cost no">Not found yet</span>' : s.pet === k ? `<span class="cost">With you</span>${btn('Leave', 'takepet', '')}` : btn('Take along', 'takepet', k, 'go'))).join('');
      },
      Log() { const s = S(), o = game.quests.objective(); return `<h3>${esc(o.title)}</h3><p>${esc(o.text)}</p><p class="note">${esc(o.short)}</p>${s.jobs.length ? `<h3>Jobs</h3>${s.jobs.map((j) => row(esc(j.title), esc(game.quests.shortText(j.obj) + game.quests.progress(j.obj, j.n)), `<span class="cost">${rewardText(j.reward)}</span>`)).join('')}` : '<p class="note">No jobs taken. Tavern keepers post work on their boards.</p>'}`; },
      Chart() { return '<canvas class="chart" id="chartCv" width="720" height="720"></canvas>'; },
      Maps() { const s = S(); return s.maps.length ? `<div class="maps">${s.maps.map((m, i) => `<figure><canvas class="chart" data-map="${i}" width="360" height="360"></canvas><figcaption>${ISLAND[m.island].name}. The X marks it; the anchor marks the landing.</figcaption></figure>`).join('')}</div>` : '<p class="note">You hold no treasure maps. Taverns sell them, and bottles drift at sea.</p>'; },
      Captain() {
        const s = S(), st = shipStats(s), ps = playerStats(s);
        return `<div class="stat"><div><small>Rank ${s.level}</small><b>${RANKS[Math.min(RANKS.length - 1, s.level - 1)]}</b></div><div><small>Infamy</small><b>${s.xp} / ${xpFor(s.level)}</b></div><div><small>Health</small><b>${ps.maxHp}</b></div><div><small>Blade</small><b>${SWORDS[s.sword].name}</b></div><div><small>Firearm</small><b>${GUNS[s.gun].name}</b></div><div><small>Ship</small><b>${st.cls.name}</b></div><div><small>Ships sunk</small><b>${s.stats.sunk}</b></div><div><small>Ships boarded</small><b>${s.stats.boarded}</b></div><div><small>Foes slain</small><b>${s.stats.kills}</b></div><div><small>Treasures dug</small><b>${s.stats.dug}</b></div></div>`
          + (Object.keys(s.cargo).some((g) => s.cargo[g]) ? `<h3>In the hold</h3><p>${Object.keys(s.cargo).filter((g) => s.cargo[g]).map((g) => `${s.cargo[g]} ${GOODS[g].name.toLowerCase()}`).join(', ')}</p>` : '');
      },
      Settings(p) {
        return row('Sound', 'Cannon, steel and surf.', btn(S().muted ? 'Turn on' : 'Turn off', 'mute'))
          + row('Start over', 'Erases this voyage for good.', p.confirm ? `${btn('Yes, erase', 'wipe', '', 'bad')}${btn('Keep', 'nowipe')}` : btn('New voyage', 'askwipe', '', 'bad'))
          + '<h3>Controls</h3><p><b>Touch:</b> left thumb steers the ship and moves on foot. Drag anywhere else to look. Flick the stick up or down to set sail.</p><p><b>Keys:</b> WASD move · Space fire or strike · Q block · Shift dodge · F shoot · R rum · E use · X / Z sails · M log.</p>';
      },
    },
  };

  const ACTIONS = {
    accept(i, p) { const err = game.quests.accept(p.isl.id, +i); if (err) ui.toast(err, 'warn'); else audio.good(); },
    abandon(id) { game.quests.abandon(id); },
    rum() { if (pay(S(), { gold: 30 })) { S().rum++; audio.coin(); } },
    chart() { const s = S(); if (pay(s, { gold: 220 })) { const isl = ISLANDS.filter((i) => i.kind !== 'hideout')[Math.floor(Math.random() * 8)]; s.maps.push({ island: isl.id, spot: Math.random() < 0.5 ? 0 : 1, tier: 2 }); audio.coin(); ui.toast(`The chart shows ${isl.name}. See Maps in your log.`, 'gold'); } },
    bribe() { const s = S(); if (pay(s, { gold: Math.ceil(s.wanted * 1.5) })) { s.wanted = 0; audio.coin(); ui.toast('The clerk forgets your face.', 'gold'); } },
    repair() { const s = S(); if (pay(s, { gold: repairCost(s) })) { s.ship.hp = 1; game.sea.player.hp = game.sea.player.maxHp; audio.good(); } },
    upgrade(k) { const s = S(); if (s.ship.up[k] < MAX_UPGRADE && pay(s, upgradeCost(s, k))) { s.ship.up[k]++; game.sea.refreshStats(); audio.good(); } },
    buyship(k) { const s = S(); if (pay(s, { gold: SHIP_CLASSES[k].price })) { s.owned[k] = { hull: 0, sails: 0, cannons: 0, hold: 0, crew: 0 }; ACTIONS.switch(k); } },
    switch(k) { const s = S(); s.ship.cls = k; s.ship.up = s.owned[k]; s.ship.hp = 1; game.swapShip(); audio.good(); ui.toast(`You take command of the ${SHIP_CLASSES[k].name}.`, 'gold'); },
    sail(k) { S().ship.sail = k; game.sea.player.model.sailMat.color.set(SAIL_COLORS[k]); audio.ui(); },
    sword(i) { const s = S(); if (pay(s, SWORDS[i])) { s.sword = +i; game.land.refreshGear(); audio.good(); } },
    gun(i) { const s = S(); if (pay(s, GUNS[i])) { s.gun = +i; audio.good(); } },
    buy(g, p) { const s = S(), bp = buyPrice(p.isl.id, g); if (cargoUsed(s) < shipStats(s).cargo && pay(s, { gold: bp })) { s.cargo[g] = (s.cargo[g] || 0) + 1; audio.coin(); } },
    sell(g, p) { const s = S(), n = s.cargo[g] || 0; if (n) { s.gold += n * sellPrice(p.isl.id, g); s.cargo[g] = 0; audio.coin(); } },
    build(id) { const s = S(); if ((s.base.b[id] || 0) < MAX_BUILDING && pay(s, buildingCost(s, id))) { const p = pending(s); s.gold += p.gold; s.timber += p.timber; s.iron += p.iron; s.base.t = Date.now(); s.base.b[id] = (s.base.b[id] || 0) + 1; refreshBase(game.world, s); game.sea.refreshStats(); audio.good(); game.emit('build', { building: id }); } },
    look(arg) { const [k, v] = arg.split(':'); S().look[k] = k === 'skin' ? +v : v; game.applyLook(); audio.ui(); },
    pet(k) { const s = S(); if (pay(s, { gold: PETS[k].price })) { s.pets[k] = true; s.pet = k; game.land.setPet(); audio.good(); ui.toast(`${PETS[k].name} joins your crew.`, 'gold'); } },
    takepet(k) { S().pet = k || null; game.land.setPet(); audio.ui(); },
    mute() { const s = S(); s.muted = !s.muted; audio.setMuted(s.muted); ui.setMute(); },
    askwipe(_, p) { p.confirm = true; }, nowipe(_, p) { p.confirm = false; },
    wipe() { clearSave(); game.restart(); },
  };

  function render() {
    const p = ui.panel; if (!p) return;
    const view = VIEWS[p.kind];
    sheet.h2.innerHTML = `${esc(p.title)}${p.sub ? `<small>${esc(p.sub)}</small>` : ''}`;
    sheet.nav.innerHTML = view.tabs.map((t) => `<button type="button" data-tab="${t}" class="${t === p.tab ? 'on' : ''}">${t}</button>`).join('');
    sheet.body.innerHTML = (view[p.tab] || view.main)(p);
    const cv = sheet.body.querySelector('#chartCv'); if (cv) drawChart(cv);
    for (const m of sheet.body.querySelectorAll('[data-map]')) drawTreasureMap(m, S().maps[+m.dataset.map]);
    ui.dirty = true;
  }
  ui.open = (kind, title, sub, extra = {}) => { ui.panel = Object.assign({ kind, title, sub, tab: VIEWS[kind].tabs[0] || 'main' }, extra); el.panel.hidden = false; game.paused = true; for (const k in input.pressed) input.pressed[k] = false; input.move.x = input.move.y = 0; audio.ui(); render(); sheet.body.scrollTop = 0; };
  ui.close = () => { if (!ui.panel) return; ui.panel = null; el.panel.hidden = true; game.paused = false; for (const k in input.pressed) input.pressed[k] = false; writeSave(S()); };
  ui.openTown = (isl, npc) => { game.emit('talk', { npc: npc.id }); ui.open(npc.kind, `${npc.name}`, `${npc.role}, ${isl.name}`, { isl }); };
  ui.openBuild = (id) => ui.open('build', BUILDINGS[id].name, "Rogue's Rest", { id });
  ui.openMenu = (tab) => { ui.open('menu', "Captain's Log", ''); if (tab) { ui.panel.tab = tab; render(); } };
  el.panel.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || !ui.panel) { if (e.target === el.panel) ui.close(); return; }
    if (t.id === 'panelClose') return ui.close();
    if (t.dataset.tab) { ui.panel.tab = t.dataset.tab; audio.ui(); sheet.body.scrollTop = 0; return render(); }
    if (t.dataset.do) { const keep = sheet.body.scrollTop; ACTIONS[t.dataset.do](t.dataset.arg, ui.panel); if (ui.panel) { render(); sheet.body.scrollTop = keep; } }
  });
  el.btnMenu.addEventListener('click', () => ui.openMenu());
  el.btnMute.addEventListener('click', () => ACTIONS.mute());
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
