// topbar.js — the ticking clock + the iOS lock-screen heading.
// The digits get REAL liquid-glass refraction (vendored shuding/liquid-glass
// Shader with a glyph-shaped fragment) via glass-clock.js, once SF Pro loads.

import { attachGlassClock, registerGlassClock, unregisterGlassClock, destroyGlassClock } from './glass-clock.js';

const GLASS_CLASS = 'is-glass';

export function renderTopBar(rootEl) {
  const top = document.createElement('header');
  top.className = 'topbar';

  const dateEl = document.createElement('p');
  dateEl.className = 'topbar__date';
  const timeEl = document.createElement('h1');
  timeEl.className = 'topbar__clock';
  registerGlassClock(timeEl);

  top.append(dateEl, timeEl);
  rootEl.appendChild(top);

  const update = () => {
    const now = new Date();
    // "Wed Oct 8" — same date style as the iOS lock screen (no comma).
    dateEl.textContent = now
      .toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      .replace(',', '');
    // "11:44" — 12-hour clock, no AM/PM, no leading zero (US iPhone default).
    const time = now
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .replace(/\s?(AM|PM)/i, '');
    timeEl.textContent = time;
    // mirrored for the ::before/::after glass sheen/shadow copies
    timeEl.dataset.time = time;
  };
  update();

  // Real glass once the actual font is in: the fragment must be built from
  // the SF Pro glyph shapes, not the fallback font's.
  document.fonts.load('700 128px "SF Pro Display"')
    .then(() => {
      timeEl.classList.add(GLASS_CLASS);
      return attachGlassClock(timeEl);
    })
    .catch(() => {
      // No SF Pro / no library: CSS fallback fills the glyphs with the
      // frosted wallpaper texture (still a decent glass look).
      timeEl.classList.add(GLASS_CLASS);
    });

  const tick = setInterval(update, 1000);

  // Logging in removes the lock-screen clock and date: fade the digits, their
  // glass lens and specular layers, and the date out, then tear them all down.
  document.addEventListener('oslogin', () => {
    clearInterval(tick);
    unregisterGlassClock();
    const parts = [
      top,
      document.querySelector('.clock-glass-lens'),
      document.querySelector('.clock-glass-specular'),
    ];
    for (const node of parts) {
      if (!node) continue;
      node.style.transition = 'opacity 400ms ease-out';
      node.style.opacity = '0';
    }
    setTimeout(() => {
      destroyGlassClock();
      top.remove();
    }, 440);
  }, { once: true });

  return top;
}