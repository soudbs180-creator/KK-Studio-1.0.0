import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  KeyManagerCloudStateDto,
  ReplaceKeyManagerCloudStateRequestDto,
  TempUserSessionDto,
  UserApiEntryDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { AuthDataRepository } from "./in-memory-auth-data-repository.ts";
import {
  extractKeyManagerCloudState,
  extractUserApiEntriesFromPayload,
  mergeUserApisPayload,
} from "./user-api-payload.ts";

interface ProfileUserApisRow {
  id: string;
  email: string | null;
  user_apis: unknown;
}

export interface SupabaseAuthDataRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
}

const tempUserExpiryMs = 24 * 60 * 60 * 1000;

export class SupabaseAuthDataRepository implements AuthDataRepository {
  private readonly client: SupabaseClient;

  constructor(options: SupabaseAuthDataRepositoryOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async listUserApiEntries(userId: string, email?: string): Promise<UserApiEntryDto[]> {
    const profile = await this.getOrCreateProfile(userId, email);
    return this.extractEntries(profile?.user_apis);
  }

  async replaceUserApiEntries(
    userId: string,
    email: string | undefined,
    entries: UserApiEntryDto[],
  ): Promise<UserApiEntryDto[]> {
    const existing = await this.getOrCreateProfile(userId, email);
    const mergedPayload = mergeUserApisPayload(existing?.user_apis, {
      entries,
    });

    const { error } = await this.client
      .from("profiles")
      .upsert({
        id: userId,
        email: email || existing?.email || null,
        user_apis: mergedPayload,
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
    return this.extractKeyManagerState(profile?.user_apis);
  }

  async replaceKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    state: ReplaceKeyManagerCloudStateRequestDto,
  ): Promise<KeyManagerCloudStateDto> {
    const existing = await this.getOrCreateProfile(userId, email);
    const mergedPayload = mergeUserApisPayload(existing?.user_apis, {
      slots: state.slots,
      providers: state.providers,
    });

    const { error } = await this.client
      .from("profiles")
      .upsert({
        id: userId,
        email: email || existing?.email || null,
        user_apis: mergedPayload,
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

  async createTempUser(userAgent?: string): Promise<TempUserSessionDto> {
    const userId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tempUserExpiryMs);
    const email = `${userId}@temp.local`;
    const nickname = `Guest_${userId.replace(/-/g, "").slice(0, 8)}`;

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
    const entries = extractUserApiEntriesFromPayload(raw);
    return Array.isArray(entries)
      ? entries
          .filter((entry): entry is UserApiEntryDto => Boolean(entry) && typeof entry === "object")
          .map((entry) => ({ ...entry }))
      : [];
  }

  private extractKeyManagerState(raw: unknown): KeyManagerCloudStateDto {
    const payload = extractKeyManagerCloudState(raw);
    return {
      version: payload.version,
      slots: payload.slots.map((slot) => ({ ...slot })),
      providers: payload.providers.map((provider) => ({ ...provider })),
      entries: this.extractEntries(payload.entries),
    };
  }
}
