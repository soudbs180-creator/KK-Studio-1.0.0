import { useEffect, useRef, type MutableRefObject } from 'react';
import { persistCanvasStateToLocalStorage } from './canvasPersistence';

type BrowserIdleCallbackHandle = number;

type BrowserIdleCallback = (
    callback: () => void,
    options?: { timeout?: number }
) => BrowserIdleCallbackHandle;

type BrowserIdleScheduler = Window & {
    requestIdleCallback?: BrowserIdleCallback;
    cancelIdleCallback?: (handle: BrowserIdleCallbackHandle) => void;
};

export function useCanvasLocalPersistence<T>(params: {
    state: T;
    persistenceToken?: unknown;
    isLoading: boolean;
    storageKey: string;
    stateRef: MutableRefObject<T>;
    isLoadingRef: MutableRefObject<boolean>;
    urgentSaveRef: MutableRefObject<boolean>;
    prepareBeforeUnloadState: (state: T) => T;
}): void {
    const {
        state,
        persistenceToken,
        isLoading,
        storageKey,
        stateRef,
        isLoadingRef,
        urgentSaveRef,
        prepareBeforeUnloadState,
    } = params;
    const localPersistenceToken = persistenceToken ?? state;
    const hasSkippedInitialDebouncedSaveRef = useRef(false);

    useEffect(() => {
        if (isLoading) return;
        if (!hasSkippedInitialDebouncedSaveRef.current) {
            hasSkippedInitialDebouncedSaveRef.current = true;
            urgentSaveRef.current = false;
            return;
        }

        const saveState = () => {
            try {
                persistCanvasStateToLocalStorage(stateRef.current as any, storageKey, 'debounced-save');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') console.error('localStorage quota exceeded.');
                else console.error('Failed to save state:', error);
            }
        };

        const browserWindow = window as BrowserIdleScheduler;
        let timer: number | undefined;
        let idleCallbackHandle: BrowserIdleCallbackHandle | undefined;
        const isUrgentSave = urgentSaveRef.current;
        urgentSaveRef.current = false;

        timer = window.setTimeout(() => {
            const requestIdleCallback = browserWindow.requestIdleCallback;
            if (requestIdleCallback) {
                idleCallbackHandle = requestIdleCallback(saveState, { timeout: isUrgentSave ? 500 : 1500 });
                return;
            }

            saveState();
        }, isUrgentSave ? 0 : 600);

        return () => {
            if (timer !== undefined) {
                window.clearTimeout(timer);
            }
            if (idleCallbackHandle !== undefined) {
                browserWindow.cancelIdleCallback?.(idleCallbackHandle);
            }
        };
    }, [isLoading, localPersistenceToken, stateRef, storageKey, urgentSaveRef]);

    useEffect(() => {
        const handleSave = (source: 'visibility' | 'beforeunload') => {
            if (isLoadingRef.current) return;
            try {
                const currentState = stateRef.current;
                const stateToPersist = source === 'beforeunload'
                    ? prepareBeforeUnloadState(currentState)
                    : currentState;
                persistCanvasStateToLocalStorage(
                    stateToPersist as any,
                    storageKey,
                    source === 'beforeunload' ? 'beforeunload-save' : 'visibility-save'
                );
            } catch (e) {
                console.error('Failed to save state on unload:', e);
            }
        };

        const handleBeforeUnloadSave = () => handleSave('beforeunload');
        window.addEventListener('beforeunload', handleBeforeUnloadSave);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') handleSave('visibility');
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnloadSave);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isLoadingRef, prepareBeforeUnloadState, stateRef, storageKey]);
}
