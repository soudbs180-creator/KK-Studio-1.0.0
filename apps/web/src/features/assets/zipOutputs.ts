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

const fetchUrlAsBlob = async (url: string, fetchBlob?: (url: string) => Promise<Blob>): Promise<Blob> => {
  if (fetchBlob) return fetchBlob(url);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.blob();
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
        const blob = await fetchUrlAsBlob(candidate.sourceUrl, params.fetchBlob);
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

        const blob = await fetchUrlAsBlob(storageUrl, params.fetchBlob);
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

  for (let index = 0; index < imageNodes.length; index += 1) {
    const image = imageNodes[index];
    const filename = getSafeOriginalFilename(image, index);
    const attemptedSources = resolveOriginalSourceCandidates(image, index).map(candidate => candidate.sourceKind);

    try {
      const downloaded = await downloadOriginalBlob(image, index, params);
      zip.file(filename, await blobToZipData(downloaded.blob));
      manifest.items.push({
        nodeId: image.id,
        parentPromptId: image.parentPromptId,
        filename,
        sourceKind: downloaded.sourceKind,
        promptSummary: summarizePrompt(image.prompt),
        model: image.model,
        createdAt: toCreatedAt(image.timestamp),
        mimeType: image.mimeType,
        originalUrlUsed: downloaded.sourceKind === 'originalUrl',
      });
    } catch (error: any) {
      manifest.failedItems.push({
        nodeId: image.id,
        parentPromptId: image.parentPromptId,
        reason: error?.message || 'fetch_failed',
        attemptedSources,
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
