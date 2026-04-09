import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { supabase } from '../../src/lib/supabase.ts';
import { legacyWebApiClient } from '../../src/services/api/kkApiClient.ts';
import {
  loadUserApisPayloadFromCloudRecord,
  resetUserApisPayloadCacheForTests,
} from '../../src/services/api/userApiCloudRecordStorage.ts';
import {
  loadUserApiEntries,
  resetUserApiProfileStorageStateForTests,
  saveUserApiEntries,
} from '../../src/services/api/userApiProfileStorage.ts';

const originalGetSession = supabase.auth.getSession;
const originalGetUser = supabase.auth.getUser;
const originalGetKeyManagerCloudState = legacyWebApiClient.getKeyManagerCloudState;
const originalGetUserApiEntries = legacyWebApiClient.getUserApiEntries;
const originalReplaceUserApisPayload = legacyWebApiClient.replaceUserApisPayload;
const originalReplaceKeyManagerCloudState = legacyWebApiClient.replaceKeyManagerCloudState;
const originalReplaceUserApiEntries = legacyWebApiClient.replaceUserApiEntries;
const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
const originalLegacyFallback = process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
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

function mockAuthenticatedUser(userId: string = 'user-1', email: string = `${userId}@example.com`) {
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
          id: userId,
          email,
        },
      },
      error: null,
    }) as Awaited<ReturnType<typeof originalGetUser>>;
}

function mockMissingAuthenticatedUser() {
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
        user: null,
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

  if (typeof originalBaseUrl === 'string') {
    process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
  } else {
    delete process.env.VITE_KK_API_BASE_URL;
  }

  if (typeof originalLegacyFallback === 'string') {
    process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = originalLegacyFallback;
  } else {
    delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
  }

  locationLike.location = originalLocation;
  resetUserApisPayloadCacheForTests();
  resetUserApiProfileStorageStateForTests();
});

test('loadUserApisPayloadFromCloudRecord uses the typed auth API on non-local runtimes', async () => {
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

  const payload = await loadUserApisPayloadFromCloudRecord();

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
  let replaceUserApiPayloadCalls = 0;
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
  legacyWebApiClient.replaceUserApiEntries = async () => {
    throw new Error('split entry writes should stay unused when the unified payload route is available');
  };
  legacyWebApiClient.replaceUserApisPayload = async (input) => {
    replaceUserApiPayloadCalls += 1;
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

  assert.equal(keyManagerCalls, 1);
  assert.equal(getUserApiCalls, 1);
  assert.equal(replaceUserApiPayloadCalls, 1);
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

test('saveUserApiEntries does not report success or seed the compatibility bridge when the cloud write fails', async () => {
  process.env.VITE_KK_API_BASE_URL = 'http://127.0.0.1:8787';
  process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = 'true';
  locationLike.location = {
    origin: 'http://localhost:5173',
  };
  mockAuthenticatedUser();

  let keyManagerCalls = 0;
  let getUserApiCalls = 0;
  let replaceUserApiPayloadCalls = 0;

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
        entries: [],
      },
    };
  };
  legacyWebApiClient.replaceKeyManagerCloudState = async () => {
    throw new Error('key-manager state should stay unchanged when only entry rows change');
  };
  legacyWebApiClient.replaceUserApiEntries = async () => {
    throw new Error('split entry writes should stay unused when the unified payload route fails');
  };
  legacyWebApiClient.replaceUserApisPayload = async () => {
    replaceUserApiPayloadCalls += 1;
    return {
      success: false,
      error: {
        message: 'cloud write failed',
      },
    };
  };

  await assert.rejects(
    () => saveUserApiEntries([createEntry('entry-fail')]),
    /cloud write failed/,
  );

  assert.equal(keyManagerCalls, 1);
  assert.equal(getUserApiCalls, 1);
  assert.equal(replaceUserApiPayloadCalls, 1);
});

test('saveUserApiEntries writes through the local typed API without a Supabase session on local runtimes', async () => {
  process.env.VITE_KK_API_BASE_URL = 'http://127.0.0.1:8787';
  process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = 'true';
  locationLike.location = {
    origin: 'http://localhost:5173',
  };
  mockMissingAuthenticatedUser();

  let keyManagerCalls = 0;
  let getUserApiCalls = 0;
  let replaceUserApiPayloadCalls = 0;
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
    throw new Error('key-manager state should stay unchanged when only entry rows change');
  };
  legacyWebApiClient.replaceUserApiEntries = async () => {
    throw new Error('split entry writes should stay unused when the unified payload route is available');
  };
  legacyWebApiClient.replaceUserApisPayload = async (input) => {
    replaceUserApiPayloadCalls += 1;
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

  await saveUserApiEntries([createEntry('entry-local-no-auth')]);

  assert.equal(keyManagerCalls, 1);
  assert.equal(getUserApiCalls, 1);
  assert.equal(replaceUserApiPayloadCalls, 1);
  assert.deepEqual(
    persistedEntries.map((entry) => ({
      id: entry.id,
      key: entry.key,
    })),
    [
      {
        id: 'entry-local-no-auth',
        key: '__kk_redacted__:key:entry-local-no-auth',
      },
    ],
  );
});

test('loadUserApiEntries keeps canonical cloud fields when the local compatibility copy has the same revision', async () => {
  process.env.VITE_KK_API_BASE_URL = 'http://127.0.0.1:8787';
  process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = 'true';
  locationLike.location = {
    origin: 'http://localhost:5173',
  };
  mockAuthenticatedUser('user-merge-1', 'user-merge-1@example.com');

  let userApiReads = 0;
  const replacePayloads: Array<Array<Record<string, unknown>>> = [];

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
    userApiReads += 1;
    return {
      success: true,
      data: {
        entries: [
          userApiReads === 1
            ? {
                ...createEntry('entry-3'),
                name: 'Cloud Entry',
                key: '__kk_redacted__:key:entry-3',
              }
            : {
                ...createEntry('entry-3'),
                name: 'Local Entry',
                key: 'sk-local-entry-3',
              },
        ],
      },
    };
  };
  legacyWebApiClient.replaceKeyManagerCloudState = async () => {
    throw new Error('key-manager state should stay unchanged when only entry rows differ');
  };
  legacyWebApiClient.replaceUserApiEntries = async (input) => {
    replacePayloads.push(
      (input.entries as Array<Record<string, unknown>>).map((entry) => ({ ...entry })),
    );
    return {
      success: true,
      data: {
        entries: input.entries,
      },
    };
  };

  const entries = await loadUserApiEntries();

  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, 'Cloud Entry');
  assert.equal(entries[0].key, 'sk-local-entry-3');

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(
    replacePayloads.some(
      (payload) => payload.length === 1
        && payload[0].name === 'Cloud Entry'
        && payload[0].key === 'sk-local-entry-3',
    ),
  );
});

