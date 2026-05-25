import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isKkaiUserApiStorageReady,
  resolveKkaiUserApiStorageMode,
} from '../../apps/web/src/services/api/kkaiUserApiStorageMode.ts';

test('resolveKkaiUserApiStorageMode treats local-file auth persistence as ready in KKAI', () => {
  assert.equal(
    resolveKkaiUserApiStorageMode({
      reachable: true,
      repositories: { authData: 'local-file' },
      persistence: { userApiKeys: true, keyManager: true } as any,
    }),
    'local-file-ready',
  );
});

test('resolveKkaiUserApiStorageMode rejects legacy Supabase auth persistence', () => {
  assert.equal(
    resolveKkaiUserApiStorageMode({
      reachable: true,
      repositories: { authData: 'supabase' },
      persistence: { userApiKeys: true, keyManager: true } as any,
    } as any),
    'not-ready',
  );
});

test('isKkaiUserApiStorageReady rejects unavailable persistence', () => {
  assert.equal(
    isKkaiUserApiStorageReady({
      reachable: false,
      repositories: { authData: 'unknown' },
      persistence: { userApiKeys: false, keyManager: false } as any,
    }),
    false,
  );
});

test('isKkaiUserApiStorageReady rejects missing persistence readiness', () => {
  assert.equal(
    isKkaiUserApiStorageReady({
      reachable: true,
      repositories: {
        authData: 'memory',
      },
      persistence: { userApiKeys: false, keyManager: false } as any,
    } as any),
    false,
  );
});

