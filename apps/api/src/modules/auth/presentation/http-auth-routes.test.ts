import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { AuthService } from "../application/auth-service.ts";
import {
  handleSendPasswordChangeCode,
  handleUpdatePassword,
  handleVersionedLogin,
  handleVersionedRegister,
} from "./http-auth-routes.ts";

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
    assert.equal(
      (await authService.getProfile({ authorization: `Bearer ${loginData.accessToken}` }))?.id,
      loginData.profile.id,
    );
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

  test("returns success envelopes for password-change code delivery and password update", async () => {
    const tempDirectory = mkdtempSync(path.join(tmpdir(), "kk-local-auth-password-routes-"));
    const originalIdentityFile = process.env.KK_LOCAL_AUTH_IDENTITY_FILE;
    process.env.KK_LOCAL_AUTH_IDENTITY_FILE = path.join(tempDirectory, "auth-identities.json");

    let deliveredEmail = "";
    let deliveredVerificationCode = "";

    try {
      const authService = new AuthService({
        verifyTurnstileToken: async () => ({ success: true }),
        passwordChangeCodeEmailSender: {
          async sendPasswordChangeCode(payload) {
            deliveredEmail = payload.email;
            deliveredVerificationCode = payload.code;
          },
        },
      });

      const registerResult = await handleVersionedRegister(authService, {
        email: "password-route-success@example.com",
        password: "password-123",
        turnstileToken: "turnstile-ok",
      }, {
        "x-request-id": "req-auth-password-register",
        "x-client-version": "auth-module-test",
      }, "127.0.0.1");
      assert.equal(registerResult.statusCode, 201);
      assert.equal(registerResult.body.success, true);

      const loginResult = await handleVersionedLogin(authService, {
        email: "password-route-success@example.com",
        password: "password-123",
      }, {
        "x-request-id": "req-auth-password-login",
        "x-client-version": "auth-module-test",
      }, "127.0.0.1");
      assert.equal(loginResult.statusCode, 200);
      assert.equal(loginResult.body.success, true);
      if (!loginResult.body.success) {
        return;
      }

      const sendCodeResult = await handleSendPasswordChangeCode(authService, {
        authorization: `Bearer ${loginResult.body.data.accessToken}`,
        "x-request-id": "req-auth-password-send-code",
        "x-client-version": "auth-module-test",
      });
      assert.equal(sendCodeResult.statusCode, 200);
      assert.equal(sendCodeResult.body.success, true);
      if (!sendCodeResult.body.success) {
        return;
      }

      assert.equal(sendCodeResult.body.data.sent, true);
      assert.equal(sendCodeResult.body.data.email, "password-route-success@example.com");
      assert.equal(sendCodeResult.body.meta.requestId, "req-auth-password-send-code");
      assert.equal(deliveredEmail, "password-route-success@example.com");
      assert.match(deliveredVerificationCode, /^\d{6}$/);

      const updateResult = await handleUpdatePassword(authService, {
        verificationCode: deliveredVerificationCode,
        newPassword: "new-password-456",
      }, {
        authorization: `Bearer ${loginResult.body.data.accessToken}`,
        "x-request-id": "req-auth-password-update",
        "x-client-version": "auth-module-test",
      });
      assert.equal(updateResult.statusCode, 200);
      assert.equal(updateResult.body.success, true);
      if (!updateResult.body.success) {
        return;
      }

      assert.equal(updateResult.body.data.updated, true);
      assert.equal(updateResult.body.data.profile.email, "password-route-success@example.com");
      assert.equal(updateResult.body.meta.requestId, "req-auth-password-update");

      const staleLoginResult = await handleVersionedLogin(authService, {
        email: "password-route-success@example.com",
        password: "password-123",
      }, {
        "x-request-id": "req-auth-password-stale-login",
        "x-client-version": "auth-module-test",
      }, "127.0.0.1");
      assert.equal(staleLoginResult.statusCode, 401);
      assert.equal(staleLoginResult.body.success, false);

      const freshLoginResult = await handleVersionedLogin(authService, {
        email: "password-route-success@example.com",
        password: "new-password-456",
      }, {
        "x-request-id": "req-auth-password-fresh-login",
        "x-client-version": "auth-module-test",
      }, "127.0.0.1");
      assert.equal(freshLoginResult.statusCode, 200);
      assert.equal(freshLoginResult.body.success, true);
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
