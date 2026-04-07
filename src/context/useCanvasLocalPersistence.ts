import { useEffect, type MutableRefObject } from 'react';
import { persistCanvasStateToLocalStorage } from './canvasPersistence';

export function useCanvasLocalPersistence<T>(params: {
    state: T;
    isLoading: boolean;
    storageKey: string;
    stateRef: MutableRefObject<T>;
    isLoadingRef: MutableRefObject<boolean>;
    urgentSaveRef: MutableRefObject<boolean>;
    prepareBeforeUnloadState: (state: T) => T;
}): void {
    const {
        state,
        isLoading,
        storageKey,
        stateRef,
        isLoadingRef,
        urgentSaveRef,
        prepareBeforeUnloadState,
    } = params;

    useEffect(() => {
        if (isLoading) return;

        const saveState = async () => {
            try {
                persistCanvasStateToLocalStorage(state as any, storageKey, 'debounced-save');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') console.error('localStorage quota exceeded.');
                else console.error('Failed to save state:', error);
            }
        };

        let timer: any;
        if (urgentSaveRef.current) {
            urgentSaveRef.current = false;
            saveState();
        } else {
            timer = setTimeout(saveState, 200);
        }

        return () => clearTimeout(timer);
    }, [isLoading, state, storageKey, urgentSaveRef]);

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
