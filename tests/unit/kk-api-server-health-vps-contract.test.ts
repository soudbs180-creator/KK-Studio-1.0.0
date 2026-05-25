import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isKkApiBillingPersistedInCloudFromHealth,
  isKkApiCanonicalCloudReadyFromHealth,
  isKkApiCreditProviderCatalogPersistedInCloudFromHealth,
  isKkApiUserDataPersistedInCloudFromHealth,
} from '../../apps/web/src/services/api/kkApiServerHealth.ts';
import { resolveKkaiUserApiStorageMode } from '../../apps/web/src/services/api/kkaiUserApiStorageMode.ts';

const postgresHealth = {
  reachable: true,
  verified: true,
  service: 'kk-studio-api',
  status: 'ok',
  selfHostedCoreReady: true,
  config: {
    hasPostgresConfig: true,
    hasAuthKey: false,
    hasUserApiEncryptionSecret: true,
  },
  repositories: {
    adminConsole: 'postgres',
    authData: 'postgres',
    creditAccounts: 'postgres',
    creditProviders: 'postgres',
    workspaceLayout: 'postgres',
  },
  persistence: {
    userApiKeys: true,
    keyManager: true,
    authData: true,
    authSessions: true,
    tempUsers: true,
    credits: true,
    creditProviders: true,
    workspaceLayout: true,
  },
  fetchedAt: Date.now(),
} as const;

test('VPS PostgreSQL health is canonical even without Supabase public config', () => {
  assert.equal(isKkApiUserDataPersistedInCloudFromHealth(postgresHealth), true);
  assert.equal(isKkApiBillingPersistedInCloudFromHealth(postgresHealth), true);
  assert.equal(isKkApiCreditProviderCatalogPersistedInCloudFromHealth(postgresHealth), true);
  assert.equal(isKkApiCanonicalCloudReadyFromHealth(postgresHealth), true);
  assert.equal(resolveKkaiUserApiStorageMode(postgresHealth), 'cloud-ready');
});

test('legacy Supabase health backends no longer count as hosted persistence', () => {
  const legacySupabaseHealth = {
    ...postgresHealth,
    repositories: {
      ...postgresHealth.repositories,
      authData: 'supabase',
      creditAccounts: 'supabase',
      creditProviders: 'supabase',
    },
  } as any;

  assert.equal(isKkApiUserDataPersistedInCloudFromHealth(legacySupabaseHealth), false);
  assert.equal(isKkApiBillingPersistedInCloudFromHealth(legacySupabaseHealth), false);
  assert.equal(isKkApiCreditProviderCatalogPersistedInCloudFromHealth(legacySupabaseHealth), false);
  assert.equal(isKkApiCanonicalCloudReadyFromHealth(legacySupabaseHealth), false);
  assert.equal(resolveKkaiUserApiStorageMode(legacySupabaseHealth), 'not-ready');
});
