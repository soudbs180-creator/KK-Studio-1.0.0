import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { Canvas, PromptNode, GeneratedImage, AspectRatio, CanvasGroup, CanvasDrawing, GenerationMode, KnownModel, PromptPendingSyncRequest, type WorkflowNode } from '../types';
import { startTransition } from 'react';
import { saveImage, saveOriginalImage, getImage, getImageByQuality, getStrictOriginalImage, deleteImage, getAllImages, clearAllImages, getImagesPage } from '../services/storage/imageStorage';
import { syncService } from '../services/system/syncService';
import { fileSystemService } from '../services/storage/fileSystemService';
import { dataURLToBlob as base64ToBlob, safeRevokeBlobUrl } from '../utils/blobUtils';
import { calculateImageHash } from '../utils/imageUtils';
import { getCardDimensions } from '../utils/styleUtils';
import { supabase } from '../lib/supabase'; // Import supabase for auth check
import { notificationService, notify } from '../services/system/notificationService';
import { logError, logInfo } from '../services/system/systemLogService';
import { ImageQuality, QUALITY_CONFIGS, compressImageToQuality, getQualityStorageId } from '../services/image/imageQuality';
import { getLocalFolderHandle, getStorageMode, restoreLocalFolderConnection, setLocalFolderHandle } from '../services/storage/storagePreference';
import { featureFlags } from '../config/featureFlags';
import { createEmptyWorkflowGraph } from '../workflow/types';
import { canvasToWorkflow, syncCanvasWorkflow } from '../workflow/adapters/canvasToWorkflow';
import { workflowToLegacyCanvas } from '../workflow/adapters/workflowToLegacy';
import { dedupeWorkflowEdges, isWorkflowUtilityNodeKind } from '../workflow/schema';
import { sanitizeWorkflowForStorage } from '../workflow/persistence/workflowSerializer';
import { clampGenerationDurationMs } from '../utils/timeUtils';
import { buildGeneratedImageBatchPositions } from '../utils/generatedImageLayout';
import {
    getReferenceImageLookupIds,
    normalizeReferenceImagesStorage,
    toReferenceImageDataUrl,
} from '../utils/referenceImageStorage';
import { getAllTasks, type PersistedTask } from '../services/persistence/taskPersistence';
import {
    buildImageResultIdentity,
    buildTaskResultIdentity,
    getCompletedTaskResultUrls,
    getImageRecoveryCandidates,
    getPromptCompletedTasks,
    normalizePersistentResultUrl,
} from '../utils/imageResultPersistence';

const MAX_CANVASES = 10;


// 副卡排列模式: 横向 | 宫格 | 纵向
export type SubCardLayout = 'row' | 'grid' | 'column';

// 整理模式: 宫格(6列) | 横向 | 纵向
export type ArrangeMode = 'grid' | 'row' | 'column';


interface CanvasState {
    canvases: Canvas[];
    activeCanvasId: string;
    // History is keyed by canvasId. Each entry has past/future stacks of the *specific canvas content* (Canvas object)
    history: {
        [key: string]: {
            past: Canvas[];
            future: Canvas[];
        }
    };
    // Local File System Support
    fileSystemHandle: FileSystemDirectoryHandle | null;
    folderName: string | null;
    selectedNodeIds: string[];
    // 副卡排列模式 (轮换: row -> grid -> column -> row)
    subCardLayoutMode: SubCardLayout;
    // 🎯 视口中心位置（动态优先级加载）
    viewportCenter: { x: number; y: number };
}

interface CanvasContextType {
    state: CanvasState;
    activeCanvas: Canvas | undefined;
    createCanvas: () => string | null; // Returns new canvas ID or null if max reached
    switchCanvas: (id: string) => void;
    deleteCanvas: (id: string) => void;
    renameCanvas: (id: string, newName: string) => void;
    addPromptNode: (node: PromptNode) => Promise<void>;
    updatePromptNode: (node: PromptNode) => Promise<void>;
    addImageNodes: (nodes: GeneratedImage[], parentUpdates?: Record<string, Partial<PromptNode>>) => Promise<void>;
    updatePromptNodePosition: (id: string, pos: { x: number; y: number }, options?: { moveChildren?: boolean; ignoreSelection?: boolean }) => void;
    updateImageNodePosition: (id: string, pos: { x: number; y: number }, options?: { ignoreSelection?: boolean }) => void;
    updateImageNodeDimensions: (id: string, dimensions: string) => void;
    updateImageNode: (id: string, updates: Partial<GeneratedImage>) => void; // 🎯 [New] Generic Update
    deleteImageNode: (id: string) => void;
    deletePromptNode: (id: string) => void;
    linkNodes: (promptId: string, imageId: string) => void;
    unlinkNodes: (promptId: string, imageId: string) => void;
    clearAllData: () => void;
    canCreateCanvas: boolean;
    undo: () => void;
    redo: () => void;
    pushToHistory: () => void;
    canUndo: boolean;
    canRedo: boolean;
    arrangeAllNodes: (mode?: ArrangeMode) => void; // Auto-layout cards: grid(6列) | row | column
    getNextCardPosition: () => { x: number; y: number }; // Get next available position for new card
    // File System
    connectLocalFolder: () => Promise<void>;
    disconnectLocalFolder: () => Promise<void>;
    changeLocalFolder: () => Promise<void>;
    refreshLocalFolder: () => Promise<void>;
    isConnectedToLocal: boolean;
    currentFolderName: string | null;
    selectedNodeIds: string[];
    selectNodes: (ids: string[], mode?: 'replace' | 'add' | 'remove' | 'toggle') => void;
    clearSelection: () => void;
    bringNodesToFront: (nodeIds: string[]) => void;
    moveSelectedNodes: (delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[]) => void;
    moveSelectedNodesImmediate: (delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[]) => void;
    findSmartPosition: (x: number, y: number, width: number, height: number, buffer?: number) => { x: number; y: number };
    findNextGroupPosition: () => { x: number; y: number }; // Grid-based Card Group placement
    addGroup: (group: CanvasGroup) => void;
    removeGroup: (id: string) => void;
    updateGroup: (group: CanvasGroup) => void;
    setNodeTags: (ids: string[], tags: string[]) => void;
    isReady: boolean;
    // 🎯 设置视口中心（动态优先级加载）
    setViewportCenter: (center: { x: number; y: number }) => void;
    // 🎯 迁移选中节点到其他项目
    migrateNodes: (nodeIds: string[], targetCanvasId: string) => void;
    mergeCanvasInto: (sourceCanvasId: string, targetCanvasId: string, options?: { deleteSource?: boolean }) => {
        movedPrompts: number;
        movedImages: number;
        deletedSource: boolean;
    };
    cleanupInvalidCards: (canvasId?: string) => {
        removedPrompts: number;
        removedImages: number;
        removedGroups: number;
    };
    // 🎯 [Persistence] Urgent state saving for generation tasks
    urgentUpdatePromptNode: (node: PromptNode) => void;
    // 🎯 [Batch Update] Atomic update for multiple nodes (e.g. stacking)
    updateNodes: (updates: {
        promptNodes?: { id: string, updates: Partial<PromptNode> }[],
        imageNodes?: { id: string, updates: Partial<GeneratedImage> }[]
    }) => void;
    addWorkflowNode: (node: WorkflowNode) => void;
    updateWorkflowNode: (id: string, updates: Partial<WorkflowNode>) => void;
    updateWorkflowNodePosition: (id: string, pos: { x: number; y: number }) => void;
    deleteWorkflowNode: (id: string) => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

const STORAGE_KEY = 'kk_studio_canvas_state';
const LOCAL_FOLDER_REFRESH_INTERVAL_MS = 60000;
const LOCAL_FOLDER_IDLE_GRACE_MS = 45000;
const SYNC_GENERATION_INTERRUPTED_ERROR = '页面刷新或离开时中断了同步生成请求，供应商可能已完成出图，但当前项目没有收到最终响应。';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const createCanvasWorkflow = (): Canvas['workflow'] | undefined =>
    featureFlags.experimentalWorkflowGraph ? createEmptyWorkflowGraph<WorkflowNode>() : undefined;

const DEFAULT_CANVAS: Canvas = {
    id: 'default',
    name: '项目1',
    promptNodes: [],
    imageNodes: [],
    groups: [] as CanvasGroup[],
    drawings: [] as CanvasDrawing[],
    workflow: createCanvasWorkflow(),
    lastModified: Date.now()
};
const DEFAULT_STATE: CanvasState = {
    canvases: [DEFAULT_CANVAS],
    activeCanvasId: 'default',
    history: { 'default': { past: [], future: [] } },
    fileSystemHandle: null,
    folderName: null,
    selectedNodeIds: [],
    subCardLayoutMode: 'row', // 默认横向排列
    viewportCenter: { x: 0, y: 0 } // 默认画布中心
};

const stripReferenceImageData = (
    referenceImages: PromptNode['referenceImages'],
    aggressive: boolean
): PromptNode['referenceImages'] => (
    normalizeReferenceImagesStorage(referenceImages)?.map(ref => {
        // [CRITICAL FIX] Keep small reference images in localStorage to prevent data loss on fast refresh.
        // If storage quota is exceeded, we retry with aggressive mode that strips all ref data.
        const shouldKeep = !aggressive && ref.data && ref.data.length < 500000;
        return {
            ...ref,
            data: shouldKeep ? ref.data : ''
        };
    })
);

const syncCanvasCompatibility = (canvas: Canvas): Canvas =>
    syncCanvasWorkflow(canvas, featureFlags.experimentalWorkflowGraph);

// Helper to strip image URLs and Reference Image data for localStorage
const stripImageUrls = (canvases: Canvas[], aggressive: boolean = false): Canvas[] => {
    return canvases.map(c => ({
        ...c,
        imageNodes: c.imageNodes.map(img => ({
            ...img,
            url: '', // Clear URL for localStorage, will be loaded from IndexedDB
            originalUrl: '' // Clear Original URL to save space
        })),
        promptNodes: c.promptNodes.map(pn => ({
            ...pn,
            referenceImages: stripReferenceImageData(pn.referenceImages, aggressive)
        })),
        workflow: sanitizeWorkflowForStorage(c.workflow, aggressive)
    }));
};

type LocalMediaCacheEntry = {
    url?: string;
    originalUrl?: string;
    filename?: string;
};

const normalizeMediaCacheSource = (value?: string | null): string => (
    typeof value === 'string' ? value.trim() : ''
);

const isVideoFileName = (filename?: string | null): boolean => (
    typeof filename === 'string' && /\.(mp4|webm|mov)$/i.test(filename)
);

const hydrateRecoveredMediaCacheEntry = async (
    id: string,
    entry?: LocalMediaCacheEntry | null
): Promise<void> => {
    const displayUrl = normalizeMediaCacheSource(entry?.url);
    const originalUrl = normalizeMediaCacheSource(entry?.originalUrl);
    const primaryOriginalSource = originalUrl;

    if (!displayUrl && !primaryOriginalSource) {
        return;
    }

    if (isVideoFileName(entry?.filename)) {
        const videoSource = primaryOriginalSource || displayUrl;
        if (!videoSource) return;
        await saveImage(id, videoSource);
        return;
    }

    // Never promote a thumbnail/display asset into the protected original slot.
    // If disk recovery only found a thumbnail, keep it in the preview tiers and
    // preserve any existing original already stored in IndexedDB/OPFS.
    if (primaryOriginalSource) {
        await saveOriginalImage(id, primaryOriginalSource);
    }

    if (displayUrl) {
        await Promise.allSettled([
            saveImage(getQualityStorageId(id, ImageQuality.MICRO), displayUrl),
            saveImage(getQualityStorageId(id, ImageQuality.THUMBNAIL), displayUrl),
        ]);
    }
};

const isGeneratedMediaVideoLike = (image?: Partial<GeneratedImage> | null): boolean => (
    image?.mode === GenerationMode.VIDEO || image?.mode === GenerationMode.AUDIO
);

const resolveOriginalPersistSourceForDisk = async (
    image: Pick<GeneratedImage, 'id' | 'storageId' | 'originalUrl' | 'apiResultUrl' | 'url' | 'mode'>
): Promise<string | null> => {
    const explicitOriginal = normalizeMediaCacheSource(image.originalUrl)
        || normalizeMediaCacheSource(image.apiResultUrl);
    if (explicitOriginal) {
        return explicitOriginal;
    }

    const storageId = image.storageId || image.id;
    if (storageId) {
        const cachedOriginal = await getStrictOriginalImage(storageId);
        if (cachedOriginal) {
            return cachedOriginal;
        }
    }

    if (isGeneratedMediaVideoLike(image)) {
        return normalizeMediaCacheSource(image.url) || null;
    }

    return null;
};

const buildStorageState = (state: CanvasState, aggressive: boolean = false): CanvasState => ({
    ...state,
    canvases: stripImageUrls(state.canvases, aggressive),
    history: {},
    fileSystemHandle: null,
    folderName: null
});

const getExpectedPromptImageCount = (node?: Partial<PromptNode> | null): number => (
    Math.max(1, Number(node?.lastGenerationTotalCount || node?.parallelCount || 1) || 1)
);

const getPendingTaskIdsFromPrompt = (node?: Partial<PromptNode> | null): string[] => {
    const rawPendingTaskIds = (node?.generationMetadata as { pendingTaskIds?: unknown } | undefined)?.pendingTaskIds;
    if (!Array.isArray(rawPendingTaskIds)) return [];

    return Array.from(new Set(
        rawPendingTaskIds.filter((taskId): taskId is string => typeof taskId === 'string' && taskId.trim().length > 0)
    ));
};

const getPendingSyncRequestsFromPrompt = (node?: Partial<PromptNode> | null): PromptPendingSyncRequest[] => {
    const rawPendingSyncRequests = (node?.generationMetadata as { pendingSyncRequests?: unknown } | undefined)?.pendingSyncRequests;
    if (!Array.isArray(rawPendingSyncRequests)) return [];

    return rawPendingSyncRequests
        .map((item): PromptPendingSyncRequest | null => {
            if (!item || typeof item !== 'object') return null;

            const requestId = typeof (item as { requestId?: unknown }).requestId === 'string'
                ? String((item as { requestId: string }).requestId).trim()
                : '';
            if (!requestId) return null;

            const index = typeof (item as { index?: unknown }).index === 'number'
                && Number.isFinite((item as { index: number }).index)
                ? (item as { index: number }).index
                : 0;
            const prompt = typeof (item as { prompt?: unknown }).prompt === 'string'
                ? (item as { prompt: string }).prompt
                : String(node?.prompt || '');
            const startedAt = typeof (item as { startedAt?: unknown }).startedAt === 'number'
                && Number.isFinite((item as { startedAt: number }).startedAt)
                ? (item as { startedAt: number }).startedAt
                : Date.now();
            const keySlotId = typeof (item as { keySlotId?: unknown }).keySlotId === 'string'
                ? (item as { keySlotId: string }).keySlotId
                : undefined;

            return {
                requestId,
                index,
                prompt,
                startedAt,
                keySlotId,
            };
        })
        .filter((item): item is PromptPendingSyncRequest => !!item);
};

type PromptRecoveryEntry = {
    taskId: string;
    resultIndex: number;
    url?: string;
    storageId?: string;
    completedAt?: number;
    keySlotId?: string;
    provider?: string;
    providerLabel?: string;
    model?: string;
    modelLabel?: string;
    cost?: number;
    costSource?: 'snapshot' | 'explicit' | 'stored' | 'estimated' | 'none';
    tokens?: number;
};

const getTaskResultUrlAtIndex = (urls: string[], index?: number): string | undefined => {
    if (!urls.length) return undefined;
    if (typeof index === 'number' && Number.isFinite(index) && index >= 0 && index < urls.length) {
        return urls[index];
    }
    return urls[0];
};

const normalizeTaskResultStorageIds = (value?: Record<string, string> | null): Record<string, string> => {
    if (!value || typeof value !== 'object') return {};

    return Object.fromEntries(
        Object.entries(value)
            .filter(([key, storageId]) => (
                String(key).trim().length > 0
                && typeof storageId === 'string'
                && storageId.trim().length > 0
            ))
            .map(([key, storageId]) => [String(key).trim(), storageId.trim()])
    );
};

const getTaskResultStorageIdAtIndex = (
    storageIds?: Record<string, string> | null,
    index?: number
): string | undefined => {
    const normalizedStorageIds = normalizeTaskResultStorageIds(storageIds);
    if (typeof index === 'number' && Number.isFinite(index)) {
        const directMatch = normalizedStorageIds[String(index)];
        if (directMatch) return directMatch;
    }

    const firstKey = Object.keys(normalizedStorageIds)[0];
    return firstKey ? normalizedStorageIds[firstKey] : undefined;
};

const resolveStoredResultSource = async (storageId?: string | null): Promise<string | undefined> => {
    const normalizedStorageId = typeof storageId === 'string' ? storageId.trim() : '';
    if (!normalizedStorageId) return undefined;

    try {
        const original = await getStrictOriginalImage(normalizedStorageId);
        if (original) return original;
    } catch {
        // noop
    }

    try {
        const cached = await getImage(normalizedStorageId);
        if (cached) return cached;
    } catch {
        // noop
    }

    return undefined;
};

const resolvePromptRecoveryEntrySource = async (
    entry?: PromptRecoveryEntry | null
): Promise<string | undefined> => {
    if (!entry) return undefined;

    const storedSource = await resolveStoredResultSource(entry.storageId);
    if (storedSource) return storedSource;

    const normalizedUrl = normalizePersistentResultUrl(entry.url) || entry.url;
    if (normalizedUrl && !normalizedUrl.startsWith('blob:')) {
        return normalizedUrl;
    }

    return undefined;
};

const buildPromptRecoveryEntries = (
    node: PromptNode,
    persistedTasks: PersistedTask[] = []
): PromptRecoveryEntry[] => {
    const entries: PromptRecoveryEntry[] = [];
    const seenKeys = new Set<string>();

    getPromptCompletedTasks(node).forEach((task) => {
        const urls = getCompletedTaskResultUrls(task);
        const storageIds = normalizeTaskResultStorageIds(task.resultStorageIds);
        const resultIndexes = Array.from(new Set([
            ...urls.map((_, index) => index),
            ...Object.keys(storageIds)
                .map((key) => Number.parseInt(key, 10))
                .filter((value) => Number.isFinite(value) && value >= 0),
        ])).sort((left, right) => left - right);

        resultIndexes.forEach((index) => {
            const url = getTaskResultUrlAtIndex(urls, index);
            const storageId = storageIds[String(index)];
            const identity = buildTaskResultIdentity({
                taskId: task.taskId,
                resultIndex: index,
                url,
            });
            if (!identity || seenKeys.has(identity)) return;
            seenKeys.add(identity);
            entries.push({
                taskId: task.taskId,
                resultIndex: index,
                url,
                storageId,
                completedAt: task.completedAt,
                keySlotId: task.keySlotId,
                provider: task.provider,
                providerLabel: task.providerLabel,
                model: task.model,
                modelLabel: task.modelLabel,
                cost: task.cost,
                costSource: task.costSource,
                tokens: task.tokens,
            });
        });
    });

    persistedTasks.forEach((task) => {
        const urls = (task.resultUrls || [])
            .map((url) => normalizePersistentResultUrl(url))
            .filter((url): url is string => !!url);
        const storageIds = normalizeTaskResultStorageIds(task.resultStorageIds);
        const resultIndexes = Array.from(new Set([
            ...urls.map((_, index) => index),
            ...Object.keys(storageIds)
                .map((key) => Number.parseInt(key, 10))
                .filter((value) => Number.isFinite(value) && value >= 0),
        ])).sort((left, right) => left - right);

        resultIndexes.forEach((index) => {
            const url = getTaskResultUrlAtIndex(urls, index);
            const storageId = storageIds[String(index)];
            const identity = buildTaskResultIdentity({
                taskId: task.taskId,
                resultIndex: index,
                url,
            });
            if (!identity || seenKeys.has(identity)) return;
            seenKeys.add(identity);
            entries.push({
                taskId: task.taskId,
                resultIndex: index,
                url,
                storageId,
                completedAt: task.completedAt ? Date.parse(task.completedAt) : undefined,
                keySlotId: task.keySlotId,
                provider: task.provider,
                providerLabel: task.providerLabel,
                model: task.model,
                cost: task.cost,
                costSource: task.costSource,
                tokens: task.tokens,
            });
        });
    });

    return entries;
};

const resolveImageRecoveryUrlFromMetadata = async (
    image: GeneratedImage,
    prompt: PromptNode | undefined,
    promptTasks: PersistedTask[] = []
): Promise<string | undefined> => {
    const directStorageCandidates = Array.from(new Set([
        image.storageId,
        image.id,
    ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)));

    for (const storageId of directStorageCandidates) {
        const storedSource = await resolveStoredResultSource(storageId);
        if (storedSource) return storedSource;
    }

    const directCandidates = getImageRecoveryCandidates(image)
        .map((candidate) => normalizePersistentResultUrl(candidate) || candidate)
        .filter((candidate): candidate is string => !!candidate && !candidate.startsWith('blob:'));
    if (directCandidates.length > 0) {
        return directCandidates[0];
    }

    if (!prompt) return undefined;

    const completedTask = getPromptCompletedTasks(prompt).find((task) => task.taskId === image.sourceTaskId);
    const completedStoredSource = await resolveStoredResultSource(
        getTaskResultStorageIdAtIndex(completedTask?.resultStorageIds, image.sourceResultIndex)
    );
    if (completedStoredSource) return completedStoredSource;

    const completedUrl = completedTask
        ? getTaskResultUrlAtIndex(getCompletedTaskResultUrls(completedTask), image.sourceResultIndex)
        : undefined;
    if (completedUrl) return completedUrl;

    const persistedTask = promptTasks.find((task) => task.taskId === image.sourceTaskId);
    const persistedStoredSource = await resolveStoredResultSource(
        getTaskResultStorageIdAtIndex(persistedTask?.resultStorageIds, image.sourceResultIndex)
    );
    if (persistedStoredSource) return persistedStoredSource;

    const persistedUrl = persistedTask
        ? getTaskResultUrlAtIndex(
            (persistedTask.resultUrls || [])
                .map((url) => normalizePersistentResultUrl(url))
                .filter((url): url is string => !!url),
            image.sourceResultIndex
        )
        : undefined;
    if (persistedUrl) return persistedUrl;

    const promptCompletedEntries = buildPromptRecoveryEntries(prompt, promptTasks);
    if (promptCompletedEntries.length === 1) {
        return resolvePromptRecoveryEntrySource(promptCompletedEntries[0]);
    }

    return undefined;
};

const hasRecoverablePendingTask = (node?: Partial<PromptNode> | null): boolean => {
    if (!node) return false;
    if (getPendingTaskIdsFromPrompt(node).length > 0) return true;
    if (getPendingSyncRequestsFromPrompt(node).length > 0) return true;
    return typeof node.jobId === 'string' && node.jobId.trim().length > 0;
};

const resolvePromptChildImageIds = (
    node?: Pick<PromptNode, 'id' | 'childImageIds' | 'sourceImageId'> | null,
    imageNodes: GeneratedImage[] = []
): string[] => {
    if (!node?.id) return [];

    const promptId = node.id;
    const sourceImageId = node.sourceImageId;
    const orderedIds = (node.childImageIds || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const imageNodeById = new Map(imageNodes.map((imageNode) => [imageNode.id, imageNode] as const));
    const strongOwnedImages = imageNodes.filter((imageNode) => (
        imageNode.parentPromptId === promptId && imageNode.id !== sourceImageId
    ));

    if (strongOwnedImages.length > 0) {
        const resolvedIds: string[] = [];
        const seenIds = new Set<string>();

        orderedIds.forEach((imageId) => {
            const imageNode = imageNodeById.get(imageId);
            if (!imageNode || imageNode.id === sourceImageId || imageNode.parentPromptId !== promptId || seenIds.has(imageNode.id)) {
                return;
            }
            seenIds.add(imageNode.id);
            resolvedIds.push(imageNode.id);
        });

        strongOwnedImages.forEach((imageNode) => {
            if (seenIds.has(imageNode.id)) return;
            seenIds.add(imageNode.id);
            resolvedIds.push(imageNode.id);
        });

        return resolvedIds;
    }

    if (sourceImageId) {
        return [];
    }

    const legacyIds: string[] = [];
    const seenIds = new Set<string>();
    orderedIds.forEach((imageId) => {
        const imageNode = imageNodeById.get(imageId);
        if (!imageNode || imageNode.id === sourceImageId || imageNode.parentPromptId || seenIds.has(imageNode.id)) {
            return;
        }
        seenIds.add(imageNode.id);
        legacyIds.push(imageNode.id);
    });

    return legacyIds;
};

const getWorkflowSourceNodeIds = (node: WorkflowNode): string[] => {
    if (!isWorkflowUtilityNodeKind(node.kind)) {
        return [];
    }

    const rawSourceIds = (node.data as { sourceNodeIds?: unknown } | undefined)?.sourceNodeIds;
    if (!Array.isArray(rawSourceIds)) {
        return [];
    }

    return Array.from(new Set(
        rawSourceIds.filter((sourceId): sourceId is string => (
            typeof sourceId === 'string' && sourceId.trim().length > 0
        ))
    ));
};

const normalizeRecoveredPromptNode = (
    node: PromptNode,
    imageNodes: GeneratedImage[] = []
): PromptNode => {
    const resolvedChildImageIds = resolvePromptChildImageIds(node, imageNodes);
    const pendingTaskIds = getPendingTaskIdsFromPrompt(node);
    const pendingSyncRequests = getPendingSyncRequestsFromPrompt(node);
    const completedTasks = getPromptCompletedTasks(node);
    const expectedImageCount = getExpectedPromptImageCount(node);
    const hasRecoverablePendingState = pendingTaskIds.length > 0
        || pendingSyncRequests.length > 0
        || (typeof node.jobId === 'string' && node.jobId.trim().length > 0);
    const isEffectivelyComplete = resolvedChildImageIds.length > 0 && (
        resolvedChildImageIds.length >= expectedImageCount || (pendingTaskIds.length === 0 && pendingSyncRequests.length === 0)
    );
    const shouldMarkInterrupted = Boolean(node.isGenerating)
        && resolvedChildImageIds.length === 0
        && !hasRecoverablePendingState;
    const nextPendingTaskIds = isEffectivelyComplete ? [] : pendingTaskIds;
    const nextPendingSyncRequests = isEffectivelyComplete ? [] : pendingSyncRequests;
    const shouldPersistGenerationMetadata = !!node.generationMetadata || pendingTaskIds.length > 0 || pendingSyncRequests.length > 0 || completedTasks.length > 0 || isEffectivelyComplete || shouldMarkInterrupted;
    const nextErrorDetails = isEffectivelyComplete
        ? undefined
        : shouldMarkInterrupted
            ? {
                ...(node.errorDetails || {}),
                code: node.errorDetails?.code || 'SYNC_REQUEST_INTERRUPTED',
                responseBody: node.errorDetails?.responseBody || SYNC_GENERATION_INTERRUPTED_ERROR,
                model: node.errorDetails?.model || node.model,
                timestamp: node.errorDetails?.timestamp || Date.now()
            }
            : node.errorDetails;

    return {
        ...node,
        childImageIds: resolvedChildImageIds,
        referenceImages: normalizeReferenceImagesStorage(node.referenceImages) || [],
        parallelCount: node.parallelCount || 1,
        tags: node.tags || [],
        isGenerating: Boolean(node.isGenerating) && !isEffectivelyComplete && !shouldMarkInterrupted,
        jobId: isEffectivelyComplete || shouldMarkInterrupted ? undefined : (nextPendingTaskIds[0] || node.jobId),
        generationMetadata: shouldPersistGenerationMetadata
            ? {
                ...(node.generationMetadata || {}),
                pendingTaskIds: nextPendingTaskIds,
                pendingSyncRequests: nextPendingSyncRequests,
                completedTasks,
            }
            : node.generationMetadata,
        error: isEffectivelyComplete ? undefined : (shouldMarkInterrupted ? (node.error || SYNC_GENERATION_INTERRUPTED_ERROR) : node.error),
        errorDetails: nextErrorDetails,
    };
};

const normalizeCanvasPromptRecovery = (canvas: Canvas): Canvas => {
    const legacyReadyCanvas = workflowToLegacyCanvas(canvas);

    return syncCanvasCompatibility({
        ...legacyReadyCanvas,
        promptNodes: (legacyReadyCanvas.promptNodes || []).map((node) => normalizeRecoveredPromptNode(node, legacyReadyCanvas.imageNodes || [])),
        groups: legacyReadyCanvas.groups || [],
        drawings: legacyReadyCanvas.drawings || []
    });
};

const markInterruptedSyncPromptGenerations = (state: CanvasState): CanvasState => ({
    ...state,
    canvases: (state.canvases || []).map((canvas) => {
        let hasChanges = false;

        const promptNodes = (canvas.promptNodes || []).map((node) => {
            const hasResolvedImages = resolvePromptChildImageIds(node, canvas.imageNodes || []).length > 0;
            const shouldMarkInterrupted = Boolean(node?.isGenerating)
                && !hasResolvedImages
                && !hasRecoverablePendingTask(node);

            if (!shouldMarkInterrupted) return node;
            hasChanges = true;

            return {
                ...node,
                isGenerating: false,
                jobId: undefined,
                error: node.error || SYNC_GENERATION_INTERRUPTED_ERROR,
                errorDetails: {
                    ...(node.errorDetails || {}),
                    code: node.errorDetails?.code || 'SYNC_REQUEST_INTERRUPTED',
                    responseBody: node.errorDetails?.responseBody || SYNC_GENERATION_INTERRUPTED_ERROR,
                    model: node.errorDetails?.model || node.model,
                    timestamp: Date.now()
                },
                generationMetadata: {
                    ...(node.generationMetadata || {}),
                    pendingTaskIds: [],
                    pendingSyncRequests: []
                }
            };
        });

        if (!hasChanges) return canvas;
        return normalizeCanvasPromptRecovery({ ...canvas, promptNodes });
    })
});

const hasUnrecoverableSyncGenerationInFlight = (state?: CanvasState | null): boolean => {
    if (!state?.canvases?.length) return false;

    return state.canvases.some((canvas) =>
        (canvas.promptNodes || []).some((node) =>
            Boolean(node?.isGenerating)
            && resolvePromptChildImageIds(node, canvas.imageNodes || []).length === 0
            && !hasRecoverablePendingTask(node)
        )
    );
};

const persistCanvasStateToLocalStorage = (state: CanvasState, context: string = 'canvas-save') => {
    const write = (aggressive: boolean) => {
        const serialized = JSON.stringify(buildStorageState(state, aggressive));
        if (!aggressive && serialized.length > 4500000) {
            console.warn(`[CanvasContext] Canvas state approaching localStorage quota limit during ${context}.`);
        }
        localStorage.setItem(STORAGE_KEY, serialized);
        return serialized.length;
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

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isShellReady, setIsShellReady] = useState(false);
    const [state, setState] = useState<CanvasState>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            console.log('[CanvasProvider] localStorage restore status:', stored ? 'Found persisted canvas data' : 'No data');
            if (stored) {
                const parsed: CanvasState = JSON.parse(stored);
                console.log('[CanvasProvider] 解析成功:', `画布数: ${parsed.canvases?.length || 0}`);

                // Migration step 1: ensure history exists.
                if (!parsed.history) parsed.history = {};
                if (!parsed.selectedNodeIds) parsed.selectedNodeIds = [];

                // Migration step 2: normalize recovered node data from older payloads.
                parsed.canvases = parsed.canvases.map(canvas => ({
                    ...canvas,
                    // Repair recovered image nodes.
                    imageNodes: (canvas.imageNodes || []).map(img => ({
                        ...img,
                        // Ensure newer fields always exist.
                        generationTime: clampGenerationDurationMs(img.generationTime),
                        canvasId: img.canvasId || canvas.id,
                        parentPromptId: img.parentPromptId || 'unknown',
                        prompt: img.prompt || '',
                        dimensions: img.dimensions || "1024x1024", // Default dimensions fallback.
                        aspectRatio: img.aspectRatio || AspectRatio.SQUARE,
                        model: img.model || KnownModel.IMAGEN_4 // 回退到当前默认官方模型
                    })),
                })).map(normalizeCanvasPromptRecovery);

                // [Critical fix] FileSystemHandle cannot be restored from localStorage.
                // Force it to null and let the restore flow recover it from IndexedDB.
                parsed.fileSystemHandle = null;
                // folderName may remain for UI display even before the folder is reconnected.
                // parsed.folderName = null;

                return parsed;
            }
        } catch (e) {
            // [Critical fix] Catch initialization parse failures, including stack overflows.
            // If persisted data is corrupted, clear localStorage to avoid an infinite crash loop.
            console.error('[CanvasProvider] Failed to parse stored state (Resetting):', e);
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (cleanupErr) {
                console.error('[CanvasProvider] Failed to clear localStorage:', cleanupErr);
            }
            return DEFAULT_STATE;
        }
        return DEFAULT_STATE;
    });

    // Track in-flight save tasks to reduce data loss during refresh.
    const pendingSavesRef = useRef<Set<Promise<void>>>(new Set());
    const stateRef = useRef(state);
    const lastUserActivityAtRef = useRef<number>(Date.now());

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        const markUserActivity = () => {
            lastUserActivityAtRef.current = Date.now();
        };

        window.addEventListener('pointerdown', markUserActivity);
        window.addEventListener('keydown', markUserActivity);
        window.addEventListener('wheel', markUserActivity);
        window.addEventListener('touchstart', markUserActivity);

        return () => {
            window.removeEventListener('pointerdown', markUserActivity);
            window.removeEventListener('keydown', markUserActivity);
            window.removeEventListener('wheel', markUserActivity);
            window.removeEventListener('touchstart', markUserActivity);
        };
    }, []);

    // [Refresh guard] beforeunload warning for in-flight work.
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const currentState = stateRef.current;
            const hasPendingSaves = pendingSavesRef.current.size > 0;
            const hasRiskySyncGeneration = hasUnrecoverableSyncGenerationInFlight(currentState);

            if (hasPendingSaves || hasRiskySyncGeneration) {
                e.preventDefault();
                e.returnValue = hasRiskySyncGeneration
                    ? '当前有同步图片生成正在返回结果，刷新或离开会导致项目收不到最终图片。'
                    : '图片正在保存中，离开可能会导致数据丢失。';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Let the workspace shell paint first; heavier restoration continues in the background.
    useEffect(() => {
        const readyFrame = window.requestAnimationFrame(() => {
            startTransition(() => {
                setIsShellReady(true);
            });
        });

        return () => {
            window.cancelAnimationFrame(readyFrame);
        };
    }, []);

    // Load image URLs from IndexedDB AND Restore Folder Handle
    useEffect(() => {
        const init = async () => {
            try {
                // 1. Restore Local Folder Handle (Fix for 0B issue)
                try {
                    const handle = await getLocalFolderHandle();
                    if (handle) {
                        // Verify permission before setting state (Cloud/Web requirement)
                        // @ts-ignore
                        const perm = await handle.queryPermission({ mode: 'readwrite' });
                        if (perm === 'granted') {
                            logInfo('CanvasContext', '已恢复本地文件夹', `folder: ${handle.name}`);

                            // [NEW] Load actual project data from disk to ensure sync
                            // This overrides localStorage state with the true file state
                            try {
                                logInfo('CanvasContext', '开始从磁盘加载项目数据', `folder: ${handle.name}`);
                                const { canvases, images, activeCanvasId: savedActiveCanvasId } = await fileSystemService.loadProjectWithThumbs(handle);
                                logInfo('CanvasContext', '磁盘数据加载完成', `画布数: ${canvases.length}, 图片数: ${images.size}, 活动ID: ${savedActiveCanvasId}`);

                                // Hydrate the cache without ever letting thumbnails overwrite the original slot.
                                for (const [id, data] of images.entries()) {
                                    void hydrateRecoveredMediaCacheEntry(id, data).catch((error) => {
                                        console.warn('[CanvasContext] Cache hydration failed', id, error);
                                    });
                                }

                                // Load the reference-image map so missing references can be restored.
                                let refUrls = new Map<string, string>();
                                try {
                                    refUrls = await fileSystemService.loadAllReferenceImages(handle);
                                } catch (e) {
                                    console.warn('[CanvasContext] Failed to load reference images', e);
                                }

                                if (canvases.length > 0) {
                                    startTransition(() => {
                                        setState(prev => {
                                        // [Key fix] Merge disk project.json with the latest localStorage state.
                                        // A hard refresh usually leaves fresher state in localStorage via beforeunload.
                                        // project.json may lag behind due to async writes, so both sources must be merged carefully.
                                        const mergedCanvases = mergeCanvases(prev.canvases, canvases);
                                        const finalActiveId = resolvePreferredActiveCanvasId(
                                            prev.activeCanvasId,
                                            savedActiveCanvasId,
                                            mergedCanvases
                                        );

                                        return {
                                            ...prev,
                                            canvases: mergedCanvases.map(c => {
                                                return {
                                                    ...c,
                                                    imageNodes: c.imageNodes.map(img => ({
                                                        ...img,
                                                        url: (images.get(img.storageId || img.id)?.url || images.get(img.id)?.url) || img.url || img.apiResultUrl || '',
                                                        originalUrl: (images.get(img.storageId || img.id)?.originalUrl || images.get(img.id)?.originalUrl) || img.originalUrl || img.apiResultUrl
                                                    })),
                                                    promptNodes: c.promptNodes.map(pn => ({
                                                        ...pn,
                                                        // Restore missing reference data from refs/ when storageId is available.
                                                        referenceImages: normalizeReferenceImagesStorage(pn.referenceImages)?.map(ref => {
                                                            const recoveredData = !ref.data
                                                                ? getReferenceImageLookupIds(ref)
                                                                    .map((lookupId) => refUrls.get(lookupId))
                                                                    .find((value): value is string => typeof value === 'string' && value.length > 0)
                                                                : undefined;

                                                            return recoveredData
                                                                ? { ...ref, data: recoveredData }
                                                                : ref;
                                                        }) || []
                                                    }))
                                                };
                                            }),
                                            activeCanvasId: finalActiveId,
                                            fileSystemHandle: handle,
                                            folderName: handle.name
                                        };
                                    });
                                    });
                                } else {
                                    // Empty project on disk? Just connect.
                                    startTransition(() => {
                                        setState(prev => ({ ...prev, fileSystemHandle: handle, folderName: handle.name }));
                                    });
                                }
                            } catch (err) {
                                console.error('Failed to load project from restored handle', err);
                                // Fallback just connect
                                startTransition(() => {
                                    setState(prev => ({ ...prev, fileSystemHandle: handle, folderName: handle.name }));
                                });
                            }
                        } else {
                            logInfo('CanvasContext', '等待本地文件夹权限', `permission: ${perm}`);
                        }
                    } else {
                        logInfo('CanvasContext', '未找到已保存的本地文件夹', 'no persisted handle found');
                    }
                } catch (e) {
                    logError('CanvasContext', e, '恢复文件夹句柄失败');
                }

                // 2. Load images from IndexedDB on demand.
                console.log('[CanvasContext] Starting optimized image loading...');

                // Collect the image IDs required by the current state.
                const requiredImageIds = new Set<string>();
                state.canvases.forEach(c => {
                    // Generated image IDs: prefer storageId because persistence uses that key.
                    c.imageNodes.forEach(img => {
                        requiredImageIds.add(img.storageId || img.id);
                    });
                    // Reference image IDs.
                    c.promptNodes.forEach(pn => {
                        if (pn.referenceImages) {
                            pn.referenceImages.forEach(ref => {
                                requiredImageIds.add(ref.storageId || ref.id);
                            });
                        }
                    });
                });


                console.log(`[CanvasContext] Found ${requiredImageIds.size} images needed in current state`);

                // Separate reference images from generated images.
                const referenceImageIds = new Set<string>();
                const generatedImageIds = new Set<string>();

                state.canvases.forEach(c => {
                    // Generated images.
                    c.imageNodes.forEach(img => {
                        generatedImageIds.add(img.storageId || img.id);
                    });
                    // Reference images: collect separately so they load first.
                    c.promptNodes.forEach(pn => {
                        if (pn.referenceImages) {
                            pn.referenceImages.forEach(ref => {
                                referenceImageIds.add(ref.storageId || ref.id);
                            });
                        }
                    });
                });

                // [Fix] Always load all reference images.
                // Only the generated-image set is capped.
                const MAX_GENERATED_LOAD = 5;
                let generatedIdsArray = Array.from(generatedImageIds);

                // Prioritize generated images closest to the viewport center.
                const viewportX = state.viewportCenter.x;
                const viewportY = state.viewportCenter.y;
                const imagesWithDistance = generatedIdsArray.map(id => {
                    let minDistance = Infinity;
                    state.canvases.forEach(c => {
                        const node = c.imageNodes.find(n => (n.storageId || n.id) === id);
                        if (node) {
                            const dx = node.position.x - viewportX;
                            const dy = node.position.y - viewportY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            minDistance = Math.min(minDistance, distance);
                        }
                    });
                    return { id, distance: minDistance };
                });

                // Sort by distance so center-adjacent images load first.
                imagesWithDistance.sort((a, b) => a.distance - b.distance);
                generatedIdsArray = imagesWithDistance.slice(0, MAX_GENERATED_LOAD).map(item => item.id);

                // [Key fix] Combine all references with the capped generated set.
                const imageIdsArray = [...Array.from(referenceImageIds), ...generatedIdsArray];

                if (generatedImageIds.size > MAX_GENERATED_LOAD) {
                    console.warn(`[CanvasContext] Too many generated images (${generatedImageIds.size}), loading only ${MAX_GENERATED_LOAD} nearest to center`);
                }
                console.log(`[CanvasContext] Loading ${referenceImageIds.size} reference images + ${generatedIdsArray.length} generated images`);

                // Load only the images needed by the current state.
                const imageMap = new Map<string, string>();
                const BATCH_SIZE = 5; // Smaller batches reduce peak memory usage.

                for (let i = 0; i < imageIdsArray.length; i += BATCH_SIZE) {
                    const batch = imageIdsArray.slice(i, i + BATCH_SIZE);
                    // [OOM fix] Load MICRO quality (<50KB) instead of THUMBNAIL.
                    const batchPromises = batch.map(id => getImageByQuality(id, ImageQuality.MICRO));
                    const batchResults = await Promise.all(batchPromises);

                    batch.forEach((id, index) => {
                        const url = batchResults[index];
                        if (url) {
                            imageMap.set(id, url);
                        }
                    });

                    console.log(`[CanvasContext] Loaded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(imageIdsArray.length / BATCH_SIZE)} (${imageMap.size}/${imageIdsArray.length})`);
                }

                console.log(`[CanvasContext] Successfully loaded ${imageMap.size}/${requiredImageIds.size} required images`);

                if (imageMap.size < requiredImageIds.size) {
                    console.debug(`[CanvasContext] ${requiredImageIds.size - imageMap.size} images not found in IndexedDB`);
                }

                // Migrate old images: if localStorage has URLs but IndexedDB doesn't, save them
                // Also migrate Reference Images
                let needsMigration = false;
                const imagesToMigrate: { id: string; url: string }[] = [];

                state.canvases.forEach(c => {
                    // Check generated images
                    c.imageNodes.forEach(img => {
                        if (img.url && img.url.startsWith('data:') && !imageMap.has(img.id)) {
                            imagesToMigrate.push({ id: img.id, url: img.url });
                            needsMigration = true;
                        }
                    });

                    // Check reference images in prompt nodes
                    c.promptNodes.forEach(pn => {
                        if (pn.referenceImages) {
                            pn.referenceImages.forEach(ref => {
                                const lookupIds = getReferenceImageLookupIds(ref);
                                if (ref.data && lookupIds.some((lookupId) => !imageMap.has(lookupId))) {
                                    // Reconstruct data URL if needed or just store raw base64 depending on storage format
                                    // referenceImages.data is typically just the base64 string, not full URL
                                    const fullUrl = toReferenceImageDataUrl(ref.data, ref.mimeType);
                                    lookupIds.forEach((lookupId) => {
                                        if (!imageMap.has(lookupId)) {
                                            imagesToMigrate.push({ id: lookupId, url: fullUrl });
                                            needsMigration = true;
                                        }
                                    });
                                }
                            });
                        }
                    });
                });

                // Save migrated images to IndexedDB
                for (const img of imagesToMigrate) {
                    await saveImage(img.id, img.url);
                    imageMap.set(img.id, img.url);
                }

                if (needsMigration) {
                    console.log(`Migrated ${imagesToMigrate.length} images (generated & references) to IndexedDB`);
                }

                // Update state with images from IndexedDB (or already in state)
                if (imageMap.size > 0) {
                    startTransition(() => {
                        setState(prev => ({
                        ...prev,
                        canvases: prev.canvases.map(c => syncCanvasCompatibility({
                            ...c,
                            imageNodes: c.imageNodes.map(img => {
                                const storedUrl = imageMap.get(img.storageId || img.id);
                                // Prefer cached URL. It might be:
                                // - data:... (base64) -> convert to blob URL for perf
                                // - http(s)/blob:...  -> use as-is (fix for empty url after strip)
                                let displayUrl = img.url || '';
                                if (storedUrl) {
                                    if (storedUrl.startsWith('data:')) {
                                        const blob = base64ToBlob(storedUrl);
                                        displayUrl = URL.createObjectURL(blob);
                                    } else {
                                        displayUrl = storedUrl;
                                    }
                                }
                                return {
                                    ...img,
                                    url: displayUrl, // Use Blob URL
                                    // IMPORTANT:
                                    // `storedUrl` here is the MICRO preview loaded for canvas performance,
                                    // not the protected original. Never hydrate it into `originalUrl`,
                                    // otherwise lightbox will mistake the thumbnail for the full image.
                                    originalUrl: img.originalUrl || img.apiResultUrl
                                };
                            }),
                            // Rehydrate reference images
                            promptNodes: c.promptNodes.map(pn => ({
                                ...pn,
                                referenceImages: pn.referenceImages?.map(ref => {
                                    const storedUrl = imageMap.get(ref.storageId || ref.id);
                                    if (storedUrl) {
                                        let finalData = storedUrl;
                                        let finalMime = ref.mimeType || 'image/png';

                                        // [SELF-HEALING] Detect corrupted double-wrapped URLs (e.g. data:image/png;base64,http...)
                                        // This fixes images that were saved with the previous buggy logic
                                        const corruptedMatch = storedUrl.match(/^data:.*;base64,(http.*|blob:.*)$/);
                                        if (corruptedMatch) {
                                            console.log('[CanvasContext] Recovering corrupted URL:', corruptedMatch[1]);
                                            finalData = corruptedMatch[1];
                                        } else if (storedUrl.startsWith('data:')) {
                                            // Normal Data URL extraction
                                            const matches = storedUrl.match(/^data:(.+);base64,(.+)$/);
                                            if (matches) {
                                                finalMime = matches[1];
                                                // We keep the full URL for the component to render, or just the base64?
                                                // ReferenceThumbnail handles both, but let's keep full URL for consistency if it's valid
                                            }
                                        }

                                        // Accept Data URL, HTTP, Blob, or Raw Base64
                                        if (finalData.startsWith('data:') || finalData.startsWith('http') || finalData.startsWith('blob:') || finalData.length > 20) {
                                            return { ...ref, mimeType: finalMime, data: finalData };
                                        }
                                    }
                                    return ref;
                                }) || []
                            }))
                        }))
                    }));
                    });
                }
            } catch (error) {
                console.error('Failed to load images from IndexedDB:', error);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, []);

    // Helper: Strip image URLs for storage


    const getCanvasCardCount = (canvas?: Canvas | null): number => {
        if (!canvas) return 0;
        return (canvas.promptNodes?.length || 0) + (canvas.imageNodes?.length || 0);
    };

    const isCanvasEffectivelyEmpty = (canvas?: Canvas | null): boolean => getCanvasCardCount(canvas) === 0;

    const mergeItemsById = <T extends { id: string }>(localItems: T[] = [], diskItems: T[] = []): T[] => {
        const map = new Map<string, T>();
        diskItems.forEach(item => map.set(item.id, item));
        localItems.forEach(item => {
            const existing = map.get(item.id);
            map.set(item.id, existing ? { ...existing, ...item } : item);
        });
        return Array.from(map.values());
    };

    const mergeSingleCanvas = (localCanvas: Canvas, diskCanvas: Canvas): Canvas => {
        const localCount = getCanvasCardCount(localCanvas);
        const diskCount = getCanvasCardCount(diskCanvas);

        if (localCount === 0 && diskCount > 0) {
            return normalizeCanvasPromptRecovery({
                ...localCanvas,
                ...diskCanvas,
                name: diskCanvas.name || localCanvas.name,
                folderName: diskCanvas.folderName || localCanvas.folderName,
                promptNodes: diskCanvas.promptNodes || [],
                imageNodes: diskCanvas.imageNodes || [],
                groups: diskCanvas.groups || [],
                drawings: diskCanvas.drawings || [],
                lastModified: Math.max(localCanvas.lastModified || 0, diskCanvas.lastModified || 0)
            });
        }

        if (diskCount === 0 && localCount > 0) {
            return normalizeCanvasPromptRecovery({
                ...diskCanvas,
                ...localCanvas,
                promptNodes: localCanvas.promptNodes || [],
                imageNodes: localCanvas.imageNodes || [],
                groups: localCanvas.groups || [],
                drawings: localCanvas.drawings || [],
                lastModified: Math.max(localCanvas.lastModified || 0, diskCanvas.lastModified || 0)
            });
        }

        const preferLocal = (localCanvas.lastModified || 0) >= (diskCanvas.lastModified || 0);
        const baseCanvas = preferLocal ? diskCanvas : localCanvas;
        const overrideCanvas = preferLocal ? localCanvas : diskCanvas;

        return normalizeCanvasPromptRecovery({
            ...baseCanvas,
            ...overrideCanvas,
            name: overrideCanvas.name || baseCanvas.name,
            folderName: overrideCanvas.folderName || baseCanvas.folderName,
            promptNodes: mergeItemsById(localCanvas.promptNodes || [], diskCanvas.promptNodes || []),
            imageNodes: mergeItemsById(localCanvas.imageNodes || [], diskCanvas.imageNodes || []),
            groups: mergeItemsById(localCanvas.groups || [], diskCanvas.groups || []),
            drawings: mergeItemsById(localCanvas.drawings || [], diskCanvas.drawings || []),
            lastModified: Math.max(localCanvas.lastModified || 0, diskCanvas.lastModified || 0)
        });
    };

    const mergeCanvases = (local: Canvas[], disk: Canvas[]): Canvas[] => {
        const map = new Map<string, Canvas>();
        disk.forEach(canvas => map.set(canvas.id, canvas));

        local.forEach(localCanvas => {
            const diskCanvas = map.get(localCanvas.id);
            if (!diskCanvas) {
                map.set(localCanvas.id, localCanvas);
                return;
            }

            map.set(localCanvas.id, mergeSingleCanvas(localCanvas, diskCanvas));
        });

        return Array.from(map.values());
    };

    const resolvePreferredActiveCanvasId = (
        localActiveId: string | undefined,
        diskActiveId: string | null | undefined,
        canvases: Canvas[]
    ): string => {
        const localActiveCanvas = localActiveId ? canvases.find(c => c.id === localActiveId) : undefined;
        const diskActiveCanvas = diskActiveId ? canvases.find(c => c.id === diskActiveId) : undefined;

        if (localActiveCanvas && !isCanvasEffectivelyEmpty(localActiveCanvas)) {
            return localActiveCanvas.id;
        }

        if (diskActiveCanvas && !isCanvasEffectivelyEmpty(diskActiveCanvas)) {
            return diskActiveCanvas.id;
        }

        if (localActiveCanvas && diskActiveCanvas && localActiveCanvas.id !== diskActiveCanvas.id) {
            return diskActiveCanvas.id;
        }

        const firstNonEmptyCanvas = canvases.find(canvas => !isCanvasEffectivelyEmpty(canvas));
        if (firstNonEmptyCanvas) {
            return firstNonEmptyCanvas.id;
        }

        if (diskActiveCanvas) return diskActiveCanvas.id;
        if (localActiveCanvas) return localActiveCanvas.id;
        return canvases[0]?.id || 'default';
    };

    // Cloud sync: load and merge on init.
    useEffect(() => {
        const loadCloud = async () => {
            // Wait for auth?
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            try {
                const cloudCanvases = await syncService.loadLayout();
                if (cloudCanvases && cloudCanvases.length > 0) {
                    setState(prev => {
                        const merged = mergeCanvases(prev.canvases, cloudCanvases);
                        // Check if anything changed
                        if (JSON.stringify(merged) !== JSON.stringify(prev.canvases)) {
                            console.log('[CanvasContext] Merged cloud layout.', { local: prev.canvases.length, cloud: cloudCanvases.length, merged: merged.length });

                            // Hydrate newly added nodes after sync (simulated).
                            // Since we don't have URLs, we rely on IDB hydration loop or trigger it?
                            // Re-triggering full init is heavy.
                            // Let's rely on lazy hydration if accessed?
                            // Or simple re-hydration loop for the merged set.

                            // Trigger background hydration
                            hydrateMergedImages(merged).catch(console.error);

                            return { ...prev, canvases: merged };
                        }
                        return prev;
                    });
                }
            } catch (e) {
                console.error('[CanvasContext] Cloud load failed', e);
            }
        };

        const hydrateMergedImages = async (canvases: Canvas[]) => {
            // Try to find images in IDB for nodes that are missing URLs
            let hasUpdates = false;

            // Map IDs to URLs
            const urlMap = new Map<string, string>();
            const promises: Promise<void>[] = [];

            for (const c of canvases) {
                for (const img of c.imageNodes) {
                    if (!img.url && (img.storageId || img.id)) {
                        promises.push(
                            getImage(img.storageId || img.id).then(url => {
                                if (url) {
                                    urlMap.set(img.id, url);
                                    hasUpdates = true;
                                }
                            }).catch(() => { })
                        );
                    }
                }
            }

            if (promises.length === 0) return;

            await Promise.all(promises);

            if (hasUpdates) {
                setState(prev => ({
                    ...prev,
                    canvases: prev.canvases.map(c => syncCanvasCompatibility({
                        ...c,
                        imageNodes: c.imageNodes.map(img =>
                            urlMap.has(img.id) ? { ...img, url: urlMap.get(img.id)! } : img
                        )
                    }))
                }));
                console.log(`[CanvasContext] Hydrated ${urlMap.size} images from cloud layout.`);
            }
        };

        if (!isLoading) loadCloud();
    }, [isLoading]);

    // Cloud sync: auto-save.
    useEffect(() => {
        if (isLoading || state.canvases.length === 0) return;

        const timer = setTimeout(() => {
            const stripped = stripImageUrls(state.canvases);
            syncService.saveLayout(stripped).catch(e => console.error('[CanvasContext] Cloud save failed', e));
        }, 3000); // 3s debounce

        return () => clearTimeout(timer);
    }, [state.canvases, isLoading]);
    const isLoadingRef = useRef(isLoading);
    // Mark operations that need an urgent flush and should bypass the 200ms debounce.
    const urgentSaveRef = useRef(false);
    useLayoutEffect(() => {
        stateRef.current = state;
        isLoadingRef.current = isLoading;
    }, [state, isLoading]);

    // Persistence Mechanism
    useEffect(() => {
        // 1. Debounced Auto-Save
        if (isLoading) return;

        const saveState = async () => {
            try {
                persistCanvasStateToLocalStorage(state, 'debounced-save');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') console.error('localStorage quota exceeded.');
                else console.error('Failed to save state:', error);
            }
        };

        let timer: any;
        if (urgentSaveRef.current) {
            // Urgent path: save immediately, bypass debounce, and reset the flag.
            urgentSaveRef.current = false;
            saveState();
        } else {
            timer = setTimeout(saveState, 200);
        }

        return () => clearTimeout(timer);
    }, [state, isLoading]);

    // 2. Stable Safety Save (Unload / Hidden) - Unmounts only once
    useEffect(() => {
        const handleSave = (source: 'visibility' | 'beforeunload') => {
            if (isLoadingRef.current) return;
            try {
                const currentState = stateRef.current;
                const stateToPersist = source === 'beforeunload'
                    ? markInterruptedSyncPromptGenerations(currentState)
                    : currentState;
                persistCanvasStateToLocalStorage(stateToPersist, source === 'beforeunload' ? 'beforeunload-save' : 'visibility-save');
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
    }, []);

    // Hydrate Reference Images from IDB (if stripped from localStorage)
    useEffect(() => {
        if (!state.activeCanvasId) return;
        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        if (!currentCanvas) return;

        let hasUpdates = false;
        const updates: { nodeId: string; refs: any[] }[] = [];

        const hydrateRefs = async () => {
            const promises = currentCanvas.promptNodes.map(async (node) => {
                if (!node.referenceImages || node.referenceImages.length === 0) return;

                let nodeUpdated = false;
                const newRefs = await Promise.all(node.referenceImages.map(async (ref) => {
                    // If data is missing (stripped), try to load from IDB
                    if (!ref.data || ref.data === '') {
                        try {
                            for (const lookupId of getReferenceImageLookupIds(ref)) {
                                const data = await getImage(lookupId);
                                if (data) {
                                    nodeUpdated = true;
                                    return { ...ref, storageId: ref.storageId || lookupId, data };
                                }
                            }
                        } catch (e) {
                            // console.warn('Failed to hydrate ref', ref.id);
                        }
                    }
                    return ref;
                }));

                if (nodeUpdated) {
                    updates.push({ nodeId: node.id, refs: newRefs });
                    hasUpdates = true;
                }
            });

            await Promise.all(promises);

            if (hasUpdates) {
                setState(prev => ({
                    ...prev,
                    canvases: prev.canvases.map(c => c.id === prev.activeCanvasId
                        ? syncCanvasCompatibility({
                            ...c,
                            promptNodes: c.promptNodes.map(pn => {
                                const update = updates.find(u => u.nodeId === pn.id);
                                return update ? { ...pn, referenceImages: update.refs } : pn;
                            })
                        })
                        : c)
                }));
            }
        };

        // Delay slighty to defer IO
        setTimeout(hydrateRefs, 500);

    }, [state.activeCanvasId]); // Run when canvas changes (or roughly once on load if active ID is set)


    const activeCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
    const canCreateCanvas = state.canvases.length < MAX_CANVASES;

    const createCanvas = useCallback((): string | null => {
        if (state.canvases.length >= MAX_CANVASES) {
            return null; // Max reached
        }

        // Find the next available number for "项目X".
        const existingNumbers = state.canvases
            .map(c => {
                const match = c.name.match(/^项目(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => n > 0);
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

        const canvasName = `项目${nextNumber}`;
        const newCanvas: Canvas = {
            id: generateId(),
            name: canvasName,
            folderName: canvasName, // Freeze the physical folder name on first creation; later renames only update the display name.
            promptNodes: [],
            imageNodes: [],
            groups: [] as CanvasGroup[],
            drawings: [] as CanvasDrawing[],
            workflow: createCanvasWorkflow(),
            lastModified: Date.now()
        };
        urgentSaveRef.current = true; // Force an immediate save after creating a canvas.
        setState(prev => ({
            ...prev,
            canvases: [...prev.canvases, newCanvas],
            activeCanvasId: newCanvas.id
        }));
        return newCanvas.id; // Return the new canvas ID for follow-up flows.
    }, [state.canvases.length, state.canvases]);

    const switchCanvas = useCallback((id: string) => {
        urgentSaveRef.current = true; // Force an immediate save after switching canvases.
        setState(prev => ({ ...prev, activeCanvasId: id }));
    }, []);

    const renameCanvas = useCallback(async (id: string, newName: string) => {
        const targetCanvas = state.canvases.find(c => c.id === id);
        if (!targetCanvas) return;
        const oldName = targetCanvas.name;
        const finalNewName = newName.trim() || oldName;

        if (oldName === finalNewName) return;

        // Lightweight rename: keep the physical folder name stable and only update the display name in project.json.
        // Also write a small hint file into the folder so the rename is discoverable on disk.
        void getLocalFolderHandle().then(async (handle) => {
            if (handle) {
                try {
                    // Reuse the original physical folder name; fall back to the old display name if needed.
                    const physicalFolderName = (targetCanvas.folderName || oldName).trim().replace(/[\\/:*?"<>|]/g, '_');
                    // @ts-ignore
                    const projectDir = await handle.getDirectoryHandle(physicalFolderName);

                    // 1. Update canvas.name in project.json.
                    try {
                        // @ts-ignore
                        const pFile = await projectDir.getFileHandle('project.json');
                        // @ts-ignore
                        const pText = await (await pFile.getFile()).text();
                        const pData = JSON.parse(pText);
                        if (pData.canvas) {
                            pData.canvas.name = finalNewName;
                        }
                        // @ts-ignore
                        const writable = await pFile.createWritable();
                        await writable.write(JSON.stringify(pData, null, 2));
                        await writable.close();
                    } catch (e) { /* Ignore if project.json does not exist yet; the next save will create it. */ }

                    // 2. Remove older rename hint files.
                    try {
                        // @ts-ignore
                        for await (const entry of projectDir.values()) {
                            if (entry.kind === 'file' && entry.name.startsWith('project-renamed-to_')) {
                                // @ts-ignore
                                await projectDir.removeEntry(entry.name);
                            }
                        }
                    } catch (e) { /* Ignore. */ }

                    // 3. Write the new rename hint file.
                    const hintFileName = `project-renamed-to_${finalNewName.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
                    // @ts-ignore
                    const hintFile = await projectDir.getFileHandle(hintFileName, { create: true });
                    // @ts-ignore
                    const hintWritable = await hintFile.createWritable();
                    await hintWritable.write(`This folder corresponds to the KK Studio project renamed to: ${finalNewName}\nOriginal folder name: ${physicalFolderName}\nUpdated at: ${new Date().toLocaleString()}`);
                    await hintWritable.close();

                    console.log('[CanvasContext] Project rename completed (light rename)', { oldName, finalNewName, physicalFolderName });
                } catch (e) {
                    console.warn('[CanvasContext] Failed to update local shortcut (non-blocking)', e);
                }
            }
        });

        // Update the UI immediately while keeping folderName stable.
        setState(prev => ({
            ...prev,
            canvases: prev.canvases.map(c =>
                c.id === id ? { ...c, name: finalNewName, folderName: c.folderName || oldName } : c
            )
        }));
    }, [state.canvases]);

    const deleteCanvas = useCallback((id: string) => {
        setState(prev => {
            if (prev.canvases.length <= 1) return prev; // Cannot delete last one
            const newCanvases = prev.canvases.filter(c => c.id !== id);
            const newActiveId = prev.activeCanvasId === id ? newCanvases[0].id : prev.activeCanvasId;
            return {
                canvases: newCanvases,
                activeCanvasId: newActiveId,
                history: prev.history,
                fileSystemHandle: prev.fileSystemHandle,
                folderName: prev.folderName,
                selectedNodeIds: [],
                subCardLayoutMode: prev.subCardLayoutMode,
                viewportCenter: prev.viewportCenter
            };
        });
    }, []);

    const updateCanvas = useCallback((updater: (canvas: Canvas) => Canvas) => {
        setState(prev => ({
            ...prev,
            canvases: prev.canvases.map(c =>
                c.id === prev.activeCanvasId
                    ? syncCanvasCompatibility({ ...updater(c), lastModified: Date.now() })
                    : c
            ),
            // Maintain existing history structure when updating canvas content
            history: prev.history
        }));
    }, []);

    const addPromptNode = useCallback(async (node: PromptNode) => {
        console.log('[CanvasContext.addPromptNode] Starting prompt node insert', { nodeId: node.id, prompt: node.prompt?.substring(0, 50) });

        try {
            // [Defensive fix] Add the node to state first so the UI shows it immediately.
            updateCanvas(c => {
                const allZIndices = [
                    ...c.promptNodes.map(n => n.zIndex ?? 0),
                    ...c.imageNodes.map(n => n.zIndex ?? 0),
                    ...(c.groups || []).map(g => g.zIndex ?? 0)
                ];
                let maxZ = allZIndices.length > 0 ? Math.max(...allZIndices) : 0;

                // Give the new PromptNode the highest z-index so older cards do not cover it.
                const nodeWithZIndex = { ...node, zIndex: maxZ + 1 };

                return {
                    ...c,
                    promptNodes: c.promptNodes.some(n => n.id === node.id) ?
                        (console.warn(`[CanvasContext] Skip duplicate promptNodeID: ${node.id}`), c.promptNodes) :
                        [...c.promptNodes, nodeWithZIndex]
                };
            });
            console.log('[CanvasContext.addPromptNode] Prompt card added to canvas');

            // [Key fix] Save reference images asynchronously; failures must not block card rendering.
            if (node.referenceImages && node.referenceImages.length > 0) {
                console.log(`[CanvasContext.addPromptNode] Saving ${node.referenceImages.length} reference images`);
                const saveTasks = node.referenceImages.map(async (ref, index) => {
                    if (ref.data) {
                        const fullUrl = toReferenceImageDataUrl(ref.data, ref.mimeType || 'image/png');
                        const lookupIds = getReferenceImageLookupIds(ref);
                        try {
                            await Promise.allSettled(lookupIds.map((lookupId) => saveImage(lookupId, fullUrl)));
                            console.log(`[CanvasContext.addPromptNode] Reference image ${index + 1}/${node.referenceImages?.length || 0} saved:`, lookupIds[0] || ref.id);
                        } catch (e: any) {
                            console.error(`[CanvasContext.addPromptNode] Failed to save reference image ${index + 1}:`, lookupIds[0] || ref.id, e?.message || e);
                            // Notify the user, but do not interrupt the flow.
                            notificationService.warning('参考图保存失败', `参考图 ${index + 1} 保存失败，刷新后可能丢失`);
                        }
                    }
                });
                await Promise.allSettled(saveTasks); // Use allSettled so one failed reference does not abort the rest.
                console.log('[CanvasContext.addPromptNode] Reference image persistence finished');
            }
        } catch (error: any) {
            // Fatal error: adding the card failed.
            console.error('[CanvasContext.addPromptNode] Failed to add prompt node', error);
            notificationService.error('添加卡片失败', '无法创建卡片：' + (error?.message || '未知错误'));
            // Do not rethrow here; avoid interrupting the downstream image-generation flow.
        }
    }, [updateCanvas]);

    const pushToHistory = useCallback(() => {
        const current = state.canvases.find(c => c.id === state.activeCanvasId);
        if (!current) return;

        setState(prev => {
            const historyEntry = prev.history[prev.activeCanvasId] || { past: [], future: [] };
            const newPast = [...historyEntry.past, current]; // Push current state to past

            // Limit history depth
            if (newPast.length > 20) newPast.shift();

            return {
                ...prev,
                history: {
                    ...prev.history,
                    [prev.activeCanvasId]: {
                        past: newPast,
                        future: [] // Clear future on new action
                    }
                }
            };
        });
    }, [state.activeCanvasId, state.canvases]);

    const updatePromptNode = useCallback(async (node: PromptNode) => {
        // [Key fix] Save reference images before updating the node to avoid losing them on refresh.
        if (node.referenceImages && node.referenceImages.length > 0) {
            const saveTasks = node.referenceImages.map(async ref => {
                if (ref.data) {
                    const fullUrl = toReferenceImageDataUrl(ref.data, ref.mimeType || 'image/png');
                    try {
                        await Promise.allSettled(
                            getReferenceImageLookupIds(ref).map((lookupId) => saveImage(lookupId, fullUrl))
                        );
                    } catch (e) {
                        console.error(`[CanvasContext] Failed to save reference image ${ref.storageId || ref.id}`, e);
                    }
                }
            });
            await Promise.all(saveTasks);
        }

        updateCanvas(c => ({
            ...c,
            promptNodes: c.promptNodes.map(n => {
                if (n.id === node.id) {
                    // [Defensive merge]
                    // We must ensure we don't accidentally overwrite existing valid data with empty data
                    // especially during rapid status updates (generating -> success)
                    const merged: PromptNode = {
                        ...n,
                        ...node,
                        // If the incoming node has empty prompt/refs but the existing one has them, keep the existing values.
                        // Unless we are explicitly clearing them (which usually happens via setConfig/delete)
                        // But updatePromptNode is mostly used for status updates.
                        prompt: (node.prompt && node.prompt.length > 0) ? node.prompt : n.prompt,
                        referenceImages: (node.referenceImages && node.referenceImages.length > 0) ? node.referenceImages : n.referenceImages
                    };

                    // [Bugfix] Prevent stale callbacks from flipping completed/failed cards back to "generating".
                    // Typical case: ResizeObserver/onHeightChange races carry older node snapshots over newer state.
                    const hasFinished = resolvePromptChildImageIds(n, c.imageNodes).length > 0;
                    const hasFailed = !!n.error;

                    if ((hasFinished || hasFailed) && node.isGenerating === true && n.isGenerating === false) {
                        merged.isGenerating = false;
                        // Also preserve error so stale undefined values do not overwrite it.
                        // [Fix] Still allow callers to clear error explicitly with error: undefined.
                        if (hasFailed && !merged.error && !('error' in node)) {
                            merged.error = n.error;
                            merged.errorDetails = n.errorDetails;
                        }
                    }

                    return merged;
                }
                return n;
            })
        }));
    }, [updateCanvas]);

    const urgentUpdatePromptNode = useCallback((node: PromptNode) => {
        // [Persistence] Bypass the debounced save and force an immediate state write.
        // 1. Update React State (UI will reflect change)
        updateCanvas(c => ({
            ...c,
            promptNodes: c.promptNodes.map(n => n.id === node.id ? { ...n, ...node } : n)
        }));

        // 2. Immediate LocalStorage Save (Prevention for Refresh/Close)
        // We use stateRef to get the most recent state since setState is async
        const recentState = stateRef.current;
        const activeCanvas = recentState.canvases.find(c => c.id === recentState.activeCanvasId);

        if (activeCanvas) {
            const updatedCanvases = recentState.canvases.map(c => {
                if (c.id === recentState.activeCanvasId) {
                    return {
                        ...c,
                        promptNodes: c.promptNodes.map(n => n.id === node.id ? { ...n, ...node } : n)
                    };
                }
                return c;
            });

            const stateToSave = { ...recentState, canvases: updatedCanvases };

            try {
                persistCanvasStateToLocalStorage(stateToSave, 'urgent-node-save');
                console.log(`[CanvasContext] URGENT SAVE for node ${node.id} to localStorage`);
            } catch (e) {
                console.error('[CanvasContext] Urgent save failed', e);
            }
        }
    }, [updateCanvas]);

    const addImageNodes = useCallback(async (nodes: GeneratedImage[], parentUpdates?: Record<string, Partial<PromptNode>>) => {
        console.log('[CanvasContext.addImageNodes] Starting image node insert', { count: nodes?.length, hasParentUpdates: !!parentUpdates });

        // Defensive filter: drop invalid nodes, but keep nodes that are still generating.
        const validNodes = Array.isArray(nodes)
            ? nodes.filter(n => n && n.id && (n.url || n.originalUrl || n.apiResultUrl || n.isGenerating))
            : [];
        if (validNodes.length === 0) {
            console.warn('[CanvasContext.addImageNodes] No valid image nodes to add.');
            return;
        }
        console.log('[CanvasContext.addImageNodes] Validation passed', validNodes.length, 'nodes');

        // Process Nodes: Create Blob URLs for State, Keep Base64 for Persistence
        const stateNodes: GeneratedImage[] = [];
        const persistenceTasks: Promise<void>[] = [];

        for (const node of validNodes) {
            let displayUrl = node.url || node.originalUrl || node.apiResultUrl || '';
            // If Base64, convert to Blob URL for optimized rendering
            if (displayUrl.startsWith('data:')) {
                try {
                    const blob = base64ToBlob(displayUrl);
                    displayUrl = URL.createObjectURL(blob);
                } catch (e) {
                    console.error('Failed to create Blob URL', e);
                }
            }

            stateNodes.push({ ...node, url: displayUrl });

            // Persistence: Save ORIGINAL (Base64) to IndexedDB
            persistenceTasks.push((async () => {
                try {
                    const sourceForTypeCheck = node.originalUrl || node.apiResultUrl || node.url || '';
                    const isVideo = node.mode === 'video' || sourceForTypeCheck.startsWith('data:video/');
                    const storageId = node.storageId || node.id;
                    const preferredOriginalSource = node.originalUrl || node.apiResultUrl || node.url || '';
                    const stableOriginalSource = preferredOriginalSource.startsWith('blob:')
                        ? null
                        : preferredOriginalSource;
                    const previewSource = stableOriginalSource || preferredOriginalSource;

                    // [Key fix] Save the original asset to the most durable store first.
                    // A. File system first: persist to local disk when available.
                    // [Closure fix] Read the latest handle dynamically instead of relying on stale state.
                    const selectedStorageMode = await getStorageMode();
                    const currentHandle = selectedStorageMode === 'local' ? await getLocalFolderHandle() : null;

                    if (selectedStorageMode === 'local' && currentHandle) {
                        try {
                            const res = await fetch(previewSource); // works with data:/blob:/http:
                            const blob = await res.blob();
                            await fileSystemService.saveImageToHandle(currentHandle, storageId, blob, isVideo);
                            console.log(`[CanvasContext] Saved ORIGINAL ${isVideo ? 'video' : 'image'} ${storageId} to LOCAL DISK`);
                        } catch (e) {
                            if (!preferredOriginalSource.startsWith('blob:')) {
                                console.error(`[CanvasContext] Failed to save ${isVideo ? 'video' : 'image'} ${node.id} to LOCAL DISK`, e);
                            }
                        }
                    } else if (selectedStorageMode === 'opfs') {
                        // [Addition] If there is no local folder, check whether OPFS is available.
                        const { isOPFSAvailable, saveToOPFS } = await import('../services/storage/opfsService');

                        if (isOPFSAvailable()) {
                            // Browser/mobile fallback: store the original asset in OPFS.
                            try {
                                const res = await fetch(previewSource);
                                const blob = await res.blob();

                                if (isVideo) {
                                    await saveToOPFS(blob, storageId, 'video');
                                    console.log(`[CanvasContext] Saved video ${storageId} to OPFS`);
                                } else {
                                    await saveToOPFS(blob, storageId, 'image');
                                    console.log(`[CanvasContext] Saved ORIGINAL image ${storageId} to OPFS`);
                                }
                            } catch (e) {
                                if (!preferredOriginalSource.startsWith('blob:')) {
                                    console.error(`[CanvasContext] Failed to save to OPFS`, e);
                                }
                            }
                        } else {
                            console.log(`[CanvasContext] No local folder or OPFS available, using IndexedDB for ${storageId}`);
                        }
                    } else {
                        console.log(`[CanvasContext] Browser storage mode selected, skipping local/OPFS for ${storageId}`);
                    }

                    // B. IndexedDB cache: always keep a fast recovery copy.
                    if (isVideo) {
                        // Videos are stored directly without thumbnail compression.
                        await saveImage(storageId, previewSource);
                        console.log(`[CanvasContext] Saved video ${storageId} to IndexedDB cache`);
                    } else {
                        // Keep an ORIGINAL copy in IndexedDB even when local disk or OPFS is available.
                        // That makes first paint and reload hit storageId immediately without waiting on disk reads.
                        if (stableOriginalSource) {
                            await saveOriginalImage(storageId, stableOriginalSource);
                            console.log(`[CanvasContext] Saved ORIGINAL for ${storageId} to IndexedDB cache`);
                        } else {
                            console.debug(`[CanvasContext] Skip ORIGINAL IDB save for transient blob ${storageId}`);
                        }

                        // [Optimization] Generate thumbnails in a Web Worker to avoid blocking the main thread.
                        try {
                            const { generateThumbnailWithPreset } = await import('../workers/thumbnailService');
                            const { blob } = await generateThumbnailWithPreset(previewSource, 'MICRO');

                            // Convert the worker output to base64 before storing it in IndexedDB.
                            const reader = new FileReader();
                            const microData = await new Promise<string>((resolve, reject) => {
                                reader.onload = () => resolve(reader.result as string);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });

                            const microId = getQualityStorageId(storageId, ImageQuality.MICRO);
                            await saveImage(microId, microData);
                            console.log(`[CanvasContext] Saved MICRO thumbnail (Worker) for ${storageId}`);

                            if (selectedStorageMode === 'local' && currentHandle) {
                                await fileSystemService.saveThumbnailToHandle(currentHandle, storageId, blob);
                            }

                            // Mirror the preview slot to the original asset to avoid blank preview reads.
                            const previewId = getQualityStorageId(storageId, ImageQuality.PREVIEW);
                            await saveImage(previewId, previewSource);
                        } catch (workerError) {
                            // Fall back to main-thread compression if the worker fails.
                            console.warn(`[CanvasContext] Worker failed, falling back to main thread:`, workerError);
                            const microData = await compressImageToQuality(previewSource, QUALITY_CONFIGS[ImageQuality.MICRO]);
                            const microId = getQualityStorageId(storageId, ImageQuality.MICRO);
                            await saveImage(microId, microData);
                            console.log(`[CanvasContext] Saved MICRO thumbnail (main thread) for ${storageId}`);

                            if (selectedStorageMode === 'local' && currentHandle) {
                                const microBlob = base64ToBlob(microData);
                                await fileSystemService.saveThumbnailToHandle(currentHandle, storageId, microBlob);
                            }

                            const previewId = getQualityStorageId(storageId, ImageQuality.PREVIEW);
                            await saveImage(previewId, previewSource);
                        }
                    }
                } catch (e) {
                    console.error(`[CanvasContext] Failed to save ${node.id}`, e);
                }
            })());
        }

        // [Fix] Update the UI first so continuous sends stay responsive.
        console.log('[CanvasContext.addImageNodes] Updating UI immediately with nodes:', stateNodes.length);
        try {
            updateCanvas(c => {
                let nextPromptNodes = [...c.promptNodes];
                const existingImageIds = new Set(c.imageNodes.map(existing => existing.id));
                const appendedNodes = stateNodes.filter(node => !existingImageIds.has(node.id));

                const allZIndices = [
                    ...c.promptNodes.map(node => node.zIndex ?? 0),
                    ...c.imageNodes.map(node => node.zIndex ?? 0),
                    ...(c.groups || []).map(group => group.zIndex ?? 0)
                ];
                let maxZ = allZIndices.length > 0 ? Math.max(...allZIndices) : 0;
                const basePromptOrderById = new Map<string, number>();
                c.promptNodes.forEach(promptNode => {
                    basePromptOrderById.set(promptNode.id, promptNode.zIndex ?? 0);
                });
                c.imageNodes.forEach(imageNode => {
                    if (!imageNode.parentPromptId) return;
                    const currentOrder = basePromptOrderById.get(imageNode.parentPromptId) ?? 0;
                    basePromptOrderById.set(imageNode.parentPromptId, Math.max(currentOrder, imageNode.zIndex ?? 0));
                });

                // [Critical fix] Atomic linking: update parent nodes in the same state transaction.
                if (parentUpdates) {
                    nextPromptNodes = nextPromptNodes.map(pn => {
                        const updates = parentUpdates[pn.id];
                        if (updates) {
                            return { ...pn, ...updates };
                        }
                        return pn;
                    });
                } else {
                    // Backward compatibility: If no explicit updates, auto-link based on parentPromptId
                    const parentIds = Array.from(new Set(appendedNodes.map(n => n.parentPromptId).filter(Boolean)));
                    if (parentIds.length > 0) {
                        nextPromptNodes = nextPromptNodes.map(pn => {
                            if (parentIds.includes(pn.id)) {
                                const newChildIds = appendedNodes.filter(n => n.parentPromptId === pn.id).map(n => n.id);
                                return {
                                    ...pn,
                                    childImageIds: [...new Set([...(pn.childImageIds || []), ...newChildIds])],
                                    isGenerating: false
                                };
                            }
                            return pn;
                        });
                    }
                }

                const nextImageNodes = [
                    ...c.imageNodes,
                    ...appendedNodes.map(node => ({
                        ...node,
                        zIndex: node.parentPromptId
                            ? (basePromptOrderById.get(node.parentPromptId) ?? node.zIndex ?? 0)
                            : (node.zIndex ?? ++maxZ)
                    }))
                ];

                return {
                    ...c,
                    promptNodes: nextPromptNodes,
                    imageNodes: nextImageNodes
                };
            });
            console.log('[CanvasContext.addImageNodes] UI update completed, images are visible');
        } catch (uiError: any) {
            // Fatal UI error: the new images could not be rendered into state.
            console.error('[CanvasContext.addImageNodes] UI update failed!', uiError);
            notificationService.error('显示图片失败', '无法显示图片：' + (uiError?.message || '未知错误'));
            throw uiError;
        }

        // Run persistence tasks in the background without blocking the UI.
        console.log('[CanvasContext.addImageNodes] Starting background persistence tasks:', persistenceTasks.length);
        // Track the task globally so refresh does not drop in-flight saves.
        const savePromise = Promise.allSettled(persistenceTasks).then((results) => {
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            console.log('[CanvasContext.addImageNodes] Persistence completed:', successful, 'succeeded /', failed, 'failed /', results.length, 'total');

            if (failed > 0) {
                console.warn('[CanvasContext.addImageNodes] Some image persistence tasks failed; data may be missing after refresh');
                notificationService.warning('图片保存失败', failed + ' 张图片保存失败，建议重新保存或重试。');
            }
        }).catch(e => {
            console.error('[CanvasContext.addImageNodes] Persistence task failed:', e);
        });

        // Track this in-flight persistence task.
        pendingSavesRef.current.add(savePromise);
        savePromise.finally(() => {
            pendingSavesRef.current.delete(savePromise);
        });
    }, [updateCanvas]);

    const updatePromptNodePosition = useCallback((
        id: string,
        pos: { x: number; y: number },
        options?: { moveChildren?: boolean; ignoreSelection?: boolean }
    ) => {
        updateCanvas(c => {
            const node = c.promptNodes.find(n => n.id === id);
            if (!node) return c;

            const dx = pos.x - node.position.x;
            const dy = pos.y - node.position.y;
            const moveChildren = options?.moveChildren !== false;
            const ignoreSelection = options?.ignoreSelection === true;

            // GROUP MOVE LOGIC
            if (!ignoreSelection) {
                const selectedIds = new Set(state.selectedNodeIds || []);
                if (selectedIds.has(id)) {
                    const newPromptNodes = c.promptNodes.map(n => {
                        if (selectedIds.has(n.id)) {
                            return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
                        }
                        return n;
                    });

                    const movedPromptIds = new Set(c.promptNodes.filter(n => selectedIds.has(n.id)).map(n => n.id));
                    const newImageNodes = c.imageNodes.map(img => {
                        if (selectedIds.has(img.id) || (img.parentPromptId && movedPromptIds.has(img.parentPromptId))) {
                            return { ...img, position: { x: img.position.x + dx, y: img.position.y + dy } };
                        }
                        return img;
                    });

                    return { ...c, promptNodes: newPromptNodes, imageNodes: newImageNodes };
                }
            }

            if (!moveChildren) {
                return {
                    ...c,
                    promptNodes: c.promptNodes.map(n => n.id === id ? { ...n, position: pos } : n)
                };
            }

            // [MODIFIED] Removed repulsion logic as per user request
            // Freely update position without checking for overlap/pushing
            return {
                ...c,
                promptNodes: c.promptNodes.map(n => n.id === id ? { ...n, position: pos } : n),
                imageNodes: c.imageNodes.map((img) => (
                    img.parentPromptId === id
                        ? { ...img, position: { x: img.position.x + dx, y: img.position.y + dy } }
                        : img
                ))
            };
        });
    }, [updateCanvas, state.selectedNodeIds]);

    const updateImageNodePosition = useCallback((
        id: string,
        pos: { x: number; y: number },
        options?: { ignoreSelection?: boolean }
    ) => {
        updateCanvas(c => {
            const node = c.imageNodes.find(n => n.id === id);
            if (!node) return c;

            const dx = pos.x - node.position.x;
            const dy = pos.y - node.position.y;
            const ignoreSelection = options?.ignoreSelection === true;

            // GROUP MOVE LOGIC
            if (!ignoreSelection) {
                const selectedIds = new Set(state.selectedNodeIds || []);
                if (selectedIds.has(id)) {
                    // [MODIFIED] Removed repulsion hook

                    const newPromptNodes = c.promptNodes.map(n => {
                        if (selectedIds.has(n.id)) {
                            return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
                        }
                        return n;
                    });

                    const movedPromptIds = new Set(c.promptNodes.filter(n => selectedIds.has(n.id)).map(n => n.id));
                    const newImageNodes = c.imageNodes.map(img => {
                        if (selectedIds.has(img.id) || (img.parentPromptId && movedPromptIds.has(img.parentPromptId))) {
                            return { ...img, position: { x: img.position.x + dx, y: img.position.y + dy } };
                        }
                        return img;
                    });

                    return { ...c, promptNodes: newPromptNodes, imageNodes: newImageNodes };
                }
            }

            // SINGLE MOVE - Removed repulsion logic
            return {
                ...c,
                promptNodes: c.promptNodes, // No changes to prompt nodes
                imageNodes: c.imageNodes.map(img =>
                    img.id === id ? { ...img, position: pos } : img
                )
            };
        });
    }, [updateCanvas, state.selectedNodeIds]);

    const updateImageNodeDimensions = useCallback((id: string, dimensions: string) => {
        updateCanvas(c => ({
            ...c,
            imageNodes: c.imageNodes.map(img =>
                img.id === id ? { ...img, dimensions } : img
            )
        }));
    }, [updateCanvas]);

    const updateImageNode = useCallback((id: string, updates: Partial<GeneratedImage>) => {
        updateCanvas(c => ({
            ...c,
            imageNodes: c.imageNodes.map(img =>
                img.id === id ? { ...img, ...updates } : img
            )
        }));
    }, [updateCanvas]);

    // [Batch update] Support stacking and other large-move operations.
    const updateNodes = useCallback((batch: {
        promptNodes?: { id: string, updates: Partial<PromptNode> }[],
        imageNodes?: { id: string, updates: Partial<GeneratedImage> }[]
    }) => {
        updateCanvas(c => {
            let nextPromptNodes = [...c.promptNodes];
            let nextImageNodes = [...c.imageNodes];
            let changed = false;

            if (batch.promptNodes && batch.promptNodes.length > 0) {
                const updateMap = new Map(batch.promptNodes.map(u => [u.id, u.updates]));
                nextPromptNodes = nextPromptNodes.map(n => {
                    const u = updateMap.get(n.id);
                    if (u) {
                        changed = true;
                        return { ...n, ...u };
                    }
                    return n;
                });
            }

            if (batch.imageNodes && batch.imageNodes.length > 0) {
                const updateMap = new Map(batch.imageNodes.map(u => [u.id, u.updates]));
                nextImageNodes = nextImageNodes.map(img => {
                    const u = updateMap.get(img.id);
                    if (u) {
                        changed = true;
                        return { ...img, ...u };
                    }
                    return img;
                });
            }

            return changed ? { ...c, promptNodes: nextPromptNodes, imageNodes: nextImageNodes } : c;
        });
    }, [updateCanvas]);

    useEffect(() => {
        if (isLoading) return;

        let cancelled = false;

        const hydratePersistedImageSources = async () => {
            const persistedTasks = await getAllTasks();
            if (cancelled) return;

            const tasksByPromptId = new Map<string, PersistedTask[]>();
            persistedTasks.forEach((task) => {
                const promptNodeId = String(task.promptNodeId || '').trim();
                if (!promptNodeId) return;
                const nextTasks = tasksByPromptId.get(promptNodeId) || [];
                nextTasks.push(task);
                tasksByPromptId.set(promptNodeId, nextTasks);
            });

            const currentState = stateRef.current;
            const imageUpdates: Array<{ id: string; updates: Partial<GeneratedImage> }> = [];
            const cacheWrites: Array<{ storageId: string; url: string }> = [];
            const recoveredNodes: GeneratedImage[] = [];
            const parentUpdates: Record<string, Partial<PromptNode>> = {};
            const isMobileViewport = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

            for (const canvas of currentState.canvases) {
                const promptById = new Map((canvas.promptNodes || []).map((promptNode) => [promptNode.id, promptNode] as const));

                for (const imageNode of canvas.imageNodes || []) {
                    if (imageNode.url && imageNode.originalUrl) continue;

                    const parentPrompt = imageNode.parentPromptId ? promptById.get(imageNode.parentPromptId) : undefined;
                    const promptTasks = parentPrompt ? (tasksByPromptId.get(parentPrompt.id) || []) : [];
                    const recoveredUrl = await resolveImageRecoveryUrlFromMetadata(imageNode, parentPrompt, promptTasks);
                    if (!recoveredUrl) continue;

                    imageUpdates.push({
                        id: imageNode.id,
                        updates: {
                            url: imageNode.url || recoveredUrl,
                            originalUrl: imageNode.originalUrl || recoveredUrl,
                            apiResultUrl: imageNode.apiResultUrl || normalizePersistentResultUrl(recoveredUrl),
                        },
                    });
                    cacheWrites.push({
                        storageId: imageNode.storageId || imageNode.id,
                        url: recoveredUrl,
                    });
                }

                for (const promptNode of canvas.promptNodes || []) {
                    const promptTasks = tasksByPromptId.get(promptNode.id) || [];
                    const existingChildren = (canvas.imageNodes || []).filter((imageNode) => imageNode.parentPromptId === promptNode.id);
                    const seenResultKeys = new Set<string>();

                    existingChildren.forEach((imageNode) => {
                        const identity = buildImageResultIdentity(imageNode);
                        if (identity) {
                            seenResultKeys.add(identity);
                        }
                        const fallbackIdentity = buildTaskResultIdentity({
                            taskId: imageNode.sourceTaskId,
                            resultIndex: imageNode.sourceResultIndex,
                            url: normalizePersistentResultUrl(imageNode.apiResultUrl || imageNode.originalUrl || imageNode.url),
                        });
                        if (fallbackIdentity) {
                            seenResultKeys.add(fallbackIdentity);
                        }
                    });

                    const recoveryEntries = buildPromptRecoveryEntries(promptNode, promptTasks);
                    const missingEntries = recoveryEntries.filter((entry) => {
                        const identity = buildTaskResultIdentity({
                            taskId: entry.taskId,
                            resultIndex: entry.resultIndex,
                            url: entry.url,
                        });
                        if (!identity) return false;
                        if (seenResultKeys.has(identity)) return false;
                        seenResultKeys.add(identity);
                        return true;
                    });

                    if (!missingEntries.length) continue;

                    const resolvedMissingEntries = (
                        await Promise.all(missingEntries.map(async (entry) => {
                            const sourceUrl = await resolvePromptRecoveryEntrySource(entry);
                            if (!sourceUrl) return null;
                            return { entry, sourceUrl };
                        }))
                    ).filter((item): item is { entry: PromptRecoveryEntry; sourceUrl: string } => !!item);

                    if (!resolvedMissingEntries.length) continue;

                    const positions = buildGeneratedImageBatchPositions({
                        basePosition: promptNode.position,
                        items: resolvedMissingEntries.map(() => ({
                            aspectRatio: promptNode.aspectRatio,
                        })),
                        mode: promptNode.mode,
                        isMobile: isMobileViewport,
                    });

                    const nextRecoveredNodes = resolvedMissingEntries.map(({ entry, sourceUrl }, index) => {
                        const imageId = `${promptNode.id}_restored_${entry.taskId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${entry.resultIndex}`;
                        const position = positions[index] || {
                            x: promptNode.position.x,
                            y: promptNode.position.y + 80,
                        };

                        return {
                            id: imageId,
                            storageId: entry.storageId || imageId,
                            url: sourceUrl,
                            originalUrl: sourceUrl,
                            apiResultUrl: normalizePersistentResultUrl(entry.url),
                            prompt: promptNode.prompt,
                            aspectRatio: promptNode.aspectRatio,
                            imageSize: promptNode.imageSize,
                            timestamp: entry.completedAt || promptNode.timestamp || Date.now(),
                            model: entry.model || promptNode.model,
                            modelLabel: entry.modelLabel || promptNode.modelLabel,
                            modelColorStart: promptNode.modelColorStart,
                            modelColorEnd: promptNode.modelColorEnd,
                            modelColorSecondary: promptNode.modelColorSecondary,
                            modelTextColor: promptNode.modelTextColor,
                            canvasId: canvas.id,
                            parentPromptId: promptNode.id,
                            position,
                            mode: promptNode.mode,
                            provider: entry.provider || promptNode.provider,
                            providerLabel: entry.providerLabel || promptNode.providerLabel,
                            keySlotId: entry.keySlotId || promptNode.keySlotId,
                            sourceTaskId: entry.taskId,
                            sourceResultIndex: entry.resultIndex,
                            sourceReferenceStorageIds: (promptNode.referenceImages || []).map((ref) => ref.storageId || ref.id).filter(Boolean),
                            cost: entry.cost,
                            costSource: entry.costSource,
                            tokens: entry.tokens,
                        } satisfies GeneratedImage;
                    });

                    if (!nextRecoveredNodes.length) {
                        return;
                    }

                    recoveredNodes.push(...nextRecoveredNodes);
                    const nextChildImageIds = Array.from(new Set([
                        ...resolvePromptChildImageIds(promptNode, canvas.imageNodes || []),
                        ...nextRecoveredNodes.map((imageNode) => imageNode.id),
                    ]));
                    parentUpdates[promptNode.id] = {
                        ...promptNode,
                        childImageIds: nextChildImageIds,
                        lastGenerationSuccessCount: nextChildImageIds.length,
                        lastGenerationTotalCount: Math.max(
                            promptNode.lastGenerationTotalCount || 0,
                            recoveryEntries.length || nextChildImageIds.length || 1
                        ),
                        error: undefined,
                        errorDetails: undefined,
                    };
                }
            }

            if (cancelled) return;

            if (imageUpdates.length > 0) {
                updateNodes({ imageNodes: imageUpdates });
                cacheWrites.forEach(({ storageId, url }) => {
                    void saveOriginalImage(storageId, url).catch(() => undefined);
                });
            }

            if (recoveredNodes.length > 0) {
                await addImageNodes(recoveredNodes, parentUpdates);
            }
        };

        void hydratePersistedImageSources();

        return () => {
            cancelled = true;
        };
    }, [addImageNodes, isLoading, state.canvases, updateNodes]);

    const addWorkflowNode = useCallback((node: WorkflowNode) => {
        if (!isWorkflowUtilityNodeKind(node.kind)) {
            console.warn('[CanvasContext.addWorkflowNode] Legacy workflow nodes are derived from canvas data and should not be inserted directly.', node.kind);
            return;
        }

        pushToHistory();
        updateCanvas(c => {
            const workflow = canvasToWorkflow(c);
            const existingNode = workflow.nodes.find(existing => existing.id === node.id);
            if (existingNode) {
                return c;
            }

            return {
                ...c,
                workflow: {
                    ...workflow,
                    nodes: [...workflow.nodes, node],
                    edges: dedupeWorkflowEdges([
                        ...workflow.edges,
                        ...getWorkflowSourceNodeIds(node)
                            .filter(sourceId => workflow.nodes.some(existingNode => existingNode.id === sourceId))
                            .map(sourceId => ({
                                id: `edge:${sourceId}:control:${node.id}`,
                                from: sourceId,
                                to: node.id,
                                role: 'control' as const,
                            })),
                    ]),
                },
            };
        });
    }, [pushToHistory, updateCanvas]);

    const updateWorkflowNode = useCallback((id: string, updates: Partial<WorkflowNode>) => {
        updateCanvas(c => {
            const workflow = canvasToWorkflow(c);
            if (!workflow.nodes.length && !workflow.edges.length) return c;
            let changed = false;

            const nextNodes = workflow.nodes.map((node) => {
                if (node.id !== id) return node;
                changed = true;
                return {
                    ...node,
                    ...updates,
                    id: node.id,
                    kind: node.kind,
                } as WorkflowNode;
            });

            if (!changed) return c;

            const updatedNode = nextNodes.find(node => node.id === id);
            const validNodeIds = new Set(nextNodes.map(node => node.id));
            const nextEdges = dedupeWorkflowEdges([
                ...workflow.edges.filter((edge) => {
                    if (!validNodeIds.has(edge.from) || !validNodeIds.has(edge.to)) {
                        return false;
                    }

                    if (edge.to !== id) {
                        return true;
                    }

                    return edge.from === id;
                }),
                ...(updatedNode
                    ? getWorkflowSourceNodeIds(updatedNode)
                        .filter(sourceId => validNodeIds.has(sourceId))
                        .map(sourceId => ({
                            id: `edge:${sourceId}:control:${id}`,
                            from: sourceId,
                            to: id,
                            role: 'control' as const,
                        }))
                    : []),
            ]);

            return {
                ...c,
                workflow: {
                    ...workflow,
                    nodes: nextNodes,
                    edges: nextEdges,
                },
            };
        });
    }, [updateCanvas]);

    const updateWorkflowNodePosition = useCallback((id: string, pos: { x: number; y: number }) => {
        updateCanvas(c => {
            if (!c.workflow) return c;
            let changed = false;

            const nextNodes = c.workflow.nodes.map((node) => {
                if (node.id !== id) return node;
                changed = true;
                return {
                    ...node,
                    position: pos,
                };
            });

            if (!changed) return c;

            return {
                ...c,
                workflow: {
                    ...c.workflow,
                    nodes: nextNodes,
                },
            };
        });
    }, [updateCanvas]);

    const deleteWorkflowNode = useCallback((id: string) => {
        pushToHistory();
        updateCanvas(c => {
            const workflow = canvasToWorkflow(c);
            if (!workflow.nodes.length && !workflow.edges.length) return c;

            const nextNodes = workflow.nodes.filter((node) => node.id !== id);
            if (nextNodes.length === workflow.nodes.length) {
                return c;
            }

            const validNodeIds = new Set(nextNodes.map((node) => node.id));
            const nextEdges = workflow.edges.filter((edge) => (
                edge.from !== id
                && edge.to !== id
                && validNodeIds.has(edge.from)
                && validNodeIds.has(edge.to)
            ));

            return {
                ...c,
                workflow: {
                    ...workflow,
                    nodes: nextNodes,
                    edges: nextEdges,
                },
            };
        });
    }, [pushToHistory, updateCanvas]);


    const deleteImageNode = useCallback((id: string) => {
        pushToHistory();

        // Delete from IndexedDB (existing logic)
        deleteImage(id);

        // [Key fix] Ask storageAdapter to delete persisted disk and OPFS artifacts too.
        import('../services/storage/storageAdapter').then(({ deleteImage: deleteImageFromDisk }) => {
            deleteImageFromDisk({
                id: id,
                type: 'native', // Trigger native local disk check
                width: 0,
                height: 0,
                x: 0,
                y: 0
            });
        }).catch(e => console.error('Failed to invoke safe physical deletion', e));

        urgentSaveRef.current = true; // Force an immediate persistence flush after deletion.
        updateCanvas(c => {
            // Revoke Blob URL to free memory
            const node = c.imageNodes.find(n => n.id === id);
            if (node) {
                safeRevokeBlobUrl(node.url);
            }
            return {
                ...c,
                imageNodes: c.imageNodes.filter(n => n.id !== id),
                // Also update parent prompt node to remove from child list
                promptNodes: c.promptNodes.map(p => ({
                    ...p,
                    childImageIds: p.childImageIds.filter(cid => cid !== id),
                    // [Ref Fix] Also clear sourceImageId if this image was a source for a follow-up
                    sourceImageId: p.sourceImageId === id ? undefined : p.sourceImageId
                }))
            };
        });
    }, [updateCanvas]);

    const deletePromptNode = useCallback((id: string) => {
        pushToHistory();

        urgentSaveRef.current = true; // 鐖惰妭鐐瑰垹闄ゅ悗鍚屾瀛樼洏
        updateCanvas(c => {
            // [Strict Logic] Delete Main Card -> Sub-cards become Lonely Sub Cards (Orphaned)
            // DO NOT delete the images. Just clear their parentPromptId.

            const newImageNodes = c.imageNodes.map(img => {
                if (img.parentPromptId === id) {
                    return { ...img, parentPromptId: '' }; // Orphan it (empty string)
                }
                return img;
            });

            // Filter out the deleted prompt node
            const newPromptNodes = c.promptNodes.filter(n => n.id !== id);

            return {
                ...c,
                promptNodes: newPromptNodes,
                imageNodes: newImageNodes
            };
        });
    }, [updateCanvas, pushToHistory]);

    const linkNodes = useCallback((promptId: string, imageId: string) => {
        updateCanvas(c => {
            // Avoid duplicates
            const promptNode = c.promptNodes.find(p => p.id === promptId);
            if (!promptNode || promptNode.childImageIds.includes(imageId)) return c;

            return {
                ...c,
                promptNodes: c.promptNodes.map(p =>
                    p.id === promptId ? { ...p, childImageIds: [...p.childImageIds, imageId] } : p
                ),
                imageNodes: c.imageNodes.map(img =>
                    img.id === imageId ? { ...img, parentPromptId: promptId } : img
                )
            };
        });
    }, [updateCanvas]);

    const unlinkNodes = useCallback((promptId: string, imageId: string) => {
        updateCanvas(c => {
            return {
                ...c,
                promptNodes: c.promptNodes.map(p =>
                    p.id === promptId ? { ...p, childImageIds: p.childImageIds.filter(id => id !== imageId) } : p
                ),
                imageNodes: c.imageNodes.map(img =>
                    img.id === imageId ? { ...img, parentPromptId: '' } : img
                )
            };
        });
    }, [updateCanvas]);


    const undo = useCallback(() => {
        setState(prev => {
            const currentCanvas = prev.canvases.find(c => c.id === prev.activeCanvasId);
            const historyEntry = prev.history[prev.activeCanvasId];

            if (!currentCanvas || !historyEntry || historyEntry.past.length === 0) return prev;

            const previousState = historyEntry.past[historyEntry.past.length - 1];
            const newPast = historyEntry.past.slice(0, -1);

            return {
                ...prev,
                canvases: prev.canvases.map(c =>
                    c.id === prev.activeCanvasId ? { ...previousState, lastModified: Date.now() } : c
                ),
                history: {
                    ...prev.history,
                    [prev.activeCanvasId]: {
                        past: newPast,
                        future: [currentCanvas, ...historyEntry.future]
                    }
                }
            };
        });
    }, []);

    const redo = useCallback(() => {
        setState(prev => {
            const currentCanvas = prev.canvases.find(c => c.id === prev.activeCanvasId);
            const historyEntry = prev.history[prev.activeCanvasId];

            if (!currentCanvas || !historyEntry || historyEntry.future.length === 0) return prev;

            const nextState = historyEntry.future[0];
            const newFuture = historyEntry.future.slice(1);

            return {
                ...prev,
                canvases: prev.canvases.map(c =>
                    c.id === prev.activeCanvasId ? { ...nextState, lastModified: Date.now() } : c
                ),
                history: {
                    ...prev.history,
                    [prev.activeCanvasId]: {
                        past: [...historyEntry.past, currentCanvas],
                        future: newFuture
                    }
                }
            };
        });
    }, []);

    const canUndo = (state.history[state.activeCanvasId]?.past.length || 0) > 0;
    const canRedo = (state.history[state.activeCanvasId]?.future.length || 0) > 0;

    const clearAllData = useCallback(() => {
        // [Optimization] Revoke all Blob URLs to free memory
        state.canvases.forEach(c => {
            c.imageNodes.forEach(img => {
                safeRevokeBlobUrl(img.url);
            });
        });

        // Clear localStorage
        localStorage.removeItem(STORAGE_KEY);
        // Clear IndexedDB images
        clearAllImages();
        // Reset to default state
        setState({
            canvases: [DEFAULT_CANVAS],
            activeCanvasId: DEFAULT_CANVAS.id,
            history: {},
            fileSystemHandle: null,
            folderName: null,
            selectedNodeIds: [],
            subCardLayoutMode: 'row',
            viewportCenter: { x: 0, y: 0 }
        });
    }, [state.canvases]);

    /**
     * Arrange all nodes: Group by project (prompt + child images)
     * - Each project: prompt on top, images below (vertical)
     * - Projects arranged left-to-right (horizontal)
     * - No overlapping
     */
    const arrangeAllNodes = useCallback((mode: ArrangeMode = 'grid') => {
        pushToHistory(); // Allow undo

        // --- Configuration ---
        const PROMPT_WIDTH = 320;
        const PROMPT_HEIGHT = 160; // Base height, dynamic in reality but fixed for grid slot
        const GAP_X = 100;  // Larger horizontal gap to prevent overlap.
        const GAP_Y = 120;  // Larger vertical gap to prevent overlap.
        const IMAGE_GAP = 40; // Larger gap between images.
        const AUTO_ARRANGE_GROUPS_PER_ROW = 20; // Wrap after a fixed 20 groups per row.
        const AUTO_ARRANGE_SUB_COLUMNS = 20; // Keep sub-cards laid out horizontally when possible.
        const AUTO_ARRANGE_GROUP_GAP_X = 56; // Extra horizontal spacing between auto-arranged groups.
        const AUTO_ARRANGE_GROUP_GAP_Y = 120; // Extra vertical spacing between auto-arranged group rows.
        const AUTO_ARRANGE_SUB_IMAGE_GAP = 32; // Additional spacing between sub-cards.
        const AUTO_ARRANGE_PROMPT_TO_SUB_GAP = 56; // Larger gap between the prompt card and its sub-cards.

        // --- Helper: Get dimensions ---
        const getImageDims = (aspectRatio?: string, dimensions?: string) => {
            // Using EXACT components dimensions to ensure perfect top alignment CSS logic
            const { width, totalHeight } = getCardDimensions(aspectRatio as AspectRatio, true);
            return { w: width, h: totalHeight };
        };

        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        if (!currentCanvas) return;

        // --- SCOPED ARRANGE: Selected Nodes Only (Smart Layout) ---
        const initialSelectedIds = state.selectedNodeIds || [];

        // [NEW] Expand Group Selection: If a group is selected, arrange its children
        let selectedIds = [...initialSelectedIds];
        const groups = currentCanvas.groups || [];
        const selectedGroups = groups.filter(g => initialSelectedIds.includes(g.id));

        if (selectedGroups.length > 0) {
            selectedGroups.forEach(g => {
                if (g.nodeIds && g.nodeIds.length > 0) {
                    selectedIds.push(...g.nodeIds);
                }
            });
            // Deduplicate and remove Group IDs (they are not actual node IDs)
            const groupIdSet = new Set(groups.map(g => g.id));
            selectedIds = Array.from(new Set(selectedIds)).filter(id => !groupIdSet.has(id));
        }

        if (selectedIds.length > 0) {
            {
                // 1. Analyze Selection Composition
                const selectedPrompts = currentCanvas.promptNodes.filter(p => selectedIds.includes(p.id));
                const selectedImages = currentCanvas.imageNodes.filter(img => selectedIds.includes(img.id));

                const isPromptOnly = selectedPrompts.length > 0 && selectedImages.length === 0;
                const isImageOnly = selectedPrompts.length === 0 && selectedImages.length > 0;

                // [New] When only a prompt is selected, rotate its child-card layout mode.
                if (isPromptOnly && selectedPrompts.length === 1) {
                    const prompt = selectedPrompts[0];
                    const childImages = currentCanvas.imageNodes.filter(img => img.parentPromptId === prompt.id);

                    if (childImages.length > 0) {
                        const targetMode: SubCardLayout = prompt.mode === GenerationMode.PPT ? 'column' : mode;
                        const SUB_GAP = AUTO_ARRANGE_SUB_IMAGE_GAP;
                        const PROMPT_TO_SUB_GAP = AUTO_ARRANGE_PROMPT_TO_SUB_GAP;

                        // Compute child-card bounds.
                        const imageDims = childImages.map(img => getImageDims(img.aspectRatio, img.dimensions));
                        const avgWidth = imageDims.reduce((sum, d) => sum + d.w, 0) / imageDims.length;
                        const avgHeight = imageDims.reduce((sum, d) => sum + d.h, 0) / imageDims.length;

                        const newImagePositions: Record<string, { x: number, y: number }> = {};
                        const promptCenterX = prompt.position.x;
                        const promptBottom = prompt.position.y;

                        if (targetMode === 'row') {
                            // Horizontal layout: arrange child cards in a single centered row.
                            const totalWidth = childImages.length * avgWidth + (childImages.length - 1) * SUB_GAP;
                            let currentX = promptCenterX - totalWidth / 2 + avgWidth / 2;
                            const y = promptBottom + PROMPT_TO_SUB_GAP + avgHeight;

                            childImages.forEach((img, i) => {
                                const dims = imageDims[i];
                                newImagePositions[img.id] = { x: currentX, y };
                                currentX += dims.w + SUB_GAP;
                            });
                        } else if (targetMode === 'grid') {
                            // Grid layout: use a 4-column grid with centered alignment.
                            const columns = Math.min(AUTO_ARRANGE_SUB_COLUMNS, childImages.length);
                            const rows = Math.ceil(childImages.length / columns);
                            const totalWidth = columns * avgWidth + (columns - 1) * SUB_GAP;
                            const startX = promptCenterX - totalWidth / 2 + avgWidth / 2;
                            const startY = promptBottom + PROMPT_TO_SUB_GAP + avgHeight;

                            childImages.forEach((img, i) => {
                                const col = i % columns;
                                const row = Math.floor(i / columns);
                                newImagePositions[img.id] = {
                                    x: startX + col * (avgWidth + SUB_GAP),
                                    y: startY + row * (avgHeight + SUB_GAP)
                                };
                            });
                        } else {
                            // Vertical layout: stack child cards in one centered column.
                            let currentY = promptBottom + PROMPT_TO_SUB_GAP + avgHeight;

                            childImages.forEach((img, i) => {
                                const dims = imageDims[i];
                                newImagePositions[img.id] = { x: promptCenterX, y: currentY };
                                currentY += dims.h + SUB_GAP;
                            });
                        }

                        // Rotate to the next layout mode.

                        // Apply the position changes.
                        const newCanvases = state.canvases.map(c => {
                            if (c.id !== state.activeCanvasId) return c;
                            return {
                                ...c,
                                imageNodes: c.imageNodes.map(img =>
                                    newImagePositions[img.id] ? { ...img, position: newImagePositions[img.id] } : img
                                ),
                                lastModified: Date.now()
                            };
                        });

                        setState(prev => ({ ...prev, canvases: newCanvases, subCardLayoutMode: targetMode }));
                        return;
                    }
                }

                // 2. Identify Roots & Sync Mode
                let roots: any[] = [];
                let syncChildren = false;

                if (isPromptOnly) {
                    // [Mode A] Prompt only: also sync child cards so the whole group arranges together.
                    roots = selectedPrompts.map(p => ({
                        id: p.id, type: 'prompt', obj: p,
                        x: p.position.x, y: p.position.y,
                        width: PROMPT_WIDTH, height: p.height || 200,
                        visualCx: p.position.x, visualCy: p.position.y - (p.height || 200) / 2
                    }));
                    syncChildren = true; // Enable child-card sync so sub-cards follow the prompt during moves.
                }
                else if (isImageOnly) {
                    // [MODE B] Image Only: Sort Images independent of parents
                    roots = selectedImages.map(img => {
                        const dims = getImageDims(img.aspectRatio, img.dimensions);
                        return {
                            id: img.id, type: 'image', obj: img,
                            x: img.position.x, y: img.position.y,
                            width: dims.w, height: dims.h,
                            visualCx: img.position.x, visualCy: img.position.y - dims.h / 2
                        };
                    });
                    syncChildren = false;
                }
                else {
                    // [MODE C] Mixed/Group: Use Group Logic
                    syncChildren = true;
                    const uniqueRootsMap = new Map<string, { id: string, type: 'prompt' | 'image', obj: any }>();
                    const getPrompt = (id: string) => currentCanvas.promptNodes.find(p => p.id === id);
                    const getImage = (id: string) => currentCanvas.imageNodes.find(img => img.id === id);

                    selectedIds.forEach(id => {
                        const p = getPrompt(id);
                        if (p) {
                            uniqueRootsMap.set(p.id, { id: p.id, type: 'prompt', obj: p });
                            return;
                        }
                        const img = getImage(id);
                        if (img) {
                            if (img.parentPromptId) {
                                const parent = getPrompt(img.parentPromptId);
                                if (parent) uniqueRootsMap.set(parent.id, { id: parent.id, type: 'prompt', obj: parent });
                                else uniqueRootsMap.set(img.id, { id: img.id, type: 'image', obj: img });
                            } else {
                                uniqueRootsMap.set(img.id, { id: img.id, type: 'image', obj: img });
                            }
                        }
                    });

                    roots = Array.from(uniqueRootsMap.values()).map(r => {
                        const node = r.obj;
                        let width, height;

                        if (r.type === 'prompt') {
                            // [Fix] Calculate the bounding box of the prompt and all children.
                            const children = currentCanvas.imageNodes.filter(img => img.parentPromptId === node.id);

                            // 1. Initial Bounds (Prompt itself) - Anchor: Bottom Center
                            const pH = node.height || 200;
                            let minTop = node.position.y - pH;
                            let maxBottom = node.position.y;
                            let minLeft = node.position.x - PROMPT_WIDTH / 2;
                            let maxRight = node.position.x + PROMPT_WIDTH / 2;

                            // 2. Expand with Children
                            children.forEach(child => {
                                const dims = getImageDims(child.aspectRatio, child.dimensions);
                                // Anchor: Bottom Center (Assuming consistent system)
                                const cTop = child.position.y - dims.h;
                                const cBottom = child.position.y;
                                const cLeft = child.position.x - dims.w / 2;
                                const cRight = child.position.x + dims.w / 2;

                                if (cTop < minTop) minTop = cTop;
                                if (cBottom > maxBottom) maxBottom = cBottom;
                                if (cLeft < minLeft) minLeft = cLeft;
                                if (cRight > maxRight) maxRight = cRight;
                            });

                            width = maxRight - minLeft;
                            height = maxBottom - minTop;
                        } else {
                            const dims = getImageDims(node.aspectRatio, node.dimensions);
                            width = dims.w;
                            height = dims.h;
                        }

                        return {
                            ...r,
                            x: node.position.x, y: node.position.y,
                            width, height,
                            visualCx: node.position.x, visualCy: node.position.y - height / 2,
                        };
                    });
                }

                if (roots.length >= 2) {
                    // 2. Use the requested mode to choose the layout strategy.
                    const strategy: 'matrix' | 'row' | 'column' = mode === 'grid' ? 'matrix' : mode;
                    const GAP = 120; // Larger gap between groups (was 80).
                    const GRID_COLUMNS = 6; // Grid mode uses 6 fixed columns.

                    // 3. Arrange
                    const newPositions: Record<string, { x: number, y: number }> = {};

                    if (strategy === 'matrix') {
                        // Grid Sort: Rough Row-Major
                        roots.sort((a, b) => {
                            if (Math.abs(a.visualCy - b.visualCy) > 200) return a.visualCy - b.visualCy;
                            return a.visualCx - b.visualCx;
                        });

                        // Use a fixed 6-column grid.
                        const columns = GRID_COLUMNS;
                        // Center around average center
                        const avgX = roots.reduce((s, r) => s + r.x, 0) / roots.length;
                        const avgY = roots.reduce((s, r) => s + r.y, 0) / roots.length;

                        // Calculate grid total size
                        const maxW = Math.max(...roots.map(r => r.width));
                        const maxH = Math.max(...roots.map(r => r.height));
                        const CELL_W = maxW + GAP;
                        const CELL_H = maxH + GAP;

                        const gridW = columns * CELL_W;
                        const rows = Math.ceil(roots.length / columns);
                        const gridH = rows * CELL_H;

                        const startX = avgX - gridW / 2 + CELL_W / 2; // + Half cell because anchor is center
                        const startY = avgY - gridH / 2 + CELL_H; // + Full cell H because anchor is bottom

                        roots.forEach((r, i) => {
                            const col = i % columns;
                            const row = Math.floor(i / columns);
                            newPositions[r.id] = {
                                x: startX + col * CELL_W,
                                y: startY + row * CELL_H
                            };
                        });

                    } else if (strategy === 'column') {
                        // Sort Top->Bottom
                        roots.sort((a, b) => a.visualCy - b.visualCy);
                        const avgX = roots.reduce((s, r) => s + r.x, 0) / roots.length;

                        // Start Y = Top-most Top + First Height
                        const topY = Math.min(...roots.map(r => r.visualCy - r.height / 2));
                        let currentY = topY;

                        roots.forEach((r) => {
                            currentY += r.height; // Bottom Anchor
                            newPositions[r.id] = { x: avgX, y: currentY };
                            currentY += GAP;
                        });

                    } else {
                        // Row (Default) - Sort Left->Right
                        roots.sort((a, b) => a.visualCx - b.visualCx);
                        // Align Centers Vertically
                        const avgCy = roots.reduce((s, r) => s + r.visualCy, 0) / roots.length;

                        let currentLeft = Math.min(...roots.map(r => r.visualCx - r.width / 2));

                        roots.forEach((r) => {
                            const newX = currentLeft + r.width / 2;
                            newPositions[r.id] = { x: newX, y: avgCy + r.height / 2 };
                            currentLeft += r.width + GAP;
                        });
                    }

                    // 4. Apply & Sync Children
                    const newCanvases = state.canvases.map(c => {
                        if (c.id !== state.activeCanvasId) return c;

                        const getRootDelta = (rid: string) => {
                            const target = newPositions[rid];
                            const original = roots.find(r => r.id === rid);
                            if (!target || !original) return { x: 0, y: 0 };
                            return { x: target.x - original.x, y: target.y - original.y };
                        };

                        return {
                            ...c,
                            promptNodes: c.promptNodes.map(pn => newPositions[pn.id] ? { ...pn, position: newPositions[pn.id] } : pn),
                            imageNodes: c.imageNodes.map(img => {
                                // If it's a Root
                                if (newPositions[img.id]) return { ...img, position: newPositions[img.id] };
                                // If it's a Child of a Root (Only if Sync Enabled)
                                if (syncChildren && img.parentPromptId && newPositions[img.parentPromptId]) {
                                    const delta = getRootDelta(img.parentPromptId);
                                    return { ...img, position: { x: img.position.x + delta.x, y: img.position.y + delta.y } };
                                }
                                return img;
                            }),
                            lastModified: Date.now()
                        };
                    });

                    setState(prev => ({ ...prev, canvases: newCanvases }));
                    return;
                }
            }

            // Filter selected nodes
            const selectedPrompts = currentCanvas.promptNodes.filter(p => selectedIds.includes(p.id));
            const selectedImages = currentCanvas.imageNodes.filter(img => selectedIds.includes(img.id));
            const selectedCount = selectedPrompts.length + selectedImages.length;

            if (selectedCount > 1) {
                {
                    const selectionSubColumns = AUTO_ARRANGE_SUB_COLUMNS;
                    const selectionSubImageGap = AUTO_ARRANGE_SUB_IMAGE_GAP;
                    const selectionPromptToSubGap = AUTO_ARRANGE_PROMPT_TO_SUB_GAP;
                    const selectionGroupGapX = AUTO_ARRANGE_GROUP_GAP_X;
                    const selectionGroupGapY = AUTO_ARRANGE_GROUP_GAP_Y;

                    type SelectedGroup = {
                        prompt?: typeof selectedPrompts[0];
                        images: typeof selectedImages;
                        originalX: number;
                        originalY: number;
                    };
                    type SelectedImagePlacement = {
                        id: string;
                        xOffset: number;
                        bottomOffset: number;
                    };
                    type SelectedGroupLayout = {
                        promptHeight: number;
                        width: number;
                        height: number;
                        imageLayoutHeight: number;
                        imagePlacements: SelectedImagePlacement[];
                    };
                    type PositionedSelectedGroup = SelectedGroup & { layout: SelectedGroupLayout };

                    const buildSelectionImageLayout = (
                        images: typeof selectedImages,
                        layoutMode: SubCardLayout
                    ): { width: number; height: number; placements: SelectedImagePlacement[] } => {
                        if (images.length === 0) {
                            return { width: 0, height: 0, placements: [] };
                        }

                        const imageDims = images.map(img => getImageDims(img.aspectRatio, img.dimensions));

                        if (layoutMode === 'column') {
                            const maxWidth = Math.max(...imageDims.map(d => d.w));
                            const totalHeight = imageDims.reduce((sum, d) => sum + d.h, 0) + (imageDims.length - 1) * selectionSubImageGap;
                            let currentTop = 0;
                            const placements = images.map((img, index) => {
                                const dims = imageDims[index];
                                const placement = {
                                    id: img.id,
                                    xOffset: 0,
                                    bottomOffset: currentTop + dims.h
                                };
                                currentTop += dims.h + selectionSubImageGap;
                                return placement;
                            });
                            return { width: maxWidth, height: totalHeight, placements };
                        }

                        if (layoutMode === 'row') {
                            const totalWidth = imageDims.reduce((sum, d) => sum + d.w, 0) + (imageDims.length - 1) * selectionSubImageGap;
                            const maxHeight = Math.max(...imageDims.map(d => d.h));
                            let currentLeft = -totalWidth / 2;
                            const placements = images.map((img, index) => {
                                const dims = imageDims[index];
                                const placement = {
                                    id: img.id,
                                    xOffset: currentLeft + dims.w / 2,
                                    bottomOffset: dims.h
                                };
                                currentLeft += dims.w + selectionSubImageGap;
                                return placement;
                            });
                            return { width: totalWidth, height: maxHeight, placements };
                        }

                        const maxWidth = Math.max(...imageDims.map(d => d.w));
                        const maxHeight = Math.max(...imageDims.map(d => d.h));
                        const columns = Math.min(selectionSubColumns, imageDims.length);
                        const totalWidth = columns * maxWidth + (columns - 1) * selectionSubImageGap;
                        const totalHeight = Math.ceil(imageDims.length / columns) * maxHeight + (Math.ceil(imageDims.length / columns) - 1) * selectionSubImageGap;
                        const startOffsetX = -totalWidth / 2;
                        const placements = images.map((img, index) => {
                            const dims = imageDims[index];
                            const col = index % columns;
                            const row = Math.floor(index / columns);
                            return {
                                id: img.id,
                                xOffset: startOffsetX + col * (maxWidth + selectionSubImageGap) + maxWidth / 2,
                                bottomOffset: row * (maxHeight + selectionSubImageGap) + dims.h
                            };
                        });

                        return { width: totalWidth, height: totalHeight, placements };
                    };

                    const selectedGroupsForArrange: SelectedGroup[] = [];
                    const groupedImageIds = new Set<string>();

                    selectedPrompts.forEach(prompt => {
                        const childImages = currentCanvas.imageNodes.filter(img => img.parentPromptId === prompt.id);
                        childImages.forEach(img => groupedImageIds.add(img.id));
                        selectedGroupsForArrange.push({
                            prompt,
                            images: childImages,
                            originalX: prompt.position.x,
                            originalY: prompt.position.y
                        });
                    });

                    selectedImages
                        .filter(img => !groupedImageIds.has(img.id))
                        .forEach(img => {
                            selectedGroupsForArrange.push({
                                images: [img],
                                originalX: img.position.x,
                                originalY: img.position.y
                            });
                        });

                    if (selectedGroupsForArrange.length > 0) {
                        selectedGroupsForArrange.sort((a, b) => {
                            const rowDiff = Math.floor(a.originalY / 200) - Math.floor(b.originalY / 200);
                            if (rowDiff !== 0) return rowDiff;
                            return a.originalX - b.originalX;
                        });

                        const selectionCenterX = selectedGroupsForArrange.reduce((sum, group) => sum + group.originalX, 0) / selectedGroupsForArrange.length;
                        const selectionCenterY = selectedGroupsForArrange.reduce((sum, group) => sum + group.originalY, 0) / selectedGroupsForArrange.length;

                        const positionedSelectionGroups: PositionedSelectedGroup[] = selectedGroupsForArrange.map(group => {
                            const layoutMode: SubCardLayout = group.prompt?.mode === GenerationMode.PPT ? 'column' : mode;
                            const imageLayout = buildSelectionImageLayout(group.images, layoutMode);
                            const promptHeight = group.prompt?.height || 0;
                            const width = group.prompt ? Math.max(PROMPT_WIDTH, imageLayout.width) : imageLayout.width;
                            const height = group.prompt
                                ? promptHeight + (imageLayout.height > 0 ? selectionPromptToSubGap + imageLayout.height : 0)
                                : imageLayout.height;

                            return {
                                ...group,
                                layout: {
                                    promptHeight,
                                    width,
                                    height,
                                    imageLayoutHeight: imageLayout.height,
                                    imagePlacements: imageLayout.placements
                                }
                            };
                        });

                        const selectionStrategy: 'matrix' | 'row' | 'column' = mode === 'grid' ? 'matrix' : mode;
                        const selectionRows: Array<{ groups: PositionedSelectedGroup[]; maxPromptHeight: number; maxTotalHeight: number; rowWidth: number }> = [];
                        const createSelectionRow = () => ({ groups: [] as PositionedSelectedGroup[], maxPromptHeight: 0, maxTotalHeight: 0, rowWidth: 0 });
                        const pushGroupIntoRow = (
                            row: { groups: PositionedSelectedGroup[]; maxPromptHeight: number; maxTotalHeight: number; rowWidth: number },
                            group: PositionedSelectedGroup
                        ) => {
                            row.rowWidth += (row.groups.length > 0 ? selectionGroupGapX : 0) + group.layout.width;
                            row.groups.push(group);
                            row.maxPromptHeight = Math.max(row.maxPromptHeight, group.layout.promptHeight);
                            row.maxTotalHeight = Math.max(
                                row.maxTotalHeight,
                                group.prompt
                                    ? row.maxPromptHeight + (group.layout.imageLayoutHeight > 0 ? selectionPromptToSubGap + group.layout.imageLayoutHeight : 0)
                                    : group.layout.height
                            );
                        };

                        if (selectionStrategy === 'row') {
                            const row = createSelectionRow();
                            positionedSelectionGroups.forEach(group => pushGroupIntoRow(row, group));
                            if (row.groups.length > 0) selectionRows.push(row);
                        } else if (selectionStrategy === 'column') {
                            positionedSelectionGroups.forEach(group => {
                                const row = createSelectionRow();
                                pushGroupIntoRow(row, group);
                                selectionRows.push(row);
                            });
                        } else {
                            const gridColumns = Math.min(AUTO_ARRANGE_GROUPS_PER_ROW, Math.max(1, positionedSelectionGroups.length));
                            let currentSelectionRow = createSelectionRow();
                            positionedSelectionGroups.forEach(group => {
                                if (currentSelectionRow.groups.length >= gridColumns) {
                                    selectionRows.push(currentSelectionRow);
                                    currentSelectionRow = createSelectionRow();
                                }
                                pushGroupIntoRow(currentSelectionRow, group);
                            });
                            if (currentSelectionRow.groups.length > 0) selectionRows.push(currentSelectionRow);
                        }

                        const totalSelectionHeight = selectionRows.reduce((sum, row) => sum + row.maxTotalHeight, 0) + (selectionRows.length - 1) * selectionGroupGapY;
                        let currentTopY = selectionCenterY - totalSelectionHeight / 2;
                        const arrangedPositions: Record<string, { x: number; y: number }> = {};

                        selectionRows.forEach(row => {
                            let currentLeftX = selectionCenterX - row.rowWidth / 2;
                            const rowTopY = currentTopY;
                            const rowSubCardsTopY = rowTopY + row.maxPromptHeight + selectionPromptToSubGap;

                            row.groups.forEach(group => {
                                const groupCenterX = currentLeftX + group.layout.width / 2;

                                if (group.prompt) {
                                    arrangedPositions[group.prompt.id] = {
                                        x: groupCenterX,
                                        y: rowTopY + group.layout.promptHeight
                                    };
                                }

                                const imageTopY = group.prompt ? rowSubCardsTopY : rowTopY;
                                group.layout.imagePlacements.forEach(placement => {
                                    arrangedPositions[placement.id] = {
                                        x: groupCenterX + placement.xOffset,
                                        y: imageTopY + placement.bottomOffset
                                    };
                                });

                                currentLeftX += group.layout.width + selectionGroupGapX;
                            });

                            currentTopY += row.maxTotalHeight + selectionGroupGapY;
                        });

                        const arrangedCanvases = state.canvases.map(canvas => {
                            if (canvas.id !== state.activeCanvasId) return canvas;
                            return {
                                ...canvas,
                                promptNodes: canvas.promptNodes.map(prompt =>
                                    arrangedPositions[prompt.id] ? { ...prompt, position: arrangedPositions[prompt.id] } : prompt
                                ),
                                imageNodes: canvas.imageNodes.map(image =>
                                    arrangedPositions[image.id] ? { ...image, position: arrangedPositions[image.id] } : image
                                ),
                                lastModified: Date.now()
                            };
                        });

                        setState(prev => ({ ...prev, canvases: arrangedCanvases, subCardLayoutMode: mode }));
                        return;
                    }
                }
                // Selection arrange: process the selection as card groups and keep nearby/top-aligned layouts stable.

                // 1. Build the selected group list, similar to the global arrange flow.
                const SUB_COLUMNS = AUTO_ARRANGE_SUB_COLUMNS; // Default horizontal sub-card columns.
                const SUB_IMAGE_GAP = AUTO_ARRANGE_SUB_IMAGE_GAP;
                const PROMPT_TO_SUB_GAP = AUTO_ARRANGE_PROMPT_TO_SUB_GAP;
                const GROUP_GAP_X = AUTO_ARRANGE_GROUP_GAP_X;
                const GROUP_GAP_Y = AUTO_ARRANGE_GROUP_GAP_Y;

                type SelectionGroup = {
                    prompt?: typeof selectedPrompts[0];
                    images: typeof selectedImages;
                    width: number;
                    height: number;
                    originalX: number;
                    originalY: number;
                };

                const groups: SelectionGroup[] = [];
                const processedImageIds = new Set<string>();

                // 2a. Process selected prompt cards together with their child image cards.
                selectedPrompts.forEach(prompt => {
                    const childImages = currentCanvas.imageNodes.filter(img => img.parentPromptId === prompt.id);
                    const promptHeight = prompt.height || 200;

                    let maxSubWidth = 0;
                    let maxSubHeight = 0;
                    childImages.forEach(img => {
                        const dims = getImageDims(img.aspectRatio, img.dimensions);
                        maxSubWidth = Math.max(maxSubWidth, dims.w);
                        maxSubHeight = Math.max(maxSubHeight, dims.h);
                        processedImageIds.add(img.id);
                    });

                    const actualColumns = Math.min(SUB_COLUMNS, childImages.length);
                    const rows = Math.ceil(childImages.length / SUB_COLUMNS);
                    const subBlockWidth = actualColumns > 0 ? actualColumns * maxSubWidth + (actualColumns - 1) * SUB_IMAGE_GAP : 0;
                    const subBlockHeight = rows > 0 ? rows * maxSubHeight + (rows - 1) * SUB_IMAGE_GAP : 0;

                    const groupWidth = Math.max(PROMPT_WIDTH, subBlockWidth);
                    const groupHeight = promptHeight + (childImages.length > 0 ? PROMPT_TO_SUB_GAP + subBlockHeight : 0);

                    groups.push({
                        prompt,
                        images: childImages,
                        width: groupWidth,
                        height: groupHeight,
                        originalX: prompt.position.x,
                        originalY: prompt.position.y
                    });
                });

                // 2b. Process selected standalone image cards without a parent prompt.
                selectedImages.filter(img => !processedImageIds.has(img.id)).forEach(img => {
                    const dims = getImageDims(img.aspectRatio, img.dimensions);
                    groups.push({
                        images: [img],
                        width: dims.w,
                        height: dims.h + 200 + PROMPT_TO_SUB_GAP, // Reserve prompt height for standalone images.
                        originalX: img.position.x,
                        originalY: img.position.y
                    });
                });

                if (groups.length === 0) return;

                // 3. Sort by original position to preserve spatial proximity.
                groups.sort((a, b) => {
                    const rowDiff = Math.floor(a.originalY / 200) - Math.floor(b.originalY / 200);
                    if (rowDiff !== 0) return rowDiff;
                    return a.originalX - b.originalX;
                });

                // 4. Compute the center of the selected area.
                const centerX = groups.reduce((sum, g) => sum + g.originalX, 0) / groups.length;
                const centerY = groups.reduce((sum, g) => sum + g.originalY, 0) / groups.length;

                // 5. Two-pass layout: assign rows first, then set final positions.
                const gridColumns = Math.min(AUTO_ARRANGE_GROUPS_PER_ROW, Math.max(1, groups.length));
                const layoutRows: Array<{ groups: SelectionGroup[]; maxPromptHeight: number; maxTotalHeight: number }> = [];
                let currentRow: typeof layoutRows[0] = { groups: [], maxPromptHeight: 0, maxTotalHeight: 0 };
                groups.forEach((group) => {
                    if (currentRow.groups.length >= gridColumns) {
                        layoutRows.push(currentRow);
                        currentRow = { groups: [], maxPromptHeight: 0, maxTotalHeight: 0 };
                    }
                    currentRow.groups.push(group);
                    const promptHeight = group.prompt?.height || 200;
                    currentRow.maxPromptHeight = Math.max(currentRow.maxPromptHeight, promptHeight);
                    currentRow.maxTotalHeight = Math.max(currentRow.maxTotalHeight, group.height);
                });
                if (currentRow.groups.length > 0) layoutRows.push(currentRow);

                // 6. Compute overall bounds and start layout from the center.
                const maxGroupWidth = Math.max(...groups.map(g => g.width));
                const totalLayoutWidth = gridColumns * maxGroupWidth + (gridColumns - 1) * GROUP_GAP_X;
                const totalLayoutHeight = layoutRows.reduce((sum, r) => sum + r.maxTotalHeight, 0) + (layoutRows.length - 1) * GROUP_GAP_Y;
                const startX = centerX - totalLayoutWidth / 2;
                let startY = centerY - totalLayoutHeight / 2;

                const newPositions: Record<string, { x: number; y: number }> = {};
                const movedPrompts = new Set<string>();

                // 7. Apply positions with top-aligned sub-cards.
                layoutRows.forEach(layoutRow => {
                    let rowX = startX;
                    const rowMaxPromptHeight = layoutRow.maxPromptHeight;
                    const subCardsStartY = startY + rowMaxPromptHeight + PROMPT_TO_SUB_GAP;

                    layoutRow.groups.forEach(group => {
                        // [Fix] Use the current group's actual width when calculating its center.
                        const groupCenterX = rowX + group.width / 2;

                        if (group.prompt) {
                            const promptHeight = group.prompt.height || 200;
                            newPositions[group.prompt.id] = {
                                x: groupCenterX,
                                y: startY + promptHeight // Keep prompt tops aligned at startY.
                            };
                            movedPrompts.add(group.prompt.id);

                            // Sub-card positions.
                            if (group.images.length > 0) {
                                const imageDims = group.images.map(img => getImageDims(img.aspectRatio, img.dimensions));
                                const maxWidth = Math.max(...imageDims.map(d => d.w));
                                const maxHeight = Math.max(...imageDims.map(d => d.h));
                                const actualColumns = Math.min(SUB_COLUMNS, group.images.length);
                                const blockWidth = actualColumns * maxWidth + (actualColumns - 1) * SUB_IMAGE_GAP;
                                const blockStartX = groupCenterX - blockWidth / 2;

                                group.images.forEach((img, i) => {
                                    const col = i % SUB_COLUMNS;
                                    const imgRow = Math.floor(i / SUB_COLUMNS);
                                    const cardCenterX = blockStartX + col * (maxWidth + SUB_IMAGE_GAP) + maxWidth / 2;
                                    const cardTopY = subCardsStartY + imgRow * (maxHeight + SUB_IMAGE_GAP);
                                    const dims = imageDims[i];
                                    newPositions[img.id] = { x: cardCenterX, y: cardTopY + dims.h };
                                });
                            }
                        } else if (group.images[0]) {
                            // Standalone image card.
                            const img = group.images[0];
                            const dims = getImageDims(img.aspectRatio, img.dimensions);
                            newPositions[img.id] = { x: groupCenterX, y: subCardsStartY + dims.h };
                        }

                        // [Fix] Advance by the real group width, not maxGroupWidth, to avoid overlap.
                        rowX += group.width + GROUP_GAP_X;
                    });

                    startY += layoutRow.maxTotalHeight + GROUP_GAP_Y;
                });

                // 8. Apply positions.
                const newCanvases = state.canvases.map(c => {
                    if (c.id !== state.activeCanvasId) return c;
                    return {
                        ...c,
                        promptNodes: c.promptNodes.map(pn => newPositions[pn.id] ? { ...pn, position: newPositions[pn.id] } : pn),
                        imageNodes: c.imageNodes.map(img => newPositions[img.id] ? { ...img, position: newPositions[img.id] } : img),
                        lastModified: Date.now()
                    };
                });

                setState(prev => ({ ...prev, canvases: newCanvases }));
                return;
            }
        }

        // --- New layout logic: start from the upper-left and place up to 20 groups per row. ---
        // Configuration
        const GROUPS_PER_ROW = AUTO_ARRANGE_GROUPS_PER_ROW;  // Fixed 20 groups per row.
        const GROUP_GAP_X = AUTO_ARRANGE_GROUP_GAP_X;     // Horizontal gap between groups.
        const GROUP_GAP_Y = AUTO_ARRANGE_GROUP_GAP_Y;     // Vertical gap between rows.
        const START_X = -2000;      // Upper-left layout origin X.
        const START_Y = 200;        // Upper-left layout origin Y.

        // 1. Classify cards.
        const errorPrompts = currentCanvas.promptNodes.filter(p => p.error);
        const errorPromptIds = new Set(errorPrompts.map(p => p.id));

        // Normal prompt cards with child images.
        const normalPrompts = currentCanvas.promptNodes.filter(p =>
            !errorPromptIds.has(p.id) &&
            currentCanvas.imageNodes.some(img => img.parentPromptId === p.id)
        );

        // Orphan prompt cards without child images.
        const orphanPrompts = currentCanvas.promptNodes.filter(p =>
            !errorPromptIds.has(p.id) &&
            !currentCanvas.imageNodes.some(img => img.parentPromptId === p.id)
        );

        // Orphan image cards without a parent prompt.
        const orphanImages = currentCanvas.imageNodes.filter(img =>
            !img.parentPromptId ||
            !currentCanvas.promptNodes.some(p => p.id === img.parentPromptId)
        );

        // 2. Build layout groups.
        type LayoutGroupType = 'normal' | 'orphan-prompt' | 'orphan-image' | 'error';
        type LayoutGroup = {
            type: LayoutGroupType;
            prompt?: typeof normalPrompts[0];
            images: typeof currentCanvas.imageNodes;
            width: number;
            height: number;
            sourcePromptId?: string;
            layoutHeight?: number;
        };
        const layoutGroups: LayoutGroup[] = [];
        const promptById = new Map(currentCanvas.promptNodes.map(prompt => [prompt.id, prompt]));
        const imageById = new Map(currentCanvas.imageNodes.map(img => [img.id, img]));

        // 2a. Normal card groups (prompt + child images).
        const SUB_COLUMNS = AUTO_ARRANGE_SUB_COLUMNS; // Default horizontal sub-card columns.
        const SUB_IMAGE_GAP = AUTO_ARRANGE_SUB_IMAGE_GAP; // Child-card gap.
        const PROMPT_TO_SUB_GAP = AUTO_ARRANGE_PROMPT_TO_SUB_GAP; // Gap between prompt and child cards.

        normalPrompts.forEach(prompt => {
            const childImages = currentCanvas.imageNodes.filter(img => img.parentPromptId === prompt.id);
            const promptWidth = 320;
            const promptHeight = prompt.height || 200;
            const sourceImage = prompt.sourceImageId ? imageById.get(prompt.sourceImageId) : undefined;
            const sourcePromptId = sourceImage?.parentPromptId && promptById.has(sourceImage.parentPromptId)
                ? sourceImage.parentPromptId
                : undefined;

            // Compute child-card bounds.
            let maxSubWidth = 0;
            let maxSubHeight = 0;
            childImages.forEach(img => {
                const dims = getImageDims(img.aspectRatio, img.dimensions);
                maxSubWidth = Math.max(maxSubWidth, dims.w);
                maxSubHeight = Math.max(maxSubHeight, dims.h);
            });

            // Actual column count, capped by image count.
            const actualColumns = Math.min(SUB_COLUMNS, childImages.length);
            const rows = Math.ceil(childImages.length / SUB_COLUMNS);

            // Child-card block size.
            const subBlockWidth = actualColumns > 0
                ? actualColumns * maxSubWidth + (actualColumns - 1) * SUB_IMAGE_GAP
                : 0;
            const subBlockHeight = rows > 0
                ? rows * maxSubHeight + (rows - 1) * SUB_IMAGE_GAP
                : 0;

            // Total group width and height.
            const groupWidth = Math.max(promptWidth, subBlockWidth);
            const groupHeight = promptHeight + (childImages.length > 0 ? PROMPT_TO_SUB_GAP + subBlockHeight : 0);

            layoutGroups.push({
                type: 'normal',
                prompt,
                images: childImages,
                width: groupWidth,
                height: groupHeight,
                sourcePromptId
            });
        });

        // 2b. Orphan prompt cards.
        orphanPrompts.forEach(prompt => {
            const sourceImage = prompt.sourceImageId ? imageById.get(prompt.sourceImageId) : undefined;
            const sourcePromptId = sourceImage?.parentPromptId && promptById.has(sourceImage.parentPromptId)
                ? sourceImage.parentPromptId
                : undefined;
            layoutGroups.push({
                type: 'orphan-prompt',
                prompt,
                images: [],
                width: 320,
                height: prompt.height || 200,
                sourcePromptId
            });
        });

        // 2c. Orphan image cards.
        orphanImages.forEach(img => {
            const dims = getImageDims(img.aspectRatio, img.dimensions);
            layoutGroups.push({
                type: 'orphan-image',
                images: [img],
                width: dims.w,
                height: dims.h
            });
        });

        // 3. Layout normal + orphan groups with 20 groups per row.
        // Two-pass layout:
        //   Pass 1: assign groups to rows and compute each row's max prompt height.
        //   Pass 2: place groups using those row metrics so sub-card tops align.

        const followUpGroups = layoutGroups.filter(group => !!group.sourcePromptId && group.prompt);
        const rootLayoutGroups = layoutGroups.filter(group => !group.sourcePromptId);
        const followUpChildrenMap = new Map<string, LayoutGroup[]>();
        followUpGroups.forEach(group => {
            const sourcePromptId = group.sourcePromptId!;
            const existing = followUpChildrenMap.get(sourcePromptId) || [];
            existing.push(group);
            followUpChildrenMap.set(sourcePromptId, existing);
        });
        followUpChildrenMap.forEach((groups) => {
            groups.sort((a, b) => (a.prompt?.timestamp || 0) - (b.prompt?.timestamp || 0));
        });

        const computeLayoutHeight = (group: LayoutGroup, stack = new Set<string>()): number => {
            const promptId = group.prompt?.id;
            if (!promptId || stack.has(promptId)) return group.height;
            const nextStack = new Set(stack);
            nextStack.add(promptId);
            const children = followUpChildrenMap.get(promptId) || [];
            return children.length === 0
                ? group.height
                : Math.max(group.height, ...children.map(child => computeLayoutHeight(child, nextStack)));
        };

        rootLayoutGroups.forEach(group => {
            group.layoutHeight = computeLayoutHeight(group);
        });

        // Pass 1: assign groups to rows.
        const rows: Array<{
            groups: LayoutGroup[];
            maxPromptHeight: number;  // Tallest prompt in the row.
            maxTotalHeight: number;   // Tallest full group in the row.
            startX: number;
        }> = [];

        let currentX = START_X;
        let currentRow: typeof rows[0] = { groups: [], maxPromptHeight: 0, maxTotalHeight: 0, startX: START_X };

        rootLayoutGroups.forEach((group) => {
            const groupsInCurrentRow = currentRow.groups.length;

            // Wrap only by group count, not by width.
            if (groupsInCurrentRow >= GROUPS_PER_ROW) {
                rows.push(currentRow);
                currentX = START_X;
                currentRow = { groups: [], maxPromptHeight: 0, maxTotalHeight: 0, startX: START_X };
            }

            // Add to the current row.
            currentRow.groups.push(group);

            // Update row height metrics.
            const promptHeight = group.prompt?.height || 200;
            currentRow.maxPromptHeight = Math.max(currentRow.maxPromptHeight, promptHeight);
            currentRow.maxTotalHeight = Math.max(currentRow.maxTotalHeight, group.layoutHeight || group.height);

            currentX += group.width + GROUP_GAP_X;
        });

        // Push the last row.
        if (currentRow.groups.length > 0) {
            rows.push(currentRow);
        }

        // Pass 2: place groups using the computed row metrics.
        const positions: { [id: string]: { x: number; y: number } } = {};
        const placedBounds = new Map<string, { left: number; top: number; right: number; bottom: number; width: number; height: number }>();
        const followUpRightEdge = new Map<string, number>();
        let currentY = START_Y;

        const placeGroup = (group: LayoutGroup, left: number, top: number) => {
            const groupCenterX = left + group.width / 2;
            const promptHeight = group.prompt?.height || 200;
            const subCardsStartY = top + promptHeight + PROMPT_TO_SUB_GAP;

            if (group.type === 'normal' && group.prompt) {
                positions[group.prompt.id] = {
                    x: groupCenterX,
                    y: top + promptHeight
                };

                if (group.images.length > 0) {
                    const imageDims = group.images.map(img => getImageDims(img.aspectRatio, img.dimensions));
                    const maxWidth = Math.max(...imageDims.map(d => d.w));
                    const maxHeight = Math.max(...imageDims.map(d => d.h));
                    const actualColumns = Math.min(SUB_COLUMNS, group.images.length);
                    const blockWidth = actualColumns * maxWidth + (actualColumns - 1) * SUB_IMAGE_GAP;
                    const blockStartX = groupCenterX - blockWidth / 2;

                    group.images.forEach((img, index) => {
                        const col = index % SUB_COLUMNS;
                        const imgRow = Math.floor(index / SUB_COLUMNS);
                        const cardCenterX = blockStartX + col * (maxWidth + SUB_IMAGE_GAP) + maxWidth / 2;
                        const cardTopY = subCardsStartY + imgRow * (maxHeight + SUB_IMAGE_GAP);
                        const dims = imageDims[index];
                        positions[img.id] = {
                            x: cardCenterX,
                            y: cardTopY + dims.h
                        };
                    });
                }
            } else if (group.type === 'orphan-prompt' && group.prompt) {
                positions[group.prompt.id] = {
                    x: groupCenterX,
                    y: top + promptHeight
                };
            } else if (group.type === 'orphan-image' && group.images[0]) {
                const img = group.images[0];
                const dims = getImageDims(img.aspectRatio, img.dimensions);
                positions[img.id] = {
                    x: groupCenterX,
                    y: subCardsStartY + dims.h
                };
            }

            if (group.prompt?.id) {
                placedBounds.set(group.prompt.id, {
                    left,
                    top,
                    right: left + group.width,
                    bottom: top + group.height,
                    width: group.width,
                    height: group.height
                });
            }
        };

        rows.forEach((row) => {
            let rowX = START_X;

            row.groups.forEach((group) => {
                placeGroup(group, rowX, currentY);
                rowX += group.width + GROUP_GAP_X;
            });

            currentY += row.maxTotalHeight + GROUP_GAP_Y;
        });

        const pendingFollowUps = [...followUpGroups];
        let guard = 0;

        while (pendingFollowUps.length > 0 && guard < 1000) {
            guard += 1;
            let placedInLoop = 0;

            for (let index = 0; index < pendingFollowUps.length; index += 1) {
                const group = pendingFollowUps[index];
                const sourcePromptId = group.sourcePromptId;

                if (!sourcePromptId) {
                    continue;
                }

                const anchorBounds = placedBounds.get(sourcePromptId);
                if (!anchorBounds) {
                    continue;
                }

                const left = followUpRightEdge.get(sourcePromptId) ?? (anchorBounds.right + GROUP_GAP_X);
                placeGroup(group, left, anchorBounds.top);

                if (group.prompt?.id) {
                    const placed = placedBounds.get(group.prompt.id);
                    if (placed) {
                        followUpRightEdge.set(sourcePromptId, placed.right + GROUP_GAP_X);
                    }
                }

                pendingFollowUps.splice(index, 1);
                index -= 1;
                placedInLoop += 1;
            }

            if (placedInLoop === 0) {
                pendingFollowUps.forEach((group) => {
                    placeGroup(group, START_X, currentY);
                    currentY += (group.layoutHeight || group.height) + GROUP_GAP_Y;
                });
                pendingFollowUps.length = 0;
            }
        }

        // 4. Arrange error card groups on their own rows.
        if (errorPrompts.length > 0) {
            // Start a fresh error row.
            let errorX = START_X;
            let errorRowMaxHeight = 0;
            let errorGroupsInRow = 0;
            currentY += GROUP_GAP_Y + 50; // Extra 50px separation.

            const ERROR_GAP_X = 40; // Tighter spacing between error groups.

            errorPrompts.forEach(prompt => {
                const promptWidth = 320;
                const promptHeight = prompt.height || 200;
                const childImages = currentCanvas.imageNodes.filter(img => img.parentPromptId === prompt.id);

                // Compute error-group bounds using the same child-card layout.
                let groupWidth = promptWidth;
                let groupHeight = promptHeight;

                if (childImages.length > 0) {
                    let maxSubWidth = 0;
                    let maxSubHeight = 0;
                    childImages.forEach(img => {
                        const dims = getImageDims(img.aspectRatio, img.dimensions);
                        maxSubWidth = Math.max(maxSubWidth, dims.w);
                        maxSubHeight = Math.max(maxSubHeight, dims.h);
                    });
                    const actualColumns = Math.min(SUB_COLUMNS, childImages.length);
                    const rows = Math.ceil(childImages.length / SUB_COLUMNS);
                    const subBlockWidth = actualColumns * maxSubWidth + (actualColumns - 1) * SUB_IMAGE_GAP;
                    const subBlockHeight = rows * maxSubHeight + (rows - 1) * SUB_IMAGE_GAP;
                    groupWidth = Math.max(promptWidth, subBlockWidth);
                    groupHeight = promptHeight + PROMPT_TO_SUB_GAP + subBlockHeight;
                }

                // Wrap error groups only by group count.
                if (errorGroupsInRow >= GROUPS_PER_ROW) {
                    errorX = START_X;
                    currentY += errorRowMaxHeight + GROUP_GAP_Y;
                    errorRowMaxHeight = 0;
                    errorGroupsInRow = 0;
                }

                const groupCenterX = errorX + groupWidth / 2;

                // Prompt position.
                positions[prompt.id] = {
                    x: groupCenterX,
                    y: currentY + promptHeight
                };

                // Child image positions: centered columns with top alignment.
                if (childImages.length > 0) {
                    const promptBottom = currentY + promptHeight + PROMPT_TO_SUB_GAP;

                    // Compute child-card bounds.
                    const imageDims = childImages.map(img => getImageDims(img.aspectRatio, img.dimensions));
                    const maxWidth = Math.max(...imageDims.map(d => d.w));
                    const maxHeight = Math.max(...imageDims.map(d => d.h));

                    // Compute the actual column count.
                    const actualColumns = Math.min(SUB_COLUMNS, childImages.length);
                    const blockWidth = actualColumns * maxWidth + (actualColumns - 1) * SUB_IMAGE_GAP;
                    const blockStartX = groupCenterX - blockWidth / 2;

                    childImages.forEach((img, i) => {
                        const col = i % SUB_COLUMNS;
                        const row = Math.floor(i / SUB_COLUMNS);
                        const cardCenterX = blockStartX + col * (maxWidth + SUB_IMAGE_GAP) + maxWidth / 2;
                        // Top-aligned: y = top position + card height (bottom anchor).
                        const cardTopY = promptBottom + row * (maxHeight + SUB_IMAGE_GAP);
                        const dims = imageDims[i];
                        positions[img.id] = {
                            x: cardCenterX,
                            y: cardTopY + dims.h
                        };
                    });
                }

                errorX += groupWidth + ERROR_GAP_X;
                errorRowMaxHeight = Math.max(errorRowMaxHeight, groupHeight);
                errorGroupsInRow++;
            });
        }

        setState(prev => {
            // Recompute from prev so we always use the latest state.
            const updatedCanvases = prev.canvases.map(c =>
                c.id === prev.activeCanvasId ? {
                    ...c,
                    promptNodes: c.promptNodes.map(pn => ({ ...pn, position: positions[pn.id] || pn.position })),
                    imageNodes: c.imageNodes.map(img => ({ ...img, position: positions[img.id] || img.position })),
                    lastModified: Date.now()
                } : c
            );

            // Force save with the updated canvas state.
            if (!prev.fileSystemHandle) {
                try {
                    persistCanvasStateToLocalStorage({
                        ...prev,
                        canvases: updatedCanvases,
                        history: {}
                    } as CanvasState, 'layout-save');
                } catch (e) {
                    console.error('Failed to save layout:', e);
                }
            }

            return { ...prev, canvases: updatedCanvases };
        });

    }, [pushToHistory]); // Removed the direct state dependency; use functional updates instead.

    // --- File System Implementation ---

    const connectLocalFolder = useCallback(async () => {
        try {
            let handle: FileSystemDirectoryHandle | null = null;

            // 1. Try Optimized Restore (Permission Prompt instead of Picker)
            try {
                handle = await restoreLocalFolderConnection();
            } catch (err) {
                // Restore failed; continue with the full directory picker.
                console.warn('[CanvasContext] Failed to restore local folder:', err);
            }

            // 2. Fallback to Full Picker
            if (!handle) {
                handle = await fileSystemService.selectDirectory();
                await setLocalFolderHandle(handle);
            }

            if (!handle) {
                return;
            }

            setState(prev => ({
                ...prev,
                fileSystemHandle: handle,
                folderName: handle.name
            }));

            void (async () => {
                try {

                    // [NEW] Migration: Save currently loaded images (Temp) to the new Local Folder
                    // This ensures work done in Temp mode is not lost/abandoned when switching
                    if (handle) {
                        // Do not call getAllImages; migrate only the assets required by the current state.

                        // Helper to save base64/blob to disk
                        const saveToDisk = async (id: string, urlOrData: string, isVideo: boolean = false) => {
                            try {
                                let blob: Blob;
                                if (urlOrData.startsWith('data:')) {
                                    const res = await fetch(urlOrData);
                                    blob = await res.blob();
                                } else {
                                    // It's a blob URL
                                    const res = await fetch(urlOrData);
                                    blob = await res.blob();
                                }

                                // Use the newer saveImageToHandle helper for both images and videos.
                                await fileSystemService.saveImageToHandle(handle!, id, blob, isVideo);

                                if (!isVideo) {
                                    const { generateThumbnailWithPreset } = await import('../workers/thumbnailService');
                                    const { blob: thumbnailBlob } = await generateThumbnailWithPreset(urlOrData, 'MICRO');
                                    await fileSystemService.saveThumbnailToHandle(handle!, id, thumbnailBlob);
                                }
                            } catch (e) {
                                console.warn('[CanvasContext] Failed to migrate image ' + id + ' to local folder', e);
                            }
                        };

                        // Migrate only the assets currently needed by the active state.
                        const promises: Promise<void>[] = [];
                        state.canvases.forEach(c => {
                            c.imageNodes.forEach(img => {
                                const lookupId = img.storageId || img.id;
                                if (img.id && lookupId) {
                                    promises.push((async () => {
                                        const sourceUrl = await resolveOriginalPersistSourceForDisk(img);
                                        if (!sourceUrl) return;

                                        // Detect whether this asset is a video.
                                        const isVideo = sourceUrl.startsWith('data:video/') || img.mode === GenerationMode.VIDEO || img.model?.includes('veo') || false;
                                        await saveToDisk(lookupId, sourceUrl, isVideo);
                                    })());
                                }
                            });
                            c.promptNodes.forEach(pn => {
                                pn.referenceImages?.forEach(ref => {
                                    // Use saveReferenceImage so refs go to refs/ with compression.
                                    if (ref.storageId && ref.data) {
                                        // saveReferenceImage expects base64 string without "data:mimeType;base64," prefix
                                        const base64Data = ref.data.startsWith('data:') ? ref.data.split(',')[1] : ref.data;
                                        promises.push(
                                            fileSystemService.saveReferenceImage(handle!, ref.storageId, base64Data, ref.mimeType)
                                        );
                                    } else if (ref.id && ref.data) {
                                        // Fallback for old refs without storageId
                                        // saveReferenceImage expects base64 string without "data:mimeType;base64," prefix
                                        const base64Data = ref.data.startsWith('data:') ? ref.data.split(',')[1] : ref.data;
                                        promises.push(
                                            fileSystemService.saveReferenceImage(handle!, ref.id, base64Data, ref.mimeType)
                                        );
                                    }
                                });
                            });
                        });

                        // Wait for every migration save to finish.
                        try {
                            await Promise.allSettled(promises);
                        } catch (e) {
                            console.warn('Migration partial failure', e);
                        }

                        if (promises.length > 0) {
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            notify.success('数据迁移', '已将 ' + promises.length + ' 张临时图片保存到本地文件夹。');
                        }
                    }

                    const { canvases, images } = await fileSystemService.loadProjectWithThumbs(handle);

                    // Hydrate caches without collapsing original and thumbnail into the same storage slot.
                    for (const [id, data] of images.entries()) {
                        void hydrateRecoveredMediaCacheEntry(id, data).catch((error) => {
                            console.error('[CanvasContext] Failed to cache image ' + id, error);
                        });
                    }

                    // If found existing project in the folder, MERGE instead of overwrite
                    if (canvases.length > 0) {
                        setState(prev => {
                            const mergedCanvases = mergeCanvases(prev.canvases, canvases);
                            const finalCanvases = mergedCanvases.map(canvas => ({
                                ...canvas,
                                imageNodes: (canvas.imageNodes || []).map(img => {
                                    const lookupId = img.storageId || img.id;
                                    const localData = images.get(lookupId) || images.get(img.id);
                                    return {
                                        ...img,
                                        url: localData?.url || img.url || img.apiResultUrl || '',
                                        originalUrl: localData?.originalUrl || img.originalUrl || img.apiResultUrl,
                                        filename: localData?.filename || img.fileName
                                    };
                                }),
                                promptNodes: (canvas.promptNodes || []).map(pn => ({
                                    ...pn,
                                    referenceImages: pn.referenceImages?.map(ref => ({ ...ref })) || []
                                }))
                            }));

                            const finalActiveId = resolvePreferredActiveCanvasId(
                                prev.activeCanvasId,
                                null,
                                finalCanvases
                            );

                            console.log('[CanvasContext] Merged local folder canvases:', prev.canvases.length, 'memory +', canvases.length, 'disk ->', finalCanvases.length);

                            return {
                                ...prev,
                                canvases: finalCanvases,
                                activeCanvasId: finalActiveId,
                                fileSystemHandle: handle,
                                folderName: handle.name,
                                history: {}
                            };
                        });
                    } else {
                        // New folder (empty), just attach handle to current state (Save to Local)
                        setState(prev => ({
                            ...prev,
                            fileSystemHandle: handle,
                            folderName: handle.name
                        }));
                    }

                    // [Fix] Persist the handle to IndexedDB so reload can restore it.
                    if (handle) {
                        void setLocalFolderHandle(handle);
                    }
                } catch (backgroundError) {
                    console.error('[CanvasContext] Failed to hydrate local folder in background:', backgroundError);
                }
            })();

        } catch (error) {
            console.error('Failed to connect local folder:', error);
            // If user likely cancelled, we can ignore. If error, maybe alert?
            // For now console.error is enough as selectDirectory throws AbortError usually
        }
    }, [state.canvases]);

    const disconnectLocalFolder = useCallback(async () => {
        // 1. Ensure all current images are cached in IndexedDB (Data Safety)
        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        if (currentCanvas) {
            // A. Cache Generated Images
            currentCanvas.imageNodes.forEach(img => {
                if (img.url && !img.url.startsWith('data:')) {
                    fetch(img.url).then(r => r.blob()).then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                            if (reader.result) {
                                const data = reader.result as string;
                                const sid = img.storageId || await calculateImageHash(data);
                                saveImage(sid, data);
                            }
                        };
                        reader.readAsDataURL(blob);
                    }).catch(e => console.warn('Background cache failed', e));
                }
            });

            // B. Cache Reference Images (Fix for missing refs)
            currentCanvas.promptNodes.forEach(pn => {
                pn.referenceImages?.forEach(async ref => {
                    if (ref.data) {
                        // Ensure it's a full data URL for storage
                        const fullUrl = ref.data.startsWith('data:')
                            ? ref.data
                            : 'data:' + (ref.mimeType || 'image/png') + ';base64,' + ref.data;
                        const sid = ref.storageId || await calculateImageHash(fullUrl);
                        saveImage(sid, fullUrl).catch(e => console.warn('Ref cache failed', e));
                    }
                });
            });
        }

        // 2. Switch Mode
        fileSystemService.setGlobalHandle(null);
        setState(prev => ({
            ...prev,
            fileSystemHandle: null,
            folderName: null
        }));

        // 3. Notify
        notify.success('已切换到临时模式', '项目数据已保留。');

    }, [state.canvases, state.activeCanvasId]);

    const changeLocalFolder = useCallback(async () => {
        const currentState = stateRef.current;
        if (!currentState.fileSystemHandle) return;

        try {
            // 1. Pick new folder
            const newHandle = await fileSystemService.selectDirectory();
            if (newHandle.name === currentState.folderName) {
                notify.info('提示', '您选择了同一个文件夹');
                return;
            }

            // 2. Confirm Migration
            const confirmed = window.confirm(
                '移动项目到 "' + newHandle.name + '"?\n\n这将移动所有文件，从 "' + currentState.folderName + '" 到新位置。'
            );

            if (!confirmed) return;
            const currentHandle = currentState.fileSystemHandle;
            if (!currentHandle) {
                notify.error('Move failed', 'Current project is not linked to a local folder.');
                return;
            }
            setIsLoading(true);
            try {
                // 3. Perform Move
                await fileSystemService.moveProject(currentHandle, newHandle);

                // 4. Update State to new handle
                setState(prev => ({
                    ...prev,
                    fileSystemHandle: newHandle,
                    folderName: newHandle.name
                }));

                // [Fix] Persist the new handle after a move.
                void setLocalFolderHandle(newHandle);

                notify.success('移动成功', '项目已成功移动到新位置。');

            } catch (error: any) {
                notify.error('移动失败', '迁移失败: ' + error.message);
                console.error(error);
            } finally {
                setIsLoading(false);
            }

        } catch (error) {
            // Cancelled picker
        }
    }, [state.fileSystemHandle, state.folderName]);

    // Cache failed image IDs to avoid repeating the same reload errors every 15 seconds.
    const failedReloadIdsRef = useRef<Set<string>>(new Set());
    // [Fix] Write lock to prevent refresh/save races.
    const isSavingRef = useRef(false);

    const runLocalFolderRefresh = useCallback(async (reason: 'manual' | 'interval' = 'manual') => {
        const currentState = stateRef.current;
        if (!currentState.fileSystemHandle) return;
        // [Fix] Skip this refresh cycle while a save is in progress to avoid half-written project.json.
        if (isSavingRef.current) {
            console.debug('[CanvasContext] Skipping refresh: save in progress');
            return;
        }
        if (reason === 'interval') {
            const isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
            const isUserActiveRecently = Date.now() - lastUserActivityAtRef.current < LOCAL_FOLDER_IDLE_GRACE_MS;
            const activeCanvas = currentState.canvases.find(c => c.id === currentState.activeCanvasId);
            const hasRunningGeneration = Boolean(
                activeCanvas?.promptNodes.some(node => node.isGenerating) ||
                activeCanvas?.imageNodes.some(node => node.isGenerating)
            );
            const hasSelection = (currentState.selectedNodeIds?.length || 0) > 0;

            if (isVisible) {
                console.debug('[CanvasContext] Skipping auto refresh: page is visible');
                return;
            }

            if (isUserActiveRecently) {
                console.debug('[CanvasContext] Skipping auto refresh: recent user activity');
                return;
            }

            if (hasRunningGeneration) {
                console.debug('[CanvasContext] Skipping auto refresh: generation in progress');
                return;
            }

            if (hasSelection) {
                console.debug('[CanvasContext] Skipping auto refresh: selection is active');
                return;
            }
        }
        try {
            const handle = currentState.fileSystemHandle;
            const { canvases, images } = await fileSystemService.loadProjectWithThumbs(handle);

            // Hydrate caches without letting thumbnail reads overwrite original-image storage.
            for (const [id, data] of images.entries()) {
                if (failedReloadIdsRef.current.has(id)) continue;
                if (!data.url && !data.originalUrl) continue;

                void hydrateRecoveredMediaCacheEntry(id, data)
                    .then(() => {
                        failedReloadIdsRef.current.delete(id);
                    })
                    .catch(() => {
                        failedReloadIdsRef.current.add(id);
                        console.debug('[CanvasContext] Failed to refresh cache for ' + id + ' from local folder (will skip future retries)');
                    });
            }

            // Reload state only if changed
            if (canvases.length > 0) {
                setState(prev => {
                    const nextActiveCanvasId = currentState.activeCanvasId || prev.activeCanvasId;
                    const incomingActiveCanvas = canvases.find(c => c.id === nextActiveCanvasId) || canvases[0];
                    const currentActiveCanvas = prev.canvases.find(c => c.id === incomingActiveCanvas?.id);

                    if (incomingActiveCanvas && currentActiveCanvas) {
                        if ((currentActiveCanvas.lastModified || 0) > (incomingActiveCanvas.lastModified || 0) + 2000) {
                            return prev;
                        }

                        const promptCountMatch = currentActiveCanvas.promptNodes.length === incomingActiveCanvas.promptNodes.length;
                        const imageCountMatch = currentActiveCanvas.imageNodes.length === incomingActiveCanvas.imageNodes.length;

                        if (
                            promptCountMatch &&
                            imageCountMatch &&
                            Math.abs((currentActiveCanvas.lastModified || 0) - (incomingActiveCanvas.lastModified || 0)) < 5000
                        ) {
                            return prev;
                        }
                    }

                    const hydratedDiskCanvases = canvases.map(diskCanvas => ({
                        ...diskCanvas,
                        imageNodes: (diskCanvas.imageNodes || []).map(img => {
                            const lookupId = img.storageId || img.id;
                            const localData = images.get(lookupId) || images.get(img.id);
                            return {
                                ...img,
                                url: localData?.url || img.url || img.apiResultUrl || '',
                                originalUrl: localData?.originalUrl || img.originalUrl || img.apiResultUrl,
                                fileName: localData?.filename || img.fileName
                            };
                        }),
                        promptNodes: (diskCanvas.promptNodes || []).map(prompt => ({
                            ...prompt,
                            referenceImages: prompt.referenceImages?.map(ref => ({ ...ref })) || []
                        }))
                    }));

                    const mergedCanvases = mergeCanvases(prev.canvases, hydratedDiskCanvases);
                    const finalActiveId = resolvePreferredActiveCanvasId(
                        prev.activeCanvasId,
                        null,
                        mergedCanvases
                    );

                    return {
                        ...prev,
                        canvases: mergedCanvases,
                        activeCanvasId: finalActiveId
                    };
                });
            }
            // Silent refresh success (no alert)
        } catch (error) {
            console.error('Failed to refresh folder:', error);
            // Silent failure
        }
    }, []);

    // Auto-sync: poll the local folder every 15 seconds when connected to reduce sync drift.
    const refreshLocalFolder = useCallback(async () => {
        await runLocalFolderRefresh('manual');
    }, [runLocalFolderRefresh]);

    useEffect(() => {
        if (!state.fileSystemHandle) return;
        const interval = window.setInterval(() => {
            void runLocalFolderRefresh('interval');
        }, LOCAL_FOLDER_REFRESH_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [state.fileSystemHandle, runLocalFolderRefresh]);

    // Enhanced Persistence (Local Storage + File System)
    useEffect(() => {
        if (isLoading) return;

        const saveState = async () => {
            // [Fix] Set the write lock so refresh cannot read half-written state.
            isSavingRef.current = true;
            try {
                // 1. Save to LocalStorage (Only if NOT using File System)
                if (!state.fileSystemHandle) {
                    try {
                        persistCanvasStateToLocalStorage(state, 'periodic-save');
                    } catch (e: any) {
                        if (e.name === 'QuotaExceededError') console.error('localStorage quota exceeded.');
                        else console.error('Failed to save state:', e);
                    }
                }

                // 2. Save to File System if connected
                if (state.fileSystemHandle) {
                    try {
                        // Gather all dirty/needed images
                        const imagesToSave = new Map<string, Blob>();

                        const allImages = new Map<string, string>();
                        state.canvases.forEach(c => {
                            c.imageNodes.forEach(img => {
                                const storageId = img.storageId || img.id;
                                if (!storageId) return;
                                allImages.set(storageId, '');
                            });
                        });

                        for (const [id] of allImages.entries()) {
                            const imageNode = state.canvases
                                .flatMap(canvas => canvas.imageNodes)
                                .find(img => (img.storageId || img.id) === id);
                            if (!imageNode) continue;

                            const url = await resolveOriginalPersistSourceForDisk(imageNode);
                            if (!url) {
                                continue;
                            }

                            // Only fetch if it's a blob url (local)
                            if (url.startsWith('blob:') || url.startsWith('data:') || /^https?:\/\//i.test(url)) {
                                try {
                                    const res = await fetch(url);
                                    if (!res.ok) throw new Error('Fetch status: ' + res.status);
                                    const blob = await res.blob();
                                    imagesToSave.set(id, blob);
                                } catch (err: any) {
                                    // [Fix] Ignore known blob errors to prevent console spam.
                                    if (err.message && err.message.includes('ERR_UPLOAD_FILE_CHANGED')) {
                                        console.warn('[CanvasContext] Blob reference lost for ' + id + ' (file changed/moved), skipping save.');
                                    } else if (err instanceof TypeError && String(err.message || '').includes('Failed to fetch')) {
                                        // blob/data URLs can expire before save completes; this failure is safe to ignore.
                                    } else {
                                        console.warn('[CanvasContext] Skip saving image ' + id + ' (fetch failed):', err);
                                    }
                                }
                            }
                        }

                        // Prepare Clean State for JSON
                        // [Defensive fix] Ensure canvases is non-empty and still contains activeCanvasId.
                        const cleanCanvases = stripImageUrls(state.canvases);
                        if (cleanCanvases.length === 0) {
                            console.error('[CanvasContext] Aborting save: canvases array is empty! This would wipe project.json');
                            return;
                        }

                        const fsState = {
                            canvases: cleanCanvases,
                            activeCanvasId: state.activeCanvasId || cleanCanvases[0]?.id || 'default',
                            version: 1
                        };

                        console.log('[CanvasContext] Saving project to disk:', {
                            canvasesCount: fsState.canvases.length,
                            activeCanvasId: fsState.activeCanvasId,
                            imagesToSave: imagesToSave.size
                        });

                        await fileSystemService.saveProject(state.fileSystemHandle, fsState as any, imagesToSave);

                    } catch (error) {
                        console.error('File System Save Failed:', error);
                    }
                }
            } finally {
                // [Fix] Release the write lock.
                isSavingRef.current = false;
            }
        };

        const timer = setTimeout(saveState, 1000); // 1s debounce for FS operations
        return () => clearTimeout(timer);
    }, [state, isLoading]);


    /**
     * Get the next available position for a new card (to the right of existing cards)
     */
    const selectNodes = useCallback((ids: string[], mode: 'replace' | 'add' | 'remove' | 'toggle' = 'replace') => {
        setState(prev => {
            const current = new Set(prev.selectedNodeIds || []);
            let newSelectedIds: string[] = [];

            switch (mode) {
                case 'replace':
                    // 瀹屽叏鏇挎崲閫夋嫨
                    newSelectedIds = ids;
                    break;

                case 'add':
                    // Add to selection (Shift + marquee).
                    ids.forEach(id => current.add(id));
                    newSelectedIds = Array.from(current);
                    break;

                case 'remove':
                    // 浠庨€夋嫨涓Щ闄わ紙Alt+妗嗛€夛級
                    ids.forEach(id => current.delete(id));
                    newSelectedIds = Array.from(current);
                    break;

                case 'toggle':
                    // Toggle selection (Ctrl + click).
                    ids.forEach(id => {
                        if (current.has(id)) {
                            current.delete(id);
                        } else {
                            current.add(id);
                        }
                    });
                    newSelectedIds = Array.from(current);
                    break;

                default:
                    newSelectedIds = ids;
            }

            return { ...prev, selectedNodeIds: newSelectedIds };
        });
    }, []);

    const clearSelection = useCallback(() => {
        setState(prev => ({ ...prev, selectedNodeIds: [] }));
    }, []);

    // [Layering] Bring nodes to front by assigning a higher zIndex.
    const bringNodesToFront = useCallback((nodeIds: string[]) => {
        if (nodeIds.length === 0) return;

        setState(prev => {
            const currentCanvas = prev.canvases.find(c => c.id === prev.activeCanvasId);
            if (!currentCanvas) return prev;

            const promptById = new Map(currentCanvas.promptNodes.map(node => [node.id, node]));
            const imageById = new Map(currentCanvas.imageNodes.map(node => [node.id, node]));
            const workflowById = new Map(
                (currentCanvas.workflow?.nodes || [])
                    .filter(node => isWorkflowUtilityNodeKind(node.kind))
                    .map(node => [node.id, node])
            );
            const canvasGroupsByNodeId = new Map<string, CanvasGroup[]>();
            currentCanvas.groups.forEach(group => {
                group.nodeIds.forEach(id => {
                    const linkedGroups = canvasGroupsByNodeId.get(id) || [];
                    linkedGroups.push(group);
                    canvasGroupsByNodeId.set(id, linkedGroups);
                });
            });
            const orderedNodeIds: string[] = [];
            const orderedNodeIdSet = new Set<string>();
            const expandedPromptIds = new Set<string>();
            const expandedCanvasGroupIds = new Set<string>();

            const pushCanvasGroup = (group: CanvasGroup) => {
                if (expandedCanvasGroupIds.has(group.id)) return;
                expandedCanvasGroupIds.add(group.id);

                group.nodeIds.forEach(memberId => {
                    const prompt = promptById.get(memberId);
                    if (prompt) {
                        pushPromptGroup(prompt.id);
                        return;
                    }

                    const image = imageById.get(memberId);
                    if (image?.parentPromptId) {
                        pushPromptGroup(image.parentPromptId);
                        return;
                    }

                    pushNodeId(memberId);
                });
            };

            const pushNodeId = (id?: string) => {
                if (!id || orderedNodeIdSet.has(id)) return;
                orderedNodeIdSet.add(id);
                orderedNodeIds.push(id);

                const linkedGroups = canvasGroupsByNodeId.get(id) || [];
                linkedGroups.forEach(pushCanvasGroup);
            };

            const getPromptGroupImageIds = (promptId: string) => {
                const prompt = promptById.get(promptId);
                if (!prompt) return [] as string[];

                const childImageIds = new Set<string>(
                    (prompt.childImageIds || []).filter((id): id is string => Boolean(id))
                );

                currentCanvas.imageNodes.forEach(image => {
                    if (image.parentPromptId === promptId) {
                        childImageIds.add(image.id);
                    }
                });

                return Array.from(childImageIds);
            };

            const pushPromptGroup = (promptId: string) => {
                if (expandedPromptIds.has(promptId)) return;
                expandedPromptIds.add(promptId);

                const prompt = promptById.get(promptId);
                if (!prompt) return;

                pushNodeId(prompt.id);
                getPromptGroupImageIds(promptId).forEach(pushNodeId);
            };

            nodeIds.forEach(id => {
                const prompt = promptById.get(id);
                if (prompt) {
                    pushPromptGroup(prompt.id);
                    return;
                }

                const image = imageById.get(id);
                if (image) {
                    if (image.parentPromptId) {
                        pushPromptGroup(image.parentPromptId);
                    } else {
                        pushNodeId(image.id);
                    }
                    return;
                }

                if (workflowById.has(id)) {
                    pushNodeId(id);
                    return;
                }

                pushNodeId(id);
            });

            const nodeIdSet = new Set(orderedNodeIds);

            // Find current max zIndex
            const allZIndices = [
                ...currentCanvas.promptNodes.map(n => n.zIndex ?? 0),
                ...currentCanvas.imageNodes.map(n => n.zIndex ?? 0),
                ...(currentCanvas.workflow?.nodes || []).map(n => n.zIndex ?? 0),
                ...currentCanvas.groups.map(g => g.zIndex ?? 0)
            ];
            let maxZ = allZIndices.length > 0 ? Math.max(...allZIndices) : 0;
            const nextZIndexById = new Map<string, number>();
            const promotedPromptGroupIds = new Set<string>();

            orderedNodeIds.forEach(id => {
                const prompt = promptById.get(id);
                if (prompt) {
                    if (promotedPromptGroupIds.has(prompt.id)) return;
                    promotedPromptGroupIds.add(prompt.id);
                    const groupZIndex = ++maxZ;
                    nextZIndexById.set(prompt.id, groupZIndex);
                    getPromptGroupImageIds(prompt.id).forEach(childImageId => {
                        nextZIndexById.set(childImageId, groupZIndex);
                    });
                    return;
                }

                const image = imageById.get(id);
                if (image?.parentPromptId && promptById.has(image.parentPromptId)) {
                    if (promotedPromptGroupIds.has(image.parentPromptId)) return;
                    promotedPromptGroupIds.add(image.parentPromptId);
                    const groupZIndex = ++maxZ;
                    nextZIndexById.set(image.parentPromptId, groupZIndex);
                    getPromptGroupImageIds(image.parentPromptId).forEach(childImageId => {
                        nextZIndexById.set(childImageId, groupZIndex);
                    });
                    return;
                }

                if (!nextZIndexById.has(id)) {
                    nextZIndexById.set(id, ++maxZ);
                }
            });

            // Update prompt nodes
            const newPromptNodes = currentCanvas.promptNodes.map(n => {
                const nextZIndex = nextZIndexById.get(n.id);
                if (nextZIndex !== undefined) {
                    return { ...n, zIndex: nextZIndex };
                }
                return n;
            });

            // Update image nodes
            const newImageNodes = currentCanvas.imageNodes.map(n => {
                const nextZIndex = nextZIndexById.get(n.id);
                if (nextZIndex !== undefined) {
                    return { ...n, zIndex: nextZIndex };
                }
                return n;
            });

            const newWorkflow = currentCanvas.workflow
                ? {
                    ...currentCanvas.workflow,
                    nodes: currentCanvas.workflow.nodes.map(node => {
                        const nextZIndex = nextZIndexById.get(node.id);
                        if (nextZIndex !== undefined) {
                            return { ...node, zIndex: nextZIndex };
                        }
                        return node;
                    })
                }
                : currentCanvas.workflow;

            // Also bring groups to front if they contain any of the selected nodes
            const newGroups = currentCanvas.groups.map(g => {
                const hasSelectedNode = g.nodeIds.some(id => nodeIdSet.has(id));
                if (hasSelectedNode) {
                    return { ...g, zIndex: ++maxZ };
                }
                return g;
            });

            const newCanvases = prev.canvases.map(c =>
                c.id === prev.activeCanvasId
                    ? { ...c, promptNodes: newPromptNodes, imageNodes: newImageNodes, workflow: newWorkflow, groups: newGroups }
                    : c
            );

            return { ...prev, canvases: newCanvases };
        });
    }, []);

    // Layering is now driven by view-only group tiers in App.tsx.
    // Keep persisted zIndex stable so selection and generation do not continuously inflate stored order.

    const applyMoveSelectedNodes = useCallback((delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[]) => {
        setState(prev => {
            let selectedIds = prev.selectedNodeIds || [];

            if (Array.isArray(sourceNodeIdOrIds) && sourceNodeIdOrIds.length > 0) {
                selectedIds = sourceNodeIdOrIds;
            } else if (typeof sourceNodeIdOrIds === 'string' && sourceNodeIdOrIds) {
                selectedIds = selectedIds.includes(sourceNodeIdOrIds) ? selectedIds : [sourceNodeIdOrIds];
            }
            if (selectedIds.length === 0) return prev;

            const currentCanvas = prev.canvases.find(c => c.id === prev.activeCanvasId);
            if (!currentCanvas) return prev;

            // Simple set-based selection
            const selectedSet = new Set(selectedIds);
            const movedPromptIds = new Set(
                currentCanvas.promptNodes
                    .filter((node) => selectedSet.has(node.id))
                    .map((node) => node.id)
            );

            // Move only selected nodes
            const newPromptNodes = currentCanvas.promptNodes.map(n => {
                if (selectedSet.has(n.id)) {
                    return { ...n, position: { x: n.position.x + delta.x, y: n.position.y + delta.y }, userMoved: true };
                }
                return n;
            });

            const newImageNodes = currentCanvas.imageNodes.map(n => {
                if (selectedSet.has(n.id) || (n.parentPromptId && movedPromptIds.has(n.parentPromptId))) {
                    return { ...n, position: { x: n.position.x + delta.x, y: n.position.y + delta.y } };
                }
                return n;
            });

            const newWorkflow = currentCanvas.workflow
                ? {
                    ...currentCanvas.workflow,
                    nodes: currentCanvas.workflow.nodes.map(node => {
                        if (selectedSet.has(node.id) && isWorkflowUtilityNodeKind(node.kind)) {
                            return {
                                ...node,
                                position: { x: node.position.x + delta.x, y: node.position.y + delta.y }
                            };
                        }
                        return node;
                    })
                }
                : currentCanvas.workflow;

            const newCanvases = prev.canvases.map(c =>
                c.id === prev.activeCanvasId ? { ...c, promptNodes: newPromptNodes, imageNodes: newImageNodes, workflow: newWorkflow } : c
            );

            return { ...prev, canvases: newCanvases };
        });
    }, []);

    const pendingMoveDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const pendingMoveSourceRef = useRef<string | string[] | undefined>(undefined);
    const moveRafRef = useRef<number | null>(null);

    const flushPendingMoveSelectedNodes = useCallback((delta?: { x: number; y: number }, sourceNodeIdOrIds?: string | string[]) => {
        if (moveRafRef.current !== null) {
            cancelAnimationFrame(moveRafRef.current);
            moveRafRef.current = null;
        }

        const batchedDelta = {
            x: pendingMoveDeltaRef.current.x + (delta?.x ?? 0),
            y: pendingMoveDeltaRef.current.y + (delta?.y ?? 0),
        };
        const batchedSource = sourceNodeIdOrIds ?? pendingMoveSourceRef.current;

        pendingMoveDeltaRef.current = { x: 0, y: 0 };
        pendingMoveSourceRef.current = undefined;

        if (batchedDelta.x !== 0 || batchedDelta.y !== 0) {
            applyMoveSelectedNodes(batchedDelta, batchedSource);
        }
    }, [applyMoveSelectedNodes]);

    const moveSelectedNodes = useCallback((delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[]) => {
        pendingMoveDeltaRef.current = {
            x: pendingMoveDeltaRef.current.x + delta.x,
            y: pendingMoveDeltaRef.current.y + delta.y,
        };

        if (sourceNodeIdOrIds !== undefined) {
            pendingMoveSourceRef.current = sourceNodeIdOrIds;
        }

        if (moveRafRef.current !== null) {
            return;
        }

        moveRafRef.current = window.requestAnimationFrame(() => {
            moveRafRef.current = null;
            flushPendingMoveSelectedNodes();
        });
    }, [flushPendingMoveSelectedNodes]);

    const moveSelectedNodesImmediate = useCallback((delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[]) => {
        flushPendingMoveSelectedNodes(delta, sourceNodeIdOrIds);
    }, [flushPendingMoveSelectedNodes]);

    useEffect(() => {
        return () => {
            if (moveRafRef.current !== null) {
                cancelAnimationFrame(moveRafRef.current);
            }
        };
    }, []);

    const getNextCardPosition = useCallback((): { x: number; y: number } => {
        const CARD_WIDTH = 280;
        const CARD_HEIGHT = 320;
        const GAP_X = 20;
        const GAP_Y = 20;
        const MAX_WIDTH = 1600;
        const SLOT_WIDTH = CARD_WIDTH + GAP_X;
        const SLOT_HEIGHT = CARD_HEIGHT + GAP_Y;
        const columnsPerRow = Math.floor(MAX_WIDTH / SLOT_WIDTH);

        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        if (!currentCanvas) return { x: 0, y: 0 };

        const totalCards = currentCanvas.promptNodes.length + currentCanvas.imageNodes.length;
        const col = totalCards % columnsPerRow;
        const row = Math.floor(totalCards / columnsPerRow);

        return { x: col * SLOT_WIDTH, y: row * SLOT_HEIGHT };
    }, [state]);

    /**
     * Find a smart position that doesn't overlap with existing nodes.
     * Starts at target (x,y) and spirals/shifts out until free space found.
     */
    const findSmartPosition = useCallback((targetX: number, targetY: number, width: number, height: number, buffer = 20): { x: number; y: number } => {
        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        if (!currentCanvas) return { x: targetX, y: targetY };

        // Helper: Check collision
        const checkCollision = (cx: number, cy: number) => {
            // Check groups first (Large blocks)
            for (const g of currentCanvas.groups) {
                const gX = g.bounds.x;
                const gY = g.bounds.y;
                const gW = g.bounds.width;
                const gH = g.bounds.height;

                const myX = cx - width / 2; // Anchor Center Helper
                const myY = cy - height;    // Anchor Bottom Helper

                // Check Overlap
                // My: [myX, myY, width, height]
                // Group: [gX, gY, gW, gH]
                if (myX < gX + gW + buffer && myX + width + buffer > gX &&
                    myY < gY + gH + buffer && myY + height + buffer > gY) {
                    return true;
                }
            }

            // Check prompts
            for (const p of currentCanvas.promptNodes) {
                // Approximate prompt dimensions (default width 320, height ~160+)
                // Origin is Bottom Center, but stored pos is card bottom center?
                // Wait, in `layoutTree`: "nodeX = x + width/2", "positions[node.id] = {x, y}"
                // And App.tsx `getCardDimensions` logic implies stored pos is bottom center?
                // Let's assume standard card calc:
                const pW = 320;
                const pH = 200; // Roughly
                // Rect: [p.x - pW/2, p.y - pH, pW, pH]
                const px = p.position.x - pW / 2;
                const py = p.position.y - pH;

                // My Candidate Rect: [cx - width/2, cy - height, width, height]
                const myX = cx - width / 2;
                const myY = cy - height;

                if (myX < px + pW + buffer && myX + width + buffer > px &&
                    myY < py + pH + buffer && myY + height + buffer > py) {
                    return true;
                }
            }

            // Check images
            for (const img of currentCanvas.imageNodes) {
                // Check dims
                let iW = 280;
                let iH = 320;
                if (img.dimensions) {
                    const [w, h] = img.dimensions.split('x').map(Number);
                    if (w && h) {
                        const ratio = w / h;
                        iW = ratio > 1 ? 320 : (ratio < 1 ? 200 : 280);
                        iH = (iW / ratio) + 40;
                    }
                }
                const ix = img.position.x - iW / 2;
                const iy = img.position.y - iH;

                const myX = cx - width / 2;
                const myY = cy - height;

                if (myX < ix + iW + buffer && myX + width + buffer > ix &&
                    myY < iy + iH + buffer && myY + height + buffer > iy) {
                    return true;
                }
            }

            for (const workflowNode of currentCanvas.workflow?.nodes || []) {
                if (!isWorkflowUtilityNodeKind(workflowNode.kind)) continue;

                const nodeWidth = workflowNode.width || 280;
                const nodeHeight = workflowNode.height || 180;
                const nodeX = workflowNode.position.x - nodeWidth / 2;
                const nodeY = workflowNode.position.y - nodeHeight;
                const myX = cx - width / 2;
                const myY = cy - height;

                if (myX < nodeX + nodeWidth + buffer && myX + width + buffer > nodeX &&
                    myY < nodeY + nodeHeight + buffer && myY + height + buffer > nodeY) {
                    return true;
                }
            }

            return false;
        };

        // If no collision at target, return immediately
        if (!checkCollision(targetX, targetY)) return { x: targetX, y: targetY };

        // Simple Shift Strategy: Try moving Down, then Right, then Diagonal
        // Iterating shifts
        const shifts = [
            { dx: 0, dy: height + buffer }, // Down 1 slot
            { dx: width + buffer, dy: 0 },  // Right 1 slot
            { dx: -(width + buffer), dy: 0 }, // Left 1 slot
            { dx: 0, dy: -(height + buffer) }, // Up 1 slot

            { dx: width + buffer, dy: height + buffer }, // Diagonal Right Down
            { dx: -(width + buffer), dy: height + buffer }, // Diagonal Left Down

            { dx: (width + buffer) * 2, dy: 0 }, // Right 2
            { dx: 0, dy: (height + buffer) * 2 }, // Down 2
        ];

        for (const shift of shifts) {
            const sx = targetX + shift.dx;
            const sy = targetY + shift.dy;
            if (!checkCollision(sx, sy)) return { x: sx, y: sy };
        }

        // Fallback: Just put it far below
        return { x: targetX, y: targetY + height + buffer + 100 };
    }, [state]);

    /**
     * Find the grid position for the next card group.
     * Strategy: place groups left-to-right and wrap after 30 groups per row.
     * Return the bottom-center anchor position of the main prompt card.
     *
     * Card Group Layout Strategy:
     * - Each group consists of a Main Card (Prompt) and Sub Cards (Images)
     * - Groups are arranged in a grid: 30 per row, then wrap to next row
     * - Dynamic width calculation based on existing sub-cards
     */
    const findNextGroupPosition = useCallback((): { x: number; y: number } => {
        // Card-group layout constants.
        const SUB_CARD_WIDTH = 280;      // Sub-card width.
        const SUB_CARD_GAP = 16;         // Gap between sub-cards.
        const GROUP_BASE_WIDTH = 380;   // Base width when a group has a single sub-card column.
        const GROUP_HEIGHT = 600;        // Prompt height + gaps + sub-card height.
        const GAP_X = 40;                // Horizontal gap between groups.
        const GAP_Y = 80;                // Vertical gap between rows.
        const GROUPS_PER_ROW = 30;       // Maximum groups per row.

        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        if (!currentCanvas) return { x: 0, y: 200 };

        const groupCount = currentCanvas.promptNodes.length;

        // Return the initial position when there are no existing groups.
        if (groupCount === 0) {
            return { x: 0, y: 200 };
        }

        // Compute each existing group's actual width from its child-card count.
        const getGroupWidth = (promptId: string): number => {
            const childCount = currentCanvas.imageNodes.filter(
                img => img.parentPromptId === promptId
            ).length;

            // Child cards use at most two columns.
            const cols = Math.min(Math.max(childCount, 1), 2);
            const width = cols * SUB_CARD_WIDTH + (cols - 1) * SUB_CARD_GAP + 40;
            return Math.max(GROUP_BASE_WIDTH, width);
        };

        // Compute the current row and column index.
        const row = Math.floor(groupCount / GROUPS_PER_ROW);
        const col = groupCount % GROUPS_PER_ROW;

        // Compute the accumulated X offset within the current row.
        const startRowIdx = row * GROUPS_PER_ROW;
        let xOffset = 0;

        // Sum the width of every existing group in this row.
        for (let i = startRowIdx; i < groupCount; i++) {
            const prompt = currentCanvas.promptNodes[i];
            if (prompt) {
                xOffset += getGroupWidth(prompt.id) + GAP_X;
            }
        }

        // Keep the layout left-aligned.
        const startX = 0;

        // New group position = startX + accumulated offset + half the new group width.
        const newGroupWidth = GROUP_BASE_WIDTH;
        const x = startX + xOffset + newGroupWidth / 2;

        // Compute Y from the row index.
        const y = 200 + row * (GROUP_HEIGHT + GAP_Y);

        return { x, y };
    }, [state]);

    /** Group Management */
    const addGroup = useCallback((group: CanvasGroup) => {
        updateCanvas((canvas) => ({
            ...canvas,
            groups: [
                ...(canvas.groups || []),
                group.zIndex !== undefined
                    ? group
                    : {
                        ...group,
                        zIndex: Math.max(
                            0,
                            ...canvas.promptNodes.map(node => node.zIndex ?? 0),
                            ...canvas.imageNodes.map(node => node.zIndex ?? 0),
                            ...(canvas.groups || []).map(existingGroup => existingGroup.zIndex ?? 0)
                        ) + 1
                    }
            ]
        }));
    }, [updateCanvas]);

    const removeGroup = useCallback((id: string) => {
        updateCanvas((canvas) => ({
            ...canvas,
            groups: (canvas.groups || []).filter(g => g.id !== id)
        }));
    }, [updateCanvas]);

    const updateGroup = useCallback((group: CanvasGroup) => {
        updateCanvas((canvas) => ({
            ...canvas,
            groups: (canvas.groups || []).map(g => g.id === group.id ? group : g)
        }));
    }, [updateCanvas]);



    const setNodeTags = useCallback((ids: string[], tags: string[]) => {
        updateCanvas((canvas) => ({
            ...canvas,
            promptNodes: canvas.promptNodes.map(n => ids.includes(n.id) ? { ...n, tags } : n),
            imageNodes: canvas.imageNodes.map(n => ids.includes(n.id) ? { ...n, tags } : n)
        }));
    }, [updateCanvas]);

    // Track viewport-center updates with useCallback to avoid needless loops.
    const setViewportCenter = useCallback((center: { x: number; y: number }) => {
        setState(prev => ({ ...prev, viewportCenter: center }));
    }, []);

    // Migrate selected nodes to another canvas.
    const migrateNodes = useCallback((nodeIds: string[], targetCanvasId: string) => {
        setState(prev => {
            const sourceCanvas = prev.canvases.find(c => c.id === prev.activeCanvasId);
            const targetCanvas = prev.canvases.find(c => c.id === targetCanvasId);
            if (!sourceCanvas || !targetCanvas) return prev;

            // Collect the nodes to migrate.
            const promptsToMigrate = sourceCanvas.promptNodes.filter(n => nodeIds.includes(n.id));
            const imagesToMigrate = sourceCanvas.imageNodes.filter(n => nodeIds.includes(n.id));

            // If a prompt card is being moved, move its child images too.
            const childImageIds = promptsToMigrate.flatMap(p => p.childImageIds || []);
            const childImagesToMigrate = sourceCanvas.imageNodes.filter(n => childImageIds.includes(n.id) && !nodeIds.includes(n.id));

            // Compute the offset so migrated nodes land to the right of the target canvas content.
            const offsetX = targetCanvas.promptNodes.length > 0
                ? Math.max(...targetCanvas.promptNodes.map(n => n.position.x)) + 500
                : 0;

            // Update migrated node positions while preserving image URLs.
            const migratedPrompts = promptsToMigrate.map(p => ({
                ...p,
                position: { x: p.position.x + offsetX, y: p.position.y }
            }));
            const migratedImages = [...imagesToMigrate, ...childImagesToMigrate].map(img => ({
                ...img,
                position: { x: img.position.x + offsetX, y: img.position.y },
                // Preserve complete URLs so storage can persist them correctly.
                url: img.url || '',
                originalUrl: img.originalUrl || ''
            }));

            // Immediately cache migrated images in IndexedDB without blocking the UI.
            (async () => {
                try {
                    for (const img of migratedImages) {
                        // Ensure the image exists in IndexedDB.
                        const existingUrl = await getImage(img.id);
                        if (!existingUrl && (img.url || img.originalUrl || img.apiResultUrl)) {
                            const originalSource = img.originalUrl || img.apiResultUrl;
                            const urlToSave = originalSource || img.url;
                            if (urlToSave && !urlToSave.startsWith('blob:')) {
                                if (originalSource) {
                                    await saveOriginalImage(img.id, originalSource);
                                } else {
                                    await saveImage(img.id, urlToSave);
                                }
                                console.log('[MigrateNodes] Saved image ' + img.id + ' to IndexedDB');
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[MigrateNodes] Failed to save images to IndexedDB', e);
                }
            })();

            // Remove from the source canvas and add to the target canvas.
            const allMigratedImageIds = [...imagesToMigrate, ...childImagesToMigrate].map(i => i.id);
            const updatedCanvases = prev.canvases.map(c => {
                if (c.id === prev.activeCanvasId) {
                    return {
                        ...c,
                        promptNodes: c.promptNodes.filter(n => !nodeIds.includes(n.id)),
                        imageNodes: c.imageNodes.filter(n => !allMigratedImageIds.includes(n.id)),
                        lastModified: Date.now()
                    };
                }
                if (c.id === targetCanvasId) {
                    return {
                        ...c,
                        promptNodes: [...c.promptNodes, ...migratedPrompts],
                        imageNodes: [...c.imageNodes, ...migratedImages],
                        lastModified: Date.now()
                    };
                }
                return c;
            });

            console.log('[MigrateNodes] Migrated', migratedPrompts.length, 'prompts,', migratedImages.length, 'images to canvas', targetCanvasId);
            return { ...prev, canvases: updatedCanvases, selectedNodeIds: [] };
        });
    }, []);

    const mergeCanvasInto = useCallback((sourceCanvasId: string, targetCanvasId: string, options?: { deleteSource?: boolean }) => {
        const deleteSource = options?.deleteSource !== false;
        let summary = {
            movedPrompts: 0,
            movedImages: 0,
            deletedSource: false
        };

        setState(prev => {
            if (sourceCanvasId === targetCanvasId) {
                return prev;
            }

            const sourceCanvas = prev.canvases.find(c => c.id === sourceCanvasId);
            const targetCanvas = prev.canvases.find(c => c.id === targetCanvasId);
            if (!sourceCanvas || !targetCanvas) {
                return prev;
            }

            const targetPromptIds = new Set(targetCanvas.promptNodes.map(node => node.id));
            const targetImageIds = new Set(targetCanvas.imageNodes.map(node => node.id));
            const targetGroupIds = new Set((targetCanvas.groups || []).map(group => group.id));
            const targetMaxX = Math.max(
                0,
                ...targetCanvas.promptNodes.map(node => node.position.x || 0),
                ...targetCanvas.imageNodes.map(node => node.position.x || 0)
            );
            const offsetX = targetCanvas.promptNodes.length > 0 || targetCanvas.imageNodes.length > 0 ? targetMaxX + 500 : 0;

            const movedPrompts = sourceCanvas.promptNodes
                .filter(node => !targetPromptIds.has(node.id))
                .map(node => ({
                    ...node,
                    position: { x: node.position.x + offsetX, y: node.position.y }
                }));

            const movedImages = sourceCanvas.imageNodes
                .filter(node => !targetImageIds.has(node.id))
                .map(node => ({
                    ...node,
                    canvasId: targetCanvasId,
                    position: { x: node.position.x + offsetX, y: node.position.y }
                }));

            const movedNodeIds = new Set<string>([
                ...movedPrompts.map(node => node.id),
                ...movedImages.map(node => node.id)
            ]);

            const movedGroups = (sourceCanvas.groups || [])
                .filter(group => !targetGroupIds.has(group.id))
                .map(group => ({
                    ...group,
                    nodeIds: (group.nodeIds || []).filter(nodeId => movedNodeIds.has(nodeId))
                }))
                .filter(group => group.nodeIds.length > 0);

            summary = {
                movedPrompts: movedPrompts.length,
                movedImages: movedImages.length,
                deletedSource: deleteSource
            };

            const updatedCanvases = prev.canvases
                .map(canvas => {
                    if (canvas.id === targetCanvasId) {
                        return {
                            ...canvas,
                            promptNodes: [...canvas.promptNodes, ...movedPrompts],
                            imageNodes: [...canvas.imageNodes, ...movedImages],
                            groups: [...(canvas.groups || []), ...movedGroups],
                            lastModified: Date.now()
                        };
                    }

                    if (canvas.id === sourceCanvasId && !deleteSource) {
                        return {
                            ...canvas,
                            promptNodes: [],
                            imageNodes: [],
                            groups: [],
                            lastModified: Date.now()
                        };
                    }

                    return canvas;
                })
                .filter(canvas => !(deleteSource && canvas.id === sourceCanvasId));

            return {
                ...prev,
                canvases: updatedCanvases,
                activeCanvasId: prev.activeCanvasId === sourceCanvasId && deleteSource ? targetCanvasId : prev.activeCanvasId,
                selectedNodeIds: []
            };
        });

        return summary;
    }, []);

    const cleanupInvalidCards = useCallback((canvasId?: string) => {
        let summary = {
            removedPrompts: 0,
            removedImages: 0,
            removedGroups: 0
        };

        setState(prev => {
            const targetCanvasId = canvasId || prev.activeCanvasId;
            const targetCanvas = prev.canvases.find(c => c.id === targetCanvasId);
            if (!targetCanvas) {
                return prev;
            }

            const promptIds = new Set(targetCanvas.promptNodes.map(node => node.id));
            const promptIdsToRemove = new Set(
                targetCanvas.promptNodes
                    .filter(node => !node.isGenerating && !!node.error && (node.childImageIds?.length || 0) === 0)
                    .map(node => node.id)
            );

            const imageIdsToRemove = new Set(
                targetCanvas.imageNodes
                    .filter(node => {
                        const hasBrokenParent = !!node.parentPromptId && !node.orphaned && !promptIds.has(node.parentPromptId);
                        const hasBrokenContent = !node.isGenerating && !node.url && !node.originalUrl && !node.apiResultUrl;
                        const hasErrorState = !node.isGenerating && !!node.error;
                        return hasBrokenParent || hasBrokenContent || hasErrorState;
                    })
                    .map(node => node.id)
            );

            const nextPromptNodes = targetCanvas.promptNodes
                .filter(node => !promptIdsToRemove.has(node.id))
                .map(node => ({
                    ...node,
                    childImageIds: (node.childImageIds || []).filter(childId => !imageIdsToRemove.has(childId))
                }));

            const nextPromptIds = new Set(nextPromptNodes.map(node => node.id));
            const nextImageNodes = targetCanvas.imageNodes.filter(node => {
                if (imageIdsToRemove.has(node.id)) {
                    return false;
                }
                if (!node.orphaned && node.parentPromptId && !nextPromptIds.has(node.parentPromptId)) {
                    imageIdsToRemove.add(node.id);
                    return false;
                }
                return true;
            });

            const workflow = canvasToWorkflow(targetCanvas);
            const validLegacyNodeIds = new Set<string>([
                ...nextPromptNodes.map(node => node.id),
                ...nextImageNodes.map(node => node.id),
            ]);
            const nextWorkflowNodes = workflow.nodes.map((node): WorkflowNode => {
                if (!isWorkflowUtilityNodeKind(node.kind)) {
                    return node;
                }

                const sourceNodeIds = getWorkflowSourceNodeIds(node).filter(sourceId => validLegacyNodeIds.has(sourceId));
                const outputNodeIds = Array.isArray((node.data as { outputNodeIds?: unknown } | undefined)?.outputNodeIds)
                    ? ((node.data as { outputNodeIds?: unknown[] }).outputNodeIds || []).filter((outputId): outputId is string => (
                        typeof outputId === 'string' && validLegacyNodeIds.has(outputId)
                    ))
                    : undefined;

                return {
                    ...node,
                    data: {
                        ...node.data,
                        sourceNodeIds,
                        ...(outputNodeIds ? { outputNodeIds } : {}),
                    },
                } as WorkflowNode;
            });
            const validWorkflowNodeIds = new Set(nextWorkflowNodes.map(node => node.id));
            const nextWorkflowEdges = dedupeWorkflowEdges(
                workflow.edges.filter(edge => (
                    validWorkflowNodeIds.has(edge.from)
                    && validWorkflowNodeIds.has(edge.to)
                    && !promptIdsToRemove.has(edge.from)
                    && !promptIdsToRemove.has(edge.to)
                    && !imageIdsToRemove.has(edge.from)
                    && !imageIdsToRemove.has(edge.to)
                ))
            );

            const syncedCanvas = syncCanvasCompatibility({
                ...targetCanvas,
                promptNodes: nextPromptNodes,
                imageNodes: nextImageNodes,
                groups: (targetCanvas.groups || []).filter(group =>
                    (group.nodeIds || []).some(nodeId => (
                        validLegacyNodeIds.has(nodeId) || validWorkflowNodeIds.has(nodeId)
                    ))
                ),
                workflow: {
                    ...workflow,
                    nodes: nextWorkflowNodes,
                    edges: nextWorkflowEdges,
                },
                lastModified: Date.now(),
            });

            const remainingNodeIds = new Set<string>([
                ...nextPromptNodes.map(node => node.id),
                ...nextImageNodes.map(node => node.id),
                ...((syncedCanvas.workflow?.nodes || []).map(node => node.id)),
            ]);
            const nextGroups = syncedCanvas.groups || [];

            summary = {
                removedPrompts: targetCanvas.promptNodes.length - nextPromptNodes.length,
                removedImages: targetCanvas.imageNodes.length - nextImageNodes.length,
                removedGroups: (targetCanvas.groups || []).length - nextGroups.length
            };

            if (summary.removedPrompts === 0 && summary.removedImages === 0 && summary.removedGroups === 0) {
                return prev;
            }

            return {
                ...prev,
                canvases: prev.canvases.map(canvas =>
                    canvas.id === targetCanvasId
                        ? syncedCanvas
                        : canvas
                ),
                selectedNodeIds: prev.selectedNodeIds.filter(nodeId => remainingNodeIds.has(nodeId))
            };
        });

        return summary;
    }, []);

    // [Performance] Cache the context value so high-frequency state like viewportCenter does not rerender every consumer.
    const contextValue = React.useMemo(() => ({
        state, activeCanvas, createCanvas, switchCanvas, deleteCanvas, renameCanvas,
        addPromptNode, updatePromptNode, addImageNodes, updatePromptNodePosition, updateImageNodePosition, updateImageNodeDimensions, updateImageNode,
        updateNodes, // Batch update
        addWorkflowNode, updateWorkflowNode, updateWorkflowNodePosition, deleteWorkflowNode,
        deleteImageNode, deletePromptNode, linkNodes, unlinkNodes, clearAllData, canCreateCanvas,
        undo, redo, pushToHistory, canUndo, canRedo, arrangeAllNodes, getNextCardPosition,
        connectLocalFolder, disconnectLocalFolder, changeLocalFolder, refreshLocalFolder,
        isConnectedToLocal: !!state.fileSystemHandle,
        currentFolderName: state.folderName,
        selectedNodeIds: state.selectedNodeIds || [],
        selectNodes,
        clearSelection,
        bringNodesToFront,
        moveSelectedNodes,
        moveSelectedNodesImmediate,
        findSmartPosition,
        findNextGroupPosition,
        addGroup,
        removeGroup,
        updateGroup,
        setNodeTags,
        isReady: isShellReady,
        setViewportCenter,
        migrateNodes,
        mergeCanvasInto,
        cleanupInvalidCards,
        urgentUpdatePromptNode
    }), [
        state, activeCanvas, createCanvas, switchCanvas, deleteCanvas, renameCanvas,
        addPromptNode, updatePromptNode, addImageNodes, updatePromptNodePosition, updateImageNodePosition, updateImageNodeDimensions, updateImageNode,
        updateNodes,
        addWorkflowNode, updateWorkflowNode, updateWorkflowNodePosition, deleteWorkflowNode,
        deleteImageNode, deletePromptNode, linkNodes, unlinkNodes, clearAllData, canCreateCanvas,
        undo, redo, pushToHistory, canUndo, canRedo, arrangeAllNodes, getNextCardPosition,
        connectLocalFolder, disconnectLocalFolder, changeLocalFolder, refreshLocalFolder,
        isLoading, selectNodes, clearSelection, bringNodesToFront, moveSelectedNodes, moveSelectedNodesImmediate, findSmartPosition, findNextGroupPosition, addGroup, removeGroup, updateGroup, setNodeTags, setViewportCenter, migrateNodes, mergeCanvasInto, cleanupInvalidCards, urgentUpdatePromptNode
    ]);

    return (
        <CanvasContext.Provider value={contextValue}>
            {children}
        </CanvasContext.Provider>
    );
};

export const useCanvas = () => {
    const context = useContext(CanvasContext);
    if (!context) throw new Error('useCanvas must be used within CanvasProvider');
    return context;
};
