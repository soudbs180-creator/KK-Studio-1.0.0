import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isAdminBrowserSessionExpired,
  normalizeAdminBrowserSession,
} from '../../apps/admin/src/services/adminBrowserSession.ts';

test('normalizeAdminBrowserSession rejects empty tokens and strips unrelated secret fields', () => {
  assert.equal(
    normalizeAdminBrowserSession({ accessToken: '', adminSessionToken: 'x' }),
    null,
  );

  assert.deepEqual(
    normalizeAdminBrowserSession({
      accessToken: 'user-token',
      adminSessionToken: 'admin-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      adminSessionExpiresAt: '2099-01-01T01:00:00.000Z',
      databasePassword: 'should-not-survive',
    }),
    {
      accessToken: 'user-token',
      adminSessionToken: 'admin-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      adminSessionExpiresAt: '2099-01-01T01:00:00.000Z',
    },
  );
});

test('isAdminBrowserSessionExpired fails closed on malformed or expired timestamps', () => {
  assert.equal(isAdminBrowserSessionExpired(undefined), true);
  assert.equal(isAdminBrowserSessionExpired('not-a-date'), true);
  assert.equal(isAdminBrowserSessionExpired('2000-01-01T00:00:00.000Z'), true);
  assert.equal(isAdminBrowserSessionExpired('2099-01-01T00:00:00.000Z'), false);
});
