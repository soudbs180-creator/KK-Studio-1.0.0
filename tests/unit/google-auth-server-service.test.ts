import assert from "node:assert/strict";
import { test } from "node:test";

import { AuthService } from "../../apps/api/src/modules/auth/application/auth-service.ts";
import { GoogleAuthService } from "../../apps/api/src/modules/auth/application/google-auth-service.ts";

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

test("google auth service rejects redirect targets outside the allowlist", () => {
  const service = createService();

  assert.throws(() => {
    service.start({
      mode: "login",
      redirectTo: "https://evil.example.com/auth/callback",
    });
  }, /redirectTo origin is not allowed/i);
});

test("google auth service start returns a Google authorization URL with signed state", () => {
  const service = createService();

  const result = service.start({
    mode: "login",
    redirectTo: "https://app.example.com/auth/callback",
  });

  assert.equal(result.provider, "google");
  assert.equal(result.mode, "login");
  assert.match(result.authorizationUrl, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  assert.match(result.callbackUrl, /\/api\/v1\/auth\/google\/callback$/);
  assert.ok(result.state.length > 10);
});

test("google auth service callback exchanges code and redirects with KK API session tokens in the hash", async () => {
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

    if (url.includes("www.googleapis.com/oauth2/v2/userinfo")) {
      return new Response(JSON.stringify({
        email: "google-user@example.com",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected Google auth request: ${url}`);
  });
  const authService = new AuthService({
    verifyTurnstileToken: async () => ({ success: true }),
  });
  const start = service.start({
    mode: "login",
    redirectTo: "https://app.example.com/auth/callback",
  });

  const result = await service.handleCallback(authService, {
    code: "google-auth-code",
    state: start.state,
  });

  assert.match(result.redirectTo, /^https:\/\/app\.example\.com\/auth\/callback#/);
  const redirectUrl = new URL(result.redirectTo);
  const hashParams = new URLSearchParams(redirectUrl.hash.replace(/^#/, ""));
  assert.ok(hashParams.get("access_token"));
  assert.ok(hashParams.get("refresh_token"));
  assert.equal(hashParams.get("provider"), "google");
});
