import type { Canvas } from '../../types';
import { supabase } from '../../lib/supabase';
import { legacyWebApiClient, shouldUseLegacyWebApiFallback } from '../api/kkApiClient';

function unwrapOrThrow<T>(response: { success: boolean; data?: T; error?: { message?: string } }, fallback: string): T {
  if (response.success && response.data !== undefined) {
    return response.data;
  }

  throw new Error(response.error?.message || fallback);
}

const WORKSPACE_LAYOUT_BUCKET = 'generated-images';
const WORKSPACE_LAYOUT_DIRECTORY = '__system__';
const WORKSPACE_LAYOUT_FILE_NAME = 'layout.json';

function buildWorkspaceLayoutPath(userId: string): string {
  return `${userId}/${WORKSPACE_LAYOUT_DIRECTORY}/${WORKSPACE_LAYOUT_FILE_NAME}`;
}

function buildLegacyWorkspaceLayoutPath(userId: string): string {
  return `${userId}/${WORKSPACE_LAYOUT_FILE_NAME}`;
}

function isMissingStorageObject(error: { message?: string; name?: string } | null | undefined): boolean {
  const message = String(error?.message || '').toLowerCase();
  const name = String(error?.name || '').toLowerCase();
  return message.includes('not found') || name.includes('storagenotfound') || name.includes('storageunknownerror');
}

function normalizeCanvasArray(raw: unknown): Canvas[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item): item is Canvas => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({ ...item }));
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session?.user?.id || null;
}

async function downloadWorkspaceLayout(path: string): Promise<Canvas[] | null> {
  const { data, error } = await supabase.storage
    .from(WORKSPACE_LAYOUT_BUCKET)
    .download(path);

  if (error) {
    if (isMissingStorageObject(error)) {
      return null;
    }

    throw error;
  }

  const text = await data.text();
  if (!text.trim()) {
    return [];
  }

  return normalizeCanvasArray(JSON.parse(text));
}

async function loadLayoutViaSupabase(userId: string): Promise<Canvas[]> {
  const currentLayout = await downloadWorkspaceLayout(buildWorkspaceLayoutPath(userId));
  if (currentLayout) {
    return currentLayout;
  }

  const legacyLayout = await downloadWorkspaceLayout(buildLegacyWorkspaceLayoutPath(userId));
  return legacyLayout || [];
}

async function saveLayoutViaSupabase(userId: string, canvases: Canvas[]): Promise<void> {
  const serialized = JSON.stringify(canvases);
  const payload = new Blob([serialized], { type: 'application/json' });

  const { error } = await supabase.storage
    .from(WORKSPACE_LAYOUT_BUCKET)
    .upload(buildWorkspaceLayoutPath(userId), payload, {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) {
    throw error;
  }
}

async function cleanupCloudImagesViaSupabase(userId: string): Promise<{ count: number; success: boolean }> {
  const protectedRootEntries = new Set([WORKSPACE_LAYOUT_DIRECTORY, WORKSPACE_LAYOUT_FILE_NAME]);
  const { data: rootEntries, error } = await supabase.storage
    .from(WORKSPACE_LAYOUT_BUCKET)
    .list(userId, { limit: 100 });

  if (error) {
    throw error;
  }

  const removablePaths = (rootEntries || [])
    .map((entry) => String(entry.name || '').trim())
    .filter((name) => Boolean(name) && !protectedRootEntries.has(name))
    .map((name) => `${userId}/${name}`);

  if (removablePaths.length === 0) {
    return { count: 0, success: true };
  }

  const { error: removeError } = await supabase.storage
    .from(WORKSPACE_LAYOUT_BUCKET)
    .remove(removablePaths);

  if (removeError) {
    throw removeError;
  }

  return { count: removablePaths.length, success: true };
}

/**
 * Service to handle Cloud Sync (Database + Storage)
 */
export const syncService = {
  // --- Database Sync (Canvas State) ---

  async saveLayout(canvases: Canvas[]) {
    try {
      const userId = await getAuthenticatedUserId();
      if (userId) {
        await saveLayoutViaSupabase(userId, canvases);
        console.log('[SyncService] Layout saved via Supabase storage');
        return;
      }

      if (!shouldUseLegacyWebApiFallback()) {
        return;
      }

      const response = await legacyWebApiClient.saveWorkspaceLayout({
        canvases: canvases as unknown as Record<string, unknown>[],
      });
      unwrapOrThrow(response, 'Failed to save workspace layout.');
      console.log('[SyncService] Layout saved via legacy API fallback');
    } catch (e) {
      console.error('[SyncService] Failed to save layout:', e);
    }
  },

  async loadLayout(): Promise<Canvas[]> {
    try {
      const userId = await getAuthenticatedUserId();
      if (userId) {
        return await loadLayoutViaSupabase(userId);
      }

      if (!shouldUseLegacyWebApiFallback()) {
        return [];
      }

      const response = await legacyWebApiClient.getWorkspaceLayout();
      const data = unwrapOrThrow(response, 'Failed to load workspace layout.');
      return (data.canvases || []) as unknown as Canvas[];
    } catch (e) {
      console.error('[SyncService] Failed to load layout:', e);
      return [];
    }
  },

  // --- Storage Sync (Images) ---

  async uploadImagePair(id: string, blob: Blob): Promise<{ original: string, thumbnail: string }> {
    // DISABLE CLOUD UPLOAD
    // Return local blob URLs to satisfy interface, or empty strings.
    // The app should handle 'blob:' URLs correctly (which it does).
    // To be safe, we create a persistent ObjectURL if not already handled by caller,
    // but typically the caller (CanvasContext) already has the blob URL.
    const localUrl = URL.createObjectURL(blob);
    return { original: localUrl, thumbnail: localUrl };
  },

  // --- Cleanup Utilities ---

  /**
   * Delete ALL files in the user's cloud storage folder.
   * This allows users to wipe their cloud footprint for images.
   */
  async cleanupAllCloudImages(): Promise<{ count: number; success: boolean }> {
    try {
      const userId = await getAuthenticatedUserId();
      if (userId) {
        return await cleanupCloudImagesViaSupabase(userId);
      }

      if (!shouldUseLegacyWebApiFallback()) {
        return { count: 0, success: true };
      }

      const response = await legacyWebApiClient.cleanupCloudImages();
      const data = unwrapOrThrow(response, 'Failed to cleanup cloud images.');
      return { count: data.deletedCount, success: true };
    } catch (e) {
      console.error('[Cloud Cleanup] Failed:', e);
      throw e;
    }
  },

  // Internal: Upload with Auto-Cleanup logic (Deprecated/Unused)
  async _uploadWithQuotaCheck(path: string, blob: Blob, retryCount = 0): Promise<void> {
    // No-op
    return;
  },

  // Internal: Cleanup Logic (Deprecated/Unused)
  async _cleanupOldestImages(count: number) {
    // No-op
  }
};
