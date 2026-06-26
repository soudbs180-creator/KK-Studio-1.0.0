import assert from "node:assert/strict";
import { test } from "node:test";

import securityHeaders from "../../server/middleware/securityHeaders.js";
import logRedactor from "../../server/middleware/logRedactor.js";

test("securityHeaders middleware sets expected headers", () => {
  const headers: Record<string, string> = {};
  const req = { path: "/api/v1/user" };
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    }
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  securityHeaders(req, res, next);

  assert.ok(nextCalled);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
});

test("securityHeaders middleware bypasses Stripe webhooks", () => {
  const headers: Record<string, string> = {};
  const req = { path: "/webhook/stripe" };
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    }
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  securityHeaders(req, res, next);

  assert.ok(nextCalled);
  assert.equal(headers["X-Content-Type-Options"], undefined);
  assert.equal(headers["X-Frame-Options"], undefined);
});

test("logRedactor middleware redacts sensitive fields from body and headers", () => {
  const req = {
    body: {
      username: "user1",
      password: "secret_password",
      apiKey: "sk-proj-key123",
      api_key: "another-api-key",
      secret: "my-app-secret",
      nested: {
        token: "access_token_val",
        deepSecret: {
          token: "deep-token"
        }
      }
    },
    headers: {
      host: "localhost",
      authorization: "Bearer my-jwt-token",
      cookie: "session_id=abc123token"
    },
    redactedBody: null,
    redactedHeaders: null
  };
  const res = {};
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  logRedactor(req, res, next);

  assert.ok(nextCalled);
  assert.equal((req.body as any).password, "secret_password"); // 原对象不应被破坏
  assert.ok(req.redactedBody);
  assert.equal((req.redactedBody as any).password, "[REDACTED]");
  assert.equal((req.redactedBody as any).apiKey, "[REDACTED]");
  assert.equal((req.redactedBody as any).api_key, "[REDACTED]");
  assert.equal((req.redactedBody as any).secret, "[REDACTED]");
  assert.equal((req.redactedBody as any).username, "user1");
  assert.equal((req.redactedBody as any).nested.token, "[REDACTED]");
  assert.equal((req.redactedBody as any).nested.deepSecret.token, "[REDACTED]");

  assert.ok(req.redactedHeaders);
  assert.equal((req.redactedHeaders as any).host, "localhost");
  assert.equal((req.redactedHeaders as any).authorization, "[REDACTED]");
  assert.equal((req.redactedHeaders as any).cookie, "[REDACTED]");
});
