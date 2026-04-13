import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type { WorkflowDocumentDto } from "../../packages/contracts/src/index.ts";
import {
  InMemoryWorkflowRepository,
} from "../../apps/api/src/modules/workflow/infrastructure/in-memory-workflow-repository.ts";
import {
  PostgresWorkflowRepository,
  createWorkflowRepositoryFromEnv,
} from "../../apps/api/src/modules/workflow/infrastructure/postgres-workflow-repository.ts";

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

function buildWorkflow(): WorkflowDocumentDto {
  return {
    id: "workflow-1",
    workspaceId: "workspace-1",
    canvasId: "canvas-1",
    name: "Workflow One",
    status: "draft",
    version: 1,
    nodes: [
      {
        id: "node-1",
        nodeType: "prompt",
        position: { x: 0, y: 0 },
        config: { prompt: "hello" },
      },
    ],
    edges: [],
    createdAt: "2026-04-13T10:00:00.000Z",
    updatedAt: "2026-04-13T10:00:00.000Z",
  };
}

test("Postgres workflow repository upserts workflow documents by workspace and workflow id", async () => {
  const fakeQueryable = new FakeQueryable();
  const repository = new PostgresWorkflowRepository(fakeQueryable as never);

  await repository.save(buildWorkflow());

  assert.equal(fakeQueryable.queries.length, 1);
  assert.match(fakeQueryable.queries[0].sql, /insert into workflow_documents/i);
  assert.match(fakeQueryable.queries[0].sql, /on conflict \(workspace_id, workflow_id\) do update/i);
  assert.equal(fakeQueryable.queries[0].values[0], "workspace-1");
  assert.equal(fakeQueryable.queries[0].values[1], "workflow-1");
});

test("Postgres workflow repository maps stored workflow rows back into DTO shape", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRows = [
    {
      workspace_id: "workspace-1",
      workflow_id: "workflow-1",
      document_json: buildWorkflow(),
      updated_at: "2026-04-13T10:00:00.000Z",
    },
  ];
  const repository = new PostgresWorkflowRepository(fakeQueryable as never);

  const workflow = await repository.findById("workspace-1", "workflow-1");

  assert.ok(workflow);
  assert.equal(workflow?.workspaceId, "workspace-1");
  assert.equal(workflow?.id, "workflow-1");
  assert.equal(workflow?.nodes.length, 1);
  assert.match(fakeQueryable.queries[0].sql, /from workflow_documents/i);
});

test("Postgres workflow repository lists workflows by workspace", async () => {
  const fakeQueryable = new FakeQueryable();
  fakeQueryable.nextRows = [
    {
      workspace_id: "workspace-1",
      workflow_id: "workflow-1",
      document_json: buildWorkflow(),
      updated_at: "2026-04-13T10:00:00.000Z",
    },
  ];
  const repository = new PostgresWorkflowRepository(fakeQueryable as never);

  const workflows = await repository.listByWorkspace("workspace-1");

  assert.equal(workflows.length, 1);
  assert.equal(workflows[0].workspaceId, "workspace-1");
  assert.match(fakeQueryable.queries[0].sql, /where workspace_id = \$1/i);
});

test("workflow repository factory uses postgres when DATABASE_URL is configured", () => {
  process.env.DATABASE_URL = "postgres://kk:secret@127.0.0.1:5432/kkstudio";

  const repository = createWorkflowRepositoryFromEnv({
    createPostgresRepository: () => ({ kind: "postgres" } as unknown as PostgresWorkflowRepository),
  });

  assert.deepEqual(repository, { kind: "postgres" });
});

test("workflow repository factory falls back to in-memory without postgres config", () => {
  delete process.env.DATABASE_URL;

  const repository = createWorkflowRepositoryFromEnv();

  assert.ok(repository instanceof InMemoryWorkflowRepository);
});
