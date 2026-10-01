# Start Panel

A lightweight Opera extension with a configurable speed dial, folders, and a grid that uses the full browser width. Built with native JavaScript, HTML, CSS, and Manifest V3. No build step or runtime dependencies.

## Used Tools and Versions

To run:
- JavaScript ES2022
- HTML5
- CSS
- Opera extension standard: Manifest V3
- Windows 11

Also to test:
- Node.js 24.19.0
- Playwright 1.62.1
- Test browser: Chromium 151.0.7922.34

## Install

1. Open `opera://extensions` in Opera.
2. Enable **Developer mode** and choose **Load unpacked**.
3. Select this `start_panel` directory, which contains `manifest.json`.
4. Pin **Start Panel** in the extensions menu and click its icon.

See [installation_manual.md](installation_manual.md) for the complete Windows installation guide, new-tab setup and compatibility notes, daily use, backup, updates, troubleshooting, and development checks.

## Features

- Full-width CSS Grid: no hard-coded maximum column count.
- Three tile sizes; rounded cards; light, dark, and system themes.
- Add, edit, remove, and reorder shortcuts with custom names, addresses, and colors.
- Named folders with shortcut previews; select existing shortcuts to group them.
- Move shortcuts between folders and Speed dial; ungroup folders without deleting their contents.
- Search names and addresses, including shortcuts inside folders.
- Keyboard-accessible dialogs, selection, and reordering; reduced-motion support.
- Local persistent storage, synchronization between open panels, and stale-edit protection.
- JSON backup export and validated import with a replacement confirmation.
- Toolbar button, configurable keyboard command, standard new-tab override, and an Opera start-page redirect preference.

Icons are colored initials rendered locally. There are no favicon services, remote fonts, trackers, advertisements, or automatic requests to saved websites.

## Layout

```text
start_panel/
    assets/                 Extension PNG icons
    src/
        main.js             Main page logic
        start_page.html     Single-page interface
        styles.css          Responsive layout and themes
        model.js            Validation and immutable operations
        background.js       Storage writes and browser entry points
        tests/              Node tests and optional browser checks
        tools/              Reproducible icon generator
    manifest.json           Required extension metadata
    package.json            Optional development commands
    installation_manual.md
    readme.md
```

All source code, including tests and tooling, is in `src`; image assets are in `assets`. The browser requires `manifest.json` at the extension root. Browser-defined manifest/API names retain their required spellings. The local Git repository uses `dev` as its main branch.

## Development

Installation needs only Opera. To run unit tests, use Node.js 22 or newer:

```powershell
node --test src/tests/model_test.js src/tests/background_test.js
```

There are no production dependencies to install. See the manual for the optional Playwright checks and their separate test-browser setup.
