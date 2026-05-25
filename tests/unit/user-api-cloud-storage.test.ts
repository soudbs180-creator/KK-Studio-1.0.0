import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { legacyWebApiClient as originalClient } from '../../apps/web/src/services/api/kkApiClient.ts';
const legacyWebApiClient = originalClient as any;
import {
  clearPersistedRuntimeAuthState,
  persistRuntimeAuthState,
} from '../../apps/web/src/services/auth/runtimeAuthState.ts';
import {
  combineUserApisEnvelopeSources,
  getUserApisPayloadDensity,
  loadUserApisPayloadFromCloudRecord,
  removeUserApiProviderFromCloudRecord,
  removeUserApiSlotFromCloudRecord,
  resetUserApisPayloadCacheForTests,
  saveUserApisPayloadToCloudRecord,
  upsertUserApiProviderToCloudRecord,
  upsertUserApiSlotToCloudRecord,
} from '../../apps/web/src/services/api/userApiCloudRecordStorage.ts';
import {
  compactUserApisPayloadForTransport,
  mergeUserApisPayload,
} from '../../apps/web/src/services/api/userApiPayload.ts';

const REDACTED_SECRET_PREFIX = '__kk_redacted__:';

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

type MutableEnvelope = {
  version: number;
  slots: Array<Record<string, unknown>>;
  providers: Array<Record<string, unknown>>;
  entries: Array<Record<string, unknown>>;
};

function createEntry(id: string, overrides: Record<string, unknown> = {}) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getRecordId(value: unknown): string {
  return isRecord(value) ? String(value.id || '').trim() : '';
}

function buildRedactedSecret(recordId: string, field: string): string {
  return `${REDACTED_SECRET_PREFIX}${field}:${recordId}`;
}

function shouldPreservePersistedSecret(value: unknown): boolean {
  const normalized = String(value || '').trim();
  return normalized.length === 0
    || normalized === 'sk-readonly-0000'
    || normalized.startsWith(REDACTED_SECRET_PREFIX);
}

function mergeRecordArray(
  existing: Array<Record<string, unknown>>,
  next: Array<Record<string, unknown>>,
  secretField?: 'key' | 'apiKey',
): Array<Record<string, unknown>> {
  const existingById = new Map<string, Record<string, unknown>>();

  existing.forEach((item) => {
    const id = getRecordId(item);
    if (id) {
      existingById.set(id, item);
    }
  });

  return next.map((item) => {
    const id = getRecordId(item);
    if (!id) {
      return item;
    }

    const persisted = existingById.get(id);
    if (!persisted) {
      return { ...item };
    }

    const merged = {
      ...persisted,
      ...item,
    };

    if (secretField && shouldPreservePersistedSecret(item[secretField])) {
      merged[secretField] = persisted[secretField];
    }

    return merged;
  });
}

function normalizeEnvelope(rawPayload: unknown): MutableEnvelope {
  const payload = isRecord(rawPayload) ? rawPayload : {};
  return {
    version: Number(payload.version || 2),
    slots: toArray(payload.slots).filter(isRecord).map((slot) => ({ ...slot })),
    providers: toArray(payload.providers).filter(isRecord).map((provider) => ({ ...provider })),
    entries: toArray(payload.entries).filter(isRecord).map((entry) => ({ ...entry })),
  };
}

function redactRecords(
  records: Array<Record<string, unknown>>,
  secretField: 'key' | 'apiKey',
): Array<Record<string, unknown>> {
  return records.map((record) => {
    const id = getRecordId(record) || 'configured';
    const nextRecord = { ...record };
    const rawSecret = nextRecord[secretField];
    if (typeof rawSecret === 'string' && rawSecret.trim()) {
      nextRecord[secretField] = buildRedactedSecret(id, secretField);
    }
    return nextRecord;
  });
}

function sanitizeEnvelopeForApi(payload: MutableEnvelope): MutableEnvelope {
  return {
    version: payload.version,
    slots: redactRecords(payload.slots, 'key'),
    providers: redactRecords(payload.providers, 'apiKey'),
    entries: redactRecords(payload.entries, 'key'),
  };
}

function mockAuthenticatedUser() {
  persistRuntimeAuthState({
    user: createRuntimeUser(),
    isTempUser: false,
    tempUserExpiry: null,
  });
}

function mockMissingAuthenticatedUser() {
  clearPersistedRuntimeAuthState();
}

function mockApiState(initialPayload: unknown) {
  mockAuthenticatedUser();

  let currentPayload = normalizeEnvelope(initialPayload);
  const unifiedReplaceCalls: Array<Record<string, unknown>> = [];
  const keyManagerReplaceCalls: Array<Record<string, unknown>> = [];
  const userApiReplaceCalls: Array<Record<string, unknown>> = [];

  legacyWebApiClient.getKeyManagerCloudState = async () => ({
    success: true,
    data: sanitizeEnvelopeForApi(currentPayload),
  });

  legacyWebApiClient.getUserApiEntries = async () => ({
    success: true,
    data: {
      entries: sanitizeEnvelopeForApi(currentPayload).entries,
    },
  });

  legacyWebApiClient.replaceUserApisPayload = async (input) => {
    unifiedReplaceCalls.push(input as Record<string, unknown>);
    currentPayload = {
      version: Number(input.version || currentPayload.version || 2),
      slots: mergeRecordArray(currentPayload.slots, toArray(input.slots).filter(isRecord), 'key'),
      providers: mergeRecordArray(currentPayload.providers, toArray(input.providers).filter(isRecord), 'apiKey'),
      entries: mergeRecordArray(currentPayload.entries, toArray(input.entries).filter(isRecord), 'key'),
    };

    return {
      success: true,
      data: sanitizeEnvelopeForApi(currentPayload),
    };
  };

  legacyWebApiClient.replaceKeyManagerCloudState = async (input) => {
    keyManagerReplaceCalls.push(input as Record<string, unknown>);
    currentPayload = {
      version: Number(input.version || currentPayload.version || 2),
      slots: mergeRecordArray(currentPayload.slots, toArray(input.slots).filter(isRecord), 'key'),
      providers: mergeRecordArray(currentPayload.providers, toArray(input.providers).filter(isRecord), 'apiKey'),
      entries: currentPayload.entries,
    };

    return {
      success: true,
      data: sanitizeEnvelopeForApi(currentPayload),
    };
  };

  legacyWebApiClient.replaceUserApiEntries = async (input) => {
    userApiReplaceCalls.push(input as Record<string, unknown>);
    currentPayload = {
      ...currentPayload,
      entries: mergeRecordArray(currentPayload.entries, toArray(input.entries).filter(isRecord), 'key'),
    };

    return {
      success: true,
      data: {
        entries: sanitizeEnvelopeForApi(currentPayload).entries,
      },
    };
  };

  return {
    getCurrentPayload: () => normalizeEnvelope(currentPayload),
    unifiedReplaceCalls,
    keyManagerReplaceCalls,
    userApiReplaceCalls,
  };
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

  test('strips provider pricing snapshots from user API transport payloads', () => {
    const compacted = compactUserApisPayloadForTransport({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          key: 'slot-secret',
          provider: 'Custom',
          recentCalls: [
            {
              timestamp: 1700000000000,
              success: true,
            },
          ],
        },
      ],
      providers: [
        {
          id: 'provider-1',
          name: 'Oversized Provider',
          baseUrl: 'https://provider.example.com/v1',
          apiKey: 'provider-secret',
          format: 'openai',
          isActive: true,
          models: ['model-a'],
          usage: {
            totalTokens: 1,
            totalCost: 2,
            dailyTokens: 3,
            dailyCost: 4,
            lastReset: 5,
          },
          pricingSnapshot: {
            fetchedAt: 1700000000000,
            modelPrices: {
              'model-a': 0.12,
            },
            rows: Array.from({ length: 1400 }, (_, index) => ({
              model: `model-${index}`,
              providerLabel: 'Large Provider',
              endpointUrl: `https://provider.example.com/v1/images/${index}`,
              description: 'x'.repeat(900),
            })),
            modelMeta: {
              'model-a': {
                providerLabel: 'Large Provider',
              },
            },
            _rawData: [
              {
                debug: 'y'.repeat(900),
              },
            ],
          },
        },
      ],
      entries: [
        {
          ...createEntry('entry-1'),
          debugOnly: 'drop-me',
        },
      ],
    });

    const compactedSlot = compacted.slots[0] as Record<string, unknown>;
    const compactedProvider = compacted.providers[0] as Record<string, unknown>;
    const compactedEntry = compacted.entries[0] as Record<string, unknown>;

    assert.equal('recentCalls' in compactedSlot, false);
    assert.equal('pricingSnapshot' in compactedProvider, false);
    assert.equal('debugOnly' in compactedEntry, false);
  });

  test('trims oversized model lists until the transport payload fits within the safe budget', () => {
    const hugeModelList = Array.from({ length: 12000 }, (_, index) => (
      `very-large-model-${index.toString().padStart(5, '0')}-${'x'.repeat(32)}`
    ));

    const compacted = compactUserApisPayloadForTransport({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          key: 'slot-secret',
          name: 'Large Slot',
          provider: 'Custom',
          type: 'proxy',
          format: 'openai',
          supportedModels: hugeModelList,
        },
      ],
      providers: [
        {
          id: 'provider-1',
          name: 'Large Provider',
          baseUrl: 'https://provider.example.com/v1',
          apiKey: 'provider-secret',
          format: 'openai',
          isActive: true,
          models: hugeModelList,
        },
      ],
      entries: [
        {
          ...createEntry('entry-1'),
          supportedModels: hugeModelList,
        },
      ],
    });

    const payloadSize = Buffer.byteLength(JSON.stringify(compacted), 'utf8');
    const compactedSlot = compacted.slots[0] as Record<string, unknown>;
    const compactedProvider = compacted.providers[0] as Record<string, unknown>;
    const compactedEntry = compacted.entries[0] as Record<string, unknown>;

    assert.ok(payloadSize <= 900 * 1024);
    assert.ok(Array.isArray(compactedSlot.supportedModels));
    assert.ok(Array.isArray(compactedProvider.models));
    assert.ok(Array.isArray(compactedEntry.supportedModels));
    assert.ok((compactedSlot.supportedModels as unknown[]).length < hugeModelList.length);
    assert.ok((compactedProvider.models as unknown[]).length < hugeModelList.length);
    assert.ok((compactedEntry.supportedModels as unknown[]).length < hugeModelList.length);
  });

  test('loads the combined typed API payload when cloud state and user-api entries are split across endpoints', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'https://kk-studio.vercel.app' };
    mockAuthenticatedUser();

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

    const payload = await loadUserApisPayloadFromCloudRecord();

    assert.deepEqual(payload, {
      version: 2,
      slots: [{ id: 'slot-1' }],
      providers: [{ id: 'provider-1' }],
      entries: [
        {
          ...createEntry('entry-1'),
          key: 'sk-readonly-0000',
        },
      ],
    });
  });

  test('loads the combined local API payload without a Supabase session on local runtimes', async () => {
    process.env.VITE_KK_API_BASE_URL = 'http://127.0.0.1:8787';
    process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = 'true';
    locationLike.location = { origin: 'http://localhost:3000' };
    mockMissingAuthenticatedUser();

    legacyWebApiClient.getKeyManagerCloudState = async () => ({
      success: true,
      data: {
        version: 2,
        slots: [{ id: 'slot-local-1' }],
        providers: [{ id: 'provider-local-1' }],
        entries: [],
      },
    });
    legacyWebApiClient.getUserApiEntries = async () => ({
      success: true,
      data: {
        entries: [createEntry('entry-local-1')],
      },
    });

    const payload = await loadUserApisPayloadFromCloudRecord();

    assert.deepEqual(payload, {
      version: 2,
      slots: [{ id: 'slot-local-1' }],
      providers: [{ id: 'provider-local-1' }],
      entries: [createEntry('entry-local-1')],
    });
  });

  test('returns client-visible placeholders when the typed auth API redacts stored secrets', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'https://kk-studio.vercel.app' };
    mockApiState({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          key: 'server-slot-secret',
          provider: 'Google',
          type: 'official',
          format: 'gemini',
        },
      ],
      providers: [
        {
          id: 'provider-1',
          name: 'SiliconFlow',
          apiKey: 'server-provider-secret',
          format: 'openai',
          isActive: true,
        },
      ],
      entries: [
        createEntry('entry-1', {
          key: 'server-entry-secret',
        }),
      ],
    });

    const payload = await loadUserApisPayloadFromCloudRecord();

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
          ...createEntry('entry-1', {
            key: 'server-entry-secret',
          }),
          key: 'sk-readonly-0000',
        },
      ],
    });
  });

  test('throws when both typed auth endpoints fail instead of bypassing the API layer', async () => {
    delete process.env.VITE_KK_API_BASE_URL;
    locationLike.location = { origin: 'https://kk-studio.vercel.app' };
    mockAuthenticatedUser();

    legacyWebApiClient.getKeyManagerCloudState = async () => ({
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'fetch failed',
      },
    });
    legacyWebApiClient.getUserApiEntries = async () => ({
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'network request failed',
      },
    });

    await assert.rejects(
      () => loadUserApisPayloadFromCloudRecord(),
      /fetch failed|network request failed/,
    );
  });

  test('saves the merged user API payload through the unified typed auth API and preserves persisted secrets', async () => {
    const api = mockApiState({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          key: 'server-slot-secret',
          provider: 'Google',
          type: 'official',
          format: 'gemini',
        },
      ],
      providers: [],
      entries: [
        createEntry('entry-1', {
          key: 'server-entry-secret',
        }),
      ],
    });

    const payload = await saveUserApisPayloadToCloudRecord({
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
    }) as MutableEnvelope;

    assert.equal(api.unifiedReplaceCalls.length, 1);
    assert.equal(api.keyManagerReplaceCalls.length, 0);
    assert.equal(api.userApiReplaceCalls.length, 0);

    const savedPayload = api.getCurrentPayload();
    assert.equal(savedPayload.slots[0].key, 'server-slot-secret');
    assert.equal(savedPayload.slots[0].disabled, true);
    assert.equal(savedPayload.entries[0].key, 'server-entry-secret');
    assert.equal(savedPayload.entries[0].status, 'valid');

    assert.equal(payload.slots[0].key, buildRedactedSecret('slot-1', 'key'));
    assert.equal(payload.entries[0].key, buildRedactedSecret('entry-1', 'key'));
  });

  test('saves the local API payload without a Supabase session on local runtimes', async () => {
    process.env.VITE_KK_API_BASE_URL = 'http://127.0.0.1:8787';
    process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = 'true';
    locationLike.location = { origin: 'http://localhost:3000' };
    mockMissingAuthenticatedUser();

    const api = mockApiState({
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });

    const payload = await saveUserApisPayloadToCloudRecord({
      version: 2,
      slots: [],
      providers: [],
      entries: [createEntry('entry-local-2')],
    }) as MutableEnvelope;

    assert.equal(api.unifiedReplaceCalls.length, 1);
    assert.equal(api.keyManagerReplaceCalls.length, 0);
    assert.equal(api.userApiReplaceCalls.length, 0);
    assert.equal(api.getCurrentPayload().entries.length, 1);
    assert.equal(api.getCurrentPayload().entries[0].id, 'entry-local-2');
    assert.equal(payload.entries[0].key, buildRedactedSecret('entry-local-2', 'key'));
  });

  test('falls back to split typed auth endpoints when the unified payload write route is unavailable', async () => {
    const api = mockApiState({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          key: 'server-slot-secret',
          provider: 'Google',
          type: 'official',
          format: 'gemini',
        },
      ],
      providers: [],
      entries: [
        createEntry('entry-1', {
          key: 'server-entry-secret',
        }),
      ],
    });

    legacyWebApiClient.replaceUserApisPayload = async () => ({
      success: false,
      error: {
        code: 'HTTP_404',
        message: 'route not found',
      },
    });

    const payload = await saveUserApisPayloadToCloudRecord({
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
    }) as MutableEnvelope;

    assert.equal(api.unifiedReplaceCalls.length, 0);
    assert.equal(api.keyManagerReplaceCalls.length, 1);
    assert.equal(api.userApiReplaceCalls.length, 1);
    assert.equal(payload.slots[0].key, buildRedactedSecret('slot-1', 'key'));
    assert.equal(payload.entries[0].key, buildRedactedSecret('entry-1', 'key'));
  });

  test('creates an official endpoint through the unified typed auth payload API', async () => {
    const api = mockApiState({
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });

    const payload = await upsertUserApiSlotToCloudRecord({
      id: 'slot-1',
      name: 'Google',
      provider: 'Google',
      type: 'official',
      format: 'gemini',
      key: 'sk-live-slot-1',
      supportedModels: ['gemini-2.5-flash'],
      disabled: false,
    }) as MutableEnvelope;

    assert.equal(api.unifiedReplaceCalls.length, 1);
    assert.equal(api.keyManagerReplaceCalls.length, 0);
    assert.equal(api.userApiReplaceCalls.length, 0);

    const savedSlot = api.getCurrentPayload().slots[0];
    assert.equal(savedSlot.id, 'slot-1');
    assert.equal(savedSlot.name, 'Google');
    assert.equal(savedSlot.provider, 'Google');
    assert.equal(savedSlot.key, 'sk-live-slot-1');
    assert.deepEqual(savedSlot.supportedModels, ['gemini-2.5-flash']);
    assert.equal(payload.slots[0].key, buildRedactedSecret('slot-1', 'key'));
  });

  test('reuses the persisted official endpoint secret when editing with the readonly placeholder', async () => {
    const api = mockApiState({
      version: 2,
      slots: [
        {
          id: 'slot-1',
          name: 'Google',
          provider: 'Google',
          type: 'official',
          format: 'gemini',
          key: 'server-slot-secret',
          disabled: false,
        },
      ],
      providers: [],
      entries: [],
    });

    await upsertUserApiSlotToCloudRecord({
      id: 'slot-1',
      name: 'Google Updated',
      provider: 'Google',
      type: 'official',
      format: 'gemini',
      key: 'sk-readonly-0000',
      disabled: true,
    });

    const savedSlot = api.getCurrentPayload().slots[0];
    assert.equal(savedSlot.name, 'Google Updated');
    assert.equal(savedSlot.key, 'server-slot-secret');
    assert.equal(savedSlot.disabled, true);
  });

  test('removes an official endpoint through the unified typed auth payload API', async () => {
    const api = mockApiState({
      version: 2,
      slots: [
        { id: 'slot-1', name: 'Google' },
        { id: 'slot-2', name: 'OpenAI' },
      ],
      providers: [],
      entries: [],
    });

    const payload = await removeUserApiSlotFromCloudRecord('slot-1') as MutableEnvelope;

    assert.equal(api.unifiedReplaceCalls.length, 1);
    assert.equal(api.keyManagerReplaceCalls.length, 0);
    assert.equal(api.userApiReplaceCalls.length, 0);
    assert.deepEqual(payload.slots.map((slot) => slot.id), ['slot-2']);
    assert.deepEqual(
      api.getCurrentPayload().slots.map((slot) => slot.id),
      ['slot-2'],
    );
  });

  test('creates a provider through the unified typed auth payload API', async () => {
    const api = mockApiState({
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });

    const payload = await upsertUserApiProviderToCloudRecord({
      id: 'provider-1',
      name: 'SiliconFlow',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: 'sk-live-provider-1',
      format: 'openai',
      isActive: true,
    }) as MutableEnvelope;

    assert.equal(api.unifiedReplaceCalls.length, 1);
    assert.equal(api.keyManagerReplaceCalls.length, 0);
    assert.equal(api.userApiReplaceCalls.length, 0);

    const savedProvider = api.getCurrentPayload().providers[0];
    assert.equal(savedProvider.id, 'provider-1');
    assert.equal(savedProvider.name, 'SiliconFlow');
    assert.equal(savedProvider.baseUrl, 'https://api.siliconflow.cn/v1');
    assert.equal(savedProvider.apiKey, 'sk-live-provider-1');
    assert.equal(savedProvider.format, 'openai');
    assert.equal(savedProvider.isActive, true);
    assert.equal(payload.providers[0].apiKey, buildRedactedSecret('provider-1', 'apiKey'));
  });

  test('reuses the persisted provider secret when editing with the readonly placeholder', async () => {
    const api = mockApiState({
      version: 2,
      slots: [],
      providers: [
        {
          id: 'provider-1',
          name: 'Old Provider',
          baseUrl: 'https://old.example.com/v1',
          apiKey: 'server-provider-secret',
          format: 'openai',
          isActive: false,
        },
      ],
      entries: [],
    });

    await upsertUserApiProviderToCloudRecord({
      id: 'provider-1',
      name: 'Updated Provider',
      baseUrl: 'https://new.example.com/v1',
      apiKey: 'sk-readonly-0000',
      format: 'gemini',
      isActive: true,
    });

    const unifiedRequest = api.unifiedReplaceCalls[0] as MutableEnvelope;
    assert.equal(
      String((unifiedRequest.providers[0] as Record<string, unknown>).apiKey || ''),
      buildRedactedSecret('provider-1', 'apiKey'),
    );

    const savedProvider = api.getCurrentPayload().providers[0];
    assert.equal(savedProvider.name, 'Updated Provider');
    assert.equal(savedProvider.baseUrl, 'https://new.example.com/v1');
    assert.equal(savedProvider.apiKey, 'server-provider-secret');
    assert.equal(savedProvider.format, 'gemini');
    assert.equal(savedProvider.isActive, true);
  });

  test('rejects creating a new provider when the api key is still the readonly placeholder', async () => {
    mockApiState({
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });

    await assert.rejects(
      () => upsertUserApiProviderToCloudRecord({
        id: 'provider-1',
        name: 'Placeholder Provider',
        baseUrl: 'https://placeholder.example.com/v1',
        apiKey: 'sk-readonly-0000',
      }),
      /real API key is required/,
    );
  });

  test('removes a provider through the unified typed auth payload API', async () => {
    const api = mockApiState({
      version: 2,
      slots: [],
      providers: [
        { id: 'provider-1', name: 'Provider One' },
        { id: 'provider-2', name: 'Provider Two' },
      ],
      entries: [],
    });

    const payload = await removeUserApiProviderFromCloudRecord('provider-1') as MutableEnvelope;

    assert.equal(api.unifiedReplaceCalls.length, 1);
    assert.equal(api.keyManagerReplaceCalls.length, 0);
    assert.equal(api.userApiReplaceCalls.length, 0);
    assert.deepEqual(payload.providers.map((provider) => provider.id), ['provider-2']);
    assert.deepEqual(
      api.getCurrentPayload().providers.map((provider) => provider.id),
      ['provider-2'],
    );
  });

  test('does not bypass typed auth write failures through a Supabase profile fallback', async () => {
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
      () => upsertUserApiProviderToCloudRecord({
        id: 'provider-1',
        name: 'Direct Owner Provider',
        baseUrl: 'https://provider.example.com/v1',
        apiKey: 'provider-secret',
        format: 'openai',
        isActive: true,
        models: ['model-a'],
        usage: {
          totalTokens: 0,
          totalCost: 0,
          dailyTokens: 0,
          dailyCost: 0,
          lastReset: 1700000000000,
        },
        status: 'checking',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }),
      /fetch failed/,
    );
  });
});
