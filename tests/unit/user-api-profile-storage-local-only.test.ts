import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { supabase } from '../../src/lib/supabase.ts';
import { legacyWebApiClient } from '../../src/services/api/kkApiClient.ts';
import {
  isKkApiBillingAvailableFromHealth,
  isKkApiUserDataWritableFromHealth,
} from '../../src/services/api/kkApiServerHealth.ts';
import { saveUserApiEntries } from '../../src/services/api/userApiProfileStorage.ts';

const originalGetSession = supabase.auth.getSession;
const originalGetUser = supabase.auth.getUser;
const originalSupabaseFrom = supabase.from.bind(supabase);
const originalGetKeyManagerCloudState = legacyWebApiClient.getKeyManagerCloudState;
const originalGetUserApiEntries = legacyWebApiClient.getUserApiEntries;
const originalReplaceUserApisPayload = legacyWebApiClient.replaceUserApisPayload;
const originalReplaceKeyManagerCloudState = legacyWebApiClient.replaceKeyManagerCloudState;
const originalReplaceUserApiEntries = legacyWebApiClient.replaceUserApiEntries;
const originalKkApiBaseUrl = process.env.VITE_KK_API_BASE_URL;
const locationLike = globalThis as { location?: { origin?: string } };
const originalLocation = locationLike.location;

function createEntry(id: string) {
  return {
    id,
    key: `sk-${id}`,
    name: `Entry ${id}`,
    provider: 'Google',
    type: 'official' as const,
    format: 'gemini' as const,
    supportedModels: ['gemini-2.5-flash'],
    disabled: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    status: 'unknown' as const,
    failCount: 0,
    successCount: 0,
    totalCost: 0,
    budgetLimit: -1,
    tokenLimit: -1,
    usedTokens: 0,
    lastUsed: null,
    lastError: null,
  };
}

function mockAuthenticatedUser() {
  supabase.auth.getSession = async () =>
    ({
      data: {
        session: null,
      },
      error: null,
    }) as Awaited<ReturnType<typeof originalGetSession>>;

  supabase.auth.getUser = async () =>
    ({
      data: {
        user: {
          id: 'user-1',
          email: 'user-1@example.com',
        },
      },
      error: null,
    }) as Awaited<ReturnType<typeof originalGetUser>>;
}

function forbidSupabaseProfileFallback() {
  (supabase as unknown as { from: typeof supabase.from }).from = (() => {
    throw new Error('Supabase profile fallback should stay unused.');
  }) as typeof supabase.from;
}

afterEach(() => {
  supabase.auth.getSession = originalGetSession;
  supabase.auth.getUser = originalGetUser;
  (supabase as unknown as { from: typeof supabase.from }).from = originalSupabaseFrom;
  legacyWebApiClient.getKeyManagerCloudState = originalGetKeyManagerCloudState;
  legacyWebApiClient.getUserApiEntries = originalGetUserApiEntries;
  legacyWebApiClient.replaceUserApisPayload = originalReplaceUserApisPayload;
  legacyWebApiClient.replaceKeyManagerCloudState = originalReplaceKeyManagerCloudState;
  legacyWebApiClient.replaceUserApiEntries = originalReplaceUserApiEntries;
  if (typeof originalKkApiBaseUrl === 'string') {
    process.env.VITE_KK_API_BASE_URL = originalKkApiBaseUrl;
  } else {
    delete process.env.VITE_KK_API_BASE_URL;
  }
  locationLike.location = originalLocation;
});

test('treats local-file auth storage as writable user API persistence', () => {
  assert.equal(isKkApiUserDataWritableFromHealth({
    reachable: true,
    verified: true,
    service: 'kk-studio-api',
    status: 'ok',
    config: {
      hasSupabaseUrl: false,
      hasServiceRoleKey: false,
      hasAuthKey: true,
      hasUserApiEncryptionSecret: true,
      usingPublicUrlFallback: false,
    },
    repositories: {
      adminConsole: 'local-file',
      authData: 'local-file',
      creditAccounts: 'memory',
      creditProviders: 'memory',
      workspaceLayout: 'memory',
    },
    persistence: {
      userApiKeys: true,
      keyManager: true,
      credits: false,
      creditProviders: false,
      workspaceLayout: false,
    },
    fetchedAt: Date.now(),
  }), true);
});

test('treats local-file credit storage as readable billing persistence', () => {
  assert.equal(isKkApiBillingAvailableFromHealth({
    reachable: true,
    verified: true,
    service: 'kk-studio-api',
    status: 'ok',
    config: {
      hasSupabaseUrl: false,
      hasServiceRoleKey: false,
      hasAuthKey: true,
      hasUserApiEncryptionSecret: true,
      usingPublicUrlFallback: false,
    },
    repositories: {
      adminConsole: 'memory',
      authData: 'local-file',
      creditAccounts: 'local-file',
      creditProviders: 'memory',
      workspaceLayout: 'memory',
    },
    persistence: {
      userApiKeys: true,
      keyManager: true,
      credits: true,
      creditProviders: false,
      workspaceLayout: false,
    },
    fetchedAt: Date.now(),
  }), true);
});

test('saveUserApiEntries surfaces local API failures instead of bypassing them through Supabase profile writes', async () => {
  delete process.env.VITE_KK_API_BASE_URL;
  locationLike.location = { origin: 'https://kk-studio.vercel.app' };
  mockAuthenticatedUser();
  forbidSupabaseProfileFallback();

  legacyWebApiClient.getKeyManagerCloudState = async () => ({
    success: true,
    data: {
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    },
  });
  legacyWebApiClient.getUserApiEntries = async () => ({
    success: true,
    data: {
      entries: [],
    },
  });
  legacyWebApiClient.replaceUserApisPayload = async () => ({
    success: false,
    error: {
      code: 'NETWORK_ERROR',
      message: 'fetch failed',
    },
  });

  await assert.rejects(
    () => saveUserApiEntries([createEntry('entry-1')]),
    /fetch failed/,
  );
});
