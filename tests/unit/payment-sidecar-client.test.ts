import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createKkApiClient } from "../../packages/contracts/src/index.ts";

describe("payment sidecar client", () => {
  test("creates payment orders with typed headers and body", async () => {
    const requests: Array<{
      body?: string;
      headers?: HeadersInit;
      method?: string;
      url: string;
    }> = [];

    const client = createKkApiClient({
      baseUrl: "https://payment.kkai.plus",
      getClientVersion: () => "legacy-payment-web",
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
            id: "payment-order-1",
            merchantOrderNo: "ORDER_TEST_1",
            status: "created",
            amount: "20.00",
            currency: "CNY",
            creditAmount: 100,
            paymentUrl: "https://payment.kkai.plus/payment/v1/orders/ORDER_TEST_1/checkout",
            providerCode: "alipay",
            userId: "user-1",
          },
          meta: {
            requestId: "req-payment-create",
            timestamp: "2026-03-23T00:00:00.000Z",
            clientVersion: "legacy-payment-web",
          },
        }), {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    const response = await client.createPaymentOrder({
      providerCode: "alipay",
      amount: "20.00",
      currency: "CNY",
      returnUrl: "https://kkai.plus/pay/success",
      notifyUrl: "https://payment.kkai.plus/payment/v1/callbacks/alipay",
      idempotencyKey: "idem-payment-order-1",
      userId: "user-1",
    }, {
      requestId: "req-payment-create",
    });

    assert.equal(response.success, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://payment.kkai.plus/payment/v1/orders");
    assert.equal(requests[0].method, "POST");

    const headers = new Headers(requests[0].headers);
    assert.equal(headers.get("x-client-version"), "legacy-payment-web");
    assert.equal(headers.get("x-request-id"), "req-payment-create");
    assert.equal(headers.get("content-type"), "application/json; charset=utf-8");

    assert.deepEqual(JSON.parse(requests[0].body || "{}"), {
      providerCode: "alipay",
      amount: "20.00",
      currency: "CNY",
      returnUrl: "https://kkai.plus/pay/success",
      notifyUrl: "https://payment.kkai.plus/payment/v1/callbacks/alipay",
      idempotencyKey: "idem-payment-order-1",
      userId: "user-1",
    });
  });

  test("resolves typed payment order status views", async () => {
    const client = createKkApiClient({
      baseUrl: "https://payment.kkai.plus",
      fetchImpl: async (input) => {
        assert.equal(String(input), "https://payment.kkai.plus/payment/v1/orders/ORDER_STATUS_1/status");

        return new Response(JSON.stringify({
          success: true,
          data: {
            paymentOrderId: "payment-order-1",
            merchantOrderNo: "ORDER_STATUS_1",
            paymentOrderStatus: "paid",
            tradeStatus: "TRADE_SUCCESS",
            creditAmount: 100,
            amount: "20.00",
            currency: "CNY",
            settlementApplied: true,
            settlementLedgerId: "ledger-1",
          },
          meta: {
            requestId: "req-payment-status",
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

    const response = await client.getPaymentOrderStatus("ORDER_STATUS_1", {
      requestId: "req-payment-status",
    });

    assert.equal(response.success, true);
    if (response.success) {
      assert.equal(response.data.paymentOrderStatus, "paid");
      assert.equal(response.data.settlementApplied, true);
      assert.equal(response.data.tradeStatus, "TRADE_SUCCESS");
    }
  });
});
