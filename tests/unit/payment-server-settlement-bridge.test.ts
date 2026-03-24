import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

const require = createRequire(import.meta.url);
const {
  DEFAULT_CREDIT_EXCHANGE_RATES,
  buildLegacyPaymentSettlementRequest,
  writeLegacyPaymentSettlement,
} = require("../../payment-server/settlement_bridge.js");

describe("payment-server settlement bridge", () => {
  test("builds a canonical settlement request from legacy callback fields", () => {
    const payload = buildLegacyPaymentSettlementRequest(
      {
        userId: "user-payment-1",
        transactionId: "trade-alipay-1",
        amount: 8,
        currency: "CNY",
        payType: "alipay",
        billNo: "ORDER_1001",
      },
      {
        CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY, creditsPerUnit: 7 },
        USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
      },
    );

    assert.deepEqual(payload, {
      paymentOrderId: "legacy-alipay-ORDER_1001",
      merchantOrderNo: "ORDER_1001",
      userId: "user-payment-1",
      providerCode: "alipay",
      amount: {
        amount: "8.00",
        currency: "CNY",
      },
      creditAmount: 56,
      callbackId: "trade-alipay-1",
    });
  });

  test("loads exchange rates and forwards a normalized settlement envelope to the main api", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl = async (input: string | URL, init?: RequestInit) => {
      requests.push({ url: String(input), init });

      if (String(input).includes("/rest/v1/credit_exchange_rates")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([
            {
              currency_code: "USD",
              credits_per_unit: 40,
              min_amount: 1,
              max_amount: 100,
              is_active: true,
            },
          ]),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          success: true,
          data: {
            ledgerId: "ledger-payment-1",
            balanceAfter: 220,
            paymentOrderId: "legacy-wechat-ORDER_2001",
            merchantOrderNo: "ORDER_2001",
          },
        }),
      } as Response;
    };

    const result = await writeLegacyPaymentSettlement(
      {
        userId: "user-payment-2",
        transactionId: "wechat-trade-1",
        amount: 3,
        currency: "USD",
        payType: "wechat",
        billNo: "ORDER_2001",
      },
      {
        baseUrl: "https://api.kk.local",
        internalToken: "payment-internal-token",
        supabaseUrl: "https://db.kk.local",
        serviceRoleKey: "service-role-key",
        requestId: "req-payment-bridge",
        fetchImpl,
      },
    );

    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /credit_exchange_rates/);
    assert.equal(requests[1].url, "https://api.kk.local/internal/v1/payment-settlements");
    assert.equal(
      (requests[1].init?.headers as Record<string, string>)["x-internal-token"],
      "payment-internal-token",
    );

    const body = JSON.parse(String(requests[1].init?.body));
    assert.deepEqual(body, {
      paymentOrderId: "legacy-wechat-ORDER_2001",
      merchantOrderNo: "ORDER_2001",
      userId: "user-payment-2",
      providerCode: "wechat",
      amount: {
        amount: "3.00",
        currency: "USD",
      },
      creditAmount: 120,
      callbackId: "wechat-trade-1",
    });

    assert.equal(result.result.ledgerId, "ledger-payment-1");
    assert.equal(result.result.balanceAfter, 220);
  });

  test("falls back to default exchange rates when supabase lookup is unavailable", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl = async (input: string | URL, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          success: true,
          data: {
            ledgerId: "ledger-payment-2",
            balanceAfter: 125,
            paymentOrderId: "legacy-alipay-ORDER_3001",
            merchantOrderNo: "ORDER_3001",
          },
        }),
      } as Response;
    };

    await writeLegacyPaymentSettlement(
      {
        userId: "user-payment-3",
        transactionId: "trade-alipay-3",
        amount: 5,
        currency: "CNY",
        payType: "alipay",
        billNo: "ORDER_3001",
      },
      {
        baseUrl: "https://api.kk.local",
        internalToken: "payment-internal-token",
        fetchImpl,
      },
    );

    assert.equal(requests.length, 1);
    const body = JSON.parse(String(requests[0].init?.body));
    assert.equal(body.creditAmount, 25);
  });
});
