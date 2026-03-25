import { supabase } from '../../lib/supabase';
import { legacyWebApiClient } from './kkApiClient';
import {
  extractKeyManagerCloudSlots,
  extractUserApiEntriesFromPayload,
  extractUserApiProvidersFromPayload,
  isUserApisEnvelope,
  mergeUserApisPayload,
} from './userApiPayload';

interface AuthenticatedProfileContext {
  userId: string;
}

interface ProfileUserApisRow {
  user_apis: unknown;
}

interface UserApisEnvelope {
  version: number;
  slots: unknown[];
  providers: unknown[];
  entries: unknown[];
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

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

export async function loadUserApisPayloadViaSupabase(
  expectedUserId?: string,
): Promise<unknown | null> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    return null;
  }

  let directPayload: unknown = null;
  let directReadError: unknown = null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_apis')
      .eq('id', context.userId)
      .maybeSingle<ProfileUserApisRow>();

    if (error) {
      throw error;
    }

    directPayload = normalizeEnvelope(data?.user_apis);
    if (getUserApisPayloadDensity(directPayload) > 0) {
      return directPayload;
    }
  } catch (error) {
    directReadError = error;
    console.warn('[UserApisCloudStorage] Direct Supabase read failed, falling back to API route:', error);
  }

  const payload = unwrapOrThrow(
    await legacyWebApiClient.getKeyManagerCloudState(),
    'Failed to load key-manager cloud state.',
  );

  const normalizedApiPayload = normalizeEnvelope(payload);
  if (getUserApisPayloadDensity(normalizedApiPayload) > 0 || directReadError) {
    return normalizedApiPayload;
  }

  return directPayload;
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

  const keyManagerState = unwrapOrThrow(
    await legacyWebApiClient.replaceKeyManagerCloudState({
      version: payload.version,
      slots: payload.slots as Record<string, unknown>[],
      providers: payload.providers as Record<string, unknown>[],
    }),
    'Failed to save key-manager cloud state.',
  ) as {
    version?: number;
    slots?: unknown[];
    providers?: unknown[];
  };

  const userApiState = unwrapOrThrow(
    await legacyWebApiClient.replaceUserApiEntries({
      entries: payload.entries as any[],
    }),
    'Failed to save user API entries.',
  ) as {
    entries?: unknown[];
  };

  return {
    version: Number(keyManagerState.version || payload.version || 2),
    slots: toArray(keyManagerState.slots),
    providers: toArray(keyManagerState.providers),
    entries: toArray(userApiState.entries),
  };
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
