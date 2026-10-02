// taskbar.js — the bottom taskbar shown once the user is "logged in".
//
// Material: the same shuding/liquid-glass lens used by the corner buttons,
// but the displacement map is computed in PIXEL space so the refracting rim
// stays a constant ~16px thick no matter how wide the bar is (the buttons'
// uv-space recipe would smear across a 20:1 capsule).
//
// `.taskbar__items` holds the pinned apps (see taskbar-icons.js); running-window
// buttons can mount alongside them later.
 
import { TASKBAR_APPS } from './taskbar-icons.js';
 
const BEZEL = 16;     // px — width of the refracting rim
const PULL = 13;      // px — how far the rim pulls its sample from inside
const RADIUS = 24;    // px — corner radius (matches --taskbar-radius)
 
let cleanup = null;
 
// Signed distance to a rounded rect centred at the origin (negative inside).
function sdf(x, y, hw, hh, r) {
  const qx = Math.abs(x) - hw + r;
  const qy = Math.abs(y) - hh + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}
 
function makeFragment(w, h) {
  const { smoothStep, texture } = window.liquidGlassUtils;
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(RADIUS, hh);
  return (uv) => {
    const px = uv.x * w - hw;
    const py = uv.y * h - hh;
    const edge = -sdf(px, py, hw, hh, r);          // distance inside the rim
    if (edge >= BEZEL) return texture(uv.x, uv.y);  // flat interior: no shift
    // outward normal from the SDF gradient
    const e = 0.5;
    const nx = sdf(px + e, py, hw, hh, r) - sdf(px - e, py, hw, hh, r);
    const ny = sdf(px, py + e, hw, hh, r) - sdf(px, py - e, hw, hh, r);
    const len = Math.hypot(nx, ny) || 1;
    const k = smoothStep(0, 1, 1 - edge / BEZEL);   // 1 at the very edge
    const pull = PULL * k * k;
    return texture((uv.x * w - (nx / len) * pull) / w, (uv.y * h - (ny / len) * pull) / h);
  };
}
 
export function renderTaskbar(rootEl = document.body) {
  cleanup?.();
 
  const bar = document.createElement('nav');
  bar.className = 'taskbar';
  bar.setAttribute('aria-label', 'Taskbar');
  bar.innerHTML = '<div class="taskbar__items"></div>';
  const items = bar.querySelector('.taskbar__items');
  TASKBAR_APPS.forEach((app, i) => {
    const slot = document.createElement('div');
    slot.className = 'taskbar__slot';
    slot.dataset.label = app.label;
    slot.style.setProperty('--i', i);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'taskbar__item';
    btn.dataset.app = app.id;
    btn.setAttribute('aria-label', app.label);
    btn.innerHTML = app.svg();
    btn.addEventListener('click', () => {
      // Dock-style bounce; also announce the launch so apps can hook in later.
      btn.classList.remove('is-launching');
      void btn.offsetWidth;
      btn.classList.add('is-launching');
      document.dispatchEvent(new CustomEvent('app-launch', { detail: { id: app.id } }));
    });
    btn.addEventListener('animationend', (e) => {
      if (e.animationName === 'taskbar-bounce') btn.classList.remove('is-launching');
    });
    slot.appendChild(btn);
    items.appendChild(slot);
  });
  rootEl.appendChild(bar);
 
  let shader = null;
  let svgHost = null;
 
  const detach = () => {
    shader?.destroy();
    svgHost?.remove();
    shader = null;
    svgHost = null;
  };
 
  const attach = () => {
    detach();
    if (!window.LiquidGlassShader) return;
    if (matchMedia('(prefers-reduced-transparency: reduce)').matches) return;
    const w = bar.offsetWidth;
    const h = bar.offsetHeight;
    if (w < 8 || h < 8) return;
 
    shader = new window.LiquidGlassShader({ width: w, height: h, fragment: makeFragment(w, h) });
    const c = shader.container;
    c.classList.add('taskbar__lens');
    c.style.position = 'absolute';
    c.style.inset = '0';
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.transform = 'none';
    c.style.borderRadius = 'inherit';
    c.style.boxShadow = 'none';
    c.style.cursor = 'default';
    c.style.zIndex = '0';
    c.style.pointerEvents = 'none';
    c.style.overflow = 'hidden';
    c.style.backdropFilter = `url(#${shader.id}_filter) blur(2.5px) saturate(1.6) brightness(1.1)`;
    c.style.webkitBackdropFilter = c.style.backdropFilter;
    bar.prepend(c);
 
    shader.svg.style.position = 'fixed';
    shader.svg.style.top = '0';
    shader.svg.style.left = '0';
    svgHost = shader.svg;
    document.body.appendChild(svgHost);
  };
 
  // Build once the entrance has laid the bar out, then keep the displacement
  // map matched to the bar's width (debounced — it's a per-pixel rebuild).
  attach();
  let t = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(attach, 120);
  });
  ro.observe(bar);
 
  cleanup = () => {
    clearTimeout(t);
    ro.disconnect();
    detach();
    bar.remove();
    cleanup = null;
  };
 
  return bar;
}
 