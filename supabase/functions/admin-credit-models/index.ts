import {
  createSupabaseFunctionClients,
  requireAdminUser,
  requireAuthenticatedUser,
  requireElevatedAdminSession,
} from '../_shared/auth.ts';
import { corsHeaders, errorResponse, HttpError, jsonResponse } from '../_shared/http.ts';

type JsonRecord = Record<string, unknown>;

type AdminCreditProviderRpcModel = {
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
  quality_pricing?: Record<string, unknown> | null;
};

type AdminCreditProviderRpcGroup = {
  provider_id?: string | null;
  provider_name?: string | null;
  base_url?: string | null;
  api_keys?: string[] | null;
  models?: AdminCreditProviderRpcModel[] | null;
};

type ActiveCreditProviderRpcGroup = {
  provider_id?: string | null;
  provider_name?: string | null;
  models?: AdminCreditProviderRpcModel[] | null;
};

type SaveAdminCreditProviderModelInput = {
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
};

type SaveAdminCreditProviderInput = {
  providerId: string;
  providerName: string;
  baseUrl: string;
  apiKeys: string[];
  retainApiKeyFingerprints?: string[];
  models: SaveAdminCreditProviderModelInput[];
};

type RequestPayload =
  | {
      action: 'list-active';
    }
  | {
      action: 'list-admin';
    }
  | {
      action: 'save';
      input?: SaveAdminCreditProviderInput;
    }
  | {
      action: 'delete';
      providerId?: string;
    };

type SupabaseRpcClient = ReturnType<typeof createSupabaseFunctionClients>['userClient'];
type SupabaseServiceClient = ReturnType<typeof createSupabaseFunctionClients>['serviceClient'];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

function normalizeString(value: unknown): string {
  return String(value || '').trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function buildSyntheticApiKeyFingerprint(preview: string, index: number): string {
  return `preview:${index}:${preview}`;
}

function normalizeAdminProviderRow(row: AdminCreditProviderRpcGroup) {
  const apiKeyPreviews = normalizeStringArray(row.api_keys);

  return {
    provider_id: normalizeString(row.provider_id) || null,
    provider_name: normalizeString(row.provider_name || row.provider_id) || null,
    base_url: normalizeString(row.base_url) || null,
    api_key_count: apiKeyPreviews.length,
    api_key_entries: apiKeyPreviews.map((preview, index) => ({
      fingerprint: buildSyntheticApiKeyFingerprint(preview, index),
      preview,
    })),
    api_key_previews: apiKeyPreviews,
    models: Array.isArray(row.models) ? row.models : [],
  };
}

function normalizeActiveProviderRow(row: ActiveCreditProviderRpcGroup) {
  return {
    provider_id: normalizeString(row.provider_id) || null,
    provider_name: normalizeString(row.provider_name || row.provider_id) || null,
    models: Array.isArray(row.models) ? row.models : [],
  };
}

function normalizeSaveInput(raw: unknown): SaveAdminCreditProviderInput {
  if (!isRecord(raw)) {
    throw new HttpError(400, 'Missing provider input.');
  }

  const providerId = normalizeString(raw.providerId);
  const providerName = normalizeString(raw.providerName);
  const baseUrl = normalizeString(raw.baseUrl);
  const apiKeys = normalizeStringArray(raw.apiKeys);
  const retainApiKeyFingerprints = normalizeStringArray(raw.retainApiKeyFingerprints);
  const models = Array.isArray(raw.models) ? raw.models : [];

  if (!providerId || !providerName || !baseUrl) {
    throw new HttpError(400, 'Provider id, name, and baseUrl are required.');
  }

  if (models.length === 0) {
    throw new HttpError(400, 'At least one model is required.');
  }

  if (
    retainApiKeyFingerprints.length > 0
    && !retainApiKeyFingerprints.every((item) => item.startsWith('preview:'))
  ) {
    throw new HttpError(
      400,
      'Retaining existing non-preview provider keys is not supported in the current Edge Function migration phase.',
    );
  }

  return {
    providerId,
    providerName,
    baseUrl,
    apiKeys,
    retainApiKeyFingerprints,
    models: models.map((model) => {
      if (!isRecord(model)) {
        throw new HttpError(400, 'Invalid model payload.');
      }

      return {
        model_id: normalizeString(model.model_id),
        display_name: normalizeString(model.display_name),
        description: normalizeString(model.description),
        endpoint_type: normalizeString(model.endpoint_type) || 'openai',
        credit_cost: Math.max(0, Number(model.credit_cost || 0)),
        advanced_enabled: model.advanced_enabled === true,
        mix_with_same_model: model.mix_with_same_model === true,
        quality_pricing:
          isRecord(model.quality_pricing)
            ? (model.quality_pricing as Record<string, { enabled: boolean; creditCost: number }>)
            : {},
        priority: Number(model.priority || 0),
        weight: Number(model.weight || 0),
        is_active: model.is_active !== false,
        color: normalizeString(model.color) || '#3B82F6',
        color_secondary: normalizeString(model.color_secondary) || null,
        text_color: normalizeString(model.text_color) === 'black' ? 'black' : 'white',
        max_calls_limit:
          model.max_calls_limit === null || model.max_calls_limit === undefined
            ? null
            : Number(model.max_calls_limit),
        auto_pause_on_limit: model.auto_pause_on_limit === true,
      };
    }),
  };
}

async function listActiveCreditModels(
  rpcClient: SupabaseServiceClient,
) {
  const { data, error } = await rpcClient.rpc('get_active_credit_models');

  if (error) {
    throw new HttpError(500, normalizeErrorMessage(error, 'Failed to load active credit models.'));
  }

  const rows = Array.isArray(data) ? (data as ActiveCreditProviderRpcGroup[]) : [];
  return rows.map((row) => normalizeActiveProviderRow(row));
}

async function listAdminCreditModels(
  rpcClient: SupabaseRpcClient,
) {
  const { data, error } = await rpcClient.rpc('get_admin_credit_models_full');

  if (error) {
    throw new HttpError(500, normalizeErrorMessage(error, 'Failed to load admin credit models.'));
  }

  const rows = Array.isArray(data) ? (data as AdminCreditProviderRpcGroup[]) : [];
  return rows.map((row) => normalizeAdminProviderRow(row));
}

async function saveAdminCreditProvider(
  rpcClient: SupabaseRpcClient,
  rawInput: unknown,
) {
  const input = normalizeSaveInput(rawInput);

  const { error } = await rpcClient.rpc('save_credit_provider', {
    p_provider_id: input.providerId,
    p_provider_name: input.providerName,
    p_base_url: input.baseUrl,
    p_api_keys: input.apiKeys,
    p_models: input.models.map((model) => ({
      model_id: model.model_id,
      display_name: model.display_name,
      description: model.description,
      endpoint_type: model.endpoint_type,
      credit_cost: model.credit_cost,
      advanced_enabled: model.advanced_enabled,
      mix_with_same_model: model.mix_with_same_model,
      quality_pricing: model.quality_pricing,
      priority: model.priority,
      weight: model.weight,
      is_active: model.is_active,
      color: model.color,
      color_secondary: model.color_secondary,
      text_color: model.text_color,
      max_calls_limit: model.max_calls_limit ?? null,
      auto_pause_on_limit: model.auto_pause_on_limit === true,
    })),
  });

  if (error) {
    throw new HttpError(500, normalizeErrorMessage(error, 'Failed to save admin credit provider.'));
  }

  return {
    providerId: input.providerId,
    modelCount: input.models.length,
    apiKeyCount: input.apiKeys.length,
  };
}

async function deleteAdminCreditProvider(
  rpcClient: SupabaseRpcClient,
  providerId: unknown,
) {
  const normalizedProviderId = normalizeString(providerId);
  if (!normalizedProviderId) {
    throw new HttpError(400, 'providerId is required.');
  }

  const { error } = await rpcClient.rpc('delete_credit_provider', {
    p_provider_id: normalizedProviderId,
  });

  if (error) {
    throw new HttpError(500, normalizeErrorMessage(error, 'Failed to delete admin credit provider.'));
  }

  return {
    providerId: normalizedProviderId,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({
      success: false,
      error: 'Method not allowed',
    }, 405);
  }

  try {
    const body = (await req.json()) as RequestPayload;
    const action = normalizeString(body?.action);
    const { userClient, serviceClient } = createSupabaseFunctionClients(req);

    if (action === 'list-active') {
      const items = await listActiveCreditModels(serviceClient);
      return jsonResponse({
        success: true,
        data: items,
      });
    }

    const user = await requireAuthenticatedUser(userClient);
    await requireAdminUser(serviceClient, user.id);

    if (action === 'list-admin') {
      const items = await listAdminCreditModels(userClient);
      return jsonResponse({
        success: true,
        data: items,
      });
    }

    if (action === 'save') {
      await requireElevatedAdminSession(serviceClient, user.id, req.headers.get('x-admin-session-token'));
      const result = await saveAdminCreditProvider(userClient, body.input);
      return jsonResponse({
        success: true,
        data: result,
      });
    }

    if (action === 'delete') {
      await requireElevatedAdminSession(serviceClient, user.id, req.headers.get('x-admin-session-token'));
      const result = await deleteAdminCreditProvider(userClient, body.providerId);
      return jsonResponse({
        success: true,
        data: result,
      });
    }

    throw new HttpError(400, 'Unsupported admin-credit-models action.');
  } catch (error) {
    return errorResponse(error);
  }
});
