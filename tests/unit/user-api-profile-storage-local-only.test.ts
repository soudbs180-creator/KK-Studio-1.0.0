import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { legacyWebApiClient as originalClient } from '../../apps/web/src/services/api/kkApiClient.ts';
const legacyWebApiClient = originalClient as any;
import {
  clearPersistedRuntimeAuthState,
  persistRuntimeAuthState,
} from '../../apps/web/src/services/auth/runtimeAuthState.ts';
import {
  isKkApiBillingAvailableFromHealth,
  isKkApiUserDataWritableFromHealth,
} from '../../apps/web/src/services/api/kkApiServerHealth.ts';
import { saveUserApiEntries } from '../../apps/web/src/services/api/userApiProfileStorage.ts';

const originalGetKeyManagerCloudState = legacyWebApiClient.getKeyManagerCloudState;
const originalGetUserApiEntries = legacyWebApiClient.getUserApiEntries;
const originalReplaceUserApisPayload = legacyWebApiClient.replaceUserApisPayload;
const originalReplaceKeyManagerCloudState = legacyWebApiClient.replaceKeyManagerCloudState;
const originalReplaceUserApiEntries = legacyWebApiClient.replaceUserApiEntries;
const originalKkApiBaseUrl = process.env.VITE_KK_API_BASE_URL;
const locationLike = globalThis as { location?: { origin?: string } };
const originalLocation = locationLike.location;

function createRuntimeUser() {
  return {
    id: 'user-1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'user-1@example.com',
    phone: '',
    created_at: '1970-01-01T00:00:00.000Z',
    updated_at: '1970-01-01T00:00:00.000Z',
    confirmed_at: '1970-01-01T00:00:00.000Z',
    last_sign_in_at: '1970-01-01T00:00:00.000Z',
    app_metadata: {
      provider: 'password',
      providers: ['password'],
    },
    user_metadata: {
      provider: 'password',
      auth_provider: 'password',
      providers: ['password'],
      full_name: 'User One',
      display_name: 'User One',
    },
  };
}

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
  persistRuntimeAuthState({
    user: createRuntimeUser(),
    isTempUser: false,
    tempUserExpiry: null,
  });
}


afterEach(() => {
  clearPersistedRuntimeAuthState();
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
    selfHostedCoreReady: true,
    config: {
      hasPostgresConfig: false,
      hasAuthKey: true,
      hasUserApiEncryptionSecret: true,
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
      authData: false,
      authSessions: false,
      tempUsers: false,
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
    selfHostedCoreReady: true,
    config: {
      hasPostgresConfig: false,
      hasAuthKey: true,
      hasUserApiEncryptionSecret: true,
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
      authData: false,
      authSessions: false,
      tempUsers: false,
    },
    fetchedAt: Date.now(),
  }), true);
});

test('saveUserApiEntries surfaces local API failures instead of bypassing them through Supabase profile writes', async () => {
  delete process.env.VITE_KK_API_BASE_URL;
  locationLike.location = { origin: 'https://kk-studio.vercel.app' };
  mockAuthenticatedUser();

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
