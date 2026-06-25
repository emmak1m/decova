window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  DC.createCursor = (root) => {
    const wrap = document.createElement('div');
    wrap.className = 'decova-cursor-wrap';
    wrap.innerHTML = `
      <svg class="decova-cursor-svg" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="10" fill="none" stroke="#2979FF" stroke-width="2"/>
        <circle cx="20" cy="20" r="1.5" fill="#2979FF"/>
        <line x1="20" y1="4" x2="20" y2="8" stroke="#2979FF" stroke-width="1.5"/>
        <line x1="20" y1="32" x2="20" y2="36" stroke="#2979FF" stroke-width="1.5"/>
        <line x1="4" y1="20" x2="8" y2="20" stroke="#2979FF" stroke-width="1.5"/>
        <line x1="32" y1="20" x2="36" y2="20" stroke="#2979FF" stroke-width="1.5"/>
      </svg>
      <span class="decova-cursor-label"></span>
    `;
    root.appendChild(wrap);
    const label = wrap.querySelector('.decova-cursor-label');
    const svg = wrap.querySelector('.decova-cursor-svg');

    return {
      el: wrap,
      move(x, y) {
        wrap.style.transform = `translate(${x}px, ${y}px)`;
      },
      setLabel(text) {
        label.textContent = text || '';
      },
      setHovering(active) {
        svg.style.transform = active ? 'scale(1.2)' : 'scale(1)';
        svg.style.transition = 'transform 120ms ease';
        wrap.classList.toggle('decova-cursor-wrap--snap', active);
      },
      pulse(x, y) {
        const ring = document.createElement('div');
        ring.className = 'decova-pulse';
        ring.style.left = '20px';
        ring.style.top = '20px';
        wrap.appendChild(ring);
        setTimeout(() => ring.remove(), 320);
      },
    };
  };
})(window.DecovaCapture);
