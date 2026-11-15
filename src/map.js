// The big chart: pan, pinch-zoom, fog of war, named islands, a legend, and tap-for-details.
import { ISLANDS, ISLAND, ZONES, WORLD_R, FOG_N, FACTIONS, PORT_FACTION, PORT_PRICES, GOODS } from './data.js';
import { standing } from './state.js';
import { clamp, dist2 } from './util.js';

const KIND = { town: 'Port town', hideout: 'Your hideout', fort: 'Pirate fort', ruins: 'Ruins', crab: 'Beast lair', islet: 'Islet' };
const LEGEND = [
  ['you', 'Your ship'], ['town', 'Port town: tavern, shipwright, smith, market'], ['hideout', 'Your hideout'], ['fort', 'Pirate fort (raid)'], ['ruins', 'Ruins and the cursed dead'],
  ['crab', 'Beast lair'], ['islet', 'Islet'], ['treasure', 'Buried treasure (a map you hold)'], ['quest', 'Current objective'], ['course', 'Course you set'],
  ['merchant', 'Merchant ship'], ['navy', 'Navy ship'], ['hostile', 'Hostile ship'], ['storm', 'Storm (it moves)'], ['zone', 'Dangerous waters'], ['fog', 'Uncharted: sail there to reveal'],
];

// One place that knows how to draw every icon, used by the chart and by the legend.
function icon(c, type, x, y, s = 1, ang = 0) {
  c.save(); c.translate(x, y); c.scale(s, s); c.lineWidth = 2; c.strokeStyle = '#1a140c'; c.lineJoin = 'round';
  const poly = (pts, fill) => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fillStyle = fill; c.fill(); c.stroke(); };
  if (type === 'you') { c.rotate(ang); poly([[0, -12], [8, 9], [0, 5], [-8, 9]], '#fff'); }
  else if (type === 'town') { c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fillStyle = '#e9c46a'; c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, -5); c.lineTo(0, 5); c.moveTo(-4, 1); c.quadraticCurveTo(0, 7, 4, 1); c.moveTo(-3, -2); c.lineTo(3, -2); c.stroke(); }
  else if (type === 'hideout') poly([[0, -10], [9, -2], [9, 9], [-9, 9], [-9, -2]], '#4fb3a6');
  else if (type === 'fort') poly([[-9, 9], [-9, -8], [-5, -8], [-5, -4], [-2, -4], [-2, -8], [2, -8], [2, -4], [5, -4], [5, -8], [9, -8], [9, 9]], '#c0443c');
  else if (type === 'ruins') { for (const px of [-7, 0, 7]) { c.fillStyle = '#b9b3a4'; c.fillRect(px - 2.5, -8, 5, 16); c.strokeRect(px - 2.5, -8, 5, 16); } }
  else if (type === 'crab') poly([[0, -9], [10, 8], [-10, 8]], '#e07b39');
  else if (type === 'islet') { c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fillStyle = '#8a6d4b'; c.fill(); c.stroke(); }
  else if (type === 'treasure') { c.strokeStyle = '#a3201a'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-7, -7); c.lineTo(7, 7); c.moveTo(7, -7); c.lineTo(-7, 7); c.stroke(); }
  else if (type === 'quest') poly([[0, -10], [10, 0], [0, 10], [-10, 0]], '#e9c46a');
  else if (type === 'course') { c.beginPath(); c.moveTo(-5, 10); c.lineTo(-5, -10); c.stroke(); poly([[-5, -10], [9, -5], [-5, 0]], '#fff'); }
  else if (type === 'merchant' || type === 'navy' || type === 'hostile') { c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fillStyle = { merchant: '#d9c79a', navy: '#7fa3d6', hostile: '#e0524a' }[type]; c.fill(); c.stroke(); }
  else if (type === 'storm') { c.strokeStyle = '#3d464c'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 3 + i * 3.5, i * 2, i * 2 + 4); c.stroke(); } }
  else if (type === 'zone') { c.strokeStyle = '#a3201a'; c.setLineDash([4, 3]); c.beginPath(); c.arc(0, 0, 9, 0, 7); c.stroke(); }
  else if (type === 'fog') { c.fillStyle = '#26323a'; c.fillRect(-9, -9, 18, 18); }
  c.restore();
}
const compass = (dx, dz) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(-dx, dz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];

export function createMap(game, $) {
  const el = $('map'), cv = $('mapCv'), c = cv.getContext('2d'), info = $('mapInfo'), legend = $('mapLegend');
  const m = { cx: 0, cz: 0, k: 0.2, icons: [], sel: null };
  let W = 0, H = 0, dpr = 1;
  const S = () => game.save, X = (x) => W / 2 - (x - m.cx) * m.k, Y = (z) => H / 2 - (z - m.cz) * m.k;
  const revealed = (x, z) => { const n = FOG_N, i = Math.floor(((x + WORLD_R) / (WORLD_R * 2)) * n), j = Math.floor(((z + WORLD_R) / (WORLD_R * 2)) * n); return i >= 0 && j >= 0 && i < n && j < n && game.fog[j * n + i] === 1; };
  const me = () => (game.mode === 'land' && !game.land.cave ? game.land.player : game.sea.player);

  legend.innerHTML = LEGEND.map(([t, label]) => `<div><canvas width="52" height="52" data-ic="${t}"></canvas><span>${label}</span></div>`).join('');
  for (const lc of legend.querySelectorAll('canvas')) { const x = lc.getContext('2d'); icon(x, lc.dataset.ic, 26, 26, 1.7); }

  function collect() {
    const s = S(), out = [], p = me(), sea = game.sea;
    for (const isl of ISLANDS) if (s.seen[isl.id]) out.push({ type: isl.kind, x: isl.x, z: isl.z, isl });
    for (const id in ZONES) out.push({ type: 'zone', x: ZONES[id].x, z: ZONES[id].z, zone: ZONES[id], hide: true });
    for (const mp of s.maps) { const isl = ISLAND[mp.island], d = isl.digs[mp.spot]; out.push({ type: 'treasure', x: d.x, z: d.z, map: mp }); }
    if (sea.event && sea.event.type === 'storm') out.push({ type: 'storm', x: sea.event.x, z: sea.event.z, storm: sea.event });
    const range = s.pet === 'parrot' ? 640 : 430;
    if (game.mode !== 'land') for (const sh of sea.ships) if (sh.alive && dist2(sh.x, sh.z, p.x, p.z) < range) out.push({ type: sh.faction === 'merchant' ? 'merchant' : sh.faction === 'navy' && !(sh.provoked || s.rep.navy <= -20) ? 'navy' : 'hostile', x: sh.x, z: sh.z, ship: sh });
    const q = game.quests.marker(); if (q && !s.course) out.push({ type: 'quest', x: q.x, z: q.z, quest: q });
    if (s.course) out.push({ type: 'course', x: s.course.x, z: s.course.z, course: s.course });
    return out;
  }

  function draw() {
    if (el.hidden) return;
    const r = el.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#d3c292'; c.fillRect(0, 0, W, H);
    // sea grid
    c.strokeStyle = 'rgba(90,70,40,.16)'; c.lineWidth = 1;
    for (let g = -WORLD_R; g <= WORLD_R; g += 290) { c.beginPath(); c.moveTo(X(g), Y(-WORLD_R)); c.lineTo(X(g), Y(WORLD_R)); c.moveTo(X(-WORLD_R), Y(g)); c.lineTo(X(WORLD_R), Y(g)); c.stroke(); }
    c.save(); c.translate(W / 2, H / 2); c.scale(-m.k, -m.k); c.translate(-m.cx, -m.cz); c.drawImage(game.world.chart, -WORLD_R, -WORLD_R, WORLD_R * 2, WORLD_R * 2); c.restore();
    // fog of war
    const cell = (WORLD_R * 2) / FOG_N, px = cell * m.k + 1;
    c.fillStyle = '#26323a';
    for (let j = 0; j < FOG_N; j++) for (let i = 0; i < FOG_N; i++) if (!game.fog[j * FOG_N + i]) c.fillRect(X(-WORLD_R + (i + 1) * cell) - 0.5, Y(-WORLD_R + (j + 1) * cell) - 0.5, px, px);
    c.fillStyle = 'rgba(38,50,58,.45)';
    for (let j = 0; j < FOG_N; j++) for (let i = 0; i < FOG_N; i++) if (game.fog[j * FOG_N + i]) { // soften the fog edge
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const u = i + a, v = j + b; return u >= 0 && v >= 0 && u < FOG_N && v < FOG_N && !game.fog[v * FOG_N + u]; });
      if (edge) c.fillRect(X(-WORLD_R + (i + 1) * cell) - 0.5, Y(-WORLD_R + (j + 1) * cell) - 0.5, px, px);
    }
    c.strokeStyle = '#3a2a18'; c.lineWidth = 2; c.strokeRect(X(WORLD_R), Y(WORLD_R), WORLD_R * 2 * m.k, WORLD_R * 2 * m.k);
    // dangerous waters and weather show even through fog
    c.textAlign = 'center';
    for (const id in ZONES) { const z = ZONES[id], lit = revealed(z.x, z.z); c.strokeStyle = lit ? 'rgba(150,40,30,.8)' : 'rgba(224,110,96,.8)'; c.lineWidth = 2; c.setLineDash([7, 6]); c.beginPath(); c.arc(X(z.x), Y(z.z), z.r * m.k, 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = lit ? '#8a2018' : '#e9a093'; c.font = 'italic 600 14px Georgia, serif'; c.fillText(lit ? z.name : 'Dangerous waters', X(z.x), Y(z.z) + 5); }
    const ev = game.sea.event;
    if (ev && ev.type === 'storm') { c.fillStyle = 'rgba(50,58,66,.42)'; c.beginPath(); c.arc(X(ev.x), Y(ev.z), ev.r * m.k, 0, 7); c.fill(); }
    // names
    for (const isl of ISLANDS) if (S().seen[isl.id]) { c.font = '600 15px Georgia, serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(211,194,146,.85)'; c.strokeText(isl.name, X(isl.x), Y(isl.z) + isl.r * m.k + 18); c.fillStyle = '#2a1d10'; c.fillText(isl.name, X(isl.x), Y(isl.z) + isl.r * m.k + 18); }
    m.icons = collect();
    for (const ic of m.icons) { if (ic.type === 'zone') continue; icon(c, ic.type, X(ic.x), Y(ic.z), ic === m.sel ? 1.35 : 1); }
    const p = me(); icon(c, 'you', X(p.x), Y(p.z), 1.1, -(game.mode === 'land' ? p.face : p.heading));
    c.fillStyle = '#2a1d10'; c.font = '700 20px Georgia, serif'; c.fillText('N', W - 30, H - 58); c.strokeStyle = '#2a1d10'; c.lineWidth = 2; c.beginPath(); c.moveTo(W - 30, H - 50); c.lineTo(W - 30, H - 22); c.moveTo(W - 36, H - 44); c.lineTo(W - 30, H - 52); c.lineTo(W - 24, H - 44); c.stroke();
  }

  function describe(ic) {
    const s = S(), p = me(), d = Math.round(dist2(p.x, p.z, ic.x, ic.z)), where = `${d} m ${compass(ic.x - p.x, ic.z - p.z)} of you`;
    let title = '', sub = '', body = '', course = null;
    if (ic.isl) {
      const isl = ic.isl, f = PORT_FACTION[isl.id] || (isl.kind === 'fort' ? 'blood' : null);
      title = isl.name; sub = `${KIND[isl.kind]} · ${where}`; body = `<p>${isl.blurb}</p>`;
      if (isl.kind === 'town') {
        const pr = PORT_PRICES[isl.id], names = (test) => Object.keys(pr).filter((g) => test(pr[g])).map((g) => GOODS[g].name).join(', ') || 'nothing special';
        body += `<p><b>Here:</b> tavern (jobs, rum, ransoms), shipwright, blacksmith, market.</p><p><b>Cheap to buy:</b> ${names((v) => v <= 0.85)}<br><b>Sells dear:</b> ${names((v) => v >= 1.25)}</p>`;
      }
      if (f) body += `<p><b>${FACTIONS[f].name}:</b> ${standing(s.rep[f])} (${s.rep[f]})</p>`;
      const n = s.maps.filter((mp) => mp.island === isl.id).length; if (n) body += `<p>You hold ${n} treasure map${n > 1 ? 's' : ''} for this island.</p>`;
      course = { x: isl.anchor.x, z: isl.anchor.z, name: isl.name };
    } else if (ic.zone) { title = revealed(ic.x, ic.z) ? ic.zone.name : 'Dangerous waters'; sub = where; body = `<p>${revealed(ic.x, ic.z) ? 'Something far stronger than an ordinary crew waits here. Come with a sound hull and full powder.' : 'The charts only warn of it. Ships that go in tend not to come out.'}</p>`; course = { x: ic.x, z: ic.z, name: title }; }
    else if (ic.map) { title = 'Buried treasure'; sub = `${ISLAND[ic.map.island].name} · ${where}`; body = '<p>Go ashore and walk to the mark. Dig when the button appears. A dog will lead you to it.</p>'; course = { x: ISLAND[ic.map.island].anchor.x, z: ISLAND[ic.map.island].anchor.z, name: ISLAND[ic.map.island].name }; }
    else if (ic.storm) { title = 'Storm'; sub = where; body = '<p>It drifts across the sea. Steer around it, or reef your sails inside it: full sail tears the rigging and breaks the hull.</p>'; }
    else if (ic.ship) { const sh = ic.ship; title = sh.name; sub = `${ic.type === 'hostile' ? 'Hostile' : 'Not hostile'} · ${where}`; body = `<p>Hull ${Math.round((sh.hp / sh.maxHp) * 100)}% · ${sh.def.guns} guns a side · crew of ${sh.crew.length}${sh.surrendered ? ' · has struck her colours' : ''}</p><p>Sink her for infamy, or board her for the whole cargo.</p>`; course = { x: sh.x, z: sh.z, name: sh.name }; }
    else if (ic.quest) { const o = game.quests.objective(); title = o.title; sub = `Objective · ${where}`; body = `<p>${o.short}</p>`; }
    else if (ic.course) { title = `Course: ${ic.course.name}`; sub = where; body = '<p>Your compass marker points here.</p>'; }
    const atSea = game.mode === 'sea' || game.mode === 'deck', far = d > 150;
    const fast = ic.isl && (ic.isl.kind === 'town' || ic.isl.kind === 'hideout') && far ? Math.round(d * 0.12) + 20 : 0; info._isl = ic.isl; info._fast = fast;
    info.innerHTML = `<b>${title}</b><small>${sub}</small>${body}<div class="mapBtns">${course ? '<button type="button" class="btn go" data-course="set">Set course</button>' : ''}${course && atSea && far ? '<button type="button" class="btn" data-course="mate">Mate, sail us there</button>' : ''}${fast ? `<button type="button" class="btn" data-course="fast">Fast travel (${fast} gold)</button>` : ''}${s.course ? '<button type="button" class="btn" data-course="clear">Clear course</button>' : ''}<button type="button" class="btn" data-course="close">Close</button></div>`;
    info.hidden = false; info._course = course;
  }
  info.addEventListener('click', (e) => {
    const b = e.target.closest('[data-course]'); if (!b) return;
    if (b.dataset.course === 'set') { S().course = info._course; game.toast(`Course set for ${info._course.name}. Follow the marker on your compass.`, 'gold'); }
    if (b.dataset.course === 'clear') { S().course = null; game.sea.setMate(null); }
    if (b.dataset.course === 'mate') { S().course = info._course; m.close(); game.sea.setMate(info._course); return; }
    if (b.dataset.course === 'fast') { m.close(); game.fastTravel(info._isl, info._fast); return; }
    info.hidden = true; m.sel = null; draw();
  });

  // ----- pan, pinch and tap -----
  const pts = new Map(); let moved = 0, pinch = 0;
  const zoomAt = (f, sx, sy) => { const wx = m.cx - (sx - W / 2) / m.k, wz = m.cz - (sy - H / 2) / m.k; m.k = clamp(m.k * f, Math.min(W, H) / (WORLD_R * 2.3), 2.2); m.cx = wx + (sx - W / 2) / m.k; m.cz = wz + (sy - H / 2) / m.k; bound(); draw(); };
  const bound = () => { m.cx = clamp(m.cx, -WORLD_R, WORLD_R); m.cz = clamp(m.cz, -WORLD_R, WORLD_R); };
  cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 1) { m.cx += dx / m.k; m.cz += dy / m.k; bound(); draw(); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = cv.getBoundingClientRect(); if (pinch > 0) zoomAt(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinch = d; }
  });
  const up = (e) => {
    const had = pts.size; pts.delete(e.pointerId);
    if (had === 1 && moved < 10) { // a tap: pick the nearest icon
      const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top; let best = null, bd = 30;
      for (const ic of m.icons) { const d = Math.hypot(X(ic.x) - sx, Y(ic.z) - sy) - (ic.type === 'zone' ? 14 : 0); if (d < bd && !(ic.isl && !S().seen[ic.isl.id])) { bd = d; best = ic; } }
      m.sel = best; if (best) describe(best); else info.hidden = true; draw();
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
  cv.addEventListener('wheel', (e) => { const r = cv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - r.left, e.clientY - r.top); e.preventDefault(); }, { passive: false });
  $('mapIn').addEventListener('click', () => zoomAt(1.4, W / 2, H / 2));
  $('mapOut').addEventListener('click', () => zoomAt(1 / 1.4, W / 2, H / 2));
  $('mapMe').addEventListener('click', () => { const p = me(); m.cx = p.x; m.cz = p.z; draw(); });
  $('mapLegendBtn').addEventListener('click', () => { legend.hidden = !legend.hidden; });
  $('mapClose').addEventListener('click', () => m.close());
  window.addEventListener('resize', draw);

  m.open = () => {
    if (game.ui.panel) game.ui.close();
    el.hidden = false; game.paused = true; info.hidden = true; legend.hidden = true; m.sel = null;
    const r = el.getBoundingClientRect(), p = me(); W = r.width; H = r.height; m.cx = p.x; m.cz = p.z; m.k = (Math.min(W, H) / (WORLD_R * 2)) * 2.1; draw();
  };
  m.close = () => { el.hidden = true; game.paused = false; for (const k in game.input.pressed) game.input.pressed[k] = false; };
  m.isOpen = () => !el.hidden;
  return m;
}
