import { create } from 'zustand';
import type { GeneratedImage, PromptNode } from '../../types';
import { getImage, getStrictOriginalImage } from '../../services/storage/imageStorage';
import { notify } from '../../services/system/notificationService';
import {
  createFavoriteImageFromGeneratedImage,
  createFavoritePromptFromNode,
  type FavoriteFilterKind,
  type FavoriteSortMode,
  filterFavorites,
  findDuplicateFavorite,
  inferMimeTypeFromSource,
  resolveFavoriteImageSource,
} from './favoriteUtils';
import { mirrorFavoritesToWorkspace, removeFavoriteMirror } from './favoriteWorkspaceMirror';
import type { FavoriteImage, FavoriteItem, FavoritePrompt } from './types';

const DB_NAME = 'kk_studio_favorites_db';
const DB_VERSION = 1;
const FAVORITES_STORE = 'favorites';
const BLOBS_STORE = 'blobs';

type FavoriteBlobKind = 'original' | 'thumbnail';

interface FavoriteBlobRecord {
  key: string;
  kind: FavoriteBlobKind;
  blob: Blob;
  updatedAt: number;
}

interface FavoritesState {
  items: FavoriteItem[];
  loaded: boolean;
  loading: boolean;
  error?: string;
  load: () => Promise<void>;
  addImageFavorite: (image: GeneratedImage) => Promise<FavoriteImage>;
  addPromptFavorite: (promptNode: PromptNode | { id?: string; prompt: string; tags?: string[] }, title?: string) => Promise<FavoritePrompt>;
  updateFavorite: (id: string, patch: Partial<FavoriteImage> | Partial<FavoritePrompt>) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  isImageFavorited: (image: Pick<GeneratedImage, 'id' | 'storageId' | 'originalUrl' | 'apiResultUrl' | 'url'>) => boolean;
  isPromptFavorited: (prompt: Pick<PromptNode, 'id' | 'prompt'> | string) => boolean;
  search: (query?: string, kind?: FavoriteFilterKind, sortMode?: FavoriteSortMode) => FavoriteItem[];
}

let dbPromise: Promise<IDBDatabase> | null = null;
const runtimeObjectUrls = new Set<string>();

function openFavoritesDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error || new Error('Failed to open favorites DB'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
          db.createObjectStore(FAVORITES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BLOBS_STORE)) {
          db.createObjectStore(BLOBS_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  return dbPromise;
}

function transaction<T>(
  mode: IDBTransactionMode,
  storeNames: string[],
  run: (stores: Record<string, IDBObjectStore>) => void,
): Promise<T | undefined> {
  return openFavoritesDb().then((db) => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
    let result: T | undefined;

    tx.onerror = () => reject(tx.error || new Error('Favorites transaction failed'));
    tx.oncomplete = () => resolve(result);

    const setResult = (value: T) => {
      result = value;
    };

    run(new Proxy(stores, {
      get(target, prop) {
        if (prop === '__setResult') return setResult;
        return target[prop as string];
      },
    }) as Record<string, IDBObjectStore>);
  }));
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function getAllFavorites(): Promise<FavoriteItem[]> {
  const db = await openFavoritesDb();
  const tx = db.transaction(FAVORITES_STORE, 'readonly');
  return idbRequest<FavoriteItem[]>(tx.objectStore(FAVORITES_STORE).getAll());
}

async function putFavorite(item: FavoriteItem): Promise<void> {
  const db = await openFavoritesDb();
  const tx = db.transaction(FAVORITES_STORE, 'readwrite');
  tx.objectStore(FAVORITES_STORE).put(stripRuntimeObjectUrls(item));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to persist favorite'));
  });
}

async function deleteFavoriteRecord(id: string): Promise<void> {
  const db = await openFavoritesDb();
  const tx = db.transaction(FAVORITES_STORE, 'readwrite');
  tx.objectStore(FAVORITES_STORE).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete favorite'));
  });
}

async function putBlobRecord(record: FavoriteBlobRecord): Promise<void> {
  const db = await openFavoritesDb();
  const tx = db.transaction(BLOBS_STORE, 'readwrite');
  tx.objectStore(BLOBS_STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to persist favorite blob'));
  });
}

async function getBlobRecord(key?: string): Promise<FavoriteBlobRecord | undefined> {
  if (!key) return undefined;
  const db = await openFavoritesDb();
  const tx = db.transaction(BLOBS_STORE, 'readonly');
  return idbRequest<FavoriteBlobRecord | undefined>(tx.objectStore(BLOBS_STORE).get(key));
}

async function deleteBlobRecord(key?: string): Promise<void> {
  if (!key) return;
  const db = await openFavoritesDb();
  const tx = db.transaction(BLOBS_STORE, 'readwrite');
  tx.objectStore(BLOBS_STORE).delete(key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete favorite blob'));
  });
}

function stripRuntimeObjectUrls(item: FavoriteItem): FavoriteItem {
  if (item.kind === 'favorite-image') {
    const { originalObjectUrl, thumbnailObjectUrl, ...rest } = item;
    return rest;
  }

  return item;
}

function objectUrlForBlob(blob?: Blob): string | undefined {
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  runtimeObjectUrls.add(url);
  return url;
}

function revokeRuntimeObjectUrls(): void {
  runtimeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  runtimeObjectUrls.clear();
}

async function hydrateRuntimeUrls(item: FavoriteItem): Promise<FavoriteItem> {
  if (item.kind !== 'favorite-image') return item;

  const [original, thumbnail] = await Promise.all([
    getBlobRecord(item.originalBlobKey),
    getBlobRecord(item.thumbnailBlobKey),
  ]);

  return {
    ...item,
    originalObjectUrl: objectUrlForBlob(original?.blob),
    thumbnailObjectUrl: objectUrlForBlob(thumbnail?.blob),
  };
}

async function sourceToBlob(source?: string, mimeType?: string): Promise<Blob | null> {
  if (!source) return null;

  if (source.startsWith('data:')) {
    const response = await fetch(source);
    return response.blob();
  }

  if (source.startsWith('blob:') || /^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) return null;
    return response.blob();
  }

  const text = source.includes(',') ? source.split(',').pop() || '' : source;
  if (!text) return null;
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'image/png' });
}

async function resolveImageFavoriteBlobs(image: GeneratedImage): Promise<{
  originalBlob?: Blob;
  thumbnailBlob?: Blob;
}> {
  const source = resolveFavoriteImageSource(image);
  let sourceUrl = source.source;

  if (!sourceUrl && source.storageId) {
    sourceUrl = (await getStrictOriginalImage(source.storageId)) || (await getImage(source.storageId)) || undefined;
  }

  const originalBlob = await sourceToBlob(sourceUrl, image.mimeType || inferMimeTypeFromSource(sourceUrl)).catch(() => null);
  const thumbnailSource = image.url || sourceUrl;
  const thumbnailBlob = thumbnailSource === sourceUrl
    ? originalBlob
    : await sourceToBlob(thumbnailSource, image.mimeType || inferMimeTypeFromSource(thumbnailSource)).catch(() => null);

  return {
    originalBlob: originalBlob || undefined,
    thumbnailBlob: thumbnailBlob || originalBlob || undefined,
  };
}

async function mirrorCurrentState(items: FavoriteItem[]): Promise<void> {
  try {
    const imageFavorites = items.filter((item): item is FavoriteImage => item.kind === 'favorite-image');
    const originalBlobsByKey = new Map<string, Blob>();
    const thumbnailBlobsByKey = new Map<string, Blob>();

    await Promise.all(imageFavorites.map(async (item) => {
      const [original, thumbnail] = await Promise.all([
        getBlobRecord(item.originalBlobKey),
        getBlobRecord(item.thumbnailBlobKey),
      ]);
      if (item.originalBlobKey && original?.blob) originalBlobsByKey.set(item.originalBlobKey, original.blob);
      if (item.thumbnailBlobKey && thumbnail?.blob) thumbnailBlobsByKey.set(item.thumbnailBlobKey, thumbnail.blob);
    }));

    await mirrorFavoritesToWorkspace({
      items: items.map(stripRuntimeObjectUrls),
      originalBlobsByKey,
      thumbnailBlobsByKey,
    });
  } catch (error) {
    console.warn('[Favorites] Workspace mirror skipped:', error);
  }
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  items: [],
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: undefined });

    try {
      revokeRuntimeObjectUrls();
      const rawItems = await getAllFavorites();
      const hydratedItems = await Promise.all(rawItems.map(hydrateRuntimeUrls));
      set({
        items: filterFavorites(hydratedItems, '', 'all', 'updated-desc'),
        loaded: true,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        loaded: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  addImageFavorite: async (image) => {
    if (!get().loaded) {
      await get().load();
    }

    const now = Date.now();
    let favorite = createFavoriteImageFromGeneratedImage(image, now);
    const duplicate = findDuplicateFavorite(get().items, favorite);
    if (duplicate && duplicate.kind === 'favorite-image') {
      favorite = {
        ...duplicate,
        ...favorite,
        id: duplicate.id,
        createdAt: duplicate.createdAt,
        updatedAt: now,
        originalBlobKey: duplicate.originalBlobKey,
        thumbnailBlobKey: duplicate.thumbnailBlobKey,
        originalObjectUrl: duplicate.originalObjectUrl,
        thumbnailObjectUrl: duplicate.thumbnailObjectUrl,
      };
    }

    const blobs = await resolveImageFavoriteBlobs(image);
    if (blobs.originalBlob) {
      const key = `${favorite.id}:original`;
      favorite.originalBlobKey = key;
      await putBlobRecord({ key, kind: 'original', blob: blobs.originalBlob, updatedAt: now });
      favorite.originalObjectUrl = objectUrlForBlob(blobs.originalBlob);
    }

    if (blobs.thumbnailBlob) {
      const key = `${favorite.id}:thumbnail`;
      favorite.thumbnailBlobKey = key;
      await putBlobRecord({ key, kind: 'thumbnail', blob: blobs.thumbnailBlob, updatedAt: now });
      favorite.thumbnailObjectUrl = objectUrlForBlob(blobs.thumbnailBlob);
    }

    await putFavorite(favorite);
    const nextItems = filterFavorites(
      duplicate
        ? get().items.map((item) => (item.id === duplicate.id ? favorite : item))
        : [favorite, ...get().items],
    );
    set({ items: nextItems });
    void mirrorCurrentState(nextItems);
    notify.success('已收藏图片', favorite.name);
    return favorite;
  },

  addPromptFavorite: async (promptNode, title) => {
    if (!get().loaded) {
      await get().load();
    }

    const now = Date.now();
    const safePromptNode = {
      id: promptNode.id || `manual_${now}`,
      prompt: promptNode.prompt,
      tags: promptNode.tags || [],
      position: { x: 0, y: 0 },
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'manual',
      childImageIds: [],
      timestamp: now,
    } as PromptNode;
    let favorite = createFavoritePromptFromNode(safePromptNode, now);
    if (title) favorite.name = title;

    const duplicate = findDuplicateFavorite(get().items, favorite);
    if (duplicate && duplicate.kind === 'favorite-prompt') {
      favorite = {
        ...favorite,
        id: duplicate.id,
        createdAt: duplicate.createdAt,
        updatedAt: now,
      };
    }

    await putFavorite(favorite);
    const nextItems = filterFavorites(
      duplicate
        ? get().items.map((item) => (item.id === duplicate.id ? favorite : item))
        : [favorite, ...get().items],
    );
    set({ items: nextItems });
    void mirrorCurrentState(nextItems);
    notify.success('已收藏提示词', favorite.name);
    return favorite;
  },

  updateFavorite: async (id, patch) => {
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    const nextItem = {
      ...current,
      ...patch,
      id: current.id,
      kind: current.kind,
      updatedAt: Date.now(),
    } as FavoriteItem;

    await putFavorite(nextItem);
    const hydrated = await hydrateRuntimeUrls(nextItem);
    const nextItems = filterFavorites(get().items.map((item) => (item.id === id ? hydrated : item)));
    set({ items: nextItems });
    void mirrorCurrentState(nextItems);
  },

  removeFavorite: async (id) => {
    const current = get().items.find((item) => item.id === id);
    if (!current) return;

    await deleteFavoriteRecord(id);
    if (current.kind === 'favorite-image') {
      await Promise.all([
        deleteBlobRecord(current.originalBlobKey),
        deleteBlobRecord(current.thumbnailBlobKey),
      ]);
      void removeFavoriteMirror(current);
    }

    const nextItems = get().items.filter((item) => item.id !== id);
    set({ items: nextItems });
    void mirrorCurrentState(nextItems);
  },

  isImageFavorited: (image) => Boolean(findDuplicateFavorite(get().items, {
    id: 'candidate',
    kind: 'favorite-image',
    name: 'candidate',
    sourceImageId: image.id,
    storageId: image.storageId,
    originalUrl: image.originalUrl,
    apiResultUrl: image.apiResultUrl,
    url: image.url,
    createdAt: 0,
    updatedAt: 0,
  })),

  isPromptFavorited: (prompt) => {
    const id = typeof prompt === 'string' ? undefined : prompt.id;
    const text = typeof prompt === 'string' ? prompt : prompt.prompt;
    return Boolean(findDuplicateFavorite(get().items, {
      id: 'candidate',
      kind: 'favorite-prompt',
      name: 'candidate',
      prompt: text,
      sourcePromptId: id,
      createdAt: 0,
      updatedAt: 0,
    }));
  },

  search: (query = '', kind = 'all', sortMode = 'updated-desc') => (
    filterFavorites(get().items, query, kind, sortMode)
  ),
}));

export const favoritesStore = {
  load: () => useFavoritesStore.getState().load(),
  addImageFavorite: (image: GeneratedImage) => useFavoritesStore.getState().addImageFavorite(image),
  addPromptFavorite: (promptNode: PromptNode | { id?: string; prompt: string; tags?: string[] }, title?: string) => useFavoritesStore.getState().addPromptFavorite(promptNode, title),
  updateFavorite: (id: string, patch: Partial<FavoriteItem>) => useFavoritesStore.getState().updateFavorite(id, patch as any),
  removeFavorite: (id: string) => useFavoritesStore.getState().removeFavorite(id),
};
