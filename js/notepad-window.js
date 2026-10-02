// notepad-window.js — the Notepad app, styled after the iPhone's Notes: a
// "‹ Files" back button, centered date, large bold title, a plain writing
// area, a bottom toolbar and a yellow "Done" that saves. It still edits
// Markdown (Edit / Preview) and saves into the pretend file system (fs.js),
// so notes show up in Files — and vanish on reload.

import { createGlassWindow } from './glass-window.js';
import { renderMarkdown } from './markdown.js';
import { getFile, saveFile } from './fs.js';

const open = []; // { id, win } for every open notepad, oldest first

const svg = (body) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  back: svg('<path d="M15 4.5L7.5 12l7.5 7.5" stroke-width="2.6"/>'),
  list: svg('<circle cx="5" cy="7" r="1.2" fill="currentColor"/><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="17" r="1.2" fill="currentColor"/><path d="M9.5 7H20M9.5 12H20M9.5 17H20"/>'),
  compose: svg('<path d="M11 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5v-4"/><path d="M17.5 3.8a1.9 1.9 0 0 1 2.700 2.700L12 14.700 8.500 15.500l.8-3.500Z"/>'),
};

const dateText = (ms) => new Date(ms).toLocaleString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
}).replace(/(\d{4}),? (?:at )?/, '$1 at '); // "October 2, 2026 at 2:05 PM"

function mount(body, entry) {
  const saved = entry.id ? getFile(entry.id) : null;
  body.innerHTML = `
    <div class="ios np">
      <header class="ios__nav">
        <div class="ios__nav-left"><button type="button" class="ios__back" data-act="files">${ICONS.back}<span>Files</span></button></div>
        <div class="np__seg" role="radiogroup" aria-label="View">
          <button type="button" role="radio" data-view="edit">Edit</button>
          <button type="button" role="radio" data-view="preview">Preview</button>
        </div>
        <div class="ios__nav-right"><button type="button" class="ios__text-btn is-bold np__done" data-act="done">Done</button></div>
      </header>
      <div class="np__page">
        <p class="np__date"></p>
        <input class="np__title" type="text" spellcheck="false" maxlength="60" placeholder="Title" aria-label="Note title">
        <textarea class="np__editor" spellcheck="false" aria-label="Note" placeholder="Start writing…  Markdown works: # heading, **bold**, - list"></textarea>
        <div class="np__preview md" aria-label="Preview"></div>
      </div>
      <div class="np__toolbar">
        <button type="button" class="np__tool" data-fmt="heading" aria-label="Heading"><span class="np__aa">Aa</span></button>
        <button type="button" class="np__tool" data-fmt="bold" aria-label="Bold"><b>B</b></button>
        <button type="button" class="np__tool" data-fmt="list" aria-label="Bulleted list">${ICONS.list}</button>
        <span class="np__spacer"></span>
        <button type="button" class="np__tool" data-act="compose" aria-label="New note">${ICONS.compose}</button>
      </div>
    </div>`;

  const q = (s) => body.querySelector(s);
  const titleEl = q('.np__title');
  const editor = q('.np__editor');
  const preview = q('.np__preview');
  const page = q('.np__page');
  const dateEl = q('.np__date');
  const doneBtn = q('.np__done');

  titleEl.value = saved ? saved.name : 'Untitled.md';
  editor.value = saved ? saved.content : '';
  let savedName = saved ? saved.name : null;
  let savedContent = saved ? saved.content : null;
  dateEl.textContent = dateText(saved ? saved.modified : Date.now());

  const refreshPreview = () => {
    preview.innerHTML = editor.value.trim()
      ? renderMarkdown(editor.value)
      : '<p class="np__hint">Nothing to preview yet.</p>';
  };
  // Done is yellow when there is something to save, grey once it's saved.
  const refreshDone = () => {
    doneBtn.disabled = savedContent !== null && editor.value === savedContent && titleEl.value === savedName;
  };

  let raf = 0;
  editor.addEventListener('input', () => {
    refreshDone();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(refreshPreview);
  });
  titleEl.addEventListener('input', refreshDone);
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); editor.focus(); }
  });

  const save = () => {
    const file = saveFile({ id: entry.id, name: titleEl.value, content: editor.value });
    entry.id = file.id;
    titleEl.value = file.name;
    savedName = file.name;
    savedContent = file.content;
    dateEl.textContent = dateText(file.modified);
    refreshDone();
  };

  // ---- Edit / Preview ----
  const segButtons = [...body.querySelectorAll('.np__seg [data-view]')];
  const setView = (view) => {
    page.dataset.view = view;
    for (const b of segButtons) {
      const on = b.dataset.view === view;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    }
    if (view === 'edit') editor.focus();
  };
  for (const b of segButtons) b.addEventListener('click', () => setView(b.dataset.view));

  // ---- bottom toolbar: small Markdown helpers ----
  const prefixLine = (prefix) => {
    const start = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
    const has = editor.value.startsWith(prefix, start);
    editor.setRangeText(has ? '' : prefix, start, has ? start + prefix.length : start, 'preserve');
  };
  const FORMAT = {
    heading: () => prefixLine('# '),
    list: () => prefixLine('- '),
    bold: () => {
      const { selectionStart: a, selectionEnd: b } = editor;
      editor.setRangeText(`**${editor.value.slice(a, b)}**`, a, b, 'end');
      if (a === b) editor.setSelectionRange(a + 2, a + 2);
    },
  };

  body.addEventListener('click', (e) => {
    const fmt = e.target.closest('[data-fmt]');
    if (fmt) {
      setView('edit');
      FORMAT[fmt.dataset.fmt]();
      editor.focus();
      editor.dispatchEvent(new Event('input'));
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'done') save();
    else if (act === 'compose') newNote();
    else if (act === 'files') document.dispatchEvent(new CustomEvent('app-launch', { detail: { id: 'files' } }));
  });

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

  setView('edit');
  refreshPreview();
  refreshDone();
  requestAnimationFrame(() => editor.focus());
}

/** Open a new notepad (blank, or showing `fileId`). */
function create(fileId) {
  const entry = { id: fileId, win: null };
  entry.win = createGlassWindow({
    title: 'Notes',
    className: 'notepad-window',
    width: 420,
    height: 640,
    onClose: () => open.splice(open.indexOf(entry), 1),
    mount: (body) => mount(body, entry),
  });
  open.push(entry);
  return entry;
}

/**
 * Taskbar click: focus the newest notepad, or open a blank one.
 * With a fileId (from Files): focus that file's notepad, or open it.
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
