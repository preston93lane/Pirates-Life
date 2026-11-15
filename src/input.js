// Touch-first input: a floating joystick on the left, drag-to-look elsewhere, on-screen buttons, plus keyboard/mouse.
export const input = {
  move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, down: {}, pressed: {}, touch: false,
  take(act) { const v = this.pressed[act]; this.pressed[act] = false; return !!v; },
};

export function initInput(layer, stickEl, knobEl) {
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
  const R = 52, keys = {};
  const setStick = (x, y) => {
    let dx = x - sx, dy = y - sy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    input.move.x = dx / R; input.move.y = -dy / R;
  };
  layer.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') input.touch = true;
    const w = window.innerWidth, h = window.innerHeight;
    if (stickId === null && e.clientX < w * 0.45 && e.clientY > h * 0.3) {
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
      stickEl.style.left = `${sx}px`; stickEl.style.top = `${sy}px`; stickEl.classList.add('on'); setStick(sx, sy);
    } else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
    try { layer.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    e.preventDefault();
  });
  layer.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) setStick(e.clientX, e.clientY);
    else if (e.pointerId === lookId) { input.look.x += e.clientX - lx; input.look.y += e.clientY - ly; lx = e.clientX; ly = e.clientY; }
  });
  const end = (e) => {
    if (e.pointerId === stickId) { stickId = null; stickEl.classList.remove('on'); knobEl.style.transform = ''; input.move.x = input.move.y = 0; }
    if (e.pointerId === lookId) lookId = null;
  };
  layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
  layer.addEventListener('contextmenu', (e) => e.preventDefault());

  for (const b of document.querySelectorAll('[data-act]')) {
    const act = b.dataset.act;
    const on = (e) => { input.down[act] = true; input.pressed[act] = true; b.classList.add('held'); e.preventDefault(); e.stopPropagation(); };
    const off = () => { input.down[act] = false; b.classList.remove('held'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  }

  const KEYMAP = { Space: 'primary', KeyJ: 'primary', ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyK: 'dodge', KeyQ: 'block', KeyL: 'block', KeyF: 'shoot', KeyE: 'ctx', KeyR: 'rum', KeyX: 'sailUp', KeyZ: 'sailDown', KeyM: 'menu', KeyC: 'ammo', KeyV: 'swivel', KeyT: 'skill', KeyG: 'bomb' };
  const axis = () => {
    if (stickId !== null) return;
    const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), y = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), d = Math.hypot(x, y) || 1;
    input.move.x = x / d; input.move.y = y / d;
  };
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (!keys[e.code]) { const a = KEYMAP[e.code]; if (a) { input.down[a] = true; input.pressed[a] = true; } }
    keys[e.code] = true; axis();
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; const a = KEYMAP[e.code]; if (a) input.down[a] = false; axis(); });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in input.down) input.down[k] = false; axis(); });
}
