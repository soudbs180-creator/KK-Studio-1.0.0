import type { GeneratedImage, PromptNode, ReferenceImage } from '../../types';
import { toReferenceImageDataUrl } from '../../utils/referenceImageStorage.ts';
import { buildMentionText, getImageFavoriteName, normalizeMentionName } from './favoriteUtils.ts';
import type {
  FavoriteImage,
  FavoriteItem,
  ReferenceMentionBuildInput,
  ReferenceMentionCandidate,
  ReferenceMentionTab,
} from './types';

const isImageMime = (mimeType?: string) => String(mimeType || '').toLowerCase().startsWith('image/');

function referenceImageName(reference: ReferenceImage, index: number): string {
  return normalizeMentionName(reference.id || reference.storageId || `ref${index + 1}`);
}

function candidateSearchText(candidate: ReferenceMentionCandidate): string {
  return [
    candidate.name,
    candidate.mentionText,
    candidate.mimeType,
    candidate.storageId,
    candidate.prompt,
    ...(candidate.tags || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function filterMentionCandidates(
  items: ReferenceMentionCandidate[],
  query: string,
): ReferenceMentionCandidate[] {
  const normalized = query.trim().replace(/^@/, '').toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => candidateSearchText(item).includes(normalized));
}

export function buildReferenceMentionTabs(input: ReferenceMentionBuildInput): ReferenceMentionTab[] {
  const uploaded: ReferenceMentionCandidate[] = [
    ...(input.promptBarReferences || []).map((reference, index): ReferenceMentionCandidate => {
      const name = referenceImageName(reference, index);
      return {
        id: `promptbar-ref-${reference.storageId || reference.id || index}`,
        source: 'upload',
        kind: 'uploaded-image',
        name,
        mentionText: buildMentionText(name),
        previewUrl: reference.url || toReferenceImageDataUrl(reference.data, reference.mimeType),
        mimeType: reference.mimeType,
        storageId: reference.storageId || reference.id,
        referenceImage: reference,
      };
    }),
    ...(input.assistantImages || []).map((asset): ReferenceMentionCandidate => {
      const name = normalizeMentionName(asset.name || asset.relativePath || asset.id);
      return {
        id: `assistant-image-${asset.id}`,
        source: 'upload',
        kind: 'uploaded-image',
        name,
        mentionText: buildMentionText(name),
        previewUrl: asset.thumbnailUrl,
        mimeType: asset.mimeType,
        storageId: asset.storageId || asset.id,
        assistantAsset: asset,
        referenceImage: asset.thumbnailUrl ? {
          id: asset.storageId || asset.id,
          storageId: asset.storageId || asset.id,
          data: asset.thumbnailUrl,
          mimeType: asset.mimeType || 'image/png',
          url: asset.thumbnailUrl,
          mentionName: name,
          mentionText: buildMentionText(name),
          mentionSourceId: asset.id,
        } : undefined,
      };
    }),
    ...(input.assistantFiles || []).map((asset): ReferenceMentionCandidate => {
      const name = normalizeMentionName(asset.name || asset.relativePath || asset.id);
      return {
        id: `assistant-file-${asset.id}`,
        source: 'upload',
        kind: 'uploaded-file',
        name,
        mentionText: buildMentionText(name),
        mimeType: asset.mimeType,
        assistantAsset: asset,
        fileOnly: true,
      };
    }),
  ];

  const promptById = new Map((input.promptNodes || []).map((prompt) => [prompt.id, prompt]));
  const taggedImages: ReferenceMentionCandidate[] = [];

  (input.imageNodes || []).forEach((image) => {
    const parentPrompt = image.parentPromptId ? promptById.get(image.parentPromptId) : undefined;
    const tags = Array.from(new Set([...(parentPrompt?.tags || []), ...(image.tags || [])]));
    if (tags.length === 0) return;

    tags.forEach((tag) => {
      const name = normalizeMentionName(image.alias || tag || getImageFavoriteName(image));
      taggedImages.push({
        id: `tagged-image-${image.id}-${tag}`,
        source: 'tag',
        kind: 'tagged-image',
        name,
        mentionText: buildMentionText(name),
        previewUrl: image.url || image.originalUrl || image.apiResultUrl,
        mimeType: image.mimeType || 'image/png',
        tags,
        sourceImageId: image.id,
        sourcePromptId: image.parentPromptId,
        storageId: image.storageId || image.id,
        url: image.url,
        originalUrl: image.originalUrl,
        apiResultUrl: image.apiResultUrl,
        prompt: image.prompt,
        referenceImage: generatedImageToReferenceImage(image, name),
      });
    });
  });

  const favorites = (input.favorites || [])
    .filter((item): item is FavoriteImage => item.kind === 'favorite-image')
    .map((favorite): ReferenceMentionCandidate => {
      const name = normalizeMentionName(favorite.name);
      return {
        id: `favorite-image-${favorite.id}`,
        source: 'favorite',
        kind: 'favorite-image',
        name,
        mentionText: buildMentionText(name),
        previewUrl: favorite.thumbnailObjectUrl || favorite.thumbnailUrl || favorite.originalObjectUrl || favorite.originalUrl || favorite.url || favorite.apiResultUrl,
        mimeType: favorite.mimeType || 'image/png',
        tags: favorite.tags || [],
        sourceImageId: favorite.sourceImageId,
        sourcePromptId: favorite.parentPromptId,
        favoriteId: favorite.id,
        storageId: favorite.storageId || favorite.sourceImageId || favorite.id,
        url: favorite.url,
        originalUrl: favorite.originalUrl || favorite.originalObjectUrl,
        apiResultUrl: favorite.apiResultUrl,
        prompt: favorite.prompt,
        referenceImage: favoriteImageToReferenceImage(favorite),
      };
    });

  return [
    { id: 'upload', label: '上传内容', items: dedupeMentionCandidates(uploaded) },
    { id: 'tag', label: '标签', items: dedupeMentionCandidates(taggedImages) },
    { id: 'favorite', label: '喜欢', items: dedupeMentionCandidates(favorites) },
  ];
}

export function generatedImageToReferenceImage(image: GeneratedImage, name?: string): ReferenceImage {
  const source = image.originalUrl || image.apiResultUrl || image.url || '';
  const mentionName = name || image.alias || image.fileName || image.displayLabel || image.id;
  return {
    id: image.storageId || image.id,
    storageId: image.storageId || image.id,
    data: source,
    mimeType: image.mimeType || 'image/png',
    url: image.url || image.originalUrl || image.apiResultUrl,
    mentionName,
    mentionText: buildMentionText(mentionName),
    mentionSourceId: image.id,
  };
}

export function favoriteImageToReferenceImage(favorite: FavoriteImage): ReferenceImage | undefined {
  const source = favorite.originalObjectUrl || favorite.originalUrl || favorite.apiResultUrl || favorite.url || favorite.thumbnailObjectUrl || favorite.thumbnailUrl;
  if (!source && !favorite.storageId) return undefined;
  return {
    id: favorite.storageId || favorite.sourceImageId || favorite.id,
    storageId: favorite.storageId || favorite.sourceImageId || favorite.id,
    data: source || '',
    mimeType: favorite.mimeType || 'image/png',
    url: favorite.thumbnailObjectUrl || favorite.thumbnailUrl || source,
    mentionName: favorite.name,
    mentionText: buildMentionText(favorite.name),
    mentionSourceId: favorite.id,
  };
}

export function canCandidateAttachToPromptBar(candidate: ReferenceMentionCandidate): boolean {
  if (candidate.fileOnly) return false;
  return isImageMime(candidate.mimeType) && Boolean(candidate.referenceImage);
}

export function dedupeMentionCandidates(items: ReferenceMentionCandidate[]): ReferenceMentionCandidate[] {
  const seen = new Set<string>();
  const result: ReferenceMentionCandidate[] = [];

  items.forEach((item) => {
    const key = [
      item.source,
      item.kind,
      item.favoriteId,
      item.sourceImageId,
      item.storageId,
      item.name.toLowerCase(),
    ].filter(Boolean).join(':');
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });

  return result;
}

export function countReferenceMentionTabs(tabs: ReferenceMentionTab[]): Record<string, number> {
  return Object.fromEntries(tabs.map((tab) => [tab.id, tab.items.length]));
}
