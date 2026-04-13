import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { AuthService } from "../../apps/api/src/modules/auth/application/auth-service.ts";
import { GoogleAuthService } from "../../apps/api/src/modules/auth/application/google-auth-service.ts";
import {
  handleGoogleCallback,
  handleStartGoogleBind,
  handleStartGoogleLogin,
} from "../../apps/api/src/modules/auth/presentation/http-google-auth-routes.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

function createService(fetchImpl?: typeof fetch) {
  return new GoogleAuthService({
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
    callbackUrl: "https://api.example.com/api/v1/auth/google/callback",
    stateSigningSecret: "google-state-signing-secret",
    allowedRedirectOrigins: ["https://app.example.com"],
    fetchImpl,
  });
}

test("google auth start route returns a typed success envelope", async () => {
  const service = createService();

  const result = await handleStartGoogleLogin(
    service,
    new URLSearchParams("redirectTo=https://app.example.com/auth/callback"),
    {
      "x-request-id": "req-google-start",
      "x-client-version": "unit-test",
    },
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  if (!result.body.success) {
    return;
  }

  assert.equal(result.body.data.provider, "google");
  assert.equal(result.body.meta.requestId, "req-google-start");
});

test("google auth callback route redirects through the frontend callback with KK tokens", async () => {
  const service = createService(async (input) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({
        access_token: "google-access-token",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("googleapis.com/oauth2/v2/userinfo")) {
      return new Response(JSON.stringify({
        email: "google-user@example.com",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  });
  const authService = new AuthService({
    verifyTurnstileToken: async () => ({ success: true }),
  });
  const start = service.start({
    mode: "login",
    redirectTo: "https://app.example.com/auth/callback",
  });

  const result = await handleGoogleCallback(
    service,
    authService,
    new URLSearchParams({
      code: "google-code",
      state: start.state,
    }),
  );

  assert.match(result.redirectTo, /^https:\/\/app\.example\.com\/auth\/callback#/);
  const redirect = new URL(result.redirectTo);
  const hash = new URLSearchParams(redirect.hash.replace(/^#/, ""));
  assert.equal(hash.get("provider"), "google");
  assert.ok(hash.get("access_token"));
});

test("google bind start route fails clearly until durable bind persistence exists", async () => {
  const service = createService();

  const result = await handleStartGoogleBind(
    service,
    new URLSearchParams("redirectTo=https://app.example.com/auth/callback?mode=google-bind"),
    {
      "x-request-id": "req-google-bind-start",
      "x-client-version": "unit-test",
    },
  );

  assert.equal(result.statusCode, 501);
  assert.equal(result.body.success, false);
  if (result.body.success) {
    return;
  }

  assert.equal(result.body.error.code, "GOOGLE_BIND_UNAVAILABLE");
});

test("AuthCallback keeps provider hints from the hash for VPS-native OAuth sessions", () => {
  const source = readSource("src/pages/AuthCallback.tsx");

  assert.match(source, /const provider = String\(hashParams\.get\('provider'\) \|\| ''\)\.trim\(\)\.toLowerCase\(\);/);
  assert.match(source, /if \(provider === 'google' \|\| provider === 'wechat'\) \{/);
  assert.match(source, /updateRuntimeUserMetadata\(\{\s*authProvider: provider,\s*addProvider: provider,/);
});
