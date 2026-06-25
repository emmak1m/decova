const els = {
  statusText: document.getElementById('status-text'),
  emptyState: document.getElementById('empty-state'),
  selectionSection: document.getElementById('selection-section'),
  itemsHeading: document.getElementById('items-heading'),
  itemList: document.getElementById('item-list'),
  selectedActions: document.getElementById('selected-actions'),
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tagBadgeClass(item) {
  const tag = (item.tagName || item.type || '').toLowerCase();
  if (item.type === 'button' || tag === 'button') return 'type-badge--tag-button';
  if (/^h[1-6]$/.test(tag)) return 'type-badge--tag-heading';
  if (tag === 'p' || tag === 'a' || tag === 'span' || tag === 'li' || item.type === 'text') {
    return 'type-badge--tag-text';
  }
  return 'type-badge--tag-generic';
}

function renderItemBadges(item) {
  const extra = item.nestedExtraCount || 0;
  const tag = (item.tagName || item.type || 'div').toLowerCase();
  let html = `<span class="type-badge type-badge--tag ${tagBadgeClass(item)}">${escapeHtml(`<${tag}>`)}</span>`;

  if (extra > 0) {
    html += `<span class="type-badge type-badge--more">+${extra}</span>`;
  }

  return html;
}

function renderSelection(items) {
  const n = items.length;

  if (n === 0) {
    els.emptyState.hidden = false;
    els.selectionSection.hidden = true;
    els.selectedActions.hidden = true;
    els.statusText.textContent = 'Ready to capture';
    return;
  }

  els.emptyState.hidden = true;
  els.selectionSection.hidden = false;
  els.selectedActions.hidden = false;
  els.statusText.textContent = 'Ready to capture';
  els.itemsHeading.textContent = `${n} Item(s) Selected`;

  els.itemList.innerHTML = items
    .map(
      (item, i) => `
      <div class="list-row" data-index="${i}">
        <span class="capture-checkbox capture-checkbox--checked"></span>
        <span class="list-row__chevron">›</span>
        <span class="list-row__label">${escapeHtml(item.label || `Element ${i + 1}`)}</span>
        <span class="item-row__badges">${renderItemBadges(item)}</span>
      </div>`,
    )
    .join('');
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'CAPTURE_SELECTION_UPDATE') {
    renderSelection(event.data.items || []);
  }
});

document.getElementById('btn-close')?.addEventListener('click', () => {
  window.parent.postMessage({ type: 'CAPTURE_PANEL_CLOSE' }, '*');
});

document.getElementById('btn-dashboard')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
});

document.getElementById('btn-recapture')?.addEventListener('click', () => {
  window.parent.postMessage({ type: 'CAPTURE_PANEL_RESELECT' }, '*');
});

document.getElementById('btn-continue')?.addEventListener('click', () => {
  window.parent.postMessage({ type: 'CAPTURE_PANEL_CONTINUE' }, '*');
});

renderSelection([]);
