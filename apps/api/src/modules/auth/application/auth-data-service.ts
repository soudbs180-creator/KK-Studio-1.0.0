import {
  buildRequestMeta,
  type ApiResponse,
  type KeyManagerCloudStateDto,
  type ReplaceKeyManagerCloudStateRequestDto,
  type ReplaceUserApisPayloadRequestDto,
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
  resolveSecureProxyUserRouteConfig as resolveSecureProxyUserRouteConfigFromPayload,
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

function getPayloadSecretSummary(raw: unknown): {
  usableSecrets: number;
  placeholderSecrets: number;
} {
  const normalized = normalizeUserApisPayload(raw);
  const records = [
    ...normalized.slots,
    ...normalized.providers,
    ...normalized.entries,
  ];

  return records.reduce<{
    usableSecrets: number;
    placeholderSecrets: number;
  }>((summary, record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return summary;
    }

    const candidate = record as Record<string, unknown>;
    const secret = String(candidate.apiKey ?? candidate.key ?? "").trim();
    if (!secret) {
      return summary;
    }

    if (isRouteSecretPlaceholder(secret)) {
      summary.placeholderSecrets += 1;
      return summary;
    }

    summary.usableSecrets += 1;
    return summary;
  }, {
    usableSecrets: 0,
    placeholderSecrets: 0,
  });
}

function clonePayloadSnapshot<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  if (typeof value === "undefined") {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isRouteSecretPlaceholder(apiKey: string | undefined): boolean {
  const normalized = String(apiKey || "").trim();
  return !normalized
    || normalized === "sk-readonly-0000"
    || normalized.startsWith("__kk_redacted__:");
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

  private shouldMirrorToCloud(accessToken?: string): boolean {
    return Boolean(this.cloudMirror && accessToken);
  }

  private async captureRollbackPayload(
    userId: string,
    email: string | undefined,
    accessToken?: string,
  ): Promise<unknown | undefined> {
    if (!this.shouldMirrorToCloud(accessToken)) {
      return undefined;
    }

    return clonePayloadSnapshot(
      normalizeUserApisPayload(await this.repository.getUserApisPayload(userId, email)),
    );
  }

  private async rollbackLocalUserApisPayload(
    userId: string,
    email: string | undefined,
    snapshot: unknown | undefined,
  ): Promise<boolean> {
    if (typeof snapshot === "undefined") {
      return true;
    }

    try {
      await this.repository.replaceUserApisPayload(userId, email, clonePayloadSnapshot(snapshot));
      return true;
    } catch (error) {
      this.logger.error("Failed to roll back local user API payload after a cloud mirror failure.", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private buildCloudMirrorFailureResponse<T>(
    requestId: string,
    clientVersion: string | undefined,
    message: string,
    rollbackSucceeded: boolean,
  ): ApiResponse<T> {
    return {
      success: false,
      error: {
        code: "CLOUD_MIRROR_FAILED",
        message: rollbackSucceeded
          ? `${message} Local changes were rolled back.`
          : `${message} Local rollback also failed; manual reconciliation is required.`,
        details: [{ rollbackSucceeded }],
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
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
    const rollbackPayload = await this.captureRollbackPayload(userId, email, accessToken);
    const entries = await this.repository.replaceUserApiEntries(userId, email, input.entries);
    try {
      await this.pushLocalUserApisPayloadToCloud(userId, email, accessToken);
    } catch (error) {
      const rollbackSucceeded = await this.rollbackLocalUserApisPayload(userId, email, rollbackPayload);
      this.logger.warn("Failed to persist user API entries to the cloud mirror.", {
        userId,
        rollbackSucceeded,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.buildCloudMirrorFailureResponse(
        requestId,
        clientVersion,
        "Failed to persist user API entries to the cloud mirror.",
        rollbackSucceeded,
      );
    }
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

  async replaceUserApisPayload(
    userId: string,
    email: string | undefined,
    input: ReplaceUserApisPayloadRequestDto,
    requestId: string,
    clientVersion?: string,
    accessToken?: string,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>> {
    const rollbackPayload = await this.captureRollbackPayload(userId, email, accessToken);
    await this.repository.replaceUserApisPayload(userId, email, {
      version: input.version,
      slots: input.slots,
      providers: input.providers,
      entries: input.entries,
    });
    try {
      await this.pushLocalUserApisPayloadToCloud(userId, email, accessToken);
    } catch (error) {
      const rollbackSucceeded = await this.rollbackLocalUserApisPayload(userId, email, rollbackPayload);
      this.logger.warn("Failed to persist user API payload to the cloud mirror.", {
        userId,
        rollbackSucceeded,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.buildCloudMirrorFailureResponse(
        requestId,
        clientVersion,
        "Failed to persist user API payload to the cloud mirror.",
        rollbackSucceeded,
      );
    }

    const state = await this.repository.getKeyManagerCloudState(userId, email);
    this.logger.info("User API payload replaced via unified auth module route", {
      userId,
      slotCount: state.slots.length,
      providerCount: state.providers.length,
      entryCount: state.entries.length,
    });

    return {
      success: true,
      data: state,
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
    const localRouteConfig = await this.repository.resolveSecureProxyUserRouteConfig(userId, email, routeId);
    if (localRouteConfig && !isRouteSecretPlaceholder(localRouteConfig.apiKey)) {
      return localRouteConfig;
    }

    if (!this.shouldMirrorToCloud(accessToken)) {
      return localRouteConfig;
    }

    try {
      const cloudPayload = await this.cloudMirror!.loadUserApisPayload(accessToken!, userId);
      const cloudRouteConfig = resolveSecureProxyUserRouteConfigFromPayload(cloudPayload, routeId);
      if (!cloudRouteConfig || isRouteSecretPlaceholder(cloudRouteConfig.apiKey)) {
        return localRouteConfig || cloudRouteConfig;
      }

      try {
        await this.repository.replaceUserApisPayload(userId, email, cloudPayload);
      } catch (error) {
        this.logger.warn("Failed to refresh local auth data while healing a user-route secret placeholder.", {
          userId,
          routeId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return cloudRouteConfig;
    } catch (error) {
      this.logger.warn("Failed to resolve the user-route config from the cloud mirror after a local placeholder match.", {
        userId,
        routeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return localRouteConfig;
    }
  }

  async replaceKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    input: ReplaceKeyManagerCloudStateRequestDto,
    requestId: string,
    clientVersion?: string,
    accessToken?: string,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>> {
    const rollbackPayload = await this.captureRollbackPayload(userId, email, accessToken);
    const state = await this.repository.replaceKeyManagerCloudState(userId, email, input);
    try {
      await this.pushLocalUserApisPayloadToCloud(userId, email, accessToken);
    } catch (error) {
      const rollbackSucceeded = await this.rollbackLocalUserApisPayload(userId, email, rollbackPayload);
      this.logger.warn("Failed to persist key-manager cloud state to the cloud mirror.", {
        userId,
        rollbackSucceeded,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.buildCloudMirrorFailureResponse(
        requestId,
        clientVersion,
        "Failed to persist key-manager state to the cloud mirror.",
        rollbackSucceeded,
      );
    }
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
        const localSecrets = getPayloadSecretSummary(localPayload);
        const cloudSecrets = getPayloadSecretSummary(cloudPayload);

        if (localDensity === 0 && cloudDensity > 0) {
          await this.repository.replaceUserApisPayload(userId, email, cloudPayload);
          return;
        }

        if (cloudDensity === 0 && localDensity > 0) {
          await this.cloudMirror!.saveUserApisPayload(accessToken, userId, email, localPayload);
          return;
        }

        if (localDensity > 0 && cloudDensity > 0 && !arePayloadsEquivalent(cloudPayload, localPayload)) {
          if (cloudSecrets.usableSecrets > localSecrets.usableSecrets) {
            await this.repository.replaceUserApisPayload(userId, email, cloudPayload);
            return;
          }

          if (localSecrets.usableSecrets > cloudSecrets.usableSecrets) {
            await this.cloudMirror!.saveUserApisPayload(accessToken, userId, email, localPayload);
            return;
          }

          if (cloudSecrets.placeholderSecrets < localSecrets.placeholderSecrets) {
            await this.repository.replaceUserApisPayload(userId, email, cloudPayload);
            return;
          }

          if (localSecrets.placeholderSecrets < cloudSecrets.placeholderSecrets) {
            await this.cloudMirror!.saveUserApisPayload(accessToken, userId, email, localPayload);
            return;
          }

          if (cloudDensity > localDensity) {
            await this.repository.replaceUserApisPayload(userId, email, cloudPayload);
            return;
          }

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

    const localPayload = await this.repository.getUserApisPayload(userId, email);
    await this.cloudMirror.saveUserApisPayload(accessToken, userId, email, localPayload);
    this.reconcileCompletedAt.set(userId, Date.now());
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
