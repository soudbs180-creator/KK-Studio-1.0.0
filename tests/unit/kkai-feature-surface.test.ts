import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  KKAI_FEATURE_FLAGS,
  shouldEnableWorkspaceCloudSync,
} from '../../src/app/kkaiFeatureFlags.ts';

test('KKAI disables billing, admin, and workspace cloud sync features', () => {
  assert.deepEqual(KKAI_FEATURE_FLAGS, {
    billing: false,
    admin: false,
    workspaceCloudSync: false,
    cloudProfileFallback: false,
  });
  assert.equal(shouldEnableWorkspaceCloudSync(), false);
});
