import assert from "node:assert/strict";
import { test } from "node:test";

const listeners = {};
const storage = {};
const tabUpdates = [];
const tabRecords = new Map();
let hasStorageFailure = false;

function createEvent(name)
{
    return {
        addListener: listener =>
        {
            listeners[name] = listener;
        }
    };
}

globalThis.chrome =
{
    runtime:
    {
        id: "test",
        getURL: path => `chrome-extension://test/${path}`,
        onMessage: createEvent("message")
    },
    storage:
    {
        local:
        {
            get: async () => structuredClone(storage),
            set: async values =>
            {
                if (hasStorageFailure)
                {
                    throw new Error("Storage is full");
                }

                Object.assign(storage, structuredClone(values));
            }
        }
    },
    action: { onClicked: createEvent("action") },
    commands: { onCommand: createEvent("command") },
    tabs:
    {
        create: async () => undefined,
        get: async identifier => tabRecords.get(identifier),
        update: async (identifier, details) =>
        {
            tabUpdates.push({ identifier, details });
        },
        onCreated: createEvent("created"),
        onUpdated: createEvent("updated")
    }
};

await import("../background.js");

function sendMessage(action, revision, payload = {})
{
    return new Promise(resolve => listeners.message({ channel: "start_panel", action, revision, payload }, { id: "test", url: "chrome-extension://test/src/start_page.html" }, resolve));
}

test("serializes writes, rejects stale edits, and recovers after storage failure", async () =>
{
    const initial = await sendMessage("read");
    assert.equal(initial.isSuccessful, true);
    const payload = { name: "Test", url: "example.com", color: "blue" };
    const results = await Promise.all([sendMessage("save_link", 0, payload), sendMessage("save_link", 0, payload)]);
    assert.equal(results[0].isSuccessful, true);
    assert.equal(results[1].isSuccessful, false);
    assert.match(results[1].error, /another tab/);
    assert.equal(storage.panelState.items.length, initial.state.items.length + 1);
    hasStorageFailure = true;
    assert.equal((await sendMessage("save_link", 1, payload)).isSuccessful, false);
    assert.equal(storage.panelState.revision, 1);
    hasStorageFailure = false;
    assert.equal((await sendMessage("save_link", 1, payload)).isSuccessful, true);
    assert.equal(storage.panelState.revision, 2);
});

test("does not accept messages from unrelated senders", () =>
{
    assert.equal(listeners.message({ channel: "start_panel", action: "read" }, { id: "other", url: "https://example.com" }, () => undefined), false);
});

test("redirects start pages, respects pending navigation and the disabled preference", async () =>
{
    tabRecords.set(1, { url: "opera://startpage/" });
    await listeners.created({ id: 1, url: "opera://startpage/" });
    assert.equal(tabUpdates.length, 1);
    assert.equal(tabUpdates[0].details.url, "chrome-extension://test/src/start_page.html");
    tabRecords.set(2, { url: "opera://startpage/", pendingUrl: "https://example.com" });
    await listeners.created({ id: 2, url: "opera://startpage/" });
    assert.equal(tabUpdates.length, 1);
    storage.panelState.settings.hasStartPageRedirect = false;
    await listeners.created({ id: 1, url: "opera://startpage/" });
    assert.equal(tabUpdates.length, 1);
    await listeners.created({ id: 3, url: "about:blank" });
    assert.equal(tabUpdates.length, 1);
});
