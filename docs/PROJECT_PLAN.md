# iWebOS Project Plan

Built for the [Hack Club webOS batch](https://jams.hackclub.com/batch/webOS) — a fake desktop experience recreating the iPhone **Liquid Glass** style, in plain HTML/CSS/JS. No frameworks, no build step.

## Design direction

- **Liquid Glass surfaces**: layered `backdrop-filter: blur() saturate()`, translucent fills, specular edge highlights, soft shadows — like iOS/iPadOS "glass" panels over the wallpaper.
- The wallpaper always shows through: windows, top bar, dock are all translucent.
- Keep content readable: dark text-shadows / contrast layering above glass.

## Batch coverage → files

| Jam part | Requirement | Where it will live |
| --- | --- | --- |
| Part 1 | Welcome screen (personal content: headings, text, image, links) | `js/apps/welcome.js` |
| Part 2 | Desktop + top bar with live clock | `js/topbar.js`, `js/wallpaper.js`, `js/desktop.js` |
| Part 3 | Window: draggable, closable, openable | `js/window-manager.js` |
| Part 4 | First app, content array + selection list | `js/apps/notes.js` |
| Part 5 | Advanced self-directed app | `js/apps/photos.js` (+ extras below) |

## Beyond the batch (to sell the "iPhone OS" feel)

- Boot splash → lock screen → desktop unlock flow (`styles/lockscreen.css`, `js/lockscreen.js`)
- Dock at the bottom with app icons (`js/desktop.js`, `.desktop__dock`)
- App registry so adding a new app = one manifest object (`js/registry.js`, `js/apps/*.js`)
- Settings app: live wallpaper switch + glass intensity slider (`js/apps/settings.js`)
- Terminal, Music, Browser, Arcade bonus apps (`js/apps/*.js`)

## Milestone ordering (suggested build order)

1. Boot splash + lock screen shell
2. Wallpaper + top bar + ticking clock
3. Window manager (drag/close/open/focus/resize)
4. Registry + desktop icons + dock
5. Welcome app content (Part 1)
6. Notes app (Part 4 pattern)
7. Photos / advanced app (Part 5)
8. Settings, Terminal, Music, Browser, Arcade
9. Glass styling pass over everything (last, once layouts are correct)

## How to run

Serve over http (ES modules don't load from `file://`):

```powershell
npx serve .        # or: python -m http.server 8000
```