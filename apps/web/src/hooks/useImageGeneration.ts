import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type PromptNode,
  type GeneratedImage,
  GenerationMode,
  AspectRatio,
  ImageSize,
  type ReferenceImage,
  type PromptPendingSyncRequest,
  type PromptCompletedTask,
  type TaskProviderType,
} from '../types';
import { llmService } from '../services/llm/LLMService';
import { generateImage, cancelGeneration } from '../services/llm/geminiService';
import { useCanvas } from '../context/CanvasContext';
import { useBilling } from '../context/BillingContext';
import { useAppStartup } from '../context/AppStartupContext';
import { calculateCost, resolveImageCost } from '../services/billing/costService';
import {
  buildGenerationAttemptRequestId,
  resolveGenerationAttemptFailureState,
} from '../services/billing/generationBillingCoordinator';
import { saveOriginalImage, getImage, normalizePersistableMediaSource } from '../services/storage/imageStorage';
import { fileSystemService } from '../services/storage/fileSystemService';
import { keyManager, getModelMetadata } from '../services/auth/keyManager';
import { 
  normalizePptSlidesForCount, 
  buildAutoPptSlides, 
  buildPptPageAlias 
} from '../utils/pptUtils';
import { buildGeneratedImageBatchPositions } from '../utils/generatedImageLayout';
import { buildPptDeckModuleState } from '../utils/pptDeckModules';
import { clearSyncImageBridgeRequest, getSyncImageBridgeRequest, isSyncImageBridgeSupported } from '../services/llm/syncImageBridge';
import { clampGenerationDurationMs } from '../utils/timeUtils';
import { hasNetworkErrorMarkers, hasTimeoutMarkers } from '../services/api/errorClassification';
import { useTaskRecovery, persistTask, markTaskCompleted, markTaskFailed } from './useTaskRecovery';
import { resolveProviderRuntime } from '../services/api/providerStrategy';
import {
  buildImageResultIdentity,
  buildTaskResultIdentity,
  getPromptCompletedTasks,
  mergeCompletedTaskResults,
  normalizePersistentResultUrl,
} from '../utils/imageResultPersistence';
import { resolveProviderIdentity } from '../utils/providerDisplay';
import { getReferenceImageLookupIds } from '../utils/referenceImageStorage';
import { normalizeModelId } from '../utils/modelIdNormalization';
import { resolveModelDisplayName } from '../utils/modelDisplayName';
import { compositePartialRedrawResult, compositeRedrawCropResult } from '../services/image/partialRedraw';
import {
  isSecureProxyGuestModeError,
  isSecureProxySessionReauthError,
  SECURE_PROXY_GUEST_MODE_MESSAGE,
  SECURE_PROXY_SESSION_REAUTH_MESSAGE,
} from '../services/model/secureModelProxy';

const SYNC_BRIDGE_RECOVERY_RETRY_MS = 2500;
const SYNC_BRIDGE_RECOVERY_MAX_AGE_MS = 15 * 60 * 1000;
const RETRO_RECOVERABLE_SYNC_BRIDGE_ERROR_CODES = new Set(['SYNC_REQUEST_INTERRUPTED', 'SYNC_BRIDGE_TIMEOUT']);
const RETRO_RECOVERABLE_SYNC_BRIDGE_ERROR_TEXT_HINTS = ['::INTERRUPTED::', '页面刷新或离开时中断了同步生成请求', '同步生成恢复超时'];

type PendingSyncRequest = PromptPendingSyncRequest;

type CompletedTaskSourceItem = Partial<GeneratedImage> & {
  taskId?: string;
  requestId?: string;
  providerName?: string;
  modelName?: string;
  taskPrompt?: string;
  base64?: string;
  index?: number;
};

type PreparedCompletedTaskItem<T> = {
  item: T;
  sourceTaskId: string;
  sourceResultIndex: number;
  apiResultUrl?: string;
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

const getPromptAttemptStartedAt = (node?: Partial<PromptNode> | null): number | undefined => {
  const rawAttemptStartedAt = (node?.generationMetadata as { attemptStartedAt?: unknown } | undefined)?.attemptStartedAt;
  return toFiniteTimestamp(toFiniteNumber(rawAttemptStartedAt));
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
  provider?: string;
  providerLabel?: string;
  explicitCost?: number;
  explicitTokens?: number;
  explicitPromptTokens?: number;
  explicitCompletionTokens?: number;
}): {
  cost?: number;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  costSource: NonNullable<GeneratedImage['costSource']>;
} => {
  const explicitCost = toFiniteNumber(params.explicitCost);
  const explicitPromptTokens = toFiniteNumber(params.explicitPromptTokens);
  const explicitCompletionTokens = toFiniteNumber(params.explicitCompletionTokens);
  const explicitTokens = toFiniteNumber(params.explicitTokens)
    ?? ((explicitPromptTokens !== undefined || explicitCompletionTokens !== undefined)
      ? (explicitPromptTokens || 0) + (explicitCompletionTokens || 0)
      : undefined);
  const resolvedImageSize = params.imageSize || ImageSize.SIZE_1K;

  try {
    const resolvedCost = resolveImageCost({
      model: params.model,
      imageSize: resolvedImageSize,
      count: Math.max(1, params.imageCount || 1),
      prompt: params.prompt,
      referenceImageCount: Math.max(0, params.referenceImageCount || 0),
      keySlotId: params.keySlotId,
      provider: params.provider,
      providerLabel: params.providerLabel,
      promptTokens: explicitPromptTokens,
      completionTokens: explicitCompletionTokens,
      totalTokens: explicitTokens,
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
      promptTokens: explicitPromptTokens,
      completionTokens: explicitCompletionTokens,
      costSource: resolvedCost.source as NonNullable<GeneratedImage['costSource']>,
    };
  } catch {
    return {
      cost: explicitCost,
      tokens: explicitTokens,
      promptTokens: explicitPromptTokens,
      completionTokens: explicitCompletionTokens,
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
    bringNodesToFront
  } = useCanvas();
  
  const { refundCreditsByTransaction, refreshBilling, applyAuthoritativeBalance } = useBilling();
  const { isStageReady } = useAppStartup();
  const canStartBackgroundRecovery = isStageReady('background_ready');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const activeCanvasRef = useRef(activeCanvas);
  useEffect(() => {
    activeCanvasRef.current = activeCanvas;
  }, [activeCanvas]);

  const shouldRefreshServerBillingState = useCallback((target?: Partial<PromptNode> | null) => (
    target?.billingMode === 'credits'
      && target?.creditSettlement === 'server'
      && Number(target?.cost || 0) > 0
  ), []);

  const resolveFailedBillingState = useCallback(async (
    target: Pick<PromptNode, 'id' | 'billingMode' | 'creditSettlement' | 'isPaymentProcessed' | 'paymentTransactionId' | 'refundStatus' | 'cost'>,
    options?: { forceServerRefundFailure?: boolean }
  ) => {
    const failureState = await resolveGenerationAttemptFailureState(target, {
      refundCreditsByTransaction,
      refreshBilling,
    }, options);

    if (
      failureState.refundStatus === 'failed'
      && shouldRefreshServerBillingState(target)
      && !options?.forceServerRefundFailure
    ) {
      console.error('[useImageGeneration] Failed to refresh billing after server-side credit failure:', target.id);
    }

    return failureState;
  }, [refundCreditsByTransaction, refreshBilling, shouldRefreshServerBillingState]);

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

  const getDisplayableGenerationError = useCallback((error: any) => {
    if (isSecureProxySessionReauthError(error)) {
      return error?.message || SECURE_PROXY_SESSION_REAUTH_MESSAGE;
    }

    if (isSecureProxyGuestModeError(error)) {
      return error?.message || SECURE_PROXY_GUEST_MODE_MESSAGE;
    }

    return error?.message || 'Unknown error';
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
    return resolveProviderIdentity({
      keySlotId,
      provider: fallbackProvider,
      providerLabel: fallbackProviderLabel,
    });
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

  const detectTaskProviderType = useCallback((model?: string, runtimeStrategyId?: string): TaskProviderType => {
    const normalizedModel = String(model || '').trim().toLowerCase();
    if (
      normalizedModel.includes('midjourney')
      || normalizedModel.startsWith('mj-')
      || normalizedModel.startsWith('mj_')
      || normalizedModel.includes('/mj')
    ) {
      return 'midjourney';
    }

    if (runtimeStrategyId === 'gpt-best' && normalizedModel.includes('journey')) {
      return 'midjourney';
    }

    return 'generic';
  }, []);

  const resolveTaskRuntimeSnapshot = useCallback((params: {
    keySlotId?: string;
    provider?: string;
    providerLabel?: string;
    model?: string;
  }) => {
    const keySlot = params.keySlotId ? keyManager.getKey(params.keySlotId) : null;
    const runtime = resolveProviderRuntime({
      provider: keySlot?.provider || params.provider,
      baseUrl: keySlot?.baseUrl,
      format: keySlot?.format,
      authMethod: keySlot?.authMethod,
      headerName: keySlot?.headerName,
      compatibilityMode: keySlot?.compatibilityMode,
      modelId: params.model,
    });

    return {
      keySlotId: params.keySlotId || keySlot?.id,
      provider: params.provider || keySlot?.provider,
      providerLabel: params.providerLabel || keySlot?.name,
      runtimeStrategyId: runtime.strategyId,
      taskProviderType: detectTaskProviderType(params.model, runtime.strategyId),
    };
  }, [detectTaskProviderType]);

  const resolveCompletedTaskId = useCallback((params: {
    promptId: string;
    taskId?: string;
    requestId?: string;
    fallbackSeed?: string | number;
  }) => {
    const taskId = String(params.taskId || '').trim();
    if (taskId) return taskId;

    const requestId = String(params.requestId || '').trim();
    if (requestId) return `sync:${params.promptId}:${requestId}`;

    return `sync:${params.promptId}:${String(params.fallbackSeed || Date.now())}`;
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

  const attachCompletedTasksToPrompt = useCallback((
    node: PromptNode,
    completedTasks: PromptCompletedTask[]
  ): PromptNode => {
    if (!completedTasks.length) return node;

    return {
      ...node,
      generationMetadata: buildGenerationMetadata(node, {
        completedTasks: mergeCompletedTaskResults(
          getPromptCompletedTasks(node),
          completedTasks
        ),
      }),
    };
  }, [buildGenerationMetadata]);

  const prepareCompletedTaskResults = useCallback(<T extends CompletedTaskSourceItem>(
    promptId: string,
    items: T[],
    fallback: {
      keySlotId?: string;
      provider?: string;
      providerLabel?: string;
      model?: string;
      modelLabel?: string;
      batchKey?: string;
    }
  ): {
    completedTasks: PromptCompletedTask[];
    preparedItems: Array<PreparedCompletedTaskItem<T>>;
  } => {
    const groups = new Map<string, { record: PromptCompletedTask; urlToIndex: Map<string, number> }>();
    const preparedItems = items.map((item, index) => {
      const sourceTaskId = resolveCompletedTaskId({
        promptId,
        taskId: item.taskId,
        requestId: item.requestId,
        fallbackSeed: `${fallback.batchKey || 'sync'}:${index}`,
      });
      const runtimeSnapshot = resolveTaskRuntimeSnapshot({
        keySlotId: item.keySlotId || fallback.keySlotId,
        provider: item.provider || fallback.provider,
        providerLabel: item.providerName || item.providerLabel || fallback.providerLabel,
        model: item.model || fallback.model,
      });

      let group = groups.get(sourceTaskId);
      if (!group) {
        group = {
          record: {
            taskId: sourceTaskId,
            resultUrls: [],
            completedAt: Date.now(),
            provider: runtimeSnapshot.provider,
            providerLabel: runtimeSnapshot.providerLabel,
            keySlotId: runtimeSnapshot.keySlotId,
            runtimeStrategyId: runtimeSnapshot.runtimeStrategyId,
            taskProviderType: runtimeSnapshot.taskProviderType,
            model: item.model || fallback.model,
            modelLabel: resolveModelDisplayName(
              item.model || fallback.model,
              item.modelName || item.modelLabel || fallback.modelLabel,
            ),
            costSource: item.costSource,
          },
          urlToIndex: new Map<string, number>(),
        };
        groups.set(sourceTaskId, group);
      }

      const apiResultUrl = normalizePersistentResultUrl(item.originalUrl || item.url);
      let sourceResultIndex = index;

      if (apiResultUrl) {
        const existingIndex = group.urlToIndex.get(apiResultUrl);
        if (existingIndex !== undefined) {
          sourceResultIndex = existingIndex;
        } else {
          sourceResultIndex = group.record.resultUrls.length;
          group.record.resultUrls.push(apiResultUrl);
          group.urlToIndex.set(apiResultUrl, sourceResultIndex);
        }
      }

      const resolvedCost = toFiniteNumber(item.cost);
      if (resolvedCost !== undefined) {
        group.record.cost = (group.record.cost || 0) + resolvedCost;
      }

      if (!group.record.costSource && item.costSource) {
        group.record.costSource = item.costSource;
      }

      const resolvedTokens = toFiniteNumber(item.tokens);
      if (resolvedTokens !== undefined) {
        group.record.tokens = (group.record.tokens || 0) + resolvedTokens;
      }

      return {
        item,
        sourceTaskId,
        sourceResultIndex,
        apiResultUrl,
      };
    });

    return {
      completedTasks: Array.from(groups.values()).map((group) => group.record),
      preparedItems,
    };
  }, [resolveCompletedTaskId, resolveTaskRuntimeSnapshot]);

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
    const baseStartedAt = getPromptAttemptStartedAt(node)
      ?? toFiniteTimestamp(node.errorDetails?.timestamp)
      ?? toFiniteTimestamp(node.timestamp)
      ?? Date.now();

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
  const activeSyncBridgeRequestIdsRef = useRef<Set<string>>(new Set());

  const getPromptChildImageSourceKeys = useCallback((promptId: string) => {
    const keys = new Set<string>();
    (activeCanvasRef.current?.imageNodes || []).forEach((imageNode) => {
      if (imageNode.parentPromptId !== promptId) return;

      const identity = buildImageResultIdentity(imageNode);
      if (identity) {
        keys.add(identity);
      }

      const legacyUrlIdentity = buildTaskResultIdentity({
        url: normalizePersistentResultUrl(imageNode.originalUrl || imageNode.url),
      });
      if (legacyUrlIdentity) {
        keys.add(legacyUrlIdentity);
      }
    });
    return keys;
  }, []);

  const filterUniqueGeneratedSources = useCallback(<T,>(
    promptId: string,
    items: T[],
    resolveSource: (item: T, index: number) => {
      taskId?: string | null;
      requestId?: string | null;
      resultIndex?: number | null;
      url?: string | null;
    }
  ) => {
    const seenKeys = getPromptChildImageSourceKeys(promptId);
    return items.filter((item, index) => {
      const source = resolveSource(item, index);
      const sourceTaskId = resolveCompletedTaskId({
        promptId,
        taskId: typeof source.taskId === 'string' ? source.taskId : undefined,
        requestId: typeof source.requestId === 'string' ? source.requestId : undefined,
        fallbackSeed: index,
      });
      const key = buildTaskResultIdentity({
        taskId: sourceTaskId,
        resultIndex: source.resultIndex,
        url: source.url,
      });
      if (!key) return true;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }, [getPromptChildImageSourceKeys, resolveCompletedTaskId]);

  const clearSyncBridgeRecoveryTimer = useCallback((requestId: string) => {
    const timer = syncBridgeRecoveryTimersRef.current.get(requestId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      syncBridgeRecoveryTimersRef.current.delete(requestId);
    }
  }, []);

  const markSyncBridgeRequestActive = useCallback((requestId?: string | null) => {
    const normalized = typeof requestId === 'string' ? requestId.trim() : '';
    if (!normalized) return;
    activeSyncBridgeRequestIdsRef.current.add(normalized);
    clearSyncBridgeRecoveryTimer(normalized);
  }, [clearSyncBridgeRecoveryTimer]);

  const releaseSyncBridgeRequestActive = useCallback((requestId?: string | null) => {
    const normalized = typeof requestId === 'string' ? requestId.trim() : '';
    if (!normalized) return;
    activeSyncBridgeRequestIdsRef.current.delete(normalized);
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
    if (activeSyncBridgeRequestIdsRef.current.has(pendingRequest.requestId)) return;
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
      const uniqueRecoveredUrls = filterUniqueGeneratedSources(nodeId, bridgeResult.urls, (url, index) => ({
        requestId: pendingRequest.requestId,
        resultIndex: index,
        url,
      }));
      const recoveredUsage = resolveUsageMetrics({
        model: normalizeModelId(latestNode.model),
        imageSize: latestNode.imageSize,
        prompt: pendingRequest.prompt || latestNode.prompt,
        imageCount: uniqueRecoveredUrls.length || bridgeResult.urls.length,
        referenceImageCount: latestNode.referenceImages?.length || 0,
        keySlotId: pendingRequest.keySlotId || latestNode.keySlotId,
        provider: latestNode.provider,
        providerLabel: latestNode.providerLabel,
      });
      const recoveredGenerationTime = resolveSyncBridgeDurationMs(bridgeResult, pendingRequest.startedAt);
      const recoveredModelId = normalizeModelId(latestNode.model);
      const recoveredModelLabel = resolveModelDisplayName(recoveredModelId, latestNode.modelLabel);
      const { completedTasks, preparedItems } = prepareCompletedTaskResults(nodeId, uniqueRecoveredUrls.map((url) => ({
        requestId: pendingRequest.requestId,
        url,
        originalUrl: url,
        keySlotId: pendingRequest.keySlotId || latestNode.keySlotId,
        provider: latestNode.provider,
        providerName: latestNode.providerLabel,
        model: recoveredModelId,
        modelName: recoveredModelLabel,
        cost: splitMetricAcrossItems(recoveredUsage.cost, bridgeResult.urls.length),
        costSource: recoveredUsage.costSource,
        tokens: splitMetricAcrossItems(recoveredUsage.tokens, bridgeResult.urls.length),
      })), {
        keySlotId: pendingRequest.keySlotId || latestNode.keySlotId,
        provider: latestNode.provider,
        providerLabel: latestNode.providerLabel,
        model: recoveredModelId,
        modelLabel: recoveredModelLabel,
        batchKey: pendingRequest.requestId,
      });
      const recoveredResults = preparedItems.map(({ item, sourceTaskId, sourceResultIndex, apiResultUrl }, index) => {
        const imageId = `${nodeId}_sync_recovered_${Date.now()}_${pendingRequest.index}_${index}`;
        const layoutIndex = pendingRequest.index + index;
        return {
          id: imageId,
          storageId: imageId,
          url: item.url,
          originalUrl: item.originalUrl,
          apiResultUrl,
          prompt: pendingRequest.prompt || latestNode.prompt,
          model: recoveredModelId,
          modelLabel: recoveredModelLabel,
          modelColorStart: latestNode.modelColorStart,
          modelColorEnd: latestNode.modelColorEnd,
          modelColorSecondary: latestNode.modelColorSecondary,
          modelTextColor: latestNode.modelTextColor,
          aspectRatio: latestNode.aspectRatio,
          imageSize: latestNode.imageSize,
          timestamp: Date.now(),
          canvasId: activeCanvasRef.current?.id || 'default',
          parentPromptId: nodeId,
          ecommerceDeliveryKind: latestNode.ecommerce?.activeDeliveryKind || latestNode.redraw?.inheritedDeliveryKind || latestNode.partialRedraw?.inheritedDeliveryKind,
          sourceTaskId,
          sourceResultIndex,
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
      const persistedPromptState = attachCompletedTasksToPrompt({
        ...nextNode,
        isGenerating: remainingTaskIds.length > 0 || remainingSyncRequests.length > 0,
        jobId: remainingTaskIds[0],
        error: undefined,
        errorDetails: undefined,
        lastGenerationSuccessCount: nextSuccessCount,
        lastGenerationFailCount: nextFailCount,
        lastGenerationTotalCount: expectedCount,
      }, completedTasks);

      urgentUpdatePromptNode(persistedPromptState);

      const nextPromptState = {
        ...persistedPromptState,
        childImageIds: mergedChildIds,
      };

      if (recoveredResults.length > 0) {
        addImageNodes(recoveredResults as any, {
          [latestNode.id]: nextPromptState
        });
      } else {
        urgentUpdatePromptNode(nextPromptState);
      }
      await clearSyncImageBridgeRequest(pendingRequest.requestId).catch(() => undefined);
    } catch (error) {
      console.warn('[useImageGeneration] Sync bridge recovery failed:', error);
      scheduleSyncBridgeRecovery(nodeId, pendingRequest, 4000);
    } finally {
      syncBridgeRecoveryInFlightRef.current.delete(pendingRequest.requestId);
    }
  }, [
    addImageNodes,
    attachCompletedTasksToPrompt,
    prepareCompletedTaskResults,
    filterUniqueGeneratedSources,
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
      bringNodesToFront([latestNode.id]);
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

      bringNodesToFront([nextNode.id]);
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
        if (activeSyncBridgeRequestIdsRef.current.has(pendingRequest.requestId)) return;
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
    activeSyncBridgeRequestIdsRef.current.clear();
  }, []);

  // --- Polling Logic ---

  const pollTaskStatus = useCallback(async (node: PromptNode, taskIdOverride?: string) => {
    const targetTaskId = taskIdOverride || node.jobId;
    if (!targetTaskId) return;

    try {
      const result = await llmService.checkTaskStatus(
        targetTaskId,
        node.mode || GenerationMode.IMAGE,
        node.keySlotId ? { id: node.keySlotId } as any : undefined,
        node.model
      );

      if (result && 'status' in result && (result.status === 'success' || result.status === 'failed')) {
        const latestNode = activeCanvasRef.current?.promptNodes.find(n => n.id === node.id) || node;
        const { nextPendingTaskIds, nextJobId, nextGenerationMetadata } = resolvePendingTaskState(latestNode, targetTaskId);
        const expectedCount = getExpectedGenerationCount(latestNode);
        const currentChildIds = Array.from(new Set((latestNode.childImageIds || []).filter(Boolean)));
        
        if (result.status === 'success') {
          const rawImageUrls: unknown[] = Array.isArray((result as any).urls)
            ? (result as any).urls
            : [(result as any).url];
          const imageUrls: string[] = rawImageUrls.filter((url: unknown): url is string => (
            typeof url === 'string' && url.trim().length > 0
          ));
          const uniqueImageUrls = filterUniqueGeneratedSources(node.id, imageUrls, (url, index) => ({
            taskId: targetTaskId,
            resultIndex: index,
            url,
          }));
          if (imageUrls.length > 0) {
            const resolvedResultImageSize = ((result as any).imageSize || latestNode.imageSize) as ImageSize | undefined;
            const recoveredUsage: ReturnType<typeof resolveUsageMetrics> = latestNode.mode === GenerationMode.IMAGE
              ? resolveUsageMetrics({
                  model: (result as any).model || latestNode.model,
                  imageSize: resolvedResultImageSize,
                  prompt: latestNode.prompt,
                  imageCount: uniqueImageUrls.length || imageUrls.length,
                  referenceImageCount: latestNode.referenceImages?.length || 0,
                  keySlotId: (result as any).keySlotId || latestNode.keySlotId,
                  provider: (result as any).provider || latestNode.provider,
                  providerLabel: (result as any).providerName || latestNode.providerLabel,
                  explicitCost: (result as any).usage?.cost,
                  explicitTokens: (result as any).usage?.totalTokens,
                  explicitPromptTokens: (result as any).usage?.promptTokens,
                  explicitCompletionTokens: (result as any).usage?.completionTokens,
                })
              : {
                  cost: toFiniteNumber((result as any).usage?.cost),
                  tokens: toFiniteNumber((result as any).usage?.totalTokens),
                  promptTokens: toFiniteNumber((result as any).usage?.promptTokens),
                  completionTokens: toFiniteNumber((result as any).usage?.completionTokens),
                  costSource: toFiniteNumber((result as any).usage?.cost) !== undefined
                    ? 'explicit'
                    : 'none',
                };
            const { completedTasks, preparedItems } = prepareCompletedTaskResults(node.id, uniqueImageUrls.map((url) => ({
              taskId: targetTaskId,
              url,
              originalUrl: url,
              keySlotId: (result as any).keySlotId || latestNode.keySlotId,
              provider: (result as any).provider || latestNode.provider,
              providerName: (result as any).providerName || latestNode.providerLabel,
              model: (result as any).model || latestNode.model,
              modelName: resolveModelDisplayName(
                (result as any).model || latestNode.model,
                (result as any).modelName || latestNode.modelLabel,
              ),
              cost: splitMetricAcrossItems(recoveredUsage.cost, uniqueImageUrls.length || imageUrls.length),
              costSource: recoveredUsage.costSource,
              tokens: splitMetricAcrossItems(recoveredUsage.tokens, uniqueImageUrls.length || imageUrls.length),
            })), {
              keySlotId: (result as any).keySlotId || latestNode.keySlotId,
              provider: (result as any).provider || latestNode.provider,
              providerLabel: (result as any).providerName || latestNode.providerLabel,
              model: (result as any).model || latestNode.model,
              modelLabel: resolveModelDisplayName(
                (result as any).model || latestNode.model,
                (result as any).modelName || latestNode.modelLabel,
              ),
              batchKey: targetTaskId,
            });

            // Success recovery logic (similar to executeGeneration completion)
            const recoveredImageNodes = preparedItems.map(({ item, sourceTaskId, sourceResultIndex, apiResultUrl }, index: number) => {
              const imageId = `${node.id}_recovered_${Date.now()}_${index}`;
              const layoutIndex = currentChildIds.length + index;
              const resolvedAspectRatio = (result as any).aspectRatio || latestNode.aspectRatio;
              const resolvedImageSize = (result as any).imageSize || latestNode.imageSize;
              return {
                id: imageId,
                storageId: imageId,
                url: item.url,
                originalUrl: item.originalUrl,
                apiResultUrl,
                prompt: latestNode.prompt, model: (result as any).model || latestNode.model,
                modelLabel: resolveModelDisplayName(
                  (result as any).model || latestNode.model,
                  (result as any).modelName || latestNode.modelLabel,
                ),
                modelColorStart: latestNode.modelColorStart,
                modelColorEnd: latestNode.modelColorEnd,
                modelColorSecondary: latestNode.modelColorSecondary,
                modelTextColor: latestNode.modelTextColor,
                aspectRatio: resolvedAspectRatio, imageSize: resolvedImageSize,
                timestamp: Date.now(), canvasId: activeCanvasRef.current?.id || 'default',
                parentPromptId: node.id,
                ecommerceDeliveryKind: latestNode.ecommerce?.activeDeliveryKind || latestNode.redraw?.inheritedDeliveryKind || latestNode.partialRedraw?.inheritedDeliveryKind,
                sourceTaskId,
                sourceResultIndex,
                sourceReferenceStorageIds: (latestNode.referenceImages || []).map((ref) => ref.storageId || ref.id).filter(Boolean),
                position: getGeneratedImagePosition(latestNode.position, resolvedAspectRatio, latestNode.mode, layoutIndex, expectedCount),
                dimensions: `${resolvedAspectRatio} 路 ${resolvedImageSize || '1K'}`,
                displayLabel: latestNode.redraw?.inheritedDisplayLabel || latestNode.partialRedraw?.inheritedDisplayLabel || latestNode.ecommerce?.displayLabel,
                provider: (result as any).provider || latestNode.provider,
                providerLabel: (result as any).providerName || latestNode.providerLabel,
                keySlotId: (result as any).keySlotId || latestNode.keySlotId,
                generationTime: clampGenerationDurationMs((result as any).generationTime),
                tokens: splitMetricAcrossItems(recoveredUsage.tokens, uniqueImageUrls.length || imageUrls.length),
                promptTokens: splitMetricAcrossItems(recoveredUsage.promptTokens, uniqueImageUrls.length || imageUrls.length),
                completionTokens: splitMetricAcrossItems(recoveredUsage.completionTokens, uniqueImageUrls.length || imageUrls.length),
                cost: splitMetricAcrossItems(recoveredUsage.cost, uniqueImageUrls.length || imageUrls.length),
                costSource: recoveredUsage.costSource,
                alias: latestNode.mode === GenerationMode.PPT ? buildPptPageAlias(latestNode.pptSlides?.[layoutIndex], layoutIndex) : undefined,
              };
            });
            const finalizedCompletedTasks = completedTasks.map((task) => ({
              ...task,
              resultStorageIds: { ...(task.resultStorageIds || {}) },
            }));
            const completedTaskById = new Map(finalizedCompletedTasks.map((task) => [task.taskId, task]));

            recoveredImageNodes.forEach((imageNode: any) => {
              const task = completedTaskById.get(imageNode.sourceTaskId);
              const storageId = String(imageNode.storageId || imageNode.id || '').trim();
              if (!task || !storageId) return;

              task.resultStorageIds = {
                ...(task.resultStorageIds || {}),
                [String(imageNode.sourceResultIndex)]: storageId,
              };
            });

            const mergedChildIds = Array.from(new Set([...currentChildIds, ...recoveredImageNodes.map((img: any) => img.id)]));
            const nextSuccessCount = mergedChildIds.length;
            const nextFailCount = nextPendingTaskIds.length > 0 ? Math.max(0, expectedCount - nextSuccessCount - nextPendingTaskIds.length) : Math.max(0, expectedCount - nextSuccessCount);
            const persistedPromptState = attachCompletedTasksToPrompt({
              ...latestNode,
              isGenerating: nextPendingTaskIds.length > 0,
              jobId: nextJobId,
              error: undefined,
              errorDetails: undefined,
              lastGenerationSuccessCount: nextSuccessCount,
              lastGenerationFailCount: nextFailCount,
              lastGenerationTotalCount: expectedCount,
              generationMetadata: nextGenerationMetadata,
            }, finalizedCompletedTasks);

            urgentUpdatePromptNode(persistedPromptState);

            const nextPromptState = {
              ...persistedPromptState,
              childImageIds: mergedChildIds,
            };

            if (recoveredImageNodes.length > 0) {
              addImageNodes(recoveredImageNodes as any, {
                [latestNode.id]: nextPromptState
              });
            } else {
              urgentUpdatePromptNode(nextPromptState);
            }

            void markTaskCompleted(
              targetTaskId,
              finalizedCompletedTasks.find((task) => task.taskId === targetTaskId)?.resultUrls || imageUrls,
              recoveredUsage.cost,
              recoveredUsage.tokens,
              recoveredUsage.costSource,
              finalizedCompletedTasks.find((task) => task.taskId === targetTaskId)?.resultStorageIds
            );

            if (shouldRefreshServerBillingState(latestNode)) {
              await refreshBilling();
            }
            
            if (nextPendingTaskIds.length > 0) {
              setTimeout(() => {
                const fresh = activeCanvasRef.current?.promptNodes.find(n => n.id === node.id);
                if (fresh?.isGenerating) nextPendingTaskIds.forEach(tid => pollTaskStatus(fresh, tid));
              }, 5000);
            }
          }
        } else {
          // Failed
          const failedMessage = String((result as any).message || (result as any).error || 'Task failed on backend');
          const failedBillingState = nextPendingTaskIds.length === 0
            ? await resolveFailedBillingState(latestNode)
            : {
                refundStatus: latestNode.refundStatus,
                isPaymentProcessed: latestNode.isPaymentProcessed,
                paymentTransactionId: latestNode.paymentTransactionId,
              };
          urgentUpdatePromptNode({
            ...latestNode,
            isGenerating: nextPendingTaskIds.length > 0,
            jobId: nextJobId,
            generationMetadata: nextGenerationMetadata,
            error: nextPendingTaskIds.length === 0 ? failedMessage : undefined,
            ...failedBillingState,
          });
          // 轮询失败，更新数据库状态
          void markTaskFailed(targetTaskId, failedMessage);
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
        const failedBillingState = nextPendingTaskIds.length === 0
          ? await resolveFailedBillingState(latestNode, { forceServerRefundFailure: true })
          : {
              refundStatus: latestNode.refundStatus,
              isPaymentProcessed: latestNode.isPaymentProcessed,
              paymentTransactionId: latestNode.paymentTransactionId,
            };
        urgentUpdatePromptNode({
          ...latestNode,
          isGenerating: nextPendingTaskIds.length > 0,
          jobId: nextJobId,
          generationMetadata: nextGenerationMetadata,
          error: message,
          errorDetails: extractErrorDetails(err, latestNode.model),
          ...failedBillingState,
        });
        return;
      }
      setTimeout(() => {
        const freshNode = activeCanvasRef.current?.promptNodes.find(n => n.id === node.id);
        if (freshNode?.isGenerating) pollTaskStatus(freshNode, targetTaskId);
      }, 15000);
    }
  }, [llmService, addImageNodes, urgentUpdatePromptNode, resolvePendingTaskState, getExpectedGenerationCount, getGeneratedImagePosition, buildPptPageAlias, getPendingTaskIds, extractErrorDetails, filterUniqueGeneratedSources, shouldRefreshServerBillingState, refreshBilling, attachCompletedTasksToPrompt, prepareCompletedTaskResults, resolveFailedBillingState]);

  useTaskRecovery(activeCanvas, pollTaskStatus, canStartBackgroundRecovery);

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
    const isEcommerce = mode === GenerationMode.ECOMMERCE;
    const isPpt = mode === GenerationMode.PPT;
    const requestedCount = Math.max(1, Number(count) || 1);
    const actualCount = isPpt ? Math.min(20, requestedCount) : requestedCount;
    setIsGenerating(true);
    
    try {
      const globalHandle = fileSystemService.getGlobalHandle();
      
      const hydratedFiles = await Promise.all(initialFiles.map(async (img) => {
        if (img.data && img.data.length > 100) return img;
        for (const lookupId of getReferenceImageLookupIds(img)) {
          try {
            const dataUrl = await getImage(lookupId);
            if (dataUrl) {
              const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
              if (matches && matches[2]) return { ...img, storageId: img.storageId || lookupId, data: matches[2], mimeType: matches[1] || img.mimeType || 'image/png' };
              return { ...img, storageId: img.storageId || lookupId, data: dataUrl };
            }
          } catch {}
          if (globalHandle) {
             try {
               const base64Data = await fileSystemService.loadReferenceImage(globalHandle, lookupId);
               if (base64Data) return { ...img, storageId: img.storageId || lookupId, data: base64Data, mimeType: 'image/jpeg' };
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
      if (!resolvedKey) {
        throw new Error('No available key for model');
      }
      const effectiveKeySlotId = resolvedKey.id;
      const routeProviderDisplay = effectiveKeySlotId
        ? resolveProviderDisplay(effectiveKeySlotId)
        : resolveProviderDisplay(undefined, node.providerLabel, node.provider);
      const preferRouteProviderDisplay = (!!effectiveKeySlotId && !!routeProviderDisplay.providerLabel)
        || shouldPreferRouteProviderDisplay(node, routeProviderDisplay);
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

      const generationAttemptStartedAt = Date.now();
      bringNodesToFront([promptNodeId]);
      urgentUpdatePromptNode({
        ...latestNode,
        ...executionNode,
        timestamp: generationAttemptStartedAt,
        isGenerating: true,
        jobId: undefined,
        childImageIds: [],
        lastGenerationSuccessCount: 0,
        lastGenerationFailCount: 0,
        lastGenerationTotalCount: actualCount,
        error: undefined,
        errorDetails: undefined,
        pptDeck: executionNode.mode === GenerationMode.PPT
          ? buildPptDeckModuleState({
              ...latestNode,
              ...executionNode,
              childImageIds: [],
              timestamp: generationAttemptStartedAt,
              isGenerating: true,
            })
          : executionNode.pptDeck,
        generationMetadata: buildGenerationMetadata(latestNode, {
          attemptStartedAt: generationAttemptStartedAt,
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
        const currentRequestId = buildGenerationAttemptRequestId(
          executionNode.billingAttemptId || promptNodeId,
          index,
        );
        let taskIdForRecovery: string | undefined = undefined;

        try {
          let generatedBase64 = '';
          let videoUrl = '';
          const taskPrompt = isPpt ? buildPptPagePrompt(promptToUse, index, actualCount) : (isEcommerce ? promptToUse : promptToUse);
          let resolvedResultKeySlotId: string | undefined = executionNode.keySlotId;
          let resolvedProvider = executionNode.provider;
          let resolvedProviderName = executionNode.providerLabel;
          let resolvedModelName = executionNode.modelLabel;
          let resolvedModelId = executionNode.model;
          let resolvedCost: number | undefined = undefined;
          let resolvedCostSource: NonNullable<GeneratedImage['costSource']> | undefined = undefined;
          let resolvedTokens: number | undefined = undefined;
          let resolvedPromptTokens: number | undefined = undefined;
          let resolvedCompletionTokens: number | undefined = undefined;
          let resolvedImageSize: ImageSize | undefined = executionNode.imageSize;
          let resolvedAspectRatio: AspectRatio = executionNode.aspectRatio;
          let resolvedExactDimensions: { width: number; height: number } | undefined = undefined;
          let resolvedDeducted: boolean | undefined = undefined;
          let resolvedLedgerId: string | undefined = undefined;
          let resolvedBalanceAfter: number | undefined = undefined;
          
          if (isAudio) {
            const audioResult = await llmService.generateAudio({ modelId: executionNode.model, prompt: taskPrompt, audioDuration: executionNode.audioDuration, audioLyrics: executionNode.audioLyrics, preferredKeyId: executionNode.keySlotId, providerConfig: {} });
            videoUrl = audioResult.url;
            resolvedResultKeySlotId = audioResult.keySlotId || resolvedResultKeySlotId;
            resolvedProvider = audioResult.provider || resolvedProvider;
            resolvedProviderName = audioResult.providerName || resolvedProviderName;
            resolvedModelId = audioResult.model || resolvedModelId;
            resolvedModelName = resolveModelDisplayName(resolvedModelId, audioResult.modelName || resolvedModelName);
            resolvedCost = toFiniteNumber(audioResult.usage?.cost);
            resolvedCostSource = resolvedCost !== undefined ? 'explicit' : undefined;
            resolvedTokens = toFiniteNumber(audioResult.usage?.totalTokens);
            resolvedPromptTokens = toFiniteNumber((audioResult as any).usage?.promptTokens);
            resolvedCompletionTokens = toFiniteNumber((audioResult as any).usage?.completionTokens);
          } else if (isVideo) {
            const videoResult = await llmService.generateVideo({ 
              modelId: executionNode.model, prompt: taskPrompt, aspectRatio: executionNode.aspectRatio === '9:16' ? '9:16' : '16:9', 
              imageUrl: files[0]?.data, videoDuration: executionNode.videoDuration, preferredKeyId: executionNode.keySlotId, 
              providerConfig: {}, 
              onTaskId: (taskId) => {
                taskIdForRecovery = taskId;
                releaseSyncBridgeRequestActive(currentRequestId);
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
            resolvedModelId = videoResult.model || resolvedModelId;
            resolvedModelName = resolveModelDisplayName(resolvedModelId, videoResult.modelName || resolvedModelName);
            resolvedCost = toFiniteNumber(videoResult.usage?.cost);
            resolvedCostSource = resolvedCost !== undefined ? 'explicit' : undefined;
            resolvedTokens = toFiniteNumber(videoResult.usage?.totalTokens);
            resolvedPromptTokens = toFiniteNumber((videoResult as any).usage?.promptTokens);
            resolvedCompletionTokens = toFiniteNumber((videoResult as any).usage?.completionTokens);
          } else {
            const result = await generateImage(taskPrompt, executionNode.aspectRatio, executionNode.imageSize, files, executionNode.model, '', currentRequestId, !!executionNode.enableGrounding || !!executionNode.enableImageSearch, {
              maskUrl: executionNode.mode === GenerationMode.REDRAW ? undefined : executionNode.maskUrl,
              editMode: executionNode.mode === GenerationMode.INPAINT ? 'inpaint' : (executionNode.mode === GenerationMode.EDIT ? 'edit' : undefined),
              preferredKeyId: executionNode.keySlotId,
              executionLane: executionNode.executionLane,
              creditRouteSpecId: executionNode.creditRouteSpecId,
              creditRouteUnitId: executionNode.creditRouteUnitId,
              onTaskId: (taskId) => {
                taskIdForRecovery = taskId;
                const fresh = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId);
                if (fresh) urgentUpdatePromptNode(clearPendingSyncRequests(registerPendingTaskId(fresh, taskId), [currentRequestId]));
                // 持久化任务到数据库
                void persistTask(taskId, executionNode, activeCanvasRef.current?.id);
              },
              onSyncBridgeRegistered: (requestId: string, startedAt?: number) => {
                markSyncBridgeRequestActive(requestId);
                const fresh = activeCanvasRef.current?.promptNodes.find(n => n.id === promptNodeId);
                if (!fresh) return;
                urgentUpdatePromptNode(registerPendingSyncRequest(fresh, {
                  requestId,
                  index,
                  prompt: taskPrompt,
                  startedAt: toFiniteTimestamp(startedAt) ?? Date.now(),
                  keySlotId: executionNode.keySlotId
                }));
              }
            });
            generatedBase64 = result.url;
            resolvedResultKeySlotId = result.keySlotId || resolvedResultKeySlotId;
            resolvedProvider = result.provider || resolvedProvider;
            resolvedProviderName = result.providerName || resolvedProviderName;
            resolvedModelId = result.effectiveModel || resolvedModelId;
            resolvedModelName = resolveModelDisplayName(resolvedModelId, result.modelName || resolvedModelName);
            resolvedImageSize = result.effectiveSize || result.imageSize || resolvedImageSize;
            resolvedAspectRatio = result.aspectRatio || resolvedAspectRatio;
            resolvedExactDimensions = result.dimensions;
            resolvedDeducted = result.deducted;
            resolvedLedgerId = result.ledgerId;
            resolvedBalanceAfter = result.balanceAfter;
            if (typeof result.balanceAfter === 'number') {
              applyAuthoritativeBalance(result.balanceAfter);
            }

            const resolvedUsage = resolveUsageMetrics({
              model: resolvedModelId,
              imageSize: resolvedImageSize,
              prompt: taskPrompt,
              imageCount: 1,
              referenceImageCount: files.length,
              keySlotId: resolvedResultKeySlotId,
              provider: resolvedProvider,
              providerLabel: resolvedProviderName,
              explicitCost: result.cost,
              explicitTokens: result.tokens,
              explicitPromptTokens: result.promptTokens,
              explicitCompletionTokens: result.completionTokens,
            });
            resolvedCost = resolvedUsage.cost;
            resolvedCostSource = resolvedUsage.costSource;
            resolvedTokens = resolvedUsage.tokens;
            resolvedPromptTokens = resolvedUsage.promptTokens;
            resolvedCompletionTokens = resolvedUsage.completionTokens;
          }

          return { 
            index,
            url: isVideo || isAudio ? videoUrl : generatedBase64,
            originalUrl: isVideo || isAudio
              ? videoUrl
              : (generatedBase64.startsWith('data:') ? generatedBase64 : undefined),
            apiResultUrl: !isVideo && !isAudio && /^https?:\/\//i.test(generatedBase64)
              ? generatedBase64
              : undefined,
            generationTime: clampGenerationDurationMs(Date.now() - startTime), base64: generatedBase64, mode, 
            taskId: taskIdForRecovery, taskPrompt, keySlotId: resolvedResultKeySlotId, requestId: currentRequestId,
            provider: resolvedProvider, providerName: resolvedProviderName, modelName: resolvedModelName, model: resolvedModelId,
            imageSize: resolvedImageSize, aspectRatio: resolvedAspectRatio, dimensions: resolvedExactDimensions, tokens: resolvedTokens, promptTokens: resolvedPromptTokens, completionTokens: resolvedCompletionTokens, cost: resolvedCost, costSource: resolvedCostSource,
            deducted: resolvedDeducted,
            ledgerId: resolvedLedgerId,
            balanceAfter: resolvedBalanceAfter,
          };
        } catch (error: any) {
          return {
            error: getDisplayableGenerationError(error),
            errorDetails: extractErrorDetails(error, executionNode.model),
            taskId: taskIdForRecovery,
            requestId: currentRequestId,
          };
        } finally {
          releaseSyncBridgeRequestActive(currentRequestId);
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
        const acceptedImageData = filterUniqueGeneratedSources(
          promptNodeId,
          validImageData,
          (item, index) => ({
            taskId: item.taskId,
            requestId: item.requestId,
            resultIndex: typeof item.index === 'number' ? item.index : index,
            url: item.originalUrl || item.url,
          })
        );
        const { completedTasks, preparedItems } = prepareCompletedTaskResults(promptNodeId, acceptedImageData.map((item) => ({
          ...item,
          taskId: item.taskId,
          requestId: item.requestId,
          url: item.url,
          originalUrl: item.originalUrl,
          keySlotId: item.keySlotId || executionNode.keySlotId,
          provider: item.provider || executionNode.provider,
          providerName: item.providerName || executionNode.providerLabel,
          model: item.model || executionNode.model,
          modelName: resolveModelDisplayName(item.model || executionNode.model, item.modelName || executionNode.modelLabel),
          cost: item.cost,
          costSource: item.costSource,
          tokens: item.tokens,
        })), {
          keySlotId: executionNode.keySlotId,
          provider: executionNode.provider,
          providerLabel: executionNode.providerLabel,
          model: executionNode.model,
          modelLabel: resolveModelDisplayName(executionNode.model, executionNode.modelLabel),
          batchKey: `${promptNodeId}:${Date.now()}`,
        });
        const generatedPositions = buildGeneratedImageBatchPositions({
          basePosition: executionNode.position,
          items: preparedItems.map(({ item }) => ({
            aspectRatio: item.aspectRatio || executionNode.aspectRatio,
            exactDimensions: item.dimensions,
          })),
          mode: executionNode.mode,
          isMobile,
        });

        const redrawSourceImageId = executionNode.redraw?.compositionBaseImageId || executionNode.redraw?.sourceImageId || executionNode.partialRedraw?.sourceImageId;
        const partialRedrawSourceImage = redrawSourceImageId
          ? activeCanvasRef.current?.imageNodes.find((imageNode) => imageNode.id === redrawSourceImageId)
          : undefined;

        const results = await Promise.all(preparedItems.map(async ({ item, sourceTaskId, sourceResultIndex, apiResultUrl }, layoutIndex) => {
          const idx = item.index;
          const uniqueId = `${Date.now()}_${idx}_${Math.random()}`;
          const layoutPosition = generatedPositions[layoutIndex] || getGeneratedImagePosition(
            executionNode.position,
            item.aspectRatio || executionNode.aspectRatio,
            executionNode.mode,
            layoutIndex,
            acceptedImageData.length
          );
          let finalUrl = item.url;
          let finalOriginalUrl = item.originalUrl;
          let finalApiResultUrl = apiResultUrl;

          if (
            executionNode.mode === GenerationMode.REDRAW
            && (executionNode.redraw?.cropPlans?.[0] || executionNode.partialRedraw)
            && partialRedrawSourceImage
          ) {
            const originalImageUrl = partialRedrawSourceImage.originalUrl || partialRedrawSourceImage.apiResultUrl || partialRedrawSourceImage.url;
            const cropPlan = executionNode.redraw?.cropPlans?.[0];
            finalUrl = cropPlan
              ? await compositeRedrawCropResult({
                  originalImageUrl,
                  generatedCropUrl: item.originalUrl || item.url,
                  generationRect: cropPlan.generationRect,
                  featherRatio: 0.05,
                })
              : await compositePartialRedrawResult({
                  originalImageUrl,
                  generatedCropUrl: item.originalUrl || item.url,
                  partialRedraw: executionNode.partialRedraw!,
                });
            finalOriginalUrl = finalUrl;
            finalApiResultUrl = undefined;
          }

          const eagerOriginalSource = normalizePersistableMediaSource(
            finalOriginalUrl || item.base64 || finalUrl,
            'image/png'
          );
          if (eagerOriginalSource && mode !== GenerationMode.VIDEO && mode !== GenerationMode.AUDIO) {
            saveOriginalImage(uniqueId, eagerOriginalSource, false).catch(() => {});
          }
          
          return {
            id: uniqueId,
            storageId: uniqueId,
            url: finalUrl,
            originalUrl: finalOriginalUrl,
            apiResultUrl: finalApiResultUrl,
            prompt: item.taskPrompt || promptToUse, aspectRatio: item.aspectRatio || executionNode.aspectRatio, imageSize: item.imageSize || executionNode.imageSize,
            timestamp: Date.now(), model: item.model || executionNode.model, canvasId: activeCanvasRef.current?.id || 'default',
            modelLabel: resolveModelDisplayName(item.model || executionNode.model, item.modelName || executionNode.modelLabel),
            modelColorStart: executionNode.modelColorStart,
            modelColorEnd: executionNode.modelColorEnd,
            modelColorSecondary: executionNode.modelColorSecondary,
            modelTextColor: executionNode.modelTextColor,
            provider: item.provider || executionNode.provider,
            providerLabel: item.providerName || executionNode.providerLabel,
            parentPromptId: promptNodeId,
            ecommerceDeliveryKind: executionNode.ecommerce?.activeDeliveryKind || executionNode.redraw?.inheritedDeliveryKind || executionNode.partialRedraw?.inheritedDeliveryKind,
            sourceTaskId,
            sourceResultIndex,
            position: layoutPosition,
            dimensions: item.dimensions ? `${item.dimensions.width}x${item.dimensions.height}` : undefined,
            displayLabel: executionNode.redraw?.inheritedDisplayLabel || executionNode.partialRedraw?.inheritedDisplayLabel || executionNode.ecommerce?.displayLabel,
            exactDimensions: item.dimensions,
            sourceReferenceStorageIds: (executionNode.referenceImages || []).map((ref) => ref.storageId || ref.id).filter(Boolean),
            generationTime: clampGenerationDurationMs(item.generationTime), keySlotId: item.keySlotId, mode,
            tokens: item.tokens, promptTokens: item.promptTokens, completionTokens: item.completionTokens, cost: item.cost, costSource: item.costSource,
            partialRedraw: executionNode.partialRedraw,
            redraw: executionNode.redraw,
          };
        }));

        const finalizedCompletedTasks = completedTasks.map((task) => ({
          ...task,
          resultStorageIds: { ...(task.resultStorageIds || {}) },
        }));
        const completedTaskById = new Map(finalizedCompletedTasks.map((task) => [task.taskId, task]));

        results.forEach((result) => {
          const task = completedTaskById.get(result.sourceTaskId);
          const storageId = String(result.storageId || result.id || '').trim();
          if (!task || !storageId) return;

          task.resultStorageIds = {
            ...(task.resultStorageIds || {}),
            [String(result.sourceResultIndex)]: storageId,
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
        if (
          shouldRefreshServerBillingState(latestNode)
          && typeof firstSuccess?.balanceAfter === 'number'
        ) {
          applyAuthoritativeBalance(firstSuccess.balanceAfter);
        }
        const resolvedSuccessDisplay = firstSuccess?.keySlotId
          ? resolveProviderDisplay(firstSuccess.keySlotId, firstSuccess.providerName, firstSuccess.provider)
          : resolveProviderDisplay(undefined, executionNode.providerLabel, executionNode.provider);
        const persistedPromptState = attachCompletedTasksToPrompt({
          ...nextNodeBase,
          isGenerating: pendingIds.length > 0 || remainingSyncRequests.length > 0,
          jobId: pendingIds[0],
          lastGenerationSuccessCount: results.length,
          lastGenerationFailCount: nonRecoverableFailureCount,
          lastGenerationTotalCount: actualCount,
          error: undefined,
          errorDetails: undefined,
          refundStatus: undefined,
          balanceAfter: firstSuccess?.balanceAfter,
          isPaymentProcessed: false,
          paymentTransactionId: undefined,
          generationMetadata: buildGenerationMetadata(nextNodeBase, { pendingTaskIds: pendingIds, pendingSyncRequests: remainingSyncRequests }),
          keySlotId: firstSuccess?.keySlotId || executionNode.keySlotId,
          provider: resolvedSuccessDisplay.provider || executionNode.provider,
          providerLabel: resolvedSuccessDisplay.providerLabel || executionNode.providerLabel,
          modelLabel: resolveModelDisplayName(firstSuccess?.model || executionNode.model, firstSuccess?.modelName || executionNode.modelLabel),
        }, finalizedCompletedTasks);

        urgentUpdatePromptNode(persistedPromptState);
        
        const updatedNode = {
          ...persistedPromptState,
          childImageIds: results.map(r => r.id),
          pptDeck: persistedPromptState.mode === GenerationMode.PPT
            ? buildPptDeckModuleState({
                ...persistedPromptState,
                childImageIds: results.map(r => r.id),
              }, results)
            : persistedPromptState.pptDeck,
        };
        
        if (results.length > 0) {
          addImageNodes(results as any, { [updatedNode.id]: updatedNode });
        } else {
          await updatePromptNode(updatedNode);
        }
        const persistedTaskIds = new Set(
          acceptedImageData
            .map((item) => (typeof item.taskId === 'string' ? item.taskId.trim() : ''))
            .filter((taskId): taskId is string => taskId.length > 0)
        );
        finalizedCompletedTasks.forEach((task) => {
          if (!persistedTaskIds.has(task.taskId)) return;
          void markTaskCompleted(task.taskId, task.resultUrls, task.cost, task.tokens, task.costSource, task.resultStorageIds);
        });
        completedSyncRequestIds.forEach((requestId) => {
          void clearSyncImageBridgeRequest(requestId).catch(() => undefined);
          clearSyncBridgeRecoveryTimer(requestId);
        });
        rememberPreferredKeyForMode(mode, updatedNode.keySlotId);

        if (shouldRefreshServerBillingState(updatedNode)) {
          await refreshBilling();
        }
        
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
      const failedBillingState = await resolveFailedBillingState(latest);
      await updatePromptNode({
        ...latest,
        isGenerating: false,
        lastGenerationSuccessCount: 0,
        lastGenerationFailCount: actualCount,
        lastGenerationTotalCount: actualCount,
        childImageIds: [],
        error: getDisplayableGenerationError(err),
        errorDetails: extractErrorDetails(err, node.model),
        ...failedBillingState,
      });
      return;
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
    shouldRefreshServerBillingState,
    extractErrorDetails,
    getDisplayableGenerationError,
    normalizePptSlidesForCount,
    buildAutoPptSlides,
    rememberPreferredKeyForMode,
    applyAuthoritativeBalance,
    refreshBilling,
    resolveProviderDisplay,
    shouldPreferRouteProviderDisplay,
    clearSyncBridgeRecoveryTimer,
    recoverSyncBridgeRequest,
    isRecoverableSyncBridgeFailure,
    filterUniqueGeneratedSources,
    attachCompletedTasksToPrompt,
    prepareCompletedTaskResults,
    resolveFailedBillingState,
    markSyncBridgeRequestActive,
    releaseSyncBridgeRequestActive
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
