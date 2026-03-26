import {
  deleteAdminCreditProviderViaSupabase,
  listAdminCreditProvidersViaSupabase,
  saveAdminCreditProviderViaSupabase,
} from '../admin/supabaseAdminFallbackService';
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

function normalizeAdminCreditProviderGroup(
  row: Awaited<ReturnType<typeof listAdminCreditProvidersViaSupabase>>[number],
): AdminCreditProviderRpcGroup {
  return {
    provider_id: row.provider_id || null,
    provider_name: row.provider_name || row.provider_id || null,
    base_url: row.base_url || null,
    api_key_count: row.api_key_count ?? 0,
    api_key_entries: Array.isArray(row.api_key_entries) ? row.api_key_entries : [],
    api_key_previews: Array.isArray(row.api_key_previews) ? row.api_key_previews : [],
    models: Array.isArray(row.models) ? row.models : [],
  };
}

export async function listAdminCreditProviders(): Promise<AdminCreditProviderRpcGroup[]> {
  const rows = await listAdminCreditProvidersViaSupabase();
  return rows.map((row) => normalizeAdminCreditProviderGroup(row));
}

export async function saveAdminCreditProvider(input: SaveAdminCreditProviderInput): Promise<void> {
  await saveAdminCreditProviderViaSupabase(input);

  await adminModelService.broadcastCatalogUpdate('save');
}

export async function deleteAdminCreditProvider(providerId: string): Promise<void> {
  await deleteAdminCreditProviderViaSupabase(providerId);

  await adminModelService.broadcastCatalogUpdate('delete');
}
