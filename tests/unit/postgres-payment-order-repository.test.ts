import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type {
  PaymentCallbackRecord,
  PaymentOrderRecord,
} from "../../apps/payment-sidecar/src/modules/payment/domain/payment-order.ts";
import {
  InMemoryPaymentOrderRepository,
} from "../../apps/payment-sidecar/src/modules/payment/infrastructure/in-memory-payment-order-repository.ts";
import {
  PostgresPaymentOrderRepository,
  createPaymentOrderRepositoryFromEnv,
} from "../../apps/payment-sidecar/src/modules/payment/infrastructure/postgres-payment-order-repository.ts";
import {
  PostgresPaymentCreditAmountResolver,
  createPaymentCreditAmountResolverFromEnv,
} from "../../apps/payment-sidecar/src/modules/payment/infrastructure/postgres-payment-credit-amount-resolver.ts";

interface RecordedQuery {
  sql: string;
  values: unknown[];
}

class FakeQueryable {
  readonly queries: RecordedQuery[] = [];
  nextRows: unknown[] = [];

  async query(sql: string, values: unknown[] = []) {
    this.queries.push({ sql, values });
    return {
      rows: this.nextRows,
    };
  }
}

const databaseUrlEnv = "DATABASE_URL";
const originalDatabaseUrl = process.env[databaseUrlEnv];

afterEach(() => {
  if (typeof originalDatabaseUrl === "string") {
    process.env[databaseUrlEnv] = originalDatabaseUrl;
  } else {
    delete process.env[databaseUrlEnv];
  }
});

function buildPaymentOrder(): PaymentOrderRecord {
  return {
    id: "payment-order-1",
    merchantOrderNo: "ORDER_1",
    status: "created",
    amount: "10.00",
    currency: "CNY",
    creditAmount: 50,
    paymentUrl: "https://pay.example.com/ORDER_1",
    providerCode: "alipay",
    userId: "user-1",
    idempotencyKey: "idem-payment-1",
    returnUrl: "https://app.example.com/pay/success",
    notifyUrl: "https://api.example.com/payment/callback",
    createdAt: "2026-04-13T10:00:00.000Z",
    updatedAt: "2026-04-13T10:00:00.000Z",
  };
}

function buildPaymentCallback(): PaymentCallbackRecord {
  return {
    paymentOrderId: "payment-order-1",
    providerCode: "alipay",
    callbackId: "callback-1",
    verified: true,
    tradeStatus: "TRADE_SUCCESS",
    payload: { tradeNo: "trade-1" },
    settlementStatus: "pending",
    receivedAt: "2026-04-13T10:01:00.000Z",
  };
}

test("Postgres payment order repository upserts orders and callbacks", async () => {
  const fakeQueryable = new FakeQueryable();
  const repository = new PostgresPaymentOrderRepository(fakeQueryable as never);

  await repository.save(buildPaymentOrder());
  await repository.saveCallback(buildPaymentCallback());

  assert.equal(fakeQueryable.queries.length, 2);
  assert.match(fakeQueryable.queries[0].sql, /insert into payment_orders/i);
  assert.match(fakeQueryable.queries[0].sql, /on conflict \(id\) do update/i);
  assert.match(fakeQueryable.queries[1].sql, /insert into payment_callbacks/i);
  assert.match(fakeQueryable.queries[1].sql, /on conflict \(callback_id\) do update/i);
  assert.ok(fakeQueryable.queries[0].values.includes("ORDER_1"));
  assert.ok(fakeQueryable.queries[1].values.includes("callback-1"));
});

test("Postgres payment order repository maps stored rows back into domain records", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRows = [
    {
      id: "payment-order-1",
      user_id: "user-1",
      provider_code: "alipay",
      merchant_order_no: "ORDER_1",
      status: "paid",
      amount: "10.00",
      currency: "CNY",
      credit_amount: 50,
      idempotency_key: "idem-payment-1",
      payment_url: "https://pay.example.com/ORDER_1",
      return_url: "https://app.example.com/pay/success",
      notify_url: "https://api.example.com/payment/callback",
      last_callback_id: "callback-1",
      settlement_applied_at: "2026-04-13T10:02:00.000Z",
      settlement_ledger_id: "ledger-1",
      created_at: "2026-04-13T10:00:00.000Z",
      updated_at: "2026-04-13T10:02:00.000Z",
      paid_at: "2026-04-13T10:02:00.000Z",
    },
  ];
  const repository = new PostgresPaymentOrderRepository(fakeQueryable as never);

  const order = await repository.findByMerchantOrderNo("ORDER_1");

  assert.ok(order);
  assert.equal(order?.merchantOrderNo, "ORDER_1");
  assert.equal(order?.status, "paid");
  assert.equal(order?.settlementLedgerId, "ledger-1");
  assert.equal(order?.lastCallbackId, "callback-1");
});

test("Postgres payment credit amount resolver uses configured exchange rates when available", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRows = [{ credits_per_unit: "8", is_active: true }];
  const resolver = new PostgresPaymentCreditAmountResolver(fakeQueryable as never);

  const amount = await resolver.resolve({
    amount: "10.00",
    currency: "CNY",
  });

  assert.equal(amount, 80);
  assert.match(fakeQueryable.queries[0].sql, /from credit_exchange_rates/i);
});

test("payment repository factory uses postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const repository = createPaymentOrderRepositoryFromEnv({
    createPostgresRepository: () => ({ kind: "postgres" } as unknown as PostgresPaymentOrderRepository),
  });

  assert.deepEqual(repository, { kind: "postgres" });
});

test("payment repository factory falls back to in-memory without postgres config", () => {
  delete process.env.DATABASE_URL;

  const repository = createPaymentOrderRepositoryFromEnv();

  assert.ok(repository instanceof InMemoryPaymentOrderRepository);
});

test("payment credit resolver factory uses postgres when DATABASE_URL is configured", async () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const resolver = createPaymentCreditAmountResolverFromEnv({
    createPostgresResolver: () => ({
      resolve: async () => 42,
    }),
  });

  assert.equal(await resolver.resolve({ amount: "8.00", currency: "CNY" }), 42);
});
