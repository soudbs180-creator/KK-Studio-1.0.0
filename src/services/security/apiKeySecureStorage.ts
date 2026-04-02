/**
 * Profile-scoped user API key storage.
 *
 * Canonical storage now lives behind the typed auth API surface.
 * Frontend callers only see redacted metadata and never touch profile rows
 * directly when listing or mutating BYOK credentials.
 */

import {
  createUserApiEntry,
  loadUserApiEntries,
  mutateUserApiEntries,
  type StoredUserApiEntry,
} from '../api/userApiProfileStorage';
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

export const getUserApiKeys = async (): Promise<UserApiKeyInfo[]> => {
  const entries = await loadUserApiEntries();
  return entries
    .map((entry) => toUserApiKeyInfo(entry))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
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
