import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import { AuthService } from "./auth-service.ts";

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
        email: string;
      };
    };
    assert.match(loginData.accessToken, /^kk-local-access-/);
    assert.match(loginData.refreshToken, /^kk-local-refresh-/);
    assert.equal(loginData.profile.email, "user@example.com");

    const tokenResolutionService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const resolvedProfile = tokenResolutionService.resolveAccessToken(loginData.accessToken);
    assert.equal(resolvedProfile?.email, "user@example.com");
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
