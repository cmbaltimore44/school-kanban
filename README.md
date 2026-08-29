# School Kanban

A clean, minimal desktop kanban board for tracking school assignments, built with Electron, HTML, CSS, and JavaScript.

## Features

- Three columns: To Do, In Progress, Done — drag and drop cards between them
- Tag assignments with classes, each with a color (pick a preset or a custom color)
- Due dates with overdue/soon-due highlighting
- Priority levels, notes, search, and filter by class
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
   This produces an updated `School Kanban.app` and `.dmg` in `dist/`.
3. Open the new `.dmg` and drag `School Kanban.app` into `Applications` again to replace the old version (your assignment data is stored separately and won't be lost).
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
| `renderer.js` | App logic: tasks, classes, filtering, drag-and-drop, persistence |
