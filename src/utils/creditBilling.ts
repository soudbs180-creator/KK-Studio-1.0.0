import { GeneratedImage } from '../types';
import { getModelCredits, isCreditBasedModel } from '../services/model/modelPricing';

type CreditBillingTarget = Pick<GeneratedImage, 'billingMode' | 'creditCost' | 'model' | 'provider' | 'imageSize'>;

const hasPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const isCreditBillingTarget = (target: CreditBillingTarget): boolean => {
  if (target.billingMode === 'credits') {
    return true;
  }

  if (hasPositiveNumber(target.creditCost)) {
    return true;
  }

  const modelId = String(target.model || '');
  const lowerModelId = modelId.toLowerCase();

  if (
    target.provider === 'SystemProxy'
    || lowerModelId.includes('@system')
    || lowerModelId.includes('@systemproxy')
  ) {
    return true;
  }

  return isCreditBasedModel(modelId, target.provider);
};

export const getResolvedCreditCost = (
  target: Pick<GeneratedImage, 'creditCost' | 'model' | 'imageSize'>
): number => {
  if (hasPositiveNumber(target.creditCost)) {
    return target.creditCost;
  }

  return getModelCredits(String(target.model || ''), target.imageSize);
};
