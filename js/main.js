// main.js — boots the OS.
// Sequences: boot splash → shell render (wallpaper + top bar) → future lockscreen.

import { setWallpaper } from './wallpaper.js';
import { renderTopBar } from './topbar.js';
import { renderDarkModeToggle } from './dark-mode-toggle.js';
import { renderWallpaperCycler } from './wallpaper-cycler.js';
import { renderLockScreen } from './lock-screen.js';
import { renderTaskbar } from './taskbar.js';
import { renderLogo } from './logo.js';

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
  }, { once: true });
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