import { createHash } from "node:crypto";

import type {
  ActiveCreditModelDto,
  ActiveCreditModelProviderDto,
  AdminCreditProviderDto,
  ProviderPricingCacheDto,
  ProviderPricingCacheItemDto,
  SaveAdminCreditProviderRequestDto,
  UpsertProviderPricingCacheRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { buildSharedPricingCacheProviderId } from "./provider-pricing-cache-key.ts";

interface StoredCreditProviderModelRecord {
  recordId?: string;
  modelId: string;
  displayName: string;
  description?: string;
  endpointType: string;
  creditCost: number;
  isActive: boolean;
  callCount: number;
  maxCallsLimit?: number | null;
  color?: string;
  colorSecondary?: string;
  textColor?: "white" | "black";
  advancedEnabled: boolean;
  mixWithSameModel: boolean;
  qualityPricing?: Record<string, { enabled: boolean; creditCost: number }>;
  priority: number;
  weight: number;
}

interface StoredCreditProviderRecord {
  providerId: string;
  providerName: string;
  baseUrl: string;
  apiKeys: string[];
  models: StoredCreditProviderModelRecord[];
}

export interface ActiveCreditModelRuntimeRoute {
  providerId: string;
  providerName: string;
  baseUrl: string;
  apiKeys: string[];
  modelId: string;
  displayName: string;
  endpointType: string;
  creditCost: number;
  priority: number;
  weight: number;
  callCount: number;
  advancedEnabled: boolean;
  mixWithSameModel: boolean;
  qualityPricing?: Record<string, { enabled: boolean; creditCost: number }>;
}

interface StoredProviderPricingCacheRecord {
  providerId: string;
  pricing: ProviderPricingCacheItemDto[];
  cachedAt?: string | null;
}

export interface SavedCreditProviderRecord {
  providerId: string;
  providerName: string;
  apiKeyCount: number;
  modelCount: number;
}

export interface CreditProviderRepository {
  listAdminProviders(): Promise<AdminCreditProviderDto[]>;
  listActiveCreditModels(): Promise<ActiveCreditModelProviderDto[]>;
  listActiveRuntimeRoutes(modelId?: string): Promise<ActiveCreditModelRuntimeRoute[]>;
  saveAdminProvider(
    providerId: string,
    input: SaveAdminCreditProviderRequestDto,
  ): Promise<SavedCreditProviderRecord>;
  getProviderPricingCache(providerId: string): Promise<ProviderPricingCacheDto | null>;
  saveProviderPricingCache(
    providerId: string,
    input: UpsertProviderPricingCacheRequestDto,
  ): Promise<ProviderPricingCacheDto>;
  getSharedProviderPricingCache(baseUrl: string): Promise<ProviderPricingCacheDto | null>;
  saveSharedProviderPricingCache(
    baseUrl: string,
    input: UpsertProviderPricingCacheRequestDto,
  ): Promise<ProviderPricingCacheDto>;
  deleteAdminProvider(providerId: string): Promise<boolean>;
}

function cloneQualityPricing(
  value: StoredCreditProviderModelRecord["qualityPricing"],
): StoredCreditProviderModelRecord["qualityPricing"] {
  return value
    ? Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          {
            enabled: item.enabled !== false,
            creditCost: Number(item.creditCost || 1),
          },
        ]),
      )
    : undefined;
}

function buildApiKeyPreview(value: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}...${normalized.slice(-2)}`;
  }

  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function buildApiKeyFingerprint(value: string): string {
  return createHash("sha256")
    .update(String(value || "").trim(), "utf8")
    .digest("hex")
    .slice(0, 16);
}

function normalizeUniqueApiKeys(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function clonePricingCacheItems(items: ProviderPricingCacheItemDto[]): ProviderPricingCacheItemDto[] {
  return items.map((item) => ({
    ...item,
  }));
}

function cloneStoredPricingCache(
  record: StoredProviderPricingCacheRecord,
): StoredProviderPricingCacheRecord {
  return {
    providerId: record.providerId,
    pricing: clonePricingCacheItems(record.pricing),
    cachedAt: record.cachedAt ?? null,
  };
}

function toAdminModelDto(
  model: StoredCreditProviderModelRecord,
): AdminCreditProviderDto["models"][number] {
  return {
    modelId: model.modelId,
    displayName: model.displayName,
    description: model.description,
    endpointType: model.endpointType,
    creditCost: model.creditCost,
    priority: model.priority,
    weight: model.weight,
    isActive: model.isActive,
    callCount: model.callCount,
    maxCallsLimit: model.maxCallsLimit ?? null,
    color: model.color,
    colorSecondary: model.colorSecondary,
    textColor: model.textColor,
    advancedEnabled: model.advancedEnabled,
    mixWithSameModel: model.mixWithSameModel,
    qualityPricing: cloneQualityPricing(model.qualityPricing),
  };
}

function toActiveModelDto(
  model: StoredCreditProviderModelRecord,
): ActiveCreditModelDto {
  return {
    recordId: model.recordId,
    modelId: model.modelId,
    displayName: model.displayName,
    description: model.description,
    endpointType: model.endpointType,
    creditCost: model.creditCost,
    priority: model.priority,
    weight: model.weight,
    callCount: model.callCount,
    color: model.color,
    colorSecondary: model.colorSecondary,
    textColor: model.textColor,
    advancedEnabled: model.advancedEnabled,
    mixWithSameModel: model.mixWithSameModel,
    qualityPricing: cloneQualityPricing(model.qualityPricing),
  };
}

function buildSeedProviders(): StoredCreditProviderRecord[] {
  // Keep the in-memory fallback empty so only explicitly configured
  // and enabled admin credit models surface in the runtime model list.
  return [];
}

export class InMemoryCreditProviderRepository implements CreditProviderRepository {
  private readonly providers = new Map<string, StoredCreditProviderRecord>();
  private readonly pricingCache = new Map<string, StoredProviderPricingCacheRecord>();

  constructor(seedProviders = buildSeedProviders()) {
    seedProviders.forEach((provider) => {
      this.providers.set(provider.providerId, this.cloneStoredProvider(provider));
    });
  }

  async listAdminProviders(): Promise<AdminCreditProviderDto[]> {
    return Array.from(this.providers.values()).map((provider) => ({
      providerId: provider.providerId,
      providerName: provider.providerName,
      baseUrl: provider.baseUrl,
      apiKeyCount: provider.apiKeys.filter((item) => item.trim()).length,
      apiKeyEntries: provider.apiKeys
        .filter((item) => item.trim())
        .map((item) => ({
          fingerprint: buildApiKeyFingerprint(item),
          preview: buildApiKeyPreview(item),
        })),
      apiKeyPreviews: provider.apiKeys
        .filter((item) => item.trim())
        .map((item) => buildApiKeyPreview(item)),
      models: provider.models.map((model) => toAdminModelDto(model)),
    }));
  }

  async listActiveCreditModels(): Promise<ActiveCreditModelProviderDto[]> {
    return Array.from(this.providers.values())
      .map((provider) => ({
        providerId: provider.providerId,
        providerName: provider.providerName,
        models: provider.models
          .filter((model) => model.isActive)
          .map((model) => toActiveModelDto(model)),
      }))
      .filter((provider) => provider.models.length > 0);
  }

  async listActiveRuntimeRoutes(modelId?: string): Promise<ActiveCreditModelRuntimeRoute[]> {
    const normalizedModelId = String(modelId || "").trim();
    return Array.from(this.providers.values()).flatMap((provider) =>
      provider.models
        .filter((model) => model.isActive)
        .filter((model) => !normalizedModelId || model.modelId === normalizedModelId)
        .map((model) => ({
          providerId: provider.providerId,
          providerName: provider.providerName,
          baseUrl: provider.baseUrl,
          apiKeys: [...provider.apiKeys],
          modelId: model.modelId,
          displayName: model.displayName,
          endpointType: model.endpointType,
          creditCost: model.creditCost,
          priority: model.priority,
          weight: model.weight,
          callCount: model.callCount,
          advancedEnabled: model.advancedEnabled,
          mixWithSameModel: model.mixWithSameModel,
          qualityPricing: cloneQualityPricing(model.qualityPricing),
        }))
    );
  }

  async saveAdminProvider(
    providerId: string,
    input: SaveAdminCreditProviderRequestDto,
  ): Promise<SavedCreditProviderRecord> {
    const existing = this.providers.get(providerId);
    const hasExplicitRetainList = Array.isArray(input.retainApiKeyFingerprints);
    const retainFingerprints = normalizeUniqueApiKeys(input.retainApiKeyFingerprints || []);
    const baseApiKeys = existing
      ? (
          hasExplicitRetainList
            ? existing.apiKeys.filter((value) => retainFingerprints.includes(buildApiKeyFingerprint(value)))
            : existing.apiKeys
        )
      : [];
    const nextApiKeys = input.apiKeys.length > 0
      ? normalizeUniqueApiKeys([...baseApiKeys, ...input.apiKeys])
      : baseApiKeys;
    const nextProvider: StoredCreditProviderRecord = {
      providerId,
      providerName: input.providerName,
      baseUrl: input.baseUrl,
      apiKeys: [...nextApiKeys],
      models: input.models.map((model, index) => ({
        recordId: `${providerId}:${model.modelId}:${index}`,
        modelId: model.modelId,
        displayName: model.displayName,
        description: model.description,
        endpointType: model.endpointType,
        creditCost: model.creditCost,
        isActive: model.isActive,
        callCount: existing?.models.find((item) => item.modelId === model.modelId)?.callCount || 0,
        maxCallsLimit: model.maxCallsLimit ?? null,
        color: model.color,
        colorSecondary: model.colorSecondary || undefined,
        textColor: model.textColor,
        advancedEnabled: model.advancedEnabled,
        mixWithSameModel: model.mixWithSameModel,
        qualityPricing: cloneQualityPricing(model.qualityPricing),
        priority: model.priority,
        weight: model.weight,
      })),
    };

    this.providers.set(providerId, this.cloneStoredProvider(nextProvider));

    return {
      providerId,
      providerName: nextProvider.providerName,
      apiKeyCount: nextProvider.apiKeys.length,
      modelCount: nextProvider.models.length,
    };
  }

  async getProviderPricingCache(providerId: string): Promise<ProviderPricingCacheDto | null> {
    const cached = this.pricingCache.get(providerId);
    if (!cached) {
      return null;
    }

    const cloned = cloneStoredPricingCache(cached);
    return {
      providerId: cloned.providerId,
      pricing: cloned.pricing,
      cachedAt: cloned.cachedAt ?? null,
    };
  }

  async saveProviderPricingCache(
    providerId: string,
    input: UpsertProviderPricingCacheRequestDto,
  ): Promise<ProviderPricingCacheDto> {
    const nextRecord: StoredProviderPricingCacheRecord = {
      providerId,
      pricing: clonePricingCacheItems(input.pricing),
      cachedAt: new Date().toISOString(),
    };

    this.pricingCache.set(providerId, cloneStoredPricingCache(nextRecord));

    return {
      providerId,
      pricing: clonePricingCacheItems(nextRecord.pricing),
      cachedAt: nextRecord.cachedAt ?? null,
    };
  }

  async getSharedProviderPricingCache(baseUrl: string): Promise<ProviderPricingCacheDto | null> {
    const providerId = buildSharedPricingCacheProviderId(baseUrl);
    if (!providerId) {
      return null;
    }

    return this.getProviderPricingCache(providerId);
  }

  async saveSharedProviderPricingCache(
    baseUrl: string,
    input: UpsertProviderPricingCacheRequestDto,
  ): Promise<ProviderPricingCacheDto> {
    const providerId = buildSharedPricingCacheProviderId(baseUrl);
    if (!providerId) {
      throw new Error("baseUrl is required before saving shared pricing cache.");
    }

    return this.saveProviderPricingCache(providerId, input);
  }

  async deleteAdminProvider(providerId: string): Promise<boolean> {
    this.pricingCache.delete(providerId);
    return this.providers.delete(providerId);
  }

  private cloneStoredProvider(provider: StoredCreditProviderRecord): StoredCreditProviderRecord {
    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      baseUrl: provider.baseUrl,
      apiKeys: [...provider.apiKeys],
      models: provider.models.map((model) => ({
        ...model,
        qualityPricing: cloneQualityPricing(model.qualityPricing),
      })),
    };
  }
}
