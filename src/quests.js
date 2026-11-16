// Story chain and tavern jobs. Both are driven by events the rest of the game emits.
import { STORY, ISLAND, ISLANDS, ZONES, GOODS, FOES, PORT_FACTION, DAILY, DEEDS, BOUNTIES, FOLK, CHARTS } from './data.js';
import { cargoUsed, shipStats, addRep, giveChart } from './state.js';
import { pick, rand, dist2 } from './util.js';

const PORTS = ISLANDS.filter((i) => i.kind === 'town');

export function createQuests(game) {
  const q = {};
  const S = () => game.save;
  q.step = () => STORY[Math.min(S().story.i, STORY.length - 1)];

  function matches(obj, evt, d, holder) {
    switch (obj.type) {
      case 'talk': return evt === 'talk' && d.npc === obj.npc;
      case 'sink': return evt === 'sink' && d.faction === obj.faction && ++holder.n >= obj.n;
      case 'dig': return evt === 'dig' && d.island === obj.island;
      case 'build': return evt === 'build' && d.building === obj.building;
      case 'kill': return evt === 'kill' && d.foe === obj.foe && ++holder.n >= obj.n;
      case 'raid': return evt === 'raid' && (!obj.island || d.island === obj.island);
      case 'boss': return evt === 'boss' && d.boss === obj.boss;
      case 'deliver': if (evt === 'talk' && d.npc === `${obj.to}:tavern` && S().questCargo >= obj.n) { S().questCargo -= obj.n; return true; } return false;
      case 'yield': return evt === 'yield';
      case 'bounty': return evt === 'bounty';
      default: return false;
    }
  }
  q.begin = () => { // hand over anything the current chapter gives you
    const st = S().story, step = q.step();
    if (st.given || !step.give) return;
    if (step.give.map) S().maps.push(Object.assign({}, step.give.map));
    if (step.give.quest) S().questCargo += step.give.quest;
    if (step.give.chart) { const c = giveChart(S(), step.give.chart); if (c) game.toast(`A star chart: ${CHARTS[c].name}. See Captain, Charts.`, 'gold'); }
    st.given = true;
  };
  const told = {};
  const dayKey = (ms) => { const t = new Date(ms); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`; };
  // Three orders a day, and a streak for coming back on consecutive days.
  q.daily = () => {
    const s = S(), t = dayKey(Date.now());
    if (!s.daily || s.daily.day !== t) {
      const streak = s.daily && s.daily.day === dayKey(Date.now() - 864e5) ? (s.daily.streak || 0) + 1 : 1;
      const pool = DAILY.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      s.daily = { day: t, streak, login: false, bonus: false, tasks: pool.map((d) => ({ id: d.id, goal: Math.round(rand(d.n[0], d.n[1]) / (d.step || 1)) * (d.step || 1), n: 0, claimed: false })) };
    }
    return s.daily;
  };
  q.dailyText = (t) => DAILY.find((x) => x.id === t.id).text(t.goal);
  q.dailyReward = () => ({ gold: 100 + 35 * S().level, xp: 50 + 10 * S().level });
  q.bonusReward = () => ({ gold: 250 + 60 * S().level, iron: 20, timber: 20, rum: 1 });
  q.loginReward = () => { const k = q.daily().streak; return { gold: 40 * Math.min(k, 7) + (k % 7 === 0 ? 300 : 0) }; };
  q.claimDaily = (i) => { const t = q.daily().tasks[i]; if (t.n >= t.goal && !t.claimed) { t.claimed = true; game.reward(q.dailyReward(), 'Order complete'); } };
  q.claimBonus = () => { const d = q.daily(); if (!d.bonus && d.tasks.every((t) => t.claimed)) { d.bonus = true; game.reward(q.bonusReward(), "All of today's orders done"); } };
  q.claimLogin = () => { const d = q.daily(); if (!d.login) { d.login = true; game.reward(q.loginReward(), `Day ${d.streak} at sea`); } };
  q.claimDeed = (id) => { const s = S(), d = DEEDS.find((x) => x.id === id); if (d && !s.deeds[id] && d.stat(s) >= d.goal) { s.deeds[id] = true; game.reward(d.reward, `Deed: ${d.name}`); } };
  q.pendingClaims = () => { const s = S(), d = q.daily(); return d.tasks.filter((t) => t.n >= t.goal && !t.claimed).length + (d.login ? 0 : 1) + DEEDS.filter((x) => !s.deeds[x.id] && x.stat(s) >= x.goal).length; };
  q.takeBounty = (id, port) => {
    const s = S(), isl = ISLAND[port], pos = game.sea.openWater(isl.x, isl.z, isl.r + 380, isl.r + 700);
    if (!pos) return 'No word of her today. Try again.';
    s.bounty = { id, x: pos.x, z: pos.z }; return null;
  };
  q.on = (evt, d) => {
    const s = S(), step = q.step();
    if (step.obj.type !== 'none' && matches(step.obj, evt, d, s.story)) {
      game.reward(step.reward, `Chapter complete: ${step.title}`);
      s.story.i++; s.story.n = 0; s.story.given = false; q.begin();
      game.ui.banner('New chapter', q.step().title, q.step().text);
    }
    // daily orders
    for (const t of q.daily().tasks) { const def = DAILY.find((x) => x.id === t.id); if (def.evt === evt && t.n < t.goal) { t.n = Math.min(t.goal, t.n + (def.amount ? d.gold || 0 : 1)); if (t.n >= t.goal) game.toast('Daily order done. Claim it in Menu, Orders.', 'gold'); } }
    // running tallies for deeds
    const tally = { yield: 'yields', storm: 'storms', ransom: 'ransomed' }[evt]; if (tally) s.stats[tally] = (s.stats[tally] || 0) + 1;
    if (evt === 'sink') s.mercy = Math.max(0, (s.mercy || 0) - 0.34);
    // bounty collected?
    if (evt === 'sink' && s.bounty && d.type === s.bounty.id) {
      const b = BOUNTIES.find((x) => x.id === s.bounty.id), times = s.bountyDone[b.id] || 0;
      s.bountyDone[b.id] = times + 1; s.bounty = null; if (b.level >= 4) { const c = giveChart(s); if (c) game.toast(`${b.captain} carried a star chart: ${CHARTS[c].name}.`, 'gold'); } s.stats.bounties = (s.stats.bounties || 0) + 1;
      game.reward({ gold: Math.round(b.gold * (1 + 0.25 * times)), xp: Math.round(b.gold * 0.3) }, `Bounty collected: ${b.captain}`); game.ui.banner('Bounty collected', b.captain, 'The poster comes down. A harder name will take its place.');
      q.on('bounty', {});
    }
    for (const d2 of DEEDS) if (!s.deeds[d2.id] && !told[d2.id] && d2.stat(s) >= d2.goal) { told[d2.id] = true; game.toast(`Deed done: ${d2.name}. Claim it in Menu, Deeds.`, 'gold'); }
    // favours asked by townsfolk
    for (const f of FOLK) { const st = s.folk[f.id]; if (st && st.on && !st.ready && matches(f.steps[st.i].obj, evt, d, st)) { st.ready = true; game.toast(`Done. ${f.name} in ${ISLAND[f.isl].name} will want to hear of it.`, 'gold'); } }
    for (const job of s.jobs.slice()) if (matches(job.obj, evt, d, job)) { s.jobs.splice(s.jobs.indexOf(job), 1); game.reward(job.reward, `Job done: ${job.title}`); for (const f in job.rep || {}) addRep(s, f, job.rep[f]); }
    game.ui.dirty = true;
  };

  const progress = (obj, n) => (obj.n > 1 && obj.type !== 'deliver' ? ` (${Math.min(n, obj.n)}/${obj.n})` : '');
  q.objective = () => { const st = q.step(); return { title: st.title, text: st.text, short: shortText(st.obj) + progress(st.obj, S().story.n) }; };
  function shortText(o) {
    switch (o.type) {
      case 'talk': { const [isl, kind] = o.npc.split(':'); return `Speak to the ${kind} keeper in ${ISLAND[isl].name}`; }
      case 'sink': return `Sink or board ${o.n > 1 ? o.n : 'a'} ${o.faction === 'pirate' ? 'Bloodwater' : o.faction} ship${o.n > 1 ? 's' : ''}`;
      case 'dig': return `Dig up the treasure on ${ISLAND[o.island].name}`;
      case 'build': return `Build a ${{ lumber: 'Lumber Camp' }[o.building] || o.building} at Rogue's Rest`;
      case 'deliver': return `Deliver ${o.n} ${GOODS[o.good].name.toLowerCase()} to the ${ISLAND[o.to].name} tavern`;
      case 'kill': return `Slay ${o.n} ${FOES[o.foe].name}${o.island ? ` on ${ISLAND[o.island].name}` : ''}`;
      case 'raid': return o.island === 'regal' ? 'Break open the strongroom at Fort Regal' : 'Break open the vault at Bloodwater Hold';
      case 'boss': return { crabking: 'Kill the Crab King on Crabclaw Key', ghost: 'Sink the Drowned Queen in the Drowned Reach', kraken: 'Destroy the Kraken in The Maw', poseidon: "Defeat Poseidon at his Throne, far to the south-west" }[o.boss];
      case 'yield': return 'Make a ship strike her colours';
      case 'bounty': return 'Take a bounty poster at a tavern and collect on it';
      default: return 'Sail where you please';
    }
  }
  q.shortText = shortText; q.progress = progress;
  // townsfolk favours: one step at a time, taken and handed in by talking to them
  q.folk = (id) => { const s = S(), f = FOLK.find((x) => x.id === id), st = s.folk[id] || { i: 0, on: false, ready: false, n: 0 }; return { f, st, step: f.steps[st.i], over: st.i >= f.steps.length }; };
  q.folkAccept = (id) => { const s = S(), { st } = q.folk(id); s.folk[id] = Object.assign(st, { on: true, ready: false, n: 0 }); };
  q.folkClaim = (id) => { const s = S(), { f, st, step } = q.folk(id); if (!st.ready) return; game.reward(step.reward, `${f.name} is grateful`); addRep(s, PORT_FACTION[f.isl], 6); s.folk[id] = { i: st.i + 1, on: false, ready: false, n: 0 }; };
  q.folkActive = () => FOLK.filter((f) => S().folk[f.id] && S().folk[f.id].on).map((f) => { const st = S().folk[f.id], o = f.steps[st.i].obj; return { name: f.name, port: ISLAND[f.isl].name, text: st.ready ? `Return to ${f.name} in ${ISLAND[f.isl].name}` : shortText(o) + progress(o, st.n) }; });

  // where the compass should point
  q.marker = () => {
    const st = q.step(), o = st.obj, p = game.sea.player;
    if (o.type === 'sink') { let best = null, bd = 1e9; for (const sh of game.sea.ships) if (sh.alive && sh.faction === o.faction) { const d = dist2(p.x, p.z, sh.x, sh.z); if (d < bd) { bd = d; best = sh; } } if (best) return { x: best.x, z: best.z, name: best.name }; }
    if (S().course) return S().course;
    if (S().bounty) { const b = S().bounty, sh = game.sea.ships.find((x) => x.alive && x.type === b.id); return sh ? { x: sh.x, z: sh.z, name: sh.name } : { x: b.x, z: b.z, name: 'Bounty last seen here' }; }
    const id = st.mark || (S().jobs[0] && S().jobs[0].mark);
    if (!id) return null;
    if (ZONES[id]) return { x: ZONES[id].x, z: ZONES[id].z, name: ZONES[id].name };
    const isl = ISLAND[id];
    if (game.mode === 'land' && game.land.isl === isl) return null;
    return { x: isl.anchor.x, z: isl.anchor.z, name: isl.name };
  };

  // ----- tavern jobs -----
  function makeJob(port) {
    const home = PORT_FACTION[port], lvl = S().level, r = Math.random(), id = `${Date.now()}-${Math.round(rand(1e6))}`;
    if (r < 0.4) {
      const to = pick(PORTS.filter((p) => p.id !== port)), good = pick(Object.keys(GOODS)), n = 4 + Math.floor(rand(7)), d = dist2(ISLAND[port].x, ISLAND[port].z, to.x, to.z);
      return { id, type: 'deliver', title: `${GOODS[good].name} for ${to.name}`, text: `Carry ${n} crates of ${GOODS[good].name.toLowerCase()} to the tavern at ${to.name}. Takes ${n} hold space.`, obj: { type: 'deliver', good, n, to: to.id }, cargo: n, mark: to.id, reward: { gold: Math.round(n * GOODS[good].price * 0.7 + d * 0.22), xp: 60 }, rep: { [home]: 4, [PORT_FACTION[to.id]]: 6 }, n: 0 };
    }
    if (r < 0.7) {
      const navy = port === 'shoals' && Math.random() < 0.6, n = 1 + Math.floor(rand(Math.min(3, 1 + lvl / 3)));
      return { id, type: 'sink', title: navy ? 'Bleed the Navy' : 'Thin the Bloodwater', text: `${navy ? 'The smugglers want fewer patrols.' : 'Traders pay to see fewer red sails.'} Sink or board ${n} ${navy ? 'navy' : 'Bloodwater'} ship${n > 1 ? 's' : ''}.`, obj: { type: 'sink', faction: navy ? 'navy' : 'pirate', n }, reward: { gold: (navy ? 320 : 170) * n, xp: 70 * n }, rep: navy ? { smug: 10, blood: 8 } : { [home]: 6, navy: port === 'regal' ? 12 : 4 }, n: 0 };
    }
    const [foe, isl, per] = pick([['skeleton', 'bones', 46], ['crab', 'crab', 30], ['brigand', 'saltmere', 40]]), n = 3 + Math.floor(rand(4));
    return { id, type: 'kill', title: `Cull: ${FOES[foe].name}`, text: `Kill ${n} ${FOES[foe].name}${foe === 'brigand' ? ' (bandits camp on the far side of Saltmere and hold Bloodwater Hold)' : ` on ${ISLAND[isl].name}`}.`, obj: { type: 'kill', foe, n }, mark: isl, reward: { gold: per * n, xp: 22 * n }, rep: { [home]: 5 }, n: 0 };
  }
  q.offers = (port) => {
    const o = S().offers;
    if (!o[port] || Date.now() - o[port].t > 10 * 60000) o[port] = { t: Date.now(), list: [makeJob(port), makeJob(port), makeJob(port)] };
    return o[port].list;
  };
  q.accept = (port, i) => {
    const s = S(), list = q.offers(port), job = list[i];
    if (s.jobs.length >= 3) return 'You already carry three jobs.';
    if (job.cargo && cargoUsed(s) + job.cargo > shipStats(s).cargo) return 'Not enough room in the hold.';
    if (job.cargo) s.questCargo += job.cargo;
    s.jobs.push(job); list[i] = makeJob(port);
    return null;
  };
  q.abandon = (id) => { const s = S(), j = s.jobs.find((x) => x.id === id); if (!j) return; if (j.cargo) s.questCargo = Math.max(0, s.questCargo - j.cargo); s.jobs.splice(s.jobs.indexOf(j), 1); };
  return q;
}
