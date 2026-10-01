// apps/about.js — "About This OS" app.
// TODO: OS version, credits, tech stack.

export const aboutApp = {
  id: 'about',
  name: 'About',
  icon: null,
  window: { width: 340, height: 240, x: 240, y: 160 },
  mount(root) {
    root.innerHTML = '';
    // TODO: about content
  },
};