import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  KKAI_FEATURE_FLAGS,
  shouldEnableWorkspaceCloudSync,
} from '../../src/app/kkaiFeatureFlags.ts';

test('KKAI disables workspace cloud sync in the local-only runtime', () => {
  assert.deepEqual(KKAI_FEATURE_FLAGS, {
    billing: false,
    admin: false,
    workspaceCloudSync: false,
    cloudProfileFallback: false,
  });
  assert.equal(shouldEnableWorkspaceCloudSync(), false);
});
