export const FAVORITES_COLLECTION_ID = 'favorites';

const DEFAULT_COLLECTIONS = [
  { id: 'favorites', name: 'Favorites' },
  { id: 'portfolio', name: 'Portfolio' },
  { id: 'new-project', name: 'New Project' },
  { id: 'inspo', name: 'Inspo' },
];

export async function getCollections() {
  const { collections } = await chrome.storage.local.get('collections');
  if (!collections?.length) {
    await chrome.storage.local.set({ collections: DEFAULT_COLLECTIONS });
    return DEFAULT_COLLECTIONS;
  }
  return collections;
}

export async function addCollection(name) {
  const collections = await getCollections();
  const id = `col-${Date.now()}`;
  const next = [...collections, { id, name }];
  await chrome.storage.local.set({ collections: next });
  return { id, name };
}

export async function getCaptures() {
  const { captures } = await chrome.storage.local.get('captures');
  return captures || [];
}

export async function saveCapture(capture) {
  const captures = await getCaptures();
  const collectionIds = capture.collectionIds || [];
  const savedToFavorites = collectionIds.includes(FAVORITES_COLLECTION_ID);
  const entry = {
    id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    favorite: savedToFavorites || !!capture.favorite,
    htmlTags: capture.htmlTags || [capture.tagName || capture.type].filter(Boolean),
    sourceUrl: capture.sourceUrl || '',
    thumbnail: capture.thumbnail || null,
    ...capture,
    collectionIds,
  };
  captures.unshift(entry);
  await chrome.storage.local.set({ captures });
  return entry;
}

export async function updateCapture(id, updates) {
  const captures = await getCaptures();
  const idx = captures.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  captures[idx] = { ...captures[idx], ...updates };
  await chrome.storage.local.set({ captures });
  return captures[idx];
}

export async function getPendingScan() {
  const { pendingScan } = await chrome.storage.local.get('pendingScan');
  return pendingScan || null;
}

export async function setPendingScan(scan) {
  await chrome.storage.local.set({ pendingScan: scan });
}

export async function clearPendingScan() {
  await chrome.storage.local.remove('pendingScan');
}

export function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just Now';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 10) return `${days} days ago`;
  return '10+ days ago';
}
