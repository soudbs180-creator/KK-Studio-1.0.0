import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { supabase } from '../../src/lib/supabase.ts';
import { legacyWebApiClient } from '../../src/services/api/kkApiClient.ts';
import {
  combineUserApisEnvelopeSources,
  getUserApisPayloadDensity,
  loadUserApisPayloadViaSupabase,
  removeUserApiSlotViaSupabase,
  removeUserApiProviderViaSupabase,
  saveUserApisPayloadViaSupabase,
  upsertUserApiSlotViaSupabase,
  upsertUserApiProviderViaSupabase,
} from '../../src/services/api/supabaseUserApiCloudStorage.ts';
import { mergeUserApisPayload } from '../../src/services/api/userApiPayload.ts';

const originalGetUser = supabase.auth.getUser;
const originalFrom = supabase.from;
const originalGetKeyManagerCloudState = legacyWebApiClient.getKeyManagerCloudState;
const originalGetUserApiEntries = legacyWebApiClient.getUserApiEntries;
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
          data: {
            user_apis: profilePayload,
          },
          error: null,
        };
      },
    };
  }) as typeof supabase.from;
}

function mockAuthenticatedProfileReadWrite(profilePayload: unknown) {
  let currentPayload = profilePayload;
  const upsertCalls: Array<{ value: Record<string, unknown>; options?: Record<string, unknown> }> = [];

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
  if (typeof originalKkApiBaseUrl === 'string') {
    process.env.VITE_KK_API_BASE_URL = originalKkApiBaseUrl;
  } else {
    delete process.env.VITE_KK_API_BASE_URL;
  }
  locationLike.location = originalLocation;
});

describe('user api cloud storage helpers', () => {
  test('uses the dedicated user-api endpoint payload when cloud state no longer embeds entries', () => {
    const combined = combineUserApisEnvelopeSources(
      {
        version: 2,
        slots: [{ id: 'slot-1' }],
        providers: [{ id: 'provider-1' }],
        entries: [],
      },
      {
        entries: [createEntry('entry-1')],
      },
    );

    assert.deepEqual(combined.slots, [{ id: 'slot-1' }]);
    assert.deepEqual(combined.providers, [{ id: 'provider-1' }]);
    assert.equal(combined.entries.length, 1);
    assert.equal((combined.entries[0] as { id: string }).id, 'entry-1');
    assert.equal(getUserApisPayloadDensity(combined), 3);
  });

  test('can prefer the explicit user-api write response over derived cloud-state entries', () => {
    const combined = combineUserApisEnvelopeSources(
      {
        version: 2,
        slots: [{ id: 'slot-1' }],
        providers: [],
        entries: [createEntry('slot-1')],
      },
      {
        entries: [createEntry('entry-2')],
      },
      {
        preferUserApiEntries: true,
      },
    );

    assert.equal(combined.entries.length, 1);
    assert.equal((combined.entries[0] as { id: string }).id, 'entry-2');
  });

  test('keeps entries intact when only key-manager slots are updated', () => {
    const merged = mergeUserApisPayload(
      {
        version: 2,
        slots: [{ id: 'slot-1', key: 'slot-secret' }],
        providers: [{ id: 'provider-1' }],
        entries: [createEntry('entry-1')],
      },
      {
        slots: [{ id: 'slot-2', key: 'slot-secret-2' }],
      },
    ) as {
      slots: Array<{ id: string }>;
      providers: Array<{ id: string }>;
      entries: Array<{ id: string }>;
    };

    assert.deepEqual(
      merged.slots.map((slot) => slot.id),
      ['slot-2'],
    );
    assert.deepEqual(
      merged.providers.map((provider) => provider.id),
      ['provider-1'],
    );
    assert.deepEqual(
      merged.entries.map((entry) => entry.id),
      ['entry-1'],
    );
  });

  test('prefers denser key-manager envelope entries unless explicit user-api entries are requested', () => {
    const combined = combineUserApisEnvelopeSources(
      {
        version: 2,
        slots: [{ id: 'slot-1' }],
        providers: [{ id: 'provider-1' }],
        entries: [createEntry('entry-from-cloud')],
      },
      {
        entries: [createEntry('entry-from-user-api')],
      },
    );

    assert.equal(combined.entries.length, 1);
    assert.equal((combined.entries[0] as { id: string }).id, 'entry-from-cloud');
  });

  test('keeps slots and providers intact when only entries are updated', () => {
    const merged = mergeUserApisPayload(
      {
        version: 2,
        slots: [{ id: 'slot-1', key: 'slot-secret' }],
        providers: [{ id: 'provider-1', label: 'Primary provider' }],
        entries: [createEntry('entry-1')],
      },
      {
        entries: [
          {
            id: 'entry-1',
            status: 'healthy',
          },
          createEntry('entry-2'),
        ],
      },
    ) as {
      slots: Array<{ id: string; key: string }>;
      providers: Array<{ id: string; label: string }>;
      entries: Array<{ id: string; key?: string; status?: string }>;
    };

    assert.deepEqual(merged.slots, [{ id: 'slot-1', key: 'slot-secret' }]);
    assert.deepEqual(merged.providers, [{ id: 'provider-1', label: 'Primary provider' }]);
    assert.deepEqual(
      merged.entries.map((entry) => ({
        id: entry.id,
        key: entry.key,
        status: entry.status,
      })),
      [
        {
          id: 'entry-1',
          key: 'sk-entry-1',
          status: 'healthy',
        },
        {
          id: 'entry-2',
          key: 'sk-entry-2',
          status: 'unknown',
        },
      ],
    );
  });

  test('loads the combined API payload when the direct profile is empty but API endpoints still have state', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'http://127.0.0.1:3000' };
    mockAuthenticatedProfile(null);
    legacyWebApiClient.getKeyManagerCloudState = async () => ({
      success: true,
      data: {
        version: 2,
        slots: [{ id: 'slot-1' }],
        providers: [{ id: 'provider-1' }],
        entries: [],
      },
    });
    legacyWebApiClient.getUserApiEntries = async () => ({
      success: true,
      data: {
        entries: [createEntry('entry-1')],
      },
    });

    const payload = await loadUserApisPayloadViaSupabase();

    assert.deepEqual(payload, {
      version: 2,
      slots: [{ id: 'slot-1' }],
      providers: [{ id: 'provider-1' }],
      entries: [createEntry('entry-1')],
    });
  });

  test('falls back to direct profile payload when local API endpoints are unavailable', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'http://127.0.0.1:3000' };
    mockAuthenticatedProfile({
      version: 2,
      slots: [{ id: 'slot-1' }],
      providers: [{ id: 'provider-1' }],
      entries: [createEntry('entry-1')],
    });
    legacyWebApiClient.getKeyManagerCloudState = async () => ({
      success: false,
      error: {
        message: 'key manager unavailable',
      },
    });
    legacyWebApiClient.getUserApiEntries = async () => ({
      success: false,
      error: {
        message: 'user api unavailable',
      },
    });

    const payload = await loadUserApisPayloadViaSupabase();

    assert.deepEqual(payload, {
      version: 2,
      slots: [{ id: 'slot-1' }],
      providers: [{ id: 'provider-1' }],
      entries: [createEntry('entry-1')],
    });
  });

  test('uses read-only Supabase payloads on hosted runtimes without touching the legacy Web API', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'https://kk-studio.vercel.app' };
    mockAuthenticatedProfile({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          key: {
            __kkUserApiSecret: true,
          },
          provider: 'Google',
          type: 'official',
          format: 'gemini',
        },
      ],
      providers: [
        {
          id: 'provider-1',
          name: 'SiliconFlow',
          apiKey: {
            __kkUserApiSecret: true,
          },
          format: 'openai',
          isActive: true,
        },
      ],
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
      throw new Error('legacy API should not be called on hosted runtimes');
    };
    legacyWebApiClient.getUserApiEntries = async () => {
      legacyCalls += 1;
      throw new Error('legacy API should not be called on hosted runtimes');
    };

    const payload = await loadUserApisPayloadViaSupabase();

    assert.equal(legacyCalls, 0);
    assert.deepEqual(payload, {
      version: 2,
      slots: [
        {
          id: 'slot-1',
          key: 'sk-readonly-0000',
          provider: 'Google',
          type: 'official',
          format: 'gemini',
        },
      ],
      providers: [
        {
          id: 'provider-1',
          name: 'SiliconFlow',
          apiKey: 'sk-readonly-0000',
          format: 'openai',
          isActive: true,
        },
      ],
      entries: [
        {
          ...createEntry('entry-1'),
          key: 'sk-readonly-0000',
        },
      ],
    });
  });

  test('returns readonly placeholders for encrypted direct profile payloads when hosted runtimes skip the legacy API', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'https://kk-studio.vercel.app' };
    mockAuthenticatedProfile({
      version: 2,
      slots: [],
      providers: [],
      entries: [
        {
          id: 'entry-1',
          key: {
            __kkUserApiSecret: true,
          },
        },
      ],
    });
    legacyWebApiClient.getKeyManagerCloudState = async () => ({
      success: false,
      error: {
        message: 'key manager unavailable',
      },
    });
    legacyWebApiClient.getUserApiEntries = async () => ({
      success: false,
      error: {
        message: 'user api unavailable',
      },
    });

    const payload = await loadUserApisPayloadViaSupabase() as {
      entries: Array<{ id: string; key: string }>;
    };

    assert.deepEqual(payload.entries, [
      {
        id: 'entry-1',
        key: 'sk-readonly-0000',
      },
    ]);
  });

  test('saves the merged user_apis payload directly to profiles.user_apis and preserves encrypted secrets', async () => {
    const encryptedSlotSecret = { __kkUserApiSecret: true, ciphertext: 'slot-secret' };
    const encryptedEntrySecret = { __kkUserApiSecret: true, ciphertext: 'entry-secret' };
    const profile = mockAuthenticatedProfileReadWrite({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          key: encryptedSlotSecret,
          provider: 'Google',
          type: 'official',
          format: 'gemini',
        },
      ],
      providers: [],
      entries: [
        {
          ...createEntry('entry-1'),
          key: encryptedEntrySecret,
        },
      ],
    });

    const payload = await saveUserApisPayloadViaSupabase({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          key: 'sk-readonly-0000',
          provider: 'Google',
          type: 'official',
          format: 'gemini',
          disabled: true,
        },
      ],
      providers: [],
      entries: [
        {
          ...createEntry('entry-1'),
          key: 'sk-readonly-0000',
          status: 'valid',
        },
      ],
    });

    assert.equal(profile.upsertCalls.length, 1);
    assert.deepEqual(payload, profile.getCurrentPayload());

    const savedPayload = profile.getCurrentPayload() as {
      slots: Array<Record<string, unknown>>;
      entries: Array<Record<string, unknown>>;
    };
    assert.deepEqual(savedPayload.slots[0].key, encryptedSlotSecret);
    assert.equal(savedPayload.slots[0].disabled, true);
    assert.deepEqual(savedPayload.entries[0].key, encryptedEntrySecret);
    assert.equal(savedPayload.entries[0].status, 'valid');
  });

  test('creates an official endpoint directly in profiles.user_apis when degraded mode needs Supabase fallback', async () => {
    const profile = mockAuthenticatedProfileReadWrite({
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });

    const payload = await upsertUserApiSlotViaSupabase({
      id: 'slot-1',
      name: 'Google',
      provider: 'Google',
      type: 'official',
      format: 'gemini',
      key: 'sk-live-slot-1',
      supportedModels: ['gemini-2.5-flash'],
      disabled: false,
    });

    assert.equal(profile.upsertCalls.length, 1);
    assert.deepEqual(payload, profile.getCurrentPayload());

    const savedSlot = (profile.getCurrentPayload() as { slots: Array<Record<string, unknown>> }).slots[0];
    assert.equal(savedSlot.id, 'slot-1');
    assert.equal(savedSlot.name, 'Google');
    assert.equal(savedSlot.provider, 'Google');
    assert.equal(savedSlot.key, 'sk-live-slot-1');
    assert.deepEqual(savedSlot.supportedModels, ['gemini-2.5-flash']);
  });

  test('reuses the persisted official endpoint secret when editing with the readonly placeholder', async () => {
    const encryptedSecret = { __kkUserApiSecret: true, ciphertext: 'slot-secret' };
    const profile = mockAuthenticatedProfileReadWrite({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          name: 'Google',
          provider: 'Google',
          type: 'official',
          format: 'gemini',
          key: encryptedSecret,
          disabled: false,
        },
      ],
      providers: [],
      entries: [],
    });

    await upsertUserApiSlotViaSupabase({
      id: 'slot-1',
      name: 'Google Updated',
      provider: 'Google',
      type: 'official',
      format: 'gemini',
      key: 'sk-readonly-0000',
      disabled: true,
    });

    const savedSlot = (profile.getCurrentPayload() as { slots: Array<Record<string, unknown>> }).slots[0];
    assert.equal(savedSlot.name, 'Google Updated');
    assert.deepEqual(savedSlot.key, encryptedSecret);
    assert.equal(savedSlot.disabled, true);
  });

  test('removes an official endpoint directly from profiles.user_apis', async () => {
    const profile = mockAuthenticatedProfileReadWrite({
      version: 2,
      slots: [
        { id: 'slot-1', name: 'Google' },
        { id: 'slot-2', name: 'OpenAI' },
      ],
      providers: [],
      entries: [],
    });

    const payload = await removeUserApiSlotViaSupabase('slot-1');

    assert.equal(profile.upsertCalls.length, 1);
    assert.deepEqual(payload, profile.getCurrentPayload());
    assert.deepEqual(
      (profile.getCurrentPayload() as { slots: Array<{ id: string }> }).slots.map((slot) => slot.id),
      ['slot-2'],
    );
  });

  test('creates a provider directly in profiles.user_apis when degraded mode needs Supabase fallback', async () => {
    const profile = mockAuthenticatedProfileReadWrite({
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });

    const payload = await upsertUserApiProviderViaSupabase({
      id: 'provider-1',
      name: 'SiliconFlow',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: 'sk-live-provider-1',
      format: 'openai',
      isActive: true,
    });

    assert.equal(profile.upsertCalls.length, 1);
    assert.deepEqual(payload, profile.getCurrentPayload());

    const savedProvider = ((profile.getCurrentPayload() as { providers: Array<Record<string, unknown>> }).providers[0]);
    assert.equal(savedProvider.id, 'provider-1');
    assert.equal(savedProvider.name, 'SiliconFlow');
    assert.equal(savedProvider.baseUrl, 'https://api.siliconflow.cn/v1');
    assert.equal(savedProvider.apiKey, 'sk-live-provider-1');
    assert.equal(savedProvider.format, 'openai');
    assert.equal(savedProvider.isActive, true);

    const [{ value, options }] = profile.upsertCalls;
    assert.equal(value.id, 'user-1');
    assert.equal(value.email, 'user-1@example.com');
    assert.equal(options?.onConflict, 'id');
  });

  test('reuses the persisted provider secret when editing with the readonly placeholder', async () => {
    const encryptedSecret = { __kkUserApiSecret: true, ciphertext: 'secret' };
    const profile = mockAuthenticatedProfileReadWrite({
      version: 2,
      slots: [],
      providers: [
        {
          id: 'provider-1',
          name: 'Old Provider',
          baseUrl: 'https://old.example.com/v1',
          apiKey: encryptedSecret,
          format: 'openai',
          isActive: false,
        },
      ],
      entries: [],
    });

    await upsertUserApiProviderViaSupabase({
      id: 'provider-1',
      name: 'Updated Provider',
      baseUrl: 'https://new.example.com/v1',
      apiKey: 'sk-readonly-0000',
      format: 'gemini',
      isActive: true,
    });

    const savedProvider = ((profile.getCurrentPayload() as { providers: Array<Record<string, unknown>> }).providers[0]);
    assert.equal(savedProvider.name, 'Updated Provider');
    assert.equal(savedProvider.baseUrl, 'https://new.example.com/v1');
    assert.deepEqual(savedProvider.apiKey, encryptedSecret);
    assert.equal(savedProvider.format, 'gemini');
    assert.equal(savedProvider.isActive, true);
  });

  test('rejects creating a new provider when the api key is still the readonly placeholder', async () => {
    mockAuthenticatedProfileReadWrite({
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });

    await assert.rejects(
      () => upsertUserApiProviderViaSupabase({
        id: 'provider-1',
        name: 'Placeholder Provider',
        baseUrl: 'https://placeholder.example.com/v1',
        apiKey: 'sk-readonly-0000',
      }),
      /real API key is required/,
    );
  });

  test('removes a provider directly from profiles.user_apis', async () => {
    const profile = mockAuthenticatedProfileReadWrite({
      version: 2,
      slots: [],
      providers: [
        { id: 'provider-1', name: 'Provider One' },
        { id: 'provider-2', name: 'Provider Two' },
      ],
      entries: [],
    });

    const payload = await removeUserApiProviderViaSupabase('provider-1');

    assert.equal(profile.upsertCalls.length, 1);
    assert.deepEqual(payload, profile.getCurrentPayload());
    assert.deepEqual(
      (profile.getCurrentPayload() as { providers: Array<{ id: string }> }).providers.map((provider) => provider.id),
      ['provider-2'],
    );
  });
});
