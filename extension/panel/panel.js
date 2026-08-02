import {
  getCollections,
  addCollection,
  saveCapture,
  getPendingScan,
  clearPendingScan,
  FAVORITES_COLLECTION_ID,
} from '../shared/storage.js';

const state = {
  items: [],
  selected: new Set(),
  saveMode: null,
  collectionIds: new Set(),
  captureName: '',
  itemNames: {},
  expanded: new Set(),
  creatingCollection: false,
  collectionOpen: false,
};

const els = {
  heading: document.getElementById('items-heading'),
  itemList: document.getElementById('item-list'),
  sectionSaveOptions: document.getElementById('section-save-options'),
  sectionSaveTo: document.getElementById('section-save-to'),
  captureName: document.getElementById('capture-name'),
  groupNameWrap: document.getElementById('group-name-wrap'),
  individualNames: document.getElementById('individual-names'),
  collectionList: document.getElementById('collection-list'),
  collectionDropdown: document.getElementById('collection-dropdown'),
  collectionTrigger: document.getElementById('collection-trigger'),
  collectionTriggerLabel: document.getElementById('collection-trigger-label'),
  collectionPanel: document.getElementById('collection-panel'),
  btnConfirm: document.getElementById('btn-confirm'),
  optIndividual: document.getElementById('opt-individual'),
  optGroup: document.getElementById('opt-group'),
  radioIndividual: document.getElementById('radio-individual'),
  radioGroup: document.getElementById('radio-group'),
  saveRequired: document.getElementById('save-required'),
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PREVIEW_FRAME_WIDTH = 300;
const PREVIEW_FRAME_MIN_HEIGHT = 60;
const PREVIEW_FRAME_MAX_HEIGHT = 320;

function previewScale(item) {
  const w = item.meta?.boundingBox?.width || 0;
  return w > PREVIEW_FRAME_WIDTH ? PREVIEW_FRAME_WIDTH / w : 1;
}

function previewFrameHeight(item) {
  const h = item.meta?.boundingBox?.height || 0;
  if (!h) return PREVIEW_FRAME_MIN_HEIGHT;
  const scaled = h * previewScale(item);
  return Math.round(Math.min(PREVIEW_FRAME_MAX_HEIGHT, Math.max(PREVIEW_FRAME_MIN_HEIGHT, scaled)));
}

function buildPreviewDoc(item) {
  const body = item.previewHtml || item.html || '';
  const scale = previewScale(item);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; padding: 0; background: #fff; }
    .decova-preview-scale { display: inline-block; transform: scale(${scale}); transform-origin: top left; }
  </style></head><body><div class="decova-preview-scale">${body}</div></body></html>`;
}

function renderItemPreview(item) {
  const height = previewFrameHeight(item);
  const doc = buildPreviewDoc(item);
  return `<iframe class="item-preview-frame" style="height:${height}px" sandbox="" srcdoc="${escapeHtml(doc)}"></iframe>`;
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

function tagBadgeLabel(item) {
  const tag = (item.tagName || item.type || 'div').toLowerCase();
  return `<${tag}>`;
}

function renderItemBadges(item) {
  const extra = item.nestedExtraCount || 0;
  let html = `<span class="type-badge type-badge--tag ${tagBadgeClass(item)}">${escapeHtml(tagBadgeLabel(item))}</span>`;

  if (extra > 0) {
    html += `<span class="type-badge type-badge--more">+${extra}</span>`;
  }

  return html;
}

function defaultItemName(item) {
  return item.label || item.primaryLabel || item.tagName || 'Untitled';
}

function renderItems() {
  const selectedCount = state.selected.size;
  const total = state.items.length;
  els.heading.textContent =
    selectedCount > 0
      ? `${selectedCount} Item(s) Selected`
      : `${total} Item(s) Detected`;

  els.itemList.innerHTML = state.items
    .map((item) => {
      const checked = state.selected.has(item.id);
      const expanded = state.expanded.has(item.id);
      return `
        <div class="item-row-wrap ${expanded ? 'item-row-wrap--expanded' : ''}" data-id="${item.id}">
          <div class="list-row ${checked ? 'list-row--selected' : ''}" data-action="toggle-select">
            <span class="capture-checkbox ${checked ? 'capture-checkbox--checked' : ''}"></span>
            <span class="list-row__chevron" data-action="toggle-expand">›</span>
            <span class="list-row__label" data-action="toggle-expand">${escapeHtml(item.label || defaultItemName(item))}</span>
            <span class="item-row__badges">${renderItemBadges(item)}</span>
          </div>
          ${expanded ? `<div class="code-block code-block--preview">${renderItemPreview(item)}</div>` : ''}
        </div>
      `;
    })
    .join('');
}

function updateSaveOptionsUI() {
  const hasSelection = state.selected.size > 0;
  const canGroup = state.selected.size >= 2;

  els.sectionSaveOptions.classList.toggle('section--disabled', !hasSelection);

  if (state.saveMode === 'group' && !canGroup) {
    state.saveMode = null;
  }

  els.radioIndividual.classList.toggle('capture-radio--checked', state.saveMode === 'individual');
  els.radioGroup.classList.toggle('capture-radio--checked', state.saveMode === 'group');
  els.optIndividual.classList.toggle('save-option--active', state.saveMode === 'individual');
  els.optGroup.classList.toggle('save-option--active', state.saveMode === 'group');
  els.optGroup.classList.toggle('save-option--disabled', !canGroup);

  const showFields = hasSelection && state.saveMode;
  els.sectionSaveTo.classList.toggle('section--disabled', !showFields);

  const isGroup = state.saveMode === 'group';
  const isIndividual = state.saveMode === 'individual';

  els.groupNameWrap.hidden = !isGroup;
  els.captureName.disabled = !isGroup;
  els.individualNames.hidden = !isIndividual;

  if (els.saveRequired) {
    if (isGroup) {
      els.saveRequired.hidden = false;
      els.saveRequired.textContent = '*required';
      els.saveRequired.classList.remove('section-required--optional');
    } else if (isIndividual) {
      els.saveRequired.hidden = false;
      els.saveRequired.textContent = 'optional';
      els.saveRequired.classList.add('section-required--optional');
    } else {
      els.saveRequired.hidden = true;
    }
  }

  if (isIndividual) {
    renderIndividualNames();
  }

  renderItems();
}

function renderIndividualNames() {
  const selectedItems = state.items.filter((i) => state.selected.has(i.id));
  if (!selectedItems.length) {
    els.individualNames.hidden = true;
    return;
  }

  els.individualNames.hidden = false;
  els.individualNames.innerHTML = selectedItems
    .map((item) => {
      const nameVal = escapeHtml(state.itemNames[item.id] ?? defaultItemName(item));
      const badges = renderItemBadges(item);
      return `
        <div class="individual-name-row">
          <div class="individual-name-row__badges">${badges}</div>
          <input type="text" class="capture-input" data-item-id="${item.id}" placeholder="Name this component (optional)" value="${nameVal}" />
        </div>
      `;
    })
    .join('');

  els.individualNames.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', (e) => {
      state.itemNames[e.target.dataset.itemId] = e.target.value;
      updateConfirm();
    });
  });
}

function updateCollectionTriggerLabel(collections) {
  if (!state.collectionIds.size) {
    els.collectionTriggerLabel.textContent = 'Select Collection';
    els.collectionTrigger.classList.remove('collection-dropdown__trigger--has-value');
    return;
  }
  const names = collections
    .filter((c) => state.collectionIds.has(c.id))
    .map((c) => c.name);
  if (state.collectionIds.has(FAVORITES_COLLECTION_ID) && !names.includes('Favorites')) {
    names.push('Favorites');
  }
  els.collectionTriggerLabel.textContent = names.join(', ');
  els.collectionTrigger.classList.add('collection-dropdown__trigger--has-value');
}

function updateConfirm() {
  const hasSelection = state.selected.size > 0;
  const hasCollection = state.collectionIds.size > 0;
  let ready = false;

  if (!hasSelection || !state.saveMode || !hasCollection) {
    els.btnConfirm.disabled = true;
    return;
  }

  if (state.saveMode === 'individual') {
    ready = true;
  }

  if (state.saveMode === 'group' && state.captureName.trim()) {
    ready = true;
  }

  els.btnConfirm.disabled = !ready;
}

async function renderCollections() {
  const collections = await getCollections();
  let html = `
    <div class="list-row collection-row--create" data-action="create-collection">
      <span class="list-row__label">Create New Collection…</span>
    </div>
  `;

  collections.forEach((col) => {
    if (col.id === FAVORITES_COLLECTION_ID) return;
    const selected = state.collectionIds.has(col.id);
    html += `
      <div class="list-row ${selected ? 'list-row--selected' : ''}" data-action="pick-collection" data-id="${col.id}">
        <span class="capture-checkbox ${selected ? 'capture-checkbox--checked' : ''}"></span>
        <span class="list-row__label">${escapeHtml(col.name)}</span>
      </div>
    `;
  });

  const favSelected = state.collectionIds.has(FAVORITES_COLLECTION_ID);
  html += `
    <div class="list-row ${favSelected ? 'list-row--selected' : ''}" data-action="pick-collection" data-id="${FAVORITES_COLLECTION_ID}">
      <span class="capture-checkbox ${favSelected ? 'capture-checkbox--checked' : ''}"></span>
      <span class="list-row__label">Favorites</span>
    </div>
  `;

  if (state.creatingCollection) {
    html += `<input type="text" class="capture-input" id="create-collection-input" placeholder="New collection name" />`;
  }

  els.collectionList.innerHTML = html;
  updateCollectionTriggerLabel(collections);
}

function bindItemList() {
  els.itemList.addEventListener('click', (e) => {
    const wrap = e.target.closest('.item-row-wrap');
    if (!wrap) return;
    const id = wrap.dataset.id;

    if (e.target.closest('[data-action="toggle-expand"]')) {
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      renderItems();
      return;
    }

    if (e.target.closest('[data-action="toggle-select"]') || e.target.closest('.capture-checkbox')) {
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      updateSaveOptionsUI();
      updateConfirm();
    }
  });
}

function bindSaveOptions() {
  els.optIndividual.addEventListener('click', () => {
    if (!state.selected.size) return;
    state.saveMode = 'individual';
    state.items.forEach((item) => {
      if (state.selected.has(item.id) && !state.itemNames[item.id]) {
        state.itemNames[item.id] = defaultItemName(item);
      }
    });
    updateSaveOptionsUI();
    updateConfirm();
  });

  els.optGroup.addEventListener('click', () => {
    if (state.selected.size < 2) return;
    state.saveMode = 'group';
    updateSaveOptionsUI();
    updateConfirm();
  });
}

function bindCollections() {
  els.collectionTrigger?.addEventListener('click', () => {
    state.collectionOpen = !state.collectionOpen;
    els.collectionPanel.hidden = !state.collectionOpen;
    els.collectionDropdown.classList.toggle('collection-dropdown--open', state.collectionOpen);
  });

  els.collectionList.addEventListener('click', async (e) => {
    const createRow = e.target.closest('[data-action="create-collection"]');
    if (createRow) {
      state.creatingCollection = true;
      await renderCollections();
      document.getElementById('create-collection-input')?.focus();
      return;
    }

    const row = e.target.closest('[data-action="pick-collection"]');
    if (row) {
      const id = row.dataset.id;
      if (state.collectionIds.has(id)) state.collectionIds.delete(id);
      else state.collectionIds.add(id);
      state.creatingCollection = false;
      await renderCollections();
      updateConfirm();
    }
  });

  els.collectionList.addEventListener('keydown', async (e) => {
    if (e.target.id !== 'create-collection-input' || e.key !== 'Enter') return;
    const name = e.target.value.trim();
    if (!name) return;
    const col = await addCollection(name);
    state.collectionIds.add(col.id);
    state.creatingCollection = false;
    await renderCollections();
    updateConfirm();
  });
}

function buildHtmlTags(item) {
  const tags = [item.tagName || item.type].filter(Boolean);
  if (item.nestedChildren?.length) {
    item.nestedChildren.forEach((c) => {
      if (c.tag && !tags.includes(c.tag)) tags.push(c.tag);
    });
  }
  return tags;
}

async function handleConfirm() {
  const selectedItems = state.items.filter((i) => state.selected.has(i.id));
  const scan = await getPendingScan();
  const collectionIds = [...state.collectionIds];

  if (state.saveMode === 'individual') {
    for (const item of selectedItems) {
      const name = (state.itemNames[item.id] || '').trim() || defaultItemName(item);
      await saveCapture({
        name,
        type: item.type,
        tagName: item.tagName || item.meta?.tagName,
        htmlTags: buildHtmlTags(item),
        primaryLabel: item.primaryLabel,
        nestedExtraCount: item.nestedExtraCount,
        nestedChildren: item.nestedChildren,
        code: item.code,
        html: item.html,
        selector: item.selector,
        thumbnail: item.thumbnail || item.meta?.screenshot,
        collectionIds,
        sourceUrl: scan?.url,
        mode: 'individual',
      });
    }
  } else {
    await saveCapture({
      name: state.captureName.trim(),
      type: 'group',
      tagName: 'group',
      htmlTags: selectedItems.map((i) => i.tagName).filter(Boolean),
      items: selectedItems,
      itemCount: selectedItems.length,
      code: selectedItems[0]?.code,
      thumbnail: selectedItems[0]?.thumbnail || selectedItems[0]?.meta?.screenshot,
      collectionIds,
      sourceUrl: scan?.url,
      mode: 'group',
    });
  }

  const collections = await getCollections();
  const colNames = collections
    .filter((c) => collectionIds.includes(c.id))
    .map((c) => c.name);
  if (collectionIds.includes(FAVORITES_COLLECTION_ID) && !colNames.includes('Favorites')) {
    colNames.push('Favorites');
  }
  const colMsg = colNames.length ? ` to ${colNames.join(', ')}` : '';

  await clearPendingScan();
  window.parent.postMessage({ type: 'CAPTURE_CLOSE_PANEL' }, '*');
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_TOAST',
        message: `Saved ${selectedItems.length} capture(s)${colMsg}`,
      });
    }
  });
}

document.getElementById('btn-close')?.addEventListener('click', () => {
  window.parent.postMessage({ type: 'CAPTURE_CLOSE_PANEL' }, '*');
});

document.getElementById('btn-back')?.addEventListener('click', () => {
  window.parent.postMessage({ type: 'CAPTURE_CLOSE_PANEL' }, '*');
});

document.getElementById('btn-dashboard')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
});

els.captureName?.addEventListener('input', (e) => {
  state.captureName = e.target.value;
  updateConfirm();
});

els.btnConfirm?.addEventListener('click', handleConfirm);

async function init() {
  const scan = await getPendingScan();
  state.items = scan?.items ?? [];
  renderItems();
  els.sectionSaveOptions.classList.add('section--disabled');
  els.sectionSaveTo.classList.add('section--disabled');
  await renderCollections();
  bindItemList();
  bindSaveOptions();
  bindCollections();
  updateSaveOptionsUI();
  updateConfirm();
}

init();
