import { createHash } from "node:crypto";

import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import type {
  ExternalIdentityRow,
  WechatAuthRepository,
  WechatAuthUserRecord,
} from "../application/wechat-auth-service.ts";

interface ProfileLookupRow {
  id: string;
  email: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
}

export class PostgresWechatAuthRepository implements WechatAuthRepository {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async resolveWechatIdentity(
    providerAppId: string,
    providerOpenId: string,
    providerUnionId?: string,
  ): Promise<{ byOpenId?: ExternalIdentityRow; byUnionId?: ExternalIdentityRow; resolved?: ExternalIdentityRow }> {
    const byUnionId = providerUnionId ? await this.findByUnionId(providerUnionId) : undefined;
    const byOpenId = await this.findByOpenId(providerAppId, providerOpenId);

    if (byUnionId && byOpenId && byUnionId.user_id !== byOpenId.user_id) {
      throw new Error("WeChat identity conflict detected between unionid and openid mappings.");
    }

    return {
      byOpenId,
      byUnionId,
      resolved: byUnionId || byOpenId,
    };
  }

  async findProviderIdentityForUser(userId: string, provider: string): Promise<ExternalIdentityRow | undefined> {
    const result = await this.queryable.query(
      `select *
         from external_identities
        where user_id = $1
          and provider = $2
        limit 1`,
      [userId, provider],
    );
    return result.rows[0] as ExternalIdentityRow | undefined;
  }

  async createOrGetWechatUser(input: {
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
  }): Promise<{ userId: string; email: string }> {
    const email = this.buildShadowEmail(input.providerAppId, input.providerOpenId, input.providerUnionId);
    const existing = await this.findProfileByEmail(email);
    if (existing?.email) {
      return {
        userId: existing.id,
        email: existing.email,
      };
    }

    const userId = `wechat-user-${createHash("sha256").update(email, "utf8").digest("hex").slice(0, 24)}`;
    await this.queryable.query(
      `insert into profiles (
         id,
         email,
         nickname,
         avatar_url,
         role,
         status,
         created_at,
         updated_at
       ) values (
         $1, $2, $3, $4, 'user', 'active', now(), now()
       )
       on conflict (id) do update
         set email = excluded.email,
             nickname = coalesce(excluded.nickname, profiles.nickname),
             avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
             updated_at = now()`,
      [userId, email, input.nickname || null, input.avatarUrl || null],
    );

    return { userId, email };
  }

  async getUserById(userId: string): Promise<WechatAuthUserRecord | undefined> {
    const result = await this.queryable.query(
      `select id, email, nickname, avatar_url
         from profiles
        where id = $1
        limit 1`,
      [userId],
    );
    const row = result.rows[0] as ProfileLookupRow | undefined;
    return row
      ? {
        id: row.id,
        email: row.email,
        user_metadata: {
          full_name: row.nickname || undefined,
          avatar_url: row.avatar_url || undefined,
        },
      }
      : undefined;
  }

  async syncWechatProfile(input: {
    userId: string;
    email?: string;
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
  }): Promise<void> {
    await this.queryable.query(
      `insert into profiles (
         id,
         email,
         nickname,
         avatar_url,
         role,
         status,
         created_at,
         updated_at
       ) values (
         $1, $2, $3, $4, 'user', 'active', now(), now()
       )
       on conflict (id) do update
         set email = coalesce(excluded.email, profiles.email),
             nickname = coalesce(excluded.nickname, profiles.nickname),
             avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
             updated_at = now()`,
      [input.userId, input.email || null, input.nickname || null, input.avatarUrl || null],
    );
  }

  async upsertWechatIdentity(input: {
    userId: string;
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
    rawProfile: Record<string, unknown>;
    lastLoginAt: string;
  }): Promise<void> {
    await this.queryable.query(
      `insert into external_identities (
         user_id,
         provider,
         provider_appid,
         provider_unionid,
         provider_openid,
         nickname,
         avatar_url,
         raw_profile,
         last_login_at,
         created_at,
         updated_at
       ) values (
         $1, 'wechat', $2, $3, $4, $5, $6, $7::jsonb, $8, now(), now()
       )
       on conflict (provider, provider_appid, provider_openid) do update
         set user_id = excluded.user_id,
             provider_unionid = excluded.provider_unionid,
             nickname = excluded.nickname,
             avatar_url = excluded.avatar_url,
             raw_profile = excluded.raw_profile,
             last_login_at = excluded.last_login_at,
             updated_at = now()`,
      [
        input.userId,
        input.providerAppId,
        input.providerUnionId || null,
        input.providerOpenId,
        input.nickname || null,
        input.avatarUrl || null,
        JSON.stringify(input.rawProfile || {}),
        input.lastLoginAt,
      ],
    );
  }

  private async findByUnionId(unionId: string): Promise<ExternalIdentityRow | undefined> {
    const result = await this.queryable.query(
      `select *
         from external_identities
        where provider = 'wechat'
          and provider_unionid = $1
        limit 1`,
      [unionId],
    );
    return result.rows[0] as ExternalIdentityRow | undefined;
  }

  private async findByOpenId(providerAppId: string, openId: string): Promise<ExternalIdentityRow | undefined> {
    const result = await this.queryable.query(
      `select *
         from external_identities
        where provider = 'wechat'
          and provider_appid = $1
          and provider_openid = $2
        limit 1`,
      [providerAppId, openId],
    );
    return result.rows[0] as ExternalIdentityRow | undefined;
  }

  private async findProfileByEmail(email: string): Promise<ProfileLookupRow | undefined> {
    const result = await this.queryable.query(
      `select id, email, nickname, avatar_url
         from profiles
        where email = $1
        limit 1`,
      [email],
    );
    return result.rows[0] as ProfileLookupRow | undefined;
  }

  private buildShadowEmail(providerAppId: string, providerOpenId: string, providerUnionId?: string): string {
    const key = providerUnionId || providerOpenId;
    const digest = createHash("sha256")
      .update(`wechat:${providerAppId}:${key}`)
      .digest("hex")
      .slice(0, 32);
    return `wechat-${digest}@users.kkstudio.local`;
  }
}

export function createWechatAuthRepositoryFromEnv(): WechatAuthRepository | null {
  if (!hasPostgresConfig()) {
    return null;
  }

  return new PostgresWechatAuthRepository(getSharedPostgresPool());
}
