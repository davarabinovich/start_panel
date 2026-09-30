import { applyOperation, createDefaultState, isStartPageUrl, validateState } from "./model.js";

let operationQueue = Promise.resolve();
const redirectTabs = new Set();

async function readState()
{
    const result = await chrome.storage.local.get("panelState");

    if (result.panelState === undefined)
    {
        const state = createDefaultState();
        await chrome.storage.local.set({ panelState: state });
        return state;
    }

    return validateState(result.panelState);
}

async function processMessage(message)
{
    const state = await readState();

    if (message.action === "read")
    {
        return { isSuccessful: true, state };
    }

    if (message.revision !== state.revision)
    {
        return { isSuccessful: false, state, error: "Your panel changed in another tab. Review the current tiles, then try again." };
    }

    const nextState = applyOperation(state, message);
    await chrome.storage.local.set({ panelState: nextState });
    return { isSuccessful: true, state: nextState };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
{
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL("src/start_page.html")) || message?.channel !== "start_panel")
    {
        return false;
    }

    operationQueue = operationQueue.then(() => processMessage(message)).then(sendResponse).catch(error =>
    {
        sendResponse({ isSuccessful: false, error: error.message || "Unable to save your panel." });
    });
    return true;
});

function openPanel()
{
    chrome.tabs.create({ url: chrome.runtime.getURL("src/start_page.html") });
}

async function redirectStartPage(tabId, address)
{
    if (!isStartPageUrl(address) || redirectTabs.has(tabId))
    {
        return;
    }

    redirectTabs.add(tabId);

    try
    {
        const result = await chrome.storage.local.get("panelState");

        if (result.panelState?.settings?.hasStartPageRedirect === false)
        {
            return;
        }

        const tab = await chrome.tabs.get(tabId);

        if (isStartPageUrl(tab.pendingUrl || tab.url))
        {
            await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("src/start_page.html") });
        }
    }
    catch
    {
        // A closing tab or an Opera-protected start page cannot be redirected.
    }
    finally
    {
        redirectTabs.delete(tabId);
    }
}

chrome.action.onClicked.addListener(openPanel);
chrome.commands.onCommand.addListener(command =>
{
    if (command === "open_panel")
    {
        openPanel();
    }
});
chrome.tabs.onCreated.addListener(tab => redirectStartPage(tab.id, tab.pendingUrl || tab.url));
chrome.tabs.onUpdated.addListener((tabId, changes, tab) =>
{
    if (changes.url || changes.status === "loading")
    {
        redirectStartPage(tabId, tab.pendingUrl || changes.url || tab.url);
    }
});
