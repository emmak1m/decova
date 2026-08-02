window.DecovaCapture = window.DecovaCapture || {};

(function (DC) {
  const RELEVANT_PROPS = [
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'color',
    'background-color',
    'background',
    'border',
    'border-radius',
    'padding',
    'margin',
    'width',
    'height',
    'display',
    'flex-direction',
    'align-items',
    'justify-content',
    'gap',
    'box-shadow',
    'opacity',
    'position',
    'z-index',
    'transform',
    'transition',
  ];

  const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'br', 'hr', 'wbr']);

  function formatElementLabel(el) {
    const tag = el.tagName.toLowerCase();
    const cls = el.classList?.[0];
    if (cls && /motion|framer/i.test(cls)) return cls;
    if (el.id) return `#${el.id}`;
    if (cls) return `.${cls}`;
    return tag;
  }

  function isMeaningfulChild(el) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return false;
    const { type } = classifyElement(el);
    if (type !== 'element') return true;
    if (/^h[1-6]$/.test(tag) || tag === 'p' || tag === 'button' || tag === 'a') return true;
    return el.children.length === 0;
  }

  function collectNestedChildren(root, limit = 8) {
    const found = [];
    const walk = (node, depth) => {
      if (depth > 5 || found.length >= limit) return;
      for (const child of node.children) {
        if (found.length >= limit) return;
        const tag = child.tagName.toLowerCase();
        if (SKIP_TAGS.has(tag)) continue;
        if (isMeaningfulChild(child)) {
          const { type, badgeLabel } = classifyElement(child);
          found.push({
            tag,
            type,
            badgeLabel,
            label: formatElementLabel(child),
          });
        }
        walk(child, depth + 1);
      }
    };
    walk(root, 0);
    return found;
  }

  function analyzeNestedContent(el) {
    const children = collectNestedChildren(el);
    const primaryLabel = formatElementLabel(el);
    return {
      primaryLabel,
      nestedChildren: children,
      extraCount: children.length,
    };
  }

  function classifyElement(el) {
    const tag = el.tagName.toLowerCase();
    if (
      tag === 'button' ||
      el.getAttribute('role') === 'button' ||
      (tag === 'input' && ['button', 'submit'].includes(el.type)) ||
      (tag === 'a' && /btn|button/i.test(el.className?.toString?.() || ''))
    ) {
      return { type: 'button', badgeLabel: 'Button' };
    }
    if (tag === 'svg' || tag === 'img' || (tag === 'i' && /icon/i.test(el.className?.toString?.() || ''))) {
      return { type: 'icon', badgeLabel: 'Icon' };
    }
    if (/^h[1-6]$/.test(tag) || tag === 'p' || (tag === 'span' && el.children.length === 0)) {
      return { type: 'text', badgeLabel: 'Tag' };
    }
    return { type: 'element', badgeLabel: 'Element' };
  }

  function truncateHtml(html, maxDepth = 3) {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const walk = (node, depth) => {
      if (depth >= maxDepth && node.nodeType === 1 && node.children.length) {
        const ellipsis = document.createComment('…');
        while (node.firstChild) node.removeChild(node.firstChild);
        node.appendChild(ellipsis);
        return;
      }
      [...node.children].forEach((c) => walk(c, depth + 1));
    };
    walk(wrap, 0);
    return wrap.innerHTML;
  }

  function extractCssVariables(el) {
    const vars = {};
    try {
      const computed = window.getComputedStyle(el);
      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        if (prop.startsWith('--')) {
          vars[prop] = computed.getPropertyValue(prop).trim();
        }
      }
    } catch {
      /* cross-origin stylesheets */
    }
    return vars;
  }

  function stylesToCode(styles, variables) {
    const lines = Object.entries(styles)
      .filter(([, v]) => v && v !== 'none' && v !== 'normal')
      .map(([k, v]) => `${k}: ${v};`);
    const varLines = Object.entries(variables).map(([k, v]) => `${k}: ${v};`);
    return [...lines, ...varLines].join('\n');
  }

  const PREVIEW_PROPS = [
    'display', 'position', 'box-sizing',
    'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'align-content', 'gap',
    'flex-grow', 'flex-shrink', 'flex-basis',
    'grid-template-columns', 'grid-template-rows', 'grid-auto-flow',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'padding',
    'border', 'border-radius', 'border-color', 'border-width', 'border-style',
    'background', 'background-color', 'background-image', 'background-size',
    'background-position', 'background-repeat',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'text-align', 'text-decoration', 'text-transform', 'white-space',
    'text-overflow', 'overflow',
    'box-shadow', 'opacity', 'object-fit', 'object-position', 'vertical-align',
    'list-style', 'outline', 'transform', 'z-index',
  ];

  const SKIP_PREVIEW_TAGS = new Set(['script', 'noscript', 'template']);

  function styleStringFor(el) {
    const computed = window.getComputedStyle(el);
    const lines = [];
    PREVIEW_PROPS.forEach((prop) => {
      const val = computed.getPropertyValue(prop);
      if (val) lines.push(`${prop}: ${val}`);
    });
    return lines.join('; ');
  }

  function resolveUrlAttr(node, attr) {
    const val = node.getAttribute(attr);
    if (!val) return;
    try {
      node.setAttribute(attr, new URL(val, location.href).href);
    } catch {
      /* leave as-is */
    }
  }

  function sanitizeForPreview(node) {
    [...node.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
    });
    resolveUrlAttr(node, 'src');
    resolveUrlAttr(node, 'href');
    if (node.hasAttribute('srcset')) node.removeAttribute('srcset');
  }

  DC.buildPreviewHtml = (element) => {
    if (!element) return '';
    const originals = [element, ...element.querySelectorAll('*')];
    const clone = element.cloneNode(true);
    const clones = [clone, ...clone.querySelectorAll('*')];

    originals.forEach((orig, i) => {
      const node = clones[i];
      if (!node) return;
      if (SKIP_PREVIEW_TAGS.has(node.tagName?.toLowerCase())) {
        node.remove();
        return;
      }
      node.setAttribute('style', styleStringFor(orig));
      sanitizeForPreview(node);
    });

    return clone.outerHTML;
  };

  DC.extractElement = (element, index) => {
    const { type, badgeLabel } = classifyElement(element);
    const computed = window.getComputedStyle(element);
    const styles = {};
    RELEVANT_PROPS.forEach((prop) => {
      const val = computed.getPropertyValue(prop);
      if (val) styles[prop] = val;
    });
    const variables = extractCssVariables(element);
    const html = element.outerHTML;
    const label =
      element.id
        ? `#${element.id}`
        : element.classList?.[0]
          ? `.${element.classList[0]}`
          : element.tagName.toLowerCase();

    const nested = analyzeNestedContent(element);
    const rect = element.getBoundingClientRect();

    return {
      id: `capture_${String(index + 1).padStart(3, '0')}`,
      type,
      badgeLabel,
      label,
      tagName: element.tagName.toLowerCase(),
      primaryLabel: nested.primaryLabel,
      nestedChildren: nested.nestedChildren,
      nestedExtraCount: nested.extraCount,
      html,
      htmlPreview: truncateHtml(html),
      previewHtml: DC.buildPreviewHtml(element),
      css: styles,
      variables,
      code: stylesToCode(styles, variables),
      selector: element.id
        ? `#${CSS.escape(element.id)}`
        : `${element.tagName.toLowerCase()}${element.classList?.[0] ? `.${CSS.escape(element.classList[0])}` : ''}`,
      meta: {
        tagName: element.tagName.toLowerCase(),
        id: element.id || null,
        classList: [...element.classList],
        childCount: element.children.length,
        nestedExtraCount: nested.extraCount,
        textContent: (element.textContent || '').trim().slice(0, 120),
        boundingBox: { width: rect.width, height: rect.height },
        screenshot: null,
      },
    };
  };

  DC.extractAll = (elements) => elements.map((el, i) => DC.extractElement(el, i));

  DC.peekElement = (element) => {
    const { type, badgeLabel } = classifyElement(element);
    const nested = analyzeNestedContent(element);
    return {
      type,
      badgeLabel,
      label: nested.primaryLabel || formatElementLabel(element),
      primaryLabel: nested.primaryLabel,
      nestedExtraCount: nested.extraCount,
      tagName: element.tagName.toLowerCase(),
    };
  };
})(window.DecovaCapture);
