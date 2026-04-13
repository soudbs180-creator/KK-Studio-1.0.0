import { createHash, randomUUID } from "node:crypto";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { ExternalIdentityRow } from "../application/wechat-auth-service.ts";

export interface SupabaseWechatAuthRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
}

interface SupabaseExternalIdentityRow {
  id: string;
  user_id: string;
  provider: string;
  provider_appid: string;
  provider_unionid: string | null;
  provider_openid: string;
  nickname: string | null;
  avatar_url: string | null;
  raw_profile: Record<string, unknown> | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileLookupRow {
  id: string;
  email: string | null;
}

export interface ResolvedWechatIdentity {
  byOpenId?: ExternalIdentityRow;
  byUnionId?: ExternalIdentityRow;
  resolved?: ExternalIdentityRow;
}

export interface CreateWechatUserInput {
  providerAppId: string;
  providerOpenId: string;
  providerUnionId?: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface UpsertWechatIdentityInput {
  userId: string;
  providerAppId: string;
  providerOpenId: string;
  providerUnionId?: string;
  nickname?: string;
  avatarUrl?: string;
  rawProfile: Record<string, unknown>;
  lastLoginAt: string;
}

export interface SyncWechatProfileInput {
  userId: string;
  email?: string;
  providerAppId: string;
  providerOpenId: string;
  providerUnionId?: string;
  nickname?: string;
  avatarUrl?: string;
}

export class SupabaseWechatAuthRepository {
  private readonly client: SupabaseClient;

  constructor(options: SupabaseWechatAuthRepositoryOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async resolveWechatIdentity(
    providerAppId: string,
    providerOpenId: string,
    providerUnionId?: string,
  ): Promise<ResolvedWechatIdentity> {
    const byUnionId = providerUnionId
      ? await this.findByUnionId(providerUnionId)
      : undefined;
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

  async findProviderIdentityForUser(
    userId: string,
    provider: string,
  ): Promise<ExternalIdentityRow | undefined> {
    const result = await this.client
      .from("external_identities")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle<SupabaseExternalIdentityRow>();

    if (result.error) {
      throw result.error;
    }

    return result.data || undefined;
  }

  async createOrGetWechatUser(
    input: CreateWechatUserInput,
  ): Promise<{ userId: string; email: string }> {
    const email = this.buildShadowEmail(
      input.providerAppId,
      input.providerOpenId,
      input.providerUnionId,
    );

    const userMetadata = this.buildWechatUserMetadata({
      providerAppId: input.providerAppId,
      providerOpenId: input.providerOpenId,
      providerUnionId: input.providerUnionId,
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
    });

    const result = await this.client.auth.admin.createUser({
      email,
      password: `${randomUUID()}${randomUUID()}`,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (result.error) {
      const existingProfile = await this.findProfileByEmail(email);
      if (existingProfile?.email) {
        return {
          userId: existingProfile.id,
          email: existingProfile.email,
        };
      }

      throw result.error;
    }

    if (!result.data.user?.id || !result.data.user.email) {
      throw new Error("Supabase did not return a valid WeChat shadow user.");
    }

    return {
      userId: result.data.user.id,
      email: result.data.user.email,
    };
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const result = await this.client.auth.admin.getUserById(userId);
    if (result.error) {
      throw result.error;
    }

    return result.data.user || undefined;
  }

  async syncWechatProfile(input: SyncWechatProfileInput): Promise<void> {
    const existingUser = await this.getUserById(input.userId);
    if (!existingUser) {
      throw new Error(`Supabase user ${input.userId} was not found.`);
    }

    const nextUserMetadata = this.buildWechatUserMetadata({
      ...input,
      existingMetadata: existingUser.user_metadata,
    });

    const updateUserResult = await this.client.auth.admin.updateUserById(input.userId, {
      user_metadata: nextUserMetadata,
    });

    if (updateUserResult.error) {
      throw updateUserResult.error;
    }

    const profilePayload: Record<string, unknown> = {
      id: input.userId,
      email: input.email || existingUser.email || null,
      updated_at: new Date().toISOString(),
    };

    if (typeof input.nickname !== "undefined") {
      profilePayload.nickname = input.nickname || null;
    }

    if (typeof input.avatarUrl !== "undefined") {
      profilePayload.avatar_url = input.avatarUrl || null;
    }

    const profileResult = await this.client
      .from("profiles")
      .upsert(profilePayload, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

    if (profileResult.error) {
      throw profileResult.error;
    }
  }

  async upsertWechatIdentity(input: UpsertWechatIdentityInput): Promise<void> {
    const existing = await this.resolveWechatIdentity(
      input.providerAppId,
      input.providerOpenId,
      input.providerUnionId,
    );

    const payload = {
      id: existing.resolved?.id,
      user_id: input.userId,
      provider: "wechat",
      provider_appid: input.providerAppId,
      provider_unionid: input.providerUnionId || null,
      provider_openid: input.providerOpenId,
      nickname: input.nickname || null,
      avatar_url: input.avatarUrl || null,
      raw_profile: input.rawProfile,
      last_login_at: input.lastLoginAt,
      updated_at: new Date().toISOString(),
    };

    const result = await this.client
      .from("external_identities")
      .upsert(payload, {
        onConflict: "provider,provider_appid,provider_openid",
        ignoreDuplicates: false,
      });

    if (result.error) {
      throw result.error;
    }
  }

  async createMagicLink(email: string, redirectTo: string): Promise<string> {
    const result = await this.client.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo,
      },
    });

    if (result.error) {
      throw result.error;
    }

    const actionLink = result.data.properties?.action_link;
    if (!actionLink) {
      throw new Error("Supabase did not return a magic link action URL.");
    }

    return actionLink;
  }

  private async findByUnionId(unionId: string): Promise<ExternalIdentityRow | undefined> {
    const result = await this.client
      .from("external_identities")
      .select("*")
      .eq("provider", "wechat")
      .eq("provider_unionid", unionId)
      .maybeSingle<SupabaseExternalIdentityRow>();

    if (result.error) {
      throw result.error;
    }

    return result.data || undefined;
  }

  private async findByOpenId(
    providerAppId: string,
    openId: string,
  ): Promise<ExternalIdentityRow | undefined> {
    const result = await this.client
      .from("external_identities")
      .select("*")
      .eq("provider", "wechat")
      .eq("provider_appid", providerAppId)
      .eq("provider_openid", openId)
      .maybeSingle<SupabaseExternalIdentityRow>();

    if (result.error) {
      throw result.error;
    }

    return result.data || undefined;
  }

  private async findProfileByEmail(email: string): Promise<ProfileLookupRow | undefined> {
    const result = await this.client
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle<ProfileLookupRow>();

    if (result.error) {
      throw result.error;
    }

    return result.data || undefined;
  }

  private buildShadowEmail(
    providerAppId: string,
    providerOpenId: string,
    providerUnionId?: string,
  ): string {
    const key = providerUnionId || providerOpenId;
    const digest = createHash("sha256")
      .update(`wechat:${providerAppId}:${key}`)
      .digest("hex")
      .slice(0, 32);

    return `wechat-${digest}@users.kkstudio.local`;
  }

  private buildWechatUserMetadata(input: {
    providerAppId: string;
    providerOpenId: string;
    providerUnionId?: string;
    nickname?: string;
    avatarUrl?: string;
    existingMetadata?: Record<string, unknown> | null;
  }): Record<string, unknown> {
    const existingMetadata = input.existingMetadata && typeof input.existingMetadata === "object"
      ? { ...input.existingMetadata }
      : {};

    const nextMetadata: Record<string, unknown> = {
      ...existingMetadata,
      auth_provider: "wechat",
      wechat_appid: input.providerAppId,
      wechat_openid: input.providerOpenId,
    };

    if (input.providerUnionId) {
      nextMetadata.wechat_unionid = input.providerUnionId;
    }

    if (input.nickname) {
      nextMetadata.full_name = input.nickname;
    }

    if (input.avatarUrl) {
      nextMetadata.avatar_url = input.avatarUrl;
    }

    return nextMetadata;
  }
}
