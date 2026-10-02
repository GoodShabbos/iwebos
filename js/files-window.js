// files-window.js — the File Explorer. Laid out like Windows Explorer (back /
// forward / up, address bar, search, command bar, navigation pane, details
// list with sortable columns, status bar) but drawn as iPhone-style glass.
// Browses the pretend file system (fs.js); double-click opens in the Notepad.

import { createGlassWindow, singleWindow } from './glass-window.js';
import { FOLDERS, listFiles, deleteFile, sizeOf } from './fs.js';
import { openNotepad, newNote } from './notepad-window.js';

const svg = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

const ICONS = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  forward: svg('<path d="M9 5l7 7-7 7"/>'),
  up: svg('<path d="M12 19V6M6 11l6-6 6 6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  open: svg('<path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V14M14 5h5v5M19 5l-8 8"/>'),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 11v5M13.5 11v5"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>'),
  folder: svg('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l2 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z" fill="currentColor" fill-opacity=".35"/>'),
  doc: svg('<path d="M6 3.5h8l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" fill="currentColor" fill-opacity=".14"/><path d="M14 3.5V8h4.5M8 12.5h8M8 15.5h8M8 18.5h5"/>'),
  pc: svg('<rect x="3.5" y="5" width="17" height="11" rx="2"/><path d="M9 20h6M12 16v4"/>'),
  Desktop: svg('<rect x="3.5" y="5" width="17" height="11" rx="2"/><path d="M9 20h6M12 16v4"/>'),
  Documents: svg('<path d="M6 3.5h8l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z"/><path d="M14 3.5V8h4.5M8 13h8M8 16.5h8"/>'),
  Downloads: svg('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'),
  Pictures: svg('<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="M4.5 17l5-4.5 4 3.5 2.5-2 3.5 3"/>'),
  Music: svg('<path d="M9 17.5V6l10-2v11.5"/><circle cx="7" cy="17.5" r="2.2"/><circle cx="17" cy="15.5" r="2.2"/>'),
  Videos: svg('<rect x="3.5" y="6" width="17" height="12" rx="3"/><path d="M10.5 9.5v5l4-2.5Z" fill="currentColor"/>'),
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const formatSize = (b) => (b < 1024 ? `${b} B` : `${Math.ceil(b / 1024)} KB`);
const formatTime = (ms) => new Date(ms).toLocaleString('en-US', {
  month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
const typeOf = (name) => {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  return ext === 'md' ? 'Markdown File' : ext ? `${ext.toUpperCase()} File` : 'File';
};

const SIDEBAR = [
  { title: 'On This PC', items: ['Desktop', 'Documents', 'Downloads', 'Pictures'] },
  { title: 'Pinned', items: [null, 'Music', 'Videos'] }, // null = This PC itself
];

function mount(body) {
  body.innerHTML = `
    <div class="fx">
      <div class="fx__top">
        <div class="fx__nav">
          <button type="button" class="fx__icon-btn" data-nav="back" aria-label="Back">${ICONS.back}</button>
          <button type="button" class="fx__icon-btn" data-nav="forward" aria-label="Forward">${ICONS.forward}</button>
          <button type="button" class="fx__icon-btn" data-nav="up" aria-label="Up">${ICONS.up}</button>
        </div>
        <div class="fx__address" aria-label="Address"></div>
        <label class="fx__search">${ICONS.search}<input type="search" spellcheck="false" aria-label="Search"></label>
      </div>
      <div class="fx__cmd">
        <button type="button" class="glass-button" data-act="new">${ICONS.plus}New Note</button>
        <button type="button" class="glass-button" data-act="delete">${ICONS.trash}Delete Note</button>
      </div>
      <div class="fx__main">
        <nav class="fx__side" aria-label="Navigation pane"></nav>
        <div class="fx__content">
          <div class="fx__head">
            <button type="button" data-col="name" class="fx__col-name">Name<i></i></button>
            <button type="button" data-col="date" class="fx__col-date">Date modified<i></i></button>
            <button type="button" data-col="type" class="fx__col-type">Type<i></i></button>
            <button type="button" data-col="size" class="fx__col-size">Size<i></i></button>
          </div>
          <div class="files__list" role="listbox" aria-label="Files" tabindex="0"></div>
        </div>
      </div>
      <div class="fx__status"></div>
    </div>`;

  const $ = (sel) => body.querySelector(sel);
  const addressEl = $('.fx__address');
  const sideEl = $('.fx__side');
  const list = $('.files__list');
  const statusEl = $('.fx__status');
  const search = $('.fx__search input');
  const backBtn = $('[data-nav="back"]');
  const fwdBtn = $('[data-nav="forward"]');
  const upBtn = $('[data-nav="up"]');
  const delBtn = $('[data-act="delete"]');

  let loc = 'Documents';        // null = "This PC"
  const history = [loc];
  let at = 0;
  let selected = null;          // item key
  let sort = { col: 'name', dir: 1 };
  let items = [];

  const visibleItems = () => {
    const q = search.value.trim().toLowerCase();
    let rows;
    if (loc === null) {
      rows = FOLDERS.map((name) => ({
        key: `d:${name}`, kind: 'folder', name, type: 'File folder', date: 0, size: -1,
      }));
    } else {
      rows = listFiles(loc).map((f) => ({
        key: `f:${f.id}`, kind: 'file', id: f.id, name: f.name, type: typeOf(f.name), date: f.modified, size: sizeOf(f),
      }));
    }
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    const { col, dir } = sort;
    return rows.sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      const c = typeof av === 'string' ? av.localeCompare(bv, undefined, { sensitivity: 'base' }) : av - bv;
      return (c || a.name.localeCompare(b.name)) * dir;
    });
  };

  const renderChrome = () => {
    addressEl.innerHTML = loc === null
      ? '<span class="fx__crumb is-current">This PC</span>'
      : `<button type="button" class="fx__crumb" data-go="">This PC</button><span class="fx__sep">${ICONS.forward}</span><span class="fx__crumb is-current">${loc}</span>`;
    search.placeholder = loc === null ? 'Search This PC' : `Search ${loc}`;
    sideEl.innerHTML = SIDEBAR.map((g) => `
      <div class="fx__side-title">${g.title}</div>
      ${g.items.map((name) => {
        const target = name ?? '';
        const label = name ?? 'This PC';
        const on = (name ?? null) === loc;
        return `<button type="button" class="fx__side-item${on ? ' is-active' : ''}" data-go="${target}">${ICONS[name ?? 'pc']}<span>${label}</span></button>`;
      }).join('')}`).join('');
    backBtn.disabled = at === 0;
    fwdBtn.disabled = at === history.length - 1;
    upBtn.disabled = loc === null;
    for (const b of body.querySelectorAll('[data-col]')) {
      const on = b.dataset.col === sort.col;
      b.classList.toggle('is-sorted', on);
      b.querySelector('i').textContent = on ? (sort.dir === 1 ? '▲' : '▼') : '';
    }
  };

  const renderList = () => {
    items = visibleItems();
    if (!items.some((r) => r.key === selected)) selected = null;
    const empty = search.value.trim()
      ? 'No items match your search.'
      : '';
    list.innerHTML = items.length
      ? items.map((r) => `
        <div class="files__row${r.key === selected ? ' is-selected' : ''}" role="option"
             aria-selected="${r.key === selected}" data-key="${r.key}">
          <span class="fx__col-name"><span class="files__icon${r.kind === 'folder' ? ' is-folder' : ''}">${ICONS[r.kind === 'folder' ? 'folder' : 'doc']}</span><span class="files__name">${esc(r.name)}</span></span>
          <span class="fx__col-date">${r.date ? formatTime(r.date) : ''}</span>
          <span class="fx__col-type">${r.type}</span>
          <span class="fx__col-size">${r.size >= 0 ? formatSize(r.size) : ''}</span>
        </div>`).join('')
      : `<p class="files__empty">${empty}</p>`;
    const sel = items.find((r) => r.key === selected);
    statusEl.textContent = `${items.length} item${items.length === 1 ? '' : 's'}${sel ? '  |  1 item selected' : ''}`;
    delBtn.disabled = !sel || sel.kind !== 'file';
  };

  const render = () => { renderChrome(); renderList(); };

  const go = (target, push = true) => {
    if (target === loc && push) return;
    if (push) {
      history.splice(at + 1);
      history.push(target);
      at = history.length - 1;
    }
    loc = target;
    selected = null;
    search.value = '';
    render();
  };

  const openItem = (r) => {
    if (!r) return;
    if (r.kind === 'folder') go(r.name);
    else openNotepad(r.id);
  };
  const current = () => items.find((r) => r.key === selected);
  const removeSelected = () => {
    const r = current();
    if (r?.kind === 'file') deleteFile(r.id);
  };

  // ---- events ----
  backBtn.addEventListener('click', () => { if (at > 0) { at--; go(history[at], false); } });
  fwdBtn.addEventListener('click', () => { if (at < history.length - 1) { at++; go(history[at], false); } });
  upBtn.addEventListener('click', () => go(null));
  for (const el of [addressEl, sideEl]) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]');
      if (b) go(b.dataset.go || null);
    });
  }
  search.addEventListener('input', renderList);
  body.querySelector('.fx__head').addEventListener('click', (e) => {
    const b = e.target.closest('[data-col]');
    if (!b) return;
    sort = { col: b.dataset.col, dir: sort.col === b.dataset.col ? -sort.dir : 1 };
    render();
  });

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.files__row');
    selected = row ? row.dataset.key : null;
    renderList();
  });
  list.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.files__row');
    if (row) openItem(items.find((r) => r.key === row.dataset.key));
  });
  list.addEventListener('keydown', (e) => {
    const i = items.findIndex((r) => r.key === selected);
    if (e.key === 'Enter') openItem(current());
    else if (e.key === 'Delete') removeSelected();
    else if (e.key === 'Backspace') { if (at > 0) backBtn.click(); }
    else if (e.key === 'ArrowDown' && items.length) { selected = items[Math.min(i + 1, items.length - 1)].key; renderList(); }
    else if (e.key === 'ArrowUp' && items.length) { selected = items[Math.max(i - 1, 0)].key; renderList(); }
    else return;
    e.preventDefault();
  });
  $('[data-act="new"]').addEventListener('click', newNote);
  delBtn.addEventListener('click', removeSelected);

  document.addEventListener('fschange', render);
  render();
  return () => document.removeEventListener('fschange', render);
}

export const openFiles = singleWindow((onClose) => createGlassWindow({
  title: 'File Explorer',
  className: 'files-window',
  width: 780,
  height: 480,
  onClose,
  mount,
}));
