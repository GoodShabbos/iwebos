/**
 * liqui.js — vanilla adapter for the @liqui-design/glass kernel.
 *
 * liqui.design is a React library (shadcn registry + @liqui-design/glass
 * runtime). iWebOS is a no-build plain-HTML/ESM project, so instead of the
 * shadcn CLI flow we vendor the actual refraction kernel
 * (js/vendor/liqui-glass-kernel.js — a faithful non-React port of the
 * library's engine: SVG filter registry, canvas displacement maps,
 * Snell's-law bezel profiles, browser fallback detection) and drive it with
 * this tiny adapter that mirrors the React primitive's contract 1:1.
 *
 * makeGlassSurface(el, opts) ≈ <LiquiGlass {...opts}/> for an existing DOM
 * element: it injects the same four layers inside el's parent wrapper and
 * applies the same dials (frost, refraction, bezel, blur, specular,
 * saturation, profile, material).
 */

import { ensureFilter, prewarmImage, glassImages, supportsRefraction } from './vendor/liqui-glass-kernel.js';

/** Default theme — matches liqui's defaultGlassTheme. */
const DEFAULTS = {
  profile: 'squircle',
  frost: 0.35,
  specular: 0.7,
  dispersion: 0,
  saturation: 1.7,
  radius: 16,
  blur: 1,
  refraction: 140,
  bezel: 26,
  elevated: false,
};

/**
 * Turn an existing element into a liqui glass surface.
 * The element keeps all event handlers/content — layers are added around it.
 * Returns a cleanup function.
 */
export function makeGlassSurface(el, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const tier =
    o.material === 'clear' ? 'clear' : o.material === 'frost' ? 'frost' : supportsRefraction ? 'refract' : 'frost';

  // Structural classes from the library's own CSS (styles/liqui-glass.css).
  el.classList.add('liqui-glass', `liqui-glass--${tier}`);
  if (o.elevated) el.classList.add('liqui-glass--elevated');
  el.style.setProperty('--lq-radius', `${Math.round(o.radius)}px`);

  // Wrap all existing children in .liqui-glass__content (z-index 3) — exactly
  // what the LiquiGlass primitive does — so content paints above every layer.
  const content = document.createElement('div');
  content.className = 'liqui-glass__content';
  while (el.firstChild) content.appendChild(el.firstChild);
  el.appendChild(content);

  const layers = [];
  const layer = (cls) => {
    const s = document.createElement('span');
    s.className = cls;
    s.setAttribute('aria-hidden', 'true');
    layers.push(s);
    return s;
  };

  const effectiveBlur = o.blur + o.frost * 14;
  const backdropFilter =
    tier === 'clear'
      ? null
      : tier === 'frost'
        ? `blur(${Math.max(effectiveBlur * 2, 10)}px) saturate(${o.saturation})`
        : `blur(${effectiveBlur}px) saturate(${o.saturation})`;

  const backdrop = layer('liqui-glass__backdrop');
  if (backdropFilter) {
    backdrop.style.backdropFilter = backdropFilter;
    backdrop.style.webkitBackdropFilter = backdropFilter;
  }
  el.insertBefore(backdrop, el.firstChild);

  const tint = layer('liqui-glass__tint');
  tint.style.opacity = tier === 'clear' ? 1 : 0.25 + 0.75 * o.frost;
  el.insertBefore(tint, backdrop.nextSibling);

  const shine = layer('liqui-glass__shine');
  el.insertBefore(shine, tint.nextSibling);

  let refractLayer = null;
  let specularLayer = null;
  let observer = null;
  let lastKey = '';

  const applyRefraction = (w, h) => {
    if (w <= 0 || h <= 0) return;
    const img = glassImages(w, h, Math.round(o.radius), Math.max(1, Math.round(o.bezel)), o.profile);
    prewarmImage(img.specular);
    const { id, cold } = ensureFilter({
      w,
      h,
      mapHref: img.map,
      refraction: Math.round(o.refraction),
      dispersion: o.dispersion,
    });

    if (!refractLayer) {
      refractLayer = layer('liqui-glass__refract');
      el.insertBefore(refractLayer, el.querySelector('.liqui-glass__backdrop').nextSibling);
      specularLayer = layer('liqui-glass__specular');
      el.insertBefore(specularLayer, el.querySelector('.liqui-glass__tint').nextSibling);
    }
    if (cold) {
      refractLayer.classList.add('liqui-glass__refract--fade');
      specularLayer.classList.add('liqui-glass__specular--fade');
      setTimeout(() => {
        refractLayer.classList.remove('liqui-glass__refract--fade');
        specularLayer.classList.remove('liqui-glass__specular--fade');
      }, 250);
    }
    refractLayer.style.backdropFilter = `url(#${id})`;
    refractLayer.style.webkitBackdropFilter = `url(#${id})`;
    specularLayer.style.backgroundImage = `url(${img.specular})`;
    specularLayer.style.opacity = o.specular;
  };

  if (tier === 'refract') {
    // Layout sizes only (offsetWidth/ResizeObserver contentRect) — never
    // getBoundingClientRect, per the kernel's displacement-map rules.
    const apply = (w, h) => {
      const key = `${w}x${h}`;
      if (key === lastKey) return;
      lastKey = key;
      applyRefraction(w, h);
    };
    apply(el.offsetWidth, el.offsetHeight);
    observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      apply(Math.round(rect.width), Math.round(rect.height));
    });
    observer.observe(el);
  }

  return () => {
    observer?.disconnect();
    layers.forEach((s) => s.remove());
    el.classList.remove('liqui-glass', `liqui-glass--${tier}`, 'liqui-glass--elevated');
  };
}

export { supportsRefraction } from './vendor/liqui-glass-kernel.js';