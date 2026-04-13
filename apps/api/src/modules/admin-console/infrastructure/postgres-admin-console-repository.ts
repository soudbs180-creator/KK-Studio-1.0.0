import type { PostgresQueryable } from "../../../lib/postgres.ts";
import { getSharedPostgresPool, hasPostgresConfig } from "../../../lib/postgres.ts";
import {
  AdminConsolePasswordInvalidError,
  AdminConsoleTargetNotFoundError,
  InMemoryAdminConsoleRepository,
  type AdminConsoleRepository,
  type AdminPasswordState,
  type AdminProfileRecord,
  type AdminRole,
  type AdminSessionRecord,
  type CreateAdminSessionInput,
  type ResolvedRoleChangeTarget,
} from "./in-memory-admin-console-repository.ts";
import {
  hashAdminPassword,
  isLegacyMd5PasswordHash,
  verifyAdminPasswordHash,
} from "./password-hashing.ts";

interface ProfileRow {
  id: string;
  email: string | null;
  role: string | null;
}

interface AdminAuthRow {
  id: number;
  password_hash: string;
  requires_password_change: boolean | null;
}

interface AdminSessionRow {
  id: string;
  admin_user_id: string;
  session_token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeRole(role: string | null | undefined): AdminRole {
  return role === "admin" ? "admin" : "user";
}

export class PostgresAdminConsoleRepository implements AdminConsoleRepository {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async getUserProfile(userId: string): Promise<AdminProfileRecord | undefined> {
    const result = await this.queryable.query(
      `select id, email, role
         from profiles
        where id = $1
        limit 1`,
      [userId],
    );
    const row = result.rows[0] as ProfileRow | undefined;
    return row
      ? {
        id: row.id,
        email: row.email || undefined,
        role: normalizeRole(row.role),
      }
      : undefined;
  }

  async findUserProfileByIdentity(identity: string): Promise<AdminProfileRecord | undefined> {
    const target = await this.findTargetProfile(identity);
    return target
      ? {
        id: target.id,
        email: target.email || undefined,
        role: normalizeRole(target.role),
      }
      : undefined;
  }

  async verifyAdminPassword(password: string): Promise<boolean> {
    const adminAuth = await this.getAdminAuthRow();
    return verifyAdminPasswordHash(password, adminAuth.password_hash);
  }

  async getAdminPasswordState(): Promise<AdminPasswordState> {
    const adminAuth = await this.getAdminAuthRow();
    return {
      requiresPasswordChange:
        adminAuth.requires_password_change !== false
        || isLegacyMd5PasswordHash(adminAuth.password_hash),
    };
  }

  async getActiveAdminSession(
    adminUserId: string,
    sessionTokenHash: string,
    now: string,
  ): Promise<AdminSessionRecord | undefined> {
    const result = await this.queryable.query(
      `select id, admin_user_id, session_token_hash, expires_at, created_at, revoked_at
         from admin_sessions
        where admin_user_id = $1
          and session_token_hash = $2
          and revoked_at is null
          and expires_at > $3
        limit 1`,
      [adminUserId, sessionTokenHash, now],
    );
    const row = result.rows[0] as AdminSessionRow | undefined;
    return row
      ? {
        id: row.id,
        adminUserId: row.admin_user_id,
        sessionTokenHash: row.session_token_hash,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        revokedAt: row.revoked_at || undefined,
      }
      : undefined;
  }

  async createAdminSession(input: CreateAdminSessionInput): Promise<void> {
    await this.queryable.query(
      `insert into admin_sessions (
         admin_user_id,
         session_token_hash,
         expires_at,
         created_at
       ) values (
         $1, $2, $3, $4
       )`,
      [input.adminUserId, input.sessionTokenHash, input.expiresAt, input.createdAt],
    );
  }

  async revokeAdminSessions(adminUserId: string, revokedAt: string): Promise<void> {
    await this.queryable.query(
      `update admin_sessions
          set revoked_at = $2
        where admin_user_id = $1
          and revoked_at is null`,
      [adminUserId, revokedAt],
    );
  }

  async changeAdminPassword(oldPassword: string, newPassword: string): Promise<void> {
    const adminAuth = await this.getAdminAuthRow();
    if (!verifyAdminPasswordHash(oldPassword, adminAuth.password_hash)) {
      throw new AdminConsolePasswordInvalidError("Incorrect old password.");
    }

    await this.queryable.query(
      `update admin_auth
          set password_hash = $2,
              requires_password_change = false,
              updated_at = $3
        where id = $1`,
      [adminAuth.id, hashAdminPassword(newPassword), new Date().toISOString()],
    );
  }

  async setUserRole(identity: string, role: AdminRole): Promise<ResolvedRoleChangeTarget> {
    const target = await this.findTargetProfile(identity);
    if (!target) {
      throw new AdminConsoleTargetNotFoundError("The target profile could not be found.");
    }

    await this.queryable.query(
      `update profiles
          set role = $2,
              updated_at = $3
        where id = $1`,
      [target.id, role, new Date().toISOString()],
    );

    return {
      subjectId: target.id,
      identity: String(identity || "").trim(),
      role,
      subjectEmail: target.email || undefined,
    };
  }

  private async getAdminAuthRow(): Promise<AdminAuthRow> {
    const result = await this.queryable.query(
      `select id, password_hash, requires_password_change
         from admin_auth
        order by id asc
        limit 1`,
    );
    const row = result.rows[0] as AdminAuthRow | undefined;
    if (!row) {
      throw new Error("The admin_auth table is not initialized.");
    }
    return row;
  }

  private async findTargetProfile(identity: string): Promise<ProfileRow | undefined> {
    const normalizedIdentity = String(identity || "").trim();
    if (!normalizedIdentity) {
      return undefined;
    }

    const result = isUuid(normalizedIdentity)
      ? await this.queryable.query(
        `select id, email, role
           from profiles
          where id = $1
          limit 1`,
        [normalizedIdentity],
      )
      : await this.queryable.query(
        `select id, email, role
           from profiles
          where lower(email) = lower($1)
          limit 1`,
        [normalizedIdentity],
      );

    return result.rows[0] as ProfileRow | undefined;
  }
}

export function createAdminConsoleRepositoryFromEnv(options: {
  createPostgresRepository?: () => AdminConsoleRepository;
} = {}): AdminConsoleRepository {
  if (!hasPostgresConfig()) {
    return new InMemoryAdminConsoleRepository();
  }

  if (options.createPostgresRepository) {
    return options.createPostgresRepository();
  }

  return new PostgresAdminConsoleRepository(getSharedPostgresPool());
}
