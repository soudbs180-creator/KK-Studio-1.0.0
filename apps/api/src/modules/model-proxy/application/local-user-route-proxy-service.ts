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
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import type { ServerSupabaseConfig } from "../../../lib/server-supabase-config.ts";
import type { AuthDataService } from "../../auth/index.ts";

const INTERNAL_ROUTE_SECRET_HEADER = "x-kk-internal-route-secret";
const LOCAL_PROXY_TASK_PREFIX = "local_proxy:";

type LocalUserRouteProxyMode =
  | "chat"
  | "image"
  | "video"
  | "audio"
  | "task_status"
  | "cancel_task"
  | "delete_task"
  | "download_task";

export interface LocalUserRouteProxyRequest {
  mode: LocalUserRouteProxyMode;
  routeId?: string;
  localTaskId?: string;
  taskId?: string;
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

type LocalUserRouteProxyTransport =
  | SecureModelProxyChatTransportDto
  | SecureModelProxyImageTransportDto
  | SecureModelProxyVideoTransportDto
  | SecureModelProxyAudioTransportDto
  | SecureModelProxyTaskTransportDto
  | SecureModelProxyDownloadTransportDto;

type LocalTaskPayload = {
  v: 1;
  userId: string;
  routeId: string;
  taskId: string;
};

export class LocalUserRouteProxyError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, options?: { code?: string; statusCode?: number }) {
    super(message);
    this.name = "LocalUserRouteProxyError";
    this.code = options?.code || "LOCAL_USER_ROUTE_PROXY_ERROR";
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

function readBearerToken(headers: Record<string, string>): string | undefined {
  const authorization = String(headers.authorization || "").trim();
  if (!authorization) {
    return undefined;
  }

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || undefined;
  }

  return authorization;
}

export class LocalUserRouteProxyService {
  private readonly logger = consoleLogger.child({ module: "local-user-route-proxy" });
  private readonly authDataService: AuthDataService;
  private readonly supabaseUrl?: string;
  private readonly authKey?: string;
  private readonly sharedSecret?: string;

  constructor(
    authDataService: AuthDataService,
    config: ServerSupabaseConfig,
  ) {
    this.authDataService = authDataService;
    this.supabaseUrl = config.supabaseUrl;
    this.authKey = config.authKey;
    this.sharedSecret = config.userApiEncryptionSecret;
  }

  async invoke(
    userId: string,
    email: string | undefined,
    requestHeaders: Record<string, string>,
    input: LocalUserRouteProxyRequest,
  ): Promise<LocalUserRouteProxyTransport> {
    const accessToken = readBearerToken(requestHeaders);
    if (!accessToken) {
      throw new LocalUserRouteProxyError("Authentication is required for local user-route proxy calls.", {
        code: "AUTH_REQUIRED",
        statusCode: 401,
      });
    }

    if (!this.supabaseUrl || !this.authKey || !this.sharedSecret) {
      throw new LocalUserRouteProxyError("The local user-route proxy is not fully configured on this API server.", {
        code: "LOCAL_USER_ROUTE_PROXY_UNAVAILABLE",
        statusCode: 503,
      });
    }

    const effectiveMode = input.mode;
    let routeId = String(input.routeId || "").trim();
    let upstreamTaskId = String(input.taskId || "").trim();

    if (effectiveMode === "task_status" || effectiveMode === "cancel_task" || effectiveMode === "delete_task" || effectiveMode === "download_task") {
      const decodedTask = this.decodeLocalTaskToken(String(input.localTaskId || "").trim(), userId);
      routeId = decodedTask.routeId;
      upstreamTaskId = decodedTask.taskId;
    }

    if (!routeId) {
      throw new LocalUserRouteProxyError("routeId is required for local user-route proxy calls.", {
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
    }

    const routeConfig = await this.authDataService.resolveSecureProxyUserRouteConfig(
      userId,
      email,
      routeId,
      accessToken,
    );
    if (!routeConfig) {
      throw new LocalUserRouteProxyError("The selected local route could not be resolved.", {
        code: "USER_ROUTE_NOT_FOUND",
        statusCode: 404,
      });
    }

    const payload: Record<string, unknown> = {
      mode: effectiveMode,
      routeConfig,
    };

    if (effectiveMode === "chat") {
      payload.modelId = String(input.modelId || "").trim();
      payload.messages = Array.isArray(input.messages) ? input.messages : [];
      payload.temperature = input.temperature;
      payload.maxTokens = input.maxTokens;
      payload.stream = Boolean(input.stream);
    } else if (effectiveMode === "image") {
      payload.modelId = String(input.modelId || "").trim();
      payload.prompt = String(input.prompt || "");
      payload.aspectRatio = input.aspectRatio;
      payload.imageSize = input.imageSize;
      payload.imageCount = input.imageCount;
      payload.referenceImages = Array.isArray(input.referenceImages) ? input.referenceImages : [];
    } else if (effectiveMode === "video") {
      payload.modelId = String(input.modelId || "").trim();
      payload.prompt = String(input.prompt || "");
      payload.aspectRatio = input.aspectRatio;
      payload.resolution = input.resolution;
      payload.duration = input.duration;
      payload.videoDuration = input.videoDuration;
      payload.imageUrl = input.imageUrl;
      payload.imageTailUrl = input.imageTailUrl;
    } else if (effectiveMode === "audio") {
      payload.modelId = String(input.modelId || "").trim();
      payload.prompt = String(input.prompt || "");
    } else {
      payload.taskId = upstreamTaskId;
    }

    const response = await this.invokeSecureProxy(accessToken, payload);
    if (effectiveMode === "video") {
      const videoResponse = response as SecureModelProxyVideoTransportDto;
      if (typeof videoResponse.taskId === "string" && videoResponse.taskId.trim()) {
        return {
          ...videoResponse,
          taskId: this.encodeLocalTaskToken({
            v: 1,
            userId,
            routeId,
            taskId: videoResponse.taskId,
          }),
        } satisfies SecureModelProxyVideoTransportDto;
      }
    }

    return response;
  }

  private async invokeSecureProxy(
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<LocalUserRouteProxyTransport> {
    const endpoint = `${this.supabaseUrl!.replace(/\/+$/, "")}/functions/v1/secure-model-proxy`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.authKey!,
        Authorization: `Bearer ${accessToken}`,
        [INTERNAL_ROUTE_SECRET_HEADER]: this.sharedSecret!,
      },
      body: JSON.stringify(payload),
    });

    let responseBody: any = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    if (!response.ok || !responseBody?.success) {
      const errorMessage =
        typeof responseBody?.error === "string"
          ? responseBody.error
          : typeof responseBody?.error?.message === "string"
            ? responseBody.error.message
            : `Local user-route proxy request failed with status ${response.status}`;
      throw new LocalUserRouteProxyError(errorMessage, {
        code:
          typeof responseBody?.error === "object" && typeof responseBody?.error?.code === "string"
            ? responseBody.error.code
            : "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
        statusCode: response.status || 502,
      });
    }

    return responseBody as LocalUserRouteProxyTransport;
  }

  private encodeLocalTaskToken(payload: LocalTaskPayload): string {
    const serialized = JSON.stringify(payload);
    const encodedPayload = toBase64Url(serialized);
    const signature = toBase64Url(
      createHmac("sha256", this.sharedSecret!)
        .update(encodedPayload)
        .digest(),
    );
    return `${LOCAL_PROXY_TASK_PREFIX}${encodedPayload}.${signature}`;
  }

  private decodeLocalTaskToken(token: string, expectedUserId: string): LocalTaskPayload {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken.startsWith(LOCAL_PROXY_TASK_PREFIX)) {
      throw new LocalUserRouteProxyError("Invalid local task id.", {
        code: "INVALID_TASK_ID",
        statusCode: 400,
      });
    }

    const signedPayload = normalizedToken.slice(LOCAL_PROXY_TASK_PREFIX.length);
    const separatorIndex = signedPayload.lastIndexOf(".");
    if (separatorIndex <= 0) {
      throw new LocalUserRouteProxyError("Invalid local task token signature.", {
        code: "INVALID_TASK_ID",
        statusCode: 400,
      });
    }

    const encodedPayload = signedPayload.slice(0, separatorIndex);
    const providedSignature = signedPayload.slice(separatorIndex + 1);
    const expectedSignature = toBase64Url(
      createHmac("sha256", this.sharedSecret!)
        .update(encodedPayload)
        .digest(),
    );

    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new LocalUserRouteProxyError("Local task token verification failed.", {
        code: "INVALID_TASK_ID",
        statusCode: 400,
      });
    }

    let payload: LocalTaskPayload | null = null;
    try {
      payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as LocalTaskPayload;
    } catch {
      payload = null;
    }

    if (
      !payload
      || payload.v !== 1
      || String(payload.userId || "").trim() !== expectedUserId
      || !String(payload.routeId || "").trim()
      || !String(payload.taskId || "").trim()
    ) {
      throw new LocalUserRouteProxyError("Local task token payload is invalid.", {
        code: "INVALID_TASK_ID",
        statusCode: 400,
      });
    }

    return payload;
  }
}
