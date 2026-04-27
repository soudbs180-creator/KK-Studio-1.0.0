import type { ImageSize, PromptNode } from '../types';
import { buildBilledPromptNodePatch } from './buildBilledPromptNodePatch';
import { resolveGenerationBillingState } from './resolveGenerationBillingState';
import {
  buildGenerationBillingAttempt,
  type GenerationBillingAttempt,
} from '../services/billing/generationBillingCoordinator';
import { resolveModelDisplayName } from '../utils/modelDisplayName';

type RetryExecutionPhase = 'retry' | 'ppt-single';

type RetryChargeResult = {
  success: boolean;
  transactionId?: string;
};

interface PrepareRetriedExecutionNodeArgs {
  executionNode: PromptNode;
  nodeId: string;
  parallelCount: number;
  phase: RetryExecutionPhase;
  pageIndex?: number;
  resolveCreditCostForModel: (modelId: string, imageSize?: ImageSize | string) => number;
  ensureCreditAttemptCharged: (params: {
    modelId: string;
    modelLabel?: string;
    providerId?: string;
    provider?: string;
    requiredCredits: number;
    useServerSideCreditSettlement: boolean;
    billingAttempt?: GenerationBillingAttempt;
  }) => Promise<RetryChargeResult>;
}

type PreparedRetryBillingState = ReturnType<typeof resolveGenerationBillingState>;

interface PrepareRetriedExecutionNodeResult {
  executionNode: PromptNode;
  billingAttempt: GenerationBillingAttempt;
  billingState: PreparedRetryBillingState;
}

export async function prepareRetriedExecutionNode({
  executionNode,
  nodeId,
  parallelCount,
  phase,
  pageIndex,
  resolveCreditCostForModel,
  ensureCreditAttemptCharged,
}: PrepareRetriedExecutionNodeArgs): Promise<PrepareRetriedExecutionNodeResult | null> {
  const billingState = resolveGenerationBillingState({
    modelId: executionNode.model,
    imageSize: executionNode.imageSize,
    mode: executionNode.mode,
    parallelCount,
    preferredKeyId: executionNode.keySlotId,
    provider: executionNode.provider,
    resolveCreditCostForModel,
  });
  const billingAttempt = buildGenerationBillingAttempt({
    nodeId,
    phase,
    pageIndex,
  });
  const chargeAttempt = await ensureCreditAttemptCharged({
    modelId: executionNode.model,
    modelLabel: resolveModelDisplayName(executionNode.model, executionNode.modelLabel || executionNode.model),
    providerId: billingState.useServerSideCreditSettlement ? 'system_proxy_slot' : executionNode.keySlotId,
    provider: executionNode.provider,
    requiredCredits: billingState.requiredCredits,
    useServerSideCreditSettlement: billingState.useServerSideCreditSettlement,
    billingAttempt,
  });

  if (!chargeAttempt.success) {
    return null;
  }

  return {
    billingAttempt,
    billingState,
    executionNode: {
      ...executionNode,
      ...buildBilledPromptNodePatch({
        billingAttemptId: billingAttempt.attemptId,
        isCreditModel: billingState.isCreditModel,
        paymentTransactionId: chargeAttempt.transactionId,
        perImageCreditCost: billingState.perImageCreditCost,
        requiredCredits: billingState.requiredCredits,
        useServerSideCreditSettlement: billingState.useServerSideCreditSettlement,
      }),
      error: undefined,
      errorDetails: undefined,
    },
  };
}
