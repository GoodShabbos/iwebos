// wallpaper-cycler.js — the bottom-LEFT glass button that cycles wallpapers.
// Same material + expansion animation as the dark-mode toggle
// (js/dark-mode-toggle.js): a shuding liquid-glass lens inside the pill,
// spring width expansion revealing the label on hover.
//
// Wallpapers register in WALLPAPERS (js/wallpaper.js); the cycler walks the
// list, so new wallpapers added there automatically join the rotation —
// no changes needed here beyond the icon/label mapping.

import { WALLPAPER_CYCLES, wallpaperDiscovery, getWallpaperPath, setWallpaper } from './wallpaper.js';

// SF-symbol-like photo/image icon for the cycler
const WALLPAPER_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
    <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="3.4"/>
    <circle cx="8.6" cy="9.4" r="1.7" fill="currentColor" stroke="none"/>
    <path stroke-linecap="round" d="M4.4 17.2 10 12l4.2 3.8 2.6-2.4 3 2.8"/>
  </g>
</svg>`;

let cleanup = null;

export function renderWallpaperCycler(rootEl) {
  if (cleanup) cleanup();
  cleanup = null;

  const btn = document.createElement('button');
  btn.className = 'glass-toggle glass-cycler';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Rotate Wallpapers');
  btn.innerHTML = `
    <span class="glass-toggle__icon">${WALLPAPER_SVG}</span>
    <span class="glass-toggle__text">Rotate Wallpapers</span>
  `;

  btn.addEventListener('click', async () => {
    await wallpaperDiscovery;
    const currentIndex = WALLPAPER_CYCLES.indexOf(getWallpaperPath());
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % WALLPAPER_CYCLES.length;
    await setWallpaper(WALLPAPER_CYCLES[nextIndex], { animate: true });
    btn.setAttribute('aria-label', 'Rotate Wallpapers');
  });

  rootEl.appendChild(btn);

  // ---- the glass lens (shuding shader) — same recipe as the toggle ----
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

    const rx = 0.32;
    const half = 0.44;
    const fragment = (uv) => {
      const ix = uv.x - 0.5;
      const iy = uv.y - 0.5;
      const d = roundedRectSDF(ix, iy, 0.48, half, rx);
      const displacement = smoothStep(0.8, 0, d - 0.09);
      const scaled = smoothStep(0, 1, displacement);
      return texture(ix * scaled + 0.5, iy * scaled + 0.5);
    };

    shader = new window.LiquidGlassShader({ width: w, height: h, fragment });
    const c = shader.container;
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
    c.style.backdropFilter = `url(#${shader.id}_filter) blur(1.2px) saturate(1.5) brightness(1.08)`;
    c.style.webkitBackdropFilter = c.style.backdropFilter;
    btn.prepend(c);

    shader.svg.style.position = 'fixed';
    shader.svg.style.top = '0';
    shader.svg.style.left = '0';
    svgHost = shader.svg;
    document.body.appendChild(svgHost);
  };
  attach();

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