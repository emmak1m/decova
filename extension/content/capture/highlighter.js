window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  DC.createHighlighter = (container) => {
    let hoverBox = null;
    let rafId = null;

    function positionBox(box, el, options = {}) {
      if (!el) {
        box.style.display = 'none';
        return;
      }
      const raw = el.getBoundingClientRect();
      const rect = DC.enforceMinRect(raw);
      box.style.display = 'block';
      box.style.top = `${rect.top}px`;
      box.style.left = `${rect.left}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;

      const warn = box.querySelector('.capture-highlight__warn');
      if (warn) {
        const large = raw.width > window.innerWidth * 0.9 || raw.height > window.innerHeight * 0.85;
        warn.style.display = large && !options.selected ? 'block' : 'none';
      }
    }

    function createHoverBox() {
      const box = document.createElement('div');
      box.className = 'capture-highlight';
      box.innerHTML = `
        <div class="capture-highlight__warn">Large element — consider selecting a child</div>
      `;
      container.appendChild(box);
      return box;
    }

    function createSelectedBox(el, index) {
      const box = document.createElement('div');
      box.className = 'capture-highlight capture-highlight--selected';
      box.dataset.elementId = DC.getElementId?.(el) || String(index);
      const numerals = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
      box.innerHTML = `<span class="capture-highlight__badge">${numerals[index] || index + 1}</span>`;
      container.appendChild(box);
      return box;
    }

    return {
      setHoverTarget(el) {
        if (!hoverBox) hoverBox = createHoverBox();
        positionBox(hoverBox, el);
      },
      clearHover() {
        if (hoverBox) hoverBox.style.display = 'none';
      },
      addSelected(el, index) {
        const box = createSelectedBox(el, index);
        positionBox(box, el, { selected: true });
        return box;
      },
      updateSelected(box, el) {
        positionBox(box, el, { selected: true });
      },
      removeSelected(box) {
        box?.remove();
      },
      trackPosition(el, box) {
        const tick = () => {
          if (el?.isConnected) positionBox(box, el, { selected: true });
          rafId = requestAnimationFrame(tick);
        };
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
      },
      trackHover(el) {
        const tick = () => {
          if (el?.isConnected && hoverBox) positionBox(hoverBox, el);
          else if (hoverBox) hoverBox.style.display = 'none';
          rafId = requestAnimationFrame(tick);
        };
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
      },
      destroy() {
        cancelAnimationFrame(rafId);
        hoverBox?.remove();
        hoverBox = null;
      },
    };
  };

  DC.getElementId = (() => {
    const map = new WeakMap();
    let n = 0;
    return (el) => {
      if (!map.has(el)) map.set(el, `el-${++n}`);
      return map.get(el);
    };
  })();
})(window.DecovaCapture);
