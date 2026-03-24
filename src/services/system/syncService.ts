import { Canvas } from '../../types';
import { legacyWebApiClient } from '../api/kkApiClient';

function unwrapOrThrow<T>(response: { success: boolean; data?: T; error?: { message?: string } }, fallback: string): T {
    if (response.success && response.data !== undefined) {
        return response.data;
    }

    throw new Error(response.error?.message || fallback);
}

/**
 * Service to handle Cloud Sync (Database + Storage)
 */
export const syncService = {
    // --- Database Sync (Canvas State) ---

    async saveLayout(canvases: Canvas[]) {
        try {
            const response = await legacyWebApiClient.saveWorkspaceLayout({
                canvases: canvases as unknown as Record<string, unknown>[],
            });
            unwrapOrThrow(response, 'Failed to save workspace layout.');
            console.log('[SyncService] Layout saved via API');
        } catch (e) {
            console.error('[SyncService] Failed to save layout:', e);
        }
    },

    async loadLayout(): Promise<Canvas[]> {
        try {
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
