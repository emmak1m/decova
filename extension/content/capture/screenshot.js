window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  const cache = {
    image: null,
    dpr: 1,
    timer: null,
    busy: false,
    lastAt: 0,
  };

  const MAX_THUMB_W = 1280;
  const MAX_THUMB_H = 960;

  function cropImage(img, rect, dpr) {
    const scale = dpr || window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    const sx = Math.max(0, Math.round(rect.left * scale));
    const sy = Math.max(0, Math.round(rect.top * scale));
    const sw = Math.max(1, Math.min(Math.round(rect.width * scale), img.width - sx));
    const sh = Math.max(1, Math.min(Math.round(rect.height * scale), img.height - sy));
    let outW = sw;
    let outH = sh;
    if (outW > MAX_THUMB_W || outH > MAX_THUMB_H) {
      const r = Math.min(MAX_THUMB_W / outW, MAX_THUMB_H / outH);
      outW = Math.round(outW * r);
      outH = Math.round(outH * r);
    }
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    return canvas.toDataURL('image/png');
  }

  async function fetchTabScreenshot() {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_TAB_SCREENSHOT' });
    if (response?.error) throw new Error(response.error);
    if (!response?.dataUrl) return null;

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = response.dataUrl;
    });
    return img;
  }

  function hideOverlayForCapture() {
    const host = document.getElementById('decova-capture-host');
    if (host) host.style.setProperty('display', 'none', 'important');
    const bodyStyle = document.getElementById(DC.INJECTED_STYLE_ID);
    if (bodyStyle) bodyStyle.disabled = true;
  }

  function restoreOverlayAfterCapture() {
    const host = document.getElementById('decova-capture-host');
    if (host) host.style.removeProperty('display');
    const bodyStyle = document.getElementById(DC.INJECTED_STYLE_ID);
    if (bodyStyle) bodyStyle.disabled = false;
  }

  function waitForCleanFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 60);
        });
      });
    });
  }

  DC.startScreenshotCache = () => {
    DC.stopScreenshotCache();
    const tick = async () => {
      if (cache.busy) return;
      cache.busy = true;
      try {
        const img = await fetchTabScreenshot();
        if (img) {
          cache.image = img;
          cache.dpr = window.devicePixelRatio || 1;
          cache.lastAt = Date.now();
        }
      } catch {
        /* activeTab may be unavailable until user interacts */
      } finally {
        cache.busy = false;
      }
    };
    tick();
    cache.timer = setInterval(tick, 300);
  };

  DC.stopScreenshotCache = () => {
    if (cache.timer) clearInterval(cache.timer);
    cache.timer = null;
    cache.image = null;
  };

  DC.invalidateScreenshotCache = () => {
    cache.image = null;
    cache.lastAt = 0;
  };

  DC.cropRect = async (rect) => {
    if (!rect || rect.width < 1 || rect.height < 1) return null;

    if (cache.image && Date.now() - cache.lastAt < 2000) {
      try {
        return cropImage(cache.image, rect, cache.dpr);
      } catch {
        /* fall through */
      }
    }

    try {
      const img = await fetchTabScreenshot();
      if (!img) return null;
      cache.image = img;
      cache.dpr = window.devicePixelRatio || 1;
      cache.lastAt = Date.now();
      return cropImage(img, rect, cache.dpr);
    } catch {
      return null;
    }
  };

  DC.captureElementPreview = async (el) => {
    if (!el?.getBoundingClientRect) return null;
    const existing = DC.elementThumbs.get(el);
    if (existing) return existing;
    const rect = el.getBoundingClientRect();
    const thumb = await DC.cropRect(rect);
    if (thumb) DC.elementThumbs.set(el, thumb);
    return thumb;
  };

  DC.cropScreenshot = (rect) => DC.cropRect(rect);

  DC.attachThumbnails = async (items, elements) => {
    for (const el of elements) {
      DC.elementThumbs.delete(el);
    }

    DC.stopScreenshotCache();

    const rects = elements.map((el) =>
      el?.getBoundingClientRect
        ? el.getBoundingClientRect()
        : null,
    );

    hideOverlayForCapture();
    await waitForCleanFrame();

    let img;
    const dpr = window.devicePixelRatio || 1;
    try {
      img = await fetchTabScreenshot();
    } catch {
      /* capture may be unavailable */
    } finally {
      restoreOverlayAfterCapture();
    }

    if (!img) return items;

    for (let i = 0; i < items.length; i++) {
      const rect = rects[i];
      if (!rect || rect.width < 1 || rect.height < 1) continue;
      const thumb = cropImage(img, rect, dpr);
      if (thumb) {
        DC.elementThumbs.set(elements[i], thumb);
        items[i].meta.screenshot = thumb;
        items[i].thumbnail = thumb;
      }
    }
    return items;
  };
})(window.DecovaCapture);
