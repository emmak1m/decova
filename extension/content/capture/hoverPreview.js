window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  DC.createHoverPreview = (container) => {
    if (!container) {
      return { schedule() {}, hide() {}, destroy() {} };
    }
    const box = document.createElement('div');
    box.className = 'decova-hover-preview';
    box.hidden = true;
    box.innerHTML = '<img alt="Element preview" />';
    container.appendChild(box);

    const img = box.querySelector('img');
    let pending = null;
    let lastEl = null;

    return {
      async show(el, x, y) {
        if (!el) {
          box.hidden = true;
          lastEl = null;
          return;
        }
        lastEl = el;
        box.hidden = false;
        box.style.transform = 'none';
        box.style.left = '20px';
        box.style.right = 'auto';
        box.style.top = 'auto';
        box.style.bottom = '72px';

        const rect = el.getBoundingClientRect();
        const thumb = await DC.captureElementPreview(el);
        if (lastEl !== el) return;
        if (thumb) {
          img.src = thumb;
          img.alt = DC.formatTagLabel(el);
          box.classList.remove('decova-hover-preview--loading');
        } else {
          img.removeAttribute('src');
          box.classList.add('decova-hover-preview--loading');
        }

        const maxW = 300;
        const maxH = 200;
        const aspect = rect.width / Math.max(rect.height, 1);
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        box.style.width = `${Math.max(80, w)}px`;
      },
      hide() {
        box.hidden = true;
        lastEl = null;
        img.removeAttribute('src');
      },
      schedule(el, x, y) {
        clearTimeout(pending);
        if (!el) {
          this.hide();
          return;
        }
        pending = setTimeout(() => this.show(el, x, y), 60);
      },
      destroy() {
        clearTimeout(pending);
        box.remove();
      },
    };
  };
})(window.DecovaCapture);
