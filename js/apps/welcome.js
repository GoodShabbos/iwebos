// apps/welcome.js — Part 1: the welcome screen / "who I am" app.
// TODO: personal intro content (headings, text, image, links).

export const welcomeApp = {
  id: 'welcome',
  name: 'Welcome',
  icon: null, // TODO: path to assets/app-icons/welcome.png
  window: { width: 360, height: 280, x: 120, y: 80 },
  mount(root) {
    root.innerHTML = '';
    // TODO: build welcome content
  },
};