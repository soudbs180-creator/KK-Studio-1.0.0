import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { CreditTransactionType } from "../../packages/contracts/src/index.ts";
import {
  CreditBalanceInsufficientError,
  InMemoryCreditAccountRepository,
} from "../../apps/api/src/modules/billing/infrastructure/in-memory-credit-account-repository.ts";
import {
  PostgresCreditAccountRepository,
  createCreditAccountRepositoryFromEnv,
} from "../../apps/api/src/modules/billing/infrastructure/postgres-credit-account-repository.ts";

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

const databaseUrlEnv = "DATABASE_URL";
const originalDatabaseUrl = process.env[databaseUrlEnv];

afterEach(() => {
  if (typeof originalDatabaseUrl === "string") {
    process.env[databaseUrlEnv] = originalDatabaseUrl;
  } else {
    delete process.env[databaseUrlEnv];
  }
});

test("Postgres credit account repository upserts balances and transactions for debits", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    [{ user_id: "user-1", balance: 100, frozen: 0, created_at: "2026-04-13T10:00:00.000Z", updated_at: "2026-04-13T10:00:00.000Z" }],
    [{ user_id: "user-1", balance: 100, frozen: 0, created_at: "2026-04-13T10:00:00.000Z", updated_at: "2026-04-13T10:00:00.000Z" }],
  ];
  const repository = new PostgresCreditAccountRepository(fakeQueryable as never);

  const current = await repository.getOrCreate("user-1");
  const result = await repository.saveDebit(current, {
    ledgerId: "ledger-1",
    userId: "user-1",
    businessRefType: "generation",
    businessRefId: "task-1",
    creditAmount: 5,
    idempotencyKey: "idem-1",
    balanceAfter: 95,
    transactionType: CreditTransactionType.Debit,
    createdAt: "2026-04-13T10:01:00.000Z",
  });

  assert.equal(result.account.balance, 95);
  assert.ok(fakeQueryable.queries.some((entry) => /insert into user_credits/i.test(entry.sql)));
  assert.ok(fakeQueryable.queries.some((entry) => /insert into credit_transactions/i.test(entry.sql)));
});

test("Postgres credit account repository fails on insufficient balance", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    [{ user_id: "user-1", balance: 1, frozen: 0, created_at: "2026-04-13T10:00:00.000Z", updated_at: "2026-04-13T10:00:00.000Z" }],
    [{ user_id: "user-1", balance: 1, frozen: 0, created_at: "2026-04-13T10:00:00.000Z", updated_at: "2026-04-13T10:00:00.000Z" }],
  ];
  const repository = new PostgresCreditAccountRepository(fakeQueryable as never);

  const current = await repository.getOrCreate("user-1");

  await assert.rejects(
    () => repository.saveDebit(current, {
      ledgerId: "ledger-1",
      userId: "user-1",
      businessRefType: "generation",
      businessRefId: "task-1",
      creditAmount: 5,
      idempotencyKey: "idem-1",
      balanceAfter: -4,
      transactionType: CreditTransactionType.Debit,
      createdAt: "2026-04-13T10:01:00.000Z",
    }),
    CreditBalanceInsufficientError,
  );
});

test("Postgres credit account repository refunds a completed transaction", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    // findTransactionById: SELECT * FROM credit_transactions WHERE id=$1 AND user_id=$2
    [{
      id: "txn-1",
      user_id: "user-1",
      amount: -5,
      type: "consumption",
      balance_after: 10,
      status: "completed",
      business_ref_type: "generation",
      business_ref_id: "task-1",
      created_at: "2026-04-13T10:00:00.000Z",
      completed_at: "2026-04-13T10:00:00.000Z",
    }],
    // withTransaction: SELECT balance, frozen FROM user_credits WHERE user_id=$1 FOR UPDATE
    [{ balance: 10, frozen: 0 }],
    // withTransaction: SELECT status FROM credit_transactions WHERE id=$1 AND user_id=$2 FOR UPDATE
    [{ status: "completed" }],
    // upsertAccountWithQueryable
    [],
    // UPDATE credit_transactions SET status='refunded'
    [],
    // insertTransactionWithQueryable
    [],
  ];
  const repository = new PostgresCreditAccountRepository(fakeQueryable as never);

  const refunded = await repository.refundTransaction("user-1", "txn-1");

  assert.equal(refunded.transactionType, CreditTransactionType.Refund);
  assert.ok(fakeQueryable.queries.some((entry) => /update credit_transactions/i.test(entry.sql)));
});

test("credit account repository factory uses postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const repository = createCreditAccountRepositoryFromEnv();

  assert.ok(repository instanceof PostgresCreditAccountRepository);
});

test("credit account repository factory falls back to null without postgres config", () => {
  delete process.env.DATABASE_URL;

  const repository = createCreditAccountRepositoryFromEnv();

  assert.equal(repository, null);
  assert.ok(!(repository instanceof InMemoryCreditAccountRepository));
});

test("Postgres credit account repository creates new accounts with zero default balance", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    [],
    [],
    [{ user_id: "user-2", email: "user-2@example.com", balance: 0, frozen: 0, created_at: "2026-04-13T10:00:00.000Z", updated_at: "2026-04-13T10:00:00.000Z" }],
  ];
  const repository = new PostgresCreditAccountRepository(fakeQueryable as never);

  const account = await repository.getOrCreate("user-2");

  assert.equal(account.balance, 0);
  const insertQuery = fakeQueryable.queries.find((entry) => /insert into user_credits/i.test(entry.sql));
  assert.ok(insertQuery);
  assert.equal(insertQuery?.values[2], 0);
});

test("Postgres credit account repository resolves email identities to profile ids for admin lookup and recharge", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    [{ id: "user-3", email: "user-3@example.com" }],
    [{ user_id: "user-3", email: "user-3@example.com", balance: 0, frozen: 0, created_at: "2026-04-13T10:00:00.000Z", updated_at: "2026-04-13T10:00:00.000Z" }],
    [],
    [{ id: "user-3", email: "user-3@example.com" }],
    [{ user_id: "user-3", email: "user-3@example.com", balance: 0, frozen: 0, created_at: "2026-04-13T10:00:00.000Z", updated_at: "2026-04-13T10:00:00.000Z" }],
    [],
  ];
  const repository = new PostgresCreditAccountRepository(fakeQueryable as never);

  const lookup = await repository.adminGetAccountByIdentity("user-3@example.com", 50);
  const recharge = await repository.adminRechargeByIdentity("user-3@example.com", 25, "admin top up");

  assert.equal(lookup.identity, "user-3@example.com");
  assert.equal(lookup.subjectId, "user-3");
  assert.equal(recharge.identity, "user-3@example.com");
  assert.equal(recharge.subjectId, "user-3");

  const accountQueries = fakeQueryable.queries.filter((entry) => /insert into user_credits/i.test(entry.sql) || /where user_id = \\$1/i.test(entry.sql));
  assert.ok(accountQueries.some((entry) => entry.values.includes("user-3")));
  const rechargeInsert = fakeQueryable.queries.find((entry) => /insert into credit_transactions/i.test(entry.sql));
  assert.ok(rechargeInsert);
  assert.equal(rechargeInsert?.values[1], "user-3");
});
