// settings-window.js — the Settings app: light/dark mode and a visual
// wallpaper picker, built on the shared glass window. It drives the same
// wallpaper.js API as the corner buttons, so everything stays in sync.

import { createGlassWindow, singleWindow } from './glass-window.js';
import {
  WALLPAPER_CYCLES, wallpaperDiscovery, setWallpaper, getWallpaperMode, getWallpaperPath, modeOf,
} from './wallpaper.js';

function mount(body) {
  body.innerHTML = `
    <section class="settings__section">
      <h3>Appearance</h3>
      <div class="settings__segmented" role="radiogroup" aria-label="Appearance">
        <button type="button" role="radio" data-mode="light">Light</button>
        <button type="button" role="radio" data-mode="dark">Dark</button>
      </div>
    </section>
    <section class="settings__section">
      <h3>Wallpaper</h3>
      <div class="settings__grid" role="radiogroup" aria-label="Wallpaper"></div>
    </section>`;

  const modeButtons = [...body.querySelectorAll('[data-mode]')];
  const grid = body.querySelector('.settings__grid');
  let shownMode = null;

  const renderGrid = () => {
    const mode = getWallpaperMode();
    const path = getWallpaperPath();
    if (shownMode !== mode) {
      shownMode = mode;
      grid.replaceChildren(...WALLPAPER_CYCLES.filter((src) => modeOf(src) === mode).map((src) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'settings__thumb';
        b.dataset.src = src;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', 'Wallpaper');
        b.style.backgroundImage = `url("${src}")`;
        b.addEventListener('click', () => setWallpaper(src, { animate: true }));
        return b;
      }));
    }
    for (const b of grid.children) {
      const on = b.dataset.src === path;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-checked', String(on));
    }
    for (const b of modeButtons) {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-checked', String(on));
    }
  };

  for (const b of modeButtons) {
    b.addEventListener('click', () => {
      if (b.dataset.mode !== getWallpaperMode()) setWallpaper(b.dataset.mode, { animate: true });
    });
  }

  // wallpaperchange fires before the state update settles; wait for the reveal
  // (animated changes) and also refresh right away for the non-animated case.
  const refresh = () => requestAnimationFrame(renderGrid);
  document.addEventListener('wallpaperchange', refresh);
  document.addEventListener('wallpaperrevealed', refresh);
  wallpaperDiscovery.then(renderGrid);
  renderGrid();

  return () => {
    document.removeEventListener('wallpaperchange', refresh);
    document.removeEventListener('wallpaperrevealed', refresh);
  };
}

export const openSettings = singleWindow((onClose) => createGlassWindow({
  title: 'Settings',
  className: 'settings-window',
  width: 600,
  height: 500,
  onClose,
  mount,
}));
