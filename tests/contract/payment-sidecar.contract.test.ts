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

describe("payment sidecar contract", () => {
  const previousInternalToken = process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN;
  process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN = "contract-sidecar-token";
  const resolveAccessToken = (accessToken: string) => (
    accessToken === "contract-payment-user-token"
      ? { userId: "contract-payment-user-1", role: "user" as const }
      : undefined
  );

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
        internalToken: "contract-sidecar-token",
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

  test("creates a payment order, accepts an alipay callback, and credits the main API balance", async () => {
    const createResponse = await fetch(`${sidecarBaseUrl}/payment/v1/orders`, {
      method: "POST",
      headers: {
        authorization: "Bearer contract-payment-user-token",
        "content-type": "application/json",
        "x-request-id": "req-contract-payment-create",
      },
      body: JSON.stringify({
        providerCode: "alipay",
        amount: "5.00",
        currency: "CNY",
        creditAmount: 25,
        returnUrl: "https://kkai.plus/pay/success",
        notifyUrl: `${sidecarBaseUrl}/api/pay/notify/alipay`,
        idempotencyKey: "idem-contract-payment-1",
      }),
    });

    assert.equal(createResponse.status, 201);
    const createPayload = await createResponse.json();
    assert.equal(createPayload.success, true);
    assert.equal(createPayload.data.creditAmount, 25);
    assert.ok(String(createPayload.data.paymentUrl).includes("/payment/v1/orders/"));

    const typedStatusBefore = await fetch(
      `${sidecarBaseUrl}/payment/v1/orders/${encodeURIComponent(createPayload.data.merchantOrderNo)}/status`,
        {
          headers: {
            authorization: "Bearer contract-payment-user-token",
            "x-request-id": "req-contract-payment-status-typed-before",
          },
        },
    );

    assert.equal(typedStatusBefore.status, 200);
    const typedStatusBeforePayload = await typedStatusBefore.json();
    assert.equal(typedStatusBeforePayload.success, true);
    assert.equal(typedStatusBeforePayload.data.paymentOrderStatus, "created");
    assert.equal(typedStatusBeforePayload.data.settlementApplied, false);

    const initialStatus = await fetch(
      `${sidecarBaseUrl}/api/pay/status?outTradeNo=${encodeURIComponent(createPayload.data.merchantOrderNo)}`,
      {
        headers: {
          authorization: "Bearer contract-payment-user-token",
          "x-request-id": "req-contract-payment-status-before",
        },
      },
    );

    assert.equal(initialStatus.status, 200);
    const initialStatusPayload = await initialStatus.json();
    assert.equal(initialStatusPayload.tradeStatus, "WAITING");

    const callbackResponse = await fetch(`${sidecarBaseUrl}/internal/v1/payment-callbacks/alipay`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": "contract-sidecar-token",
        "x-request-id": "req-contract-payment-callback-1",
      },
      body: JSON.stringify({
        callbackId: "callback-contract-1",
        merchantOrderNo: createPayload.data.merchantOrderNo,
        tradeStatus: "TRADE_SUCCESS",
        payload: {
          providerTradeNo: "trade-contract-1",
        },
      }),
    });

    assert.equal(callbackResponse.status, 200);
    const callbackPayload = await callbackResponse.json();
    assert.equal(callbackPayload.success, true);
    assert.equal(callbackPayload.data.paymentOrderStatus, "paid");

    const duplicateCallbackResponse = await fetch(`${sidecarBaseUrl}/internal/v1/payment-callbacks/alipay`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": "contract-sidecar-token",
        "x-request-id": "req-contract-payment-callback-2",
      },
      body: JSON.stringify({
        callbackId: "callback-contract-1",
        merchantOrderNo: createPayload.data.merchantOrderNo,
        tradeStatus: "TRADE_SUCCESS",
        payload: {
          providerTradeNo: "trade-contract-1",
        },
      }),
    });

    assert.equal(duplicateCallbackResponse.status, 200);

    const balanceResponse = await fetch(`${apiBaseUrl}/api/v1/billing/credits/balance`, {
      headers: {
        authorization: "Bearer contract-payment-user-token",
        "x-request-id": "req-contract-payment-balance",
      },
    });

    assert.equal(balanceResponse.status, 200);
    const balancePayload = await balanceResponse.json();
    assert.equal(balancePayload.success, true);
    assert.equal(balancePayload.data.balance, 125);

    const finalStatus = await fetch(
      `${sidecarBaseUrl}/api/pay/status?outTradeNo=${encodeURIComponent(createPayload.data.merchantOrderNo)}`,
      {
        headers: {
          authorization: "Bearer contract-payment-user-token",
          "x-request-id": "req-contract-payment-status-after",
        },
      },
    );

    assert.equal(finalStatus.status, 200);
    const finalStatusPayload = await finalStatus.json();
    assert.equal(finalStatusPayload.tradeStatus, "TRADE_SUCCESS");
    assert.equal(finalStatusPayload.details.settlementApplied, true);

    const typedStatusAfter = await fetch(
      `${sidecarBaseUrl}/payment/v1/orders/${encodeURIComponent(createPayload.data.merchantOrderNo)}/status`,
        {
          headers: {
            authorization: "Bearer contract-payment-user-token",
            "x-request-id": "req-contract-payment-status-typed-after",
          },
        },
    );

    assert.equal(typedStatusAfter.status, 200);
    const typedStatusAfterPayload = await typedStatusAfter.json();
    assert.equal(typedStatusAfterPayload.success, true);
    assert.equal(typedStatusAfterPayload.data.paymentOrderStatus, "paid");
    assert.equal(typedStatusAfterPayload.data.settlementApplied, true);
  });

  test("rejects the deprecated public callback route with a migration hint", async () => {
    const response = await fetch(`${sidecarBaseUrl}/payment/v1/callbacks/alipay`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-contract-payment-callback-deprecated",
      },
      body: JSON.stringify({
        callbackId: "callback-deprecated",
        merchantOrderNo: "ORDER_DOES_NOT_MATTER",
        tradeStatus: "TRADE_SUCCESS",
        payload: {},
      }),
    });

    assert.equal(response.status, 410);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "PUBLIC_CALLBACK_ROUTE_DISABLED");
  });
});
