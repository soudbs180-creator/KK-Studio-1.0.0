import { type GeneratedImage, type PromptNode } from '../types';
import { getModelCredits, isCreditBasedModel } from '../services/model/modelPricing';

type CreditBillingTarget = Pick<GeneratedImage, 'billingMode' | 'creditCost' | 'model' | 'provider' | 'imageSize' | 'keySlotId'>
  & Partial<Pick<PromptNode, 'executionLane'>>;

export const DEFAULT_PROMPT_GROUP_CREDIT_COST = 10;

const hasPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const isCreditBillingTarget = (target: CreditBillingTarget): boolean => {
  const modelId = String(target.model || '');
  const routeResolvedAsCredits = isCreditBasedModel(
    modelId,
    target.provider,
    undefined,
    undefined,
    target.keySlotId,
  );

  // If a concrete user route is attached, trust the resolved route first so
  // stale credit metadata does not leak into user-owned API results.
  if (target.keySlotId && !routeResolvedAsCredits) {
    return false;
  }

  if (target.billingMode === 'credits') {
    return true;
  }

  if (target.billingMode === 'currency') {
    return false;
  }

  if (routeResolvedAsCredits) {
    return true;
  }

  if (hasPositiveNumber(target.creditCost)) {
    return true;
  }

  return false;
};

export const getResolvedCreditCost = (
  target: Pick<GeneratedImage, 'creditCost' | 'model' | 'imageSize'>
): number => {
  if (hasPositiveNumber(target.creditCost)) {
    return target.creditCost;
  }

  return getModelCredits(String(target.model || ''), target.imageSize);
};

export const resolvePromptGroupCreditDisplay = (
  target: Partial<CreditBillingTarget>
): { isCreditModel: boolean; creditCost?: number } => {
  if (target.billingMode === 'currency') {
    return { isCreditModel: false };
  }

  const explicitCredit = isCreditBillingTarget(target as CreditBillingTarget);
  const mainCardDefaultCredit = !target.keySlotId && target.executionLane !== 'local-user-api';
  const isCreditModel = explicitCredit
    || target.executionLane === 'cloud-credit-model'
    || mainCardDefaultCredit;

  if (!isCreditModel) {
    return { isCreditModel: false };
  }

  const resolvedCost = getResolvedCreditCost(target as Pick<GeneratedImage, 'creditCost' | 'model' | 'imageSize'>);
  return {
    isCreditModel: true,
    creditCost: hasPositiveNumber(resolvedCost) ? resolvedCost : DEFAULT_PROMPT_GROUP_CREDIT_COST,
  };
};
