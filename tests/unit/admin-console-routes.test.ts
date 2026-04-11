import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ADMIN_SESSION_TOKEN_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
  AUTHENTICATED_USER_ROLE_HEADER,
} from "../../packages/shared/src/index.ts";
import { AdminConsoleService } from "../../apps/api/src/modules/admin-console/application/admin-console-service.ts";
import { InMemoryAdminConsoleRepository } from "../../apps/api/src/modules/admin-console/infrastructure/in-memory-admin-console-repository.ts";
import {
  handleChangeAdminPassword,
  handleGetAdminAccess,
  handleSetUserRole,
  handleVerifyAdminPassword,
} from "../../apps/api/src/modules/admin-console/presentation/http-admin-console-routes.ts";

describe("admin console routes", () => {
  test("returns the current admin access envelope", async () => {
    const service = new AdminConsoleService(new InMemoryAdminConsoleRepository());
    const result = await handleGetAdminAccess(service, {
      [AUTHENTICATED_USER_ID_HEADER]: "admin-user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
      "x-request-id": "req-admin-access",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(result.body.data.userId, "admin-user-1");
    assert.equal(result.body.data.isAdmin, true);
    assert.equal(result.body.data.role, "admin");
    assert.equal(result.body.data.requiresPasswordChange, true);
    assert.equal(result.body.data.adminSessionActive, false);
  });

  test("verifies, changes, and re-verifies the admin password", async () => {
    const service = new AdminConsoleService(new InMemoryAdminConsoleRepository());
    const headers = {
      [AUTHENTICATED_USER_ID_HEADER]: "admin-user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
      "x-request-id": "req-admin-password",
    };

    const verifyDefault = await handleVerifyAdminPassword(service, {
      password: "123456",
    }, {
      ...headers,
      "x-request-id": "req-admin-password-verify-default",
    });

    assert.equal(verifyDefault.statusCode, 200);
    assert.equal(verifyDefault.body.success, true);
    if (!verifyDefault.body.success) {
      return;
    }

    assert.equal(verifyDefault.body.data.verified, true);
    assert.equal(verifyDefault.body.data.requiresPasswordChange, true);
    assert.ok(verifyDefault.body.data.adminSessionToken.startsWith("adm_"));

    const change = await handleChangeAdminPassword(service, {
      oldPassword: "123456",
      newPassword: "new-password-123",
    }, {
      ...headers,
      [ADMIN_SESSION_TOKEN_HEADER]: verifyDefault.body.data.adminSessionToken,
      "x-request-id": "req-admin-password-change",
    });

    assert.equal(change.statusCode, 200);
    assert.equal(change.body.success, true);

    const verifyNew = await handleVerifyAdminPassword(service, {
      password: "new-password-123",
    }, {
      ...headers,
      "x-request-id": "req-admin-password-verify-new",
    });

    assert.equal(verifyNew.statusCode, 200);
    assert.equal(verifyNew.body.success, true);
    if (!verifyNew.body.success) {
      return;
    }

    assert.equal(verifyNew.body.data.requiresPasswordChange, false);
  });

test("only admins can update another user's role", async () => {
  const service = new AdminConsoleService(new InMemoryAdminConsoleRepository());

    const unauthorized = await handleSetUserRole(service, {
      identity: "user-1@example.com",
      role: "admin",
    }, {
      "x-request-id": "req-admin-role-unauthorized",
    });

    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.body.success, false);

    const forbidden = await handleSetUserRole(service, {
      identity: "user-1@example.com",
      role: "admin",
    }, {
      [AUTHENTICATED_USER_ID_HEADER]: "user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "user",
      "x-request-id": "req-admin-role-forbidden",
    });

    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.success, false);

    const verify = await handleVerifyAdminPassword(service, {
      password: "123456",
    }, {
      [AUTHENTICATED_USER_ID_HEADER]: "admin-user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
      "x-request-id": "req-admin-role-verify",
    });

    assert.equal(verify.statusCode, 200);
    assert.equal(verify.body.success, true);
    if (!verify.body.success) {
      return;
    }

    const success = await handleSetUserRole(service, {
      identity: "user-1@example.com",
      role: "admin",
    }, {
      [AUTHENTICATED_USER_ID_HEADER]: "admin-user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
      [ADMIN_SESSION_TOKEN_HEADER]: verify.body.data.adminSessionToken,
      "x-request-id": "req-admin-role-success",
    });

    assert.equal(success.statusCode, 200);
    assert.equal(success.body.success, true);
    if (!success.body.success) {
      return;
    }

  assert.equal(success.body.data.identity, "user-1@example.com");
  assert.equal(success.body.data.role, "admin");
  assert.equal(success.body.data.subjectId, "user-1");
});

test('owner admin cannot be demoted through the delegated role mutation route', async () => {
  const service = new AdminConsoleService(new InMemoryAdminConsoleRepository(), {
    primaryAdminUserId: 'admin-user-1',
  });

  const verify = await handleVerifyAdminPassword(service, {
    password: '123456',
  }, {
    [AUTHENTICATED_USER_ID_HEADER]: 'admin-user-1',
    [AUTHENTICATED_USER_ROLE_HEADER]: 'admin',
    'x-request-id': 'req-owner-demotion-verify',
  });

  assert.equal(verify.statusCode, 200);
  assert.equal(verify.body.success, true);
  if (!verify.body.success) {
    return;
  }

  const demotion = await handleSetUserRole(service, {
    identity: 'admin-user-1',
    role: 'user',
  }, {
    [AUTHENTICATED_USER_ID_HEADER]: 'admin-user-1',
    [AUTHENTICATED_USER_ROLE_HEADER]: 'admin',
    [ADMIN_SESSION_TOKEN_HEADER]: verify.body.data.adminSessionToken,
    'x-request-id': 'req-owner-demotion',
  });

  assert.equal(demotion.statusCode, 409);
  assert.equal(demotion.body.success, false);
  if (demotion.body.success) {
    return;
  }

  assert.equal(demotion.body.error.code, 'PRIMARY_ADMIN_ROLE_PROTECTED');
});
});
