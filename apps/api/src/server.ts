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
import { shouldAttemptBearerAuthentication } from "./lib/request-auth-scope.ts";
import {
  probeServerRuntimePersistence,
  resolveServerRuntimeConfig,
  summarizeServerRuntimeConfig,
  type ServerRuntimeConfig,
  type ServerRuntimePersistenceProbe,
} from "./lib/server-runtime-config.ts";
import { hasPostgresConfig } from "./lib/postgres.ts";
import {
  resolveServerAdminConfig,
  summarizeServerAdminConfig,
} from "./lib/server-admin-config.ts";
import {
  AdminConsoleService,
  type AdminConsoleRepository,
  createAdminConsoleRepositoryFromEnv,
  InMemoryAdminConsoleRepository,
  PostgresAdminConsoleRepository,
  handleChangeAdminPassword,
  handleGetAdminAccess,
  handleSetUserRole,
  handleVerifyAdminPassword,
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
  BrowserSessionService,
  FileBackedAuthDataRepository,
  GoogleAuthService,
  InMemoryAuthDataRepository,
  InMemoryBrowserSessionRepository,
  PostgresAuthDataRepository,
  PostgresWechatAuthRepository,
  createUserSessionRepositoryFromEnv,
  createAuthDataRepositoryFromEnv,
  createWechatAuthRepositoryFromEnv,
  type TurnstileVerifier,
  WechatAuthService,
  handleCreateTempUser,
  handleCheckUserRouteConnectivity,
  handleGetKeyManagerCloudState,
  handleGetProfile,
  handleGetSession,
  handleSendPasswordChangeCode,
  handleGoogleCallback,
  handleGetUserApiEntries,
  handleLogoutSession,
  handleReplaceUserApisPayload,
  handleRefreshSession,
  handleStartGoogleBind,
  handleStartGoogleLogin,
  handleStartWechatBind,
  handleStartWechatLogin,
  handleWechatCallback,
  handleReplaceKeyManagerCloudState,
  handleReplaceUserApiEntries,
  handleSyncUserRoutePricing,
  handleUpdatePassword,
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
  FileBackedCreditAccountRepository,
  FileBackedCreditExchangeRateRepository,
  FileBackedRechargePaymentChannelConfigRepository,
  FileBackedRechargeSubmissionRepository,
  InMemoryCreditAccountRepository,
  InMemoryCreditExchangeRateRepository,
  InMemoryRechargePaymentChannelConfigRepository,
  InMemoryRechargeSubmissionRepository,
  PostgresCreditAccountRepository,
  PostgresCreditExchangeRateRepository,
  PostgresRechargeSubmissionRepository,
  createCreditAccountRepositoryFromEnv,
  createCreditExchangeRateRepositoryFromEnv,
  createRechargeSubmissionRepositoryFromEnv,
  RechargePaymentChannelConfigService,
  StaticRechargeService,
  handleAdminRechargeCredits,
  handleCreateRechargeSubmission,
  handleGetAdminRechargeSubmission,
  handleListAdminRechargeSubmissions,
  handleListCreditExchangeRates,
  handleListRechargePaymentChannels,
  handleMarkRechargeSubmissionPaid,
  handleReviewRechargeSubmission,
  handleSubmitRecharge,
  handleSubmitRechargeProof,
  handleUpsertCreditExchangeRate,
  handleDebitCredits,
  handleGetAdminCreditAccount,
  handleGetCreditBalance,
  handleListCreditTransactions,
  handleRefundCredits,
} from "./modules/billing/index.ts";
import {
  createGenerationTaskRepositoryFromEnv,
  GenerationService,
  handleCreateGenerationTask,
  handleGetGenerationTask,
} from "./modules/generation/index.ts";
import {
  createCreditProviderRepositoryFromEnv,
  CreditProviderService,
  InMemoryCreditProviderRepository,
  InMemoryModelCatalogRepository,
  ModelCatalogService,
  PostgresCreditProviderRepository,
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
  createWorkflowRepositoryFromEnv,
  WorkflowService,
  InMemoryWorkflowRepository,
  PostgresWorkflowRepository,
  handleGetWorkflow,
  handleSaveWorkflow,
} from "./modules/workflow/index.ts";
import {
  InMemoryWorkspaceLayoutRepository,
  PostgresWorkspaceLayoutRepository,
  createWorkspaceLayoutRepositoryFromEnv,
  WorkspaceCanvasService,
  handleCleanupCloudImages,
  handleGetWorkspaceLayout,
  handleGetWorkspaceCanvas,
  handleSaveWorkspaceLayout,
} from "./modules/workspace-canvas/index.ts";

const emittedStartupModeLogKeys = new Set<string>();

export function resetStartupModeLogDedupForTests(): void {
  emittedStartupModeLogKeys.clear();
}

function logStartupMode(
  level: "info" | "warn",
  message: string,
  context?: Record<string, unknown>,
): void {
  const logKey = `${level}:${message}:${JSON.stringify(context || {})}`;
  if (emittedStartupModeLogKeys.has(logKey)) {
    return;
  }

  emittedStartupModeLogKeys.add(logKey);
  if (level === "warn") {
    apiLogger.warn(message, context);
    return;
  }

  apiLogger.info(message, context);
}

class JsonBodyParseError extends Error {
  readonly code = "INVALID_JSON_BODY";
}

class PayloadTooLargeError extends Error {
  readonly code = "PAYLOAD_TOO_LARGE";
}

const defaultMaxJsonBodyBytes = 1024 * 1024;
const defaultExpandedProfileJsonBodyBytes = 4 * 1024 * 1024;
const defaultModelProxyJsonBodyBytes = 16 * 1024 * 1024;
const corsAllowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const corsAllowedHeaders = [
  "authorization",
  "content-type",
  "x-admin-session-token",
  "x-client-version",
  "x-kk-temp-user-id",
  "x-request-id",
].join(", ");
const defaultPublicCorsOrigins = [
  "https://kkai.plus",
  "https://www.kkai.plus",
];

function resolveJsonBodyMaxBytes(pathname?: string): number {
  const defaultMaxBytes = Number(process.env.KK_API_MAX_JSON_BODY_BYTES || defaultMaxJsonBodyBytes);
  const expandedProfileMaxBytes = Number(
    process.env.KK_API_PROFILE_MAX_JSON_BODY_BYTES
      || process.env.KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES
      || Math.max(defaultMaxBytes, defaultExpandedProfileJsonBodyBytes),
  );
  const expandedModelProxyMaxBytes = Number(
    process.env.KK_API_MODEL_PROXY_MAX_JSON_BODY_BYTES
      || Math.max(defaultMaxBytes, defaultModelProxyJsonBodyBytes),
  );

  if (
    pathname === "/api/v1/profile/user-apis"
    || pathname === "/api/v1/profile/user-apis/payload"
    || pathname === "/api/v1/profile/key-manager-state"
  ) {
    return expandedProfileMaxBytes;
  }

  if (
    pathname === "/api/v1/model-proxy/system"
    || pathname === "/api/v1/model-proxy/user"
  ) {
    return expandedModelProxyMaxBytes;
  }

  return defaultMaxBytes;
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
  extraHeaders: Record<string, string | string[]> = {},
) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function normalizeCorsOrigin(value: string | undefined): string | undefined {
  const raw = String(value || "").trim();
  if (!raw) {
    return undefined;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

function isLoopbackCorsOrigin(origin: string): boolean {
  const normalizedOrigin = normalizeCorsOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  try {
    const parsed = new URL(normalizedOrigin);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "::1"
      || hostname === "[::1]";
  } catch {
    return false;
  }
}

function getConfiguredCorsOrigins(): Set<string> {
  const configuredOrigins = [
    ...defaultPublicCorsOrigins,
    process.env.KK_API_PUBLIC_ORIGIN,
    process.env.KK_API_ALLOWED_ORIGINS,
    process.env.KK_API_CORS_ALLOWED_ORIGINS,
  ]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => normalizeCorsOrigin(value))
    .filter((value): value is string => Boolean(value));

  return new Set(configuredOrigins);
}

function resolveCorsOrigin(req: IncomingMessage): string | undefined {
  const originHeader = req.headers.origin;
  const origin = normalizeCorsOrigin(Array.isArray(originHeader) ? originHeader[0] : originHeader);
  if (!origin) {
    return undefined;
  }

  if (isLoopbackCorsOrigin(origin)) {
    return origin;
  }

  if (getConfiguredCorsOrigins().has(origin)) {
    return origin;
  }

  return undefined;
}

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): boolean {
  const allowedOrigin = resolveCorsOrigin(req);
  res.setHeader("vary", "Origin");
  if (!allowedOrigin) {
    return false;
  }

  res.setHeader("access-control-allow-origin", allowedOrigin);
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("access-control-allow-methods", corsAllowedMethods);
  res.setHeader("access-control-allow-headers", corsAllowedHeaders);
  res.setHeader("access-control-max-age", "600");
  return true;
}

function writeOptionsResponse(req: IncomingMessage, res: ServerResponse) {
  applyCorsHeaders(req, res);
  res.writeHead(204, {
    "content-length": "0",
  });
  res.end();
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

function getRequestUserAgent(req: IncomingMessage): string {
  const header = req.headers["user-agent"];
  return Array.isArray(header) ? String(header[0] || "unknown") : String(header || "unknown");
}

function parseCookies(cookieHeader: string | string[] | undefined): Record<string, string> {
  const rawCookie = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : String(cookieHeader || "");
  if (!rawCookie.trim()) {
    return {};
  }

  return rawCookie
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, segment) => {
      const separatorIndex = segment.indexOf("=");
      if (separatorIndex <= 0) {
        return cookies;
      }

      const key = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();
      if (!key) {
        return cookies;
      }

      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
      return cookies;
    }, {});
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
  let payloadTooLargeError: PayloadTooLargeError | null = null;
  for await (const chunk of req) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bufferChunk.length;
    if (payloadTooLargeError) {
      continue;
    }
    if (Number.isFinite(maxBytes) && maxBytes > 0 && totalBytes > maxBytes) {
      // Drain the remaining request body so oversized callers receive the 413
      // response envelope instead of a socket reset.
      payloadTooLargeError = new PayloadTooLargeError(`Request body exceeds ${maxBytes} bytes.`);
      continue;
    }
    chunks.push(bufferChunk);
  }

  if (payloadTooLargeError) {
    throw payloadTooLargeError;
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

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function isFalsyEnvValue(value: string | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "0"
    || normalized === "false"
    || normalized === "no"
    || normalized === "off";
}

function getTurnstileErrorMessage(code: string): string {
  const errorMap: Record<string, string> = {
    "missing-input-secret": "Turnstile server secret is missing.",
    "invalid-input-secret": "Turnstile server secret is invalid.",
    "missing-input-response": "Complete the Turnstile challenge before submitting.",
    "invalid-input-response": "Turnstile verification failed. Try again.",
    "bad-request": "Turnstile verification request is malformed.",
    "timeout-or-duplicate": "Turnstile verification expired. Try again.",
    "internal-error": "Turnstile verification service is temporarily unavailable.",
  };

  return errorMap[code] || "Turnstile verification failed. Try again.";
}

const defaultTurnstileVerifier: TurnstileVerifier = async (token, ip) => {
  if (isFalsyEnvValue(process.env.KK_AUTH_REQUIRE_TURNSTILE)) {
    return { success: true };
  }

  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    return {
      success: false,
      error: "Turnstile verifier is not configured for the API skeleton. Set TURNSTILE_SECRET_KEY or KK_AUTH_REQUIRE_TURNSTILE=false.",
    };
  }

  if (!token) {
    return { success: false, error: "Complete the Turnstile challenge before submitting." };
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      return { success: false, error: "Turnstile verification service is temporarily unavailable." };
    }

    const data = await response.json() as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: getTurnstileErrorMessage(data["error-codes"]?.[0] || "unknown"),
    };
  } catch {
    return { success: false, error: "Turnstile verification service is temporarily unavailable." };
  }
};

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
  configSummary: ReturnType<typeof summarizeServerRuntimeConfig>;
  criticalPersistence: Record<CriticalPersistenceCapability, CriticalPersistenceState>;
  runtimeBlockers: string[];
}

interface CriticalPersistenceOptions {
  configReady?: boolean;
  readyBackends?: Partial<Record<string, RepositoryBackend[]>>;
  structuralBlockers?: string[];
}

function resolveProbeCheckBlockers(
  probe: ServerRuntimePersistenceProbe | undefined,
  capability: CriticalPersistenceCapability,
): string[] {
  const check = probe?.checks[capability];
  if (!check || check.ready) {
    return [];
  }

  return [check.blocker || "POSTGRES_PERSISTENCE_PROBE_FAILED"];
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isTruthyValue(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1"
    || normalized === "true"
    || normalized === "yes"
    || normalized === "on";
}

function isKkaiLocalOnlyRuntime(): boolean {
  return !isHostedRuntime() && isTruthyValue(process.env.KKAI_LOCAL_ONLY);
}

function resolveBrowserSessionCookieSecure(): boolean {
  if (isHostedRuntime()) {
    return true;
  }

  return isTruthyValue(process.env.KK_SESSION_COOKIE_SECURE);
}

function buildCriticalPersistenceState(
  label: string,
  repositories: Record<string, RepositoryBackend>,
  configSummary: ReturnType<typeof summarizeServerRuntimeConfig>,
  repositoryBlockers: Record<string, string>,
  extraBlockers: string[] = [],
  options: CriticalPersistenceOptions = {},
): CriticalPersistenceState {
  const readyBackends = options.readyBackends || {};
  const isRepositoryReady = ([key, repository]: [string, RepositoryBackend]) => {
    const acceptedBackends = readyBackends[key] || ["postgres"];
    return acceptedBackends.includes(repository);
  };
  const blockers = [
    ...(options.structuralBlockers ?? (Array.isArray(configSummary.structuralBlockers) ? configSummary.structuralBlockers : [])),
    ...Object.entries(repositories)
      .filter((entry) => !isRepositoryReady(entry))
      .map(([key]) => repositoryBlockers[key])
      .filter(Boolean),
    ...extraBlockers,
  ];

  return {
    label,
    ready:
      (options.configReady ?? Boolean(configSummary.canonicalConfigReady ?? configSummary.canonicalPersistenceReady))
      && Object.entries(repositories).every((entry) => isRepositoryReady(entry))
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
      message: `${state.label} require the API server to use the VPS PostgreSQL persistence backend.`,
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
  options: {
    localOnly?: boolean;
  } = {},
): CriticalPersistenceCapability | undefined {
  if (
    pathname === "/api/v1/profile/user-apis"
    || pathname === "/api/v1/profile/user-apis/payload"
    || pathname === "/api/v1/profile/key-manager-state"
  ) {
    return options.localOnly ? undefined : "authData";
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
    || pathname === "/api/v1/billing/payment-channels"
    || pathname === "/api/v1/billing/submit-recharge"
    || pathname === "/api/v1/billing/recharge-submissions"
    || /^\/api\/v1\/billing\/recharge-submissions\/[^/]+\/proof$/.test(pathname)
    || /^\/api\/v1\/billing\/recharge-submissions\/[^/]+\/mark-paid$/.test(pathname)
    || pathname === "/api/v1/billing/credits/debit"
    || pathname === "/api/v1/billing/credits/refunds"
    || pathname === "/api/v1/admin/billing/exchange-rates"
    || pathname === "/api/v1/admin/billing/recharges"
    || pathname === "/api/v1/admin/billing/recharge-submissions"
    || /^\/api\/v1\/admin\/billing\/recharge-submissions\/[^/]+(?:\/review)?$/.test(pathname)
    || pathname === "/internal/v1/payment-settlements"
  ) {
    return "billing";
  }

  if (
    pathname === "/api/v1/model-catalog/active"
    || pathname === "/api/v1/model-catalog/active-credit-models"
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
  localOnlyUser?: AuthenticatedRequestContext;
  requestAuthenticator?: RequestAuthenticator;
  resolveAccessToken?: (accessToken: string) => AuthenticatedRequestContext | undefined | Promise<AuthenticatedRequestContext | undefined>;
  verifyTurnstileToken?: TurnstileVerifier;
  allowDegradedPersistence?: boolean;
  probeServerRuntimePersistence?: (
    config: ServerRuntimeConfig,
  ) => Promise<ServerRuntimePersistenceProbe>;
}

type RepositoryBackend = "memory" | "postgres" | "local-file" | "custom";
const tempUserRateLimitRule = { max: 10, windowMs: 60 * 60 * 1000 } as const;

function normalizeAuthenticatedRequestContext(
  context: AuthenticatedRequestContext | undefined,
): AuthenticatedRequestContext | undefined {
  const userId = String(context?.userId || "").trim();
  if (!userId) {
    return undefined;
  }

  const email = String(context?.email || "").trim() || undefined;
  const role = String(context?.role || "").trim() || undefined;
  return {
    userId,
    ...(email ? { email } : {}),
    ...(role ? { role } : {}),
  };
}

function resolveRepositoryBackend(
  repository: unknown,
  inMemoryCtor: abstract new (...args: any[]) => unknown,
  postgresCtor?: abstract new (...args: any[]) => unknown,
  localFileCtor?: abstract new (...args: any[]) => unknown,
): RepositoryBackend {
  if (repository instanceof inMemoryCtor) {
    return "memory";
  }

  if (postgresCtor && repository instanceof postgresCtor) {
    return "postgres";
  }

  if (localFileCtor && repository instanceof localFileCtor) {
    return "local-file";
  }

  return "custom";
}

function createAdminConsoleRepository(serverRuntimeConfig: ServerRuntimeConfig): AdminConsoleRepository {
  if (isKkaiLocalOnlyRuntime()) {
    logStartupMode("warn", "Using in-memory admin console repository for KKAI local-only runtime", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
    });
    return new InMemoryAdminConsoleRepository();
  }

  const postgresRepository = createAdminConsoleRepositoryFromEnv();
  if (postgresRepository instanceof PostgresAdminConsoleRepository) {
    logStartupMode("info", "Using PostgreSQL admin console repository", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.PGHOST),
    });
    return postgresRepository;
  }

  logStartupMode("warn", "Falling back to in-memory admin console repository", {
    ...summarizeServerRuntimeConfig(serverRuntimeConfig),
  });
  return new InMemoryAdminConsoleRepository();
}

function createBrowserSessionService(): BrowserSessionService {
  const repository = createUserSessionRepositoryFromEnv()
    || new InMemoryBrowserSessionRepository();
  const sessionSigningSecret = String(process.env.KK_API_SESSION_SIGNING_SECRET || "").trim()
    || "kkai-local-dev-browser-session-secret";
  const normalizedSameSite = String(process.env.KK_SESSION_COOKIE_SAME_SITE || "").trim().toLowerCase();

  return new BrowserSessionService({
    repository,
    sessionSigningSecret,
    cookieName: String(process.env.KK_SESSION_COOKIE_NAME || "").trim() || undefined,
    secure: resolveBrowserSessionCookieSecure(),
    sameSite: normalizedSameSite === "strict" || normalizedSameSite === "none"
      ? normalizedSameSite
      : "lax",
  });
}

function createCreditAccountRepository(serverRuntimeConfig: ServerRuntimeConfig): CreditAccountRepository {
  if (isKkaiLocalOnlyRuntime()) {
    logStartupMode("warn", "Using file-backed credit account repository for KKAI local-only runtime", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
    });
    return new FileBackedCreditAccountRepository();
  }

  const postgresRepository = createCreditAccountRepositoryFromEnv();
  if (postgresRepository instanceof PostgresCreditAccountRepository) {
    logStartupMode("info", "Using PostgreSQL credit account repository", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.PGHOST),
    });
    return postgresRepository;
  }

  logStartupMode("warn", "Falling back to in-memory credit account repository", {
    ...summarizeServerRuntimeConfig(serverRuntimeConfig),
  });
  return new InMemoryCreditAccountRepository();
}

function createCreditExchangeRateRepository(
  serverRuntimeConfig: ServerRuntimeConfig,
): CreditExchangeRateRepository {
  if (isKkaiLocalOnlyRuntime()) {
    logStartupMode("warn", "Using file-backed credit exchange-rate repository for KKAI local-only runtime", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
    });
    return new FileBackedCreditExchangeRateRepository();
  }

  const postgresRepository = createCreditExchangeRateRepositoryFromEnv();
  if (postgresRepository instanceof PostgresCreditExchangeRateRepository) {
    logStartupMode("info", "Using PostgreSQL credit exchange-rate repository", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.PGHOST),
    });
    return postgresRepository;
  }

  logStartupMode("warn", "Falling back to in-memory credit exchange-rate repository", {
    ...summarizeServerRuntimeConfig(serverRuntimeConfig),
  });
  return new InMemoryCreditExchangeRateRepository();
}

function createCreditProviderRepository(serverRuntimeConfig: ServerRuntimeConfig) {
  if (isKkaiLocalOnlyRuntime()) {
    logStartupMode("warn", "Using in-memory credit provider repository for KKAI local-only runtime", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
    });
    return new InMemoryCreditProviderRepository();
  }

  const postgresRepository = createCreditProviderRepositoryFromEnv();
  if (postgresRepository instanceof PostgresCreditProviderRepository) {
    logStartupMode("info", "Using PostgreSQL credit provider repository", {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.PGHOST),
    });
    return postgresRepository;
  }

  logStartupMode("warn", "Falling back to in-memory credit provider repository", {
    ...summarizeServerRuntimeConfig(serverRuntimeConfig),
  });
  return new InMemoryCreditProviderRepository();
}

function createRechargeSubmissionRepository(serverRuntimeConfig: ServerRuntimeConfig) {
  if (isKkaiLocalOnlyRuntime()) {
    logStartupMode("warn", "Using file-backed recharge submission repository for KKAI local-only runtime", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
    });
    return new FileBackedRechargeSubmissionRepository();
  }

  const postgresRepository = createRechargeSubmissionRepositoryFromEnv();
  if (postgresRepository instanceof PostgresRechargeSubmissionRepository) {
    logStartupMode("info", "Using PostgreSQL recharge submission repository", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.PGHOST),
    });
    return postgresRepository;
  }

  logStartupMode("warn", "Falling back to in-memory recharge submission repository", {
    ...summarizeServerRuntimeConfig(serverRuntimeConfig),
  });
  return new InMemoryRechargeSubmissionRepository();
}

function createRechargePaymentChannelConfigRepository() {
  if (isKkaiLocalOnlyRuntime()) {
    return new FileBackedRechargePaymentChannelConfigRepository();
  }

  return new InMemoryRechargePaymentChannelConfigRepository();
}

function createAuthDataRepository(serverRuntimeConfig: ServerRuntimeConfig) {
  const postgresRepository = createAuthDataRepositoryFromEnv({
    storageEncryptionKey: serverRuntimeConfig.userApiEncryptionSecret,
  });
  if (postgresRepository instanceof PostgresAuthDataRepository) {
    logStartupMode("info", "Using PostgreSQL auth data repository", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.PGHOST),
    });
    return postgresRepository;
  }

  logStartupMode("warn", "Falling back to file-backed local auth data repository", {
    ...summarizeServerRuntimeConfig(serverRuntimeConfig),
  });
  return new FileBackedAuthDataRepository({
    storageEncryptionKey: serverRuntimeConfig.userApiEncryptionSecret,
  });
}

function createWorkspaceLayoutRepository(serverRuntimeConfig: ServerRuntimeConfig) {
  if (isKkaiLocalOnlyRuntime()) {
    logStartupMode("warn", "Using in-memory workspace layout repository for KKAI local-only runtime", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
    });
    return new InMemoryWorkspaceLayoutRepository();
  }

  const postgresRepository = createWorkspaceLayoutRepositoryFromEnv();
  if (postgresRepository instanceof PostgresWorkspaceLayoutRepository) {
    logStartupMode("info", "Using PostgreSQL workspace layout repository", {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.PGHOST),
    });
    return postgresRepository;
  }

  logStartupMode("warn", "Falling back to in-memory workspace layout repository", {
    ...summarizeServerRuntimeConfig(serverRuntimeConfig),
  });
  return new InMemoryWorkspaceLayoutRepository();
}

function createWechatAuthService(serverRuntimeConfig: ServerRuntimeConfig): WechatAuthService | undefined {
  const providerAppId = env.get("WECHAT_OPEN_APP_ID");
  const providerSecret = env.get("WECHAT_OPEN_APP_SECRET");
  const callbackUrl = env.get("WECHAT_OPEN_REDIRECT_URI");
  const stateSigningSecret = env.get("WECHAT_STATE_SIGNING_SECRET");
  const allowedRedirectOrigins = String(env.get("WECHAT_ALLOWED_REDIRECT_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const postgresRepository = createWechatAuthRepositoryFromEnv();
  if (!(postgresRepository instanceof PostgresWechatAuthRepository)) {
    logStartupMode("warn", "WeChat auth service is disabled because the PostgreSQL WeChat repository is unavailable.", {
      ...summarizeServerRuntimeConfig(serverRuntimeConfig),
    });
    return undefined;
  }

  if (!providerAppId || !providerSecret || !callbackUrl || !stateSigningSecret) {
    logStartupMode("warn", "WeChat auth service is disabled because WeChat env vars are incomplete.", {
      hasProviderAppId: Boolean(providerAppId),
      hasProviderSecret: Boolean(providerSecret),
      hasCallbackUrl: Boolean(callbackUrl),
      hasStateSigningSecret: Boolean(stateSigningSecret),
    });
    return undefined;
  }

  return new WechatAuthService({
    repository: postgresRepository,
    providerAppId,
    providerSecret,
    callbackUrl,
    stateSigningSecret,
    allowedRedirectOrigins,
  });
}

function createGoogleAuthService(): GoogleAuthService | undefined {
  const clientId = env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const callbackUrl = env.get("GOOGLE_OAUTH_REDIRECT_URI");
  const stateSigningSecret = env.get("GOOGLE_STATE_SIGNING_SECRET");
  const allowedRedirectOrigins = String(env.get("GOOGLE_ALLOWED_REDIRECT_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!clientId || !clientSecret || !callbackUrl || !stateSigningSecret || allowedRedirectOrigins.length === 0) {
    logStartupMode("warn", "Google auth service is disabled because Google OAuth env vars are incomplete.", {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      hasCallbackUrl: Boolean(callbackUrl),
      hasStateSigningSecret: Boolean(stateSigningSecret),
      allowedRedirectOriginCount: allowedRedirectOrigins.length,
    });
    return undefined;
  }

  return new GoogleAuthService({
    clientId,
    clientSecret,
    callbackUrl,
    stateSigningSecret,
    allowedRedirectOrigins,
  });
}

function buildRuntimePersistenceState(
  serverRuntimeConfig: ServerRuntimeConfig,
  repositoryModes: RepositoryModeMap,
  options: {
    localOnly?: boolean;
    persistenceProbe?: ServerRuntimePersistenceProbe;
  } = {},
): RuntimePersistenceState {
  const localOnly = options.localOnly === true;
  const configSummary = summarizeServerRuntimeConfig(serverRuntimeConfig, {
    persistenceProbe: options.persistenceProbe,
  });
  const criticalPersistence = {
    authData: buildCriticalPersistenceState(
      "Profile user API storage",
      { authData: repositoryModes.authData },
      configSummary,
      { authData: "AUTH_DATA_REPOSITORY_DEGRADED" },
      [
        ...(configSummary.hasUserApiEncryptionSecret ? [] : ["USER_API_ENCRYPTION_SECRET_MISSING"]),
        ...resolveProbeCheckBlockers(options.persistenceProbe, "authData"),
      ],
      {
        configReady: configSummary.hasUserApiEncryptionSecret,
        readyBackends: {
          authData: localOnly
            ? ["postgres", "local-file", "memory"]
            : ["postgres"],
        },
        structuralBlockers: [],
      },
    ),
    guestSessions: buildCriticalPersistenceState(
      "Guest temp sessions",
      { authData: repositoryModes.authData },
      configSummary,
      { authData: "AUTH_DATA_REPOSITORY_DEGRADED" },
      resolveProbeCheckBlockers(options.persistenceProbe, "guestSessions"),
      {
        configReady: true,
        readyBackends: {
          authData: localOnly
            ? ["postgres", "local-file", "memory"]
            : ["postgres"],
        },
        structuralBlockers: [],
      },
    ),
    workspaceLayout: buildCriticalPersistenceState(
      "Workspace layout sync",
      { workspaceLayout: repositoryModes.workspaceLayout },
      configSummary,
      { workspaceLayout: "WORKSPACE_LAYOUT_REPOSITORY_DEGRADED" },
      resolveProbeCheckBlockers(options.persistenceProbe, "workspaceLayout"),
      {
        configReady: true,
        readyBackends: {
          workspaceLayout: localOnly
            ? ["postgres", "memory"]
            : ["postgres"],
        },
        structuralBlockers: [],
      },
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
      resolveProbeCheckBlockers(options.persistenceProbe, "billing"),
      {
        configReady: true,
        readyBackends: {
          creditAccounts: localOnly
            ? ["postgres", "local-file"]
            : ["postgres"],
          creditExchangeRates: localOnly
            ? ["postgres", "local-file"]
            : ["postgres"],
        },
        structuralBlockers: [],
      },
    ),
    creditProviders: buildCriticalPersistenceState(
      "Credit provider catalog",
      { creditProviders: repositoryModes.creditProviders },
      configSummary,
      { creditProviders: "CREDIT_PROVIDER_REPOSITORY_DEGRADED" },
      resolveProbeCheckBlockers(options.persistenceProbe, "creditProviders"),
      {
        configReady: true,
        readyBackends: {
          creditProviders: localOnly
            ? ["postgres", "memory"]
            : ["postgres"],
        },
        structuralBlockers: [],
      },
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

function assertHostedApiRuntimeReady(
  serverRuntimeConfig: ServerRuntimeConfig,
  options: {
    allowDegradedPersistence: boolean;
  },
) {
  if (!isHostedRuntime() || options.allowDegradedPersistence) {
    return;
  }

  const hasSessionSigningSecret = Boolean(String(process.env.KK_API_SESSION_SIGNING_SECRET || "").trim());
  if (!hasPostgresConfig() || !serverRuntimeConfig.userApiEncryptionSecret || !hasSessionSigningSecret) {
    throw new Error(
      "Hosted API runtime requires PostgreSQL persistence plus USER_API_ENCRYPTION_SECRET and KK_API_SESSION_SIGNING_SECRET.",
    );
  }
}

function buildApiServer(
  port = Number(process.env.PORT || 3001),
  options: ApiServerOptions = {},
) {
  const serverRuntimeConfig = resolveServerRuntimeConfig();
  const serverAdminConfig = resolveServerAdminConfig();
  const serverAdminSummary = summarizeServerAdminConfig(serverAdminConfig);
  const kkaiLocalOnly = isKkaiLocalOnlyRuntime();
  const allowDegradedPersistence = options.allowDegradedPersistence ?? (port === 0);
  assertHostedApiRuntimeReady(serverRuntimeConfig, { allowDegradedPersistence });
  const localOnlyUser = normalizeAuthenticatedRequestContext(options.localOnlyUser);
  const authDataRepository = options.authDataRepository || createAuthDataRepository(serverRuntimeConfig);
  const adminConsoleRepository =
    options.adminConsoleRepository || createAdminConsoleRepository(serverRuntimeConfig);
  if (!serverAdminSummary.primaryAdminUserIdConfigured) {
    logStartupMode("warn", "Owner admin identity is not configured. Set KK_PRIMARY_ADMIN_USER_ID to lock the default administrator.", {
      blockers: serverAdminSummary.blockers,
    });
  }
  const creditAccountRepository =
    options.creditAccountRepository || createCreditAccountRepository(serverRuntimeConfig);
  const creditExchangeRateRepository = createCreditExchangeRateRepository(serverRuntimeConfig);
  const creditProviderRepository = createCreditProviderRepository(serverRuntimeConfig);
  const workspaceLayoutRepository = createWorkspaceLayoutRepository(serverRuntimeConfig);
  const browserSessionService = createBrowserSessionService();
  const authService = new AuthService({
    verifyTurnstileToken: options.verifyTurnstileToken || defaultTurnstileVerifier,
    browserSessionService,
  });
  const authDataCloudMirror = undefined;
  const authDataService = new AuthDataService(authDataRepository, {
    cloudMirror: authDataCloudMirror,
    localOnly: kkaiLocalOnly,
  });
  const userRouteDiagnosticsService = new UserRouteDiagnosticsService(authDataService);
  const localUserRouteProxyService = new LocalUserRouteProxyService(authDataService, serverRuntimeConfig);
  const adminConsoleService = new AdminConsoleService(adminConsoleRepository, {
    primaryAdminUserId: serverAdminConfig.primaryAdminUserId,
  });
  const assetLibraryService = new AssetLibraryService(new InMemoryAssetLibraryRepository());
  const creditAccountService = new CreditAccountService(creditAccountRepository, creditProviderRepository);
  const localSystemProxyService = new LocalSystemProxyService({
    creditProviderRepository,
    creditAccountService,
    directRouteInvoker: localUserRouteProxyService,
    taskSigningSecret: serverRuntimeConfig.userApiEncryptionSecret,
  });
  const creditExchangeRateService = new CreditExchangeRateService(creditExchangeRateRepository);
  const rechargePaymentChannelConfigService = new RechargePaymentChannelConfigService(
    createRechargePaymentChannelConfigRepository(),
  );
  const staticRechargeService = new StaticRechargeService({
    submissionRepository: createRechargeSubmissionRepository(serverRuntimeConfig),
    exchangeRateRepository: creditExchangeRateRepository,
    creditAccountService,
  });
  const requestAuthenticator = options.requestAuthenticator || createRequestAuthenticator({
    resolveLegacyAccessToken: async (accessToken) => {
      const resolvedOverride = options.resolveAccessToken
        ? await options.resolveAccessToken(accessToken)
        : undefined;
      if (resolvedOverride) {
        return resolvedOverride;
      }

      const profile = await authService.resolveAccessToken(accessToken);
      if (!profile) {
        return undefined;
      }

      return {
        userId: profile.id,
        email: profile.email || undefined,
        role: profile.role,
      };
    },
  });
  const tempUserRateLimiter = new InMemoryRateLimiter();
  const generationService = new GenerationService(createGenerationTaskRepositoryFromEnv());
  const modelCatalogService = new ModelCatalogService(new InMemoryModelCatalogRepository());
  const creditProviderService = new CreditProviderService(creditProviderRepository);
  const workflowRepository = createWorkflowRepositoryFromEnv();
  const workflowService = new WorkflowService(workflowRepository);
  const workspaceCanvasService = new WorkspaceCanvasService(
    workflowRepository,
    workspaceLayoutRepository,
  );
  const googleAuthService = createGoogleAuthService();
  const wechatAuthService = createWechatAuthService(serverRuntimeConfig);
  const repositoryModes = {
    adminConsole: resolveRepositoryBackend(
      adminConsoleRepository,
      InMemoryAdminConsoleRepository,
      PostgresAdminConsoleRepository,
    ),
    authData: resolveRepositoryBackend(
      authDataRepository,
      InMemoryAuthDataRepository,
      PostgresAuthDataRepository,
      FileBackedAuthDataRepository,
    ),
    creditAccounts: resolveRepositoryBackend(
      creditAccountRepository,
      InMemoryCreditAccountRepository,
      PostgresCreditAccountRepository,
      FileBackedCreditAccountRepository,
    ),
    creditExchangeRates: resolveRepositoryBackend(
      creditExchangeRateRepository,
      InMemoryCreditExchangeRateRepository,
      PostgresCreditExchangeRateRepository,
      FileBackedCreditExchangeRateRepository,
    ),
    creditProviders: resolveRepositoryBackend(
      creditProviderRepository,
      InMemoryCreditProviderRepository,
      PostgresCreditProviderRepository,
    ),
    workspaceLayout: resolveRepositoryBackend(
      workspaceLayoutRepository,
      InMemoryWorkspaceLayoutRepository,
      PostgresWorkspaceLayoutRepository,
    ),
  } as const;
  const browserSessionHealth = {
    ready: true,
  } as const;

  const server = createServer((req, res) => {
    void (async () => {
      applyCorsHeaders(req, res);
      if (req.method === "OPTIONS") {
        writeOptionsResponse(req, res);
        return;
      }

      const rawHeaders = normalizeHeaders(req);
      const headers = stripAuthenticatedHeaders(rawHeaders);
      const requestId = headers["x-request-id"] || randomUUID();
      const clientVersion = getClientVersion(req);
      const url = new URL(req.url || "/", "http://localhost");
      const pathname = url.pathname;
      const requestCookies = parseCookies(req.headers.cookie);
      const userRouteConnectivityMatch = pathname.match(/^\/api\/v1\/profile\/user-routes\/([^/]+)\/connectivity$/);
      const userRoutePricingMatch = pathname.match(/^\/api\/v1\/profile\/user-routes\/([^/]+)\/pricing-sync$/);

      try {
        const requiredCapability = !allowDegradedPersistence
          ? resolveCriticalPersistenceCapability(pathname, { localOnly: kkaiLocalOnly })
          : undefined;
        const probeRequested = isTruthyValue(url.searchParams.get("probe"));
        const shouldRunPersistenceProbe = !allowDegradedPersistence && (
          probeRequested || (!kkaiLocalOnly && Boolean(requiredCapability))
        );
        const persistenceProbe = shouldRunPersistenceProbe
          ? await (options.probeServerRuntimePersistence || probeServerRuntimePersistence)(serverRuntimeConfig)
          : undefined;
        const runtimePersistenceState = buildRuntimePersistenceState(serverRuntimeConfig, repositoryModes, {
          localOnly: kkaiLocalOnly,
          persistenceProbe,
        });
        const {
          configSummary,
          criticalPersistence,
          runtimeBlockers,
        } = runtimePersistenceState;
        if (pathname === "/healthz") {
          const overallStatus = Object.values(criticalPersistence).every((state) => state.ready)
            ? "ok"
            : "degraded";
          const selfHostedCoreReady = browserSessionHealth.ready
            && (kkaiLocalOnly || (
              repositoryModes.adminConsole === "postgres"
              && repositoryModes.authData === "postgres"
              && repositoryModes.workspaceLayout === "postgres"
              && criticalPersistence.authData.ready
            ))
            && criticalPersistence.guestSessions.ready
            && criticalPersistence.workspaceLayout.ready;
          writeJson(res, 200, {
            success: true,
            data: {
              service: "kk-studio-api",
              status: overallStatus,
              selfHostedCoreReady,
              config: configSummary,
              repositories: repositoryModes,
              persistence: {
                userApiKeys: criticalPersistence.authData.ready,
                keyManager: criticalPersistence.authData.ready,
                authData: criticalPersistence.authData.ready,
                authSessions: browserSessionHealth.ready,
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

        const authenticatedUser = shouldAttemptBearerAuthentication(pathname, headers)
          ? await requestAuthenticator.authenticate(headers)
          : undefined;
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
            : localOnlyUser
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

        if (req.method === "POST" && (pathname === "/api/v1/auth/login" || pathname === "/api/auth/login")) {
          const body = await readJsonBody(req);
          const result = await handleVersionedLogin(
            authService,
            body,
            requestHeaders,
            getRequestIp(req),
            getRequestUserAgent(req),
          );
          writeJson(res, result.statusCode, result.body, result.headers);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/auth/session") {
          const result = await handleGetSession(
            authService,
            requestHeaders,
            requestCookies,
            getRequestIp(req),
            getRequestUserAgent(req),
          );
          writeJson(res, result.statusCode, result.body, result.headers);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/auth/refresh") {
          const result = await handleRefreshSession(
            authService,
            requestHeaders,
            requestCookies,
            getRequestIp(req),
            getRequestUserAgent(req),
          );
          writeJson(res, result.statusCode, result.body, result.headers);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/auth/logout") {
          const result = await handleLogoutSession(authService, requestHeaders, requestCookies);
          writeJson(res, result.statusCode, result.body, result.headers);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/auth/google/start") {
          const result = await handleStartGoogleLogin(googleAuthService, url.searchParams, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/auth/google/bind/start") {
          const result = await handleStartGoogleBind(googleAuthService, url.searchParams, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/auth/google/callback") {
          const result = await handleGoogleCallback(googleAuthService, authService, url.searchParams);
          writeRedirect(res, result.redirectTo);
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

          const result = await handleWechatCallback(wechatAuthService, authService, url.searchParams, requestHeaders);
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

        if (req.method === "POST" && pathname === "/api/v1/profile/password") {
          const body = await readJsonBody(req);
          const result = await handleUpdatePassword(authService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/profile/password/send-code") {
          const result = await handleSendPasswordChangeCode(authService, requestHeaders);
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
          const body = await readJsonBody(req);
          const result = await handleSyncUserRoutePricing(
            userRouteDiagnosticsService,
            decodeURIComponent(userRoutePricingMatch[1] || ""),
            requestHeaders,
            body,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/model-proxy/system") {
          const body = await readJsonBody(req, {
            maxBytes: resolveJsonBodyMaxBytes(pathname),
          });
          const result = await handleInvokeLocalSystemProxy(
            localSystemProxyService,
            body,
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/model-proxy/user") {
          const body = await readJsonBody(req, {
            maxBytes: resolveJsonBodyMaxBytes(pathname),
          });
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

        const adminCreditAccountPrefix = "/api/v1/admin/billing/accounts/";
        if (pathname.startsWith(adminCreditAccountPrefix) && req.method === "GET") {
          const result = await handleGetAdminCreditAccount(
            creditAccountService,
            decodeURIComponent(pathname.slice(adminCreditAccountPrefix.length)),
            requestHeaders,
          );
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

        if (req.method === "GET" && pathname === "/api/v1/billing/payment-channels") {
          const result = await handleListRechargePaymentChannels(
            rechargePaymentChannelConfigService,
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/billing/recharge-submissions") {
          const body = await readJsonBody(req);
          const result = await handleCreateRechargeSubmission(staticRechargeService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        const rechargeProofMatch = pathname.match(/^\/api\/v1\/billing\/recharge-submissions\/([^/]+)\/proof$/);
        if (req.method === "POST" && rechargeProofMatch) {
          const body = await readJsonBody(req);
          const result = await handleSubmitRechargeProof(
            staticRechargeService,
            decodeURIComponent(rechargeProofMatch[1]),
            body,
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        const rechargeMarkPaidMatch = pathname.match(/^\/api\/v1\/billing\/recharge-submissions\/([^/]+)\/mark-paid$/);
        if (req.method === "POST" && rechargeMarkPaidMatch) {
          const result = await handleMarkRechargeSubmissionPaid(
            staticRechargeService,
            decodeURIComponent(rechargeMarkPaidMatch[1]),
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/billing/submit-recharge") {
          const body = await readJsonBody(req);
          const result = await handleSubmitRecharge(staticRechargeService, body, requestHeaders);
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

        if (
          req.method === "GET"
          && (pathname === "/api/v1/model-catalog/active" || pathname === "/api/v1/model-catalog/active-credit-models")
        ) {
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

        if (req.method === "GET" && pathname === "/api/v1/admin/billing/recharge-submissions") {
          const result = await handleListAdminRechargeSubmissions(
            staticRechargeService,
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        const adminRechargeSubmissionMatch = pathname.match(/^\/api\/v1\/admin\/billing\/recharge-submissions\/([^/]+)$/);
        if (req.method === "GET" && adminRechargeSubmissionMatch) {
          const result = await handleGetAdminRechargeSubmission(
            staticRechargeService,
            decodeURIComponent(adminRechargeSubmissionMatch[1]),
            requestHeaders,
          );
          writeJson(res, result.statusCode, result.body);
          return;
        }

        const adminRechargeReviewMatch = pathname.match(/^\/api\/v1\/admin\/billing\/recharge-submissions\/([^/]+)\/review$/);
        if (req.method === "POST" && adminRechargeReviewMatch) {
          const body = await readJsonBody(req);
          const result = await handleReviewRechargeSubmission(
            staticRechargeService,
            decodeURIComponent(adminRechargeReviewMatch[1]),
            body,
            requestHeaders,
          );
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
