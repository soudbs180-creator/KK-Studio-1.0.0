import { createHash } from "node:crypto";

import {
  hashAdminPassword,
  isLegacyMd5PasswordHash,
  verifyAdminPasswordHash,
} from "./password-hashing.ts";

export type AdminRole = "user" | "admin";

export interface AdminProfileRecord {
  id: string;
  email?: string;
  role: AdminRole;
}

export interface AdminPasswordState {
  requiresPasswordChange: boolean;
}

export interface AdminSessionRecord {
  id: string;
  adminUserId: string;
  sessionTokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
}

export interface CreateAdminSessionInput {
  adminUserId: string;
  sessionTokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface ResolvedRoleChangeTarget {
  subjectId: string;
  identity: string;
  role: AdminRole;
  subjectEmail?: string;
}

export class AdminConsoleAccessDeniedError extends Error {
  constructor(message = "Admin role is required to access the admin console.") {
    super(message);
  }
}

export class AdminConsolePasswordInvalidError extends Error {
  constructor(message = "The provided admin password is invalid.") {
    super(message);
  }
}

export class AdminConsoleTargetNotFoundError extends Error {
  constructor(message = "The requested admin target could not be found.") {
    super(message);
  }
}

export interface AdminConsoleRepository {
  getUserProfile(userId: string): Promise<AdminProfileRecord | undefined>;
  findUserProfileByIdentity(identity: string): Promise<AdminProfileRecord | undefined>;
  verifyAdminPassword(password: string): Promise<boolean>;
  getAdminPasswordState(): Promise<AdminPasswordState>;
  getActiveAdminSession(
    adminUserId: string,
    sessionTokenHash: string,
    now: string,
  ): Promise<AdminSessionRecord | undefined>;
  createAdminSession(input: CreateAdminSessionInput): Promise<void>;
  revokeAdminSessions(adminUserId: string, revokedAt: string): Promise<void>;
  changeAdminPassword(oldPassword: string, newPassword: string): Promise<void>;
  setUserRole(identity: string, role: AdminRole): Promise<ResolvedRoleChangeTarget>;
}

export function hashAdminSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export class InMemoryAdminConsoleRepository implements AdminConsoleRepository {
  private readonly profiles = new Map<string, AdminProfileRecord>();
  private readonly adminSessions = new Map<string, AdminSessionRecord>();
  private adminPasswordHash = hashAdminPassword("123456");
  private requiresPasswordChange = true;

  constructor(seedProfiles?: AdminProfileRecord[]) {
    const defaults: AdminProfileRecord[] = seedProfiles || [
      {
        id: "admin-user-1",
        email: "admin@example.com",
        role: "admin",
      },
      {
        id: "user-1",
        email: "user-1@example.com",
        role: "user",
      },
    ];

    defaults.forEach((profile) => {
      this.profiles.set(profile.id, { ...profile });
    });
  }

  async getUserProfile(userId: string): Promise<AdminProfileRecord | undefined> {
    const profile = this.profiles.get(userId);
    return profile ? { ...profile } : undefined;
  }

  async findUserProfileByIdentity(identity: string): Promise<AdminProfileRecord | undefined> {
    const normalizedIdentity = String(identity || "").trim();
    const target = Array.from(this.profiles.values()).find((profile) => (
      profile.id === normalizedIdentity
      || String(profile.email || "").trim().toLowerCase() === normalizedIdentity.toLowerCase()
    ));

    return target ? { ...target } : undefined;
  }

  async verifyAdminPassword(password: string): Promise<boolean> {
    return verifyAdminPasswordHash(password, this.adminPasswordHash);
  }

  async getAdminPasswordState(): Promise<AdminPasswordState> {
    return {
      requiresPasswordChange: this.requiresPasswordChange || isLegacyMd5PasswordHash(this.adminPasswordHash),
    };
  }

  async getActiveAdminSession(
    adminUserId: string,
    sessionTokenHash: string,
    now: string,
  ): Promise<AdminSessionRecord | undefined> {
    const expiresAfter = Date.parse(now) || Date.now();
    const session = Array.from(this.adminSessions.values()).find((candidate) => (
      candidate.adminUserId === adminUserId
      && candidate.sessionTokenHash === sessionTokenHash
      && !candidate.revokedAt
      && (Date.parse(candidate.expiresAt) || 0) > expiresAfter
    ));

    return session ? { ...session } : undefined;
  }

  async createAdminSession(input: CreateAdminSessionInput): Promise<void> {
    this.adminSessions.set(input.sessionTokenHash, {
      id: `admin-session-${this.adminSessions.size + 1}`,
      adminUserId: input.adminUserId,
      sessionTokenHash: input.sessionTokenHash,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
    });
  }

  async revokeAdminSessions(adminUserId: string, revokedAt: string): Promise<void> {
    for (const [sessionTokenHash, session] of this.adminSessions.entries()) {
      if (session.adminUserId !== adminUserId || session.revokedAt) {
        continue;
      }

      this.adminSessions.set(sessionTokenHash, {
        ...session,
        revokedAt,
      });
    }
  }

  async changeAdminPassword(oldPassword: string, newPassword: string): Promise<void> {
    const matches = await this.verifyAdminPassword(oldPassword);
    if (!matches) {
      throw new AdminConsolePasswordInvalidError("Incorrect old password.");
    }

    this.adminPasswordHash = hashAdminPassword(newPassword);
    this.requiresPasswordChange = false;
  }

  async setUserRole(identity: string, role: AdminRole): Promise<ResolvedRoleChangeTarget> {
    const normalizedIdentity = String(identity || "").trim();
    const target = Array.from(this.profiles.values()).find((profile) => (
      profile.id === normalizedIdentity
      || String(profile.email || "").trim().toLowerCase() === normalizedIdentity.toLowerCase()
    ));

    if (!target) {
      throw new AdminConsoleTargetNotFoundError("The target profile could not be found.");
    }

    const next = {
      ...target,
      role,
    };
    this.profiles.set(target.id, next);

    return {
      subjectId: next.id,
      identity: normalizedIdentity,
      role,
      subjectEmail: next.email,
    };
  }
}
