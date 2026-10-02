// fs.js — the pretend file system. Everything lives in memory only, so it all
// disappears on reload (that's the point: it's a make-believe OS).

export const FOLDERS = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'];
export const DEFAULT_FOLDER = 'Documents';

const files = new Map(); // id → { id, name, content, modified, folder }
let seq = 0;

const emit = () => document.dispatchEvent(new CustomEvent('fschange'));

function cleanName(raw) {
  let name = String(raw ?? '').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60);
  if (!name) name = 'Untitled';
  if (!name.includes('.')) name += '.md';
  return name;
}

// "Notes.md" → "Notes 2.md" when another file already has the name.
function uniqueName(name, selfId, folder) {
  const taken = new Set([...files.values()]
    .filter((f) => f.id !== selfId && f.folder === folder && !f.deleted)
    .map((f) => f.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${stem} ${n}${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Files in `folder` (or everywhere). `deleted` lists Recently Deleted instead. */
export function listFiles(folder, deleted = false) {
  return [...files.values()].filter((f) => (!folder || f.folder === folder) && !!f.deleted === deleted).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function getFile(id) {
  return files.get(id) ?? null;
}

/** Create or update a file; a missing/deleted id creates a new one. */
export function saveFile({ id, name, content, folder }) {
  let existing = id ? files.get(id) : null;
  if (existing?.deleted) existing = null; // a deleted file saves as a new one
  const fileId = existing ? existing.id : `f${++seq}`;
  const where = existing ? existing.folder : (folder || DEFAULT_FOLDER);
  const file = {
    id: fileId,
    folder: where,
    name: uniqueName(cleanName(name), fileId, where),
    content: String(content ?? ''),
    modified: Date.now(),
  };
  files.set(fileId, file);
  emit();
  return file;
}

/** Delete moves a file to Recently Deleted (like iOS); purgeFile removes it for good. */
export function deleteFile(id) {
  const f = files.get(id);
  if (f && !f.deleted) {
    f.deleted = Date.now();
    emit();
  }
}

export function restoreFile(id) {
  const f = files.get(id);
  if (f?.deleted) {
    delete f.deleted;
    f.name = uniqueName(f.name, f.id, f.folder);
    emit();
  }
}

export function purgeFile(id) {
  if (files.delete(id)) emit();
}

export function sizeOf(file) {
  return new TextEncoder().encode(file.content).length;
}
