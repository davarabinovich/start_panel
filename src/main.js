import { colorNames, findItem, getCollection, normalizeUrl, validateState } from "./model.js";

const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map(element => [element.id, element]));
const selectedIds = new Set();
const dialogRevisions = new WeakMap();
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
const iconPaths =
{
    plus: ["M12 5v14M5 12h14"],
    close: ["m6 6 12 12M6 18 18 6"],
    back: ["m14 6-6 6 6 6"],
    search: ["M21 21l-5-5", "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
    folder: ["M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"],
    select: ["M9 5H5v4m10-4h4v4M5 15v4h4m10-4v4h-4m-7-7 3 3 5-6"],
    settings: ["M4 7h16M4 17h16M8 4v6m8 4v6"],
    download: ["M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"],
    more: ["M5 12h.01M12 12h.01M19 12h.01"]
};
let state;
let folderId = "";
let editorContext = {};
let moveIds = [];
let confirmation = null;
let draggedId = "";
let toastTimer;
let hasPendingOperation = false;
let isOrganizing = false;

function createElement(tag, className = "", text = "")
{
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}

function createIcon(name)
{
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", name === "more" ? "3.5" : "1.7");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");

    for (const data of iconPaths[name])
    {
        const path = document.createElementNS(icon.namespaceURI, "path");
        path.setAttribute("d", data);
        icon.append(path);
    }

    return icon;
}

function createMonogram(item)
{
    const words = item.name.trim().split(/\s+/u);
    const initials = words.length > 1 ? [...words[0]][0] + [...words.at(-1)][0] : [...words[0]][0];
    const icon = createElement("span", `monogram color_${item.color}`, initials.toLocaleUpperCase());
    icon.setAttribute("aria-hidden", "true");
    return icon;
}

function showToast(message)
{
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = setTimeout(() =>
    {
        elements.toast.hidden = true;
    }, 5000);
}

function applyAppearance()
{
    document.documentElement.dataset.theme = state.settings.theme === "system" ?
        (systemTheme.matches ? "dark" : "light") : state.settings.theme;
    document.documentElement.dataset.size = state.settings.tileSize;
}

function updateState(nextState)
{
    if (state && nextState.revision < state.revision)
    {
        return;
    }

    state = nextState;

    if (folderId && !state.items.some(item => item.id === folderId && item.kind === "folder"))
    {
        folderId = "";
    }

    const identifiers = new Set(getCollection(state, folderId).filter(item => item.kind === "link").map(item => item.id));

    for (const identifier of selectedIds)
    {
        if (!identifiers.has(identifier))
        {
            selectedIds.delete(identifier);
        }
    }

    applyAppearance();
    renderPanel();
}

async function sendOperation(action, payload = {}, revision = state.revision)
{
    if (hasPendingOperation)
    {
        throw new Error("Please wait for the current change to finish.");
    }

    hasPendingOperation = true;

    try
    {
        const response = await chrome.runtime.sendMessage({ channel: "start_panel", action, payload, revision });

        if (response?.state)
        {
            updateState(response.state);
        }

        if (!response?.isSuccessful)
        {
            throw new Error(response?.error || "The extension did not respond. Reload this page and try again.");
        }
    }
    finally
    {
        hasPendingOperation = false;
    }
}

async function submitDialog(dialog, errorElement, action, payload, message)
{
    const submitButton = dialog.querySelector('[type="submit"]');
    errorElement.textContent = "";
    submitButton.disabled = true;

    try
    {
        await sendOperation(action, payload, dialogRevisions.get(dialog));
        dialog.close();
        showToast(message);
        return true;
    }
    catch (error)
    {
        errorElement.textContent = error.message;
        dialogRevisions.set(dialog, state.revision);
        return false;
    }
    finally
    {
        submitButton.disabled = false;
    }
}

function openDialog(dialog)
{
    dialogRevisions.set(dialog, state.revision);
    dialog.showModal();
}

function openFolder(identifier)
{
    folderId = identifier;
    elements.searchInput.value = "";
    selectedIds.clear();
    isOrganizing = false;
    renderPanel();
    (folderId ? elements.backButton : elements.addButton).focus();
}

function toggleSelection(identifier)
{
    if (selectedIds.has(identifier))
    {
        selectedIds.delete(identifier);
    }
    else
    {
        selectedIds.add(identifier);
    }

    const tile = [...elements.tileGrid.children].find(element => element.dataset.id === identifier);

    if (tile)
    {
        tile.classList.toggle("is_selected", selectedIds.has(identifier));
        tile.querySelector("input").checked = selectedIds.has(identifier);
    }

    renderSelection();
}

function renderSelection()
{
    elements.selectionBar.hidden = !isOrganizing;
    elements.selectionCount.textContent = `${selectedIds.size} selected`;
    elements.organizeButton.setAttribute("aria-pressed", String(isOrganizing));
    elements.tileGrid.classList.toggle("is_organizing", isOrganizing);

    for (const button of [elements.groupButton, elements.moveButton, elements.deleteSelectionButton])
    {
        button.disabled = selectedIds.size === 0;
    }
}

function createTile(item, parentName = "")
{
    const tile = createElement("article", `tile color_${item.color}${selectedIds.has(item.id) ? " is_selected" : ""}`);
    tile.dataset.id = item.id;
    const isFolder = item.kind === "folder";
    const link = createElement(isFolder ? "button" : "a", "tile_link");
    const face = createElement("span", "tile_face");
    const label = createElement("span", "tile_label", item.name);
    const detail = isFolder ? `${item.children.length} shortcuts` : (parentName || new URL(item.url).hostname.replace(/^www\./, ""));
    link.title = isFolder ? `Open ${item.name}` : `${item.name}\n${item.url}`;

    if (isFolder)
    {
        link.type = "button";
        const mark = createElement("span", "folder_mark");
        mark.append(createIcon("folder"));
        face.append(mark);

        if (item.children.length)
        {
            const preview = createElement("span", "folder_preview");
            item.children.slice(0, 4).forEach(child => preview.append(createMonogram(child)));
            face.append(preview);
        }
        else
        {
            const symbol = createElement("span", `monogram color_${item.color}`);
            symbol.append(createIcon("folder"));
            face.append(symbol);
        }

        link.addEventListener("click", () => openFolder(item.id));
    }
    else
    {
        link.href = item.url;
        link.target = state.settings.hasNewTabLinks ? "_blank" : "_self";
        link.rel = "noopener noreferrer";
        face.append(createMonogram(item));
        link.addEventListener("click", event =>
        {
            if (isOrganizing)
            {
                event.preventDefault();
                toggleSelection(item.id);
            }
        });
    }

    link.append(face, label, createElement("span", "tile_detail", detail));
    tile.append(link);

    if (isOrganizing && !isFolder)
    {
        const checkbox = createElement("input", "tile_checkbox");
        checkbox.type = "checkbox";
        checkbox.checked = selectedIds.has(item.id);
        checkbox.setAttribute("aria-label", `Select ${item.name}`);
        checkbox.addEventListener("change", () => toggleSelection(item.id));
        tile.append(checkbox);
    }

    const menuButton = createElement("button", "icon_button tile_tools");
    menuButton.type = "button";
    menuButton.setAttribute("aria-label", `Actions for ${item.name}`);
    menuButton.setAttribute("aria-haspopup", "true");
    menuButton.append(createIcon("more"));
    menuButton.addEventListener("click", () => openTileMenu(item, menuButton));
    tile.append(menuButton);
    tile.draggable = !isOrganizing && !elements.searchInput.value.trim();
    tile.addEventListener("dragstart", event =>
    {
        if (!tile.draggable)
        {
            event.preventDefault();
            return;
        }

        draggedId = item.id;
        event.dataTransfer.setData("application/x-start-panel", item.id);
        event.dataTransfer.effectAllowed = "move";
        elements.tileMenu.hidePopover();
    });
    tile.addEventListener("dragover", event =>
    {
        if (draggedId && draggedId !== item.id)
        {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            tile.classList.add("is_drop_target");
        }
    });
    tile.addEventListener("dragleave", () => tile.classList.remove("is_drop_target"));
    tile.addEventListener("dragend", clearDrag);
    tile.addEventListener("drop", async event =>
    {
        event.preventDefault();
        const identifier = draggedId;
        clearDrag();

        if (!identifier || identifier === item.id)
        {
            return;
        }

        const bounds = tile.getBoundingClientRect();

        try
        {
            await sendOperation("reorder", { id: identifier, targetId: item.id, hasAfter: event.clientX > bounds.left + bounds.width / 2 });
            showToast("Tile order saved.");
        }
        catch (error)
        {
            showToast(error.message);
        }
    });
    return tile;
}

function clearDrag()
{
    draggedId = "";
    document.querySelectorAll(".is_drop_target").forEach(element => element.classList.remove("is_drop_target"));
}

function renderPanel()
{
    const query = elements.searchInput.value.trim().toLocaleLowerCase();
    let entries = getCollection(state, folderId).map(item => ({ item, parentName: "" }));

    if (query && !folderId)
    {
        entries = state.items.flatMap(item => item.kind === "folder" ?
            [{ item, parentName: "" }, ...item.children.map(child => ({ item: child, parentName: item.name }))] : [{ item, parentName: "" }]);
    }

    entries = entries.filter(({ item }) => `${item.name} ${item.url || ""}`.toLocaleLowerCase().includes(query));
    elements.sectionTitle.textContent = query ? "Search results" : (folderId ? findItem(state, folderId).item.name : "Speed dial");
    elements.itemCount.textContent = String(entries.length);
    elements.backButton.hidden = !folderId;
    elements.folderButton.hidden = Boolean(folderId);
    elements.organizeButton.disabled = Boolean(query);
    const fragment = document.createDocumentFragment();
    entries.forEach(({ item, parentName }) => fragment.append(createTile(item, parentName)));

    if (!query)
    {
        const addTile = createElement("button", "tile tile_link add_tile");
        addTile.type = "button";
        const face = createElement("span", "tile_face");
        const icon = createElement("span", "monogram");
        icon.append(createIcon("plus"));
        face.append(icon);
        addTile.append(face, createElement("span", "tile_label", "Add a shortcut"));
        addTile.addEventListener("click", () => openEditor("link"));
        fragment.append(addTile);
    }

    elements.tileGrid.replaceChildren(fragment);
    elements.emptyMessage.hidden = entries.length > 0;
    elements.emptyMessage.textContent = query ? "No shortcuts found. Try another name or address." :
        (folderId ? "A little room to grow. Add a shortcut or move one into this folder." : "Your space is ready. Add your first shortcut.");
    renderSelection();
}

function renderDestinations(select, currentId = "")
{
    select.replaceChildren(new Option("Speed dial", ""));

    for (const item of state.items.filter(entry => entry.kind === "folder"))
    {
        select.add(new Option(item.name, item.id));
    }

    select.value = currentId;
}

function openEditor(kind, item = null, identifiers = [])
{
    editorContext = { kind, id: item?.id || "", ids: identifiers };
    const isLink = kind === "link";
    elements.editorTitle.textContent = item ? (isLink ? "Edit shortcut" : "Edit folder") : (isLink ? "Add shortcut" : "New folder");
    elements.editorDescription.textContent = isLink ? "A familiar name. A favorite place." :
        (identifiers.length ? `${identifiers.length} shortcuts, together in one place.` : "Give your collection a little space of its own.");
    elements.nameInput.value = item?.name || "";
    elements.urlInput.value = item?.url || "";
    elements.urlInput.required = isLink;
    elements.urlField.hidden = !isLink;
    elements.destinationField.hidden = !isLink;
    elements.editorError.textContent = "";
    elements.saveButton.textContent = isLink ? "Save shortcut" : "Save folder";
    renderDestinations(elements.destinationInput, item && isLink ? findItem(state, item.id).folderId : folderId);
    elements.colorOptions.replaceChildren();

    for (const color of colorNames)
    {
        const label = createElement("label", `color_choice color_${color}`);
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "color";
        radio.value = color;
        radio.checked = color === (item?.color || "blue");
        radio.setAttribute("aria-label", color[0].toUpperCase() + color.slice(1));
        label.append(radio);
        elements.colorOptions.append(label);
    }

    openDialog(elements.editorDialog);
    elements.nameInput.focus();
}

function openMove(identifiers)
{
    moveIds = identifiers;
    renderDestinations(elements.moveDestinationInput, folderId);
    elements.moveError.textContent = "";
    openDialog(elements.moveDialog);
}

function openConfirmation(title, description, action, payload, label = "Delete", message = "Deleted.")
{
    confirmation = { action, payload, message };
    elements.confirmTitle.textContent = title;
    elements.confirmDescription.textContent = description;
    elements.confirmButton.textContent = label;
    elements.confirmError.textContent = "";
    openDialog(elements.confirmDialog);
}

function openDelete(identifiers)
{
    const items = identifiers.map(identifier => findItem(state, identifier).item);
    const count = items.reduce((total, item) => total + (item.kind === "folder" ? item.children.length : 1), 0);
    const title = identifiers.length === 1 ? `Delete “${items[0].name}”?` : `Delete ${identifiers.length} shortcuts?`;
    const description = `This removes ${count} shortcut${count === 1 ? "" : "s"}${items.some(item => item.kind === "folder") ? " and the folder" : ""}. This cannot be undone. You can export a backup in Customize first.`;
    openConfirmation(title, description, "delete", { ids: identifiers });
}

function openTileMenu(item, button)
{
    const menu = elements.tileMenu;
    menu.hidePopover();
    menu.replaceChildren();

    function addAction(label, handler)
    {
        const action = createElement("button", "", label);
        action.type = "button";
        action.addEventListener("click", async () =>
        {
            menu.hidePopover();

            try
            {
                await handler();
            }
            catch (error)
            {
                showToast(error.message);
            }
        });
        menu.append(action);
    }

    addAction(item.kind === "folder" ? "Edit folder" : "Edit shortcut", () => openEditor(item.kind, item));

    if (item.kind === "link")
    {
        addAction("Move to…", () => openMove([item.id]));
    }
    else
    {
        addAction("Ungroup folder", () => openConfirmation("Ungroup this folder?", "Move its shortcuts to Speed dial and remove the folder.", "ungroup", { id: item.id }, "Ungroup", "Folder ungrouped."));
    }

    const collection = findItem(state, item.id).collection;
    const index = collection.findIndex(entry => entry.id === item.id);

    if (index > 0)
    {
        addAction("Move earlier", () => sendOperation("reorder", { id: item.id, targetId: collection[index - 1].id, hasAfter: false }));
    }

    if (index < collection.length - 1)
    {
        addAction("Move later", () => sendOperation("reorder", { id: item.id, targetId: collection[index + 1].id, hasAfter: true }));
    }

    addAction("Delete…", () => openDelete([item.id]));
    menu.showPopover();
    const bounds = button.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(bounds.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(bounds.bottom + 5, innerHeight - menu.offsetHeight - 8))}px`;
    menu.firstElementChild.focus();
}

function openSettings()
{
    elements.themeInput.value = state.settings.theme;
    elements.sizeInput.value = state.settings.tileSize;
    elements.newTabInput.checked = state.settings.hasNewTabLinks;
    elements.redirectInput.checked = state.settings.hasStartPageRedirect;
    elements.settingsError.textContent = "";
    openDialog(elements.settingsDialog);
}

function exportBackup()
{
    const blob = new Blob([JSON.stringify(state, null, 4)], { type: "application/json" });
    const address = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = address;
    link.download = `start_panel_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(address), 1000);
}

async function importBackup()
{
    const file = elements.importInput.files[0];
    elements.importInput.value = "";

    if (!file)
    {
        return;
    }

    try
    {
        if (file.size > 8 * 1024 * 1024)
        {
            throw new Error("Choose a backup smaller than 8 MB.");
        }

        const backup = validateState(JSON.parse(await file.text()));
        const count = backup.items.reduce((total, item) => total + (item.kind === "folder" ? item.children.length : 1), 0);
        elements.settingsDialog.close();
        openConfirmation("Replace your panel?", `This backup contains ${count} shortcuts. Importing replaces all current shortcuts, folders, and preferences. Export your current panel first if you want to keep a copy.`, "import", { state: backup }, "Replace panel", "Backup imported.");
    }
    catch (error)
    {
        elements.settingsError.textContent = error instanceof SyntaxError ? "This file is not valid JSON. Choose a Start Panel backup." : error.message;
    }
}

function connectEvents()
{
    document.querySelectorAll("[data-icon]").forEach(element => element.append(createIcon(element.dataset.icon)));
    document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
    elements.addButton.addEventListener("click", () => openEditor("link"));
    elements.folderButton.addEventListener("click", () => openEditor("folder"));
    elements.backButton.addEventListener("click", () => openFolder(""));
    elements.settingsButton.addEventListener("click", openSettings);
    elements.searchInput.addEventListener("input", () =>
    {
        isOrganizing = false;
        selectedIds.clear();
        renderPanel();
    });
    elements.organizeButton.addEventListener("click", () =>
    {
        isOrganizing = !isOrganizing;
        selectedIds.clear();
        renderPanel();
    });
    elements.finishButton.addEventListener("click", () =>
    {
        isOrganizing = false;
        selectedIds.clear();
        renderPanel();
    });
    elements.groupButton.addEventListener("click", () => openEditor("folder", null, [...selectedIds]));
    elements.moveButton.addEventListener("click", () => openMove([...selectedIds]));
    elements.deleteSelectionButton.addEventListener("click", () => openDelete([...selectedIds]));
    elements.exportButton.addEventListener("click", exportBackup);
    elements.importButton.addEventListener("click", () => elements.importInput.click());
    elements.importInput.addEventListener("change", importBackup);
    elements.editorForm.addEventListener("submit", async event =>
    {
        event.preventDefault();
        const payload =
        {
            ...editorContext,
            name: elements.nameInput.value,
            url: elements.urlInput.value,
            folderId: elements.destinationInput.value,
            color: elements.editorForm.querySelector('[name="color"]:checked').value
        };

        try
        {
            if (editorContext.kind === "link")
            {
                payload.url = normalizeUrl(payload.url);
            }
        }
        catch (error)
        {
            elements.editorError.textContent = error.message;
            return;
        }

        if (await submitDialog(elements.editorDialog, elements.editorError, `save_${editorContext.kind}`, payload, editorContext.kind === "link" ? "Shortcut saved." : "Folder saved."))
        {
            selectedIds.clear();
            isOrganizing = false;
            renderPanel();
        }
    });
    elements.moveForm.addEventListener("submit", async event =>
    {
        event.preventDefault();

        if (await submitDialog(elements.moveDialog, elements.moveError, "move", { ids: moveIds, folderId: elements.moveDestinationInput.value }, "Shortcuts moved."))
        {
            selectedIds.clear();
            renderPanel();
        }
    });
    elements.settingsForm.addEventListener("submit", event =>
    {
        event.preventDefault();
        submitDialog(elements.settingsDialog, elements.settingsError, "settings",
        {
            theme: elements.themeInput.value,
            tileSize: elements.sizeInput.value,
            hasNewTabLinks: elements.newTabInput.checked,
            hasStartPageRedirect: elements.redirectInput.checked
        }, "Preferences saved.");
    });
    elements.confirmForm.addEventListener("submit", event =>
    {
        event.preventDefault();
        submitDialog(elements.confirmDialog, elements.confirmError, confirmation.action, confirmation.payload, confirmation.message);
    });
    systemTheme.addEventListener("change", applyAppearance);
    window.addEventListener("resize", () => elements.tileMenu.hidePopover());
    window.addEventListener("scroll", () => elements.tileMenu.hidePopover());
    document.addEventListener("keydown", event =>
    {
        const hasDialog = Boolean(document.querySelector("dialog[open]"));
        const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);

        if (event.key === "/" && !hasDialog && !isInput && !event.ctrlKey && !event.altKey && !event.metaKey)
        {
            event.preventDefault();
            elements.searchInput.focus();
        }

        if (event.key === "Escape" && !hasDialog && !elements.tileMenu.matches(":popover-open"))
        {
            if (elements.searchInput.value)
            {
                elements.searchInput.value = "";
                renderPanel();
            }
            else if (folderId)
            {
                openFolder("");
            }
        }
    });
}

async function initializePanel()
{
    try
    {
        if (!globalThis.chrome?.runtime?.id)
        {
            throw new Error("Load the start_panel folder as an unpacked extension in Opera, then open it with its toolbar button. See installation_manual.md for the steps.");
        }

        const response = await chrome.runtime.sendMessage({ channel: "start_panel", action: "read" });

        if (!response?.isSuccessful)
        {
            throw new Error(response?.error || "Unable to load your saved panel.");
        }

        connectEvents();
        updateState(response.state);
        chrome.storage.onChanged.addListener((changes, areaName) =>
        {
            if (areaName === "local" && changes.panelState?.newValue)
            {
                try
                {
                    updateState(validateState(changes.panelState.newValue));
                }
                catch (error)
                {
                    showToast(error.message);
                }
            }
        });
        const latest = await chrome.runtime.sendMessage({ channel: "start_panel", action: "read" });

        if (latest?.isSuccessful)
        {
            updateState(latest.state);
        }
    }
    catch (error)
    {
        elements.loadError.textContent = `${error.message} Your saved data has not been reset.`;
        elements.loadError.hidden = false;
        document.querySelectorAll("button, input").forEach(element =>
        {
            element.disabled = true;
        });
    }
}

initializePanel();
