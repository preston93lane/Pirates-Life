// Story chain and tavern jobs. Both are driven by events the rest of the game emits.
import { STORY, ISLAND, ISLANDS, ZONES, GOODS, FOES } from './data.js';
import { cargoUsed, shipStats } from './state.js';
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
      case 'raid': return evt === 'raid';
      case 'boss': return evt === 'boss' && d.boss === obj.boss;
      case 'deliver': if (evt === 'talk' && d.npc === `${obj.to}:tavern` && S().questCargo >= obj.n) { S().questCargo -= obj.n; return true; } return false;
      default: return false;
    }
  }
  q.begin = () => { // hand over anything the current chapter gives you
    const st = S().story, step = q.step();
    if (st.given || !step.give) return;
    if (step.give.map) S().maps.push(Object.assign({}, step.give.map));
    if (step.give.quest) S().questCargo += step.give.quest;
    st.given = true;
  };
  q.on = (evt, d) => {
    const s = S(), step = q.step();
    if (step.obj.type !== 'none' && matches(step.obj, evt, d, s.story)) {
      game.reward(step.reward, `Chapter complete: ${step.title}`);
      s.story.i++; s.story.n = 0; s.story.given = false; q.begin();
      game.ui.banner('New chapter', q.step().title, q.step().text);
    }
    for (const job of s.jobs.slice()) if (matches(job.obj, evt, d, job)) { s.jobs.splice(s.jobs.indexOf(job), 1); game.reward(job.reward, `Job done: ${job.title}`); }
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
      case 'raid': return 'Break open the vault at Bloodwater Hold';
      case 'boss': return { crabking: 'Kill the Crab King on Crabclaw Key', ghost: 'Sink the Drowned Queen in the Drowned Reach', kraken: 'Destroy the Kraken in The Maw' }[o.boss];
      default: return 'Sail where you please';
    }
  }
  q.shortText = shortText; q.progress = progress;

  // where the compass should point
  q.marker = () => {
    const st = q.step(), o = st.obj, p = game.sea.player;
    if (o.type === 'sink') { let best = null, bd = 1e9; for (const sh of game.sea.ships) if (sh.alive && sh.faction === o.faction) { const d = dist2(p.x, p.z, sh.x, sh.z); if (d < bd) { bd = d; best = sh; } } if (best) return { x: best.x, z: best.z, name: best.name }; }
    const id = st.mark || (S().jobs[0] && S().jobs[0].mark);
    if (!id) return null;
    if (ZONES[id]) return { x: ZONES[id].x, z: ZONES[id].z, name: ZONES[id].name };
    const isl = ISLAND[id];
    if (game.mode === 'land' && game.land.isl === isl) return null;
    return { x: isl.anchor.x, z: isl.anchor.z, name: isl.name };
  };

  // ----- tavern jobs -----
  function makeJob(port) {
    const lvl = S().level, r = Math.random(), id = `${Date.now()}-${Math.round(rand(1e6))}`;
    if (r < 0.4) {
      const to = pick(PORTS.filter((p) => p.id !== port)), good = pick(Object.keys(GOODS)), n = 4 + Math.floor(rand(7)), d = dist2(ISLAND[port].x, ISLAND[port].z, to.x, to.z);
      return { id, type: 'deliver', title: `${GOODS[good].name} for ${to.name}`, text: `Carry ${n} crates of ${GOODS[good].name.toLowerCase()} to the tavern at ${to.name}. Takes ${n} hold space.`, obj: { type: 'deliver', good, n, to: to.id }, cargo: n, mark: to.id, reward: { gold: Math.round(n * GOODS[good].price * 0.7 + d * 0.22), xp: 60 }, n: 0 };
    }
    if (r < 0.7) {
      const navy = port === 'shoals' && Math.random() < 0.5, n = 1 + Math.floor(rand(Math.min(3, 1 + lvl / 3)));
      return { id, type: 'sink', title: navy ? 'Bleed the Navy' : 'Thin the Bloodwater', text: `${navy ? 'The smugglers want fewer patrols.' : 'Traders pay to see fewer red sails.'} Sink or board ${n} ${navy ? 'navy' : 'Bloodwater'} ship${n > 1 ? 's' : ''}.`, obj: { type: 'sink', faction: navy ? 'navy' : 'pirate', n }, reward: { gold: (navy ? 320 : 170) * n, xp: 70 * n }, n: 0 };
    }
    const [foe, isl, per] = pick([['skeleton', 'bones', 46], ['crab', 'crab', 30], ['brigand', 'saltmere', 40]]), n = 3 + Math.floor(rand(4));
    return { id, type: 'kill', title: `Cull: ${FOES[foe].name}`, text: `Kill ${n} ${FOES[foe].name}${foe === 'brigand' ? ' (bandits camp on the far side of Saltmere and hold Bloodwater Hold)' : ` on ${ISLAND[isl].name}`}.`, obj: { type: 'kill', foe, n }, mark: isl, reward: { gold: per * n, xp: 22 * n }, n: 0 };
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
