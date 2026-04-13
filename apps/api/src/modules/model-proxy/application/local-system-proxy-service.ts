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
import type { ServerSupabaseConfig } from "../../../lib/server-supabase-config.ts";

const TRANSIENT_PROXY_RETRY_STATUS_CODES = new Set([502, 503, 504]);
const MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS = 2;
const TRANSIENT_PROXY_RETRY_BASE_DELAY_MS = 250;

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

function shouldRetryProxyResponse(response?: Response): boolean {
  return Boolean(response && TRANSIENT_PROXY_RETRY_STATUS_CODES.has(response.status));
}

function isRetryableProxyFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError") {
    return false;
  }

  const message = String(error.message || "").trim().toLowerCase();
  return (
    error.name === "TypeError"
    || message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("network request failed")
    || message.includes("load failed")
  );
}

function waitForProxyRetry(attempt: number): Promise<void> {
  const delayMs = Math.max(0, TRANSIENT_PROXY_RETRY_BASE_DELAY_MS * attempt);
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

export class LocalSystemProxyService {
  private readonly supabaseUrl?: string;
  private readonly authKey?: string;

  constructor(config: ServerSupabaseConfig) {
    this.supabaseUrl = config.supabaseUrl;
    this.authKey = config.authKey;
  }

  async invoke(
    requestHeaders: Record<string, string>,
    input: LocalSystemProxyRequest,
  ): Promise<LocalSystemProxyTransport> {
    const accessToken = readBearerToken(requestHeaders);
    if (!accessToken) {
      throw new LocalSystemProxyError("Authentication is required for local system proxy calls.", {
        code: "AUTH_REQUIRED",
        statusCode: 401,
      });
    }

    if (!this.supabaseUrl || !this.authKey) {
      throw new LocalSystemProxyError("The local system proxy is not fully configured on this API server.", {
        code: "LOCAL_SYSTEM_PROXY_UNAVAILABLE",
        statusCode: 503,
      });
    }

    const requestId = String(input.requestId || "").trim() || undefined;
    const attemptId = String(input.attemptId || "").trim() || undefined;
    const payload: Record<string, unknown> = {
      mode: input.mode,
    };

    if (input.mode === "chat") {
      payload.modelId = String(input.modelId || "").trim();
      payload.messages = Array.isArray(input.messages) ? input.messages : [];
      payload.temperature = input.temperature;
      payload.maxTokens = input.maxTokens;
      payload.stream = Boolean(input.stream);
    } else if (input.mode === "image") {
      payload.modelId = String(input.modelId || "").trim();
      payload.prompt = String(input.prompt || "");
      payload.aspectRatio = input.aspectRatio;
      payload.imageSize = input.imageSize;
      payload.imageCount = input.imageCount;
      payload.referenceImages = Array.isArray(input.referenceImages) ? input.referenceImages : [];
    } else if (input.mode === "video") {
      payload.modelId = String(input.modelId || "").trim();
      payload.prompt = String(input.prompt || "");
      payload.aspectRatio = input.aspectRatio;
      payload.resolution = input.resolution;
      payload.duration = input.duration;
      payload.videoDuration = input.videoDuration;
      payload.imageUrl = input.imageUrl;
      payload.imageTailUrl = input.imageTailUrl;
    } else if (input.mode === "audio") {
      payload.modelId = String(input.modelId || "").trim();
      payload.prompt = String(input.prompt || "");
    } else {
      payload.taskId = String(input.taskId || "").trim();
    }

    if (requestId) {
      payload.requestId = requestId;
    }

    if (attemptId) {
      payload.attemptId = attemptId;
    }

    return this.invokeSecureProxy(accessToken, payload);
  }

  private async invokeSecureProxy(
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<LocalSystemProxyTransport> {
    const endpoint = `${this.supabaseUrl!.replace(/\/+$/, "")}/functions/v1/secure-model-proxy`;
    let response: Response | undefined;

    for (let attempt = 1; attempt <= MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS; attempt += 1) {
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.authKey!,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!shouldRetryProxyResponse(response) || attempt >= MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS) {
          break;
        }
      } catch (error) {
        if (!isRetryableProxyFetchError(error) || attempt >= MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS) {
          throw new LocalSystemProxyError(
            error instanceof Error ? error.message : "Local system proxy request failed.",
            {
              code: "LOCAL_SYSTEM_PROXY_UNAVAILABLE",
              statusCode: 502,
            },
          );
        }
      }

      await waitForProxyRetry(attempt);
    }

    if (!response) {
      throw new LocalSystemProxyError("Local system proxy request failed.", {
        code: "LOCAL_SYSTEM_PROXY_UNAVAILABLE",
        statusCode: 502,
      });
    }

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
            : `Local system proxy request failed with status ${response.status}`;
      throw new LocalSystemProxyError(errorMessage, {
        code:
          typeof responseBody?.error === "object" && typeof responseBody?.error?.code === "string"
            ? responseBody.error.code
            : "LOCAL_SYSTEM_PROXY_UPSTREAM_ERROR",
        statusCode: response.status || 502,
      });
    }

    return responseBody as LocalSystemProxyTransport;
  }
}
