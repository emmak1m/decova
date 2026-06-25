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
        boundingBox: element.getBoundingClientRect(),
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
