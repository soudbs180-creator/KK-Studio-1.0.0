import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { handleApplyPaymentSettlement } from "../../apps/api/src/modules/billing/presentation/http-payment-settlement-routes.ts";
import { HttpMainApiSettlementWriter } from "../../apps/payment-sidecar/src/modules/payment/infrastructure/http-main-api-settlement-writer.ts";
import type { ApplyPaymentSettlementRequestDto } from "../../packages/contracts/src/index.ts";

const trackedEnvKeys = [
  "VERCEL",
  "PAYMENT_SIDECAR_INTERNAL_TOKEN",
  "PAYMENT_SIDECAR_SETTLEMENT_TOKEN",
  "PAYMENT_WEBHOOK_SETTLEMENT_TOKEN",
];

const originalEnv = new Map(trackedEnvKeys.map((key) => [key, process.env[key]]));

function restoreTrackedEnv() {
  for (const key of trackedEnvKeys) {
    const value = originalEnv.get(key);
    if (typeof value === "string") {
      process.env[key] = value;
      continue;
    }

    delete process.env[key];
  }
}

afterEach(() => {
  restoreTrackedEnv();
});

function buildSettlementBody(): ApplyPaymentSettlementRequestDto {
  return {
    paymentOrderId: "payment-order-1",
    merchantOrderNo: "ORDER_TEST_1",
    userId: "user-1",
    providerCode: "alipay",
    amount: {
      amount: "5.00",
      currency: "CNY",
    },
    creditAmount: 25,
    callbackId: "callback-1",
  };
}

test("hosted settlement route prefers caller-specific tokens over the legacy shared token", async () => {
  process.env.VERCEL = "1";
  process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN = "legacy-shared-token";
  process.env.PAYMENT_SIDECAR_SETTLEMENT_TOKEN = "scoped-settlement-token";

  const service = {
    applyPaymentSettlement: async () => ({
      success: true,
      data: {
        ledgerId: "ledger-1",
        balanceAfter: 125,
        paymentOrderId: "payment-order-1",
        merchantOrderNo: "ORDER_TEST_1",
      },
      meta: {
        requestId: "req-1",
        timestamp: "2026-04-07T00:00:00.000Z",
      },
    }),
  };

  const legacyResult = await handleApplyPaymentSettlement(
    service as any,
    buildSettlementBody(),
    {
      "x-request-id": "req-settlement-legacy",
      "x-internal-token": "legacy-shared-token",
    },
  );
  assert.equal(legacyResult.statusCode, 401);

  const scopedResult = await handleApplyPaymentSettlement(
    service as any,
    buildSettlementBody(),
    {
      "x-request-id": "req-settlement-scoped",
      "x-internal-caller": "payment-sidecar",
      "x-payment-settlement-token": "scoped-settlement-token",
    },
  );
  assert.equal(scopedResult.statusCode, 200);
});

test("settlement writer sends caller-scoped auth headers", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const writer = new HttpMainApiSettlementWriter({
    baseUrl: "https://api.kk.local",
    internalToken: "legacy-shared-token",
    settlementToken: "scoped-settlement-token",
    caller: "payment-sidecar",
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({
        success: true,
        data: {
          ledgerId: "ledger-1",
          balanceAfter: 125,
          paymentOrderId: "payment-order-1",
          merchantOrderNo: "ORDER_TEST_1",
        },
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    },
  });

  await writer.write(buildSettlementBody(), {
    requestId: "req-writer-scoped",
    clientVersion: "payment-sidecar",
  });

  assert.equal(requests.length, 1);
  const headers = requests[0].init?.headers as Record<string, string>;
  assert.equal(headers["x-internal-caller"], "payment-sidecar");
  assert.equal(headers["x-payment-settlement-token"], "scoped-settlement-token");
});

test("hosted settlement route accepts webhook-scoped settlement auth", async () => {
  process.env.VERCEL = "1";
  process.env.PAYMENT_WEBHOOK_SETTLEMENT_TOKEN = "webhook-scoped-token";
  delete process.env.PAYMENT_SIDECAR_SETTLEMENT_TOKEN;
  delete process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN;

  const service = {
    applyPaymentSettlement: async () => ({
      success: true,
      data: {
        ledgerId: "ledger-2",
        balanceAfter: 150,
        paymentOrderId: "payment-order-1",
        merchantOrderNo: "ORDER_TEST_1",
      },
      meta: {
        requestId: "req-2",
        timestamp: "2026-04-07T00:00:00.000Z",
      },
    }),
  };

  const result = await handleApplyPaymentSettlement(
    service as any,
    buildSettlementBody(),
    {
      "x-request-id": "req-settlement-webhook",
      "x-internal-caller": "payment-webhook",
      "x-payment-settlement-token": "webhook-scoped-token",
    },
  );

  assert.equal(result.statusCode, 200);
});
