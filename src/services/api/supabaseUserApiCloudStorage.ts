import { supabase } from '../../lib/supabase.ts';
import { legacyWebApiClient } from './kkApiClient.ts';
import { assertKkApiUserDataWritable } from './kkApiServerHealth.ts';
import {
  extractKeyManagerCloudSlots,
  extractUserApiEntriesFromPayload,
  extractUserApiProvidersFromPayload,
  isUserApisEnvelope,
  mergeUserApisPayload,
} from './userApiPayload.ts';

interface AuthenticatedProfileContext {
  userId: string;
}

interface ProfileUserApisRow {
  user_apis: unknown;
}

export interface UserApisEnvelope {
  version: number;
  slots: unknown[];
  providers: unknown[];
  entries: unknown[];
}

type JsonRecord = Record<string, unknown>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

function unwrapOrThrow<T>(
  response: {
    success: boolean;
    data?: T;
    error?: { message?: string | null };
  },
  fallback: string,
): T {
  if (response.success) {
    return response.data as T;
  }

  throw new Error(response.error?.message || fallback);
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

function isEncryptedSecretEnvelope(value: unknown): boolean {
  return isRecord(value) && value.__kkUserApiSecret === true;
}

function payloadHasEncryptedSecrets(rawPayload: unknown): boolean {
  const payload = normalizeEnvelope(rawPayload);

  const slotsContainEncryptedKey = payload.slots.some((slot) => isRecord(slot) && isEncryptedSecretEnvelope(slot.key));
  const providersContainEncryptedKey = payload.providers.some((provider) => isRecord(provider) && isEncryptedSecretEnvelope(provider.apiKey));
  const entriesContainEncryptedKey = payload.entries.some((entry) => isRecord(entry) && isEncryptedSecretEnvelope(entry.key));

  return slotsContainEncryptedKey || providersContainEncryptedKey || entriesContainEncryptedKey;
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

async function getAuthenticatedProfileContext(
  expectedUserId?: string,
): Promise<AuthenticatedProfileContext | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(getErrorMessage(error, 'Failed to resolve Supabase user session.'));
  }

  const userId = String(data.user?.id || '').trim();
  if (!userId) {
    return null;
  }

  if (expectedUserId && expectedUserId !== userId) {
    return null;
  }

  return { userId };
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

  const directProfilePayload = await loadUserApisPayloadDirectlyFromProfile(context.userId);
  const directProfileDensity = getUserApisPayloadDensity(directProfilePayload);
  const directProfileHasEncryptedSecrets = payloadHasEncryptedSecrets(directProfilePayload);

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

  if (directProfileDensity > 0 && !directProfileHasEncryptedSecrets) {
    return normalizeEnvelope(directProfilePayload);
  }

  if (directProfileDensity > 0 && directProfileHasEncryptedSecrets) {
    throw new Error(
      'Supabase profile contains encrypted user_apis payload, but the local API server is not available to decrypt it.',
    );
  }

  if (!keyManagerState && !userApiEntries) {
    throw new Error(
      getApiFailureMessage(keyManagerResponse)
      || getApiFailureMessage(userApiEntriesResponse)
      || 'Failed to load key-manager cloud state.',
    );
  }

  return combinedApiPayload;
}

export async function saveUserApisPayloadViaSupabase(
  rawPayload: unknown,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('Authenticated Supabase session is required to save user_apis.');
  }

  await assertKkApiUserDataWritable();

  const payload = normalizeEnvelope(rawPayload);
  const keyManagerStateResponse = await legacyWebApiClient.replaceKeyManagerCloudState({
      version: payload.version,
      slots: payload.slots as Record<string, unknown>[],
      providers: payload.providers as Record<string, unknown>[],
    });
  const keyManagerState = unwrapOrThrow(
    keyManagerStateResponse,
    'Failed to save key-manager cloud state.',
  ) as {
    version?: number;
    slots?: unknown[];
    providers?: unknown[];
    entries?: unknown[];
  };

  const userApiResponse = await legacyWebApiClient.replaceUserApiEntries({
      entries: payload.entries as any[],
    });
  const userApiState = unwrapOrThrow(
    userApiResponse,
    'Failed to save user API entries.',
  ) as {
    entries?: unknown[];
  };

  return combineUserApisEnvelopeSources(
    {
      version: Number(keyManagerState.version || payload.version || 2),
      slots: toArray(keyManagerState.slots),
      providers: toArray(keyManagerState.providers),
      entries: toArray(keyManagerState.entries),
    },
    { entries: toArray(userApiState.entries) },
    { preferUserApiEntries: true },
  );
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
