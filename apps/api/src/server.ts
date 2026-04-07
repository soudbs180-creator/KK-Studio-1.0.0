import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { URL } from "node:url";

import { buildApiManifest, apiLogger } from "./app.ts";
import {
  AUTHENTICATED_ADMIN_SESSION_EXPIRES_AT_HEADER,
  AUTHENTICATED_ADMIN_SESSION_HEADER,
  env,
  resolveAdminSessionToken,
  resolveTempUserId,
} from "../../../packages/shared/src/index.ts";
import {
  applyAuthenticatedHeaders,
  createRequestAuthenticator,
  stripAuthenticatedHeaders,
  type AuthenticatedRequestContext,
  type RequestAuthenticator,
} from "./lib/request-authenticator.ts";
import {
  assertServerSupabaseConfigConsistency,
  probeServerSupabasePersistence,
  resolveServerSupabaseConfig,
  summarizeServerSupabaseConfig,
  type ServerSupabaseConfig,
  type ServerSupabasePersistenceProbe,
  type ServerSupabaseProbeCheck,
} from "./lib/server-supabase-config.ts";
import {
  AdminConsoleService,
  type AdminConsoleRepository,
  InMemoryAdminConsoleRepository,
  handleChangeAdminPassword,
  handleGetAdminAccess,
  handleSetUserRole,
  handleVerifyAdminPassword,
  SupabaseAdminConsoleRepository,
} from "./modules/admin-console/index.ts";
import {
  AssetLibraryService,
  InMemoryAssetLibraryRepository,
  handleListAssets,
} from "./modules/asset-library/index.ts";
import {
  LocalSystemProxyService,
  LocalUserRouteProxyService,
  handleInvokeLocalSystemProxy,
  handleInvokeLocalUserRouteProxy,
} from "./modules/model-proxy/index.ts";
import {
  AuthDataService,
  type AuthDataRepository,
  AuthService,
  FileBackedAuthDataRepository,
  InMemoryAuthDataRepository,
  SupabaseUserScopedAuthDataMirror,
  SupabaseAuthDataRepository,
  SupabaseWechatAuthRepository,
  type TurnstileVerifier,
  WechatAuthService,
  handleCreateTempUser,
  handleCheckUserRouteConnectivity,
  handleGetKeyManagerCloudState,
  handleGetProfile,
  handleGetUserApiEntries,
  handleReplaceUserApisPayload,
  handleStartWechatBind,
  handleStartWechatLogin,
  handleWechatCallback,
  handleReplaceKeyManagerCloudState,
  handleReplaceUserApiEntries,
  handleSyncUserRoutePricing,
  handleUpdateProfile,
  UserRouteDiagnosticsService,
  handleVersionedLogin,
  handleVersionedRegister,
} from "./modules/auth/index.ts";
import { InMemoryRateLimiter } from "./modules/auth/infrastructure/in-memory-rate-limiter.ts";
import {
  handleApplyPaymentSettlement,
  CreditExchangeRateService,
  CreditAccountService,
  type CreditAccountRepository,
  type CreditExchangeRateRepository,
  InMemoryCreditAccountRepository,
  InMemoryCreditExchangeRateRepository,
  handleAdminRechargeCredits,
  handleListCreditExchangeRates,
  handleUpsertCreditExchangeRate,
  SupabaseCreditAccountRepository,
  SupabaseCreditExchangeRateRepository,
  handleDebitCredits,
  handleGetCreditBalance,
  handleListCreditTransactions,
  handleRefundCredits,
} from "./modules/billing/index.ts";
import {
  GenerationService,
  InMemoryGenerationTaskRepository,
  handleCreateGenerationTask,
  handleGetGenerationTask,
} from "./modules/generation/index.ts";
import {
  CreditProviderService,
  InMemoryCreditProviderRepository,
  InMemoryModelCatalogRepository,
  ModelCatalogService,
  SupabaseCreditProviderRepository,
  handleDeleteAdminCreditProvider,
  handleGetAdminCreditProviderPricingCache,
  handleGetSharedProviderPricingCache,
  handleListActiveCreditModels,
  handleListAdminCreditProviders,
  handleCreateAdminModel,
  handleListModels,
  handleSaveAdminCreditProvider,
  handleUpsertAdminCreditProviderPricingCache,
  handleUpsertSharedProviderPricingCache,
} from "./modules/model-catalog/index.ts";
import {
  WorkflowService,
  InMemoryWorkflowRepository,
  handleGetWorkflow,
  handleSaveWorkflow,
} from "./modules/workflow/index.ts";
import {
  InMemoryWorkspaceLayoutRepository,
  SupabaseWorkspaceLayoutRepository,
  WorkspaceCanvasService,
  handleCleanupCloudImages,
  handleGetWorkspaceLayout,
  handleGetWorkspaceCanvas,
  handleSaveWorkspaceLayout,
} from "./modules/workspace-canvas/index.ts";

class JsonBodyParseError extends Error {
  readonly code = "INVALID_JSON_BODY";
}

class PayloadTooLargeError extends Error {
  readonly code = "PAYLOAD_TOO_LARGE";
}

const defaultMaxJsonBodyBytes = 1024 * 1024;
const defaultExpandedProfileJsonBodyBytes = 4 * 1024 * 1024;

function resolveJsonBodyMaxBytes(pathname?: string): number {
  const defaultMaxBytes = Number(process.env.KK_API_MAX_JSON_BODY_BYTES || defaultMaxJsonBodyBytes);
  const expandedProfileMaxBytes = Number(
    process.env.KK_API_PROFILE_MAX_JSON_BODY_BYTES
      || process.env.KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES
      || Math.max(defaultMaxBytes, defaultExpandedProfileJsonBodyBytes),
  );

  if (
    pathname === "/api/v1/profile/user-apis"
    || pathname === "/api/v1/profile/user-apis/payload"
    || pathname === "/api/v1/profile/key-manager-state"
  ) {
    return expandedProfileMaxBytes;
  }

  return defaultMaxBytes;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function writeRedirect(res: ServerResponse, location: string, statusCode = 302) {
  res.writeHead(statusCode, {
    location,
    "content-length": "0",
  });
  res.end();
}

function getClientVersion(req: IncomingMessage): string | undefined {
  const header = req.headers["x-client-version"];
  return Array.isArray(header) ? header[0] : header;
}

function normalizeHeaders(req: IncomingMessage): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      normalized[key] = String(value[0] || "");
    } else if (typeof value !== "undefined") {
      normalized[key] = String(value);
    }
  }
  return normalized;
}

function getRequestIp(req: IncomingMessage): string {
  return req.socket.remoteAddress || "unknown";
}

async function readJsonBody(
  req: IncomingMessage,
  options?: {
    maxBytes?: number;
  },
): Promise<any> {
  const chunks: Buffer[] = [];
  const maxBytes = Number(
    options?.maxBytes ?? process.env.KK_API_MAX_JSON_BODY_BYTES ?? defaultMaxJsonBodyBytes,
  );
  let totalBytes = 0;
  for await (const chunk of req) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bufferChunk.length;
    if (Number.isFinite(maxBytes) && maxBytes > 0 && totalBytes > maxBytes) {
      throw new PayloadTooLargeError(`Request body exceeds ${maxBytes} bytes.`);
    }
    chunks.push(bufferChunk);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error: any) {
    throw new JsonBodyParseError(error?.message || "Invalid JSON body.");
  }
}

function buildErrorMeta(requestId: string, clientVersion?: string) {
  return {
    requestId,
    clientVersion,
    timestamp: new Date().toISOString(),
  };
}

const defaultTurnstileVerifier: TurnstileVerifier = async () => ({
  success: false,
  error: "Turnstile verifier is not configured for the API skeleton.",
});

type CriticalPersistenceCapability =
  | "authData"
  | "guestSessions"
  | "workspaceLayout"
  | "billing"
  | "creditProviders";

type RepositoryModeMap = {
  adminConsole: RepositoryBackend;
  authData: RepositoryBackend;
  creditAccounts: RepositoryBackend;
  creditExchangeRates: RepositoryBackend;
  creditProviders: RepositoryBackend;
  workspaceLayout: RepositoryBackend;
};

interface CriticalPersistenceState {
  label: string;
  ready: boolean;
  repositories: Record<string, RepositoryBackend>;
  blockers: string[];
}

interface RuntimePersistenceState {
  configSummary: ReturnType<typeof summarizeServerSupabaseConfig>;
  criticalPersistence: Record<CriticalPersistenceCapability, CriticalPersistenceState>;
  runtimeBlockers: string[];
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isTruthyQueryValue(value: string | null): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1"
    || normalized === "true"
    || normalized === "yes"
    || normalized === "on";
}

function buildCriticalPersistenceState(
  label: string,
  repositories: Record<string, RepositoryBackend>,
  configSummary: ReturnType<typeof summarizeServerSupabaseConfig>,
  repositoryBlockers: Record<string, string>,
  probeChecks: Array<ServerSupabaseProbeCheck | undefined> = [],
  extraBlockers: string[] = [],
): CriticalPersistenceState {
  const probeBlockers = probeChecks
    .filter((check): check is ServerSupabaseProbeCheck => {
      if (check == null) {
        return false;
      }

      return check.ready === false;
    })
    .flatMap((check) => String(check.blocker || "").split(",").map((value) => value.trim()).filter(Boolean));
  const blockers = [
    ...(Array.isArray(configSummary.structuralBlockers) ? configSummary.structuralBlockers : []),
    ...Object.entries(repositories)
      .filter(([, repository]) => repository !== "supabase")
      .map(([key]) => repositoryBlockers[key])
      .filter(Boolean),
    ...probeBlockers,
    ...extraBlockers,
  ];

  return {
    label,
    ready:
      Boolean(configSummary.canonicalConfigReady ?? configSummary.canonicalPersistenceReady)
      && Object.values(repositories).every((repository) => repository === "supabase")
      && probeBlockers.length === 0
      && extraBlockers.length === 0,
    repositories,
    blockers: dedupeStrings(blockers),
  };
}

function buildServerConfigErrorResponse(
  requestId: string,
  clientVersion: string | undefined,
  capability: CriticalPersistenceCapability,
  state: CriticalPersistenceState,
) {
  return {
    success: false,
    error: {
      code: "SERVER_PERSISTENCE_REQUIRED",
      message: `${state.label} require the API server to use the canonical Supabase backend.`,
      details: [
        {
          capability,
          repositories: state.repositories,
          blockers: state.blockers,
        },
      ],
    },
    meta: buildErrorMeta(requestId, clientVersion),
  };
}

function resolveCriticalPersistenceCapability(
  pathname: string,
): CriticalPersistenceCapability | undefined {
  if (
    pathname === "/api/v1/profile/user-apis"
    || pathname === "/api/v1/profile/user-apis/payload"
    || pathname === "/api/v1/profile/key-manager-state"
  ) {
    return "authData";
  }

  if (pathname === "/api/v1/auth/temp-users") {
    return "guestSessions";
  }

  if (
    pathname === "/api/v1/workspaces/layout"
    || pathname === "/api/v1/workspaces/layout/cloud-images"
  ) {
    return "workspaceLayout";
  }

  if (
    pathname === "/api/v1/billing/credits/balance"
    || pathname === "/api/v1/billing/credits/transactions"
    || pathname === "/api/v1/billing/exchange-rates"
    || pathname === "/api/v1/billing/credits/debit"
    || pathname === "/api/v1/billing/credits/refunds"
    || pathname === "/api/v1/admin/billing/exchange-rates"
    || pathname === "/api/v1/admin/billing/recharges"
    || pathname === "/internal/v1/payment-settlements"
  ) {
    return "billing";
  }

  if (
    pathname === "/api/v1/model-catalog/active-credit-models"
    || pathname === "/api/v1/provider-pricing-cache"
    || pathname === "/api/v1/admin/credit-providers"
    || /^\/api\/v1\/admin\/credit-providers\/[^/]+(?:\/pricing-cache)?$/.test(pathname)
  ) {
    return "creditProviders";
  }

  return undefined;
}

export interface ApiServerOptions {
  adminConsoleRepository?: AdminConsoleRepository;
  authDataRepository?: AuthDataRepository;
  creditAccountRepository?: CreditAccountRepository;
  requestAuthenticator?: RequestAuthenticator;
  resolveAccessToken?: (accessToken: string) => AuthenticatedRequestContext | undefined;
  verifyTurnstileToken?: TurnstileVerifier;
  allowDegradedPersistence?: boolean;
  probeServerSupabasePersistence?: (
    config: ServerSupabaseConfig,
  ) => Promise<ServerSupabasePersistenceProbe>;
}

type RepositoryBackend = "memory" | "supabase" | "local-file" | "custom";
const tempUserRateLimitRule = { max: 10, windowMs: 60 * 60 * 1000 } as const;

function resolveRepositoryBackend(
  repository: unknown,
  inMemoryCtor: abstract new (...args: any[]) => unknown,
  supabaseCtor: abstract new (...args: any[]) => unknown,
  localFileCtor?: abstract new (...args: any[]) => unknown,
): RepositoryBackend {
  if (repository instanceof inMemoryCtor) {
    return "memory";
  }

  if (repository instanceof supabaseCtor) {
    return "supabase";
  }

  if (localFileCtor && repository instanceof localFileCtor) {
    return "local-file";
  }

  return "custom";
}

function createAdminConsoleRepository(serverSupabaseConfig: ServerSupabaseConfig): AdminConsoleRepository {
  if (serverSupabaseConfig.supabaseUrl && serverSupabaseConfig.serviceRoleKey) {
    apiLogger.info("Using Supabase admin console repository", {
      ...summarizeServerSupabaseConfig(serverSupabaseConfig),
    });
    return new SupabaseAdminConsoleRepository({
      supabaseUrl: serverSupabaseConfig.supabaseUrl,
      serviceRoleKey: serverSupabaseConfig.serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory admin console repository", {
    ...summarizeServerSupabaseConfig(serverSupabaseConfig),
  });
  return new InMemoryAdminConsoleRepository();
}

function createCreditAccountRepository(serverSupabaseConfig: ServerSupabaseConfig): CreditAccountRepository {
  if (serverSupabaseConfig.supabaseUrl && serverSupabaseConfig.serviceRoleKey) {
    apiLogger.info("Using Supabase credit account repository", {
      ...summarizeServerSupabaseConfig(serverSupabaseConfig),
    });
    return new SupabaseCreditAccountRepository({
      supabaseUrl: serverSupabaseConfig.supabaseUrl,
      serviceRoleKey: serverSupabaseConfig.serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory credit account repository", {
    ...summarizeServerSupabaseConfig(serverSupabaseConfig),
  });
  return new InMemoryCreditAccountRepository();
}

function createCreditExchangeRateRepository(
  serverSupabaseConfig: ServerSupabaseConfig,
): CreditExchangeRateRepository {
  if (serverSupabaseConfig.supabaseUrl && serverSupabaseConfig.serviceRoleKey) {
    apiLogger.info("Using Supabase credit exchange-rate repository", {
      ...summarizeServerSupabaseConfig(serverSupabaseConfig),
    });
    return new SupabaseCreditExchangeRateRepository({
      supabaseUrl: serverSupabaseConfig.supabaseUrl,
      serviceRoleKey: serverSupabaseConfig.serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory credit exchange-rate repository", {
    ...summarizeServerSupabaseConfig(serverSupabaseConfig),
  });
  return new InMemoryCreditExchangeRateRepository();
}

function createCreditProviderRepository(serverSupabaseConfig: ServerSupabaseConfig) {
  if (serverSupabaseConfig.supabaseUrl && serverSupabaseConfig.serviceRoleKey) {
    apiLogger.info("Using Supabase credit provider repository", {
      ...summarizeServerSupabaseConfig(serverSupabaseConfig),
    });
    return new SupabaseCreditProviderRepository({
      supabaseUrl: serverSupabaseConfig.supabaseUrl,
      serviceRoleKey: serverSupabaseConfig.serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory credit provider repository", {
    ...summarizeServerSupabaseConfig(serverSupabaseConfig),
  });
  return new InMemoryCreditProviderRepository();
}

function createAuthDataRepository(serverSupabaseConfig: ServerSupabaseConfig) {
  if (serverSupabaseConfig.supabaseUrl && serverSupabaseConfig.serviceRoleKey) {
    apiLogger.info("Using Supabase auth data repository", {
      ...summarizeServerSupabaseConfig(serverSupabaseConfig),
    });
    return new SupabaseAuthDataRepository({
      supabaseUrl: serverSupabaseConfig.supabaseUrl,
      serviceRoleKey: serverSupabaseConfig.serviceRoleKey,
      storageEncryptionKey: serverSupabaseConfig.userApiEncryptionSecret,
    });
  }

  apiLogger.warn("Falling back to file-backed local auth data repository", {
    ...summarizeServerSupabaseConfig(serverSupabaseConfig),
  });
  return new FileBackedAuthDataRepository({
    storageEncryptionKey: serverSupabaseConfig.userApiEncryptionSecret,
  });
}

function createWorkspaceLayoutRepository(serverSupabaseConfig: ServerSupabaseConfig) {
  if (serverSupabaseConfig.supabaseUrl && serverSupabaseConfig.serviceRoleKey) {
    apiLogger.info("Using Supabase workspace layout repository", {
      ...summarizeServerSupabaseConfig(serverSupabaseConfig),
    });
    return new SupabaseWorkspaceLayoutRepository({
      supabaseUrl: serverSupabaseConfig.supabaseUrl,
      serviceRoleKey: serverSupabaseConfig.serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory workspace layout repository", {
    ...summarizeServerSupabaseConfig(serverSupabaseConfig),
  });
  return new InMemoryWorkspaceLayoutRepository();
}

function createWechatAuthService(serverSupabaseConfig: ServerSupabaseConfig): WechatAuthService | undefined {
  const providerAppId = env.get("WECHAT_OPEN_APP_ID");
  const providerSecret = env.get("WECHAT_OPEN_APP_SECRET");
  const callbackUrl = env.get("WECHAT_OPEN_REDIRECT_URI");
  const stateSigningSecret = env.get("WECHAT_STATE_SIGNING_SECRET");
  const allowedRedirectOrigins = String(env.get("WECHAT_ALLOWED_REDIRECT_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!serverSupabaseConfig.supabaseUrl || !serverSupabaseConfig.serviceRoleKey) {
    apiLogger.warn("WeChat auth service is disabled because Supabase admin config is unavailable.", {
      ...summarizeServerSupabaseConfig(serverSupabaseConfig),
    });
    return undefined;
  }

  if (!providerAppId || !providerSecret || !callbackUrl || !stateSigningSecret) {
    apiLogger.warn("WeChat auth service is disabled because WeChat env vars are incomplete.", {
      hasProviderAppId: Boolean(providerAppId),
      hasProviderSecret: Boolean(providerSecret),
      hasCallbackUrl: Boolean(callbackUrl),
      hasStateSigningSecret: Boolean(stateSigningSecret),
    });
    return undefined;
  }

  return new WechatAuthService({
    repository: new SupabaseWechatAuthRepository({
      supabaseUrl: serverSupabaseConfig.supabaseUrl,
      serviceRoleKey: serverSupabaseConfig.serviceRoleKey,
    }),
    providerAppId,
    providerSecret,
    callbackUrl,
    stateSigningSecret,
    allowedRedirectOrigins,
  });
}

function buildRuntimePersistenceState(
  serverSupabaseConfig: ServerSupabaseConfig,
  repositoryModes: RepositoryModeMap,
  persistenceProbe?: ServerSupabasePersistenceProbe,
): RuntimePersistenceState {
  const configSummary = summarizeServerSupabaseConfig(serverSupabaseConfig, {
    persistenceProbe,
  });
  const criticalPersistence = {
    authData: buildCriticalPersistenceState(
      "Profile user API storage",
      { authData: repositoryModes.authData },
      configSummary,
      { authData: "AUTH_DATA_REPOSITORY_DEGRADED" },
      [persistenceProbe?.checks.authData],
      configSummary.hasUserApiEncryptionSecret ? [] : ["USER_API_ENCRYPTION_SECRET_MISSING"],
    ),
    guestSessions: buildCriticalPersistenceState(
      "Guest temp sessions",
      { authData: repositoryModes.authData },
      configSummary,
      { authData: "AUTH_DATA_REPOSITORY_DEGRADED" },
      [persistenceProbe?.checks.guestSessions],
    ),
    workspaceLayout: buildCriticalPersistenceState(
      "Workspace layout sync",
      { workspaceLayout: repositoryModes.workspaceLayout },
      configSummary,
      { workspaceLayout: "WORKSPACE_LAYOUT_REPOSITORY_DEGRADED" },
      [persistenceProbe?.checks.workspaceLayout],
    ),
    billing: buildCriticalPersistenceState(
      "Billing and credit persistence",
      {
        creditAccounts: repositoryModes.creditAccounts,
        creditExchangeRates: repositoryModes.creditExchangeRates,
      },
      configSummary,
      {
        creditAccounts: "CREDIT_ACCOUNT_REPOSITORY_DEGRADED",
        creditExchangeRates: "CREDIT_EXCHANGE_RATE_REPOSITORY_DEGRADED",
      },
      [persistenceProbe?.checks.billing],
    ),
    creditProviders: buildCriticalPersistenceState(
      "Credit provider catalog",
      { creditProviders: repositoryModes.creditProviders },
      configSummary,
      { creditProviders: "CREDIT_PROVIDER_REPOSITORY_DEGRADED" },
      [persistenceProbe?.checks.creditProviders],
    ),
  } satisfies Record<CriticalPersistenceCapability, CriticalPersistenceState>;

  return {
    configSummary,
    criticalPersistence,
    runtimeBlockers: dedupeStrings(
      Object.values(criticalPersistence).flatMap((state) => state.blockers),
    ),
  };
}

function logApiServerStarted(server: Server, requestedPort: number) {
  const address = server.address();
  const resolvedPort = address && typeof address !== "string"
    ? address.port
    : requestedPort;
  apiLogger.info("API skeleton server started", { port: resolvedPort });
}

function listenApiServer(server: Server, port: number): Promise<Server> {
  if (server.listening) {
    return Promise.resolve(server);
  }

  return new Promise((resolve, reject) => {
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const handleListening = () => {
      cleanup();
      logApiServerStarted(server, port);
      resolve(server);
    };
    const cleanup = () => {
      server.off("error", handleError);
      server.off("listening", handleListening);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);

    try {
      server.listen(port);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function isHostedRuntime(): boolean {
  return Boolean(
    process.env.VERCEL
    || process.env.VERCEL_ENV
    || (process.env.CONTEXT && process.env.CONTEXT !== "dev"),
  );
}

function assertHostedApiRuntimeReady(serverSupabaseConfig: ServerSupabaseConfig) {
  if (!isHostedRuntime()) {
    return;
  }

  const configSummary = summarizeServerSupabaseConfig(serverSupabaseConfig);
  if (!configSummary.canonicalPersistenceReady || !configSummary.hasUserApiEncryptionSecret) {
    throw new Error("Hosted API runtime requires canonical Supabase persistence.");
  }
}

function buildApiServer(
  port = Number(process.env.PORT || 3001),
  options: ApiServerOptions = {},
) {
  const serverSupabaseConfig = resolveServerSupabaseConfig();
  assertHostedApiRuntimeReady(serverSupabaseConfig);
  const allowDegradedPersistence = options.allowDegradedPersistence ?? (port === 0);
  if (!allowDegradedPersistence) {
    assertServerSupabaseConfigConsistency(serverSupabaseConfig);
  }
  const authDataRepository = options.authDataRepository || createAuthDataRepository(serverSupabaseConfig);
  const adminConsoleRepository =
    options.adminConsoleRepository || createAdminConsoleRepository(serverSupabaseConfig);
  const creditAccountRepository =
    options.creditAccountRepository || createCreditAccountRepository(serverSupabaseConfig);
  const creditExchangeRateRepository = createCreditExchangeRateRepository(serverSupabaseConfig);
  const creditProviderRepository = createCreditProviderRepository(serverSupabaseConfig);
  const workspaceLayoutRepository = createWorkspaceLayoutRepository(serverSupabaseConfig);
  const authService = new AuthService({
    verifyTurnstileToken: options.verifyTurnstileToken || defaultTurnstileVerifier,
  });
  const authDataCloudMirror =
    !serverSupabaseConfig.serviceRoleKey
    && serverSupabaseConfig.supabaseUrl
    && serverSupabaseConfig.authKey
    && serverSupabaseConfig.userApiEncryptionSecret
      ? new SupabaseUserScopedAuthDataMirror({
          supabaseUrl: serverSupabaseConfig.supabaseUrl,
          authKey: serverSupabaseConfig.authKey,
          storageEncryptionKey: serverSupabaseConfig.userApiEncryptionSecret,
        })
      : undefined;
  const authDataService = new AuthDataService(authDataRepository, {
    cloudMirror: authDataCloudMirror,
  });
  const userRouteDiagnosticsService = new UserRouteDiagnosticsService(authDataService);
  const localSystemProxyService = new LocalSystemProxyService(serverSupabaseConfig);
  const localUserRouteProxyService = new LocalUserRouteProxyService(authDataService, serverSupabaseConfig);
  const adminConsoleService = new AdminConsoleService(adminConsoleRepository);
  const assetLibraryService = new AssetLibraryService(new InMemoryAssetLibraryRepository());
  const creditAccountService = new CreditAccountService(creditAccountRepository);
  const creditExchangeRateService = new CreditExchangeRateService(creditExchangeRateRepository);
  const requestAuthenticator = options.requestAuthenticator || createRequestAuthenticator({
    resolveLegacyAccessToken: (accessToken) => {
      const resolvedOverride = options.resolveAccessToken?.(accessToken);
      if (resolvedOverride) {
        return resolvedOverride;
      }

      const profile = authService.resolveAccessToken(accessToken);
      if (!profile) {
        return undefined;
      }

      return {
        userId: profile.id,
        email: profile.email || undefined,
        role: profile.role,
      };
    },
    supabaseUrl: serverSupabaseConfig.supabaseUrl,
    supabaseAuthKey: serverSupabaseConfig.authKey,
  });
  const tempUserRateLimiter = new InMemoryRateLimiter();
  const generationService = new GenerationService(new InMemoryGenerationTaskRepository());
  const modelCatalogService = new ModelCatalogService(new InMemoryModelCatalogRepository());
  const creditProviderService = new CreditProviderService(creditProviderRepository);
  const workflowRepository = new InMemoryWorkflowRepository();
  const workflowService = new WorkflowService(workflowRepository);
  const workspaceCanvasService = new WorkspaceCanvasService(
    workflowRepository,
    workspaceLayoutRepository,
  );
  const wechatAuthService = createWechatAuthService(serverSupabaseConfig);
  const repositoryModes = {
    adminConsole: resolveRepositoryBackend(
      adminConsoleRepository,
      InMemoryAdminConsoleRepository,
      SupabaseAdminConsoleRepository,
    ),
    authData: resolveRepositoryBackend(
      authDataRepository,
      InMemoryAuthDataRepository,
      SupabaseAuthDataRepository,
      FileBackedAuthDataRepository,
    ),
    creditAccounts: resolveRepositoryBackend(
      creditAccountRepository,
      InMemoryCreditAccountRepository,
      SupabaseCreditAccountRepository,
    ),
    creditExchangeRates: resolveRepositoryBackend(
      creditExchangeRateRepository,
      InMemoryCreditExchangeRateRepository,
      SupabaseCreditExchangeRateRepository,
    ),
    creditProviders: resolveRepositoryBackend(
      creditProviderRepository,
      InMemoryCreditProviderRepository,
      SupabaseCreditProviderRepository,
    ),
    workspaceLayout: resolveRepositoryBackend(
      workspaceLayoutRepository,
      InMemoryWorkspaceLayoutRepository,
      SupabaseWorkspaceLayoutRepository,
    ),
  } as const;
  const resolvePersistenceProbe = options.probeServerSupabasePersistence || probeServerSupabasePersistence;
  let cachedPersistenceProbe: ServerSupabasePersistenceProbe | undefined;
  let cachedPersistenceProbeAt = 0;
  let pendingPersistenceProbe: Promise<ServerSupabasePersistenceProbe> | undefined;
  const persistenceProbeTtlMs = 30_000;

  async function getPersistenceProbe(): Promise<ServerSupabasePersistenceProbe> {
    const now = Date.now();
    if (cachedPersistenceProbe && (now - cachedPersistenceProbeAt) < persistenceProbeTtlMs) {
      return cachedPersistenceProbe;
    }

    if (!pendingPersistenceProbe) {
      pendingPersistenceProbe = resolvePersistenceProbe(serverSupabaseConfig)
        .then((probe) => {
          cachedPersistenceProbe = probe;
          cachedPersistenceProbeAt = Date.now();
          return probe;
        })
        .finally(() => {
          pendingPersistenceProbe = undefined;
        });
    }

    return pendingPersistenceProbe;
  }

  const server = createServer((req, res) => {
    void (async () => {
      const rawHeaders = normalizeHeaders(req);
      const headers = stripAuthenticatedHeaders(rawHeaders);
      const requestId = headers["x-request-id"] || randomUUID();
      const clientVersion = getClientVersion(req);
      const url = new URL(req.url || "/", "http://localhost");
      const pathname = url.pathname;
      const userRouteConnectivityMatch = pathname.match(/^\/api\/v1\/profile\/user-routes\/([^/]+)\/connectivity$/);
      const userRoutePricingMatch = pathname.match(/^\/api\/v1\/profile\/user-routes\/([^/]+)\/pricing-sync$/);

      try {
        const requiredCapability = !allowDegradedPersistence
          ? resolveCriticalPersistenceCapability(pathname)
          : undefined;
        const forceHealthProbe = pathname === "/healthz" && isTruthyQueryValue(url.searchParams.get("probe"));
        const shouldProbePersistence = forceHealthProbe || Boolean(requiredCapability);
        const persistenceProbe = shouldProbePersistence
          ? await getPersistenceProbe()
          : cachedPersistenceProbe;
        const {
          configSummary,
          criticalPersistence,
          runtimeBlockers,
        } = buildRuntimePersistenceState(serverSupabaseConfig, repositoryModes, persistenceProbe);

        if (pathname === "/healthz") {
          const overallStatus = Object.values(criticalPersistence).every((state) => state.ready)
            ? "ok"
            : "degraded";
          writeJson(res, 200, {
            success: true,
            data: {
              service: "kk-studio-api",
              status: overallStatus,
              config: configSummary,
              repositories: repositoryModes,
              persistence: {
                userApiKeys:
                  repositoryModes.authData === "supabase"
                  && configSummary.hasUserApiEncryptionSecret,
                keyManager:
                  repositoryModes.authData === "supabase"
                  && configSummary.hasUserApiEncryptionSecret,
                authData: criticalPersistence.authData.ready,
                tempUsers: criticalPersistence.guestSessions.ready,
                credits: criticalPersistence.billing.ready,
                creditProviders: criticalPersistence.creditProviders.ready,
                workspaceLayout: criticalPersistence.workspaceLayout.ready,
              },
              runtime: {
                allowDegradedPersistence,
                blockers: runtimeBlockers,
                criticalPersistence,
              },
            },
            meta: {
              requestId,
              clientVersion,
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        if (pathname === "/api/manifest") {
          writeJson(res, 200, buildApiManifest(requestId, clientVersion));
          return;
        }

        if (!allowDegradedPersistence) {
          if (requiredCapability) {
            const state = criticalPersistence[requiredCapability];
            if (!state.ready) {
              writeJson(
                res,
                503,
                buildServerConfigErrorResponse(
                  requestId,
                  clientVersion,
                  requiredCapability,
                  state,
                ),
              );
              return;
            }
          }
        }

        const authenticatedUser = await requestAuthenticator.authenticate(headers);
        const tempUserId = String(resolveTempUserId(headers) || "").trim();
        const tempUserSession = !authenticatedUser && tempUserId
          ? await authDataService.resolveTempUserSession(tempUserId)
          : null;
        const effectiveAuthenticatedUser = authenticatedUser || (
          tempUserSession
            ? {
              userId: tempUserSession.userId,
              email: tempUserSession.email || undefined,
              role: undefined,
            }
            : undefined
        );
        let requestHeaders = headers;
        if (effectiveAuthenticatedUser) {
          const access = await adminConsoleService.getAccess(
            effectiveAuthenticatedUser.userId,
            requestId,
            clientVersion,
            resolveAdminSessionToken(headers),
          );
          const authenticatedRole = access.success
            ? access.data.role
            : effectiveAuthenticatedUser.role;

          requestHeaders = applyAuthenticatedHeaders(headers, {
            ...effectiveAuthenticatedUser,
            role: authenticatedRole,
          });

          if (access.success && access.data.adminSessionActive) {
            requestHeaders[AUTHENTICATED_ADMIN_SESSION_HEADER] = "true";
            if (access.data.adminSessionExpiresAt) {
              requestHeaders[AUTHENTICATED_ADMIN_SESSION_EXPIRES_AT_HEADER] = access.data.adminSessionExpiresAt;
            }
          }
        }

        if (req.method === "POST" && pathname === "/api/v1/auth/register") {
          const body = await readJsonBody(req);
          const result = await handleVersionedRegister(authService, body, requestHeaders, getRequestIp(req));
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/auth/temp-users") {
          if (!tempUserRateLimiter.consume("temp-user-ip", getRequestIp(req), tempUserRateLimitRule)) {
            writeJson(res, 429, {
              success: false,
              error: {
                code: "RATE_LIMITED",
                message: "Too many temporary-user requests from this IP.",
              },
              meta: buildErrorMeta(requestId, clientVersion),
            });
            return;
          }
          const result = await handleCreateTempUser(authDataService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/auth/login") {
          const body = await readJsonBody(req);
          const result = await handleVersionedLogin(authService, body, requestHeaders, getRequestIp(req));
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/auth/wechat/start") {
          if (!wechatAuthService) {
            writeJson(res, 503, {
              success: false,
              error: {
                code: "WECHAT_AUTH_UNAVAILABLE",
                message: "WeChat login is not configured on the API server.",
              },
              meta: buildErrorMeta(requestId, clientVersion),
            });
            return;
          }

          const result = await handleStartWechatLogin(wechatAuthService, url.searchParams, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/auth/wechat/bind/start") {
          if (!wechatAuthService) {
            writeJson(res, 503, {
              success: false,
              error: {
                code: "WECHAT_AUTH_UNAVAILABLE",
                message: "WeChat account binding is not configured on the API server.",
              },
              meta: buildErrorMeta(requestId, clientVersion),
            });
            return;
          }

          const result = await handleStartWechatBind(wechatAuthService, url.searchParams, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/auth/wechat/callback") {
          if (!wechatAuthService) {
            writeJson(res, 503, {
              success: false,
              error: {
                code: "WECHAT_AUTH_UNAVAILABLE",
                message: "WeChat callback handling is not configured on the API server.",
              },
              meta: buildErrorMeta(requestId, clientVersion),
            });
            return;
          }

          const result = await handleWechatCallback(wechatAuthService, url.searchParams, requestHeaders);
          if (result.redirectTo) {
            writeRedirect(res, result.redirectTo, result.statusCode);
            return;
          }

          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/profile") {
          const result = await handleGetProfile(authService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "PATCH" && pathname === "/api/v1/profile") {
          const body = await readJsonBody(req);
          const result = await handleUpdateProfile(authService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/profile/user-apis") {
          const result = await handleGetUserApiEntries(authDataService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "PUT" && pathname === "/api/v1/profile/user-apis") {
          const body = await readJsonBody(req, {
            maxBytes: resolveJsonBodyMaxBytes(pathname),
          });
          const result = await handleReplaceUserApiEntries(authDataService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "PUT" && pathname === "/api/v1/profile/user-apis/payload") {
          const body = await readJsonBody(req, {
            maxBytes: resolveJsonBodyMaxBytes(pathname),
          });
          const result = await handleReplaceUserApisPayload(authDataService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/profile/key-manager-state") {
          const result = await handleGetKeyManagerCloudState(authDataService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "PUT" && pathname === "/api/v1/profile/key-manager-state") {
          const body = await readJsonBody(req, {
            maxBytes: resolveJsonBodyMaxBytes(pathname),
          });
          const result = await handleReplaceKeyManagerCloudState(authDataService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && userRouteConnectivityMatch) {
          const result = await handleCheckUserRouteConnectivity(
            userRouteDiagnosticsService,
            decodeURIComponent(userRouteConnectivityMatch[1] || ""),
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && userRoutePricingMatch) {
          const result = await handleSyncUserRoutePricing(
            userRouteDiagnosticsService,
            decodeURIComponent(userRoutePricingMatch[1] || ""),
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/model-proxy/system") {
          const body = await readJsonBody(req);
          const result = await handleInvokeLocalSystemProxy(
            localSystemProxyService,
            body,
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/model-proxy/user") {
          const body = await readJsonBody(req);
          const result = await handleInvokeLocalUserRouteProxy(
            localUserRouteProxyService,
            body,
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/admin/access") {
          const result = await handleGetAdminAccess(adminConsoleService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/admin/session/verify-password") {
          const body = await readJsonBody(req);
          const result = await handleVerifyAdminPassword(adminConsoleService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/admin/password") {
          const body = await readJsonBody(req);
          const result = await handleChangeAdminPassword(adminConsoleService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/admin/users/roles") {
          const body = await readJsonBody(req);
          const result = await handleSetUserRole(adminConsoleService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/billing/credits/balance") {
          const result = await handleGetCreditBalance(creditAccountService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/billing/credits/transactions") {
          const result = await handleListCreditTransactions(creditAccountService, {
              transactionType: url.searchParams.get("transactionType") || undefined,
              status: url.searchParams.get("status") || undefined,
              limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
          }, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/billing/exchange-rates") {
          const result = await handleListCreditExchangeRates(creditExchangeRateService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/assets") {
          const result = await handleListAssets(assetLibraryService, {
              kind: url.searchParams.get("kind") || undefined,
              cursor: url.searchParams.get("cursor") || undefined,
              limit: url.searchParams.get("limit") || undefined,
          }, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/billing/credits/debit") {
          const body = await readJsonBody(req);
          const result = await handleDebitCredits(creditAccountService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/billing/credits/refunds") {
          const body = await readJsonBody(req);
          const result = await handleRefundCredits(creditAccountService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "PUT" && pathname === "/api/v1/admin/billing/exchange-rates") {
          const body = await readJsonBody(req);
          const result = await handleUpsertCreditExchangeRate(creditExchangeRateService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/internal/v1/payment-settlements") {
          const body = await readJsonBody(req);
          const result = await handleApplyPaymentSettlement(creditAccountService, body, headers);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/generation-tasks") {
          const body = await readJsonBody(req);
          const result = await handleCreateGenerationTask(generationService, body, requestHeaders);
          const statusCode = result.success
            ? 202
            : result.error.code === "AUTH_REQUIRED"
              ? 401
              : 400;
          writeJson(
            res,
            statusCode,
            result,
          );
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/model-catalog/models") {
          const result = await handleListModels(modelCatalogService, url.searchParams.get("kind") || undefined, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/model-catalog/active-credit-models") {
          const result = await handleListActiveCreditModels(creditProviderService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (pathname === "/api/v1/provider-pricing-cache" && req.method === "GET") {
          const result = await handleGetSharedProviderPricingCache(
            creditProviderService,
            url.searchParams.get("baseUrl") || "",
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (pathname === "/api/v1/provider-pricing-cache" && req.method === "PUT") {
          const body = await readJsonBody(req);
          const result = await handleUpsertSharedProviderPricingCache(
            creditProviderService,
            url.searchParams.get("baseUrl") || "",
            body,
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        const workspaceCanvasMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/canvas$/);
        if (workspaceCanvasMatch && req.method === "GET") {
          const [, workspaceId] = workspaceCanvasMatch;
          const result = await handleGetWorkspaceCanvas(workspaceCanvasService, workspaceId, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/workspaces/layout") {
          const result = await handleGetWorkspaceLayout(workspaceCanvasService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "PUT" && pathname === "/api/v1/workspaces/layout") {
          const body = await readJsonBody(req);
          const result = await handleSaveWorkspaceLayout(workspaceCanvasService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "DELETE" && pathname === "/api/v1/workspaces/layout/cloud-images") {
          const result = await handleCleanupCloudImages(workspaceCanvasService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/admin/models") {
          const body = await readJsonBody(req);
          const result = await handleCreateAdminModel(modelCatalogService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/admin/credit-providers") {
          const result = await handleListAdminCreditProviders(creditProviderService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        const adminCreditProviderPricingCacheMatch = pathname.match(
          /^\/api\/v1\/admin\/credit-providers\/([^/]+)\/pricing-cache$/,
        );
        if (adminCreditProviderPricingCacheMatch && req.method === "GET") {
          const result = await handleGetAdminCreditProviderPricingCache(
            creditProviderService,
            decodeURIComponent(adminCreditProviderPricingCacheMatch[1]),
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (adminCreditProviderPricingCacheMatch && req.method === "PUT") {
          const body = await readJsonBody(req);
          const result = await handleUpsertAdminCreditProviderPricingCache(
            creditProviderService,
            decodeURIComponent(adminCreditProviderPricingCacheMatch[1]),
            body,
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        const adminCreditProviderMatch = pathname.match(/^\/api\/v1\/admin\/credit-providers\/([^/]+)$/);
        if (adminCreditProviderMatch && req.method === "PUT") {
          const body = await readJsonBody(req);
          const result = await handleSaveAdminCreditProvider(
            creditProviderService,
            decodeURIComponent(adminCreditProviderMatch[1]),
            body,
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (adminCreditProviderMatch && req.method === "DELETE") {
          const result = await handleDeleteAdminCreditProvider(
            creditProviderService,
            decodeURIComponent(adminCreditProviderMatch[1]),
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/admin/billing/recharges") {
          const body = await readJsonBody(req);
          const result = await handleAdminRechargeCredits(creditAccountService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        const generationTaskMatch = pathname.match(/^\/api\/v1\/generation-tasks\/([^/]+)$/);
        if (req.method === "GET" && generationTaskMatch) {
          const result = await handleGetGenerationTask(generationService, generationTaskMatch[1], requestHeaders);
          const statusCode = result.success
            ? 200
            : result.error.code === "AUTH_REQUIRED"
              ? 401
              : 404;
          writeJson(
            res,
            statusCode,
            result,
          );
          return;
        }

        const workflowMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/workflows\/([^/]+)$/);
        if (workflowMatch && req.method === "PUT") {
          const [, workspaceId, workflowId] = workflowMatch;
          const body = await readJsonBody(req);
          const result = await handleSaveWorkflow(workflowService, workspaceId, workflowId, body, requestHeaders);
          writeJson(res, result.success === false ? 400 : 200, result);
          return;
        }

        if (workflowMatch && req.method === "GET") {
          const [, workspaceId, workflowId] = workflowMatch;
          const result = await handleGetWorkflow(workflowService, workspaceId, workflowId, requestHeaders);
          writeJson(res, result.success === false ? 404 : 200, result);
          return;
        }

        writeJson(res, 404, {
          success: false,
          error: {
            code: "ROUTE_NOT_FOUND",
            message: "The requested route is not registered in the API skeleton.",
            details: [{ method: req.method, url: req.url }],
          },
          meta: buildErrorMeta(requestId, clientVersion),
        });
      } catch (error: any) {
        if (error instanceof JsonBodyParseError) {
          writeJson(res, 400, {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
            meta: buildErrorMeta(requestId, clientVersion),
          });
          return;
        }

        if (error instanceof PayloadTooLargeError) {
          writeJson(res, 413, {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
            meta: buildErrorMeta(requestId, clientVersion),
          });
          return;
        }

        writeJson(res, 500, {
          success: false,
          error: {
            code: "API_SKELETON_ERROR",
            message: error?.message || "Unexpected API skeleton error.",
          },
          meta: buildErrorMeta(requestId, clientVersion),
        });
      }
    })();
  });

  return server;
}

export function createApiServer(
  port = Number(process.env.PORT || 3001),
  options: ApiServerOptions = {},
) {
  const server = buildApiServer(port, options);
  server.listen(port, () => {
    logApiServerStarted(server, port);
  });
  return server;
}

export async function startApiServer(
  port = Number(process.env.PORT || 3001),
  options: ApiServerOptions = {},
) {
  const server = buildApiServer(port, options);
  return listenApiServer(server, port);
}

if (process.env.RUN_KK_API_SKELETON === "true") {
  await startApiServer().catch((error: any) => {
    apiLogger.error("Failed to start API skeleton server", {
      port: Number(process.env.PORT || 3001),
      error: error?.message || String(error),
    });
    throw error;
  });
}
