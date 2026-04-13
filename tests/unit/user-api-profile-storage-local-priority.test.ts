import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { supabase } from '../../src/lib/supabase.ts';
import { setStoredKkApiAccessToken } from '../../src/services/api/authAccessToken.ts';
import { legacyWebApiClient } from '../../src/services/api/kkApiClient.ts';
import {
  loadUserApiEntries,
  saveUserApiEntries,
} from '../../src/services/api/userApiProfileStorage.ts';

const originalGetSession = supabase.auth.getSession;
const originalGetUser = supabase.auth.getUser;
const originalGetKeyManagerCloudState = legacyWebApiClient.getKeyManagerCloudState;
const originalGetUserApiEntries = legacyWebApiClient.getUserApiEntries;
const originalReplaceUserApisPayload = legacyWebApiClient.replaceUserApisPayload;
const originalReplaceKeyManagerCloudState = legacyWebApiClient.replaceKeyManagerCloudState;
const originalReplaceUserApiEntries = legacyWebApiClient.replaceUserApiEntries;
const originalKkApiBaseUrl = process.env.VITE_KK_API_BASE_URL;
const originalLegacyFallback = process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
const locationLike = globalThis as { location?: { origin?: string } };
const originalLocation = locationLike.location;

function createEntry(id: string, overrides: Partial<Record<string, unknown>> = {}) {
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
    ...overrides,
  };
}

function setLocalRuntime() {
  process.env.VITE_KK_API_BASE_URL = 'http://127.0.0.1:8787';
  process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = 'true';
  locationLike.location = {
    origin: 'http://localhost:5173',
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

afterEach(() => {
  supabase.auth.getSession = originalGetSession;
  supabase.auth.getUser = originalGetUser;
  legacyWebApiClient.getKeyManagerCloudState = originalGetKeyManagerCloudState;
  legacyWebApiClient.getUserApiEntries = originalGetUserApiEntries;
  legacyWebApiClient.replaceUserApisPayload = originalReplaceUserApisPayload;
  legacyWebApiClient.replaceKeyManagerCloudState = originalReplaceKeyManagerCloudState;
  legacyWebApiClient.replaceUserApiEntries = originalReplaceUserApiEntries;
  setStoredKkApiAccessToken(undefined);

  if (typeof originalKkApiBaseUrl === 'string') {
    process.env.VITE_KK_API_BASE_URL = originalKkApiBaseUrl;
  } else {
    delete process.env.VITE_KK_API_BASE_URL;
  }

  if (typeof originalLegacyFallback === 'string') {
    process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = originalLegacyFallback;
  } else {
    delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
  }

  locationLike.location = originalLocation;
});

test('loadUserApiEntries prefers local bridge entries when the local runtime is available', async () => {
  setLocalRuntime();
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
  legacyWebApiClient.getUserApiEntries = async () => {
    const stack = new Error().stack || '';
    const isLocalBridgeRead = stack.includes('loadLocalUserApiEntriesViaApi');
    return {
      success: true,
      data: {
        entries: [
          isLocalBridgeRead
            ? createEntry('entry-1', {
                name: 'Local Entry',
                key: 'sk-local-entry-1',
              })
            : createEntry('entry-1', {
                name: 'Cloud Entry',
                key: '__kk_redacted__:key:entry-1',
              }),
        ],
      },
    };
  };
  legacyWebApiClient.replaceUserApisPayload = async () => {
    throw new Error('background cloud convergence should stay disabled without a KK API access token');
  };

  const entries = await loadUserApiEntries();

  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, 'Local Entry');
  assert.equal(entries[0].key, 'sk-local-entry-1');
});

test('saveUserApiEntries writes the local bridge before surfacing cloud sync failures on local runtimes', async () => {
  setLocalRuntime();
  mockAuthenticatedUser();

  const callOrder: string[] = [];
  const localWrites: Array<Array<Record<string, unknown>>> = [];

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
  legacyWebApiClient.replaceUserApiEntries = async (input) => {
    callOrder.push('local');
    localWrites.push(
      (input.entries as Array<Record<string, unknown>>).map((entry) => ({ ...entry })),
    );
    return {
      success: true,
      data: {
        entries: input.entries,
      },
    };
  };
  legacyWebApiClient.replaceUserApisPayload = async () => {
    callOrder.push('cloud');
    return {
      success: false,
      error: {
        message: 'cloud write failed',
      },
    };
  };
  legacyWebApiClient.replaceKeyManagerCloudState = async () => {
    throw new Error('key-manager state should stay unchanged when only entry rows change');
  };

  await assert.rejects(
    () => saveUserApiEntries([createEntry('entry-2')]),
    /cloud write failed/,
  );

  assert.deepEqual(callOrder, ['local', 'cloud']);
  assert.equal(localWrites.length, 1);
  assert.equal(localWrites[0][0]?.id, 'entry-2');
});
