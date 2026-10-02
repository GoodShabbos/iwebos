// notepad-window.js — the Notepad app: a Markdown editor with live preview,
// built on the shared glass window. Notes save into the pretend file system
// (fs.js), so they show up in the File Explorer — and vanish on reload.

import { createGlassWindow } from './glass-window.js';
import { renderMarkdown } from './markdown.js';
import { getFile, saveFile } from './fs.js';

const open = []; // { id, win } for every open notepad, oldest first

function mount(body, entry) {
  const saved = entry.id ? getFile(entry.id) : null;
  body.innerHTML = `
    <div class="notepad__toolbar">
      <input class="notepad__name" type="text" spellcheck="false" maxlength="60" aria-label="File name">
      <div class="settings__segmented notepad__view" role="radiogroup" aria-label="View">
        <button type="button" role="radio" data-view="edit">Edit</button>
        <button type="button" role="radio" data-view="split">Split</button>
        <button type="button" role="radio" data-view="preview">Preview</button>
      </div>
      <span class="notepad__status" aria-live="polite"></span>
      <button class="glass-button notepad__save" type="button">Save</button>
    </div>
    <div class="notepad__panes" data-view="split">
      <textarea class="notepad__editor" spellcheck="false" aria-label="Markdown editor"
        placeholder="Write some Markdown…  # Heading, **bold**, *italic*, - lists"></textarea>
      <div class="notepad__preview md" aria-label="Preview"></div>
    </div>`;

  const nameEl = body.querySelector('.notepad__name');
  const editor = body.querySelector('.notepad__editor');
  const preview = body.querySelector('.notepad__preview');
  const panes = body.querySelector('.notepad__panes');
  const status = body.querySelector('.notepad__status');

  nameEl.value = saved ? saved.name : 'Untitled.md';
  editor.value = saved ? saved.content : '';
  let savedName = saved ? saved.name : null;
  let savedContent = saved ? saved.content : null;

  const refreshPreview = () => {
    preview.innerHTML = editor.value.trim()
      ? renderMarkdown(editor.value)
      : '<p class="notepad__hint">Nothing to preview yet.</p>';
  };
  const refreshStatus = () => {
    const dirty = savedContent === null || editor.value !== savedContent || nameEl.value !== savedName;
    status.textContent = dirty ? (savedContent === null ? 'Not saved' : 'Unsaved changes') : 'Saved';
    status.classList.toggle('is-dirty', dirty);
  };

  let raf = 0;
  editor.addEventListener('input', () => {
    refreshStatus();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(refreshPreview);
  });
  nameEl.addEventListener('input', refreshStatus);

  const save = () => {
    const file = saveFile({ id: entry.id, name: nameEl.value, content: editor.value });
    entry.id = file.id;
    nameEl.value = file.name;
    savedName = file.name;
    savedContent = file.content;
    refreshStatus();
  };
  body.querySelector('.notepad__save').addEventListener('click', save);
  body.closest('.glass-window').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });

  // Tab inserts spaces instead of leaving the editor
  editor.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input'));
  });

  const viewButtons = [...body.querySelectorAll('[data-view]')].filter((b) => b.tagName === 'BUTTON');
  const setView = (view) => {
    panes.dataset.view = view;
    for (const b of viewButtons) {
      const on = b.dataset.view === view;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-checked', String(on));
    }
  };
  for (const b of viewButtons) b.addEventListener('click', () => setView(b.dataset.view));
  setView('split');

  refreshPreview();
  refreshStatus();
  requestAnimationFrame(() => editor.focus());
}

/** Open a new notepad (blank, or showing `fileId`). */
function create(fileId) {
  const entry = { id: fileId, win: null };
  entry.win = createGlassWindow({
    title: 'Notepad',
    className: 'notepad-window',
    width: 780,
    height: 520,
    onClose: () => open.splice(open.indexOf(entry), 1),
    mount: (body) => mount(body, entry),
  });
  open.push(entry);
  return entry;
}

/**
 * Taskbar click: focus the newest notepad, or open a blank one.
 * With a fileId (from the File Explorer): focus that file's notepad, or open it.
 */
export function openNotepad(fileId = null) {
  const match = fileId ? open.find((e) => e.id === fileId) : open[open.length - 1];
  if (match) match.win.focus();
  else create(fileId);
}

/** Always open a fresh blank note. */
export function newNote() {
  create(null);
}
