import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { AUTHENTICATED_USER_ID_HEADER } from "../../packages/shared/src/index.ts";
import { PaymentService } from "../../apps/payment-sidecar/src/modules/payment/application/payment-service.ts";
import { InMemoryPaymentOrderRepository } from "../../apps/payment-sidecar/src/modules/payment/infrastructure/in-memory-payment-order-repository.ts";
import type {
  PaymentCreditAmountResolver,
  PaymentCreditAmountResolverInput,
} from "../../apps/payment-sidecar/src/modules/payment/infrastructure/payment-credit-amount-resolver.ts";
import type {
  PaymentSettlementWriter,
  SettlementWriterContext,
} from "../../apps/payment-sidecar/src/modules/payment/infrastructure/http-main-api-settlement-writer.ts";
import {
  handleCreatePaymentOrder,
  handleLegacyCreateQrCode,
  handleLegacyGetStatus,
} from "../../apps/payment-sidecar/src/modules/payment/presentation/http-payment-routes.ts";
import type { ApplyPaymentSettlementRequestDto } from "../../packages/contracts/src/index.ts";

const originalConsoleWarn = console.warn;

async function withMutedConsoleWarnAsync<T>(callback: () => Promise<T>): Promise<T> {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    return await callback();
  } finally {
    console.warn = originalWarn;
  }
}

class StubSettlementWriter implements PaymentSettlementWriter {
  readonly calls: ApplyPaymentSettlementRequestDto[] = [];

  async write(input: ApplyPaymentSettlementRequestDto, _context: SettlementWriterContext) {
    this.calls.push(input);
    return {
      ledgerId: "ledger-1",
      balanceAfter: 125,
      paymentOrderId: input.paymentOrderId,
      merchantOrderNo: input.merchantOrderNo,
    };
  }
}

class StubCreditAmountResolver implements PaymentCreditAmountResolver {
  readonly calls: PaymentCreditAmountResolverInput[] = [];
  private readonly resolveFn: (input: PaymentCreditAmountResolverInput) => number;

  constructor(resolveFn?: (input: PaymentCreditAmountResolverInput) => number) {
    this.resolveFn = resolveFn || ((input) => {
      const amount = Number(input.amount);
      return String(input.currency || "").toUpperCase() === "USD"
        ? Math.max(1, Math.round(amount * 30))
        : Math.max(1, Math.round(amount * 5));
    });
  }

  async resolve(input: PaymentCreditAmountResolverInput): Promise<number> {
    this.calls.push(input);
    return this.resolveFn(input);
  }
}

beforeEach(() => {
  console.warn = () => undefined;
});

afterEach(() => {
  console.warn = originalConsoleWarn;
});

describe("payment sidecar service", () => {
  test("creates idempotent payment orders for the same user and idempotency key", async () => {
    const service = new PaymentService(
      new InMemoryPaymentOrderRepository(),
      new StubSettlementWriter(),
      new StubCreditAmountResolver(),
    );

    const first = await service.createOrder({
      providerCode: "alipay",
      amount: "25.00",
      currency: "CNY",
      creditAmount: 125,
      returnUrl: "https://kkai.plus/pay/success",
      notifyUrl: "https://payment.kkai.plus/api/pay/notify/alipay",
      idempotencyKey: "idem-sidecar-1",
    }, {
      requestId: "req-sidecar-create-1",
      userId: "user-sidecar-1",
      paymentUrlFactory: (input) => `https://payment.kkai.plus/payment/v1/orders/${input.merchantOrderNo}/checkout`,
    });

    const second = await service.createOrder({
      providerCode: "alipay",
      amount: "25.00",
      currency: "CNY",
      creditAmount: 125,
      returnUrl: "https://kkai.plus/pay/success",
      notifyUrl: "https://payment.kkai.plus/api/pay/notify/alipay",
      idempotencyKey: "idem-sidecar-1",
    }, {
      requestId: "req-sidecar-create-2",
      userId: "user-sidecar-1",
      paymentUrlFactory: (input) => `https://payment.kkai.plus/payment/v1/orders/${input.merchantOrderNo}/checkout`,
    });

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    if (first.success && second.success) {
      assert.equal(first.data.id, second.data.id);
      assert.equal(first.data.merchantOrderNo, second.data.merchantOrderNo);
      assert.equal(first.data.paymentUrl, second.data.paymentUrl);
    }
  });

  test("resolves credit amounts server-side instead of trusting the client payload", async () => {
    await withMutedConsoleWarnAsync(async () => {
      const resolver = new StubCreditAmountResolver(() => 40);
      const service = new PaymentService(
        new InMemoryPaymentOrderRepository(),
        new StubSettlementWriter(),
        resolver,
      );

      const created = await service.createOrder({
        providerCode: "alipay",
        amount: "8.00",
        currency: "CNY",
        creditAmount: 8000,
        returnUrl: "https://kkai.plus/pay/success",
        notifyUrl: "https://payment.kkai.plus/api/pay/notify/alipay",
        idempotencyKey: "idem-sidecar-credit-resolve-1",
      }, {
        requestId: "req-sidecar-credit-resolve-1",
        userId: "user-sidecar-credit-1",
        paymentUrlFactory: (input) => `https://payment.kkai.plus/payment/v1/orders/${input.merchantOrderNo}/checkout`,
      });

      assert.equal(created.success, true);
      assert.equal(resolver.calls.length, 1);
      if (created.success) {
        assert.equal(created.data.creditAmount, 40);
      }
    });
  });

  test("creates payment orders when legacy clients omit creditAmount", async () => {
    const resolver = new StubCreditAmountResolver(() => 30);
    const service = new PaymentService(
      new InMemoryPaymentOrderRepository(),
      new StubSettlementWriter(),
      resolver,
    );

    const created = await service.createOrder({
      providerCode: "alipay",
      amount: "6.00",
      currency: "CNY",
      returnUrl: "https://kkai.plus/pay/success",
      notifyUrl: "https://payment.kkai.plus/api/pay/notify/alipay",
      idempotencyKey: "idem-sidecar-credit-omitted-1",
    }, {
      requestId: "req-sidecar-credit-omitted-1",
      userId: "user-sidecar-credit-omitted-1",
      paymentUrlFactory: (input) => `https://payment.kkai.plus/payment/v1/orders/${input.merchantOrderNo}/checkout`,
    });

    assert.equal(created.success, true);
    assert.equal(resolver.calls.length, 1);
    if (created.success) {
      assert.equal(created.data.creditAmount, 30);
    }
  });

  test("settles a paid callback only once and exposes legacy status mapping", async () => {
    const settlementWriter = new StubSettlementWriter();
    const service = new PaymentService(
      new InMemoryPaymentOrderRepository(),
      settlementWriter,
      new StubCreditAmountResolver(),
    );

    const created = await service.createOrder({
      providerCode: "alipay",
      amount: "5.00",
      currency: "CNY",
      creditAmount: 25,
      returnUrl: "https://kkai.plus/pay/success",
      notifyUrl: "https://payment.kkai.plus/api/pay/notify/alipay",
      idempotencyKey: "idem-sidecar-paid-1",
    }, {
      requestId: "req-sidecar-paid-create",
      userId: "user-sidecar-2",
      paymentUrlFactory: (input) => `https://payment.kkai.plus/payment/v1/orders/${input.merchantOrderNo}/checkout`,
    });

    assert.equal(created.success, true);
    if (!created.success) {
      return;
    }

    const firstCallback = await service.handleAlipayCallback({
      callbackId: "callback-1",
      merchantOrderNo: created.data.merchantOrderNo,
      tradeStatus: "TRADE_SUCCESS",
      payload: { source: "test" },
    }, {
      requestId: "req-sidecar-callback-1",
    });

    const repeatedCallback = await service.handleAlipayCallback({
      callbackId: "callback-1",
      merchantOrderNo: created.data.merchantOrderNo,
      tradeStatus: "TRADE_SUCCESS",
      payload: { source: "test" },
    }, {
      requestId: "req-sidecar-callback-2",
    });

    const secondSuccessfulCallback = await service.handleAlipayCallback({
      callbackId: "callback-2",
      merchantOrderNo: created.data.merchantOrderNo,
      tradeStatus: "TRADE_SUCCESS",
      payload: { source: "test" },
    }, {
      requestId: "req-sidecar-callback-3",
    });

    assert.equal(firstCallback.success, true);
    assert.equal(repeatedCallback.success, true);
    assert.equal(secondSuccessfulCallback.success, true);
    assert.equal(settlementWriter.calls.length, 1);

    const status = await service.getOrderStatus(created.data.merchantOrderNo);
    assert.ok(status);
    assert.equal(status?.tradeStatus, "TRADE_SUCCESS");
    assert.equal(status?.settlementApplied, true);
    assert.equal(status?.settlementLedgerId, "ledger-1");
  });
});

describe("payment sidecar legacy routes", () => {
  test("requires authentication for the new create order route", async () => {
    const service = new PaymentService(
      new InMemoryPaymentOrderRepository(),
      new StubSettlementWriter(),
      new StubCreditAmountResolver(),
    );

    const result = await handleCreatePaymentOrder(service, {
      providerCode: "alipay",
      amount: "8.00",
      currency: "CNY",
      returnUrl: "https://kkai.plus/pay/success",
      notifyUrl: "https://payment.kkai.plus/api/pay/notify/alipay",
      idempotencyKey: "idem-missing-auth",
    }, {
      "x-request-id": "req-sidecar-auth-missing",
    }, "https://payment.kkai.plus");

    assert.equal(result.statusCode, 401);
  });

  test("maps legacy qrcode and status routes onto the new payment module", async () => {
    const service = new PaymentService(
      new InMemoryPaymentOrderRepository(),
      new StubSettlementWriter(),
      new StubCreditAmountResolver(),
    );

    const created = await handleLegacyCreateQrCode(
      service,
      new URLSearchParams({
        method: "alipay",
        userId: "legacy-user-1",
        amount: "20",
      }),
      {
        [AUTHENTICATED_USER_ID_HEADER]: "legacy-user-1",
        "x-request-id": "req-sidecar-legacy-create",
      },
      "https://payment.kkai.plus",
    );

    assert.equal(created.statusCode, 200);
    const payload = created.body as { qrCode: string; outTradeNo: string; isWebLink: boolean };
    assert.ok(payload.qrCode.includes("/payment/v1/orders/"));
    assert.equal(payload.isWebLink, true);

    const status = await handleLegacyGetStatus(
      service,
      new URLSearchParams({
        outTradeNo: payload.outTradeNo,
      }),
      {
        [AUTHENTICATED_USER_ID_HEADER]: "legacy-user-1",
        "x-request-id": "req-sidecar-legacy-status",
      },
    );

    assert.equal(status.statusCode, 200);
    const statusPayload = status.body as { tradeStatus: string };
    assert.equal(statusPayload.tradeStatus, "WAITING");
  });

  test("allows legacy payment routes to inject an external payment url factory", async () => {
    const service = new PaymentService(
      new InMemoryPaymentOrderRepository(),
      new StubSettlementWriter(),
      new StubCreditAmountResolver(),
    );

    const created = await handleLegacyCreateQrCode(
      service,
      new URLSearchParams({
        method: "alipay",
        userId: "legacy-user-bridge-1",
        amount: "12",
        returnUrl: "https://kkai.plus/pay/success",
        notifyUrl: "https://payment.kkai.plus/api/pay/notify/alipay",
      }),
      {
        [AUTHENTICATED_USER_ID_HEADER]: "legacy-user-bridge-1",
        "x-request-id": "req-sidecar-legacy-external-link",
      },
      "https://payment.kkai.plus",
      {
        paymentUrlFactory: async (input) =>
          `https://openapi.alipay.com/gateway.do?merchantOrderNo=${encodeURIComponent(input.merchantOrderNo)}`,
      },
    );

    assert.equal(created.statusCode, 200);
    const payload = created.body as { qrCode: string; outTradeNo: string };
    assert.match(payload.qrCode, /^https:\/\/openapi\.alipay\.com\/gateway\.do\?/);
    assert.match(payload.qrCode, new RegExp(encodeURIComponent(payload.outTradeNo)));
  });
});

