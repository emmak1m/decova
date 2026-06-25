(function () {
  if (window.__DECOVA_CONTENT_BOUND) return;
  window.__DECOVA_CONTENT_BOUND = true;

  let capturePanelHost = null;
  let previewPanelHost = null;
  let previewBackdrop = null;

  function showToast(message) {
    let host = document.querySelector('.capture-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'capture-toast-host';
      document.body.appendChild(host);
    }
    host.innerHTML = `<div class="capture-toast">${message}</div>`;
    const toast = host.firstElementChild;
    requestAnimationFrame(() => toast.classList.add('capture-toast--visible'));
    setTimeout(() => {
      toast.classList.remove('capture-toast--visible');
      setTimeout(() => host.remove(), 200);
    }, 2200);
  }

  function openCapturePanel() {
    if (capturePanelHost) return;
    capturePanelHost = document.createElement('div');
    capturePanelHost.className = 'capture-panel-host capture-panel-host--capture';
    capturePanelHost.id = 'decova-capture-panel-root';

    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('capture/capture-panel.html');
    iframe.title = 'Capture Panel';
    capturePanelHost.appendChild(iframe);

    document.body.appendChild(capturePanelHost);
    iframe.addEventListener('load', () => {
      const session = window.DecovaCapture?.activeSession;
      if (session?.state?.selected) {
        window.DecovaCapture?.notifyCapturePanel?.(session.state.selected);
      }
    });
    requestAnimationFrame(() => capturePanelHost.classList.add('capture-panel-host--open'));
  }

  function closeCapturePanel() {
    capturePanelHost?.remove();
    capturePanelHost = null;
  }

  function openPreviewPanel() {
    if (previewPanelHost) return;
    previewBackdrop = document.createElement('div');
    previewBackdrop.className = 'capture-backdrop';
    previewBackdrop.addEventListener('click', closePreviewPanel);

    previewPanelHost = document.createElement('div');
    previewPanelHost.className = 'capture-panel-host';
    previewPanelHost.id = 'capture-panel-root';

    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('panel/panel.html');
    iframe.title = 'Capture Preview Panel';
    previewPanelHost.appendChild(iframe);

    document.body.appendChild(previewBackdrop);
    document.body.appendChild(previewPanelHost);

    requestAnimationFrame(() => {
      previewBackdrop.classList.add('capture-backdrop--visible');
      previewPanelHost.classList.add('capture-panel-host--open');
    });
  }

  function closePreviewPanel() {
    if (previewBackdrop) {
      previewBackdrop.classList.remove('capture-backdrop--visible');
      setTimeout(() => previewBackdrop?.remove(), 120);
      previewBackdrop = null;
    }
    previewPanelHost?.remove();
    previewPanelHost = null;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ ok: true, ready: !!window.DecovaCapture });
      return true;
    }

    if (message.action === 'startCaptureMode' || message.type === 'START_CAPTURE_MODE') {
      (async () => {
        try {
          if (!window.DecovaCapture?.startCaptureMode) {
            sendResponse({
              ok: false,
              error: 'Capture module not loaded. Refresh the page and try again.',
            });
            return;
          }
          await window.DecovaCapture.startCaptureMode();
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: err?.message || String(err) });
        }
      })();
      return true;
    }

    if (message.type === 'OPEN_PREVIEW_PANEL') {
      closeCapturePanel();
      openPreviewPanel();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'CLOSE_PREVIEW_PANEL') {
      closePreviewPanel();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'SHOW_TOAST') {
      showToast(message.message || 'Saved successfully');
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'CAPTURE_CLOSE_PANEL') closePreviewPanel();
    if (event.data?.type === 'CAPTURE_PANEL_CLOSE') {
      window.DecovaCapture?.stopCaptureMode?.();
      closeCapturePanel();
    }
    if (event.data?.type === 'CAPTURE_PANEL_RESELECT') {
      const session = window.DecovaCapture?.activeSession;
      if (!session) return;
      session.selected?.forEach((s) => {
        s.stopTrack?.();
        session.highlighter?.removeSelected(s.box);
      });
      session.state.selected = [];
      session.selected = session.state.selected;
      window.DecovaCapture?.notifyCapturePanel?.([]);
      session.selector?.updateActionBar?.();
    }
    if (event.data?.type === 'CAPTURE_PANEL_CONTINUE') {
      window.DecovaCapture?.bus?.emit('confirm', {
        selected: (window.DecovaCapture?.activeSession?.state?.selected || []).map(
          (s) => s.element,
        ),
      });
    }
  });

  window.__decovaOpenPanel = openPreviewPanel;
  window.__decovaClosePanel = closePreviewPanel;
  window.__decovaOpenCapturePanel = openCapturePanel;
  window.__decovaCloseCapturePanel = closeCapturePanel;
})();
