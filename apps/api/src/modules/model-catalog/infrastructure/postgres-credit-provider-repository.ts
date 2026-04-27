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
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import {
  type ActiveCreditModelRuntimeRoute,
  InMemoryCreditProviderRepository,
  type CreditProviderRepository,
  type SavedCreditProviderRecord,
} from "./in-memory-credit-provider-repository.ts";
import { buildSharedPricingCacheProviderId } from "./provider-pricing-cache-key.ts";

interface CreditProviderTableRow {
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
  max_calls_limit?: number | null;
  color?: string | null;
  color_secondary?: string | null;
  text_color?: string | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, { enabled: boolean; creditCost: number }> | null;
  visibility?: string | null;
}

interface ProviderPricingCacheRow {
  provider_id?: string | null;
  pricing_json?: ProviderPricingCacheItemDto[] | null;
  cached_at?: string | null;
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

function normalizeApiKeys(apiKeys: string[] | null | undefined): string[] {
  return Array.isArray(apiKeys)
    ? apiKeys.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
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

function compareProviderTableRows(left: CreditProviderTableRow, right: CreditProviderTableRow): number {
  const leftPriority = Number(left.priority ?? Number.MIN_SAFE_INTEGER);
  const rightPriority = Number(right.priority ?? Number.MIN_SAFE_INTEGER);
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }
  return String(left.model_id || "").localeCompare(String(right.model_id || ""));
}

function toAdminModelDto(row: CreditProviderTableRow): AdminCreditProviderDto["models"][number] {
  return {
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
  };
}

function toActiveModelDto(row: CreditProviderTableRow): ActiveCreditModelDto {
  return {
    modelId: String(row.model_id || "").trim(),
    displayName: String(row.display_name || row.model_id || "").trim(),
    description: row.description || undefined,
    endpointType: String(row.endpoint_type || "openai").trim(),
    creditCost: Math.max(1, Number(row.credit_cost || 1)),
    priority: Number(row.priority || 0),
    weight: Number(row.weight || 0),
    callCount: Number(row.call_count || 0),
    color: row.color || undefined,
    colorSecondary: row.color_secondary || undefined,
    textColor: row.text_color === "black" ? "black" : "white",
    advancedEnabled: Boolean(row.advanced_enabled),
    mixWithSameModel: Boolean(row.mix_with_same_model),
    qualityPricing: cloneQualityPricing(row.quality_pricing),
  };
}

function toAdminProviderDtoFromRows(rows: CreditProviderTableRow[]): AdminCreditProviderDto | undefined {
  const sortedRows = [...rows].sort(compareProviderTableRows);
  const first = sortedRows[0];
  const providerId = String(first?.provider_id || "").trim();
  if (!providerId) {
    return undefined;
  }

  const apiKeys = sortedRows
    .map((row) => normalizeApiKeys(row.api_keys))
    .find((keys) => keys.length > 0) || [];

  return {
    providerId,
    providerName: String(first?.provider_name || providerId).trim(),
    baseUrl: String(first?.base_url || "").trim(),
    apiKeyCount: apiKeys.length,
    apiKeyEntries: apiKeys.map((value) => ({
      fingerprint: buildApiKeyFingerprint(value),
      preview: buildApiKeyPreview(value),
    })),
    apiKeyPreviews: apiKeys.map((value) => buildApiKeyPreview(value)),
    models: sortedRows.map((row) => toAdminModelDto(row)),
  };
}

function toProviderPricingCacheDto(row: ProviderPricingCacheRow): ProviderPricingCacheDto {
  return {
    providerId: String(row.provider_id || "").trim(),
    pricing: Array.isArray(row.pricing_json) ? row.pricing_json.map((item) => ({ ...item })) : [],
    cachedAt: row.cached_at || null,
  };
}

export class PostgresCreditProviderRepository implements CreditProviderRepository {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async listAdminProviders(): Promise<AdminCreditProviderDto[]> {
    const result = await this.queryable.query(
      `select provider_id, provider_name, base_url, api_keys, model_id, display_name, description,
              endpoint_type, credit_cost, priority, weight, is_active, call_count, max_calls_limit,
              color, color_secondary, text_color, advanced_enabled, mix_with_same_model, quality_pricing, visibility
         from admin_credit_models
        order by provider_id asc, priority desc, model_id asc`,
    );
    const rows = Array.isArray(result.rows) ? (result.rows as CreditProviderTableRow[]) : [];
    const grouped = new Map<string, CreditProviderTableRow[]>();
    rows.forEach((row) => {
      const providerId = String(row.provider_id || "").trim();
      if (!providerId) return;
      const bucket = grouped.get(providerId);
      if (bucket) bucket.push(row);
      else grouped.set(providerId, [row]);
    });
    return Array.from(grouped.values())
      .map((providerRows) => toAdminProviderDtoFromRows(providerRows))
      .filter((item): item is AdminCreditProviderDto => Boolean(item));
  }

  async listActiveCreditModels(): Promise<ActiveCreditModelProviderDto[]> {
    const result = await this.queryable.query(
      `select provider_id, provider_name, model_id, display_name, description,
              endpoint_type, credit_cost, priority, weight, is_active, call_count,
              color, color_secondary, text_color, advanced_enabled, mix_with_same_model, quality_pricing
         from admin_credit_models
        where is_active = true
        order by provider_id asc, priority desc, model_id asc`,
    );
    const rows = Array.isArray(result.rows) ? (result.rows as CreditProviderTableRow[]) : [];
    const grouped = new Map<string, CreditProviderTableRow[]>();
    rows.forEach((row) => {
      const providerId = String(row.provider_id || "").trim();
      if (!providerId) return;
      const bucket = grouped.get(providerId);
      if (bucket) bucket.push(row);
      else grouped.set(providerId, [row]);
    });
    return Array.from(grouped.entries()).map(([providerId, providerRows]) => ({
      providerId,
      providerName: String(providerRows[0]?.provider_name || providerId).trim(),
      models: providerRows.map((row) => toActiveModelDto(row)),
    }));
  }

  async listActiveRuntimeRoutes(modelId?: string): Promise<ActiveCreditModelRuntimeRoute[]> {
    const normalizedModelId = String(modelId || "").trim();
    const values: unknown[] = [];
    let modelFilterSql = "";
    if (normalizedModelId) {
      values.push(normalizedModelId);
      modelFilterSql = ` and model_id = $${values.length}`;
    }

    const result = await this.queryable.query(
      `select provider_id, provider_name, base_url, api_keys, model_id, display_name,
              endpoint_type, credit_cost, priority, weight, call_count,
              advanced_enabled, mix_with_same_model, quality_pricing
         from admin_credit_models
        where is_active = true${modelFilterSql}
        order by priority desc, weight desc, provider_id asc, model_id asc`,
      values,
    );
    const rows = Array.isArray(result.rows) ? (result.rows as CreditProviderTableRow[]) : [];
    const routes: ActiveCreditModelRuntimeRoute[] = [];

    rows.forEach((row) => {
      const providerId = String(row.provider_id || "").trim();
      const resolvedModelId = String(row.model_id || "").trim();
      if (!providerId || !resolvedModelId) {
        return;
      }

      routes.push({
        providerId,
        providerName: String(row.provider_name || providerId).trim(),
        baseUrl: String(row.base_url || "").trim(),
        apiKeys: normalizeApiKeys(row.api_keys),
        modelId: resolvedModelId,
        displayName: String(row.display_name || resolvedModelId).trim(),
        endpointType: String(row.endpoint_type || "openai").trim(),
        creditCost: Math.max(1, Number(row.credit_cost || 1)),
        priority: Number(row.priority || 0),
        weight: Number(row.weight || 0),
        callCount: Number(row.call_count || 0),
        advancedEnabled: Boolean(row.advanced_enabled),
        mixWithSameModel: Boolean(row.mix_with_same_model),
        qualityPricing: cloneQualityPricing(row.quality_pricing),
      });
    });

    return routes;
  }

  async saveAdminProvider(
    providerId: string,
    input: SaveAdminCreditProviderRequestDto,
  ): Promise<SavedCreditProviderRecord> {
    const existingResult = await this.queryable.query(
      `select api_keys
         from admin_credit_models
        where provider_id = $1`,
      [providerId],
    );
    const existingRows = Array.isArray(existingResult.rows) ? (existingResult.rows as CreditProviderTableRow[]) : [];
    const existingApiKeys = existingRows
      .map((row) => normalizeApiKeys(row.api_keys))
      .find((keys) => keys.length > 0) || [];
    const retainFingerprints = normalizeUniqueApiKeys(input.retainApiKeyFingerprints || []);
    const retainedApiKeys = Array.isArray(input.retainApiKeyFingerprints)
      ? existingApiKeys.filter((value) => retainFingerprints.includes(buildApiKeyFingerprint(value)))
      : existingApiKeys;
    const nextApiKeys = input.apiKeys.length > 0
      ? normalizeUniqueApiKeys([...retainedApiKeys, ...input.apiKeys])
      : retainedApiKeys;

    await this.queryable.query(
      `delete from admin_credit_models
        where provider_id = $1`,
      [providerId],
    );

    for (const model of input.models) {
      await this.queryable.query(
        `insert into admin_credit_models (
           provider_id,
           provider_name,
           base_url,
           api_keys,
           model_id,
           display_name,
           description,
           endpoint_type,
           credit_cost,
           priority,
           weight,
           is_active,
           call_count,
           max_calls_limit,
           color,
           color_secondary,
           text_color,
           advanced_enabled,
           mix_with_same_model,
           quality_pricing,
           visibility
         ) values (
           $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb, $21
         )`,
        [
          providerId,
          input.providerName,
          input.baseUrl,
          JSON.stringify(nextApiKeys),
          model.modelId,
          model.displayName,
          model.description || "",
          model.endpointType,
          model.creditCost,
          model.priority,
          model.weight,
          model.isActive,
          0,
          model.maxCallsLimit ?? null,
          model.color,
          model.colorSecondary || null,
          model.textColor,
          model.advancedEnabled,
          model.mixWithSameModel,
          JSON.stringify(model.qualityPricing || null),
          "public",
        ],
      );
    }

    return {
      providerId,
      providerName: input.providerName,
      apiKeyCount: nextApiKeys.length,
      modelCount: input.models.length,
    };
  }

  async getProviderPricingCache(providerId: string): Promise<ProviderPricingCacheDto | null> {
    const result = await this.queryable.query(
      `select provider_id, pricing_json, cached_at
         from provider_pricing_cache
        where provider_id = $1
        limit 1`,
      [providerId],
    );
    const row = result.rows[0] as ProviderPricingCacheRow | undefined;
    return row ? toProviderPricingCacheDto(row) : null;
  }

  async saveProviderPricingCache(
    providerId: string,
    input: UpsertProviderPricingCacheRequestDto,
  ): Promise<ProviderPricingCacheDto> {
    const cachedAt = new Date().toISOString();
    const result = await this.queryable.query(
      `insert into provider_pricing_cache (
         provider_id,
         pricing_json,
         cached_at
       ) values (
         $1, $2::jsonb, $3
       )
       on conflict (provider_id) do update
         set pricing_json = excluded.pricing_json,
             cached_at = excluded.cached_at
       returning provider_id, pricing_json, cached_at`,
      [providerId, JSON.stringify(input.pricing || []), cachedAt],
    );
    const row = result.rows[0] as ProviderPricingCacheRow | undefined;
    return toProviderPricingCacheDto(row || {
      provider_id: providerId,
      pricing_json: input.pricing,
      cached_at: cachedAt,
    });
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
    const result = await this.queryable.query(
      `delete from admin_credit_models
        where provider_id = $1
      returning provider_id`,
      [providerId],
    );
    return Array.isArray(result.rows) && result.rows.length > 0;
  }
}

export function createCreditProviderRepositoryFromEnv(options: {
  createPostgresRepository?: () => CreditProviderRepository;
} = {}): CreditProviderRepository {
  if (!hasPostgresConfig()) {
    return new InMemoryCreditProviderRepository();
  }

  if (options.createPostgresRepository) {
    return options.createPostgresRepository();
  }

  return new PostgresCreditProviderRepository(getSharedPostgresPool());
}
