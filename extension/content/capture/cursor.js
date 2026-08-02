window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  DC.createCursor = (root) => {
    const wrap = document.createElement('div');
    wrap.className = 'decova-cursor-wrap';
    root.appendChild(wrap);

    return {
      el: wrap,
      move(x, y) {
        wrap.style.transform = `translate(${x}px, ${y}px)`;
      },
      setHovering(active) {
        wrap.classList.toggle('decova-cursor-wrap--snap', active);
      },
      pulse(x, y) {
        const ring = document.createElement('div');
        ring.className = 'decova-pulse';
        ring.style.left = '0';
        ring.style.top = '0';
        wrap.appendChild(ring);
        setTimeout(() => ring.remove(), 320);
      },
    };
  };
})(window.DecovaCapture);
