import type { GenerationTaskDto } from "../../../../../../packages/contracts/src/index.ts";
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import { InMemoryGenerationTaskRepository, type GenerationTaskRepository } from "./in-memory-generation-task-repository.ts";

function toNullableJson(value: unknown): unknown[] | Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
}

function mapRowToGenerationTask(row: Record<string, unknown>): GenerationTaskDto {
  return {
    id: String(row.id || ""),
    workspaceId: String(row.workspace_id || ""),
    workflowId: String(row.workflow_id || ""),
    requesterId: String(row.requester_id || ""),
    ...(row.request_id == null ? {} : { requestId: String(row.request_id) }),
    ...(row.attempt_id == null ? {} : { attemptId: String(row.attempt_id) }),
    modelCode: String(row.model_code || ""),
    taskType: String(row.task_type || "image") as GenerationTaskDto["taskType"],
    status: String(row.status || "queued") as GenerationTaskDto["status"],
    prompt: String(row.prompt || ""),
    references: Array.isArray(row.references_json) ? row.references_json.map((item) => String(item)) : [],
    idempotencyKey: String(row.idempotency_key || ""),
    createdAt: String(row.created_at || ""),
    ...(row.started_at == null ? {} : { startedAt: String(row.started_at) }),
    ...(row.completed_at == null ? {} : { completedAt: String(row.completed_at) }),
    ...(row.error_code == null ? {} : { errorCode: String(row.error_code) }),
    ...(row.error_message == null ? {} : { errorMessage: String(row.error_message) }),
    results: Array.isArray(row.results_json) ? row.results_json as GenerationTaskDto["results"] : [],
    ...(row.billing_status == null ? {} : {
      billingStatus: String(row.billing_status) as GenerationTaskDto["billingStatus"],
    }),
    ...(row.ledger_transaction_id == null ? {} : {
      ledgerTransactionId: String(row.ledger_transaction_id),
    }),
    ...(row.refund_transaction_id == null ? {} : {
      refundTransactionId: String(row.refund_transaction_id),
    }),
    ...(typeof row.credit_amount === "number" ? { creditAmount: row.credit_amount } : {}),
    ...(typeof row.cost_usd === "number" ? { costUsd: row.cost_usd } : {}),
    ...(row.provider_id == null ? {} : { providerId: String(row.provider_id) }),
    ...(row.protocol_family == null ? {} : {
      protocolFamily: String(row.protocol_family) as GenerationTaskDto["protocolFamily"],
    }),
    ...(row.usage_snapshot_json && typeof row.usage_snapshot_json === "object"
      ? { usageSnapshot: row.usage_snapshot_json as GenerationTaskDto["usageSnapshot"] }
      : {}),
  };
}

export class PostgresGenerationTaskRepository implements GenerationTaskRepository {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async findById(taskId: string): Promise<GenerationTaskDto | null> {
    const result = await this.queryable.query(
      `select *
         from generation_tasks
        where id = $1
        limit 1`,
      [taskId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRowToGenerationTask(row) : null;
  }

  async findByIdempotencyKey(requesterId: string, idempotencyKey: string): Promise<GenerationTaskDto | null> {
    const result = await this.queryable.query(
      `select *
         from generation_tasks
        where requester_id = $1
          and idempotency_key = $2
        limit 1`,
      [requesterId, idempotencyKey],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRowToGenerationTask(row) : null;
  }

  async save(task: GenerationTaskDto): Promise<void> {
    await this.queryable.query(
      `insert into generation_tasks (
         id,
         workspace_id,
         workflow_id,
         requester_id,
         request_id,
         attempt_id,
         model_code,
         task_type,
         status,
         prompt,
         references_json,
         idempotency_key,
         created_at,
         started_at,
         completed_at,
         error_code,
         error_message,
         results_json,
         billing_status,
         ledger_transaction_id,
         refund_transaction_id,
         credit_amount,
         cost_usd,
         provider_id,
         protocol_family,
         usage_snapshot_json
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20, $21, $22, $23, $24, $25, $26::jsonb
       )
       on conflict (id) do update
         set workspace_id = excluded.workspace_id,
             workflow_id = excluded.workflow_id,
             requester_id = excluded.requester_id,
             request_id = excluded.request_id,
             attempt_id = excluded.attempt_id,
             model_code = excluded.model_code,
             task_type = excluded.task_type,
             status = excluded.status,
             prompt = excluded.prompt,
             references_json = excluded.references_json,
             idempotency_key = excluded.idempotency_key,
             created_at = excluded.created_at,
             started_at = excluded.started_at,
             completed_at = excluded.completed_at,
             error_code = excluded.error_code,
             error_message = excluded.error_message,
             results_json = excluded.results_json,
             billing_status = excluded.billing_status,
             ledger_transaction_id = excluded.ledger_transaction_id,
             refund_transaction_id = excluded.refund_transaction_id,
             credit_amount = excluded.credit_amount,
             cost_usd = excluded.cost_usd,
             provider_id = excluded.provider_id,
             protocol_family = excluded.protocol_family,
             usage_snapshot_json = excluded.usage_snapshot_json`,
      [
        task.id,
        task.workspaceId,
        task.workflowId,
        task.requesterId,
        task.requestId ?? null,
        task.attemptId ?? null,
        task.modelCode,
        task.taskType,
        task.status,
        task.prompt,
        JSON.stringify(task.references || []),
        task.idempotencyKey,
        task.createdAt,
        task.startedAt ?? null,
        task.completedAt ?? null,
        task.errorCode ?? null,
        task.errorMessage ?? null,
        JSON.stringify(task.results || []),
        task.billingStatus ?? null,
        task.ledgerTransactionId ?? null,
        task.refundTransactionId ?? null,
        task.creditAmount ?? null,
        task.costUsd ?? null,
        task.providerId ?? null,
        task.protocolFamily ?? null,
        JSON.stringify(toNullableJson(task.usageSnapshot)),
      ],
    );
  }
}

export function createGenerationTaskRepositoryFromEnv(options: {
  createPostgresRepository?: () => GenerationTaskRepository;
} = {}): GenerationTaskRepository {
  if (!hasPostgresConfig()) {
    return new InMemoryGenerationTaskRepository();
  }

  if (options.createPostgresRepository) {
    return options.createPostgresRepository();
  }

  return new PostgresGenerationTaskRepository(getSharedPostgresPool());
}
