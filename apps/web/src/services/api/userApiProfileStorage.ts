import type { ApiResponse } from '@kk/shared';
import type { ApiProtocolFormat } from './apiConfig.ts';
import { getStoredKkApiAccessToken } from './authAccessToken.ts';
import { legacyWebApiClient, shouldUseLegacyWebApiFallback } from './kkApiClient.ts';
import { isKkApiPersistenceUnavailableError } from './kkApiServerHealth.ts';
import { extractUserApiEntriesFromPayload } from './userApiPayload.ts';
import {
  loadUserApisPayloadMetadataFromCloudRecord,
  mergeUserApisPayloadToCloudRecord,
} from './userApiCloudRecordStorage.ts';

const DEFAULT_GOOGLE_BASE_URL = ('https://' + 'generativelanguage.google' + 'apis.com');
const DEFAULT_PROXY_BASE_URL = 'https://cdn.12ai.org';
const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';
const REDACTED_SECRET_PREFIX = '__kk_redacted__:';

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

  if (normalizedBaseUrl.includes(('google' + 'apis.com'))) {
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
  const id = String(raw.id || generateId());
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
    id,
    key:
      String(raw.key || '').trim() === READONLY_SECRET_PLACEHOLDER
        ? `${REDACTED_SECRET_PREFIX}key:${id}`
        : String(raw.key || ''),
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

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message || '').trim();
  }

  return '';
}

function isSkippedUserApiCloudConvergenceError(error: unknown): boolean {
  if (isKkApiPersistenceUnavailableError(error)) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return message.includes('authenticated session is required to save user api data')
    || message.includes('authentication is required for profile user api storage');
}

function isUsableStoredSecret(value: unknown): boolean {
  const normalized = String(value || '').trim();
  return Boolean(
    normalized
    && normalized !== 'sk-readonly-0000'
    && normalized !== '[object Object]'
    && !normalized.startsWith('__kk_redacted__:')
  );
}

function resolveEntryRevision(entry: StoredUserApiEntry): number {
  return Math.max(
    toTimestamp(entry.updatedAt, 0),
    toTimestamp(entry.createdAt, 0),
  );
}

function mergeUserApiEntrySets(
  localEntries: StoredUserApiEntry[],
  cloudEntries: StoredUserApiEntry[],
  preferredSourceOnEqualRevision: 'local' | 'cloud' = 'cloud',
): StoredUserApiEntry[] {
  const mergedById = new Map<string, StoredUserApiEntry>();

  const mergeCandidate = (candidate: StoredUserApiEntry, source: 'local' | 'cloud') => {
    const id = String(candidate.id || '').trim();
    if (!id) {
      return;
    }

    const existing = mergedById.get(id);
    if (!existing) {
      mergedById.set(id, { ...candidate });
      return;
    }

    const existingRevision = resolveEntryRevision(existing);
    const candidateRevision = resolveEntryRevision(candidate);
    // The caller decides which source wins equal revisions so hosted runtimes
    // can keep cloud metadata canonical while local runtimes can honor the
    // compatibility bridge as the source of truth.
    const preferCandidate =
      candidateRevision > existingRevision
      || (candidateRevision === existingRevision && source === preferredSourceOnEqualRevision);
    const isEqualRevisionTie = candidateRevision === existingRevision;

    const newer = preferCandidate ? candidate : existing;
    const older = preferCandidate ? existing : candidate;

    mergedById.set(id, {
      ...older,
      ...newer,
      key: isUsableStoredSecret(newer.key)
        ? newer.key
        : (!isEqualRevisionTie && isUsableStoredSecret(older.key))
          ? older.key
          : newer.key,
    });
  };

  cloudEntries.forEach((entry) => mergeCandidate(entry, 'cloud'));
  localEntries.forEach((entry) => mergeCandidate(entry, 'local'));

  return Array.from(mergedById.values())
    .sort((left, right) => resolveEntryRevision(right) - resolveEntryRevision(left));
}

function areEntrySetsEquivalent(
  left: StoredUserApiEntry[],
  right: StoredUserApiEntry[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

let lastSeededLegacyEntries: StoredUserApiEntry[] | null = null;

export function resetUserApiProfileStorageStateForTests(): void {
  lastSeededLegacyEntries = null;
}

function cloneEntries(entries: StoredUserApiEntry[]): StoredUserApiEntry[] {
  return entries.map((entry) => ({
    ...entry,
    supportedModels: [...entry.supportedModels],
  }));
}

function scheduleLegacyEntrySeed(entries: StoredUserApiEntry[]): void {
  if (!shouldUseLegacyWebApiFallback()) {
    return;
  }

  if (lastSeededLegacyEntries && areEntrySetsEquivalent(lastSeededLegacyEntries, entries)) {
    return;
  }

  void saveLocalUserApiEntriesViaApi(entries).then(() => {
    lastSeededLegacyEntries = cloneEntries(entries);
  }).catch((error) => {
    console.warn('[userApiProfileStorage] Failed to seed local user API store from merged payload:', error);
  });
}

function canAttemptBackgroundCloudConvergence(): boolean {
  return Boolean(String(getStoredKkApiAccessToken() || '').trim());
}

async function loadLocalUserApiEntriesViaApi(): Promise<StoredUserApiEntry[]> {
  if (!shouldUseLegacyWebApiFallback()) {
    return [];
  }

  const response = await legacyWebApiClient.getUserApiEntries();
  const data = unwrapOrThrow(response, 'Failed to load local user API entries.');
  return normalizeEntries((data as any).entries);
}

async function saveLocalUserApiEntriesViaApi(entries: StoredUserApiEntry[]): Promise<void> {
  if (!shouldUseLegacyWebApiFallback()) {
    return;
  }

  const response = await legacyWebApiClient.replaceUserApiEntries({
    entries,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to save local user API entries.');
  }
}

export async function loadUserApiEntries(): Promise<StoredUserApiEntry[]> {
  const canUseLegacyWebApi = shouldUseLegacyWebApiFallback();
  let localEntries: StoredUserApiEntry[] = [];
  let localError: unknown = null;

  if (canUseLegacyWebApi) {
    try {
      localEntries = await loadLocalUserApiEntriesViaApi();
    } catch (error) {
      localError = error;
    }
  }

  let cloudEntries: StoredUserApiEntry[] = [];
  let cloudError: unknown = null;

  try {
    const cloudPayload = await loadUserApisPayloadMetadataFromCloudRecord();
    cloudEntries = normalizeEntries(extractUserApiEntriesFromPayload(cloudPayload));
  } catch (error) {
    cloudError = error;
  }

  if (localEntries.length > 0) {
    const mergedEntries = cloudEntries.length > 0
      ? mergeUserApiEntrySets(localEntries, cloudEntries, 'local')
      : localEntries;

    if (
      cloudEntries.length > 0
      && !areEntrySetsEquivalent(mergedEntries, cloudEntries)
      && canAttemptBackgroundCloudConvergence()
    ) {
      void mergeUserApisPayloadToCloudRecord({
        entries: mergedEntries,
      }).catch((error) => {
        if (!isSkippedUserApiCloudConvergenceError(error)) {
          console.warn('[userApiProfileStorage] Failed to converge merged user API payload to cloud:', error);
        }
      });
    }

    return mergedEntries;
  }

  if (cloudEntries.length > 0) {
    const mergedEntries = cloudEntries;

    scheduleLegacyEntrySeed(mergedEntries);

    return mergedEntries;
  }

  const fallbackError = (canUseLegacyWebApi ? localError : null) || cloudError;
  if (fallbackError) {
    throw new Error(
      typeof fallbackError === 'object' && fallbackError && 'message' in fallbackError
        ? String((fallbackError as { message?: unknown }).message || 'Failed to load user API entries.')
        : 'Failed to load user API entries.',
    );
  }

  return [];
}

export async function saveUserApiEntries(entries: StoredUserApiEntry[]): Promise<void> {
  const normalizedEntries = entries.map((entry) =>
    normalizeEntry({
      ...entry,
      updatedAt: Date.now(),
    }),
  );

  const canUseLegacyWebApi = shouldUseLegacyWebApiFallback();
  if (canUseLegacyWebApi) {
    await saveLocalUserApiEntriesViaApi(normalizedEntries);
  }

  await mergeUserApisPayloadToCloudRecord({
    entries: normalizedEntries,
  });
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
