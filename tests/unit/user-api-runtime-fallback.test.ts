import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { supabase } from '../../src/lib/supabase.ts';
import { legacyWebApiClient } from '../../src/services/api/kkApiClient.ts';
import { loadUserApisPayloadViaSupabase } from '../../src/services/api/supabaseUserApiCloudStorage.ts';
import {
  loadUserApiEntries,
  saveUserApiEntries,
} from '../../src/services/api/userApiProfileStorage.ts';

const originalGetUser = supabase.auth.getUser;
const originalFrom = supabase.from;
const originalGetKeyManagerCloudState = legacyWebApiClient.getKeyManagerCloudState;
const originalGetUserApiEntries = legacyWebApiClient.getUserApiEntries;
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

function mockAuthenticatedProfile(profilePayload: unknown) {
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

  let currentPayload = profilePayload;
  const upsertCalls: Array<{ value: Record<string, unknown>; options?: Record<string, unknown> }> = [];

  supabase.from = ((table: string) => {
    assert.equal(table, 'profiles');

    return {
      select(column: string) {
        assert.equal(column, 'user_apis');
        return this;
      },
      eq(column: string, value: string) {
        assert.equal(column, 'id');
        assert.equal(value, 'user-1');
        return this;
      },
      async maybeSingle() {
        return {
          data: currentPayload == null ? null : { user_apis: currentPayload },
          error: null,
        };
      },
      async upsert(value: Record<string, unknown>, options?: Record<string, unknown>) {
        upsertCalls.push({ value, options });
        currentPayload = value.user_apis;
        return {
          data: null,
          error: null,
        };
      },
    };
  }) as typeof supabase.from;

  return {
    getCurrentPayload: () => currentPayload,
    upsertCalls,
  };
}

afterEach(() => {
  supabase.auth.getUser = originalGetUser;
  supabase.from = originalFrom;
  legacyWebApiClient.getKeyManagerCloudState = originalGetKeyManagerCloudState;
  legacyWebApiClient.getUserApiEntries = originalGetUserApiEntries;
  legacyWebApiClient.replaceUserApiEntries = originalReplaceUserApiEntries;

  if (typeof originalBaseUrl === 'string') {
    process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
  } else {
    delete process.env.VITE_KK_API_BASE_URL;
  }

  locationLike.location = originalLocation;
});

test('loadUserApisPayloadViaSupabase skips legacy API hydration on non-local runtimes', async () => {
  setProductionRuntime();
  const profilePayload = {
    version: 2,
    slots: [{ id: 'slot-1' }],
    providers: [{ id: 'provider-1' }],
    entries: [createEntry('entry-1')],
  };
  mockAuthenticatedProfile(profilePayload);

  let keyManagerCalls = 0;
  let userApiCalls = 0;
  legacyWebApiClient.getKeyManagerCloudState = async () => {
    keyManagerCalls += 1;
    throw new Error('legacy key-manager endpoint should not be used');
  };
  legacyWebApiClient.getUserApiEntries = async () => {
    userApiCalls += 1;
    throw new Error('legacy user-api endpoint should not be used');
  };

  const payload = await loadUserApisPayloadViaSupabase();

  assert.deepEqual(payload, profilePayload);
  assert.equal(keyManagerCalls, 0);
  assert.equal(userApiCalls, 0);
});

test('loadUserApiEntries reads Supabase payload without seeding the legacy API on production runtimes', async () => {
  setProductionRuntime();
  mockAuthenticatedProfile({
    version: 2,
    slots: [],
    providers: [],
    entries: [createEntry('entry-1')],
  });

  let keyManagerCalls = 0;
  let getUserApiCalls = 0;
  let replaceUserApiCalls = 0;
  legacyWebApiClient.getKeyManagerCloudState = async () => {
    keyManagerCalls += 1;
    throw new Error('legacy key-manager endpoint should not be used');
  };
  legacyWebApiClient.getUserApiEntries = async () => {
    getUserApiCalls += 1;
    throw new Error('legacy user-api endpoint should not be used');
  };
  legacyWebApiClient.replaceUserApiEntries = async () => {
    replaceUserApiCalls += 1;
    throw new Error('legacy user-api replace endpoint should not be used');
  };

  const entries = await loadUserApiEntries();

  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'entry-1');
  assert.equal(keyManagerCalls, 0);
  assert.equal(getUserApiCalls, 0);
  assert.equal(replaceUserApiCalls, 0);
});

test('saveUserApiEntries writes only to Supabase when legacy fallback is disabled', async () => {
  setProductionRuntime();
  const profile = mockAuthenticatedProfile({
    version: 2,
    slots: [],
    providers: [],
    entries: [],
  });

  let keyManagerCalls = 0;
  let getUserApiCalls = 0;
  let replaceUserApiCalls = 0;
  legacyWebApiClient.getKeyManagerCloudState = async () => {
    keyManagerCalls += 1;
    throw new Error('legacy key-manager endpoint should not be used');
  };
  legacyWebApiClient.getUserApiEntries = async () => {
    getUserApiCalls += 1;
    throw new Error('legacy user-api endpoint should not be used');
  };
  legacyWebApiClient.replaceUserApiEntries = async () => {
    replaceUserApiCalls += 1;
    throw new Error('legacy user-api replace endpoint should not be used');
  };

  await saveUserApiEntries([createEntry('entry-2')]);

  assert.equal(profile.upsertCalls.length, 1);
  const savedPayload = profile.getCurrentPayload() as { entries: Array<{ id: string }> };
  assert.deepEqual(savedPayload.entries.map((entry) => entry.id), ['entry-2']);
  assert.equal(keyManagerCalls, 0);
  assert.equal(getUserApiCalls, 0);
  assert.equal(replaceUserApiCalls, 0);
});
