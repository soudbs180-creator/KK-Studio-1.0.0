export interface SupabaseAdminCreditProviderRpcModel {
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

export interface SupabaseAdminCreditProviderRpcGroup {
  provider_id?: string | null;
  provider_name?: string | null;
  base_url?: string | null;
  api_key_count?: number | null;
  api_key_entries?: Array<{ fingerprint?: string | null; preview?: string | null }> | null;
  api_key_previews?: string[] | null;
  models?: SupabaseAdminCreditProviderRpcModel[] | null;
}

export interface SupabaseActiveCreditModelRpc {
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
  text_color?: 'white' | 'black' | string | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, unknown> | null;
}

export interface SupabaseActiveCreditProviderRpcGroup {
  provider_id?: string | null;
  provider_name?: string | null;
  models?: SupabaseActiveCreditModelRpc[] | null;
}

export interface SupabaseAdminProviderModelInput {
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

export interface SupabaseAdminProviderInput {
  providerId: string;
  providerName: string;
  baseUrl: string;
  apiKeys: string[];
  retainApiKeyFingerprints?: string[];
  models: SupabaseAdminProviderModelInput[];
}

export type AppAccountRole = 'user' | 'admin' | `member${string}`;

export function normalizeAppAccountRole(rawRole: unknown): AppAccountRole {
  const normalized = String(rawRole || '').trim().toLowerCase();
  if (normalized === 'admin') {
    return 'admin';
  }

  if (normalized.startsWith('member')) {
    return normalized as AppAccountRole;
  }

  return 'user';
}

export function isAdminAccountRole(role: unknown): boolean {
  return normalizeAppAccountRole(role) === 'admin';
}
