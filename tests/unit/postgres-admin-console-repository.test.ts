import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  InMemoryAdminConsoleRepository,
} from "../../apps/api/src/modules/admin-console/infrastructure/in-memory-admin-console-repository.ts";
import {
  PostgresAdminConsoleRepository,
  createAdminConsoleRepositoryFromEnv,
} from "../../apps/api/src/modules/admin-console/infrastructure/postgres-admin-console-repository.ts";
import { hashAdminPassword } from "../../apps/api/src/modules/admin-console/infrastructure/password-hashing.ts";

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

test("Postgres admin console repository resolves user profiles and active sessions", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    [{ id: "admin-user-1", email: "admin@example.com", role: "admin" }],
    [{
      id: "session-1",
      admin_user_id: "admin-user-1",
      session_token_hash: "hash-1",
      expires_at: "2099-01-01T00:00:00.000Z",
      created_at: "2026-04-13T10:00:00.000Z",
      revoked_at: null,
    }],
  ];
  const repository = new PostgresAdminConsoleRepository(fakeQueryable as never);

  const profile = await repository.getUserProfile("admin-user-1");
  const session = await repository.getActiveAdminSession("admin-user-1", "hash-1", "2026-04-13T10:01:00.000Z");

  assert.equal(profile?.role, "admin");
  assert.equal(session?.adminUserId, "admin-user-1");
  assert.match(fakeQueryable.queries[0].sql, /from profiles/i);
  assert.match(fakeQueryable.queries[1].sql, /from admin_sessions/i);
});

test("Postgres admin console repository manages password state and role updates", async () => {
  const fakeQueryable = new FakeQueryable();
  const passwordHash = hashAdminPassword("123456");
  fakeQueryable.nextRowsQueue = [
    [{ id: 1, password_hash: passwordHash, requires_password_change: true }],
    [{ id: 1, password_hash: passwordHash, requires_password_change: true }],
    [],
    [{ id: "user-1", email: "user@example.com", role: "user" }],
    [],
  ];
  const repository = new PostgresAdminConsoleRepository(fakeQueryable as never);

  const passwordState = await repository.getAdminPasswordState();
  await repository.changeAdminPassword("123456", "new-password-123");
  const target = await repository.setUserRole("user@example.com", "admin");

  assert.equal(passwordState.requiresPasswordChange, true);
  assert.equal(target.role, "admin");
  assert.ok(fakeQueryable.queries.some((entry) => /update admin_auth/i.test(entry.sql)));
  assert.ok(fakeQueryable.queries.some((entry) => /update profiles/i.test(entry.sql)));
});

test("Postgres admin console repository creates and revokes admin sessions", async () => {
  const fakeQueryable = new FakeQueryable();
  const repository = new PostgresAdminConsoleRepository(fakeQueryable as never);

  await repository.createAdminSession({
    adminUserId: "admin-user-1",
    sessionTokenHash: "hash-1",
    createdAt: "2026-04-13T10:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  await repository.revokeAdminSessions("admin-user-1", "2026-04-13T10:01:00.000Z");

  assert.ok(fakeQueryable.queries.some((entry) => /insert into admin_sessions/i.test(entry.sql)));
  assert.ok(fakeQueryable.queries.some((entry) => /update admin_sessions/i.test(entry.sql)));
});

test("admin console repository factory uses postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const repository = createAdminConsoleRepositoryFromEnv({
    createPostgresRepository: () => ({ kind: "postgres" } as unknown as PostgresAdminConsoleRepository),
  });

  assert.deepEqual(repository, { kind: "postgres" });
});

test("admin console repository factory falls back to in-memory without postgres config", () => {
  delete process.env.DATABASE_URL;

  const repository = createAdminConsoleRepositoryFromEnv();

  assert.ok(repository instanceof InMemoryAdminConsoleRepository);
});
