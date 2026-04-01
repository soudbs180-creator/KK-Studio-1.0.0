import { keyManager } from '../auth/keyManager';
import { adminModelService } from './adminModelService';

const MODEL_LIBRARY_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

let refreshPromise: Promise<void> | null = null;
let lastRefreshStartedAt = 0;

export async function refreshModelLibraryData(options?: { force?: boolean }): Promise<void> {
    if (refreshPromise) {
        return refreshPromise;
    }

    const now = Date.now();
    if (!options?.force && now - lastRefreshStartedAt < MODEL_LIBRARY_REFRESH_INTERVAL_MS) {
        return;
    }

    lastRefreshStartedAt = now;

    refreshPromise = (async () => {
        const results = await Promise.allSettled([
            keyManager.refreshFromCloudNow(),
            adminModelService.forceLoadAdminModels(),
        ]);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const source = index === 0 ? 'user API' : 'admin credit models';
                console.warn(`[ModelLibraryRefresh] Failed to refresh ${source}:`, result.reason);
            }
        });
    })().finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

export function refreshModelLibraryDataInBackground(options?: { force?: boolean }): void {
    void refreshModelLibraryData(options).catch((error) => {
        console.warn('[ModelLibraryRefresh] Background refresh failed:', error);
    });
}
