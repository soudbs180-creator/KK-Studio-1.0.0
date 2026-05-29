import assert from "node:assert/strict";
import { test } from "node:test";

import { createKkApiClient } from "../../packages/shared/src/contracts/client/kk-api-client.ts";

test("KK API client sends browser credentials for every auth route used by mobile sign-in flows", async () => {
  const credentials: Array<RequestCredentials | undefined> = [];
  const client = createKkApiClient({
    baseUrl: "https://api.example.com",
    fetchImpl: async (_input, init) => {
      credentials.push(init?.credentials);
      return new Response(JSON.stringify({
        success: true,
        data: {
          provider: "google",
          mode: "login",
          authorizationUrl: "https://accounts.example.com/oauth",
          callbackUrl: "https://api.example.com/api/v1/auth/google/callback",
          state: "state-1",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
        meta: {
          requestId: "req-google-start",
          timestamp: new Date().toISOString(),
        },
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    },
  });

  await client.startGoogleLogin("https://app.example.com/auth/callback");

  assert.equal(credentials[0], "include");
});

test("KK API client persists X-Refresh-Token before returning envelope responses", async () => {
  let refreshedToken: string | undefined;
  const client = createKkApiClient({
    baseUrl: "https://api.example.com",
    onRefreshToken: async (token) => {
      refreshedToken = token;
    },
    fetchImpl: async () => new Response(JSON.stringify({
      success: true,
      data: {
        id: "user-1",
        email: "user@example.com",
        nickname: "User One",
        role: "user",
        status: "active",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      meta: {
        requestId: "req-profile",
        timestamp: new Date().toISOString(),
      },
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-refresh-token": "new-access-token",
      },
    }),
  });

  await client.getProfile({ accessToken: "old-access-token" });

  assert.equal(refreshedToken, "new-access-token");
});
