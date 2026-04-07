import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

const require = createRequire(import.meta.url);
const {
  handleLegacyCreateQrCodeThroughSidecar,
  handleLegacyPaymentCallbackThroughSidecar,
  handleLegacyGetStatusThroughSidecar,
} = require("../../payment-server/sidecar_compat_bridge.js");

describe("payment server compatibility bridge", () => {
  test("legacy qrcode bridge fails closed without authenticated user context", async () => {
    const result = await handleLegacyCreateQrCodeThroughSidecar(
      new URLSearchParams({
        method: "alipay",
        userId: "spoof-user",
        amount: "10",
      }),
      {},
      "https://example.com",
    );

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.success, false);
    assert.equal(result.body.error.code, "AUTH_REQUIRED");
  });

  test("legacy status bridge ignores spoofed authenticated-user headers", async () => {
    const result = await handleLegacyGetStatusThroughSidecar(
      new URLSearchParams({
        outTradeNo: "ORDER_TEST",
        userId: "spoof-user",
      }),
      {
        "x-authenticated-user-id": "spoof-user",
      },
    );

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.success, false);
    assert.equal(result.body.error.code, "AUTH_REQUIRED");
  });

  test("legacy callback bridge fails closed when the canonical sidecar order is missing", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("legacy callback bridge should not hit runtime fallback or settlement network calls");
    }) as typeof fetch;

    try {
      const result = await handleLegacyPaymentCallbackThroughSidecar({
        userId: "compat-user-1",
        callbackId: "compat-callback-missing",
        transactionId: "compat-callback-missing",
        merchantOrderNo: "ORDER_COMPAT_MISSING",
        amount: 6,
        currency: "CNY",
        providerCode: "alipay",
        tradeStatus: "TRADE_SUCCESS",
        payload: { source: "compat-test" },
      }, {
        baseUrl: "https://api.kk.local",
        internalToken: "payment-internal-token",
      });

      assert.equal(result.success, false);
      assert.equal(result.source, "sidecar");
      assert.equal(result.error?.code, "PAYMENT_ORDER_NOT_FOUND");
      assert.match(String(result.error?.message || ""), /runtime fallback is disabled/i);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
