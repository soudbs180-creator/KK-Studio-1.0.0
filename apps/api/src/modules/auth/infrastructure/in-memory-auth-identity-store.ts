import { randomUUID } from "node:crypto";

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

const sessionTtlSeconds = 60 * 60;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class InMemoryAuthIdentityStore {
  private readonly usersById = new Map<string, ProfileDto>();
  private readonly userIdByEmail = new Map<string, string>();
  private readonly sessionsByAccessToken = new Map<string, StoredSession>();

  createRegisteredUser(email: string): { created: boolean; profile: ProfileDto } {
    const normalizedEmail = normalizeEmail(email);
    const existing = this.findUserByEmail(normalizedEmail);
    if (existing) {
      return {
        created: false,
        profile: { ...existing },
      };
    }

    const now = new Date().toISOString();
    const profile: ProfileDto = {
      id: randomUUID(),
      email: normalizedEmail,
      nickname: normalizedEmail.split("@")[0],
      role: "user",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    this.usersById.set(profile.id, profile);
    this.userIdByEmail.set(normalizedEmail, profile.id);

    return {
      created: true,
      profile: { ...profile },
    };
  }

  issueLoginSession(email: string): LoginResponseDto {
    const { profile } = this.createRegisteredUser(email);
    const accessToken = `stub-access-${randomUUID()}`;
    const refreshToken = `stub-refresh-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000).toISOString();

    this.sessionsByAccessToken.set(accessToken, {
      accessToken,
      refreshToken,
      userId: profile.id,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: sessionTtlSeconds,
      profile,
    };
  }

  resolveAccessToken(accessToken: string): ProfileDto | undefined {
    const normalizedToken = String(accessToken || "").trim();
    if (!normalizedToken) {
      return undefined;
    }

    const session = this.sessionsByAccessToken.get(normalizedToken);
    if (!session) {
      return undefined;
    }

    return this.cloneProfile(this.usersById.get(session.userId));
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

    const nextProfile: ProfileDto = {
      ...profile,
      ...(typeof input.nickname === "string" ? { nickname: input.nickname.trim() || undefined } : {}),
      ...(typeof input.avatarUrl === "string" ? { avatarUrl: input.avatarUrl.trim() || undefined } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.usersById.set(nextProfile.id, nextProfile);
    this.userIdByEmail.set(nextProfile.email, nextProfile.id);
    return { ...nextProfile };
  }

  private findUserByEmail(email: string): ProfileDto | undefined {
    const userId = this.userIdByEmail.get(email);
    return userId ? this.usersById.get(userId) : undefined;
  }

  private cloneProfile(profile: ProfileDto | undefined): ProfileDto | undefined {
    return profile ? { ...profile } : undefined;
  }

  private getOrCreateAuthenticatedProfile(
    userId: string,
    email?: string,
    role?: string,
  ): ProfileDto {
    const now = new Date().toISOString();
    const existing = this.usersById.get(userId);
    const normalizedRole = role === "admin" ? "admin" : "user";
    const normalizedEmail = email
      ? normalizeEmail(email)
      : existing?.email
        || `${userId}@local.invalid`;

    const nextProfile: ProfileDto = existing
      ? {
          ...existing,
          email: normalizedEmail,
          role: normalizedRole,
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

    nextProfile.updatedAt = now;
    this.usersById.set(userId, nextProfile);
    if (nextProfile.email) {
      this.userIdByEmail.set(nextProfile.email, nextProfile.id);
    }

    return { ...nextProfile };
  }
}
