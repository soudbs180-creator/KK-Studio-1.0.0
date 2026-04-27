import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import { AuthService } from "./auth-service.ts";
import { verifyKkSessionToken } from "../infrastructure/kk-session-token.ts";

const LOCAL_AUTH_IDENTITY_FILE_ENV = "KK_LOCAL_AUTH_IDENTITY_FILE";
const LOCAL_EMAIL_OUTBOX_DIR_ENV = "KK_LOCAL_EMAIL_OUTBOX_DIR";
const originalLocalAuthIdentityFile = process.env[LOCAL_AUTH_IDENTITY_FILE_ENV];
const originalLocalEmailOutboxDir = process.env[LOCAL_EMAIL_OUTBOX_DIR_ENV];

afterEach(() => {
  if (typeof originalLocalAuthIdentityFile === "string") {
    process.env[LOCAL_AUTH_IDENTITY_FILE_ENV] = originalLocalAuthIdentityFile;
  } else {
    delete process.env[LOCAL_AUTH_IDENTITY_FILE_ENV];
  }

  if (typeof originalLocalEmailOutboxDir === "string") {
    process.env[LOCAL_EMAIL_OUTBOX_DIR_ENV] = originalLocalEmailOutboxDir;
  } else {
    delete process.env[LOCAL_EMAIL_OUTBOX_DIR_ENV];
  }
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

    const resolvedProfile = await tokenResolutionService.resolveAccessToken(loginData.accessToken);
    assert.equal(resolvedProfile?.email, "user@example.com");
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test("auth service updates password through the local identity store", async () => {
  const tempDirectory = mkdtempSync(path.join(tmpdir(), "kk-local-auth-password-"));
  process.env[LOCAL_AUTH_IDENTITY_FILE_ENV] = path.join(tempDirectory, "auth-identities.json");
  process.env[LOCAL_EMAIL_OUTBOX_DIR_ENV] = path.join(tempDirectory, "email-outbox");

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

    const sendCode = await authService.sendPasswordChangeCode({
      authorization: `Bearer ${session.accessToken}`,
    });
    assert.equal(sendCode.statusCode, 200);
    assert.equal(sendCode.body.success, true);
    if (!sendCode.body.success) {
      return;
    }

    const outboxPath = path.join(tempDirectory, "email-outbox");
    const verificationCode = JSON.parse(
      readFileSync(path.join(outboxPath, readdirSync(outboxPath)[0]), "utf8"),
    ).code as string;

    const updated = await authService.updatePassword({
      authorization: `Bearer ${session.accessToken}`,
    }, {
      verificationCode,
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

test("auth service updates password with a verification code", async () => {
  const tempDirectory = mkdtempSync(path.join(tmpdir(), "kk-local-auth-current-password-"));
  process.env[LOCAL_AUTH_IDENTITY_FILE_ENV] = path.join(tempDirectory, "auth-identities.json");
  process.env[LOCAL_EMAIL_OUTBOX_DIR_ENV] = path.join(tempDirectory, "email-outbox");

  try {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const registerResult = await authService.register({
      email: "current-password@example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(registerResult.body.success, true);

    const loginResult = await authService.login({
      email: "current-password@example.com",
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
    };

    const sendCode = await authService.sendPasswordChangeCode({
      authorization: `Bearer ${session.accessToken}`,
    });
    assert.equal(sendCode.statusCode, 200);
    assert.equal(sendCode.body.success, true);
    if (!sendCode.body.success) {
      return;
    }

    const outboxPath = path.join(tempDirectory, "email-outbox");
    const verificationCode = JSON.parse(
      readFileSync(path.join(outboxPath, readdirSync(outboxPath)[0]), "utf8"),
    ).code as string;

    const updated = await authService.updatePassword({
      authorization: `Bearer ${session.accessToken}`,
    }, {
      verificationCode,
      newPassword: "replacement-789",
    });

    assert.equal(updated?.updated, true);

    const freshPasswordLogin = await authService.login({
      email: "current-password@example.com",
      password: "replacement-789",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(freshPasswordLogin.statusCode, 200);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test("auth service requires a turnstile token on registration", async () => {
  const authService = new AuthService({
    verifyTurnstileToken: async () => ({ success: true }),
  });

  const registerResult = await authService.register({
    email: "missing-turnstile@example.com",
    password: "password-123",
  } as any, {
    ip: "127.0.0.1",
  });

  assert.equal(registerResult.statusCode, 400);
  assert.equal(registerResult.body.success, false);
});

test("auth service clears issued password change codes after a current-password reset", async () => {
  const tempDirectory = mkdtempSync(path.join(tmpdir(), "kk-local-auth-password-clear-"));
  process.env[LOCAL_AUTH_IDENTITY_FILE_ENV] = path.join(tempDirectory, "auth-identities.json");
  process.env[LOCAL_EMAIL_OUTBOX_DIR_ENV] = path.join(tempDirectory, "email-outbox");

  try {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const registerResult = await authService.register({
      email: "clear-code@example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(registerResult.body.success, true);

    const loginResult = await authService.login({
      email: "clear-code@example.com",
      password: "password-123",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(loginResult.body.success, true);
    if (!loginResult.body.success) {
      return;
    }

    const session = loginResult.body.data as { accessToken: string };
    const sendCode = await authService.sendPasswordChangeCode({
      authorization: `Bearer ${session.accessToken}`,
    });
    assert.equal(sendCode.statusCode, 200);
    assert.equal(sendCode.body.success, true);

    const outboxPath = path.join(tempDirectory, "email-outbox");
    const verificationCode = JSON.parse(
      readFileSync(path.join(outboxPath, readdirSync(outboxPath)[0]), "utf8"),
    ).code as string;

    const updated = await authService.updatePassword({
      authorization: `Bearer ${session.accessToken}`,
    }, {
      currentPassword: "password-123",
      newPassword: "replacement-789",
    });
    assert.equal(updated?.updated, true);

    const rejectedReuse = await authService.updatePassword({
      authorization: `Bearer ${session.accessToken}`,
    }, {
      verificationCode,
      newPassword: "should-not-work",
    });
    assert.equal(rejectedReuse, undefined);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test("auth service rate-limits repeated password verification code attempts", async () => {
  const tempDirectory = mkdtempSync(path.join(tmpdir(), "kk-local-auth-password-rate-limit-"));
  process.env[LOCAL_AUTH_IDENTITY_FILE_ENV] = path.join(tempDirectory, "auth-identities.json");
  process.env[LOCAL_EMAIL_OUTBOX_DIR_ENV] = path.join(tempDirectory, "email-outbox");

  try {
    const authService = new AuthService({
      verifyTurnstileToken: async () => ({ success: true }),
    });

    const registerResult = await authService.register({
      email: "rate-limit-code@example.com",
      password: "password-123",
      turnstileToken: "turnstile-ok",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(registerResult.body.success, true);

    const loginResult = await authService.login({
      email: "rate-limit-code@example.com",
      password: "password-123",
    }, {
      ip: "127.0.0.1",
    });
    assert.equal(loginResult.body.success, true);
    if (!loginResult.body.success) {
      return;
    }

    const session = loginResult.body.data as { accessToken: string };
    const sendCode = await authService.sendPasswordChangeCode({
      authorization: `Bearer ${session.accessToken}`,
    });
    assert.equal(sendCode.statusCode, 200);
    assert.equal(sendCode.body.success, true);

    const outboxPath = path.join(tempDirectory, "email-outbox");
    const verificationCode = JSON.parse(
      readFileSync(path.join(outboxPath, readdirSync(outboxPath)[0]), "utf8"),
    ).code as string;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rejected = await authService.updatePassword({
        authorization: `Bearer ${session.accessToken}`,
      }, {
        verificationCode: "000000",
        newPassword: `invalid-${attempt}-pass`,
      });
      assert.equal(rejected, undefined);
    }

    const blocked = await authService.updatePassword({
      authorization: `Bearer ${session.accessToken}`,
    }, {
      verificationCode,
      newPassword: "replacement-999",
    });
    assert.equal(blocked, undefined);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
