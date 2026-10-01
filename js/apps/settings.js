// apps/settings.js — live OS settings (glass intensity, wallpaper picker).
// TODO: wallpaper switcher, glass blur toggle, other prefs.

export const settingsApp = {
  id: 'settings',
  name: 'Settings',
  icon: null,
  window: { width: 420, height: 380, x: 280, y: 100 },
  mount(root) {
    root.innerHTML = '';
    // TODO: wallpaper picker + glass intensity slider
  },
};