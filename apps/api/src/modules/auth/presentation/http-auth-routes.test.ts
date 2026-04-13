import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { AuthService } from "../application/auth-service.ts";
import { verifyKkSessionToken } from "../infrastructure/kk-session-token.ts";
import { handleVersionedLogin, handleVersionedRegister } from "./http-auth-routes.ts";

describe("http auth routes", () => {
  test("returns success envelopes for local password register and login", async () => {
    const tempDirectory = mkdtempSync(path.join(tmpdir(), "kk-local-auth-routes-"));
    const originalIdentityFile = process.env.KK_LOCAL_AUTH_IDENTITY_FILE;
    process.env.KK_LOCAL_AUTH_IDENTITY_FILE = path.join(tempDirectory, "auth-identities.json");

    try {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const registerResult = await handleVersionedRegister(authService, {
      email: "route-user@example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      "x-request-id": "req-auth-module-register",
      "x-client-version": "auth-module-test",
    }, "127.0.0.1");

    assert.equal(registerResult.statusCode, 201);
    assert.equal(registerResult.body.success, true);
    if (!registerResult.body.success) {
      return;
    }

    const registerData = registerResult.body.data as unknown as {
      email: string;
      status: string;
    };
    assert.equal(registerData.email, "route-user@example.com");
    assert.equal(registerData.status, "registered");
    assert.equal(registerResult.body.meta.requestId, "req-auth-module-register");

    const loginResult = await handleVersionedLogin(authService, {
      email: "route-user@example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      "x-request-id": "req-auth-module-login",
      "x-client-version": "auth-module-test",
    }, "127.0.0.1");

    assert.equal(loginResult.statusCode, 200);
    assert.equal(loginResult.body.success, true);
    if (!loginResult.body.success) {
      return;
    }

    const loginData = loginResult.body.data as unknown as {
      accessToken: string;
      refreshToken: string;
      profile: {
        id: string;
        email: string;
      };
    };
    assert.match(loginData.accessToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.match(loginData.refreshToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(loginData.profile.email, "route-user@example.com");
    assert.equal(verifyKkSessionToken(loginData.accessToken, { tokenType: "access" })?.userId, loginData.profile.id);
    assert.equal(verifyKkSessionToken(loginData.refreshToken, { tokenType: "refresh" })?.userId, loginData.profile.id);
    assert.equal(loginResult.body.meta.requestId, "req-auth-module-login");
    } finally {
      if (typeof originalIdentityFile === "string") {
        process.env.KK_LOCAL_AUTH_IDENTITY_FILE = originalIdentityFile;
      } else {
        delete process.env.KK_LOCAL_AUTH_IDENTITY_FILE;
      }

      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
