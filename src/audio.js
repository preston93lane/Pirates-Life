// All sound is synthesised with WebAudio: no audio files to download.
let ctx = null, master = null, noise = null, amb = null;

function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function burst({ type = 'lowpass', f0 = 800, f1 = 200, q = 0.7, dur = 0.4, vol = 0.5, attack = 0.005 }) {
  const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise; src.playbackRate.value = 0.7 + Math.random() * 0.6; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, attack, vol, dur); src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + dur + attack + 0.05);
}
function tone({ f0 = 440, f1 = 440, dur = 0.2, vol = 0.3, type = 'sine', delay = 0 }) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.004, vol, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}

// ---------- music: a tiny sequencer playing original jig-time tunes in D dorian ----------
const SCALE = [0, 2, 3, 5, 7, 9, 10], _ = null;
const hz = (deg, oct = 0) => 293.66 * Math.pow(2, oct + Math.floor(deg / 7) + SCALE[((deg % 7) + 7) % 7] / 12);
const TUNES = {
  sail: { bpm: 100, vol: 1, drum: 0.5, lead: [0, _, 2, 4, _, 4, 5, 4, 2, 4, _, _, 0, _, 2, 4, _, 7, 6, 4, 2, 1, _, _, 0, _, 2, 4, _, 4, 7, _, 6, 4, _, 2, 3, 2, 0, 1, _, -1, 0, _, _, _, _, _], bass: [0, 0, 3, 4, 0, 5, 3, 0] },
  battle: { bpm: 138, vol: 1.15, drum: 1, lead: [0, 0, 4, 0, 0, 4, 3, 3, 6, 3, 3, 6, 0, 0, 4, 0, 0, 7, 6, 4, 2, 1, -1, 0, 7, 7, 4, 7, 7, 4, 6, 6, 3, 6, 6, 3, 5, 4, 2, 4, 2, 0, 1, 2, 1, 0, _, _], bass: [0, 3, 0, 4, 0, 6, 5, 0] },
  town: { bpm: 112, vol: 0.9, drum: 0.35, lead: [2, _, 4, 6, _, 4, 7, 6, 4, 6, _, _, 5, _, 4, 2, _, 4, 5, 4, 2, 1, _, _, 2, _, 4, 6, _, 9, 8, _, 7, 6, _, 4, 5, 4, 2, 4, _, 1, 2, _, _, _, _, _], bass: [2, 2, 5, 4, 2, 0, 5, 2] },
  night: { bpm: 66, vol: 0.7, drum: 0, lead: [0, _, _, _, _, _, 4, _, _, 2, _, _, 1, _, _, _, _, _, -1, _, _, 0, _, _, 2, _, _, _, _, _, 4, _, _, 7, _, _, 6, _, _, 4, _, _, 0, _, _, _, _, _], bass: [0, 0, 5, 0, 3, 0, 4, 0] },
};
const music = { on: true, mood: 'sail', want: 'sail', step: 0, next: 0, timer: null, gain: null };
function voice(freq, t, dur, vol, type, cut) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), v = ctx.createOscillator(), vg = ctx.createGain();
  o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cut; v.frequency.value = 5.5; vg.gain.value = freq * 0.006; v.connect(vg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(music.gain); o.start(t); v.start(t); o.stop(t + dur + 0.05); v.stop(t + dur + 0.05);
}
function thump(t, vol, hi) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; f.type = hi ? 'bandpass' : 'lowpass'; f.frequency.value = hi ? 1800 : 150;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (hi ? 0.07 : 0.18)); s.connect(f).connect(g).connect(music.gain); s.start(t, Math.random()); s.stop(t + 0.25);
}
function schedule() {
  if (!ctx || !music.on || ctx.state !== 'running') return;
  if (music.next < ctx.currentTime) music.next = ctx.currentTime + 0.05;
  while (music.next < ctx.currentTime + 0.4) {
    if (music.step % 6 === 0 && music.want !== music.mood) { music.mood = music.want; music.step = 0; }
    const T = TUNES[music.mood], d = 60 / T.bpm / 3 * 2, i = music.step % T.lead.length, n = T.lead[i], t = music.next, beat = music.step % 6;
    if (n !== null) { let len = 1; while (T.lead[(i + len) % T.lead.length] === null && len < 6) len++; voice(hz(n), t, d * len * 0.95, 0.09 * T.vol, 'sawtooth', 1700); voice(hz(n, -1), t, d * len * 0.9, 0.035 * T.vol, 'square', 900); }
    if (beat === 0 || beat === 3) { const b = T.bass[Math.floor(music.step / 6) % T.bass.length]; voice(hz(b, -2), t, d * 2.6, 0.12 * T.vol, 'triangle', 600); if (beat === 0) voice(hz(b + 4, -1), t, d * 5, 0.03 * T.vol, 'triangle', 900); }
    if (T.drum) { if (beat === 0) thump(t, 0.5 * T.drum, false); else if (beat === 3) thump(t, 0.3 * T.drum, false); if (T.drum > 0.8 && (beat === 2 || beat === 5)) thump(t, 0.12, true); }
    music.next += d; music.step++;
  }
}

export const audio = {
  // music and background sounds
  setMusic(on) { music.on = on; if (music.gain) music.gain.gain.value = on ? 0.5 : 0; },
  mood(m) { music.want = m; },
  creak() { if (!ctx) return; tone({ f0: 70 + Math.random() * 30, f1: 110 + Math.random() * 40, dur: 0.5, vol: 0.06, type: 'sawtooth' }); burst({ type: 'bandpass', f0: 320, f1: 520, q: 6, dur: 0.45, vol: 0.05, attack: 0.1 }); },
  gull() { if (!ctx) return; for (let i = 0; i < 3; i++) tone({ f0: 1900 - i * 120, f1: 1250, dur: 0.16, vol: 0.035, delay: i * 0.22 }); },
  bell() { if (!ctx) return; for (const f of [880, 1320, 2210]) tone({ f0: f, f1: f, dur: 1.1, vol: 0.05, type: 'sine' }); },
  muted: false,
  init(muted) {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination); this.muted = !!muted;
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // surf: looped noise through a slowly breathing low-pass
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      src.buffer = noise; src.loop = true; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0.07; lfo.frequency.value = 0.11; lg.gain.value = 0.035;
      lfo.connect(lg).connect(g.gain); src.connect(f).connect(g).connect(master); src.start(); lfo.start(); amb = g;
      music.gain = ctx.createGain(); music.gain.gain.value = music.on ? 0.5 : 0; music.gain.connect(master); music.timer = setInterval(schedule, 110);
    } catch (e) { ctx = null; }
  },
  setMuted(m) { this.muted = m; if (master) master.gain.value = m ? 0 : 0.8; },
  cannon(v = 1) { if (!ctx) return; burst({ f0: 1400, f1: 70, dur: 0.9, vol: 0.9 * v }); tone({ f0: 110, f1: 38, dur: 0.45, vol: 0.9 * v }); },
  crack(v = 1) { if (!ctx) return; burst({ type: 'bandpass', f0: 900, f1: 300, q: 1.2, dur: 0.22, vol: 0.6 * v }); tone({ f0: 160, f1: 60, dur: 0.12, vol: 0.4 * v }); },
  splash(v = 1) { if (!ctx) return; burst({ type: 'bandpass', f0: 1500, f1: 500, q: 0.6, dur: 0.5, vol: 0.22 * v, attack: 0.03 }); },
  clang(v = 1) { if (!ctx) return; for (const f of [1850, 2760, 4130]) tone({ f0: f * (0.97 + Math.random() * 0.06), f1: f * 0.98, dur: 0.28, vol: 0.12 * v, type: 'triangle' }); burst({ type: 'highpass', f0: 3000, f1: 3000, dur: 0.05, vol: 0.25 * v }); },
  swish() { if (!ctx) return; burst({ type: 'bandpass', f0: 500, f1: 2600, q: 1.5, dur: 0.16, vol: 0.14, attack: 0.04 }); },
  hit(v = 1) { if (!ctx) return; burst({ f0: 500, f1: 120, dur: 0.14, vol: 0.5 * v }); tone({ f0: 150, f1: 55, dur: 0.12, vol: 0.5 * v }); },
  shot(v = 1) { if (!ctx) return; burst({ type: 'highpass', f0: 900, f1: 300, dur: 0.22, vol: 0.7 * v }); tone({ f0: 200, f1: 50, dur: 0.16, vol: 0.6 * v }); },
  coin() { if (!ctx) return; tone({ f0: 1320, f1: 1320, dur: 0.08, vol: 0.14 }); tone({ f0: 1760, f1: 1760, dur: 0.16, vol: 0.14, delay: 0.07 }); },
  ui() { if (!ctx) return; tone({ f0: 620, f1: 520, dur: 0.05, vol: 0.12, type: 'triangle' }); },
  good() { if (!ctx) return; [523, 659, 784].forEach((f, i) => tone({ f0: f, f1: f, dur: 0.22, vol: 0.14, type: 'triangle', delay: i * 0.09 })); },
  bad() { if (!ctx) return; tone({ f0: 220, f1: 110, dur: 0.5, vol: 0.25, type: 'sawtooth' }); },
  roar() { if (!ctx) return; tone({ f0: 90, f1: 45, dur: 1.4, vol: 0.5, type: 'sawtooth' }); burst({ f0: 400, f1: 90, dur: 1.4, vol: 0.5, attack: 0.2 }); },
  thunder() { if (!ctx) return; burst({ f0: 900, f1: 50, dur: 2.2, vol: 0.8, attack: 0.02 }); tone({ f0: 70, f1: 30, dur: 1.6, vol: 0.5 }); },
  siren(v = 1) { if (!ctx) return; [[659, 0], [784, 0.5], [740, 1.1], [880, 1.6]].forEach(([f, d]) => { tone({ f0: f, f1: f * 1.01, dur: 0.7, vol: 0.08 * v, delay: d }); tone({ f0: f * 1.5, f1: f * 1.5, dur: 0.7, vol: 0.03 * v, delay: d }); }); },
  bark() { if (!ctx) return; tone({ f0: 420, f1: 260, dur: 0.09, vol: 0.2, type: 'sawtooth' }); },
  squawk() { if (!ctx) return; tone({ f0: 1500, f1: 900, dur: 0.14, vol: 0.12, type: 'sawtooth' }); },
  dig() { if (!ctx) return; burst({ type: 'bandpass', f0: 700, f1: 250, q: 0.8, dur: 0.16, vol: 0.3, attack: 0.02 }); },
};
