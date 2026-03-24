import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createKkApiClient } from "../../packages/contracts/src/client/kk-api-client.ts";

describe("kk api client", () => {
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

  test("builds billing transaction, refund, and admin recharge requests with the expected paths", async () => {
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
    await client.adminRechargeCredits({
      identity: "admin-target@example.com",
      creditAmount: 25,
      description: "client admin recharge",
    });

    assert.equal(requests.length, 3);
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
    assert.equal(requests[2].url, "http://127.0.0.1:3001/api/v1/admin/billing/recharges");
    assert.equal(requests[2].method, "POST");
    assert.deepEqual(JSON.parse(requests[2].body || "{}"), {
      identity: "admin-target@example.com",
      creditAmount: 25,
      description: "client admin recharge",
    });
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
    await client.createTempUser();

    assert.equal(requests.length, 3);
    assert.equal(requests[0].url, "http://127.0.0.1:3001/api/v1/profile/user-apis");
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[1].url, "http://127.0.0.1:3001/api/v1/profile/user-apis");
    assert.equal(requests[1].method, "PUT");
    assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
      entries: [],
    });
    assert.equal(requests[2].url, "http://127.0.0.1:3001/api/v1/auth/temp-users");
    assert.equal(requests[2].method, "POST");
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
