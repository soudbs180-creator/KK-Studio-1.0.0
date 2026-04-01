import { keyManager } from '../auth/keyManager';
import { adminModelService } from './adminModelService';

let refreshPromise: Promise<void> | null = null;

export async function refreshModelLibraryData(): Promise<void> {
    if (refreshPromise) {
        return refreshPromise;
    }

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
