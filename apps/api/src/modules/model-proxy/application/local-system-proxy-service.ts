import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  SecureModelProxyAudioRequestDto,
  SecureModelProxyAudioTransportDto,
  SecureModelProxyChatRequestDto,
  SecureModelProxyChatTransportDto,
  SecureModelProxyDownloadTransportDto,
  SecureModelProxyImageRequestDto,
  SecureModelProxyImageTransportDto,
  SecureModelProxyTaskTransportDto,
  SecureModelProxyVideoRequestDto,
  SecureModelProxyVideoTransportDto,
  SecureProxyUserRouteConfigDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { CreditAccountService } from "../../billing/index.ts";
import type {
  ActiveCreditModelRuntimeRoute,
  CreditProviderRepository,
} from "../../model-catalog/index.ts";
import type {
  LocalResolvedImageSurface,
  LocalUserRouteProxyService,
  LocalUserRouteProxyRequest,
} from "./local-user-route-proxy-service.ts";

const SYSTEM_PROXY_TASK_PREFIX = "system_proxy:";

type LocalSystemProxyMode =
  | "chat"
  | "image"
  | "video"
  | "audio"
  | "task_status"
  | "cancel_task"
  | "delete_task"
  | "download_task";

export interface LocalSystemProxyRequest {
  mode: LocalSystemProxyMode;
  taskId?: string;
  requestId?: string;
  attemptId?: string;
  modelId?: string;
  messages?: SecureModelProxyChatRequestDto["messages"];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  prompt?: string;
  aspectRatio?: string;
  imageSize?: string;
  imageCount?: number;
  referenceImages?: SecureModelProxyImageRequestDto["referenceImages"];
  resolution?: string;
  duration?: number;
  videoDuration?: string;
  imageUrl?: string;
  imageTailUrl?: string;
}

type LocalSystemProxyTransport =
  | SecureModelProxyChatTransportDto
  | SecureModelProxyImageTransportDto
  | SecureModelProxyVideoTransportDto
  | SecureModelProxyAudioTransportDto
  | SecureModelProxyTaskTransportDto
  | SecureModelProxyDownloadTransportDto;

type SystemTaskPayload = {
  v: 1;
  kind: "image" | "video";
  userId: string;
  modelId: string;
  providerId: string;
  taskId: string;
  transactionId: string;
  balanceAfter?: number;
  requestId?: string;
  attemptId?: string;
};

type ParsedSystemModelRoute = {
  baseModelId: string;
  routeIndex: number | null;
  routeKey: string | null;
};

type SelectedRuntimeRoute = {
  route: ActiveCreditModelRuntimeRoute;
  requiredCredits: number;
  imageSurface: LocalResolvedImageSurface;
};

type RefundOutcome = {
  applied: boolean;
  balanceAfter?: number;
};

export interface LocalSystemProxyServiceOptions {
  creditProviderRepository: Pick<CreditProviderRepository, "listActiveRuntimeRoutes">;
  creditAccountService: CreditAccountService;
  directRouteInvoker: Pick<LocalUserRouteProxyService, "invokeResolvedRoute">;
  taskSigningSecret?: string;
}

export class LocalSystemProxyError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, options?: { code?: string; statusCode?: number }) {
    super(message);
    this.name = "LocalSystemProxyError";
    this.code = options?.code || "LOCAL_SYSTEM_PROXY_ERROR";
    this.statusCode = options?.statusCode || 500;
  }
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const normalized = String(input || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${"=".repeat(padLength)}`, "base64");
}

function normalizeImageSize(imageSize?: string): string {
  const raw = String(imageSize || "1K").toUpperCase();
  if (raw.includes("4K")) return "4K";
  if (raw.includes("2K")) return "2K";
  if (raw.includes("0.5K") || raw.includes("512")) return "0.5K";
  return "1K";
}

function parseSystemModelRoute(input: string): ParsedSystemModelRoute {
  const rawModelId = String(input || "").trim();
  const [baseModelId, rawSuffix = ""] = rawModelId.split("@");
  const suffix = rawSuffix.trim().toLowerCase();
  const systemMatch = suffix.match(/^system(?:_(.+))?$/);

  if (!systemMatch) {
    return {
      baseModelId: baseModelId.trim(),
      routeIndex: null,
      routeKey: null,
    };
  }

  const rawRouteToken = String(systemMatch[1] || "").trim();
  if (!rawRouteToken) {
    return {
      baseModelId: baseModelId.trim(),
      routeIndex: null,
      routeKey: null,
    };
  }

  if (/^\d+$/.test(rawRouteToken)) {
    const parsedIndex = Number(rawRouteToken) - 1;
    return {
      baseModelId: baseModelId.trim(),
      routeIndex: Number.isFinite(parsedIndex) && parsedIndex >= 0 ? parsedIndex : 0,
      routeKey: null,
    };
  }

  let routeKey = rawRouteToken;
  try {
    routeKey = decodeURIComponent(rawRouteToken);
  } catch {
    routeKey = rawRouteToken;
  }

  return {
    baseModelId: baseModelId.trim(),
    routeIndex: null,
    routeKey: routeKey.toLowerCase(),
  };
}

function compareRuntimeRoutes(left: ActiveCreditModelRuntimeRoute, right: ActiveCreditModelRuntimeRoute): number {
  const priorityDiff = Number(right.priority || 0) - Number(left.priority || 0);
  if (priorityDiff !== 0) return priorityDiff;

  const weightDiff = Number(right.weight || 0) - Number(left.weight || 0);
  if (weightDiff !== 0) return weightDiff;

  const providerDiff = String(left.providerId || "").localeCompare(String(right.providerId || ""));
  if (providerDiff !== 0) return providerDiff;

  return String(left.modelId || "").localeCompare(String(right.modelId || ""));
}

function normalizeQualityPricing(
  pricing: ActiveCreditModelRuntimeRoute["qualityPricing"],
  fallbackCost: number,
): Record<string, { enabled: boolean; creditCost: number }> {
  const safeCost = Math.max(1, Number(fallbackCost || 1));
  const defaults = {
    "0.5K": { enabled: true, creditCost: Math.max(1, Math.floor(safeCost * 0.5)) },
    "1K": { enabled: true, creditCost: safeCost },
    "2K": { enabled: true, creditCost: safeCost * 2 },
    "4K": { enabled: true, creditCost: safeCost * 4 },
  };

  if (!pricing || typeof pricing !== "object") {
    return defaults;
  }

  for (const size of ["0.5K", "1K", "2K", "4K"] as const) {
    const item = pricing[size];
    if (!item || typeof item !== "object") continue;
    defaults[size] = {
      enabled: item.enabled !== false,
      creditCost: Math.max(1, Number(item.creditCost || defaults[size].creditCost)),
    };
  }

  return defaults;
}

function isRouteQualityEnabled(route: ActiveCreditModelRuntimeRoute, requestedSize: string): boolean {
  if (!route.advancedEnabled) return true;
  const pricing = normalizeQualityPricing(route.qualityPricing, Number(route.creditCost || 1));
  return pricing[requestedSize]?.enabled !== false;
}

function getRouteCreditCost(route: ActiveCreditModelRuntimeRoute, requestedSize: string): number {
  if (!route.advancedEnabled) {
    return Math.max(1, Number(route.creditCost || 1));
  }

  const pricing = normalizeQualityPricing(route.qualityPricing, Number(route.creditCost || 1));
  return Math.max(1, Number(pricing[requestedSize]?.creditCost || route.creditCost || 1));
}

function inferSystemImageSurface(endpointType: string | undefined): LocalResolvedImageSurface {
  const normalized = String(endpointType || "").trim().toLowerCase();
  if (normalized.includes("image-generation-async") || normalized.includes("/images/async/")) {
    return "async-image";
  }
  if (normalized.includes("gemini") || normalized.includes("generatecontent")) {
    return "gemini-native-image";
  }
  return "provider-images";
}

function pickRandomKey(apiKeys: string[]): string | undefined {
  const available = apiKeys
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (!available.length) {
    return undefined;
  }
  if (available.length === 1) {
    return available[0];
  }
  const index = Math.floor(Math.random() * available.length);
  return available[index] || available[0];
}

function inferRouteFormat(endpointType: string | undefined): SecureProxyUserRouteConfigDto["format"] {
  const normalized = String(endpointType || "").trim().toLowerCase();
  if (normalized.includes("claude") || normalized.includes("messages")) {
    return "claude";
  }
  if (normalized.includes("gemini") || normalized.includes("generatecontent")) {
    return "gemini";
  }
  return "openai";
}

function pickCheapestRoute(
  routes: ActiveCreditModelRuntimeRoute[],
  requestedSize: string,
  options?: {
    onlyEnabledForRequestedSize?: boolean;
    useBaseCreditCost?: boolean;
  },
): SelectedRuntimeRoute | null {
  if (routes.length === 0) return null;

  const onlyEnabledForRequestedSize = options?.onlyEnabledForRequestedSize !== false;
  const useBaseCreditCost = options?.useBaseCreditCost === true;

  const scopedRoutes = onlyEnabledForRequestedSize
    ? routes.filter((route) => isRouteQualityEnabled(route, requestedSize))
    : routes;

  if (scopedRoutes.length === 0) return null;

  const pricedRoutes = scopedRoutes.map((route) => ({
    route,
    requiredCredits: useBaseCreditCost
      ? Math.max(1, Number(route.creditCost || 1))
      : getRouteCreditCost(route, requestedSize),
  }));

  const lowestCost = Math.min(...pricedRoutes.map((item) => item.requiredCredits));
  const cheapestRoutes = pricedRoutes.filter((item) => item.requiredCredits === lowestCost);
  const picked = cheapestRoutes[Math.floor(Math.random() * cheapestRoutes.length)] || cheapestRoutes[0];
  if (!picked) {
    return null;
  }

  return {
    route: picked.route,
    requiredCredits: picked.requiredCredits,
    imageSurface: inferSystemImageSurface(picked.route.endpointType),
  };
}

function pickCreditModelRoute(
  routes: ActiveCreditModelRuntimeRoute[],
  requestedSize: string,
  routeIndex: number | null,
  routeKey: string | null,
): SelectedRuntimeRoute | null {
  const sortedRoutes = [...routes].sort(compareRuntimeRoutes);
  const mixedRoutes = sortedRoutes.filter((route) => route.mixWithSameModel === true);
  const eligibleRoutes = sortedRoutes.filter((route) => isRouteQualityEnabled(route, requestedSize));

  if (routeKey) {
    const exactRoute = sortedRoutes.find(
      (route) => String(route.providerId || "").trim().toLowerCase() === routeKey,
    );
    if (!exactRoute || !isRouteQualityEnabled(exactRoute, requestedSize)) {
      return null;
    }

    return {
      route: exactRoute,
      requiredCredits: getRouteCreditCost(exactRoute, requestedSize),
      imageSurface: inferSystemImageSurface(exactRoute.endpointType),
    };
  }

  if ((routeIndex === null || routeIndex === 0) && mixedRoutes.length > 1) {
    const selectedForRequestedSize = pickCheapestRoute(mixedRoutes, requestedSize, {
      onlyEnabledForRequestedSize: true,
      useBaseCreditCost: false,
    });
    if (selectedForRequestedSize) {
      return selectedForRequestedSize;
    }

    return pickCheapestRoute(mixedRoutes, requestedSize, {
      onlyEnabledForRequestedSize: false,
      useBaseCreditCost: true,
    });
  }

  if (routeIndex !== null) {
    const exactRoute = sortedRoutes[routeIndex] || sortedRoutes[0];
    if (!exactRoute || !isRouteQualityEnabled(exactRoute, requestedSize)) {
      return null;
    }

    return {
      route: exactRoute,
      requiredCredits: getRouteCreditCost(exactRoute, requestedSize),
      imageSurface: inferSystemImageSurface(exactRoute.endpointType),
    };
  }

  if (eligibleRoutes.length === 0) return null;
  return {
    route: eligibleRoutes[0],
    requiredCredits: getRouteCreditCost(eligibleRoutes[0], requestedSize),
    imageSurface: inferSystemImageSurface(eligibleRoutes[0].endpointType),
  };
}

function buildRouteConfig(route: ActiveCreditModelRuntimeRoute, apiKey: string): SecureProxyUserRouteConfigDto {
  return {
    routeId: route.providerId,
    provider: route.providerName || route.providerId,
    baseUrl: route.baseUrl,
    apiKey,
    format: inferRouteFormat(route.endpointType),
  };
}

function enrichTransportWithDebit<T extends LocalSystemProxyTransport>(
  transport: T,
  ledgerId: string,
  balanceAfter: number | undefined,
): T {
  return {
    ...transport,
    deducted: true,
    ledgerId,
    balanceAfter,
  };
}

function appendRefundMetadata<T extends LocalSystemProxyTransport>(
  transport: T,
  refund: RefundOutcome,
): T {
  if (!refund.applied && typeof refund.balanceAfter === "undefined") {
    return transport;
  }

  return {
    ...transport,
    refundApplied: refund.applied,
    refundBalanceAfter: refund.balanceAfter,
  };
}

export class LocalSystemProxyService {
  private readonly creditProviderRepository: Pick<CreditProviderRepository, "listActiveRuntimeRoutes">;
  private readonly creditAccountService: CreditAccountService;
  private readonly directRouteInvoker: Pick<LocalUserRouteProxyService, "invokeResolvedRoute">;
  private readonly taskSigningSecret: string;

  constructor(options: LocalSystemProxyServiceOptions) {
    this.creditProviderRepository = options.creditProviderRepository;
    this.creditAccountService = options.creditAccountService;
    this.directRouteInvoker = options.directRouteInvoker;
    this.taskSigningSecret = String(options.taskSigningSecret || "").trim();
  }

  async invoke(
    userId: string,
    input: LocalSystemProxyRequest,
  ): Promise<LocalSystemProxyTransport> {
    if (input.mode === "task_status" || input.mode === "cancel_task" || input.mode === "delete_task" || input.mode === "download_task") {
      return this.invokeTaskOperation(userId, input);
    }

    if (input.mode === "image" || input.mode === "video") {
      this.requireTaskSigningSecret();
    }

    const parsedRoute = parseSystemModelRoute(String(input.modelId || ""));
    const baseModelId = parsedRoute.baseModelId;
    if (!baseModelId) {
      throw new LocalSystemProxyError("modelId is required.", {
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
    }

    const routes = await this.creditProviderRepository.listActiveRuntimeRoutes(baseModelId);
    const selected = pickCreditModelRoute(
      routes,
      normalizeImageSize(input.imageSize),
      parsedRoute.routeIndex,
      parsedRoute.routeKey,
    );
    if (!selected) {
      throw new LocalSystemProxyError("Model route not found.", {
        code: "MODEL_ROUTE_NOT_FOUND",
        statusCode: 404,
      });
    }

    const selectedKey = pickRandomKey(selected.route.apiKeys);
    if (!selectedKey) {
      throw new LocalSystemProxyError("Provider key is not configured for this system model route.", {
        code: "PROVIDER_KEY_MISSING",
        statusCode: 500,
      });
    }

    const routeConfig = buildRouteConfig(selected.route, selectedKey);
    const requestId = String(input.requestId || "").trim() || undefined;
    const attemptId = String(input.attemptId || "").trim() || undefined;
    const businessRefId = requestId || attemptId || `${baseModelId}:${Date.now()}`;
    const idempotencyKey = requestId || attemptId || `${baseModelId}:${Date.now()}`;
    const debit = await this.creditAccountService.debitCredits(
      userId,
      {
        businessRefType: "system_model_proxy",
        businessRefId,
        creditAmount: selected.requiredCredits,
        modelCode: baseModelId,
        idempotencyKey,
      },
      requestId || businessRefId,
    );

    if (debit.success === false) {
      throw new LocalSystemProxyError(
        debit.error?.message || "Unable to debit credits for the system model route.",
        {
          code: debit.error?.code || "CREDIT_DEBIT_FAILED",
          statusCode: debit.error?.code === "CREDIT_BALANCE_INSUFFICIENT" ? 402 : 500,
        },
      );
    }

    if (!debit.data) {
      throw new LocalSystemProxyError("Unable to debit credits for the system model route.", {
        code: "CREDIT_DEBIT_FAILED",
        statusCode: 500,
      });
    }
    const debitData = debit.data;

    const directRequest: LocalUserRouteProxyRequest = {
      ...input,
      modelId: baseModelId,
      requestId,
      attemptId,
    };

    try {
      const response = await this.directRouteInvoker.invokeResolvedRoute(
        routeConfig,
        directRequest,
        {
          imageSurface: input.mode === "image" ? selected.imageSurface : undefined,
        },
      );

      const billedResponse = enrichTransportWithDebit(
        response,
        debitData.ledgerId,
        debitData.balanceAfter,
      );

      if (input.mode === "image") {
        const imageResponse = billedResponse as SecureModelProxyImageTransportDto;
        if (typeof imageResponse.taskId === "string" && imageResponse.taskId.trim()) {
          return {
            ...imageResponse,
            taskId: this.encodeTaskToken({
              v: 1,
              kind: "image",
              userId,
              modelId: baseModelId,
              providerId: selected.route.providerId,
              taskId: imageResponse.taskId,
              transactionId: debitData.ledgerId,
              balanceAfter: debitData.balanceAfter,
              requestId,
              attemptId,
            }),
          };
        }

        return imageResponse;
      }

      if (input.mode === "video") {
        const videoResponse = billedResponse as SecureModelProxyVideoTransportDto;
        if (typeof videoResponse.taskId === "string" && videoResponse.taskId.trim()) {
          return {
            ...videoResponse,
            taskId: this.encodeTaskToken({
              v: 1,
              kind: "video",
              userId,
              modelId: baseModelId,
              providerId: selected.route.providerId,
              taskId: videoResponse.taskId,
              transactionId: debitData.ledgerId,
              balanceAfter: debitData.balanceAfter,
              requestId,
              attemptId,
            }),
          };
        }

        return videoResponse;
      }

      return billedResponse;
    } catch (error) {
      const refund = await this.refundCredits(userId, debitData.ledgerId, "system_route_request_failed");
      const message = error instanceof Error ? error.message : "System route request failed.";
      throw new LocalSystemProxyError(
        refund.applied ? message : `${message} (credit rollback failed)`,
        {
          code: "LOCAL_SYSTEM_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        },
      );
    }
  }

  private async invokeTaskOperation(
    userId: string,
    input: LocalSystemProxyRequest,
  ): Promise<LocalSystemProxyTransport> {
    const taskPayload = this.decodeTaskToken(String(input.taskId || "").trim(), userId);
    const routes = await this.creditProviderRepository.listActiveRuntimeRoutes(taskPayload.modelId);
    const selectedRoute = routes.find((route) => route.providerId === taskPayload.providerId);
    if (!selectedRoute) {
      throw new LocalSystemProxyError("Model route not found for the stored task.", {
        code: "MODEL_ROUTE_NOT_FOUND",
        statusCode: 404,
      });
    }

    const selectedKey = pickRandomKey(selectedRoute.apiKeys);
    if (!selectedKey) {
      throw new LocalSystemProxyError("Provider key is not configured for this stored task.", {
        code: "PROVIDER_KEY_MISSING",
        statusCode: 500,
      });
    }

    const routeConfig = buildRouteConfig(selectedRoute, selectedKey);
    const directResponse = await this.directRouteInvoker.invokeResolvedRoute(
      routeConfig,
      {
        mode: input.mode,
        taskId: taskPayload.taskId,
        modelId: taskPayload.modelId,
        requestId: taskPayload.requestId || input.requestId,
        attemptId: taskPayload.attemptId || input.attemptId,
      },
      {
        taskMode: taskPayload.kind,
      },
    );

    const billedResponse = enrichTransportWithDebit(
      directResponse,
      taskPayload.transactionId,
      taskPayload.balanceAfter,
    );

    if (input.mode === "delete_task") {
      return billedResponse;
    }

    const shouldRefundOnFailure = (
      input.mode === "cancel_task"
      || (typeof (billedResponse as SecureModelProxyTaskTransportDto).status === "string"
        && (billedResponse as SecureModelProxyTaskTransportDto).status === "failed")
    );

    if (shouldRefundOnFailure) {
      const refund = await this.refundCredits(
        userId,
        taskPayload.transactionId,
        input.mode === "cancel_task" ? "system_route_task_cancelled" : "system_route_task_failed",
      );
      return appendRefundMetadata(billedResponse, refund);
    }

    return billedResponse;
  }

  private async refundCredits(
    userId: string,
    transactionId: string,
    reason: string,
  ): Promise<RefundOutcome> {
    const result = await this.creditAccountService.refundCredits(
      userId,
      {
        transactionId,
        reason,
      },
      transactionId,
    );

    if (result.success && result.data) {
      return {
        applied: true,
        balanceAfter: result.data.balanceAfter,
      };
    }

    if (result.success === false && result.error?.code === "CREDIT_TRANSACTION_NOT_REFUNDABLE") {
      return { applied: false };
    }

    throw new LocalSystemProxyError(
      result.success === false ? result.error?.message || "Credit rollback failed." : "Credit rollback failed.",
      {
        code: result.success === false ? result.error?.code || "CREDIT_REFUND_FAILED" : "CREDIT_REFUND_FAILED",
        statusCode: 500,
      },
    );
  }

  private encodeTaskToken(payload: SystemTaskPayload): string {
    const taskSigningSecret = this.requireTaskSigningSecret();

    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = toBase64Url(
      createHmac("sha256", taskSigningSecret)
        .update(encodedPayload)
        .digest(),
    );
    return `${SYSTEM_PROXY_TASK_PREFIX}${encodedPayload}.${signature}`;
  }

  private decodeTaskToken(token: string, expectedUserId: string): SystemTaskPayload {
    const taskSigningSecret = this.requireTaskSigningSecret();

    const normalizedToken = String(token || "").trim();
    if (!normalizedToken.startsWith(SYSTEM_PROXY_TASK_PREFIX)) {
      throw new LocalSystemProxyError("Invalid task id.", {
        code: "INVALID_TASK_ID",
        statusCode: 400,
      });
    }

    const signedPayload = normalizedToken.slice(SYSTEM_PROXY_TASK_PREFIX.length);
    const separatorIndex = signedPayload.lastIndexOf(".");
    if (separatorIndex <= 0) {
      throw new LocalSystemProxyError("Invalid task token signature.", {
        code: "INVALID_TASK_ID",
        statusCode: 400,
      });
    }

    const encodedPayload = signedPayload.slice(0, separatorIndex);
    const providedSignature = signedPayload.slice(separatorIndex + 1);
    const expectedSignature = toBase64Url(
      createHmac("sha256", taskSigningSecret)
        .update(encodedPayload)
        .digest(),
    );

    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new LocalSystemProxyError("Task token verification failed.", {
        code: "INVALID_TASK_ID",
        statusCode: 400,
      });
    }

    let payload: SystemTaskPayload | null = null;
    try {
      payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as SystemTaskPayload;
    } catch {
      payload = null;
    }

    if (
      !payload
      || payload.v !== 1
      || String(payload.userId || "").trim() !== expectedUserId
      || !String(payload.modelId || "").trim()
      || !String(payload.providerId || "").trim()
      || !String(payload.taskId || "").trim()
      || !String(payload.transactionId || "").trim()
    ) {
      throw new LocalSystemProxyError("Task token payload is invalid.", {
        code: "INVALID_TASK_ID",
        statusCode: 400,
      });
    }

    return payload;
  }

  private requireTaskSigningSecret(): string {
    if (this.taskSigningSecret) {
      return this.taskSigningSecret;
    }

    throw new LocalSystemProxyError("System proxy task signing secret is not configured.", {
      code: "TASK_SIGNING_SECRET_REQUIRED",
      statusCode: 500,
    });
  }
}
