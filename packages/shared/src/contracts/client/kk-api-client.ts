import type {
  AdminAdjustCreditsRequestDto,
  AdminAdjustCreditsResponseDto,
  AdminAccessDto,
  ChangeAdminPasswordRequestDto,
  ChangeAdminPasswordResponseDto,
  ListAdminUsersQueryDto,
  ListAdminUsersResponseDto,
  SetUserRoleRequestDto,
  SetUserRoleResponseDto,
  VerifyAdminPasswordRequestDto,
  VerifyAdminPasswordResponseDto,
} from "../dto/admin-console.ts";
import type {
  AssetKind,
  AssetListDto,
  CreateAssetRequestDto,
  CreateAssetResponseDto,
} from "../dto/asset-library.ts";
import type {
  AuthSessionDto,
  GoogleAuthStartResponseDto,
  KeyManagerCloudStateDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  PasswordResetRequestDto,
  PasswordResetRequestResponseDto,
  PasswordResetConfirmDto,
  PasswordResetConfirmResponseDto,
  ProfileDto,
  RefreshSessionRequestDto,
  ReplaceKeyManagerCloudStateRequestDto,
  ReplaceUserApisPayloadRequestDto,
  RegisterRequestDto,
  RegisterResponseDto,
  ReplaceUserApiEntriesRequestDto,
  SendPasswordChangeCodeResponseDto,
  TempUserSessionDto,
  UpdatePasswordRequestDto,
  UpdatePasswordResponseDto,
  RevealUserApiSecretRequestDto,
  RevealUserApiSecretResponseDto,
  UserRouteConnectivityCheckDto,
  UserRoutePricingSyncRequestDto,
  UserRoutePricingSyncDto,
  UpdateProfileRequestDto,
  UserApiEntryListDto,
  WechatAuthStartResponseDto,
} from "../dto/auth.ts";
import type {
  AdminCreditAccountLookupDto,
  AdminRechargeCreditsRequestDto,
  AdminRechargeCreditsResponseDto,
  CreateRechargeSubmissionRequestDto,
  CreateRechargeSubmissionResponseDto,
  CreditTransactionListDto,
  CreditBalanceDto,
  CreditExchangeRateDto,
  CreditExchangeRateListDto,
  DebitCreditsRequestDto,
  DebitCreditsResponseDto,
  GetAdminRechargeSubmissionResponseDto,
  ListAdminRechargeSubmissionsResponseDto,
  ListCreditTransactionsQueryDto,
  MarkRechargeSubmissionPaidResponseDto,
  RechargePaymentChannelConfigListDto,
  RefundCreditsRequestDto,
  RefundCreditsResponseDto,
  ReviewRechargeSubmissionRequestDto,
  ReviewRechargeSubmissionResponseDto,
  SubmitRechargeProofRequestDto,
  SubmitRechargeProofResponseDto,
  SubmitRechargeRequestDto,
  SubmitRechargeResponseDto,
  UpsertCreditExchangeRateRequestDto,
} from "../dto/billing.ts";
import type {
  ClaimGenerationBatchJobRequestDto,
  ControlGenerationBatchJobRequestDto,
  CreateGenerationBatchJobRequestDto,
  CreateGenerationTaskRequestDto,
  GenerationBatchJobDto,
  GenerationBatchJobListDto,
  GenerationJobStatus,
  GenerationTaskDto,
  UpdateGenerationBatchJobRequestDto,
} from "../dto/generation.ts";
import type {
  ActiveCreditModelListDto,
  AdminCreditProviderListDto,
  CreateAdminModelRequestDto,
  DeleteAdminCreditProviderResponseDto,
  ModelCatalogItemDto,
  ModelCatalogListDto,
  ModelKind,
  ProviderPricingCacheDto,
  SaveAdminCreditProviderRequestDto,
  SaveAdminCreditProviderResponseDto,
  UpsertProviderPricingCacheRequestDto,
  WuyinCatalogItemDto,
  WuyinCatalogResponseDto,
  WuyinCatalogSourceDto,
} from "../dto/model-catalog.ts";
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
import type {
  AgentKnowledgeChangeDto,
  AgentKnowledgeDocumentDto,
  AgentKnowledgeSearchQueryDto,
  AgentRunDto,
  AgentSkillDeleteDto,
  AgentSkillDto,
  AgentToolCallDto,
  AssistantApiResultDto,
} from "../dto/ai-assistant.ts";
import type {
  CreateProviderConnectionRequest,
  DeleteProviderConnectionResponseDto,
  ProviderConnectionDto,
  ProviderConnectionListDto,
  UpdateProviderConnectionRequest,
} from "../../capability-graph/connection.ts";
import type { CapabilityGraphSnapshotDto } from "../../capability-graph/graph.ts";
import type { GenerationJobListDtoV3 } from "../../generation-v3/job.ts";

export interface ApiClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  refreshAccessToken?: () => string | undefined | Promise<string | undefined>;
  getAuthSubject?: () => string | undefined | Promise<string | undefined>;
  onRefreshToken?: (token: string) => void | Promise<void>;
  getClientVersion?: () => string | undefined;
  getDefaultHeaders?: () => Record<string, string | undefined>;
}

export interface ApiClientRequestOptions {
  accessToken?: string;
  /** Captured owner for deferred writes; a subject change aborts before any network request. */
  expectedAuthSubject?: string;
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
  requestPasswordReset(
    input: PasswordResetRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<PasswordResetRequestResponseDto>>;
  confirmPasswordReset(
    input: PasswordResetConfirmDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<PasswordResetConfirmResponseDto>>;
  getSession(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AuthSessionDto>>;
  refreshSession(
    input: RefreshSessionRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AuthSessionDto>>;
  logout(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<LogoutResponseDto>>;
  startWechatLogin(
    redirectTo: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<WechatAuthStartResponseDto>>;
  startGoogleLogin(
    redirectTo: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GoogleAuthStartResponseDto>>;
  startGoogleBind(
    redirectTo: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GoogleAuthStartResponseDto>>;
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
  updatePassword(
    input: UpdatePasswordRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<UpdatePasswordResponseDto>>;
  sendPasswordChangeCode(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<SendPasswordChangeCodeResponseDto>>;
  getUserApiEntries(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<UserApiEntryListDto>>;
  replaceUserApiEntries(
    input: ReplaceUserApiEntriesRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<UserApiEntryListDto>>;
  replaceUserApisPayload(
    input: ReplaceUserApisPayloadRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>>;
  revealUserApiSecret(
    input: RevealUserApiSecretRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<RevealUserApiSecretResponseDto>>;
  getKeyManagerCloudState(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>>;
  replaceKeyManagerCloudState(
    input: ReplaceKeyManagerCloudStateRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>>;
  /** Capability APIs share one client boundary so callers cannot bypass auth or rollout routing. */
  getCapabilityGraphSnapshot(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CapabilityGraphSnapshotDto>>;
  listProviderConnections(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProviderConnectionListDto>>;
  createProviderConnection(
    input: CreateProviderConnectionRequest,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProviderConnectionDto>>;
  updateProviderConnection(
    connectionId: string,
    input: UpdateProviderConnectionRequest,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProviderConnectionDto>>;
  verifyProviderConnection(
    connectionId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProviderConnectionDto>>;
  deleteProviderConnection(
    connectionId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<DeleteProviderConnectionResponseDto>>;
  checkUserRouteConnectivity(
    routeId: string,
    input?: { baseUrl?: string; apiKey?: string; format?: "gemini" | "openai" | "auto" | "claude"; name?: string } | ApiClientRequestOptions,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<UserRouteConnectivityCheckDto>>;
  syncUserRoutePricing(
    routeId: string,
    input?: UserRoutePricingSyncRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<UserRoutePricingSyncDto>>;
  getWuyinCatalog(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<WuyinCatalogResponseDto>>;
  refreshWuyinCatalog(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<WuyinCatalogResponseDto>>;
  createTempUser(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<TempUserSessionDto>>;
  getAdminAccess(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AdminAccessDto>>;
  listAdminUsers(
    input?: ListAdminUsersQueryDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ListAdminUsersResponseDto>>;
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
  adjustAdminCredits(
    input: AdminAdjustCreditsRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AdminAdjustCreditsResponseDto>>;
  getAdminCreditAccount(
    identity: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AdminCreditAccountLookupDto>>;
  createRechargeSubmission(
    input: CreateRechargeSubmissionRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CreateRechargeSubmissionResponseDto>>;
  submitRechargeProof(
    submissionId: string,
    input: SubmitRechargeProofRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<SubmitRechargeProofResponseDto>>;
  markRechargeSubmissionPaid(
    submissionId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<MarkRechargeSubmissionPaidResponseDto>>;
  listAdminRechargeSubmissions(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ListAdminRechargeSubmissionsResponseDto>>;
  getAdminRechargeSubmission(
    submissionId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GetAdminRechargeSubmissionResponseDto>>;
    reviewRechargeSubmission(
      submissionId: string,
      input: ReviewRechargeSubmissionRequestDto,
      options?: ApiClientRequestOptions,
    ): Promise<ApiResponse<ReviewRechargeSubmissionResponseDto>>;
    listRechargePaymentChannels(
      options?: ApiClientRequestOptions,
    ): Promise<ApiResponse<RechargePaymentChannelConfigListDto>>;
    submitRecharge(
      input: SubmitRechargeRequestDto,
      options?: ApiClientRequestOptions,
    ): Promise<ApiResponse<SubmitRechargeResponseDto>>;
  listCreditExchangeRates(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CreditExchangeRateListDto>>;
  upsertCreditExchangeRate(
    input: UpsertCreditExchangeRateRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CreditExchangeRateDto>>;
  listModels(
    kind?: ModelKind,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ModelCatalogListDto>>;
  listActiveCreditModels(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ActiveCreditModelListDto>>;
  listActiveModels(
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
  getAdminCreditProviderPricingCache(
    providerId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProviderPricingCacheDto>>;
  upsertAdminCreditProviderPricingCache(
    providerId: string,
    input: UpsertProviderPricingCacheRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProviderPricingCacheDto>>;
  getSharedProviderPricingCache(
    baseUrl: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProviderPricingCacheDto>>;
  upsertSharedProviderPricingCache(
    baseUrl: string,
    input: UpsertProviderPricingCacheRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProviderPricingCacheDto>>;
  deleteAdminCreditProvider(
    providerId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<DeleteAdminCreditProviderResponseDto>>;
  listAssets(
    input?: { kind?: AssetKind; cursor?: string; limit?: number },
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AssetListDto>>;
  createAsset(
    input: CreateAssetRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CreateAssetResponseDto>>;
  createGenerationTask(
    input: CreateGenerationTaskRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationTaskDto>>;
  getGenerationTask(
    taskId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationTaskDto>>;
  createGenerationJob(
    input: CreateGenerationBatchJobRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationBatchJobDto>>;
  listGenerationJobs(
    input?: { statuses?: GenerationJobStatus[]; cursor?: string; limit?: number },
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationBatchJobListDto>>;
  listPendingGenerationV3Jobs(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationJobListDtoV3>>;
  getGenerationJob(
    jobId: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationBatchJobDto>>;
  updateGenerationJob(
    jobId: string,
    input: UpdateGenerationBatchJobRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationBatchJobDto>>;
  controlGenerationJob(
    jobId: string,
    input: ControlGenerationBatchJobRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationBatchJobDto>>;
  claimGenerationJob(
    jobId: string,
    input: ClaimGenerationBatchJobRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<GenerationBatchJobDto>>;
  upsertAgentRun(
    input: AgentRunDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AssistantApiResultDto<AgentRunDto>>>;
  recordAgentToolCall(
    input: AgentToolCallDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AssistantApiResultDto<AgentToolCallDto>>>;
  recordKnowledgeChange(
    input: AgentKnowledgeChangeDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AssistantApiResultDto<AgentKnowledgeDocumentDto>>>;
  searchAgentKnowledge(
    input?: AgentKnowledgeSearchQueryDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AssistantApiResultDto<AgentKnowledgeDocumentDto[]>>>;
  upsertAgentSkill(
    input: AgentSkillDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AssistantApiResultDto<AgentSkillDto>>>;
  deleteAgentSkill(
    skillId: string,
    input: AgentSkillDeleteDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AssistantApiResultDto<AgentSkillDto>>>;
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

function shouldIncludeBrowserCredentials(path: string): boolean {
  return path.startsWith("api/v1/auth/");
}

async function persistRefreshHeader(
  config: ApiClientConfig,
  response: Response,
): Promise<void> {
  // 中文注释：标准 envelope 响应也可能携带滑动续期头，必须在任何成功分支返回前统一落盘。
  const refreshToken = response.headers.get("x-refresh-token") || response.headers.get("X-Refresh-Token");
  if (refreshToken) {
    await config.onRefreshToken?.(refreshToken);
  }
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

function normalizeTransportSafeAccessToken(token?: string): string | undefined {
  const normalized = String(token || "").trim();
  return normalized.length > 0 && /^[\x21-\x7E]+$/.test(normalized)
    ? normalized
    : undefined;
}

async function resolveRefreshedAccessToken(
  config: ApiClientConfig,
): Promise<string | undefined> {
  return config.refreshAccessToken ? config.refreshAccessToken() : undefined;
}

async function resolveAuthSubject(config: ApiClientConfig): Promise<string | undefined> {
  const subject = config.getAuthSubject ? await config.getAuthSubject() : undefined;
  const normalized = String(subject || "").trim();
  return normalized || undefined;
}

function decodeAccessTokenSubject(token?: string): string | undefined {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload || typeof globalThis.atob !== "function") return undefined;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const claims = JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
    const subject = String(claims.sub || claims.userId || claims.user_id || "").trim();
    return subject || undefined;
  } catch {
    return undefined;
  }
}

function canRetryWithRefreshedIdentity(input: {
  initialAuthSubject?: string;
  refreshedAuthSubject?: string;
  initialAccessToken?: string;
  refreshedAccessToken?: string;
}): boolean {
  const checks: boolean[] = [];
  if (input.initialAuthSubject || input.refreshedAuthSubject) {
    checks.push(Boolean(
      input.initialAuthSubject
      && input.refreshedAuthSubject
      && input.initialAuthSubject === input.refreshedAuthSubject,
    ));
  }
  const initialTokenSubject = decodeAccessTokenSubject(input.initialAccessToken);
  const refreshedTokenSubject = decodeAccessTokenSubject(input.refreshedAccessToken);
  if (initialTokenSubject || refreshedTokenSubject) {
    checks.push(Boolean(
      initialTokenSubject
      && refreshedTokenSubject
      && initialTokenSubject === refreshedTokenSubject,
    ));
  }
  return checks.length === 0 || checks.every(Boolean);
}

function matchesExpectedAuthSubject(input: {
  expectedAuthSubject?: string;
  resolvedAuthSubject?: string;
  accessToken?: string;
}): boolean {
  const expected = String(input.expectedAuthSubject || "").trim();
  if (!expected) return true;
  if (String(input.resolvedAuthSubject || "").trim() !== expected) return false;
  const tokenSubject = decodeAccessTokenSubject(input.accessToken);
  return !tokenSubject || tokenSubject === expected;
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
    const defaultHeaders = config.getDefaultHeaders ? config.getDefaultHeaders() : {};
    const executeRequest = async (accessToken?: string) => {
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
        credentials: shouldIncludeBrowserCredentials(path) ? "include" : init.credentials,
        signal: options?.signal,
      });

      const payload = await parseResponseBody(response);
      return { response, payload };
    };

    const initialAccessToken = normalizeTransportSafeAccessToken(
      await resolveAccessToken(config, options),
    );
    const initialAuthSubject = await resolveAuthSubject(config);
    if (!matchesExpectedAuthSubject({
      expectedAuthSubject: options?.expectedAuthSubject,
      resolvedAuthSubject: initialAuthSubject,
      accessToken: initialAccessToken,
    })) {
      return createClientError(
        "AUTH_SUBJECT_CHANGED",
        "The authenticated user changed before the request could be sent.",
        requestId,
        clientVersion,
      );
    }
    let { response, payload } = await executeRequest(initialAccessToken);

    if (response.status === 401 && typeof options?.accessToken !== "string") {
      try {
        const refreshedAccessToken = normalizeTransportSafeAccessToken(
          await resolveRefreshedAccessToken(config),
        );
        const refreshedAuthSubject = await resolveAuthSubject(config);
        if (!matchesExpectedAuthSubject({
          expectedAuthSubject: options?.expectedAuthSubject,
          resolvedAuthSubject: refreshedAuthSubject,
          accessToken: refreshedAccessToken,
        })) {
          return createClientError(
            "AUTH_SUBJECT_CHANGED",
            "The authenticated user changed before the request could be retried.",
            requestId,
            clientVersion,
          );
        }
        if (
          refreshedAccessToken
          && refreshedAccessToken !== initialAccessToken
          && canRetryWithRefreshedIdentity({
            initialAuthSubject,
            refreshedAuthSubject,
            initialAccessToken,
            refreshedAccessToken,
          })
        ) {
          ({ response, payload } = await executeRequest(refreshedAccessToken));
        }
      } catch {
        // Fall through and surface the original 401 response below.
      }
    }

    if (response.ok) {
      const responseAuthSubject = await resolveAuthSubject(config);
      if (!initialAuthSubject || responseAuthSubject === initialAuthSubject) {
        await persistRefreshHeader(config, response);
      }
    }

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

interface LegacyWuyinCatalogPayload {
  success?: unknown;
  data?: unknown;
  source?: unknown;
}

const WUYIN_MODEL_KINDS = new Set(["image", "video", "audio", "chat", "detail", "utility"]);
const WUYIN_EXECUTION_MODES = new Set(["async-detail", "sync", "sora2-special"]);
const WUYIN_SUBMIT_CONTENT_TYPES = new Set(["application/json", "application/x-www-form-urlencoded"]);

function isWuyinCatalogSource(value: unknown): value is WuyinCatalogSourceDto {
  return value === "cache" || value === "remote" || value === "fallback";
}

function isWuyinCatalogItem(value: unknown): value is WuyinCatalogItemDto {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<WuyinCatalogItemDto>;
  return typeof item.id === "string"
    && typeof item.name === "string"
    && typeof item.displayName === "string"
    && typeof item.categoryName === "string"
    && typeof item.kind === "string"
    && WUYIN_MODEL_KINDS.has(item.kind)
    && typeof item.executionMode === "string"
    && WUYIN_EXECUTION_MODES.has(item.executionMode)
    && typeof item.endpointPath === "string"
    && (item.method === "GET" || item.method === "POST")
    && typeof item.contentType === "string"
    && typeof item.submitContentType === "string"
    && WUYIN_SUBMIT_CONTENT_TYPES.has(item.submitContentType)
    && Array.isArray(item.aliases)
    && item.aliases.every((alias) => typeof alias === "string")
    && typeof item.enabled === "boolean"
    && typeof item.lastCrawledAt === "string";
}

function normalizeWuyinCatalogPayload(
  response: ApiResponse<LegacyWuyinCatalogPayload>,
): ApiResponse<WuyinCatalogResponseDto> {
  if (!response.success) {
    // The transport error branch does not carry a catalog payload. Keep the
    // error envelope while narrowing the generic at this normalization
    // boundary instead of leaking the legacy payload type to callers.
    return response as ApiResponse<WuyinCatalogResponseDto>;
  }

  const payload = response.data;
  if (
    payload?.success !== true
    || !Array.isArray(payload.data)
    || !payload.data.every(isWuyinCatalogItem)
    || !isWuyinCatalogSource(payload.source)
  ) {
    return createClientError(
      "INVALID_RESPONSE_PAYLOAD",
      "KK API returned an invalid Wuyin catalog payload.",
      response.meta.requestId,
      response.meta.clientVersion,
      [{ reason: "invalid_wuyin_catalog_payload" }],
    );
  }

  return {
    success: true,
    data: {
      items: payload.data,
      source: payload.source,
    },
    meta: response.meta,
  };
}

async function requestWuyinCatalog(
  config: ApiClientConfig,
  path: string,
  method: "GET" | "POST",
  options?: ApiClientRequestOptions,
): Promise<ApiResponse<WuyinCatalogResponseDto>> {
  const response = await requestJson<LegacyWuyinCatalogPayload>(
    config,
    path,
    { method },
    options,
  );
  return normalizeWuyinCatalogPayload(response);
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

    requestPasswordReset(input, options) {
      return requestJson<PasswordResetRequestResponseDto>(
        config,
        "api/v1/auth/password-reset/request",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    confirmPasswordReset(input, options) {
      return requestJson<PasswordResetConfirmResponseDto>(
        config,
        "api/v1/auth/password-reset/confirm",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    getSession(options) {
      return requestJson<AuthSessionDto>(
        config,
        "api/v1/auth/session",
        {
          method: "GET",
        },
        options,
      );
    },

    refreshSession(input, options) {
      return requestJson<AuthSessionDto>(
        config,
        "api/v1/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    logout(options) {
      return requestJson<LogoutResponseDto>(
        config,
        "api/v1/auth/logout",
        {
          method: "POST",
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

    startGoogleLogin(redirectTo, options) {
      const query = new URLSearchParams({
        redirectTo,
      });

      return requestJson<GoogleAuthStartResponseDto>(
        config,
        `api/v1/auth/google/start?${query.toString()}`,
        {
          method: "GET",
        },
        options,
      );
    },

    startGoogleBind(redirectTo, options) {
      const query = new URLSearchParams({
        redirectTo,
      });

      return requestJson<GoogleAuthStartResponseDto>(
        config,
        `api/v1/auth/google/bind/start?${query.toString()}`,
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

    updatePassword(input, options) {
      return requestJson<UpdatePasswordResponseDto>(
        config,
        "api/v1/profile/password",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    sendPasswordChangeCode(options) {
      return requestJson<SendPasswordChangeCodeResponseDto>(
        config,
        "api/v1/profile/password/send-code",
        {
          method: "POST",
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

    replaceUserApisPayload(input, options) {
      return requestJson<KeyManagerCloudStateDto>(
        config,
        "api/v1/profile/user-apis/payload",
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    revealUserApiSecret(input, options) {
      return requestJson<RevealUserApiSecretResponseDto>(
        config,
        "api/v1/profile/user-apis/reveal-secret",
        {
          method: "POST",
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

    getCapabilityGraphSnapshot(options) {
      return requestJson<CapabilityGraphSnapshotDto>(
        config,
        "api/v1/capability-graph/snapshot",
        { method: "GET" },
        options,
      );
    },

    listProviderConnections(options) {
      return requestJson<ProviderConnectionListDto>(
        config,
        "api/v1/provider-connections",
        { method: "GET" },
        options,
      );
    },

    createProviderConnection(input, options) {
      return requestJson<ProviderConnectionDto>(
        config,
        "api/v1/provider-connections",
        { method: "POST", body: JSON.stringify(input) },
        options,
      );
    },

    updateProviderConnection(connectionId, input, options) {
      return requestJson<ProviderConnectionDto>(
        config,
        `api/v1/provider-connections/${encodeURIComponent(connectionId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
        options,
      );
    },

    verifyProviderConnection(connectionId, options) {
      return requestJson<ProviderConnectionDto>(
        config,
        `api/v1/provider-connections/${encodeURIComponent(connectionId)}/verify`,
        { method: "POST" },
        options,
      );
    },

    deleteProviderConnection(connectionId, options) {
      return requestJson<DeleteProviderConnectionResponseDto>(
        config,
        `api/v1/provider-connections/${encodeURIComponent(connectionId)}`,
        { method: "DELETE" },
        options,
      );
    },

    checkUserRouteConnectivity(routeId, input, options) {
      let requestBody: Record<string, unknown> | undefined;
      let requestOptions = options;

      if (input && typeof input === 'object' && ('baseUrl' in input || 'apiKey' in input || 'format' in input || 'name' in input)) {
        requestBody = input as Record<string, unknown>;
      } else if (input) {
        requestOptions = input as ApiClientRequestOptions;
      }

      return requestJson<UserRouteConnectivityCheckDto>(
        config,
        `api/v1/profile/user-routes/${encodeURIComponent(routeId)}/connectivity`,
        {
          method: "POST",
          body: requestBody ? JSON.stringify(requestBody) : undefined,
        },
        requestOptions,
      );
    },

    syncUserRoutePricing(routeId, input, options) {
      return requestJson<UserRoutePricingSyncDto>(
        config,
        `api/v1/profile/user-routes/${encodeURIComponent(routeId)}/pricing-sync`,
        {
          method: "POST",
          body: input ? JSON.stringify(input) : undefined,
        },
        options,
      );
    },

    getWuyinCatalog(options) {
      return requestWuyinCatalog(
        config,
        "api/v1/wuyin/catalog",
        "GET",
        options,
      );
    },

    refreshWuyinCatalog(options) {
      return requestWuyinCatalog(
        config,
        "api/v1/wuyin/catalog/refresh",
        "POST",
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

    listAdminUsers(input, options) {
      const query = new URLSearchParams();
      if (typeof input?.page === "number") {
        query.set("page", String(input.page));
      }
      if (typeof input?.limit === "number") {
        query.set("limit", String(input.limit));
      }
      if (input?.search) {
        query.set("search", input.search);
      }

      const path = query.size > 0
        ? `api/v1/admin/users?${query.toString()}`
        : "api/v1/admin/users";

      return requestJson<ListAdminUsersResponseDto>(
        config,
        path,
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

    adjustAdminCredits(input, options) {
      return requestJson<AdminAdjustCreditsResponseDto>(
        config,
        "api/v1/admin/billing/credit-adjustments",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    getAdminCreditAccount(identity, options) {
      return requestJson<AdminCreditAccountLookupDto>(
        config,
        `api/v1/admin/billing/accounts/${encodeURIComponent(identity)}`,
        {
          method: "GET",
        },
        options,
      );
    },

    createRechargeSubmission(input, options) {
      return requestJson<CreateRechargeSubmissionResponseDto>(
        config,
        "api/v1/billing/recharge-submissions",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    submitRechargeProof(submissionId, input, options) {
      return requestJson<SubmitRechargeProofResponseDto>(
        config,
        `api/v1/billing/recharge-submissions/${encodeURIComponent(submissionId)}/proof`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    markRechargeSubmissionPaid(submissionId, options) {
      return requestJson<MarkRechargeSubmissionPaidResponseDto>(
        config,
        `api/v1/billing/recharge-submissions/${encodeURIComponent(submissionId)}/mark-paid`,
        {
          method: "POST",
        },
        options,
      );
    },

    listAdminRechargeSubmissions(options) {
      return requestJson<ListAdminRechargeSubmissionsResponseDto>(
        config,
        "api/v1/admin/billing/recharge-submissions",
        {
          method: "GET",
        },
        options,
      );
    },

    getAdminRechargeSubmission(submissionId, options) {
      return requestJson<GetAdminRechargeSubmissionResponseDto>(
        config,
        `api/v1/admin/billing/recharge-submissions/${encodeURIComponent(submissionId)}`,
        {
          method: "GET",
        },
        options,
      );
    },

    reviewRechargeSubmission(submissionId, input, options) {
      return requestJson<ReviewRechargeSubmissionResponseDto>(
        config,
        `api/v1/admin/billing/recharge-submissions/${encodeURIComponent(submissionId)}/review`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    listRechargePaymentChannels(options) {
      return requestJson<RechargePaymentChannelConfigListDto>(
        config,
        "api/v1/billing/payment-channels",
        {
          method: "GET",
        },
        options,
      );
    },

    submitRecharge(input, options) {
      return requestJson<SubmitRechargeResponseDto>(
        config,
        "api/v1/billing/submit-recharge",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    listCreditExchangeRates(options) {
      return requestJson<CreditExchangeRateListDto>(
        config,
        "api/v1/billing/exchange-rates",
        {
          method: "GET",
        },
        options,
      );
    },

    upsertCreditExchangeRate(input, options) {
      return requestJson<CreditExchangeRateDto>(
        config,
        "api/v1/admin/billing/exchange-rates",
        {
          method: "PUT",
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

    listActiveModels(options) {
      return requestJson<ActiveCreditModelListDto>(
        config,
        "api/v1/model-catalog/active",
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

    getAdminCreditProviderPricingCache(providerId, options) {
      return requestJson<ProviderPricingCacheDto>(
        config,
        `api/v1/admin/credit-providers/${encodeURIComponent(providerId)}/pricing-cache`,
        {
          method: "GET",
        },
        options,
      );
    },

    upsertAdminCreditProviderPricingCache(providerId, input, options) {
      return requestJson<ProviderPricingCacheDto>(
        config,
        `api/v1/admin/credit-providers/${encodeURIComponent(providerId)}/pricing-cache`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    getSharedProviderPricingCache(baseUrl, options) {
      const query = new URLSearchParams({
        baseUrl,
      });

      return requestJson<ProviderPricingCacheDto>(
        config,
        `api/v1/provider-pricing-cache?${query.toString()}`,
        {
          method: "GET",
        },
        options,
      );
    },

    upsertSharedProviderPricingCache(baseUrl, input, options) {
      const query = new URLSearchParams({
        baseUrl,
      });

      return requestJson<ProviderPricingCacheDto>(
        config,
        `api/v1/provider-pricing-cache?${query.toString()}`,
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

    createAsset(input, options) {
      return requestJson<CreateAssetResponseDto>(
        config,
        "api/v1/assets",
        {
          method: "POST",
          body: JSON.stringify(input),
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

    createGenerationJob(input, options) {
      return requestJson<GenerationBatchJobDto>(
        config,
        "api/v1/generation-jobs",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        options,
      );
    },

    listGenerationJobs(input, options) {
      const query = new URLSearchParams();
      for (const status of input?.statuses || []) query.append("status", status);
      if (input?.cursor) query.set("cursor", input.cursor);
      if (typeof input?.limit === "number") query.set("limit", String(input.limit));
      const path = query.size > 0
        ? `api/v1/generation-jobs?${query.toString()}`
        : "api/v1/generation-jobs";
      return requestJson<GenerationBatchJobListDto>(config, path, { method: "GET" }, options);
    },

    listPendingGenerationV3Jobs(options) {
      return requestJson<GenerationJobListDtoV3>(
        config,
        "api/v1/generation/jobs",
        { method: "GET" },
        options,
      );
    },

    getGenerationJob(jobId, options) {
      return requestJson<GenerationBatchJobDto>(
        config,
        `api/v1/generation-jobs/${encodeURIComponent(jobId)}`,
        { method: "GET" },
        options,
      );
    },

    updateGenerationJob(jobId, input, options) {
      return requestJson<GenerationBatchJobDto>(
        config,
        `api/v1/generation-jobs/${encodeURIComponent(jobId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
        options,
      );
    },

    controlGenerationJob(jobId, input, options) {
      return requestJson<GenerationBatchJobDto>(
        config,
        `api/v1/generation-jobs/${encodeURIComponent(jobId)}/control`,
        { method: "POST", body: JSON.stringify(input) },
        options,
      );
    },

    claimGenerationJob(jobId, input, options) {
      return requestJson<GenerationBatchJobDto>(
        config,
        `api/v1/generation-jobs/${encodeURIComponent(jobId)}/claim`,
        { method: "POST", body: JSON.stringify(input) },
        options,
      );
    },

    upsertAgentRun(input, options) {
      return requestJson<AssistantApiResultDto<AgentRunDto>>(
        config,
        "api/ai-assistant/runs",
        { method: "POST", body: JSON.stringify(input) },
        options,
      );
    },

    recordAgentToolCall(input, options) {
      return requestJson<AssistantApiResultDto<AgentToolCallDto>>(
        config,
        "api/ai-assistant/tool-calls",
        { method: "POST", body: JSON.stringify(input) },
        options,
      );
    },

    recordKnowledgeChange(input, options) {
      return requestJson<AssistantApiResultDto<AgentKnowledgeDocumentDto>>(
        config,
        "api/ai-assistant/changes",
        { method: "POST", body: JSON.stringify(input) },
        options,
      );
    },

    searchAgentKnowledge(input = {}, options) {
      const params = new URLSearchParams();
      const query = String(input.query || "").trim();
      if (query) params.set("query", query);
      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      return requestJson<AssistantApiResultDto<AgentKnowledgeDocumentDto[]>>(
        config,
        `api/ai-assistant/knowledge${suffix}`,
        { method: "GET" },
        options,
      );
    },

    upsertAgentSkill(input, options) {
      return requestJson<AssistantApiResultDto<AgentSkillDto>>(
        config,
        "api/ai-assistant/skills",
        { method: "POST", body: JSON.stringify(input) },
        options,
      );
    },

    deleteAgentSkill(skillId, input, options) {
      return requestJson<AssistantApiResultDto<AgentSkillDto>>(
        config,
        `api/ai-assistant/skills/${encodeURIComponent(skillId)}`,
        { method: "DELETE", body: JSON.stringify(input) },
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
