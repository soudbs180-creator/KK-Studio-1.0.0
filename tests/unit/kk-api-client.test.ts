import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { createKkApiClient } from "../../packages/contracts/src/index.ts";
import { TEMP_USER_ID_HEADER } from "../../packages/shared/src/index.ts";
import {
  createLegacyWebApiClient,
  isLoopbackHostname,
  shouldUseLegacyWebApiFallback,
} from "../../src/services/api/kkApiClient.ts";

describe("kk api client", () => {
  test("keeps admin recharge DTO public while client avoids unused direct DTO imports", () => {
    const contractsSourceRoot = path.join("packages", "contracts", "src");
    const clientSource = readFileSync(
      path.join(contractsSourceRoot, "client", "kk-api-client.ts"),
      "utf8",
    );
    const billingDtoSource = readFileSync(
      path.join(contractsSourceRoot, "dto", "billing.ts"),
      "utf8",
    );

    assert.match(
      billingDtoSource,
      /export interface AdminRechargeSubmissionDto extends RechargeSubmissionDto/,
    );
    assert.doesNotMatch(clientSource, /\bAdminRechargeSubmissionDto,/);
    assert.match(clientSource, /ListAdminRechargeSubmissionsResponseDto/);
    assert.match(clientSource, /GetAdminRechargeSubmissionResponseDto/);
    assert.match(clientSource, /ReviewRechargeSubmissionResponseDto/);
  });

  test("detects loopback hosts for local-only Web API fallbacks", () => {
    assert.equal(isLoopbackHostname("localhost"), true);
    assert.equal(isLoopbackHostname("127.0.0.1"), true);
    assert.equal(isLoopbackHostname("::1"), true);
    assert.equal(isLoopbackHostname("kkai.plus"), false);
  });

  test("keeps legacy Web API fallback disabled on hosted origins when only the API base URL is configured", () => {
    const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
    const originalLegacyFallback = process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
    const locationLike = globalThis as { location?: { origin?: string } };
    const originalLocation = locationLike.location;

    process.env.VITE_KK_API_BASE_URL = "https://api.example.com";
    delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
    locationLike.location = { origin: "https://kk-studio.vercel.app" };

    try {
      assert.equal(shouldUseLegacyWebApiFallback(), false);
    } finally {
      if (typeof originalBaseUrl === "string") {
        process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
      } else {
        delete process.env.VITE_KK_API_BASE_URL;
      }
      if (typeof originalLegacyFallback === "string") {
        process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = originalLegacyFallback;
      } else {
        delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
      }
      locationLike.location = originalLocation;
    }
  });

  test("requires an explicit opt-in to enable legacy Web API fallback on hosted origins", () => {
    const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
    const originalLegacyFallback = process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
    const locationLike = globalThis as { location?: { origin?: string } };
    const originalLocation = locationLike.location;

    process.env.VITE_KK_API_BASE_URL = "https://api.example.com";
    process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = "true";
    locationLike.location = { origin: "https://kk-studio.vercel.app" };

    try {
      assert.equal(shouldUseLegacyWebApiFallback(), true);
    } finally {
      if (typeof originalBaseUrl === "string") {
        process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
      } else {
        delete process.env.VITE_KK_API_BASE_URL;
      }
      if (typeof originalLegacyFallback === "string") {
        process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = originalLegacyFallback;
      } else {
        delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
      }
      locationLike.location = originalLocation;
    }
  });

  test("keeps legacy Web API fallback enabled on local loopback origins", () => {
    const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
    const originalLegacyFallback = process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
    const locationLike = globalThis as { location?: { origin?: string } };
    const originalLocation = locationLike.location;

    delete process.env.VITE_KK_API_BASE_URL;
    delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
    locationLike.location = { origin: "http://127.0.0.1:3000" };

    try {
      assert.equal(shouldUseLegacyWebApiFallback(), true);
    } finally {
      if (typeof originalBaseUrl === "string") {
        process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
      } else {
        delete process.env.VITE_KK_API_BASE_URL;
      }
      if (typeof originalLegacyFallback === "string") {
        process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK = originalLegacyFallback;
      } else {
        delete process.env.VITE_ENABLE_LEGACY_WEB_API_FALLBACK;
      }
      locationLike.location = originalLocation;
    }
  });

  test("sends generation task requests with the spec headers", async () => {
    const requests: Array<{
      body?: string;
      headers?: HeadersInit;
      method?: string;
      url: string;
    }> = [];

    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      getAccessToken: () => "token-123",
      getClientVersion: () => "web-1.0.0",
      getDefaultHeaders: () => ({ "x-tenant-id": "tenant-1" }),
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          headers: init?.headers,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {
            id: "task-1",
            workspaceId: "workspace-1",
            workflowId: "workflow-1",
            requesterId: "user-1",
            modelCode: "gemini-2.5-flash-image",
            taskType: "image",
            status: "queued",
            prompt: "hello",
            references: [],
            idempotencyKey: "idem-1",
            createdAt: "2026-03-23T00:00:00.000Z",
            results: [],
          },
          meta: {
            requestId: "req-fixed",
            timestamp: "2026-03-23T00:00:00.000Z",
            clientVersion: "web-1.0.0",
          },
        }), {
          status: 202,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    const response = await client.createGenerationTask({
      workspaceId: "workspace-1",
      workflowId: "workflow-1",
      modelCode: "gemini-2.5-flash-image",
      taskType: "image",
      prompt: "hello",
      idempotencyKey: "idem-1",
    }, {
      requestId: "req-fixed",
    });

    assert.equal(response.success, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/generation-tasks");
    assert.equal(requests[0].method, "POST");

    const headers = new Headers(requests[0].headers);
    assert.equal(headers.get("authorization"), "Bearer token-123");
    assert.equal(headers.get("x-client-version"), "web-1.0.0");
    assert.equal(headers.get("x-request-id"), "req-fixed");
    assert.equal(headers.get("x-tenant-id"), "tenant-1");
    assert.equal(headers.get("content-type"), "application/json; charset=utf-8");

    assert.deepEqual(JSON.parse(requests[0].body || "{}"), {
      workspaceId: "workspace-1",
      workflowId: "workflow-1",
      modelCode: "gemini-2.5-flash-image",
      taskType: "image",
      prompt: "hello",
      idempotencyKey: "idem-1",
    });
  });

  test("builds password login requests against the versioned auth route", async () => {
    const requests: Array<{
      body?: string;
      credentials?: RequestCredentials;
      method?: string;
      url: string;
    }> = [];

    const client = createKkApiClient({
      baseUrl: "http://172.245.156.16",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          credentials: init?.credentials,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: false,
          error: {
            code: "AUTH_REQUIRED",
            message: "Invalid login credentials.",
          },
          meta: {
            requestId: "req-login-client",
            timestamp: "2026-05-07T00:00:00.000Z",
          },
        }), {
          status: 401,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    const response = await client.login({
      email: "missing@example.com",
      password: "missing-password",
    }, {
      requestId: "req-login-client",
    });

    assert.equal(response.success, false);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://172.245.156.16/api/v1/auth/login");
    assert.equal(requests[0].method, "POST");
    assert.equal(requests[0].credentials, "include");
    assert.deepEqual(JSON.parse(requests[0].body || "{}"), {
      email: "missing@example.com",
      password: "missing-password",
    });
  });

  test("wraps non-envelope http failures into the standard error shape", async () => {
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async () => new Response("upstream failed", {
        status: 502,
        statusText: "Bad Gateway",
      }),
    });

    const response = await client.getWorkflow("workspace-1", "workflow-1", {
      requestId: "req-error-1",
    });

    assert.equal(response.success, false);
    if (!response.success) {
      assert.equal(response.error.code, "HTTP_502");
      assert.equal(response.error.message, "Bad Gateway");
      assert.equal(response.meta.requestId, "req-error-1");
      assert.deepEqual(response.error.details?.[0], {
        status: 502,
        body: "upstream failed",
      });
    }
  });

  test("wraps network failures into the standard error shape instead of throwing", async () => {
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    const response = await client.getCreditBalance({
      requestId: "req-network-1",
    });

    assert.equal(response.success, false);
    if (!response.success) {
      assert.equal(response.error.code, "NETWORK_ERROR");
      assert.equal(response.error.message, "Failed to fetch");
      assert.equal(response.meta.requestId, "req-network-1");
    }
  });

  test("treats html responses as invalid payloads instead of successful api data", async () => {
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async () => new Response("<!DOCTYPE html><html><body>index</body></html>", {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }),
    });

    const response = await client.startWechatLogin("http://127.0.0.1:3000/auth/callback");

    assert.equal(response.success, false);
    if (!response.success) {
      assert.equal(response.error.code, "INVALID_RESPONSE_PAYLOAD");
      assert.match(response.error.message, /html page/i);
    }
  });

  test("builds google auth start requests with the expected path", async () => {
    const requests: Array<{ method?: string; url: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {
            provider: "google",
            mode: "login",
            authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test",
            callbackUrl: "https://api.example.com/api/v1/auth/google/callback",
            state: "state-123",
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
          meta: {
            requestId: "req-google-client",
            timestamp: "2026-04-13T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    const response = await client.startGoogleLogin("http://127.0.0.1:3000/auth/callback");

    assert.equal(response.success, true);
    assert.equal(requests.length, 1);
    assert.equal(
      requests[0].url,
      "http://127.0.0.1:3001/api/v1/auth/google/start?redirectTo=http%3A%2F%2F127.0.0.1%3A3000%2Fauth%2Fcallback",
    );
    assert.equal(requests[0].method, "GET");
  });

  test("builds google bind start requests with the expected path", async () => {
    const requests: Array<{ method?: string; url: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
        });

        return new Response(JSON.stringify({
          success: false,
          error: {
            code: "GOOGLE_BIND_UNAVAILABLE",
            message: "Google bind is not persisted on the VPS runtime yet.",
          },
          meta: {
            requestId: "req-google-bind-client",
            timestamp: "2026-04-13T00:00:00.000Z",
          },
        }), {
          status: 501,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    const response = await client.startGoogleBind("http://127.0.0.1:3000/auth/callback?mode=google-bind");

    assert.equal(response.success, false);
    if (response.success) {
      return;
    }
    assert.equal(response.error.code, "GOOGLE_BIND_UNAVAILABLE");
    assert.equal(
      requests[0].url,
      "http://127.0.0.1:3001/api/v1/auth/google/bind/start?redirectTo=http%3A%2F%2F127.0.0.1%3A3000%2Fauth%2Fcallback%3Fmode%3Dgoogle-bind",
    );
  });

  test("builds billing transaction, refund, recharge config, and admin recharge requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {},
          meta: {
            requestId: "req-billing-client",
            timestamp: "2026-03-23T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.listCreditTransactions({
      transactionType: "consumption",
      status: "completed",
      limit: 20,
    });
    await client.refundCredits({
      transactionId: "8f702f95-2b10-4c4d-b839-5163ae09a50c",
      reason: "client refund",
    });
    await client.listCreditExchangeRates();
    await client.upsertCreditExchangeRate({
      currencyCode: "CNY",
      creditsPerUnit: 5.5,
      minAmount: 6,
      maxAmount: 300,
      isActive: true,
    });
    await client.adminRechargeCredits({
      identity: "admin-target@example.com",
      creditAmount: 25,
      description: "client admin recharge",
    });

    assert.equal(requests.length, 5);
    assert.equal(
      requests[0].url,
      "http://127.0.0.1:3001/api/v1/billing/credits/transactions?transactionType=consumption&status=completed&limit=20",
    );
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[1].url, "http://127.0.0.1:3001/api/v1/billing/credits/refunds");
    assert.equal(requests[1].method, "POST");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      transactionId: "8f702f95-2b10-4c4d-b839-5163ae09a50c",
      reason: "client refund",
    });
    assert.equal(requests[2].url, "http://127.0.0.1:3001/api/v1/billing/exchange-rates");
    assert.equal(requests[2].method, "GET");
    assert.equal(requests[3].url, "http://127.0.0.1:3001/api/v1/admin/billing/exchange-rates");
    assert.equal(requests[3].method, "PUT");
    assert.deepEqual(JSON.parse(requests[3].body || "{}"), {
      currencyCode: "CNY",
      creditsPerUnit: 5.5,
      minAmount: 6,
      maxAmount: 300,
      isActive: true,
    });
    assert.equal(requests[4].url, "http://127.0.0.1:3001/api/v1/admin/billing/recharges");
    assert.equal(requests[4].method, "POST");
    assert.deepEqual(JSON.parse(requests[4].body || "{}"), {
      identity: "admin-target@example.com",
      creditAmount: 25,
      description: "client admin recharge",
    });
  });

  test("builds split recharge submission client requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {},
          meta: {
            requestId: "req-recharge-submission-client",
            timestamp: "2026-04-15T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.createRechargeSubmission({
      amount: 8,
      currencyCode: "CNY",
      paymentChannel: "manual",
    });
    await client.submitRechargeProof("submission-123", {
      transferReferenceLast4: "4321",
      note: "client proof",
    });
    await client.getAdminRechargeSubmission("submission-123");
    await client.reviewRechargeSubmission("submission-123", {
      decision: "credit",
    });

    assert.equal(requests.length, 4);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/billing/recharge-submissions");
    assert.equal(requests[0].method, "POST");
    assert.deepEqual(JSON.parse(requests[0].body || "{}"), {
      amount: 8,
      currencyCode: "CNY",
      paymentChannel: "manual",
    });
    assert.equal(
      requests[1].url,
      "http://127.0.0.1:3001/api/v1/billing/recharge-submissions/submission-123/proof",
    );
    assert.equal(requests[1].method, "POST");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      transferReferenceLast4: "4321",
      note: "client proof",
    });
    assert.equal(
      requests[2].url,
      "http://127.0.0.1:3001/api/v1/admin/billing/recharge-submissions/submission-123",
    );
    assert.equal(requests[2].method, "GET");
    assert.equal(
      requests[3].url,
      "http://127.0.0.1:3001/api/v1/admin/billing/recharge-submissions/submission-123/review",
    );
    assert.equal(requests[3].method, "POST");
    assert.deepEqual(JSON.parse(requests[3].body || "{}"), {
      decision: "credit",
    });
  });

  test("builds recharge payment channel config requests with the expected path", async () => {
    const requests: Array<{ method?: string; url: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
        });

        return new Response(JSON.stringify({
          success: true,
          data: { items: [] },
          meta: {
            requestId: "req-recharge-payment-channels-client",
            timestamp: "2026-04-15T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.listRechargePaymentChannels();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/billing/payment-channels");
    assert.equal(requests[0].method, "GET");
  });

  test("builds admin console requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {},
          meta: {
            requestId: "req-admin-client",
            timestamp: "2026-03-23T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.getAdminAccess();
    await client.verifyAdminPassword({
      password: "123456",
    });
    await client.changeAdminPassword({
      oldPassword: "123456",
      newPassword: "new-password-123",
    });
    await client.setUserRole({
      identity: "user-1@example.com",
      role: "admin",
    });

    assert.equal(requests.length, 4);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/admin/access");
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[1].url, "http://127.0.0.1:3001/api/v1/admin/session/verify-password");
    assert.equal(requests[1].method, "POST");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      password: "123456",
    });
    assert.equal(requests[2].url, "http://127.0.0.1:3001/api/v1/admin/password");
    assert.equal(requests[2].method, "POST");
    assert.deepEqual(JSON.parse(requests[2].body || "{}"), {
      oldPassword: "123456",
      newPassword: "new-password-123",
    });
    assert.equal(requests[3].url, "http://127.0.0.1:3001/api/v1/admin/users/roles");
    assert.equal(requests[3].method, "POST");
    assert.deepEqual(JSON.parse(requests[3].body || "{}"), {
      identity: "user-1@example.com",
      role: "admin",
    });
  });

  test("builds password change verification requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {},
          meta: {
            requestId: "req-password-code-client",
            timestamp: "2026-04-14T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.sendPasswordChangeCode();
    await client.updatePassword({
      verificationCode: "123456",
      newPassword: "new-password-123",
    });

    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/profile/password/send-code");
    assert.equal(requests[0].method, "POST");
    assert.equal(requests[1].url, "http://127.0.0.1:3001/api/v1/profile/password");
    assert.equal(requests[1].method, "POST");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      verificationCode: "123456",
      newPassword: "new-password-123",
    });
  });

  test("builds admin credit provider pricing cache requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {
            providerId: "provider-1",
            pricing: [],
            cachedAt: "2026-03-31T00:00:00.000Z",
          },
          meta: {
            requestId: "req-provider-pricing-client",
            timestamp: "2026-03-31T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.getAdminCreditProviderPricingCache("provider-1");
    await client.upsertAdminCreditProviderPricingCache("provider-1", {
      pricing: [
        {
          modelId: "gpt-4.1",
          modelName: "GPT-4.1",
          inputPrice: 1.2,
          outputPrice: 3.4,
          isPerToken: true,
          currency: "USD",
        },
      ],
    });

    assert.equal(requests.length, 2);
    assert.equal(
      requests[0].url,
      "http://127.0.0.1:3001/api/v1/admin/credit-providers/provider-1/pricing-cache",
    );
    assert.equal(requests[0].method, "GET");
    assert.equal(
      requests[1].url,
      "http://127.0.0.1:3001/api/v1/admin/credit-providers/provider-1/pricing-cache",
    );
    assert.equal(requests[1].method, "PUT");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      pricing: [
        {
          modelId: "gpt-4.1",
          modelName: "GPT-4.1",
          inputPrice: 1.2,
          outputPrice: 3.4,
          isPerToken: true,
          currency: "USD",
        },
      ],
    });
  });

  test("builds user route diagnostics requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {},
          meta: {
            requestId: "req-user-route-diagnostics",
            timestamp: "2026-03-31T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.checkUserRouteConnectivity("provider-1");
    await client.syncUserRoutePricing("provider-1");

    assert.equal(requests.length, 2);
    assert.equal(
      requests[0].url,
      "http://127.0.0.1:3001/api/v1/profile/user-routes/provider-1/connectivity",
    );
    assert.equal(requests[0].method, "POST");
    assert.equal(
      requests[1].url,
      "http://127.0.0.1:3001/api/v1/profile/user-routes/provider-1/pricing-sync",
    );
    assert.equal(requests[1].method, "POST");
  });

  test("builds shared provider pricing cache requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {
            providerId: "shared:abc123",
            pricing: [],
            cachedAt: "2026-03-31T00:00:00.000Z",
          },
          meta: {
            requestId: "req-shared-provider-pricing-client",
            timestamp: "2026-03-31T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.getSharedProviderPricingCache("https://api.example.com/v1");
    await client.upsertSharedProviderPricingCache("https://api.example.com/v1", {
      pricing: [
        {
          modelId: "gpt-4.1",
          modelName: "GPT-4.1",
          inputPrice: 1.2,
          outputPrice: 3.4,
          isPerToken: true,
          currency: "USD",
        },
      ],
    });

    assert.equal(requests.length, 2);
    assert.equal(
      requests[0].url,
      "http://127.0.0.1:3001/api/v1/provider-pricing-cache?baseUrl=https%3A%2F%2Fapi.example.com%2Fv1",
    );
    assert.equal(requests[0].method, "GET");
    assert.equal(
      requests[1].url,
      "http://127.0.0.1:3001/api/v1/provider-pricing-cache?baseUrl=https%3A%2F%2Fapi.example.com%2Fv1",
    );
    assert.equal(requests[1].method, "PUT");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      pricing: [
        {
          modelId: "gpt-4.1",
          modelName: "GPT-4.1",
          inputPrice: 1.2,
          outputPrice: 3.4,
          isPerToken: true,
          currency: "USD",
        },
      ],
    });
  });

  test("passes an optional pricing endpoint override when syncing provider pricing", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {
            routeId: "provider-2",
            ok: false,
            count: 0,
            pricingData: [],
            groupRatio: {},
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.syncUserRoutePricing("provider-2", {
      endpointUrl: "https://pricing.example.com/custom",
    });

    assert.equal(requests.length, 1);
    assert.equal(
      requests[0].url,
      "http://127.0.0.1:3001/api/v1/profile/user-routes/provider-2/pricing-sync",
    );
    assert.equal(requests[0].method, "POST");
    assert.equal(
      requests[0].body,
      JSON.stringify({ endpointUrl: "https://pricing.example.com/custom" }),
    );
  });

  test("builds profile user-api and guest temp-user requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {},
          meta: {
            requestId: "req-auth-data-client",
            timestamp: "2026-03-23T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.getUserApiEntries();
    await client.replaceUserApiEntries({
      entries: [],
    });
    await client.replaceUserApisPayload({
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });
    await client.createTempUser();

    assert.equal(requests.length, 4);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/profile/user-apis");
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[1].url, "http://127.0.0.1:3001/api/v1/profile/user-apis");
    assert.equal(requests[1].method, "PUT");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      entries: [],
    });
    assert.equal(requests[2].url, "http://127.0.0.1:3001/api/v1/profile/user-apis/payload");
    assert.equal(requests[2].method, "PUT");
    assert.deepEqual(JSON.parse(requests[2].body || "{}"), {
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });
    assert.equal(requests[3].url, "http://127.0.0.1:3001/api/v1/auth/temp-users");
    assert.equal(requests[3].method, "POST");
  });

  test("builds key-manager cloud-state requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {
            version: 2,
            slots: [],
            providers: [],
            entries: [],
          },
          meta: {
            requestId: "req-key-manager-client",
            timestamp: "2026-03-23T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.getKeyManagerCloudState();
    await client.replaceKeyManagerCloudState({
      version: 2,
      slots: [],
      providers: [],
    });

    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/profile/key-manager-state");
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[1].url, "http://127.0.0.1:3001/api/v1/profile/key-manager-state");
    assert.equal(requests[1].method, "PUT");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      version: 2,
      slots: [],
      providers: [],
    });
  });

  test("legacy web api client forwards the cached temp user header", async () => {
    const originalFetch = globalThis.fetch;
    const globalLike = globalThis as typeof globalThis & {
      window?: {
        localStorage?: {
          getItem: (key: string) => string | null;
          setItem: (key: string, value: string) => void;
          removeItem: (key: string) => void;
        };
      };
    };
    const originalWindow = globalLike.window;
    const storage = new Map<string, string>([
      ["temp_user_session_v1", JSON.stringify({
        user: { id: "temp-user-123" },
        expiresAt: Date.now() + 60_000,
      })],
    ]);
    const requests: Array<{ url: string; headers: Headers }> = [];

    globalLike.window = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    };
    globalThis.fetch = async (input, init) => {
      requests.push({
        url: String(input),
        headers: new Headers(init?.headers),
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          version: 2,
          slots: [],
          providers: [],
          entries: [],
        },
        meta: {
          requestId: "req-temp-user-header",
          timestamp: "2026-04-02T00:00:00.000Z",
        },
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    };

    try {
      const client = createLegacyWebApiClient();
      await client.getKeyManagerCloudState();
    } finally {
      globalThis.fetch = originalFetch;
      globalLike.window = originalWindow;
    }

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/profile/key-manager-state");
    assert.equal(requests[0].headers.get(TEMP_USER_ID_HEADER), "temp-user-123");
  });

  test("builds workspace layout sync requests with the expected paths", async () => {
    const requests: Array<{ method?: string; url: string; body?: string }> = [];
    const client = createKkApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {
            canvases: [],
            deletedCount: 0,
            preservedLayout: true,
          },
          meta: {
            requestId: "req-layout-client",
            timestamp: "2026-03-23T00:00:00.000Z",
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    await client.getWorkspaceLayout();
    await client.saveWorkspaceLayout({
      canvases: [],
    });
    await client.cleanupCloudImages();

    assert.equal(requests.length, 3);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/workspaces/layout");
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[1].url, "http://127.0.0.1:3001/api/v1/workspaces/layout");
    assert.equal(requests[1].method, "PUT");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      canvases: [],
    });
    assert.equal(requests[2].url, "http://127.0.0.1:3001/api/v1/workspaces/layout/cloud-images");
    assert.equal(requests[2].method, "DELETE");
  });
});
