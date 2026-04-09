import type { KeyManagerCloudStateDto, UserApiEntryDto } from '../../../packages/contracts/src/index.ts';
import { supabase } from '../../lib/supabase.ts';
import {
  getLegacyWebApiFallbackState,
  legacyWebApiClient,
  shouldUseLegacyWebApiFallback,
} from './kkApiClient.ts';
import {
  compactUserApisPayloadForTransport,
  extractKeyManagerCloudSlots,
  extractUserApiEntriesFromPayload,
  extractUserApiProvidersFromPayload,
  isUserApisEnvelope,
  mergeUserApisPayload,
} from './userApiPayload.ts';

interface AuthenticatedProfileContext {
  userId: string;
  email: string | null;
}

export interface UserApisEnvelope {
  version: number;
  slots: unknown[];
  providers: unknown[];
  entries: unknown[];
}

type JsonRecord = Record<string, unknown>;

const USER_APIS_PAYLOAD_CACHE_TTL_MS = 15_000;
const CLIENT_VISIBLE_SECRET_PLACEHOLDER = 'sk-readonly-0000';
const REDACTED_SECRET_PREFIX = '__kk_redacted__:';
const LOCAL_RUNTIME_FALLBACK_USER_ID = 'local-user';

const userApisPayloadCache = new Map<string, {
  payload: UserApisEnvelope | null;
  expiresAt: number;
}>();
const userApisPayloadInFlight = new Map<string, Promise<UserApisEnvelope | null>>();

export function resetUserApisPayloadCacheForTests(): void {
  userApisPayloadCache.clear();
  userApisPayloadInFlight.clear();
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

function unwrapOrUndefined<T>(
  response: {
    success: boolean;
    data?: T;
    error?: { message?: string | null };
  },
): T | undefined {
  return response.success ? (response.data as T) : undefined;
}

function getApiFailureMessage(
  response: {
    success: boolean;
    error?: { message?: string | null };
  },
): string | undefined {
  if (response.success) {
    return undefined;
  }

  return response.error?.message || undefined;
}

function isUnifiedUserApisPayloadEndpointUnavailable(
  response: {
    success: boolean;
    error?: {
      code?: string | null;
      details?: unknown;
    };
  },
): boolean {
  if (response.success) {
    return false;
  }

  const code = String(response.error?.code || '').trim().toUpperCase();
  if (code === 'HTTP_404' || code === 'HTTP_405') {
    return true;
  }

  const details = Array.isArray(response.error?.details) ? response.error?.details : [];
  return details.some((detail) => isRecord(detail) && (detail.status === 404 || detail.status === 405));
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumericValue(value: unknown, fallback: number): number {
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
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneEnvelope(payload: UserApisEnvelope | null): UserApisEnvelope | null {
  if (!payload) {
    return null;
  }

  return {
    version: payload.version,
    slots: [...payload.slots],
    providers: [...payload.providers],
    entries: [...payload.entries],
  };
}

function isEncryptedSecretEnvelope(value: unknown): boolean {
  return isRecord(value) && value.__kkUserApiSecret === true;
}

function isRedactedSecretPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(REDACTED_SECRET_PREFIX);
}

function toClientVisibleSecret(value: unknown): unknown {
  if (isEncryptedSecretEnvelope(value) || isRedactedSecretPlaceholder(value)) {
    return CLIENT_VISIBLE_SECRET_PLACEHOLDER;
  }

  return value;
}

function sanitizeClientVisibleEnvelope(payload: UserApisEnvelope): UserApisEnvelope {
  const sanitizeItems = (
    items: unknown[],
    secretField: 'key' | 'apiKey',
  ): unknown[] => items.map((item) => {
    if (!isRecord(item)) {
      return item;
    }

    if (!(secretField in item)) {
      return {
        ...item,
      };
    }

    return {
      ...item,
      [secretField]: toClientVisibleSecret(item[secretField]),
    };
  });

  return {
    version: payload.version,
    slots: sanitizeItems(payload.slots, 'key'),
    providers: sanitizeItems(payload.providers, 'apiKey'),
    entries: sanitizeItems(payload.entries, 'key'),
  };
}

function getCachedUserApisPayload(userId: string): UserApisEnvelope | null | undefined {
  if (!shouldUseLegacyWebApiFallback()) {
    return undefined;
  }

  const cached = userApisPayloadCache.get(userId);
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    userApisPayloadCache.delete(userId);
    return undefined;
  }

  return cloneEnvelope(cached.payload);
}

function setCachedUserApisPayload(userId: string, payload: unknown | null): UserApisEnvelope | null {
  const normalizedPayload = payload == null ? null : normalizeEnvelope(payload);
  if (!shouldUseLegacyWebApiFallback()) {
    return cloneEnvelope(normalizedPayload);
  }

  userApisPayloadCache.set(userId, {
    payload: cloneEnvelope(normalizedPayload),
    expiresAt: Date.now() + USER_APIS_PAYLOAD_CACHE_TTL_MS,
  });
  return cloneEnvelope(normalizedPayload);
}

function invalidateCachedUserApisPayload(userId: string): void {
  userApisPayloadCache.delete(userId);
  userApisPayloadInFlight.delete(userId);
}

function normalizeEnvelope(rawPayload: unknown): UserApisEnvelope {
  if (isUserApisEnvelope(rawPayload)) {
    const payload = rawPayload as Record<string, unknown>;
    return {
      version: Number(payload.version || 2),
      slots: toArray(payload.slots),
      providers: toArray(payload.providers),
      entries: toArray(payload.entries),
    };
  }

  return {
    version: 2,
    slots: [],
    providers: extractUserApiProvidersFromPayload(rawPayload),
    entries: extractUserApiEntriesFromPayload(rawPayload),
  };
}

function normalizeRecordId(value: unknown): string {
  return isRecord(value) ? String(value.id || '').trim() : '';
}

function resolveUserApiEntryType(
  rawEntry: JsonRecord,
  provider: string,
  baseUrl?: string,
): UserApiEntryDto['type'] {
  if (rawEntry.type === 'official' || rawEntry.type === 'proxy' || rawEntry.type === 'third-party') {
    return rawEntry.type;
  }

  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedBaseUrl = String(baseUrl || '').trim().toLowerCase();

  if (!normalizedBaseUrl && normalizedProvider === 'google') {
    return 'official';
  }

  if (normalizedBaseUrl.includes('googleapis.com')) {
    return 'official';
  }

  return normalizedBaseUrl ? 'proxy' : 'third-party';
}

function resolveUserApiEntryFormat(
  rawEntry: JsonRecord,
  provider: string,
  baseUrl?: string,
): UserApiEntryDto['format'] {
  if (
    rawEntry.format === 'gemini'
    || rawEntry.format === 'openai'
    || rawEntry.format === 'auto'
    || rawEntry.format === 'claude'
  ) {
    return rawEntry.format;
  }

  return resolveUserApiEntryType(rawEntry, provider, baseUrl) === 'official'
    ? 'gemini'
    : 'auto';
}

function normalizeUserApiEntryDto(rawEntry: unknown): UserApiEntryDto {
  const now = Date.now();
  const entry = isRecord(rawEntry) ? rawEntry : {};
  const provider = String(entry.provider || 'Custom').trim() || 'Custom';
  const rawBaseUrl = String(entry.baseUrl ?? entry.base_url ?? '').trim();
  const baseUrl = rawBaseUrl || undefined;
  const createdAt = toNumericValue(entry.createdAt ?? entry.created_at, now);
  const updatedAt = toNumericValue(entry.updatedAt ?? entry.updated_at, createdAt);
  const disabled =
    typeof entry.disabled === 'boolean'
      ? entry.disabled
      : typeof entry.is_active === 'boolean'
        ? !entry.is_active
        : false;

  return {
    id: String(entry.id || '').trim(),
    key: String(entry.key || ''),
    name: String(entry.name || `${provider} Key`).trim() || `${provider} Key`,
    provider,
    type: resolveUserApiEntryType(entry, provider, baseUrl),
    format: resolveUserApiEntryFormat(entry, provider, baseUrl),
    baseUrl,
    supportedModels: toStringArray(entry.supportedModels ?? entry.supported_models),
    disabled,
    createdAt,
    updatedAt,
    status:
      entry.status === 'valid'
      || entry.status === 'invalid'
      || entry.status === 'rate_limited'
      || entry.status === 'unknown'
        ? entry.status
        : 'unknown',
    failCount: Number(entry.failCount ?? entry.fail_count ?? 0),
    successCount: Number(entry.successCount ?? entry.success_count ?? 0),
    totalCost: Number(entry.totalCost ?? entry.total_cost ?? 0),
    budgetLimit: Number.isFinite(Number(entry.budgetLimit ?? entry.budget_limit))
      ? Number(entry.budgetLimit ?? entry.budget_limit)
      : -1,
    tokenLimit: Number.isFinite(Number(entry.tokenLimit ?? entry.token_limit))
      ? Number(entry.tokenLimit ?? entry.token_limit)
      : -1,
    usedTokens: Number(entry.usedTokens ?? entry.used_tokens ?? 0),
    lastUsed:
      entry.lastUsed == null && entry.last_used == null
        ? null
        : toNumericValue(entry.lastUsed ?? entry.last_used, now),
    lastError:
      entry.lastError == null && entry.last_error == null
        ? null
        : String(entry.lastError ?? entry.last_error),
  };
}

function normalizeUserApiEntryDtos(entries: unknown[]): UserApiEntryDto[] {
  return entries.map((entry) => normalizeUserApiEntryDto(entry));
}

function upsertArrayRecordById(
  existing: unknown[],
  nextRecord: JsonRecord,
): unknown[] {
  const targetId = normalizeRecordId(nextRecord);
  if (!targetId) {
    return [...existing, nextRecord];
  }

  let matched = false;
  const merged = existing.map((item) => {
    if (normalizeRecordId(item) !== targetId || !isRecord(item)) {
      return item;
    }

    matched = true;
    return {
      ...item,
      ...nextRecord,
    };
  });

  if (matched) {
    return merged;
  }

  return [...merged, nextRecord];
}

function shouldReusePersistedSecret(value: unknown): boolean {
  if (value == null) {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  return normalized.length === 0
    || normalized === CLIENT_VISIBLE_SECRET_PLACEHOLDER
    || isRedactedSecretPlaceholder(normalized);
}

function mergeRecordArrayWithPersistedSecret(
  existing: unknown[],
  next: unknown[],
  secretField?: 'key' | 'apiKey',
): unknown[] {
  const existingById = new Map<string, JsonRecord>();

  existing.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const id = normalizeRecordId(item);
    if (!id) {
      return;
    }

    existingById.set(id, item);
  });

  return next.map((item) => {
    if (!isRecord(item)) {
      return item;
    }

    const id = normalizeRecordId(item);
    if (!id) {
      return item;
    }

    const persisted = existingById.get(id);
    if (!persisted) {
      return item;
    }

    const merged: JsonRecord = {
      ...persisted,
      ...item,
    };

    if (secretField && shouldReusePersistedSecret(item[secretField])) {
      merged[secretField] = persisted[secretField];
    }

    return merged;
  });
}

function arraysEqual(left: unknown[], right: unknown[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createLegacyFallbackProfileContext(
  expectedUserId?: string,
): AuthenticatedProfileContext {
  return {
    userId: String(expectedUserId || LOCAL_RUNTIME_FALLBACK_USER_ID).trim() || LOCAL_RUNTIME_FALLBACK_USER_ID,
    email: null,
  };
}

function shouldPreferSessionlessLegacyContext(): boolean {
  const legacyFallbackState = getLegacyWebApiFallbackState();
  return legacyFallbackState.enabled
    && (
      legacyFallbackState.reason === 'local-loopback'
      || legacyFallbackState.reason === 'local-private-network'
    );
}

async function getAuthenticatedProfileContext(
  expectedUserId?: string,
): Promise<AuthenticatedProfileContext | null> {
  if (shouldPreferSessionlessLegacyContext()) {
    return createLegacyFallbackProfileContext(expectedUserId);
  }

  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) {
    throw new Error(getErrorMessage(sessionResult.error, 'Failed to resolve authenticated user session.'));
  }

  const sessionUser = sessionResult.data.session?.user;
  const resolvedUser = sessionUser || await (async () => {
    const userResult = await supabase.auth.getUser();
    if (userResult.error) {
      const message = getErrorMessage(userResult.error, '').toLowerCase();
      if (message.includes('auth session missing') || message.includes('session') && message.includes('missing')) {
        return null;
      }

      throw new Error(getErrorMessage(userResult.error, 'Failed to resolve authenticated user profile.'));
    }

    return userResult.data.user ?? null;
  })();
  const userId = String(resolvedUser?.id || '').trim();
  if (!userId) {
    if (shouldUseLegacyWebApiFallback()) {
      return createLegacyFallbackProfileContext(expectedUserId);
    }
    return null;
  }

  if (expectedUserId && expectedUserId !== userId) {
    return null;
  }

  return {
    userId,
    email: resolvedUser?.email ?? null,
  };
}

async function loadUserApisPayloadViaApi(
  context: AuthenticatedProfileContext,
  options?: {
    preferUserApiEntries?: boolean;
  },
): Promise<UserApisEnvelope> {
  const [keyManagerResponse, userApiEntriesResponse] = await Promise.all([
    legacyWebApiClient.getKeyManagerCloudState(),
    legacyWebApiClient.getUserApiEntries(),
  ]);

  const keyManagerState = unwrapOrUndefined(keyManagerResponse);
  const userApiEntries = unwrapOrUndefined(userApiEntriesResponse);
  const combinedApiPayload =
    keyManagerState || userApiEntries
      ? combineUserApisEnvelopeSources(keyManagerState, userApiEntries, options)
      : null;

  if (combinedApiPayload) {
    return normalizeEnvelope(combinedApiPayload);
  }

  throw new Error(
    getApiFailureMessage(keyManagerResponse)
    || getApiFailureMessage(userApiEntriesResponse)
    || `Failed to load user API payload for ${context.userId}.`,
  );
}

async function loadUserApisPayloadRaw(
  expectedUserId?: string,
): Promise<UserApisEnvelope | null> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    return null;
  }

  const cachedPayload = getCachedUserApisPayload(context.userId);
  if (cachedPayload !== undefined) {
    return cachedPayload;
  }

  const existingInFlight = userApisPayloadInFlight.get(context.userId);
  if (existingInFlight) {
    return await existingInFlight;
  }

  const loadPromise = loadUserApisPayloadViaApi(context)
    .then((payload) => setCachedUserApisPayload(context.userId, payload) ?? payload)
    .finally(() => {
      userApisPayloadInFlight.delete(context.userId);
    });

  userApisPayloadInFlight.set(context.userId, loadPromise);
  return await loadPromise;
}

async function persistUserApisPayloadViaApi(
  context: AuthenticatedProfileContext,
  payload: UserApisEnvelope,
  existingPayloadInput?: UserApisEnvelope | null,
): Promise<UserApisEnvelope> {
  const existingPayload = normalizeEnvelope(
    existingPayloadInput ?? await loadUserApisPayloadRaw(context.userId),
  );
  const compactExistingPayload = compactUserApisPayloadForTransport(existingPayload, {
    maxBytes: Number.POSITIVE_INFINITY,
  });
  const compactNextPayload = compactUserApisPayloadForTransport(payload);
  const persistablePayload: UserApisEnvelope = {
    version: compactNextPayload.version,
    slots: mergeRecordArrayWithPersistedSecret(compactExistingPayload.slots, compactNextPayload.slots, 'key'),
    providers: mergeRecordArrayWithPersistedSecret(compactExistingPayload.providers, compactNextPayload.providers, 'apiKey'),
    entries: mergeRecordArrayWithPersistedSecret(compactExistingPayload.entries, compactNextPayload.entries, 'key'),
  };

  const slotsChanged =
    persistablePayload.version !== compactExistingPayload.version
    || !arraysEqual(persistablePayload.slots, compactExistingPayload.slots)
    || !arraysEqual(persistablePayload.providers, compactExistingPayload.providers);
  const entriesChanged = !arraysEqual(persistablePayload.entries, compactExistingPayload.entries);

  if (!slotsChanged && !entriesChanged) {
    return setCachedUserApisPayload(context.userId, compactExistingPayload) || normalizeEnvelope(compactExistingPayload);
  }

  invalidateCachedUserApisPayload(context.userId);

  const unifiedResponse = await legacyWebApiClient.replaceUserApisPayload({
    version: persistablePayload.version,
    slots: persistablePayload.slots as JsonRecord[],
    providers: persistablePayload.providers as JsonRecord[],
    entries: normalizeUserApiEntryDtos(persistablePayload.entries),
  });
  if (unifiedResponse.success) {
    const latestPayload = normalizeEnvelope(unifiedResponse.data as KeyManagerCloudStateDto);
    return setCachedUserApisPayload(context.userId, latestPayload) ?? latestPayload;
  }

  if (!isUnifiedUserApisPayloadEndpointUnavailable(unifiedResponse)) {
    throw new Error(unifiedResponse.error?.message || 'Failed to save user API payload.');
  }

  if (slotsChanged) {
    const response = await legacyWebApiClient.replaceKeyManagerCloudState({
      version: persistablePayload.version,
      slots: persistablePayload.slots as JsonRecord[],
      providers: persistablePayload.providers as JsonRecord[],
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to save key-manager cloud state.');
    }
  }

  if (entriesChanged) {
    const response = await legacyWebApiClient.replaceUserApiEntries({
      entries: normalizeUserApiEntryDtos(persistablePayload.entries),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to save user API entries.');
    }
  }

  const latestPayload =
    await loadUserApisPayloadViaApi(context, { preferUserApiEntries: true })
      .catch(() => persistablePayload);

  return setCachedUserApisPayload(context.userId, latestPayload) ?? latestPayload;
}

export async function loadUserApisPayloadMetadataFromCloudRecord(
  expectedUserId?: string,
): Promise<unknown | null> {
  const payload = await loadUserApisPayloadRaw(expectedUserId);
  return payload ? sanitizeClientVisibleEnvelope(payload) : null;
}

export function getUserApisPayloadDensity(rawPayload: unknown): number {
  return (
    extractKeyManagerCloudSlots(rawPayload).length
    + extractUserApiProvidersFromPayload(rawPayload).length
    + extractUserApiEntriesFromPayload(rawPayload).length
  );
}

export function combineUserApisEnvelopeSources(
  keyManagerStateRaw: unknown,
  userApiEntriesRaw?: unknown,
  options?: {
    preferUserApiEntries?: boolean;
  },
): UserApisEnvelope {
  const keyManagerState = normalizeEnvelope(keyManagerStateRaw);
  const userApiEntries = toArray(
    isUserApisEnvelope(userApiEntriesRaw)
      ? (userApiEntriesRaw as Record<string, unknown>).entries
      : (userApiEntriesRaw as { entries?: unknown[] } | null | undefined)?.entries
        ?? extractUserApiEntriesFromPayload(userApiEntriesRaw),
  );

  const entries =
    options?.preferUserApiEntries
      ? (userApiEntries.length > 0 ? userApiEntries : keyManagerState.entries)
      : (keyManagerState.entries.length > 0 ? keyManagerState.entries : userApiEntries);

  return {
    version: keyManagerState.version,
    slots: keyManagerState.slots,
    providers: keyManagerState.providers,
    entries,
  };
}

export async function loadUserApisPayloadFromCloudRecord(
  expectedUserId?: string,
): Promise<unknown | null> {
  const payload = await loadUserApisPayloadRaw(expectedUserId);
  return payload ? sanitizeClientVisibleEnvelope(payload) : null;
}

export async function saveUserApisPayloadToCloudRecord(
  rawPayload: unknown,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('An authenticated session is required to save user API data.');
  }

  const payload = normalizeEnvelope(rawPayload);
  return persistUserApisPayloadViaApi(context, payload);
}

export async function upsertUserApiSlotToCloudRecord(
  slotInput: Record<string, unknown>,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('An authenticated session is required to save official endpoint settings.');
  }

  const slotId = String(slotInput.id || '').trim();
  if (!slotId) {
    throw new Error('Official endpoint id is required before saving settings.');
  }

  const existingPayload = normalizeEnvelope(
    await loadUserApisPayloadRaw(context.userId),
  );
  const existingSlots = existingPayload.slots.filter(isRecord);
  const existingSlot = existingSlots.find((item) => normalizeRecordId(item) === slotId);
  const nextSlot: JsonRecord = {
    ...(existingSlot || {}),
    ...slotInput,
    id: slotId,
  };

  if (existingSlot && shouldReusePersistedSecret(slotInput.key)) {
    nextSlot.key = existingSlot.key;
  }

  if (!existingSlot && shouldReusePersistedSecret(nextSlot.key)) {
    throw new Error('A real API key is required when creating a new official endpoint.');
  }

  const nextPayload: UserApisEnvelope = {
    ...existingPayload,
    slots: upsertArrayRecordById(existingPayload.slots, nextSlot),
  };

  return persistUserApisPayloadViaApi(context, nextPayload, existingPayload);
}

export async function removeUserApiSlotFromCloudRecord(
  slotId: string,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('An authenticated session is required to remove official endpoint settings.');
  }

  const normalizedSlotId = String(slotId || '').trim();
  if (!normalizedSlotId) {
    throw new Error('Official endpoint id is required before removing settings.');
  }

  const existingPayload = normalizeEnvelope(
    await loadUserApisPayloadRaw(context.userId),
  );
  const nextPayload: UserApisEnvelope = {
    ...existingPayload,
    slots: existingPayload.slots.filter((item) => normalizeRecordId(item) !== normalizedSlotId),
  };

  return persistUserApisPayloadViaApi(context, nextPayload, existingPayload);
}

export async function upsertUserApiProviderToCloudRecord(
  providerInput: Record<string, unknown>,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('An authenticated session is required to save provider settings.');
  }

  const providerId = String(providerInput.id || '').trim();
  if (!providerId) {
    throw new Error('Provider id is required before saving provider settings.');
  }

  const existingPayload = normalizeEnvelope(
    await loadUserApisPayloadRaw(context.userId),
  );
  const existingProviders = existingPayload.providers.filter(isRecord);
  const existingProvider = existingProviders.find((item) => normalizeRecordId(item) === providerId);
  const nextProvider: JsonRecord = {
    ...(existingProvider || {}),
    ...providerInput,
    id: providerId,
  };

  if (existingProvider && shouldReusePersistedSecret(providerInput.apiKey)) {
    nextProvider.apiKey = existingProvider.apiKey;
  }

  if (shouldReusePersistedSecret(nextProvider.apiKey) && !existingProvider) {
    throw new Error('A real API key is required when creating a new provider.');
  }

  const nextPayload: UserApisEnvelope = {
    ...existingPayload,
    providers: upsertArrayRecordById(existingPayload.providers, nextProvider),
  };

  return persistUserApisPayloadViaApi(context, nextPayload, existingPayload);
}

export async function removeUserApiProviderFromCloudRecord(
  providerId: string,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('An authenticated session is required to remove provider settings.');
  }

  const normalizedProviderId = String(providerId || '').trim();
  if (!normalizedProviderId) {
    throw new Error('Provider id is required before removing provider settings.');
  }

  const existingPayload = normalizeEnvelope(
    await loadUserApisPayloadRaw(context.userId),
  );
  const nextPayload: UserApisEnvelope = {
    ...existingPayload,
    providers: existingPayload.providers.filter((item) => normalizeRecordId(item) !== normalizedProviderId),
  };

  return persistUserApisPayloadViaApi(context, nextPayload, existingPayload);
}

export async function mergeUserApisPayloadToCloudRecord(
  updates: {
    slots?: unknown[];
    providers?: unknown[];
    entries?: unknown[];
  },
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('An authenticated session is required to save user API data.');
  }

  const existingPayload = await loadUserApisPayloadRaw(context.userId);
  const mergedPayload = mergeUserApisPayload(existingPayload, updates);
  return persistUserApisPayloadViaApi(
    context,
    normalizeEnvelope(mergedPayload),
    normalizeEnvelope(existingPayload),
  );
}
