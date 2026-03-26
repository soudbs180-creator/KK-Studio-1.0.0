import type { User } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import {
  getStoredAdminSessionExpiresAt,
  getStoredAdminSessionToken,
  getStoredAdminSessionUserId,
  setStoredAdminSession,
} from '../api/adminSession';

const FALLBACK_ADMIN_SESSION_PREFIX = 'sb-admin-session:';
const FALLBACK_ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;

type RpcJsonResult = {
  success?: boolean | null;
  message?: string | null;
  requires_password_change?: boolean | null;
};

type RpcAuthenticateAdminRow = {
  success?: boolean | null;
  token?: string | null;
  message?: string | null;
  requires_password_change?: boolean | null;
};

type RpcRechargeRow = {
  success?: boolean | null;
  new_balance?: number | null;
  message?: string | null;
};

type RpcAdminCreditProviderModelRow = {
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
};

type RpcAdminCreditProviderRow = {
  provider_id?: string | null;
  provider_name?: string | null;
  base_url?: string | null;
  api_keys?: string[] | null;
  models?: RpcAdminCreditProviderModelRow[] | null;
};

type RpcActiveCreditModelRow = {
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
};

type RpcActiveCreditProviderRow = {
  provider_id?: string | null;
  provider_name?: string | null;
  models?: RpcActiveCreditModelRow[] | null;
};

export type SupabaseAdminCreditProviderRpcModel = RpcAdminCreditProviderModelRow;

export interface SupabaseAdminCreditProviderRpcGroup {
  provider_id?: string | null;
  provider_name?: string | null;
  base_url?: string | null;
  api_key_count?: number | null;
  api_key_entries?: Array<{ fingerprint?: string | null; preview?: string | null }> | null;
  api_key_previews?: string[] | null;
  models?: SupabaseAdminCreditProviderRpcModel[] | null;
}

export type SupabaseActiveCreditModelRpc = RpcActiveCreditModelRow;

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

export interface SupabaseAdminAccessState {
  isAdmin: boolean;
  adminSessionActive: boolean;
  adminSessionExpiresAt?: string;
  requiresPasswordChange: boolean;
}

function buildFallbackAdminSessionToken(userId: string): string {
  const sessionId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return `${FALLBACK_ADMIN_SESSION_PREFIX}${userId}:${sessionId}`;
}

function isFallbackAdminSessionForUser(token: string | undefined, userId: string): boolean {
  return Boolean(token && token.startsWith(`${FALLBACK_ADMIN_SESSION_PREFIX}${userId}:`));
}

function resolveFallbackAdminSessionState(
  userId?: string,
): Pick<SupabaseAdminAccessState, 'adminSessionActive' | 'adminSessionExpiresAt'> {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return { adminSessionActive: false };
  }

  const token = getStoredAdminSessionToken();
  if (!token) {
    return { adminSessionActive: false };
  }

  const expiresAt = getStoredAdminSessionExpiresAt();
  if (!expiresAt) {
    return { adminSessionActive: false };
  }

  const storedUserId = String(getStoredAdminSessionUserId() || '').trim();
  if (storedUserId && storedUserId !== normalizedUserId) {
    return { adminSessionActive: false };
  }

  if (
    !storedUserId
    && token.startsWith(FALLBACK_ADMIN_SESSION_PREFIX)
    && !isFallbackAdminSessionForUser(token, normalizedUserId)
  ) {
    return { adminSessionActive: false };
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { adminSessionActive: false };
  }

  return {
    adminSessionActive: true,
    adminSessionExpiresAt: expiresAt,
  };
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

function buildSyntheticApiKeyFingerprint(preview: string, index: number): string {
  return `preview:${index}:${String(preview || '').trim()}`;
}

export async function resolveSupabaseAdminAccess(
  user: User | null | undefined,
): Promise<SupabaseAdminAccessState> {
  const userId = String(user?.id || '').trim();
  if (!userId) {
    return {
      isAdmin: false,
      adminSessionActive: false,
      requiresPasswordChange: false,
    };
  }

  const sessionState = resolveFallbackAdminSessionState(userId);
  const { data, error } = await supabase.rpc('is_admin');

  if (error || data !== true) {
    return {
      isAdmin: false,
      adminSessionActive: false,
      requiresPasswordChange: false,
    };
  }

  return {
    isAdmin: true,
    adminSessionActive: sessionState.adminSessionActive,
    adminSessionExpiresAt: sessionState.adminSessionExpiresAt,
    requiresPasswordChange: false,
  };
}

export async function verifyAdminPasswordViaSupabase(
  user: User | null | undefined,
  password: string,
) {
  const userId = String(user?.id || '').trim();
  if (!userId) {
    throw new Error('请先登录后再验证管理员密码。');
  }

  const { data, error } = await supabase.rpc('authenticate_admin', {
    input_password: password,
  });

  if (error) {
    throw new Error(normalizeErrorMessage(error, '管理员密码验证失败。'));
  }

  const row = Array.isArray(data)
    ? (data[0] as RpcAuthenticateAdminRow | undefined)
    : (data as RpcAuthenticateAdminRow | undefined);

  if (!row || row.success !== true) {
    throw new Error(String(row?.message || '管理员密码错误。'));
  }

  const adminSessionToken =
    String(row.token || '').trim() || buildFallbackAdminSessionToken(userId);
  const expiresAt = new Date(Date.now() + FALLBACK_ADMIN_SESSION_TTL_MS).toISOString();
  setStoredAdminSession(adminSessionToken, expiresAt, userId);

  return {
    adminSessionToken,
    adminSessionExpiresAt: expiresAt,
    requiresPasswordChange: row.requires_password_change === true,
  };
}

export async function changeAdminPasswordViaSupabase(
  user: User | null | undefined,
  oldPassword: string,
  newPassword: string,
) {
  const email = String(user?.email || '').trim();
  if (!email) {
    throw new Error('当前账号缺少邮箱，无法通过 Supabase 直接修改管理员密码。');
  }

  const { data, error } = await supabase.rpc('admin_change_password', {
    p_email: email,
    p_old_password: oldPassword,
    p_new_password: newPassword,
  });

  if (error) {
    throw new Error(normalizeErrorMessage(error, '管理员密码修改失败。'));
  }

  const payload = (data || {}) as RpcJsonResult;
  if (payload.success !== true) {
    throw new Error(String(payload.message || '管理员密码修改失败。'));
  }
}

export async function adminRechargeCreditsViaSupabase(
  identity: string,
  creditAmount: number,
  description?: string,
) {
  const { data, error } = await supabase.rpc('admin_recharge_credits_by_identity', {
    p_identity: identity,
    p_amount: creditAmount,
    p_description: description || null,
  });

  if (error) {
    throw new Error(normalizeErrorMessage(error, '管理员充值失败。'));
  }

  const row = Array.isArray(data)
    ? (data[0] as RpcRechargeRow | undefined)
    : (data as RpcRechargeRow | undefined);

  if (!row || row.success !== true) {
    throw new Error(String(row?.message || '管理员充值失败。'));
  }

  return {
    balanceAfter: Math.max(0, Number(row.new_balance || 0)),
    message: String(row.message || '充值成功。'),
  };
}

export async function listAdminCreditProvidersViaSupabase(): Promise<SupabaseAdminCreditProviderRpcGroup[]> {
  const { data, error } = await supabase.rpc('get_admin_credit_models_full');

  if (error) {
    throw new Error(normalizeErrorMessage(error, '加载管理员模型配置失败。'));
  }

  const rows = Array.isArray(data) ? (data as RpcAdminCreditProviderRow[]) : [];
  return rows.map((row) => ({
    provider_id: row.provider_id || null,
    provider_name: row.provider_name || row.provider_id || null,
    base_url: row.base_url || null,
    api_key_count: Array.isArray(row.api_keys)
      ? row.api_keys.filter((item) => typeof item === 'string' && item.trim()).length
      : 0,
    api_key_entries: Array.isArray(row.api_keys)
      ? row.api_keys
          .filter((item) => typeof item === 'string' && item.trim())
          .map((item, index) => ({
            fingerprint: buildSyntheticApiKeyFingerprint(String(item).trim(), index),
            preview: String(item).trim(),
          }))
      : [],
    api_key_previews: Array.isArray(row.api_keys)
      ? row.api_keys
          .filter((item) => typeof item === 'string' && item.trim())
          .map((item) => String(item).trim())
      : [],
    models: Array.isArray(row.models) ? row.models : [],
  }));
}

export async function listActiveCreditModelsViaSupabase(): Promise<SupabaseActiveCreditProviderRpcGroup[]> {
  const { data, error } = await supabase.rpc('get_active_credit_models');

  if (error) {
    throw new Error(normalizeErrorMessage(error, '加载启用中的积分模型失败。'));
  }

  const rows = Array.isArray(data) ? (data as RpcActiveCreditProviderRow[]) : [];
  return rows.map((row) => ({
    provider_id: row.provider_id || null,
    provider_name: row.provider_name || row.provider_id || null,
    models: Array.isArray(row.models) ? row.models : [],
  }));
}

export async function saveAdminCreditProviderViaSupabase(
  input: SupabaseAdminProviderInput,
): Promise<void> {
  if (Array.isArray(input.retainApiKeyFingerprints) && input.retainApiKeyFingerprints.length > 0) {
    const syntheticFingerprintsOnly = input.retainApiKeyFingerprints.every((item) =>
      String(item || '').startsWith('preview:'),
    );

    if (!syntheticFingerprintsOnly) {
      throw new Error('当前已切换到 Supabase 直连回退模式，暂不支持逐条删除或替换已保存密钥。请启用 API 服务后重试。');
    }
  }

  const { error } = await supabase.rpc('save_credit_provider', {
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
    throw new Error(normalizeErrorMessage(error, '保存管理员模型配置失败。'));
  }
}

export async function deleteAdminCreditProviderViaSupabase(providerId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_credit_provider', {
    p_provider_id: providerId,
  });

  if (error) {
    throw new Error(normalizeErrorMessage(error, '删除管理员模型配置失败。'));
  }
}
