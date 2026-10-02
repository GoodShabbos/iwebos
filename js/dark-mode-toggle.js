// dark-mode-toggle.js — the bottom-right liquid-glass button that switches
// the wallpaper light ↔ dark.
//
// Material: real refraction via the vendored shuding/liquid-glass Shader —
// a rounded glass slab whose displacement filter bends the wallpaper at the
// capsule's rim, plus a frost chain (the same values as liqui's glass tier).
//
// The lens element lives INSIDE the button (position:absolute, inset 0):
//   - follows hover expansion automatically (no coordinate re-pinning)
//   - no scroll handlers, no cross-instance cleanup races
//   - backdrop-filter reaches the wallpaper behind the button's paint box
//
// Expansion animation: spring cubic-bezier overshoot on width + the text
// span fading/sliding in — reads as the glass physically stretching.
// prefers-reduced-motion collapses the spring to a simple fade.

import { setWallpaper, getWallpaperMode } from './wallpaper.js';

const MOON_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <path fill="currentColor" d="M21.3 14.4A9.2 9.2 0 0 1 9.6 2.7a.8.8 0 0 0-1.1-.9 10.5 10.5 0 1 0 13.7 13.7.8.8 0 0 0-.9-1.1Z"/>
</svg>`;

const SUN_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/>
    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/>
  </g>
</svg>`;

let cleanup = null;
let pendingMode = null;
const LABELS = { light: 'Switch to Dark Mode', dark: 'Switch to Light Mode' };
const ICONS = { light: MOON_SVG, dark: SUN_SVG };
const NEXT = { light: 'dark', dark: 'light' };

export function renderDarkModeToggle(rootEl) {
  if (cleanup) cleanup();
  cleanup = null;

  const btn = document.createElement('button');
  btn.className = 'glass-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label', LABELS[getWallpaperMode()]);
  btn.innerHTML = `
    <span class="glass-toggle__icon">${ICONS[getWallpaperMode()]}</span>
    <span class="glass-toggle__text">${LABELS[getWallpaperMode()]}</span>
  `;

  btn.addEventListener('click', async () => {
    const next = NEXT[pendingMode || getWallpaperMode()];
    pendingMode = next;
    btn.querySelector('.glass-toggle__icon').innerHTML = ICONS[next];
    btn.querySelector('.glass-toggle__text').textContent = LABELS[next];
    btn.setAttribute('aria-label', LABELS[next]);
    try {
      await setWallpaper(next, { animate: true });
    } finally {
      if (pendingMode === next) pendingMode = null;
    }
  });

  rootEl.appendChild(btn);

  // ---- the glass lens (shuding shader), hosted inside the button ----
  let shader = null;
  let svgHost = null;
  const attach = () => {
    if (!window.LiquidGlassShader) return;
    const { roundedRectSDF, smoothStep, texture } = window.liquidGlassUtils;
    shader?.destroy();
    svgHost?.remove();
    svgHost = null;
    shader = null;

    const w = btn.offsetWidth;
    const h = btn.offsetHeight;
    if (w < 8 || h < 8) return;

    // Pill-shaped refraction fragment (the library demo's lens math)
    const rx = 0.32;        // corner ratio of the pill
    const half = 0.44;      // pill half-height in uv units
    const fragment = (uv) => {
      const ix = uv.x - 0.5;
      const iy = uv.y - 0.5;
      const d = roundedRectSDF(ix, iy, 0.48, half, rx);
      const displacement = smoothStep(0.8, 0, d - 0.09); // bezel band
      const scaled = smoothStep(0, 1, displacement);
      return texture(ix * scaled + 0.5, iy * scaled + 0.5);
    };

    shader = new window.LiquidGlassShader({ width: w, height: h, fragment });
    const c = shader.container;

    // lens as button child, filling the box under the content
    c.style.position = 'absolute';
    c.style.inset = '0';
    c.style.width = '100%';      // stretch with the button on hover expansion
    c.style.height = '100%';
    c.style.transform = 'none';
    c.style.borderRadius = '999px';
    c.style.boxShadow = 'none';
    c.style.cursor = 'default';
    c.style.zIndex = '0';
    c.style.pointerEvents = 'none';
    c.style.overflow = 'hidden';
    c.style.backdropFilter = `url(#${shader.id}_filter) blur(1.2px) saturate(1.5) brightness(1.08)`;
    c.style.webkitBackdropFilter = c.style.backdropFilter;
    btn.prepend(c);

    // SVG filter defs stay at page level (document-wide url() resolution);
    // must not live inside the button (it's 0x0, aria-hidden).
    shader.svg.style.position = 'fixed';
    shader.svg.style.top = '0';
    shader.svg.style.left = '0';
    svgHost = shader.svg;
    document.body.appendChild(svgHost);
  };
  attach();

  // Rebuild the filter at the expanded size on hover — debounced to avoid
  // the ping-pong trap (an attach that shifts layout → RO → attach…).
  let t = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(attach, 80);
  });
  ro.observe(btn);

  cleanup = () => {
    clearTimeout(t);
    ro.disconnect();
    shader?.destroy();
    svgHost?.remove();
    svgHost = null;
    shader = null;
  };
}