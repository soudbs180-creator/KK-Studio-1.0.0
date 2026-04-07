import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { createApiServer } from "../../apps/api/src/server.ts";
import { InMemoryCreditAccountRepository } from "../../apps/api/src/modules/billing/infrastructure/in-memory-credit-account-repository.ts";
import { createPaymentSidecarServer } from "../../apps/payment-sidecar/src/server.ts";
import { InMemoryPaymentOrderRepository } from "../../apps/payment-sidecar/src/modules/payment/infrastructure/in-memory-payment-order-repository.ts";

function getBaseUrl(server: { address(): string | import("node:net").AddressInfo | null }) {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not expose a TCP port.");
  }

  return `http://127.0.0.1:${address.port}`;
}

describe("release smoke e2e", () => {
  const previousInternalToken = process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN;
  process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN = "smoke-sidecar-token";

  const runtimeAccessTokens = new Map<string, { userId: string; email?: string; role: "user" | "admin" }>();
  const resolveAccessToken = (accessToken: string) => runtimeAccessTokens.get(accessToken);

  const apiServer = createApiServer(0, {
    creditAccountRepository: new InMemoryCreditAccountRepository(),
    resolveAccessToken,
    verifyTurnstileToken: async () => ({ success: true }),
  });

  let apiBaseUrl = "";
  let sidecarServer: ReturnType<typeof createPaymentSidecarServer> | undefined;
  let sidecarBaseUrl = "";

  before(async () => {
    if (!apiServer.listening) {
      await new Promise<void>((resolve) => {
        apiServer.once("listening", resolve);
      });
    }

    apiBaseUrl = getBaseUrl(apiServer);
    sidecarServer = createPaymentSidecarServer(0, {
      paymentOrderRepository: new InMemoryPaymentOrderRepository(),
      resolveAccessToken,
      settlementWriterOptions: {
        baseUrl: apiBaseUrl,
        internalToken: "smoke-sidecar-token",
      },
    });

    if (!sidecarServer.listening) {
      await new Promise<void>((resolve) => {
        sidecarServer?.once("listening", resolve);
      });
    }

    sidecarBaseUrl = getBaseUrl(sidecarServer);
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      sidecarServer?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      apiServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    if (typeof previousInternalToken === "string") {
      process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN = previousInternalToken;
    } else {
      delete process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN;
    }
  });

  test("smoke path covers auth, workflow, generation, assets, layout, and payment settlement", async () => {
    const accessToken = "smoke-user-token";
    const smokeUser = {
      userId: "smoke-user-1",
      email: "smoke@example.com",
      role: "user" as const,
    };
    runtimeAccessTokens.set(accessToken, {
      userId: smokeUser.userId,
      email: smokeUser.email,
      role: smokeUser.role,
    });

    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    };

    const saveWorkflowResponse = await fetch(
      `${apiBaseUrl}/api/v1/workspaces/workspace-smoke-1/workflows/workflow-smoke-1`,
      {
        method: "PUT",
        headers: {
          ...authHeaders,
          "x-request-id": "req-smoke-workflow-save",
        },
        body: JSON.stringify({
          name: "Smoke Workflow",
          version: 1,
          status: "draft",
          nodes: [
            {
              id: "node-smoke-prompt",
              nodeType: "prompt",
              position: { x: 120, y: 80 },
              config: {
                prompt: "release smoke prompt",
              },
            },
          ],
          edges: [],
        }),
      },
    );

    assert.equal(saveWorkflowResponse.status, 200);
    const saveWorkflowPayload = await saveWorkflowResponse.json();
    assert.equal(saveWorkflowPayload.success, true);
    assert.equal(saveWorkflowPayload.data.workspaceId, "workspace-smoke-1");

    const summaryResponse = await fetch(
      `${apiBaseUrl}/api/v1/workspaces/workspace-smoke-1/canvas`,
      {
        headers: {
          authorization: authHeaders.authorization,
          "x-request-id": "req-smoke-workspace-summary",
        },
      },
    );

    assert.equal(summaryResponse.status, 200);
    const summaryPayload = await summaryResponse.json();
    assert.equal(summaryPayload.success, true);
    assert.equal(summaryPayload.data.workspaceId, "workspace-smoke-1");
    assert.equal(summaryPayload.data.nodeCount, 1);

    const generationResponse = await fetch(`${apiBaseUrl}/api/v1/generation-tasks`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "x-request-id": "req-smoke-generation-create",
      },
      body: JSON.stringify({
        workspaceId: "workspace-smoke-1",
        workflowId: "workflow-smoke-1",
        modelCode: "gemini-2.5-flash-image",
        taskType: "image",
        prompt: "generate a smoke-test illustration",
        idempotencyKey: "idem-smoke-generation-1",
      }),
    });

    assert.equal(generationResponse.status, 202);
    const generationPayload = await generationResponse.json();
    assert.equal(generationPayload.success, true);
    assert.equal(generationPayload.data.status, "queued");

    const assetResponse = await fetch(`${apiBaseUrl}/api/v1/assets?kind=image&limit=1`, {
      headers: {
        authorization: authHeaders.authorization,
        "x-request-id": "req-smoke-assets",
      },
    });

    assert.equal(assetResponse.status, 200);
    const assetPayload = await assetResponse.json();
    assert.equal(assetPayload.success, true);
    assert.ok(Array.isArray(assetPayload.data.items));
    assert.ok(assetPayload.data.items.length >= 1);

    const saveLayoutResponse = await fetch(`${apiBaseUrl}/api/v1/workspaces/layout`, {
      method: "PUT",
      headers: {
        ...authHeaders,
        "x-request-id": "req-smoke-layout-save",
      },
      body: JSON.stringify({
        canvases: [
          {
            id: "canvas-smoke-1",
            name: "Smoke Canvas",
            workflowId: "workflow-smoke-1",
          },
        ],
      }),
    });

    assert.equal(saveLayoutResponse.status, 200);
    const saveLayoutPayload = await saveLayoutResponse.json();
    assert.equal(saveLayoutPayload.success, true);
    assert.equal(saveLayoutPayload.data.canvases.length, 1);

    const paymentCreateResponse = await fetch(`${sidecarBaseUrl}/payment/v1/orders`, {
      method: "POST",
      headers: {
        authorization: authHeaders.authorization,
        "content-type": "application/json",
        "x-request-id": "req-smoke-payment-create",
      },
      body: JSON.stringify({
        providerCode: "alipay",
        amount: "6.00",
        currency: "CNY",
        returnUrl: "https://kkai.plus/pay/success",
        notifyUrl: `${sidecarBaseUrl}/api/pay/notify/alipay`,
        idempotencyKey: "idem-smoke-payment-1",
      }),
    });

    assert.equal(paymentCreateResponse.status, 201);
    const paymentCreatePayload = await paymentCreateResponse.json();
    assert.equal(paymentCreatePayload.success, true);
    assert.equal(paymentCreatePayload.data.creditAmount, 30);

    const callbackResponse = await fetch(`${sidecarBaseUrl}/internal/v1/payment-callbacks/alipay`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": "smoke-sidecar-token",
        "x-request-id": "req-smoke-payment-callback",
      },
      body: JSON.stringify({
        callbackId: "callback-smoke-1",
        merchantOrderNo: paymentCreatePayload.data.merchantOrderNo,
        tradeStatus: "TRADE_SUCCESS",
        payload: {
          providerTradeNo: "trade-smoke-1",
        },
      }),
    });

    assert.equal(callbackResponse.status, 200);
    const callbackPayload = await callbackResponse.json();
    assert.equal(callbackPayload.success, true);
    assert.equal(callbackPayload.data.paymentOrderStatus, "paid");

    const balanceResponse = await fetch(`${apiBaseUrl}/api/v1/billing/credits/balance`, {
      headers: {
        authorization: authHeaders.authorization,
        "x-request-id": "req-smoke-balance",
      },
    });

    assert.equal(balanceResponse.status, 200);
    const balancePayload = await balanceResponse.json();
    assert.equal(balancePayload.success, true);
    assert.equal(balancePayload.data.balance, 130);
  });
});
