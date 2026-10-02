# iWebOS 🧊

A fake desktop experience that recreates the iPhone's **Liquid Glass** aesthetic in the web — glass windows, translucent top bar, frosted dock, and a wallpaper that refracts through every surface.

Built for the [Hack Club webOS batch](https://jams.hackclub.com/batch/webOS) — **plain HTML, CSS & JS**, no frameworks, no build step.

## Run it

Open `index.html` in a browser, or serve the folder for a proper web feel:

```powershell
npx serve .        # or: python -m http.server 8000
```

> NOTE: the app uses ES modules (`type="module"`) — do **not** serve over `file://` without a local server (module CORS will block loading). `npx serve` is the easiest on this Windows machine.

## Features

- **Boot splash** with glass progress bar
- **Lock screen → desktop** unlock flow
- **Liquid glass surfaces** — layered `backdrop-filter` blur, specular edge highlights, refraction tint (see `styles/glass.css`)
- **Top bar** (`menu-bar`): OS name, date/time (ticking ⏰), status pills
- **Windows**: draggable by the handle, closable, openable, z-index focus stacking, resizable from the corner
- **Dock** with app icons, labels, and launch handling
- **Apps**: Welcome (about me), Notes (content-selection data pattern from Part 4), Photos, Terminal, About, Settings (glass intensity + wallpaper switch), Music, Browser (iframe), Arcade (mini-game), About This OS
- **Wallpaper switcher** (multiple gradients/images in `assets/wallpapers/`)

### Adding wallpapers

The wallpaper cycler discovers numbered files automatically; no code edit is needed. Use consecutive names such as `light_mode_background-3.jpg` or `dark_mode_background-3.webp` in `assets/wallpapers/`. Supported extensions are `.jpg`, `.jpeg`, `.png`, and `.webp`.

## Structure

```
iWebOS/
├── index.html               # single-page shell + script/style wiring
├── assets/
│   ├── wallpapers/          # desktop backgrounds (drop your own here)
│   ├── app-icons/           # icons for each app (SVG or PNG)
│   └── fonts/               # (optional) custom fonts — system stack used by default
├── styles/
│   ├── globals.css          # reset, CSS variables, body + boot splash
│   ├── glass.css            # ★ liquid-glass surface system
│   ├── desktop.css          # desktop area, top bar, dock
│   ├── windows.css          # window frame, header, traffic lights, resize grip
│   ├── app-icons.css        # icon grid + labels + selected state
│   ├── apps.css             # app internals (notes list, photos grid, terminal…)
│   └── lockscreen.css       # lock screen + boot splash
├── js/
│   ├── main.js              # boots: locks → unlocks → renders shell
│   ├── wallpaper.js         # wallpaper rendering + switching
│   ├── topbar.js            # clock, status pills, OS name
│   ├── desktop.js           # desktop area: icons grid + dock
│   ├── lockscreen.js        # lock/unlock flow
│   ├── window-manager.js    # spawn/drag/close/resize/focus/open windows
│   ├── registry.js          # app registry (id, name, icon, window config, mount fn)
│   └── apps/
│       ├── welcome.js       # Part 1 — the welcome "who I am" app
│       ├── notes.js         # Part 4 — content array + sidebar selection
│       ├── photos.js        # Part 5 — advanced app: photo grid + lightbox
│       ├── terminal.js      # fun terminal with fake commands
│       ├── about.js         # about this OS
│       ├── settings.js      # live glass tuning + wallpaper picker
│       ├── music.js         # fake music player UI
│       ├── browser.js       # fake browser (iframe sandbox)
│       └── arcade.js        # mini-game
├── docs/PROJECT_PLAN.md     # roadmap covering every jam part
└── README.md
```

## Design notes

The glass system in `styles/glass.css` is the heart of the "iPhone on the web" feel:

- `.glass` — base surface: translucency + `backdrop-filter: blur()` + saturation boost
- `.glass--panel` — thick specular panels (windows)
- `.glass--bar` — thin bars (top bar, dock)
- `.glass--chrome` — buttons/controls, plus `.glass--reflect` for a specular top-edge highlight

Everything layers so the wallpaper shows through with a soft refraction tint, just like the real thing.

## License

MIT — have fun remixing your own OS 🧊