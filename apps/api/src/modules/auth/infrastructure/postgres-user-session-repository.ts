import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from '../../../lib/postgres.ts';
import type { BrowserSessionRecord, BrowserSessionRepository } from '../domain/browser-session.ts';

interface UserSessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
  rotated_from: string | null;
  revoked_at: string | null;
  created_at: string;
  user_agent: string | null;
  ip_address: string | null;
}

function mapRecord(row: UserSessionRow | undefined): BrowserSessionRecord | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    expiresAt: row.expires_at,
    ...(row.rotated_from ? { rotatedFrom: row.rotated_from } : {}),
    ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
    createdAt: row.created_at,
    ...(row.user_agent ? { userAgent: row.user_agent } : {}),
    ...(row.ip_address ? { ipAddress: row.ip_address } : {}),
  };
}

export class PostgresUserSessionRepository implements BrowserSessionRepository {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async insert(record: BrowserSessionRecord): Promise<void> {
    await this.queryable.query(
      `insert into user_sessions (
         id,
         user_id,
         refresh_token_hash,
         expires_at,
         rotated_from,
         revoked_at,
         created_at,
         last_seen_at,
         user_agent,
         ip_address
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $7, $8, $9
       )`,
      [
        record.id,
        record.userId,
        record.refreshTokenHash,
        record.expiresAt,
        record.rotatedFrom || null,
        record.revokedAt || null,
        record.createdAt,
        record.userAgent || null,
        record.ipAddress || null,
      ],
    );
  }

  async findActiveByRefreshTokenHash(
    refreshTokenHash: string,
    nowIso: string,
  ): Promise<BrowserSessionRecord | undefined> {
    const result = await this.queryable.query(
      `select id, user_id, refresh_token_hash, expires_at, rotated_from, revoked_at, created_at, user_agent, ip_address
         from user_sessions
        where refresh_token_hash = $1
          and revoked_at is null
          and expires_at > $2
        limit 1`,
      [refreshTokenHash, nowIso],
    );

    return mapRecord(result.rows[0] as UserSessionRow | undefined);
  }

  async revokeSession(id: string, revokedAt: string): Promise<void> {
    await this.queryable.query(
      `update user_sessions
          set revoked_at = $2
        where id = $1
          and revoked_at is null`,
      [id, revokedAt],
    );
  }

  async replaceRotatedSession(
    currentId: string,
    nextRecord: BrowserSessionRecord,
    revokedAt: string,
  ): Promise<void> {
    await this.revokeSession(currentId, revokedAt);
    await this.insert(nextRecord);
  }
}

export function createUserSessionRepositoryFromEnv(
  createPostgresRepository?: () => BrowserSessionRepository,
): BrowserSessionRepository | null {
  if (!hasPostgresConfig()) {
    return null;
  }

  if (createPostgresRepository) {
    return createPostgresRepository();
  }

  return new PostgresUserSessionRepository(getSharedPostgresPool());
}
