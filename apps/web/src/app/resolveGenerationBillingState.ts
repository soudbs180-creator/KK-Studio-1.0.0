import { keyManager } from '../services/auth/keyManager';
import { type ModelExecutionLane, resolveModelExecutionLane } from '../services/model/modelExecutionLane';
import { isCreditBasedModel } from '../services/model/modelPricing';
import { GenerationMode, type ImageSize } from '../types';

interface ResolveGenerationBillingStateArgs {
  customAlias?: string;
  imageSize?: ImageSize | string;
  mode?: GenerationMode;
  modelId: string;
  parallelCount?: number | null;
  preferredKeyId?: string;
  provider?: string;
  resolveCreditCostForModel: (modelId: string, imageSize?: ImageSize | string) => number;
}

interface ResolveGenerationBillingStateResult {
  executionLane: ModelExecutionLane;
  hasCustomUserKey: boolean;
  isCreditModel: boolean;
  perImageCreditCost: number;
  requiredCredits: number;
  resolvedProvider?: string;
  useServerSideCreditSettlement: boolean;
}

export function resolveGenerationBillingState({
  customAlias,
  imageSize,
  mode,
  modelId,
  parallelCount,
  preferredKeyId,
  provider,
  resolveCreditCostForModel,
}: ResolveGenerationBillingStateArgs): ResolveGenerationBillingStateResult {
  const resolvedProvider = modelId.includes('@') ? modelId.split('@')[1] : provider;
  const hasCustomUserKey = keyManager.hasCustomKeyForModel(modelId);
  const isCreditModel = isCreditBasedModel(
    modelId,
    resolvedProvider,
    customAlias,
    hasCustomUserKey,
    preferredKeyId,
  );
  const executionLane = resolveModelExecutionLane({
    modelId,
    isCreditModel,
  });
  const useServerSideCreditSettlement = executionLane === 'cloud-credit-model';
  const perImageCreditCost = isCreditModel
    ? resolveCreditCostForModel(modelId, imageSize)
    : 0;
  const normalizedCount = Math.max(1, Number(parallelCount) || 1);
  const requiredCredits = isCreditModel
    ? (
      mode === GenerationMode.IMAGE
      || mode === GenerationMode.PPT
      || mode === GenerationMode.ECOMMERCE
        ? normalizedCount * perImageCreditCost
        : (perImageCreditCost || 1)
    )
    : 0;

  return {
    resolvedProvider,
    hasCustomUserKey,
    isCreditModel,
    executionLane,
    useServerSideCreditSettlement,
    perImageCreditCost,
    requiredCredits,
  };
}
