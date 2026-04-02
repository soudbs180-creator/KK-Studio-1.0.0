import { supabase } from '../../lib/supabase.ts';
import { legacyWebApiClient, shouldUseLegacyWebApiFallback } from './kkApiClient.ts';
import {
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

interface ProfileUserApisRow {
  id?: string;
  email?: string | null;
  user_apis: unknown;
}

export interface UserApisEnvelope {
  version: number;
  slots: unknown[];
  providers: unknown[];
  entries: unknown[];
}

type JsonRecord = Record<string, unknown>;

const USER_APIS_PAYLOAD_CACHE_TTL_MS = 15_000;

const userApisPayloadCache = new Map<string, {
  payload: UserApisEnvelope | null;
  expiresAt: number;
}>();
const userApisPayloadInFlight = new Map<string, Promise<unknown | null>>();

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

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function toClientVisibleSecret(value: unknown): unknown {
  if (!isEncryptedSecretEnvelope(value)) {
    return value;
  }

  return 'sk-readonly-0000';
}

function sanitizeClientVisibleEnvelope(payload: UserApisEnvelope): UserApisEnvelope {
  const sanitizeItems = (
    items: unknown[],
    secretField: 'key' | 'apiKey',
  ): unknown[] => items.map((item) => {
    if (!isRecord(item)) {
      return item;
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

function payloadHasEncryptedSecrets(rawPayload: unknown): boolean {
  const payload = normalizeEnvelope(rawPayload);

  const slotsContainEncryptedKey = payload.slots.some((slot) => isRecord(slot) && isEncryptedSecretEnvelope(slot.key));
  const providersContainEncryptedKey = payload.providers.some((provider) => isRecord(provider) && isEncryptedSecretEnvelope(provider.apiKey));
  const entriesContainEncryptedKey = payload.entries.some((entry) => isRecord(entry) && isEncryptedSecretEnvelope(entry.key));

  return slotsContainEncryptedKey || providersContainEncryptedKey || entriesContainEncryptedKey;
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

async function loadUserApisPayloadDirectlyFromProfile(
  userId: string,
): Promise<unknown | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_apis')
    .eq('id', userId)
    .maybeSingle<ProfileUserApisRow>();

  if (error) {
    throw error;
  }

  return data?.user_apis ?? null;
}

async function saveUserApisPayloadDirectlyToProfile(
  userId: string,
  rawPayload: unknown,
): Promise<void> {
  const sessionSnapshot = await getAuthenticatedProfileContext(userId);
  const email = sessionSnapshot?.email ?? null;
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email,
      user_apis: rawPayload,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

  if (error) {
    throw error;
  }
}

export async function loadUserApisPayloadMetadataViaSupabase(
  expectedUserId?: string,
): Promise<unknown | null> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    return null;
  }

  const directProfilePayload = await loadUserApisPayloadDirectlyFromProfile(context.userId);
  return normalizeEnvelope(directProfilePayload);
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
  return normalized.length === 0 || normalized === 'sk-readonly-0000' || normalized.startsWith('__kk_redacted__:');
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

async function saveNormalizedUserApisPayloadDirectlyToProfile(
  userId: string,
  payload: UserApisEnvelope,
): Promise<UserApisEnvelope> {
  const existingPayload = normalizeEnvelope(
    await loadUserApisPayloadDirectlyFromProfile(userId),
  );
  const persistablePayload: UserApisEnvelope = {
    version: payload.version,
    slots: mergeRecordArrayWithPersistedSecret(existingPayload.slots, payload.slots, 'key'),
    providers: mergeRecordArrayWithPersistedSecret(existingPayload.providers, payload.providers, 'apiKey'),
    entries: mergeRecordArrayWithPersistedSecret(existingPayload.entries, payload.entries, 'key'),
  };

  await saveUserApisPayloadDirectlyToProfile(userId, persistablePayload);
  invalidateCachedUserApisPayload(userId);
  return persistablePayload;
}

async function getAuthenticatedProfileContext(
  expectedUserId?: string,
): Promise<AuthenticatedProfileContext | null> {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) {
    throw new Error(getErrorMessage(sessionResult.error, 'Failed to resolve Supabase user session.'));
  }

  const sessionUser = sessionResult.data.session?.user;
  const resolvedUser = sessionUser || await (async () => {
    const userResult = await supabase.auth.getUser();
    if (userResult.error) {
      const message = getErrorMessage(userResult.error, '').toLowerCase();
      if (message.includes('auth session missing') || message.includes('session') && message.includes('missing')) {
        return null;
      }

      throw new Error(getErrorMessage(userResult.error, 'Failed to resolve Supabase user profile.'));
    }

    return userResult.data.user ?? null;
  })();
  const userId = String(resolvedUser?.id || '').trim();
  if (!userId) {
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

export async function loadUserApisPayloadViaSupabase(
  expectedUserId?: string,
): Promise<unknown | null> {
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

  const loadPromise = (async (): Promise<unknown | null> => {
    const directProfilePayload = await loadUserApisPayloadDirectlyFromProfile(context.userId);
    const directProfileDensity = getUserApisPayloadDensity(directProfilePayload);
    const directProfileHasEncryptedSecrets = payloadHasEncryptedSecrets(directProfilePayload);

    if (directProfileDensity > 0 && !directProfileHasEncryptedSecrets) {
      return normalizeEnvelope(directProfilePayload);
    }

    if (!shouldUseLegacyWebApiFallback()) {
      if (directProfileDensity > 0 && directProfileHasEncryptedSecrets) {
        return sanitizeClientVisibleEnvelope(normalizeEnvelope(directProfilePayload));
      }

      return null;
    }

    const [keyManagerResponse, userApiEntriesResponse] = await Promise.all([
      legacyWebApiClient.getKeyManagerCloudState(),
      legacyWebApiClient.getUserApiEntries(),
    ]);

    const keyManagerState = unwrapOrUndefined(
      keyManagerResponse,
    );
    const userApiEntries = unwrapOrUndefined(
      userApiEntriesResponse,
    );
    const combinedApiPayload =
      keyManagerState || userApiEntries
        ? combineUserApisEnvelopeSources(keyManagerState, userApiEntries)
        : null;
    const combinedApiDensity = getUserApisPayloadDensity(combinedApiPayload);

    if (combinedApiDensity > 0) {
      return combinedApiPayload;
    }

    if (directProfileDensity > 0 && directProfileHasEncryptedSecrets) {
      return sanitizeClientVisibleEnvelope(normalizeEnvelope(directProfilePayload));
    }

    if (!keyManagerState && !userApiEntries) {
      throw new Error(
        getApiFailureMessage(keyManagerResponse)
        || getApiFailureMessage(userApiEntriesResponse)
        || 'Failed to load key-manager cloud state.',
      );
    }

    return combinedApiPayload;
  })()
    .then((payload) => setCachedUserApisPayload(context.userId, payload))
    .finally(() => {
      userApisPayloadInFlight.delete(context.userId);
    });

  userApisPayloadInFlight.set(context.userId, loadPromise);
  return await loadPromise;
}

export async function saveUserApisPayloadViaSupabase(
  rawPayload: unknown,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('Authenticated Supabase session is required to save user_apis.');
  }

  const payload = normalizeEnvelope(rawPayload);
  return saveNormalizedUserApisPayloadDirectlyToProfile(context.userId, payload);
}

export async function upsertUserApiSlotViaSupabase(
  slotInput: Record<string, unknown>,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('Authenticated Supabase session is required to save official endpoint settings.');
  }

  const slotId = String(slotInput.id || '').trim();
  if (!slotId) {
    throw new Error('Official endpoint id is required before saving settings.');
  }

  const existingPayload = normalizeEnvelope(
    await loadUserApisPayloadDirectlyFromProfile(context.userId),
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

  return saveNormalizedUserApisPayloadDirectlyToProfile(context.userId, nextPayload);
}

export async function removeUserApiSlotViaSupabase(
  slotId: string,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('Authenticated Supabase session is required to remove official endpoint settings.');
  }

  const normalizedSlotId = String(slotId || '').trim();
  if (!normalizedSlotId) {
    throw new Error('Official endpoint id is required before removing settings.');
  }

  const existingPayload = normalizeEnvelope(
    await loadUserApisPayloadDirectlyFromProfile(context.userId),
  );
  const nextPayload: UserApisEnvelope = {
    ...existingPayload,
    slots: existingPayload.slots.filter((item) => normalizeRecordId(item) !== normalizedSlotId),
  };

  return saveNormalizedUserApisPayloadDirectlyToProfile(context.userId, nextPayload);
}

export async function upsertUserApiProviderViaSupabase(
  providerInput: Record<string, unknown>,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('Authenticated Supabase session is required to save provider settings.');
  }

  const providerId = String(providerInput.id || '').trim();
  if (!providerId) {
    throw new Error('Provider id is required before saving provider settings.');
  }

  const existingPayload = normalizeEnvelope(
    await loadUserApisPayloadDirectlyFromProfile(context.userId),
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

  if (!isEncryptedSecretEnvelope(nextProvider.apiKey) && shouldReusePersistedSecret(nextProvider.apiKey)) {
    throw new Error('A real API key is required when creating a new provider.');
  }

  const nextPayload: UserApisEnvelope = {
    ...existingPayload,
    providers: upsertArrayRecordById(existingPayload.providers, nextProvider),
  };

  return saveNormalizedUserApisPayloadDirectlyToProfile(context.userId, nextPayload);
}

export async function removeUserApiProviderViaSupabase(
  providerId: string,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('Authenticated Supabase session is required to remove provider settings.');
  }

  const normalizedProviderId = String(providerId || '').trim();
  if (!normalizedProviderId) {
    throw new Error('Provider id is required before removing provider settings.');
  }

  const existingPayload = normalizeEnvelope(
    await loadUserApisPayloadDirectlyFromProfile(context.userId),
  );
  const nextPayload: UserApisEnvelope = {
    ...existingPayload,
    providers: existingPayload.providers.filter((item) => normalizeRecordId(item) !== normalizedProviderId),
  };

  return saveNormalizedUserApisPayloadDirectlyToProfile(context.userId, nextPayload);
}

export async function mergeUserApisPayloadViaSupabase(
  updates: {
    slots?: unknown[];
    providers?: unknown[];
    entries?: unknown[];
  },
  expectedUserId?: string,
): Promise<unknown> {
  const existingPayload = await loadUserApisPayloadViaSupabase(expectedUserId);
  const mergedPayload = mergeUserApisPayload(existingPayload, updates);
  return saveUserApisPayloadViaSupabase(mergedPayload, expectedUserId);
}
