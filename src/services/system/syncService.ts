import type { Canvas } from '../../types';
import { legacyWebApiClient } from '../api/kkApiClient';

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

/**
 * Service to handle cloud sync via the typed KK API layer.
 */
export const syncService = {
  async saveLayout(canvases: Canvas[]) {
    try {
      const response = await legacyWebApiClient.saveWorkspaceLayout({
        canvases: canvases as unknown as Record<string, unknown>[],
      });

      if (isUnauthorizedResponse(response)) {
        return;
      }

      unwrapOrThrow(response, 'Failed to save workspace layout.');
      console.log('[SyncService] Layout saved via KK API');
    } catch (e) {
      console.error('[SyncService] Failed to save layout:', e);
    }
  },

  async loadLayout(): Promise<Canvas[]> {
    try {
      const response = await legacyWebApiClient.getWorkspaceLayout();
      if (isUnauthorizedResponse(response)) {
        return [];
      }

      const data = unwrapOrThrow(response, 'Failed to load workspace layout.');
      return normalizeCanvasArray(data.canvases);
    } catch (e) {
      console.error('[SyncService] Failed to load layout:', e);
      return [];
    }
  },

  async uploadImagePair(id: string, blob: Blob): Promise<{ original: string, thumbnail: string }> {
    void id;

    // Cloud image upload stays disabled; keep returning local object URLs for callers.
    const localUrl = URL.createObjectURL(blob);
    return { original: localUrl, thumbnail: localUrl };
  },

  async cleanupAllCloudImages(): Promise<{ count: number; success: boolean }> {
    try {
      const response = await legacyWebApiClient.cleanupCloudImages();
      if (isUnauthorizedResponse(response)) {
        return { count: 0, success: true };
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
