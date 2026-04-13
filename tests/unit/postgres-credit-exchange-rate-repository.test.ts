import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  PostgresCreditExchangeRateRepository,
  createCreditExchangeRateRepositoryFromEnv,
} from "../../apps/api/src/modules/billing/infrastructure/postgres-credit-exchange-rate-repository.ts";

class FakeQueryable {
  readonly queries: Array<{ sql: string; values: unknown[] }> = [];
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

test("Postgres credit exchange rate repository lists configured rows", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [[
    {
      currency_code: "CNY",
      credits_per_unit: 5,
      min_amount: 6,
      max_amount: 300,
      is_active: true,
      updated_at: "2026-04-13T10:00:00.000Z",
    },
  ]];
  const repository = new PostgresCreditExchangeRateRepository(fakeQueryable as never);

  const rows = await repository.list();

  assert.equal(rows.length, 1);
  assert.equal(rows[0].currencyCode, "CNY");
  assert.match(fakeQueryable.queries[0].sql, /from credit_exchange_rates/i);
});

test("Postgres credit exchange rate repository upserts rows", async () => {
  const fakeQueryable = new FakeQueryable();
  const repository = new PostgresCreditExchangeRateRepository(fakeQueryable as never);

  const row = await repository.upsert({
    currencyCode: "USD",
    creditsPerUnit: 30,
    minAmount: 5,
    maxAmount: 500,
    isActive: true,
  });

  assert.equal(row.currencyCode, "USD");
  assert.ok(fakeQueryable.queries.some((entry) => /insert into credit_exchange_rates/i.test(entry.sql)));
});

test("credit exchange rate repository factory uses postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const repository = createCreditExchangeRateRepositoryFromEnv();

  assert.ok(repository instanceof PostgresCreditExchangeRateRepository);
});
