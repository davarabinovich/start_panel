import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requirePackage = createRequire(process.env.START_PANEL_NODE_MODULES ? join(process.env.START_PANEL_NODE_MODULES, "package.json") : import.meta.url);
const { chromium } = requirePackage("playwright");
const repositoryPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputPath = resolve(repositoryPath, "../verification");
mkdirSync(outputPath, { recursive: true });
const profilePath = mkdtempSync(join(outputPath, "browser_profile_"));
const context = await chromium.launchPersistentContext(profilePath,
{
    channel: process.env.START_PANEL_BROWSER ? undefined : "chromium",
    executablePath: process.env.START_PANEL_BROWSER || undefined,
    headless: true,
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    args: [`--disable-extensions-except=${repositoryPath}`, `--load-extension=${repositoryPath}`, "--no-first-run", "--no-default-browser-check"]
});
const errors = [];
const results = [];
context.setDefaultTimeout(15000);
let page;

async function runCheck(name, action)
{
    await action();
    results.push(name);
    console.log(`PASS ${name}`);
}

async function getState()
{
    return page.evaluate(async () => (await chrome.storage.local.get("panelState")).panelState);
}

async function waitForSave(dialogName)
{
    await page.locator(`#${dialogName}`).waitFor({ state: "hidden" });
}

async function clickTileAction(name, action)
{
    await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await page.locator("#tileMenu").getByRole("button", { name: action, exact: true }).click();
}

try
{
    const worker = context.serviceWorkers().find(entry => entry.url().includes("background.js")) ||
        await context.waitForEvent("serviceworker", { predicate: entry => entry.url().includes("background.js"), timeout: 20000 });
    const extensionId = new URL(worker.url()).host;
    page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message =>
    {
        if (message.type() === "error")
        {
            errors.push(message.text());
        }
    });
    await page.goto(`chrome-extension://${extensionId}/src/start_page.html`);
    await page.locator(".tile[data-id]").first().waitFor();

    await runCheck("extension loads without runtime errors", async () =>
    {
        assert.equal(await page.locator(".tile[data-id]").count(), 6);
        assert.equal(await page.locator("#loadError").isVisible(), false);
        await page.screenshot({ path: join(outputPath, "start_panel_light.png"), fullPage: true });
    });

    await runCheck("creates a shortcut, validates its URL and persists after reload", async () =>
    {
        await page.getByRole("button", { name: "Add shortcut", exact: true }).click();
        await page.getByLabel("Name", { exact: true }).fill("Example workspace");
        await page.getByLabel("Website address", { exact: true }).fill("javascript:alert(1)");
        await page.getByRole("button", { name: "Save shortcut", exact: true }).click();
        await page.getByText("Use an HTTP or HTTPS address without embedded login details.", { exact: true }).waitFor();
        await page.getByLabel("Website address", { exact: true }).fill("example.com/work");
        await page.getByRole("radio", { name: "Teal", exact: true }).check();
        await page.getByRole("button", { name: "Save shortcut", exact: true }).click();
        await waitForSave("editorDialog");
        await page.reload();
        await page.getByRole("link", { name: /Example workspace/ }).waitFor();
        const state = await getState();
        assert.equal(state.items.at(-1).url, "https://example.com/work");
    });

    await runCheck("groups existing tiles and adds a shortcut inside the folder", async () =>
    {
        await page.getByRole("button", { name: "Organize", exact: true }).click();
        await page.getByRole("checkbox", { name: "Select Wikipedia", exact: true }).check();
        await page.getByRole("checkbox", { name: "Select YouTube", exact: true }).check();
        await page.getByRole("button", { name: "Create folder from selection", exact: true }).click();
        await page.getByLabel("Name", { exact: true }).fill("Reference");
        await page.getByRole("button", { name: "Save folder", exact: true }).click();
        await waitForSave("editorDialog");
        await page.getByRole("button", { name: /^Reference 2 shortcuts$/ }).click();
        assert.equal(await page.locator(".tile[data-id]").count(), 2);
        await page.getByRole("button", { name: "Add shortcut", exact: true }).click();
        await page.getByLabel("Name", { exact: true }).fill("Inside folder");
        await page.getByLabel("Website address", { exact: true }).fill("example.org");
        await page.getByRole("button", { name: "Save shortcut", exact: true }).click();
        await waitForSave("editorDialog");
        assert.equal(await page.locator(".tile[data-id]").count(), 3);
    });

    await runCheck("edits, reorders, moves and deletes a folder shortcut", async () =>
    {
        await clickTileAction("Inside folder", "Edit shortcut");
        await page.getByLabel("Name", { exact: true }).fill("Renamed shortcut");
        await page.getByRole("button", { name: "Save shortcut", exact: true }).click();
        await waitForSave("editorDialog");
        await clickTileAction("Renamed shortcut", "Move earlier");
        await page.waitForFunction(() => document.querySelectorAll(".tile[data-id] .tile_label")[1]?.textContent === "Renamed shortcut");
        await clickTileAction("Renamed shortcut", "Move to…");
        await page.locator("#moveDestinationInput").selectOption("");
        await page.locator("#moveDialog").getByRole("button", { name: "Move shortcuts", exact: true }).click();
        await waitForSave("moveDialog");
        await page.getByRole("button", { name: "Back to all shortcuts" }).click();
        await clickTileAction("Renamed shortcut", "Delete…");
        await page.locator("#confirmDialog").getByRole("button", { name: "Delete", exact: true }).click();
        await waitForSave("confirmDialog");
        assert.equal(await page.getByRole("link", { name: /Renamed shortcut/ }).count(), 0);
    });

    await runCheck("finds shortcuts inside folders", async () =>
    {
        await page.getByRole("searchbox").fill("wikipedia");
        assert.equal(await page.locator(".tile[data-id]").count(), 1);
        assert.equal(await page.locator(".tile_detail").textContent(), "Reference");
        await page.getByRole("searchbox").fill("");
    });

    await runCheck("renames and ungroups a folder while keeping its shortcuts", async () =>
    {
        await clickTileAction("Reference", "Edit folder");
        await page.getByLabel("Name", { exact: true }).fill("Reading");
        await page.getByRole("button", { name: "Save folder", exact: true }).click();
        await waitForSave("editorDialog");
        await clickTileAction("Reading", "Ungroup folder");
        await page.locator("#confirmDialog").getByRole("button", { name: "Ungroup", exact: true }).click();
        await waitForSave("confirmDialog");
        assert.equal(await page.getByRole("link", { name: /Wikipedia/ }).count(), 1);
        assert.equal((await getState()).items.some(item => item.name === "Reading"), false);
    });

    await runCheck("reorders with drag and opens a dialog using the keyboard", async () =>
    {
        const before = (await getState()).items;
        const source = page.locator(`[data-id="${before[0].id}"]`);
        const destination = page.locator(`[data-id="${before[2].id}"]`);
        await source.dragTo(destination, { targetPosition: { x: 10, y: 60 } });
        await page.waitForFunction(identifier => document.querySelectorAll(".tile[data-id]")[1]?.dataset.id === identifier, before[0].id);
        await page.getByRole("button", { name: "Add shortcut", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page.locator("#editorDialog").waitFor({ state: "visible" });
        assert.equal(await page.locator("#nameInput").evaluate(element => element === document.activeElement), true);
        await page.keyboard.press("Escape");
        await waitForSave("editorDialog");
    });

    await runCheck("confirms folder deletion and removes its children", async () =>
    {
        const folder = (await getState()).items.find(item => item.name === "Discover");
        await clickTileAction("Discover", "Delete…");
        await page.locator("#confirmDialog").getByRole("button", { name: "Cancel", exact: true }).click();
        assert.ok((await getState()).items.some(item => item.id === folder.id));
        await clickTileAction("Discover", "Delete…");
        await page.locator("#confirmDialog").getByRole("button", { name: "Delete", exact: true }).click();
        await waitForSave("confirmDialog");
        assert.equal((await getState()).items.some(item => item.id === folder.id), false);
    });

    await runCheck("synchronizes two open tabs and rejects a stale dialog save", async () =>
    {
        const otherPage = await context.newPage();
        await otherPage.goto(page.url());
        await otherPage.locator(".tile[data-id]").first().waitFor();
        await page.getByRole("button", { name: "Add shortcut", exact: true }).click();
        await page.getByLabel("Name", { exact: true }).fill("Concurrent shortcut");
        await page.getByLabel("Website address", { exact: true }).fill("example.net");
        const response = await otherPage.evaluate(async () =>
        {
            const { panelState } = await chrome.storage.local.get("panelState");
            return chrome.runtime.sendMessage({ channel: "start_panel", action: "save_folder", revision: panelState.revision, payload: { name: "Other tab", color: "blue" } });
        });
        assert.equal(response.isSuccessful, true);
        await page.getByRole("button", { name: "Save shortcut", exact: true }).click();
        await page.getByText("Your panel changed in another tab. Review the current tiles, then try again.", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Save shortcut", exact: true }).click();
        await waitForSave("editorDialog");
        await otherPage.getByRole("link", { name: /Concurrent shortcut/ }).waitFor();
        await otherPage.close();
    });

    await runCheck("exports and imports a backup with confirmation", async () =>
    {
        await page.getByRole("button", { name: "Customize", exact: true }).click();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export backup", exact: true }).click();
        const download = await downloadPromise;
        const backupPath = join(outputPath, "test_backup.json");
        await download.saveAs(backupPath);
        const backup = JSON.parse(readFileSync(backupPath, "utf8"));
        assert.equal(backup.version, 1);
        await page.locator("#importInput").setInputFiles(backupPath);
        await page.getByRole("button", { name: "Replace panel", exact: true }).click();
        await waitForSave("confirmDialog");
        assert.deepEqual((await getState()).items, backup.items);
    });

    await runCheck("saves dark theme, larger tiles and link target preference", async () =>
    {
        await page.getByRole("button", { name: "Customize", exact: true }).click();
        await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
        await page.getByLabel("Tile size", { exact: true }).selectOption("large");
        await page.getByLabel("Open shortcuts in a new tab", { exact: true }).check();
        await page.getByRole("button", { name: "Save preferences", exact: true }).click();
        await waitForSave("settingsDialog");
        assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
        assert.equal(await page.locator("a.tile_link").first().getAttribute("target"), "_blank");
        await page.screenshot({ path: join(outputPath, "start_panel_dark.png"), fullPage: true });
    });

    await runCheck("uses more columns on ultrawide windows and never overflows a narrow viewport", async () =>
    {
        await page.evaluate(async () =>
        {
            const { panelState } = await chrome.storage.local.get("panelState");
            const backup = structuredClone(panelState);
            backup.items = Array.from({ length: 90 }, (_, index) => ({ id: `wide_${index}`, kind: "link", name: `Shortcut ${index + 1}`, url: `https://example.com/${index}`, color: ["blue", "green", "rose", "violet"][index % 4] }));
            backup.settings.theme = "light";
            backup.settings.tileSize = "comfortable";
            await chrome.runtime.sendMessage({ channel: "start_panel", action: "import", revision: panelState.revision, payload: { state: backup } });
        });
        const widths = [360, 768, 1440, 2560, 3840];
        const columns = [];

        for (const width of widths)
        {
            await page.setViewportSize({ width, height: 1000 });
            const layout = await page.evaluate(() =>
            {
                const tiles = [...document.querySelectorAll(".tile[data-id]")];
                const firstTop = tiles[0].getBoundingClientRect().top;
                return { columns: tiles.filter(tile => Math.abs(tile.getBoundingClientRect().top - firstTop) < 1).length, hasOverflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert.equal(layout.hasOverflow, false, `Overflow at ${width}px`);
            columns.push(layout.columns);
        }

        assert.ok(columns[4] > 10);
        assert.ok(columns[4] > columns[3] && columns[3] > columns[2]);
        console.log(JSON.stringify({ widths, columns }));
        await page.setViewportSize({ width: 2560, height: 1440 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: join(outputPath, "start_panel_wide.png"), fullPage: true });
        await page.setViewportSize({ width: 360, height: 900 });
        await page.screenshot({ path: join(outputPath, "start_panel_narrow.png"), fullPage: false });
    });

    await runCheck("new tab opens the panel when browser support is available", async () =>
    {
        const newPage = await context.newPage();
        await newPage.goto("chrome://newtab/").catch(() => undefined);
        await newPage.waitForURL(`chrome-extension://${extensionId}/src/start_page.html`, { timeout: 10000 });
        await newPage.locator(".tile[data-id]").first().waitFor();
        await newPage.close();
    });

    assert.deepEqual(errors, []);
    const report = { browser: context.browser()?.version() || "persistent context", executable: process.env.START_PANEL_BROWSER || chromium.executablePath(), results, errors };
    writeFileSync(join(outputPath, "browser_results.json"), JSON.stringify(report, null, 4));
    console.log(`Passed ${results.length} browser checks. Artifacts: ${outputPath}`);
}
catch (error)
{
    if (page)
    {
        await page.screenshot({ path: join(outputPath, "browser_failure.png"), fullPage: true }).catch(() => undefined);
    }

    console.error({ results, errors });
    throw error;
}
finally
{
    await context.close();
}
