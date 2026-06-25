# Decova

Chrome extension (Manifest V3) for capturing UI components from any webpage into a personal design library.

## Features

- **Capture Mode** — DOM picker with custom crosshair cursor, hover highlights, hierarchy navigation (↑/↓), multi-select, and full HTML + CSS extraction
- **Extension popup** — starts Capture Mode on the active tab
- **Preview panel** — review, configure save options, and organize captures into collections
- **Dashboard** — Decova library UI with clips grid, collections, tags, filters, and bulk actions

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension` folder

## Usage

1. Visit any webpage (not `chrome://` pages)
2. Click the Decova toolbar icon → **Capture**
3. Hover to inspect elements, click to select (multiple allowed)
4. Click **Capture →** in the action bar
5. Configure and confirm in the preview panel
6. View clips in the dashboard (gear icon)

## Project structure

```
extension/
  content/capture/     # Capture Mode modules
  content/content.js   # Panel injection + messaging
  popup/
  panel/
  dashboard/
  shared/
```

## Capture Mode controls

| Input | Action |
|---|---|
| Hover | Highlight element under cursor |
| Click | Select / deselect element |
| ↑ / ↓ or scroll | Parent / child in DOM hierarchy |
| Alt + hover | Jump to nearest section |
| Escape | Exit Capture Mode |
