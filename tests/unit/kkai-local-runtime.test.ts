import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  KKAI_LOCAL_USER_ID,
  createKkaiLocalRuntime,
} from '../../apps/web/src/app/kkaiLocalRuntime.ts';

test('createKkaiLocalRuntime returns the fixed local profile and restores the latest local workspace when available', () => {
  assert.deepEqual(
    createKkaiLocalRuntime({ hasStoredWorkspace: true }),
    {
      mode: 'local-only',
      userId: KKAI_LOCAL_USER_ID,
      launchTarget: 'restore-last-workspace',
      cloudReadsAllowed: false,
      cloudWritesAllowed: false,
      billingEnabled: true,
      adminEnabled: false,
    },
  );
});

test('createKkaiLocalRuntime falls back to a blank local workspace when nothing is stored yet', () => {
  assert.equal(
    createKkaiLocalRuntime({ hasStoredWorkspace: false }).launchTarget,
    'default-workspace',
  );
});
