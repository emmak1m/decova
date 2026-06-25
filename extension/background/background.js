chrome.runtime.onInstalled.addListener(async () => {
  const { collections } = await chrome.storage.local.get('collections');
  if (!collections?.length) {
    await chrome.storage.local.set({
      collections: [
        { id: 'favorites', name: 'Favorites' },
        { id: 'portfolio', name: 'Portfolio' },
        { id: 'new-project', name: 'New Project' },
        { id: 'inspo', name: 'Inspo' },
      ],
      captures: [],
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'CAPTURE_TAB_SCREENSHOT') {
    (async () => {
      try {
        let windowId = sender.tab?.windowId;
        if (windowId == null) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          windowId = tab?.windowId;
        }
        if (windowId == null) {
          sendResponse({ error: 'No active window for screenshot' });
          return;
        }
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: 'png',
        });
        sendResponse({ dataUrl });
      } catch (err) {
        sendResponse({ error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message.type === 'OPEN_PREVIEW_PANEL') {
    (async () => {
      try {
        const tabId = sender.tab?.id;
        if (tabId) {
          await chrome.tabs.sendMessage(tabId, { type: 'OPEN_PREVIEW_PANEL' });
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  return false;
});
