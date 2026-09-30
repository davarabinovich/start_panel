export const colorNames = ["blue", "violet", "rose", "amber", "green", "teal", "slate"];

export function normalizeUrl(value)
{
    if (typeof value !== "string" || !value.trim() || value.length > 8192)
    {
        throw new Error("Enter a website address, such as example.com.");
    }

    const address = value.trim();
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(address) && !/^[^/:]+:\d+(\/|$)/.test(address);
    let url;

    try
    {
        url = new URL(hasScheme ? address : `https://${address}`);
    }
    catch
    {
        throw new Error("Enter a valid website address.");
    }

    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password)
    {
        throw new Error("Use an HTTP or HTTPS address without embedded login details.");
    }

    return url.href;
}

export function readName(value)
{
    if (typeof value !== "string" || !value.trim() || value.trim().length > 80)
    {
        throw new Error("Enter a name between 1 and 80 characters.");
    }

    return value.trim();
}

export function createLink(name, url, color = "blue")
{
    return { id: crypto.randomUUID(), kind: "link", name: readName(name), url: normalizeUrl(url), color };
}

export function createDefaultState()
{
    return {
        version: 1,
        revision: 0,
        settings:
        {
            theme: "light",
            tileSize: "comfortable",
            hasNewTabLinks: false,
            hasStartPageRedirect: true
        },
        items:
        [
            createLink("Wikipedia", "https://www.wikipedia.org", "slate"),
            createLink("YouTube", "https://www.youtube.com", "rose"),
            createLink("GitHub", "https://github.com", "violet"),
            createLink("Outlook", "https://outlook.live.com", "blue"),
            {
                id: crypto.randomUUID(), kind: "folder", name: "Discover", color: "green",
                children:
                [
                    createLink("Unsplash", "https://unsplash.com", "green"),
                    createLink("OpenStreetMap", "https://www.openstreetmap.org", "teal"),
                    createLink("NASA", "https://www.nasa.gov", "blue")
                ]
            },
            createLink("Opera", "https://www.opera.com", "rose")
        ]
    };
}

export function validateState(value)
{
    if (!value || value.version !== 1 || !Array.isArray(value.items) || !value.settings)
    {
        throw new Error("This is not a supported Start Panel backup (version 1).");
    }

    const identifiers = new Set();

    function readItem(item, hasFolderParent = false)
    {
        if (!item || typeof item.id !== "string" || !/^[a-z\d_-]{1,100}$/i.test(item.id) || identifiers.has(item.id))
        {
            throw new Error("The backup contains a missing or duplicate tile identifier.");
        }

        identifiers.add(item.id);

        if (!colorNames.includes(item.color) || !["link", "folder"].includes(item.kind))
        {
            throw new Error("The backup contains an unsupported tile.");
        }

        const result = { id: item.id, kind: item.kind, name: readName(item.name), color: item.color };

        if (item.kind === "link")
        {
            result.url = normalizeUrl(item.url);
        }
        else
        {
            if (hasFolderParent || !Array.isArray(item.children))
            {
                throw new Error("Folders may contain shortcuts, but not other folders.");
            }

            result.children = item.children.map(child => readItem(child, true));
        }

        return result;
    }

    const settings = value.settings;

    if (!["light", "dark", "system"].includes(settings.theme) ||
        !["compact", "comfortable", "large"].includes(settings.tileSize) ||
        typeof settings.hasNewTabLinks !== "boolean" || typeof settings.hasStartPageRedirect !== "boolean")
    {
        throw new Error("The backup contains unsupported preferences.");
    }

    return {
        version: 1,
        revision: Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
        settings:
        {
            theme: settings.theme, tileSize: settings.tileSize,
            hasNewTabLinks: settings.hasNewTabLinks, hasStartPageRedirect: settings.hasStartPageRedirect
        },
        items: value.items.map(item => readItem(item))
    };
}

export function findItem(state, identifier)
{
    for (const item of state.items)
    {
        if (item.id === identifier)
        {
            return { item, collection: state.items, folderId: "" };
        }

        if (item.kind === "folder")
        {
            const child = item.children.find(entry => entry.id === identifier);

            if (child)
            {
                return { item: child, collection: item.children, folderId: item.id };
            }
        }
    }

    throw new Error("This tile no longer exists. Refresh and try again.");
}

export function getCollection(state, folderId = "")
{
    if (!folderId)
    {
        return state.items;
    }

    const result = findItem(state, folderId);

    if (result.item.kind !== "folder")
    {
        throw new Error("Choose a folder as the destination.");
    }

    return result.item.children;
}

export function applyOperation(currentState, operation)
{
    let state = validateState(currentState);
    const payload = operation.payload || {};

    switch (operation.action)
    {
        case "save_link":
        {
            const link = createLink(payload.name, payload.url, payload.color);
            const destination = getCollection(state, payload.folderId);

            if (payload.id)
            {
                const result = findItem(state, payload.id);

                if (result.item.kind !== "link")
                {
                    throw new Error("Only shortcuts have website addresses.");
                }

                link.id = result.item.id;
                const index = result.collection.indexOf(result.item);
                result.collection.splice(index, 1);
                destination.splice(destination === result.collection ? index : destination.length, 0, link);
            }
            else
            {
                destination.push(link);
            }

            break;
        }
        case "save_folder":
        {
            if (payload.id)
            {
                const result = findItem(state, payload.id);

                if (result.item.kind !== "folder")
                {
                    throw new Error("Choose a folder to rename.");
                }

                result.item.name = readName(payload.name);
                result.item.color = payload.color;
            }
            else
            {
                const identifiers = new Set(payload.ids || []);
                const children = [...identifiers].map(identifier => findItem(state, identifier).item);

                if (children.some(item => item.kind !== "link"))
                {
                    throw new Error("Select shortcuts to put in a folder.");
                }

                for (const identifier of identifiers)
                {
                    const result = findItem(state, identifier);
                    result.collection.splice(result.collection.indexOf(result.item), 1);
                }

                state.items.push({ id: crypto.randomUUID(), kind: "folder", name: readName(payload.name), color: payload.color, children });
            }

            break;
        }
        case "move":
        {
            const destination = getCollection(state, payload.folderId);
            const entries = [...new Set(payload.ids)].map(identifier => findItem(state, identifier));

            if (entries.some(entry => entry.item.kind !== "link"))
            {
                throw new Error("Only shortcuts can move between folders.");
            }

            for (const entry of entries)
            {
                entry.collection.splice(entry.collection.indexOf(entry.item), 1);
                destination.push(entry.item);
            }

            break;
        }
        case "reorder":
        {
            const source = findItem(state, payload.id);
            const destination = findItem(state, payload.targetId);

            if (source.collection !== destination.collection)
            {
                throw new Error("Reorder tiles within the same folder.");
            }

            source.collection.splice(source.collection.indexOf(source.item), 1);
            source.collection.splice(source.collection.indexOf(destination.item) + (payload.hasAfter ? 1 : 0), 0, source.item);
            break;
        }
        case "delete":
        {
            for (const identifier of new Set(payload.ids))
            {
                const result = findItem(state, identifier);
                result.collection.splice(result.collection.indexOf(result.item), 1);
            }

            break;
        }
        case "ungroup":
        {
            const result = findItem(state, payload.id);

            if (result.item.kind !== "folder")
            {
                throw new Error("Choose a folder to ungroup.");
            }

            state.items.splice(state.items.indexOf(result.item), 1, ...result.item.children);
            break;
        }
        case "settings":
            state.settings = { ...state.settings, ...payload };
            break;
        case "import":
            state = validateState(payload.state);
            break;
        default:
            throw new Error("Unknown change requested.");
    }

    state.revision = currentState.revision + 1;
    return validateState(state);
}

export function isStartPageUrl(value)
{
    return typeof value === "string" && /^(opera|chrome):\/\/(startpage|startpageshared|newtab)\/?(?:[?#].*)?$/i.test(value);
}
