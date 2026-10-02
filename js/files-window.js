// files-window.js — the Files app, modelled on the iPhone's Files: a Browse
// screen (Locations / Favorites), large titles that collapse on scroll, a back
// button labelled with the previous screen, a Recents tab, Select mode and a
// Recently Deleted area. Browses the pretend file system (fs.js); tapping a
// file opens it in the Notepad.

import { createGlassWindow, singleWindow } from './glass-window.js';
import { FOLDERS, listFiles, deleteFile, restoreFile, purgeFile, sizeOf } from './fs.js';
import { openNotepad, newNote } from './notepad-window.js';

const svg = (body, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const I = {
  chevronRight: svg('<path d="M9 5l7 7-7 7"/>', 'ios__chev'),
  chevronLeft: svg('<path d="M15 4.5L7.5 12l7.5 7.5" stroke-width="2.6"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
  clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="var(--search-bg)" stroke-width="2" stroke-linecap="round"/></svg>',
  plus: svg('<path d="M12 5v14M5 12h14" stroke-width="2.4"/>'),
  trash: svg('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5.5M14 11v5.5"/>'),
  restore: svg('<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.5 2"/>'),
  folderTab: svg('<path d="M3.5 7A2 2 0 0 1 5.5 5h4l2 2.2h7A2 2 0 0 1 20.5 9.2v8.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>'),
  phone: svg('<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18.5h3"/>'),
  check: svg('<path d="M5.5 12.5l4.2 4.2L18.5 8"/>', 'ios__check'),
};

// Blue Files folder and white document thumbnail (flat, like the real icons)
const FOLDER_ICON = `
<svg class="ios__folder" viewBox="0 0 44 36" aria-hidden="true">
  <path d="M2 6.5A4.5 4.5 0 0 1 6.5 2h10.2a4.5 4.5 0 0 1 3 1.2L23 6.5h14.5A4.5 4.5 0 0 1 42 11v19.5a4.5 4.5 0 0 1-4.5 4.5h-31A4.5 4.5 0 0 1 2 30.5Z" fill="#64b5ff"/>
  <path d="M2 13a4.5 4.5 0 0 1 4.5-4.5h31A4.5 4.5 0 0 1 42 13v17.5a4.5 4.5 0 0 1-4.5 4.5h-31A4.5 4.5 0 0 1 2 30.5Z" fill="#1c8bff"/>
</svg>`;

const FILE_ICON = `
<svg class="ios__file" viewBox="0 0 32 40" aria-hidden="true">
  <path d="M4 .8h16.5L31 11.3V36a3.2 3.2 0 0 1-3.2 3.2H4A3.2 3.2 0 0 1 .8 36V4A3.2 3.2 0 0 1 4 .8Z" fill="#fff" stroke="#c7c7cc" stroke-width="1.2"/>
  <path d="M20.5.8V8a3.2 3.2 0 0 0 3.2 3.2H31" fill="#e5e5ea" stroke="#c7c7cc" stroke-width="1.2"/>
  <path d="M7 19h18M7 24h18M7 29h12" stroke="#c7c7cc" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function sizeLabel(bytes) {
  if (bytes < 1024) return plural(bytes, 'byte', 'bytes');
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function dateLabel(ms) {
  const d = new Date(ms);
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diff === 0) return `Today at ${time}`;
  if (diff === 1) return `Yesterday at ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TITLES = { recents: 'Recents', browse: 'Browse', iphone: 'On My iWeb', deleted: 'Trash' };
const titleOf = (s) => (s.id === 'folder' ? s.name : TITLES[s.id]);

const EMPTY = {
  folder: ['Folder Is Empty', 'Save a note in Notepad and it will show up here.'],
  recents: ['No Recents', 'Notes you save in Notepad will show up here.'],
  deleted: ['No Deleted Items', 'Deleted files stay here until you remove them.'],
};

function mount(body) {
  body.innerHTML = '<div class="ios"><div class="ios__stage"></div><div class="ios__bar"></div></div>';
  const stage = body.querySelector('.ios__stage');
  const bar = body.querySelector('.ios__bar');

  const tabs = { recents: [{ id: 'recents' }], browse: [{ id: 'browse' }] };
  let tab = 'browse';
  let query = '';
  let selecting = false;
  const picked = new Set();
  let ui = {};
  let items = [];

  const stack = () => tabs[tab];
  const top = () => stack()[stack().length - 1];
  const hasFiles = () => ['folder', 'recents', 'deleted'].includes(top().id);

  // ---- data for the current screen ----
  const folderItem = (name) => ({
    kind: 'folder', key: `d:${name}`, name,
    sub: plural(listFiles(name).length, 'item', 'items'),
  });
  const fileItem = (f) => ({
    kind: 'file', key: `f:${f.id}`, id: f.id, name: f.name,
    sub: `${dateLabel(f.modified)} • ${sizeLabel(sizeOf(f))}`,
  });

  function itemsFor(s) {
    const q = query.trim().toLowerCase();
    const match = (n) => !q || n.toLowerCase().includes(q);
    const byDate = (a, b) => b.modified - a.modified;
    switch (s.id) {
      case 'folder': return listFiles(s.name).filter((f) => match(f.name)).map(fileItem);
      case 'recents': return listFiles().filter((f) => match(f.name)).sort(byDate).map(fileItem);
      case 'deleted': return listFiles(null, true).filter((f) => match(f.name)).map(fileItem);
      case 'iphone':
      case 'browse':
        if (!q && s.id === 'browse') return null; // the Browse home has its own layout
        return [
          ...FOLDERS.filter(match).map(folderItem),
          ...(q ? listFiles().filter((f) => match(f.name)).map(fileItem) : []),
        ];
      default: return [];
    }
  }

  // ---- rendering ----
  function renderScreen(dir) {
    const s = top();
    const canBack = stack().length > 1;
    const prev = canBack ? titleOf(stack()[stack().length - 2]) : '';
    stage.innerHTML = `
      <section class="ios__screen${dir ? ` is-${dir}` : ''}" data-id="${s.id}">
        <header class="ios__nav">
          <div class="ios__nav-left">${canBack ? `<button type="button" class="ios__back" data-act="back">${I.chevronLeft}<span>${esc(prev)}</span></button>` : ''}</div>
          <div class="ios__nav-title"></div>
          <div class="ios__nav-right"></div>
        </header>
        <div class="ios__scroll">
          <h1 class="ios__large">${esc(titleOf(s))}</h1>
          <label class="ios__search">${I.search}<input type="text" placeholder="Search" spellcheck="false" aria-label="Search"><button type="button" class="ios__clear" data-act="clear" aria-label="Clear search" hidden>${I.clear}</button></label>
          <div class="ios__content"></div>
        </div>
      </section>`;
    const screen = stage.firstElementChild;
    ui = {
      screen,
      navTitle: screen.querySelector('.ios__nav-title'),
      navRight: screen.querySelector('.ios__nav-right'),
      scroll: screen.querySelector('.ios__scroll'),
      input: screen.querySelector('.ios__search input'),
      clear: screen.querySelector('.ios__clear'),
      content: screen.querySelector('.ios__content'),
    };
    ui.input.addEventListener('input', () => { query = ui.input.value; renderContent(); });
    ui.scroll.addEventListener('scroll', () => {
      screen.classList.toggle('is-scrolled', ui.scroll.scrollTop > 34);
    });
    renderContent();
  }

  function rowHtml(r) {
    const picks = selecting && r.kind === 'file';
    return `
      <div class="ios__row${picks && picked.has(r.id) ? ' is-picked' : ''}" role="button" tabindex="0" data-key="${r.key}">
        ${picks ? `<span class="ios__select">${I.check}</span>` : ''}
        <span class="ios__thumb">${r.kind === 'folder' ? FOLDER_ICON : FILE_ICON}</span>
        <span class="ios__text">
          <span class="ios__name">${esc(r.name)}</span>
          <span class="ios__sub">${esc(r.sub)}</span>
        </span>
        ${r.kind === 'folder' ? I.chevronRight : ''}
      </div>`;
  }

  function browseHtml() {
    const loc = (go, icon, label) =>
      `<button type="button" class="ios__loc" data-go="${go}"><span class="ios__loc-icon">${icon}</span><span class="ios__loc-name">${label}</span>${I.chevronRight}</button>`;
    return `
      <h2 class="ios__section">Locations</h2>
      <div class="ios__card">
        ${loc('iphone', I.phone, 'On My iWeb')}
        ${loc('deleted', I.trash, 'Trash')}
      </div>
      <h2 class="ios__section">Favorites</h2>
      <div class="ios__card">
        ${loc('folder:Downloads', FOLDER_ICON, 'Downloads')}
      </div>`;
  }

  function renderContent() {
    if (!ui.content) return;
    const s = top();
    items = itemsFor(s);
    const q = query.trim();
    const files = (items || []).filter((r) => r.kind === 'file');
    for (const id of [...picked]) if (!files.some((r) => r.id === id)) picked.delete(id);
    if (selecting && !hasFiles()) selecting = false;

    ui.clear.hidden = !query;
    ui.navTitle.classList.toggle('is-selecting', selecting);
    ui.navTitle.textContent = selecting ? (picked.size ? `${picked.size} Selected` : 'Select Items') : titleOf(s);

    const actions = [];
    if (hasFiles() && (files.length || selecting)) {
      actions.push(selecting
        ? '<button type="button" class="ios__text-btn is-bold" data-act="done">Done</button>'
        : '<button type="button" class="ios__text-btn" data-act="select">Select</button>');
    }
    if (!selecting && (s.id === 'folder' || s.id === 'recents')) {
      actions.push(`<button type="button" class="ios__round-btn" data-act="new" aria-label="New Note">${I.plus}</button>`);
    }
    ui.navRight.innerHTML = actions.join('');

    if (items === null) {
      ui.content.innerHTML = browseHtml();
    } else if (!items.length) {
      const [title, sub] = q ? ['No Results', `for “${q}”`] : (EMPTY[s.id] || ['No Items', '']);
      ui.content.innerHTML = `<div class="ios__empty"><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>`;
    } else {
      ui.content.innerHTML = `<div class="ios__list">${items.map(rowHtml).join('')}</div>${
        q ? '' : `<p class="ios__count">${plural(items.length, 'Item', 'Items')}</p>`}`;
    }
    renderBar();
  }

  function renderBar() {
    const s = top();
    if (selecting) {
      const none = picked.size === 0 ? ' disabled' : '';
      bar.className = 'ios__bar is-toolbar';
      bar.innerHTML = s.id === 'deleted'
        ? `<button type="button" class="ios__tool" data-act="recover"${none}>${I.restore}<span>Recover</span></button>
           <button type="button" class="ios__tool" data-act="purge"${none}>${I.trash}<span>Delete</span></button>`
        : `<button type="button" class="ios__tool" data-act="trash"${none}>${I.trash}<span>Delete</span></button>`;
    } else {
      bar.className = 'ios__bar';
      bar.innerHTML = `
        <button type="button" class="ios__tab${tab === 'recents' ? ' is-active' : ''}" data-tab="recents">${I.clock}<span>Recents</span></button>
        <button type="button" class="ios__tab${tab === 'browse' ? ' is-active' : ''}" data-tab="browse">${I.folderTab}<span>Browse</span></button>`;
    }
  }

  // ---- navigation ----
  const reset = () => { query = ''; selecting = false; picked.clear(); };
  const push = (screen) => { stack().push(screen); reset(); renderScreen('push'); };
  const pop = () => {
    if (stack().length < 2) return;
    stack().pop();
    reset();
    renderScreen('pop');
  };
  const goTo = (target) => {
    if (target === 'iphone' || target === 'deleted') push({ id: target });
    else if (target.startsWith('folder:')) push({ id: 'folder', name: target.slice(7) });
  };

  const openRow = (r) => {
    if (!r) return;
    if (r.kind === 'folder') { push({ id: 'folder', name: r.name }); return; }
    if (selecting) {
      if (picked.has(r.id)) picked.delete(r.id); else picked.add(r.id);
      renderContent();
    } else if (top().id !== 'deleted') {
      openNotepad(r.id);
    }
  };

  function finish(fn) {
    const ids = [...picked];
    picked.clear();
    selecting = false;
    ids.forEach(fn); // each call also fires fschange → re-render
    renderContent();
  }

  const ACTIONS = {
    back: pop,
    select: () => { selecting = true; picked.clear(); renderContent(); },
    done: () => { selecting = false; picked.clear(); renderContent(); },
    clear: () => { query = ''; ui.input.value = ''; renderContent(); ui.input.focus(); },
    new: newNote,
    trash: () => finish(deleteFile),
    recover: () => finish(restoreFile),
    purge: () => finish(purgeFile),
  };

  body.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      if (!act.disabled) ACTIONS[act.dataset.act]?.();
      return;
    }
    const goBtn = e.target.closest('[data-go]');
    if (goBtn) { goTo(goBtn.dataset.go); return; }
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      if (tabBtn.dataset.tab !== tab) tab = tabBtn.dataset.tab;
      else if (stack().length > 1) stack().splice(1); // re-tapping a tab pops to its root
      else return;
      reset();
      renderScreen(null);
      return;
    }
    const row = e.target.closest('.ios__row');
    if (row) openRow(items.find((r) => r.key === row.dataset.key));
  });
  body.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('ios__row')) {
      e.preventDefault();
      openRow(items.find((r) => r.key === e.target.dataset.key));
    }
  });

  document.addEventListener('fschange', renderContent);
  renderScreen(null);
  return () => document.removeEventListener('fschange', renderContent);
}

export const openFiles = singleWindow((onClose) => createGlassWindow({
  title: 'Files',
  className: 'files-window',
  width: 400,
  height: 660,
  onClose,
  mount,
}));
