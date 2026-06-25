export function parseCssCode(code) {
  const props = {};
  (code || '').split('\n').forEach((line) => {
    const m = line.match(/^([\w-]+)\s*:\s*(.+?);?\s*$/);
    if (m) props[m[1]] = m[2].trim();
  });
  return props;
}

export function cssToTailwind(props) {
  const parts = [];
  const map = {
    display: { flex: 'flex', block: 'block', grid: 'grid', inline: 'inline', 'inline-flex': 'inline-flex' },
    'flex-direction': { column: 'flex-col', row: 'flex-row' },
    'align-items': {
      center: 'items-center',
      'flex-start': 'items-start',
      'flex-end': 'items-end',
    },
    'justify-content': {
      center: 'justify-center',
      'flex-start': 'justify-start',
      'flex-end': 'justify-end',
      'space-between': 'justify-between',
    },
    'font-weight': {
      '400': 'font-normal',
      '500': 'font-medium',
      '600': 'font-semibold',
      '700': 'font-bold',
    },
    position: { relative: 'relative', absolute: 'absolute', fixed: 'fixed' },
  };

  Object.entries(props).forEach(([key, val]) => {
    if (map[key]?.[val]) {
      parts.push(map[key][val]);
      return;
    }
    if (key === 'font-size') {
      const px = parseFloat(val);
      if (px <= 12) parts.push('text-xs');
      else if (px <= 14) parts.push('text-sm');
      else if (px <= 16) parts.push('text-base');
      else if (px <= 18) parts.push('text-lg');
      else parts.push('text-xl');
      return;
    }
    if (key === 'opacity' && val === '1') return;
    if (key === 'gap' && val.endsWith('px')) parts.push(`gap-[${val}]`);
    if ((key === 'width' || key === 'height') && val.endsWith('px')) {
      parts.push(`${key === 'width' ? 'w' : 'h'}-[${val}]`);
    }
    if (key === 'padding' && val) parts.push(`p-[${val.replace(/\s+/g, '_')}]`);
    if (key === 'margin' && val) parts.push(`m-[${val.replace(/\s+/g, '_')}]`);
    if (key === 'border-radius' && val.endsWith('px')) parts.push(`rounded-[${val}]`);
    if (key === 'color' && val.startsWith('#')) parts.push(`text-[${val}]`);
    if (key === 'background-color' && val.startsWith('#')) parts.push(`bg-[${val}]`);
  });

  return parts.length ? parts.join(' ') : '/* No Tailwind mapping */';
}

export function formatElementTags(cap) {
  if (cap.primaryLabel && (cap.nestedExtraCount || 0) > 0) {
    return `${cap.primaryLabel} +${cap.nestedExtraCount}`;
  }
  if (cap.primaryLabel) return cap.primaryLabel;
  const tags = cap.htmlTags || [cap.tagName || cap.type].filter(Boolean);
  return tags.join(', ') || 'element';
}

export function getDetailSlides(cap) {
  if (!cap?.items?.length) {
    return [
      {
        type: 'single',
        name: cap.name,
        code: cap.code,
        thumbnail: cap.thumbnail,
        tagName: cap.tagName,
        primaryLabel: cap.primaryLabel,
        badgeLabel: cap.badgeLabel,
        elementType: cap.type,
        nestedExtraCount: cap.nestedExtraCount,
        nestedChildren: cap.nestedChildren,
      },
    ];
  }

  const slides = [
    {
      type: 'parent',
      name: cap.name,
      code: cap.code || cap.items[0]?.code,
      thumbnail: cap.thumbnail,
      tagName: cap.tagName || 'group',
      primaryLabel: cap.primaryLabel || 'group',
      badgeLabel: 'Group',
      elementType: 'group',
      items: cap.items,
      itemCount: cap.items.length,
    },
  ];

  cap.items.forEach((item, index) => {
    slides.push({
      type: 'child',
      index,
      name: item.label || item.primaryLabel || item.tagName || `Element ${index + 1}`,
      code: item.code,
      thumbnail: item.thumbnail || item.meta?.screenshot,
      tagName: item.tagName,
      primaryLabel: item.primaryLabel,
      badgeLabel: item.badgeLabel || item.type,
      elementType: item.type,
      nestedExtraCount: item.nestedExtraCount,
      nestedChildren: item.nestedChildren,
    });
  });

  return slides;
}

export function buildDetailSections(props) {
  const row = (label, value) =>
    value ? `<div class="detail-row"><span>${label}</span><span>${value}</span></div>` : '';

  return {
    typography: [
      row('Font', props['font-family']),
      row('Size', props['font-size']),
      row('Weight', props['font-weight']),
      row('Line height', props['line-height']),
      row('Letter spacing', props['letter-spacing'] || 'normal'),
      row('Align', props['text-align'] || 'left'),
    ].join(''),
    colors: [
      row('Text', props.color),
      row('Background', props['background-color'] || props.background),
      row('Border', props['border-color'] || props.border),
    ].join(''),
    layout: [
      row('Display', props.display),
      row('Padding', props.padding),
      row('Margin', props.margin),
      row('Width', props.width),
      row('Height', props.height),
      row('Gap', props.gap),
      row('Flex direction', props['flex-direction']),
      row('Align items', props['align-items']),
      row('Justify content', props['justify-content']),
    ].join(''),
    effects: [
      row('Border radius', props['border-radius']),
      row('Border', props.border),
      row('Shadow', props['box-shadow'] || 'none'),
      row('Opacity', props.opacity || '1'),
    ].join(''),
  };
}
