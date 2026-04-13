import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AuthService } from "../../apps/api/src/modules/auth/application/auth-service.ts";
import { InMemoryAuthIdentityStore } from "../../apps/api/src/modules/auth/infrastructure/in-memory-auth-identity-store.ts";
import {
  handleGetProfile,
  handleUpdateProfile,
  handleVersionedLogin,
  handleVersionedRegister,
} from "../../apps/api/src/modules/auth/presentation/http-auth-routes.ts";

describe("auth http routes", () => {
  test("returns an OpenAPI-shaped success envelope for register", async () => {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const result = await handleVersionedRegister(authService, {
      email: "register-user@example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      "x-request-id": "req-register-1",
      "x-client-version": "test-suite",
    }, "127.0.0.1");

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.success, true);
    if (result.body.success) {
      assert.equal(result.body.data.email, "register-user@example.com");
      assert.equal(result.body.data.status, "registered");
      assert.equal(result.body.meta.requestId, "req-register-1");
    }
  });

  test("returns an OpenAPI-shaped success envelope for login", async () => {
    const identityStore = new InMemoryAuthIdentityStore();
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
      identityStore,
    });
    identityStore.registerPasswordUser("user@example.com", "password-123");

    const result = await handleVersionedLogin(authService, {
      email: "user@example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      "x-request-id": "req-login-1",
    }, "127.0.0.1");

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (result.body.success) {
      assert.ok(result.body.data.accessToken);
      assert.ok(result.body.data.refreshToken);
      assert.equal(result.body.data.profile.email, "user@example.com");
      assert.equal(result.body.meta.requestId, "req-login-1");
    }
  });

  test("resolves and updates profile from the issued access token", async () => {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
      identityStore: new InMemoryAuthIdentityStore(),
    });

    const login = authService.issueLoginSession("profile@example.com");

    const profile = await handleGetProfile(authService, {
      authorization: `Bearer ${login.accessToken}`,
      "x-request-id": "req-profile-get",
    });

    assert.equal(profile.statusCode, 200);
    assert.equal(profile.body.success, true);
    if (!profile.body.success) {
      return;
    }
    assert.equal(profile.body.data.email, "profile@example.com");

    const updated = await handleUpdateProfile(authService, {
      nickname: "KK Architect",
    }, {
      authorization: `Bearer ${login.accessToken}`,
      "x-request-id": "req-profile-patch",
    });

    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.success, true);
    if (updated.body.success) {
      assert.equal(updated.body.data.nickname, "KK Architect");
    }
  });
});
