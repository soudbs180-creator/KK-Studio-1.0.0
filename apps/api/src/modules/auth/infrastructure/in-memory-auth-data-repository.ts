import { randomUUID } from "node:crypto";

import type {
  KeyManagerCloudStateDto,
  ReplaceKeyManagerCloudStateRequestDto,
  SecureProxyUserRouteConfigDto,
  TempUserSessionDto,
  UserApiEntryDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  mergeUserApisPayload,
  resolveSecureProxyUserRouteConfig,
  sanitizeKeyManagerCloudStateForClient,
  sanitizeUserApiEntriesForClient,
} from "./user-api-payload.ts";

export interface AuthDataRepository {
  listUserApiEntries(userId: string, email?: string): Promise<UserApiEntryDto[]>;
  replaceUserApiEntries(userId: string, email: string | undefined, entries: UserApiEntryDto[]): Promise<UserApiEntryDto[]>;
  getKeyManagerCloudState(userId: string, email?: string): Promise<KeyManagerCloudStateDto>;
  getUserApisPayload(userId: string, email?: string): Promise<unknown>;
  replaceUserApisPayload(userId: string, email: string | undefined, payload: unknown): Promise<void>;
  resolveSecureProxyUserRouteConfig(
    userId: string,
    email: string | undefined,
    routeId: string,
  ): Promise<SecureProxyUserRouteConfigDto | null>;
  replaceKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    state: ReplaceKeyManagerCloudStateRequestDto,
  ): Promise<KeyManagerCloudStateDto>;
  createTempUser(userAgent?: string): Promise<TempUserSessionDto>;
}

const tempUserExpiryMs = 24 * 60 * 60 * 1000;

interface StoredProfileRecord {
  id: string;
  email?: string;
  userApisPayload: unknown;
}

export class InMemoryAuthDataRepository implements AuthDataRepository {
  private readonly profiles = new Map<string, StoredProfileRecord>();

  async listUserApiEntries(userId: string, email?: string): Promise<UserApiEntryDto[]> {
    const profile = this.ensureProfile(userId, email);
    return this.extractEntries(profile.userApisPayload);
  }

  async replaceUserApiEntries(
    userId: string,
    email: string | undefined,
    entries: UserApiEntryDto[],
  ): Promise<UserApiEntryDto[]> {
    const profile = this.ensureProfile(userId, email);
    profile.userApisPayload = mergeUserApisPayload(profile.userApisPayload, {
      entries,
    });
    this.profiles.set(userId, profile);
    return this.extractEntries(profile.userApisPayload);
  }

  async getKeyManagerCloudState(userId: string, email?: string): Promise<KeyManagerCloudStateDto> {
    const profile = this.ensureProfile(userId, email);
    return this.extractKeyManagerState(profile.userApisPayload);
  }

  async getUserApisPayload(userId: string, email?: string): Promise<unknown> {
    const profile = this.ensureProfile(userId, email);
    return profile.userApisPayload;
  }

  async replaceUserApisPayload(
    userId: string,
    email: string | undefined,
    payload: unknown,
  ): Promise<void> {
    const profile = this.ensureProfile(userId, email);
    profile.userApisPayload = payload;
    this.profiles.set(userId, profile);
  }

  async resolveSecureProxyUserRouteConfig(
    userId: string,
    email: string | undefined,
    routeId: string,
  ): Promise<SecureProxyUserRouteConfigDto | null> {
    const profile = this.ensureProfile(userId, email);
    return resolveSecureProxyUserRouteConfig(profile.userApisPayload, routeId);
  }

  async replaceKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    state: ReplaceKeyManagerCloudStateRequestDto,
  ): Promise<KeyManagerCloudStateDto> {
    const profile = this.ensureProfile(userId, email);
    profile.userApisPayload = mergeUserApisPayload(profile.userApisPayload, {
      slots: state.slots,
      providers: state.providers,
    });
    this.profiles.set(userId, profile);
    return this.extractKeyManagerState(profile.userApisPayload);
  }

  async createTempUser(userAgent?: string): Promise<TempUserSessionDto> {
    const userId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tempUserExpiryMs);
    void userAgent;

    return {
      userId,
      email: `${userId}@temp.local`,
      nickname: `Guest_${userId.replace(/-/g, "").slice(0, 8)}`,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isTempUser: true,
    };
  }

  private ensureProfile(userId: string, email?: string): StoredProfileRecord {
    const existing = this.profiles.get(userId);
    if (existing) {
      if (email) {
        existing.email = email;
      }
      return existing;
    }

    const created: StoredProfileRecord = {
      id: userId,
      email,
      userApisPayload: [],
    };
    this.profiles.set(userId, created);
    return created;
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
}
