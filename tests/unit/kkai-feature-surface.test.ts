import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  KKAI_FEATURE_FLAGS,
  shouldEnableWorkspaceCloudSync,
} from '../../apps/web/src/app/kkaiFeatureFlags.ts';

test('KKAI keeps billing on while admin and workspace cloud sync stay disabled', () => {
  assert.deepEqual(KKAI_FEATURE_FLAGS, {
    billing: true,
    admin: false,
    workspaceCloudSync: false,
    cloudProfileFallback: false,
  });
  assert.equal(shouldEnableWorkspaceCloudSync(), false);
});
