import JSZip from 'jszip';
import fileSaver from 'file-saver';

import { useAssetStore } from './assetStore.ts';
import {
  getSafeOriginalFilename,
  resolveImageNodesForDownload,
  resolveOriginalSourceCandidates,
  type OriginalSourceKind,
} from './resolveOriginalAssets.ts';
import { type GeneratedImage } from '../../types/index.ts';

const saveAs = typeof fileSaver === 'object' && fileSaver && 'saveAs' in fileSaver
  ? (fileSaver as any).saveAs
  : fileSaver;

export interface ZipParams {
  projectName: string;
  canvasId?: string;
  batchId: string;
  imageNodes: GeneratedImage[];
  selectedNodeIds?: string[];
  promptNodes?: any[];
  preferOriginal?: boolean;
  skipSave?: boolean;
  fetchBlob?: (url: string) => Promise<Blob>;
  fetchTimeoutMs?: number;
  retryAttempts?: number;
  retryBackoffMs?: number;
  downloadConcurrency?: number;
  onProgress?: (event: { completed: number; total: number; nodeId: string; status: 'success' | 'failed' }) => void;
}

export interface ZipManifestItem {
  nodeId: string;
  parentPromptId?: string;
  filename: string;
  sourceKind: OriginalSourceKind;
  promptSummary?: string;
  model?: string;
  createdAt?: string;
  mimeType?: string;
  originalUrlUsed: boolean;
}

export interface ZipManifestFailedItem {
  nodeId: string;
  parentPromptId?: string;
  reason: string;
  attemptedSources: OriginalSourceKind[];
}

export interface ZipManifest {
  projectName: string;
  canvasId?: string;
  batchId: string;
  scope: string;
  createdAt: string;
  count: number;
  failedCount: number;
  items: ZipManifestItem[];
  failedItems: ZipManifestFailedItem[];
}

export interface ZipOutputsResult {
  count: number;
  failedCount: number;
  manifest: ZipManifest;
  zipBlob?: Blob;
}

type DownloadedImage = {
  blob: Blob;
  sourceKind: OriginalSourceKind;
};

type DownloadResolution = {
  image: GeneratedImage;
  filename: string;
  attemptedSources: OriginalSourceKind[];
  downloaded?: DownloadedImage;
  error?: Error;
};

const DEFAULT_DOWNLOAD_CONCURRENCY = 4;
const MAX_DOWNLOAD_CONCURRENCY = 6;
const DEFAULT_FETCH_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_ATTEMPTS = 1;
const DEFAULT_RETRY_BACKOFF_MS = 500;

const isUsableBlob = (blob: Blob | null | undefined): blob is Blob =>
  !!blob && typeof blob.size === 'number' && blob.size > 0;

const toCreatedAt = (timestamp: unknown): string | undefined => {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return new Date(value).toISOString();
};

const summarizePrompt = (prompt: unknown): string | undefined => {
  if (typeof prompt !== 'string') return undefined;
  const trimmed = prompt.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : undefined;
};

const fetchUrlAsBlobWithTimeout = async (
  url: string,
  params: ZipParams
): Promise<Blob> => {
  if (params.fetchBlob) return params.fetchBlob(url);

  const timeoutMs = Number.isFinite(params.fetchTimeoutMs)
    ? Math.max(1000, Number(params.fetchTimeoutMs))
    : DEFAULT_FETCH_TIMEOUT_MS;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.blob();
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`fetch_timeout_${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const isRetryableFetchError = (error: Error): boolean =>
  /HTTP (408|409|425|429|5\d\d)|network|timeout|failed|aborted|abort|ECONNRESET|ETIMEDOUT/i.test(error.message);

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, params: ZipParams): Promise<Blob> => {
  const attempts = Number.isFinite(params.retryAttempts)
    ? Math.max(0, Math.floor(Number(params.retryAttempts)))
    : DEFAULT_RETRY_ATTEMPTS;
  const backoffMs = Number.isFinite(params.retryBackoffMs)
    ? Math.max(0, Number(params.retryBackoffMs))
    : DEFAULT_RETRY_BACKOFF_MS;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await fetchUrlAsBlobWithTimeout(url, params);
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= attempts || !isRetryableFetchError(lastError)) {
        throw lastError;
      }
      await sleep(backoffMs * (attempt + 1));
    }
  }

  throw lastError || new Error('fetch_failed');
};

const loadStorageImageUrl = async (id: string): Promise<string | null> => {
  const storage = await import('../../services/storage/imageStorage.ts');
  const strictOriginal = await storage.getStrictOriginalImage(id);
  if (strictOriginal) return strictOriginal;

  return storage.getImage(id);
};

const findLocalAssetBlob = (image: GeneratedImage): Blob | null => {
  const { images, files } = useAssetStore.getState();
  const matchedImage = images.find(asset => (
    asset.id === image.id
    || asset.name === image.fileName
    || asset.thumbnailUrl === image.url
  ));
  const matchedFile = files.find(asset => (
    asset.id === image.id
    || asset.name === image.fileName
  ));
  const localFile = (matchedImage || matchedFile)?.localFile;

  return localFile instanceof Blob ? localFile : null;
};

const downloadOriginalBlob = async (
  image: GeneratedImage,
  index: number,
  params: ZipParams
): Promise<DownloadedImage> => {
  const candidates = resolveOriginalSourceCandidates(image, index);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      if (candidate.sourceUrl) {
        const blob = await fetchWithRetry(candidate.sourceUrl, params);
        if (isUsableBlob(blob)) {
          return { blob, sourceKind: candidate.sourceKind };
        }
        throw new Error('empty_blob');
      }

      if (candidate.storageId) {
        const storageUrl = await loadStorageImageUrl(candidate.storageId);
        if (!storageUrl) {
          throw new Error('storage_not_found');
        }

        const blob = await fetchWithRetry(storageUrl, params);
        if (isUsableBlob(blob)) {
          return { blob, sourceKind: 'storageId' };
        }
        throw new Error('empty_storage_blob');
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[zipOutputs] Failed to load ${image.id} from ${candidate.sourceKind}:`, lastError.message);
    }
  }

  const localBlob = findLocalAssetBlob(image);
  if (isUsableBlob(localBlob)) {
    return { blob: localBlob, sourceKind: 'localFile' };
  }

  throw lastError || new Error('no_downloadable_original_source');
};

const blobToZipData = async (blob: Blob): Promise<ArrayBuffer | Blob> => {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  return blob;
};

const normalizeConcurrency = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_DOWNLOAD_CONCURRENCY;
  return Math.min(MAX_DOWNLOAD_CONCURRENCY, Math.max(1, Math.floor(numeric)));
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(items.length, concurrency);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }));

  return results;
};

export async function zipOutputs(scope: string, params: ZipParams): Promise<ZipOutputsResult> {
  const imageNodes = resolveImageNodesForDownload({
    scope,
    selectedNodeIds: params.selectedNodeIds,
    activeCanvas: {
      promptNodes: params.promptNodes,
      imageNodes: params.imageNodes || [],
    },
  });

  if (scope === 'selected_cards' && imageNodes.length === 0) {
    throw new Error('No selected image cards or prompt child images are available to download.');
  }

  if (imageNodes.length === 0) {
    throw new Error('No generated images are available to package on the current canvas.');
  }

  const zip = new JSZip();
  const manifest: ZipManifest = {
    projectName: params.projectName || 'KKStudio',
    canvasId: params.canvasId,
    batchId: params.batchId,
    scope,
    createdAt: new Date().toISOString(),
    count: 0,
    failedCount: 0,
    items: [],
    failedItems: [],
  };

  let completed = 0;
  const downloadedItems = await mapWithConcurrency(
    imageNodes,
    normalizeConcurrency(params.downloadConcurrency),
    async (image, index): Promise<DownloadResolution> => {
      const filename = getSafeOriginalFilename(image, index);
      const attemptedSources = resolveOriginalSourceCandidates(image, index).map(candidate => candidate.sourceKind);

      try {
        const downloaded = await downloadOriginalBlob(image, index, params);
        completed += 1;
        params.onProgress?.({ completed, total: imageNodes.length, nodeId: image.id, status: 'success' });
        return {
          image,
          filename,
          attemptedSources,
          downloaded,
        };
      } catch (error: any) {
        completed += 1;
        params.onProgress?.({ completed, total: imageNodes.length, nodeId: image.id, status: 'failed' });
        return {
          image,
          filename,
          attemptedSources,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }
  );

  for (const item of downloadedItems) {
    const { image } = item;
    if (item.downloaded) {
      zip.file(item.filename, await blobToZipData(item.downloaded.blob));
      manifest.items.push({
        nodeId: image.id,
        parentPromptId: image.parentPromptId,
        filename: item.filename,
        sourceKind: item.downloaded.sourceKind,
        promptSummary: summarizePrompt(image.prompt),
        model: image.model,
        createdAt: toCreatedAt(image.timestamp),
        mimeType: image.mimeType,
        originalUrlUsed: item.downloaded.sourceKind === 'originalUrl',
      });
    } else {
      manifest.failedItems.push({
        nodeId: image.id,
        parentPromptId: image.parentPromptId,
        reason: item.error?.message || 'fetch_failed',
        attemptedSources: item.attemptedSources,
      });
    }
  }

  manifest.count = manifest.items.length;
  manifest.failedCount = manifest.failedItems.length;
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  if (!params.skipSave) {
    if (typeof saveAs === 'function') {
      saveAs(zipBlob, `${params.projectName || 'KKStudio'}_outputs.zip`);
    } else {
      console.log(`[zipOutputs] Environment non-browser: generated ${params.projectName || 'KKStudio'}_outputs.zip in memory`);
    }
  }

  return {
    count: manifest.count,
    failedCount: manifest.failedCount,
    manifest,
    zipBlob,
  };
}
