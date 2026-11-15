// Particles (smoke, spray, sparks, splinters) and shot tracers. One draw call for all particles.
import * as THREE from 'three';

const MAX = 1400;
const VERT = `
attribute float size; attribute float alpha; attribute vec3 color; uniform float uScale; varying float vA; varying vec3 vC; varying float vF;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale / max(0.1, -mv.z); vA = alpha; vC = color; vF = 1.0 - exp(-0.0000018 * mv.z * mv.z); }`;
const FRAG = `
uniform vec3 uFog; varying float vA; varying vec3 vC; varying float vF;
void main() { float d = length(gl_PointCoord - 0.5); float a = vA * smoothstep(0.5, 0.2, d); if (a < 0.01) discard; gl_FragColor = vec4(mix(vC, uFog, vF), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createFx(scene, fogColor) {
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), size = new Float32Array(MAX), alpha = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), maxLife = new Float32Array(MAX), grow = new Float32Array(MAX), grav = new Float32Array(MAX), drag = new Float32Array(MAX), a0 = new Float32Array(MAX);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 600 }, uFog: { value: new THREE.Color(fogColor) } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
  const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 3; scene.add(points);
  let head = 0; const c = new THREE.Color();

  const fx = {
    setScale(v) { mat.uniforms.uScale.value = v; },
    emit(x, y, z, o) {
      const n = fx.thin ? Math.max(1, Math.round((o.n || 1) * 0.5)) : o.n || 1;
      for (let i = 0; i < n; i++) {
        const k = head; head = (head + 1) % MAX;
        const sp = o.spread ?? 0.3;
        pos[k * 3] = x + (Math.random() - 0.5) * sp; pos[k * 3 + 1] = y + (Math.random() - 0.5) * sp; pos[k * 3 + 2] = z + (Math.random() - 0.5) * sp;
        const s = (o.speed ?? 1) * (0.4 + Math.random() * 0.6), th = Math.random() * 6.283, ph = Math.acos(1 - Math.random() * (o.cone ?? 2));
        let vx = Math.sin(ph) * Math.cos(th) * s, vy = Math.cos(ph) * s, vz = Math.sin(ph) * Math.sin(th) * s;
        if (o.dir) { vx += o.dir[0]; vy += o.dir[1]; vz += o.dir[2]; }
        vel[k * 3] = vx; vel[k * 3 + 1] = vy + (o.up || 0); vel[k * 3 + 2] = vz;
        c.set(o.color); const v = 0.85 + Math.random() * 0.3;
        col[k * 3] = c.r * v; col[k * 3 + 1] = c.g * v; col[k * 3 + 2] = c.b * v;
        life[k] = maxLife[k] = (o.life ?? 1) * (0.7 + Math.random() * 0.6); size[k] = (o.size ?? 1) * (0.7 + Math.random() * 0.6);
        grow[k] = o.grow ?? 0; grav[k] = o.gravity ?? 0; drag[k] = o.drag ?? 0; a0[k] = o.alpha ?? 1;
      }
    },
    smoke(x, y, z, dir, n = 10) { fx.emit(x, y, z, { n, color: 0xd8d2c4, speed: 2.5, dir: dir && [dir[0] * 9, 1, dir[2] * 9], life: 2.6, size: 2.2, grow: 2.6, drag: 2.4, alpha: 0.75, spread: 0.6 }); fx.emit(x, y, z, { n: 3, color: 0xffc268, speed: 1, dir: dir && [dir[0] * 14, 0.5, dir[2] * 14], life: 0.12, size: 2.4, alpha: 1 }); },
    splash(x, z, big = 1) { fx.emit(x, 0.3, z, { n: Math.round(12 * big), color: 0xeef3ee, speed: 5 * big, cone: 0.5, up: 5 * big, gravity: 14, life: 1.0, size: 1.1 * big, grow: 0.8, spread: 0.8, alpha: 0.85 }); },
    splinters(x, y, z, n = 12) { fx.emit(x, y, z, { n, color: 0x8a6d4b, speed: 7, up: 4, gravity: 16, life: 0.9, size: 0.45, spread: 0.6 }); fx.emit(x, y, z, { n: 4, color: 0x6b6459, speed: 1.5, life: 1.4, size: 2, grow: 2, alpha: 0.5, drag: 1 }); },
    fire(x, y, z, n = 3) { fx.emit(x, y, z, { n, color: 0xff8a2a, speed: 0.8, up: 2.4, life: 0.7, size: 1.3, grow: -0.8, spread: 1.2 }); fx.emit(x, y + 1, z, { n: 1, color: 0x2a2826, speed: 0.5, up: 3, life: 2.4, size: 2, grow: 2, alpha: 0.55, spread: 1 }); },
    sparks(x, y, z, n = 8, color = 0xffe2a0) { fx.emit(x, y, z, { n, color, speed: 5, up: 1.5, gravity: 12, life: 0.3, size: 0.28, spread: 0.1 }); },
    blood(x, y, z, n = 7, color = 0x6b1512) { fx.emit(x, y, z, { n, color, speed: 3, up: 1.5, gravity: 12, life: 0.5, size: 0.32, spread: 0.2 }); },
    dust(x, y, z, n = 5, color = 0xb8aa88) { fx.emit(x, y, z, { n, color, speed: 1.4, up: 0.6, life: 0.8, size: 0.9, grow: 1.4, alpha: 0.5, drag: 2, spread: 0.5 }); },
    wake(x, z, s = 1) { fx.emit(x, 0.25, z, { n: 1, color: 0xe9efea, speed: 0.6, cone: 0.2, life: 2.2, size: 1.6 * s, grow: 1.6, alpha: 0.5, spread: 1.4 * s }); },
    update(dt) {
      for (let k = 0; k < MAX; k++) {
        if (life[k] <= 0) continue;
        life[k] -= dt;
        if (life[k] <= 0) { alpha[k] = 0; size[k] = 0; continue; }
        const d = Math.max(0, 1 - drag[k] * dt);
        vel[k * 3] *= d; vel[k * 3 + 1] = vel[k * 3 + 1] * d - grav[k] * dt; vel[k * 3 + 2] *= d;
        pos[k * 3] += vel[k * 3] * dt; pos[k * 3 + 1] += vel[k * 3 + 1] * dt; pos[k * 3 + 2] += vel[k * 3 + 2] * dt;
        size[k] = Math.max(0, size[k] + grow[k] * dt); const t = life[k] / maxLife[k]; alpha[k] = a0[k] * Math.min(1, t * 2.2);
      }
      for (const n of ['position', 'color', 'size', 'alpha']) g.attributes[n].needsUpdate = true;
      for (const t of tracers) if (t.life > 0) { t.life -= dt; t.mesh.material.opacity = Math.max(0, t.life / 0.09); t.mesh.visible = t.life > 0; }
    },
    tracer(a, b) {
      const t = tracers[ti]; ti = (ti + 1) % tracers.length;
      t.mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); t.mesh.lookAt(b.x, b.y, b.z); t.mesh.scale.set(1, 1, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)); t.life = 0.09; t.mesh.visible = true;
    },
  };
  const tracers = []; let ti = 0;
  for (let i = 0; i < 6; i++) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, depthWrite: false })); mesh.visible = false; scene.add(mesh); tracers.push({ mesh, life: 0 }); }
  return fx;
}
