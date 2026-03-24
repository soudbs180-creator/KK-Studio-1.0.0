import type {
  AdminAccessDto,
  ChangeAdminPasswordRequestDto,
  ChangeAdminPasswordResponseDto,
  SetUserRoleRequestDto,
  SetUserRoleResponseDto,
  VerifyAdminPasswordRequestDto,
  VerifyAdminPasswordResponseDto,
} from "../dto/admin-console.ts";
import type {
  AssetKind,
  AssetListDto,
} from "../dto/asset-library.ts";
import type {
  KeyManagerCloudStateDto,
  LoginRequestDto,
  LoginResponseDto,
  ProfileDto,
  ReplaceKeyManagerCloudStateRequestDto,
  RegisterRequestDto,
  RegisterResponseDto,
  ReplaceUserApiEntriesRequestDto,
  TempUserSessionDto,
  UpdateProfileRequestDto,
  UserApiEntryListDto,
  WechatAuthStartResponseDto,
} from "../dto/auth.ts";
import type {
  AdminRechargeCreditsRequestDto,
  AdminRechargeCreditsResponseDto,
  CreditTransactionListDto,
  CreditBalanceDto,
  DebitCreditsRequestDto,
  DebitCreditsResponseDto,
  ListCreditTransactionsQueryDto,
  RefundCreditsRequestDto,
  RefundCreditsResponseDto,
} from "../dto/billing.ts";
import type {
  CreateGenerationTaskRequestDto,
  GenerationTaskDto,
} from "../dto/generation.ts";
import type {
  ActiveCreditModelListDto,
  AdminCreditProviderListDto,
  CreateAdminModelRequestDto,
  DeleteAdminCreditProviderResponseDto,
  ModelCatalogItemDto,
  ModelCatalogListDto,
  ModelKind,
  SaveAdminCreditProviderRequestDto,
  SaveAdminCreditProviderResponseDto,
} from "../dto/model-catalog.ts";
import type {
  CreatePaymentOrderRequestDto,
  PaymentOrderDto,
  PaymentOrderStatusViewDto,
} from "../dto/payment.ts";
import type {
  SaveWorkflowRequestDto,
  WorkflowDocumentDto,
} from "../dto/workflow.ts";
import type { CanvasSummaryDto } from "../dto/workspace-canvas.ts";
import type {
  CanvasLayoutDto,
  CleanupCloudImagesResponseDto,
  SaveCanvasLayoutRequestDto,
} from "../dto/workspace-canvas.ts";
import type {
  ApiError,
  ApiResponse,
  RequestMeta,
} from "../http/envelope.ts";

export interface ApiClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  getClientVersion?: () => string | undefined;
  getDefaultHeaders?: () => Record<string, string | undefined>;
}

export interface ApiClientRequestOptions {
  accessToken?: string;
  clientVersion?: string;
  headers?: Record<string, string | undefined>;
  requestId?: string;
  signal?: AbortSignal;
}

export interface KkApiClient {
  register(
    input: RegisterRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<RegisterResponseDto>>;
  login(
    input: LoginRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<LoginResponseDto>>;
  startWechatLogin(
    redirectTo: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<WechatAuthStartResponseDto>>;
  startWechatBind(
    redirectTo: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<WechatAuthStartResponseDto>>;
  getProfile(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProfileDto>>;
  updateProfile(
    input: UpdateProfileRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProfileDto>>;
  getUserApiEntries(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<UserApiEntryListDto>>;
  replaceUserApiEntries(
    input: ReplaceUserApiEntriesRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<UserApiEntryListDto>>;
  getKeyManagerCloudState(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>>;
  replaceKeyManagerCloudState(
    input: ReplaceKeyManagerCloudStateRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>>;
  createTempUser(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<TempUserSessionDto>>;
  getAdminAccess(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AdminAccessDto>>;
  verifyAdminPassword(
    input: VerifyAdminPasswordRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<VerifyAdminPasswordResponseDto>>;
  changeAdminPassword(
    input: ChangeAdminPasswordRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ChangeAdminPasswordResponseDto>>;
  setUserRole(
    input: SetUserRoleRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<SetUserRoleResponseDto>>;
  getWorkspaceCanvas(
    workspaceId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CanvasSummaryDto>>;
  getWorkspaceLayout(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CanvasLayoutDto>>;
  saveWorkspaceLayout(
    input: SaveCanvasLayoutRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CanvasLayoutDto>>;
  cleanupCloudImages(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CleanupCloudImagesResponseDto>>;
  getCreditBalance(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CreditBalanceDto>>;
  listCreditTransactions(
    input?: ListCreditTransactionsQueryDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CreditTransactionListDto>>;
  debitCredits(
    input: DebitCreditsRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<DebitCreditsResponseDto>>;
  refundCredits(
    input: RefundCreditsRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<RefundCreditsResponseDto>>;
  adminRechargeCredits(
    input: AdminRechargeCreditsRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AdminRechargeCreditsResponseDto>>;
  listModels(
    kind?: ModelKind,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ModelCatalogListDto>>;
  listActiveCreditModels(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ActiveCreditModelListDto>>;
  createAdminModel(
    input: CreateAdminModelRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ModelCatalogItemDto>>;
  listAdminCreditProviders(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AdminCreditProviderListDto>>;
  saveAdminCreditProvider(
    providerId: string,
    input: SaveAdminCreditProviderRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<SaveAdminCreditProviderResponseDto>>;
  deleteAdminCreditProvider(
    providerId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<DeleteAdminCreditProviderResponseDto>>;
  createPaymentOrder(
    input: CreatePaymentOrderRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<PaymentOrderDto>>;
  getPaymentOrderStatus(
    merchantOrderNo: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<PaymentOrderStatusViewDto>>;
  listAssets(
    input?: { kind?: AssetKind; cursor?: string; limit?: number },
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AssetListDto>>;
  createGenerationTask(
    input: CreateGenerationTaskRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationTaskDto>>;
  getGenerationTask(
    taskId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationTaskDto>>;
  saveWorkflow(
    workspaceId: string,
    workflowId: string,
    input: SaveWorkflowRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<WorkflowDocumentDto>>;
  getWorkflow(
    workspaceId: string,
    workflowId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<WorkflowDocumentDto>>;
}

function buildRequestId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUuid) {
    return randomUuid();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildMeta(requestId: string, clientVersion?: string): RequestMeta {
  return {
    requestId,
    clientVersion,
    timestamp: new Date().toISOString(),
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function normalizeHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string" && value.length > 0) {
      normalized[key] = value;
    }
  }

  return normalized;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isHtmlPayload(payload: unknown, response: Response): boolean {
  const contentType = response.headers.get("content-type") || "";
  if (/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    return true;
  }

  if (typeof payload !== "string") {
    return false;
  }

  const normalized = payload.trimStart().toLowerCase();
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html");
}

function isEnvelope<T>(payload: unknown): payload is ApiResponse<T> {
  return Boolean(
    payload
    && typeof payload === "object"
    && "success" in payload
    && "meta" in payload,
  );
}

function createFallbackError(
  response: Response,
  payload: unknown,
  requestId: string,
  clientVersion?: string,
): ApiResponse<never> {
  return createClientError(
    `HTTP_${response.status}`,
    response.statusText || "Request failed.",
    requestId,
    clientVersion,
    [
      {
        status: response.status,
        body: payload,
      },
    ],
  );
}

function createClientError(
  code: string,
  message: string,
  requestId: string,
  clientVersion?: string,
  details?: ApiError["details"],
): ApiResponse<never> {
  const error: ApiError = {
    code,
    message,
    details,
  };

  return {
    success: false,
    error,
    meta: buildMeta(requestId, clientVersion),
  };
}

async function resolveAccessToken(
  config: ApiClientConfig,
  options?: ApiClientRequestOptions,
): Promise<string | undefined> {
  if (typeof options?.accessToken === "string") {
    return options.accessToken;
  }

  return config.getAccessToken ? config.getAccessToken() : undefined;
}

async function requestJson<TResponse>(
  config: ApiClientConfig,
  path: string,
  init: RequestInit,
  options?: ApiClientRequestOptions,
): Promise<ApiResponse<TResponse>> {
  const fetchImpl = config.fetchImpl || globalThis.fetch;
  const requestId = options?.requestId || buildRequestId();
  const clientVersion = options?.clientVersion || config.getClientVersion?.();
  if (!fetchImpl) {
    return createClientError(
      "FETCH_UNAVAILABLE",
      "No fetch implementation is available for the KK API client.",
      requestId,
      clientVersion,
    );
  }

  try {
    const accessToken = await resolveAccessToken(config, options);
    const defaultHeaders = config.getDefaultHeaders ? config.getDefaultHeaders() : {};

    const headers = normalizeHeaders({
      ...defaultHeaders,
      ...options?.headers,
      ...(init.body ? { "content-type": "application/json; charset=utf-8" } : {}),
      authorization: accessToken ? `Bearer ${accessToken}` : undefined,
      "x-client-version": clientVersion,
      "x-request-id": requestId,
    });

    const response = await fetchImpl(new URL(path, normalizeBaseUrl(config.baseUrl)), {
      ...init,
      headers,
      signal: options?.signal,
    });

    const payload = await parseResponseBody(response);

    if (isEnvelope<TResponse>(payload)) {
      return payload;
    }

    if (isHtmlPayload(payload, response)) {
      return createClientError(
        "INVALID_RESPONSE_PAYLOAD",
        "KK API returned an HTML page instead of the expected JSON payload.",
        requestId,
        clientVersion,
        [
          {
            status: response.status,
            contentType: response.headers.get("content-type") || undefined,
          },
        ],
      );
    }

    if (response.ok) {
      return {
        success: true,
        data: payload as TResponse,
        meta: buildMeta(requestId, clientVersion),
      };
    }

    return createFallbackError(response, payload, requestId, clientVersion);
  } catch (error: any) {
    const message = error?.message || "Request failed before a response was received.";
    const normalizedMessage = String(message).toLowerCase();
    const code = normalizedMessage.includes("fetch") || normalizedMessage.includes("network")
      ? "NETWORK_ERROR"
      : "CLIENT_REQUEST_FAILED";

    return createClientError(code, message, requestId, clientVersion, [
      {
        reason: "request_failed",
        name: error?.name,
      },
    ]);
  }
}

export function createKkApiClient(config: ApiClientConfig): KkApiClient {
  return {
    register(input, options) {
      return requestJson<RegisterResponseDto>(
        config,
        "api/v1/auth/register",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    login(input, options) {
      return requestJson<LoginResponseDto>(
        config,
        "api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    startWechatLogin(redirectTo, options) {
      const query = new URLSearchParams({
        redirectTo,
      });

      return requestJson<WechatAuthStartResponseDto>(
        config,
        `api/v1/auth/wechat/start?${query.toString()}`,
        {
          method: "GET",
        },
        options,
      );
    },

    startWechatBind(redirectTo, options) {
      const query = new URLSearchParams({
        redirectTo,
      });

      return requestJson<WechatAuthStartResponseDto>(
        config,
        `api/v1/auth/wechat/bind/start?${query.toString()}`,
        {
          method: "GET",
        },
        options,
      );
    },

    getProfile(options) {
      return requestJson<ProfileDto>(
        config,
        "api/v1/profile",
        {
          method: "GET",
        },
        options,
      );
    },

    updateProfile(input, options) {
      return requestJson<ProfileDto>(
        config,
        "api/v1/profile",
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    getUserApiEntries(options) {
      return requestJson<UserApiEntryListDto>(
        config,
        "api/v1/profile/user-apis",
        {
          method: "GET",
        },
        options,
      );
    },

    replaceUserApiEntries(input, options) {
      return requestJson<UserApiEntryListDto>(
        config,
        "api/v1/profile/user-apis",
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    getKeyManagerCloudState(options) {
      return requestJson<KeyManagerCloudStateDto>(
        config,
        "api/v1/profile/key-manager-state",
        {
          method: "GET",
        },
        options,
      );
    },

    replaceKeyManagerCloudState(input, options) {
      return requestJson<KeyManagerCloudStateDto>(
        config,
        "api/v1/profile/key-manager-state",
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    createTempUser(options) {
      return requestJson<TempUserSessionDto>(
        config,
        "api/v1/auth/temp-users",
        {
          method: "POST",
        },
        options,
      );
    },

    getAdminAccess(options) {
      return requestJson<AdminAccessDto>(
        config,
        "api/v1/admin/access",
        {
          method: "GET",
        },
        options,
      );
    },

    verifyAdminPassword(input, options) {
      return requestJson<VerifyAdminPasswordResponseDto>(
        config,
        "api/v1/admin/session/verify-password",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    changeAdminPassword(input, options) {
      return requestJson<ChangeAdminPasswordResponseDto>(
        config,
        "api/v1/admin/password",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    setUserRole(input, options) {
      return requestJson<SetUserRoleResponseDto>(
        config,
        "api/v1/admin/users/roles",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    getWorkspaceCanvas(workspaceId, options) {
      return requestJson<CanvasSummaryDto>(
        config,
        `api/v1/workspaces/${encodeURIComponent(workspaceId)}/canvas`,
        {
          method: "GET",
        },
        options,
      );
    },

    getWorkspaceLayout(options) {
      return requestJson<CanvasLayoutDto>(
        config,
        "api/v1/workspaces/layout",
        {
          method: "GET",
        },
        options,
      );
    },

    saveWorkspaceLayout(input, options) {
      return requestJson<CanvasLayoutDto>(
        config,
        "api/v1/workspaces/layout",
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    cleanupCloudImages(options) {
      return requestJson<CleanupCloudImagesResponseDto>(
        config,
        "api/v1/workspaces/layout/cloud-images",
        {
          method: "DELETE",
        },
        options,
      );
    },

    getCreditBalance(options) {
      return requestJson<CreditBalanceDto>(
        config,
        "api/v1/billing/credits/balance",
        {
          method: "GET",
        },
        options,
      );
    },

    listCreditTransactions(input, options) {
      const query = new URLSearchParams();
      if (input?.transactionType) {
        query.set("transactionType", input.transactionType);
      }
      if (input?.status) {
        query.set("status", input.status);
      }
      if (typeof input?.limit === "number") {
        query.set("limit", String(input.limit));
      }

      const path = query.size > 0
        ? `api/v1/billing/credits/transactions?${query.toString()}`
        : "api/v1/billing/credits/transactions";

      return requestJson<CreditTransactionListDto>(
        config,
        path,
        {
          method: "GET",
        },
        options,
      );
    },

    debitCredits(input, options) {
      return requestJson<DebitCreditsResponseDto>(
        config,
        "api/v1/billing/credits/debit",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    refundCredits(input, options) {
      return requestJson<RefundCreditsResponseDto>(
        config,
        "api/v1/billing/credits/refunds",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    adminRechargeCredits(input, options) {
      return requestJson<AdminRechargeCreditsResponseDto>(
        config,
        "api/v1/admin/billing/recharges",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    listModels(kind, options) {
      const path = kind
        ? `api/v1/model-catalog/models?kind=${encodeURIComponent(kind)}`
        : "api/v1/model-catalog/models";

      return requestJson<ModelCatalogListDto>(
        config,
        path,
        {
          method: "GET",
        },
        options,
      );
    },

    listActiveCreditModels(options) {
      return requestJson<ActiveCreditModelListDto>(
        config,
        "api/v1/model-catalog/active-credit-models",
        {
          method: "GET",
        },
        options,
      );
    },

    createAdminModel(input, options) {
      return requestJson<ModelCatalogItemDto>(
        config,
        "api/v1/admin/models",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    listAdminCreditProviders(options) {
      return requestJson<AdminCreditProviderListDto>(
        config,
        "api/v1/admin/credit-providers",
        {
          method: "GET",
        },
        options,
      );
    },

    saveAdminCreditProvider(providerId, input, options) {
      return requestJson<SaveAdminCreditProviderResponseDto>(
        config,
        `api/v1/admin/credit-providers/${encodeURIComponent(providerId)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    deleteAdminCreditProvider(providerId, options) {
      return requestJson<DeleteAdminCreditProviderResponseDto>(
        config,
        `api/v1/admin/credit-providers/${encodeURIComponent(providerId)}`,
        {
          method: "DELETE",
        },
        options,
      );
    },

    createPaymentOrder(input, options) {
      return requestJson<PaymentOrderDto>(
        config,
        "payment/v1/orders",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    getPaymentOrderStatus(merchantOrderNo, options) {
      return requestJson<PaymentOrderStatusViewDto>(
        config,
        `payment/v1/orders/${encodeURIComponent(merchantOrderNo)}/status`,
        {
          method: "GET",
        },
        options,
      );
    },

    listAssets(input, options) {
      const query = new URLSearchParams();
      if (input?.kind) {
        query.set("kind", input.kind);
      }
      if (input?.cursor) {
        query.set("cursor", input.cursor);
      }
      if (typeof input?.limit === "number") {
        query.set("limit", String(input.limit));
      }

      const path = query.size > 0
        ? `api/v1/assets?${query.toString()}`
        : "api/v1/assets";

      return requestJson<AssetListDto>(
        config,
        path,
        {
          method: "GET",
        },
        options,
      );
    },

    createGenerationTask(input, options) {
      return requestJson<GenerationTaskDto>(
        config,
        "api/v1/generation-tasks",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    getGenerationTask(taskId, options) {
      return requestJson<GenerationTaskDto>(
        config,
        `api/v1/generation-tasks/${encodeURIComponent(taskId)}`,
        {
          method: "GET",
        },
        options,
      );
    },

    saveWorkflow(workspaceId, workflowId, input, options) {
      return requestJson<WorkflowDocumentDto>(
        config,
        `api/v1/workspaces/${encodeURIComponent(workspaceId)}/workflows/${encodeURIComponent(workflowId)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    getWorkflow(workspaceId, workflowId, options) {
      return requestJson<WorkflowDocumentDto>(
        config,
        `api/v1/workspaces/${encodeURIComponent(workspaceId)}/workflows/${encodeURIComponent(workflowId)}`,
        {
          method: "GET",
        },
        options,
      );
    },
  };
}
