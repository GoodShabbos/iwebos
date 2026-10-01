// apps/browser.js — fake browser (iframe sandbox).
// TODO: URL bar + iframe viewport.

export const browserApp = {
  id: 'browser',
  name: 'Browser',
  icon: null,
  window: { width: 640, height: 480, x: 400, y: 140 },
  mount(root) {
    root.innerHTML = '';
    // TODO: url bar + <iframe>
  },
};