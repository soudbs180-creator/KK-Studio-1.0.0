import type {
  AdminCreditProviderDto,
  AdminCreditProviderModelDto,
  SaveAdminCreditProviderRequestDto,
} from '../../../../../packages/contracts/src/index.ts';

export interface ProviderEditorState {
  id: string;
  providerName: string;
  baseUrl: string;
  retainApiKeyFingerprints: string[];
  models: AdminCreditProviderModelDto[];
}

function toSaveModel(model: AdminCreditProviderModelDto): SaveAdminCreditProviderRequestDto['models'][number] {
  return {
    modelId: model.modelId,
    displayName: model.displayName,
    description: model.description,
    endpointType: model.endpointType,
    creditCost: model.creditCost,
    advancedEnabled: model.advancedEnabled,
    mixWithSameModel: model.mixWithSameModel,
    qualityPricing: model.qualityPricing || {},
    priority: 0,
    weight: 0,
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
    retainApiKeyFingerprints: (input.apiKeyEntries || []).map((entry: { fingerprint: string }) => entry.fingerprint),
    models: input.models,
  };
}

export function buildSaveAdminCreditProviderPayload(
  provider: ProviderEditorState,
): SaveAdminCreditProviderRequestDto {
  return {
    providerName: provider.providerName,
    baseUrl: provider.baseUrl,
    apiKeys: [],
    retainApiKeyFingerprints: provider.retainApiKeyFingerprints,
    models: provider.models.map(toSaveModel),
  };
}
