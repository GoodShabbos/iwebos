// apps/terminal.js — fun terminal with fake commands.
// TODO: command input, output log, command handlers (help, about, clear…).

export const terminalApp = {
  id: 'terminal',
  name: 'Terminal',
  icon: null,
  window: { width: 560, height: 360, x: 320, y: 180 },
  mount(root) {
    root.innerHTML = '';
    // TODO: output log + input line
  },
};