export interface KeyManagerCloudSyncState {
    pendingStateCloudSync: boolean;
    pendingProviderCloudSync: boolean;
    cloudSyncRevision: number;
    pendingCloudRetryTimer: ReturnType<typeof setTimeout> | null;
}

export function createKeyManagerCloudSyncState(): KeyManagerCloudSyncState {
    return {
        pendingStateCloudSync: false,
        pendingProviderCloudSync: false,
        cloudSyncRevision: 0,
        pendingCloudRetryTimer: null,
    };
}

export function hasPendingCloudSync(state: KeyManagerCloudSyncState): boolean {
    return state.pendingStateCloudSync || state.pendingProviderCloudSync;
}

export function markPendingStateCloudSync(state: KeyManagerCloudSyncState): number {
    state.pendingStateCloudSync = true;
    state.cloudSyncRevision += 1;
    return state.cloudSyncRevision;
}

export function markPendingProviderCloudSync(state: KeyManagerCloudSyncState): number {
    state.pendingProviderCloudSync = true;
    state.cloudSyncRevision += 1;
    return state.cloudSyncRevision;
}

export function resetCloudSyncState(state: KeyManagerCloudSyncState): void {
    state.pendingStateCloudSync = false;
    state.pendingProviderCloudSync = false;
    state.cloudSyncRevision = 0;
}

export function clearPendingCloudRetry(state: KeyManagerCloudSyncState): void {
    if (!state.pendingCloudRetryTimer) {
        return;
    }

    clearTimeout(state.pendingCloudRetryTimer);
    state.pendingCloudRetryTimer = null;
}

export function schedulePendingCloudRetry(
    state: KeyManagerCloudSyncState,
    options: {
        userId: string | null;
        cloudSyncBackoffUntil: number;
        onRetry: () => void;
    }
): void {
    if (!options.userId || !hasPendingCloudSync(state)) {
        return;
    }

    if (state.pendingCloudRetryTimer) {
        return;
    }

    const waitMs = Math.max(1000, options.cloudSyncBackoffUntil - Date.now(), 3000);
    state.pendingCloudRetryTimer = setTimeout(() => {
        state.pendingCloudRetryTimer = null;
        options.onRetry();
    }, waitMs);
}

export function clearCloudSyncPendingFlagsOnRevisionMatch(
    state: KeyManagerCloudSyncState,
    revision: number
): void {
    if (state.cloudSyncRevision !== revision) {
        return;
    }

    state.pendingStateCloudSync = false;
    state.pendingProviderCloudSync = false;
}
