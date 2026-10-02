/**
 * glass-clock.js — the clock's digits as liquid glass, driven by the
 * vendored shuding/liquid-glass Shader (real displacement-map refraction,
 * not a blur approximation).
 *
 * How it composes with the library:
 *  - The Shader's fragment() returns, per pixel of a W×H region, the SOURCE
 *    position that pixel samples from (texture(u, v)). We supply a custom
 *    fragment built from the glyphs themselves: an offscreen canvas is used
 *    to rasterize the time string + a one-pass distance blur of its alpha
 *    channel gives a smooth rim→interior displacement profile (the lens
 *    bends hardest near the letter edges, exactly like the iOS clock).
 *  - The library renders that into an SVG feDisplacementMap; we apply the
 *    filter to a dedicated transparent overlay div (the h1's backdrop-filter
 *    can't take a sized filter region cleanly, and the h1's own glyphs must
 *    stay as the crisp SF Pro "print" on top of the refraction).
 *  - The overlay's backdrop = everything below it = wallpaper ONLY (text is
 *    painted above by the h1), so no ghost glyphs are possible.
 */

import { buildGlassFragment, renderGlyphMask, renderSpecular, canvasFont } from './glass-fragment.js';

const RIM = 0.38;     // rim width, fraction of max stroke depth
const MAXPULL = 0.07  // max pull, fraction of lens size (refraction strength)

let overlay = null;
let attaching = false; // re-entrancy guard (ResizeObserver tick during attach)
let activeClockEl = null;

export function registerGlassClock(clockEl) {
  activeClockEl = clockEl;
}

// Stop tracking the clock (e.g. after login) so wallpaper changes no longer
// try to rebuild its glass.
export function unregisterGlassClock() {
  activeClockEl = null;
}

/**
 * Attach glyph-shaped liquid glass to the clock.
 * @param {HTMLElement} clockEl the h1.topbar__clock
 */
export async function attachGlassClock(clockEl) {
  if (!window.LiquidGlassShader) return; // library failed to load
  activeClockEl = clockEl;
  if (attaching) {
    // A wallpaper transition must wait for an in-flight lens rebuild, then
    // rebuild once more against the newest backdrop before revealing.
    while (attaching) await new Promise((resolve) => setTimeout(resolve, 16));
    return attachGlassClock(clockEl);
  }
  attaching = true;

  try {
    destroyGlassClock();

    const rect = clockEl.getBoundingClientRect();
    const w = Math.ceil(rect.width);
    const h = Math.ceil(rect.height);
    if (w < 4 || h < 4) return;

    const cs = getComputedStyle(clockEl);
    const fontCss = canvasFont(cs);
    // CSS tracking must match the canvas rendering (drift bug without it)
    const letterSpacing = parseFloat(cs.letterSpacing) || 0;
    const maskUrl = await renderGlyphMask({ text: clockEl.textContent, w, h, fontCss, letterSpacing });
    const specularUrl = await renderSpecular({ text: clockEl.textContent, w, h, fontCss, letterSpacing });
    const fragment = await buildGlassFragment({
      text: clockEl.textContent,
      w, h,
      fontCss,
      rim: RIM,
      maxPull: MAXPULL,
      letterSpacing,
    });

    const shader = new window.LiquidGlassShader({ width: w, height: h, fragment });
    const c = shader.container;
    c.classList.add('clock-glass-lens');
    c.style.top = `${rect.top + scrollY}px`;
    c.style.left = `${rect.left + scrollX}px`;
    c.style.transform = 'none';
    c.style.borderRadius = '0';
    c.style.boxShadow = 'none';
    c.style.cursor = 'default';
    c.style.pointerEvents = 'none';
    c.style.background = 'transparent';
    c.style.opacity = document.body.dataset.wallpaperTransition === 'true' ? '0' : '1';
    // lens exists ONLY where the glyphs are: mask to the ink alpha
    c.style.maskImage = `url("${maskUrl}")`;
    c.style.webkitMaskImage = `url("${maskUrl}")`;
    // refraction chain per wallpaper mode:
    //   light mode — pale desaturated glass over the light wallpaper; the
    //     displaced wallpaper bands ARE the digit shading.
    //   dark mode — iOS's dark clock is WHITE frosted glass: a white fill
    //     at 0.72 + gentle chain (a big brightness boost on a near-black
    //     backdrop renders black; an opaque white base buries the glass).
    //     The liquid character lives in the rims + specular here, matching
    //     the real iOS look.
    const dark = document.body.dataset.wallpaperMode === 'dark';
    c.style.backgroundColor = dark ? 'rgba(244, 247, 252, 0.72)' : 'transparent';
    c.style.backdropFilter = dark
      ? `url(#${shader.id}_filter) blur(1.5px) contrast(1.1) saturate(0.9) brightness(1.2)`
      : `url(#${shader.id}_filter) blur(1.5px) contrast(1.45) saturate(0.5) brightness(1.32)`;
    c.style.webkitBackdropFilter = c.style.backdropFilter;
    c.style.overflow = 'visible'; // glyph ink may exceed the box slightly
    document.body.appendChild(shader.svg);
    document.body.appendChild(c);

    // Specular rim layer: white catch-lights on the top edges of every
    // stroke + dark thickness shading beneath — masked to the glyphs, sitting
    // above the refraction. This is the detail that makes it read as glass.
    const spec = document.createElement('span');
    spec.className = 'clock-glass-specular';
    spec.style.cssText = `
      position: fixed;
      top: ${rect.top + scrollY}px;
      left: ${rect.left + scrollX}px;
      width: ${w}px;
      height: ${h}px;
      background-image: url("${specularUrl}");
      background-size: 100% 100%;
      mask-image: url("${maskUrl}");
      -webkit-mask-image: url("${maskUrl}");
      pointer-events: none;
      z-index: 502;
      opacity: ${document.body.dataset.wallpaperTransition === 'true' ? '0' : '1'};
    `;
    document.body.appendChild(spec);

    // Re-attach when the ink box changes size (e.g. 9:59 → 10:00).
    // Debounced + size-gated: the overlay itself can nudge layout, so an
    // immediate rebuild would ping-pong (attach → resize event → attach…).
    let lastW = w, lastH = h;
    let debounceTimer = null;
    const ro = new ResizeObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const rectNow = clockEl.getBoundingClientRect();
        const wNow = Math.ceil(rectNow.width);
        const hNow = Math.ceil(rectNow.height);
        // rebuild only when the clock genuinely changed size
        if (wNow !== lastW && wNow > 4 && hNow > 4 && overlay && overlay.el === clockEl) {
          lastW = wNow;
          lastH = hNow;
          attachGlassClock(clockEl);
        }
      }, 80);
    });
    ro.observe(clockEl);

    overlay = { shader, ro, el: clockEl, w, h, spec, clockEl };
  } finally {
    attaching = false;
  }
}

// Re-attach on wallpaper mode change — the refraction chain is mode-aware.
document.addEventListener('wallpaperchange', (event) => {
  const clockEl = activeClockEl || overlay?.clockEl;
  if (clockEl) event.detail.ready = attachGlassClock(clockEl);
});

export function destroyGlassClock() {
  if (!overlay) return;
  overlay.ro.disconnect();
  overlay.shader.destroy();
  overlay.spec?.remove();
  overlay = null;
}