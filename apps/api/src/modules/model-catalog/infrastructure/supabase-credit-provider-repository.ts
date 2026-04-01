import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  ActiveCreditModelProviderDto,
  AdminCreditProviderDto,
  ProviderPricingCacheDto,
  ProviderPricingCacheItemDto,
  SaveAdminCreditProviderRequestDto,
  UpsertProviderPricingCacheRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type {
  CreditProviderRepository,
  SavedCreditProviderRecord,
} from "./in-memory-credit-provider-repository.ts";
import { buildSharedPricingCacheProviderId } from "./provider-pricing-cache-key.ts";

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

interface CreditProviderTableRow {
  id?: string | null;
  provider_id?: string | null;
  provider_name?: string | null;
  base_url?: string | null;
  api_keys?: string[] | null;
  model_id?: string | null;
  display_name?: string | null;
  description?: string | null;
  endpoint_type?: string | null;
  credit_cost?: number | null;
  priority?: number | null;
  weight?: number | null;
  is_active?: boolean | null;
  call_count?: number | null;
  total_credits_consumed?: number | null;
  max_calls_limit?: number | null;
  auto_pause_on_limit?: boolean | null;
  color?: string | null;
  color_secondary?: string | null;
  text_color?: string | null;
  gradient?: string | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, { enabled: boolean; creditCost: number }> | null;
  visibility?: string | null;
}

interface ProviderPricingCacheRow {
  provider_id?: string | null;
  pricing?: ProviderPricingCacheItemDto[] | null;
  cached_at?: string | null;
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

function normalizeApiKeys(apiKeys: string[] | null | undefined): string[] {
  return Array.isArray(apiKeys)
    ? apiKeys
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];
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

function filterApiKeysByFingerprints(apiKeys: string[], fingerprints: string[]): string[] {
  const allowed = new Set(fingerprints);
  return apiKeys.filter((value) => allowed.has(buildApiKeyFingerprint(value)));
}

function clonePricingCacheItems(items: ProviderPricingCacheItemDto[]): ProviderPricingCacheItemDto[] {
  return items.map((item) => ({
    ...item,
  }));
}

function toProviderPricingCacheDto(row: ProviderPricingCacheRow): ProviderPricingCacheDto {
  return {
    providerId: String(row.provider_id || "").trim(),
    pricing: Array.isArray(row.pricing) ? clonePricingCacheItems(row.pricing) : [],
    cachedAt: row.cached_at || null,
  };
}

function compareProviderTableRows(left: CreditProviderTableRow, right: CreditProviderTableRow): number {
  const leftPriority = Number(left.priority ?? Number.MIN_SAFE_INTEGER);
  const rightPriority = Number(right.priority ?? Number.MIN_SAFE_INTEGER);
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  const leftModelId = String(left.model_id || "").trim().toLowerCase();
  const rightModelId = String(right.model_id || "").trim().toLowerCase();
  return leftModelId.localeCompare(rightModelId);
}

function toAdminProviderDtoFromRows(rows: CreditProviderTableRow[]): AdminCreditProviderDto | undefined {
  const sortedRows = [...rows].sort(compareProviderTableRows);
  const first = sortedRows[0];
  const providerId = String(first?.provider_id || "").trim();
  if (!providerId) {
    return undefined;
  }

  const providerName = String(first?.provider_name || providerId).trim();
  const baseUrl = String(first?.base_url || "").trim();
  const apiKeys = sortedRows
    .map((row) => normalizeApiKeys(row.api_keys))
    .find((keys) => keys.length > 0) || [];

  return {
    providerId,
    providerName,
    baseUrl,
    apiKeyCount: apiKeys.length,
    apiKeyEntries: apiKeys.map((value) => ({
      fingerprint: buildApiKeyFingerprint(value),
      preview: buildApiKeyPreview(value),
    })),
    apiKeyPreviews: apiKeys.map((value) => buildApiKeyPreview(value)),
    models: sortedRows.map((row) => ({
      modelId: String(row.model_id || "").trim(),
      displayName: String(row.display_name || row.model_id || "").trim(),
      description: row.description || undefined,
      endpointType: String(row.endpoint_type || "openai").trim(),
      creditCost: Math.max(1, Number(row.credit_cost || 1)),
      isActive: row.is_active !== false,
      callCount: Number(row.call_count || 0),
      maxCallsLimit: row.max_calls_limit ?? null,
      color: row.color || undefined,
      colorSecondary: row.color_secondary || undefined,
      textColor: row.text_color === "black" ? "black" : "white",
      advancedEnabled: Boolean(row.advanced_enabled),
      mixWithSameModel: Boolean(row.mix_with_same_model),
      qualityPricing: cloneQualityPricing(row.quality_pricing),
    })),
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
    const { data, error } = await this.client
      .from("admin_credit_models")
      .select(
        [
          "id",
          "provider_id",
          "provider_name",
          "base_url",
          "api_keys",
          "model_id",
          "display_name",
          "description",
          "endpoint_type",
          "credit_cost",
          "priority",
          "weight",
          "is_active",
          "call_count",
          "max_calls_limit",
          "color",
          "color_secondary",
          "text_color",
          "advanced_enabled",
          "mix_with_same_model",
          "quality_pricing",
        ].join(", "),
      )
      .order("provider_id", { ascending: true })
      .order("priority", { ascending: false })
      .order("model_id", { ascending: true });

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? (data as CreditProviderTableRow[]) : [];
    const grouped = new Map<string, CreditProviderTableRow[]>();
    rows.forEach((row) => {
      const providerId = String(row.provider_id || "").trim();
      if (!providerId) {
        return;
      }

      const bucket = grouped.get(providerId);
      if (bucket) {
        bucket.push(row);
        return;
      }

      grouped.set(providerId, [row]);
    });

    return Array.from(grouped.values())
      .map((providerRows) => toAdminProviderDtoFromRows(providerRows))
      .filter((item): item is AdminCreditProviderDto => Boolean(item));
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
    const { data: existingData, error: existingError } = await this.client
      .from("admin_credit_models")
      .select(
        [
          "provider_id",
          "provider_name",
          "base_url",
          "api_keys",
          "model_id",
          "call_count",
          "total_credits_consumed",
          "gradient",
          "visibility",
        ].join(", "),
      )
      .eq("provider_id", providerId);

    if (existingError) {
      throw existingError;
    }

    const existingRows = Array.isArray(existingData) ? (existingData as CreditProviderTableRow[]) : [];
    const existingApiKeys = existingRows
      .map((row) => normalizeApiKeys(row.api_keys))
      .find((keys) => keys.length > 0) || [];
    const hasExplicitRetainList = Array.isArray(input.retainApiKeyFingerprints);
    const retainFingerprints = normalizeUniqueApiKeys(input.retainApiKeyFingerprints || []);
    const retainedApiKeys = hasExplicitRetainList
      ? filterApiKeysByFingerprints(existingApiKeys, retainFingerprints)
      : existingApiKeys;
    const nextApiKeys = normalizeApiKeys(input.apiKeys);
    const effectiveApiKeys = nextApiKeys.length > 0
      ? normalizeUniqueApiKeys([...retainedApiKeys, ...nextApiKeys])
      : retainedApiKeys;

    if (effectiveApiKeys.length === 0) {
      throw new Error("At least one provider key is required.");
    }

    const existingRowByModelId = new Map<string, CreditProviderTableRow>();
    existingRows.forEach((row) => {
      const modelId = String(row.model_id || "").trim();
      if (!modelId || existingRowByModelId.has(modelId)) {
        return;
      }

      existingRowByModelId.set(modelId, row);
    });

    const fallbackVisibility = String(existingRows[0]?.visibility || "").trim() || "public";

    const insertRows = input.models.map((model) => {
      const existingRow = existingRowByModelId.get(String(model.modelId || "").trim());

      return {
        provider_id: providerId,
        provider_name: input.providerName,
        base_url: input.baseUrl,
        api_keys: effectiveApiKeys,
        model_id: model.modelId,
        display_name: model.displayName,
        description: model.description || "",
        color: model.color,
        color_secondary: model.colorSecondary || null,
        text_color: model.textColor,
        gradient: existingRow?.gradient || "from-blue-500 to-indigo-600",
        endpoint_type: model.endpointType,
        credit_cost: model.creditCost,
        max_calls_limit: model.maxCallsLimit ?? null,
        auto_pause_on_limit: model.autoPauseOnLimit === true,
        priority: model.priority,
        weight: model.weight,
        is_active: model.isActive,
        call_count: Number(existingRow?.call_count || 0),
        total_credits_consumed: Number(existingRow?.total_credits_consumed || 0),
        advanced_enabled: model.advancedEnabled,
        mix_with_same_model: model.mixWithSameModel,
        quality_pricing: model.qualityPricing,
        visibility: String(existingRow?.visibility || "").trim() || fallbackVisibility,
      };
    });

    const { error: deleteError } = await this.client
      .from("admin_credit_models")
      .delete()
      .eq("provider_id", providerId);

    if (deleteError) {
      throw deleteError;
    }

    const { error } = await this.client
      .from("admin_credit_models")
      .insert(insertRows);

    if (error) {
      throw error;
    }

    return {
      providerId,
      providerName: input.providerName,
      apiKeyCount: effectiveApiKeys.length,
      modelCount: input.models.length,
    };
  }

  async getProviderPricingCache(providerId: string): Promise<ProviderPricingCacheDto | null> {
    const { data, error } = await this.client
      .from("provider_pricing_cache")
      .select("provider_id, pricing, cached_at")
      .eq("provider_id", providerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return toProviderPricingCacheDto(data as ProviderPricingCacheRow);
  }

  async saveProviderPricingCache(
    providerId: string,
    input: UpsertProviderPricingCacheRequestDto,
  ): Promise<ProviderPricingCacheDto> {
    const cachedAt = new Date().toISOString();
    const { data, error } = await this.client
      .from("provider_pricing_cache")
      .upsert({
        provider_id: providerId,
        pricing: clonePricingCacheItems(input.pricing),
        cached_at: cachedAt,
      }, {
        onConflict: "provider_id",
      })
      .select("provider_id, pricing, cached_at")
      .single();

    if (error) {
      throw error;
    }

    return toProviderPricingCacheDto((data || {
      provider_id: providerId,
      pricing: input.pricing,
      cached_at: cachedAt,
    }) as ProviderPricingCacheRow);
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
    const { data, error: lookupError } = await this.client
      .from("admin_credit_models")
      .select("id")
      .eq("provider_id", providerId)
      .limit(1);

    if (lookupError) {
      throw lookupError;
    }

    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }

    const { error } = await this.client
      .from("admin_credit_models")
      .delete()
      .eq("provider_id", providerId);

    if (error) {
      throw error;
    }

    return true;
  }
}
