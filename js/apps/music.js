// apps/music.js — fake music player UI.
// TODO: playlist data, play/pause state, progress bar (visual only).

export const musicApp = {
  id: 'music',
  name: 'Music',
  icon: null,
  window: { width: 400, height: 420, x: 360, y: 120 },
  mount(root) {
    root.innerHTML = '';
    // TODO: album art, track list, transport controls
  },
};