import type {
  ActiveCreditModelDto,
  ActiveCreditModelProviderDto,
  AdminCreditProviderDto,
  SaveAdminCreditProviderRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";

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

export interface SavedCreditProviderRecord {
  providerId: string;
  providerName: string;
  apiKeyCount: number;
  modelCount: number;
}

export interface CreditProviderRepository {
  listAdminProviders(): Promise<AdminCreditProviderDto[]>;
  listActiveCreditModels(): Promise<ActiveCreditModelProviderDto[]>;
  saveAdminProvider(
    providerId: string,
    input: SaveAdminCreditProviderRequestDto,
  ): Promise<SavedCreditProviderRecord>;
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

function toAdminModelDto(
  model: StoredCreditProviderModelRecord,
): AdminCreditProviderDto["models"][number] {
  return {
    modelId: model.modelId,
    displayName: model.displayName,
    description: model.description,
    endpointType: model.endpointType,
    creditCost: model.creditCost,
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
  return [
    {
      providerId: "seed-provider",
      providerName: "Seed Provider",
      baseUrl: "https://api.seed-provider.local/v1",
      apiKeys: ["seed-key-1"],
      models: [
        {
          recordId: "seed-provider:gpt-image-1",
          modelId: "gpt-image-1",
          displayName: "GPT Image 1",
          description: "Seeded admin credit model for API migration tests.",
          endpointType: "openai",
          creditCost: 4,
          isActive: true,
          callCount: 0,
          maxCallsLimit: null,
          color: "#3B82F6",
          colorSecondary: "#1D4ED8",
          textColor: "white",
          advancedEnabled: false,
          mixWithSameModel: false,
          qualityPricing: {
            "1K": {
              enabled: true,
              creditCost: 4,
            },
          },
          priority: 10,
          weight: 1,
        },
      ],
    },
  ];
}

export class InMemoryCreditProviderRepository implements CreditProviderRepository {
  private readonly providers = new Map<string, StoredCreditProviderRecord>();

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

  async saveAdminProvider(
    providerId: string,
    input: SaveAdminCreditProviderRequestDto,
  ): Promise<SavedCreditProviderRecord> {
    const existing = this.providers.get(providerId);
    const nextApiKeys = input.apiKeys.length > 0
      ? input.apiKeys.filter((value) => value.trim())
      : existing?.apiKeys || [];
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

  async deleteAdminProvider(providerId: string): Promise<boolean> {
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
