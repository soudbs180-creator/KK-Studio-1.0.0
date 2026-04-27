import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { legacyWebApiClient } from '../../src/services/api/kkApiClient.ts';
import {
  clearPersistedRuntimeAuthState,
  persistRuntimeAuthState,
} from '../../src/services/auth/runtimeAuthState.ts';
import { resetUserApisPayloadCacheForTests } from '../../src/services/api/userApiCloudRecordStorage.ts';
import {
  loadUserApiEntries,
  resetUserApiProfileStorageStateForTests,
  saveUserApiEntries,
} from '../../src/services/api/userApiProfileStorage.ts';

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
  resetUserApisPayloadCacheForTests();
  resetUserApiProfileStorageStateForTests();
});

describe('user api profile storage runtime fallback', () => {
  test('loads user API entries from the typed auth API on hosted runtimes', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'https://kk-studio.vercel.app' };
    mockAuthenticatedUser();

    let keyManagerCalls = 0;
    let userApiCalls = 0;
    legacyWebApiClient.getKeyManagerCloudState = async () => {
      keyManagerCalls += 1;
      return {
        success: true,
        data: {
          version: 2,
          slots: [],
          providers: [],
          entries: [],
        },
      };
    };
    legacyWebApiClient.getUserApiEntries = async () => {
      userApiCalls += 1;
      return {
        success: true,
        data: {
          entries: [
            {
              ...createEntry('entry-1'),
              key: '__kk_redacted__:key:entry-1',
            },
          ],
        },
      };
    };

    const entries = await loadUserApiEntries();

    assert.equal(keyManagerCalls, 1);
    assert.equal(userApiCalls, 1);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'entry-1');
    assert.equal(entries[0].key, '__kk_redacted__:key:entry-1');
  });

  test('saves user API entries through the typed auth API on hosted runtimes', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'https://kk-studio.vercel.app' };
    mockAuthenticatedUser();

    let keyManagerCalls = 0;
    let userApiReads = 0;
    let unifiedWrites = 0;
    let persistedEntries: Array<Record<string, unknown>> = [];

    legacyWebApiClient.getKeyManagerCloudState = async () => {
      keyManagerCalls += 1;
      return {
        success: true,
        data: {
          version: 2,
          slots: [],
          providers: [],
          entries: [],
        },
      };
    };
    legacyWebApiClient.getUserApiEntries = async () => {
      userApiReads += 1;
      return {
        success: true,
        data: {
          entries: persistedEntries,
        },
      };
    };
    legacyWebApiClient.replaceKeyManagerCloudState = async () => {
      throw new Error('key-manager state should stay unchanged when only entry rows change');
    };
    legacyWebApiClient.replaceUserApiEntries = async () => {
      throw new Error('split entry writes should stay unused when the unified payload route is available');
    };
    legacyWebApiClient.replaceUserApisPayload = async (input) => {
      unifiedWrites += 1;
      persistedEntries = (input.entries as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        key: `__kk_redacted__:key:${String(entry.id || '')}`,
      }));
      return {
        success: true,
        data: {
          version: Number(input.version || 2),
          slots: input.slots || [],
          providers: input.providers || [],
          entries: persistedEntries,
        },
      };
    };

    await saveUserApiEntries([createEntry('entry-2')]);

    assert.equal(unifiedWrites, 1);
    assert.equal(keyManagerCalls, 1);
    assert.equal(userApiReads, 1);
    assert.deepEqual(
      persistedEntries.map((entry) => ({
        id: entry.id,
        key: entry.key,
      })),
      [
        {
          id: 'entry-2',
          key: '__kk_redacted__:key:entry-2',
        },
      ],
    );
  });
});
