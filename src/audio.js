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

export const audio = {
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
