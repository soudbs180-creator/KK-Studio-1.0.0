import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type { GenerationTaskDto } from "../../packages/contracts/src/index.ts";
import { GenerationTaskStatus } from "../../packages/contracts/src/index.ts";
import {
  PostgresGenerationTaskRepository,
  createGenerationTaskRepositoryFromEnv,
} from "../../apps/api/src/modules/generation/infrastructure/postgres-generation-task-repository.ts";
import { InMemoryGenerationTaskRepository } from "../../apps/api/src/modules/generation/infrastructure/in-memory-generation-task-repository.ts";

interface RecordedQuery {
  sql: string;
  values: unknown[];
}

class FakeQueryable {
  readonly queries: RecordedQuery[] = [];
  nextRows: unknown[] = [];

  async query(sql: string, values: unknown[]) {
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

function buildTask(): GenerationTaskDto {
  return {
    id: "task-1",
    workspaceId: "workspace-1",
    workflowId: "workflow-1",
    requesterId: "user-1",
    requestId: "request-1",
    attemptId: "attempt-1",
    modelCode: "gemini-2.5-flash",
    taskType: "image",
    status: GenerationTaskStatus.Queued,
    prompt: "Draw a skyline",
    references: ["ref-1"],
    idempotencyKey: "idem-1",
    createdAt: "2026-04-13T10:00:00.000Z",
    results: [],
  };
}

test("Postgres generation task repository saves tasks through an upsert query", async () => {
  const fakeQueryable = new FakeQueryable();
  const repository = new PostgresGenerationTaskRepository(fakeQueryable as never);

  await repository.save(buildTask());

  assert.equal(fakeQueryable.queries.length, 1);
  assert.match(fakeQueryable.queries[0].sql, /insert into generation_tasks/i);
  assert.match(fakeQueryable.queries[0].sql, /on conflict \(id\) do update/i);
  assert.equal(fakeQueryable.queries[0].values[0], "task-1");
  assert.ok(fakeQueryable.queries[0].values.includes(GenerationTaskStatus.Queued));
});

test("Postgres generation task repository maps stored rows back into DTO shape", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRows = [
    {
      id: "task-1",
      workspace_id: "workspace-1",
      workflow_id: "workflow-1",
      requester_id: "user-1",
      request_id: "request-1",
      attempt_id: "attempt-1",
      model_code: "gemini-2.5-flash",
      task_type: "image",
      status: GenerationTaskStatus.Queued,
      prompt: "Draw a skyline",
      references_json: ["ref-1"],
      idempotency_key: "idem-1",
      created_at: "2026-04-13T10:00:00.000Z",
      started_at: null,
      completed_at: null,
      error_code: null,
      error_message: null,
      results_json: [],
      billing_status: null,
      ledger_transaction_id: null,
      refund_transaction_id: null,
      credit_amount: null,
      cost_usd: null,
      provider_id: null,
      protocol_family: null,
      usage_snapshot_json: null,
    },
  ];
  const repository = new PostgresGenerationTaskRepository(fakeQueryable as never);

  const task = await repository.findById("task-1");

  assert.ok(task);
  assert.equal(task?.id, "task-1");
  assert.equal(task?.workspaceId, "workspace-1");
  assert.equal(task?.workflowId, "workflow-1");
  assert.equal(task?.requesterId, "user-1");
  assert.equal(task?.requestId, "request-1");
  assert.equal(task?.attemptId, "attempt-1");
  assert.equal(task?.modelCode, "gemini-2.5-flash");
  assert.equal(task?.taskType, "image");
  assert.equal(task?.status, GenerationTaskStatus.Queued);
  assert.equal(task?.prompt, "Draw a skyline");
  assert.deepEqual(task?.references, ["ref-1"]);
  assert.equal(task?.idempotencyKey, "idem-1");
  assert.equal(task?.createdAt, "2026-04-13T10:00:00.000Z");
  assert.deepEqual(task?.results, []);
  assert.equal(task?.startedAt, undefined);
  assert.equal(task?.completedAt, undefined);
  assert.equal(task?.errorCode, undefined);
  assert.equal(task?.errorMessage, undefined);
  assert.equal(task?.billingStatus, undefined);
  assert.match(fakeQueryable.queries[0].sql, /where id = \$1/i);
});

test("generation repository factory uses postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const repository = createGenerationTaskRepositoryFromEnv({
    createPostgresRepository: () => ({ kind: "postgres" } as unknown as PostgresGenerationTaskRepository),
  });

  assert.deepEqual(repository, { kind: "postgres" });
});

test("generation repository factory falls back to in-memory without postgres config", () => {
  delete process.env.DATABASE_URL;

  const repository = createGenerationTaskRepositoryFromEnv();

  assert.ok(repository instanceof InMemoryGenerationTaskRepository);
});
