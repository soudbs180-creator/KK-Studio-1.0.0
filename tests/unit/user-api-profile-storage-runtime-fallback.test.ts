import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { supabase } from '../../src/lib/supabase.ts';
import { legacyWebApiClient } from '../../src/services/api/kkApiClient.ts';
import {
  loadUserApiEntries,
  saveUserApiEntries,
} from '../../src/services/api/userApiProfileStorage.ts';

const originalGetUser = supabase.auth.getUser;
const originalFrom = supabase.from;
const originalGetKeyManagerCloudState = legacyWebApiClient.getKeyManagerCloudState;
const originalGetUserApiEntries = legacyWebApiClient.getUserApiEntries;
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
          data: profilePayload == null ? null : { user_apis: profilePayload },
          error: null,
        };
      },
    };
  }) as typeof supabase.from;
}

function mockAuthenticatedProfileReadWrite(profilePayload: unknown) {
  let currentPayload = profilePayload;
  const upsertCalls: Array<{ value: Record<string, unknown> }> = [];

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
      async upsert(value: Record<string, unknown>) {
        currentPayload = value.user_apis;
        upsertCalls.push({ value });
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
  if (typeof originalKkApiBaseUrl === 'string') {
    process.env.VITE_KK_API_BASE_URL = originalKkApiBaseUrl;
  } else {
    delete process.env.VITE_KK_API_BASE_URL;
  }
  locationLike.location = originalLocation;
});

describe('user api profile storage runtime fallback', () => {
  test('loads user API entries from Supabase on hosted runtimes without touching the legacy Web API', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'https://kk-studio.vercel.app' };
    mockAuthenticatedProfile({
      version: 2,
      slots: [],
      providers: [],
      entries: [
        {
          ...createEntry('entry-1'),
          key: {
            __kkUserApiSecret: true,
          },
        },
      ],
    });

    let legacyCalls = 0;
    legacyWebApiClient.getKeyManagerCloudState = async () => {
      legacyCalls += 1;
      throw new Error('legacy key-manager endpoint should stay unused');
    };
    legacyWebApiClient.getUserApiEntries = async () => {
      legacyCalls += 1;
      throw new Error('legacy user-api endpoint should stay unused');
    };

    const entries = await loadUserApiEntries();

    assert.equal(legacyCalls, 0);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'entry-1');
    assert.equal(entries[0].key, 'sk-readonly-0000');
  });

  test('saves user API entries directly to Supabase on hosted runtimes without seeding the legacy Web API', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'https://kk-studio.vercel.app' };
    const profile = mockAuthenticatedProfileReadWrite({
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });

    let legacyWrites = 0;
    legacyWebApiClient.replaceUserApiEntries = async () => {
      legacyWrites += 1;
      throw new Error('legacy user-api writes should stay unused');
    };

    await saveUserApiEntries([createEntry('entry-2')]);

    assert.equal(legacyWrites, 0);
    assert.equal(profile.upsertCalls.length, 1);

    const savedPayload = profile.getCurrentPayload() as {
      entries: Array<{ id: string; key: string }>;
    };
    assert.deepEqual(savedPayload.entries.map((entry) => ({
      id: entry.id,
      key: entry.key,
    })), [
      {
        id: 'entry-2',
        key: 'sk-entry-2',
      },
    ]);
  });
});
