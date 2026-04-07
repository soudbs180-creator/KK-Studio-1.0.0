import { kkWebApiClient } from './kkApiClient';
import { adminModelService } from '../model/adminModelService';

export interface AdminCreditProviderRpcModel {
  model_id?: string | null;
  display_name?: string | null;
  description?: string | null;
  endpoint_type?: string | null;
  credit_cost?: number | null;
  is_active?: boolean | null;
  call_count?: number | null;
  max_calls_limit?: number | null;
  color?: string | null;
  color_secondary?: string | null;
  text_color?: 'white' | 'black' | string | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, unknown> | null;
}

export interface AdminCreditProviderRpcGroup {
  provider_id?: string | null;
  provider_name?: string | null;
  base_url?: string | null;
  api_key_count?: number | null;
  api_key_entries?: Array<{ fingerprint?: string | null; preview?: string | null }> | null;
  api_key_previews?: string[] | null;
  models?: AdminCreditProviderRpcModel[] | null;
}

export interface SaveAdminCreditProviderModelInput {
  model_id: string;
  display_name: string;
  description: string;
  endpoint_type: string;
  credit_cost: number;
  advanced_enabled: boolean;
  mix_with_same_model: boolean;
  quality_pricing: Record<string, { enabled: boolean; creditCost: number }>;
  priority: number;
  weight: number;
  is_active: boolean;
  color: string;
  color_secondary: string | null;
  text_color: 'white' | 'black';
  max_calls_limit?: number | null;
  auto_pause_on_limit?: boolean;
}

export interface SaveAdminCreditProviderInput {
  providerId: string;
  providerName: string;
  baseUrl: string;
  apiKeys: string[];
  retainApiKeyFingerprints?: string[];
  models: SaveAdminCreditProviderModelInput[];
}

function normalizeAdminCreditProviderGroup(row: {
  providerId?: string | null;
  providerName?: string | null;
  baseUrl?: string | null;
  apiKeyCount?: number | null;
  apiKeyEntries?: Array<{ fingerprint?: string | null; preview?: string | null }> | null;
  apiKeyPreviews?: string[] | null;
  models?: Array<{
    modelId?: string | null;
    displayName?: string | null;
    description?: string | null;
    endpointType?: string | null;
    creditCost?: number | null;
    isActive?: boolean | null;
    callCount?: number | null;
    maxCallsLimit?: number | null;
    color?: string | null;
    colorSecondary?: string | null;
    textColor?: 'white' | 'black' | string | null;
    advancedEnabled?: boolean | null;
    mixWithSameModel?: boolean | null;
    qualityPricing?: Record<string, unknown> | null;
  }> | null;
}): AdminCreditProviderRpcGroup {
  return {
    provider_id: row.providerId || null,
    provider_name: row.providerName || row.providerId || null,
    base_url: row.baseUrl || null,
    api_key_count: row.apiKeyCount ?? 0,
    api_key_entries: Array.isArray(row.apiKeyEntries) ? row.apiKeyEntries : [],
    api_key_previews: Array.isArray(row.apiKeyPreviews) ? row.apiKeyPreviews : [],
    models: Array.isArray(row.models)
      ? row.models.map((model) => ({
          model_id: model.modelId || null,
          display_name: model.displayName || model.modelId || null,
          description: model.description || null,
          endpoint_type: model.endpointType || null,
          credit_cost: model.creditCost ?? null,
          is_active: model.isActive !== false,
          call_count: model.callCount ?? null,
          max_calls_limit: model.maxCallsLimit ?? null,
          color: model.color || null,
          color_secondary: model.colorSecondary || null,
          text_color: model.textColor || null,
          advanced_enabled: model.advancedEnabled === true,
          mix_with_same_model: model.mixWithSameModel === true,
          quality_pricing: model.qualityPricing ?? null,
        }))
      : [],
  };
}

export async function listAdminCreditProviders(): Promise<AdminCreditProviderRpcGroup[]> {
  const response = await kkWebApiClient.listAdminCreditProviders();
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to load admin credit providers.');
  }

  return (response.data.items || []).map((row) => normalizeAdminCreditProviderGroup(row));
}

export async function saveAdminCreditProvider(input: SaveAdminCreditProviderInput): Promise<void> {
  const response = await kkWebApiClient.saveAdminCreditProvider(input.providerId, {
    providerName: input.providerName,
    baseUrl: input.baseUrl,
    apiKeys: input.apiKeys,
    retainApiKeyFingerprints: input.retainApiKeyFingerprints,
    models: input.models.map((model) => ({
      modelId: model.model_id,
      displayName: model.display_name,
      description: model.description,
      endpointType: model.endpoint_type,
      creditCost: model.credit_cost,
      advancedEnabled: model.advanced_enabled,
      mixWithSameModel: model.mix_with_same_model,
      qualityPricing: model.quality_pricing,
      priority: model.priority,
      weight: model.weight,
      isActive: model.is_active,
      color: model.color,
      colorSecondary: model.color_secondary,
      textColor: model.text_color,
      maxCallsLimit: model.max_calls_limit ?? null,
      autoPauseOnLimit: model.auto_pause_on_limit === true,
    })),
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to save admin credit provider.');
  }

  await adminModelService.broadcastCatalogUpdate('save');
}

export async function deleteAdminCreditProvider(providerId: string): Promise<void> {
  const response = await kkWebApiClient.deleteAdminCreditProvider(providerId);
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to delete admin credit provider.');
  }

  await adminModelService.broadcastCatalogUpdate('delete');
}
