import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOperation, createDefaultState, createLink, findItem, isStartPageUrl, normalizeUrl, validateState } from "../model.js";

test("normalizes web addresses and rejects executable or credential-bearing URLs", () =>
{
    assert.equal(normalizeUrl(" example.com/path?q=1 "), "https://example.com/path?q=1");
    assert.equal(normalizeUrl("localhost:3000"), "https://localhost:3000/");
    assert.equal(normalizeUrl("http://localhost:8080"), "http://localhost:8080/");

    for (const address of ["", "javascript:alert(1)", "data:text/html,hello", "file:///c:/test", "https://user:pass@example.com", "https://", "not a url"])
    {
        assert.throws(() => normalizeUrl(address));
    }
});

test("creates, edits and deletes a shortcut without mutating the previous state", () =>
{
    const original = createDefaultState();
    const snapshot = structuredClone(original);
    let state = applyOperation(original, { action: "save_link", payload: { name: "Test", url: "example.com", color: "teal" } });
    const identifier = state.items.at(-1).id;
    assert.deepEqual(original, snapshot);
    assert.equal(state.revision, 1);
    state = applyOperation(state, { action: "save_link", payload: { id: identifier, name: "Changed", url: "https://example.org", color: "rose" } });
    assert.equal(findItem(state, identifier).item.name, "Changed");
    assert.equal(state.items.length, original.items.length + 1);
    state = applyOperation(state, { action: "delete", payload: { ids: [identifier] } });
    assert.throws(() => findItem(state, identifier));
    assert.equal(state.revision, 3);
});

test("groups existing shortcuts, edits a folder and moves shortcuts in both directions", () =>
{
    let state = createDefaultState();
    const identifiers = state.items.slice(0, 2).map(item => item.id);
    state = applyOperation(state, { action: "save_folder", payload: { name: "Work", color: "blue", ids: identifiers } });
    const folder = state.items.at(-1);
    assert.deepEqual(folder.children.map(item => item.id), identifiers);
    assert.equal(findItem(state, identifiers[0]).folderId, folder.id);
    state = applyOperation(state, { action: "save_folder", payload: { id: folder.id, name: "Research", color: "amber" } });
    state = applyOperation(state, { action: "move", payload: { ids: [identifiers[0]], folderId: "" } });
    assert.equal(findItem(state, identifiers[0]).folderId, "");
    state = applyOperation(state, { action: "move", payload: { ids: [identifiers[0]], folderId: folder.id } });
    state = applyOperation(state, { action: "save_link", payload: { name: "New", url: "example.com", color: "green", folderId: folder.id } });
    assert.equal(findItem(state, folder.id).item.children.length, 3);
    state = applyOperation(state, { action: "ungroup", payload: { id: folder.id } });
    assert.throws(() => findItem(state, folder.id));
    assert.equal(findItem(state, identifiers[0]).folderId, "");
});

test("reorders both root and folder collections and rejects cross-folder reordering", () =>
{
    let state = createDefaultState();
    const first = state.items[0];
    const third = state.items[2];
    state = applyOperation(state, { action: "reorder", payload: { id: first.id, targetId: third.id, hasAfter: true } });
    assert.equal(state.items[2].id, first.id);
    const folder = state.items.find(item => item.kind === "folder");
    const child = folder.children[0];
    state = applyOperation(state, { action: "reorder", payload: { id: child.id, targetId: folder.children[2].id, hasAfter: true } });
    assert.equal(findItem(state, folder.id).item.children[2].id, child.id);
    assert.throws(() => applyOperation(state, { action: "reorder", payload: { id: first.id, targetId: child.id } }));
});

test("rejects malformed backups, duplicate IDs, nested folders and unknown settings", () =>
{
    const original = createDefaultState();
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(original))), original);
    assert.throws(() => validateState({ ...original, version: 2 }));
    assert.throws(() => validateState({ ...original, items: [...original.items, original.items[0]] }));
    assert.throws(() => validateState({ ...original, settings: { ...original.settings, theme: "unknown" } }));
    assert.throws(() => validateState({ ...original, items: [{ id: "outer", kind: "folder", name: "Outer", color: "blue", children: [original.items.find(item => item.kind === "folder")] }] }));
    assert.throws(() => applyOperation(original, { action: "save_folder", payload: { name: "Nested", color: "blue", ids: [original.items.find(item => item.kind === "folder").id] } }));
});

test("imports validated data with a fresh revision and has no arbitrary item limit", () =>
{
    const original = createDefaultState();
    const backup = createDefaultState();
    backup.items = Array.from({ length: 1500 }, (_, index) => createLink(`Site ${index}`, `https://example.com/${index}`));
    backup.revision = 800;
    const state = applyOperation(original, { action: "import", payload: { state: backup } });
    assert.equal(state.items.length, 1500);
    assert.equal(state.revision, 1);
});

test("matches only explicit browser start-page addresses", () =>
{
    for (const address of ["opera://startpage/", "chrome://startpageshared/", "opera://newtab", "chrome://newtab/?source=test"])
    {
        assert.equal(isStartPageUrl(address), true);
    }

    for (const address of [undefined, "about:blank", "https://example.com/newtab", "opera://settings", "chrome://newtab/other", "chrome://startpage.evil/", "chrome-extension://id/src/start_page.html"])
    {
        assert.equal(isStartPageUrl(address), false);
    }
});
