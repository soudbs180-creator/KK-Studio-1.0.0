import { type Canvas, type GeneratedImage, type PromptNode, type PromptPendingSyncRequest } from '../types';
import { getPromptCompletedTasks } from '../utils/imageResultPersistence';
import { normalizeReferenceImagesStorage } from '../utils/referenceImageStorage';
import { workflowToLegacyCanvas } from '../workflow/adapters/workflowToLegacy';
import { syncCanvasCompatibility } from './canvasCompatibility';
import { resolvePromptChildImageIds } from './canvasPromptChildImages';
import { type CanvasState } from './canvasContextState';

const SYNC_GENERATION_INTERRUPTED_ERROR = '\u9875\u9762\u5237\u65b0\u6216\u79bb\u5f00\u65f6\u4e2d\u65ad\u4e86\u540c\u6b65\u751f\u6210\u8bf7\u6c42\uff0c\u4f9b\u5e94\u5546\u53ef\u80fd\u5df2\u5b8c\u6210\u51fa\u56fe\uff0c\u4f46\u5f53\u524d\u9879\u76ee\u6ca1\u6709\u6536\u5230\u6700\u7ec8\u54cd\u5e94\u3002';

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

const hasRecoverablePendingTask = (node?: Partial<PromptNode> | null): boolean => {
    if (!node) return false;
    if (getPendingTaskIdsFromPrompt(node).length > 0) return true;
    if (getPendingSyncRequestsFromPrompt(node).length > 0) return true;
    return typeof node.jobId === 'string' && node.jobId.trim().length > 0;
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

export const normalizeCanvasPromptRecovery = (canvas: Canvas): Canvas => {
    const legacyReadyCanvas = workflowToLegacyCanvas(canvas);

    return syncCanvasCompatibility({
        ...legacyReadyCanvas,
        promptNodes: (legacyReadyCanvas.promptNodes || []).map((node) => normalizeRecoveredPromptNode(node, legacyReadyCanvas.imageNodes || [])),
        groups: legacyReadyCanvas.groups || [],
        drawings: legacyReadyCanvas.drawings || []
    });
};

export const markInterruptedSyncPromptGenerations = (state: CanvasState): CanvasState => ({
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

export const hasUnrecoverableSyncGenerationInFlight = (state?: CanvasState | null): boolean => {
    if (!state?.canvases?.length) return false;

    return state.canvases.some((canvas) =>
        (canvas.promptNodes || []).some((node) =>
            Boolean(node?.isGenerating)
            && resolvePromptChildImageIds(node, canvas.imageNodes || []).length === 0
            && !hasRecoverablePendingTask(node)
        )
    );
};
