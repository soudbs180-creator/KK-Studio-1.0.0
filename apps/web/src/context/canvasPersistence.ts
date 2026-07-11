import type { CanvasMigrationSummary } from '@kk/shared';
import type { Canvas, PromptNode } from '../types';
import { normalizeReferenceImagesStorage } from '../utils/referenceImageStorage.ts';
import { sanitizeWorkflowForStorage } from '../workflow/persistence/workflowSerializer.ts';
import { sanitizePersistedCanvasesWithReport } from './canvasGeometrySanitizer.ts';
import {
    getCanvasMigrationBackupKey,
    getCanvasMigrationSummaryKey,
    migrateCanvasPresentations,
} from './canvasPresentationMigration.ts';

export interface CanvasStorageStateLike {
    canvases: Canvas[];
    history: Record<string, unknown>;
    fileSystemHandle: FileSystemDirectoryHandle | null;
    folderName: string | null;
}

export const CANVAS_STORAGE_KEY = 'kk_studio_canvas_state';

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

export const getCanvasRecoveryDiagnosticKey = (storageKey: string): string => (
    `${storageKey}:recovery-diagnostic`
);

export const readCanvasMigrationSummary = (
    storageKey: string = CANVAS_STORAGE_KEY
): CanvasMigrationSummary | null => {
    try {
        const raw = localStorage.getItem(getCanvasMigrationSummaryKey(storageKey));
        if (!raw) return null;
        const summary = JSON.parse(raw) as CanvasMigrationSummary;
        return summary && typeof summary === 'object' && Number.isFinite(summary.completedAt)
            ? summary
            : null;
    } catch {
        return null;
    }
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

        const parsed = JSON.parse(stored) as CanvasStorageStateLike;
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Persisted canvas state is not an object.');
        }
        const sanitization = sanitizePersistedCanvasesWithReport(parsed.canvases);
        const migration = migrateCanvasPresentations(sanitization.canvases);
        if (migration.changed || sanitization.changed) {
            const backupKey = getCanvasMigrationBackupKey(storageKey);
            try {
                if (!localStorage.getItem(backupKey)) {
                    localStorage.setItem(backupKey, stored);
                }
                const summary = {
                    ...migration.summary,
                    migratedCanvasIds: Array.from(new Set([
                        ...migration.summary.migratedCanvasIds,
                        ...sanitization.affectedCanvasIds,
                    ])),
                    repairedNodeIds: Array.from(new Set([
                        ...migration.summary.repairedNodeIds,
                        ...sanitization.repairedNodeIds,
                    ])),
                    flaggedNodeIds: Array.from(new Set([
                        ...(migration.summary.flaggedNodeIds || []),
                        ...sanitization.flaggedNodeIds,
                    ])),
                    issues: [
                        ...(migration.summary.issues || []),
                        ...sanitization.issues,
                    ],
                    backupKey,
                };
                localStorage.setItem(getCanvasMigrationSummaryKey(storageKey), JSON.stringify(summary));
            } catch (backupError) {
                console.error('[CanvasProvider] Failed to persist migration backup:', backupError);
            }
        }
        return {
            ...parsed,
            canvases: migration.canvases,
        };
    } catch (error) {
        console.error('[CanvasProvider] Failed to restore stored state; original data was preserved:', error);
        try {
            const stored = localStorage.getItem(storageKey);
            localStorage.setItem(getCanvasRecoveryDiagnosticKey(storageKey), JSON.stringify({
                code: 'canvas-restore-failed',
                message: error instanceof Error ? error.message : String(error),
                sourceLength: stored?.length || 0,
                completedAt: Date.now(),
            }));
        } catch (diagnosticError) {
            console.error('[CanvasProvider] Failed to persist recovery diagnostic:', diagnosticError);
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

export const buildCanvasLocalPersistenceSignature = (
    canvases: Canvas[] = [],
    activeCanvasId?: string
): string => (
    [
        String(activeCanvasId || ''),
        canvases.map((canvas) => [
            canvas.id,
            canvas.name,
            canvas.folderName || '',
            canvas.lastModified || 0,
            canvas.promptNodes.length,
            canvas.imageNodes.length,
            (canvas.groups || []).length,
            (canvas.drawings || []).length,
        ].join(':')).join('|'),
    ].join('::')
);
