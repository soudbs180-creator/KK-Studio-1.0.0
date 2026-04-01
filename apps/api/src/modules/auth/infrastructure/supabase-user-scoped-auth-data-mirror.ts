import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  decryptUserApisPayload,
  encryptUserApisPayload,
} from "./user-api-secret-crypto.ts";

interface ProfileUserApisRow {
  id: string;
  email: string | null;
  user_apis: unknown;
}

export interface UserScopedAuthDataMirror {
  loadUserApisPayload(accessToken: string, userId: string): Promise<unknown | null>;
  saveUserApisPayload(
    accessToken: string,
    userId: string,
    email: string | undefined,
    payload: unknown,
  ): Promise<void>;
}

export interface SupabaseUserScopedAuthDataMirrorOptions {
  supabaseUrl: string;
  authKey: string;
  storageEncryptionKey?: string;
}

export class SupabaseUserScopedAuthDataMirror implements UserScopedAuthDataMirror {
  private readonly supabaseUrl: string;
  private readonly authKey: string;
  private readonly storageEncryptionKey?: string;

  constructor(options: SupabaseUserScopedAuthDataMirrorOptions) {
    this.supabaseUrl = options.supabaseUrl;
    this.authKey = options.authKey;
    this.storageEncryptionKey = options.storageEncryptionKey?.trim() || undefined;
  }

  async loadUserApisPayload(accessToken: string, userId: string): Promise<unknown | null> {
    const client = this.createClient(accessToken);
    const { data, error } = await client
      .from("profiles")
      .select("id, email, user_apis")
      .eq("id", userId)
      .maybeSingle<ProfileUserApisRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return this.decryptPayload(data.user_apis);
  }

  async saveUserApisPayload(
    accessToken: string,
    userId: string,
    email: string | undefined,
    payload: unknown,
  ): Promise<void> {
    const client = this.createClient(accessToken);
    const encryptedPayload = this.encryptPayload(payload);

    const { error } = await client
      .from("profiles")
      .upsert({
        id: userId,
        email: email || null,
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

  private createClient(accessToken: string): SupabaseClient {
    return createClient(this.supabaseUrl, this.authKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  private encryptPayload(payload: unknown): unknown {
    if (!this.storageEncryptionKey) {
      return payload;
    }

    return encryptUserApisPayload(payload, this.storageEncryptionKey);
  }

  private decryptPayload(payload: unknown): unknown {
    if (!this.storageEncryptionKey) {
      return payload;
    }

    return decryptUserApisPayload(payload, this.storageEncryptionKey);
  }
}
