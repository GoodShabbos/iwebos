// settings-window.js — the Settings app, modelled on the iPhone's Settings:
// a "Settings" home with colored icon tiles, a Display & Brightness screen
// (Light / Dark phone previews) and a Wallpaper screen. It drives the same
// wallpaper.js API as the corner buttons, so everything stays in sync.
// Shares the iOS navigation styling (.ios__*) with the Files app.

import { createGlassWindow, singleWindow } from './glass-window.js';
import {
  WALLPAPER_CYCLES, wallpaperDiscovery, setWallpaper, getWallpaperMode, getWallpaperPath, modeOf,
} from './wallpaper.js';

const svg = (body, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const I = {
  chevronRight: svg('<path d="M9 5l7 7-7 7"/>', 'ios__chev'),
  chevronLeft: svg('<path d="M15 4.5L7.5 12l7.5 7.5" stroke-width="2.6"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
  clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="var(--search-bg)" stroke-width="2" stroke-linecap="round"/></svg>',
  check: svg('<path d="M5.5 12.5l4.2 4.2L18.5 8"/>', 'ios__check'),
  // white glyphs for the colored row tiles
  display: svg('<circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>'),
  wallpaper: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none"/><path d="M4.5 17.5l5-4.5 4 3.5 2.5-2.2 3.5 3"/>'),
};

const ROWS = [
  { id: 'display', label: 'Display & Brightness', icon: I.display, color: '#007aff' },
  { id: 'wallpaper', label: 'Wallpaper', icon: I.wallpaper, color: '#32ade6' },
];
const TITLES = { settings: 'Settings', display: 'Display & Brightness', wallpaper: 'Wallpaper' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function mount(body) {
  body.innerHTML = '<div class="ios"><div class="ios__stage"></div></div>';
  const stage = body.querySelector('.ios__stage');

  const stack = ['settings'];
  let query = '';
  let ui = {};
  const top = () => stack[stack.length - 1];

  function contentHtml() {
    const id = top();
    if (id === 'settings') {
      const q = query.trim().toLowerCase();
      const rows = ROWS.filter((r) => !q || r.label.toLowerCase().includes(q));
      if (!rows.length) {
        return `<div class="ios__empty"><strong>No Results</strong><span>for “${esc(query.trim())}”</span></div>`;
      }
      return `<div class="ios__card">${rows.map((r) => `
        <button type="button" class="ios__loc" data-go="${r.id}">
          <span class="set__tile" style="background:${r.color}">${r.icon}</span>
          <span class="ios__loc-name">${r.label}</span>${I.chevronRight}
        </button>`).join('')}</div>`;
    }
    const mode = getWallpaperMode();
    if (id === 'display') {
      const opt = (m, label) => `
        <button type="button" class="set__mode${mode === m ? ' is-on' : ''}" role="radio" aria-checked="${mode === m}" data-mode="${m}">
          <span class="set__phone set__phone--${m}"></span>
          <span class="set__mode-label">${label}</span>
          <span class="ios__select">${I.check}</span>
        </button>`;
      return `
        <h2 class="set__header">Appearance</h2>
        <div class="ios__card set__appearance" role="radiogroup" aria-label="Appearance">${opt('light', 'Light')}${opt('dark', 'Dark')}</div>`;
    }
    // wallpaper
    const path = getWallpaperPath();
    const group = (m, title) => {
      const srcs = WALLPAPER_CYCLES.filter((s) => modeOf(s) === m);
      if (!srcs.length) return '';
      return `
        <h2 class="set__header">${title}</h2>
        <div class="set__walls" role="radiogroup" aria-label="${title} wallpapers">${srcs.map((s) => `
          <button type="button" class="set__wall${s === path ? ' is-on' : ''}" role="radio" aria-checked="${s === path}"
                  aria-label="Wallpaper" data-src="${esc(s)}" style="background-image:url('${esc(s)}')">
            <span class="ios__select">${I.check}</span>
          </button>`).join('')}</div>`;
    };
    return group('light', 'Light') + group('dark', 'Dark');
  }

  function renderContent() {
    if (!ui.content) return;
    ui.content.innerHTML = contentHtml();
    ui.clear.hidden = !query;
  }

  function renderScreen(dir) {
    const id = top();
    const canBack = stack.length > 1;
    const prev = canBack ? TITLES[stack[stack.length - 2]] : '';
    stage.innerHTML = `
      <section class="ios__screen${dir ? ` is-${dir}` : ''}" data-id="${id}">
        <header class="ios__nav">
          <div class="ios__nav-left">${canBack ? `<button type="button" class="ios__back" data-act="back">${I.chevronLeft}<span>${esc(prev)}</span></button>` : ''}</div>
          <div class="ios__nav-title">${esc(TITLES[id])}</div>
          <div class="ios__nav-right"></div>
        </header>
        <div class="ios__scroll">
          <h1 class="ios__large">${esc(TITLES[id])}</h1>
          ${id === 'settings' ? `<label class="ios__search">${I.search}<input type="text" placeholder="Search" spellcheck="false" aria-label="Search"><button type="button" class="ios__clear" data-act="clear" aria-label="Clear search" hidden>${I.clear}</button></label>` : ''}
          <div class="ios__content"></div>
        </div>
      </section>`;
    const screen = stage.firstElementChild;
    ui = {
      screen,
      scroll: screen.querySelector('.ios__scroll'),
      content: screen.querySelector('.ios__content'),
      input: screen.querySelector('.ios__search input'),
      clear: screen.querySelector('.ios__clear') || { hidden: true },
    };
    ui.input?.addEventListener('input', () => { query = ui.input.value; renderContent(); });
    ui.scroll.addEventListener('scroll', () => screen.classList.toggle('is-scrolled', ui.scroll.scrollTop > 34));
    renderContent();
  }

  const push = (id) => { stack.push(id); query = ''; renderScreen('push'); };
  const pop = () => {
    if (stack.length < 2) return;
    stack.pop();
    query = '';
    renderScreen('pop');
  };

  body.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'back') pop();
      else if (act.dataset.act === 'clear') { query = ''; ui.input.value = ''; renderContent(); ui.input.focus(); }
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go) { push(go.dataset.go); return; }
    const mode = e.target.closest('[data-mode]');
    if (mode) {
      if (mode.dataset.mode !== getWallpaperMode()) setWallpaper(mode.dataset.mode, { animate: true });
      return;
    }
    const wall = e.target.closest('[data-src]');
    if (wall) setWallpaper(wall.dataset.src, { animate: true });
  });

  // Marks follow the real wallpaper state (also when changed by the corner buttons).
  const refresh = () => requestAnimationFrame(renderContent);
  document.addEventListener('wallpaperchange', refresh);
  document.addEventListener('wallpaperrevealed', refresh);
  wallpaperDiscovery.then(renderContent);

  renderScreen(null);
  return () => {
    document.removeEventListener('wallpaperchange', refresh);
    document.removeEventListener('wallpaperrevealed', refresh);
  };
}

export const openSettings = singleWindow((onClose) => createGlassWindow({
  title: 'Settings',
  className: 'settings-window',
  width: 400,
  height: 660,
  onClose,
  mount,
}));
