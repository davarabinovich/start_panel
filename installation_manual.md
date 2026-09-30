# Start Panel: Windows installation and user manual

## 1. What you are installing

Start Panel is a single-page browser extension for desktop Opera. Its tiles open websites, and its folder tiles open a collection of shortcuts on the same page. Its grid expands to use the browser width instead of stopping at a fixed number of columns.

The extension uses native HTML, CSS, and JavaScript. There is no compilation, bundler, application server, native Windows helper, or production library to install. A Manifest V3 service worker handles events and saves; it is not a permanently running background program.

This is an independent extension, not an Opera product. Existing Opera bookmarks and Speed Dial entries are separate and are not changed or automatically imported.

## 2. Files and prerequisites

Use a current desktop Opera release on Windows with Manifest V3 support. The interface uses native dialogs, popovers, CSS Grid, and JavaScript modules. Older Opera releases may lack these features.

The prepared source directory on this computer is:

```text
C:\Users\izyak\Documents\Pet\StartPanel\start_panel
```

It must contain `manifest.json`, `src`, and `assets`. The four icon PNGs are already included. You do not need Node.js, npm, Git, or any compiler to load this prepared source into Opera.

If transferring the project to another machine, copy the complete `start_panel` directory to a permanent location. Do not select `src` as the extension root. A ZIP archive must first be extracted.

Keep the source directory in place after installation: an unpacked extension runs directly from those files. Moving or deleting it can break the extension. To move it safely, export a backup first, load the new location, and import that backup if necessary.

## 3. Install directly from source

1. Open Opera.
2. Enter `opera://extensions` in the address bar and press Enter. The Windows shortcut **Ctrl+Shift+E** also opens the extension manager.
3. Turn on **Developer mode**, usually near the top right.
4. Click **Load unpacked** or **Load unpacked extension**; wording varies by Opera release.
5. In the folder chooser, select:

   ```text
   C:\Users\izyak\Documents\Pet\StartPanel\start_panel
   ```

6. Confirm the folder selection. A **Start Panel** extension card should appear and be enabled.
7. Open Opera's extensions menu near the address bar. Pin Start Panel if your version offers a pin control.
8. Click the Start Panel icon: a purple rounded square containing four white squares. The page opens in a normal tab.
9. Add a test shortcut, close the panel tab, and open it again. The shortcut should remain.

The official Opera instructions describe loading unpacked extensions and using Reload during development: [Opera: Testing and Debugging](https://help.opera.com/en/extensions/testing/).

Developer-mode notices are normal for unpacked extensions. Installing from source does not publish anything to the Opera add-ons store. Do not use **Pack extension** for this installation; loading the source folder is sufficient.

## 4. Open the panel and configure startup

### Reliable entry points

- Click the pinned toolbar icon.
- Use **Alt+Shift+S**, provided another shortcut has not taken it.
- Open Start Panel's **Options** from its extension card.
- Bookmark the panel's own address after opening it.

You can change the shortcut in Opera's extension keyboard-shortcut settings, usually available at `opera://extensions/shortcuts`. If that address is unavailable, use the extension manager's keyboard shortcuts menu. The browser or another application may reserve a key combination.

The panel address has this form:

```text
chrome-extension://YOUR_EXTENSION_ID/src/start_page.html
```

Use the actual address from your panel tab, or the ID shown on its extension card. The `chrome-extension` prefix is normal in Chromium-based Opera. Do not literally enter `YOUR_EXTENSION_ID`.

### New tabs and Opera's native start page

Start Panel declares Chromium's standard new-tab override and also contains a narrowly scoped redirect for browser start-page addresses. The redirect is enabled initially and can be toggled under **Customize → Open Start Panel on Opera's start page**.

Opera does not consistently expose the same new-tab replacement behavior as Chrome. Do not assume that declaring a new-tab override guarantees that every Opera edition replaces its built-in Speed Dial. Automatic replacement must be checked in your installed Opera version.

After installing:

1. Open a fresh tab with **Ctrl+T** or the plus button.
2. Check whether Start Panel opens.
3. If Opera still shows its own start page, verify that the Start Panel redirect preference is enabled and reload the extension once.
4. Test again with a new tab. If replacement is still blocked, use the toolbar, shortcut, bookmark, or startup-page method below. The panel itself remains usable.

The redirect only recognizes `opera://` and `chrome://` addresses whose host is exactly `startpage`, `startpageshared`, or `newtab`. It does not redirect web pages, settings, extension pages, or generic `about:blank` tabs. It rechecks the current tab before navigating, including any pending URL, to avoid replacing a website being opened.

Because the Opera workaround is a navigation, a brief native-start-page flash and the extension address remaining in the address bar are possible. New-tab replacement is not claimed to be verified in Opera on this machine. A separate test browser validates the extension page and Chromium new-tab behavior; see `verification_report.md` for the recorded results.

In browsers that honor `chrome_url_overrides`, the manifest override remains active while the extension is enabled. The Customize checkbox controls the additional redirect only. To restore that browser's own new-tab page, disable the extension, or remove the `chrome_url_overrides` object from `manifest.json` and reload it. In Opera, turn off the checkbox first if you want to keep the panel available only through its toolbar or startup entry.

### Open Start Panel when Opera starts

1. Open the panel from the toolbar and copy its complete address.
2. Open Opera Settings, usually **Alt+P**, and find **On startup**. Searching Settings for “startup” is often quickest.
3. Choose the setting to open a specific page or set of pages, if available in your edition.
4. Add the copied panel address and save it.
5. Restart Opera to verify the result.

This changes browser startup behavior, not necessarily every new tab. If you prefer Opera to restore your previous tabs, keep that preference and pin a Start Panel tab instead.

## 5. Add and manage shortcuts

### Add a website

1. Click **Add shortcut** or the dashed **Add a shortcut** tile.
2. Enter a custom name, up to 80 characters.
3. Enter the website address. An omitted scheme becomes HTTPS: `example.com` becomes `https://example.com/`.
4. Choose **Speed dial** or an existing folder under **Location**.
5. Pick a tile color and click **Save shortcut**.

HTTP and HTTPS addresses are supported, including local network web servers. Specify `http://` explicitly if your local server does not use HTTPS. Executable addresses such as `javascript:`, local filesystem addresses, and URLs with embedded usernames/passwords are rejected.

The icon uses initials from your custom name and your chosen color. It is generated locally; it does not fetch favicons, thumbnails, or screenshots from websites. Duplicate website addresses are allowed, so one site can have shortcuts in several collections.

### Open, edit, or remove a website

- Click the tile to open its address. **Customize → Open shortcuts in a new tab** changes the default click behavior. Normal browser modifier-click and middle-click behavior remains available.
- Hover over a tile or focus it using Tab to reveal its three-dot action button.
- Choose **Edit shortcut** to change the name, address, color, or folder.
- Choose **Delete…** and confirm to remove the shortcut.

Changes are saved immediately after you press the relevant Save, Move, or confirmation button. There is no separate global Save action. Errors are shown if saving fails; failed writes do not replace the previous stored panel.

## 6. Create and manage folders

### Create an empty folder

On Speed dial, click **New folder**, provide a name and color, then **Save folder**. Click its tile to view its contents. The same responsive grid is used inside a folder.

### Combine existing shortcuts

1. Click **Organize**.
2. Select the desired shortcuts using their checkboxes or by clicking their tiles.
3. Choose **Create folder from selection**.
4. Enter a folder name and click **Save folder**.

The existing shortcuts move into the new folder. No duplicates are created. A new folder created from a selection is placed on the main Speed dial, including when the selection was made inside another folder.

### Add, move, or delete folder contents

- Inside a folder, **Add shortcut** selects that folder as the default destination.
- Use a shortcut's **Move to…** action, or select several shortcuts in Organize and click **Move to…**.
- Choose another folder or **Speed dial** as the destination.
- Delete individual shortcuts using their action menu, or select several and choose **Delete**.
- Use the back arrow beside the folder name to return to Speed dial. Escape also returns when no dialog or menu is open and the search field is empty.

Folders contain shortcuts, not other folders. To rename a folder or change its color, use **Edit folder** in its action menu. **Ungroup folder** moves the shortcuts back to Speed dial and removes only the container. **Delete…** removes the folder and its contents after a confirmation showing the affected shortcut count.

## 7. Arrangement, search, and appearance

### Responsive grid

Columns are calculated by CSS Grid from the available width. There is no fixed maximum number of columns, no fixed number of rows, and no centered container that caps the usable width. Tiles wrap as the window narrows; the page scrolls vertically when needed.

Default card faces are at least approximately 190 px wide and 132 px tall, with labels below. They grow slightly to share leftover row space. **Customize → Tile size** offers compact (156 × 106 px minimum), comfortable (190 × 132 px), and large (232 × 154 px) faces. Browser zoom also affects how many tiles fit.

The grid retains a linear tile order and reflows it into rows; it does not store absolute row/column coordinates that would break on another window size.

### Reorder

Drag a tile onto the left half of another tile to place it before that tile; use the right half to place it after. Dragging reorders within the current collection. To move into a folder, use **Move to…** or the Location field rather than dragging onto a folder.

For keyboard use, Tab to a tile's action button, press Enter, then use **Move earlier** or **Move later**. Folders can also be reordered. Reordering by drag is disabled while searching or selecting shortcuts.

### Search

Use **Find a shortcut** to filter by name or address. Press `/` from outside an input to focus search. On Speed dial, results include shortcuts inside folders and display the parent folder name. Inside a folder, search stays within that folder. Escape clears a nonempty search.

### Preferences

**Customize** provides Light, Dark, or Follow system appearance; tile size; default shortcut tab behavior; and the Opera redirect preference. Click **Save preferences** to apply them. Export always captures saved settings, not unsaved changes in the Customize dialog.

## 8. Data, backup, and recovery

Data is stored under `panelState` in `chrome.storage.local` for this extension and browser profile. It is not synced through an Opera account or sent to a server. Browser tabs viewing the panel receive updates when another panel saves a change.

If two tabs edit the panel at the same time, a stale save is rejected with a message. Review the updated tiles and your form, then save again. Writes are serialized by the service worker to prevent silent overwrites.

### Export

Open **Customize → Export backup**. Opera downloads a JSON file containing shortcut URLs, custom names, colors, folder membership, order, and saved preferences. Store it wherever you keep personal backups. The file contains your saved URLs in readable text.

### Import

1. Export your current panel first if you may want it later.
2. Open **Customize → Import backup** and choose a Start Panel JSON backup.
3. Review the replacement confirmation.
4. Click **Replace panel** to replace the current panel, or Cancel to keep it.

Import replaces rather than merges. Invalid JSON, unsupported schema versions, duplicate identifiers, unsupported settings, nested folders, and unsafe addresses are rejected. Import accepts files up to 8 MB to avoid accidentally loading extremely large files. The normal browser storage quota also applies; the absence of a grid column cap does not imply unlimited memory or disk space.

Deletion has no Undo command. A previous exported backup can restore the panel. Disabling and re-enabling normally retains extension storage. Uninstalling the extension removes its local data; export first. Loading from a different directory or profile may produce a different extension ID and a separate storage area.

If stored data becomes malformed, the extension reports the problem instead of silently resetting it. Before removing the extension, use its page's developer console to inspect or copy the existing value if possible:

```javascript
copy(JSON.stringify((await chrome.storage.local.get("panelState")).panelState, null, 4))
```

`copy` is a developer-console helper, not application code. Save the copied text before attempting a repair. Do not run storage-clearing commands unless you intend to discard the local panel.

## 9. Permissions and resource use

| Permission | Purpose |
| --- | --- |
| `storage` | Save shortcuts, folders, preferences, and their revision. |
| `tabs` | Inspect start-page tab URLs for the optional Opera redirect. |

The `tabs` permission can produce a browser warning about browsing information. Start Panel does not record browsing history, inspect page contents, inject content scripts, or transmit tab data. There are no host permissions. The extension's content security policy disallows network connections and remote scripts.

There is no polling timer, live clock, image downloading, background animation, framework runtime, or native helper. UI code runs when the panel is open; the service worker wakes for its registered extension and tab events. Rendering cost grows with the number of visible tiles, so very large collections are best split into folders. This implementation does not claim constant memory use or a measured performance advantage over Opera's native page.

## 10. Update, uninstall, and troubleshoot

### Reload after a source edit

1. Export a backup before substantial changes.
2. Edit the files in the same installed directory.
3. Open `opera://extensions` and click **Reload** on Start Panel.
4. Refresh any existing Start Panel tabs.

Reloading in place normally preserves local storage. Changing the manifest or service worker requires an extension reload, not just a page refresh.

### Common problems

| Symptom | Action |
| --- | --- |
| “Manifest missing” or folder will not load | Select `start_panel`, not its parent, `src`, or a ZIP file. Confirm `manifest.json` exists there. |
| Manifest V3 unsupported | Update Opera to a release that supports Manifest V3. This project does not include a legacy Manifest V2 build. |
| “Load this folder as an unpacked extension” message | Do not double-click the HTML file. Install the extension and use its toolbar icon. |
| New tabs still show Opera Speed Dial | Follow section 4; automatic replacement is browser-dependent. Use the toolbar or startup page if Opera blocks it. |
| Extension icon is not visible | Open the extensions menu, verify the extension is enabled, and pin it. |
| Shortcut does not work | Change its key binding in Opera; check for system or extension conflicts. |
| Another new-tab extension takes priority | Disable the conflicting extension temporarily, reload Start Panel, and test a new tab. |
| Save says the panel changed | Another panel has saved data. Review the form and current tiles, then retry. |
| Storage quota error | Export a backup, remove unneeded shortcuts, and retry. Do not uninstall before saving a backup. |
| A change does not appear | Reload the extension, then refresh its page. |
| Incorrect page after a URL click | Edit the shortcut and check its full address and HTTP/HTTPS scheme. |

For more detail, inspect errors on the Start Panel card at `opera://extensions`, open the service-worker inspector if available, or use **Ctrl+Shift+I** on the panel page. Record the error, Opera version, and reproduction steps.

To remove the extension: export a backup, open `opera://extensions`, and choose **Remove**. Restore any startup page or bookmark you configured separately. Removal does not delete the source directory or change Opera's own bookmarks.

## 11. Development and verification from source

All executable source files are under `src`. Assets are under `assets`. `manifest.json` is at the root because the extension platform requires that location. Names prescribed by the browser, JSON manifest format, CSS, HTML, and Node APIs retain their platform spellings.

The local Git repository is inside `start_panel` and uses `dev`. From PowerShell:

```powershell
Set-Location 'C:\Users\izyak\Documents\Pet\StartPanel\start_panel'
git branch --show-current
git status
```

No remote is configured by this project.

### Unit tests

Install or use Node.js 22 or newer for development only. From the repository directory:

```powershell
node --test src/tests/model_test.js src/tests/background_test.js
```

Tests cover URL safety, shortcut CRUD, grouping, moving, ungrouping, reordering, backup validation, large collections, start-page matching, serialized writes, stale revisions, storage failures, and redirect navigation guards. They use Node's built-in test runner, with no npm dependencies.

### Optional browser checks

`src/tests/browser_test.js` uses Playwright as a test-only dependency. The extension itself never imports it. Keep all downloaded tooling in the parent project directory:

```powershell
Set-Location 'C:\Users\izyak\Documents\Pet\StartPanel'
npm install --prefix verification_tools --no-save playwright
$env:START_PANEL_NODE_MODULES = Join-Path $PWD 'verification_tools\node_modules'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD 'verification\browser_runtime'
node verification_tools/node_modules/playwright/cli.js install chromium --no-shell
node start_panel/src/tests/browser_test.js
```

The script creates a disposable profile below the parent's `verification` directory, loads the actual unpacked extension, drives its UI, and saves screenshots and a JSON results report there. It never opens your ordinary browser profile. It checks loading, shortcut CRUD, folders, moving, search, multiple tabs, import/export, themes, narrow and wide layouts, and new-tab behavior.

Use Playwright's test Chromium for these checks. Recent regular Google Chrome releases may ignore the extension-loading command-line flags. To test a compatible browser executable explicitly, set `START_PANEL_BROWSER` to its absolute path before running the script; whether a particular Opera build supports automated headless startup must be checked locally.

The isolated profiles and downloaded test browsers are auxiliary artifacts. They are outside the Git repository and can be removed from the project's parent directory when no test browser is running. They are not needed for installation or normal use.

### Regenerate the icons

The included PNGs can be reproduced without a graphics package:

```powershell
node src/tools/create_icons.js
```

### Technical references

- [Opera extension loading and debugging](https://help.opera.com/en/extensions/testing/)
- [Opera tab API overview](https://help.opera.com/en/extensions/tab-window/)
- [Chromium manifest format](https://developer.chrome.com/docs/extensions/reference/manifest)
- [Chromium new-tab overrides](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages)
- [Extension local storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Manifest V3 service-worker basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics)
