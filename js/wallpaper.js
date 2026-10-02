// wallpaper.js — desktop background, switcher, and the wallpaper texture
// that glass text (clock) refracts inside its letterforms.
//
// Wallpapers on disk:
//   assets/wallpapers/light_mode_background-1.jpg  (pastel day gradient)
//   assets/wallpapers/light_mode_background-2.jpg  (new light variant)
//   assets/wallpapers/dark_mode_background-1.jpg   (dark, night look)
//   assets/wallpapers/dark_mode_background-2.jpg   (new dark variant)
// The cycler (js/wallpaper-cycler.js) walks WALLPAPER_CYCLES below; the
// dark-mode toggle keeps using WALLPAPERS.light/dark as the mode anchors.
// Add a new background by dropping the file in assets/wallpapers/ and
// appending an entry.

export const WALLPAPERS = {
  light: './assets/wallpapers/light_mode_background-1.jpg',
  dark: './assets/wallpapers/dark_mode_background-1.jpg',
};

// GitHub Pages doesn't expose directory listings, so discover wallpapers via
// a numbered filename convention instead of maintaining a manual manifest:
// light_mode_background-3.jpg, dark_mode_background-4.webp, etc.
export const WALLPAPER_CYCLES = [];
const WALLPAPER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_WALLPAPER_INDEX = 40;

async function wallpaperExists(path) {
  try {
    const response = await fetch(path, { method: 'HEAD', cache: 'no-cache' });
    return response.ok;
  } catch {
    return false;
  }
}

async function discoverWallpapers() {
  const discovered = [];
  for (const mode of ['light', 'dark']) {
    let missingIndexes = 0;
    for (let index = 1; index <= MAX_WALLPAPER_INDEX && missingIndexes < 2; index++) {
      const prefix = `${mode}_mode_background-${index}`;
      const paths = WALLPAPER_EXTENSIONS.map((extension) =>
        `./assets/wallpapers/${prefix}.${extension}`,
      );
      const found = await Promise.all(paths.map(async (path) => (await wallpaperExists(path) ? path : null)));
      const matches = found.filter(Boolean);
      if (matches.length) {
        discovered.push(...matches);
        missingIndexes = 0;
      } else {
        missingIndexes++;
      }
    }
  }

  // Keep the shipped defaults usable if discovery is unavailable (e.g. file://).
  const cycle = discovered.length ? discovered : [WALLPAPERS.light, WALLPAPERS.dark];
  WALLPAPER_CYCLES.splice(0, WALLPAPER_CYCLES.length, ...cycle);
  return WALLPAPER_CYCLES;
}

export const wallpaperDiscovery = discoverWallpapers();

let current = 'dark';
let currentSrc = WALLPAPERS.dark;
let wallpaperImage = null; // HTMLImageElement handle
let transitionQueue = Promise.resolve();
let transitionCover = null;

// Light or dark — derived from the filename (light_mode / dark_mode), so the
// clock glass re-chains per wallpaper automatically. Raw paths are allowed.
export function modeOf(src) {
  if (typeof src !== 'string') return 'light';
  if (WALLPAPERS.dark === src) return 'dark';
  if (WALLPAPERS.light === src) return 'light';
  if (src.includes('dark_mode')) return 'dark';
  return 'light';
}

export function getWallpaperImage() {
  return wallpaperImage;
}

function getTransitionCover() {
  if (transitionCover) return transitionCover;
  transitionCover = document.createElement('div');
  transitionCover.className = 'wallpaper-transition-cover';
  transitionCover.setAttribute('aria-hidden', 'true');
  document.body.appendChild(transitionCover);
  return transitionCover;
}

function playOpacity(element, from, to, duration) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.style.opacity = String(to);
    return Promise.resolve();
  }
  const animation = element.animate(
    [{ opacity: from }, { opacity: to }],
    { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
  );
  return animation.finished.catch(() => {});
}

function setClockTransitionOpacity(opacity, transition = false) {
  const value = String(opacity);
  const nodes = [
    document.querySelector('.topbar__clock'),
    document.querySelector('.clock-glass-lens'),
    document.querySelector('.clock-glass-specular'),
    document.querySelector('.lock-screen__content'),
  ];
  for (const node of nodes) {
    if (!node) continue;
    node.style.transition = transition ? 'opacity 240ms ease-out' : 'none';
    node.style.opacity = value;
  }
}

function setOtherChromeOpacity(opacity, transition = false) {
  const date = document.querySelector('.topbar__date');
  if (date) {
    date.style.transition = transition ? 'opacity 180ms ease-out' : 'none';
    date.style.opacity = String(opacity);
  }
  for (const node of document.querySelectorAll('.glass-toggle')) {
    node.style.transition = transition ? 'opacity 180ms ease-out' : 'none';
    node.style.opacity = String(opacity);
  }
}

async function applyWallpaper(mode, src, animate) {
  if (src === currentSrc && document.body.style.backgroundImage) return;

  let cover = null;
  if (animate) {
    cover = getTransitionCover();
    cover.style.backgroundColor = mode === 'dark' ? '#000' : '#fff';
    cover.style.opacity = '0';
    cover.style.zIndex = '900'; // first cover the clock and controls too
    document.body.dataset.wallpaperTransition = 'true';
    await playOpacity(cover, 0, 1, 360);
    // The background is now fully black/white. Hide the old digits, switch
    // the wallpaper and rebuild the new glass while it remains covered.
    setClockTransitionOpacity(0);
  }

  current = mode;
  currentSrc = src;
  const body = document.body;
  body.dataset.wallpaperMode = mode;
  body.style.backgroundImage = `url("${src}")`;
  body.style.backgroundSize = 'cover';
  body.style.backgroundPosition = 'center';
  body.style.backgroundRepeat = 'no-repeat';
  body.style.backgroundAttachment = 'fixed';
  body.style.minHeight = '100vh';

  const blurReady = buildWallpaperBlur(src);
  const change = new CustomEvent('wallpaperchange', {
    detail: { mode, path: src, ready: Promise.resolve() },
  });
  document.dispatchEvent(change);
  await Promise.all([blurReady, change.detail.ready]);

  if (animate && cover) {
    // Put the clock above the solid-color cover. The new digits fade in first;
    // only then does the cover dissolve to reveal the new wallpaper.
    setOtherChromeOpacity(0);
    cover.style.zIndex = '450';
    setClockTransitionOpacity(1, true);
    await new Promise((resolve) => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260));
    await playOpacity(cover, 1, 0, 620);
    cover.remove();
    if (transitionCover === cover) transitionCover = null;
    delete document.body.dataset.wallpaperTransition;
    document.body.classList.remove('wallpaper-booting');
    setOtherChromeOpacity(1, true);
    document.dispatchEvent(new CustomEvent('wallpaperrevealed'));
    for (const node of [
      document.querySelector('.topbar__clock'),
      document.querySelector('.clock-glass-lens'),
      document.querySelector('.clock-glass-specular'),
    ]) {
      node?.style.removeProperty('opacity');
      node?.style.removeProperty('transition');
    }
  }
}

export function setWallpaper(mode = 'light', { animate = false } = {}) {
  const src = WALLPAPERS[mode] || mode; // allow a raw path too
  const resolved = modeOf(src);
  const run = () => applyWallpaper(resolved, src, animate);
  if (!animate) return run();
  transitionQueue = transitionQueue.catch(() => {}).then(run);
  return transitionQueue;
}

/**
 * Build a heavily blurred, low-res copy of the wallpaper and expose it as a
 * CSS custom property (--wallpaper-blur). Glass text uses it via
 * background-clip: text so the glyphs refract the wallpaper like real glass.
 */
export async function buildWallpaperBlur(src = WALLPAPERS.light) {
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src;
    });
    wallpaperImage = img;
    // Render at low resolution: blurry at full size, cheap to compute.
    const canvas = document.createElement('canvas');
    const scale = 420 / img.width;
    canvas.width = 420;
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.filter = `blur(${Math.max(6, Math.round(26 * scale))}px)`;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.9);
    document.body.style.setProperty('--wallpaper-blur', `url("${url}")`);
    return url;
  } catch {
    return null; /* glass falls back to plain tint */
  }
}

export function renderWallpaper(rootEl) {
  setWallpaper(currentSrc);
}

export function getWallpaperMode() {
  return current;
}

export function getWallpaperPath() {
  return currentSrc;
}

