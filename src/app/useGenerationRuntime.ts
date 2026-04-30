import { useCallback } from 'react';

import type { CreditConsumeResult, CreditRefundResult } from '../context/BillingContext';
import { keyManager } from '../services/auth/keyManager';
import {
  buildGenerationBillingAttempt,
  resolveGenerationAttemptFailureState,
} from '../services/billing/generationBillingCoordinator';
import { adminModelService } from '../services/model/adminModelService';
import { getModelCapabilities } from '../services/model/modelCapabilities';
import type { ModelExecutionLane } from '../services/model/modelExecutionLane';
import { GenerationMode, ImageSize, type Canvas, type GeneratedImage, type GenerationConfig, type PromptNode, type ReferenceImage } from '../types';
import { buildCancelledPromptNodePatch } from './buildCancelledPromptNodePatch';
import { buildCompletedPromptNodePatch } from './buildCompletedPromptNodePatch';
import { buildGeneratingPromptNode } from './buildGeneratingPromptNode';
import { optimizeGenerationPrompt } from './optimizeGenerationPrompt';
import { persistGeneratingPromptNode } from './persistGeneratingPromptNode';
import { resolveGenerationBillingState } from './resolveGenerationBillingState';
import { resolveGenerationPreviewState } from './resolveGenerationPreviewState';

type CreditBillingAttempt = {
  attemptId: string;
  businessRefId: string;
  idempotencyKey: string;
};

export interface EnsureCreditAttemptChargedParams {
  modelId: string;
  modelLabel?: string;
  providerId?: string;
  provider?: string;
  requiredCredits: number;
  useServerSideCreditSettlement: boolean;
  billingAttempt?: CreditBillingAttempt;
}

export type EnsureCreditAttemptChargedResult =
  | { success: true; transactionId: string | undefined }
  | { success: false; transactionId?: undefined };

export interface PrepareInitialCreditSettlementParams extends EnsureCreditAttemptChargedParams {
  isCreditModel: boolean;
}

export type PrepareInitialCreditSettlementResult =
  | { allowed: true; paymentTransactionId: string | undefined }
  | { allowed: false; paymentTransactionId?: undefined };

export type GenerationCreditAttemptNode = Pick<
  PromptNode,
  | 'id'
  | 'billingMode'
  | 'creditSettlement'
  | 'isPaymentProcessed'
  | 'paymentTransactionId'
  | 'refundStatus'
  | 'cost'
>;

export type GenerationCreditAttemptFailurePatch = {
  refundStatus?: PromptNode['refundStatus'];
  isPaymentProcessed?: boolean;
  paymentTransactionId?: string;
};

export interface PrepareGenerationDraftContextArgs {
  activeCanvasRef: {
    current?: Pick<Canvas, 'promptNodes'> | null;
  };
  activeSourceImage?: string | null;
  draftNodeId?: string | null;
}

export interface PrepareGenerationDraftContextResult {
  isFollowUp: boolean;
  existingPromptDraftId: string;
  existingPromptDraft: PromptNode | null;
  hasReusablePromptDraft: boolean;
  promptNodeId: string;
}

interface InitialBillingGenerationState {
  executionLane: ModelExecutionLane;
  isCreditModel: boolean;
  useServerSideCreditSettlement: boolean;
}

export interface PrepareInitialBillingAttemptContextParams {
  generationBillingState: InitialBillingGenerationState;
  imageSize?: ImageSize | string | null;
  modelId: string;
  promptNodeId: string;
}

export interface PrepareInitialBillingAttemptContextResult {
  billingAttempt: CreditBillingAttempt;
  executionLane: ModelExecutionLane;
  resolvedCreditRoute: ReturnType<typeof adminModelService.getCreditRouteSnapshot> | null;
  resolvedCreditSpecId: string | undefined;
  useServerSideCreditSettlement: boolean;
}

export interface PrepareGenerationBillingStateContextParams {
  config: Pick<GenerationConfig, 'model' | 'imageSize' | 'mode' | 'parallelCount'>;
  getPreferredKeyForMode: (mode: GenerationConfig['mode']) => string | undefined;
  hasExplicitModelRoute: (modelId: string) => boolean;
  resolveCreditCostForModel: (modelId: string, imageSize?: ImageSize | string) => number;
}

export interface PrepareGenerationBillingStateContextResult {
  selectedKeyForBilling: ReturnType<typeof keyManager.getNextKey>;
  generationBillingState: ReturnType<typeof resolveGenerationBillingState>;
}

export interface PrepareInitialGeneratingPromptNodeParams {
  activeSourceImage?: string | null;
  billingAttempt: CreditBillingAttempt;
  config: GenerationConfig;
  currentPos: PromptNode['position'];
  executionLane: ModelExecutionLane;
  finalReferenceImages: ReferenceImage[];
  generationBillingState: Pick<ReturnType<typeof resolveGenerationBillingState>, 'isCreditModel'>;
  optimizedPromptEn?: string;
  optimizedPromptZh?: string;
  paymentTransactionId?: string;
  perImageCreditCost: number;
  promptNodeId: string;
  promptOptimizerResult?: PromptNode['promptOptimizerResult'];
  rawPrompt: string;
  requiredCredits: number;
  resolvedCreditRoute: ReturnType<typeof adminModelService.getCreditRouteSnapshot> | null;
  resolvedCreditSpecId?: string;
  selectedKeyForBilling: ReturnType<typeof keyManager.getNextKey>;
  useServerSideCreditSettlement: boolean;
}

export interface PrepareInitialGeneratingPromptNodeResult {
  generatingNode: PromptNode;
}

type GenerationPersistenceCanvasSnapshot = Pick<Canvas, 'promptNodes'> & {
  imageNodes: GeneratedImage[];
};

export interface PersistInitialGeneratingPromptNodeParams {
  addPromptNode: (node: PromptNode) => void | Promise<void>;
  deletePromptNode: (id: string) => void | Promise<void>;
  generatingNode: PromptNode;
  getCanvas: () => GenerationPersistenceCanvasSnapshot | undefined;
  updateImageNodePosition: (
    id: string,
    position: { x: number; y: number },
    options?: { ignoreSelection?: boolean },
  ) => void | Promise<void>;
}

export interface PersistInitialGeneratingPromptNodeResult {
  persistedGeneratingNode: PromptNode;
}

export interface PrepareInitialGenerationPromptOptimizationParams {
  config: Pick<
    GenerationConfig,
    'aspectRatio' | 'enablePromptOptimization' | 'imageSize' | 'mode' | 'model' | 'thinkingMode'
  >;
  finalReferenceImages: ReferenceImage[];
  rawPrompt: string;
}

export type PrepareInitialGenerationPromptOptimizationResult = Awaited<ReturnType<typeof optimizeGenerationPrompt>>;

export interface CompleteInitialGenerationPromptSubmissionParams {
  setActiveSourceImage: (id: string | null) => void;
  setConfig: (updater: (prev: GenerationConfig) => GenerationConfig) => void;
  setDraftNodeId: (id: string | null) => void;
}

export interface CommitRetryGenerationFailureParams {
  error: unknown;
  executionNode: PromptNode;
  extractErrorDetails: (error: unknown, fallbackModel?: string) => PromptNode['errorDetails'];
}

export interface ExecuteInitialGenerationPromptNodeParams {
  executeGeneration: (node: PromptNode) => Promise<void>;
  persistedGeneratingNode: PromptNode;
  requiredCredits: number;
  useServerSideCreditSettlement: boolean;
}

export interface ReportInitialGenerationFailureParams {
  error: unknown;
}

export interface CreateRetryGenerationTimeoutGuardParams {
  executionNode: PromptNode;
  requestId: string;
  timeoutMs: number;
}

export interface CreateRetryGenerationTimeoutGuardResult {
  markFinished: () => void;
  clear: () => void;
}

export interface CommitRetryGenerationStartParams {
  executionNode: PromptNode;
  retryBillingState: Pick<ReturnType<typeof resolveGenerationBillingState>, 'requiredCredits' | 'useServerSideCreditSettlement'>;
  resolveModelDisplayName: (modelId: string, fallbackLabel?: string) => string;
}

export interface ReportRetryRecoveryResultParams {
  recoveredCount: number;
  pendingCount: number;
}

export interface PrepareRetryGenerationRequestContextParams {
  node: Pick<PromptNode, 'id' | 'mode' | 'parallelCount'>;
  defaultParallelCount: number;
}

export interface PrepareRetryGenerationRequestContextResult {
  currentNodeId: string;
  requestedCount: number;
  count: number;
}

export interface RetryGenerationSuccessDebugResult {
  requestPath?: string;
  requestBodyPreview?: string;
  pythonSnippet?: string;
}

export interface ReportRetryGenerationSuccessParams {
  executionNode: Pick<PromptNode, 'model' | 'prompt' | 'referenceImages' | 'imageSize' | 'keySlotId'>;
  alignedImageNodes: Array<Pick<GeneratedImage, 'imageSize' | 'keySlotId'>>;
  results: RetryGenerationSuccessDebugResult[];
}

export interface PrepareRetryGenerationTaskPromptContextParams {
  count: number;
  executionNode: Pick<PromptNode, 'mode' | 'pptSlides' | 'pptStyleLocked' | 'prompt'>;
  index: number;
  sourcePrompt: string;
}

export interface PrepareRetryGenerationTaskPromptContextResult {
  currentMode: GenerationMode;
  taskPrompt: string;
}

export interface PrepareRetryVideoGenerationRequestParams {
  executionNode: Pick<
    PromptNode,
    'aspectRatio' | 'imageSize' | 'keySlotId' | 'model' | 'referenceImages' | 'videoDuration' | 'videoResolution'
  >;
  taskPrompt: string;
}

export interface PrepareRetryVideoGenerationRequestResult {
  modelId: string;
  prompt: string;
  aspectRatio: string;
  imageUrl?: string;
  imageTailUrl?: string;
  videoDuration?: string;
  preferredKeyId?: string;
  providerConfig: {
    google: {
      imageConfig: {
        imageSize: string;
      };
    };
  };
}

export interface PrepareRetryImageGenerationRequestParams {
  executionNode: Pick<
    PromptNode,
    'aspectRatio' | 'enableGrounding' | 'enableImageSearch' | 'imageSize' | 'keySlotId' | 'model' | 'referenceImages' | 'thinkingMode'
  >;
  requestId: string;
  taskPrompt: string;
}

export interface PrepareRetryImageGenerationRequestResult {
  args: [
    string,
    PromptNode['aspectRatio'],
    PromptNode['imageSize'],
    ReferenceImage[],
    PromptNode['model'],
    string,
    string,
  ];
  grounding: boolean;
  options: {
    preferredKeyId?: string;
    enableWebSearch: boolean;
    enableImageSearch: boolean;
    thinkingMode: 'minimal' | 'high';
  };
}

export interface PrepareRetryGeneratedMediaPersistenceParams {
  b64: string;
  calculateImageHash: (source: string) => Promise<string>;
  currentMode: GenerationMode;
  normalizePersistableMediaSource: (source: string, mimeType: string) => string | undefined;
  saveOriginalImage: (storageId: string, originalSource: string) => Promise<unknown>;
}

export interface PrepareRetryGeneratedMediaPersistenceResult {
  apiResultUrl?: string;
  mimeType: 'image/png' | 'video/mp4';
  normalizedOriginalSource?: string;
  originalUrl: string;
  storageId: string;
  url: string;
}

export interface ResolveRetryGeneratedMediaDimensionsParams {
  b64: string;
  executionNode: Pick<PromptNode, 'aspectRatio' | 'imageSize'>;
  url: string;
}

export interface ResolveRetryGeneratedMediaDimensionsResult {
  actualHeight: number;
  actualWidth: number;
  computedImageSize: PromptNode['imageSize'];
  displayDimensions: string;
}

export interface BuildRetryGeneratedMediaResultParams {
  alias?: string;
  canvasId?: string;
  currentMode: GenerationMode;
  executionNode: Pick<
    PromptNode,
    'aspectRatio' | 'billingMode' | 'creditCost' | 'id' | 'referenceImages'
  >;
  generationTime: number;
  index: number;
  mediaDimensions: ResolveRetryGeneratedMediaDimensionsResult;
  mediaPersistence: PrepareRetryGeneratedMediaPersistenceResult;
  prompt: string;
  requestTrace: RetryGenerationSuccessDebugResult;
  resultMetadata: {
    completionTokens?: number;
    cost?: number;
    costSource?: GeneratedImage['costSource'];
    keySlotId?: string;
    model: GeneratedImage['model'];
    modelLabel?: string;
    promptTokens?: number;
    provider?: string;
    providerLabel?: string;
    tokens?: number;
  };
}

export type RetryGeneratedMediaResult = Omit<GeneratedImage, 'position'> & {
  height: number;
  index: number;
  seed: number;
  width: number;
};

interface RetryGeneratedMediaLayoutCardDimensions {
  width: number;
  totalHeight: number;
}

interface RetryGeneratedMediaLayoutPosition {
  x: number;
  y: number;
}

export type RetryGeneratedMediaLayoutNode = RetryGeneratedMediaResult & Pick<GeneratedImage, 'position'>;

export interface BuildRetryGeneratedMediaLayoutParams {
  buildGeneratedImageBatchPositions: (params: {
    basePosition: RetryGeneratedMediaLayoutPosition;
    items: Array<{
      aspectRatio?: GeneratedImage['aspectRatio'];
      exactDimensions?: { width: number; height: number };
    }>;
    mode?: GenerationMode;
    isMobile?: boolean;
  }) => RetryGeneratedMediaLayoutPosition[];
  count: number;
  executionNode: Pick<PromptNode, 'aspectRatio' | 'mode' | 'position'>;
  getCardDimensions: (aspectRatio: PromptNode['aspectRatio'], includeFooter?: boolean) => RetryGeneratedMediaLayoutCardDimensions;
  isMobile: boolean;
  latestLayoutPrompt?: Pick<PromptNode, 'position'> | null;
  results: RetryGeneratedMediaResult[];
}

export interface BuildRetryCompletedPromptPatchParams {
  alignedImageNodes: Array<Pick<GeneratedImage, 'id' | 'keySlotId' | 'model' | 'modelLabel' | 'provider' | 'providerLabel'>>;
  executionNode: Pick<PromptNode, 'keySlotId' | 'model' | 'modelLabel' | 'provider' | 'providerLabel'>;
  resolveModelDisplayName: (modelId: string, fallbackLabel?: string) => string;
}

interface RefreshBillingOptions {
  includeTransactions?: boolean;
  silent?: boolean;
}

const createGenerationPromptNodeId = () => `node_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

export interface UseGenerationRuntimeDeps {
  activeCanvas?: Pick<Canvas, 'promptNodes'> | null;
  updatePromptNode: (node: PromptNode) => void | Promise<void>;
  cancelGenerationRequest: (requestId: string) => void;
  cancelSystemProxyTask: (jobId: string) => Promise<unknown>;
  authLoading: boolean;
  user: unknown;
  isTempUser: boolean;
  billingLoading: boolean;
  balance: number;
  setShowRechargeModal: (show: boolean) => void;
  consumeCreditsDetailed: (
    modelId: string,
    count: number,
    details?: Record<string, unknown>,
  ) => Promise<CreditConsumeResult>;
  refundCreditsByTransaction: (transactionId: string, reason: string) => Promise<CreditRefundResult>;
  refreshBilling: (options?: RefreshBillingOptions) => Promise<void>;
  adjustBalanceOptimistically: (delta: number) => void;
}

export interface UseGenerationRuntimeResult {
  handleCancelGeneration: (id?: string) => Promise<void>;
  ensureCreditAttemptCharged: (params: EnsureCreditAttemptChargedParams) => Promise<EnsureCreditAttemptChargedResult>;
  prepareInitialCreditSettlement: (params: PrepareInitialCreditSettlementParams) => Promise<PrepareInitialCreditSettlementResult>;
  prepareGenerationDraftContext: (args: PrepareGenerationDraftContextArgs) => PrepareGenerationDraftContextResult;
  prepareInitialBillingAttemptContext: (params: PrepareInitialBillingAttemptContextParams) => PrepareInitialBillingAttemptContextResult;
  prepareGenerationBillingStateContext: (params: PrepareGenerationBillingStateContextParams) => PrepareGenerationBillingStateContextResult;
  prepareInitialGeneratingPromptNode: (params: PrepareInitialGeneratingPromptNodeParams) => PrepareInitialGeneratingPromptNodeResult;
  persistInitialGeneratingPromptNode: (params: PersistInitialGeneratingPromptNodeParams) => Promise<PersistInitialGeneratingPromptNodeResult>;
  prepareInitialGenerationPromptOptimization: (params: PrepareInitialGenerationPromptOptimizationParams) => Promise<PrepareInitialGenerationPromptOptimizationResult>;
  completeInitialGenerationPromptSubmission: (params: CompleteInitialGenerationPromptSubmissionParams) => void;
  commitRetryGenerationFailure: (params: CommitRetryGenerationFailureParams) => Promise<void>;
  executeInitialGenerationPromptNode: (params: ExecuteInitialGenerationPromptNodeParams) => Promise<void>;
  reportInitialGenerationFailure: (params: ReportInitialGenerationFailureParams) => void;
  createRetryGenerationTimeoutGuard: (params: CreateRetryGenerationTimeoutGuardParams) => CreateRetryGenerationTimeoutGuardResult;
  commitRetryGenerationStart: (params: CommitRetryGenerationStartParams) => void;
  reportRetryRecoveryResult: (params: ReportRetryRecoveryResultParams) => void;
  prepareRetryGenerationRequestContext: (params: PrepareRetryGenerationRequestContextParams) => PrepareRetryGenerationRequestContextResult;
  reportRetryGenerationSuccess: (params: ReportRetryGenerationSuccessParams) => void;
  prepareRetryGenerationTaskPromptContext: (params: PrepareRetryGenerationTaskPromptContextParams) => PrepareRetryGenerationTaskPromptContextResult;
  prepareRetryVideoGenerationRequest: (params: PrepareRetryVideoGenerationRequestParams) => PrepareRetryVideoGenerationRequestResult;
  prepareRetryImageGenerationRequest: (params: PrepareRetryImageGenerationRequestParams) => PrepareRetryImageGenerationRequestResult;
  prepareRetryGeneratedMediaPersistence: (params: PrepareRetryGeneratedMediaPersistenceParams) => Promise<PrepareRetryGeneratedMediaPersistenceResult>;
  resolveRetryGeneratedMediaDimensions: (params: ResolveRetryGeneratedMediaDimensionsParams) => Promise<ResolveRetryGeneratedMediaDimensionsResult>;
  buildRetryGeneratedMediaResult: (params: BuildRetryGeneratedMediaResultParams) => RetryGeneratedMediaResult;
  buildRetryGeneratedMediaLayout: (params: BuildRetryGeneratedMediaLayoutParams) => RetryGeneratedMediaLayoutNode[];
  buildRetryCompletedPromptPatch: (params: BuildRetryCompletedPromptPatchParams) => Partial<PromptNode>;
  resolveFailedCreditAttempt: (node: GenerationCreditAttemptNode) => Promise<GenerationCreditAttemptFailurePatch>;
  applyOptimisticServerCreditDebit: (requiredCredits: number, useServerSideCreditSettlement: boolean) => void;
}

export function useGenerationRuntime({
  activeCanvas,
  updatePromptNode,
  cancelGenerationRequest,
  cancelSystemProxyTask,
  authLoading,
  user,
  isTempUser,
  billingLoading,
  balance,
  setShowRechargeModal,
  consumeCreditsDetailed,
  refundCreditsByTransaction,
  refreshBilling,
  adjustBalanceOptimistically,
}: UseGenerationRuntimeDeps): UseGenerationRuntimeResult {
  const ensureCreditAttemptCharged = useCallback(async (params: EnsureCreditAttemptChargedParams) => {
    if (params.requiredCredits <= 0) {
      return { success: true as const, transactionId: undefined };
    }

    if (authLoading) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.info('账户状态确认中', '正在校验登录状态，请稍后再试。');
      });
      return { success: false as const };
    }

    if (!user || isTempUser) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('请先登录', '积分模型需要登录正式账号后使用。');
      });
      return { success: false as const };
    }

    if (billingLoading) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.info('余额同步中', '正在刷新账户余额，请稍后重试。');
      });
      return { success: false as const };
    }

    if (balance < params.requiredCredits) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('生成失败', '您的账户余额不足，请先充值积分。');
      });
      setShowRechargeModal(true);
      return { success: false as const };
    }

    if (params.useServerSideCreditSettlement) {
      return { success: true as const, transactionId: undefined };
    }

    const chargeResult = await consumeCreditsDetailed(params.modelId, params.requiredCredits, {
      feature: `模型调用：${params.modelLabel || params.modelId}`,
      modelName: params.modelLabel || params.modelId,
      providerId: params.providerId || params.provider || 'managed',
      provider: params.provider,
      keySlotId: params.providerId,
      attemptId: params.billingAttempt?.attemptId,
      businessRefId: params.billingAttempt?.businessRefId,
      idempotencyKey: params.billingAttempt?.idempotencyKey,
    });

    if (!chargeResult.success) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('生成失败', chargeResult.message || '积分扣费失败，请稍后重试。');
      });
      if ((chargeResult.newBalance ?? balance) < params.requiredCredits) {
        setShowRechargeModal(true);
      }
      return { success: false as const };
    }

    return {
      success: true as const,
      transactionId: chargeResult.transactionId,
    };
  }, [authLoading, balance, billingLoading, consumeCreditsDetailed, isTempUser, setShowRechargeModal, user]);

  const prepareInitialCreditSettlement = useCallback(async (params: PrepareInitialCreditSettlementParams) => {
    if (!params.isCreditModel) {
      return { allowed: true as const, paymentTransactionId: undefined };
    }

    if (authLoading) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.info('账号状态确认中', '正在校验登录状态，请稍后再试。');
      });
      return { allowed: false as const };
    }

    if (!user || isTempUser) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('请先登录', '管理员配置的积分模型需要登录账号后使用积分调用。');
      });
      return { allowed: false as const };
    }

    if (params.requiredCredits > 0 && billingLoading) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.info('余额同步中', '正在刷新账户余额，请稍后重试。');
      });
      return { allowed: false as const };
    }

    if (params.requiredCredits > 0 && balance < params.requiredCredits) {
      import('../services/system/notificationService').then(({ notify }) => {
        notify.error('生成失败', '您的账户余额不足，请先充值积分。');
      });
      setShowRechargeModal(true);
      return { allowed: false as const };
    }

    if (params.requiredCredits > 0 && !params.useServerSideCreditSettlement) {
      const chargeAttempt = await ensureCreditAttemptCharged({
        modelId: params.modelId,
        modelLabel: params.modelLabel,
        providerId: params.providerId,
        provider: params.provider,
        requiredCredits: params.requiredCredits,
        useServerSideCreditSettlement: params.useServerSideCreditSettlement,
        billingAttempt: params.billingAttempt,
      });

      if (!chargeAttempt.success) {
        return { allowed: false as const };
      }

      return {
        allowed: true as const,
        paymentTransactionId: chargeAttempt.transactionId,
      };
    }

    return { allowed: true as const, paymentTransactionId: undefined };
  }, [
    authLoading,
    balance,
    billingLoading,
    ensureCreditAttemptCharged,
    isTempUser,
    setShowRechargeModal,
    user,
  ]);

  const resolveFailedCreditAttempt = useCallback(async (node: GenerationCreditAttemptNode) => {
    const failureState = await resolveGenerationAttemptFailureState(node, {
      refundCreditsByTransaction,
      refreshBilling,
    });

    if (
      failureState.refundStatus === 'failed'
      && node.billingMode === 'credits'
      && node.creditSettlement === 'server'
      && (node.cost || 0) > 0
    ) {
      console.error('[resolveFailedCreditAttempt] Failed to refresh billing after server-side credit failure:', node.id);
    }

    return failureState;
  }, [refundCreditsByTransaction, refreshBilling]);

  const commitRetryGenerationFailure = useCallback(async (params: CommitRetryGenerationFailureParams) => {
    const failedBillingState = await resolveFailedCreditAttempt(params.executionNode);
    const rawMessage = (params.error as { message?: unknown } | null | undefined)?.message;
    const errorMessage = typeof rawMessage === 'string' && rawMessage ? rawMessage : 'Retry failed';
    const notifyMessage = errorMessage;

    await updatePromptNode({
      ...params.executionNode,
      isGenerating: false,
      isDraft: false,
      error: errorMessage,
      errorDetails: params.extractErrorDetails(params.error, params.executionNode.model),
      ...failedBillingState
    });
    import('../services/system/notificationService').then(({ notify }) => {
      notify.error('重试失败', notifyMessage);
    });
  }, [resolveFailedCreditAttempt, updatePromptNode]);

  const applyOptimisticServerCreditDebit = useCallback((requiredCredits: number, useServerSideCreditSettlement: boolean) => {
    if (useServerSideCreditSettlement && requiredCredits > 0) {
      adjustBalanceOptimistically(-requiredCredits);
    }
  }, [adjustBalanceOptimistically]);

  const executeInitialGenerationPromptNode = useCallback(async (params: ExecuteInitialGenerationPromptNodeParams) => {
    applyOptimisticServerCreditDebit(params.requiredCredits, params.useServerSideCreditSettlement);
    await params.executeGeneration(params.persistedGeneratingNode);
  }, [applyOptimisticServerCreditDebit]);

  const reportInitialGenerationFailure = useCallback((params: ReportInitialGenerationFailureParams) => {
    console.error('[handleGenerate] failed:', params.error);
    const message = String((params.error as { message?: unknown } | null | undefined)?.message || '请重试');
    import('../services/system/notificationService').then(({ notify }) => {
      notify.error('发送失败', message);
    });
  }, []);

  const createRetryGenerationTimeoutGuard = useCallback((params: CreateRetryGenerationTimeoutGuardParams) => {
    let isFinished = false;
    const timer = setTimeout(() => {
      if (!isFinished) {
        cancelGenerationRequest(params.requestId);
        void updatePromptNode({
          ...params.executionNode,
          isGenerating: false,
          isDraft: false,
          error: '生成超时',
          errorDetails: {
            code: 'TIMEOUT',
            responseBody: `Retry request exceeded ${params.timeoutMs}ms timeout`,
            model: params.executionNode.model,
            timestamp: Date.now()
          }
        });
      }
    }, params.timeoutMs);

    return {
      markFinished: () => {
        isFinished = true;
      },
      clear: () => clearTimeout(timer),
    };
  }, [cancelGenerationRequest, updatePromptNode]);

  const commitRetryGenerationStart = useCallback((params: CommitRetryGenerationStartParams) => {
    updatePromptNode({
      ...params.executionNode,
      modelLabel: params.resolveModelDisplayName(params.executionNode.model, params.executionNode.modelLabel || params.executionNode.model),
      isGenerating: true,
      error: undefined,
      errorDetails: undefined,
      isDraft: false,
      timestamp: Date.now()
    });
    applyOptimisticServerCreditDebit(
      params.retryBillingState.requiredCredits,
      params.retryBillingState.useServerSideCreditSettlement,
    );
  }, [applyOptimisticServerCreditDebit, updatePromptNode]);

  const reportRetryRecoveryResult = useCallback((params: ReportRetryRecoveryResultParams) => {
    if (params.recoveredCount <= 0 && params.pendingCount <= 0) {
      return;
    }
    const message = params.pendingCount > 0
      ? `已重新接管 ${params.pendingCount} 个可恢复请求，后台返图后会自动补回。`
      : `已找到 ${params.recoveredCount} 个已返图结果，正在补回到当前卡片。`;
    import('../services/system/notificationService').then(({ notify }) => {
      notify.info('恢复历史结果', message);
    });
  }, []);

  const prepareRetryGenerationRequestContext = useCallback((params: PrepareRetryGenerationRequestContextParams) => {
    const currentNodeId = params.node.id;
    const requestedCount = params.node.parallelCount || params.defaultParallelCount || 1;
    const count = params.node.mode === GenerationMode.PPT ? Math.min(20, Math.max(1, requestedCount)) : requestedCount;
    return { currentNodeId, requestedCount, count };
  }, []);

  const reportRetryGenerationSuccess = useCallback((params: ReportRetryGenerationSuccessParams) => {
    const effectiveSize = params.alignedImageNodes[0]?.imageSize || params.executionNode.imageSize;

    import('../services/billing/costService').then(({ recordCost }) => {
      const firstDebug = params.results[0] || {};
      recordCost(
        params.executionNode.model,
        effectiveSize as ImageSize,
        params.alignedImageNodes.length,
        params.executionNode.prompt,
        params.executionNode.referenceImages?.length || 0,
        undefined,
        {
          requestPath: firstDebug.requestPath,
          requestBodyPreview: firstDebug.requestBodyPreview,
          pythonSnippet: firstDebug.pythonSnippet
        },
        params.alignedImageNodes[0]?.keySlotId || params.executionNode.keySlotId
      );
    });
    import('../services/system/notificationService').then(({ notify }) => {
      notify.success('生成完成', '重新生成成功');
    });
  }, []);

  const prepareRetryGenerationTaskPromptContext = useCallback((params: PrepareRetryGenerationTaskPromptContextParams) => {
    const currentMode = params.executionNode.mode || GenerationMode.IMAGE;
    if (currentMode !== GenerationMode.PPT) {
      return { currentMode, taskPrompt: params.executionNode.prompt };
    }

    const slideLines = (params.executionNode.pptSlides || [])
      .map((line) => String(line || '').trim())
      .filter(Boolean);
    const styleDirective = params.executionNode.pptStyleLocked !== false
      ? '与整套 PPT 保持完全统一的视觉语言'
      : '保持整体风格统一，但允许当前页面有适度变化';
    const picked = slideLines.length > 0
      ? slideLines[Math.min(params.index, slideLines.length - 1)]
      : `主题：${params.sourcePrompt}。保持同一套视觉风格，页面内容独立不重复。`;

    return {
      currentMode,
      taskPrompt: `PPT 第 ${params.index + 1}/${params.count} 页。${picked}。16:9。${styleDirective}。`,
    };
  }, []);

  const prepareRetryVideoGenerationRequest = useCallback((params: PrepareRetryVideoGenerationRequestParams) => {
    const videoResolution = (() => {
      if (params.executionNode.videoResolution) return params.executionNode.videoResolution;
      const size = params.executionNode.imageSize?.toLowerCase() || '';
      if (size.includes('4k') || size.includes('ultra')) return '4k';
      if (size.includes('1080') || size.includes('hd')) return '1080p';
      return '720p';
    })();
    const videoAspect = params.executionNode.aspectRatio === '9:16' ? '9:16' : '16:9';

    return {
      modelId: params.executionNode.model,
      prompt: params.taskPrompt,
      aspectRatio: videoAspect,
      imageUrl: params.executionNode.referenceImages?.[0]?.data,
      imageTailUrl: params.executionNode.referenceImages?.[1]?.data,
      videoDuration: params.executionNode.videoDuration,
      preferredKeyId: params.executionNode.keySlotId,
      providerConfig: {
        google: {
          imageConfig: { imageSize: videoResolution }
        }
      }
    };
  }, []);

  const prepareRetryImageGenerationRequest = useCallback((params: PrepareRetryImageGenerationRequestParams): PrepareRetryImageGenerationRequestResult => ({
    args: [
      params.taskPrompt,
      params.executionNode.aspectRatio,
      params.executionNode.imageSize,
      params.executionNode.referenceImages || [],
      params.executionNode.model,
      '',
      params.requestId,
    ],
    grounding: !!params.executionNode.enableGrounding || !!params.executionNode.enableImageSearch,
    options: {
      preferredKeyId: params.executionNode.keySlotId,
      enableWebSearch: !!params.executionNode.enableGrounding,
      enableImageSearch: !!params.executionNode.enableImageSearch,
      thinkingMode: params.executionNode.thinkingMode || 'minimal'
    }
  }), []);

  const prepareRetryGeneratedMediaPersistence = useCallback(async (
    params: PrepareRetryGeneratedMediaPersistenceParams,
  ): Promise<PrepareRetryGeneratedMediaPersistenceResult> => {
    let url = params.b64;
    let originalUrl = '';
    let apiResultUrl: string | undefined = undefined;

    if (params.currentMode === GenerationMode.IMAGE || params.currentMode === GenerationMode.PPT || params.currentMode === GenerationMode.ECOMMERCE) {
      if (params.b64.startsWith('data:')) {
        originalUrl = params.b64;
      } else if (/^https?:\/\//i.test(params.b64)) {
        apiResultUrl = params.b64;
      }
    } else {
      url = params.b64;
      originalUrl = params.b64;
    }

    const mimeType = params.currentMode === GenerationMode.VIDEO ? 'video/mp4' : 'image/png';
    const normalizedOriginalSource = params.normalizePersistableMediaSource(
      originalUrl || url,
      mimeType,
    );
    const storageId = await params.calculateImageHash(normalizedOriginalSource || url);

    if (params.currentMode === GenerationMode.IMAGE || params.currentMode === GenerationMode.PPT || params.currentMode === GenerationMode.ECOMMERCE) {
      if (normalizedOriginalSource) {
        void params.saveOriginalImage(storageId, normalizedOriginalSource).catch(() => undefined);
      }
    }

    return {
      apiResultUrl,
      mimeType,
      normalizedOriginalSource,
      originalUrl,
      storageId,
      url,
    };
  }, []);

  const resolveRetryGeneratedMediaDimensions = useCallback(async (
    params: ResolveRetryGeneratedMediaDimensionsParams,
  ): Promise<ResolveRetryGeneratedMediaDimensionsResult> => {
    let actualWidth = 1024;
    let actualHeight = 1024;
    let displayDimensions = `${params.executionNode.aspectRatio} · ${params.executionNode.imageSize || '1K'}`;
    let computedImageSize: PromptNode['imageSize'] = params.executionNode.imageSize || ImageSize.SIZE_1K;

    try {
      if (typeof createImageBitmap !== 'undefined' && params.b64.startsWith('blob:')) {
        const res = await fetch(params.b64);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        actualWidth = bitmap.width;
        actualHeight = bitmap.height;
        bitmap.close();
      } else {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = params.url;
        });
        actualWidth = img.naturalWidth;
        actualHeight = img.naturalHeight;
      }

      displayDimensions = `${actualWidth}x${actualHeight}`;

      const maxDim = Math.max(actualWidth, actualHeight);
      if (maxDim > 3000) {
        computedImageSize = ImageSize.SIZE_4K;
      } else if (maxDim > 1500) {
        computedImageSize = ImageSize.SIZE_2K;
      } else {
        computedImageSize = ImageSize.SIZE_1K;
      }
      console.log(`[Fair Billing] Requested: ${params.executionNode.imageSize}, Received: ${actualWidth}x${actualHeight}, Billed As: ${computedImageSize}`);
    } catch (e) {
      console.warn('[App] Failed to detect actual dimensions, falling back to requested', e);
    }

    return {
      actualHeight,
      actualWidth,
      computedImageSize,
      displayDimensions,
    };
  }, []);

  const buildRetryGeneratedMediaResult = useCallback((params: BuildRetryGeneratedMediaResultParams): RetryGeneratedMediaResult => {
    const sourceReferenceStorageIds = (params.executionNode.referenceImages || [])
      .map(ref => ref.storageId || ref.id)
      .filter((id): id is string => Boolean(id));

    return {
      canvasId: params.canvasId || 'default',
      parentPromptId: params.executionNode.id,
      dimensions: params.mediaDimensions.displayDimensions,
      generationTime: params.generationTime,
      index: params.index,
      url: params.mediaPersistence.url,
      originalUrl: params.mediaPersistence.originalUrl,
      apiResultUrl: params.mediaPersistence.apiResultUrl,
      prompt: params.prompt,
      width: params.mediaDimensions.actualWidth,
      height: params.mediaDimensions.actualHeight,
      aspectRatio: params.executionNode.aspectRatio,
      imageSize: params.mediaDimensions.computedImageSize,
      model: params.resultMetadata.model,
      modelLabel: params.resultMetadata.modelLabel,
      provider: params.resultMetadata.provider,
      providerLabel: params.resultMetadata.providerLabel,
      tokens: params.resultMetadata.tokens,
      promptTokens: params.resultMetadata.promptTokens,
      completionTokens: params.resultMetadata.completionTokens,
      cost: params.resultMetadata.cost,
      costSource: params.resultMetadata.costSource,
      billingMode: params.executionNode.billingMode,
      creditCost: params.executionNode.creditCost,
      keySlotId: params.resultMetadata.keySlotId,
      sourceReferenceStorageIds,
      alias: params.alias,
      seed: -1,
      id: `${Date.now()}_${params.index}_${Math.random().toString(36).substr(2, 5)}`,
      storageId: params.mediaPersistence.storageId,
      mimeType: params.mediaPersistence.mimeType,
      timestamp: Date.now(),
      mode: params.currentMode,
      requestPath: params.requestTrace.requestPath,
      requestBodyPreview: params.requestTrace.requestBodyPreview,
      pythonSnippet: params.requestTrace.pythonSnippet,
    };
  }, []);

  const buildRetryGeneratedMediaLayout = useCallback((params: BuildRetryGeneratedMediaLayoutParams): RetryGeneratedMediaLayoutNode[] => {
    const gapToImages = 20;
    const gap = 16;
    const { width: cardWidth, totalHeight: cardHeight } = params.getCardDimensions(params.executionNode.aspectRatio, true);

    const newImageNodes = params.results.map((img, i) => {
      let x;
      let y;
      let exactImageHeight = cardHeight;

      if (img.dimensions) {
        const match = img.dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
        if (match && match[1] && match[2]) {
          const w = parseInt(match[1], 10);
          const h = parseInt(match[2], 10);
          if (w > 0 && h > 0) {
            const ratio = w / h;
            const displayWidth = ratio > 1 ? 320 : (ratio < 1 ? 200 : 280);
            exactImageHeight = (displayWidth / ratio) + 40;
          }
        }
      } else {
        const { totalHeight } = params.getCardDimensions(params.executionNode.aspectRatio, true);
        exactImageHeight = totalHeight;
      }

      const isPptMode = (params.executionNode.mode || GenerationMode.IMAGE) === GenerationMode.PPT;

      if (isPptMode) {
        const pptGap = 28;
        const offsetY = gapToImages + exactImageHeight + i * (exactImageHeight + pptGap);
        x = params.executionNode.position.x;
        y = params.executionNode.position.y + offsetY;
      } else if (params.isMobile) {
        const row = i;
        const mobileCardWidth = cardWidth;
        const mobileGap = 20;
        const startX = -mobileCardWidth / 2;
        const offsetX = startX + mobileCardWidth / 2;
        const offsetY = gapToImages + exactImageHeight + row * (exactImageHeight + mobileGap);
        x = params.executionNode.position.x + offsetX;
        y = params.executionNode.position.y + offsetY;
      } else {
        const cols = Math.min(params.count, 2);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const itemsInRow = Math.min(cols, params.count - row * cols);
        let actualCardHeight = cardHeight;

        if (img.dimensions) {
          const match = img.dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
          if (match && match[1] && match[2]) {
            const w = parseInt(match[1], 10);
            const h = parseInt(match[2], 10);
            if (w > 0 && h > 0) {
              const aspect = w / h;
              const { width: baseWidth } = params.getCardDimensions(params.executionNode.aspectRatio, false);
              actualCardHeight = (baseWidth / aspect) + 40;
            }
          }
        }

        if (params.count === 1) {
          x = params.executionNode.position.x;
          y = params.executionNode.position.y + gapToImages + actualCardHeight;
        } else {
          const gridCardWidth = cardWidth;
          const currentGridWidth = itemsInRow * gridCardWidth + (itemsInRow - 1) * gap;
          const startX = params.executionNode.position.x - currentGridWidth / 2;
          const offsetX = startX + col * (gridCardWidth + gap) + gridCardWidth / 2 - params.executionNode.position.x;
          const rowHeight = exactImageHeight;
          const rowOffsetY = row * (rowHeight + gap);
          const offsetY = gapToImages + exactImageHeight + rowOffsetY;

          x = params.executionNode.position.x + offsetX;
          y = params.executionNode.position.y + offsetY;
        }
      }

      return {
        ...img,
        position: { x, y },
      };
    });

    const generatedPositions = params.buildGeneratedImageBatchPositions({
      basePosition: (params.latestLayoutPrompt || params.executionNode).position || params.executionNode.position,
      items: newImageNodes.map((img) => ({
        aspectRatio: img.aspectRatio,
        exactDimensions: (typeof img.width === 'number' && typeof img.height === 'number' && img.width > 0 && img.height > 0)
          ? { width: img.width, height: img.height }
          : undefined,
      })),
      mode: params.executionNode.mode,
      isMobile: params.isMobile,
    });

    return newImageNodes.map((img, index) => ({
      ...img,
      position: generatedPositions[index] || img.position,
    }));
  }, []);

  const buildRetryCompletedPromptPatch = useCallback((params: BuildRetryCompletedPromptPatchParams): Partial<PromptNode> => {
    const primaryImageNode = params.alignedImageNodes[0];
    const modelId = primaryImageNode?.model || params.executionNode.model;

    return {
      isGenerating: false,
      isDraft: false,
      childImageIds: params.alignedImageNodes.map(n => n.id),
      ...buildCompletedPromptNodePatch(),
      keySlotId: primaryImageNode?.keySlotId || params.executionNode.keySlotId,
      provider: primaryImageNode?.provider || params.executionNode.provider,
      providerLabel: primaryImageNode?.providerLabel || params.executionNode.providerLabel,
      modelLabel: params.resolveModelDisplayName(
        modelId,
        primaryImageNode?.modelLabel || params.executionNode.modelLabel,
      ),
    };
  }, []);

  const prepareGenerationDraftContext = useCallback(({
    activeCanvasRef,
    activeSourceImage,
    draftNodeId,
  }: PrepareGenerationDraftContextArgs) => {
    const isFollowUp = !!activeSourceImage;
    const existingPromptDraftId = String(draftNodeId || '').trim();
    const existingPromptDraft = existingPromptDraftId
      ? activeCanvasRef.current?.promptNodes.find((node) => node.id === existingPromptDraftId) ?? null
      : null;
    const hasReusablePromptDraft = Boolean(isFollowUp && existingPromptDraft);
    const promptNodeId = hasReusablePromptDraft
      ? existingPromptDraftId
      : createGenerationPromptNodeId();

    return {
      isFollowUp,
      existingPromptDraftId,
      existingPromptDraft,
      hasReusablePromptDraft,
      promptNodeId,
    };
  }, []);

  const prepareInitialBillingAttemptContext = useCallback((params: PrepareInitialBillingAttemptContextParams) => {
    const resolvedCreditRoute = params.generationBillingState.isCreditModel
      ? adminModelService.getCreditRouteSnapshot(params.modelId, params.imageSize)
      : null;
    const billingAttempt = buildGenerationBillingAttempt({
      nodeId: params.promptNodeId,
      phase: 'initial',
    });

    return {
      resolvedCreditRoute,
      resolvedCreditSpecId: resolvedCreditRoute?.specId,
      billingAttempt,
      executionLane: params.generationBillingState.executionLane,
      useServerSideCreditSettlement: params.generationBillingState.useServerSideCreditSettlement,
    };
  }, []);

  const prepareGenerationBillingStateContext = useCallback((params: PrepareGenerationBillingStateContextParams) => {
    const customLocal = (() => {
      try {
        return JSON.parse(localStorage.getItem('kk_model_customizations') || '{}')[params.config.model] || {};
      } catch {
        return {};
      }
    })();

    const preferredKeyIdForBilling = params.hasExplicitModelRoute(params.config.model)
      ? undefined
      : params.getPreferredKeyForMode(params.config.mode);
    const selectedKeyForBilling = keyManager.getNextKey(params.config.model, preferredKeyIdForBilling);
    const generationBillingState = resolveGenerationBillingState({
      modelId: params.config.model,
      imageSize: params.config.imageSize,
      mode: params.config.mode,
      parallelCount: params.config.parallelCount,
      customAlias: customLocal.alias,
      preferredKeyId: selectedKeyForBilling?.id || preferredKeyIdForBilling,
      resolveCreditCostForModel: params.resolveCreditCostForModel,
    });

    console.log('[handleGenerate] 计费检查', {
      model: params.config.model,
      provider: generationBillingState.resolvedProvider,
      selectedKeyId: selectedKeyForBilling?.id,
      hasCustomUserKey: generationBillingState.hasCustomUserKey,
      isCreditModel: generationBillingState.isCreditModel,
      mode: params.config.mode,
    });

    return {
      selectedKeyForBilling,
      generationBillingState,
    };
  }, []);

  const prepareInitialGeneratingPromptNode = useCallback((params: PrepareInitialGeneratingPromptNodeParams) => {
    const generationPreviewState = resolveGenerationPreviewState({
      config: params.config,
      rawPrompt: params.rawPrompt,
      selectedKeyForBilling: params.selectedKeyForBilling,
      useServerSideCreditSettlement: params.useServerSideCreditSettlement,
    });

    const generatingNode = buildGeneratingPromptNode({
      promptNodeId: params.promptNodeId,
      prompt: params.rawPrompt,
      optimizedPromptEn: params.optimizedPromptEn,
      optimizedPromptZh: params.optimizedPromptZh,
      promptOptimizerResult: params.promptOptimizerResult,
      promptOptimizationEnabled: !!(params.config.enablePromptOptimization && (params.optimizedPromptEn || params.promptOptimizerResult)),
      position: params.currentPos,
      config: params.config,
      previewModelLabel: generationPreviewState.previewModelLabel,
      previewModelMeta: generationPreviewState.previewColorMeta,
      previewProvider: generationPreviewState.previewProvider,
      previewProviderLabel: generationPreviewState.previewProviderLabel,
      keySlotId: generationPreviewState.keySlotId,
      referenceImages: params.finalReferenceImages,
      creditSettlement: params.useServerSideCreditSettlement ? 'server' : 'client',
      executionLane: params.executionLane,
      billingAttemptId: params.billingAttempt.attemptId,
      creditRouteSpecId: params.resolvedCreditSpecId,
      creditRouteUnitId: params.resolvedCreditRoute?.routeUnitId,
      paymentTransactionId: params.paymentTransactionId,
      isNew: true,
      parallelCount: generationPreviewState.parallelCount,
      sourceImageId: params.activeSourceImage || undefined,
      pptSlides: generationPreviewState.pptSlides,
      cost: params.requiredCredits,
      billingMode: params.generationBillingState.isCreditModel ? 'credits' : 'currency',
      creditCost: params.generationBillingState.isCreditModel ? params.perImageCreditCost : undefined,
      isPaymentProcessed: params.requiredCredits > 0 && !params.useServerSideCreditSettlement,
    });

    return { generatingNode };
  }, []);

  const persistInitialGeneratingPromptNode = useCallback(async (params: PersistInitialGeneratingPromptNodeParams) => {
    const persistedGeneratingNode = await persistGeneratingPromptNode({
      generatingNode: params.generatingNode,
      getCanvas: params.getCanvas,
      updatePromptNode,
      addPromptNode: params.addPromptNode,
      updateImageNodePosition: params.updateImageNodePosition,
      deletePromptNode: params.deletePromptNode,
    });

    return { persistedGeneratingNode };
  }, [updatePromptNode]);

  const prepareInitialGenerationPromptOptimization = useCallback(async (params: PrepareInitialGenerationPromptOptimizationParams) => {
    return optimizeGenerationPrompt({
      enabled: (params.config.mode === GenerationMode.IMAGE || params.config.mode === GenerationMode.PPT)
        && params.config.enablePromptOptimization
        && !!params.rawPrompt,
      rawPrompt: params.rawPrompt,
      referenceImages: params.finalReferenceImages,
      options: {
        preferredModelId: params.config.model,
        aspectRatio: params.config.aspectRatio,
        imageSize: params.config.imageSize,
        mode: params.config.mode,
        supportsThinking: !!getModelCapabilities(params.config.model)?.supportsThinking,
        thinkingMode: params.config.thinkingMode || 'minimal',
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error || '');
        console.warn('[handleGenerate] Prompt optimization failed, fallback to raw prompt:', error);
        import('../services/system/notificationService').then(({ notify }) => {
          notify.error('Prompt optimization failed', 'Fell back to the original prompt: ' + message);
        });
      },
    });
  }, []);

  const completeInitialGenerationPromptSubmission = useCallback((params: CompleteInitialGenerationPromptSubmissionParams) => {
    params.setDraftNodeId(null);
    params.setConfig(prev => ({ ...prev, prompt: '', referenceImages: [] }));
    params.setActiveSourceImage(null);
  }, []);

  const handleCancelGeneration = useCallback(async (id?: string) => {
    const promptNodes = activeCanvas?.promptNodes ?? [];

    if (id) {
      cancelGenerationRequest(id);
      const node = promptNodes.find((candidate) => candidate.id === id);
      if (!node) {
        return;
      }

      if (node.jobId?.startsWith('system_proxy:')) {
        try {
          await cancelSystemProxyTask(node.jobId);
        } catch (error) {
          console.warn('[handleCancelGeneration] 取消系统任务失败:', error);
        }
      }

      await updatePromptNode({
        ...node,
        ...buildCancelledPromptNodePatch(node.model),
      });
      return;
    }

    const generatingNodes = promptNodes.filter((node) => node.isGenerating);
    await Promise.allSettled(generatingNodes.map(async (node) => {
      const count = node.parallelCount || 1;
      for (let i = 0; i < count; i += 1) {
        cancelGenerationRequest(`${node.id}-${i}`);
      }

      if (node.jobId?.startsWith('system_proxy:')) {
        try {
          await cancelSystemProxyTask(node.jobId);
        } catch (error) {
          console.warn('[handleCancelGeneration] 批量取消系统任务失败:', error);
        }
      }

      await updatePromptNode({
        ...node,
        ...buildCancelledPromptNodePatch(node.model),
      });
    }));
  }, [activeCanvas, cancelGenerationRequest, cancelSystemProxyTask, updatePromptNode]);

  return {
    handleCancelGeneration,
    ensureCreditAttemptCharged,
    prepareInitialCreditSettlement,
    prepareGenerationDraftContext,
    prepareInitialBillingAttemptContext,
    prepareGenerationBillingStateContext,
    prepareInitialGeneratingPromptNode,
    persistInitialGeneratingPromptNode,
    prepareInitialGenerationPromptOptimization,
    completeInitialGenerationPromptSubmission,
    commitRetryGenerationFailure,
    executeInitialGenerationPromptNode,
    reportInitialGenerationFailure,
    createRetryGenerationTimeoutGuard,
    commitRetryGenerationStart,
    reportRetryRecoveryResult,
    prepareRetryGenerationRequestContext,
    reportRetryGenerationSuccess,
    prepareRetryGenerationTaskPromptContext,
    prepareRetryVideoGenerationRequest,
    prepareRetryImageGenerationRequest,
    prepareRetryGeneratedMediaPersistence,
    resolveRetryGeneratedMediaDimensions,
    buildRetryGeneratedMediaResult,
    buildRetryGeneratedMediaLayout,
    buildRetryCompletedPromptPatch,
    resolveFailedCreditAttempt,
    applyOptimisticServerCreditDebit,
  };
}
