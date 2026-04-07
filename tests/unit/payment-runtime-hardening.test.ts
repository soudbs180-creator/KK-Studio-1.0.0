import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { AUTHENTICATED_USER_ID_HEADER } from "../../packages/shared/src/index.ts";
import { createApiServer } from "../../apps/api/src/server.ts";
import { createPaymentSidecarServer } from "../../apps/payment-sidecar/src/server.ts";
import { PaymentService } from "../../apps/payment-sidecar/src/modules/payment/application/payment-service.ts";
import { InMemoryPaymentOrderRepository } from "../../apps/payment-sidecar/src/modules/payment/infrastructure/in-memory-payment-order-repository.ts";
import {
  handleCheckoutComplete,
  handleLegacyCreateQrCode,
} from "../../apps/payment-sidecar/src/modules/payment/presentation/http-payment-routes.ts";
import type {
  PaymentCreditAmountResolver,
  PaymentCreditAmountResolverInput,
} from "../../apps/payment-sidecar/src/modules/payment/infrastructure/payment-credit-amount-resolver.ts";
import type {
  PaymentSettlementWriter,
  SettlementWriterContext,
} from "../../apps/payment-sidecar/src/modules/payment/infrastructure/http-main-api-settlement-writer.ts";
import type { ApplyPaymentSettlementRequestDto } from "../../packages/contracts/src/index.ts";

class StubSettlementWriter implements PaymentSettlementWriter {
  async write(input: ApplyPaymentSettlementRequestDto, _context: SettlementWriterContext) {
    return {
      ledgerId: "ledger-1",
      balanceAfter: 125,
      paymentOrderId: input.paymentOrderId,
      merchantOrderNo: input.merchantOrderNo,
    };
  }
}

class StubCreditAmountResolver implements PaymentCreditAmountResolver {
  async resolve(input: PaymentCreditAmountResolverInput): Promise<number> {
    return String(input.currency || "").toUpperCase() === "USD" ? 30 : 5;
  }
}

const trackedEnvKeys = [
  "VERCEL",
  "VERCEL_ENV",
  "CONTEXT",
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
  "USER_API_ENCRYPTION_SECRET",
  "PROFILE_USER_APIS_ENCRYPTION_SECRET",
  "PAYMENT_SIDECAR_INTERNAL_TOKEN",
  "PAYMENT_SIDECAR_SETTLEMENT_TOKEN",
  "PAYMENT_SIDECAR_CALLBACK_TOKEN",
  "PAYMENT_SIDECAR_ALLOW_LEGACY_ROUTES",
  "PAYMENT_SIDECAR_ALLOW_MANUAL_CHECKOUT",
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

describe("hosted runtime hardening", () => {
  test("hosted api server refuses to boot without canonical persistence", async () => {
    process.env.VERCEL = "1";
    process.env.VITE_SUPABASE_URL = "https://guard-ref.supabase.co";
    process.env.SUPABASE_URL = "https://guard-ref.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "publishable-anon";
    process.env.SUPABASE_ANON_KEY = "anon";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.USER_API_ENCRYPTION_SECRET;
    delete process.env.PROFILE_USER_APIS_ENCRYPTION_SECRET;

    let server: ReturnType<typeof createApiServer> | undefined;
    try {
      server = createApiServer(0, {
        allowDegradedPersistence: false,
        verifyTurnstileToken: async () => ({ success: true }),
      });
      assert.fail("Expected hosted API startup to throw without canonical persistence.");
    } catch (error) {
      assert.match(String(error), /Hosted API runtime requires canonical Supabase persistence/);
    } finally {
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server?.close((closeError) => {
            if (closeError) {
              reject(closeError);
              return;
            }

            resolve();
          });
        });
      }
    }
  });

  test("hosted payment sidecar refuses to boot without durable payment dependencies", async () => {
    process.env.VERCEL = "1";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.PAYMENT_SIDECAR_INTERNAL_TOKEN;
    delete process.env.PAYMENT_SIDECAR_SETTLEMENT_TOKEN;

    let server: ReturnType<typeof createPaymentSidecarServer> | undefined;
    try {
      server = createPaymentSidecarServer(0);
      assert.fail("Expected hosted payment sidecar startup to throw without durable dependencies.");
    } catch (error) {
      assert.match(String(error), /Hosted payment sidecar requires durable Supabase storage and settlement auth/);
    } finally {
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server?.close((closeError) => {
            if (closeError) {
              reject(closeError);
              return;
            }

            resolve();
          });
        });
      }
    }
  });
});

describe("legacy payment routes", () => {
  test("legacy payment routes stay local-only by default on hosted runtimes", async () => {
    process.env.VERCEL = "1";

    const service = new PaymentService(
      new InMemoryPaymentOrderRepository(),
      new StubSettlementWriter(),
      new StubCreditAmountResolver(),
    );

    const result = await handleLegacyCreateQrCode(
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

    assert.equal(result.statusCode, 403);
  });

  test("manual checkout stays local-only even when the opt-in flag is enabled", async () => {
    process.env.VERCEL = "1";
    process.env.PAYMENT_SIDECAR_ALLOW_MANUAL_CHECKOUT = "true";

    const service = new PaymentService(
      new InMemoryPaymentOrderRepository(),
      new StubSettlementWriter(),
      new StubCreditAmountResolver(),
    );

    const created = await service.createOrder({
      providerCode: "alipay",
      amount: "5.00",
      currency: "CNY",
      returnUrl: "https://kkai.plus/pay/success",
      notifyUrl: "https://payment.kkai.plus/payment/v1/callbacks/alipay",
      idempotencyKey: "idem-hosted-manual-checkout-1",
    }, {
      requestId: "req-hosted-manual-checkout-create",
      userId: "hosted-user-1",
      paymentUrlFactory: (input) => `https://payment.kkai.plus/payment/v1/orders/${input.merchantOrderNo}/checkout`,
    });

    assert.equal(created.success, true);
    if (!created.success) {
      return;
    }

    const result = await handleCheckoutComplete(
      service,
      created.data.merchantOrderNo,
      { "x-request-id": "req-hosted-manual-checkout-complete" },
    );

    assert.equal(result.statusCode, 403);
  });
});
