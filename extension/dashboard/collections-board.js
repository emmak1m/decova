import {
  getCaptures,
  getCollections,
  addCollection,
  FAVORITES_COLLECTION_ID,
} from '../shared/storage.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function getTagsFromCaptures(captures) {
  const counts = {};
  captures.forEach((c) => {
    (c.htmlTags || [c.tagName || c.type]).forEach((t) => {
      const key = String(t).toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

function clipsForCollection(colId, captures) {
  if (colId === FAVORITES_COLLECTION_ID) {
    return captures.filter((c) => c.favorite);
  }
  return captures.filter((c) => c.collectionIds?.includes(colId));
}

function boardMosaicHtml(clips) {
  const sorted = [...clips].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cells = [];
  for (let i = 0; i < 4; i += 1) {
    const cap = sorted[i];
    if (cap?.thumbnail) {
      cells.push(
        `<div class="board-card__mosaic-cell"><img src="${cap.thumbnail}" alt="" /></div>`,
      );
    } else if (cap) {
      const hint = escapeHtml((cap.name || cap.code || '').slice(0, 48));
      cells.push(
        `<div class="board-card__mosaic-cell board-card__mosaic-cell--hint">${hint}</div>`,
      );
    } else {
      cells.push('<div class="board-card__mosaic-cell board-card__mosaic-cell--empty"></div>');
    }
  }
  return `<div class="board-card__mosaic" aria-hidden="true">${cells.join('')}</div>`;
}

function updateCounts(captures) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const elAll = document.getElementById('count-all');
  const elRecent = document.getElementById('count-recent');
  const elFav = document.getElementById('count-favorites');
  if (elAll) elAll.textContent = captures.length;
  if (elRecent) elRecent.textContent = captures.filter((c) => c.createdAt >= weekAgo).length;
  if (elFav) elFav.textContent = captures.filter((c) => c.favorite).length;
}

function renderBoardsPrimaryNav() {
  document.querySelectorAll('.sidebar__nav .nav-item[data-view]').forEach((el) => {
    el.classList.remove('nav-item--active');
  });
}

function renderSidebarCollections(captures, collections, highlightId) {
  const nav = document.getElementById('sidebar-collections');
  if (!nav) return;

  nav.innerHTML = collections
    .map((col) => {
      const n =
        col.id === FAVORITES_COLLECTION_ID
          ? captures.filter((c) => c.favorite).length
          : captures.filter((c) => c.collectionIds?.includes(col.id)).length;
      const hi = highlightId === col.id ? 'sidebar-collection-row--highlight' : '';
      const href = `dashboard.html?collection=${encodeURIComponent(col.id)}`;
      return `
        <div class="sidebar-collection-row ${hi}">
          <a href="${href}" class="nav-item nav-item--collection">
            <span>${escapeHtml(col.name)}</span>
            <span class="nav-item__count">${n}</span>
          </a>
        </div>`;
    })
    .join('');

  renderBoardsPrimaryNav();
}

function renderSidebarTags(captures) {
  const nav = document.getElementById('sidebar-tags');
  const moreBtn = document.getElementById('btn-more-tags');
  if (!nav) return;

  const tags = getTagsFromCaptures(captures);
  const visible = tags.slice(0, 3);
  nav.innerHTML = visible
    .map(
      ([tag, count]) => `
      <a href="dashboard.html?tag=${encodeURIComponent(tag)}" class="nav-item">
        <span><span class="tag-dot ${tagDotClass(tag)}"></span>${formatTag(tag)}</span>
        <span class="nav-item__count">${count}</span>
      </a>`,
    )
    .join('');
  if (moreBtn) moreBtn.hidden = tags.length <= 3;
}

function scrollToBoardCard(id) {
  const card = [...document.querySelectorAll('.board-card[data-board-id]')].find(
    (el) => el.dataset.boardId === id,
  );
  card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderBoardCards(collections, captures) {
  const grid = document.getElementById('boards-grid');
  if (!grid) return;

  const cardsHtml = collections
    .map((col) => {
      const clips = clipsForCollection(col.id, captures);
      const href = `dashboard.html?collection=${encodeURIComponent(col.id)}`;
      const countLabel = `${clips.length} item${clips.length === 1 ? '' : 's'}`;
      return `
        <a href="${href}" class="board-card clip-card-like" data-board-id="${escapeHtml(col.id)}">
          ${boardMosaicHtml(clips)}
          <div class="board-card__body">
            <span class="board-card__title">${escapeHtml(col.name)}</span>
            <span class="board-card__count">${countLabel}</span>
          </div>
        </a>`;
    })
    .join('');

  const addCard = `
    <button type="button" class="board-card board-card--add clip-card-like" id="board-add" aria-label="New collection">
      <span class="board-card--add-inner">+ New collection</span>
    </button>
  `;

  grid.innerHTML = cardsHtml + addCard;

  document.getElementById('board-add')?.addEventListener('click', async () => {
    const name = prompt('Collection name');
    if (!name?.trim()) return;
    const col = await addCollection(name.trim());
    window.location.hash = encodeURIComponent(col.id);
    await refresh();
  });
}

async function refresh() {
  const captures = await getCaptures();
  const collections = await getCollections();

  const highlightId = window.location.hash.slice(1)
    ? decodeURIComponent(window.location.hash.slice(1))
    : '';

  updateCounts(captures);
  renderSidebarCollections(captures, collections, highlightId);
  renderSidebarTags(captures);
  renderBoardCards(collections, captures);

  if (highlightId) {
    requestAnimationFrame(() => scrollToBoardCard(highlightId));
  }
}

document.getElementById('btn-new-collection')?.addEventListener('click', async () => {
  const name = prompt('Collection name');
  if (!name?.trim()) return;
  await addCollection(name.trim());
  await refresh();
});

window.addEventListener('hashchange', () => refresh());

refresh();
