import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

interface StoredProfileRecord {
  id: string;
  email?: string;
  userApisPayload: unknown;
}

interface PersistedAuthDataState {
  version: 1;
  profiles: Record<string, { id: string; email?: string; userApisPayload: unknown }>;
  tempUsers: Record<string, TempUserSessionDto>;
}

export interface FileBackedAuthDataRepositoryOptions {
  filePath?: string;
  storageEncryptionKey?: string;
}

const tempUserExpiryMs = 24 * 60 * 60 * 1000;

function buildDefaultFilePath(): string {
  const configuredPath = String(process.env.KK_LOCAL_AUTH_DATA_FILE || "").trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), ".kk-local", "auth-data.json");
}

function createEmptyState(): PersistedAuthDataState {
  return {
    version: 1,
    profiles: {},
    tempUsers: {},
  };
}

function isPersistedState(value: unknown): value is PersistedAuthDataState {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { version?: unknown }).version === 1
    && typeof (value as { profiles?: unknown }).profiles === "object"
    && !Array.isArray((value as { profiles?: unknown }).profiles)
    && typeof (value as { tempUsers?: unknown }).tempUsers === "object"
    && !Array.isArray((value as { tempUsers?: unknown }).tempUsers)
  );
}

export class FileBackedAuthDataRepository implements AuthDataRepository {
  private readonly filePath: string;
  private readonly storageEncryptionKey?: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: FileBackedAuthDataRepositoryOptions = {}) {
    this.filePath = options.filePath?.trim()
      ? path.resolve(options.filePath.trim())
      : buildDefaultFilePath();
    this.storageEncryptionKey = options.storageEncryptionKey?.trim() || undefined;
  }

  async listUserApiEntries(userId: string, email?: string): Promise<UserApiEntryDto[]> {
    const profile = await this.ensureProfile(userId, email);
    return this.extractEntries(profile.userApisPayload);
  }

  async replaceUserApiEntries(
    userId: string,
    email: string | undefined,
    entries: UserApiEntryDto[],
  ): Promise<UserApiEntryDto[]> {
    const profile = await this.ensureProfile(userId, email);
    profile.userApisPayload = mergeUserApisPayload(profile.userApisPayload, {
      entries,
    });
    await this.saveProfile(profile);
    return this.extractEntries(profile.userApisPayload);
  }

  async getKeyManagerCloudState(userId: string, email?: string): Promise<KeyManagerCloudStateDto> {
    const profile = await this.ensureProfile(userId, email);
    return this.extractKeyManagerState(profile.userApisPayload);
  }

  async getUserApisPayload(userId: string, email?: string): Promise<unknown> {
    const profile = await this.ensureProfile(userId, email);
    return profile.userApisPayload;
  }

  async replaceUserApisPayload(
    userId: string,
    email: string | undefined,
    payload: unknown,
  ): Promise<void> {
    const profile = await this.ensureProfile(userId, email);
    profile.userApisPayload = payload;
    await this.saveProfile(profile);
  }

  async resolveSecureProxyUserRouteConfig(
    userId: string,
    email: string | undefined,
    routeId: string,
  ): Promise<SecureProxyUserRouteConfigDto | null> {
    const profile = await this.ensureProfile(userId, email);
    return resolveSecureProxyUserRouteConfig(profile.userApisPayload, routeId);
  }

  async replaceKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    state: ReplaceKeyManagerCloudStateRequestDto,
  ): Promise<KeyManagerCloudStateDto> {
    const profile = await this.ensureProfile(userId, email);
    profile.userApisPayload = mergeUserApisPayload(profile.userApisPayload, {
      slots: state.slots,
      providers: state.providers,
    });
    await this.saveProfile(profile);
    return this.extractKeyManagerState(profile.userApisPayload);
  }

  async createTempUser(userAgent?: string): Promise<TempUserSessionDto> {
    const userId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tempUserExpiryMs);
    void userAgent;

    const nextTempUser: TempUserSessionDto = {
      userId,
      email: `${userId}@temp.local`,
      nickname: `Guest_${userId.replace(/-/g, "").slice(0, 8)}`,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isTempUser: true,
    };

    await this.withState(async (state) => {
      const nextState = this.pruneExpiredTempUsers(state);
      nextState.tempUsers[userId] = nextTempUser;
      return {
        state: nextState,
        result: nextTempUser,
      };
    });

    return nextTempUser;
  }

  private async ensureProfile(userId: string, email?: string): Promise<StoredProfileRecord> {
    return this.withState(async (state) => {
      const nextState = this.pruneExpiredTempUsers(state);
      const existing = nextState.profiles[userId];
      if (existing) {
        const decoded = this.decodeProfile(existing);
        if (email && email !== decoded.email) {
          decoded.email = email;
          nextState.profiles[userId] = this.encodeProfile(decoded);
          return {
            state: nextState,
            result: decoded,
          };
        }

        return {
          state: nextState,
          result: decoded,
        };
      }

      const created: StoredProfileRecord = {
        id: userId,
        email,
        userApisPayload: [],
      };
      nextState.profiles[userId] = this.encodeProfile(created);
      return {
        state: nextState,
        result: created,
      };
    });
  }

  private async saveProfile(profile: StoredProfileRecord): Promise<void> {
    await this.withState(async (state) => {
      const nextState = this.pruneExpiredTempUsers(state);
      nextState.profiles[profile.id] = this.encodeProfile(profile);
      return {
        state: nextState,
        result: undefined,
      };
    });
  }

  private async withState<T>(
    mutator: (state: PersistedAuthDataState) => Promise<{ state: PersistedAuthDataState; result: T }> | { state: PersistedAuthDataState; result: T },
  ): Promise<T> {
    let resolvedResult: T | undefined;

    const run = async () => {
      const currentState = await this.readState();
      const { state: nextState, result } = await mutator(currentState);
      await this.writeState(nextState);
      resolvedResult = result;
    };

    const writeTask = this.writeQueue.then(run, run);
    this.writeQueue = writeTask.then(() => undefined, () => undefined);
    await writeTask;
    return resolvedResult as T;
  }

  private async readState(): Promise<PersistedAuthDataState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!isPersistedState(parsed)) {
        return createEmptyState();
      }

      return parsed;
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return createEmptyState();
      }

      throw error;
    }
  }

  private async writeState(state: PersistedAuthDataState): Promise<void> {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tempPath, this.filePath);
  }

  private decodeProfile(
    profile: PersistedAuthDataState["profiles"][string],
  ): StoredProfileRecord {
    return {
      id: profile.id,
      email: profile.email,
      userApisPayload: this.decryptPayload(profile.userApisPayload),
    };
  }

  private encodeProfile(profile: StoredProfileRecord): PersistedAuthDataState["profiles"][string] {
    return {
      id: profile.id,
      email: profile.email,
      userApisPayload: this.encryptPayload(profile.userApisPayload),
    };
  }

  private pruneExpiredTempUsers(state: PersistedAuthDataState): PersistedAuthDataState {
    const now = Date.now();
    const nextState: PersistedAuthDataState = {
      version: 1,
      profiles: { ...state.profiles },
      tempUsers: {},
    };

    Object.entries(state.tempUsers || {}).forEach(([userId, tempUser]) => {
      const expiresAtMs = Date.parse(String(tempUser?.expiresAt || ""));
      if (Number.isFinite(expiresAtMs) && expiresAtMs > now) {
        nextState.tempUsers[userId] = tempUser;
      }
    });

    return nextState;
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
      return raw;
    }

    return encryptUserApisPayload(raw, this.storageEncryptionKey);
  }

  private decryptPayload(raw: unknown): unknown {
    if (!this.storageEncryptionKey) {
      return raw;
    }

    return decryptUserApisPayload(raw, this.storageEncryptionKey);
  }
}
