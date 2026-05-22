import type {
  SecureModelProxyAudioRequestDto,
  SecureModelProxyAudioTransportDto,
  SecureModelProxyChatRequestDto,
  SecureModelProxyChatTransportDto,
  SecureModelProxyDownloadTransportDto,
  SecureModelProxyImageRequestDto,
  SecureModelProxyImageTransportDto,
  SecureModelProxyTaskTransportDto,
  SecureProxyUserRouteConfigDto,
  SecureModelProxyVideoRequestDto,
  SecureModelProxyVideoTransportDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import type { KeySlot } from "../../../../../../src/services/auth/keyManager.ts";
import type { AudioGenerationOptions, VideoGenerationOptions } from "../../../../../../src/services/llm/LLMAdapter.ts";
import type { ServerRuntimeConfig } from "../../../lib/server-runtime-config.ts";
import type { AuthDataService } from "../../auth/index.ts";
import {
  buildDirectClaudeEndpoint,
  buildDirectOpenAIEndpoint,
  normalizeDirectGeminiBaseUrl,
} from "./local-user-route-endpoints.ts";
import {
  buildGeminiAuth,
  buildOpenAICompatAuth,
  detectLocalRouteStrategy,
  formatAuthorizationHeaderValue,
  getApiKeyToken,
  inferLocalAuthorizationValueFormat,
  inferLocalAuthMethod,
  inferLocalHeaderName,
  inferLocalRouteFormat,
  is12AIBaseUrl,
  normalizeRouteString,
  resolveLocalImageSurface,
  resolveLocalRouteEndpointType,
  type LocalResolvedImageSurface,
  type LocalResolvedRouteEndpointType,
  type LocalResolvedRouteFormat,
} from "./local-user-route-auth.ts";
import {
  decodeLocalUserRouteTaskToken,
  encodeLocalUserRouteTaskToken,
  resolveLocalUserRouteTaskSigningSecret,
  type LocalUserRouteTaskPayload,
} from "./local-user-route-task-token.ts";

export type { LocalResolvedImageSurface } from "./local-user-route-auth.ts";
const CLIENT_VISIBLE_SECRET_PLACEHOLDER = "sk-readonly-0000";

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

type LocalUserRouteProxyTransport =
  | SecureModelProxyChatTransportDto
  | SecureModelProxyImageTransportDto
  | SecureModelProxyVideoTransportDto
  | SecureModelProxyAudioTransportDto
  | SecureModelProxyTaskTransportDto
  | SecureModelProxyDownloadTransportDto;

type GeminiNativeImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type OpenAICompatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type OpenAICompatImageResponse = {
  data?: Array<{ b64_json?: string }>;
  usage?: OpenAICompatUsage;
};

type OpenAICompatChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: OpenAICompatUsage & {
    input_tokens?: number;
    output_tokens?: number;
  };
  output_text?: string;
  output?: unknown[];
  content?: unknown;
  response?: {
    output?: unknown;
  };
};

type GeminiNativeChatResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  usage_metadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type ClaudeNativeChatResponse = {
  content?: Array<{ text?: string }> | string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
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

interface InvokeResolvedRouteOptions {
  taskMode?: "image" | "video";
  imageSurface?: LocalResolvedImageSurface;
}

function getBaseModelId(modelId: string): string {
  return String(modelId || "").split("@")[0]?.trim() || "";
}

function getUpstreamModelId(modelId: string): string {
  return getBaseModelId(modelId).split("|")[0]?.trim() || "";
}

function isRouteSecretPlaceholder(apiKey: string | undefined): boolean {
  const normalized = String(apiKey || "").trim();
  return !normalized
    || normalized === CLIENT_VISIBLE_SECRET_PLACEHOLDER
    || normalized.startsWith("__kk_redacted__:");
}

function buildDirectClaudeHeaders(routeConfig: SecureProxyUserRouteConfigDto): Record<string, string> {
  const format: LocalResolvedRouteFormat = "claude";
  const authMethod = inferLocalAuthMethod(routeConfig, format);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };

  if (authMethod !== "header") {
    return headers;
  }

  const headerName = inferLocalHeaderName(routeConfig, format);
  const authorizationValueFormat = inferLocalAuthorizationValueFormat(routeConfig, format, headerName);
  headers[headerName] = headerName.toLowerCase() === "authorization"
    ? formatAuthorizationHeaderValue(routeConfig.apiKey, authorizationValueFormat)
    : getApiKeyToken(routeConfig.apiKey);
  return headers;
}

function normalizeLocalChatText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (content == null) {
    return "";
  }
  return JSON.stringify(content);
}

function buildDirectOpenAIChatMessages(
  messages: SecureModelProxyChatRequestDto["messages"],
): Array<{ role: string; content: string }> {
  return (Array.isArray(messages) ? messages : []).map((message) => ({
    role: String(message.role || "user"),
    content: normalizeLocalChatText(message.content),
  }));
}

function normalizeDirectClaudeMessages(
  messages: SecureModelProxyChatRequestDto["messages"],
): {
  system?: string;
  messages: Array<{
    role: "user" | "assistant";
    content: Array<{ type: "text"; text: string }>;
  }>;
} {
  const systemParts: string[] = [];
  const normalizedMessages: Array<{
    role: "user" | "assistant";
    content: Array<{ type: "text"; text: string }>;
  }> = [];

  (Array.isArray(messages) ? messages : []).forEach((message) => {
    const text = normalizeLocalChatText(message.content).trim();
    if (!text) return;

    if (message.role === "system") {
      systemParts.push(text);
      return;
    }

    normalizedMessages.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: [{ type: "text", text }],
    });
  });

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: normalizedMessages.length > 0
      ? normalizedMessages
      : [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
  };
}

function pushLocalText(parts: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const normalized = value.trim();
  if (normalized) {
    parts.push(normalized);
  }
}

function extractLocalTextFromContent(parts: string[], content: unknown): void {
  if (typeof content === "string") {
    pushLocalText(parts, content);
    return;
  }

  if (Array.isArray(content)) {
    content.forEach((item) => extractLocalTextFromContent(parts, item));
    return;
  }

  if (!content || typeof content !== "object") {
    return;
  }

  const typedContent = content as Record<string, any>;
  pushLocalText(parts, typedContent.text);
  pushLocalText(parts, typedContent.output_text);
  pushLocalText(parts, typedContent.value);

  if ("content" in typedContent) {
    extractLocalTextFromContent(parts, typedContent.content);
  }
}

function extractLocalOpenAITextPayload(payload: OpenAICompatChatResponse): string {
  const directContent = payload?.choices?.[0]?.message?.content;
  if (typeof directContent === "string" && directContent.trim()) {
    return directContent.trim();
  }

  if (Array.isArray(directContent)) {
    const parts: string[] = [];
    directContent.forEach((item) => extractLocalTextFromContent(parts, item));
    const combined = parts.join("\n").trim();
    if (combined) {
      return combined;
    }
  }

  const parts: string[] = [];
  pushLocalText(parts, payload?.output_text);
  if (Array.isArray(payload?.output)) {
    payload.output.forEach((item) => extractLocalTextFromContent(parts, item));
  }
  extractLocalTextFromContent(parts, payload?.content);
  extractLocalTextFromContent(parts, payload?.response?.output);
  return parts.join("\n").trim();
}

function extractLocalOpenAIUsage(payload: OpenAICompatChatResponse): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const promptTokens = Number(payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens ?? 0) || 0;
  const completionTokens = Number(payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens ?? 0) || 0;
  const totalTokens = Number(payload?.usage?.total_tokens ?? (promptTokens + completionTokens)) || 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function localModelPrefersResponsesApi(modelId?: string): boolean {
  const normalized = String(modelId || "").trim().split("@")[0].toLowerCase();
  return /^o3-pro$/i.test(normalized)
    || /^codex-mini-latest$/i.test(normalized)
    || /^o3-deep-research(?:-[\d-]+)?$/i.test(normalized);
}

function shouldRetryWithLocalResponsesApi(status: number | undefined, errorText: string | undefined): boolean {
  const text = String(errorText || "").toLowerCase();
  if (!text) return false;

  if (text.includes("/v1/responses") || text.includes("use /v1/responses")) {
    return true;
  }

  if ((text.includes("responses api") || text.includes("response api")) && !text.includes("image")) {
    return true;
  }

  if (
    (text.includes("chat/completions") || text.includes("/chat/completions"))
    && (text.includes("not supported") || text.includes("unsupported") || text.includes("invalid"))
  ) {
    return true;
  }

  if (
    status === 400
    && text.includes("responses")
    && (text.includes("model") || text.includes("endpoint"))
  ) {
    return true;
  }

  return false;
}

function buildLocalResponsesPayload(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxOutputTokens?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model,
    input: params.messages.map((message) => ({
      role: message.role,
      content: [{ type: "input_text", text: message.content }],
    })),
    stream: false,
  };

  if (typeof params.temperature === "number") {
    body.temperature = params.temperature;
  }

  if (
    typeof params.maxOutputTokens === "number"
    && Number.isFinite(params.maxOutputTokens)
    && params.maxOutputTokens > 0
  ) {
    body.max_output_tokens = Math.round(params.maxOutputTokens);
  }

  return body;
}

function normalizeImageSize(imageSize?: string): string {
  const raw = String(imageSize || "1K").toUpperCase();
  if (raw.includes("4K")) return "4K";
  if (raw.includes("2K")) return "2K";
  if (raw.includes("0.5K") || raw.includes("512")) return "0.5K";
  return "1K";
}

function normalizeAspectRatio(aspectRatio?: string): string | undefined {
  const value = String(aspectRatio || "").trim();
  if (!value || value.toLowerCase() === "auto") return undefined;
  return value;
}

function mapAspectRatioToOpenAI(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "16:9": return "1792x1024";
    case "9:16": return "1024x1792";
    case "3:2": return "1536x1024";
    case "2:3": return "1024x1536";
    case "4:3": return "1024x768";
    case "3:4": return "768x1024";
    default: return "1024x1024";
  }
}

function isGeminiImageCompatModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (lower.includes("gemini") && lower.includes("image"))
    || lower.includes("nano-banana")
    || lower.includes("banana");
}

function toOpenAIImageUrl(ref: string | { data: string; mimeType?: string }): string | null {
  if (typeof ref === "string") {
    return ref.startsWith("data:") ? ref : null;
  }

  const rawData = String(ref.data || "");
  if (!rawData) return null;
  if (rawData.startsWith("data:")) return rawData;
  return `data:${ref.mimeType || "image/png"};base64,${rawData}`;
}

function extractImageUrlsFromOpenAICompatPayload(data: any): string[] {
  const urls: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      urls.push(value.trim());
    }
  };

  const candidates = [
    ...(Array.isArray(data?.data) ? data.data : []),
    ...(Array.isArray(data?.images) ? data.images : []),
    ...(Array.isArray(data?.choices?.[0]?.message?.images) ? data.choices[0].message.images : []),
  ];

  candidates.forEach((item: any) => {
    if (!item || typeof item !== "object") return;
    const b64 = item.b64_json || item.b64 || item.base64;
    if (typeof b64 === "string" && b64.trim()) {
      urls.push(`data:image/png;base64,${b64.replace(/\s+/g, "")}`);
      return;
    }
    push(item.url);
    push(item.image_url);
  });

  const content = String(data?.choices?.[0]?.message?.content || "");
  const markdownMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (markdownMatch?.[1]) {
    push(markdownMatch[1]);
  }
  const dataUrlMatch = content.match(/data:(image\/[^;]+);base64,([A-Za-z0-9+/=\s]+)/);
  if (dataUrlMatch?.[2]) {
    urls.push(`data:${dataUrlMatch[1]};base64,${dataUrlMatch[2].replace(/\s+/g, "")}`);
  }

  return Array.from(new Set(urls));
}

function extractAsyncImageUrls(data: any): string[] {
  const urls = extractImageUrlsFromOpenAICompatPayload(data);
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      urls.push(value.trim());
    }
  };

  push(data?.url);
  push(data?.image_url);
  push(data?.data?.url);
  push(data?.data?.image_url);
  push(data?.result?.url);
  push(data?.result?.image_url);

  (Array.isArray(data?.images) ? data.images : []).forEach((item: any) => {
    push(item?.url);
    push(item?.image_url);
  });
  (Array.isArray(data?.result?.images) ? data.result.images : []).forEach((item: any) => {
    push(item?.url);
    push(item?.image_url);
  });

  return Array.from(new Set(urls));
}

function extractAsyncTaskId(data: any): string {
  return String(
    data?.task_id
    || data?.taskId
    || data?.id
    || data?.data?.task_id
    || data?.data?.taskId
    || data?.result?.task_id
    || data?.result?.taskId
    || "",
  ).trim();
}

function normalizeAsyncTaskStatus(data: any): "pending" | "success" | "failed" {
  const normalized = String(
    data?.status
    || data?.state
    || data?.task_status
    || data?.data?.status
    || data?.result?.status
    || "",
  ).trim().toLowerCase();

  if (!normalized) {
    return extractAsyncImageUrls(data).length > 0 ? "success" : "pending";
  }

  if (["success", "succeeded", "completed", "done", "finish", "finished"].includes(normalized)) {
    return "success";
  }

  if (["failed", "failure", "error", "cancelled", "canceled"].includes(normalized)) {
    return "failed";
  }

  return "pending";
}

function extractDirectVideoUrl(data: any): string {
  const candidates = [
    data?.video_url,
    data?.url,
    data?.video?.url,
    data?.data?.video_url,
    data?.data?.output,
    data?.content_url,
    data?.data?.content_url,
    Array.isArray(data?.data?.outputs) ? data.data.outputs[0] : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function extractGeminiVideoTaskErrorMessage(data: any): string {
  const candidates = [
    data?.error?.message,
    data?.response?.error?.message,
    data?.response?.generateVideoResponse?.error?.message,
    data?.response?.generateVideoResponse?.error,
    data?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function extractGeminiVideoUri(data: any): string {
  const candidates = [
    data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri,
    data?.response?.generatedSamples?.[0]?.video?.uri,
    data?.response?.video?.uri,
    data?.response?.result?.video?.uri,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

async function downloadBinaryAsDataUrl(
  url: string,
  headers: HeadersInit,
  fallbackMimeType: string,
): Promise<string> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download generated content: HTTP ${response.status}`);
  }

  const mimeType = String(response.headers.get("content-type") || "").trim() || fallbackMimeType;
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function toAsyncImageReference(ref: string | { data: string; mimeType?: string }): string | null {
  if (typeof ref === "string") {
    const normalized = ref.trim();
    if (!normalized) return null;
    if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith("data:")) {
      return normalized;
    }
    return null;
  }

  const rawData = String(ref.data || "").trim();
  if (!rawData) return null;
  if (rawData.startsWith("data:")) return rawData;
  return `data:${ref.mimeType || "image/png"};base64,${rawData}`;
}

function buildGoogleImageExtraBody(input: LocalUserRouteProxyRequest): Record<string, unknown> | undefined {
  const imageConfig: Record<string, unknown> = {};
  const aspectRatio = normalizeAspectRatio(input.aspectRatio);
  if (aspectRatio) {
    imageConfig.aspect_ratio = aspectRatio;
  }
  if (input.imageSize) {
    imageConfig.image_size = normalizeImageSize(input.imageSize);
  }

  if (!Object.keys(imageConfig).length) {
    return undefined;
  }

  return {
    google: {
      image_config: imageConfig,
    },
  };
}

function normalizeGeminiModelIdForExtendedImages(modelId: string, imageSize?: string): string {
  const normalized = String(modelId || "").trim();
  if (!normalized) return normalized;

  const is4K = String(imageSize || "").toUpperCase().includes("4K");
  const is2K = String(imageSize || "").toUpperCase().includes("2K");
  if (!is4K && !is2K) {
    return normalized;
  }

  const lowered = normalized.toLowerCase();
  if (/-4k$/i.test(normalized) || /-2k$/i.test(normalized)) {
    return normalized;
  }

  if (
    lowered.includes("gemini-3-pro-image-preview")
    || lowered.includes("gemini-3.1-flash-image-preview")
    || lowered.includes("nano-banana")
    || lowered.includes("banana")
  ) {
    return `${normalized}${is4K ? "-4k" : "-2k"}`;
  }

  return normalized;
}

function buildProviderImagesBody(
  routeConfig: SecureProxyUserRouteConfigDto,
  modelId: string,
  input: LocalUserRouteProxyRequest,
): Record<string, unknown> {
  const strategy = detectLocalRouteStrategy(routeConfig);
  const isExtendedImagesRoute =
    strategy === "gpt-best"
    || strategy === "antigravity"
    || strategy === "newapi";

  let width = 1024;
  let height = 1024;
  const requestedSize = normalizeImageSize(input.imageSize);
  if (requestedSize === "4K") {
    width = 4096;
    height = 4096;
  } else if (requestedSize === "2K") {
    width = 2048;
    height = 2048;
  } else if (requestedSize === "0.5K") {
    width = 512;
    height = 512;
  }

  const ratio = normalizeAspectRatio(input.aspectRatio);
  if (ratio && ratio.includes(":")) {
    const [w, h] = ratio.split(":").map((value) => Number(value));
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      if (w > h) {
        height = Math.max(1, Math.round(width * (h / w)));
      } else if (h > w) {
        width = Math.max(1, Math.round(height * (w / h)));
      }
    }
  }

  const body: Record<string, unknown> = {
    model: isExtendedImagesRoute ? normalizeGeminiModelIdForExtendedImages(modelId, input.imageSize) : modelId,
    prompt: input.prompt || "",
    n: Math.max(1, Number(input.imageCount || 1)),
    size: `${width}x${height}`,
    response_format: "b64_json",
    quality: requestedSize === "1K" ? "standard" : requestedSize === "2K" ? "medium" : "hd",
  };

  if (isExtendedImagesRoute) {
    body.imageSize = requestedSize;
    if (ratio) {
      body.aspect_ratio = ratio;
    }
    body.width = width;
    body.height = height;
  }

  if (input.referenceImages?.length) {
    const imageUrls = input.referenceImages
      .map((ref) => toOpenAIImageUrl(ref))
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    if (imageUrls.length > 0) {
      body.image = imageUrls.length === 1 ? imageUrls[0] : imageUrls;
      body.image_url = imageUrls[0];
    }
  }

  return body;
}

async function toInlineImagePart(ref: string | { data: string; mimeType?: string }) {
  return toInlineImagePartWithFormat(ref, false);
}

async function toInlineImagePartWithFormat(
  ref: string | { data: string; mimeType?: string },
  useSnakeCase: boolean,
) {
  if (typeof ref === "string") {
    const match = ref.match(/^data:(.+?);base64,(.+)$/);
    if (match) {
      return {
        [useSnakeCase ? "inline_data" : "inlineData"]: useSnakeCase
          ? {
              mime_type: match[1] || "image/png",
              data: match[2] || "",
            }
          : {
              mimeType: match[1] || "image/png",
              data: match[2] || "",
            },
      };
    }
    return null;
  }

  const rawData = String(ref.data || "");
  const match = rawData.match(/^data:(.+?);base64,(.+)$/);
  if (match) {
    return {
      [useSnakeCase ? "inline_data" : "inlineData"]: useSnakeCase
        ? {
            mime_type: match[1] || ref.mimeType || "image/png",
            data: match[2] || "",
          }
        : {
            mimeType: match[1] || ref.mimeType || "image/png",
            data: match[2] || "",
          },
    };
  }

  return {
    [useSnakeCase ? "inline_data" : "inlineData"]: useSnakeCase
      ? {
          mime_type: ref.mimeType || "image/png",
          data: rawData,
        }
      : {
          mimeType: ref.mimeType || "image/png",
          data: rawData,
        },
  };
}

export class LocalUserRouteProxyService {
  private readonly logger = consoleLogger.child({ module: "local-user-route-proxy" });
  private readonly authDataService: AuthDataService;
  private readonly taskSigningSecret: string;

  constructor(
    authDataService: AuthDataService,
    config: ServerRuntimeConfig,
  ) {
    this.authDataService = authDataService;
    const signingSecret = resolveLocalUserRouteTaskSigningSecret({
      taskSigningSecret: config.userApiEncryptionSecret,
      allowInsecureLocalTaskSigningFallback: config.allowInsecureLocalTaskSigningFallback,
    });
    this.taskSigningSecret = signingSecret.ok ? signingSecret.secret : "";
  }

  private async createVideoAdapter() {
    const { VideoCompatibleAdapter } = await import("../../../../../../src/services/llm/VideoCompatibleAdapter.ts");
    return new VideoCompatibleAdapter();
  }

  private async createAudioAdapter() {
    const { AudioCompatibleAdapter } = await import("../../../../../../src/services/llm/AudioCompatibleAdapter.ts");
    return new AudioCompatibleAdapter();
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

    const effectiveMode = input.mode;
    let routeId = String(input.routeId || "").trim();
    let upstreamTaskId = String(input.taskId || "").trim();
    let decodedTask: LocalUserRouteTaskPayload | undefined;

    if (effectiveMode === "image" || effectiveMode === "video") {
      this.requireTaskSigningSecret();
    }

    if (effectiveMode === "task_status" || effectiveMode === "cancel_task" || effectiveMode === "delete_task" || effectiveMode === "download_task") {
      decodedTask = this.decodeLocalTaskToken(String(input.localTaskId || "").trim(), userId);
      routeId = decodedTask.routeId;
      upstreamTaskId = decodedTask.taskId;
    }

    const requestId = String(input.requestId || decodedTask?.requestId || "").trim() || undefined;
    const attemptId = String(input.attemptId || decodedTask?.attemptId || "").trim() || undefined;

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

    if (isRouteSecretPlaceholder(routeConfig.apiKey)) {
      throw new LocalUserRouteProxyError(
        "The selected local route only contains a redacted API key placeholder. Re-enter the real API key in Settings > API Management and save the provider again.",
        {
          code: "USER_ROUTE_SECRET_REQUIRED",
          statusCode: 400,
        },
      );
    }

    const response = await this.invokeResolvedRoute(
      routeConfig,
      {
        ...input,
        taskId: upstreamTaskId || input.taskId,
        requestId,
        attemptId,
      },
      {
        taskMode: decodedTask?.mode,
      },
    );

    if (effectiveMode === "image") {
      const imageResponse = response as SecureModelProxyImageTransportDto;
      if (typeof imageResponse.taskId === "string" && imageResponse.taskId.trim()) {
        return {
          ...imageResponse,
          taskId: this.encodeLocalTaskToken({
            v: 1,
            userId,
            routeId,
            taskId: imageResponse.taskId,
            mode: "image",
            requestId: imageResponse.requestId || requestId,
            attemptId: imageResponse.attemptId || attemptId,
          }),
          requestId: imageResponse.requestId || requestId,
          attemptId: imageResponse.attemptId || attemptId,
        } satisfies SecureModelProxyImageTransportDto;
      }

      return {
        ...imageResponse,
        requestId: imageResponse.requestId || requestId,
        attemptId: imageResponse.attemptId || attemptId,
      } satisfies SecureModelProxyImageTransportDto;
    }

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
            mode: "video",
            requestId: videoResponse.requestId || requestId,
            attemptId: videoResponse.attemptId || attemptId,
          }),
          requestId: videoResponse.requestId || requestId,
          attemptId: videoResponse.attemptId || attemptId,
        } satisfies SecureModelProxyVideoTransportDto;
      }

      return {
        ...videoResponse,
        requestId: videoResponse.requestId || requestId,
        attemptId: videoResponse.attemptId || attemptId,
      } satisfies SecureModelProxyVideoTransportDto;
    }

    if (effectiveMode === "task_status" || effectiveMode === "cancel_task" || effectiveMode === "delete_task") {
      const taskResponse = response as SecureModelProxyTaskTransportDto;
      return {
        ...taskResponse,
        requestId: taskResponse.requestId || requestId,
        attemptId: taskResponse.attemptId || attemptId,
      } satisfies SecureModelProxyTaskTransportDto;
    }

    if (effectiveMode === "download_task") {
      const downloadResponse = response as SecureModelProxyDownloadTransportDto;
      return {
        ...downloadResponse,
        requestId: downloadResponse.requestId || requestId,
        attemptId: downloadResponse.attemptId || attemptId,
      } satisfies SecureModelProxyDownloadTransportDto;
    }

    return response;
  }

  async invokeResolvedRoute(
    routeConfig: SecureProxyUserRouteConfigDto,
    input: LocalUserRouteProxyRequest,
    options: InvokeResolvedRouteOptions = {},
  ): Promise<LocalUserRouteProxyTransport> {
    const effectiveMode = input.mode;
    const requestId = String(input.requestId || "").trim() || undefined;
    const attemptId = String(input.attemptId || "").trim() || undefined;
    const upstreamTaskId = String(input.taskId || "").trim();

    if ((effectiveMode === "task_status" || effectiveMode === "download_task") && options.taskMode === "image") {
      return this.invokeDirectImageTaskRoute(
        routeConfig,
        effectiveMode,
        upstreamTaskId,
        requestId,
        attemptId,
      );
    }

    if (
      (effectiveMode === "task_status"
        || effectiveMode === "cancel_task"
        || effectiveMode === "delete_task"
        || effectiveMode === "download_task")
      && options.taskMode === "video"
    ) {
      return this.invokeDirectVideoTaskRoute(
        routeConfig,
        effectiveMode,
        upstreamTaskId,
        String(input.modelId || "").trim(),
        requestId,
        attemptId,
      );
    }

    if (effectiveMode === "image") {
      return this.invokeDirectImageRoute(routeConfig, input, options.imageSurface);
    }

    if (effectiveMode === "chat") {
      return this.invokeDirectChatRoute(routeConfig, input);
    }

    if (effectiveMode === "video") {
      return this.invokeDirectVideoRoute(routeConfig, input);
    }

    if (effectiveMode === "audio") {
      return this.invokeDirectAudioRoute(routeConfig, input);
    }

    throw new LocalUserRouteProxyError("The local user-route proxy cannot resolve this task operation.", {
      code: "LOCAL_USER_ROUTE_PROXY_UNAVAILABLE",
      statusCode: 503,
    });
  }

  private buildDirectRouteKeySlot(
    routeConfig: SecureProxyUserRouteConfigDto,
    modelId?: string,
  ): KeySlot {
    const now = Date.now();
    return {
      id: routeConfig.routeId || `local-user-route-${now}`,
      key: routeConfig.apiKey,
      name: routeConfig.provider || "User Route",
      provider: (routeConfig.provider || "Custom") as KeySlot["provider"],
      type: "third-party",
      format: (routeConfig.format || "auto") as KeySlot["format"],
      baseUrl: routeConfig.baseUrl,
      compatibilityMode: routeConfig.compatibilityMode,
      supportedModels: modelId ? [modelId] : [],
      authMethod: routeConfig.authMethod,
      headerName: routeConfig.headerName,
      status: "valid",
      failCount: 0,
      successCount: 0,
      lastUsed: null,
      lastError: null,
      disabled: false,
      createdAt: now,
      totalCost: 0,
      budgetLimit: -1,
    };
  }

  private async invokeDirectChatRoute(
    routeConfig: SecureProxyUserRouteConfigDto,
    input: LocalUserRouteProxyRequest,
  ): Promise<SecureModelProxyChatTransportDto> {
    const endpointType = resolveLocalRouteEndpointType(routeConfig);
    const routeStrategy = detectLocalRouteStrategy(routeConfig);
    const modelId = getUpstreamModelId(String(input.modelId || ""));
    if (!modelId) {
      throw new LocalUserRouteProxyError("modelId is required.", {
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
    }

    if (endpointType === "gemini") {
      const useSnakeCase = is12AIBaseUrl(routeConfig.baseUrl);
      const systemInstructionTexts = (Array.isArray(input.messages) ? input.messages : [])
        .filter((message) => message.role === "system")
        .map((message) => normalizeLocalChatText(message.content).trim())
        .filter((text) => text.length > 0);
      const contents = (Array.isArray(input.messages) ? input.messages : [])
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: normalizeLocalChatText(message.content) }],
        }));
      const generationConfig: Record<string, unknown> = {};
      if (typeof input.temperature === "number") {
        generationConfig.temperature = input.temperature;
      }
      if (typeof input.maxTokens === "number" && Number.isFinite(input.maxTokens) && input.maxTokens > 0) {
        generationConfig[useSnakeCase ? "max_output_tokens" : "maxOutputTokens"] = Math.round(input.maxTokens);
      }

      const payload: Record<string, unknown> = {
        contents: contents.length > 0
          ? contents
          : [{ role: "user", parts: [{ text: "Hello" }] }],
      };
      if (Object.keys(generationConfig).length > 0) {
        payload[useSnakeCase ? "generation_config" : "generationConfig"] = generationConfig;
      }
      if (systemInstructionTexts.length > 0) {
        payload[useSnakeCase ? "system_instruction" : "systemInstruction"] = {
          parts: systemInstructionTexts.map((text) => ({ text })),
        };
      }

      const auth = buildGeminiAuth(
        `${normalizeDirectGeminiBaseUrl(routeConfig.baseUrl)}/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
        routeConfig,
      );
      const response = await fetch(auth.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.headers as Record<string, string>),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LocalUserRouteProxyError(
          `Upstream error: ${response.status} ${errorText} [surface=chat;strategy=${routeStrategy};format=${endpointType}]`,
          {
            code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
            statusCode: 502,
          },
        );
      }

      const result: GeminiNativeChatResponse = await response.json();
      const parts = result?.candidates?.[0]?.content?.parts || [];
      const usage = result?.usageMetadata || result?.usage_metadata;
      return {
        success: true,
        content: parts.map((part) => String(part?.text || "")).join(""),
        deducted: false,
        endpointType,
        usage: {
          promptTokens: Number(usage?.promptTokenCount || 0),
          completionTokens: Number(usage?.candidatesTokenCount || 0),
          totalTokens: Number(usage?.totalTokenCount || 0),
        },
      };
    }

    if (endpointType === "claude") {
      const { system, messages } = normalizeDirectClaudeMessages(input.messages ?? []);
      const payload: Record<string, unknown> = {
        model: modelId,
        messages,
        stream: false,
      };
      if (system) {
        payload.system = system;
      }
      if (typeof input.temperature === "number") {
        payload.temperature = input.temperature;
      }
      if (typeof input.maxTokens === "number" && Number.isFinite(input.maxTokens) && input.maxTokens > 0) {
        payload.max_tokens = Math.round(input.maxTokens);
      }

      const response = await fetch(buildDirectClaudeEndpoint(routeConfig.baseUrl, "messages"), {
        method: "POST",
        headers: buildDirectClaudeHeaders(routeConfig),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LocalUserRouteProxyError(
          `Upstream error: ${response.status} ${errorText} [surface=chat;strategy=${routeStrategy};format=${endpointType}]`,
          {
            code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
            statusCode: 502,
          },
        );
      }

      const result: ClaudeNativeChatResponse = await response.json();
      const content = typeof result?.content === "string"
        ? result.content
        : Array.isArray(result?.content)
          ? result.content.map((block) => String(block?.text || "")).join("")
          : "";
      const promptTokens = Number(result?.usage?.input_tokens || 0);
      const completionTokens = Number(result?.usage?.output_tokens || 0);
      return {
        success: true,
        content,
        deducted: false,
        endpointType,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      };
    }

    const normalizedMessages = buildDirectOpenAIChatMessages(input.messages ?? []);
    const chatRequestBody: Record<string, unknown> = {
      model: modelId,
      messages: normalizedMessages,
      stream: false,
    };
    if (typeof input.temperature === "number") {
      chatRequestBody.temperature = input.temperature;
    }
    if (typeof input.maxTokens === "number" && Number.isFinite(input.maxTokens) && input.maxTokens > 0) {
      chatRequestBody.max_tokens = Math.round(input.maxTokens);
    }

    const responsesRequestBody = buildLocalResponsesPayload({
      model: modelId,
      messages: normalizedMessages,
      temperature: input.temperature,
      maxOutputTokens: input.maxTokens,
    });

    const executeOpenAIRequest = async (
      endpointPath: "chat/completions" | "responses",
      body: Record<string, unknown>,
    ): Promise<OpenAICompatChatResponse> => {
      const auth = buildOpenAICompatAuth(
        buildDirectOpenAIEndpoint(routeConfig.baseUrl, endpointPath),
        routeConfig,
        "openai",
      );
      const response = await fetch(auth.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.headers as Record<string, string>),
        },
        body: JSON.stringify(body),
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new LocalUserRouteProxyError(
          `Upstream error: ${response.status} ${responseText} [surface=chat;strategy=${routeStrategy};format=${endpointType};endpoint=${endpointPath}]`,
          {
            code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
            statusCode: response.status || 502,
          },
        );
      }
      try {
        return responseText ? JSON.parse(responseText) as OpenAICompatChatResponse : {};
      } catch {
        throw new LocalUserRouteProxyError("Upstream returned an invalid JSON response.", {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        });
      }
    };

    const useResponsesFirst = localModelPrefersResponsesApi(modelId);
    let result: OpenAICompatChatResponse;
    try {
      result = useResponsesFirst
        ? await executeOpenAIRequest("responses", responsesRequestBody)
        : await executeOpenAIRequest("chat/completions", chatRequestBody);
    } catch (error) {
      if (
        !useResponsesFirst
        && error instanceof LocalUserRouteProxyError
        && shouldRetryWithLocalResponsesApi(error.statusCode, error.message)
      ) {
        result = await executeOpenAIRequest("responses", responsesRequestBody);
      } else {
        throw error;
      }
    }

    return {
      success: true,
      content: extractLocalOpenAITextPayload(result),
      deducted: false,
      endpointType,
      usage: extractLocalOpenAIUsage(result),
    };
  }

  private async invokeDirectVideoRoute(
    routeConfig: SecureProxyUserRouteConfigDto,
    input: LocalUserRouteProxyRequest,
  ): Promise<SecureModelProxyVideoTransportDto> {
    const modelId = String(input.modelId || "").trim();
    if (!modelId) {
      throw new LocalUserRouteProxyError("modelId is required.", {
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
    }

    const keySlot = this.buildDirectRouteKeySlot(routeConfig, modelId);
    const videoAdapter = await this.createVideoAdapter();
    const result = await videoAdapter.generateVideo({
      modelId,
      prompt: String(input.prompt || ""),
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      duration: input.duration,
      videoDuration: input.videoDuration,
      imageUrl: input.imageUrl,
      imageTailUrl: input.imageTailUrl,
    } satisfies VideoGenerationOptions, keySlot);
    const resolvedUrl = String(result.url || "").trim();
    if (resolvedUrl.startsWith("blob:")) {
      throw new LocalUserRouteProxyError(
        "The upstream video route returned a local blob URL that cannot be served back through the local API. Switch to a provider that returns a public video URL.",
        {
          code: "LOCAL_USER_ROUTE_PROXY_UNSUPPORTED_VIDEO_CONTENT",
          statusCode: 502,
        },
      );
    }

    return {
      success: true,
      url: resolvedUrl,
      status: result.status === "failed"
        ? "failed"
        : result.status === "success"
          ? "success"
          : "pending",
      deducted: false,
      endpointType: resolveLocalRouteEndpointType(routeConfig),
      taskId: result.status === "success" && result.url
        ? undefined
        : String(result.taskId || "").trim() || undefined,
      requestId: input.requestId,
      attemptId: input.attemptId,
    };
  }

  private async invokeDirectAudioRoute(
    routeConfig: SecureProxyUserRouteConfigDto,
    input: LocalUserRouteProxyRequest,
  ): Promise<SecureModelProxyAudioTransportDto> {
    const modelId = String(input.modelId || "").trim();
    if (!modelId) {
      throw new LocalUserRouteProxyError("modelId is required.", {
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
    }

    const keySlot = this.buildDirectRouteKeySlot(routeConfig, modelId);
    const audioAdapter = await this.createAudioAdapter();
    const result = await audioAdapter.generateAudio({
      modelId,
      prompt: String(input.prompt || ""),
    } satisfies AudioGenerationOptions, keySlot);

    return {
      success: true,
      url: String(result.url || ""),
      deducted: false,
      endpointType: resolveLocalRouteEndpointType(routeConfig),
    };
  }

  private async invokeDirectImageRoute(
    routeConfig: SecureProxyUserRouteConfigDto,
    input: LocalUserRouteProxyRequest,
    imageSurfaceOverride?: LocalResolvedImageSurface,
  ): Promise<SecureModelProxyImageTransportDto> {
    const endpointType = resolveLocalRouteEndpointType(routeConfig);
    const imageSurface = imageSurfaceOverride || resolveLocalImageSurface(routeConfig, input.modelId, input.imageCount);
    const routeStrategy = detectLocalRouteStrategy(routeConfig);
    const modelId = getUpstreamModelId(String(input.modelId || ""));
    if (!modelId) {
      throw new LocalUserRouteProxyError("modelId is required.", {
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
    }

    const baseUrl = endpointType === "claude"
      ? normalizeRouteString(routeConfig.baseUrl).replace(/\/+$/, "").replace(/\/v1$/i, "")
      : normalizeRouteString(routeConfig.baseUrl).replace(/\/+$/, "");

    if (endpointType === "claude") {
      throw new LocalUserRouteProxyError("Claude routes do not support image generation in the local proxy.", {
        code: "UNSUPPORTED_ROUTE",
        statusCode: 400,
      });
    }

    if (endpointType === "gemini" && modelId.startsWith("imagen-")) {
      const auth = buildGeminiAuth(`${baseUrl}/v1beta/models/${modelId}:predict`, routeConfig);

      const parameters: Record<string, unknown> = {
        sampleCount: Math.max(1, Number(input.imageCount || 1)),
      };

      if (input.aspectRatio && String(input.aspectRatio).toLowerCase() !== "auto") {
        parameters.aspectRatio = normalizeAspectRatio(input.aspectRatio) || input.aspectRatio;
      }

      if (input.imageSize) {
        const size = String(input.imageSize).toUpperCase();
        if (size.includes("2K") || size.includes("4K") || size.includes("HD")) {
          parameters.sampleImageSize = "2K";
        } else {
          parameters.sampleImageSize = "1K";
        }
      }

      const instances: any[] = [];
      if (input.referenceImages && input.referenceImages.length > 0) {
        const ref = input.referenceImages[0];
        const inlinePart = await toInlineImagePartWithFormat(ref, false);
        if (inlinePart?.inlineData?.data) {
          instances.push({
            prompt: input.prompt || "",
            image: { bytesBase64Encoded: inlinePart.inlineData.data }
          });
        } else {
          instances.push({ prompt: input.prompt || "" });
        }
      } else {
        instances.push({ prompt: input.prompt || "" });
      }

      const payload = {
        instances,
        parameters,
      };

      const imageResponse = await fetch(auth.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.headers as Record<string, string>),
        },
        body: JSON.stringify(payload),
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        throw new LocalUserRouteProxyError(`Upstream error: ${imageResponse.status} ${errorText} [surface=${imageSurface};strategy=${routeStrategy}]`, {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        });
      }

      const result = await imageResponse.json();
      const predictions = result.predictions || [];
      const imageUrls = predictions
        .map((p: any) => p?.bytesBase64Encoded ? `data:image/png;base64,${String(p.bytesBase64Encoded).replace(/\s+/g, "")}` : null)
        .filter((value: string | null): value is string => typeof value === "string" && value.length > 0);

      if (!imageUrls.length) {
        throw new LocalUserRouteProxyError("No image data returned from upstream.", {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        });
      }

      return {
        success: true,
        urls: imageUrls,
        deducted: false,
        endpointType,
        requestId: input.requestId,
        attemptId: input.attemptId,
      };
    }

    if (imageSurface === "async-image") {
      const auth = buildOpenAICompatAuth(`${baseUrl}/v1/images/async/generations`, routeConfig, "openai");
      const requestedSize = normalizeImageSize(input.imageSize);
      const body: Record<string, unknown> = {
        model: modelId,
        prompt: input.prompt || "",
        n: Math.max(1, Number(input.imageCount || 1)),
        size: normalizeAspectRatio(input.aspectRatio) || requestedSize,
        quality: requestedSize === "4K" ? "4K" : requestedSize === "2K" ? "hd" : "standard",
      };

      const refs = (input.referenceImages || [])
        .map((ref) => toAsyncImageReference(ref))
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      if (refs.length === 1) {
        body.image = refs[0];
      } else if (refs.length > 1) {
        body.images = refs;
      }

      const imageResponse = await fetch(auth.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.headers as Record<string, string>),
        },
        body: JSON.stringify(body),
      });

      const responseText = await imageResponse.text();
      if (!imageResponse.ok) {
        throw new LocalUserRouteProxyError(`Upstream error: ${imageResponse.status} ${responseText} [surface=${imageSurface};strategy=${routeStrategy}]`, {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: imageResponse.status || 502,
        });
      }

      let result: Record<string, unknown> = {};
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new LocalUserRouteProxyError("Upstream returned an invalid JSON response.", {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        });
      }

      const imageUrls = extractAsyncImageUrls(result);
      if (imageUrls.length > 0) {
        return {
          success: true,
          urls: imageUrls,
          deducted: false,
          endpointType,
          requestId: input.requestId,
          attemptId: input.attemptId,
        };
      }

      const taskId = extractAsyncTaskId(result);
      if (!taskId) {
        throw new LocalUserRouteProxyError("12AI async-image submit succeeded but no task id was returned.", {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        });
      }

      return {
        success: true,
        urls: [],
        taskId,
        status: "pending",
        deducted: false,
        endpointType,
        requestId: input.requestId,
        attemptId: input.attemptId,
      };
    }

    if (imageSurface === "gemini-native-image") {
      const useSnakeCase = is12AIBaseUrl(baseUrl);
      const parts: any[] = [];
      for (const ref of input.referenceImages || []) {
        const inlinePart = await toInlineImagePartWithFormat(ref, useSnakeCase);
        if (inlinePart) parts.push(inlinePart);
      }
      parts.push({ text: input.prompt || "" });

      const generationConfig: Record<string, unknown> = {
        [useSnakeCase ? "response_modalities" : "responseModalities"]: ["IMAGE"],
      };
      const imageConfig: Record<string, unknown> = {};
      const aspectRatio = normalizeAspectRatio(input.aspectRatio);
      if (aspectRatio) {
        imageConfig[useSnakeCase ? "aspect_ratio" : "aspectRatio"] = aspectRatio;
      }
      if (input.imageSize) {
        imageConfig[useSnakeCase ? "image_size" : "imageSize"] = normalizeImageSize(input.imageSize);
      }
      if (Object.keys(imageConfig).length) {
        generationConfig[useSnakeCase ? "image_config" : "imageConfig"] = imageConfig;
      }

      const auth = buildGeminiAuth(`${baseUrl}/v1beta/models/${modelId}:generateContent`, routeConfig);
      const payload: Record<string, unknown> = {
        contents: [{ parts }],
        [useSnakeCase ? "generation_config" : "generationConfig"]: generationConfig,
      };
      const imageResponse = await fetch(auth.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.headers as Record<string, string>),
        },
        body: JSON.stringify(payload),
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        throw new LocalUserRouteProxyError(`Upstream error: ${imageResponse.status} ${errorText} [surface=${imageSurface};strategy=${routeStrategy}]`, {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        });
      }

      const result: GeminiNativeImageResponse = await imageResponse.json();
      const partsList = result?.candidates?.[0]?.content?.parts || [];
      const imagePart = partsList.find((part: any) => part?.inlineData || part?.inline_data);
      const inline = (imagePart?.inlineData || imagePart?.inline_data) as
        | { mimeType?: string; mime_type?: string; data?: string }
        | undefined;
      const mimeType = inline?.mimeType || inline?.mime_type || "image/png";
      const imageData = String(inline?.data || "").replace(/\s+/g, "");

      if (!imageData) {
        throw new LocalUserRouteProxyError("No image data returned from upstream.", {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        });
      }

      return {
        success: true,
        urls: [`data:${mimeType};base64,${imageData}`],
        deducted: false,
        endpointType,
        usage: {
          promptTokens: Number(result?.usageMetadata?.promptTokenCount || 0),
          completionTokens: Number(result?.usageMetadata?.candidatesTokenCount || 0),
          totalTokens: Number(result?.usageMetadata?.totalTokenCount || 0),
        },
      };
    }

    if (imageSurface === "chat-image") {
      const contentParts: Array<Record<string, unknown>> = [{ type: "text", text: input.prompt || "" }];
      for (const ref of input.referenceImages || []) {
        const dataUrl = toOpenAIImageUrl(ref);
        if (!dataUrl) continue;
        contentParts.push({
          type: "image_url",
          image_url: { url: dataUrl },
        });
      }

      const requestBody: Record<string, unknown> = {
        model: modelId,
        messages: [
          {
            role: "user",
            content: contentParts,
          },
        ],
        stream: false,
      };

      const extraBody = buildGoogleImageExtraBody(input);
      if (extraBody) {
        requestBody.extra_body = extraBody;
      }

      const auth = buildOpenAICompatAuth(`${baseUrl}/v1/chat/completions`, routeConfig, "openai");
      const imageResponse = await fetch(auth.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.headers as Record<string, string>),
        },
        body: JSON.stringify(requestBody),
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        throw new LocalUserRouteProxyError(`Upstream error: ${imageResponse.status} ${errorText} [surface=${imageSurface};strategy=${routeStrategy}]`, {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        });
      }

      const result: Record<string, unknown> & { usage?: OpenAICompatUsage } = await imageResponse.json();
      const imageUrls = extractImageUrlsFromOpenAICompatPayload(result);
      if (!imageUrls.length) {
        throw new LocalUserRouteProxyError("No image data returned from upstream.", {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: 502,
        });
      }

      return {
        success: true,
        urls: imageUrls,
        deducted: false,
        endpointType,
        usage: {
          promptTokens: Number(result?.usage?.prompt_tokens || 0),
          completionTokens: Number(result?.usage?.completion_tokens || 0),
          totalTokens: Number(result?.usage?.total_tokens || 0),
        },
      };
    }

    const auth = buildOpenAICompatAuth(`${baseUrl}/v1/images/generations`, routeConfig, "openai");
    const imageResponse = await fetch(auth.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth.headers as Record<string, string>),
      },
      body: JSON.stringify(buildProviderImagesBody(routeConfig, modelId, input)),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      throw new LocalUserRouteProxyError(`Upstream error: ${imageResponse.status} ${errorText} [surface=${imageSurface};strategy=${routeStrategy}]`, {
        code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
        statusCode: 502,
      });
    }

    const result: OpenAICompatImageResponse = await imageResponse.json();
    const imageUrls = Array.isArray(result?.data)
      ? result.data
          .map((item: any) => item?.b64_json ? `data:image/png;base64,${String(item.b64_json).replace(/\s+/g, "")}` : null)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];

    if (!imageUrls.length) {
      throw new LocalUserRouteProxyError("No image data returned from upstream.", {
        code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
        statusCode: 502,
      });
    }

    return {
      success: true,
      urls: imageUrls,
      deducted: false,
      endpointType,
      usage: {
        promptTokens: Number(result?.usage?.prompt_tokens || 0),
        completionTokens: Number(result?.usage?.completion_tokens || 0),
        totalTokens: Number(result?.usage?.total_tokens || 0),
      },
    };
  }

  private async invokeDirectImageTaskRoute(
    routeConfig: SecureProxyUserRouteConfigDto,
    mode: "task_status" | "download_task",
    upstreamTaskId: string,
    requestId?: string,
    attemptId?: string,
  ): Promise<SecureModelProxyTaskTransportDto | SecureModelProxyDownloadTransportDto> {
    const auth = buildOpenAICompatAuth(
      `${normalizeRouteString(routeConfig.baseUrl).replace(/\/+$/, "")}/v1/images/async/generations/${encodeURIComponent(upstreamTaskId)}`,
      routeConfig,
      "openai",
    );
    const response = await fetch(auth.url, {
      method: "GET",
      headers: auth.headers,
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new LocalUserRouteProxyError(`Status polling failed: ${response.status} ${responseText}`, {
        code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
        statusCode: response.status || 502,
      });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new LocalUserRouteProxyError("Upstream returned an invalid JSON response.", {
        code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
        statusCode: 502,
      });
    }

    const status = normalizeAsyncTaskStatus(payload);
    const imageUrls = extractAsyncImageUrls(payload);

    if (mode === "download_task") {
      if (status === "success" && imageUrls[0]) {
        return {
          success: true,
          url: imageUrls[0],
          deducted: false,
          requestId,
          attemptId,
        };
      }

      return {
        success: false,
        error: "Task content is not ready yet",
        deducted: false,
        requestId,
        attemptId,
      };
    }

    return {
      success: true,
      status: status === "success" ? "success" : status === "failed" ? "failed" : "pending",
      url: status === "success" ? imageUrls[0] : undefined,
      taskId: upstreamTaskId,
      deducted: false,
      requestId,
      attemptId,
    };
  }

  private async invokeDirectVideoTaskRoute(
    routeConfig: SecureProxyUserRouteConfigDto,
    mode: "task_status" | "cancel_task" | "delete_task" | "download_task",
    upstreamTaskId: string,
    modelId: string,
    requestId?: string,
    attemptId?: string,
  ): Promise<SecureModelProxyTaskTransportDto | SecureModelProxyDownloadTransportDto> {
    const endpointType = resolveLocalRouteEndpointType(routeConfig);
    const keySlot = this.buildDirectRouteKeySlot(routeConfig, modelId);
    const baseUrl = normalizeRouteString(routeConfig.baseUrl).replace(/\/+$/, "");

    if (!upstreamTaskId) {
      throw new LocalUserRouteProxyError("taskId is required.", {
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
    }

    if (mode === "delete_task") {
      await this.tryDeleteDirectVideoTask(routeConfig, endpointType, baseUrl, upstreamTaskId);
      return {
        success: true,
        status: "success",
        deducted: false,
        requestId,
        attemptId,
      };
    }

    if (mode === "cancel_task") {
      if (endpointType === "gemini") {
        const apiBase = baseUrl.includes("/v1") ? baseUrl : `${baseUrl}/v1beta`;
        const auth = buildGeminiAuth(`${apiBase}/${upstreamTaskId}:cancel`, routeConfig);
        const response = await fetch(auth.url, {
          method: "POST",
          headers: auth.headers,
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new LocalUserRouteProxyError(`Cancel failed: ${response.status} ${errorText}`, {
            code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
            statusCode: response.status || 502,
          });
        }
      } else {
        const openaiBase = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
        const candidateUrls = [
          `${openaiBase}/videos/${encodeURIComponent(upstreamTaskId)}`,
          `${openaiBase}/videos/generations/${encodeURIComponent(upstreamTaskId)}`,
        ];
        let cancelled = false;
        for (const candidateUrl of candidateUrls) {
          const auth = buildOpenAICompatAuth(candidateUrl, routeConfig, "openai");
          const response = await fetch(auth.url, {
            method: "DELETE",
            headers: auth.headers,
          }).catch(() => null);
          if (response && (response.ok || response.status === 404 || response.status === 409)) {
            cancelled = true;
            break;
          }
        }

        if (!cancelled) {
          throw new LocalUserRouteProxyError("Unable to cancel upstream video task.", {
            code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
            statusCode: 502,
          });
        }
      }

      return {
        success: true,
        status: "failed",
        deducted: false,
        requestId,
        attemptId,
      };
    }

    if (endpointType === "gemini") {
      const apiBase = baseUrl.includes("/v1") ? baseUrl : `${baseUrl}/v1beta`;
      const auth = buildGeminiAuth(`${apiBase}/${upstreamTaskId}`, routeConfig);
      const response = await fetch(auth.url, {
        headers: auth.headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LocalUserRouteProxyError(`Status polling failed: ${response.status} ${errorText}`, {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: response.status || 502,
        });
      }

      const payload = await response.json().catch(() => ({}));
      const taskErrorMessage = extractGeminiVideoTaskErrorMessage(payload);
      if (taskErrorMessage) {
        return {
          success: true,
          status: "failed",
          deducted: false,
          requestId,
          attemptId,
        };
      }

      const videoUri = extractGeminiVideoUri(payload);
      if (!videoUri) {
        return mode === "download_task"
          ? {
              success: false,
              error: "Task content is not ready yet",
              deducted: false,
              requestId,
              attemptId,
            }
          : {
              success: true,
              status: "pending",
              deducted: false,
              requestId,
              attemptId,
            };
      }

      const mediaAuth = buildGeminiAuth(videoUri, routeConfig);
      let dataUrl = "";
      try {
        dataUrl = await downloadBinaryAsDataUrl(mediaAuth.url, mediaAuth.headers, "video/mp4");
      } catch {
        return mode === "download_task"
          ? {
              success: false,
              error: "Task content is not ready yet",
              deducted: false,
              requestId,
              attemptId,
            }
          : {
              success: true,
              status: "pending",
              deducted: false,
              requestId,
              attemptId,
            };
      }

      return mode === "download_task"
        ? {
            success: true,
            url: dataUrl,
            deducted: false,
            requestId,
            attemptId,
          }
        : {
            success: true,
            status: "success",
            url: dataUrl,
            deducted: false,
            requestId,
            attemptId,
          };
    }

    const openAiStatus = await this.fetchDirectOpenAiVideoTaskStatus(routeConfig, upstreamTaskId);
    const normalizedStatus = normalizeAsyncTaskStatus(openAiStatus.payload);
    const directUrl = extractDirectVideoUrl(openAiStatus.payload);
    if (directUrl) {
      return mode === "download_task"
        ? {
            success: true,
            url: directUrl,
            deducted: false,
            requestId,
            attemptId,
          }
        : {
            success: true,
            status: "success",
            url: directUrl,
            deducted: false,
            requestId,
            attemptId,
          };
    }

    if (normalizedStatus === "success") {
      const contentUrls = [
        `${openAiStatus.baseUrl}/videos/${encodeURIComponent(upstreamTaskId)}/content`,
        `${openAiStatus.baseUrl}/videos/generations/${encodeURIComponent(upstreamTaskId)}/content`,
        String(
          (openAiStatus.payload as { content_url?: unknown })?.content_url
            || ((openAiStatus.payload as { data?: { content_url?: unknown } })?.data?.content_url)
            || "",
        ).trim(),
      ].filter((value) => Boolean(value));

      for (const contentUrl of contentUrls) {
        const auth = buildOpenAICompatAuth(contentUrl, routeConfig, "openai");
        try {
          const dataUrl = await downloadBinaryAsDataUrl(auth.url, auth.headers, "video/mp4");
          return mode === "download_task"
            ? {
                success: true,
                url: dataUrl,
                deducted: false,
                requestId,
                attemptId,
              }
            : {
                success: true,
                status: "success",
                url: dataUrl,
                deducted: false,
                requestId,
                attemptId,
              };
        } catch {
          continue;
        }
      }
    }

    if (normalizedStatus === "failed") {
      return {
        success: true,
        status: "failed",
        deducted: false,
        requestId,
        attemptId,
      };
    }

    return mode === "download_task"
      ? {
          success: false,
          error: "Task content is not ready yet",
          deducted: false,
          requestId,
          attemptId,
        }
      : {
          success: true,
          status: "pending",
          deducted: false,
          requestId,
          attemptId,
        };
  }

  private async fetchDirectOpenAiVideoTaskStatus(
    routeConfig: SecureProxyUserRouteConfigDto,
    upstreamTaskId: string,
  ): Promise<{ payload: Record<string, unknown>; baseUrl: string }> {
    const baseUrl = normalizeRouteString(routeConfig.baseUrl).replace(/\/+$/, "");
    const openAiBase = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
    const candidateUrls = [
      `${openAiBase}/videos/${encodeURIComponent(upstreamTaskId)}`,
      `${openAiBase}/videos/generations/${encodeURIComponent(upstreamTaskId)}`,
    ];

    let lastFailureMessage = "Task status lookup failed.";
    for (const candidateUrl of candidateUrls) {
      const auth = buildOpenAICompatAuth(candidateUrl, routeConfig, "openai");
      const response = await fetch(auth.url, {
        headers: auth.headers,
      }).catch(() => null);
      if (!response) {
        lastFailureMessage = `Task status lookup failed for ${candidateUrl}.`;
        continue;
      }
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        lastFailureMessage = `Status polling failed: ${response.status} ${errorText}`;
        if (response.status >= 500 || response.status === 404) {
          continue;
        }
        throw new LocalUserRouteProxyError(lastFailureMessage, {
          code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
          statusCode: response.status || 502,
        });
      }

      return {
        payload: await response.json().catch(() => ({})),
        baseUrl: openAiBase,
      };
    }

    throw new LocalUserRouteProxyError(lastFailureMessage, {
      code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
      statusCode: 502,
    });
  }

  private async tryDeleteDirectVideoTask(
    routeConfig: SecureProxyUserRouteConfigDto,
    endpointType: LocalResolvedRouteEndpointType,
    baseUrl: string,
    upstreamTaskId: string,
  ): Promise<void> {
    try {
      if (endpointType === "gemini") {
        const apiBase = baseUrl.includes("/v1") ? baseUrl : `${baseUrl}/v1beta`;
        const auth = buildGeminiAuth(`${apiBase}/${upstreamTaskId}`, routeConfig);
        await fetch(auth.url, {
          method: "DELETE",
          headers: auth.headers,
        }).catch(() => undefined);
        return;
      }

      const openaiBase = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
      const candidateUrls = [
        `${openaiBase}/videos/${encodeURIComponent(upstreamTaskId)}`,
        `${openaiBase}/videos/generations/${encodeURIComponent(upstreamTaskId)}`,
      ];
      for (const candidateUrl of candidateUrls) {
        const auth = buildOpenAICompatAuth(candidateUrl, routeConfig, "openai");
        await fetch(auth.url, {
          method: "DELETE",
          headers: auth.headers,
        }).catch(() => undefined);
      }
    } catch {
      // Best-effort cleanup only.
    }
  }

  private encodeLocalTaskToken(payload: LocalUserRouteTaskPayload): string {
    return encodeLocalUserRouteTaskToken(payload, this.requireTaskSigningSecret());
  }

  private decodeLocalTaskToken(token: string, expectedUserId: string): LocalUserRouteTaskPayload {
    const decoded = decodeLocalUserRouteTaskToken(token, expectedUserId, this.requireTaskSigningSecret());
    if (!decoded.ok) {
      throw new LocalUserRouteProxyError(decoded.message, {
        code: decoded.code,
        statusCode: decoded.statusCode,
      });
    }

    return decoded.payload;
  }

  private requireTaskSigningSecret(): string {
    if (this.taskSigningSecret) {
      return this.taskSigningSecret;
    }

    throw new LocalUserRouteProxyError("Local user-route task signing secret is not configured.", {
      code: "TASK_SIGNING_SECRET_REQUIRED",
      statusCode: 500,
    });
  }
}
