import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PostgresCreditAccountRepository,
  createCreditAccountRepositoryFromEnv,
} from "../../apps/api/src/modules/billing/infrastructure/postgres-credit-account-repository.ts";
import {
  PostgresCreditExchangeRateRepository,
  createCreditExchangeRateRepositoryFromEnv,
} from "../../apps/api/src/modules/billing/infrastructure/postgres-credit-exchange-rate-repository.ts";
import { FileBackedCreditAccountRepository } from "../../apps/api/src/modules/billing/infrastructure/file-backed-credit-account-repository.ts";
import { FileBackedCreditExchangeRateRepository } from "../../apps/api/src/modules/billing/infrastructure/file-backed-credit-exchange-rate-repository.ts";
import { CreditTransactionType } from "../../packages/contracts/src/index.ts";

interface RecordedQuery {
  sql: string;
  values: unknown[];
}

class FakeQueryable {
  readonly queries: RecordedQuery[] = [];
  nextRowsQueue: unknown[][] = [];

  async query(sql: string, values: unknown[] = []) {
    this.queries.push({ sql, values });
    const rows = this.nextRowsQueue.length > 0 ? this.nextRowsQueue.shift()! : [];
    return { rows };
  }
}

test("Postgres credit exchange-rate repository lists and upserts rates", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [[
    {
      currency_code: "CNY",
      credits_per_unit: "5",
      min_amount: "5",
      max_amount: "500",
      is_active: true,
      updated_at: "2026-04-13T10:00:00.000Z",
    },
  ]];
  const repository = new PostgresCreditExchangeRateRepository(fakeQueryable as never);

  const rows = await repository.list();
  const saved = await repository.upsert({
    currencyCode: "USD",
    creditsPerUnit: 30,
    minAmount: 1,
    maxAmount: 100,
    isActive: true,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].currencyCode, "CNY");
  assert.equal(saved.currencyCode, "USD");
  assert.ok(fakeQueryable.queries.some((entry) => /insert into credit_exchange_rates/i.test(entry.sql)));
});

test("Postgres credit account repository writes debit, recharge, and refund ledger rows", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    [{ user_id: "user-1", balance: 100, frozen: 0, created_at: "2026-04-13T10:00:00.000Z", updated_at: "2026-04-13T10:00:00.000Z" }],
    [],
    [],
  ];
  const repository = new PostgresCreditAccountRepository(fakeQueryable as never);

  const debit = await repository.saveDebit(
    { accountId: "user-1", userId: "user-1", balance: 100, frozenBalance: 0, createdAt: "2026-04-13T10:00:00.000Z", updatedAt: "2026-04-13T10:00:00.000Z" },
    {
      ledgerId: "txn-1",
      userId: "user-1",
      businessRefType: "generation",
      businessRefId: "job-1",
      creditAmount: 20,
      idempotencyKey: "idem-1",
      balanceAfter: 80,
      transactionType: CreditTransactionType.Debit,
      createdAt: "2026-04-13T10:00:00.000Z",
    },
  );

  fakeQueryable.nextRowsQueue = [
    // findTransactionById
    [{ id: "txn-1", user_id: "user-1", amount: -20, type: "consumption", balance_after: 80, status: "completed", created_at: "2026-04-13T10:00:00.000Z", completed_at: "2026-04-13T10:00:00.000Z", metadata_json: {}, business_ref_type: "generation", business_ref_id: "job-1" }],
    // SELECT balance, frozen ... FOR UPDATE
    [{ balance: 80, frozen: 0 }],
    // SELECT status ... FOR UPDATE
    [{ status: "completed" }],
    // upsertAccountWithQueryable
    [],
    // UPDATE credit_transactions SET status='refunded'
    [],
    // insertTransactionWithQueryable
    [],
  ];
  const refund = await repository.refundTransaction("user-1", "txn-1");

  assert.equal(debit.account.balance, 80);
  assert.equal(refund.transactionType, CreditTransactionType.Refund);
  assert.ok(fakeQueryable.queries.some((entry) => /insert into credit_transactions/i.test(entry.sql)));
  assert.ok(fakeQueryable.queries.some((entry) => /update credit_transactions/i.test(entry.sql)));
});

test("billing repository factories choose postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const creditRepository = createCreditAccountRepositoryFromEnv();
  const exchangeRepository = createCreditExchangeRateRepositoryFromEnv();

  assert.ok(creditRepository instanceof PostgresCreditAccountRepository);
  assert.ok(exchangeRepository instanceof PostgresCreditExchangeRateRepository);

  delete process.env.DATABASE_URL;

  const fallbackCreditRepository = createCreditAccountRepositoryFromEnv();
  const fallbackExchangeRepository = createCreditExchangeRateRepositoryFromEnv();

  assert.equal(fallbackCreditRepository, null);
  assert.equal(fallbackExchangeRepository, null);
  assert.ok(new FileBackedCreditAccountRepository());
  assert.ok(new FileBackedCreditExchangeRateRepository());
});
