import assert from "node:assert/strict";
import { test } from "node:test";

import type { BrowserSessionRecord } from "../../apps/api/src/modules/auth/domain/browser-session.ts";
import { PostgresUserSessionRepository } from "../../apps/api/src/modules/auth/infrastructure/postgres-user-session-repository.ts";

interface RecordedQuery {
  sql: string;
  values: unknown[];
}

class FakeQueryable {
  readonly queries: RecordedQuery[] = [];
  private readonly updateResult: { rows: unknown[]; rowCount: number };

  constructor(updateResult: { rows: unknown[]; rowCount: number }) {
    this.updateResult = updateResult;
  }

  async query(sql: string, values: unknown[] = []) {
    this.queries.push({ sql, values });

    if (/^\s*update\s+user_sessions/i.test(sql)) {
      return this.updateResult;
    }

    return { rows: [], rowCount: 1 };
  }
}

function createNextRecord(overrides: Partial<BrowserSessionRecord> = {}): BrowserSessionRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    userId: "user-1",
    refreshTokenHash: "next-refresh-token-hash",
    expiresAt: "2026-05-05T11:00:00.000Z",
    rotatedFrom: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-05-05T10:00:00.000Z",
    userAgent: "node-test",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

test("Postgres user session rotation revokes and inserts in a single transaction", async () => {
  const fakeQueryable = new FakeQueryable({
    rows: [{ id: "11111111-1111-4111-8111-111111111111" }],
    rowCount: 1,
  });
  const repository = new PostgresUserSessionRepository(fakeQueryable as never);

  await repository.replaceRotatedSession(
    "11111111-1111-4111-8111-111111111111",
    createNextRecord(),
    "2026-05-05T10:00:00.000Z",
  );

  assert.equal(normalizeSql(fakeQueryable.queries[0]?.sql || ""), "begin");
  assert.match(fakeQueryable.queries[1]?.sql || "", /update\s+user_sessions/i);
  assert.match(fakeQueryable.queries[1]?.sql || "", /revoked_at\s+is\s+null/i);
  assert.match(fakeQueryable.queries[1]?.sql || "", /returning\s+id/i);
  assert.match(fakeQueryable.queries[2]?.sql || "", /insert\s+into\s+user_sessions/i);
  assert.equal(normalizeSql(fakeQueryable.queries[3]?.sql || ""), "commit");
});

test("Postgres user session rotation rejects concurrent reuse after revoke loses the race", async () => {
  const fakeQueryable = new FakeQueryable({ rows: [], rowCount: 0 });
  const repository = new PostgresUserSessionRepository(fakeQueryable as never);

  await assert.rejects(
    () => repository.replaceRotatedSession(
      "11111111-1111-4111-8111-111111111111",
      createNextRecord(),
      "2026-05-05T10:00:00.000Z",
    ),
    /invalid|revoked|expired|rotated/i,
  );

  assert.ok(fakeQueryable.queries.some((entry) => normalizeSql(entry.sql) === "begin"));
  assert.ok(fakeQueryable.queries.some((entry) => normalizeSql(entry.sql) === "rollback"));
  assert.equal(
    fakeQueryable.queries.some((entry) => /insert\s+into\s+user_sessions/i.test(entry.sql)),
    false,
  );
});
