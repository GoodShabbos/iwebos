// calculator-window.js — the Calculator app: an iPhone-style calculator on the
// shared glass window. Click the keys or type (0-9 . + - * / Enter Esc Backspace %).

import { createGlassWindow, singleWindow } from './glass-window.js';

const KEYS = [
  { id: 'clear', label: 'AC', kind: 'fn' },
  { id: 'neg', label: '±', kind: 'fn' },
  { id: 'pct', label: '%', kind: 'fn' },
  { id: '/', label: '÷', kind: 'op' },
  { id: '7', label: '7' }, { id: '8', label: '8' }, { id: '9', label: '9' },
  { id: '*', label: '×', kind: 'op' },
  { id: '4', label: '4' }, { id: '5', label: '5' }, { id: '6', label: '6' },
  { id: '-', label: '−', kind: 'op' },
  { id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' },
  { id: '+', label: '+', kind: 'op' },
  { id: '0', label: '0', kind: 'zero' }, { id: '.', label: '.' },
  { id: '=', label: '=', kind: 'op' },
];

const MAX_DIGITS = 9;

const apply = (a, op, b) => {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? NaN : a / b;
    default: return b;
  }
};

// Trim float noise (0.1 + 0.2 → 0.3) and return a plain string.
const toEntry = (n) => (Number.isFinite(n) ? String(parseFloat(n.toPrecision(12))) : 'Error');

// "1234567.5" → "1,234,567.5" (leaves exponents and errors alone)
function pretty(entry) {
  if (entry === 'Error' || /e/i.test(entry)) return entry;
  const [int, frac] = entry.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = int.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${digits}${frac !== undefined ? `.${frac}` : ''}`;
}

function mount(body) {
  body.innerHTML = `
    <div class="calc__display" aria-live="polite"><span class="calc__value">0</span></div>
    <div class="calc__pad">
      ${KEYS.map((k) => `<button type="button" class="calc__key calc__key--${k.kind || 'num'}" data-key="${k.id}">${k.label}</button>`).join('')}
    </div>`;

  const valueEl = body.querySelector('.calc__value');
  const displayEl = body.querySelector('.calc__display');
  const clearBtn = body.querySelector('[data-key="clear"]');
  const opBtns = [...body.querySelectorAll('.calc__key--op')];

  let entry = '0';        // what's on screen, as a raw string
  let acc = null;         // left operand
  let op = null;          // pending operator
  let fresh = true;       // next digit starts a new number
  let lastOp = null;      // for repeated "="
  let lastB = null;

  const cur = () => parseFloat(entry);

  const fit = () => {
    let size = 84;
    valueEl.style.fontSize = `${size}px`;
    while (size > 30 && valueEl.scrollWidth > displayEl.clientWidth) {
      size -= 3;
      valueEl.style.fontSize = `${size}px`;
    }
  };

  const show = () => {
    valueEl.textContent = pretty(entry);
    clearBtn.textContent = entry !== '0' && !fresh ? 'C' : 'AC';
    for (const b of opBtns) b.classList.toggle('is-active', fresh && op === b.dataset.key);
    fit();
  };

  const reset = () => { entry = '0'; acc = null; op = null; fresh = true; lastOp = null; lastB = null; };

  const press = (key) => {
    if (entry === 'Error' && key !== 'clear') reset();

    if (/^\d$/.test(key) || key === '.') {
      if (fresh) { entry = key === '.' ? '0.' : key; fresh = false; }
      else if (key === '.') { if (!entry.includes('.')) entry += '.'; }
      else if (entry === '0') entry = key;
      else if (entry.replace(/[-.]/g, '').length < MAX_DIGITS) entry += key;
    } else if (key === 'clear') {
      if (entry !== '0' && !fresh) { entry = '0'; fresh = true; } else reset();
    } else if (key === 'neg') {
      if (entry !== '0') entry = entry.startsWith('-') ? entry.slice(1) : `-${entry}`;
    } else if (key === 'pct') {
      entry = toEntry(cur() / 100);
      fresh = true;
    } else if ('+-*/'.includes(key)) {
      if (op && !fresh) {
        entry = toEntry(apply(acc, op, cur()));
        acc = cur();
      } else acc = cur();
      if (entry === 'Error') { acc = null; op = null; } else op = key;
      fresh = true;
      lastOp = null;
    } else if (key === '=') {
      if (op) {
        const b = cur();
        entry = toEntry(apply(acc, op, b));
        lastOp = op;
        lastB = b;
        acc = null;
        op = null;
      } else if (lastOp) {
        entry = toEntry(apply(cur(), lastOp, lastB));
      }
      fresh = true;
    }
    show();
  };

  const backspace = () => {
    if (fresh || entry === 'Error') return;
    entry = entry.length > 1 && !(entry.length === 2 && entry.startsWith('-')) ? entry.slice(0, -1) : '0';
    show();
  };

  body.querySelector('.calc__pad').addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (b) press(b.dataset.key);
  });

  const KEYMAP = { Enter: '=', '=': '=', Escape: 'clear', Delete: 'clear', '%': 'pct', ',': '.' };
  const win = body.closest('.glass-window');
  win.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let key = KEYMAP[e.key] ?? e.key;
    if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
    if (/^[\d.+\-*/]$/.test(key) || ['=', 'clear', 'pct'].includes(key)) {
      e.preventDefault(); // also stops Enter/Space re-clicking a focused key
      e.stopPropagation(); // Escape clears here instead of closing the window
      press(key);
    }
  }, true);

  win.tabIndex = -1;
  requestAnimationFrame(() => win.focus());
  new ResizeObserver(fit).observe(displayEl);
  show();
}

export const openCalculator = singleWindow((onClose) => createGlassWindow({
  title: 'Calculator',
  className: 'calc-window',
  width: 340,
  height: 600,
  onClose,
  mount,
}));
