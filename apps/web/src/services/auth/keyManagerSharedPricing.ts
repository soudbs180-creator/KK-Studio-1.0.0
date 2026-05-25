import {
  buildProviderPricingSnapshot,
  type ProviderPricingSnapshot,
} from './providerPricingSnapshot.ts';
import type { ModelPricingInfo } from '../billing/newApiPricingService.ts';

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function readField(item: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (item[key] !== undefined) {
      return item[key];
    }
  }

  return undefined;
}

function resolveSharedPricingModelId(item: Record<string, unknown>): string {
  const candidates = [
    readField(item, 'model'),
    readField(item, 'modelId'),
    readField(item, 'id'),
    readField(item, 'model_name'),
    readField(item, 'modelName'),
    readField(item, 'name'),
  ];

  return candidates
    .map((value) => String(value || '').replace(/^models\//i, '').trim())
    .find(Boolean) || '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readTrimmedString(item: Record<string, unknown>, ...keys: string[]): string | undefined {
  const rawValue = readField(item, ...keys);
  const trimmed = String(rawValue ?? '').trim();
  return trimmed || undefined;
}

export function buildSharedPricingItemsFromRawCatalog(
  pricingData: unknown,
  groupRatioMap?: Record<string, number>,
  fallbackEndpointUrl?: string,
): ModelPricingInfo[] {
  const seen = new Set<string>();
  const rows: ModelPricingInfo[] = [];
  const defaultGroupRatio =
    (groupRatioMap && Object.values(groupRatioMap).find((value) => Number.isFinite(value)))
    || 1;

  for (const rawItem of Array.isArray(pricingData) ? pricingData : []) {
    const item = asRecord(rawItem);
    if (!item) {
      continue;
    }

    const modelId = resolveSharedPricingModelId(item);
    if (!modelId) {
      continue;
    }

    const cacheKey = modelId.toLowerCase();
    if (seen.has(cacheKey)) {
      continue;
    }
    seen.add(cacheKey);

    const perRequestPrice = toFiniteNumber(readField(item, 'per_request_price', 'perRequestPrice', 'price_per_image', 'pricePerImage'));
    const explicitInputPrice = toFiniteNumber(readField(item, 'input_price', 'inputPrice'));
    const modelPrice = toFiniteNumber(readField(item, 'model_price', 'modelPrice'));
    const completionPrice = toFiniteNumber(readField(item, 'output_price', 'outputPrice'));
    const completionRatio = toFiniteNumber(readField(item, 'completion_ratio', 'completionRatio'));
    const quotaType = String(readField(item, 'quota_type', 'quotaType', 'billing_type', 'billingType') ?? '').trim().toLowerCase();
    const isPerToken = !(quotaType === 'per_request' || perRequestPrice !== undefined);
    const inputPrice = perRequestPrice ?? explicitInputPrice ?? modelPrice ?? 0;
    const outputPrice = completionPrice ?? (
      isPerToken && inputPrice > 0 && completionRatio !== undefined
        ? inputPrice * completionRatio
        : 0
    );
    const groupRatio = toFiniteNumber(readField(item, 'group_ratio', 'groupRatio')) ?? defaultGroupRatio;
    const modelName = readTrimmedString(item, 'model_name', 'modelName') || modelId;
    const endpointUrl = readTrimmedString(item, 'endpoint_url', 'endpointUrl') || (
      fallbackEndpointUrl ? String(fallbackEndpointUrl).trim() || undefined : undefined
    );

    rows.push({
      modelId,
      modelName,
      inputPrice: Math.max(0, inputPrice),
      outputPrice: Math.max(0, outputPrice),
      isPerToken,
      groupRatio,
      currency: readTrimmedString(item, 'currency') || 'USD',
      billingUnit: readTrimmedString(item, 'billing_unit', 'pay_unit'),
      displayPrice: readTrimmedString(item, 'display_price'),
      supportsGroups: item.supports_groups === true || item.supportsGroups === true,
      endpointUrl,
      endpointPath: readTrimmedString(item, 'endpoint_path', 'endpointPath'),
    });
  }

  return rows;
}

export function buildPricingSnapshotFromSharedCache(pricing: ModelPricingInfo[]): ProviderPricingSnapshot | undefined {
  if (!Array.isArray(pricing) || pricing.length === 0) {
    return undefined;
  }

  return buildProviderPricingSnapshot(
    pricing.map((item) => ({
      model: item.modelId,
      model_name: item.modelName,
      quota_type: item.isPerToken ? 'tokens' : 'per_request',
      per_request_price: item.isPerToken ? undefined : item.inputPrice,
      model_price: item.isPerToken ? item.inputPrice : undefined,
      completion_ratio:
        item.isPerToken && item.inputPrice > 0 && item.outputPrice > 0
          ? item.outputPrice / item.inputPrice
          : undefined,
      currency: item.currency,
      billing_unit: item.billingUnit,
      display_price: item.displayPrice,
      endpoint_url: item.endpointUrl,
      endpoint_path: item.endpointPath,
      group_ratio: item.groupRatio,
    })),
    undefined,
    {
      fetchedAt: Date.now(),
      note: 'Loaded from shared provider pricing cache',
    },
  );
}
