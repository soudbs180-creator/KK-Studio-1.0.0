import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type {
  ReplaceKeyManagerCloudStateRequestDto,
  UserApiEntryDto,
} from "../../packages/contracts/src/index.ts";
import {
  createAuthDataRepositoryFromEnv,
  PostgresAuthDataRepository,
} from "../../apps/api/src/modules/auth/infrastructure/postgres-auth-data-repository.ts";

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

function buildEntry(): UserApiEntryDto {
  return {
    id: "entry-1",
    key: "sk-entry-secret",
    name: "Google Key",
    provider: "Google",
    type: "official",
    format: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    supportedModels: ["gemini-2.5-flash"],
    disabled: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    status: "unknown",
    failCount: 0,
    successCount: 0,
    totalCost: 0,
    budgetLimit: -1,
    tokenLimit: -1,
    usedTokens: 0,
    lastUsed: null,
    lastError: null,
  };
}

test("Postgres auth data repository saves and reads encrypted user api payloads", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    [],
    [],
  ];
  const repository = new PostgresAuthDataRepository({
    queryable: fakeQueryable as never,
    storageEncryptionKey: "unit-test-user-api-secret",
  });

  await repository.replaceUserApiEntries("user-1", "user@example.com", [buildEntry()]);

  const profileUpserts = fakeQueryable.queries.filter((entry) => /insert into profiles/i.test(entry.sql));
  const profileUpsert = profileUpserts[profileUpserts.length - 1];
  fakeQueryable.nextRowsQueue = [[
    {
      id: "user-1",
      email: "user@example.com",
      user_apis: profileUpsert?.values[2] ? JSON.parse(String(profileUpsert.values[2])) : [],
    },
  ]];

  const entries = await repository.listUserApiEntries("user-1", "user@example.com");

  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "entry-1");
  assert.ok(fakeQueryable.queries.some((entry) => /insert into profiles/i.test(entry.sql)));
});

test("Postgres auth data repository replaces key manager cloud state", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRowsQueue = [
    [],
    [],
  ];
  const repository = new PostgresAuthDataRepository({
    queryable: fakeQueryable as never,
    storageEncryptionKey: "unit-test-user-api-secret",
  });

  const state: ReplaceKeyManagerCloudStateRequestDto = {
    version: 3,
    slots: [{ id: "slot-1", key: "slot-secret" }],
    providers: [{ id: "provider-1", apiKey: "provider-secret" }],
  };

  const result = await repository.replaceKeyManagerCloudState("user-1", "user@example.com", state);

  assert.equal(result.version, 3);
  assert.equal(result.slots.length, 1);
  assert.equal(result.providers.length, 1);
});

test("Postgres auth data repository creates temp users in postgres tables", async () => {
  const fakeQueryable = new FakeQueryable();
  const repository = new PostgresAuthDataRepository({
    queryable: fakeQueryable as never,
    storageEncryptionKey: "unit-test-user-api-secret",
  });

  const tempUser = await repository.createTempUser("unit-test");

  assert.equal(tempUser.isTempUser, true);
  assert.ok(fakeQueryable.queries.some((entry) => /insert into temp_users/i.test(entry.sql)));
});

test("auth data repository factory uses postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const repository = createAuthDataRepositoryFromEnv({
    storageEncryptionKey: "unit-test-user-api-secret",
    createPostgresRepository: () => ({ kind: "postgres" } as unknown as PostgresAuthDataRepository),
  });

  assert.deepEqual(repository, { kind: "postgres" });
});
