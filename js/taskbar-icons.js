// taskbar-icons.js — the default Windows-style apps, drawn as Apple-style icons.
//
// Every icon is an inline SVG on a true iOS "squircle" (a superellipse, not a
// plain rounded rect), with a soft top gloss, an inner hairline and a gradient
// body — the same recipe as iOS home-screen icons.
 
const S = 64; // icon viewBox
 
// iOS-style continuous-corner tile: |x|^n + |y|^n = 1, n≈5.
function squircle(n = 5, steps = 96) {
  const h = S / 2;
  let d = '';
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = h + h * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = h + h * Math.sign(s) * Math.abs(s) ** (2 / n);
    d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d + 'Z';
}
const TILE = squircle();
 
// Wraps a glyph in the shared tile: gradient body, gloss, edge light.
function icon(id, [top, bottom], glyph, defs = '') {
  return `
<svg viewBox="0 0 ${S} ${S}" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="ti-${id}-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
    <linearGradient id="ti-${id}-gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".38"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="ti-${id}-clip"><path d="${TILE}"/></clipPath>
    ${defs}
  </defs>
  <path d="${TILE}" fill="url(#ti-${id}-bg)"/>
  <g clip-path="url(#ti-${id}-clip)">
    ${glyph}
    <rect x="0" y="0" width="${S}" height="30" fill="url(#ti-${id}-gloss)"/>
  </g>
  <path d="${TILE}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1"/>
  <path d="${TILE}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".6"/>
</svg>`;
}
 
const files = () => icon('files', ['#ffffff', '#e4ecf8'], `
  <rect x="12" y="15" width="19" height="13" rx="4.5" fill="#2d8cff"/>
  <rect x="12" y="21" width="40" height="27" rx="6" fill="url(#ti-files-fold)"/>
  <rect x="12" y="21" width="40" height="3" fill="#fff" opacity=".35"/>`,
  `<linearGradient id="ti-files-fold" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0" stop-color="#4db1ff"/><stop offset="1" stop-color="#0a7aff"/>
   </linearGradient>`);
 
const notepad = () => icon('notes', ['#ffffff', '#f1f1f6'], `
  <rect x="0" y="0" width="${S}" height="19" fill="#ffd60a"/>
  <rect x="0" y="18" width="${S}" height=".9" fill="#000" opacity=".1"/>
  <g stroke="#d4d4da" stroke-width="2.6" stroke-linecap="round">
    <path d="M13 30h38M13 38.5h38M13 47h24"/>
  </g>`);
 
const calculator = () => {
  const cols = [16.5, 27.8, 39.1, 50.4];
  const rows = [19.5, 30.5, 41.5, 52.5];
  let dots = '';
  rows.forEach((y, r) => cols.forEach((x, c) => {
    const fill = c === 3 ? '#ff9f0a' : r === 0 ? '#a6a6ab' : '#5a5a5f';
    dots += `<circle cx="${x}" cy="${y}" r="4.6" fill="${fill}"/>`;
  }));
  return icon('calc', ['#3d3d41', '#1b1b1d'], dots);
};
 
const settings = () => {
  const teeth = Array.from({ length: 8 }, (_, i) =>
    `<rect x="28" y="10.5" width="8" height="10" rx="2.4" transform="rotate(${i * 45} 32 32)"/>`).join('');
  return icon('set', ['#b9bec7', '#6c717b'], `
    <g fill="url(#ti-set-gear)">${teeth}<circle cx="32" cy="32" r="14.5"/></g>
    <circle cx="32" cy="32" r="6" fill="#7a808a"/>
    <circle cx="32" cy="32" r="6" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>`,
    `<linearGradient id="ti-set-gear" x1="0" y1="0" x2="0" y2="1">
       <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dde4"/>
     </linearGradient>`);
};
 
const credits = () => icon('credits', ['#ff7eb3', '#b04dff'], `
  <circle cx="32" cy="32" r="19" fill="none" stroke="#fff" stroke-width="3"/>
  <circle cx="32" cy="22.5" r="3.2" fill="#fff"/>
  <path d="M32 29.5v14" stroke="#fff" stroke-width="4.2" stroke-linecap="round"/>`);

// Order is the order shown on the taskbar.
export const TASKBAR_APPS = [
  { id: 'files',      label: 'File Explorer', svg: files },
  { id: 'notepad',    label: 'Notepad',       svg: notepad },
  { id: 'calculator', label: 'Calculator',    svg: calculator },
  { id: 'settings',   label: 'Settings',      svg: settings },
  { id: 'credits',    label: 'Credits',       svg: credits },
];
