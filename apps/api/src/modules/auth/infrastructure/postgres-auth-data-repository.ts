import { randomUUID } from "node:crypto";

import type {
  KeyManagerCloudStateDto,
  ReplaceKeyManagerCloudStateRequestDto,
  SecureProxyUserRouteConfigDto,
  TempUserSessionDto,
  UserApiEntryDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import type { AuthDataRepository } from "./in-memory-auth-data-repository.ts";
import {
  mergeUserApisPayload,
  resolveSecureProxyUserRouteConfig,
  sanitizeKeyManagerCloudStateForClient,
  sanitizeUserApiEntriesForClient,
} from "./user-api-payload.ts";
import {
  decryptUserApisPayload,
  encryptUserApisPayload,
} from "./user-api-secret-crypto.ts";

interface ProfileUserApisRow {
  id: string;
  email: string | null;
  user_apis: unknown;
}

interface TempUserRow {
  id: string;
  created_at: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  metadata_json: {
    email?: string;
    nickname?: string;
  } | null;
}

export interface PostgresAuthDataRepositoryOptions {
  queryable: PostgresQueryable;
  storageEncryptionKey?: string;
}

const tempUserExpiryMs = 24 * 60 * 60 * 1000;

export class PostgresAuthDataRepository implements AuthDataRepository {
  private readonly queryable: PostgresQueryable;
  private readonly storageEncryptionKey?: string;

  constructor(options: PostgresAuthDataRepositoryOptions) {
    this.queryable = options.queryable;
    this.storageEncryptionKey = options.storageEncryptionKey?.trim() || undefined;
  }

  async listUserApiEntries(userId: string, email?: string): Promise<UserApiEntryDto[]> {
    const profile = await this.getOrCreateProfile(userId, email);
    return this.extractEntries(this.decryptPayload(profile?.user_apis));
  }

  async replaceUserApiEntries(
    userId: string,
    email: string | undefined,
    entries: UserApiEntryDto[],
  ): Promise<UserApiEntryDto[]> {
    this.assertWritableEncryptionConfigured();
    const existing = await this.getOrCreateProfile(userId, email);
    const mergedPayload = mergeUserApisPayload(this.decryptPayload(existing?.user_apis), {
      entries,
    });
    await this.saveProfile(userId, email || existing?.email || undefined, mergedPayload);
    return this.extractEntries(mergedPayload);
  }

  async getKeyManagerCloudState(userId: string, email?: string): Promise<KeyManagerCloudStateDto> {
    const profile = await this.getOrCreateProfile(userId, email);
    return this.extractKeyManagerState(this.decryptPayload(profile?.user_apis));
  }

  async getUserApisPayload(userId: string, email?: string): Promise<unknown> {
    const profile = await this.getOrCreateProfile(userId, email);
    return this.decryptPayload(profile?.user_apis);
  }

  async replaceUserApisPayload(
    userId: string,
    email: string | undefined,
    payload: unknown,
  ): Promise<void> {
    this.assertWritableEncryptionConfigured();
    const existing = await this.getOrCreateProfile(userId, email);
    const mergedPayload = mergeUserApisPayload(this.decryptPayload(existing?.user_apis), payload as {
      version?: number;
      slots?: unknown[];
      providers?: unknown[];
      entries?: unknown[];
    });
    await this.saveProfile(userId, email || existing?.email || undefined, mergedPayload);
  }

  async resolveSecureProxyUserRouteConfig(
    userId: string,
    email: string | undefined,
    routeId: string,
  ): Promise<SecureProxyUserRouteConfigDto | null> {
    const profile = await this.getOrCreateProfile(userId, email);
    return resolveSecureProxyUserRouteConfig(this.decryptPayload(profile?.user_apis), routeId);
  }

  async replaceKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    state: ReplaceKeyManagerCloudStateRequestDto,
  ): Promise<KeyManagerCloudStateDto> {
    this.assertWritableEncryptionConfigured();
    const existing = await this.getOrCreateProfile(userId, email);
    const mergedPayload = mergeUserApisPayload(this.decryptPayload(existing?.user_apis), {
      version: state.version,
      slots: state.slots,
      providers: state.providers,
    });
    await this.saveProfile(userId, email || existing?.email || undefined, mergedPayload);
    return this.extractKeyManagerState(mergedPayload);
  }

  async getTempUserSession(userId: string): Promise<TempUserSessionDto | null> {
    const result = await this.queryable.query(
      `select id, created_at, expires_at, is_active, metadata_json
         from temp_users
        where id = $1
          and is_active = true
          and expires_at > $2
        limit 1`,
      [userId, new Date().toISOString()],
    );
    const row = result.rows[0] as TempUserRow | undefined;
    if (!row) {
      return null;
    }

    const createdAt = String(row.created_at || new Date().toISOString());
    const expiresAt = String(row.expires_at || "");
    if (!expiresAt) {
      return null;
    }

    return {
      userId: row.id,
      email: String(row.metadata_json?.email || `${row.id}@temp.local`),
      nickname: String(row.metadata_json?.nickname || `Guest_${row.id.replace(/-/g, "").slice(0, 8)}`),
      createdAt,
      expiresAt,
      isTempUser: true,
    };
  }

  async createTempUser(userAgent?: string): Promise<TempUserSessionDto> {
    const userId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tempUserExpiryMs);
    const email = `${userId}@temp.local`;
    const nickname = `Guest_${userId.replace(/-/g, "").slice(0, 8)}`;

    await this.queryable.query(
      `delete from temp_users
        where expires_at < $1`,
      [now.toISOString()],
    );

    await this.queryable.query(
      `insert into temp_users (
         id,
         created_at,
         expires_at,
         is_active,
         metadata_json
       ) values (
         $1, $2, $3, $4, $5::jsonb
       )`,
      [
        userId,
        now.toISOString(),
        expiresAt.toISOString(),
        true,
        JSON.stringify({
          email,
          nickname,
          lastSeenAt: now.toISOString(),
          userAgent: userAgent || "unknown",
        }),
      ],
    );

    return {
      userId,
      email,
      nickname,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isTempUser: true,
    };
  }

  private async getOrCreateProfile(userId: string, email?: string): Promise<ProfileUserApisRow | undefined> {
    const result = await this.queryable.query(
      `select id, email, user_apis
         from profiles
        where id = $1
        limit 1`,
      [userId],
    );
    const existing = result.rows[0] as ProfileUserApisRow | undefined;
    if (existing) {
      return existing;
    }

    await this.queryable.query(
      `insert into profiles (
         id,
         email,
         user_apis,
         updated_at
       ) values (
         $1, $2, $3::jsonb, $4
       )
       on conflict (id) do update
         set email = coalesce(excluded.email, profiles.email),
             user_apis = coalesce(profiles.user_apis, excluded.user_apis),
             updated_at = excluded.updated_at`,
      [userId, email || null, JSON.stringify([]), new Date().toISOString()],
    );

    return {
      id: userId,
      email: email || null,
      user_apis: [],
    };
  }

  private async saveProfile(userId: string, email: string | undefined, payload: unknown): Promise<void> {
    const encryptedPayload = this.encryptPayload(payload);
    await this.queryable.query(
      `insert into profiles (
         id,
         email,
         user_apis,
         updated_at
       ) values (
         $1, $2, $3::jsonb, $4
       )
       on conflict (id) do update
         set email = coalesce(excluded.email, profiles.email),
             user_apis = excluded.user_apis,
             updated_at = excluded.updated_at`,
      [userId, email || null, JSON.stringify(encryptedPayload), new Date().toISOString()],
    );
  }

  private extractEntries(raw: unknown): UserApiEntryDto[] {
    const entries = sanitizeUserApiEntriesForClient(raw);
    return Array.isArray(entries)
      ? entries.map((entry) => entry as unknown as UserApiEntryDto)
      : [];
  }

  private extractKeyManagerState(raw: unknown): KeyManagerCloudStateDto {
    const payload = sanitizeKeyManagerCloudStateForClient(raw);
    return {
      version: payload.version,
      slots: payload.slots.map((slot) => ({ ...slot })),
      providers: payload.providers.map((provider) => ({ ...provider })),
      entries: this.extractEntries(payload.entries),
    };
  }

  private encryptPayload(raw: unknown): unknown {
    if (!this.storageEncryptionKey) {
      throw new Error("USER_API_ENCRYPTION_SECRET is required before writing user API data.");
    }
    return encryptUserApisPayload(raw, this.storageEncryptionKey);
  }

  private decryptPayload(raw: unknown): unknown {
    if (!this.storageEncryptionKey) {
      return raw;
    }
    return decryptUserApisPayload(raw, this.storageEncryptionKey);
  }

  private assertWritableEncryptionConfigured(): void {
    if (!this.storageEncryptionKey) {
      throw new Error("USER_API_ENCRYPTION_SECRET is required before updating user API data.");
    }
  }
}

export function createAuthDataRepositoryFromEnv(options: {
  storageEncryptionKey?: string;
  createPostgresRepository?: () => AuthDataRepository;
} = {}): AuthDataRepository | null {
  if (!hasPostgresConfig()) {
    return null;
  }

  if (options.createPostgresRepository) {
    return options.createPostgresRepository();
  }

  return new PostgresAuthDataRepository({
    queryable: getSharedPostgresPool(),
    storageEncryptionKey: options.storageEncryptionKey,
  });
}
