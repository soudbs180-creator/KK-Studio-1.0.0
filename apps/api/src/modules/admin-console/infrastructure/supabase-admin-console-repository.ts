import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  AdminConsolePasswordInvalidError,
  AdminConsoleTargetNotFoundError,
  type AdminConsoleRepository,
  type AdminSessionRecord,
  type AdminPasswordState,
  type AdminProfileRecord,
  type AdminRole,
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

export interface SupabaseAdminConsoleRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeRole(role: string | null | undefined): AdminRole {
  return role === "admin" ? "admin" : "user";
}

export class SupabaseAdminConsoleRepository implements AdminConsoleRepository {
  private readonly client: SupabaseClient;

  constructor(options: SupabaseAdminConsoleRepositoryOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async getUserProfile(userId: string): Promise<AdminProfileRecord | undefined> {
    const { data, error } = await this.client
      .from("profiles")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle<ProfileRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return undefined;
    }

    return {
      id: data.id,
      email: data.email || undefined,
      role: normalizeRole(data.role),
    };
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
    const { data, error } = await this.client
      .from("admin_sessions")
      .select("id, admin_user_id, session_token_hash, expires_at, created_at, revoked_at")
      .eq("admin_user_id", adminUserId)
      .eq("session_token_hash", sessionTokenHash)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .maybeSingle<AdminSessionRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return undefined;
    }

    return {
      id: data.id,
      adminUserId: data.admin_user_id,
      sessionTokenHash: data.session_token_hash,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      revokedAt: data.revoked_at || undefined,
    };
  }

  async createAdminSession(input: CreateAdminSessionInput): Promise<void> {
    const { error } = await this.client
      .from("admin_sessions")
      .insert({
        admin_user_id: input.adminUserId,
        session_token_hash: input.sessionTokenHash,
        expires_at: input.expiresAt,
        created_at: input.createdAt,
      });

    if (error) {
      throw error;
    }
  }

  async revokeAdminSessions(adminUserId: string, revokedAt: string): Promise<void> {
    const { error } = await this.client
      .from("admin_sessions")
      .update({
        revoked_at: revokedAt,
      })
      .eq("admin_user_id", adminUserId)
      .is("revoked_at", null);

    if (error) {
      throw error;
    }
  }

  async changeAdminPassword(oldPassword: string, newPassword: string): Promise<void> {
    const adminAuth = await this.getAdminAuthRow();
    if (!verifyAdminPasswordHash(oldPassword, adminAuth.password_hash)) {
      throw new AdminConsolePasswordInvalidError("Incorrect old password.");
    }

    const { error } = await this.client
      .from("admin_auth")
      .update({
        password_hash: hashAdminPassword(newPassword),
        requires_password_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", adminAuth.id);

    if (error) {
      throw error;
    }
  }

  async setUserRole(identity: string, role: AdminRole): Promise<ResolvedRoleChangeTarget> {
    const target = await this.findTargetProfile(identity);
    if (!target) {
      throw new AdminConsoleTargetNotFoundError("The target profile could not be found.");
    }

    const { error } = await this.client
      .from("profiles")
      .update({
        role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id);

    if (error) {
      throw error;
    }

    return {
      subjectId: target.id,
      identity: String(identity || "").trim(),
      role,
      subjectEmail: target.email || undefined,
    };
  }

  private async getAdminAuthRow(): Promise<AdminAuthRow> {
    const { data, error } = await this.client
      .from("admin_auth")
      .select("id, password_hash, requires_password_change")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle<AdminAuthRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("The admin_auth table is not initialized.");
    }

    return data;
  }

  private async findTargetProfile(identity: string): Promise<ProfileRow | undefined> {
    const normalizedIdentity = String(identity || "").trim();
    if (!normalizedIdentity) {
      return undefined;
    }

    if (isUuid(normalizedIdentity)) {
      const { data, error } = await this.client
        .from("profiles")
        .select("id, email, role")
        .eq("id", normalizedIdentity)
        .maybeSingle<ProfileRow>();

      if (error) {
        throw error;
      }

      return data || undefined;
    }

    const { data, error } = await this.client
      .from("profiles")
      .select("id, email, role")
      .ilike("email", normalizedIdentity)
      .limit(1)
      .maybeSingle<ProfileRow>();

    if (error) {
      throw error;
    }

    return data || undefined;
  }
}
