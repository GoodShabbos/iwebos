// apps/notes.js — Part 4: first app. Content stored as an array of objects,
// programmatically displayed + selectable via a sidebar.
// TODO: notes data array, sidebar population, setNotesContent.

export const notesApp = {
  id: 'notes',
  name: 'Notes',
  icon: null,
  window: { width: 520, height: 480, x: 160, y: 120 },
  mount(root) {
    root.innerHTML = '';
    // TODO: sidebar + content area; render from data below
    // const notes = [{ title, date, content: `...html...` }]
  },
};