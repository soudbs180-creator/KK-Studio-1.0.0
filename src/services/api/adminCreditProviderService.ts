import type {
  ApiResponse,
  AdminCreditProviderDto,
  SaveAdminCreditProviderModelRequestDto,
} from '../../../packages/contracts/src/index';
import {
  deleteAdminCreditProviderViaSupabase,
  listAdminCreditProvidersViaSupabase,
  saveAdminCreditProviderViaSupabase,
} from '../admin/supabaseAdminFallbackService';
import { legacyWebApiClient } from './kkApiClient';
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
  models: SaveAdminCreditProviderModelInput[];
}

function mapAdminCreditProviderModel(
  model: AdminCreditProviderDto['models'][number],
): AdminCreditProviderRpcModel {
  return {
    model_id: model.modelId,
    display_name: model.displayName,
    description: model.description || null,
    endpoint_type: model.endpointType,
    credit_cost: model.creditCost,
    is_active: model.isActive,
    call_count: model.callCount,
    max_calls_limit: model.maxCallsLimit ?? null,
    color: model.color || null,
    color_secondary: model.colorSecondary || null,
    text_color: model.textColor || 'white',
    advanced_enabled: model.advancedEnabled,
    mix_with_same_model: model.mixWithSameModel,
    quality_pricing: model.qualityPricing || null,
  };
}

function mapAdminCreditProviderGroup(
  provider: AdminCreditProviderDto,
): AdminCreditProviderRpcGroup {
  return {
    provider_id: provider.providerId,
    provider_name: provider.providerName,
    base_url: provider.baseUrl,
    api_key_count: provider.apiKeyCount,
    models: provider.models.map((model) => mapAdminCreditProviderModel(model)),
  };
}

function mapSaveModelInput(
  model: SaveAdminCreditProviderModelInput,
): SaveAdminCreditProviderModelRequestDto {
  return {
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
  };
}

function unwrapOrThrow<T>(response: ApiResponse<T>, fallback: string): T {
  if (response.success) {
    return response.data;
  }

  throw new Error(response.error?.message || fallback);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

async function withSupabaseFallback<T>(
  legacyRequest: () => Promise<T>,
  supabaseRequest: () => Promise<T>,
  fallbackMessage: string,
): Promise<T> {
  try {
    return await legacyRequest();
  } catch (legacyError) {
    try {
      return await supabaseRequest();
    } catch (supabaseError) {
      throw new Error(
        getErrorMessage(
          supabaseError,
          getErrorMessage(legacyError, fallbackMessage),
        ),
      );
    }
  }
}

export async function listAdminCreditProviders(): Promise<AdminCreditProviderRpcGroup[]> {
  return withSupabaseFallback(
    async () => {
      const payload = unwrapOrThrow(
        await legacyWebApiClient.listAdminCreditProviders(),
        'Failed to load admin credit providers.',
      );

      return payload.items.map((provider) => mapAdminCreditProviderGroup(provider));
    },
    async () => {
      const rows = await listAdminCreditProvidersViaSupabase();
      return rows.map((row) => ({
        provider_id: row.provider_id || null,
        provider_name: row.provider_name || row.provider_id || null,
        base_url: row.base_url || null,
        api_key_count: row.api_key_count ?? 0,
        models: Array.isArray(row.models) ? row.models : [],
      }));
    },
    'Failed to load admin credit providers.',
  );
}

export async function saveAdminCreditProvider(input: SaveAdminCreditProviderInput): Promise<void> {
  await withSupabaseFallback(
    async () => {
      unwrapOrThrow(
        await legacyWebApiClient.saveAdminCreditProvider(input.providerId, {
          providerName: input.providerName,
          baseUrl: input.baseUrl,
          apiKeys: input.apiKeys,
          models: input.models.map((model) => mapSaveModelInput(model)),
        }),
        'Failed to save admin credit provider.',
      );
    },
    async () => {
      await saveAdminCreditProviderViaSupabase(input);
    },
    'Failed to save admin credit provider.',
  );

  await adminModelService.broadcastCatalogUpdate('save');
}

export async function deleteAdminCreditProvider(providerId: string): Promise<void> {
  await withSupabaseFallback(
    async () => {
      unwrapOrThrow(
        await legacyWebApiClient.deleteAdminCreditProvider(providerId),
        'Failed to delete admin credit provider.',
      );
    },
    async () => {
      await deleteAdminCreditProviderViaSupabase(providerId);
    },
    'Failed to delete admin credit provider.',
  );

  await adminModelService.broadcastCatalogUpdate('delete');
}
