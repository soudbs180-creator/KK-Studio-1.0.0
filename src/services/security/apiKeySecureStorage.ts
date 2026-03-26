/**
 * Profile-scoped user API key storage.
 *
 * Canonical storage now lives in `profiles.user_apis`.
 * Keys are masked in the UI, and profile access relies on row-level security
 * instead of the removed legacy `user_api_keys` table/view/RPC chain.
 */

import {
  createUserApiEntry,
  loadUserApiEntries,
  mutateUserApiEntries,
  type StoredUserApiEntry,
} from '../api/userApiProfileStorage';
import { extractUserApiEntriesFromPayload } from '../api/userApiPayload';
import { supabase } from '../../lib/supabase';
import { callSecureSystemProxyChat } from '../model/secureModelProxy';

export interface UserApiKeyInfo {
  id: string;
  name: string;
  provider: string;
  key_status: string;
  base_url: string | null;
  is_active: boolean;
  created_at: string;
}

export type ApiProvider =
  | 'Google'
  | 'OpenAI'
  | 'Anthropic'
  | '智谱'
  | '火山引擎'
  | '阿里云'
  | '腾讯云'
  | 'Custom';

export const API_PROVIDERS: { value: ApiProvider; label: string }[] = [
  { value: 'Google', label: 'Google (Gemini)' },
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Anthropic', label: 'Anthropic (Claude)' },
  { value: '智谱', label: '智谱 (ChatGLM)' },
  { value: '火山引擎', label: '火山引擎' },
  { value: '阿里云', label: '阿里云' },
  { value: '腾讯云', label: '腾讯云' },
  { value: 'Custom', label: '自定义' },
];

interface ProfileUserApisRow {
  user_apis: unknown;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasStoredSecret(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return isRecord(value) && value.__kkUserApiSecret === true;
}

function toCreatedAtIso(value: unknown): string {
  const fallback = new Date(0).toISOString();

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return new Date(numeric).toISOString();
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return fallback;
}

function maskKeyStatus(entry: StoredUserApiEntry): string {
  if (!entry.key) return '***MISSING***';
  return entry.disabled ? '***DISABLED***' : '***CONFIGURED***';
}

function toUserApiKeyInfo(entry: StoredUserApiEntry): UserApiKeyInfo {
  return {
    id: entry.id,
    name: entry.name,
    provider: entry.provider,
    key_status: maskKeyStatus(entry),
    base_url: entry.baseUrl || null,
    is_active: !entry.disabled,
    created_at: new Date(entry.createdAt).toISOString(),
  };
}

function toUserApiKeyInfoFromRawEntry(rawEntry: unknown): UserApiKeyInfo | null {
  const raw = isRecord(rawEntry) ? rawEntry : null;
  if (!raw) return null;

  const id = normalizeString(raw.id);
  if (!id) return null;

  const provider = normalizeString(raw.provider) || 'Custom';
  const name = normalizeString(raw.name) || `${provider} Key`;
  const disabled =
    typeof raw.disabled === 'boolean'
      ? raw.disabled
      : typeof raw.is_active === 'boolean'
        ? !raw.is_active
        : false;
  const baseUrl = normalizeString(raw.baseUrl ?? raw.base_url) || null;

  return {
    id,
    name,
    provider,
    key_status: hasStoredSecret(raw.key) ? (disabled ? '***DISABLED***' : '***CONFIGURED***') : '***MISSING***',
    base_url: baseUrl,
    is_active: !disabled,
    created_at: toCreatedAtIso(raw.createdAt ?? raw.created_at),
  };
}

async function loadUserApiKeyMetadataFromProfile(): Promise<UserApiKeyInfo[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw authError;
  }

  const userId = normalizeString(authData.user?.id);
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_apis')
    .eq('id', userId)
    .maybeSingle<ProfileUserApisRow>();

  if (error) {
    throw error;
  }

  return extractUserApiEntriesFromPayload(data?.user_apis)
    .map((entry) => toUserApiKeyInfoFromRawEntry(entry))
    .filter((entry): entry is UserApiKeyInfo => Boolean(entry))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export const getUserApiKeys = async (): Promise<UserApiKeyInfo[]> => {
  let loadError: unknown = null;

  try {
    const entries = await loadUserApiEntries();
    const hydratedEntries = entries
      .map((entry) => toUserApiKeyInfo(entry))
      .sort((left, right) => right.created_at.localeCompare(left.created_at));

    if (hydratedEntries.length > 0) {
      return hydratedEntries;
    }
  } catch (error) {
    loadError = error;
  }

  try {
    const metadataEntries = await loadUserApiKeyMetadataFromProfile();
    if (metadataEntries.length > 0) {
      return metadataEntries;
    }
  } catch (profileError) {
    if (loadError) {
      throw loadError;
    }
    throw profileError;
  }

  if (loadError) {
    throw loadError;
  }

  return [];
};

export const addUserApiKey = async (
  name: string,
  provider: ApiProvider,
  apiKey: string,
  baseUrl?: string,
): Promise<string> => {
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error('API 密钥长度不足');
  }

  if (!name || !name.trim()) {
    throw new Error('请输入密钥名称');
  }

  const nextEntry = createUserApiEntry({
    name,
    provider,
    apiKey,
    baseUrl,
  });

  await mutateUserApiEntries((entries) => [...entries, nextEntry]);
  return nextEntry.id;
};

export const toggleApiKeyStatus = async (
  keyId: string,
  isActive: boolean,
): Promise<void> => {
  await mutateUserApiEntries((entries) =>
    entries.map((entry) =>
      entry.id === keyId
        ? {
            ...entry,
            disabled: !isActive,
            updatedAt: Date.now(),
          }
        : entry,
    ),
  );
};

export const deleteApiKey = async (keyId: string): Promise<void> => {
  await mutateUserApiEntries((entries) => entries.filter((entry) => entry.id !== keyId));
};

export interface SecureModelRoute {
  route_type: 'user_key' | 'admin_model' | 'none';
  provider_id: string;
  base_url: string;
  api_key: string;
  model_id: string;
  endpoint_type: string;
  credit_cost: number;
  user_pays: number;
  expires_at: string;
}

export const getSecureModelRoute = async (
  _modelId: string,
  _preferredProvider?: string,
): Promise<SecureModelRoute | null> => {
  throw new Error('Direct model route retrieval is disabled for security. Use secure-model-proxy helpers instead.');
};

export const callAiApiSecure = async (
  modelId: string,
  messages: unknown[],
  options?: {
    temperature?: number;
    max_tokens?: number;
    preferred_provider?: string;
    onProgress?: (content: string) => void;
  },
): Promise<{ content: string; usage?: { prompt: number; completion: number } }> => {
  void options?.preferred_provider;
  void options?.onProgress;

  const normalizedMessages = messages.map((message: any) => ({
    role: message?.role === 'assistant' || message?.role === 'system' ? message.role : 'user',
    content:
      typeof message?.content === 'string'
        ? message.content
        : Array.isArray(message?.content)
          ? message.content.map((part: unknown) => String(part)).join('\n')
          : String(message?.content ?? ''),
  }));

  const result = await callSecureSystemProxyChat({
    modelId,
    messages: normalizedMessages,
    temperature: options?.temperature,
    maxTokens: options?.max_tokens,
    stream: false,
  });

  return {
    content: result.content,
    usage: result.usage
      ? {
          prompt: result.usage.promptTokens,
          completion: result.usage.completionTokens,
        }
      : undefined,
  };
};

export const checkProviderConfigured = async (provider: ApiProvider): Promise<boolean> => {
  const entries = await loadUserApiEntries();
  return entries.some(
    (entry) =>
      entry.provider === provider &&
      !entry.disabled &&
      Boolean(entry.key),
  );
};
