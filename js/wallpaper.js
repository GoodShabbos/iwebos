// wallpaper.js — desktop background + switcher.

const DEFAULT_WALLPAPER = './assets/wallpapers/background.jpg';

export function setWallpaper(src = DEFAULT_WALLPAPER) {
  const body = document.body;
  body.style.backgroundImage = `url("${src}")`;
  body.style.backgroundSize = 'cover';
  body.style.backgroundPosition = 'center';
  body.style.backgroundRepeat = 'no-repeat';
  body.style.backgroundAttachment = 'fixed';
  body.style.minHeight = '100vh';
}

export function renderWallpaper(rootEl) {
  // TODO (later pass): render a dedicated wallpaper layer inside the OS root
  // once the shell exists; for now apply directly to the body canvas.
  setWallpaper();
}

// Apply the default wallpaper as soon as the module loads (before shell boot).
setWallpaper();