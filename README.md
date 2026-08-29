# Task Kanban

A clean, minimal desktop kanban board for tracking tasks, built with Electron, HTML, CSS, and JavaScript.

## Features

- Three columns: To Do, In Progress, Done — drag and drop cards between them
- Tag tasks with categories, each with a color (pick a preset or a custom color)
- Reorder categories by dragging them in the category manager
- Due dates with overdue/soon-due highlighting
- Priority levels, notes, search, and filter by category
- Light/dark mode toggle
- All data is stored locally on your machine (no accounts, no network)

## Running in development

```bash
npm install
npm start
```

## Updating the code

After making changes to `main.js`, `preload.js`, `index.html`, `style.css`, or `renderer.js`:

1. Run `npm start` to try the change in dev mode.
2. When you're happy with it, rebuild the installable app:
   ```bash
   npm run dist
   ```
   This produces an updated `Task Kanban.app` and `.dmg` in `dist/`.
3. Open the new `.dmg` and drag `Task Kanban.app` into `Applications` again to replace the old version (your task data is stored separately and won't be lost).
4. Commit your changes:
   ```bash
   git add -A
   git commit -m "Describe your change"
   git push
   ```

## Project structure

| File | Purpose |
|---|---|
| `main.js` | Electron main process — creates the app window |
| `preload.js` | Isolated preload script (no privileged APIs currently exposed) |
| `index.html` | App layout and modals |
| `style.css` | Styling, including light/dark theme variables |
| `renderer.js` | App logic: tasks, categories, filtering, drag-and-drop, persistence |
| `build/icon.icns` | App icon used by the packaged `.app`/`.dmg` |
| `build/icon.png` | Same icon, used for the Dock icon while running in dev mode |

## Changing the app icon

`build/icon.icns` (packaging) and `build/icon.png` (dev Dock icon) are generated from `scripts/icon-source.html`, a plain HTML/CSS/SVG file. To tweak the design:

1. Edit `scripts/icon-source.html`.
2. Re-render it to a 1024×1024 PNG:
   ```bash
   ./node_modules/.bin/electron scripts/generate-icon.js
   ```
3. Rebuild the `.icns` and dev PNG from that master image:
   ```bash
   cd build
   rm -rf icon.iconset
   mkdir icon.iconset
   sips -z 16 16 icon-source.png     --out icon.iconset/icon_16x16.png
   sips -z 32 32 icon-source.png     --out icon.iconset/icon_16x16@2x.png
   sips -z 32 32 icon-source.png     --out icon.iconset/icon_32x32.png
   sips -z 64 64 icon-source.png     --out icon.iconset/icon_32x32@2x.png
   sips -z 128 128 icon-source.png   --out icon.iconset/icon_128x128.png
   sips -z 256 256 icon-source.png   --out icon.iconset/icon_128x128@2x.png
   sips -z 256 256 icon-source.png   --out icon.iconset/icon_256x256.png
   sips -z 512 512 icon-source.png   --out icon.iconset/icon_256x256@2x.png
   sips -z 512 512 icon-source.png   --out icon.iconset/icon_512x512.png
   cp icon-source.png icon.iconset/icon_512x512@2x.png
   iconutil -c icns icon.iconset -o icon.icns
   sips -s format png icon.icns --out icon.png && sips -z 512 512 icon.png --out icon.png
   rm -rf icon.iconset icon-source.png
   cd ..
   ```
4. Run `npm run dist` to rebuild the app with the new icon.
