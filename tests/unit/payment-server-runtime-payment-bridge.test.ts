import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

const require = createRequire(import.meta.url);
const {
  buildRuntimePaymentStatusView,
  handleLegacySuccessfulPaymentCallback,
  persistLegacyPaymentOrder,
} = require("../../payment-server/runtime_payment_bridge.js");

describe("payment-server runtime payment bridge", () => {
  test("persists legacy payment orders into the runtime payment table with frozen credit amounts", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl = async (input: string | URL, init?: RequestInit) => {
      const request = { url: String(input), init };
      requests.push(request);

      if (request.url.includes("/rest/v1/payment_orders") && init?.method === "GET") {
        return {
          ok: true,
          status: 200,
          text: async () => "[]",
        } as Response;
      }

      if (request.url.includes("/rest/v1/credit_exchange_rates")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([
            {
              currency_code: "CNY",
              credits_per_unit: 6,
              min_amount: 5,
              max_amount: 500,
              is_active: true,
            },
          ]),
        } as Response;
      }

      if (request.url.includes("/rest/v1/payment_orders") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([JSON.parse(String(init.body))]),
        } as Response;
      }

      throw new Error(`Unexpected request: ${request.url}`);
    };

    const result = await persistLegacyPaymentOrder({
      merchantOrderNo: "ORDER_4001",
      userId: "11111111-1111-1111-1111-111111111111",
      providerCode: "alipay",
      amount: 7,
      currency: "CNY",
      paymentUrl: "https://pay.kk.local/ORDER_4001",
      returnUrl: "https://app.kk.local/pay/success",
      notifyUrl: "https://pay.kk.local/api/pay/notify/alipay",
      idempotencyKey: "legacy-ORDER_4001",
    }, {
      supabaseUrl: "https://db.kk.local",
      serviceRoleKey: "service-role-key",
      fetchImpl,
    });

    assert.equal(result.persisted, true);
    assert.equal(result.created, true);
    assert.equal(requests.length, 3);
    assert.match(requests[2].url, /payment_orders/);

    const body = JSON.parse(String(requests[2].init?.body));
    assert.equal(body.merchant_order_no, "ORDER_4001");
    assert.equal(body.credit_amount, 42);
    assert.equal(body.idempotency_key, "legacy-ORDER_4001");
    assert.equal(body.status, "created");
  });

  test("uses the persisted payment order id and frozen credit amount during settlement write-back", async () => {
    const orderId = "22222222-2222-2222-2222-222222222222";
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    let paymentOrderReads = 0;

    const persistedOrder = {
      id: orderId,
      user_id: "33333333-3333-3333-3333-333333333333",
      provider_code: "alipay",
      merchant_order_no: "ORDER_5001",
      status: "created",
      amount: "5.00",
      currency: "CNY",
      credit_amount: 25,
      idempotency_key: "legacy-ORDER_5001",
      payment_url: "https://pay.kk.local/ORDER_5001",
      return_url: "https://app.kk.local/pay/success",
      notify_url: "https://pay.kk.local/api/pay/notify/alipay",
      last_callback_id: null,
      settlement_applied_at: null,
      settlement_ledger_id: null,
      created_at: "2026-03-23T08:00:00.000Z",
      updated_at: "2026-03-23T08:00:00.000Z",
      paid_at: null,
    };

    const settledOrder = {
      ...persistedOrder,
      status: "paid",
      last_callback_id: "trade-alipay-5001",
      settlement_applied_at: "2026-03-23T08:05:00.000Z",
      settlement_ledger_id: "44444444-4444-4444-4444-444444444444",
      paid_at: "2026-03-23T08:05:00.000Z",
    };

    const fetchImpl = async (input: string | URL, init?: RequestInit) => {
      const request = { url: String(input), init };
      requests.push(request);

      if (request.url.includes("/rest/v1/payment_orders") && init?.method === "GET") {
        paymentOrderReads += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([paymentOrderReads > 1 ? settledOrder : persistedOrder]),
        } as Response;
      }

      if (request.url.includes("/rest/v1/payment_callbacks") && init?.method === "GET") {
        return {
          ok: true,
          status: 200,
          text: async () => "[]",
        } as Response;
      }

      if (request.url.includes("/rest/v1/payment_callbacks") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([JSON.parse(String(init.body))]),
        } as Response;
      }

      if (request.url.includes("/rest/v1/credit_exchange_rates")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([
            {
              currency_code: "CNY",
              credits_per_unit: 99,
              min_amount: 1,
              max_amount: 500,
              is_active: true,
            },
          ]),
        } as Response;
      }

      if (request.url.endsWith("/internal/v1/payment-settlements")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            success: true,
            data: {
              ledgerId: "44444444-4444-4444-4444-444444444444",
              balanceAfter: 125,
              paymentOrderId: orderId,
              merchantOrderNo: "ORDER_5001",
            },
          }),
        } as Response;
      }

      if (request.url.includes("/rest/v1/payment_orders") && init?.method === "PATCH") {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([settledOrder]),
        } as Response;
      }

      if (request.url.includes("/rest/v1/payment_callbacks") && init?.method === "PATCH") {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{
            payment_order_id: orderId,
            provider_code: "alipay",
            callback_id: "trade-alipay-5001",
            verified: true,
            trade_status: "TRADE_SUCCESS",
            payload: { source: "alipay" },
            settlement_status: "applied",
            settlement_error: null,
            received_at: "2026-03-23T08:05:00.000Z",
            processed_at: "2026-03-23T08:05:00.000Z",
          }]),
        } as Response;
      }

      throw new Error(`Unexpected request: ${request.url}`);
    };

    const result = await handleLegacySuccessfulPaymentCallback({
      userId: persistedOrder.user_id,
      callbackId: "trade-alipay-5001",
      merchantOrderNo: persistedOrder.merchant_order_no,
      amount: 5,
      currency: "CNY",
      providerCode: "alipay",
      payload: { source: "alipay" },
    }, {
      baseUrl: "https://api.kk.local",
      internalToken: "payment-internal-token",
      supabaseUrl: "https://db.kk.local",
      serviceRoleKey: "service-role-key",
      fetchImpl,
    });

    assert.equal(result.success, true);
    assert.equal(result.duplicated, false);
    assert.equal(result.runtimeStatus?.settlementApplied, true);
    assert.equal(result.runtimeStatus?.settlementLedgerId, "44444444-4444-4444-4444-444444444444");

    const settlementRequest = requests.find((request) => request.url.endsWith("/internal/v1/payment-settlements"));
    assert.ok(settlementRequest);
    const settlementBody = JSON.parse(String(settlementRequest?.init?.body));
    assert.equal(settlementBody.paymentOrderId, orderId);
    assert.equal(settlementBody.creditAmount, 25);

    const orderPatch = requests.find((request) => request.url.includes("/rest/v1/payment_orders") && request.init?.method === "PATCH");
    assert.ok(orderPatch);
    const orderPatchBody = JSON.parse(String(orderPatch?.init?.body));
    assert.equal(orderPatchBody.status, "paid");
    assert.equal(orderPatchBody.last_callback_id, "trade-alipay-5001");
    assert.equal(orderPatchBody.settlement_ledger_id, "44444444-4444-4444-4444-444444444444");
  });

  test("maps settled and unsettled runtime orders to legacy trade statuses", () => {
    const waiting = buildRuntimePaymentStatusView({
      id: "payment-order-waiting",
      merchant_order_no: "ORDER_WAITING",
      status: "paid",
      amount: "9.00",
      currency: "CNY",
      credit_amount: 45,
      settlement_applied_at: null,
      settlement_ledger_id: null,
    });

    const settled = buildRuntimePaymentStatusView({
      id: "payment-order-paid",
      merchant_order_no: "ORDER_PAID",
      status: "paid",
      amount: "9.00",
      currency: "CNY",
      credit_amount: 45,
      settlement_applied_at: "2026-03-23T08:10:00.000Z",
      settlement_ledger_id: "ledger-paid",
    });

    assert.equal(waiting.tradeStatus, "WAITING");
    assert.equal(waiting.settlementApplied, false);
    assert.equal(settled.tradeStatus, "TRADE_SUCCESS");
    assert.equal(settled.settlementApplied, true);
  });
});
