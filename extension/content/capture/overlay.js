window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  DC.createOverlay = () => {
    const host = document.createElement('div');
    host.id = 'decova-capture-host';
    host.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';

    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = DC.TOKENS_CSS + DC.OVERLAY_STYLES;
    shadow.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'decova-overlay';
    overlay.innerHTML = `
      <div class="decova-layer" id="decova-overlay"></div>
      <div id="decova-highlights"></div>
      <div id="decova-cursor-root"></div>
      <div id="decova-hover-preview-root"></div>
      <div id="decova-action-bar" hidden></div>
      <div class="decova-toast" id="decova-toast"></div>
      <div class="decova-kbd-hints" id="decova-kbd-hints" aria-live="polite"></div>
      <div class="decova-selection-count" id="decova-selection-count" aria-live="polite" hidden></div>
    `;
    shadow.appendChild(overlay);

    document.body.appendChild(host);

    const bodyStyle = document.createElement('style');
    bodyStyle.id = DC.INJECTED_STYLE_ID;
    bodyStyle.textContent =
      'body { overflow: hidden !important; } html { overflow: hidden !important; }';
    document.documentElement.appendChild(bodyStyle);

    return {
      host,
      shadow,
      overlayEl: shadow.getElementById('decova-overlay'),
      highlightsEl: shadow.getElementById('decova-highlights'),
      cursorRoot: shadow.getElementById('decova-cursor-root'),
      hoverPreviewRoot: shadow.getElementById('decova-hover-preview-root'),
      actionBarEl: shadow.getElementById('decova-action-bar'),
      toastEl: shadow.getElementById('decova-toast'),
      hintsEl: shadow.getElementById('decova-kbd-hints'),
      countEl: shadow.getElementById('decova-selection-count'),
    };
  };

  DC.renderSelectionCount = (countEl, n = 0) => {
    if (!countEl) return;
    if (n > 0) {
      countEl.hidden = false;
      countEl.textContent = `${n} item(s) selected`;
    } else {
      countEl.hidden = true;
      countEl.textContent = '';
    }
  };

  DC.renderKeyboardHints = (hintsEl, selectedCount = 0) => {
    if (!hintsEl) return;
    const enterReady = selectedCount > 0;
    hintsEl.innerHTML = `
      <span class="decova-hint"><kbd>Click</kbd> to select elements</span>
      <span class="decova-hint-sep">·</span>
      <span class="decova-hint"><kbd>↑</kbd><kbd>↓</kbd> parent / child</span>
      <span class="decova-hint-sep">·</span>
      <span class="decova-hint decova-hint--enter ${enterReady ? 'decova-hint--ready' : ''}">
        <kbd>Enter</kbd> ${enterReady ? 'open preview' : 'select items first'}
      </span>
      <span class="decova-hint-sep">·</span>
      <span class="decova-hint"><kbd>Esc</kbd> to exit</span>
    `;
  };

  DC.OVERLAY_STYLES = `
    .decova-overlay { position: fixed; inset: 0; pointer-events: none; }
    .decova-layer {
      position: fixed; inset: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.28); cursor: default; pointer-events: all; z-index: 1;
    }
    .decova-toast {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%) translateY(-8px);
      padding: 10px 16px; background: #fff; color: #202124;
      font: 400 12px 'Google Sans', sans-serif; border-radius: 8px;
      border: 1px solid #dadce0;
      box-shadow: 0 4px 24px rgba(60, 64, 67, 0.15); opacity: 0; transition: opacity 180ms ease, transform 180ms ease;
      pointer-events: none; z-index: 10; white-space: nowrap;
    }
    .decova-toast--visible { opacity: 1; transform: translateX(-50%) translateY(0); }
    .decova-kbd-hints {
      position: fixed; bottom: 16px; left: 16px; right: 220px;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 6px;
      font: 400 10px 'Google Sans', sans-serif; color: #5f6368; pointer-events: none; z-index: 10;
    }
    .decova-selection-count {
      position: fixed; bottom: 16px; right: 16px;
      padding: 10px 16px; background: #fff; color: #202124;
      font: 500 14px 'Google Sans', sans-serif;
      border: 1px solid #d0d0d0; border-radius: 8px;
      box-shadow: 0 4px 24px rgba(60, 64, 67, 0.15);
      pointer-events: none; z-index: 11; white-space: nowrap;
    }
    .decova-selection-count[hidden] { display: none !important; }
    .decova-hint { display: inline-flex; align-items: center; gap: 4px; }
    .decova-hint-sep { color: #9aa0a6; }
    .decova-hint kbd {
      display: inline-block; padding: 2px 5px; border-radius: 4px;
      background: #fff; border: 1px solid #dadce0; color: #202124;
      font: 500 9px 'Google Sans', sans-serif; line-height: 1.2;
    }
    .decova-hint--enter kbd { color: #80868b; border-color: #dadce0; }
    .decova-hint--ready { color: #202124; }
    .decova-hint--ready kbd { color: #fff; border-color: #1a73e8; background: #1a73e8; }
    .decova-action-bar {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 12px; padding: 10px 14px;
      background: #333; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      font-family: 'Google Sans', sans-serif; z-index: 10; pointer-events: all;
    }
    .decova-action-bar[hidden] { display: none !important; }
    .decova-action-bar__count { font-size: 12px; color: #a0a0a0; min-width: 100px; text-align: center; }
    .decova-action-bar__cancel {
      border: none; background: transparent; color: #a0a0a0; font-size: 12px; cursor: pointer; padding: 6px 8px;
    }
    .decova-action-bar__cancel:hover { color: #fff; }
    .decova-action-bar__confirm {
      border: none; background: #2979ff; color: #fff; font-weight: 500; font-size: 13px;
      padding: 8px 16px; border-radius: 6px; cursor: pointer;
    }
    .decova-action-bar__confirm:hover { filter: brightness(0.92); }
    .decova-action-bar__confirm kbd {
      margin-left: 4px; padding: 1px 4px; border-radius: 3px;
      background: rgba(255,255,255,0.15); font: 500 10px 'Google Sans Mono', monospace;
    }
    .capture-highlight {
      position: fixed; border: 2px solid #1a73e8;
      background: rgba(26, 115, 232, 0.08); border-radius: 4px;
      pointer-events: none; z-index: 2;
      transition: top 60ms ease, left 60ms ease, width 60ms ease, height 60ms ease;
      box-shadow: 0 0 0 1px rgba(26, 115, 232, 0.2);
    }
    .capture-highlight--selected {
      border-color: #34a853; background: rgba(52, 168, 83, 0.08);
      transition: border-color 150ms ease, background 150ms ease;
    }
    .capture-highlight__check {
      position: absolute; top: 4px; right: 4px; width: 18px; height: 18px;
      background: #4caf50; border-radius: 50%; color: #fff; font-size: 11px;
      display: flex; align-items: center; justify-content: center; font-weight: 500;
    }
    .capture-highlight__badge {
      position: absolute; top: 4px; right: 4px; min-width: 18px; height: 18px;
      background: #4caf50; border-radius: 50%; color: #fff; font-size: 10px;
      display: flex; align-items: center; justify-content: center; font-weight: 500;
    }
    .capture-highlight__warn {
      position: absolute; bottom: 100%; left: 0; margin-bottom: 4px;
      font: 400 10px 'Google Sans', sans-serif; color: #e37400;
      background: #fff; border: 1px solid #dadce0; padding: 4px 8px; border-radius: 4px; white-space: nowrap;
      box-shadow: 0 1px 4px rgba(60, 64, 67, 0.1);
    }
    .decova-cursor-wrap {
      position: fixed; left: 0; top: 0; pointer-events: none; z-index: 5;
      will-change: transform;
    }
    .decova-cursor-wrap--snap { transition: transform 120ms ease; }
    .decova-pulse {
      position: absolute; width: 40px; height: 40px; margin: -20px 0 0 -20px;
      border: 2px solid #1a73e8; border-radius: 50%; opacity: 0.8;
      animation: decova-pulse 300ms ease-out forwards; pointer-events: none;
    }
    @keyframes decova-pulse {
      from { transform: scale(0.5); opacity: 0.8; }
      to { transform: scale(2); opacity: 0; }
    }
    .decova-hover-preview {
      position: fixed; left: 20px; bottom: 72px; top: auto; right: auto; z-index: 6; pointer-events: none;
      border-radius: 8px; overflow: hidden;
      background: #fff;
      border: 1px solid #dadce0;
      box-shadow: 0 4px 24px rgba(60, 64, 67, 0.15);
      transition: opacity 120ms ease;
    }
    .decova-hover-preview[hidden] { display: none !important; }
    .decova-hover-preview img {
      display: block; width: 100%; height: auto; max-height: 200px; object-fit: contain;
      background: #f8f9fa;
    }
    .decova-hover-preview--loading::after {
      content: 'Loading…'; display: block; padding: 24px; font: 11px 'Google Sans', sans-serif; color: #9aa0a6;
    }
  `;

  DC.showToast = (toastEl, message, duration = 2000) => {
    toastEl.textContent = message;
    toastEl.classList.add('decova-toast--visible');
    setTimeout(() => toastEl.classList.remove('decova-toast--visible'), duration);
  };
})(window.DecovaCapture);
