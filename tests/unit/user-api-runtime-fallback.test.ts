import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { legacyWebApiClient } from '../../apps/web/src/services/api/kkApiClient.ts';
import {
  clearPersistedRuntimeAuthState,
  persistRuntimeAuthState,
} from '../../apps/web/src/services/auth/runtimeAuthState.ts';
import { loadUserApisPayloadFromCloudRecord } from '../../apps/web/src/services/api/userApiCloudRecordStorage.ts';
import {
  loadUserApiEntries,
  saveUserApiEntries,
} from '../../apps/web/src/services/api/userApiProfileStorage.ts';

// 中文注释：使用 client: any 绕过 mock 函数缺少 meta 属性带来的 TSC 校验报错
const client: any = legacyWebApiClient;

const originalGetKeyManagerCloudState = client.getKeyManagerCloudState;
const originalGetUserApiEntries = client.getUserApiEntries;
const originalReplaceUserApisPayload = client.replaceUserApisPayload;
const originalReplaceKeyManagerCloudState = client.replaceKeyManagerCloudState;
const originalReplaceUserApiEntries = client.replaceUserApiEntries;
const originalConsoleWarn = console.warn;
const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
const originalLegacyFallback = process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
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

function setProductionRuntime() {
  delete process.env.VITE_KK_API_BASE_URL;
  locationLike.location = {
    origin: 'https://kk-studio.vercel.app',
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
  client.getKeyManagerCloudState = originalGetKeyManagerCloudState;
  client.getUserApiEntries = originalGetUserApiEntries;
  client.replaceUserApisPayload = originalReplaceUserApisPayload;
  client.replaceKeyManagerCloudState = originalReplaceKeyManagerCloudState;
  client.replaceUserApiEntries = originalReplaceUserApiEntries;
  console.warn = originalConsoleWarn;

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
});

test('loadUserApisPayloadFromCloudRecord uses the typed auth API on non-local runtimes', async () => {
  setProductionRuntime();
  mockAuthenticatedUser();

  let keyManagerCalls = 0;
  let userApiCalls = 0;
  client.getKeyManagerCloudState = async () => {
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
  client.getUserApiEntries = async () => {
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
    entries: [
      {
        ...createEntry('entry-1'),
        key: 'sk-readonly-0000',
        keyPreview: '已填写',
      },
    ],
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
  client.getKeyManagerCloudState = async () => {
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
  client.getUserApiEntries = async () => {
    getUserApiCalls += 1;
    return {
      success: true,
      data: {
        entries: [createEntry('entry-1')],
      },
    };
  };
  client.replaceUserApiEntries = async () => {
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

  client.getKeyManagerCloudState = async () => {
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
  client.getUserApiEntries = async () => {
    getUserApiCalls += 1;
    return {
      success: true,
      data: {
        entries: persistedEntries,
      },
    };
  };
  client.replaceKeyManagerCloudState = async () => {
    throw new Error('key-manager state should not be rewritten when only entries change');
  };
  client.replaceUserApiEntries = async () => {
    throw new Error('split entry writes should stay unused when the unified payload route is available');
  };
  client.replaceUserApisPayload = async (input: any) => {
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

test('saveUserApiEntries writes locally first and still surfaces cloud sync failures on local runtimes', async () => {
  process.env.VITE_KK_API_BASE_URL = 'http://127.0.0.1:8787';
  process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = 'true';
  locationLike.location = {
    origin: 'http://localhost:5173',
  };
  mockAuthenticatedUser();

  let keyManagerCalls = 0;
  let getUserApiCalls = 0;
  let replaceUserApiPayloadCalls = 0;
  let replaceUserApiEntriesCalls = 0;

  client.getKeyManagerCloudState = async () => {
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
  client.getUserApiEntries = async () => {
    getUserApiCalls += 1;
    return {
      success: true,
      data: {
        entries: [],
      },
    };
  };
  client.replaceKeyManagerCloudState = async () => {
    throw new Error('key-manager state should stay unchanged when only entry rows change');
  };
  client.replaceUserApiEntries = async () => {
    replaceUserApiEntriesCalls += 1;
    return {
      success: true,
      data: {
        entries: [createEntry('entry-fail')],
      },
    };
  };
  client.replaceUserApisPayload = async () => {
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
  assert.equal(replaceUserApiEntriesCalls, 1);
  assert.equal(replaceUserApiPayloadCalls, 1);
});

test('loadUserApiEntries keeps canonical cloud fields stable when equal-revision bridge data is replayed', async () => {
  process.env.VITE_KK_API_BASE_URL = 'http://127.0.0.1:8787';
  process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = 'true';
  locationLike.location = {
    origin: 'http://localhost:5173',
  };
  mockAuthenticatedUser();

  let userApiReads = 0;
  const replacePayloads: Array<Array<Record<string, unknown>>> = [];
  let replaceUserApisPayloadCalls = 0;
  const warnings: string[] = [];

  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };

  client.getKeyManagerCloudState = async () => ({
    success: true,
    data: {
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    },
  });
  client.getUserApiEntries = async () => {
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
  client.replaceKeyManagerCloudState = async () => {
    throw new Error('key-manager state should stay unchanged when only entry rows differ');
  };
  client.replaceUserApisPayload = async () => {
    replaceUserApisPayloadCalls += 1;
    throw new Error('background cloud convergence should stay disabled without a KK API access token');
  };
  client.replaceUserApiEntries = async (input: any) => {
    replacePayloads.push(
      ((input.entries as any) as Array<Record<string, unknown>>).map((entry) => ({ ...entry })),
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
  assert.equal(entries[0].key, '__kk_redacted__:key:entry-3');

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(replacePayloads.length, 0);
  assert.equal(
    warnings.some((warning) => warning.includes('Failed to converge merged user API payload to cloud')),
    false,
  );
  assert.equal(replaceUserApisPayloadCalls, 0);
});
