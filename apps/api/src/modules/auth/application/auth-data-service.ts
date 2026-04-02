import {
  buildRequestMeta,
  type ApiResponse,
  type KeyManagerCloudStateDto,
  type ReplaceKeyManagerCloudStateRequestDto,
  type SecureProxyUserRouteConfigDto,
  type ReplaceUserApiEntriesRequestDto,
  type TempUserSessionDto,
  type UserApiEntryListDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import type { AuthDataRepository } from "../infrastructure/in-memory-auth-data-repository.ts";
import type { UserScopedAuthDataMirror } from "../infrastructure/supabase-user-scoped-auth-data-mirror.ts";
import {
  extractKeyManagerCloudSlots,
  extractUserApiEntriesFromPayload,
  extractUserApiProvidersFromPayload,
  extractUserApisPayloadVersion,
} from "../infrastructure/user-api-payload.ts";

function normalizeUserApisPayload(raw: unknown): {
  version: number;
  slots: unknown[];
  providers: unknown[];
  entries: unknown[];
} {
  return {
    version: extractUserApisPayloadVersion(raw),
    slots: extractKeyManagerCloudSlots(raw),
    providers: extractUserApiProvidersFromPayload(raw),
    entries: extractUserApiEntriesFromPayload(raw),
  };
}

function arePayloadsEquivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizeUserApisPayload(left)) === JSON.stringify(normalizeUserApisPayload(right));
}

function getPayloadDensity(raw: unknown): number {
  const normalized = normalizeUserApisPayload(raw);
  return normalized.slots.length + normalized.providers.length + normalized.entries.length;
}

export interface AuthDataServiceOptions {
  cloudMirror?: UserScopedAuthDataMirror;
}

const USER_APIS_RECONCILE_TTL_MS = 15_000;

export class AuthDataService {
  private readonly logger = consoleLogger.child({ module: "auth-data" });
  private readonly repository: AuthDataRepository;
  private readonly cloudMirror?: UserScopedAuthDataMirror;
  private readonly reconcileCompletedAt = new Map<string, number>();
  private readonly reconcileInFlight = new Map<string, Promise<void>>();

  constructor(repository: AuthDataRepository, options: AuthDataServiceOptions = {}) {
    this.repository = repository;
    this.cloudMirror = options.cloudMirror;
  }

  async listUserApiEntries(
    userId: string,
    email: string | undefined,
    requestId: string,
    clientVersion?: string,
    accessToken?: string,
  ): Promise<ApiResponse<UserApiEntryListDto>> {
    await this.reconcileUserApisPayloadWithCloud(userId, email, accessToken);
    const entries = await this.repository.listUserApiEntries(userId, email);
    return {
      success: true,
      data: { entries },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async replaceUserApiEntries(
    userId: string,
    email: string | undefined,
    input: ReplaceUserApiEntriesRequestDto,
    requestId: string,
    clientVersion?: string,
    accessToken?: string,
  ): Promise<ApiResponse<UserApiEntryListDto>> {
    const entries = await this.repository.replaceUserApiEntries(userId, email, input.entries);
    await this.pushLocalUserApisPayloadToCloud(userId, email, accessToken);
    this.logger.info("User API entries replaced via migrated auth module", {
      userId,
      entryCount: entries.length,
    });

    return {
      success: true,
      data: { entries },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async getKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    requestId: string,
    clientVersion?: string,
    accessToken?: string,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>> {
    await this.reconcileUserApisPayloadWithCloud(userId, email, accessToken);
    const state = await this.repository.getKeyManagerCloudState(userId, email);
    return {
      success: true,
      data: state,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async resolveSecureProxyUserRouteConfig(
    userId: string,
    email: string | undefined,
    routeId: string,
    accessToken?: string,
  ): Promise<SecureProxyUserRouteConfigDto | null> {
    await this.reconcileUserApisPayloadWithCloud(userId, email, accessToken);
    return this.repository.resolveSecureProxyUserRouteConfig(userId, email, routeId);
  }

  async replaceKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    input: ReplaceKeyManagerCloudStateRequestDto,
    requestId: string,
    clientVersion?: string,
    accessToken?: string,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>> {
    const state = await this.repository.replaceKeyManagerCloudState(userId, email, input);
    await this.pushLocalUserApisPayloadToCloud(userId, email, accessToken);
    this.logger.info("Key manager cloud state replaced via migrated auth module", {
      userId,
      slotCount: state.slots.length,
      providerCount: state.providers.length,
    });

    return {
      success: true,
      data: state,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  private async reconcileUserApisPayloadWithCloud(
    userId: string,
    email: string | undefined,
    accessToken?: string,
  ): Promise<void> {
    if (!this.cloudMirror || !accessToken) {
      return;
    }

    const now = Date.now();
    const lastCompletedAt = this.reconcileCompletedAt.get(userId) || 0;
    if (now - lastCompletedAt < USER_APIS_RECONCILE_TTL_MS) {
      return;
    }

    const inFlight = this.reconcileInFlight.get(userId);
    if (inFlight) {
      return inFlight;
    }

    const reconcilePromise = (async () => {
      try {
        const [localPayload, cloudPayload] = await Promise.all([
          this.repository.getUserApisPayload(userId, email),
          this.cloudMirror!.loadUserApisPayload(accessToken, userId),
        ]);

        const localDensity = getPayloadDensity(localPayload);
        const cloudDensity = getPayloadDensity(cloudPayload);

        if (localDensity === 0 && cloudDensity > 0) {
          await this.repository.replaceUserApisPayload(userId, email, cloudPayload);
          return;
        }

        if (localDensity > 0 && !arePayloadsEquivalent(cloudPayload, localPayload)) {
          await this.cloudMirror!.saveUserApisPayload(accessToken, userId, email, localPayload);
        }
      } catch (error) {
        this.logger.warn("Failed to reconcile local auth data with the user-scoped Supabase mirror.", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.reconcileCompletedAt.set(userId, Date.now());
        this.reconcileInFlight.delete(userId);
      }
    })();

    this.reconcileInFlight.set(userId, reconcilePromise);
    return reconcilePromise;
  }

  private async pushLocalUserApisPayloadToCloud(
    userId: string,
    email: string | undefined,
    accessToken?: string,
  ): Promise<void> {
    if (!this.cloudMirror || !accessToken) {
      return;
    }

    try {
      const localPayload = await this.repository.getUserApisPayload(userId, email);
      await this.cloudMirror.saveUserApisPayload(accessToken, userId, email, localPayload);
      this.reconcileCompletedAt.set(userId, Date.now());
    } catch (error) {
      this.logger.warn("Failed to mirror local auth data to the user-scoped Supabase profile.", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async createTempUser(
    userAgent: string | undefined,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<TempUserSessionDto>> {
    const tempUser = await this.repository.createTempUser(userAgent);
    this.logger.info("Temporary guest session created via migrated auth module", {
      userId: tempUser.userId,
      expiresAt: tempUser.expiresAt,
    });

    return {
      success: true,
      data: tempUser,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async resolveTempUserSession(userId: string): Promise<TempUserSessionDto | null> {
    return await this.repository.getTempUserSession(userId);
  }
}
