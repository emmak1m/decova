const CAPTURE_SCRIPT_FILES = [
  'content/capture/shared.js',
  'content/capture/extractor.js',
  'content/capture/screenshot.js',
  'content/capture/hoverPreview.js',
  'content/capture/overlay.js',
  'content/capture/cursor.js',
  'content/capture/highlighter.js',
  'content/capture/selector.js',
  'content/capture/teardown.js',
  'content/capture/captureMode.js',
  'content/content.js',
];

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScripts(tabId) {
  let ping;
  try {
    ping = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch {
    ping = null;
  }

  if (ping?.ready && ping?.ok) return true;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: CAPTURE_SCRIPT_FILES,
  });
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content/content.css'],
  });

  const after = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  return !!(after?.ready && after?.ok);
}

function showError(msg) {
  const placeholder = document.getElementById('preview-placeholder');
  const countEl = document.getElementById('item-count');
  if (placeholder) placeholder.textContent = msg;
  if (countEl) countEl.textContent = 'Capture failed';
}

function initPopup() {
  const countEl = document.getElementById('item-count');
  const placeholder = document.getElementById('preview-placeholder');
  countEl.textContent = 'Ready to capture';
  placeholder.textContent = 'Nothing selected yet. Get capturing!';
}

document.getElementById('btn-close')?.addEventListener('click', () => window.close());

document.getElementById('btn-dashboard')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
});

document.getElementById('btn-confirm')?.addEventListener('click', async () => {
  const tab = await getActiveTab();
  const placeholder = document.getElementById('preview-placeholder');

  if (!tab?.id) {
    showError('No active tab found');
    return;
  }

  const url = tab.url || '';
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  ) {
    showError('Open a regular website (http/https) to capture');
    return;
  }

  try {
    const ready = await ensureContentScripts(tab.id);
    if (!ready) {
      showError('Could not load capture on this page. Refresh and try again.');
      return;
    }

    const res = await chrome.tabs.sendMessage(tab.id, {
      action: 'startCaptureMode',
      type: 'START_CAPTURE_MODE',
    });

    if (!res?.ok) {
      showError(res?.error || 'Failed to start capture mode');
      return;
    }

    window.close();
  } catch (err) {
    showError(err?.message || 'Failed to start capture');
  }
});

initPopup();
