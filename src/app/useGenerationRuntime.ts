import { useCallback } from 'react';

import type { CreditConsumeResult, CreditRefundResult } from '../context/BillingContext';
import {
  buildGenerationBillingAttempt,
  resolveGenerationAttemptFailureState,
} from '../services/billing/generationBillingCoordinator';
import { adminModelService } from '../services/model/adminModelService';
import type { ModelExecutionLane } from '../services/model/modelExecutionLane';
import type { Canvas, ImageSize, PromptNode } from '../types';
import { buildCancelledPromptNodePatch } from './buildCancelledPromptNodePatch';

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

  const applyOptimisticServerCreditDebit = useCallback((requiredCredits: number, useServerSideCreditSettlement: boolean) => {
    if (useServerSideCreditSettlement && requiredCredits > 0) {
      adjustBalanceOptimistically(-requiredCredits);
    }
  }, [adjustBalanceOptimistically]);

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
    resolveFailedCreditAttempt,
    applyOptimisticServerCreditDebit,
  };
}
