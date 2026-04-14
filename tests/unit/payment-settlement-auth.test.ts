import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { handleApplyPaymentSettlement } from "../../apps/api/src/modules/billing/presentation/http-payment-settlement-routes.ts";

const validRequest = {
  paymentOrderId: randomUUID(),
  merchantOrderNo: "ORDER_SETTLE_1",
  userId: randomUUID(),
  providerCode: "alipay",
  callbackId: "callback-1",
  creditAmount: 25,
  amount: {
    amount: "5.00",
    currency: "CNY",
  },
};

test("payment settlement accepts sidecar-scoped internal auth", async () => {
  process.env.PAYMENT_SIDECAR_SETTLEMENT_TOKEN = "sidecar-settlement-token";
  delete process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN;
  delete process.env.PAYMENT_WEBHOOK_SETTLEMENT_TOKEN;

  const result = await handleApplyPaymentSettlement(
    {
      async applyPaymentSettlement(body) {
        return {
          success: true as const,
          data: {
            ledgerId: "ledger-1",
            balanceAfter: 100,
            paymentOrderId: body.paymentOrderId,
            merchantOrderNo: body.merchantOrderNo,
          },
          meta: {
            requestId: "req-1",
            timestamp: new Date().toISOString(),
          },
        };
      },
    } as any,
    validRequest,
    {
      "x-request-id": "req-sidecar-settlement",
      "x-internal-service": "payment-sidecar",
      "x-internal-token": "sidecar-settlement-token",
    },
  );

  assert.equal(result.statusCode, 200);
});

test("payment settlement rejects mismatched internal caller and token pairs", async () => {
  process.env.PAYMENT_SIDECAR_SETTLEMENT_TOKEN = "sidecar-settlement-token";
  process.env.PAYMENT_WEBHOOK_SETTLEMENT_TOKEN = "webhook-settlement-token";
  delete process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN;

  const result = await handleApplyPaymentSettlement(
    {
      async applyPaymentSettlement() {
        throw new Error("should not be called");
      },
    } as any,
    validRequest,
    {
      "x-request-id": "req-invalid-settlement",
      "x-internal-service": "payment-sidecar",
      "x-internal-token": "webhook-settlement-token",
    },
  );

  assert.equal(result.statusCode, 401);
  if (result.body.success) {
    assert.fail("expected settlement auth request to fail");
  } else {
    const failureBody = result.body as { error: { code: string } };
    assert.equal(failureBody.error.code, "INTERNAL_AUTH_REQUIRED");
  }
});
