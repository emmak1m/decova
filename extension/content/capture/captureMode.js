window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  DC.startCaptureMode = async () => {
    if (DC.activeSession) DC.teardown(DC.activeSession);

    DC.startScreenshotCache?.();

    const ui = DC.createOverlay();
    const cursor = DC.createCursor(ui.cursorRoot);
    const highlighter = DC.createHighlighter(ui.highlightsEl);
    const hoverPreview = DC.createHoverPreview?.(ui.hoverPreviewRoot);

    const state = {
      hoverTarget: null,
      selected: [],
      inIframe: false,
    };

    const selector = DC.createSelector(
      { ...ui, highlighter, cursor, hoverPreview },
      state,
    );
    selector.bind();

    DC.renderKeyboardHints?.(ui.hintsEl, 0);
    DC.renderSelectionCount?.(ui.countEl, 0);

    const onCancel = () => DC.teardown(session);
    const onConfirm = async ({ selected: elements }) => {
      if (!elements?.length) return;

      let items = DC.extractAll(elements);
      try {
        items = await DC.attachThumbnails(items, elements);
      } catch (err) {
        console.warn('[Decova] thumbnail capture failed', err);
      }

      const scan = {
        items,
        thumbnail: items[0]?.thumbnail || null,
        url: location.href,
        title: document.title,
        scannedAt: Date.now(),
      };

      await chrome.storage.local.set({ pendingScan: scan });
      window.__decovaCloseCapturePanel?.();
      DC.teardown(session);

      if (typeof window.__decovaOpenPanel === 'function') {
        window.__decovaOpenPanel();
      } else {
        chrome.runtime.sendMessage({ type: 'OPEN_PREVIEW_PANEL' });
      }
    };

    const session = {
      ui,
      cursor,
      highlighter,
      hoverPreview,
      selector,
      state,
      selected: state.selected,
      onCancel,
      onConfirm,
    };
    DC.activeSession = session;

    DC.bus.on('cancel', onCancel);
    DC.bus.on('confirm', onConfirm);

    return session;
  };

  DC.stopCaptureMode = () => {
    if (DC.activeSession) DC.teardown(DC.activeSession);
  };
})(window.DecovaCapture);
