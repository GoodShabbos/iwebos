// logo.js — the iWebOS wordmark, top-left, shown once the user is logged in.
//
// Material: a liquid-glass capsule using the same shuding/liquid-glass lens as
// the taskbar and corner buttons (pixel-space rim so the refraction stays
// constant at any width), holding a glass "i" tile and the wordmark.
 
const BEZEL = 11;   // px — refracting rim thickness
const PULL = 9;     // px — how far the rim bends the wallpaper
 
const MARK_SVG = `
<svg class="os-logo__mark" viewBox="0 0 32 32" aria-hidden="true">
  <defs>
    <linearGradient id="os-logo-tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".62"/>
      <stop offset=".55" stop-color="#fff" stop-opacity=".16"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".32"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="30" height="30" rx="10" fill="url(#os-logo-tile)"
        stroke="#fff" stroke-opacity=".7" stroke-width="1"/>
  <path d="M5 8.2C8 3.6 16 2.2 24 4" fill="none" stroke="#fff" stroke-opacity=".75"
        stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="16" cy="9.6" r="2.3" fill="currentColor"/>
  <rect x="13.7" y="14" width="4.6" height="11.6" rx="2.3" fill="currentColor"/>
</svg>`;
 
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
 
export function renderLogo(rootEl = document.body) {
  cleanup?.();
 
  const logo = document.createElement('div');
  logo.className = 'os-logo';
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', 'iWebOS');
  logo.innerHTML = `${MARK_SVG}<span class="os-logo__word" aria-hidden="true">iWebOS</span>`;
  rootEl.appendChild(logo);
 
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
    const w = logo.offsetWidth;
    const h = logo.offsetHeight;
    if (w < 8 || h < 8) return;
 
    shader = new window.LiquidGlassShader({ width: w, height: h, fragment: makeFragment(w, h) });
    const c = shader.container;
    c.classList.add('os-logo__lens');
    c.style.position = 'absolute';
    c.style.inset = '0';
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.transform = 'none';
    c.style.borderRadius = '999px';
    c.style.boxShadow = 'none';
    c.style.cursor = 'default';
    c.style.zIndex = '0';
    c.style.pointerEvents = 'none';
    c.style.overflow = 'hidden';
    c.style.backdropFilter = `url(#${shader.id}_filter) blur(2px) saturate(1.55) brightness(1.1)`;
    c.style.webkitBackdropFilter = c.style.backdropFilter;
    logo.prepend(c);
 
    shader.svg.style.position = 'fixed';
    shader.svg.style.top = '0';
    shader.svg.style.left = '0';
    svgHost = shader.svg;
    document.body.appendChild(svgHost);
  };
 
  // The capsule's width depends on the wordmark, so wait for SF Pro first.
  let t = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(attach, 100);
  });
  document.fonts.load('700 18px "SF Pro Display"')
    .catch(() => {})
    .finally(() => {
      if (!logo.isConnected) return;
      attach();
      ro.observe(logo);
    });
 
  cleanup = () => {
    clearTimeout(t);
    ro.disconnect();
    detach();
    logo.remove();
    cleanup = null;
  };
 
  return logo;
}
 