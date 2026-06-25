window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  DC.teardown = (session) => {
    if (!session) return;

    if (session.onCancel) DC.bus.off('cancel', session.onCancel);
    if (session.onConfirm) DC.bus.off('confirm', session.onConfirm);

    session.selector?.unbind();
    session.highlighter?.destroy();
    session.hoverPreview?.destroy();
    session.selected?.forEach((s) => {
      s.stopTrack?.();
      s.box?.remove();
    });
    session.ui?.host?.remove();
    document.getElementById(DC.INJECTED_STYLE_ID)?.remove();
    document.body.style.cursor = '';
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';

    DC.stopScreenshotCache?.();
    window.__decovaCloseCapturePanel?.();
    DC.activeSession = null;
  };
})(window.DecovaCapture);
