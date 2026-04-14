import type { Canvas, PromptNode } from '../types';
import { normalizeReferenceImagesStorage } from '../utils/referenceImageStorage';
import { sanitizeWorkflowForStorage } from '../workflow/persistence/workflowSerializer';

export interface CanvasStorageStateLike {
    canvases: Canvas[];
    history: Record<string, unknown>;
    fileSystemHandle: FileSystemDirectoryHandle | null;
    folderName: string | null;
}

const stripReferenceImageData = (
    referenceImages: PromptNode['referenceImages'],
    aggressive: boolean
): PromptNode['referenceImages'] => (
    normalizeReferenceImagesStorage(referenceImages)?.map(ref => {
        const shouldKeep = !aggressive && ref.data && ref.data.length < 500000;
        return {
            ...ref,
            data: shouldKeep ? ref.data : ''
        };
    })
);

const stripImageUrls = (canvases: Canvas[], aggressive: boolean = false): Canvas[] => {
    return canvases.map(c => ({
        ...c,
        imageNodes: c.imageNodes.map(img => ({
            ...img,
            url: '',
            originalUrl: ''
        })),
        promptNodes: c.promptNodes.map(pn => ({
            ...pn,
            referenceImages: stripReferenceImageData(pn.referenceImages, aggressive)
        })),
        workflow: sanitizeWorkflowForStorage(c.workflow, aggressive)
    }));
};

type CachedStrippedCanvases = {
    standard?: Canvas[];
    aggressive?: Canvas[];
};

const strippedCanvasCache = new WeakMap<Canvas[], CachedStrippedCanvases>();

export const getCachedStrippedCanvases = (
    canvases: Canvas[],
    aggressive: boolean = false
): Canvas[] => {
    const cacheKey = aggressive ? 'aggressive' : 'standard';
    const existingCache = strippedCanvasCache.get(canvases);
    const existingValue = existingCache?.[cacheKey];
    if (existingValue) {
        return existingValue;
    }

    const stripped = stripImageUrls(canvases, aggressive);
    const nextCache = existingCache || {};
    nextCache[cacheKey] = stripped;
    strippedCanvasCache.set(canvases, nextCache);
    return stripped;
};

export const hasLocalOnlyCanvasMedia = (canvases: Canvas[]): boolean => (
    canvases.some((canvas) =>
        canvas.imageNodes.length > 0
        || canvas.promptNodes.some((promptNode) => Array.isArray(promptNode.referenceImages) && promptNode.referenceImages.length > 0)
    )
);

export const buildCanvasStorageState = <T extends CanvasStorageStateLike>(
    state: T,
    aggressive: boolean = false
): T => ({
    ...state,
    canvases: getCachedStrippedCanvases(state.canvases, aggressive),
    history: {} as T['history'],
    fileSystemHandle: null as T['fileSystemHandle'],
    folderName: null as T['folderName']
});

type CachedCanvasStorageSnapshot = {
    standard?: { serialized: string; length: number };
    aggressive?: { serialized: string; length: number };
};

const canvasStorageSnapshotCache = new WeakMap<object, CachedCanvasStorageSnapshot>();
let lastPersistedCanvasStorageSnapshot: string | null = null;

export const clearPersistedCanvasStorageSnapshot = () => {
    lastPersistedCanvasStorageSnapshot = null;
};

export const restoreCanvasStateFromLocalStorage = (
    storageKey: string
): CanvasStorageStateLike | null => {
    try {
        const stored = localStorage.getItem(storageKey);
        console.log('[CanvasProvider] localStorage restore status:', stored ? 'Found persisted canvas data' : 'No data');
        if (!stored) {
            return null;
        }

        return JSON.parse(stored) as CanvasStorageStateLike;
    } catch (error) {
        console.error('[CanvasProvider] Failed to parse stored state (Resetting):', error);
        try {
            localStorage.removeItem(storageKey);
            clearPersistedCanvasStorageSnapshot();
        } catch (cleanupErr) {
            console.error('[CanvasProvider] Failed to clear localStorage:', cleanupErr);
        }
        return null;
    }
};

export const getCachedCanvasStorageSnapshot = <T extends CanvasStorageStateLike>(
    state: T,
    aggressive: boolean
): { serialized: string; length: number } => {
    const cacheKey = aggressive ? 'aggressive' : 'standard';
    const existingCache = canvasStorageSnapshotCache.get(state as object);
    const existingSnapshot = existingCache?.[cacheKey];
    if (existingSnapshot) {
        return existingSnapshot;
    }

    const serialized = JSON.stringify(buildCanvasStorageState(state, aggressive));
    const snapshot = {
        serialized,
        length: serialized.length,
    };
    const nextCache = existingCache || {};
    nextCache[cacheKey] = snapshot;
    canvasStorageSnapshotCache.set(state as object, nextCache);
    return snapshot;
};

export const shouldSkipPersistedCanvasStorageWrite = (serialized: string): boolean => (
    lastPersistedCanvasStorageSnapshot === serialized
);

export const markPersistedCanvasStorageSnapshot = (serialized: string): void => {
    lastPersistedCanvasStorageSnapshot = serialized;
};

export const persistCanvasStateToLocalStorage = <T extends CanvasStorageStateLike>(
    state: T,
    storageKey: string,
    context: string = 'canvas-save'
): void => {
    const write = (aggressive: boolean) => {
        const snapshot = getCachedCanvasStorageSnapshot(state, aggressive);
        if (!aggressive && snapshot.length > 4500000) {
            console.warn(`[CanvasContext] Canvas state approaching localStorage quota limit during ${context}.`);
        }
        if (shouldSkipPersistedCanvasStorageWrite(snapshot.serialized)) {
            return snapshot.length;
        }
        localStorage.setItem(storageKey, snapshot.serialized);
        markPersistedCanvasStorageSnapshot(snapshot.serialized);
        return snapshot.length;
    };

    try {
        write(false);
    } catch (error: any) {
        if (error?.name !== 'QuotaExceededError') throw error;

        try {
            const fallbackLength = write(true);
            console.warn(`[CanvasContext] localStorage quota exceeded during ${context}, retried with aggressive payload (${fallbackLength} chars).`);
        } catch (fallbackError) {
            throw fallbackError;
        }
    }
};

export const buildCanvasCloudSyncSignature = (canvases: Canvas[] = []): string => (
    canvases.map((canvas) => [
        canvas.id,
        canvas.name,
        canvas.lastModified || 0,
        canvas.promptNodes.length,
        canvas.imageNodes.length,
        (canvas.groups || []).length,
        (canvas.drawings || []).length,
    ].join(':')).join('|')
);

export const buildCanvasFileSystemPersistenceSignature = (
    canvases: Canvas[] = [],
    activeCanvasId?: string
): string => (
    `${String(activeCanvasId || '')}|${canvases.map((canvas) => [
        canvas.id,
        canvas.lastModified || 0,
        canvas.promptNodes.length,
        canvas.imageNodes.length,
        (canvas.groups || []).length,
        (canvas.drawings || []).length,
    ].join(':')).join('|')}`
);
