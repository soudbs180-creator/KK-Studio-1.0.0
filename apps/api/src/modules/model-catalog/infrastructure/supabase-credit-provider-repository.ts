import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  ActiveCreditModelProviderDto,
  AdminCreditProviderDto,
  SaveAdminCreditProviderRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type {
  CreditProviderRepository,
  SavedCreditProviderRecord,
} from "./in-memory-credit-provider-repository.ts";

interface RpcAdminCreditProviderModelRow {
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
  text_color?: string | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, { enabled: boolean; creditCost: number }> | null;
}

interface RpcAdminCreditProviderRow {
  provider_id?: string | null;
  provider_name?: string | null;
  base_url?: string | null;
  api_keys?: string[] | null;
  models?: RpcAdminCreditProviderModelRow[] | null;
}

interface RpcActiveCreditModelRow {
  id?: string | null;
  model_id?: string | null;
  display_name?: string | null;
  description?: string | null;
  endpoint_type?: string | null;
  credit_cost?: number | null;
  priority?: number | null;
  weight?: number | null;
  call_count?: number | null;
  color?: string | null;
  color_secondary?: string | null;
  text_color?: string | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, { enabled: boolean; creditCost: number }> | null;
}

interface RpcActiveCreditProviderRow {
  provider_id?: string | null;
  provider_name?: string | null;
  models?: RpcActiveCreditModelRow[] | null;
}

export interface SupabaseCreditProviderRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
}

function cloneQualityPricing(
  value: Record<string, { enabled: boolean; creditCost: number }> | null | undefined,
): Record<string, { enabled: boolean; creditCost: number }> | undefined {
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

function toAdminProviderDto(row: RpcAdminCreditProviderRow): AdminCreditProviderDto {
  return {
    providerId: String(row.provider_id || "").trim(),
    providerName: String(row.provider_name || row.provider_id || "").trim(),
    baseUrl: String(row.base_url || "").trim(),
    apiKeyCount: Array.isArray(row.api_keys)
      ? row.api_keys.filter((item) => typeof item === "string" && item.trim()).length
      : 0,
    models: Array.isArray(row.models)
      ? row.models.map((model) => ({
          modelId: String(model.model_id || "").trim(),
          displayName: String(model.display_name || model.model_id || "").trim(),
          description: model.description || undefined,
          endpointType: String(model.endpoint_type || "openai").trim(),
          creditCost: Math.max(1, Number(model.credit_cost || 1)),
          isActive: model.is_active !== false,
          callCount: Number(model.call_count || 0),
          maxCallsLimit: model.max_calls_limit ?? null,
          color: model.color || undefined,
          colorSecondary: model.color_secondary || undefined,
          textColor: model.text_color === "black" ? "black" : "white",
          advancedEnabled: Boolean(model.advanced_enabled),
          mixWithSameModel: Boolean(model.mix_with_same_model),
          qualityPricing: cloneQualityPricing(model.quality_pricing),
        }))
      : [],
  };
}

function toActiveProviderDto(row: RpcActiveCreditProviderRow): ActiveCreditModelProviderDto {
  return {
    providerId: String(row.provider_id || "").trim(),
    providerName: String(row.provider_name || row.provider_id || "").trim(),
    models: Array.isArray(row.models)
      ? row.models.map((model) => ({
          recordId: model.id ? String(model.id).trim() : undefined,
          modelId: String(model.model_id || "").trim(),
          displayName: String(model.display_name || model.model_id || "").trim(),
          description: model.description || undefined,
          endpointType: String(model.endpoint_type || "openai").trim(),
          creditCost: Math.max(1, Number(model.credit_cost || 1)),
          priority: Number(model.priority || 0),
          weight: Number(model.weight || 0),
          callCount: Number(model.call_count || 0),
          color: model.color || undefined,
          colorSecondary: model.color_secondary || undefined,
          textColor: model.text_color === "black" ? "black" : "white",
          advancedEnabled: Boolean(model.advanced_enabled),
          mixWithSameModel: Boolean(model.mix_with_same_model),
          qualityPricing: cloneQualityPricing(model.quality_pricing),
        }))
      : [],
  };
}

export class SupabaseCreditProviderRepository implements CreditProviderRepository {
  private readonly client: SupabaseClient;

  constructor(options: SupabaseCreditProviderRepositoryOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async listAdminProviders(): Promise<AdminCreditProviderDto[]> {
    const { data, error } = await this.client.rpc("get_admin_credit_models_full");
    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? (data as RpcAdminCreditProviderRow[]) : [];
    return rows.map((row) => toAdminProviderDto(row));
  }

  async listActiveCreditModels(): Promise<ActiveCreditModelProviderDto[]> {
    const { data, error } = await this.client.rpc("get_active_credit_models");
    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? (data as RpcActiveCreditProviderRow[]) : [];
    return rows.map((row) => toActiveProviderDto(row));
  }

  async saveAdminProvider(
    providerId: string,
    input: SaveAdminCreditProviderRequestDto,
  ): Promise<SavedCreditProviderRecord> {
    const { error } = await this.client.rpc("save_credit_provider", {
      p_provider_id: providerId,
      p_provider_name: input.providerName,
      p_base_url: input.baseUrl,
      p_api_keys: input.apiKeys,
      p_models: input.models.map((model) => ({
        model_id: model.modelId,
        display_name: model.displayName,
        description: model.description || "",
        endpoint_type: model.endpointType,
        credit_cost: model.creditCost,
        advanced_enabled: model.advancedEnabled,
        mix_with_same_model: model.mixWithSameModel,
        quality_pricing: model.qualityPricing,
        priority: model.priority,
        weight: model.weight,
        is_active: model.isActive,
        color: model.color,
        color_secondary: model.colorSecondary || null,
        text_color: model.textColor,
        max_calls_limit: model.maxCallsLimit ?? null,
        auto_pause_on_limit: model.autoPauseOnLimit === true,
      })),
    });

    if (error) {
      throw error;
    }

    const currentProviders = await this.listAdminProviders();
    const current = currentProviders.find((item) => item.providerId === providerId);

    return {
      providerId,
      providerName: current?.providerName || input.providerName,
      apiKeyCount: current?.apiKeyCount ?? input.apiKeys.filter((item) => item.trim()).length,
      modelCount: current?.models.length ?? input.models.length,
    };
  }

  async deleteAdminProvider(providerId: string): Promise<boolean> {
    const before = await this.listAdminProviders();
    const existed = before.some((provider) => provider.providerId === providerId);
    if (!existed) {
      return false;
    }

    const { error } = await this.client.rpc("delete_credit_provider", {
      p_provider_id: providerId,
    });

    if (error) {
      throw error;
    }

    return true;
  }
}
