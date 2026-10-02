// os-clock.js — date + time capsule, top-right, shown once the user is logged
// in. Same liquid-glass capsule as the logo (it reuses the .os-logo styles, so
// it also turns black in light mode), mirrored to the opposite corner.

const BEZEL = 11;   // px — refracting rim thickness
const PULL = 9;     // px — how far the rim bends the wallpaper

let cleanup = null;

function sdf(x, y, hw, hh, r) {
  const qx = Math.abs(x) - hw + r;
  const qy = Math.abs(y) - hh + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}

function makeFragment(w, h) {
  const { smoothStep, texture } = window.liquidGlassUtils;
  const hw = w / 2;
  const hh = h / 2;
  const r = hh; // full capsule
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

export function renderOsClock(rootEl = document.body) {
  cleanup?.();

  const box = document.createElement('div');
  box.className = 'os-logo os-clock';
  box.setAttribute('role', 'timer');
  box.innerHTML = `
    <span class="os-clock__date" aria-hidden="true"></span>
    <span class="os-logo__word os-clock__time"></span>`;
  rootEl.appendChild(box);

  const dateEl = box.querySelector('.os-clock__date');
  const timeEl = box.querySelector('.os-clock__time');
  const update = () => {
    const now = new Date();
    dateEl.textContent = now
      .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      .replace(',', '');
    timeEl.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    box.setAttribute('aria-label', `${dateEl.textContent}, ${timeEl.textContent}`);
  };
  update();
  const tick = setInterval(update, 1000);

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
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    if (w < 8 || h < 8) return;

    shader = new window.LiquidGlassShader({ width: w, height: h, fragment: makeFragment(w, h) });
    const c = shader.container;
    c.classList.add('os-logo__lens');
    Object.assign(c.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%', transform: 'none',
      borderRadius: '999px', boxShadow: 'none', cursor: 'default', zIndex: '0',
      pointerEvents: 'none', overflow: 'hidden',
    });
    c.style.backdropFilter = `url(#${shader.id}_filter) blur(2px) saturate(1.55) brightness(1.1)`;
    c.style.webkitBackdropFilter = c.style.backdropFilter;
    box.prepend(c);
    Object.assign(shader.svg.style, { position: 'fixed', top: '0', left: '0' });
    svgHost = shader.svg;
    document.body.appendChild(svgHost);
  };

  // Width depends on the text, so wait for SF Pro before building the lens.
  let t = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(attach, 100);
  });
  document.fonts.load('700 18px "SF Pro Display"')
    .catch(() => {})
    .finally(() => {
      if (!box.isConnected) return;
      attach();
      ro.observe(box);
    });

  cleanup = () => {
    clearInterval(tick);
    clearTimeout(t);
    ro.disconnect();
    detach();
    box.remove();
    cleanup = null;
  };
  return box;
}
