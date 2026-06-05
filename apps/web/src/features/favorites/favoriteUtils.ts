import type { GeneratedImage, PromptNode } from '../../types';
import type { FavoriteImage, FavoriteItem, FavoritePrompt } from './types';

export type FavoriteSortMode = 'updated-desc' | 'created-desc' | 'name-asc';
export type FavoriteFilterKind = 'all' | 'images' | 'prompts';

export function createFavoriteId(prefix: 'fav_img' | 'fav_prompt' = 'fav_img'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeFavoriteName(value?: string | null, fallback = 'Untitled'): string {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized || fallback;
}

export function normalizeMentionName(value?: string | null): string {
  return normalizeFavoriteName(value, 'reference').replace(/^@+/, '');
}

export function buildMentionText(value?: string | null): string {
  return `@${normalizeMentionName(value)}`;
}

export function getImageFavoriteName(image: Pick<GeneratedImage, 'alias' | 'fileName' | 'displayLabel' | 'prompt' | 'id'>): string {
  return normalizeFavoriteName(
    image.alias || image.fileName || image.displayLabel || image.prompt || image.id,
    'Image',
  );
}

export function getPromptFavoriteName(promptNode: Pick<PromptNode, 'prompt' | 'id'>): string {
  const prompt = normalizeFavoriteName(promptNode.prompt, promptNode.id || 'Prompt');
  return prompt.length > 40 ? `${prompt.slice(0, 40)}...` : prompt;
}

export function createFavoriteImageFromGeneratedImage(
  image: GeneratedImage,
  now: number = Date.now(),
): FavoriteImage {
  return {
    id: createFavoriteId('fav_img'),
    kind: 'favorite-image',
    name: getImageFavoriteName(image),
    sourceImageId: image.id,
    sourceCanvasId: image.canvasId,
    parentPromptId: image.parentPromptId,
    storageId: image.storageId,
    mimeType: image.mimeType || inferMimeTypeFromSource(image.originalUrl || image.apiResultUrl || image.url),
    url: image.url,
    originalUrl: image.originalUrl,
    apiResultUrl: image.apiResultUrl,
    thumbnailUrl: image.url,
    prompt: image.prompt,
    model: image.model,
    tags: image.tags || [],
    sourceKind: resolveFavoriteImageSource(image).sourceKind,
    createdAt: now,
    updatedAt: now,
  };
}

export function createFavoritePromptFromNode(
  promptNode: PromptNode,
  now: number = Date.now(),
): FavoritePrompt {
  return {
    id: createFavoriteId('fav_prompt'),
    kind: 'favorite-prompt',
    name: getPromptFavoriteName(promptNode),
    prompt: promptNode.prompt,
    sourcePromptId: promptNode.id,
    sourceCanvasId: undefined,
    tags: promptNode.tags || [],
    createdAt: now,
    updatedAt: now,
  };
}

export function getFavoriteSearchText(item: FavoriteItem): string {
  if (item.kind === 'favorite-image') {
    return [
      item.name,
      item.prompt,
      item.model,
      item.storageId,
      item.sourceImageId,
      ...(item.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();
  }

  return [
    item.name,
    item.prompt,
    item.sourcePromptId,
    ...(item.tags || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function filterFavorites(
  items: FavoriteItem[],
  query: string = '',
  kind: FavoriteFilterKind = 'all',
  sortMode: FavoriteSortMode = 'updated-desc',
): FavoriteItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (kind === 'images' && item.kind !== 'favorite-image') return false;
    if (kind === 'prompts' && item.kind !== 'favorite-prompt') return false;
    if (!normalizedQuery) return true;
    return getFavoriteSearchText(item).includes(normalizedQuery);
  });

  return filtered.sort((left, right) => {
    if (sortMode === 'name-asc') {
      return left.name.localeCompare(right.name);
    }

    if (sortMode === 'created-desc') {
      return (right.createdAt || 0) - (left.createdAt || 0);
    }

    return (right.updatedAt || 0) - (left.updatedAt || 0);
  });
}

export function findDuplicateFavorite(
  items: FavoriteItem[],
  candidate: FavoriteItem,
): FavoriteItem | undefined {
  if (candidate.kind === 'favorite-image') {
    return items.find((item) => {
      if (item.kind !== 'favorite-image') return false;
      return Boolean(
        (candidate.sourceImageId && item.sourceImageId === candidate.sourceImageId)
        || (candidate.storageId && item.storageId === candidate.storageId)
        || (candidate.originalUrl && item.originalUrl === candidate.originalUrl)
        || (candidate.apiResultUrl && item.apiResultUrl === candidate.apiResultUrl)
        || (candidate.url && item.url === candidate.url),
      );
    });
  }

  const promptText = candidate.prompt.trim();
  return items.find((item) => (
    item.kind === 'favorite-prompt'
    && (
      (candidate.sourcePromptId && item.sourcePromptId === candidate.sourcePromptId)
      || item.prompt.trim() === promptText
    )
  ));
}

export function upsertFavoriteItem(items: FavoriteItem[], candidate: FavoriteItem): FavoriteItem[] {
  const duplicate = findDuplicateFavorite(items, candidate);
  if (!duplicate) {
    return [candidate, ...items];
  }

  return items.map((item) => (
    item.id === duplicate.id
      ? {
        ...item,
        ...candidate,
        id: duplicate.id,
        createdAt: duplicate.createdAt,
        updatedAt: candidate.updatedAt,
      } as FavoriteItem
      : item
  ));
}

export function resolveFavoriteImageSource(image: Pick<GeneratedImage, 'originalUrl' | 'apiResultUrl' | 'url' | 'storageId'>): {
  sourceKind: FavoriteImage['sourceKind'];
  source?: string;
  storageId?: string;
} {
  const originalUrl = String(image.originalUrl || '').trim();
  if (originalUrl) return { sourceKind: 'originalUrl', source: originalUrl };

  const apiResultUrl = String(image.apiResultUrl || '').trim();
  if (apiResultUrl) return { sourceKind: 'apiResultUrl', source: apiResultUrl };

  const url = String(image.url || '').trim();
  if (url) return { sourceKind: 'url', source: url };

  const storageId = String(image.storageId || '').trim();
  if (storageId) return { sourceKind: 'storageId', storageId };

  return { sourceKind: 'missing' };
}

export function inferMimeTypeFromSource(source?: string): string {
  const value = String(source || '').toLowerCase();
  const match = value.match(/^data:([^;,]+)/);
  if (match?.[1]) return match[1];
  if (value.includes('.webp')) return 'image/webp';
  if (value.includes('.jpg') || value.includes('.jpeg')) return 'image/jpeg';
  if (value.includes('.gif')) return 'image/gif';
  if (value.includes('.mp4')) return 'video/mp4';
  return 'image/png';
}
