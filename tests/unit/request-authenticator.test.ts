import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  createRequestAuthenticator,
  type AuthenticatedRequestContext,
} from "../../apps/api/src/lib/request-authenticator.ts";
import { createKkSessionToken } from "../../apps/api/src/modules/auth/infrastructure/kk-session-token.ts";

const sessionSecretEnv = "KK_API_SESSION_SIGNING_SECRET";
const requireSecretEnv = "KK_REQUIRE_SESSION_SIGNING_SECRET";
const nodeEnv = "NODE_ENV";
const originalSessionSecret = process.env[sessionSecretEnv];
const originalRequireSecret = process.env[requireSecretEnv];
const originalNodeEnv = process.env[nodeEnv];

afterEach(() => {
  if (typeof originalSessionSecret === "string") {
    process.env[sessionSecretEnv] = originalSessionSecret;
  } else {
    delete process.env[sessionSecretEnv];
  }

  if (typeof originalRequireSecret === "string") {
    process.env[requireSecretEnv] = originalRequireSecret;
  } else {
    delete process.env[requireSecretEnv];
  }

  if (typeof originalNodeEnv === "string") {
    process.env[nodeEnv] = originalNodeEnv;
  } else {
    delete process.env[nodeEnv];
  }
});

test("request authenticator accepts locally signed KK API access tokens before any fallback", async () => {
  process.env[sessionSecretEnv] = "request-authenticator-test-secret";
  let resolveCallCount = 0;

  const authenticator = createRequestAuthenticator({
    resolveLegacyAccessToken: () => {
      resolveCallCount += 1;
      return undefined;
    },
  });

  const accessToken = createKkSessionToken({
    tokenType: "access",
    userId: "auth-user-local",
    email: "local@example.com",
    role: "admin",
    expiresInSeconds: 3600,
  });

  const result = await authenticator.authenticate({
    authorization: `Bearer ${accessToken}`,
  });

  assert.equal(result, undefined);
  assert.equal(resolveCallCount, 1);
});

test("request authenticator trusts signed KK API tokens when no stateful resolver is configured", async () => {
  process.env[sessionSecretEnv] = "request-authenticator-test-secret";
  const authenticator = createRequestAuthenticator({});

  const accessToken = createKkSessionToken({
    tokenType: "access",
    userId: "auth-user-direct",
    email: "direct@example.com",
    role: "admin",
    expiresInSeconds: 3600,
  });

  const result = await authenticator.authenticate({
    authorization: `Bearer ${accessToken}`,
  });

  assert.deepEqual(result, {
    userId: "auth-user-direct",
    email: "direct@example.com",
    role: "admin",
  });
});

test("request authenticator accepts stateful resolver results for signed KK API access tokens", async () => {
  process.env[sessionSecretEnv] = "request-authenticator-test-secret";
  const expectedContext: AuthenticatedRequestContext = {
    userId: "auth-user-stateful",
    email: "stateful@example.com",
    role: "user",
  };

  const accessToken = createKkSessionToken({
    tokenType: "access",
    userId: "auth-user-stateful",
    email: "stateful@example.com",
    role: "admin",
    expiresInSeconds: 3600,
  });

  const authenticator = createRequestAuthenticator({
    resolveLegacyAccessToken: (token) => (
      token === accessToken ? expectedContext : undefined
    ),
  });

  const result = await authenticator.authenticate({
    authorization: `Bearer ${accessToken}`,
  });

  assert.deepEqual(result, expectedContext);
});

test("request authenticator rejects refresh tokens used as bearer access tokens", async () => {
  process.env[sessionSecretEnv] = "request-authenticator-test-secret";
  const authenticator = createRequestAuthenticator({});

  const refreshToken = createKkSessionToken({
    tokenType: "refresh",
    userId: "auth-user-refresh",
    expiresInSeconds: 3600,
  });

  const result = await authenticator.authenticate({
    authorization: `Bearer ${refreshToken}`,
  });

  assert.equal(result, undefined);
});

test("request authenticator rejects expired signed KK API access tokens", async () => {
  process.env[sessionSecretEnv] = "request-authenticator-test-secret";
  const authenticator = createRequestAuthenticator({});

  const accessToken = createKkSessionToken({
    tokenType: "access",
    userId: "auth-user-expired",
    expiresInSeconds: 1,
  });

  await new Promise((resolve) => setTimeout(resolve, 1100));
  const result = await authenticator.authenticate({
    authorization: `Bearer ${accessToken}`,
  });

  assert.equal(result, undefined);
});
