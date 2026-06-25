window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  DC.TOKENS_CSS = `
    :host {
      --accent-blue: #1a73e8;
      --accent-green: #34a853;
      --bg-elevated: #ffffff;
      --text-muted: #9aa0a6;
      --text-primary: #202124;
      all: initial;
      font-family: 'Google Sans', system-ui, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
  `;

  DC.INJECTED_STYLE_ID = 'decova-capture-body-style';
  DC.PANEL_ROOT_ID = 'capture-panel-root';

  DC.isRootElement = (el) => {
    if (!el) return true;
    const tag = el.tagName?.toLowerCase();
    return tag === 'html' || tag === 'body' || el === document.documentElement;
  };

  DC.isOurElement = (el) => {
    if (!el) return false;
    return !!(
      el.closest?.('#decova-capture-host') ||
      el.closest?.('#decova-capture-panel-root') ||
      el.closest?.(`#${DC.PANEL_ROOT_ID}`) ||
      el.closest?.('.capture-toast-host') ||
      el.closest?.('.capture-panel-host') ||
      el.closest?.('.capture-backdrop')
    );
  };

  DC.getElementAtPoint = (x, y) => {
    const host = document.getElementById('decova-capture-host');
    const panel = document.getElementById(DC.PANEL_ROOT_ID);
    const capturePanel = document.getElementById('decova-capture-panel-root');
    const hidden = [];

    [host, panel, capturePanel].forEach((node) => {
      if (node) {
        hidden.push([node, node.style.visibility]);
        node.style.visibility = 'hidden';
      }
    });

    let el = null;
    try {
      const stack = document.elementsFromPoint(x, y);
      for (const candidate of stack) {
        if (DC.isOurElement(candidate)) continue;
        let node = candidate;
        while (node && (DC.isRootElement(node) || DC.isOurElement(node))) {
          node = node.parentElement;
        }
        if (node && !DC.isRootElement(node) && !DC.isOurElement(node)) {
          el = candidate;
          break;
        }
      }
      if (!el) {
        el = document.elementFromPoint(x, y);
        while (el && (DC.isRootElement(el) || DC.isOurElement(el))) {
          el = el.parentElement;
        }
      }
    } finally {
      hidden.forEach(([node, vis]) => {
        node.style.visibility = vis || 'visible';
      });
    }

    if (!el || DC.isRootElement(el) || DC.isOurElement(el)) return null;
    return el;
  };

  DC.formatTagLabel = (el) => {
    if (!el) return '';
    return `<${el.tagName.toLowerCase()}>`;
  };

  DC.formatBreadcrumb = (el) => {
    const parts = [];
    if (el.tagName) parts.push({ type: 'tag', text: el.tagName.toLowerCase() });
    if (el.id) parts.push({ type: 'id', text: `#${el.id}` });
    const cls = [...(el.classList || [])][0];
    if (cls) parts.push({ type: 'class', text: `.${cls}` });
    return parts;
  };

  DC.findSectionAncestor = (el) => {
    let node = el;
    const sectionTags = new Set(['section', 'article', 'nav', 'header', 'footer', 'main', 'aside']);
    while (node && !DC.isRootElement(node)) {
      if (sectionTags.has(node.tagName?.toLowerCase()) || node.id) return node;
      node = node.parentElement;
    }
    return el;
  };

  DC.enforceMinRect = (rect) => {
    const minH = 24;
    let { top, left, width, height } = rect;
    if (height < minH) {
      const diff = minH - height;
      top -= diff / 2;
      height = minH;
    }
    return { top, left, width, height };
  };

  DC.bus = {
    listeners: {},
    on(evt, fn) {
      (this.listeners[evt] = this.listeners[evt] || []).push(fn);
    },
    emit(evt, data) {
      (this.listeners[evt] || []).forEach((fn) => fn(data));
    },
    off(evt, fn) {
      this.listeners[evt] = (this.listeners[evt] || []).filter((f) => f !== fn);
    },
  };

  DC.elementThumbs = new WeakMap();

  DC.notifyCapturePanel = (selectedEntries) => {
    const iframe = document.querySelector('#decova-capture-panel-root iframe');
    if (!iframe?.contentWindow) return;
    const items = selectedEntries.map((s) => DC.peekElement(s.element));
    iframe.contentWindow.postMessage({ type: 'CAPTURE_SELECTION_UPDATE', items }, '*');
  };
})(window.DecovaCapture);
