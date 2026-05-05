import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  createKkSessionToken,
  verifyKkSessionToken,
} from "../../apps/api/src/modules/auth/infrastructure/kk-session-token.ts";

const SESSION_SECRET_ENV = "KK_API_SESSION_SIGNING_SECRET";
const originalSessionSecret = process.env[SESSION_SECRET_ENV];
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (typeof originalSessionSecret === "string") {
    process.env[SESSION_SECRET_ENV] = originalSessionSecret;
  } else {
    delete process.env[SESSION_SECRET_ENV];
  }

  if (typeof originalNodeEnv === "string") {
    process.env.NODE_ENV = originalNodeEnv;
  } else {
    delete process.env.NODE_ENV;
  }
});

test("KK API session tokens round-trip the authenticated context without Supabase lookups", () => {
  process.env[SESSION_SECRET_ENV] = "unit-test-session-secret";

  const token = createKkSessionToken({
    tokenType: "access",
    userId: "session-user-1",
    email: "session@example.com",
    role: "admin",
    expiresInSeconds: 3600,
  });

  const verified = verifyKkSessionToken(token, { tokenType: "access" });

  assert.ok(verified);
  assert.equal(verified?.userId, "session-user-1");
  assert.equal(verified?.email, "session@example.com");
  assert.equal(verified?.role, "admin");
  assert.equal(verified?.tokenType, "access");
});

test("KK API session token verification rejects tampered signatures", () => {
  process.env[SESSION_SECRET_ENV] = "unit-test-session-secret";

  const token = createKkSessionToken({
    tokenType: "access",
    userId: "session-user-2",
    expiresInSeconds: 3600,
  });
  const tampered = `${token}tampered`;

  assert.equal(verifyKkSessionToken(tampered, { tokenType: "access" }), null);
});

test("KK API session tokens fail closed when no explicit signing secret is configured", () => {
  delete process.env[SESSION_SECRET_ENV];
  process.env.NODE_ENV = "test";

  assert.throws(() => {
    createKkSessionToken({
      tokenType: "access",
      userId: "session-user-3",
      expiresInSeconds: 3600,
    });
  }, /KK_API_SESSION_SIGNING_SECRET/);

  assert.throws(() => {
    verifyKkSessionToken("not.a.jwt", { tokenType: "access" });
  }, /KK_API_SESSION_SIGNING_SECRET/);
});
