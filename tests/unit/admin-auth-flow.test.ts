import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canUseAdminRoute,
  performAdminLogin,
} from '../../apps/admin/src/services/adminAuthFlow.ts';

test('performAdminLogin requires a normal auth login, admin role, and elevated admin session', async () => {
  const result = await performAdminLogin(
    {
      email: 'admin@example.com',
      password: 'user-password',
      adminPassword: 'admin-password',
    },
    {
      client: {
        login: async () => ({
          success: true,
          data: {
            accessToken: 'user-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
            profile: {
              id: 'user-1',
              email: 'admin@example.com',
              role: 'admin',
              status: 'active',
              createdAt: '2026-04-10T00:00:00.000Z',
              updatedAt: '2026-04-10T00:00:00.000Z',
            },
          },
        }),
        getAdminAccess: async () => ({
          success: true,
          data: {
            role: 'admin',
            isAdmin: true,
            adminSessionActive: false,
            requiresPasswordChange: false,
          },
        }),
        verifyAdminPassword: async () => ({
          success: true,
          data: {
            verified: true,
            adminSessionToken: 'admin-session-token',
            adminSessionExpiresAt: '2099-01-01T00:00:00.000Z',
          },
        }),
      } as any,
    },
  );

  assert.equal(result.accessToken, 'user-token');
  assert.equal(result.adminSessionToken, 'admin-session-token');
});

test('canUseAdminRoute fails closed when either session layer is missing', () => {
  assert.equal(canUseAdminRoute(null), false);
  assert.equal(
    canUseAdminRoute({
      accessToken: 'user-token',
      adminSessionToken: '',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      adminSessionExpiresAt: '2099-01-01T01:00:00.000Z',
    } as any),
    false,
  );
});
