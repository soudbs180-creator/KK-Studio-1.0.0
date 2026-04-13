import type { WorkflowDocumentDto } from "../../../../../../packages/contracts/src/index.ts";
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import { InMemoryWorkflowRepository, type WorkflowRepository } from "./in-memory-workflow-repository.ts";

interface WorkflowDocumentRow {
  workspace_id?: string | null;
  workflow_id?: string | null;
  document_json?: WorkflowDocumentDto | null;
  updated_at?: string | null;
}

function cloneWorkflowDocument(value: WorkflowDocumentDto): WorkflowDocumentDto {
  return {
    ...value,
    nodes: value.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      config: { ...node.config },
      ...(Array.isArray(node.tags) ? { tags: [...node.tags] } : {}),
    })),
    edges: value.edges.map((edge) => ({ ...edge })),
  };
}

function normalizeWorkflowDocument(row: WorkflowDocumentRow | undefined): WorkflowDocumentDto | null {
  const document = row?.document_json;
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return null;
  }

  return cloneWorkflowDocument(document);
}

export class PostgresWorkflowRepository implements WorkflowRepository {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async findById(workspaceId: string, workflowId: string): Promise<WorkflowDocumentDto | null> {
    const result = await this.queryable.query(
      `select workspace_id, workflow_id, document_json, updated_at
         from workflow_documents
        where workspace_id = $1
          and workflow_id = $2
        limit 1`,
      [workspaceId, workflowId],
    );

    return normalizeWorkflowDocument(result.rows[0] as WorkflowDocumentRow | undefined);
  }

  async listByWorkspace(workspaceId: string): Promise<WorkflowDocumentDto[]> {
    const result = await this.queryable.query(
      `select workspace_id, workflow_id, document_json, updated_at
         from workflow_documents
        where workspace_id = $1
        order by updated_at desc nulls last, workflow_id asc`,
      [workspaceId],
    );

    return (result.rows as WorkflowDocumentRow[])
      .map((row) => normalizeWorkflowDocument(row))
      .filter((value): value is WorkflowDocumentDto => Boolean(value));
  }

  async save(document: WorkflowDocumentDto): Promise<void> {
    const normalizedDocument = cloneWorkflowDocument(document);
    await this.queryable.query(
      `insert into workflow_documents (
         workspace_id,
         workflow_id,
         document_json,
         updated_at
       ) values (
         $1, $2, $3::jsonb, $4
       )
       on conflict (workspace_id, workflow_id) do update
         set document_json = excluded.document_json,
             updated_at = excluded.updated_at`,
      [
        normalizedDocument.workspaceId,
        normalizedDocument.id,
        JSON.stringify(normalizedDocument),
        normalizedDocument.updatedAt,
      ],
    );
  }
}

export function createWorkflowRepositoryFromEnv(options: {
  createPostgresRepository?: () => WorkflowRepository;
} = {}): WorkflowRepository {
  if (!hasPostgresConfig()) {
    return new InMemoryWorkflowRepository();
  }

  if (options.createPostgresRepository) {
    return options.createPostgresRepository();
  }

  return new PostgresWorkflowRepository(getSharedPostgresPool());
}
