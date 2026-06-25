import {
  getCaptures,
  getCollections,
  addCollection,
  formatRelativeTime,
  FAVORITES_COLLECTION_ID,
} from '../shared/storage.js';
import {
  parseCssCode,
  cssToTailwind,
  formatElementTags,
  buildDetailSections,
  getDetailSlides,
} from '../shared/clipDetail.js';

const SORT_LABELS = {
  recent: 'Most recent',
  leastRecent: 'Least recent',
  nameAsc: 'Name A → Z',
  nameDesc: 'Name Z → A',
};

const state = {
  captures: [],
  collections: [],
  view: 'all',
  collectionId: null,
  tagFilter: null,
  pillFilters: new Set(),
  search: '',
  selected: new Set(),
  sortBy: 'recent',
  detailId: null,
  detailPageIndex: 0,
  contextMenuClipId: null,
};

const els = {
  grid: document.getElementById('clip-grid'),
  empty: document.getElementById('empty-state'),
  search: document.getElementById('search'),
  pageTitle: document.getElementById('page-title'),
  pageCount: document.getElementById('page-count'),
  selectionStatus: document.getElementById('selection-status'),
  filterPills: document.getElementById('filter-pills'),
  sidebarCollections: document.getElementById('sidebar-collections'),
  sidebarTags: document.getElementById('sidebar-tags'),
  countAll: document.getElementById('count-all'),
  countRecent: document.getElementById('count-recent'),
  countFavorites: document.getElementById('count-favorites'),
  btnMove: document.getElementById('btn-move'),
  btnExport: document.getElementById('btn-export'),
  btnDelete: document.getElementById('btn-delete'),
  detailModal: document.getElementById('clip-detail'),
  detailTitle: document.getElementById('detail-title'),
  detailPreview: document.getElementById('detail-preview'),
  detailBody: document.getElementById('detail-body'),
  detailClose: document.getElementById('detail-close'),
  detailDelete: document.getElementById('detail-delete'),
  detailCopyTailwind: document.getElementById('detail-copy-tailwind'),
  detailCopyCss: document.getElementById('detail-copy-css'),
  detailCollections: document.getElementById('detail-collections'),
  detailPager: document.getElementById('detail-pager'),
  detailPrev: document.getElementById('detail-prev'),
  detailNext: document.getElementById('detail-next'),
  detailPageLabel: document.getElementById('detail-page-label'),
  sortWrap: document.getElementById('sort-wrap'),
  sortMenuTrigger: document.getElementById('sort-menu-trigger'),
  sortMenu: document.getElementById('sort-menu'),
  moveWrap: document.getElementById('move-wrap'),
  moveMenu: document.getElementById('move-menu'),
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTag(tag) {
  return `< ${tag} >`;
}

function tagDotClass(tag) {
  if (tag === 'div') return 'tag-dot--div';
  if (/^h[1-6]$/.test(tag)) return 'tag-dot--h1';
  if (tag === 'button') return 'tag-dot--button';
  if (tag === 'a') return 'tag-dot--a';
  return 'tag-dot--default';
}

function getHostname(url) {
  try {
    return new URL(url).hostname + '/';
  } catch {
    return url || '';
  }
}

function getTagsFromCaptures() {
  const counts = {};
  state.captures.forEach((c) => {
    (c.htmlTags || [c.tagName || c.type]).forEach((t) => {
      const key = String(t).toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

function filteredList() {
  let list = [...state.captures];

  if (state.view === 'recent') {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    list = list.filter((c) => c.createdAt >= weekAgo);
  }
  if (state.view === 'favorites') {
    list = list.filter((c) => c.favorite);
  }
  if (state.collectionId === FAVORITES_COLLECTION_ID) {
    list = list.filter((c) => c.favorite);
  } else if (state.collectionId) {
    list = list.filter((c) => c.collectionIds?.includes(state.collectionId));
  }
  if (state.tagFilter) {
    list = list.filter((c) =>
      (c.htmlTags || []).map((t) => t.toLowerCase()).includes(state.tagFilter),
    );
  }
  if (state.pillFilters.size > 0) {
    list = list.filter((c) =>
      [...state.pillFilters].every((fid) => {
        if (fid === 'favorites') return !!c.favorite;
        const tags = (c.htmlTags || []).map((t) => String(t).toLowerCase());
        const ty = String(c.type || '').toLowerCase();
        return tags.includes(fid) || ty === fid;
      }),
    );
  }
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter((c) => {
      const hay = [c.name, c.sourceUrl, ...(c.htmlTags || []), c.type].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  list.sort((a, b) => {
    switch (state.sortBy) {
      case 'recent':
        return b.createdAt - a.createdAt;
      case 'leastRecent':
        return a.createdAt - b.createdAt;
      case 'nameAsc':
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
          sensitivity: 'base',
        });
      case 'nameDesc':
        return String(b.name || '').localeCompare(String(a.name || ''), undefined, {
          sensitivity: 'base',
        });
      default:
        return b.createdAt - a.createdAt;
    }
  });

  return list;
}

function updateCounts() {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  els.countAll.textContent = state.captures.length;
  els.countRecent.textContent = state.captures.filter((c) => c.createdAt >= weekAgo).length;
  els.countFavorites.textContent = state.captures.filter((c) => c.favorite).length;
}

function renderSidebar() {
  els.sidebarCollections.innerHTML = state.collections
    .map((col) => {
      const n =
        col.id === FAVORITES_COLLECTION_ID
          ? state.captures.filter((c) => c.favorite).length
          : state.captures.filter((c) => c.collectionIds?.includes(col.id)).length;
      const active = state.collectionId === col.id ? 'nav-item--active' : '';
      const href = `dashboard.html?collection=${encodeURIComponent(col.id)}`;
      return `
        <div class="sidebar-collection-row">
          <a href="${href}" class="nav-item nav-item--collection ${active}" data-collection="${col.id}">
            <span>${escapeHtml(col.name)}</span>
            <span class="nav-item__count">${n}</span>
          </a>
        </div>`;
    })
    .join('');

  const tags = getTagsFromCaptures();
  const visible = tags.slice(0, 3);
  els.sidebarTags.innerHTML = visible
    .map(
      ([tag, count]) => `
      <a href="dashboard.html?tag=${encodeURIComponent(tag)}" class="nav-item ${state.tagFilter === tag ? 'nav-item--active' : ''}" data-tag="${tag}">
        <span><span class="tag-dot ${tagDotClass(tag)}"></span>${formatTag(tag)}</span>
        <span class="nav-item__count">${count}</span>
      </a>`,
    )
    .join('');

  const moreBtn = document.getElementById('btn-more-tags');
  if (moreBtn) moreBtn.hidden = tags.length <= 3;

  renderPrimaryNav();
}

function renderFilterPills() {
  const tags = getTagsFromCaptures().slice(0, 3).map(([t]) => t);
  const pills = [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: 'Favorites' },
    ...tags.map((t) => ({ id: t, label: formatTag(t) })),
  ];
  const noneActive = state.pillFilters.size === 0;
  els.filterPills.innerHTML = pills
    .map((p) => {
      const active = p.id === 'all' ? noneActive : state.pillFilters.has(p.id);
      return `<button type="button" class="pill ${active ? 'pill--active' : ''}" data-filter="${p.id}">${p.label}</button>`;
    })
    .join('');
}

function updateSortUI() {
  if (!els.sortMenuTrigger || !els.sortMenu) return;
  const label = SORT_LABELS[state.sortBy] || SORT_LABELS.recent;
  els.sortMenuTrigger.textContent = `Sort by · ${label} ▾`;
  els.sortMenu.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.classList.toggle('sort-menu__item--active', btn.dataset.sort === state.sortBy);
  });
}

function closeSortMenu() {
  if (!els.sortMenu || !els.sortMenuTrigger) return;
  els.sortMenu.hidden = true;
  els.sortMenuTrigger.setAttribute('aria-expanded', 'false');
}

function getSelectedCaptures() {
  return [...state.selected]
    .map((id) => state.captures.find((c) => c.id === id))
    .filter(Boolean);
}

function renderMoveMenu() {
  if (!els.moveMenu) return;
  const sel = getSelectedCaptures();
  els.moveMenu.innerHTML = `<p class="move-menu__hint">Checked = all selected clips are in that collection.</p>
    ${state.collections
      .map(
        (col) => `
      <label class="move-menu__row">
        <input type="checkbox" data-move-collection="${col.id}" />
        <span>${escapeHtml(col.name)}</span>
      </label>`,
      )
      .join('')}`;
  els.moveMenu.querySelectorAll('[data-move-collection]').forEach((cb) => {
    const id = cb.dataset.moveCollection;
    const hasAll = sel.length > 0 && sel.every((c) => c.collectionIds?.includes(id));
    const hasSome = sel.some((c) => c.collectionIds?.includes(id));
    cb.checked = hasAll;
    cb.indeterminate = hasSome && !hasAll;
  });
}

function closeMoveMenu() {
  if (!els.moveMenu || !els.btnMove) return;
  els.moveMenu.hidden = true;
  els.btnMove.setAttribute('aria-expanded', 'false');
}

function toggleMoveMenu() {
  if (!els.moveMenu || !els.btnMove || els.btnMove.disabled) return;
  const open = els.moveMenu.hidden;
  els.moveMenu.hidden = !open;
  els.btnMove.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) renderMoveMenu();
}

function mutateCaptureCollectionMembership(cap, collectionId, shouldAdd) {
  if (!cap.collectionIds) cap.collectionIds = [];
  if (shouldAdd) {
    if (!cap.collectionIds.includes(collectionId)) cap.collectionIds.push(collectionId);
    if (collectionId === FAVORITES_COLLECTION_ID) cap.favorite = true;
  } else {
    cap.collectionIds = cap.collectionIds.filter((id) => id !== collectionId);
    if (collectionId === FAVORITES_COLLECTION_ID) cap.favorite = false;
  }
  if (cap.favorite && !cap.collectionIds.includes(FAVORITES_COLLECTION_ID)) {
    cap.collectionIds.push(FAVORITES_COLLECTION_ID);
  }
  if (!cap.favorite) {
    cap.collectionIds = cap.collectionIds.filter((id) => id !== FAVORITES_COLLECTION_ID);
  }
}

async function applyBulkCollectionToggle(collectionId, shouldAdd) {
  const caps = getSelectedCaptures();
  for (const cap of caps) {
    mutateCaptureCollectionMembership(cap, collectionId, shouldAdd);
  }
  await persist();
  updateCounts();
  renderSidebar();
  renderGrid();
  caps.forEach((cap) => {
    if (state.detailId === cap.id) renderDetailView(cap);
  });
  renderMoveMenu();
}

async function applyContextMenuCollectionToggle(collectionId, shouldAdd) {
  const cap = state.captures.find((c) => c.id === state.contextMenuClipId);
  if (!cap) return;
  mutateCaptureCollectionMembership(cap, collectionId, shouldAdd);
  await persist();
  updateCounts();
  renderSidebar();
  renderGrid();
  if (state.detailId === cap.id) renderDetailView(cap);
  syncContextOrganizeCheckboxes(cap);
}

function syncContextOrganizeCheckboxes(cap) {
  const menu = document.getElementById('clip-card-context-menu');
  if (!menu || menu.hidden || !cap) return;
  menu.querySelectorAll('[data-ctx-collection]').forEach((cb) => {
    const id = cb.dataset.ctxCollection;
    cb.checked = !!cap.collectionIds?.includes(id);
  });
}

function getCapturePrimarySlide(cap) {
  const slides = getDetailSlides(cap);
  return slides[0] || null;
}

function closeClipContextMenu() {
  state.contextMenuClipId = null;
  const menu = document.getElementById('clip-card-context-menu');
  const sub = document.getElementById('clip-card-context-submenu');
  if (menu) menu.hidden = true;
  if (sub) sub.hidden = true;
}

function positionClipContextMenu(menu, clientX, clientY) {
  const pad = 8;
  menu.hidden = false;
  menu.style.left = '0';
  menu.style.top = '0';
  const rect = menu.getBoundingClientRect();
  let left = clientX;
  let top = clientY;
  if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
  if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function renderContextOrganizeSubmenu(cap) {
  const sub = document.getElementById('clip-card-context-submenu');
  if (!sub || !cap) return;
  sub.innerHTML = `
    <p class="clip-card-context-submenu__hint">Checked = clip is in that collection.</p>
    ${state.collections
      .map(
        (col) => `
      <label class="clip-card-context-submenu__row">
        <input type="checkbox" data-ctx-collection="${col.id}" />
        <span>${escapeHtml(col.name)}</span>
      </label>`,
      )
      .join('')}
  `;
  sub.querySelectorAll('[data-ctx-collection]').forEach((cb) => {
    cb.checked = !!cap.collectionIds?.includes(cb.dataset.ctxCollection);
  });
}

function ensureClipCardContextMenu() {
  let menu = document.getElementById('clip-card-context-menu');
  if (menu) return menu;

  menu = document.createElement('div');
  menu.id = 'clip-card-context-menu';
  menu.className = 'clip-card-context-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <div class="clip-card-context-menu__section clip-card-context-menu__section--lead">
      <button type="button" class="clip-card-context-menu__item" role="menuitem" data-card-action="open">
        <span class="clip-card-context-menu__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v7h-7"/><path d="M3 10V3h7"/></svg></span>
        <span class="clip-card-context-menu__label">Open</span>
      </button>
    </div>
    <hr class="clip-card-context-menu__rule" />
    <div class="clip-card-context-menu__section">
      <button type="button" class="clip-card-context-menu__item" role="menuitem" data-card-action="rename">
        <span class="clip-card-context-menu__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>
        <span class="clip-card-context-menu__label">Rename</span>
      </button>
      <button type="button" class="clip-card-context-menu__item" role="menuitem" data-card-action="duplicate">
        <span class="clip-card-context-menu__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
        <span class="clip-card-context-menu__label">Make a copy</span>
      </button>
      <div class="clip-card-context-menu__organize-host">
        <div class="clip-card-context-menu__item clip-card-context-menu__item--hint">
          <span class="clip-card-context-menu__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
          <span class="clip-card-context-menu__label">Organize</span>
          <span class="clip-card-context-menu__caret" aria-hidden="true">›</span>
        </div>
        <div class="clip-card-context-submenu" id="clip-card-context-submenu" hidden role="menu"></div>
      </div>
    </div>
    <hr class="clip-card-context-menu__rule" />
    <div class="clip-card-context-menu__section">
      <button type="button" class="clip-card-context-menu__item" role="menuitem" data-card-action="copy-css">
        <span class="clip-card-context-menu__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
        <span class="clip-card-context-menu__label">Copy CSS</span>
      </button>
      <button type="button" class="clip-card-context-menu__item" role="menuitem" data-card-action="copy-tailwind">
        <span class="clip-card-context-menu__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></span>
        <span class="clip-card-context-menu__label">Copy Tailwind</span>
      </button>
    </div>
    <hr class="clip-card-context-menu__rule" />
    <div class="clip-card-context-menu__section">
      <button type="button" class="clip-card-context-menu__item clip-card-context-menu__item--danger" role="menuitem" data-card-action="delete">
        <span class="clip-card-context-menu__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span>
        <span class="clip-card-context-menu__label">Move to trash</span>
      </button>
    </div>
  `;

  document.body.appendChild(menu);

  menu.addEventListener('contextmenu', (e) => e.preventDefault());

  menu.addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.target.closest('[data-card-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.cardAction;
    const cap = state.captures.find((c) => c.id === state.contextMenuClipId);
    if (!cap) return;

    if (action === 'open') {
      closeClipContextMenu();
      openDetail(cap.id);
      return;
    }
    if (action === 'rename') {
      const next = prompt('Rename clip', cap.name || '');
      if (next != null && next.trim()) {
        cap.name = next.trim();
        await persist();
        renderGrid();
        if (state.detailId === cap.id) els.detailTitle.value = cap.name;
      }
      closeClipContextMenu();
      return;
    }
    if (action === 'duplicate') {
      const json = JSON.parse(JSON.stringify(cap));
      json.id = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      json.createdAt = Date.now();
      json.name = `${cap.name || 'Clip'} copy`;
      state.captures.unshift(json);
      await persist();
      updateCounts();
      renderSidebar();
      renderGrid();
      closeClipContextMenu();
      return;
    }
    if (action === 'copy-css') {
      const slide = getCapturePrimarySlide(cap);
      if (slide?.code) navigator.clipboard.writeText(slide.code);
      closeClipContextMenu();
      return;
    }
    if (action === 'copy-tailwind') {
      const slide = getCapturePrimarySlide(cap);
      if (slide?.code) navigator.clipboard.writeText(cssToTailwind(parseCssCode(slide.code)));
      closeClipContextMenu();
      return;
    }
    if (action === 'delete') {
      if (confirm(`Delete “${cap.name || 'this clip'}”?`)) {
        state.captures = state.captures.filter((c) => c.id !== cap.id);
        state.selected.delete(cap.id);
        if (state.detailId === cap.id) closeDetail();
        await persist();
        updateCounts();
        renderSidebar();
        renderGrid();
        updateActionBar();
      }
      closeClipContextMenu();
    }
  });

  menu.addEventListener('change', async (e) => {
    const input = e.target;
    if (input.type !== 'checkbox' || !input.dataset.ctxCollection) return;
    await applyContextMenuCollectionToggle(input.dataset.ctxCollection, input.checked);
  });

  const organizeHost = menu.querySelector('.clip-card-context-menu__organize-host');
  const sub = menu.querySelector('#clip-card-context-submenu');
  const pointerFineMq = window.matchMedia('(pointer: fine)');

  function openOrganizeSubmenuPanel() {
    const cap = state.captures.find((c) => c.id === state.contextMenuClipId);
    if (!cap || !sub) return;
    renderContextOrganizeSubmenu(cap);
    sub.hidden = false;
  }

  if (organizeHost && sub) {
    organizeHost.addEventListener('mouseenter', () => {
      if (!pointerFineMq.matches) return;
      openOrganizeSubmenuPanel();
    });
    organizeHost.addEventListener('mouseleave', (e) => {
      if (!pointerFineMq.matches) return;
      if (!organizeHost.contains(e.relatedTarget)) sub.hidden = true;
    });
    organizeHost.addEventListener('click', (e) => {
      if (e.target.closest('#clip-card-context-submenu')) return;
      if (pointerFineMq.matches) return;
      e.preventDefault();
      e.stopPropagation();
      if (sub.hidden) openOrganizeSubmenuPanel();
      else sub.hidden = true;
    });
  }

  return menu;
}

function openClipContextMenu(clientX, clientY, clipId) {
  closeSortMenu();
  closeMoveMenu();
  state.contextMenuClipId = clipId;
  const menu = ensureClipCardContextMenu();
  const sub = document.getElementById('clip-card-context-submenu');
  if (sub) sub.hidden = true;
  positionClipContextMenu(menu, clientX, clientY);
}

function toggleSortMenu() {
  if (!els.sortMenu || !els.sortMenuTrigger) return;
  const open = els.sortMenu.hidden;
  els.sortMenu.hidden = !open;
  els.sortMenuTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function renderCardTags(cap) {
  if (cap.primaryLabel && (cap.nestedExtraCount || 0) > 0) {
    return `
      <span class="clip-tag"><span class="tag-dot tag-dot--div"></span>${escapeHtml(cap.primaryLabel)}</span>
      <span class="clip-card__badges-extra">+${cap.nestedExtraCount}</span>
    `;
  }
  const tags = cap.htmlTags || [cap.tagName || cap.type].filter(Boolean);
  return tags
    .slice(0, 4)
    .map(
      (t) =>
        `<span class="clip-tag"><span class="tag-dot ${tagDotClass(String(t).toLowerCase())}"></span>${formatTag(t)}</span>`,
    )
    .join('');
}

function getActiveCapture() {
  return state.captures.find((c) => c.id === state.detailId) || null;
}

function getActiveSlides() {
  const cap = getActiveCapture();
  return cap ? getDetailSlides(cap) : [];
}

function getActiveSlide() {
  const slides = getActiveSlides();
  return slides[state.detailPageIndex] || slides[0] || null;
}

function renderCollectionPills(collectionIds) {
  if (!collectionIds?.length) return '';
  return state.collections
    .filter((c) => collectionIds.includes(c.id))
    .map((c) => `<span class="collection-pill">${escapeHtml(c.name)}</span>`)
    .join('');
}

function renderDetailCollections(cap) {
  const ids = cap.collectionIds || [];
  if (!ids.length) {
    els.detailCollections.hidden = true;
    els.detailCollections.innerHTML = '';
    return;
  }
  els.detailCollections.hidden = false;
  els.detailCollections.innerHTML = `
    <span class="clip-detail__collections-label">Saved to</span>
    ${renderCollectionPills(ids)}
  `;
}

function renderDetailPager(slides) {
  const total = slides.length;
  const show = total > 1;
  els.detailPager.hidden = !show;
  if (!show) return;

  const current = state.detailPageIndex + 1;
  els.detailPageLabel.textContent = `${current} / ${total}`;
  els.detailPrev.disabled = state.detailPageIndex <= 0;
  els.detailNext.disabled = state.detailPageIndex >= total - 1;
}

function renderChildrenList(items, cap) {
  if (!items?.length) return '';
  return `
    <section class="clip-detail__section">
      <h3>Included Elements</h3>
      <div class="detail-children">
        ${items
          .map((item, i) => {
            const slideIndex = i + 1;
            const name = escapeHtml(item.label || item.primaryLabel || item.tagName || `Element ${i + 1}`);
            const tag = escapeHtml(item.badgeLabel || item.tagName || item.type || 'element');
            const code = escapeHtml(item.code || '/* No styles captured */');
            return `
              <article class="detail-child-card" data-goto-slide="${slideIndex}" role="button" tabindex="0">
                <div class="detail-child-card__head">
                  <span class="detail-child-card__name">${name}</span>
                  <span class="detail-child-card__tag">${tag}</span>
                </div>
                <pre class="detail-code detail-code--css">${code}</pre>
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderSlideLabel(slide) {
  if (slide.type === 'parent') {
    return `<div class="clip-detail__slide-label clip-detail__slide-label--parent">Parent · ${slide.itemCount || 0} elements</div>`;
  }
  if (slide.type === 'child') {
    return `<div class="clip-detail__slide-label clip-detail__slide-label--child">Child ${(slide.index ?? 0) + 1} · ${escapeHtml(slide.badgeLabel || slide.tagName || 'element')}</div>`;
  }
  return '';
}

function renderSlideBody(slide, cap) {
  const props = parseCssCode(slide.code);
  const sections = buildDetailSections(props);
  const tailwind = cssToTailwind(props);
  const cssExport = buildCssExport(props);
  const collectionRows = state.collections
    .map((col) => {
      const checked = (cap.collectionIds || []).includes(col.id);
      const isFav = col.id === FAVORITES_COLLECTION_ID;
      return `
        <label class="detail-collection-row">
          <input type="checkbox" data-detail-collection="${col.id}" ${checked ? 'checked' : ''} />
          <span>${escapeHtml(col.name)}${isFav ? ' (starred)' : ''}</span>
        </label>
      `;
    })
    .join('');

  const childrenBlock =
    slide.type === 'parent' && slide.items?.length ? renderChildrenList(slide.items, cap) : '';

  return `
    ${renderSlideLabel(slide)}
    <section class="clip-detail__section">
      <h3>Typography</h3>
      ${sections.typography || '<div class="detail-row"><span>—</span><span>—</span></div>'}
    </section>
    <section class="clip-detail__section">
      <h3>Colors</h3>
      ${sections.colors || '<div class="detail-row"><span>—</span><span>—</span></div>'}
    </section>
    <section class="clip-detail__section">
      <h3>Layout</h3>
      ${sections.layout || '<div class="detail-row"><span>—</span><span>—</span></div>'}
    </section>
    <section class="clip-detail__section">
      <h3>Effects</h3>
      ${sections.effects || '<div class="detail-row"><span>—</span><span>—</span></div>'}
    </section>
    <section class="clip-detail__section">
      <h3>CSS Export</h3>
      <pre class="detail-code detail-code--css">${escapeHtml(cssExport)}</pre>
    </section>
    <section class="clip-detail__section">
      <h3>Tailwind Export</h3>
      <pre class="detail-code detail-code--tw">${escapeHtml(tailwind)}</pre>
    </section>
    ${childrenBlock}
    <section class="clip-detail__section">
      <h3>Source</h3>
      <div class="detail-row"><span>URL</span><span>${escapeHtml(cap.sourceUrl || '—')}</span></div>
      <div class="detail-row"><span>Element</span><span>${escapeHtml(formatElementTags(slide))}</span></div>
      <div class="detail-row"><span>Collection</span></div>
      <div class="detail-collections">${collectionRows}</div>
      <div class="detail-row"><span>Saved</span><span>${formatSavedDate(cap.createdAt)}</span></div>
    </section>
  `;
}

function bindDetailCollectionInputs() {
  els.detailBody.querySelectorAll('[data-detail-collection]').forEach((input) => {
    input.addEventListener('change', async () => {
      const capLive = getActiveCapture();
      if (!capLive) return;
      const id = input.dataset.detailCollection;
      if (!capLive.collectionIds) capLive.collectionIds = [];
      if (input.checked) {
        if (!capLive.collectionIds.includes(id)) capLive.collectionIds.push(id);
      } else {
        capLive.collectionIds = capLive.collectionIds.filter((c) => c !== id);
      }
      if (id === FAVORITES_COLLECTION_ID) capLive.favorite = input.checked;
      if (capLive.favorite && !capLive.collectionIds.includes(FAVORITES_COLLECTION_ID)) {
        capLive.collectionIds.push(FAVORITES_COLLECTION_ID);
      }
      if (!capLive.favorite) {
        capLive.collectionIds = capLive.collectionIds.filter((c) => c !== FAVORITES_COLLECTION_ID);
      }
      await persist();
      updateCounts();
      renderSidebar();
      renderGrid();
      renderDetailCollections(capLive);
      renderDetailView(capLive);
    });
  });
}

function bindChildCardNavigation(slides) {
  els.detailBody.querySelectorAll('[data-goto-slide]').forEach((card) => {
    const go = () => {
      const idx = Number(card.dataset.gotoSlide);
      if (idx >= 0 && idx < slides.length) {
        state.detailPageIndex = idx;
        renderDetailView(getActiveCapture());
      }
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });
}

function renderDetailView(cap) {
  if (!cap) return;
  const slides = getDetailSlides(cap);
  if (state.detailPageIndex >= slides.length) state.detailPageIndex = 0;
  const slide = slides[state.detailPageIndex];

  renderDetailCollections(cap);
  renderDetailPager(slides);
  renderDetailPreview(slide);

  els.detailBody.innerHTML = renderSlideBody(slide, cap);
  bindDetailCollectionInputs();
  bindChildCardNavigation(slides);
}

function navigateDetailPage(delta) {
  const slides = getActiveSlides();
  if (slides.length <= 1) return;
  const next = state.detailPageIndex + delta;
  if (next < 0 || next >= slides.length) return;
  state.detailPageIndex = next;
  renderDetailView(getActiveCapture());
}

function formatSavedDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildCssExport(props) {
  const lines = Object.entries(props).map(([k, v]) => `  ${k}: ${v};`);
  return `.element {\n${lines.join('\n')}\n}`;
}

function openDetail(capId) {
  const cap = state.captures.find((c) => c.id === capId);
  if (!cap) return;
  state.detailId = capId;
  state.detailPageIndex = 0;
  els.detailTitle.value = cap.name;
  renderDetailView(cap);
  els.detailModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  state.detailId = null;
  state.detailPageIndex = 0;
  els.detailModal.hidden = true;
  document.body.style.overflow = '';
}

function renderDetailPreview(slide) {
  const thumb = slide?.thumbnail;
  const name = slide?.name || 'Preview';
  if (thumb) {
    els.detailPreview.innerHTML = `<img src="${thumb}" alt="" />`;
  } else {
    els.detailPreview.innerHTML = `<div class="clip-detail__preview-placeholder">${escapeHtml(name)}</div>`;
  }
}


function renderGrid() {
  const list = filteredList();
  els.empty.hidden = list.length > 0;
  els.pageCount.textContent = list.length;

  els.grid.innerHTML = list
    .map((cap) => {
      const selected = state.selected.has(cap.id);
      const thumb = cap.thumbnail
        ? `<img class="clip-card__thumb" src="${cap.thumbnail}" alt="" />`
        : `<div class="clip-card__thumb-placeholder">${escapeHtml((cap.code || cap.name || '').slice(0, 80))}</div>`;

      return `
        <article class="clip-card ${selected ? 'clip-card--selected' : ''}" data-id="${cap.id}">
          <div class="clip-card__thumb-wrap">
            ${thumb}
            <button type="button" class="clip-card__select" aria-label="Select"></button>
          </div>
          <div class="clip-card__body">
            <div class="clip-card__row">
              <span class="clip-card__title">${escapeHtml(cap.name)}</span>
              <button type="button" class="clip-card__star ${cap.favorite ? 'clip-card__star--on' : ''}" data-fav="${cap.id}" aria-label="Favorite">★</button>
            </div>
            <div class="clip-card__tags">
              ${renderCardTags(cap)}
              ${cap.mode === 'group' && cap.items?.length ? `<span class="clip-tag">${cap.items.length} elements</span>` : ''}
            </div>
            <div class="clip-card__footer">
              <span class="clip-card__url">${escapeHtml(getHostname(cap.sourceUrl))}</span>
              <span>${formatRelativeTime(cap.createdAt)}</span>
            </div>
          </div>
        </article>`;
    })
    .join('');

}

function updateActionBar() {
  const n = state.selected.size;
  els.selectionStatus.textContent = `${n} Clip${n === 1 ? '' : 's'} Selected`;
  const has = n > 0;
  els.btnMove.disabled = !has;
  els.btnExport.disabled = !has;
  els.btnDelete.disabled = !has;
  if (!has) closeMoveMenu();
  else if (els.moveMenu && !els.moveMenu.hidden) renderMoveMenu();
}

async function persist() {
  await chrome.storage.local.set({ captures: state.captures });
}

async function load() {
  state.captures = await getCaptures();
  state.collections = await getCollections();

  const params = new URLSearchParams(window.location.search);
  const collectionParam = params.get('collection');
  const viewParam = params.get('view');
  const tagParam = params.get('tag');

  state.collectionId = null;
  state.tagFilter = null;
  state.view = 'all';

  if (collectionParam) {
    state.collectionId = collectionParam;
    const col = state.collections.find((c) => c.id === collectionParam);
    els.pageTitle.textContent = col?.name || 'Collection';
  } else if (tagParam) {
    state.tagFilter = tagParam.toLowerCase();
    els.pageTitle.textContent = 'All Clips';
  } else if (viewParam === 'recent') {
    state.view = 'recent';
    els.pageTitle.textContent = 'Recently Saved';
  } else if (viewParam === 'favorites') {
    state.view = 'favorites';
    els.pageTitle.textContent = 'Favorites';
  } else {
    els.pageTitle.textContent = 'All Clips';
  }

  updateCounts();
  renderSidebar();
  renderFilterPills();
  updateSortUI();
  renderGrid();
  updateActionBar();
}

function renderPrimaryNav() {
  document.querySelectorAll('.sidebar__nav .nav-item[data-view]').forEach((el) => {
    const active =
      !state.collectionId &&
      !state.tagFilter &&
      state.view === el.dataset.view;
    el.classList.toggle('nav-item--active', active);
  });
}

els.filterPills?.addEventListener('click', (e) => {
  const pill = e.target.closest('.pill');
  if (!pill) return;
  const id = pill.dataset.filter;
  if (id === 'all') {
    state.pillFilters.clear();
  } else if (state.pillFilters.has(id)) {
    state.pillFilters.delete(id);
  } else {
    state.pillFilters.add(id);
  }
  renderFilterPills();
  renderGrid();
});

els.search?.addEventListener('input', (e) => {
  state.search = e.target.value;
  renderGrid();
});

els.sortMenuTrigger?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSortMenu();
});

els.sortMenu?.addEventListener('click', (e) => {
  const item = e.target.closest('[data-sort]');
  if (!item) return;
  state.sortBy = item.dataset.sort;
  updateSortUI();
  closeSortMenu();
  renderGrid();
});

document.addEventListener('click', () => {
  closeSortMenu();
  closeMoveMenu();
  closeClipContextMenu();
});

els.moveWrap?.addEventListener('click', (e) => e.stopPropagation());

els.sortWrap?.addEventListener('click', (e) => e.stopPropagation());

els.btnMove?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (els.btnMove.disabled) return;
  toggleMoveMenu();
});

els.moveMenu?.addEventListener('change', async (e) => {
  const input = e.target;
  if (input.type !== 'checkbox' || !input.dataset.moveCollection) return;
  await applyBulkCollectionToggle(input.dataset.moveCollection, input.checked);
});

document.getElementById('btn-select-all')?.addEventListener('click', () => {
  const list = filteredList();
  const allSelected = list.every((c) => state.selected.has(c.id));
  if (allSelected) list.forEach((c) => state.selected.delete(c.id));
  else list.forEach((c) => state.selected.add(c.id));
  updateActionBar();
  renderGrid();
});

els.grid?.addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.clip-card');
  if (!card || !els.grid.contains(card)) return;
  e.preventDefault();
  openClipContextMenu(e.clientX, e.clientY, card.dataset.id);
});

els.grid?.addEventListener('click', async (e) => {
  const favBtn = e.target.closest('[data-fav]');
  if (favBtn) {
    e.stopPropagation();
    const cap = state.captures.find((c) => c.id === favBtn.dataset.fav);
    if (cap) {
      cap.favorite = !cap.favorite;
      if (!cap.collectionIds) cap.collectionIds = [];
      if (cap.favorite) {
        if (!cap.collectionIds.includes(FAVORITES_COLLECTION_ID)) {
          cap.collectionIds.push(FAVORITES_COLLECTION_ID);
        }
      } else {
        cap.collectionIds = cap.collectionIds.filter((id) => id !== FAVORITES_COLLECTION_ID);
      }
      await persist();
      updateCounts();
      renderSidebar();
      renderGrid();
      if (state.detailId === cap.id) renderDetailView(cap);
    }
    return;
  }

  const card = e.target.closest('.clip-card');
  if (!card) return;

  if (e.target.closest('.clip-card__select')) {
    e.stopPropagation();
    const id = card.dataset.id;
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    updateActionBar();
    renderGrid();
    return;
  }

  openDetail(card.dataset.id);
});

els.detailClose?.addEventListener('click', closeDetail);
els.detailModal?.querySelector('[data-close-detail]')?.addEventListener('click', closeDetail);

els.detailTitle?.addEventListener('change', async () => {
  const cap = getActiveCapture();
  if (!cap) return;
  cap.name = els.detailTitle.value.trim() || cap.name;
  await persist();
  renderGrid();
});

els.detailDelete?.addEventListener('click', async () => {
  const cap = getActiveCapture();
  if (!cap) return;
  state.captures = state.captures.filter((c) => c.id !== cap.id);
  state.selected.delete(cap.id);
  await persist();
  closeDetail();
  updateCounts();
  renderSidebar();
  renderGrid();
  updateActionBar();
});

els.detailCopyCss?.addEventListener('click', () => {
  const slide = getActiveSlide();
  if (!slide?.code) return;
  navigator.clipboard.writeText(slide.code);
});

els.detailCopyTailwind?.addEventListener('click', () => {
  const slide = getActiveSlide();
  if (!slide?.code) return;
  const tw = cssToTailwind(parseCssCode(slide.code));
  navigator.clipboard.writeText(tw);
});

els.detailPrev?.addEventListener('click', () => navigateDetailPage(-1));
els.detailNext?.addEventListener('click', () => navigateDetailPage(1));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const ctxMenu = document.getElementById('clip-card-context-menu');
    if (ctxMenu && !ctxMenu.hidden) {
      closeClipContextMenu();
      return;
    }
    if (els.moveMenu && !els.moveMenu.hidden) {
      closeMoveMenu();
      return;
    }
    if (els.sortMenu && !els.sortMenu.hidden) {
      closeSortMenu();
      return;
    }
    if (state.detailId) {
      const tag = e.target.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') closeDetail();
      return;
    }
    return;
  }
  if (!state.detailId) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateDetailPage(-1);
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateDetailPage(1);
  }
});

document.getElementById('btn-delete')?.addEventListener('click', async () => {
  state.captures = state.captures.filter((c) => !state.selected.has(c.id));
  state.selected.clear();
  await persist();
  updateCounts();
  renderSidebar();
  renderGrid();
  updateActionBar();
});

document.getElementById('btn-export')?.addEventListener('click', () => {
  const selected = state.captures.filter((c) => state.selected.has(c.id));
  const blob = new Blob(
    [
      selected
        .map((c) => `/* ${c.name} */\n${c.code || c.html || ''}`)
        .join('\n\n'),
    ],
    { type: 'text/css' },
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'decova-clips.css';
  a.click();
});

document.getElementById('btn-new-collection')?.addEventListener('click', async () => {
  const name = prompt('Collection name');
  if (!name?.trim()) return;
  await addCollection(name.trim());
  state.collections = await getCollections();
  renderSidebar();
});

window.addEventListener('resize', closeClipContextMenu);

load();
