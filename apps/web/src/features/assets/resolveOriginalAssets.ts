import { type GeneratedImage } from '../../types/index.ts';

export type ZipScope =
  | 'latest_batch'
  | 'current_batch'
  | 'selected_cards'
  | 'all_canvas_outputs'
  | 'asset_collection_outputs';

export type OriginalSourceKind =
  | 'originalUrl'
  | 'apiResultUrl'
  | 'url'
  | 'storageId'
  | 'localFile'
  | 'missing';

export interface DownloadCanvasLike {
  promptNodes?: Array<{ id?: string; childImageIds?: string[] }>;
  imageNodes?: GeneratedImage[];
}

export interface ImageNodesDownloadParams {
  scope: string;
  selectedNodeIds?: string[];
  activeCanvas?: DownloadCanvasLike | null;
}

export interface OriginalSourceResolution {
  nodeId: string;
  sourceUrl?: string;
  storageId?: string;
  filename: string;
  mimeType: string;
  sourceKind: OriginalSourceKind;
}

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
};

const normalizeScope = (scope: string): ZipScope => {
  if (
    scope === 'latest_batch'
    || scope === 'current_batch'
    || scope === 'selected_cards'
    || scope === 'all_canvas_outputs'
    || scope === 'asset_collection_outputs'
  ) {
    return scope;
  }

  return 'latest_batch';
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const dedupeById = (images: GeneratedImage[]): GeneratedImage[] => {
  const seen = new Set<string>();
  const result: GeneratedImage[] = [];

  for (const image of images) {
    if (!image?.id || seen.has(image.id)) continue;
    seen.add(image.id);
    result.push(image);
  }

  return result;
};

export function resolveImageNodesForDownload(params: ImageNodesDownloadParams): GeneratedImage[] {
  const scope = normalizeScope(params.scope);
  const imageNodes = params.activeCanvas?.imageNodes || [];

  if (scope === 'selected_cards') {
    const selectedIds = new Set((params.selectedNodeIds || []).filter(isNonEmptyString));
    if (selectedIds.size === 0) return [];

    const promptNodes = params.activeCanvas?.promptNodes || [];
    const selectedPromptNodes = promptNodes.filter(prompt => prompt.id && selectedIds.has(prompt.id));
    const selectedPromptIds = new Set(selectedPromptNodes.map(prompt => prompt.id).filter(isNonEmptyString));
    const selectedPromptChildIds = new Set(
      selectedPromptNodes.flatMap(prompt => prompt.childImageIds || []).filter(isNonEmptyString)
    );

    return dedupeById(imageNodes.filter((image: GeneratedImage) => (
      selectedIds.has(image.id)
      || selectedPromptChildIds.has(image.id)
      || (isNonEmptyString(image.parentPromptId) && selectedPromptIds.has(image.parentPromptId))
    )));
  }

  if (scope === 'latest_batch') {
    return [...imageNodes]
      .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
      .slice(0, 4);
  }

  return imageNodes;
}

const extensionFromMime = (mimeType: string): string =>
  IMAGE_MIME_EXTENSIONS[mimeType.toLowerCase()] || 'png';

const extensionFromName = (fileName?: string): string | null => {
  if (!fileName) return null;
  const match = fileName.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match?.[1]?.toLowerCase() || null;
};

export function getSafeOriginalFilename(image: GeneratedImage, index: number): string {
  const mimeType = image.mimeType || 'image/png';
  const extension = extensionFromName(image.fileName) || extensionFromMime(mimeType);
  const rawName = image.fileName || image.displayLabel || image.alias || image.id || `image_${index + 1}`;
  const baseName = rawName.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
  const safeBaseName = baseName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || `image_${index + 1}`;

  return `${String(index + 1).padStart(3, '0')}_${safeBaseName}.${extension}`;
}

export function resolveOriginalSourceCandidates(
  image: GeneratedImage,
  index = 0
): OriginalSourceResolution[] {
  const nodeId = image.id;
  const mimeType = image.mimeType || 'image/png';
  const filename = getSafeOriginalFilename(image, index);
  const candidates: OriginalSourceResolution[] = [];

  if (isNonEmptyString(image.originalUrl)) {
    candidates.push({ nodeId, sourceUrl: image.originalUrl.trim(), filename, mimeType, sourceKind: 'originalUrl' });
  }
  if (isNonEmptyString(image.apiResultUrl)) {
    candidates.push({ nodeId, sourceUrl: image.apiResultUrl.trim(), filename, mimeType, sourceKind: 'apiResultUrl' });
  }
  if (isNonEmptyString(image.url)) {
    candidates.push({ nodeId, sourceUrl: image.url.trim(), filename, mimeType, sourceKind: 'url' });
  }
  if (isNonEmptyString(image.storageId)) {
    candidates.push({ nodeId, storageId: image.storageId.trim(), filename, mimeType, sourceKind: 'storageId' });
  }

  return candidates;
}

export function resolveOriginalSource(image: GeneratedImage, index = 0): OriginalSourceResolution {
  const candidates = resolveOriginalSourceCandidates(image, index);
  if (candidates.length > 0) return candidates[0];

  return {
    nodeId: image.id,
    filename: getSafeOriginalFilename(image, index),
    mimeType: image.mimeType || 'image/png',
    sourceKind: 'missing',
  };
}
