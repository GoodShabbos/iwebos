// glass-window.js — shared frame for every app window: a translucent,
// draggable, resizable liquid-glass window. Same lens recipe as the taskbar
// (shuding/liquid-glass with a pixel-space displacement map so the refracting
// rim stays a constant thickness at any window size), rebuilt (debounced)
// when the window resizes.

const BEZEL = 20;   // px — width of the refracting rim
const PULL = 16;    // px — how far the rim pulls its sample from inside
const RADIUS = 24;  // px — corner radius (matches .glass-window)
const MIN_W = 340;
const MIN_H = 260;

let zTop = 600;     // above the clock (500), below the taskbar (700)

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
    const edge = -sdf(px, py, hw, hh, r);
    if (edge >= BEZEL) return texture(uv.x, uv.y);
    const e = 0.5;
    const nx = sdf(px + e, py, hw, hh, r) - sdf(px - e, py, hw, hh, r);
    const ny = sdf(px, py + e, hw, hh, r) - sdf(px, py - e, hw, hh, r);
    const len = Math.hypot(nx, ny) || 1;
    const k = smoothStep(0, 1, 1 - edge / BEZEL);
    const pull = PULL * k * k;
    return texture((uv.x * w - (nx / len) * pull) / w, (uv.y * h - (ny / len) * pull) / h);
  };
}

/**
 * Open a glass window.
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.className] extra class on the window root
 * @param {number} [o.width]
 * @param {number} [o.height]
 * @param {(body: HTMLElement) => (void | (() => void))} o.mount fills the body;
 *        may return a cleanup function run when the window closes
 * @param {() => void} [o.onClose]
 * @returns {{ el: HTMLElement, focus: () => void, close: () => void }}
 */
export function createGlassWindow({ title, className = '', width = 560, height = 420, mount, onClose }) {
  const el = document.createElement('section');
  el.className = `glass-window ${className}`.trim();
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', title);
  el.innerHTML = `
    <header class="glass-window__bar">
      <button class="glass-window__close" type="button" aria-label="Close ${title}">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
      <span class="glass-window__title">${title}</span>
    </header>
    <div class="glass-window__body"></div>
    ${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
      .map((d) => `<div class="glass-window__resize glass-window__resize--${d}" data-dir="${d}"></div>`)
      .join('')}`;

  const w = Math.min(width, innerWidth - 40);
  const h = Math.min(height, innerHeight - 140);
  // cascade each new window a little so stacked windows stay visible
  const cascade = (document.querySelectorAll('.glass-window').length % 6) * 28;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.left = `${Math.max(12, (innerWidth - w) / 2 + cascade)}px`;
  el.style.top = `${Math.max(12, (innerHeight - h) / 2 - 40 + cascade)}px`;
  document.body.appendChild(el);

  const focus = () => { el.style.zIndex = String(++zTop); };
  focus();
  el.addEventListener('pointerdown', focus);

  const unmount = mount(el.querySelector('.glass-window__body'));

  // ---- liquid-glass lens ----
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
    if (!window.LiquidGlassShader || !window.liquidGlassUtils) return;
    if (matchMedia('(prefers-reduced-transparency: reduce)').matches) return;
    const lw = el.offsetWidth;
    const lh = el.offsetHeight;
    if (lw < 8 || lh < 8) return;
    shader = new window.LiquidGlassShader({ width: lw, height: lh, fragment: makeFragment(lw, lh) });
    const c = shader.container;
    c.classList.add('glass-window__lens');
    Object.assign(c.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%', transform: 'none',
      borderRadius: 'inherit', boxShadow: 'none', cursor: 'default', zIndex: '0',
      pointerEvents: 'none', overflow: 'hidden',
    });
    c.style.backdropFilter = `url(#${shader.id}_filter) blur(6px) saturate(1.6) brightness(1.08)`;
    c.style.webkitBackdropFilter = c.style.backdropFilter;
    el.prepend(c);
    Object.assign(shader.svg.style, { position: 'fixed', top: '0', left: '0' });
    svgHost = shader.svg;
    document.body.appendChild(svgHost);
  };
  attach();
  let t = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(attach, 150);
  });
  ro.observe(el);

  // ---- drag by the title bar ----
  el.querySelector('.glass-window__bar').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const startX = e.clientX - el.offsetLeft;
    const startY = e.clientY - el.offsetTop;
    const move = (ev) => {
      el.style.left = `${Math.min(Math.max(ev.clientX - startX, 80 - el.offsetWidth), innerWidth - 80)}px`;
      el.style.top = `${Math.min(Math.max(ev.clientY - startY, 0), innerHeight - 40)}px`;
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    e.preventDefault();
  });

  // ---- resize from any edge or corner ----
  el.querySelectorAll('.glass-window__resize').forEach((grip) => {
    grip.addEventListener('pointerdown', (e) => {
      const dir = grip.dataset.dir;
      const start = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      const move = (ev) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        let l = start.l;
        let top = start.t;
        let nw = start.w;
        let nh = start.h;
        if (dir.includes('e')) nw = Math.max(MIN_W, start.w + dx);
        if (dir.includes('s')) nh = Math.max(MIN_H, start.h + dy);
        if (dir.includes('w')) { nw = Math.max(MIN_W, start.w - dx); l = start.l + start.w - nw; }
        if (dir.includes('n')) {
          nh = Math.max(MIN_H, start.h - dy);
          top = Math.max(0, start.t + start.h - nh);
          nh = start.t + start.h - top;
        }
        Object.assign(el.style, { left: `${l}px`, top: `${top}px`, width: `${nw}px`, height: `${nh}px` });
      };
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // ---- close ----
  let closed = false;
  const onKey = (e) => {
    // Escape closes the front window — but not while typing in a field
    if (e.key === 'Escape' && Number(el.style.zIndex) === zTop && !e.target.closest?.('input, textarea')) close();
  };
  function close() {
    if (closed) return;
    closed = true;
    removeEventListener('keydown', onKey);
    clearTimeout(t);
    ro.disconnect();
    if (typeof unmount === 'function') unmount();
    onClose?.();
    el.classList.add('is-closing');
    setTimeout(() => { detach(); el.remove(); }, 180);
  }
  addEventListener('keydown', onKey);
  el.querySelector('.glass-window__close').addEventListener('click', close);

  return { el, focus, close };
}

/** Single-instance helper: open once, re-focus if already open. */
export function singleWindow(factory) {
  let win = null;
  return () => {
    if (win) {
      win.focus();
      return win.el;
    }
    win = factory(() => { win = null; });
    return win.el;
  };
}
