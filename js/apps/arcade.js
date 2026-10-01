// apps/arcade.js — mini-game app.
// TODO: pick a game (e.g. snake / pong) on canvas.

export const arcadeApp = {
  id: 'arcade',
  name: 'Arcade',
  icon: null,
  window: { width: 480, height: 520, x: 440, y: 160 },
  mount(root) {
    root.innerHTML = '';
    // TODO: canvas + game loop
  },
};