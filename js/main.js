// main.js — boots the OS.
// Sequences: boot splash → shell render (wallpaper + top bar) → future lockscreen.

import { setWallpaper } from './wallpaper.js';
import { renderTopBar } from './topbar.js';
import { renderDarkModeToggle } from './dark-mode-toggle.js';
import { renderWallpaperCycler } from './wallpaper-cycler.js';
import { renderLockScreen } from './lock-screen.js';
import { renderTaskbar } from './taskbar.js';
import { renderLogo } from './logo.js';
import { renderOsClock } from './os-clock.js';
import { openCredits } from './credits-window.js';
import { openSettings } from './settings-window.js';
import { openNotepad } from './notepad-window.js';
import { openFiles } from './files-window.js';
import { openCalculator } from './calculator-window.js';

function renderShell(rootEl) {
  rootEl.innerHTML = '';
  renderTopBar(rootEl);
  renderDarkModeToggle(document.body);
  renderWallpaperCycler(document.body);
  renderLockScreen(document.body);
  // The taskbar is only mounted once the user has "logged in" to the OS.
  document.addEventListener('oslogin', () => {
    renderTaskbar(document.body);
    renderLogo(document.body);
    renderOsClock(document.body);
  }, { once: true });
  document.addEventListener('app-launch', (e) => {
    if (e.detail.id === 'credits') openCredits();
    if (e.detail.id === 'settings') openSettings();
    if (e.detail.id === 'notepad') openNotepad();
    if (e.detail.id === 'files') openFiles();
    if (e.detail.id === 'calculator') openCalculator();
  });
}

export function boot() {
  const splash = document.getElementById('boot-splash');
  const osRoot = document.getElementById('os-root');
  if (!splash || !osRoot) return;

  document.body.classList.add('wallpaper-booting');
  renderShell(osRoot);
  document.body.style.backgroundColor = '#000';

  // First visit lands in dark mode. Start from black, then reveal the dark
  // wallpaper through the same iOS-style cover → clock → wallpaper sequence.
  requestAnimationFrame(() => {
    setWallpaper('dark', { animate: true });
  });

  // Swap the splash out on the next frame so the shell is painted first.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => splash.classList.add('is-hidden'));
    setTimeout(() => splash.remove(), 500);
  });
}

// Auto-run when loaded as the entry point.
boot();