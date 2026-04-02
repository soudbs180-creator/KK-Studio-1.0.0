import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  KeyManagerCloudStateDto,
  ReplaceKeyManagerCloudStateRequestDto,
  SecureProxyUserRouteConfigDto,
  TempUserSessionDto,
  UserApiEntryDto,
} from "../../../../../../packages/contracts/src/index.ts";
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
  metadata: {
    email?: string;
    nickname?: string;
  } | null;
}

export interface SupabaseAuthDataRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
  storageEncryptionKey?: string;
}

const tempUserExpiryMs = 24 * 60 * 60 * 1000;

export class SupabaseAuthDataRepository implements AuthDataRepository {
  private readonly client: SupabaseClient;
  private readonly storageEncryptionKey?: string;

  constructor(options: SupabaseAuthDataRepositoryOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
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
    const encryptedPayload = this.encryptPayload(mergedPayload);

    const { error } = await this.client
      .from("profiles")
      .upsert({
        id: userId,
        email: email || existing?.email || null,
        user_apis: encryptedPayload,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

    if (error) {
      throw error;
    }

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
    const encryptedPayload = this.encryptPayload(payload);

    const { error } = await this.client
      .from("profiles")
      .upsert({
        id: userId,
        email: email || existing?.email || null,
        user_apis: encryptedPayload,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

    if (error) {
      throw error;
    }
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
      slots: state.slots,
      providers: state.providers,
    });
    const encryptedPayload = this.encryptPayload(mergedPayload);

    const { error } = await this.client
      .from("profiles")
      .upsert({
        id: userId,
        email: email || existing?.email || null,
        user_apis: encryptedPayload,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

    if (error) {
      throw error;
    }

    return this.extractKeyManagerState(mergedPayload);
  }

  async getTempUserSession(userId: string): Promise<TempUserSessionDto | null> {
    const nowIso = new Date().toISOString();
    const { data, error } = await this.client
      .from("temp_users")
      .select("id, created_at, expires_at, is_active, metadata")
      .eq("id", userId)
      .eq("is_active", true)
      .gt("expires_at", nowIso)
      .maybeSingle<TempUserRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const createdAt = String(data.created_at || nowIso);
    const expiresAt = String(data.expires_at || "");
    if (!expiresAt) {
      return null;
    }

    return {
      userId: data.id,
      email: String(data.metadata?.email || `${data.id}@temp.local`),
      nickname: String(data.metadata?.nickname || `Guest_${data.id.replace(/-/g, "").slice(0, 8)}`),
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

    // Best-effort cleanup keeps the temp_users table aligned with the 24h TTL model.
    await this.client
      .from("temp_users")
      .delete()
      .lt("expires_at", now.toISOString());

    const { error } = await this.client.from("temp_users").insert({
      id: userId,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      metadata: {
        email,
        nickname,
        lastSeenAt: now.toISOString(),
        userAgent: userAgent || "unknown",
      },
    });

    if (error) {
      throw error;
    }

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
    const current = await this.client
      .from("profiles")
      .select("id, email, user_apis")
      .eq("id", userId)
      .maybeSingle<ProfileUserApisRow>();

    if (current.error) {
      throw current.error;
    }

    if (current.data) {
      return current.data;
    }

    const { error } = await this.client
      .from("profiles")
      .upsert({
        id: userId,
        email: email || null,
        user_apis: [],
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

    if (error) {
      throw error;
    }

    return {
      id: userId,
      email: email || null,
      user_apis: [],
    };
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
