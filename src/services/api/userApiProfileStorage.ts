import type { ApiResponse } from '../../../packages/contracts/src/index';
import type { ApiProtocolFormat } from './apiConfig';
import { legacyWebApiClient } from './kkApiClient';
import { extractUserApiEntriesFromPayload } from './userApiPayload';
import {
  loadUserApisPayloadViaSupabase,
  mergeUserApisPayloadViaSupabase,
} from './supabaseUserApiCloudStorage';

const DEFAULT_GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_PROXY_BASE_URL = 'https://cdn.12ai.org';

type JsonRecord = Record<string, unknown>;

export interface StoredUserApiEntry {
  id: string;
  key: string;
  name: string;
  provider: string;
  type: 'official' | 'proxy' | 'third-party';
  format: ApiProtocolFormat;
  baseUrl?: string;
  supportedModels: string[];
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
  status: 'valid' | 'invalid' | 'rate_limited' | 'unknown';
  failCount: number;
  successCount: number;
  totalCost: number;
  budgetLimit: number;
  tokenLimit: number;
  usedTokens: number;
  lastUsed: number | null;
  lastError: string | null;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function resolveApiType(provider: string, baseUrl?: string): StoredUserApiEntry['type'] {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const normalizedBaseUrl = String(baseUrl || '').trim().toLowerCase();

  if (!normalizedBaseUrl && normalizedProvider === 'google') {
    return 'official';
  }

  if (normalizedBaseUrl.includes('googleapis.com')) {
    return 'official';
  }

  if (normalizedBaseUrl) {
    return 'proxy';
  }

  return 'third-party';
}

function resolveFormat(provider: string, baseUrl?: string, value?: unknown): ApiProtocolFormat {
  if (value === 'gemini' || value === 'openai' || value === 'auto') {
    return value;
  }

  return resolveApiType(provider, baseUrl) === 'official' ? 'gemini' : 'auto';
}

function resolveBaseUrl(provider: string, baseUrl?: unknown): string | undefined {
  const normalized = String(baseUrl || '').trim();
  if (normalized) return normalized;

  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (normalizedProvider === 'google') {
    return DEFAULT_GOOGLE_BASE_URL;
  }

  return undefined;
}

function normalizeEntry(rawEntry: unknown): StoredUserApiEntry {
  const now = Date.now();
  const raw = (rawEntry && typeof rawEntry === 'object' ? rawEntry : {}) as JsonRecord;
  const provider = String(raw.provider || 'Custom').trim() || 'Custom';
  const baseUrl = resolveBaseUrl(provider, raw.baseUrl ?? raw.base_url);
  const createdAt = toTimestamp(raw.createdAt ?? raw.created_at, now);
  const updatedAt = toTimestamp(raw.updatedAt ?? raw.updated_at, createdAt);
  const disabled =
    typeof raw.disabled === 'boolean'
      ? raw.disabled
      : typeof raw.is_active === 'boolean'
        ? !raw.is_active
        : false;

  return {
    id: String(raw.id || generateId()),
    key: String(raw.key || ''),
    name: String(raw.name || `${provider} Key`).trim(),
    provider,
    type: resolveApiType(provider, baseUrl),
    format: resolveFormat(provider, baseUrl, raw.format),
    baseUrl,
    supportedModels: toStringArray(raw.supportedModels ?? raw.supported_models),
    disabled,
    createdAt,
    updatedAt,
    status:
      raw.status === 'valid' || raw.status === 'invalid' || raw.status === 'rate_limited'
        ? raw.status
        : 'unknown',
    failCount: Number(raw.failCount || 0),
    successCount: Number(raw.successCount || 0),
    totalCost: Number(raw.totalCost || 0),
    budgetLimit: Number.isFinite(Number(raw.budgetLimit)) ? Number(raw.budgetLimit) : -1,
    tokenLimit: Number.isFinite(Number(raw.tokenLimit)) ? Number(raw.tokenLimit) : -1,
    usedTokens: Number(raw.usedTokens || 0),
    lastUsed: raw.lastUsed == null ? null : toTimestamp(raw.lastUsed, now),
    lastError: raw.lastError == null ? null : String(raw.lastError),
  };
}

function normalizeEntries(rawEntries: unknown): StoredUserApiEntry[] {
  if (!Array.isArray(rawEntries)) return [];
  return rawEntries.map((entry) => normalizeEntry(entry));
}

function unwrapOrThrow<T>(response: ApiResponse<T>, fallback: string): T {
  if (response.success) {
    return response.data;
  }

  throw new Error(response.error?.message || fallback);
}

export async function loadUserApiEntries(): Promise<StoredUserApiEntry[]> {
  let supabaseEntries: StoredUserApiEntry[] = [];
  let supabaseError: unknown = null;

  try {
    const supabasePayload = await loadUserApisPayloadViaSupabase();
    supabaseEntries = normalizeEntries(extractUserApiEntriesFromPayload(supabasePayload));
  } catch (error) {
    supabaseError = error;
  }

  try {
    const response = await legacyWebApiClient.getUserApiEntries();
    const data = unwrapOrThrow(response, 'Failed to load user API entries.');
    const apiEntries = normalizeEntries(data.entries);
    return supabaseEntries.length > 0 ? supabaseEntries : apiEntries;
  } catch (apiError) {
    if (supabaseEntries.length > 0) {
      return supabaseEntries;
    }

    const fallbackError = supabaseError || apiError;
    throw new Error(
      typeof fallbackError === 'object' && fallbackError && 'message' in fallbackError
        ? String((fallbackError as { message?: unknown }).message || 'Failed to load user API entries.')
        : 'Failed to load user API entries.'
    );
  }
}

export async function saveUserApiEntries(entries: StoredUserApiEntry[]): Promise<void> {
  const normalizedEntries = entries.map((entry) =>
    normalizeEntry({
      ...entry,
      updatedAt: Date.now(),
    }),
  );

  try {
    await mergeUserApisPayloadViaSupabase({
      entries: normalizedEntries,
    });
    return;
  } catch (supabaseError) {
    const response = await legacyWebApiClient.replaceUserApiEntries({
      entries: normalizedEntries,
    });

    if (response.success) {
      return;
    }

    throw new Error(
      response.error?.message
      || (typeof supabaseError === 'object' && supabaseError && 'message' in supabaseError
        ? String((supabaseError as { message?: unknown }).message || 'Failed to save user API entries.')
        : 'Failed to save user API entries.')
    );
  }
}

export async function mutateUserApiEntries(
  updater: (entries: StoredUserApiEntry[]) => StoredUserApiEntry[],
): Promise<StoredUserApiEntry[]> {
  const currentEntries = await loadUserApiEntries();
  const nextEntries = updater(currentEntries.map((entry) => ({ ...entry })));
  await saveUserApiEntries(nextEntries);
  return nextEntries;
}

export function createUserApiEntry(input: {
  name: string;
  provider: string;
  apiKey: string;
  baseUrl?: string;
}): StoredUserApiEntry {
  const now = Date.now();
  const provider = String(input.provider || 'Custom').trim() || 'Custom';
  const baseUrl = resolveBaseUrl(provider, input.baseUrl);

  return normalizeEntry({
    id: generateId(),
    key: String(input.apiKey || '').trim(),
    name: String(input.name || `${provider} Key`).trim(),
    provider,
    baseUrl: baseUrl || (resolveApiType(provider, baseUrl) === 'proxy' ? DEFAULT_PROXY_BASE_URL : undefined),
    supportedModels: [],
    disabled: false,
    createdAt: now,
    updatedAt: now,
    status: 'unknown',
    failCount: 0,
    successCount: 0,
    totalCost: 0,
    budgetLimit: -1,
    tokenLimit: -1,
    usedTokens: 0,
    lastUsed: null,
    lastError: null,
  });
}
