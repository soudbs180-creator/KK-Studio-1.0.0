import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AuthService } from "../../apps/api/src/modules/auth/application/auth-service.ts";
import {
  handleGetProfile,
  handleUpdateProfile,
  handleVersionedLogin,
  handleVersionedRegister,
} from "../../apps/api/src/modules/auth/presentation/http-auth-routes.ts";

describe("auth http routes", () => {
  test("returns an OpenAPI-shaped envelope for register", async () => {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const result = await handleVersionedRegister(authService, {
      email: "User@Example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      "x-request-id": "req-register-1",
      "x-client-version": "test-suite",
    }, "127.0.0.1");

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.success, true);
    if (result.body.success) {
      assert.equal(result.body.data.email, "user@example.com");
      assert.equal(result.body.data.status, "verification_pending");
      assert.equal(result.body.meta.requestId, "req-register-1");
    }
  });

  test("returns an OpenAPI-shaped envelope for login", async () => {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

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
      assert.ok(result.body.data.accessToken.startsWith("stub-access-"));
      assert.ok(result.body.data.refreshToken.startsWith("stub-refresh-"));
      assert.equal(result.body.data.profile.email, "user@example.com");
      assert.equal(result.body.data.expiresIn, 3600);
    }
  });

  test("resolves and updates profile from the issued access token", async () => {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const login = await handleVersionedLogin(authService, {
      email: "profile@example.com",
      password: "password-123",
    }, {
      "x-request-id": "req-profile-login",
    }, "127.0.0.1");

    assert.equal(login.body.success, true);
    if (!login.body.success) {
      return;
    }

    const profile = await handleGetProfile(authService, {
      authorization: `Bearer ${login.body.data.accessToken}`,
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
      authorization: `Bearer ${login.body.data.accessToken}`,
      "x-request-id": "req-profile-patch",
    });

    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.success, true);
    if (updated.body.success) {
      assert.equal(updated.body.data.nickname, "KK Architect");
    }
  });
});
