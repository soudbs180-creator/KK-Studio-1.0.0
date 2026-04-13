import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isKkaiUserApiStorageReady,
  resolveKkaiUserApiStorageMode,
} from '../../src/services/api/kkaiUserApiStorageMode.ts';

test('resolveKkaiUserApiStorageMode treats local-file auth persistence as ready in KKAI', () => {
  assert.equal(
    resolveKkaiUserApiStorageMode({
      reachable: true,
      repositories: { authData: 'local-file' },
      persistence: { userApiKeys: true, keyManager: true },
    }),
    'local-file-ready',
  );
});

test('isKkaiUserApiStorageReady rejects unavailable persistence', () => {
  assert.equal(
    isKkaiUserApiStorageReady({
      reachable: false,
      repositories: { authData: 'unknown' },
      persistence: { userApiKeys: false, keyManager: false },
    }),
    false,
  );
});
