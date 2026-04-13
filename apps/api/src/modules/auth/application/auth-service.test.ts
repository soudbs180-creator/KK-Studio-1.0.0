import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import { AuthService } from "./auth-service.ts";
import { verifyKkSessionToken } from "../infrastructure/kk-session-token.ts";

const LOCAL_AUTH_IDENTITY_FILE_ENV = "KK_LOCAL_AUTH_IDENTITY_FILE";
const originalLocalAuthIdentityFile = process.env[LOCAL_AUTH_IDENTITY_FILE_ENV];

afterEach(() => {
  if (typeof originalLocalAuthIdentityFile === "string") {
    process.env[LOCAL_AUTH_IDENTITY_FILE_ENV] = originalLocalAuthIdentityFile;
    return;
  }

  delete process.env[LOCAL_AUTH_IDENTITY_FILE_ENV];
});

test("default auth service persists local password registrations across service instances", async () => {
  const tempDirectory = mkdtempSync(path.join(tmpdir(), "kk-local-auth-"));
  process.env[LOCAL_AUTH_IDENTITY_FILE_ENV] = path.join(tempDirectory, "auth-identities.json");

  try {
    const registerService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const registerResult = await registerService.register({
      email: "User@Example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      ip: "127.0.0.1",
    });

    assert.equal(registerResult.statusCode, 201);
    assert.equal(registerResult.body.success, true);
    if (!registerResult.body.success) {
      return;
    }

    const registerData = registerResult.body.data as unknown as {
      email: string;
      status: string;
    };
    assert.equal(registerData.email, "user@example.com");
    assert.equal(registerData.status, "registered");

    const loginService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const loginResult = await loginService.login({
      email: "user@example.com",
      password: "password-123",
    }, {
      ip: "127.0.0.1",
    });

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
    assert.equal(loginData.profile.email, "user@example.com");
    assert.equal(verifyKkSessionToken(loginData.accessToken, { tokenType: "access" })?.userId, loginData.profile.id);
    assert.equal(verifyKkSessionToken(loginData.refreshToken, { tokenType: "refresh" })?.userId, loginData.profile.id);

    const tokenResolutionService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const resolvedProfile = tokenResolutionService.resolveAccessToken(loginData.accessToken);
    assert.equal(resolvedProfile?.email, "user@example.com");
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test("auth service updates password through the local identity store", async () => {
  const tempDirectory = mkdtempSync(path.join(tmpdir(), "kk-local-auth-password-"));
  process.env[LOCAL_AUTH_IDENTITY_FILE_ENV] = path.join(tempDirectory, "auth-identities.json");

  try {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const registerResult = await authService.register({
      email: "password-change@example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(registerResult.body.success, true);

    const loginResult = await authService.login({
      email: "password-change@example.com",
      password: "password-123",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(loginResult.body.success, true);
    if (!loginResult.body.success) {
      return;
    }

    const session = loginResult.body.data as {
      accessToken: string;
      profile: { id: string; email: string };
    };

    const updated = authService.updatePassword({
      authorization: `Bearer ${session.accessToken}`,
    }, {
      currentPassword: "password-123",
      newPassword: "new-password-456",
    });

    assert.equal(updated?.updated, true);
    assert.equal(updated?.profile.email, "password-change@example.com");

    const stalePasswordLogin = await authService.login({
      email: "password-change@example.com",
      password: "password-123",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(stalePasswordLogin.statusCode, 401);

    const freshPasswordLogin = await authService.login({
      email: "password-change@example.com",
      password: "new-password-456",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(freshPasswordLogin.statusCode, 200);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
