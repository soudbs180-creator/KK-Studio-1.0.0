import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { supabase } from '../../src/lib/supabase.ts';
import { legacyWebApiClient } from '../../src/services/api/kkApiClient.ts';
import { loadUserApisPayloadViaSupabase } from '../../src/services/api/supabaseUserApiCloudStorage.ts';
import {
  loadUserApiEntries,
  saveUserApiEntries,
} from '../../src/services/api/userApiProfileStorage.ts';

const originalGetSession = supabase.auth.getSession;
const originalGetUser = supabase.auth.getUser;
const originalGetKeyManagerCloudState = legacyWebApiClient.getKeyManagerCloudState;
const originalGetUserApiEntries = legacyWebApiClient.getUserApiEntries;
const originalReplaceKeyManagerCloudState = legacyWebApiClient.replaceKeyManagerCloudState;
const originalReplaceUserApiEntries = legacyWebApiClient.replaceUserApiEntries;
const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
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

function setProductionRuntime() {
  delete process.env.VITE_KK_API_BASE_URL;
  locationLike.location = {
    origin: 'https://kk-studio.vercel.app',
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
  legacyWebApiClient.replaceKeyManagerCloudState = originalReplaceKeyManagerCloudState;
  legacyWebApiClient.replaceUserApiEntries = originalReplaceUserApiEntries;

  if (typeof originalBaseUrl === 'string') {
    process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
  } else {
    delete process.env.VITE_KK_API_BASE_URL;
  }

  locationLike.location = originalLocation;
});

test('loadUserApisPayloadViaSupabase uses the typed auth API on non-local runtimes', async () => {
  setProductionRuntime();
  mockAuthenticatedUser();

  let keyManagerCalls = 0;
  let userApiCalls = 0;
  legacyWebApiClient.getKeyManagerCloudState = async () => {
    keyManagerCalls += 1;
    return {
      success: true,
      data: {
        version: 2,
        slots: [{ id: 'slot-1' }],
        providers: [{ id: 'provider-1' }],
        entries: [],
      },
    };
  };
  legacyWebApiClient.getUserApiEntries = async () => {
    userApiCalls += 1;
    return {
      success: true,
      data: {
        entries: [createEntry('entry-1')],
      },
    };
  };

  const payload = await loadUserApisPayloadViaSupabase();

  assert.deepEqual(payload, {
    version: 2,
    slots: [{ id: 'slot-1' }],
    providers: [{ id: 'provider-1' }],
    entries: [createEntry('entry-1')],
  });
  assert.equal(keyManagerCalls, 1);
  assert.equal(userApiCalls, 1);
});

test('loadUserApiEntries reads the typed auth API payload without seeding the local compatibility bridge on production runtimes', async () => {
  setProductionRuntime();
  mockAuthenticatedUser();

  let keyManagerCalls = 0;
  let getUserApiCalls = 0;
  let replaceUserApiCalls = 0;
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
    getUserApiCalls += 1;
    return {
      success: true,
      data: {
        entries: [createEntry('entry-1')],
      },
    };
  };
  legacyWebApiClient.replaceUserApiEntries = async () => {
    replaceUserApiCalls += 1;
    throw new Error('compatibility bridge writes should stay unused');
  };

  const entries = await loadUserApiEntries();

  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'entry-1');
  assert.equal(keyManagerCalls, 1);
  assert.equal(getUserApiCalls, 1);
  assert.equal(replaceUserApiCalls, 0);
});

test('saveUserApiEntries writes through the typed auth API on hosted runtimes', async () => {
  setProductionRuntime();
  mockAuthenticatedUser();

  let keyManagerCalls = 0;
  let getUserApiCalls = 0;
  let replaceUserApiCalls = 0;
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
    getUserApiCalls += 1;
    return {
      success: true,
      data: {
        entries: persistedEntries,
      },
    };
  };
  legacyWebApiClient.replaceKeyManagerCloudState = async () => {
    throw new Error('key-manager state should not be rewritten when only entries change');
  };
  legacyWebApiClient.replaceUserApiEntries = async (input) => {
    replaceUserApiCalls += 1;
    persistedEntries = (input.entries as Array<Record<string, unknown>>).map((entry) => ({
      ...entry,
      key: `__kk_redacted__:key:${String(entry.id || '')}`,
    }));

    return {
      success: true,
      data: {
        entries: persistedEntries,
      },
    };
  };

  await saveUserApiEntries([createEntry('entry-2')]);

  assert.equal(keyManagerCalls, 2);
  assert.equal(getUserApiCalls, 2);
  assert.equal(replaceUserApiCalls, 1);
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
