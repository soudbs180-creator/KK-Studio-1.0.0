import type {
  CanvasLayoutRecordDto,
  CleanupCloudImagesResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import { InMemoryWorkspaceLayoutRepository, type WorkspaceLayoutRepository } from "./in-memory-workspace-layout-repository.ts";

interface WorkspaceLayoutRow {
  user_id: string;
  layout_json: CanvasLayoutRecordDto[] | null;
}

interface DeletedCountRow {
  deleted_count?: number | string | null;
}

function normalizeCanvasLayoutRecords(raw: unknown): CanvasLayoutRecordDto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is CanvasLayoutRecordDto => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ ...item }));
}

function toDeletedCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export class PostgresWorkspaceLayoutRepository implements WorkspaceLayoutRepository {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async getLayout(userId: string): Promise<CanvasLayoutRecordDto[]> {
    const result = await this.queryable.query(
      `select user_id, layout_json
         from workspace_layouts
        where user_id = $1
        limit 1`,
      [userId],
    );
    const row = result.rows[0] as WorkspaceLayoutRow | undefined;
    return normalizeCanvasLayoutRecords(row?.layout_json);
  }

  async saveLayout(userId: string, canvases: CanvasLayoutRecordDto[]): Promise<CanvasLayoutRecordDto[]> {
    const nextCanvases = canvases.map((canvas) => ({ ...canvas }));
    await this.queryable.query(
      `insert into workspace_layouts (
         user_id,
         layout_json,
         updated_at
       ) values (
         $1, $2::jsonb, now()
       )
       on conflict (user_id) do update
         set layout_json = excluded.layout_json,
             updated_at = now()`,
      [userId, JSON.stringify(nextCanvases)],
    );

    return nextCanvases;
  }

  async cleanupCloudImages(userId: string): Promise<CleanupCloudImagesResponseDto> {
    const result = await this.queryable.query(
      `with deleted as (
         delete from workspace_cloud_images
          where user_id = $1
         returning 1
       )
       select count(*)::int as deleted_count from deleted`,
      [userId],
    );
    const row = result.rows[0] as DeletedCountRow | undefined;

    return {
      deletedCount: toDeletedCount(row?.deleted_count),
      preservedLayout: true,
    };
  }
}

export function createWorkspaceLayoutRepositoryFromEnv(options: {
  createPostgresRepository?: () => WorkspaceLayoutRepository;
} = {}): WorkspaceLayoutRepository {
  if (!hasPostgresConfig()) {
    return new InMemoryWorkspaceLayoutRepository();
  }

  if (options.createPostgresRepository) {
    return options.createPostgresRepository();
  }

  return new PostgresWorkspaceLayoutRepository(getSharedPostgresPool());
}
