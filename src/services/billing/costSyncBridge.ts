type CostSyncHandler = () => Promise<boolean> | boolean;

let costSyncHandler: CostSyncHandler | null = null;

export function registerCostSyncHandler(handler: CostSyncHandler | null): void {
    costSyncHandler = handler;
}

export async function requestCostSync(): Promise<boolean> {
    if (!costSyncHandler) {
        return false;
    }

    try {
        return await costSyncHandler();
    } catch (error) {
        console.error('[CostSyncBridge] Failed to run cost sync handler:', error);
        return false;
    }
}
