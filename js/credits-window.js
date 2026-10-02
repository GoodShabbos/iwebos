// credits-window.js — the Credits app, built on the shared glass window.

import { createGlassWindow, singleWindow } from './glass-window.js';

const CREDITS = [
  { role: 'GitHub Repo for this project', names: ['github.com/GoodShabbos/iwebos'] },
  { role: 'Liquid Glass', names: ['github.com/shuding/liquid-glass', 'github.com/shuding/liquid-glass'] },
  { role: 'Fonts', names: ['SF Pro Display'] },
];

function creditsHtml() {
  const groups = CREDITS.map((g) => `
    <section class="credits__group">
      <h3>${g.role}</h3>
      ${g.names.map((n) => `<p>${n}</p>`).join('')}
    </section>`).join('');
  return `
    <div class="credits__hero">
      <h2>iWebOS</h2>
      <p>Made for the Hack Club StarDance webOS mission</p>
    </div>
    ${groups}`;
}

export const openCredits = singleWindow((onClose) => createGlassWindow({
  title: 'Credits',
  className: 'credits-window',
  onClose,
  mount: (body) => { body.innerHTML = creditsHtml(); },
}));
