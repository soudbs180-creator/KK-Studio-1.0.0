import { supabase } from '../../lib/supabase';
import {
  extractKeyManagerCloudSlots,
  extractUserApiEntriesFromPayload,
  extractUserApiProvidersFromPayload,
  mergeUserApisPayload,
} from './userApiPayload';

type JsonRecord = Record<string, unknown>;

interface ProfileUserApisRow {
  id: string;
  email?: string | null;
  user_apis?: unknown;
}

interface AuthenticatedProfileContext {
  userId: string;
  email?: string | null;
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

  return {
    userId,
    email: data.user?.email ?? null,
  };
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

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, user_apis')
    .eq('id', context.userId)
    .maybeSingle<ProfileUserApisRow>();

  if (error) {
    throw new Error(getErrorMessage(error, 'Failed to load user_apis from Supabase.'));
  }

  return data?.user_apis ?? [];
}

export async function saveUserApisPayloadViaSupabase(
  rawPayload: unknown,
  expectedUserId?: string,
): Promise<unknown> {
  const context = await getAuthenticatedProfileContext(expectedUserId);
  if (!context) {
    throw new Error('Authenticated Supabase session is required to save user_apis.');
  }

  const upsertRow: JsonRecord = {
    id: context.userId,
    email: context.email ?? null,
    user_apis: rawPayload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(upsertRow, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })
    .select('id, email, user_apis')
    .maybeSingle<ProfileUserApisRow>();

  if (error) {
    throw new Error(getErrorMessage(error, 'Failed to save user_apis to Supabase.'));
  }

  return data?.user_apis ?? rawPayload;
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
