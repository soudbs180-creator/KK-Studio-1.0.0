import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import type {
  LoginResponseDto,
  ProfileDto,
  UpdateProfileRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedUserEmail,
  resolveAuthenticatedUserId,
  resolveAuthenticatedUserRole,
} from "../../../../../../packages/shared/src/index.ts";

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: string;
}

interface StoredIdentityRecord {
  id: string;
  email: string;
  nickname?: string;
  avatarUrl?: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
  passwordSalt?: string;
  passwordHash?: string;
}

export interface PersistedAuthIdentityState {
  version: 1;
  users: Record<string, StoredIdentityRecord>;
  sessions: Record<string, StoredSession>;
}

export interface AuthIdentityStore {
  registerPasswordUser(email: string, password: string): { created: boolean; profile: ProfileDto };
  authenticatePassword(email: string, password: string): LoginResponseDto | undefined;
  createRegisteredUser(email: string): { created: boolean; profile: ProfileDto };
  issueLoginSession(email: string): LoginResponseDto;
  resolveAccessToken(accessToken: string): ProfileDto | undefined;
  resolveProfile(headers: Record<string, string>): ProfileDto | undefined;
  updateProfile(headers: Record<string, string>, input: UpdateProfileRequestDto): ProfileDto | undefined;
}

const sessionTtlSeconds = 60 * 60;
const passwordHashBytes = 64;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createPasswordSecret(password: string): { passwordSalt: string; passwordHash: string } {
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, passwordSalt, passwordHashBytes).toString("hex");
  return {
    passwordSalt,
    passwordHash,
  };
}

function verifyPasswordSecret(password: string, passwordSalt: string, passwordHash: string): boolean {
  const expectedHash = Buffer.from(passwordHash, "hex");
  const actualHash = scryptSync(password, passwordSalt, expectedHash.length);
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
}

function cloneProfile(record: StoredIdentityRecord | undefined): ProfileDto | undefined {
  if (!record) {
    return undefined;
  }

  return {
    id: record.id,
    email: record.email,
    nickname: record.nickname,
    avatarUrl: record.avatarUrl,
    role: record.role,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class InMemoryAuthIdentityStore implements AuthIdentityStore {
  protected readonly usersById = new Map<string, StoredIdentityRecord>();
  protected readonly userIdByEmail = new Map<string, string>();
  protected readonly sessionsByAccessToken = new Map<string, StoredSession>();

  constructor(initialState?: PersistedAuthIdentityState) {
    this.restoreState(initialState);
  }

  registerPasswordUser(email: string, password: string): { created: boolean; profile: ProfileDto } {
    const normalizedEmail = normalizeEmail(email);
    const existing = this.findStoredUserByEmail(normalizedEmail);
    if (existing) {
      return {
        created: false,
        profile: cloneProfile(existing)!,
      };
    }

    const now = new Date().toISOString();
    const record: StoredIdentityRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      nickname: normalizedEmail.split("@")[0],
      role: "user",
      status: "active",
      createdAt: now,
      updatedAt: now,
      ...createPasswordSecret(password),
    };

    this.storeUser(record);
    this.afterStateChange();

    return {
      created: true,
      profile: cloneProfile(record)!,
    };
  }

  authenticatePassword(email: string, password: string): LoginResponseDto | undefined {
    const normalizedEmail = normalizeEmail(email);
    const record = this.findStoredUserByEmail(normalizedEmail);
    if (!record?.passwordSalt || !record.passwordHash) {
      return undefined;
    }

    if (!verifyPasswordSecret(password, record.passwordSalt, record.passwordHash)) {
      return undefined;
    }

    return this.issueLoginSessionForUserId(record.id);
  }

  createRegisteredUser(email: string): { created: boolean; profile: ProfileDto } {
    const normalizedEmail = normalizeEmail(email);
    const existing = this.findStoredUserByEmail(normalizedEmail);
    if (existing) {
      return {
        created: false,
        profile: cloneProfile(existing)!,
      };
    }

    const now = new Date().toISOString();
    const record: StoredIdentityRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      nickname: normalizedEmail.split("@")[0],
      role: "user",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    this.storeUser(record);
    this.afterStateChange();

    return {
      created: true,
      profile: cloneProfile(record)!,
    };
  }

  issueLoginSession(email: string): LoginResponseDto {
    const { profile } = this.createRegisteredUser(email);
    return this.issueLoginSessionForUserId(profile.id);
  }

  resolveAccessToken(accessToken: string): ProfileDto | undefined {
    if (this.pruneExpiredSessions()) {
      this.afterStateChange();
    }

    const normalizedToken = String(accessToken || "").trim();
    if (!normalizedToken) {
      return undefined;
    }

    const session = this.sessionsByAccessToken.get(normalizedToken);
    if (!session) {
      return undefined;
    }

    return cloneProfile(this.usersById.get(session.userId));
  }

  resolveProfile(headers: Record<string, string>): ProfileDto | undefined {
    const authenticatedUserId = resolveAuthenticatedUserId(headers);
    if (authenticatedUserId) {
      return this.getOrCreateAuthenticatedProfile(
        authenticatedUserId,
        resolveAuthenticatedUserEmail(headers),
        resolveAuthenticatedUserRole(headers),
      );
    }

    const authorization = headers.authorization;
    if (!authorization) {
      return undefined;
    }

    const token = authorization.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : authorization.trim();

    if (!token) {
      return undefined;
    }

    return this.resolveAccessToken(token);
  }

  updateProfile(headers: Record<string, string>, input: UpdateProfileRequestDto): ProfileDto | undefined {
    const profile = this.resolveProfile(headers);
    if (!profile) {
      return undefined;
    }

    const existing = this.usersById.get(profile.id);
    const nextProfile: StoredIdentityRecord = {
      ...(existing || {
        ...profile,
      }),
      ...(typeof input.nickname === "string" ? { nickname: input.nickname.trim() || undefined } : {}),
      ...(typeof input.avatarUrl === "string" ? { avatarUrl: input.avatarUrl.trim() || undefined } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.storeUser(nextProfile);
    this.afterStateChange();
    return cloneProfile(nextProfile);
  }

  protected snapshotState(): PersistedAuthIdentityState {
    this.pruneExpiredSessions();

    return {
      version: 1,
      users: Object.fromEntries(
        Array.from(this.usersById.entries()).map(([userId, record]) => [userId, { ...record }]),
      ),
      sessions: Object.fromEntries(
        Array.from(this.sessionsByAccessToken.entries()).map(([accessToken, session]) => [accessToken, { ...session }]),
      ),
    };
  }

  protected afterStateChange(): void {
  }

  protected findStoredUserByEmail(email: string): StoredIdentityRecord | undefined {
    const userId = this.userIdByEmail.get(email);
    return userId ? this.usersById.get(userId) : undefined;
  }

  private issueLoginSessionForUserId(userId: string): LoginResponseDto {
    if (this.pruneExpiredSessions()) {
      this.afterStateChange();
    }

    const profile = cloneProfile(this.usersById.get(userId));
    if (!profile) {
      throw new Error(`Cannot issue a login session for unknown auth user ${userId}.`);
    }

    const accessToken = `kk-local-access-${randomUUID()}`;
    const refreshToken = `kk-local-refresh-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000).toISOString();

    this.sessionsByAccessToken.set(accessToken, {
      accessToken,
      refreshToken,
      userId: profile.id,
      expiresAt,
    });
    this.afterStateChange();

    return {
      accessToken,
      refreshToken,
      expiresIn: sessionTtlSeconds,
      profile,
    };
  }

  private restoreState(initialState?: PersistedAuthIdentityState): void {
    if (!initialState || initialState.version !== 1) {
      return;
    }

    for (const [userId, record] of Object.entries(initialState.users || {})) {
      if (!record || typeof record !== "object") {
        continue;
      }

      this.usersById.set(userId, { ...record });
      this.userIdByEmail.set(record.email, userId);
    }

    for (const [accessToken, session] of Object.entries(initialState.sessions || {})) {
      if (!session || typeof session !== "object") {
        continue;
      }

      this.sessionsByAccessToken.set(accessToken, { ...session });
    }

    this.pruneExpiredSessions();
  }

  private storeUser(record: StoredIdentityRecord): void {
    this.usersById.set(record.id, { ...record });
    this.userIdByEmail.set(record.email, record.id);
  }

  private getOrCreateAuthenticatedProfile(
    userId: string,
    email?: string,
    role?: string,
  ): ProfileDto {
    const existing = this.usersById.get(userId);
    const normalizedRole = role === "admin" ? "admin" : "user";
    const normalizedEmail = email
      ? normalizeEmail(email)
      : existing?.email || `${userId}@local.invalid`;

    if (existing && existing.email === normalizedEmail && existing.role === normalizedRole) {
      return cloneProfile(existing)!;
    }

    const now = new Date().toISOString();
    const nextProfile: StoredIdentityRecord = existing
      ? {
          ...existing,
          email: normalizedEmail,
          role: normalizedRole,
          updatedAt: now,
        }
      : {
          id: userId,
          email: normalizedEmail,
          nickname: normalizedEmail.split("@")[0] || "user",
          role: normalizedRole,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };

    this.storeUser(nextProfile);
    this.afterStateChange();

    return cloneProfile(nextProfile)!;
  }

  private pruneExpiredSessions(): boolean {
    const now = Date.now();
    let removedAny = false;

    for (const [accessToken, session] of this.sessionsByAccessToken.entries()) {
      const expiresAtMs = Date.parse(String(session.expiresAt || ""));
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
        this.sessionsByAccessToken.delete(accessToken);
        removedAny = true;
      }
    }

    return removedAny;
  }
}
