import type {
  AdminCreditProviderDto,
  AdminCreditProviderModelDto,
  SaveAdminCreditProviderRequestDto,
} from '../../../../../packages/contracts/src/index.ts';

export type ProviderEditorModelState = AdminCreditProviderModelDto & {
  priority?: number;
  weight?: number;
};

export interface ProviderEditorState {
  id: string;
  providerName: string;
  baseUrl: string;
  apiKeyInput: string;
  retainApiKeyFingerprints: string[];
  models: ProviderEditorModelState[];
}

function buildQualityPricing(baseCreditCost: number): Record<string, { enabled: boolean; creditCost: number }> {
  return {
    '1K': { enabled: true, creditCost: baseCreditCost },
    '2K': { enabled: true, creditCost: baseCreditCost * 2 },
    '4K': { enabled: true, creditCost: baseCreditCost * 4 },
  };
}

function splitApiKeyInput(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      if (seen.has(item)) return;
      seen.add(item);
      result.push(item);
    });

  return result;
}

function toSaveModel(model: ProviderEditorModelState): SaveAdminCreditProviderRequestDto['models'][number] {
  return {
    modelId: model.modelId,
    displayName: model.displayName,
    description: model.description,
    endpointType: model.endpointType,
    creditCost: model.creditCost,
    advancedEnabled: model.advancedEnabled,
    mixWithSameModel: model.mixWithSameModel,
    qualityPricing: model.qualityPricing || {},
    priority: Number(model.priority ?? 0),
    weight: Number(model.weight ?? 0),
    isActive: model.isActive,
    color: model.color || '#111111',
    colorSecondary: null,
    textColor: model.textColor || 'white',
    maxCallsLimit: model.maxCallsLimit ?? null,
    autoPauseOnLimit: false,
  };
}

export function createProviderEditorState(input: AdminCreditProviderDto): ProviderEditorState {
  return {
    id: input.providerId,
    providerName: input.providerName,
    baseUrl: input.baseUrl,
    apiKeyInput: '',
    retainApiKeyFingerprints: (input.apiKeyEntries || []).map((entry: { fingerprint: string }) => entry.fingerprint),
    models: input.models.map((model) => ({ ...model })),
  };
}

export function createDefaultProviderEditorState(): ProviderEditorState {
  return {
    id: 'system-image-provider',
    providerName: 'System Image Provider',
    baseUrl: 'https://future-api.vodeshop.com',
    apiKeyInput: '',
    retainApiKeyFingerprints: [],
    models: [{
      modelId: 'gemini-3.1-flash-image-preview',
      displayName: 'Nano Banana 2',
      description: 'Default system credit image route for ecommerce generation.',
      endpointType: 'openai',
      creditCost: 12,
      priority: 100,
      weight: 100,
      isActive: true,
      callCount: 0,
      maxCallsLimit: null,
      color: '#16A34A',
      colorSecondary: '#0F766E',
      textColor: 'white',
      advancedEnabled: true,
      mixWithSameModel: false,
      qualityPricing: buildQualityPricing(12),
    }],
  };
}

export function buildSaveAdminCreditProviderPayload(
  provider: ProviderEditorState,
): SaveAdminCreditProviderRequestDto {
  return {
    providerName: provider.providerName,
    baseUrl: provider.baseUrl,
    apiKeys: splitApiKeyInput(provider.apiKeyInput),
    retainApiKeyFingerprints: provider.retainApiKeyFingerprints,
    models: provider.models.map(toSaveModel),
  };
}

export function hasProviderApiKeysForSave(provider: ProviderEditorState): boolean {
  return provider.retainApiKeyFingerprints.length > 0 || splitApiKeyInput(provider.apiKeyInput).length > 0;
}
