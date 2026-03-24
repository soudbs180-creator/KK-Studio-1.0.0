import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

import { buildApiManifest, apiLogger } from "./app.ts";
import {
  AUTHENTICATED_ADMIN_SESSION_EXPIRES_AT_HEADER,
  AUTHENTICATED_ADMIN_SESSION_HEADER,
  env,
  resolveAdminSessionToken,
} from "../../../packages/shared/src/index.ts";
import {
  applyAuthenticatedHeaders,
  createRequestAuthenticator,
  resolveSupabaseAuthKey,
  stripAuthenticatedHeaders,
  type AuthenticatedRequestContext,
  type RequestAuthenticator,
} from "./lib/request-authenticator.ts";
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
  AuthDataService,
  AuthService,
  InMemoryAuthDataRepository,
  SupabaseAuthDataRepository,
  SupabaseWechatAuthRepository,
  type TurnstileVerifier,
  WechatAuthService,
  handleCreateTempUser,
  handleGetKeyManagerCloudState,
  handleGetProfile,
  handleGetUserApiEntries,
  handleStartWechatBind,
  handleStartWechatLogin,
  handleWechatCallback,
  handleReplaceKeyManagerCloudState,
  handleReplaceUserApiEntries,
  handleUpdateProfile,
  handleVersionedLogin,
  handleVersionedRegister,
} from "./modules/auth/index.ts";
import {
  handleApplyPaymentSettlement,
  CreditAccountService,
  type CreditAccountRepository,
  InMemoryCreditAccountRepository,
  handleAdminRechargeCredits,
  SupabaseCreditAccountRepository,
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
  handleListActiveCreditModels,
  handleListAdminCreditProviders,
  handleCreateAdminModel,
  handleListModels,
  handleSaveAdminCreditProvider,
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

async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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

export interface ApiServerOptions {
  adminConsoleRepository?: AdminConsoleRepository;
  creditAccountRepository?: CreditAccountRepository;
  requestAuthenticator?: RequestAuthenticator;
  resolveAccessToken?: (accessToken: string) => AuthenticatedRequestContext | undefined;
  verifyTurnstileToken?: TurnstileVerifier;
}

function createAdminConsoleRepository(): AdminConsoleRepository {
  const supabaseUrl = env.get("SUPABASE_URL");
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY");

  if (supabaseUrl && serviceRoleKey) {
    apiLogger.info("Using Supabase admin console repository", {
      hasSupabaseUrl: true,
      hasServiceRoleKey: true,
    });
    return new SupabaseAdminConsoleRepository({
      supabaseUrl,
      serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory admin console repository", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  });
  return new InMemoryAdminConsoleRepository();
}

function createCreditAccountRepository(): CreditAccountRepository {
  const supabaseUrl = env.get("SUPABASE_URL");
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY");

  if (supabaseUrl && serviceRoleKey) {
    apiLogger.info("Using Supabase credit account repository", {
      hasSupabaseUrl: true,
      hasServiceRoleKey: true,
    });
    return new SupabaseCreditAccountRepository({
      supabaseUrl,
      serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory credit account repository", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  });
  return new InMemoryCreditAccountRepository();
}

function createCreditProviderRepository() {
  const supabaseUrl = env.get("SUPABASE_URL");
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY");

  if (supabaseUrl && serviceRoleKey) {
    apiLogger.info("Using Supabase credit provider repository", {
      hasSupabaseUrl: true,
      hasServiceRoleKey: true,
    });
    return new SupabaseCreditProviderRepository({
      supabaseUrl,
      serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory credit provider repository", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  });
  return new InMemoryCreditProviderRepository();
}

function createAuthDataRepository() {
  const supabaseUrl = env.get("SUPABASE_URL");
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY");

  if (supabaseUrl && serviceRoleKey) {
    apiLogger.info("Using Supabase auth data repository", {
      hasSupabaseUrl: true,
      hasServiceRoleKey: true,
    });
    return new SupabaseAuthDataRepository({
      supabaseUrl,
      serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory auth data repository", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  });
  return new InMemoryAuthDataRepository();
}

function createWorkspaceLayoutRepository() {
  const supabaseUrl = env.get("SUPABASE_URL");
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY");

  if (supabaseUrl && serviceRoleKey) {
    apiLogger.info("Using Supabase workspace layout repository", {
      hasSupabaseUrl: true,
      hasServiceRoleKey: true,
    });
    return new SupabaseWorkspaceLayoutRepository({
      supabaseUrl,
      serviceRoleKey,
    });
  }

  apiLogger.warn("Falling back to in-memory workspace layout repository", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  });
  return new InMemoryWorkspaceLayoutRepository();
}

function createWechatAuthService(): WechatAuthService | undefined {
  const supabaseUrl = env.get("SUPABASE_URL");
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY");
  const providerAppId = env.get("WECHAT_OPEN_APP_ID");
  const providerSecret = env.get("WECHAT_OPEN_APP_SECRET");
  const callbackUrl = env.get("WECHAT_OPEN_REDIRECT_URI");
  const stateSigningSecret = env.get("WECHAT_STATE_SIGNING_SECRET");
  const allowedRedirectOrigins = String(env.get("WECHAT_ALLOWED_REDIRECT_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!supabaseUrl || !serviceRoleKey) {
    apiLogger.warn("WeChat auth service is disabled because Supabase admin config is unavailable.", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
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
      supabaseUrl,
      serviceRoleKey,
    }),
    providerAppId,
    providerSecret,
    callbackUrl,
    stateSigningSecret,
    allowedRedirectOrigins,
  });
}

export function createApiServer(
  port = Number(process.env.PORT || 3001),
  options: ApiServerOptions = {},
) {
  const authService = new AuthService({
    verifyTurnstileToken: options.verifyTurnstileToken || defaultTurnstileVerifier,
  });
  const authDataService = new AuthDataService(createAuthDataRepository());
  const adminConsoleService = new AdminConsoleService(
    options.adminConsoleRepository || createAdminConsoleRepository(),
  );
  const assetLibraryService = new AssetLibraryService(new InMemoryAssetLibraryRepository());
  const creditAccountService = new CreditAccountService(
    options.creditAccountRepository || createCreditAccountRepository(),
  );
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
    supabaseUrl: env.get("SUPABASE_URL"),
    supabaseAuthKey: resolveSupabaseAuthKey(),
  });
  const generationService = new GenerationService(new InMemoryGenerationTaskRepository());
  const modelCatalogService = new ModelCatalogService(new InMemoryModelCatalogRepository());
  const creditProviderService = new CreditProviderService(createCreditProviderRepository());
  const workflowRepository = new InMemoryWorkflowRepository();
  const workflowService = new WorkflowService(workflowRepository);
  const workspaceCanvasService = new WorkspaceCanvasService(
    workflowRepository,
    createWorkspaceLayoutRepository(),
  );
  const wechatAuthService = createWechatAuthService();

  const server = createServer((req, res) => {
    void (async () => {
      const rawHeaders = normalizeHeaders(req);
      const headers = stripAuthenticatedHeaders(rawHeaders);
      const requestId = headers["x-request-id"] || randomUUID();
      const clientVersion = getClientVersion(req);
      const url = new URL(req.url || "/", "http://localhost");
      const pathname = url.pathname;

      try {
        const authenticatedUser = await requestAuthenticator.authenticate(headers);
        let requestHeaders = headers;
        if (authenticatedUser) {
          const access = await adminConsoleService.getAccess(
            authenticatedUser.userId,
            requestId,
            clientVersion,
            resolveAdminSessionToken(headers),
          );
          const authenticatedRole = access.success
            ? access.data.role
            : authenticatedUser.role;

          requestHeaders = applyAuthenticatedHeaders(headers, {
            ...authenticatedUser,
            role: authenticatedRole,
          });

          if (access.success && access.data.adminSessionActive) {
            requestHeaders[AUTHENTICATED_ADMIN_SESSION_HEADER] = "true";
            if (access.data.adminSessionExpiresAt) {
              requestHeaders[AUTHENTICATED_ADMIN_SESSION_EXPIRES_AT_HEADER] = access.data.adminSessionExpiresAt;
            }
          }
        }

        if (pathname === "/healthz") {
          writeJson(res, 200, {
            success: true,
            data: {
              service: "kk-studio-api",
              status: "ok",
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

        if (req.method === "POST" && pathname === "/api/v1/auth/register") {
          const body = await readJsonBody(req);
          const result = await handleVersionedRegister(authService, body, requestHeaders, getRequestIp(req));
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/auth/temp-users") {
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
          const body = await readJsonBody(req);
          const result = await handleReplaceUserApiEntries(authDataService, body, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "GET" && pathname === "/api/v1/profile/key-manager-state") {
          const result = await handleGetKeyManagerCloudState(authDataService, requestHeaders);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "PUT" && pathname === "/api/v1/profile/key-manager-state") {
          const body = await readJsonBody(req);
          const result = await handleReplaceKeyManagerCloudState(authDataService, body, requestHeaders);
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

        if (req.method === "POST" && pathname === "/internal/v1/payment-settlements") {
          const body = await readJsonBody(req);
          const result = await handleApplyPaymentSettlement(creditAccountService, body, headers);
          writeJson(res, result.statusCode, result.body);
          return;
        }

        if (req.method === "POST" && pathname === "/api/v1/generation-tasks") {
          const body = await readJsonBody(req);
          const result = await handleCreateGenerationTask(generationService, body, requestHeaders);
          writeJson(
            res,
            result.success ? 202 : result.error.code === "AUTH_REQUIRED" ? 401 : 400,
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
          writeJson(
            res,
            result.success ? 200 : result.error.code === "AUTH_REQUIRED" ? 401 : 404,
            result,
          );
          return;
        }

        const workflowMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/workflows\/([^/]+)$/);
        if (workflowMatch && req.method === "PUT") {
          const [, workspaceId, workflowId] = workflowMatch;
          const body = await readJsonBody(req);
          const result = await handleSaveWorkflow(workflowService, workspaceId, workflowId, body, requestHeaders);
          writeJson(res, result.success ? 200 : 400, result);
          return;
        }

        if (workflowMatch && req.method === "GET") {
          const [, workspaceId, workflowId] = workflowMatch;
          const result = await handleGetWorkflow(workflowService, workspaceId, workflowId, requestHeaders);
          writeJson(res, result.success ? 200 : 404, result);
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

  server.listen(port, () => {
    apiLogger.info("API skeleton server started", { port });
  });

  return server;
}

if (process.env.RUN_KK_API_SKELETON === "true") {
  createApiServer();
}
