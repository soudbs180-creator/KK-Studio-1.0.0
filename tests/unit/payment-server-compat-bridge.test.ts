import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createKkSessionToken } from "../../apps/api/src/modules/auth/infrastructure/kk-session-token.ts";

const require = createRequire(import.meta.url);
const {
  handleLegacyCreateQrCodeThroughSidecar,
  handleLegacyPaymentCallbackThroughSidecar,
  handleLegacyGetStatusThroughSidecar,
} = require("../../payment-server/sidecar_compat_bridge.js");

const trackedEnvKeys = [
  "KK_API_BASE_URL",
  "PAYMENT_WEBHOOK_SETTLEMENT_TOKEN",
  "PAYMENT_SIDECAR_SETTLEMENT_TOKEN",
  "PAYMENT_SIDECAR_INTERNAL_TOKEN",
  "KK_API_SESSION_SIGNING_SECRET",
];

const originalEnv = new Map(trackedEnvKeys.map((key) => [key, process.env[key]]));

function restoreTrackedEnv() {
  for (const key of trackedEnvKeys) {
    const originalValue = originalEnv.get(key);
    if (typeof originalValue === "string") {
      process.env[key] = originalValue;
    } else {
      delete process.env[key];
    }
  }
}

describe("payment server compatibility bridge", () => {
  beforeEach(() => {
    restoreTrackedEnv();
  });

  afterEach(() => {
    restoreTrackedEnv();
  });

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

  test("legacy qrcode bridge accepts a KK session bearer token without legacy cloud auth env", async () => {
    process.env.KK_API_SESSION_SIGNING_SECRET = "compat-bridge-test-secret";

    const accessToken = createKkSessionToken({
      tokenType: "access",
      userId: "compat-user-kk",
      email: "compat-user-kk@example.com",
      role: "user",
      expiresInSeconds: 3600,
    });

    const result = await handleLegacyCreateQrCodeThroughSidecar(
      new URLSearchParams({
        method: "alipay",
        userId: "compat-user-kk",
        amount: "10",
      }),
      {
        authorization: `Bearer ${accessToken}`,
        "x-authenticated-user-id": "spoofed-user",
      },
      "https://example.com",
      {
        paymentUrlFactory: ({ merchantOrderNo }) => `https://pay.example.com/${merchantOrderNo}`,
      },
    );

    assert.equal(result.statusCode, 200);
    assert.equal(typeof result.body?.qrCode, "string");
    assert.match(String(result.body?.qrCode || ""), /^https:\/\/pay\.example\.com\//);
    assert.equal(typeof result.body?.outTradeNo, "string");
  });

  test("legacy callback bridge honors explicit settlement writer options", async () => {
    delete process.env.KK_API_BASE_URL;
    delete process.env.PAYMENT_WEBHOOK_SETTLEMENT_TOKEN;
    delete process.env.PAYMENT_SIDECAR_SETTLEMENT_TOKEN;
    delete process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN;
    process.env.KK_API_SESSION_SIGNING_SECRET = "compat-bridge-test-secret";

    const accessToken = createKkSessionToken({
      tokenType: "access",
      userId: "compat-user-callback",
      email: "compat-user-callback@example.com",
      role: "user",
      expiresInSeconds: 3600,
    });

    const created = await handleLegacyCreateQrCodeThroughSidecar(
      new URLSearchParams({
        method: "alipay",
        userId: "compat-user-callback",
        amount: "10",
      }),
      {
        authorization: `Bearer ${accessToken}`,
      },
      "https://example.com",
      {
        paymentUrlFactory: ({ merchantOrderNo }) => `https://pay.example.com/${merchantOrderNo}`,
      },
    );

    assert.equal(created.statusCode, 200);
    const merchantOrderNo = String(created.body?.outTradeNo || "");
    assert.ok(merchantOrderNo);

    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const request = { url: String(input), init };
      requests.push(request);
      assert.equal(request.url, "https://api.kk.local/internal/v1/payment-settlements");

      const settlementBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          success: true,
          data: {
            ledgerId: "ledger-compat-1",
            balanceAfter: 150,
            paymentOrderId: settlementBody.paymentOrderId,
            merchantOrderNo: settlementBody.merchantOrderNo,
          },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await handleLegacyPaymentCallbackThroughSidecar({
        userId: "compat-user-callback",
        callbackId: "trade-compat-callback-1",
        transactionId: "trade-compat-callback-1",
        merchantOrderNo,
        amount: 10,
        currency: "CNY",
        providerCode: "alipay",
        tradeStatus: "TRADE_SUCCESS",
        payload: { source: "compat-test" },
      }, {
        baseUrl: "https://api.kk.local",
        internalToken: "payment-internal-token",
        settlementToken: "payment-settlement-token",
      });

      assert.equal(result.success, true);
      assert.equal(result.source, "sidecar");
      assert.equal(requests.length, 1);

      const headers = requests[0].init?.headers as Record<string, string>;
      assert.equal(headers["x-internal-token"], "payment-settlement-token");
      assert.equal(headers["x-payment-settlement-token"], "payment-settlement-token");
      assert.equal(headers["x-internal-service"], "payment-webhook");
      assert.equal(headers["x-internal-caller"], "payment-webhook");

      const settlementBody = JSON.parse(String(requests[0].init?.body));
      assert.equal(settlementBody.merchantOrderNo, merchantOrderNo);
      assert.equal(settlementBody.userId, "compat-user-callback");
      assert.equal(settlementBody.creditAmount, 50);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
