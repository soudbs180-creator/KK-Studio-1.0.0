import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  resolveServerAdminConfig,
  summarizeServerAdminConfig,
} from '../../apps/api/src/lib/server-admin-config.ts';

const originalPrimaryAdminUserId = process.env.KK_PRIMARY_ADMIN_USER_ID;

afterEach(() => {
  if (typeof originalPrimaryAdminUserId === 'string') {
    process.env.KK_PRIMARY_ADMIN_USER_ID = originalPrimaryAdminUserId;
  } else {
    delete process.env.KK_PRIMARY_ADMIN_USER_ID;
  }
});

test('server admin config reports when the owner admin id is configured', () => {
  process.env.KK_PRIMARY_ADMIN_USER_ID = 'owner-user-1';

  const config = resolveServerAdminConfig();
  const summary = summarizeServerAdminConfig(config);

  assert.equal(config.primaryAdminUserId, 'owner-user-1');
  assert.equal(summary.primaryAdminUserIdConfigured, true);
  assert.deepEqual(summary.blockers, []);
});

test('server admin config reports a clear blocker when the owner admin id is missing', () => {
  delete process.env.KK_PRIMARY_ADMIN_USER_ID;

  const config = resolveServerAdminConfig();
  const summary = summarizeServerAdminConfig(config);

  assert.equal(config.primaryAdminUserId, undefined);
  assert.equal(summary.primaryAdminUserIdConfigured, false);
  assert.deepEqual(summary.blockers, ['KK_PRIMARY_ADMIN_USER_ID_MISSING']);
});
