window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  DC.createSelector = (ui, state) => {
    const { overlayEl, actionBarEl, highlighter, cursor, hintsEl, hoverPreview, countEl } = ui;

    function updateHints() {
      DC.renderKeyboardHints?.(hintsEl, state.selected.length);
    }

    function updateSelectionCount() {
      DC.renderSelectionCount?.(countEl, state.selected.length);
    }

    function confirmCapture() {
      if (!state.selected.length) {
        DC.showToast(
          ui.toastEl,
          'Select one or more elements, then press Enter',
          2200,
        );
        return;
      }
      DC.bus.emit('confirm', { selected: state.selected.map((s) => s.element) });
    }

    function updateActionBar() {
      updateHints();
      updateSelectionCount();
      window.DecovaCapture?.notifyCapturePanel?.(state.selected);
    }

    function isSelected(el) {
      return state.selected.some((s) => s.element === el);
    }

    function toggleSelect(el) {
      const idx = state.selected.findIndex((s) => s.element === el);
      if (idx >= 0) {
        highlighter.removeSelected(state.selected[idx].box);
        state.selected.splice(idx, 1);
        state.selected.forEach((s, i) => {
          const numerals = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
          const badge = s.box.querySelector('.capture-highlight__badge');
          if (badge) badge.textContent = numerals[i] || String(i + 1);
        });
      } else {
        const box = highlighter.addSelected(el, state.selected.length);
        const stopTrack = highlighter.trackPosition(el, box);
        state.selected.push({ element: el, box, stopTrack });
        cursor.pulse();
        DC.captureElementPreview(el).catch(() => {});
      }
      updateActionBar();
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      const el = state.hoverTarget;
      if (!el) return;
      if (state.inIframe) {
        DC.showToast(ui.toastEl, 'Cannot capture cross-origin iframes');
        return;
      }
      toggleSelect(el);
    }

    function onMouseMove(e) {
      e.preventDefault();
      e.stopPropagation();
      const x = e.clientX;
      const y = e.clientY;
      cursor.move(x, y);

      let el = DC.getElementAtPoint(x, y);
      if (e.altKey && el) el = DC.findSectionAncestor(el);

      state.inIframe = false;
      if (el?.ownerDocument !== document) {
        state.inIframe = true;
        state.hoverTarget = null;
        highlighter.clearHover();
        cursor.setHovering(false);
        return;
      }

      state.hoverTarget = el;
      if (el) {
        highlighter.setHoverTarget(el);
        cursor.setHovering(true);
        hoverPreview?.schedule(el, x, y);
      } else {
        highlighter.clearHover();
        cursor.setHovering(false);
        hoverPreview?.hide();
      }
    }

    function navigateHierarchy(direction) {
      let el = state.hoverTarget;
      if (!el) return;
      if (direction === 'up' && el.parentElement && !DC.isRootElement(el.parentElement)) {
        el = el.parentElement;
      } else if (direction === 'down' && el.firstElementChild) {
        el = el.firstElementChild;
      } else return;
      state.hoverTarget = el;
      highlighter.setHoverTarget(el);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        DC.bus.emit('cancel');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmCapture();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateHierarchy('up');
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateHierarchy('down');
      }
    }

    function onWheel(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY < 0) navigateHierarchy('up');
      else if (e.deltaY > 0) navigateHierarchy('down');
    }

    actionBarEl.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel') DC.bus.emit('cancel');
      if (action === 'confirm') confirmCapture();
    });

    return {
      bind() {
        updateHints();
        overlayEl.addEventListener('mousemove', onMouseMove, true);
        overlayEl.addEventListener('click', onClick, true);
        overlayEl.addEventListener('wheel', onWheel, { passive: false, capture: true });
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('scroll', () => {
          if (state.hoverTarget) highlighter.setHoverTarget(state.hoverTarget);
        }, true);
      },
      unbind() {
        overlayEl.removeEventListener('mousemove', onMouseMove, true);
        overlayEl.removeEventListener('click', onClick, true);
        overlayEl.removeEventListener('wheel', onWheel, true);
        window.removeEventListener('keydown', onKeyDown, true);
      },
      updateActionBar,
    };
  };
})(window.DecovaCapture);
