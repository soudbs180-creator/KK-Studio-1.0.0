import type { Canvas } from '../../types';
import { kkWebApiClient } from '../api/kkApiClient';

function unwrapOrThrow<T>(
  response: {
    success: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  },
  fallback: string,
): T {
  if (response.success && response.data !== undefined) {
    return response.data;
  }

  throw new Error(response.error?.message || fallback);
}

function isUnauthorizedResponse(
  response: {
    success: boolean;
    error?: { code?: string };
  },
): boolean {
  if (response.success) {
    return false;
  }

  const code = String(response.error?.code || '').trim().toUpperCase();
  return code === 'AUTH_REQUIRED' || code === 'HTTP_401';
}

function normalizeCanvasArray(raw: unknown): Canvas[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item): item is Canvas => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({ ...item }));
}

function hasLocalOnlyCanvasMedia(canvases: Canvas[]): boolean {
  return canvases.some((canvas) =>
    canvas.imageNodes.length > 0
    || canvas.promptNodes.some((promptNode) => Array.isArray(promptNode.referenceImages) && promptNode.referenceImages.length > 0)
  );
}

/**
 * Service to handle cloud sync via the typed KK API layer.
 */
export const syncService = {
  async saveLayout(canvases: Canvas[]) {
    try {
      if (hasLocalOnlyCanvasMedia(canvases)) {
        throw new Error('Cloud workspace sync is disabled for canvases that still depend on local-only media.');
      }

      const response = await kkWebApiClient.saveWorkspaceLayout({
        canvases: canvases as unknown as Record<string, unknown>[],
      });

      if (isUnauthorizedResponse(response)) {
        throw new Error('Authenticated KK API session is required to save workspace layout.');
      }

      unwrapOrThrow(response, 'Failed to save workspace layout.');
      console.log('[SyncService] Layout saved via KK API');
    } catch (e) {
      console.error('[SyncService] Failed to save layout:', e);
      throw e;
    }
  },

  async loadLayout(): Promise<Canvas[]> {
    try {
      const response = await kkWebApiClient.getWorkspaceLayout();
      if (isUnauthorizedResponse(response)) {
        return [];
      }

      const data = unwrapOrThrow(response, 'Failed to load workspace layout.');
      return normalizeCanvasArray(data.canvases);
    } catch (e) {
      console.error('[SyncService] Failed to load layout:', e);
      throw e;
    }
  },

  async uploadImagePair(id: string, blob: Blob): Promise<{ original: string, thumbnail: string }> {
    void id;
    void blob;
    throw new Error('Cloud image sync is disabled until server-backed asset upload is implemented.');
  },

  async cleanupAllCloudImages(): Promise<{ count: number; success: boolean }> {
    try {
      const response = await kkWebApiClient.cleanupCloudImages();
      if (isUnauthorizedResponse(response)) {
        throw new Error('Authenticated KK API session is required to clean up cloud images.');
      }

      const data = unwrapOrThrow(response, 'Failed to cleanup cloud images.');
      return { count: data.deletedCount, success: true };
    } catch (e) {
      console.error('[Cloud Cleanup] Failed:', e);
      throw e;
    }
  },

  async _uploadWithQuotaCheck(path: string, blob: Blob, retryCount = 0): Promise<void> {
    void path;
    void blob;
    void retryCount;
    return;
  },

  async _cleanupOldestImages(count: number) {
    void count;
  }
};
