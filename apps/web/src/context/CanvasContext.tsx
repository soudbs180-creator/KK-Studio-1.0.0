import React, { useContext, useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { type Canvas, type PromptNode, type GeneratedImage, AspectRatio, type CanvasGroup, type CanvasDrawing, type CanvasNoteNode, GenerationMode, KnownModel, type WorkflowNode, type WorkflowPanelNode } from '../types';
import { startTransition } from 'react';
import { shouldEnableWorkspaceCloudSync } from '../app/kkaiFeatureFlags';
import { saveImage, saveOriginalImage, getImage, getImageByQuality, deleteImage, clearAllImages, normalizePersistableMediaSource } from '../services/storage/imageStorage';
import { fileSystemService } from '../services/storage/fileSystemService';
import { dataURLToBlob as base64ToBlob, safeRevokeBlobUrl } from '../utils/blobUtils';
import { calculateImageHash } from '../utils/imageUtils';
import { notificationService, notify } from '../services/system/notificationService';
import { traceLocalPerformance } from '../services/system/localPerformanceTrace';
import { logError, logInfo } from '../services/system/systemLogService';
import { ImageQuality, QUALITY_CONFIGS, compressImageToQuality, getQualityStorageId } from '../services/image/imageQuality';
import { getLocalFolderHandle, getStorageMode, restoreLocalFolderConnection, setLocalFolderHandle } from '../services/storage/storagePreference';
import { canvasToWorkflow } from '../workflow/adapters/canvasToWorkflow';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';
import { clampGenerationDurationMs } from '../utils/timeUtils';
import { buildGeneratedImageBatchPositions } from '../utils/generatedImageLayout';
import {
    getReferenceImageLookupIds,
    normalizeReferenceImagesStorage,
    toReferenceImageDataUrl,
} from '../utils/referenceImageStorage';
import {
    buildCanvasLocalPersistenceSignature,
    clearPersistedCanvasStorageSnapshot,
    restoreCanvasStateFromLocalStorage,
} from './canvasPersistence';
import { useCanvasCloudSync } from './useCanvasCloudSync';
import { useCanvasFileSystemPersistence } from './useCanvasFileSystemPersistence';
import { useCanvasLocalPersistence } from './useCanvasLocalPersistence';
import {
    DEFAULT_CANVAS,
    DEFAULT_STATE,
    MAX_CANVASES,
    CanvasContext,
    CanvasStartupStatusContext,
    createCanvasWorkflow,
    generateId,
    type ArrangeMode,
    type CanvasState,
} from './canvasContextState';
import { syncCanvasCompatibility } from './canvasCompatibility';
import { resolvePromptChildImageIds } from './canvasPromptChildImages';
import { resolveCanvasSelectionIds, type CanvasSelectionMode } from './canvasSelection';
import { hydrateRecoveredMediaCacheEntry, resolveOriginalPersistSourceForDisk } from './canvasMediaRecovery';
import { mergeCanvases, resolvePreferredActiveCanvasId } from './canvasMerge';
import { mergeCanvasIntoState } from './canvasMergeInto';
import { arrangeSelectedGroupedNodes, arrangeSelectedRootNodes, arrangeSingleSelectedPromptChildren } from './canvasArrangeSelection';
import { createCanvasCardPresentation, resolvePromptCardKind } from './canvasPresentationMigration';
import { convertCanvasDrawingsToNote, restoreCanvasNoteToDrawings } from './canvasNotes.ts';
import { createCanvasCardNodes, type CanvasCardFactoryResult, type CanvasCreateCardInput } from './canvasCardFactory.ts';
import { getCardDimensions } from '../utils/styleUtils';
import { getCanvasSceneBoundsForNodeIds, unionCanvasSceneBounds } from '../canvas/canvasSceneGeometry.ts';
import { requestCanvasBoundsFocus } from '../canvas/canvasViewportEvents.ts';
import { rasterizeCanvasNote } from '../canvas/canvasNoteRasterizer.ts';
import { cleanupInvalidCanvasCardsForCanvas, type CleanupInvalidCardsSummary } from './canvasCleanup';
import { resolveNextCardPosition, resolveNextGroupPosition, resolveSmartCanvasPosition } from './canvasPlacement';
import { bringCanvasNodesToFront } from './canvasLayering';
import { addCanvasGroupToCanvas, removeCanvasGroupFromCanvas, updateCanvasGroupInCanvas } from './canvasGroups';
import { moveSelectedCanvasNodes, type CanvasMoveOptions } from './canvasMovement';
import { setCanvasNodeTags } from './canvasTags';
import {
    addCanvasPromptNode,
    applyCanvasNodeBatchUpdates,
    updateCanvasPromptNode,
    updateCanvasImageNode,
    updateCanvasImageNodeDimensions
} from './canvasNodeUpdates';
import {
    updateCanvasImageNodePosition,
    updateCanvasPromptNodePosition
} from './canvasPositionUpdates';
import {
    deleteCanvasImageNode,
    deleteCanvasPromptNode,
    linkCanvasPromptToImage,
    unlinkCanvasPromptFromImage
} from './canvasPromptImageLinks';
import {
    addCanvasWorkflowNode,
    deleteCanvasWorkflowNode,
    updateCanvasWorkflowNode,
    updateCanvasWorkflowNodePosition
} from './canvasWorkflowUpdates';
import {
    buildPersistedImageRecoverySignature,
    buildPromptRecoveryEntries,
    resolveImageRecoveryUrlFromMetadata,
    resolvePromptRecoveryEntrySource,
    type PromptRecoveryEntry,
} from './canvasPersistedImageRecovery';
import {
    hasUnrecoverableSyncGenerationInFlight,
    markInterruptedSyncPromptGenerations,
    normalizeCanvasPromptRecovery,
} from './canvasPromptRecovery';
import { resolveModelDisplayName } from '../utils/modelDisplayName';
import { isPhoneResponsiveWidth } from '../utils/responsiveSurface';
import { getAllTasks, type PersistedTask } from '../services/persistence/taskPersistence';
import {
    buildImageResultIdentity,
    buildTaskResultIdentity,
    normalizePersistentResultUrl,
} from '../utils/imageResultPersistence';
import { useAuth } from './AuthContext';
import {
    getLatestStartupSnapshot,
    isStartupStageReady,
    subscribeStartupSnapshot,
    type AppStartupStage,
} from '../services/system/appStartup';

export type { ArrangeMode, CanvasContextType, CanvasState, SubCardLayout } from './canvasContextState';

const STORAGE_KEY = 'kk_studio_canvas_state';
const LOCAL_FOLDER_REFRESH_INTERVAL_MS = 60000;
const LOCAL_FOLDER_IDLE_GRACE_MS = 45000;
const STARTUP_GENERATED_PREVIEW_LIMIT = 5;
const STARTUP_DATA_URL_MIGRATION_LIMIT = 50;
const LARGE_CANVAS_DATA_URL_MIGRATION_NODE_THRESHOLD = 1000;
const LARGE_CANVAS_STARTUP_DATA_URL_MIGRATION_LIMIT = 5;
const LARGE_CANVAS_DATA_URL_MIGRATION_DELAY_MS = 30000;
const DATA_URL_MIGRATION_BATCH_SIZE = 5;
const LARGE_CANVAS_DATA_URL_MIGRATION_BATCH_SIZE = 1;
const PERSISTED_IMAGE_RECOVERY_LARGE_CANVAS_THRESHOLD = 1000;
const PERSISTED_IMAGE_RECOVERY_LARGE_IMAGE_LIMIT = 48;

const isLatestStartupStageReady = (requiredStage: AppStartupStage): boolean => (
    isStartupStageReady(getLatestStartupSnapshot().stage, requiredStage)
);
const PERSISTED_IMAGE_RECOVERY_LARGE_PROMPT_LIMIT = 48;
const LARGE_CANVAS_LOCAL_PERSISTENCE_NODE_THRESHOLD = 1000;
const LARGE_CANVAS_DEBOUNCED_SAVE_DELAY_MS = 30000;
const LARGE_CANVAS_IDLE_SAVE_TIMEOUT_MS = 10000;

const normalizeRestoredCanvasState = (restoredState: CanvasState): CanvasState => {
    const nextState: CanvasState = {
        ...DEFAULT_STATE,
        ...restoredState,
        canvases: Array.isArray(restoredState.canvases) && restoredState.canvases.length > 0
            ? restoredState.canvases
            : DEFAULT_STATE.canvases,
        history: restoredState.history || {},
        selectedNodeIds: restoredState.selectedNodeIds || [],
        subCardLayoutMode: restoredState.subCardLayoutMode || DEFAULT_STATE.subCardLayoutMode,
        viewportCenter: restoredState.viewportCenter || DEFAULT_STATE.viewportCenter,
    };

    console.log('[CanvasProvider] 解析成功:', `画布数: ${nextState.canvases?.length || 0}`);

    nextState.canvases = nextState.canvases.map(canvas => ({
        ...canvas,
        imageNodes: (canvas.imageNodes || []).map(img => ({
            ...img,
            generationTime: clampGenerationDurationMs(img.generationTime),
            canvasId: img.canvasId || canvas.id,
            parentPromptId: img.parentPromptId || '',
            prompt: img.prompt || '',
            dimensions: img.dimensions || "1024x1024",
            aspectRatio: img.aspectRatio || AspectRatio.SQUARE,
            model: img.model || KnownModel.IMAGEN_4
        })),
    })).map(normalizeCanvasPromptRecovery);

    // File system handles are restored separately from IndexedDB.
    nextState.fileSystemHandle = null;

    return nextState;
};

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, session, isTempUser } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    // 简体中文注释：标记当前首次初始化（包含本地物理文件夹数据和 IndexedDB）是否已经完全恢复完毕
    const [isInitRestored, setIsInitRestored] = useState(false);
    const [isShellReady, setIsShellReady] = useState(false);
    const [state, setState] = useState<CanvasState>(DEFAULT_STATE);
    if (typeof window !== 'undefined' && (window as any).__KK_LARGE_CANVAS_SMOKE__) {
        const active = state.canvases.find(canvas => canvas.id === state.activeCanvasId) || state.canvases[0];
        console.log(`[Workspace10k] canvas-provider:render:start loading=${isLoading} restored=${isInitRestored} nodes=${(active?.promptNodes?.length || 0) + (active?.imageNodes?.length || 0)}`);
    }

    // Track in-flight save tasks to reduce data loss during refresh.
    const pendingSavesRef = useRef<Set<Promise<void>>>(new Set());
    const stateRef = useRef(state);
    const lastUserActivityAtRef = useRef<number>(Date.now());
    const cloudLoadStartedRef = useRef(false);
    const viewportCenterRef = useRef(DEFAULT_STATE.viewportCenter);

    // 简体中文注释：防回退黄金法则，保存首次画布初始化加载是否成功完成的标志，防止重复执行 init() 造成进度回退
    const hasLoadedSuccessRef = useRef(false);
    // 简体中文注释：标记当前 Provider 挂载生命周期内 init 是否已经被触发执行过，防止 double render 造成并发和状态错乱
    const isInitExecutedRef = useRef(false);
    const startupLoadRunIdRef = useRef(0);

    useEffect(() => {
        stateRef.current = state;
        viewportCenterRef.current = state.viewportCenter || viewportCenterRef.current;
    }, [state]);

    // 简体中文注释：水合激活与 sessionStorage 缓存读取。
    // 在挂载后 useEffect 中读取，确保在客户端 Mount 完毕后才改变状态，完美防范 Hydration Mismatch 引起的全页强制刷新
    useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('kk_canvas_loaded') === 'true') {
            setIsLoading(false);
            setLoadingProgress(100);
            hasLoadedSuccessRef.current = true;
        }
    }, []);

    const pushLoadingProgress = useCallback((nextProgress: number, options?: { reset?: boolean; runId?: number }) => {
        if (options?.runId !== undefined && startupLoadRunIdRef.current !== options.runId) {
            return;
        }
        const normalizedProgress = Math.max(0, Math.min(100, Math.floor(Number.isFinite(nextProgress) ? nextProgress : 0)));
        setLoadingProgress(prev => options?.reset ? normalizedProgress : Math.max(prev, normalizedProgress));
    }, []);

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

    const applyStartupHydratedImages = useCallback((hydratedImageMap: Map<string, string>) => {
        if (hydratedImageMap.size === 0) {
            return;
        }

        startTransition(() => {
            setState(prev => {
                let stateChanged = false;

                const canvases = prev.canvases.map(c => {
                    let canvasChanged = false;

                    const imageNodes = c.imageNodes.map(img => {
                        const storedUrl = hydratedImageMap.get(img.storageId || img.id);
                        let displayUrl = img.url || '';
                        let errorMsg = img.error;
                        let originalUrl = img.originalUrl;

                        if (storedUrl) {
                            if (storedUrl.startsWith('data:')) {
                                const blob = base64ToBlob(storedUrl);
                                displayUrl = URL.createObjectURL(blob);
                            } else {
                                displayUrl = storedUrl;
                            }
                            if (errorMsg === '本地临时图片已失效') {
                                errorMsg = undefined;
                            }
                        } else {
                            if (displayUrl.startsWith('blob:') || (img.originalUrl && img.originalUrl.startsWith('blob:'))) {
                                displayUrl = '';
                                errorMsg = '本地临时图片已失效';
                            }
                        }

                        originalUrl = displayUrl === '' && errorMsg === '本地临时图片已失效'
                            ? ''
                            : (img.originalUrl || img.apiResultUrl);

                        if (
                            displayUrl === img.url
                            && originalUrl === img.originalUrl
                            && errorMsg === img.error
                        ) {
                            return img;
                        }

                        canvasChanged = true;
                        return {
                            ...img,
                            url: displayUrl,
                            originalUrl,
                            error: errorMsg
                        };
                    });

                    const promptNodes = c.promptNodes.map(pn => {
                        const referenceImages = pn.referenceImages;
                        if (!referenceImages || referenceImages.length === 0) {
                            return pn;
                        }

                        let promptChanged = false;
                        const nextReferenceImages = referenceImages.map(ref => {
                            const storedUrl = hydratedImageMap.get(ref.storageId || ref.id);
                            if (storedUrl) {
                                let finalData = storedUrl;
                                let finalMime = ref.mimeType || 'image/png';

                                const corruptedMatch = storedUrl.match(/^data:.*;base64,(http.*|blob:.*)$/);
                                if (corruptedMatch) {
                                    console.log('[CanvasContext] Recovering corrupted URL:', corruptedMatch[1]);
                                    finalData = corruptedMatch[1];
                                } else if (storedUrl.startsWith('data:')) {
                                    const matches = storedUrl.match(/^data:(.+);base64,(.+)$/);
                                    if (matches) {
                                        finalMime = matches[1];
                                    }
                                }

                                if (finalData.startsWith('data:') || finalData.startsWith('http') || finalData.startsWith('blob:') || finalData.length > 20) {
                                    if (finalMime === ref.mimeType && finalData === ref.data) {
                                        return ref;
                                    }
                                    promptChanged = true;
                                    return { ...ref, mimeType: finalMime, data: finalData };
                                }
                            }
                            return ref;
                        });

                        if (!promptChanged) {
                            return pn;
                        }

                        canvasChanged = true;
                        return {
                            ...pn,
                            referenceImages: nextReferenceImages,
                        };
                    });

                    if (!canvasChanged) {
                        return c;
                    }

                    stateChanged = true;
                    return syncCanvasCompatibility({
                        ...c,
                        imageNodes,
                        promptNodes,
                    });
                });

                if (!stateChanged) {
                    return prev;
                }

                return {
                    ...prev,
                    canvases,
                };
            });
        });
    }, []);

    const hydrateStartupPreviewImages = useCallback(async (startupState: CanvasState, onProgress?: (pct: number) => void) => {
        // 简体中文注释：通知图片加载已开始
        onProgress?.(30);
        console.log('[CanvasContext] Starting optimized image loading...');

        // Collect the image IDs required by the current state.
        const requiredImageIds = new Set<string>();
        startupState.canvases.forEach(c => {
            c.imageNodes.forEach(img => {
                requiredImageIds.add(img.storageId || img.id);
            });
            c.promptNodes.forEach(pn => {
                if (pn.referenceImages) {
                    pn.referenceImages.forEach(ref => {
                        requiredImageIds.add(ref.storageId || ref.id);
                    });
                }
            });
        });

        console.log(`[CanvasContext] Found ${requiredImageIds.size} images needed in current state`);

        const referenceImageIds = new Set<string>();
        const generatedImageIds = new Set<string>();

        startupState.canvases.forEach(c => {
            c.imageNodes.forEach(img => {
                generatedImageIds.add(img.storageId || img.id);
            });
            c.promptNodes.forEach(pn => {
                if (pn.referenceImages) {
                    pn.referenceImages.forEach(ref => {
                        referenceImageIds.add(ref.storageId || ref.id);
                    });
                }
            });
        });

        let generatedIdsArray = Array.from(generatedImageIds);

        const viewportX = startupState.viewportCenter.x;
        const viewportY = startupState.viewportCenter.y;

        // 简体中文注释：通过提前构建 lookupId 到 imageNode 的映射消除嵌套 find 带来的 O(n²) 查找
        const imageNodeByLookupId = new Map<string, GeneratedImage>();
        startupState.canvases.forEach(c => {
            c.imageNodes.forEach(img => {
                const lookupId = img.storageId || img.id;
                if (lookupId) {
                    imageNodeByLookupId.set(lookupId, img);
                }
            });
        });

        const imagesWithDistance = generatedIdsArray.map(id => {
            const node = imageNodeByLookupId.get(id);
            let minDistance = Infinity;
            if (node) {
                const dx = node.position.x - viewportX;
                const dy = node.position.y - viewportY;
                minDistance = Math.sqrt(dx * dx + dy * dy);
            }
            return { id, distance: minDistance };
        });

        imagesWithDistance.sort((a, b) => a.distance - b.distance);
        const nearestGeneratedIds = imagesWithDistance.slice(0, STARTUP_GENERATED_PREVIEW_LIMIT).map(item => item.id);
        const skippedGeneratedHydrationCount = Math.max(0, imagesWithDistance.length - nearestGeneratedIds.length);
        generatedIdsArray = nearestGeneratedIds;

        const generatedPreviewMap = new Map<string, string>();
        if (generatedIdsArray.length > 0) {
            const generatedPreviewResults = await Promise.all(
                generatedIdsArray.map((id) => getImageByQuality(id, ImageQuality.MICRO))
            );

            generatedIdsArray.forEach((id, index) => {
                const url = generatedPreviewResults[index];
                if (url) {
                    generatedPreviewMap.set(id, url);
                }
            });

            if (generatedPreviewMap.size > 0) {
                applyStartupHydratedImages(generatedPreviewMap);
            }
        }

        // 简体中文注释：首屏图片加载完成，前台加载任务快速结束，进度推进至 45%
        onProgress?.(45);

        // 简体中文注释：将非首屏的其它图片及数据迁移等耗时较长、非核心的任务改到后台异步非阻塞执行
        void (async () => {
            try {
                if (skippedGeneratedHydrationCount > 0) {
                    console.log(`[CanvasContext] Large generated image set (${generatedImageIds.size}); hydrated ${generatedIdsArray.length} nearest previews and deferred ${skippedGeneratedHydrationCount} images to visible-card scheduling`);
                }
                console.log(`[CanvasContext] Loading ${referenceImageIds.size} reference images + ${generatedIdsArray.length} nearest generated previews`);

                const imageMap = new Map<string, string>(generatedPreviewMap);
                const finalHydrationMap = new Map<string, string>();
                const imageIdsArray = Array.from(referenceImageIds);
                const BATCH_SIZE = 5;

                for (let i = 0; i < imageIdsArray.length; i += BATCH_SIZE) {
                    const batch = imageIdsArray.slice(i, i + BATCH_SIZE);
                    const batchPromises = batch.map(id => getImageByQuality(id, ImageQuality.MICRO));
                    const batchResults = await Promise.all(batchPromises);

                    let batchUpdated = false;
                    batch.forEach((id, index) => {
                        const url = batchResults[index];
                        if (url) {
                            imageMap.set(id, url);
                            finalHydrationMap.set(id, url);
                            batchUpdated = true;
                        }
                    });

                    if (batchUpdated) {
                        applyStartupHydratedImages(finalHydrationMap);
                    }

                    // 简体中文注释：根据批次计算真实的参考图加载进度百分比（从 45% 爬升至 80%）
                    const batchPct = 45 + Math.round((Math.min(i + BATCH_SIZE, imageIdsArray.length) / Math.max(imageIdsArray.length, 1)) * 35);
                    onProgress?.(batchPct);

                    console.log(`[CanvasContext] Background Loaded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(imageIdsArray.length / BATCH_SIZE)} (${imageMap.size}/${imageIdsArray.length})`);
                }

                console.log(`[CanvasContext] Startup media hydration loaded ${imageMap.size} images; deferred ${skippedGeneratedHydrationCount} generated images`);

                const startupDeferredImageCount = Math.max(0, requiredImageIds.size - imageMap.size);
                if (startupDeferredImageCount > 0) {
                    console.debug(`[CanvasContext] ${startupDeferredImageCount} images left for visible-card or recovery scheduling`);
                }

                let needsMigration = false;
                const imagesToMigrate: { id: string; url: string }[] = [];
                let skippedGeneratedDataUrlMigrationCount = 0;
                const startupCanvasNodeCount = startupState.canvases.reduce((total, canvas) => (
                    total + (canvas.promptNodes?.length || 0) + (canvas.imageNodes?.length || 0)
                ), 0);
                const isLargeStartupCanvas = startupCanvasNodeCount > LARGE_CANVAS_DATA_URL_MIGRATION_NODE_THRESHOLD;
                const startupDataUrlMigrationLimit = isLargeStartupCanvas
                    ? LARGE_CANVAS_STARTUP_DATA_URL_MIGRATION_LIMIT
                    : STARTUP_DATA_URL_MIGRATION_LIMIT;

                startupState.canvases.forEach(c => {
                    c.imageNodes.forEach(img => {
                        if (img.url && img.url.startsWith('data:') && !imageMap.has(img.id)) {
                            if (imagesToMigrate.length >= startupDataUrlMigrationLimit) {
                                skippedGeneratedDataUrlMigrationCount += 1;
                                return;
                            }
                            imagesToMigrate.push({ id: img.id, url: img.url });
                            needsMigration = true;
                        }
                    });

                    c.promptNodes.forEach(pn => {
                        if (pn.referenceImages) {
                            pn.referenceImages.forEach(ref => {
                                const lookupIds = getReferenceImageLookupIds(ref);
                                if (ref.data && lookupIds.some((lookupId) => !imageMap.has(lookupId))) {
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

                if (skippedGeneratedDataUrlMigrationCount > 0) {
                    console.log(`[CanvasContext] Deferred ${skippedGeneratedDataUrlMigrationCount} data URL image migrations beyond the startup cap`);
                }

                if (needsMigration) {
                    const runDataUrlMigration = async () => {
                        console.log(`[CanvasContext] Found ${imagesToMigrate.length} images to migrate. Starting background non-blocking migration...`);
                        let migratedCount = 0;
                        const batchSize = isLargeStartupCanvas
                            ? LARGE_CANVAS_DATA_URL_MIGRATION_BATCH_SIZE
                            : DATA_URL_MIGRATION_BATCH_SIZE;
                        const migrationHydrationMap = new Map<string, string>();
                        for (let i = 0; i < imagesToMigrate.length; i += batchSize) {
                            const batch = imagesToMigrate.slice(i, i + batchSize);
                            await Promise.all(batch.map(async (img) => {
                                try {
                                    await saveImage(img.id, img.url);
                                    imageMap.set(img.id, img.url);
                                    migrationHydrationMap.set(img.id, img.url);
                                } catch (err) {
                                    console.error(`[CanvasContext] Background migration failed for ${img.id}:`, err);
                                }
                            }));
                            migratedCount += batch.length;
                            const migratePct = 80 + Math.round((migratedCount / imagesToMigrate.length) * 10);
                            onProgress?.(migratePct);
                            if (isLargeStartupCanvas) {
                                await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
                            }
                        }
                        if (migrationHydrationMap.size > 0) {
                            applyStartupHydratedImages(migrationHydrationMap);
                        }
                        console.log(`[CanvasContext] Background migration of ${imagesToMigrate.length} images completed.`);
                    };

                    if (isLargeStartupCanvas) {
                        console.log(`[CanvasContext] Large canvas data URL migration scheduled after startup for ${imagesToMigrate.length} images`);
                        window.setTimeout(() => {
                            void runDataUrlMigration().catch((err) => {
                                console.error('[CanvasContext] Delayed large-canvas data URL migration failed:', err);
                            });
                        }, LARGE_CANVAS_DATA_URL_MIGRATION_DELAY_MS);
                    } else {
                        await runDataUrlMigration();
                    }
                }
            } catch (err) {
                console.error('[CanvasContext] Background image recovery error:', err);
            } finally {
                // 简体中文注释：后台完全收尾，将进度推至 90%
                onProgress?.(90);
            }
        })();
    }, [applyStartupHydratedImages]);

    // Load image URLs from IndexedDB AND Restore Folder Handle
    useEffect(() => {
        if (!isShellReady) return;

        const init = async () => {
            // 简体中文注释：如果当前挂载周期内已经开始或运行过 init()，直接跳过，防止 double render 造成重复加载和时序冲突
            if (isInitExecutedRef.current) {
                return;
            }
            isInitExecutedRef.current = true;

            const isSilent = typeof window !== 'undefined' && sessionStorage.getItem('kk_canvas_loaded') === 'true';

            // 简体中文注释：启动减速缓动假进度条定时器，使首次加载在前中期顺滑步进，后期无限逼近 99.9% 且绝不卡死
            let progress = isSilent ? 100 : 0;
            let progressTimer: any = null;

            if (!isSilent) {
                progressTimer = setInterval(() => {
                    let delta = 0;
                    if (progress < 60) {
                        // 前期（0 - 60%）：较快步进
                        delta = Math.random() * 6 + 4;
                    } else if (progress < 85) {
                        // 中期（60% - 85%）：中等速度减速步进
                        delta = Math.random() * 1.5 + 0.5;
                    } else if (progress < 95) {
                        // 后期（85% - 95%）：极慢步进
                        delta = Math.random() * 0.3 + 0.1;
                    } else if (progress < 99.8) {
                        // 极限期（95% - 99.8%）：微幅移动，给用户提供系统依然在工作的持续动态反馈，杜绝卡在 99 零反应
                        delta = Math.random() * 0.05 + 0.01;
                    } else {
                        // 99.8% 以上极微幅增长
                        delta = 0.002;
                    }
                    
                    progress = Math.min(99.9, progress + delta);
                    pushLoadingProgress(Math.floor(progress));
                }, 50);
            }

            const smoothProgressTo100 = () => {
                if (progressTimer !== null) {
                    clearInterval(progressTimer);
                    progressTimer = null;
                }
                progress = 100;
                pushLoadingProgress(100);
                return Promise.resolve();
            };

            await traceLocalPerformance('canvas-startup.restore-total', async () => {
                const restoredState = traceLocalPerformance('canvas-startup.restore-local-state', () => restoreCanvasStateFromLocalStorage(STORAGE_KEY));
                const startupState = restoredState
                    ? normalizeRestoredCanvasState(restoredState as CanvasState)
                    : DEFAULT_STATE;
                const startupCanvasNodeCountForFinalize = startupState.canvases.reduce((total, canvas) => (
                    total + (canvas.promptNodes?.length || 0) + (canvas.imageNodes?.length || 0)
                ), 0);
                const isLargeStartupCanvasForFinalize = startupCanvasNodeCountForFinalize > LARGE_CANVAS_DATA_URL_MIGRATION_NODE_THRESHOLD;

                if (restoredState) {
                    startTransition(() => {
                        setState(startupState);
                    });
                }

                const startupImageHydrationPromise = traceLocalPerformance('canvas-startup.preview-hydration', () => hydrateStartupPreviewImages(startupState, (pct) => pushLoadingProgress(pct)));

            try {
                // 简体中文注释：为磁盘文件恢复与权限检查设置最大 3200ms 的超时保护，避免由于 File System 挂起导致界面无限等待 99%
                const diskRestorePromise = (async () => {
                    // 1. Restore Local Folder Handle (Fix for 0B issue)
                    try {
                        const handle = await traceLocalPerformance('canvas-startup.restore-folder-handle', () => getLocalFolderHandle());
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
                                    const projectLoadPromise = traceLocalPerformance('canvas-startup.disk-project-load', () => fileSystemService.loadProjectWithThumbs(handle));
                                    const referenceImageLoadPromise = traceLocalPerformance('canvas-startup.reference-image-load', () => fileSystemService.loadAllReferenceImages(handle));
                                    const [{ canvases, images, activeCanvasId: diskActiveCanvasId }, refUrls] = await Promise.all([
                                        projectLoadPromise,
                                        referenceImageLoadPromise,
                                    ]);
                                    logInfo('CanvasContext', '磁盘数据加载完成', `画布数: ${canvases.length}, 图片数: ${images.size}, 活动ID: ${diskActiveCanvasId}`);

                                    // Hydrate the cache without ever letting thumbnails overwrite the original slot.
                                    for (const [id, data] of images.entries()) {
                                        void hydrateRecoveredMediaCacheEntry(id, data).catch((error) => {
                                            console.warn('[CanvasContext] Cache hydration failed', id, error);
                                        });
                                    }

                                    if (canvases.length > 0) {
                                        startTransition(() => {
                                            setState(prev => {
                                            // [Key fix] Merge disk project.json with the latest localStorage state.
                                            // A hard refresh usually leaves fresher state in localStorage via beforeunload.
                                            // project.json may lag behind due to async writes, so both sources must be merged carefully.
                                            const mergedCanvases = mergeCanvases(prev.canvases, canvases, normalizeCanvasPromptRecovery);
                                            const finalActiveId = resolvePreferredActiveCanvasId(
                                                prev.activeCanvasId,
                                                diskActiveCanvasId,
                                                mergedCanvases
                                            );

                                            return {
                                                ...prev,
                                                canvases: mergedCanvases.map(c => {
                                                    return {
                                                        ...c,
                                                        imageNodes: c.imageNodes.map(img => {
                                                            const diskImage = images.get(img.storageId || img.id) || images.get(img.id);
                                                            const recoveredUrl = diskImage?.url || img.url || img.apiResultUrl || '';
                                                            const recoveredOriginalUrl = diskImage?.originalUrl || img.originalUrl || img.apiResultUrl;
                                                            
                                                            const isFreshDiskRecovery = !!diskImage;
                                                            const hasRecovered = isFreshDiskRecovery ||
                                                                (recoveredUrl && !recoveredUrl.startsWith('blob:')) ||
                                                                (recoveredOriginalUrl && !recoveredOriginalUrl.startsWith('blob:'));
                                                            const errorMsg = (hasRecovered && img.error === '本地临时图片已失效') ? undefined : img.error;

                                                            return {
                                                                ...img,
                                                                url: recoveredUrl,
                                                                originalUrl: recoveredOriginalUrl,
                                                                error: errorMsg
                                                            };
                                                        }),
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
                })();

                const diskTimeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 3200));
                await Promise.race([diskRestorePromise, diskTimeoutPromise]);

            } catch (error) {
                console.error('Failed to load images from IndexedDB:', error);
            } finally {
                try {
                    // 简体中文注释：为图片载入与迁移设置最大 3 秒超时，防止底层 IndexedDB 挂起阻断用户进入页面
                    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 3000));
                    await Promise.race([startupImageHydrationPromise, timeoutPromise]);
                } catch (error) {
                    console.error('Failed to load startup preview images:', error);
                }
                // 简体中文注释：所有核心加载任务均完毕，极速平滑飙升到 100% 并延迟 200ms 关闭加载状态
                await smoothProgressTo100();
                setTimeout(() => {
                    if (typeof window !== 'undefined' && (window as any).__KK_LARGE_CANVAS_SMOKE__) {
                        console.log('[Workspace10k] canvas-loading-finalize:start');
                    }
                    setIsLoading(false);
                    if (typeof window !== 'undefined' && (window as any).__KK_LARGE_CANVAS_SMOKE__) {
                        console.log('[Workspace10k] canvas-loading-finalize:after-loading');
                    }
                    hasLoadedSuccessRef.current = true; // 标记首次加载已成功，防止以后重复初始化把进度重置为 0
                    const unlockPersistence = () => {
                        setIsInitRestored(true); // 🚀 标记项目已彻底同步恢复完毕，解锁后续磁盘/缓存文件保存动作
                        if (typeof window !== 'undefined' && (window as any).__KK_LARGE_CANVAS_SMOKE__) {
                            console.log('[Workspace10k] canvas-loading-finalize:persistence-unlocked');
                        }
                    };
                    if (isLargeStartupCanvasForFinalize) {
                        window.setTimeout(unlockPersistence, 2500);
                    } else {
                        unlockPersistence();
                    }
                    if (typeof window !== 'undefined' && (window as any).__KK_LARGE_CANVAS_SMOKE__) {
                        console.log('[Workspace10k] canvas-loading-finalize:after-init-restored');
                        window.requestAnimationFrame(() => {
                            console.log('[Workspace10k] canvas-loading-finalize:next-frame');
                        });
                    }
                    if (typeof window !== 'undefined') {
                        sessionStorage.setItem('kk_canvas_loaded', 'true');
                    }
                }, 200);
            }
            });
        };

        init();
    }, [isShellReady]);

    // Helper: Strip image URLs for storage

    // 简体中文注释：高效对比两个 Canvas 节点列表的辅助函数，避免深度 JSON.stringify 带来主线程卡顿
    function isCanvasEqual(c1: Canvas, c2: Canvas): boolean {
        if (c1 === c2) return true;
        if (!c1 || !c2) return false;
        if (c1.id !== c2.id || c1.name !== c2.name || c1.folderName !== c2.folderName || c1.lastModified !== c2.lastModified) {
            return false;
        }
        if (c1.promptNodes.length !== c2.promptNodes.length || c1.imageNodes.length !== c2.imageNodes.length) {
            return false;
        }
        if ((c1.groups?.length || 0) !== (c2.groups?.length || 0)) return false;
        if ((c1.drawings?.length || 0) !== (c2.drawings?.length || 0)) return false;

        for (let i = 0; i < c1.promptNodes.length; i++) {
            const p1 = c1.promptNodes[i];
            const p2 = c2.promptNodes[i];
            if (p1.id !== p2.id || p1.prompt !== p2.prompt || p1.isGenerating !== p2.isGenerating || p1.error !== p2.error) {
                return false;
            }
            if ((p1.childImageIds?.length || 0) !== (p2.childImageIds?.length || 0)) {
                return false;
            }
            if (p1.childImageIds && p2.childImageIds) {
                for (let j = 0; j < p1.childImageIds.length; j++) {
                    if (p1.childImageIds[j] !== p2.childImageIds[j]) return false;
                }
            }
        }
        for (let i = 0; i < c1.imageNodes.length; i++) {
            const img1 = c1.imageNodes[i];
            const img2 = c2.imageNodes[i];
            if (img1.id !== img2.id || img1.url !== img2.url || img1.error !== img2.error || img1.fileName !== img2.fileName) {
                return false;
            }
            if (img1.position?.x !== img2.position?.x || img1.position?.y !== img2.position?.y) {
                return false;
            }
        }
        return true;
    }

    function areCanvasListsEqual(a: Canvas[], b: Canvas[]): boolean {
        if (a === b) return true;
        if (!a || !b || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!isCanvasEqual(a[i], b[i])) return false;
        }
        return true;
    }


    const canUseCloudLayout = Boolean(
        shouldEnableWorkspaceCloudSync()
        && user
        && session
        && !isTempUser
    );

    useEffect(() => {
        cloudLoadStartedRef.current = false;
    }, [user?.id]);

    // Cloud sync: load and merge on init.
    useEffect(() => {
        const loadCloud = async () => {
            if (!canUseCloudLayout) return;

            try {
                const { syncService } = await import('../services/system/syncService');
                const cloudCanvases = await syncService.loadLayout();
                if (cloudCanvases && cloudCanvases.length > 0) {
                    setState(prev => {
                        const merged = mergeCanvases(prev.canvases, cloudCanvases, normalizeCanvasPromptRecovery);
                        // Check if anything changed
                        if (!areCanvasListsEqual(merged, prev.canvases)) {
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

        if (isLoading || !canUseCloudLayout || cloudLoadStartedRef.current) {
            return;
        }

        let cancelled = false;
        let unsubscribe: (() => void) | null = null;

        const maybeLoadCloud = () => {
            if (cancelled || cloudLoadStartedRef.current || !isLatestStartupStageReady('profile_ready')) {
                return;
            }

            cloudLoadStartedRef.current = true;
            void loadCloud();
            unsubscribe?.();
            unsubscribe = null;
        };

        maybeLoadCloud();

        if (!cloudLoadStartedRef.current) {
            unsubscribe = subscribeStartupSnapshot(() => {
                maybeLoadCloud();
            });
        }

        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, [isLoading, canUseCloudLayout]);

    const isSaveBlocked = !isInitRestored;
    useCanvasCloudSync(state.canvases, isLoading, canUseCloudLayout);
    const isSaveBlockedRef = useRef(isSaveBlocked);
    // Mark operations that need an urgent flush and should bypass the 200ms debounce.
    const urgentSaveRef = useRef(false);
    useLayoutEffect(() => {
        stateRef.current = state;
        isSaveBlockedRef.current = isSaveBlocked;
    }, [state, isSaveBlocked]);

    const localPersistenceToken = useMemo(
        () => buildCanvasLocalPersistenceSignature(
            state.canvases,
            state.activeCanvasId,
            state.subCardLayoutMode
        ),
        [state.activeCanvasId, state.canvases, state.subCardLayoutMode]
    );
    const isLargeLocalPersistenceCanvas = useMemo(
        () => state.canvases.some((canvas) => (
            (canvas.promptNodes?.length || 0) + (canvas.imageNodes?.length || 0)
        ) > LARGE_CANVAS_LOCAL_PERSISTENCE_NODE_THRESHOLD),
        [state.canvases]
    );

    useCanvasLocalPersistence({
        state,
        persistenceToken: localPersistenceToken,
        isLoading: isSaveBlocked,
        storageKey: STORAGE_KEY,
        stateRef,
        isLoadingRef: isSaveBlockedRef,
        urgentSaveRef,
        prepareBeforeUnloadState: markInterruptedSyncPromptGenerations,
        debouncedSaveDelayMs: isLargeLocalPersistenceCanvas ? LARGE_CANVAS_DEBOUNCED_SAVE_DELAY_MS : undefined,
        idleSaveTimeoutMs: isLargeLocalPersistenceCanvas ? LARGE_CANVAS_IDLE_SAVE_TIMEOUT_MS : undefined,
    });

    // Hydrate Reference Images from IDB (if stripped from localStorage)
    useEffect(() => {
        if (!state.activeCanvasId) return;
        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        if (!currentCanvas) return;
        const promptNodesWithReferences = currentCanvas.promptNodes.filter((
            node
        ): node is PromptNode & { referenceImages: NonNullable<PromptNode['referenceImages']> } => (
            Boolean(node.referenceImages && node.referenceImages.length > 0)
        ));
        if (promptNodesWithReferences.length === 0) {
            return;
        }

        let hasUpdates = false;
        const updates: { nodeId: string; refs: any[] }[] = [];

        const hydrateRefs = async () => {
            const promises = promptNodesWithReferences.map(async (node) => {
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
        const timeoutId = window.setTimeout(hydrateRefs, 500);
        return () => window.clearTimeout(timeoutId);

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
        console.log('[CanvasContext.addPromptNode] Starting prompt node insert', { nodeId: node.id });

        try {
            const presentableNode = node.presentation
                ? node
                : {
                    ...node,
                    presentation: createCanvasCardPresentation(
                        resolvePromptCardKind(node, node.childImageIds?.length || 0),
                        'column',
                        node.mode === GenerationMode.ECOMMERCE || node.mode === GenerationMode.PPT ? 'wide' : 'standard',
                    ),
                };
            // [Defensive fix] Add the node to state first so the UI shows it immediately.
            updateCanvas(canvas => {
                const nextCanvas = addCanvasPromptNode(canvas, presentableNode);
                if (nextCanvas === canvas) {
                    console.warn(`[CanvasContext] Skip duplicate promptNodeID: ${node.id}`);
                }
                return nextCanvas;
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
                void Promise.allSettled(saveTasks).then(() => {
                    console.log('[CanvasContext.addPromptNode] Reference image persistence finished');
                }); // Keep card insertion responsive; one failed reference does not abort the rest.
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

        updateCanvas(canvas => updateCanvasPromptNode(canvas, node));
    }, [updateCanvas]);

    const urgentUpdatePromptNode = useCallback((node: PromptNode) => {
        // [Persistence] Request an urgent flush after React commits the updated state.
        urgentSaveRef.current = true;
        updateCanvas(c => ({
            ...c,
            promptNodes: c.promptNodes.map(n => n.id === node.id ? { ...n, ...node } : n)
        }));
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
                    const preferredOriginalSource = normalizePersistableMediaSource(
                        node.originalUrl || '',
                        isVideo ? 'video/mp4' : (node.mimeType || 'image/png')
                    );
                    const stableOriginalSource = preferredOriginalSource.startsWith('blob:')
                        ? null
                        : preferredOriginalSource;
                    const previewSource = normalizePersistableMediaSource(
                        node.apiResultUrl || node.url || node.originalUrl || '',
                        isVideo ? 'video/mp4' : (node.mimeType || 'image/png')
                    );

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
                            if (previewSource) {
                                await saveOriginalImage(storageId, previewSource);
                                console.log(`[CanvasContext] Saved ORIGINAL from preview source for ${storageId} to IndexedDB cache`);
                            }
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
        updateCanvas(canvas => updateCanvasPromptNodePosition(canvas, state.selectedNodeIds || [], id, pos, options));
    }, [updateCanvas, state.selectedNodeIds]);

    const updateImageNodePosition = useCallback((
        id: string,
        pos: { x: number; y: number },
        options?: { ignoreSelection?: boolean }
    ) => {
        updateCanvas(canvas => updateCanvasImageNodePosition(canvas, state.selectedNodeIds || [], id, pos, options));
    }, [updateCanvas, state.selectedNodeIds]);

    const updateImageNodeDimensions = useCallback((id: string, dimensions: string) => {
        updateCanvas(canvas => updateCanvasImageNodeDimensions(canvas, id, dimensions));
    }, [updateCanvas]);

    const updateImageNode = useCallback((id: string, updates: Partial<GeneratedImage>) => {
        updateCanvas(canvas => updateCanvasImageNode(canvas, id, updates));
    }, [updateCanvas]);

    // [Batch update] Support stacking and other large-move operations.
    const updateNodes = useCallback((batch: {
        promptNodes?: { id: string, updates: Partial<PromptNode> }[],
        imageNodes?: { id: string, updates: Partial<GeneratedImage> }[]
    }) => {
        updateCanvas(canvas => applyCanvasNodeBatchUpdates(canvas, batch));
    }, [updateCanvas]);

    const persistedImageRecoverySignature = useMemo(
        () => buildPersistedImageRecoverySignature(state.canvases),
        [state.canvases]
    );
    const persistedRecoveryNodeCount = useMemo(
        () => state.canvases.reduce(
            (total, canvas) => total + (canvas.promptNodes?.length || 0) + (canvas.imageNodes?.length || 0),
            0
        ),
        [state.canvases]
    );
    const shouldDeferPersistedRecoveryForLargeCanvas = persistedRecoveryNodeCount >= PERSISTED_IMAGE_RECOVERY_LARGE_CANVAS_THRESHOLD;
    const [isBackgroundRecoveryStageReady, setIsBackgroundRecoveryStageReady] = useState(() => (
        isLatestStartupStageReady('background_ready')
    ));

    useEffect(() => {
        if (!user || !session) {
            setIsBackgroundRecoveryStageReady(false);
            return;
        }

        if (shouldDeferPersistedRecoveryForLargeCanvas || isLatestStartupStageReady('background_ready')) {
            setIsBackgroundRecoveryStageReady(isLatestStartupStageReady('background_ready'));
            return;
        }

        setIsBackgroundRecoveryStageReady(false);

        const unsubscribe = subscribeStartupSnapshot((snapshot) => {
            if (isStartupStageReady(snapshot.stage, 'background_ready')) {
                setIsBackgroundRecoveryStageReady(true);
                unsubscribe();
            }
        });

        return unsubscribe;
    }, [session, shouldDeferPersistedRecoveryForLargeCanvas, user]);

    const canHydratePersistedTaskResults = Boolean(
        user
        && session
        && !shouldDeferPersistedRecoveryForLargeCanvas
        && isBackgroundRecoveryStageReady
    );

    useEffect(() => {
        if (isLoading || !canHydratePersistedTaskResults || !persistedImageRecoverySignature) return;
        if (shouldDeferPersistedRecoveryForLargeCanvas) return;

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
            const isMobileViewport = typeof window !== 'undefined' ? isPhoneResponsiveWidth(window.innerWidth) : false;
            const totalRecoveryNodeCount = currentState.canvases.reduce(
                (total, canvas) => total + (canvas.promptNodes?.length || 0) + (canvas.imageNodes?.length || 0),
                0
            );
            const isLargePersistedRecoveryProject = totalRecoveryNodeCount >= PERSISTED_IMAGE_RECOVERY_LARGE_CANVAS_THRESHOLD;
            const viewportCenter = currentState.viewportCenter || { x: 0, y: 0 };

            for (const canvas of currentState.canvases) {
                const promptById = new Map((canvas.promptNodes || []).map((promptNode) => [promptNode.id, promptNode] as const));

                // 简体中文注释：提前构建查找 Map 缓存，供后续 resolvePromptChildImageIds 循环调用，消除 O(n²) 复杂度
                const imageNodes = canvas.imageNodes || [];
                const imageNodeById = new Map<string, GeneratedImage>();
                const strongOwnedImagesByParentPromptId = new Map<string, GeneratedImage[]>();
                imageNodes.forEach((img) => {
                    imageNodeById.set(img.id, img);
                    if (img.parentPromptId) {
                        const list = strongOwnedImagesByParentPromptId.get(img.parentPromptId) || [];
                        list.push(img);
                        strongOwnedImagesByParentPromptId.set(img.parentPromptId, list);
                    }
                });

                const recoveryImageNodes = imageNodes
                    .filter((imageNode) => {
                        if (!imageNode.url) return true;
                        return !isLargePersistedRecoveryProject && !imageNode.originalUrl;
                    })
                    .sort((left, right) => {
                        if (!isLargePersistedRecoveryProject) return 0;
                        const leftDistance = Math.abs((left.position?.x || 0) - viewportCenter.x)
                            + Math.abs((left.position?.y || 0) - viewportCenter.y);
                        const rightDistance = Math.abs((right.position?.x || 0) - viewportCenter.x)
                            + Math.abs((right.position?.y || 0) - viewportCenter.y);
                        return leftDistance - rightDistance;
                    });
                const boundedRecoveryImageNodes = isLargePersistedRecoveryProject
                    ? recoveryImageNodes.slice(0, PERSISTED_IMAGE_RECOVERY_LARGE_IMAGE_LIMIT)
                    : recoveryImageNodes;

                for (const imageNode of boundedRecoveryImageNodes) {

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

                let promptRecoveryProbeCount = 0;
                for (const promptNode of canvas.promptNodes || []) {
                    const promptTasks = tasksByPromptId.get(promptNode.id) || [];
                    const existingChildren = strongOwnedImagesByParentPromptId.get(promptNode.id) || [];
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
                    if (isLargePersistedRecoveryProject && recoveryEntries.length > 0) {
                        if (promptRecoveryProbeCount >= PERSISTED_IMAGE_RECOVERY_LARGE_PROMPT_LIMIT) {
                            continue;
                        }
                        promptRecoveryProbeCount += 1;
                    }
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
                            modelLabel: resolveModelDisplayName(
                                entry.model || promptNode.model,
                                entry.modelLabel || promptNode.modelLabel,
                            ),
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
                        ...resolvePromptChildImageIds(promptNode, imageNodes, imageNodeById, strongOwnedImagesByParentPromptId),
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
                    if (url.startsWith('blob:')) {
                        return;
                    }
                    void saveOriginalImage(storageId, url).catch(() => undefined);
                });
            }

            if (recoveredNodes.length > 0) {
                await addImageNodes(recoveredNodes, parentUpdates);
            }
        };

        const hydrateWithTimeout = async () => {
            const timeoutPromise = new Promise<void>((_, reject) => {
                setTimeout(() => reject(new Error('HydrationTimeout')), 2500);
            });
            try {
                await Promise.race([
                    hydratePersistedImageSources(),
                    timeoutPromise
                ]);
            } catch (err) {
                console.warn('[CanvasContext] Persisted image hydration timed out, falling back to local nodes.', err);
            }
        };

        void hydrateWithTimeout();

        return () => {
            cancelled = true;
        };
    }, [
        addImageNodes,
        canHydratePersistedTaskResults,
        isLoading,
        persistedImageRecoverySignature,
        shouldDeferPersistedRecoveryForLargeCanvas,
        updateNodes,
    ]);

    const addWorkflowNode = useCallback((node: WorkflowNode) => {
        if (!isWorkflowUtilityNodeKind(node.kind)) {
            console.warn('[CanvasContext.addWorkflowNode] Legacy workflow nodes are derived from canvas data and should not be inserted directly.', node.kind);
            return;
        }

        pushToHistory();
        updateCanvas(canvas => addCanvasWorkflowNode(canvas, node));
    }, [pushToHistory, updateCanvas]);

    const updateWorkflowNode = useCallback((id: string, updates: Partial<WorkflowNode>) => {
        updateCanvas(canvas => updateCanvasWorkflowNode(canvas, id, updates));
    }, [updateCanvas]);

    const updateWorkflowNodePosition = useCallback((id: string, pos: { x: number; y: number }) => {
        updateCanvas(canvas => updateCanvasWorkflowNodePosition(canvas, id, pos));
    }, [updateCanvas]);

    const deleteWorkflowNode = useCallback((id: string) => {
        pushToHistory();
        updateCanvas(canvas => deleteCanvasWorkflowNode(canvas, id));
    }, [pushToHistory, updateCanvas]);

    const createCard = useCallback((input: CanvasCreateCardInput): CanvasCardFactoryResult => {
        const result = createCanvasCardNodes(input, {
            canvasId: state.activeCanvasId,
            position: state.viewportCenter,
        });
        pushToHistory();
        updateCanvas(canvas => {
            let nextCanvas: Canvas = {
                ...canvas,
                promptNodes: [...canvas.promptNodes, ...result.promptNodes],
                imageNodes: [...canvas.imageNodes, ...result.imageNodes],
                noteNodes: [...(canvas.noteNodes || []), ...result.noteNodes],
                lastModified: Date.now(),
            };
            result.workflowNodes.forEach((node) => {
                nextCanvas = addCanvasWorkflowNode(nextCanvas, node);
            });
            return nextCanvas;
        });
        return result;
    }, [pushToHistory, state.activeCanvasId, state.viewportCenter, updateCanvas]);

    const createWorkflowPanel = useCallback((title: string = 'Workflow'): WorkflowPanelNode => {
        const result = createCard({ kind: 'workflow-panel', title });
        return result.workflowNodes[0];
    }, [createCard]);


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
            return deleteCanvasImageNode(c, id);
        });
    }, [updateCanvas]);

    const deletePromptNode = useCallback((id: string) => {
        pushToHistory();

        // 1. 物理删除所有与此 promptNode (或其级联删除的 promptNodes) 关联的生成的图片文件
        const currentState = stateRef.current;
        const activeCanvas = currentState.canvases.find(c => c.id === currentState.activeCanvasId);
        if (activeCanvas) {
            const targetNode = activeCanvas.promptNodes.find(n => n.id === id);
            if (targetNode) {
                const toDeletePromptIds = new Set<string>([id]);
                if (targetNode.mode === GenerationMode.ECOMMERCE && targetNode.ecommerce?.kind === 'framework') {
                    activeCanvas.promptNodes.forEach(node => {
                        if (node.ecommerce?.frameworkId === id) {
                            toDeletePromptIds.add(node.id);
                        }
                    });
                } else if (targetNode.mode === GenerationMode.ECOMMERCE && targetNode.ecommerce?.kind === 'a-plus-group') {
                    activeCanvas.promptNodes.forEach(node => {
                        if (node.ecommerce?.groupId === id) {
                            toDeletePromptIds.add(node.id);
                        }
                    });
                }

                // 如果是电商节点（包括级联被删的电商子节点），我们需要物理删除其图片
                const isEcommerceNode = targetNode.mode === GenerationMode.ECOMMERCE;
                if (isEcommerceNode) {
                    const imagesToDelete = activeCanvas.imageNodes.filter(image => 
                        image.parentPromptId && toDeletePromptIds.has(image.parentPromptId)
                    );

                    imagesToDelete.forEach(img => {
                        // 物理删除 IndexedDB
                        deleteImage(img.id);
                        // 物理删除 磁盘
                        import('../services/storage/storageAdapter').then(({ deleteImage: deleteImageFromDisk }) => {
                            deleteImageFromDisk({
                                id: img.id,
                                type: 'native',
                                width: 0,
                                height: 0,
                                x: 0,
                                y: 0
                            });
                        }).catch(e => console.error('Failed to invoke safe physical deletion', e));
                        // 释放 Blob URL
                        safeRevokeBlobUrl(img.url);
                    });
                }
            }
        }

        urgentSaveRef.current = true; // 父节点删除后同步存盘
        updateCanvas(canvas => deleteCanvasPromptNode(canvas, id));
    }, [updateCanvas, pushToHistory]);

    const linkNodes = useCallback((fromId: string, toId: string) => {
        pushToHistory();
        updateCanvas(canvas => {
            const fromPrompt = canvas.promptNodes.find(n => n.id === fromId);
            const fromImage = canvas.imageNodes.find(n => n.id === fromId);
            const toPrompt = canvas.promptNodes.find(n => n.id === toId);
            const toImage = canvas.imageNodes.find(n => n.id === toId);
            const fromUtility = canvas.workflow?.nodes?.find(n => n.id === fromId);
            const toUtility = canvas.workflow?.nodes?.find(n => n.id === toId);

            if (fromPrompt && toImage) {
                // 传统 Prompt -> Image
                const promptId = fromId;
                const imageId = toId;
                return linkCanvasPromptToImage(canvas, promptId, imageId);
            } else if (fromImage && toPrompt) {
                // 图生图 Image -> Prompt
                return {
                    ...canvas,
                    promptNodes: canvas.promptNodes.map(node =>
                        node.id === toId
                            ? { ...node, sourceImageId: fromId, lastModified: Date.now() }
                            : node
                    ),
                };
            } else if ((fromPrompt || fromImage || fromUtility) && (toPrompt || toImage || toUtility)) {
                // DAG 可视化节点流通用 Sequence 连接，存入 workflow.edges
                if (canvas.workflow) {
                    const newEdge = {
                        id: `edge:${fromId}:sequence:${toId}`,
                        from: fromId,
                        to: toId,
                        role: 'sequence' as any,
                        state: 'active' as any
                    };
                    const alreadyExists = (canvas.workflow.edges || []).some(
                        e => e.from === fromId && e.to === toId
                    );
                    if (alreadyExists) return canvas;

                    return {
                        ...canvas,
                        workflow: {
                            ...canvas.workflow,
                            edges: [...(canvas.workflow.edges || []), newEdge]
                        }
                    };
                }
            }
            return canvas;
        });
    }, [updateCanvas, pushToHistory]);

    const unlinkNodes = useCallback((fromId: string, toId: string) => {
        pushToHistory();
        updateCanvas(canvas => {
            const fromPrompt = canvas.promptNodes.find(n => n.id === fromId);
            const fromImage = canvas.imageNodes.find(n => n.id === fromId);
            const toPrompt = canvas.promptNodes.find(n => n.id === toId);
            const toImage = canvas.imageNodes.find(n => n.id === toId);

            if (fromPrompt && toImage) {
                // 传统 Prompt -> Image 断开
                const promptId = fromId;
                const imageId = toId;
                return unlinkCanvasPromptFromImage(canvas, promptId, imageId);
            } else if (fromImage && toPrompt) {
                // 图生图 Image -> Prompt 断开
                return {
                    ...canvas,
                    promptNodes: canvas.promptNodes.map(node =>
                        node.id === toId && node.sourceImageId === fromId
                            ? { ...node, sourceImageId: undefined, lastModified: Date.now() }
                            : node
                    ),
                };
            }

            // 过滤 workflow.edges 中的自定义边
            if (canvas.workflow?.edges) {
                return {
                    ...canvas,
                    workflow: {
                        ...canvas.workflow,
                        edges: canvas.workflow.edges.filter(edge => !(edge.from === fromId && edge.to === toId))
                    }
                };
            }
            return canvas;
        });
    }, [updateCanvas, pushToHistory]);


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
        clearPersistedCanvasStorageSnapshot();
        // Clear IndexedDB images
        clearAllImages();
        // Reset to default state
        setState({
            ...DEFAULT_STATE,
            canvases: [DEFAULT_CANVAS],
            activeCanvasId: DEFAULT_CANVAS.id,
            history: {}
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
                const singlePromptArrange = arrangeSingleSelectedPromptChildren(currentCanvas, selectedIds, mode);
                if (singlePromptArrange) {
                    const newCanvases = state.canvases.map(c =>
                        c.id === state.activeCanvasId ? { ...singlePromptArrange.canvas, lastModified: Date.now() } : c
                    );
                    setState(prev => ({
                        ...prev,
                        canvases: newCanvases,
                        subCardLayoutMode: singlePromptArrange.subCardLayoutMode
                    }));
                    requestCanvasBoundsFocus(unionCanvasSceneBounds(
                        getCanvasSceneBoundsForNodeIds(singlePromptArrange.canvas, selectedIds),
                    ));
                    return;
                }

                const selectedRootArrange = arrangeSelectedRootNodes(currentCanvas, selectedIds, mode);
                if (selectedRootArrange) {
                    const newCanvases = state.canvases.map(c =>
                        c.id === state.activeCanvasId ? { ...selectedRootArrange.canvas, lastModified: Date.now() } : c
                    );
                    setState(prev => ({
                        ...prev,
                        canvases: newCanvases,
                        subCardLayoutMode: selectedRootArrange.subCardLayoutMode,
                    }));
                    requestCanvasBoundsFocus(unionCanvasSceneBounds(
                        getCanvasSceneBoundsForNodeIds(selectedRootArrange.canvas, selectedIds),
                    ));
                    return;
                }

                const selectedGroupedArrange = arrangeSelectedGroupedNodes(currentCanvas, selectedIds, mode);
                if (selectedGroupedArrange) {
                    const newCanvases = state.canvases.map(c =>
                        c.id === state.activeCanvasId ? { ...selectedGroupedArrange.canvas, lastModified: Date.now() } : c
                    );
                    setState(prev => ({
                        ...prev,
                        canvases: newCanvases,
                        subCardLayoutMode: selectedGroupedArrange.subCardLayoutMode
                    }));
                    requestCanvasBoundsFocus(unionCanvasSceneBounds(
                        getCanvasSceneBoundsForNodeIds(selectedGroupedArrange.canvas, selectedIds),
                    ));
                    return;
                }

                // 简体中文注释：限制框选整理范围：如果局部整理 helper 均未成功应用，直接退出，避免误整理全画布卡片
                return;
            }
        }

        const newImageNodes = [...currentCanvas.imageNodes];
        currentCanvas.promptNodes.forEach(prompt => {
            const childImages = newImageNodes.filter(image => image.parentPromptId === prompt.id);
            if (childImages.length === 0) return;

            const targetMode = prompt.mode === GenerationMode.PPT ? 'column' : mode;
            const imageDims = childImages.map(image => {
                const { width, totalHeight } = getCardDimensions(image.aspectRatio as AspectRatio, true);
                return { w: width, h: totalHeight };
            });
            const promptCenterX = prompt.position.x;
            const promptBottom = prompt.position.y;

            if (targetMode === 'row') {
                const totalWidth = imageDims.reduce((sum, dims) => sum + dims.w, 0) + (childImages.length - 1) * 32;
                let currentLeft = promptCenterX - totalWidth / 2;
                const subCardsTopY = promptBottom + 56;

                childImages.forEach((image, index) => {
                    const dims = imageDims[index];
                    const foundIdx = newImageNodes.findIndex(img => img.id === image.id);
                    if (foundIdx !== -1) {
                        newImageNodes[foundIdx] = {
                            ...newImageNodes[foundIdx],
                            position: {
                                x: currentLeft + dims.w / 2,
                                y: subCardsTopY + dims.h
                            }
                        };
                    }
                    currentLeft += dims.w + 32;
                });
            } else if (targetMode === 'grid') {
                const columns = Math.min(20, childImages.length);
                const maxWidth = Math.max(...imageDims.map(dims => dims.w));
                const totalWidth = columns * maxWidth + (columns - 1) * 32;
                const startX = promptCenterX - totalWidth / 2 + maxWidth / 2;

                const rowCount = Math.ceil(childImages.length / columns);
                const rowMaxHeights: number[] = [];
                for (let r = 0; r < rowCount; r++) {
                    let maxH = 0;
                    for (let c = 0; c < columns; c++) {
                        const idx = r * columns + c;
                        if (idx < childImages.length) {
                            maxH = Math.max(maxH, imageDims[idx].h);
                        }
                    }
                    rowMaxHeights.push(maxH);
                }

                const rowTopYs: number[] = [];
                let currentTopY = promptBottom + 56;
                for (let r = 0; r < rowCount; r++) {
                    rowTopYs.push(currentTopY);
                    currentTopY += rowMaxHeights[r] + 32;
                }

                childImages.forEach((image, index) => {
                    const col = index % columns;
                    const row = Math.floor(index / columns);
                    const dims = imageDims[index];
                    const foundIdx = newImageNodes.findIndex(img => img.id === image.id);
                    if (foundIdx !== -1) {
                        newImageNodes[foundIdx] = {
                            ...newImageNodes[foundIdx],
                            position: {
                                x: startX + col * (maxWidth + 32),
                                y: rowTopYs[row] + dims.h
                            }
                        };
                    }
                });
            } else {
                // column
                let currentTop = promptBottom + 56;
                childImages.forEach((image, index) => {
                    const dims = imageDims[index];
                    const foundIdx = newImageNodes.findIndex(img => img.id === image.id);
                    if (foundIdx !== -1) {
                        newImageNodes[foundIdx] = {
                            ...newImageNodes[foundIdx],
                            position: {
                                x: promptCenterX,
                                y: currentTop + dims.h
                            }
                        };
                    }
                    currentTop += dims.h + 32;
                });
            }
        });

        setState(prev => {
            const newCanvases = prev.canvases.map(c =>
                c.id === prev.activeCanvasId
                    ? {
                        ...c,
                        promptNodes: c.promptNodes.map(prompt => ({
                            ...prompt,
                            presentation: createCanvasCardPresentation(
                                prompt.presentation?.kind || resolvePromptCardKind(prompt, prompt.childImageIds?.length || 0),
                                prompt.mode === GenerationMode.PPT ? 'column' : mode,
                                prompt.presentation?.size || 'standard',
                                prompt.presentation?.diagnostic,
                            ),
                        })),
                        imageNodes: newImageNodes,
                        lastModified: Date.now(),
                    }
                    : c
            );
            return { ...prev, canvases: newCanvases };
        });

    }, [pushToHistory, state.canvases, state.activeCanvasId, state.selectedNodeIds]);

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
                        // Migrate only the assets required by the current state.

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

                    const { canvases, images, activeCanvasId: diskActiveCanvasId } = await fileSystemService.loadProjectWithThumbs(handle);

                    // Hydrate caches without collapsing original and thumbnail into the same storage slot.
                    for (const [id, data] of images.entries()) {
                        void hydrateRecoveredMediaCacheEntry(id, data).catch((error) => {
                            console.error('[CanvasContext] Failed to cache image ' + id, error);
                        });
                    }

                    // If found existing project in the folder, MERGE instead of overwrite
                    if (canvases.length > 0) {
                        setState(prev => {
                            const mergedCanvases = mergeCanvases(prev.canvases, canvases, normalizeCanvasPromptRecovery);
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
                                diskActiveCanvasId,
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
        if (stateRef.current.fileSystemHandle || stateRef.current.folderName) {
            notify.success('已切换到临时模式', '项目数据已保留。');
        }

    }, [state.canvases, state.activeCanvasId]);

    const changeLocalFolder = useCallback(async () => {
        const currentState = stateRef.current;

        // 1. 如果当前没有有效的本地句柄（已被破坏或从未授权），则直接执行全新绑定/连接
        if (!currentState.fileSystemHandle) {
            try {
                const newHandle = await fileSystemService.selectDirectory();
                if (!newHandle) return;
                setIsLoading(true);
                try {
                    // 更新状态句柄
                    setState(prev => ({
                        ...prev,
                        fileSystemHandle: newHandle,
                        folderName: newHandle.name
                    }));
                    await setLocalFolderHandle(newHandle);

                    // 重新载入所选目录下的项目并进行合并
                    const { canvases, images, activeCanvasId: diskActiveCanvasId } = await fileSystemService.loadProjectWithThumbs(newHandle);
                    
                    // 预加载恢复的媒体缓存
                    for (const [id, data] of images.entries()) {
                        void hydrateRecoveredMediaCacheEntry(id, data).catch((error) => {
                            console.error('[CanvasContext] Failed to cache image ' + id, error);
                        });
                    }

                    if (canvases.length > 0) {
                        setState(prev => {
                            const mergedCanvases = mergeCanvases(prev.canvases, canvases, normalizeCanvasPromptRecovery);
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

                            return {
                                ...prev,
                                canvases: finalCanvases,
                                activeCanvasId: finalActiveId,
                                fileSystemHandle: newHandle,
                                folderName: newHandle.name,
                                history: {}
                            };
                        });
                    }
                    notify.success('连接成功', '已重新绑定本地存储文件夹。');
                } catch (error: any) {
                    notify.error('连接失败', '无法连接或读取所选文件夹: ' + error.message);
                    console.error(error);
                } finally {
                    setIsLoading(false);
                }
            } catch (error) {
                // Cancelled picker
            }
            return;
        }

        // 2. 如果当前存在有效本地句柄，则执行目录迁移逻辑
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
            const { canvases, images, activeCanvasId: diskActiveCanvasId } = await fileSystemService.loadProjectWithThumbs(handle);

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

                    const mergedCanvases = mergeCanvases(prev.canvases, hydratedDiskCanvases, normalizeCanvasPromptRecovery);
                    const finalActiveId = resolvePreferredActiveCanvasId(
                        prev.activeCanvasId,
                        diskActiveCanvasId,
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

    useCanvasFileSystemPersistence({
        canvases: state.canvases,
        activeCanvasId: state.activeCanvasId,
        fileSystemHandle: state.fileSystemHandle,
        isLoading: isSaveBlocked,
        stateRef,
        isSavingRef,
        resolveOriginalPersistSourceForDisk,
    });


    /**
     * Get the next available position for a new card (to the right of existing cards)
     */
    const selectNodes = useCallback((ids: string[], mode: CanvasSelectionMode = 'replace') => {
        setState(prev => {
            const currentSelectedNodeIds = prev.selectedNodeIds || [];
            const nextSelectedNodeIds = resolveCanvasSelectionIds(prev.selectedNodeIds, ids, mode);
            if (
                nextSelectedNodeIds.length === currentSelectedNodeIds.length
                && nextSelectedNodeIds.every((id, index) => id === currentSelectedNodeIds[index])
            ) {
                return prev;
            }

            return {
                ...prev,
                selectedNodeIds: nextSelectedNodeIds
            };
        });
    }, []);

    const clearSelection = useCallback(() => {
        setState(prev => (prev.selectedNodeIds.length === 0 ? prev : { ...prev, selectedNodeIds: [] }));
    }, []);

    // [Layering] Bring nodes to front by assigning a higher zIndex.
    const bringNodesToFront = useCallback((nodeIds: string[]) => {
        if (nodeIds.length === 0) return;

        setState(prev => {
            const currentCanvas = prev.canvases.find(c => c.id === prev.activeCanvasId);
            if (!currentCanvas) return prev;

            const layeredCanvas = bringCanvasNodesToFront(currentCanvas, nodeIds);

            const newCanvases = prev.canvases.map(c =>
                c.id === prev.activeCanvasId
                    ? { ...layeredCanvas, lastModified: Date.now() }
                    : c
            );

            return { ...prev, canvases: newCanvases };
        });
    }, []);

    // Layering is now driven by view-only group tiers in App.tsx.
    // Keep persisted zIndex stable so selection and generation do not continuously inflate stored order.

    const applyMoveSelectedNodes = useCallback((delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[], options?: CanvasMoveOptions) => {
        setState(prev => {
            const currentCanvas = prev.canvases.find(c => c.id === prev.activeCanvasId);
            if (!currentCanvas) return prev;

            const movedCanvas = moveSelectedCanvasNodes({
                canvas: currentCanvas,
                selectedNodeIds: prev.selectedNodeIds || [],
                delta,
                sourceNodeIdOrIds,
                options,
            });
            if (movedCanvas === currentCanvas) return prev;
            urgentSaveRef.current = true;

            const newCanvases = prev.canvases.map(c =>
                c.id === prev.activeCanvasId ? { ...movedCanvas, lastModified: Date.now() } : c
            );

            return { ...prev, canvases: newCanvases };
        });
    }, []);

    const pendingMoveDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const pendingMoveSourceRef = useRef<string | string[] | undefined>(undefined);
    const pendingMoveOptionsRef = useRef<CanvasMoveOptions | undefined>(undefined);
    const moveRafRef = useRef<number | null>(null);

    const flushPendingMoveSelectedNodes = useCallback((delta?: { x: number; y: number }, sourceNodeIdOrIds?: string | string[], options?: CanvasMoveOptions) => {
        if (moveRafRef.current !== null) {
            cancelAnimationFrame(moveRafRef.current);
            moveRafRef.current = null;
        }

        const batchedDelta = {
            x: pendingMoveDeltaRef.current.x + (delta?.x ?? 0),
            y: pendingMoveDeltaRef.current.y + (delta?.y ?? 0),
        };
        const batchedSource = sourceNodeIdOrIds ?? pendingMoveSourceRef.current;
        const batchedOptions = options ?? pendingMoveOptionsRef.current;

        pendingMoveDeltaRef.current = { x: 0, y: 0 };
        pendingMoveSourceRef.current = undefined;
        pendingMoveOptionsRef.current = undefined;

        if (batchedDelta.x !== 0 || batchedDelta.y !== 0) {
            applyMoveSelectedNodes(batchedDelta, batchedSource, batchedOptions);
        }
    }, [applyMoveSelectedNodes]);

    const moveSelectedNodes = useCallback((delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[], options?: CanvasMoveOptions) => {
        pendingMoveDeltaRef.current = {
            x: pendingMoveDeltaRef.current.x + delta.x,
            y: pendingMoveDeltaRef.current.y + delta.y,
        };

        if (sourceNodeIdOrIds !== undefined) {
            pendingMoveSourceRef.current = sourceNodeIdOrIds;
        }
        if (options !== undefined) {
            pendingMoveOptionsRef.current = options;
        }

        if (moveRafRef.current !== null) {
            return;
        }

        moveRafRef.current = window.requestAnimationFrame(() => {
            moveRafRef.current = null;
            flushPendingMoveSelectedNodes();
        });
    }, [flushPendingMoveSelectedNodes]);

    const moveSelectedNodesImmediate = useCallback((delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[], options?: CanvasMoveOptions) => {
        flushPendingMoveSelectedNodes(delta, sourceNodeIdOrIds, options);
    }, [flushPendingMoveSelectedNodes]);

    useEffect(() => {
        return () => {
            if (moveRafRef.current !== null) {
                cancelAnimationFrame(moveRafRef.current);
            }
        };
    }, []);

    const getNextCardPosition = useCallback((): { x: number; y: number } => {
        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        return resolveNextCardPosition(currentCanvas);
    }, [state]);

    const findSmartPosition = useCallback((targetX: number, targetY: number, width: number, height: number, buffer = 20): { x: number; y: number } => {
        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        return resolveSmartCanvasPosition(currentCanvas, targetX, targetY, width, height, buffer);
    }, [state]);

    const findNextGroupPosition = useCallback((): { x: number; y: number } => {
        const currentCanvas = state.canvases.find(c => c.id === state.activeCanvasId);
        return resolveNextGroupPosition(currentCanvas);
    }, [state]);

    /** Group Management */
    const addGroup = useCallback((group: CanvasGroup) => {
        updateCanvas((canvas) => addCanvasGroupToCanvas(canvas, group));
    }, [updateCanvas]);

    const removeGroup = useCallback((id: string) => {
        updateCanvas((canvas) => removeCanvasGroupFromCanvas(canvas, id));
    }, [updateCanvas]);

    const updateGroup = useCallback((group: CanvasGroup) => {
        updateCanvas((canvas) => updateCanvasGroupInCanvas(canvas, group));
    }, [updateCanvas]);



    const setNodeTags = useCallback((ids: string[], tags: string[]) => {
        updateCanvas((canvas) => setCanvasNodeTags(canvas, ids, tags));
    }, [updateCanvas]);

    // Track viewport-center updates with useCallback to avoid needless loops.
    const setViewportCenter = useCallback((center: { x: number; y: number }) => {
        const roundedCenter = {
            x: Math.round(center.x),
            y: Math.round(center.y),
        };
        viewportCenterRef.current = roundedCenter;
        setState(prev => (
            prev.viewportCenter.x === roundedCenter.x && prev.viewportCenter.y === roundedCenter.y
                ? prev
                : (() => {
                    const active = prev.canvases.find((canvas) => canvas.id === prev.activeCanvasId) || prev.canvases[0];
                    const activeNodeCount = (active?.promptNodes?.length || 0) + (active?.imageNodes?.length || 0);
                    if (activeNodeCount >= PERSISTED_IMAGE_RECOVERY_LARGE_CANVAS_THRESHOLD) {
                        return prev;
                    }
                    return { ...prev, viewportCenter: roundedCenter };
                })()
        ));
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
        let summary = {
            movedPrompts: 0,
            movedImages: 0,
            deletedSource: false
        };

        setState(prev => {
            const result = mergeCanvasIntoState(prev, sourceCanvasId, targetCanvasId, options);
            summary = result.summary;
            return result.state;
        });

        return summary;
    }, []);

    const cleanupInvalidCards = useCallback((canvasId?: string) => {
        let summary: CleanupInvalidCardsSummary = {
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

            const result = cleanupInvalidCanvasCardsForCanvas({
                canvas: targetCanvas,
                selectedNodeIds: prev.selectedNodeIds,
                toWorkflow: canvasToWorkflow,
                syncCompatibility: syncCanvasCompatibility,
                now: Date.now,
            });

            summary = result.summary;

            if (!result.changed) {
                return prev;
            }

            return {
                ...prev,
                canvases: prev.canvases.map(canvas =>
                    canvas.id === targetCanvasId
                        ? result.canvas
                        : canvas
                ),
                selectedNodeIds: result.selectedNodeIds
            };
        });

        return summary;
    }, []);

    const addCanvasDrawing = useCallback((drawing: CanvasDrawing) => {
        pushToHistory();
        updateCanvas(canvas => ({
            ...canvas,
            drawings: [...(canvas.drawings || []), drawing]
        }));
    }, [updateCanvas, pushToHistory]);

    const deleteCanvasDrawing = useCallback((id: string) => {
        pushToHistory();
        updateCanvas(canvas => ({
            ...canvas,
            drawings: (canvas.drawings || []).filter(d => d.id !== id)
        }));
    }, [updateCanvas, pushToHistory]);

    const clearCanvasDrawings = useCallback(() => {
        pushToHistory();
        updateCanvas(canvas => ({
            ...canvas,
            drawings: []
        }));
    }, [updateCanvas, pushToHistory]);

    const convertDrawingsToNote = useCallback((drawingIds: string[], title?: string): CanvasNoteNode | null => {
        const currentCanvas = stateRef.current.canvases.find(canvas => canvas.id === stateRef.current.activeCanvasId);
        if (!currentCanvas) return null;
        const options = { id: `note-${generateId()}`, title, now: Date.now() };
        const previewCanvas = convertCanvasDrawingsToNote(currentCanvas, drawingIds, options);
        const createdNote = previewCanvas.noteNodes?.find(note => note.id === options.id) || null;
        if (!createdNote) return null;
        pushToHistory();
        updateCanvas(canvas => convertCanvasDrawingsToNote(canvas, drawingIds, options));
        return createdNote;
    }, [pushToHistory, updateCanvas]);

    const updateNoteNodePosition = useCallback((id: string, position: { x: number; y: number }) => {
        updateCanvas(canvas => ({
            ...canvas,
            noteNodes: (canvas.noteNodes || []).map(note => (
                note.id === id ? { ...note, position, updatedAt: Date.now() } : note
            )),
            lastModified: Date.now(),
        }));
    }, [updateCanvas]);

    const editNoteNode = useCallback((id: string): string[] => {
        const note = stateRef.current.canvases
            .find(canvas => canvas.id === stateRef.current.activeCanvasId)
            ?.noteNodes?.find(candidate => candidate.id === id);
        if (!note) return [];
        const drawingIds = note.elements.map(element => element.id);
        pushToHistory();
        updateCanvas(canvas => restoreCanvasNoteToDrawings(canvas, id));
        return drawingIds;
    }, [pushToHistory, updateCanvas]);

    const rasterizeNote = useCallback(async (id: string, scale = 1) => {
        const note = stateRef.current.canvases
            .find(canvas => canvas.id === stateRef.current.activeCanvasId)
            ?.noteNodes?.find(candidate => candidate.id === id);
        return note ? rasterizeCanvasNote(note, { scale }) : null;
    }, []);

    const deleteNoteNode = useCallback((id: string) => {
        pushToHistory();
        updateCanvas(canvas => ({
            ...canvas,
            noteNodes: (canvas.noteNodes || []).filter(note => note.id !== id),
            lastModified: Date.now(),
        }));
    }, [pushToHistory, updateCanvas]);

    // [Performance] Cache the context value so high-frequency state like viewportCenter does not rerender every consumer.
    const contextValue = React.useMemo(() => ({
        state, activeCanvas, createCanvas, switchCanvas, deleteCanvas, renameCanvas,
        addPromptNode, updatePromptNode, addImageNodes, updatePromptNodePosition, updateImageNodePosition, updateImageNodeDimensions, updateImageNode,
        updateNodes, // Batch update
        addWorkflowNode, updateWorkflowNode, updateWorkflowNodePosition, deleteWorkflowNode, createWorkflowPanel, createCard,
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
        urgentUpdatePromptNode,
        addCanvasDrawing,
        deleteCanvasDrawing,
        clearCanvasDrawings,
        convertDrawingsToNote, editNoteNode, rasterizeNote,
        updateNoteNodePosition,
        deleteNoteNode,
    }), [
        state, activeCanvas, createCanvas, switchCanvas, deleteCanvas, renameCanvas,
        addPromptNode, updatePromptNode, addImageNodes, updatePromptNodePosition, updateImageNodePosition, updateImageNodeDimensions, updateImageNode,
        updateNodes,
        addWorkflowNode, updateWorkflowNode, updateWorkflowNodePosition, deleteWorkflowNode, createWorkflowPanel, createCard,
        deleteImageNode, deletePromptNode, linkNodes, unlinkNodes, clearAllData, canCreateCanvas,
        undo, redo, pushToHistory, canUndo, canRedo, arrangeAllNodes, getNextCardPosition,
        connectLocalFolder, disconnectLocalFolder, changeLocalFolder, refreshLocalFolder,
        isShellReady, selectNodes, clearSelection, bringNodesToFront, moveSelectedNodes, moveSelectedNodesImmediate, findSmartPosition, findNextGroupPosition, addGroup, removeGroup, updateGroup, setNodeTags, setViewportCenter, migrateNodes, mergeCanvasInto, cleanupInvalidCards, urgentUpdatePromptNode,
        addCanvasDrawing, deleteCanvasDrawing, clearCanvasDrawings,
        convertDrawingsToNote, editNoteNode, rasterizeNote, updateNoteNodePosition, deleteNoteNode
    ]);
    const startupStatusValue = React.useMemo(() => ({
        isLoading,
        loadingProgress,
    }), [isLoading, loadingProgress]);
    if (typeof window !== 'undefined' && (window as any).__KK_LARGE_CANVAS_SMOKE__) {
        console.log(`[Workspace10k] canvas-provider:render:context-ready loading=${isLoading} restored=${isInitRestored}`);
    }

    return (
        <CanvasStartupStatusContext.Provider value={startupStatusValue}>
            <CanvasContext.Provider value={contextValue}>
                {children}
            </CanvasContext.Provider>
        </CanvasStartupStatusContext.Provider>
    );
};

export const useCanvas = () => {
    const context = useContext(CanvasContext);
    if (!context) throw new Error('useCanvas must be used within CanvasProvider');
    return context;
};

export const useCanvasStartupStatus = () => useContext(CanvasStartupStatusContext);
