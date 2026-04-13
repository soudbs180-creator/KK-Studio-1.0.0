import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type { CanvasLayoutRecordDto } from "../../packages/contracts/src/index.ts";
import {
  InMemoryWorkspaceLayoutRepository,
} from "../../apps/api/src/modules/workspace-canvas/infrastructure/in-memory-workspace-layout-repository.ts";
import {
  PostgresWorkspaceLayoutRepository,
  createWorkspaceLayoutRepositoryFromEnv,
} from "../../apps/api/src/modules/workspace-canvas/infrastructure/postgres-workspace-layout-repository.ts";

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

function buildLayout(): CanvasLayoutRecordDto[] {
  return [
    {
      id: "canvas-1",
      name: "Canvas 1",
      lastModified: 1700000000000,
    },
  ];
}

test("Postgres workspace layout repository upserts per-user layout payloads", async () => {
  const fakeQueryable = new FakeQueryable();
  const repository = new PostgresWorkspaceLayoutRepository(fakeQueryable as never);

  await repository.saveLayout("user-1", buildLayout());

  assert.equal(fakeQueryable.queries.length, 1);
  assert.match(fakeQueryable.queries[0].sql, /insert into workspace_layouts/i);
  assert.match(fakeQueryable.queries[0].sql, /on conflict \(user_id\) do update/i);
  assert.equal(fakeQueryable.queries[0].values[0], "user-1");
});

test("Postgres workspace layout repository restores stored layout rows", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRows = [
    {
      user_id: "user-1",
      layout_json: buildLayout(),
    },
  ];
  const repository = new PostgresWorkspaceLayoutRepository(fakeQueryable as never);

  const layout = await repository.getLayout("user-1");

  assert.deepEqual(layout, buildLayout());
  assert.match(fakeQueryable.queries[0].sql, /from workspace_layouts/i);
});

test("Postgres workspace cleanup removes cloud image metadata rows but preserves saved layout", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRows = [{ deleted_count: 2 }];
  const repository = new PostgresWorkspaceLayoutRepository(fakeQueryable as never);

  const result = await repository.cleanupCloudImages("user-1");

  assert.equal(result.deletedCount, 2);
  assert.equal(result.preservedLayout, true);
  assert.match(fakeQueryable.queries[0].sql, /delete from workspace_cloud_images/i);
});

test("workspace layout repository factory uses postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const repository = createWorkspaceLayoutRepositoryFromEnv({
    createPostgresRepository: () => ({ kind: "postgres" } as unknown as PostgresWorkspaceLayoutRepository),
  });

  assert.deepEqual(repository, { kind: "postgres" });
});

test("workspace layout repository factory falls back to in-memory without postgres config", () => {
  delete process.env.DATABASE_URL;

  const repository = createWorkspaceLayoutRepositoryFromEnv();

  assert.ok(repository instanceof InMemoryWorkspaceLayoutRepository);
});
