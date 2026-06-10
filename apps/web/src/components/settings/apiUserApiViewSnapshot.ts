import type { Provider } from '../../types';
import type { ApiProtocolFormat } from '../../services/api/apiConfig';
import type { KeySlot, ThirdPartyProvider } from '../../services/auth/keyManager';
import { resolveEffectiveProviderModels } from '../../services/auth/keyManagerEffectiveProviderModels.ts';

const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';
const DEFAULT_PROVIDER_COLOR = 'var(--text-secondary)';
const DEFAULT_GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const USER_API_VIEW_SNAPSHOT_PREFIX = 'kk_user_api_view_snapshot:';
const USER_API_VIEW_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

type JsonRecord = Record<string, unknown>;

export interface UserApiViewSnapshot {
  officialSlots: unknown[];
  providers: unknown[];
  updatedAt: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return fallback;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];
}

function hasStoredSecret(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return isRecord(value) && value.__kkUserApiSecret === true;
}

function maskSecret(secret?: unknown): string {
  if (!hasStoredSecret(secret)) return '';
  return READONLY_SECRET_PLACEHOLDER;
}

function normalizeProtocolFormat(value: unknown, fallback: ApiProtocolFormat = 'auto'): ApiProtocolFormat {
  return value === 'auto' || value === 'openai' || value === 'gemini' || value === 'claude'
    ? value
    : fallback;
}

function normalizeOfficialProvider(value: unknown): Provider {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'openai') return 'OpenAI' as Provider;
  if (normalized === 'google' || normalized === 'gemini') return 'Google' as Provider;
  return (normalizeString(value) || 'Google') as Provider;
}

function normalizeOptionalTimestamp(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }

  return normalizeTimestamp(value, Date.now());
}

function getUserApiViewSnapshotKey(userId: string): string {
  return `${USER_API_VIEW_SNAPSHOT_PREFIX}${userId}`;
}

export function toReadonlyOfficialSlot(rawValue: unknown): KeySlot | null {
  const raw = isRecord(rawValue) ? rawValue : null;
  if (!raw) return null;

  const id = normalizeString(raw.id);
  if (!id) return null;

  const now = Date.now();
  const createdAt = normalizeTimestamp(raw.createdAt ?? raw.created_at, now);
  const provider = normalizeOfficialProvider(raw.provider);
  const defaultBaseUrl =
    provider === 'Google'
      ? DEFAULT_GOOGLE_BASE_URL
      : provider === 'OpenAI'
        ? DEFAULT_OPENAI_BASE_URL
        : undefined;
  const baseUrl = normalizeString(raw.baseUrl ?? raw.base_url) || defaultBaseUrl;

  return {
    id,
    legacyIds: normalizeStringArray(raw.legacyIds),
    key: hasStoredSecret(raw.key) ? maskSecret(raw.key) : '',
    name: normalizeString(raw.name) || (provider === 'OpenAI' ? 'OpenAI' : 'Google'),
    provider,
    type: provider === 'Google' || provider === 'OpenAI' ? 'official' : (baseUrl ? 'proxy' : 'third-party'),
    format: normalizeProtocolFormat(raw.format, provider === 'Google' ? 'gemini' : 'openai'),
    baseUrl,
    supportedModels: normalizeStringArray(raw.supportedModels ?? raw.supported_models),
    disabled:
      typeof raw.disabled === 'boolean'
        ? raw.disabled
        : typeof raw.is_active === 'boolean'
          ? !raw.is_active
          : false,
    status:
      raw.status === 'valid' || raw.status === 'invalid' || raw.status === 'rate_limited'
        ? raw.status
        : 'unknown',
    failCount: normalizeNumber(raw.failCount ?? raw.fail_count),
    successCount: normalizeNumber(raw.successCount ?? raw.success_count),
    lastUsed: normalizeOptionalTimestamp(raw.lastUsed ?? raw.last_used),
    lastError: normalizeString(raw.lastError ?? raw.last_error) || null,
    createdAt,
    updatedAt: normalizeTimestamp(raw.updatedAt ?? raw.updated_at, createdAt),
    avgResponseTime: normalizeNumber(raw.avgResponseTime ?? raw.avg_response_time, 0) || undefined,
    lastResponseTime: normalizeNumber(raw.lastResponseTime ?? raw.last_response_time, 0) || undefined,
    usedTokens: normalizeNumber(raw.usedTokens ?? raw.used_tokens),
    totalCost: normalizeNumber(raw.totalCost ?? raw.total_cost),
    budgetLimit: Number.isFinite(Number(raw.budgetLimit)) ? Number(raw.budgetLimit) : -1,
    tokenLimit: Number.isFinite(Number(raw.tokenLimit)) ? Number(raw.tokenLimit) : -1,
  };
}

export function toReadonlyProvider(rawValue: unknown): ThirdPartyProvider | null {
  const raw = isRecord(rawValue) ? rawValue : null;
  if (!raw) return null;

  const id = normalizeString(raw.id);
  if (!id) return null;

  const now = Date.now();
  const createdAt = normalizeTimestamp(raw.createdAt ?? raw.created_at, now);
  const usageRaw = isRecord(raw.usage) ? raw.usage : {};
  const providerName = normalizeString(raw.name) || 'Provider';
  const providerBaseUrl = normalizeString(raw.baseUrl ?? raw.base_url);
  const providerFormat = normalizeProtocolFormat(raw.format);
  const rawProviderModels = normalizeStringArray(raw.models ?? raw.supportedModels ?? raw.supported_models);

  return {
    id,
    legacyIds: normalizeStringArray(raw.legacyIds),
    name: providerName,
    baseUrl: providerBaseUrl,
    apiKey: hasStoredSecret(raw.apiKey ?? raw.key) ? maskSecret(raw.apiKey ?? raw.key) : '',
    models: resolveEffectiveProviderModels({
      provider: providerName,
      baseUrl: providerBaseUrl,
      format: providerFormat,
      models: rawProviderModels,
    }),
    format: providerFormat,
    icon: normalizeString(raw.icon) || undefined,
    group: normalizeString(raw.group) || undefined,
    providerColor: normalizeString(raw.providerColor ?? raw.color) || DEFAULT_PROVIDER_COLOR,
    isActive:
      typeof raw.isActive === 'boolean'
        ? raw.isActive
        : typeof raw.is_active === 'boolean'
          ? raw.is_active
          : true,
    budgetLimit: Number.isFinite(Number(raw.budgetLimit)) ? Number(raw.budgetLimit) : undefined,
    tokenLimit: Number.isFinite(Number(raw.tokenLimit)) ? Number(raw.tokenLimit) : undefined,
    customCostMode:
      raw.customCostMode === 'unlimited' || raw.customCostMode === 'amount' || raw.customCostMode === 'tokens'
        ? raw.customCostMode
        : 'unlimited',
    customCostValue: Number.isFinite(Number(raw.customCostValue)) ? Number(raw.customCostValue) : undefined,
    usage: {
      totalTokens: normalizeNumber(usageRaw.totalTokens ?? raw.usedTokens ?? raw.used_tokens),
      totalCost: normalizeNumber(usageRaw.totalCost ?? raw.totalCost ?? raw.total_cost),
      dailyTokens: normalizeNumber(usageRaw.dailyTokens),
      dailyCost: normalizeNumber(usageRaw.dailyCost),
      lastReset: normalizeTimestamp(usageRaw.lastReset, createdAt),
    },
    status: raw.status === 'active' || raw.status === 'error' || raw.status === 'checking' ? raw.status : 'checking',
    lastError: normalizeString(raw.lastError ?? raw.last_error) || undefined,
    lastChecked: normalizeOptionalTimestamp(raw.lastChecked ?? raw.last_checked) ?? undefined,
    createdAt,
    updatedAt: normalizeTimestamp(raw.updatedAt ?? raw.updated_at, createdAt),
    activitySummary: isRecord(raw.activitySummary)
      ? {
          lastLatencyMs: normalizeNumber(raw.activitySummary.lastLatencyMs, 0) || null,
          lastTokens: normalizeNumber(raw.activitySummary.lastTokens, 0) || null,
          lastAmount: normalizeNumber(raw.activitySummary.lastAmount, 0) || null,
          updatedAt: normalizeOptionalTimestamp(raw.activitySummary.updatedAt) ?? undefined,
        }
      : undefined,
  };
}

export function readUserApiViewSnapshot(userId: string | null | undefined): UserApiViewSnapshot | null {
  const normalizedUserId = normalizeString(userId);
  if (typeof window === 'undefined' || !normalizedUserId) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(getUserApiViewSnapshotKey(normalizedUserId))
      || window.sessionStorage.getItem(getUserApiViewSnapshotKey(normalizedUserId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<UserApiViewSnapshot> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const updatedAt = normalizeTimestamp(parsed.updatedAt, 0);
    if (!updatedAt || Date.now() - updatedAt > USER_API_VIEW_SNAPSHOT_TTL_MS) {
      window.localStorage.removeItem(getUserApiViewSnapshotKey(normalizedUserId));
      window.sessionStorage.removeItem(getUserApiViewSnapshotKey(normalizedUserId));
      return null;
    }

    return {
      officialSlots: Array.isArray(parsed.officialSlots) ? parsed.officialSlots : [],
      providers: Array.isArray(parsed.providers) ? parsed.providers : [],
      updatedAt,
    };
  } catch (error) {
    console.warn('[ApiSettingsView] Failed to restore cached user API snapshot:', error);
    return null;
  }
}

export function writeUserApiViewSnapshot(
  userId: string | null | undefined,
  officialSlots: KeySlot[],
  providers: ThirdPartyProvider[],
): void {
  const normalizedUserId = normalizeString(userId);
  if (typeof window === 'undefined' || !normalizedUserId) {
    return;
  }

  try {
    window.localStorage.setItem(getUserApiViewSnapshotKey(normalizedUserId), JSON.stringify({
      officialSlots: officialSlots
        .map((slot) => toReadonlyOfficialSlot(slot))
        .filter((slot): slot is KeySlot => Boolean(slot)),
      providers: providers
        .map((provider) => toReadonlyProvider(provider))
        .filter((provider): provider is ThirdPartyProvider => Boolean(provider)),
      updatedAt: Date.now(),
    } satisfies UserApiViewSnapshot));
  } catch (error) {
    console.warn('[ApiSettingsView] Failed to persist cached user API snapshot:', error);
  }
}

export function clearUserApiViewSnapshot(userId: string | null | undefined): void {
  const normalizedUserId = normalizeString(userId);
  if (typeof window === 'undefined' || !normalizedUserId) {
    return;
  }

  window.localStorage.removeItem(getUserApiViewSnapshotKey(normalizedUserId));
  window.sessionStorage.removeItem(getUserApiViewSnapshotKey(normalizedUserId));
}
