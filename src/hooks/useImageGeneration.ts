import { useState, useCallback, useRef, useEffect } from 'react';
import { PromptNode, GeneratedImage, GenerationMode, AspectRatio, ImageSize, ReferenceImage } from '../types';
import { llmService } from '../services/llm/LLMService';
import { generateImage, cancelGeneration } from '../services/llm/geminiService';
import { useCanvas } from '../context/CanvasContext';
import { useBilling } from '../context/BillingContext';
import { calculateCost, resolveImageCost } from '../services/billing/costService';
import { saveImage, saveOriginalImage, getImage } from '../services/storage/imageStorage';
import { fileSystemService } from '../services/storage/fileSystemService';
import { keyManager, getModelMetadata } from '../services/auth/keyManager';
import { isCreditBasedModel } from '../services/model/modelPricing';
import { 
  normalizePptSlidesForCount, 
  buildAutoPptSlides, 
  buildPptPageAlias 
} from '../utils/pptUtils';
import { buildGeneratedImageBatchPositions } from '../utils/generatedImageLayout';
import { clearSyncImageBridgeRequest, getSyncImageBridgeRequest, isSyncImageBridgeSupported } from '../services/llm/syncImageBridge';
import { clampGenerationDurationMs } from '../utils/timeUtils';
import { hasNetworkErrorMarkers, hasTimeoutMarkers } from '../services/api/errorClassification';
import { useTaskRecovery, persistTask, markTaskCompleted, markTaskFailed } from './useTaskRecovery';

const GENERATE_TIMEOUT_MS = 600000;
const SYNC_BRIDGE_RECOVERY_RETRY_MS = 2500;
const SYNC_BRIDGE_RECOVERY_MAX_AGE_MS = 15 * 60 * 1000;
const RETRO_RECOVERABLE_SYNC_BRIDGE_ERROR_CODES = new Set(['SYNC_REQUEST_INTERRUPTED', 'SYNC_BRIDGE_TIMEOUT']);
const RETRO_RECOVERABLE_SYNC_BRIDGE_ERROR_TEXT_HINTS = ['::INTERRUPTED::', '页面刷新或离开时中断了同步生成请求', '同步生成恢复超时'];

type PendingSyncRequest = {
  requestId: string;
  index: number;
  prompt: string;
  startedAt: number;
  keySlotId?: string;
};

const toFiniteTimestamp = (value?: number | null): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
);

const resolveSyncBridgeDurationMs = (
  result: { startedAt?: number; completedAt?: number },
  fallbackStartedAt?: number
): number => {
  const startedAt = toFiniteTimestamp(result.startedAt) ?? toFiniteTimestamp(fallbackStartedAt);
  const completedAt = toFiniteTimestamp(result.completedAt);

  if (startedAt !== undefined && completedAt !== undefined && completedAt >= startedAt) {
    return clampGenerationDurationMs(completedAt - startedAt);
  }

  return 0;
};

const hasRecoverableReferenceImage = (img?: Partial<ReferenceImage> | null): boolean => {
  if (!img) return false;

  const data = typeof img.data === 'string' ? img.data.trim() : '';
  if (data.length > 0) return true;

  if (typeof img.storageId === 'string' && img.storageId.trim().length > 0) return true;
  if (typeof img.url === 'string' && img.url.trim().length > 0) return true;

  // Keep legacy records that rely on id-only cache recovery.
  return typeof img.id === 'string' && img.id.trim().length > 0;
};

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const splitMetricAcrossItems = (value: number | undefined, count: number): number | undefined => {
  if (value === undefined) return undefined;
  const safeCount = Math.max(1, count || 1);
  return value / safeCount;
};

const resolveUsageMetrics = (params: {
  model: string;
  imageSize?: ImageSize;
  prompt?: string;
  imageCount?: number;
  referenceImageCount?: number;
  keySlotId?: string;
  explicitCost?: number;
  explicitTokens?: number;
}): {
  cost?: number;
  tokens?: number;
  costSource: NonNullable<GeneratedImage['costSource']>;
} => {
  const explicitCost = toFiniteNumber(params.explicitCost);
  const explicitTokens = toFiniteNumber(params.explicitTokens);
  const resolvedImageSize = params.imageSize || ImageSize.SIZE_1K;

  try {
    const resolvedCost = resolveImageCost({
      model: params.model,
      imageSize: resolvedImageSize,
      count: Math.max(1, params.imageCount || 1),
      prompt: params.prompt,
      referenceImageCount: Math.max(0, params.referenceImageCount || 0),
      keySlotId: params.keySlotId,
      explicitCost,
    });
    const estimate = calculateCost(
      params.model,
      resolvedImageSize,
      Math.max(1, params.imageCount || 1),
      String(params.prompt || '').length,
      Math.max(0, params.referenceImageCount || 0),
      params.keySlotId
    );
    const shouldSuppressEstimatedTokens = Boolean(params.keySlotId)
      && !resolvedCost.usedPricingSnapshot
      && resolvedCost.source === 'none'
      && explicitTokens === undefined;

    return {
      cost: resolvedCost.source === 'none' ? undefined : resolvedCost.cost,
      tokens: explicitTokens ?? (shouldSuppressEstimatedTokens ? undefined : estimate.tokens),
      costSource: resolvedCost.source as NonNullable<GeneratedImage['costSource']>,
    };
  } catch {
    return {
      cost: explicitCost,
      tokens: explicitTokens,
      costSource: explicitCost !== undefined ? 'explicit' : 'none',
    };
  }
};

export const useImageGeneration = (options: {
  isMobile: boolean;
  getCardDimensions: (ratio: AspectRatio, hasToolbar?: boolean) => { width: number; totalHeight: number };
  rememberPreferredKeyForMode: (mode: GenerationMode | undefined, keySlotId: string | undefined) => void;
}) => {
  const { isMobile, rememberPreferredKeyForMode } = options;
  const { 
    activeCanvas, 
    updatePromptNode, 
    urgentUpdatePromptNode, 
    addImageNodes, 
    deleteImageNode,
    updateImageNode,
    updateImageNodePosition
  } = useCanvas();
  
  const { refundCredits } = useBilling();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const activeCanvasRef = useRef(activeCanvas);
  useEffect(() => {
    activeCanvasRef.current = activeCanvas;
  }, [activeCanvas]);

  // --- Helpers ---

  const extractErrorDetails = useCallback((error: any, fallbackModel?: string) => {
    const details = {
      code: error?.code ? String(error.code) : undefined,
      status: typeof error?.status === 'number' ? error.status : (typeof error?.response?.status === 'number' ? error.response.status : undefined),
      requestPath: error?.requestPath ? String(error.requestPath) : (error?.request?.path ? String(error.request.path) : undefined),
      requestBody: undefined as string | undefined,
      responseBody: undefined as string | undefined,
      provider: error?.provider ? String(error.provider) : undefined,
      model: fallbackModel,
      timestamp: Date.now()
    };
    if (error?.requestBody) details.requestBody = typeof error.requestBody === 'string' ? error.requestBody : JSON.stringify(error.requestBody, null, 2);
    if (error?.responseBody) details.responseBody = typeof error.responseBody === 'string' ? error.responseBody : JSON.stringify(error.responseBody, null, 2);
    if (error?.message && !details.responseBody) details.responseBody = String(error.message);
    return details;
  }, []);

  const isRecoverableSyncBridgeFailure = useCallback((params: {
    requestId?: string;
    error?: string;
    errorDetails?: {
      code?: string;
      responseBody?: string;
    };
    pendingSyncRequestIds?: Set<string>;
  }) => {
    const requestId = String(params.requestId || '').trim();
    if (!requestId) return false;
    if (params.pendingSyncRequestIds && !params.pendingSyncRequestIds.has(requestId)) return false;

    const code = String(params.errorDetails?.code || '').trim().toUpperCase();
    if (RETRO_RECOVERABLE_SYNC_BRIDGE_ERROR_CODES.has(code)) return true;

    const combinedText = [
      params.error,
      params.errorDetails?.responseBody,
      params.errorDetails?.code,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ');

    if (!combinedText) return false;
    if (RETRO_RECOVERABLE_SYNC_BRIDGE_ERROR_TEXT_HINTS.some((hint) => combinedText.includes(hint))) return true;
    if (hasNetworkErrorMarkers(combinedText) || hasTimeoutMarkers(combinedText)) return true;

    const normalized = combinedText.toLowerCase();
    return normalized.includes('sync image bridge')
      || normalized.includes('service worker')
      || normalized.includes('failed to fetch');
  }, []);

  const resolveProviderDisplay = useCallback((keySlotId?: string, fallbackProviderLabel?: string, fallbackProvider?: string) => {
    if (fallbackProviderLabel) return { provider: fallbackProvider, providerLabel: fallbackProviderLabel };
    if (keySlotId) {
      const provider = keyManager.getProviderForKeySlot(keySlotId);
      if (provider) return { provider: provider.name || fallbackProvider, providerLabel: provider.name || fallbackProviderLabel || 'Custom' };
      const keySlot = keyManager.getKey(keySlotId);
      if (keySlot) return { provider: String(keySlot.provider || ''), providerLabel: keySlot.name || String(keySlot.provider || 'Official') };
    }
    return { provider: fallbackProvider, providerLabel: fallbackProviderLabel || fallbackProvider };
  }, []);

  const shouldPreferRouteProviderDisplay = useCallback((
    node: Pick<PromptNode, 'model' | 'provider' | 'providerLabel'>,
    routeDisplay: { provider?: string; providerLabel?: string }
  ) => {
    const currentLabel = String(node.providerLabel || '').trim();
    const routeLabel = String(routeDisplay.providerLabel || '').trim();

    if (!routeLabel || !currentLabel || currentLabel === routeLabel) {
      return !currentLabel && !!routeLabel;
    }

    const modelMeta = getModelMetadata(node.model || '') as { provider?: string; providerLabel?: string } | undefined;
    const genericLabels = new Set(
      [node.providerLabel, node.provider, modelMeta?.providerLabel, modelMeta?.provider]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim().toLowerCase())
    );

    return genericLabels.has(currentLabel.toLowerCase());
  }, []);

  // --- Task State Helpers ---

  const getPendingTaskIds = useCallback((node?: PromptNode | null): string[] => {
    const rawPendingTaskIds = (node?.generationMetadata as { pendingTaskIds?: unknown } | undefined)?.pendingTaskIds;
    const fallbackTaskIds = node?.jobId ? [node.jobId] : [];
    const normalizedTaskIds = Array.isArray(rawPendingTaskIds) ? rawPendingTaskIds : fallbackTaskIds;
    return Array.from(new Set(
      normalizedTaskIds.filter((taskId): taskId is string => typeof taskId === 'string' && taskId.trim().length > 0)
    ));
  }, []);

  const buildGenerationMetadata = useCallback((node: PromptNode | null | undefined, partial: Record<string, unknown>) => ({
    ...(node?.generationMetadata || {}),
    ...partial,
  }), []);

  const getPendingSyncRequests = useCallback((node?: PromptNode | null): PendingSyncRequest[] => {
    const rawPendingSyncRequests = (node?.generationMetadata as { pendingSyncRequests?: unknown } | undefined)?.pendingSyncRequests;
    if (!Array.isArray(rawPendingSyncRequests)) return [];

    return rawPendingSyncRequests.filter((item): item is PendingSyncRequest => (
      !!item
      && typeof item === 'object'
      && typeof (item as PendingSyncRequest).requestId === 'string'
      && (item as PendingSyncRequest).requestId.trim().length > 0
    ));
  }, []);

  const buildPendingTaskMetadata = useCallback((node: PromptNode | null | undefined, pendingTaskIds: string[]) => (
    buildGenerationMetadata(node, { pendingTaskIds })
  ), [buildGenerationMetadata]);

  const buildPendingSyncMetadata = useCallback((node: PromptNode | null | undefined, pendingSyncRequests: PendingSyncRequest[]) => (
    buildGenerationMetadata(node, { pendingSyncRequests })
  ), [buildGenerationMetadata]);

  const registerPendingTaskId = useCallback((node: PromptNode, taskId: string): PromptNode => {
    const nextPendingTaskIds = Array.from(new Set([...getPendingTaskIds(node), taskId]));
    return {
      ...node,
      jobId: nextPendingTaskIds[0],
      generationMetadata: buildPendingTaskMetadata(node, nextPendingTaskIds),
    };
  }, [buildPendingTaskMetadata, getPendingTaskIds]);

  const registerPendingSyncRequest = useCallback((node: PromptNode, pendingRequest: PendingSyncRequest): PromptNode => {
    const existing = getPendingSyncRequests(node);
    const nextPendingSyncRequests = existing.some(item => item.requestId === pendingRequest.requestId)
      ? existing
      : [...existing, pendingRequest];

    return {
      ...node,
      generationMetadata: buildPendingSyncMetadata(node, nextPendingSyncRequests),
    };
  }, [buildPendingSyncMetadata, getPendingSyncRequests]);

  const clearPendingSyncRequests = useCallback((node: PromptNode, requestIds: string[]): PromptNode => {
    if (!requestIds.length) return node;
    const requestIdSet = new Set(requestIds);
    const nextPendingSyncRequests = getPendingSyncRequests(node).filter(item => !requestIdSet.has(item.requestId));
    return {
      ...node,
      generationMetadata: buildPendingSyncMetadata(node, nextPendingSyncRequests),
    };
  }, [buildPendingSyncMetadata, getPendingSyncRequests]);

  const resolvePendingTaskState = useCallback((node: PromptNode, completedTaskId?: string) => {
    const currentPendingTaskIds = getPendingTaskIds(node);
    const nextPendingTaskIds = completedTaskId
      ? currentPendingTaskIds.filter(taskId => taskId !== completedTaskId)
      : [];
    return {
      nextPendingTaskIds,
      nextJobId: nextPendingTaskIds[0],
      nextGenerationMetadata: buildPendingTaskMetadata(node, nextPendingTaskIds),
    };
  }, [buildPendingTaskMetadata, getPendingTaskIds]);

  const getExpectedGenerationCount = useCallback((node?: PromptNode | null) => (
    Math.max(1, Number(node?.lastGenerationTotalCount || node?.parallelCount || 1) || 1)
  ), []);

  const getResolvedChildImageCount = useCallback((node?: PromptNode | null) => {
    if (!node?.id) return 0;

    const resolvedIds = new Set<string>((node.childImageIds || []).filter(Boolean));
    (activeCanvasRef.current?.imageNodes || []).forEach((imageNode) => {
      if (imageNode.parentPromptId === node.id && imageNode.id) {
        resolvedIds.add(imageNode.id);
      }
    });

    return resolvedIds.size;
  }, []);

  const canAttemptRetroSyncBridgeRecovery = useCallback((node?: PromptNode | null) => {
    if (!node || node.isGenerating) return false;
    if (node.mode === GenerationMode.VIDEO || node.mode === GenerationMode.AUDIO) return false;
    if (getResolvedChildImageCount(node) > 0) return false;

    const errorCode = String(node.errorDetails?.code || '').trim().toUpperCase();
    if (RETRO_RECOVERABLE_SYNC_BRIDGE_ERROR_CODES.has(errorCode)) return true;

    const errorText = `${node.error || ''} ${node.errorDetails?.responseBody || ''}`;
    if (hasNetworkErrorMarkers(errorText) || hasTimeoutMarkers(errorText)) return true;
    return RETRO_RECOVERABLE_SYNC_BRIDGE_ERROR_TEXT_HINTS.some((hint) => errorText.includes(hint));
  }, [getResolvedChildImageCount]);

  const buildRetroPendingSyncRequests = useCallback((node: PromptNode): PendingSyncRequest[] => {
    const expectedCount = getExpectedGenerationCount(node);
    const baseStartedAt = typeof node.errorDetails?.timestamp === 'number'
      ? node.errorDetails.timestamp
      : (node.timestamp || Date.now());

    return Array.from({ length: expectedCount }).map((_, index) => ({
      requestId: `${node.id}-${index}`,
      index,
      prompt: node.mode === GenerationMode.PPT
        ? String(node.pptSlides?.[index] || node.prompt || '')
        : String(node.prompt || ''),
      startedAt: baseStartedAt,
      keySlotId: node.keySlotId
    }));
  }, [getExpectedGenerationCount]);

  const getGeneratedImagePosition = useCallback((
    basePosition: { x: number; y: number },
    aspectRatio: AspectRatio,
    mode: GenerationMode | undefined,
    index: number,
    totalCount: number
  ) => {
    const safeTotalCount = Math.max(1, totalCount);
    const positions = buildGeneratedImageBatchPositions({
      basePosition,
      items: Array.from({ length: safeTotalCount }, () => ({ aspectRatio })),
      mode,
      isMobile,
    });
    return positions[index] || positions[positions.length - 1] || basePosition;
  }, [isMobile]);

  const syncBridgeRecoveryTimersRef = useRef<Map<string, number>>(new Map());
  const syncBridgeRecoveryInFlightRef = useRef<Set<string>>(new Set());
  const retroSyncBridgeRecoveryAttemptedRef = useRef<Set<string>>(new Set());

  const clearSyncBridgeRecoveryTimer = useCallback((requestId: string) => {
    const timer = syncBridgeRecoveryTimersRef.current.get(requestId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      syncBridgeRecoveryTimersRef.current.delete(requestId);
    }
  }, []);

  const scheduleSyncBridgeRecovery = useCallback((nodeId: string, pendingRequest: PendingSyncRequest, delayMs: number = SYNC_BRIDGE_RECOVERY_RETRY_MS) => {
    clearSyncBridgeRecoveryTimer(pendingRequest.requestId);
    const timer = window.setTimeout(() => {
      syncBridgeRecoveryTimersRef.current.delete(pendingRequest.requestId);
      syncBridgeRecoveryInFlightRef.current.delete(pendingRequest.requestId);
      void recoverSyncBridgeRequest(nodeId, pendingRequest);
    }, delayMs);
    syncBridgeRecoveryTimersRef.current.set(pendingRequest.requestId, timer);
  }, [clearSyncBridgeRecoveryTimer]);

  const recoverSyncBridgeRequest = useCallback(async (nodeId: string, pendingRequest: PendingSyncRequest) => {
    if (syncBridgeRecoveryInFlightRef.current.has(pendingRequest.requestId)) return;
    syncBridgeRecoveryInFlightRef.current.add(pendingRequest.requestId);

    try {
      const bridgeResult = await getSyncImageBridgeRequest(pendingRequest.requestId);
      const latestNode = activeCanvasRef.current?.promptNodes.find(n => n.id === nodeId);
      if (!latestNode) {
        await clearSyncImageBridgeRequest(pendingRequest.requestId).catch(() => undefined);
        return;
      }

      if (bridgeResult.status === 'pending' || bridgeResult.status === 'missing') {
        const elapsed = Date.now() - (pendingRequest.startedAt || 0);
        if (elapsed < SYNC_BRIDGE_RECOVERY_MAX_AGE_MS) {
          scheduleSyncBridgeRecovery(nodeId, pendingRequest);
        } else {
          const nextNode = clearPendingSyncRequests(latestNode, [pendingRequest.requestId]);
          urgentUpdatePromptNode({
            ...nextNode,
            isGenerating: getPendingTaskIds(nextNode).length > 0 || getPendingSyncRequests(nextNode).length > 0,
            jobId: getPendingTaskIds(nextNode)[0],
            error: getPendingTaskIds(nextNode).length === 0 && getPendingSyncRequests(nextNode).length === 0
              ? '同步生成恢复超时，供应商结果未能重新接回。'
              : nextNode.error,
            errorDetails: {
              ...(nextNode.errorDetails || {}),
              code: nextNode.errorDetails?.code || 'SYNC_BRIDGE_TIMEOUT',
              responseBody: nextNode.errorDetails?.responseBody || 'Sync bridge result recovery timed out',
              model: nextNode.errorDetails?.model || nextNode.model,
              timestamp: Date.now()
            }
          });
          await clearSyncImageBridgeRequest(pendingRequest.requestId).catch(() => undefined);
        }
        return;
      }

      if (bridgeResult.status === 'error') {
        const nextNode = clearPendingSyncRequests(latestNode, [pendingRequest.requestId]);
        const remainingTaskIds = getPendingTaskIds(nextNode);
        const remainingSyncRequests = getPendingSyncRequests(nextNode);
        urgentUpdatePromptNode({
          ...nextNode,
          isGenerating: remainingTaskIds.length > 0 || remainingSyncRequests.length > 0,
          jobId: remainingTaskIds[0],
          error: remainingTaskIds.length === 0 && remainingSyncRequests.length === 0
            ? bridgeResult.error
            : nextNode.error,
          errorDetails: {
            ...(nextNode.errorDetails || {}),
            code: bridgeResult.code || nextNode.errorDetails?.code || 'SYNC_BRIDGE_ERROR',
            status: bridgeResult.responseStatus || nextNode.errorDetails?.status,
            responseBody: bridgeResult.responseBodyPreview || bridgeResult.error || nextNode.errorDetails?.responseBody,
            model: nextNode.errorDetails?.model || nextNode.model,
            timestamp: Date.now()
          }
        });
        await clearSyncImageBridgeRequest(pendingRequest.requestId).catch(() => undefined);
        return;
      }

      const currentChildIds = Array.from(new Set((latestNode.childImageIds || []).filter(Boolean)));
      const expectedCount = getExpectedGenerationCount(latestNode);
      const recoveredUsage = resolveUsageMetrics({
        model: latestNode.model,
        imageSize: latestNode.imageSize,
        prompt: pendingRequest.prompt || latestNode.prompt,
        imageCount: bridgeResult.urls.length,
        referenceImageCount: latestNode.referenceImages?.length || 0,
        keySlotId: pendingRequest.keySlotId || latestNode.keySlotId,
      });
      const recoveredGenerationTime = resolveSyncBridgeDurationMs(bridgeResult, pendingRequest.startedAt);
      const recoveredResults = bridgeResult.urls.map((url, index) => {
        const imageId = `${nodeId}_sync_recovered_${Date.now()}_${pendingRequest.index}_${index}`;
        const layoutIndex = pendingRequest.index + index;
        return {
          id: imageId,
          storageId: imageId,
          url,
          originalUrl: url,
          prompt: pendingRequest.prompt || latestNode.prompt,
          model: latestNode.model,
          modelLabel: latestNode.modelLabel,
          modelColorStart: latestNode.modelColorStart,
          modelColorEnd: latestNode.modelColorEnd,
          modelColorSecondary: latestNode.modelColorSecondary,
          modelTextColor: latestNode.modelTextColor,
          aspectRatio: latestNode.aspectRatio,
          imageSize: latestNode.imageSize,
          timestamp: Date.now(),
          canvasId: activeCanvasRef.current?.id || 'default',
          parentPromptId: nodeId,
          sourceReferenceStorageIds: (latestNode.referenceImages || []).map((ref) => ref.storageId || ref.id).filter(Boolean),
          position: getGeneratedImagePosition(latestNode.position, latestNode.aspectRatio, latestNode.mode, layoutIndex, expectedCount),
          provider: latestNode.provider,
          providerLabel: latestNode.providerLabel,
          keySlotId: pendingRequest.keySlotId || latestNode.keySlotId,
          generationTime: recoveredGenerationTime,
          tokens: splitMetricAcrossItems(recoveredUsage.tokens, bridgeResult.urls.length),
          cost: splitMetricAcrossItems(recoveredUsage.cost, bridgeResult.urls.length),
          costSource: recoveredUsage.costSource,
          alias: latestNode.mode === GenerationMode.PPT ? buildPptPageAlias(latestNode.pptSlides?.[layoutIndex], layoutIndex) : undefined,
        };
      });

      const mergedChildIds = Array.from(new Set([...currentChildIds, ...recoveredResults.map(result => result.id)]));
      const nextNode = clearPendingSyncRequests(latestNode, [pendingRequest.requestId]);
      const remainingTaskIds = getPendingTaskIds(nextNode);
      const remainingSyncRequests = getPendingSyncRequests(nextNode);
      const nextSuccessCount = mergedChildIds.length;
      const nextFailCount = remainingTaskIds.length > 0 || remainingSyncRequests.length > 0
        ? Math.max(0, expectedCount - nextSuccessCount - remainingTaskIds.length - remainingSyncRequests.length)
        : Math.max(0, expectedCount - nextSuccessCount);

      addImageNodes(recoveredResults as any, {
        [latestNode.id]: {
          ...nextNode,
          isGenerating: remainingTaskIds.length > 0 || remainingSyncRequests.length > 0,
          jobId: remainingTaskIds[0],
          childImageIds: mergedChildIds,
          error: undefined,
          errorDetails: undefined,
          lastGenerationSuccessCount: nextSuccessCount,
          lastGenerationFailCount: nextFailCount
        }
      });
      await clearSyncImageBridgeRequest(pendingRequest.requestId).catch(() => undefined);
    } catch (error) {
      console.warn('[useImageGeneration] Sync bridge recovery failed:', error);
      scheduleSyncBridgeRecovery(nodeId, pendingRequest, 4000);
    } finally {
      syncBridgeRecoveryInFlightRef.current.delete(pendingRequest.requestId);
    }
  }, [
    addImageNodes,
    buildPptPageAlias,
    clearPendingSyncRequests,
    getExpectedGenerationCount,
    getGeneratedImagePosition,
    getPendingSyncRequests,
    getPendingTaskIds,
    scheduleSyncBridgeRecovery,
    urgentUpdatePromptNode
  ]);

  const recoverFailedSyncBridgeGeneration = useCallback(async (node: PromptNode) => {
    if (!isSyncImageBridgeSupported()) {
      return { checkedCount: 0, recoveredCount: 0, pendingCount: 0 };
    }

    const latestNode = activeCanvasRef.current?.promptNodes.find(n => n.id === node.id) || node;
    if (!latestNode) {
      return { checkedCount: 0, recoveredCount: 0, pendingCount: 0 };
    }

    const existingPendingRequests = getPendingSyncRequests(latestNode);
    if (existingPendingRequests.length > 0) {
      urgentUpdatePromptNode({
        ...latestNode,
        isGenerating: true,
        jobId: getPendingTaskIds(latestNode)[0],
        error: undefined,
        errorDetails: undefined
      });

      existingPendingRequests.forEach((pendingRequest) => {
        clearSyncBridgeRecoveryTimer(pendingRequest.requestId);
        void recoverSyncBridgeRequest(latestNode.id, pendingRequest);
      });

      return {
        checkedCount: existingPendingRequests.length,
        recoveredCount: 0,
        pendingCount: existingPendingRequests.length
      };
    }

    if (!canAttemptRetroSyncBridgeRecovery(latestNode)) {
      return { checkedCount: 0, recoveredCount: 0, pendingCount: 0 };
    }

    const candidateRequests = buildRetroPendingSyncRequests(latestNode);
    if (candidateRequests.length === 0) {
      return { checkedCount: 0, recoveredCount: 0, pendingCount: 0 };
    }

    const bridgeStates = await Promise.all(candidateRequests.map(async (candidate) => {
      try {
        const result = await getSyncImageBridgeRequest(candidate.requestId);
        return { candidate, result };
      } catch (error) {
        console.warn('[useImageGeneration] Retro sync bridge lookup failed:', candidate.requestId, error);
        return { candidate, result: null as null };
      }
    }));

    const recoverNowCandidates: PendingSyncRequest[] = [];
    const pendingCandidates: PendingSyncRequest[] = [];
    let recoveredCount = 0;

    bridgeStates.forEach(({ candidate, result }) => {
      if (!result) return;
      if (result.status === 'success') {
        recoverNowCandidates.push(candidate);
        recoveredCount += 1;
        return;
      }
      if (result.status === 'pending') {
        recoverNowCandidates.push(candidate);
        pendingCandidates.push(candidate);
      }
    });

    if (pendingCandidates.length > 0) {
      const freshNode = activeCanvasRef.current?.promptNodes.find(n => n.id === latestNode.id) || latestNode;
      let nextNode = freshNode;
      pendingCandidates.forEach((candidate) => {
        nextNode = registerPendingSyncRequest(nextNode, candidate);
      });

      urgentUpdatePromptNode({
        ...nextNode,
        isGenerating: true,
        jobId: getPendingTaskIds(nextNode)[0],
        error: undefined,
        errorDetails: undefined
      });
    }

    recoverNowCandidates.forEach((candidate) => {
      clearSyncBridgeRecoveryTimer(candidate.requestId);
      void recoverSyncBridgeRequest(latestNode.id, candidate);
    });

    return {
      checkedCount: candidateRequests.length,
      recoveredCount,
      pendingCount: pendingCandidates.length
    };
  }, [
    buildRetroPendingSyncRequests,
    canAttemptRetroSyncBridgeRecovery,
    clearSyncBridgeRecoveryTimer,
    getPendingSyncRequests,
    getPendingTaskIds,
    recoverSyncBridgeRequest,
    registerPendingSyncRequest,
    urgentUpdatePromptNode
  ]);

  useEffect(() => {
    const canvas = activeCanvas;
    if (!canvas?.promptNodes?.length) return;

    canvas.promptNodes.forEach((node) => {
      getPendingSyncRequests(node).forEach((pendingRequest) => {
        if (!pendingRequest?.requestId) return;
        if (syncBridgeRecoveryInFlightRef.current.has(pendingRequest.requestId)) return;
        if (syncBridgeRecoveryTimersRef.current.has(pendingRequest.requestId)) return;
        void recoverSyncBridgeRequest(node.id, pendingRequest);
      });
    });
  }, [activeCanvas, getPendingSyncRequests, recoverSyncBridgeRequest]);

  useEffect(() => {
    const canvas = activeCanvas;
    if (!canvas?.promptNodes?.length || !isSyncImageBridgeSupported()) return;

    canvas.promptNodes.forEach((node) => {
      if (!canAttemptRetroSyncBridgeRecovery(node)) return;
      if (retroSyncBridgeRecoveryAttemptedRef.current.has(node.id)) return;

      retroSyncBridgeRecoveryAttemptedRef.current.add(node.id);
      void recoverFailedSyncBridgeGeneration(node);
    });
  }, [activeCanvas, canAttemptRetroSyncBridgeRecovery, recoverFailedSyncBridgeGeneration]);

  useEffect(() => () => {
    syncBridgeRecoveryTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    syncBridgeRecoveryTimersRef.current.clear();
    syncBridgeRecoveryInFlightRef.current.clear();
    retroSyncBridgeRecoveryAttemptedRef.current.clear();
  }, []);

  // --- Polling Logic ---

  const pollTaskStatus = useCallback(async (node: PromptNode, taskIdOverride?: string) => {
    const targetTaskId = taskIdOverride || node.jobId;
    if (!targetTaskId) return;

    try {
      const result = await llmService.checkTaskStatus(targetTaskId, node.mode || GenerationMode.IMAGE, node.keySlotId ? { id: node.keySlotId } as any : undefined);

      if (result && 'status' in result && (result.status === 'success' || result.status === 'failed')) {
        const latestNode = activeCanvasRef.current?.promptNodes.find(n => n.id === node.id) || node;
        const pendingTaskIds = getPendingTaskIds(latestNode);
        const { nextPendingTaskIds, nextJobId, nextGenerationMetadata } = resolvePendingTaskState(latestNode, targetTaskId);
        const expectedCount = getExpectedGenerationCount(latestNode);
        const currentChildIds = Array.from(new Set((latestNode.childImageIds || []).filter(Boolean)));
        
        if (result.status === 'success') {
          const imageUrls = (result as any).urls || [(result as any).url].filter(Boolean);
          if (imageUrls.length > 0) {
            const resolvedResultImageSize = ((result as any).imageSize || latestNode.imageSize) as ImageSize | undefined;
            const recoveredUsage = latestNode.mode === GenerationMode.IMAGE
              ? resolveUsageMetrics({
                  model: (result as any).model || latestNode.model,
                  imageSize: resolvedResultImageSize,
                  prompt: latestNode.prompt,
                  imageCount: imageUrls.length,
                  referenceImageCount: latestNode.referenceImages?.length || 0,
                  keySlotId: (result as any).keySlotId || latestNode.keySlotId,
                  explicitCost: (result as any).usage?.cost,
                  explicitTokens: (result as any).usage?.totalTokens,
                })
              : {
                  cost: toFiniteNumber((result as any).usage?.cost),
                  tokens: toFiniteNumber((result as any).usage?.totalTokens),
                  costSource: toFiniteNumber((result as any).usage?.cost) !== undefined ? 'explicit' : 'none',
                };

            // Success recovery logic (similar to executeGeneration completion)
            const recoveredImageNodes = imageUrls.map((url: string, index: number) => {
              const imageId = `${node.id}_recovered_${Date.now()}_${index}`;
              const layoutIndex = currentChildIds.length + index;
              const resolvedAspectRatio = (result as any).aspectRatio || latestNode.aspectRatio;
              const resolvedImageSize = (result as any).imageSize || latestNode.imageSize;
              return {
                id: imageId, storageId: imageId, url, originalUrl: url,
                prompt: latestNode.prompt, model: (result as any).model || latestNode.model,
                modelLabel: (result as any).modelName || latestNode.modelLabel,
                modelColorStart: latestNode.modelColorStart,
                modelColorEnd: latestNode.modelColorEnd,
                modelColorSecondary: latestNode.modelColorSecondary,
                modelTextColor: latestNode.modelTextColor,
                aspectRatio: resolvedAspectRatio, imageSize: resolvedImageSize,
                timestamp: Date.now(), canvasId: activeCanvasRef.current?.id || 'default',
                parentPromptId: node.id,
                sourceReferenceStorageIds: (latestNode.referenceImages || []).map((ref) => ref.storageId || ref.id).filter(Boolean),
                position: getGeneratedImagePosition(latestNode.position, resolvedAspectRatio, latestNode.mode, layoutIndex, expectedCount),
                dimensions: `${resolvedAspectRatio} 路 ${resolvedImageSize || '1K'}`,
                provider: (result as any).provider || latestNode.provider,
                providerLabel: (result as any).providerName || latestNode.providerLabel,
                keySlotId: (result as any).keySlotId || latestNode.keySlotId,
                generationTime: clampGenerationDurationMs((result as any).generationTime),
                tokens: splitMetricAcrossItems(recoveredUsage.tokens, imageUrls.length),
                cost: splitMetricAcrossItems(recoveredUsage.cost, imageUrls.length),
                costSource: recoveredUsage.costSource,
                alias: latestNode.mode === GenerationMode.PPT ? buildPptPageAlias(latestNode.pptSlides?.[layoutIndex], layoutIndex) : undefined,
              };
            });

            const mergedChildIds = Array.from(new Set([...currentChildIds, ...recoveredImageNodes.map((img: any) => img.id)]));
            const nextSuccessCount = mergedChildIds.length;
            const nextFailCount = nextPendingTaskIds.length > 0 ? Math.max(0, expectedCount - nextSuccessCount - nextPendingTaskIds.length) : Math.max(0, expectedCount - nextSuccessCount);

            addImageNodes(recoveredImageNodes as any, {
              [latestNode.id]: {
                ...latestNode,
                isGenerating: nextPendingTaskIds.length > 0,
                jobId: nextJobId,
                childImageIds: mergedChildIds,
                error: undefined,
                errorDetails: undefined,
                lastGenerationSuccessCount: nextSuccessCount,
                lastGenerationFailCount: nextFailCount,
                generationMetadata: nextGenerationMetadata
              }
            });

            void markTaskCompleted(
              targetTaskId,
              imageUrls,
              recoveredUsage.cost,
              recoveredUsage.tokens
            );
            
            if (nextPendingTaskIds.length > 0) {
              setTimeout(() => {
                const fresh = activeCanvasRef.current?.promptNodes.find(n => n.id === node.id);
                if (fresh?.isGenerating) nextPendingTaskIds.forEach(tid => pollTaskStatus(fresh, tid));
              }, 5000);
            }
          }
        } else {
          // Failed
          urgentUpdatePromptNode({ ...latestNode, isGenerating: nextPendingTaskIds.length > 0, jobId: nextJobId, generationMetadata: nextGenerationMetadata, error: nextPendingTaskIds.length === 0 ? 'Task failed on backend' : undefined });
          // 轮询失败，更新数据库状态
          void markTaskFailed(targetTaskId, 'Task failed on backend');
        }
      } else {
        // Still pending
        setTimeout(() => {
          const freshNode = activeCanvasRef.current?.promptNodes.find(n => n.id === node.id);
          if (freshNode && freshNode.isGenerating) pollTaskStatus(freshNode, targetTaskId);
        }, 10000);
      }
    } catch (err) {
      console.error(`[useImageGeneration] Polling failed:`, err);
      const message = err instanceof Error ? err.message : String(err || 'Task polling failed');
      if (/credit rollback failed/i.test(message)) {
        const latestNode = activeCanvasRef.current?.promptNodes.find(n => n.id === node.id) || node;
        const { nextPendingTaskIds, nextJobId, nextGenerationMetadata } = resolvePendingTaskState(latestNode, targetTaskId);
        urgentUpdatePromptNode({
          ...latestNode,
          isGenerating: nextPendingTaskIds.length > 0,
          jobId: nextJobId,
          generationMetadata: nextGenerationMetadata,
          error: message,
          errorDetails: extractErrorDetails(err, latestNode.model)
        });
        return;
      }
      setTimeout(() => {
        const freshNode = activeCanvasRef.current?.promptNodes.find(n => n.id === node.id);
        if (freshNode?.isGenerating) pollTaskStatus(freshNode, targetTaskId);
      }, 15000);
    }
  }, [llmService, addImageNodes, urgentUpdatePromptNode, resolvePendingTaskState, getExpectedGenerationCount, getGeneratedImagePosition, buildPptPageAlias, getPendingTaskIds, extractErrorDetails]);

  useTaskRecovery(pollTaskStatus);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      const canvas = activeCanvasRef.current;
      if (!canvas?.promptNodes?.length) return;

      canvas.promptNodes.forEach((node) => {
        const latestNode = activeCanvasRef.current?.promptNodes.find((item) => item.id === node.id) || node;
        const pendingSyncRequests = getPendingSyncRequests(latestNode);

        pendingSyncRequests.forEach((pendingRequest) => {
          clearSyncBridgeRecoveryTimer(pendingRequest.requestId);
          syncBridgeRecoveryInFlightRef.current.delete(pendingRequest.requestId);
          void recoverSyncBridgeRequest(latestNode.id, pendingRequest);
        });

        getPendingTaskIds(latestNode).forEach((taskId) => {
          void pollTaskStatus(latestNode, taskId);
        });

        if (canAttemptRetroSyncBridgeRecovery(latestNode)) {
          retroSyncBridgeRecoveryAttemptedRef.current.delete(latestNode.id);
          void recoverFailedSyncBridgeGeneration(latestNode);
        }
      });
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [
    canAttemptRetroSyncBridgeRecovery,
    clearSyncBridgeRecoveryTimer,
    getPendingSyncRequests,
    getPendingTaskIds,
    pollTaskStatus,
    recoverFailedSyncBridgeGeneration,
    recoverSyncBridgeRequest
  ]);

  // --- Execution Logic ---

  const executeGeneration = useCallback(async (node: PromptNode) => {
    const { id: promptNodeId, prompt: promptToUse, parallelCount: count = 1, mode, referenceImages: initialFiles = [] } = node;
    const isVideo = mode === GenerationMode.VIDEO;
    const isAudio = mode === GenerationMode.AUDIO;
    const isPpt = mode === GenerationMode.PPT;
    const requestedCount = Math.max(1, Number(count) || 1);
    const actualCount = isPpt ? Math.min(20, requestedCount) : requestedCount;
    setIsGenerating(true);
    
    try {
      const { getImage } = await import('../services/storage/imageStorage');
      const { fileSystemService } = await import('../services/storage/fileSystemService');
      const globalHandle = fileSystemService.getGlobalHandle();
      
      const hydratedFiles = await Promise.all(initialFiles.map(async (img) => {
        if (img.data && img.data.length > 100) return img;
        if (img.storageId) {
          try {
            const dataUrl = await getImage(img.storageId);
            if (dataUrl) {
              const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
              if (matches && matches[2]) return { ...img, data: matches[2], mimeType: matches[1] || img.mimeType || 'image/png' };
              return { ...img, data: dataUrl };
            }
          } catch {}
          if (globalHandle) {
             try {
               const base64Data = await fileSystemService.loadReferenceImage(globalHandle, img.storageId);
               if (base64Data) return { ...img, data: base64Data, mimeType: 'image/jpeg' };
             } catch {}
          }
        }
        return img;
      }));
      
      const files = hydratedFiles.filter(hasRecoverableReferenceImage);
      if (initialFiles.length > 0) {
        const droppedCount = Math.max(0, hydratedFiles.length - files.length);
        console.log(`[useImageGeneration] Reference images prepared: input=${initialFiles.length}, hydrated=${hydratedFiles.length}, forwarded=${files.length}, dropped=${droppedCount}`);
        if (droppedCount > 0) {
          console.warn(`[useImageGeneration] Dropped ${droppedCount} empty reference image(s) before generation.`);
        }
      }
      const resolvedKey = keyManager.getNextKey(node.model, node.keySlotId);
      const effectiveKeySlotId = resolvedKey?.id || node.keySlotId;
      const routeProviderDisplay = effectiveKeySlotId
        ? resolveProviderDisplay(effectiveKeySlotId)
        : resolveProviderDisplay(undefined, node.providerLabel, node.provider);
      const preferRouteProviderDisplay = shouldPreferRouteProviderDisplay(node, routeProviderDisplay);
      const executionNode: PromptNode = {
        ...node,
        keySlotId: effectiveKeySlotId,
        provider: preferRouteProviderDisplay
          ? (routeProviderDisplay.provider || node.provider)
          : (node.provider || routeProviderDisplay.provider),
        providerLabel: preferRouteProviderDisplay
          ? (routeProviderDisplay.providerLabel || node.providerLabel)
          : (node.providerLabel || routeProviderDisplay.providerLabel),
      };

      if (
        executionNode.keySlotId !== node.keySlotId ||
        executionNode.provider !== node.provider ||
        executionNode.providerLabel !== node.providerLabel
      ) {
        const latestNode = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId) || node;
        urgentUpdatePromptNode({
          ...latestNode,
          keySlotId: executionNode.keySlotId,
          provider: executionNode.provider,
          providerLabel: executionNode.providerLabel,
        });
      }

      const effectiveSlideLines = isPpt ? normalizePptSlidesForCount(executionNode.pptSlides, executionNode.prompt, count) : [];
      const latestNode = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId) || node;

      urgentUpdatePromptNode({
        ...latestNode,
        ...executionNode,
        isGenerating: true,
        jobId: undefined,
        childImageIds: [],
        lastGenerationSuccessCount: 0,
        lastGenerationFailCount: 0,
        lastGenerationTotalCount: actualCount,
        error: undefined,
        errorDetails: undefined,
        generationMetadata: buildGenerationMetadata(latestNode, {
          pendingTaskIds: [],
          pendingSyncRequests: [],
        }),
      });
      
      const buildPptPagePrompt = (basePrompt: string, index: number, total: number) => {
        const pageNo = index + 1;
        const slideLines = effectiveSlideLines.length > 0 ? effectiveSlideLines : buildAutoPptSlides(basePrompt, total);
        const picked = slideLines[index] || `第 ${pageNo} 页：${basePrompt}`;
        return `PPT 第 ${pageNo} 页：${picked}。16:9 演示文稿风格，中文排版清晰，信息层次分明。`;
      };

      const buildTask = (index: number) => async () => {
        const startTime = Date.now();
        const currentRequestId = `${promptNodeId}-${index}`;
        let taskIdForRecovery: string | undefined = undefined;

        try {
          let generatedBase64 = '';
          let videoUrl = '';
          const taskPrompt = isPpt ? buildPptPagePrompt(promptToUse, index, actualCount) : promptToUse;
          let resolvedResultKeySlotId: string | undefined = executionNode.keySlotId;
          let resolvedProvider = executionNode.provider;
          let resolvedProviderName = executionNode.providerLabel;
          let resolvedModelName = executionNode.modelLabel;
          let resolvedModelId = executionNode.model;
          let resolvedCost: number | undefined = undefined;
          let resolvedCostSource: NonNullable<GeneratedImage['costSource']> | undefined = undefined;
          let resolvedTokens: number | undefined = undefined;
          let resolvedImageSize: ImageSize | undefined = executionNode.imageSize;
          let resolvedAspectRatio: AspectRatio = executionNode.aspectRatio;
          let resolvedExactDimensions: { width: number; height: number } | undefined = undefined;
          
          if (isAudio) {
            const audioResult = await llmService.generateAudio({ modelId: executionNode.model, prompt: taskPrompt, audioDuration: executionNode.audioDuration, audioLyrics: executionNode.audioLyrics, preferredKeyId: executionNode.keySlotId, providerConfig: {} });
            videoUrl = audioResult.url;
            resolvedResultKeySlotId = audioResult.keySlotId || resolvedResultKeySlotId;
            resolvedProvider = audioResult.provider || resolvedProvider;
            resolvedProviderName = audioResult.providerName || resolvedProviderName;
            resolvedModelName = audioResult.modelName || resolvedModelName;
            resolvedModelId = audioResult.model || resolvedModelId;
            resolvedCost = toFiniteNumber(audioResult.usage?.cost);
            resolvedCostSource = resolvedCost !== undefined ? 'explicit' : undefined;
            resolvedTokens = toFiniteNumber(audioResult.usage?.totalTokens);
          } else if (isVideo) {
            const videoResult = await llmService.generateVideo({ 
              modelId: executionNode.model, prompt: taskPrompt, aspectRatio: executionNode.aspectRatio === '9:16' ? '9:16' : '16:9', 
              imageUrl: files[0]?.data, videoDuration: executionNode.videoDuration, preferredKeyId: executionNode.keySlotId, 
              providerConfig: {}, 
              onTaskId: (taskId) => {
                taskIdForRecovery = taskId;
                const fresh = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId);
                if (fresh) urgentUpdatePromptNode(registerPendingTaskId(fresh, taskId));
                // 持久化任务到数据库
                void persistTask(taskId, executionNode, activeCanvasRef.current?.id);
              }
            });
            videoUrl = videoResult.url;
            resolvedResultKeySlotId = videoResult.keySlotId || resolvedResultKeySlotId;
            resolvedProvider = videoResult.provider || resolvedProvider;
            resolvedProviderName = videoResult.providerName || resolvedProviderName;
            resolvedModelName = videoResult.modelName || resolvedModelName;
            resolvedModelId = videoResult.model || resolvedModelId;
            resolvedCost = toFiniteNumber(videoResult.usage?.cost);
            resolvedCostSource = resolvedCost !== undefined ? 'explicit' : undefined;
            resolvedTokens = toFiniteNumber(videoResult.usage?.totalTokens);
          } else {
            const result = await generateImage(taskPrompt, executionNode.aspectRatio, executionNode.imageSize, files, executionNode.model, '', currentRequestId, !!executionNode.enableGrounding || !!executionNode.enableImageSearch, {
              maskUrl: executionNode.maskUrl, editMode: executionNode.mode === GenerationMode.INPAINT ? 'inpaint' : (executionNode.mode === GenerationMode.EDIT ? 'edit' : undefined),
              preferredKeyId: executionNode.keySlotId, 
              onTaskId: (taskId) => {
                taskIdForRecovery = taskId;
                const fresh = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId);
                if (fresh) urgentUpdatePromptNode(clearPendingSyncRequests(registerPendingTaskId(fresh, taskId), [currentRequestId]));
                // 持久化任务到数据库
                void persistTask(taskId, executionNode, activeCanvasRef.current?.id);
              },
              onSyncBridgeRegistered: (requestId: string) => {
                const fresh = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId);
                if (!fresh) return;
                urgentUpdatePromptNode(registerPendingSyncRequest(fresh, {
                  requestId,
                  index,
                  prompt: taskPrompt,
                  startedAt: Date.now(),
                  keySlotId: executionNode.keySlotId
                }));
              }
            });
            generatedBase64 = result.url;
            resolvedResultKeySlotId = result.keySlotId || resolvedResultKeySlotId;
            resolvedProvider = result.provider || resolvedProvider;
            resolvedProviderName = result.providerName || resolvedProviderName;
            resolvedModelName = result.modelName || resolvedModelName;
            resolvedModelId = result.effectiveModel || resolvedModelId;
            resolvedImageSize = result.effectiveSize || result.imageSize || resolvedImageSize;
            resolvedAspectRatio = result.aspectRatio || resolvedAspectRatio;
            resolvedExactDimensions = result.dimensions;

            const resolvedUsage = resolveUsageMetrics({
              model: resolvedModelId,
              imageSize: resolvedImageSize,
              prompt: taskPrompt,
              imageCount: 1,
              referenceImageCount: files.length,
              keySlotId: resolvedResultKeySlotId,
              explicitCost: result.cost,
              explicitTokens: result.tokens,
            });
            resolvedCost = resolvedUsage.cost;
            resolvedCostSource = resolvedUsage.costSource;
            resolvedTokens = resolvedUsage.tokens;
          }

          return { 
            index, url: isVideo || isAudio ? videoUrl : generatedBase64, originalUrl: isVideo || isAudio ? videoUrl : generatedBase64, 
            generationTime: clampGenerationDurationMs(Date.now() - startTime), base64: generatedBase64, mode, 
            taskId: taskIdForRecovery, taskPrompt, keySlotId: resolvedResultKeySlotId, requestId: currentRequestId,
            provider: resolvedProvider, providerName: resolvedProviderName, modelName: resolvedModelName, model: resolvedModelId,
            imageSize: resolvedImageSize, aspectRatio: resolvedAspectRatio, dimensions: resolvedExactDimensions, tokens: resolvedTokens, cost: resolvedCost, costSource: resolvedCostSource,
          };
        } catch (error: any) {
          return { error: error.message || 'Unknown error', errorDetails: extractErrorDetails(error, executionNode.model), taskId: taskIdForRecovery, requestId: currentRequestId };
        }
      };

      const tasks = Array.from({ length: actualCount }).map((_, index) => buildTask(index));
      const imageData = await Promise.all(tasks.map(t => t()));
      
      const validImageData = imageData.filter(d => !('error' in d)) as any[];
      const failedImageData = imageData.filter(d => 'error' in d) as any[];
      const latestNodeAfterBatch = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId) || node;
      const pendingSyncRequestIds = new Set(
        getPendingSyncRequests(latestNodeAfterBatch).map((item) => item.requestId)
      );
      const recoverableSyncFailureRequestIds = new Set(
        failedImageData
          .filter((item) => isRecoverableSyncBridgeFailure({
            requestId: item.requestId,
            error: item.error,
            errorDetails: item.errorDetails,
            pendingSyncRequestIds,
          }))
          .map((item) => item.requestId)
          .filter((requestId): requestId is string => typeof requestId === 'string' && requestId.trim().length > 0)
      );
      const recoverableSyncFailureCount = failedImageData.filter((item) => (
        typeof item.requestId === 'string' && recoverableSyncFailureRequestIds.has(item.requestId)
      )).length;
      const nonRecoverableFailureCount = Math.max(0, failedImageData.length - recoverableSyncFailureCount);

      failedImageData.forEach((item) => {
        if (typeof item.taskId !== 'string' || item.taskId.trim().length === 0) return;
        if (typeof item.requestId === 'string' && recoverableSyncFailureRequestIds.has(item.requestId)) return;

        void markTaskFailed(item.taskId, item.error || 'Generation failed');
      });
      
      if (validImageData.length > 0) {
        const generatedPositions = buildGeneratedImageBatchPositions({
          basePosition: executionNode.position,
          items: validImageData.map((item) => ({
            aspectRatio: item.aspectRatio || executionNode.aspectRatio,
            exactDimensions: item.dimensions,
          })),
          mode: executionNode.mode,
          isMobile,
        });

        const results = validImageData.map(item => {
          const idx = item.index;
          const uniqueId = `${Date.now()}_${idx}_${Math.random()}`;
          if (item.base64?.startsWith('data:')) saveOriginalImage(uniqueId, item.base64, mode === GenerationMode.VIDEO).catch(() => {});
          
          return {
            id: uniqueId, storageId: uniqueId, url: item.url, originalUrl: item.originalUrl,
            prompt: item.taskPrompt || promptToUse, aspectRatio: item.aspectRatio || executionNode.aspectRatio, imageSize: item.imageSize || executionNode.imageSize,
            timestamp: Date.now(), model: item.model || executionNode.model, canvasId: activeCanvasRef.current?.id || 'default',
            modelLabel: item.modelName || executionNode.modelLabel,
            modelColorStart: executionNode.modelColorStart,
            modelColorEnd: executionNode.modelColorEnd,
            modelColorSecondary: executionNode.modelColorSecondary,
            modelTextColor: executionNode.modelTextColor,
            provider: item.provider || executionNode.provider,
            providerLabel: item.providerName || executionNode.providerLabel,
            parentPromptId: promptNodeId,
            position: generatedPositions[idx] || getGeneratedImagePosition(executionNode.position, executionNode.aspectRatio, executionNode.mode, idx, actualCount),
            dimensions: item.dimensions ? `${item.dimensions.width}x${item.dimensions.height}` : undefined,
            exactDimensions: item.dimensions,
            sourceReferenceStorageIds: (executionNode.referenceImages || []).map((ref) => ref.storageId || ref.id).filter(Boolean),
            generationTime: clampGenerationDurationMs(item.generationTime), keySlotId: item.keySlotId, mode,
            tokens: item.tokens, cost: item.cost, costSource: item.costSource,
          };
        });

        const latestNode = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId) || node;
        const pendingIds = getPendingTaskIds(latestNode).filter(tid => !validImageData.some(v => v.taskId === tid));
        const completedSyncRequestIds = imageData
          .map(item => item.requestId)
          .filter((requestId): requestId is string => typeof requestId === 'string' && requestId.trim().length > 0)
          .filter((requestId) => !recoverableSyncFailureRequestIds.has(requestId));
        const nextNodeBase = clearPendingSyncRequests(latestNode, completedSyncRequestIds);
        const remainingSyncRequests = getPendingSyncRequests(nextNodeBase);
        const firstSuccess = validImageData[0];
        const resolvedSuccessDisplay = firstSuccess?.keySlotId
          ? resolveProviderDisplay(firstSuccess.keySlotId, firstSuccess.providerName, firstSuccess.provider)
          : resolveProviderDisplay(undefined, executionNode.providerLabel, executionNode.provider);
        
        const updatedNode = {
          ...nextNodeBase, isGenerating: pendingIds.length > 0 || remainingSyncRequests.length > 0, jobId: pendingIds[0],
          childImageIds: results.map(r => r.id), lastGenerationSuccessCount: validImageData.length,
          lastGenerationFailCount: nonRecoverableFailureCount, lastGenerationTotalCount: actualCount,
          error: undefined,
          errorDetails: undefined,
          generationMetadata: buildGenerationMetadata(nextNodeBase, { pendingTaskIds: pendingIds, pendingSyncRequests: remainingSyncRequests }),
          keySlotId: firstSuccess?.keySlotId || executionNode.keySlotId,
          provider: resolvedSuccessDisplay.provider || executionNode.provider,
          providerLabel: resolvedSuccessDisplay.providerLabel || executionNode.providerLabel,
          modelLabel: firstSuccess?.modelName || executionNode.modelLabel
        };
        
        addImageNodes(results as any, { [updatedNode.id]: updatedNode });
        validImageData.forEach((item) => {
          if (typeof item.taskId !== 'string' || item.taskId.trim().length === 0) return;
          if (typeof item.url !== 'string' || item.url.trim().length === 0) return;

          void markTaskCompleted(item.taskId, [item.url], item.cost, item.tokens);
        });
        completedSyncRequestIds.forEach((requestId) => {
          void clearSyncImageBridgeRequest(requestId).catch(() => undefined);
          clearSyncBridgeRecoveryTimer(requestId);
        });
        rememberPreferredKeyForMode(mode, updatedNode.keySlotId);
        
        if (pendingIds.length > 0) {
          setTimeout(() => {
            const fresh = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId);
            if (fresh?.isGenerating) pendingIds.forEach(tid => pollTaskStatus(fresh, tid));
          }, 5000);
        }

        if (remainingSyncRequests.length > 0) {
          remainingSyncRequests.forEach((pendingRequest) => {
            clearSyncBridgeRecoveryTimer(pendingRequest.requestId);
            void recoverSyncBridgeRequest(updatedNode.id, pendingRequest);
          });
        }
      } else {
        const latestNode = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId) || node;
        const completedSyncRequestIds = imageData
          .map(item => item.requestId)
          .filter((requestId): requestId is string => typeof requestId === 'string' && requestId.trim().length > 0)
          .filter((requestId) => !recoverableSyncFailureRequestIds.has(requestId));
        const nextNodeBase = clearPendingSyncRequests(latestNode, completedSyncRequestIds);
        const remainingPendingTaskIds = getPendingTaskIds(nextNodeBase);
        const remainingSyncRequests = getPendingSyncRequests(nextNodeBase);
        const isStillRecovering = remainingPendingTaskIds.length > 0 || remainingSyncRequests.length > 0;

        await updatePromptNode({
          ...nextNodeBase,
          isGenerating: isStillRecovering,
          jobId: remainingPendingTaskIds[0],
          childImageIds: [],
          lastGenerationSuccessCount: 0,
          lastGenerationFailCount: isStillRecovering ? nonRecoverableFailureCount : (nonRecoverableFailureCount || actualCount),
          lastGenerationTotalCount: actualCount,
          error: isStillRecovering ? undefined : (failedImageData[0]?.error || 'Generation failed'),
          errorDetails: isStillRecovering
            ? undefined
            : (failedImageData[0]?.errorDetails || extractErrorDetails(new Error(failedImageData[0]?.error || 'Generation failed'), executionNode.model))
        });
        completedSyncRequestIds.forEach((requestId) => {
          void clearSyncImageBridgeRequest(requestId).catch(() => undefined);
          clearSyncBridgeRecoveryTimer(requestId);
        });

        if (isStillRecovering) {
          remainingPendingTaskIds.forEach((taskId) => {
            setTimeout(() => {
              const fresh = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId);
              if (fresh?.isGenerating) void pollTaskStatus(fresh, taskId);
            }, 5000);
          });

          remainingSyncRequests.forEach((pendingRequest) => {
            clearSyncBridgeRecoveryTimer(pendingRequest.requestId);
            void recoverSyncBridgeRequest(nextNodeBase.id, pendingRequest);
          });
          return;
        }

        throw new Error(failedImageData[0]?.error || 'Generation failed');
      }

    } catch (err: any) {
      console.error('[useImageGeneration] Execution error:', err);
      const latest = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId) || node;
      await updatePromptNode({
        ...latest,
        isGenerating: false,
        lastGenerationSuccessCount: latest.lastGenerationSuccessCount ?? 0,
        lastGenerationFailCount: Math.max(latest.lastGenerationFailCount ?? 0, actualCount),
        lastGenerationTotalCount: latest.lastGenerationTotalCount ?? actualCount,
        error: err.message,
        errorDetails: extractErrorDetails(err, node.model)
      });
      if (node.cost && node.cost > 0) refundCredits(node.cost, `退款 ${node.id}`);
    } finally {
      setIsGenerating(false);
    }
  }, [
    activeCanvasRef,
    addImageNodes,
    updatePromptNode,
    urgentUpdatePromptNode,
    getGeneratedImagePosition,
    registerPendingTaskId,
    registerPendingSyncRequest,
    clearPendingSyncRequests,
    getPendingTaskIds,
    getPendingSyncRequests,
    buildPendingTaskMetadata,
    buildGenerationMetadata,
    pollTaskStatus,
    extractErrorDetails,
    normalizePptSlidesForCount,
    buildAutoPptSlides,
    rememberPreferredKeyForMode,
    refundCredits,
    resolveProviderDisplay,
    shouldPreferRouteProviderDisplay,
    clearSyncBridgeRecoveryTimer,
    recoverSyncBridgeRequest,
    isRecoverableSyncBridgeFailure
  ]);

  const hookCancelGeneration = useCallback((nodeId?: string) => {
    if (!nodeId) return;
    cancelGeneration(nodeId);
  }, []);

  return {
    isGenerating,
    executeGeneration,
    pollTaskStatus,
    getPendingTaskIds,
    cancelGeneration: hookCancelGeneration,
    recoverFailedSyncBridgeGeneration
  };
};
