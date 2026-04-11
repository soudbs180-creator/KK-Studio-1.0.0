import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AdminConsoleService } from '../../apps/api/src/modules/admin-console/application/admin-console-service.ts';
import { InMemoryAdminConsoleRepository } from '../../apps/api/src/modules/admin-console/infrastructure/in-memory-admin-console-repository.ts';

test('primary admin user id resolves as admin even when the stored profile role is user', async () => {
  const repository = new InMemoryAdminConsoleRepository([
    {
      id: 'owner-user-1',
      email: 'owner@example.com',
      role: 'user',
    },
  ]);
  const service = new AdminConsoleService(repository, {
    primaryAdminUserId: 'owner-user-1',
  });

  const result = await service.getAccess('owner-user-1', 'req-owner-admin-access');

  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.role, 'admin');
  assert.equal(result.data.isAdmin, true);
  assert.equal(result.data.adminSessionActive, false);
});

test('delegated profile admins still resolve as admins when they are not the owner admin', async () => {
  const repository = new InMemoryAdminConsoleRepository([
    {
      id: 'delegated-admin-1',
      email: 'delegate@example.com',
      role: 'admin',
    },
  ]);
  const service = new AdminConsoleService(repository, {
    primaryAdminUserId: 'owner-user-1',
  });

  const result = await service.getAccess('delegated-admin-1', 'req-delegated-admin-access');

  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.role, 'admin');
  assert.equal(result.data.isAdmin, true);
});

test('non-admin users stay non-admin when they are neither the owner nor a delegated admin', async () => {
  const repository = new InMemoryAdminConsoleRepository([
    {
      id: 'plain-user-1',
      email: 'user@example.com',
      role: 'user',
    },
  ]);
  const service = new AdminConsoleService(repository, {
    primaryAdminUserId: 'owner-user-1',
  });

  const result = await service.getAccess('plain-user-1', 'req-plain-user-access');

  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.role, 'user');
  assert.equal(result.data.isAdmin, false);
  assert.equal(result.data.requiresPasswordChange, false);
});
