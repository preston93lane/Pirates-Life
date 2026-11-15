// Small math, random and noise helpers shared by everything.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const angleDiff = (from, to) => wrapAngle(to - from);
export const turnToward = (from, to, maxStep) => { const d = angleDiff(from, to); return from + clamp(d, -maxStep, maxStep); };
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function hash(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}
export function fbm(x, z, oct = 4) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { v += noise(x * f, z * f) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}

// Ocean swell. Must stay in sync with the GLSL copy in world.js.
export const WAVES = [
  // dirX, dirZ, wavelength, amplitude, speed
  [0.83, 0.55, 74, 0.62, 5.2],
  [-0.35, 0.94, 47, 0.38, 4.1],
  [0.98, -0.2, 29, 0.2, 3.4],
];
export const SEA = { amp: 1 }; // storms raise the swell
export function waveHeight(x, z, t) {
  let h = 0;
  for (const w of WAVES) { const k = TAU / w[2]; h += w[3] * Math.sin((x * w[0] + z * w[1]) * k + t * w[4] * k); }
  return h * SEA.amp;
}
