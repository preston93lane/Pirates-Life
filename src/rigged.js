// Animated people for the game, built on the KayKit rigs in public/models.
// Each actor keeps the same interface the procedural figures have (root, anim, update, height),
// so combat code does not change. The procedural figure stands in until the model has loaded.
import * as THREE from 'three';
import { AnimationMixer } from 'three';
import { buildCharacter, staticFigure } from './character.js';
import { loadGltf, loadModel } from './models.js';

const TARGET_H = 1.85;
// which body each game look wears
const BODY = {
  skeleton: 'characters/skeletons/Skeleton_Warrior.glb',
  brigand: 'characters/adventurers/Barbarian.glb', brute: 'characters/adventurers/Barbarian.glb', bruiser: 'characters/adventurers/Barbarian.glb',
  marksman: 'characters/adventurers/Ranger.glb', rifleman: 'characters/adventurers/Ranger.glb', musketeer: 'characters/adventurers/Ranger.glb',
  captain: 'characters/adventurers/Knight.glb', soldier: 'characters/adventurers/Knight.glb', commandant: 'characters/adventurers/Knight.glb', bravo: 'characters/adventurers/Knight.glb',
  crew: 'characters/adventurers/Rogue.glb',
};
// the animation files and the clip in each that a game state uses
const FILES = { general: 'animations/medium/Rig_Medium_General.glb', move: 'animations/medium/Rig_Medium_MovementBasic.glb', melee: 'animations/medium/Rig_Medium_CombatMelee.glb', ranged: 'animations/medium/Rig_Medium_CombatRanged.glb' };
const CLIP = {
  idle: ['general', 'Idle_A', true], walk: ['move', 'Walking_A', true], run: ['move', 'Running_A', true],
  hit: ['general', 'Hit_A', false], dead: ['general', 'Death_A', false], aim: ['ranged', 'Ranged_1H_Aiming', true],
  block: ['melee', 'Melee_Blocking', true],
  melee0: ['melee', 'Melee_1H_Attack_Slice_Horizontal', false], melee1: ['melee', 'Melee_1H_Attack_Slice_Diagonal', false], melee2: ['melee', 'Melee_2H_Attack_Chop', false],
};

let clipsP = null;
function loadClips() {
  if (!clipsP) clipsP = Promise.all(Object.entries(FILES).map(([k, f]) => loadGltf(f).then((g) => [k, g]))).then((all) => {
    const by = {}; for (const [k, g] of all) by[k] = g ? Object.fromEntries(g.animations.map((a) => [a.name, a])) : {};
    return by;
  });
  return clipsP;
}

// Stand the body on the ground at the procedural figure's height, facing the same way.
function fit(body) {
  const box = new THREE.Box3().setFromObject(body), h = Math.max(0.01, box.max.y - box.min.y), s = TARGET_H / h;
  const wrap = new THREE.Group(); body.scale.setScalar(s); body.position.y = -box.min.y * s; wrap.add(body);
  return wrap;
}

function pickKey(a) {
  switch (a.state) {
    case 'idle': case 'rise': case 'buried': case 'dig': case 'roll': case 'whirl': case 'throw': return 'idle';
    case 'run': return a.speed < 3 ? 'walk' : 'run';
    case 'attack': return 'melee' + ((a.i || 0) % 3);
    case 'aim': case 'shoot': return 'aim';
    case 'stagger': return 'hit';
    case 'block': return 'block';
    case 'dead': return 'dead';
    default: return 'idle';
  }
}

// Rig-driven pose: loops for idle and moving, scrubbed by the game's own timing for attacks and death.
function drive(ch, dt) {
  const a = ch.anim, key = pickKey(a);
  if (key !== ch.cur) {
    const prev = ch.actions[ch.cur], next = ch.actions[key] || ch.actions.idle;
    if (prev) prev.fadeOut(0.15);
    if (next) { next.reset(); next.paused = false; next.fadeIn(0.15).play(); }
    ch.cur = key;
  }
  const act = ch.actions[key]; if (!act) { ch.mixer.update(dt); return; }
  const dur = act.getClip().duration;
  if (key.startsWith('melee')) { act.paused = true; act.time = Math.min(dur, Math.max(0, a.u || 0) * dur); }
  else if (key === 'dead') { act.paused = true; act.time = Math.min(dur, (a.t || 0) * 1.2); }
  ch.mixer.update(dt);
}

function attachBody(holder, look, onReady) {
  const file = BODY[look]; if (!file) return;
  Promise.all([loadModel(file), loadClips()]).then(([scene, clips]) => {
    if (!scene) return;
    const body = fit(scene), mixer = new AnimationMixer(scene), actions = {};
    for (const [key, [fk, name, loop]] of Object.entries(CLIP)) {
      const clip = clips[fk] && clips[fk][name]; if (!clip) continue;
      const act = mixer.clipAction(clip, scene); act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); act.clampWhenFinished = !loop; actions[key] = act;
    }
    holder.body = body; holder.mixer = mixer; holder.actions = actions;
    if (onReady) onReady(body);
  });
}

// An animated actor for combat. The game drives it through the same anim fields as the procedural one.
export function riggedActor(look) {
  if (!BODY[look]) return buildCharacter(look);
  const proc = buildCharacter(look), root = new THREE.Group(), ch = { root, anim: proc.anim, height: proc.height, P: proc.P, torch: false, cur: null, actions: {}, mixer: null };
  root.add(proc.root);
  ch.setBlade = () => {}; ch.torchPos = () => null;
  ch.update = (dt) => { if (ch.mixer) drive(ch, dt); else proc.update(dt); };
  attachBody(ch, look, (body) => { proc.root.visible = false; root.add(body); ch.cur = null; });
  return ch;
}

// A still figure for the tavern: a rigged body posed in its idle, with the procedural figure until it loads.
export function riggedStatic(look) {
  const g = new THREE.Group(); g.add(staticFigure(look));
  if (BODY[look]) attachBody({}, look, (body) => { g.clear(); g.add(body); });
  return g;
}
