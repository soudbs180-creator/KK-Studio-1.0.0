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
  SecureProxyUserRouteConfigDto,
  SecureModelProxyVideoRequestDto,
  SecureModelProxyVideoTransportDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import type { KeySlot } from "../../../../../../src/services/auth/keyManager.ts";
import type { AudioGenerationOptions, VideoGenerationOptions } from "../../../../../../src/services/llm/LLMAdapter.ts";
import type { ServerSupabaseConfig } from "../../../lib/server-supabase-config.ts";
import type { AuthDataService } from "../../auth/index.ts";

const INTERNAL_ROUTE_SECRET_HEADER = "x-kk-internal-route-secret";
const LOCAL_PROXY_TASK_PREFIX = "local_proxy:";
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

type LocalTaskPayload = {
  v: 1;
  userId: string;
  routeId: string;
  taskId: string;
  requestId?: string;
  attemptId?: string;
};

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

function isHostedSecureProxyTransportFailure(error: unknown): boolean {
  if (error instanceof LocalUserRouteProxyError) {
    return error.statusCode === 401 || error.statusCode >= 500;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = String(error.message || "").trim().toLowerCase();
  return (
    message.includes("fetch failed")
    || message.includes("network")
    || message.includes("timeout")
    || message.includes("socket")
    || message.includes("econnrefused")
    || message.includes("enotfound")
    || message.includes("aborted")
  );
}

function wrapDirectFallbackError(
  mode: LocalUserRouteProxyMode,
  error: unknown,
): LocalUserRouteProxyError {
  if (error instanceof LocalUserRouteProxyError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error || "Unknown error.");
  return new LocalUserRouteProxyError(
    `Local direct ${mode} route failed after hosted secure-model-proxy fallback: ${message}`,
    {
      code: "LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR",
      statusCode: 502,
    },
  );
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

type LocalResolvedRouteEndpointType = "openai" | "gemini" | "claude";
type LocalResolvedRouteFormat = "openai" | "gemini" | "claude";
type LocalResolvedAuthMethod = "query" | "header";
type LocalAuthorizationValueFormat = "bearer" | "raw";
type LocalResolvedImageSurface = "chat-image" | "provider-images" | "gemini-native-image";

function normalizeRouteString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function is12AIBaseUrl(baseUrl: string | undefined): boolean {
  const normalizedBaseUrl = normalizeRouteString(baseUrl);
  if (!normalizedBaseUrl) return false;

  try {
    const candidate = /^https?:\/\//i.test(normalizedBaseUrl) ? normalizedBaseUrl : `https://${normalizedBaseUrl}`;
    const host = new URL(candidate).hostname.toLowerCase();
    return /(^|\.)12ai\.(org|xyz|io|net)$/i.test(host);
  } catch {
    return false;
  }
}

function isGoogleOfficialGeminiBaseUrl(baseUrl: string | undefined): boolean {
  const normalized = normalizeRouteString(baseUrl).toLowerCase();
  return normalized.includes("googleapis.com") || normalized.includes("generativelanguage.googleapis.com");
}

function isWuyinGeminiRoute(routeConfig: SecureProxyUserRouteConfigDto): boolean {
  const provider = normalizeRouteString(routeConfig.provider).toLowerCase();
  const baseUrl = normalizeRouteString(routeConfig.baseUrl).toLowerCase();
  return provider.includes("wuyin") || baseUrl.includes("wuyinkeji");
}

function isBearerGeminiCompatRoute(routeConfig: SecureProxyUserRouteConfigDto): boolean {
  const provider = normalizeRouteString(routeConfig.provider).toLowerCase();
  const baseUrl = normalizeRouteString(routeConfig.baseUrl).toLowerCase();
  return provider.includes("gpt-best")
    || provider.includes("gptbest")
    || provider.includes("suxi")
    || provider.includes("newapi")
    || provider.includes("oneapi")
    || baseUrl.includes("gpt-best")
    || baseUrl.includes("gptbest")
    || baseUrl.includes("suxi")
    || baseUrl.includes("newapi")
    || baseUrl.includes("new-api")
    || baseUrl.includes("oneapi")
    || baseUrl.includes("one-api");
}

function isGptBestRoute(routeConfig: SecureProxyUserRouteConfigDto): boolean {
  const provider = normalizeRouteString(routeConfig.provider).toLowerCase();
  const baseUrl = normalizeRouteString(routeConfig.baseUrl).toLowerCase();
  return provider.includes("gpt-best")
    || provider.includes("gptbest")
    || baseUrl.includes("gpt-best")
    || baseUrl.includes("gptbest");
}

function isSuxiRoute(routeConfig: SecureProxyUserRouteConfigDto): boolean {
  const provider = normalizeRouteString(routeConfig.provider).toLowerCase();
  const baseUrl = normalizeRouteString(routeConfig.baseUrl).toLowerCase();
  return provider.includes("suxi") || baseUrl.includes("suxi");
}

function isNewApiRoute(routeConfig: SecureProxyUserRouteConfigDto): boolean {
  const provider = normalizeRouteString(routeConfig.provider).toLowerCase();
  const baseUrl = normalizeRouteString(routeConfig.baseUrl).toLowerCase();
  return provider.includes("newapi")
    || provider.includes("new-api")
    || provider.includes("oneapi")
    || provider.includes("one-api")
    || baseUrl.includes("newapi")
    || baseUrl.includes("new-api")
    || baseUrl.includes("oneapi")
    || baseUrl.includes("one-api");
}

function isAntigravityRoute(routeConfig: SecureProxyUserRouteConfigDto): boolean {
  const provider = normalizeRouteString(routeConfig.provider).toLowerCase();
  const baseUrl = normalizeRouteString(routeConfig.baseUrl).toLowerCase();
  return provider.includes("antigravity")
    || baseUrl.includes("127.0.0.1:8045")
    || baseUrl.includes("localhost:8045");
}

function isSiliconFlowRoute(routeConfig: SecureProxyUserRouteConfigDto): boolean {
  const provider = normalizeRouteString(routeConfig.provider).toLowerCase();
  const baseUrl = normalizeRouteString(routeConfig.baseUrl).toLowerCase();
  return provider.includes("siliconflow") || baseUrl.includes("siliconflow");
}

function detectLocalRouteStrategy(routeConfig: SecureProxyUserRouteConfigDto): string {
  if (is12AIBaseUrl(routeConfig.baseUrl)) return "12ai";
  if (isWuyinGeminiRoute(routeConfig)) return "wuyinkeji";
  if (isGptBestRoute(routeConfig)) return "gpt-best";
  if (isSuxiRoute(routeConfig)) return "suxi";
  if (isNewApiRoute(routeConfig)) return "newapi";
  if (isAntigravityRoute(routeConfig)) return "antigravity";
  if (isSiliconFlowRoute(routeConfig)) return "siliconflow";

  const provider = normalizeRouteString(routeConfig.provider).toLowerCase();
  const baseUrl = normalizeRouteString(routeConfig.baseUrl).toLowerCase();
  if (provider === "openai" || baseUrl.includes("api.openai.com")) return "openai";
  return "custom";
}

function inferLocalRouteFormat(routeConfig: SecureProxyUserRouteConfigDto): LocalResolvedRouteFormat {
  const explicitFormat = normalizeRouteString(routeConfig.format).toLowerCase();
  if (explicitFormat === "openai" || explicitFormat === "gemini" || explicitFormat === "claude") {
    return explicitFormat;
  }

  const normalizedFormat = normalizeRouteString(routeConfig.format).toLowerCase();
  const normalizedProvider = normalizeRouteString(routeConfig.provider).toLowerCase();
  const normalizedBaseUrl = normalizeRouteString(routeConfig.baseUrl).toLowerCase();

  if (
    normalizedFormat === "gemini"
    || normalizedProvider === "google"
    || normalizedProvider === "gemini"
    || isGoogleOfficialGeminiBaseUrl(routeConfig.baseUrl)
    || is12AIBaseUrl(routeConfig.baseUrl)
  ) {
    return "gemini";
  }

  if (
    normalizedFormat === "claude"
    || normalizedProvider.includes("anthropic")
    || normalizedBaseUrl.includes("anthropic.com")
  ) {
    return "claude";
  }

  return "openai";
}

function isGeminiImageModel(modelId?: string): boolean {
  const modelLower = String(modelId || "").trim().toLowerCase();
  return (
    (modelLower.includes("gemini") && modelLower.includes("image"))
    || modelLower.includes("nano-banana")
    || modelLower.includes("banana")
  );
}

function shouldBypassChatCompatibilityForImages(routeConfig: SecureProxyUserRouteConfigDto): boolean {
  const strategy = detectLocalRouteStrategy(routeConfig);
  return strategy === "12ai"
    || strategy === "gpt-best"
    || strategy === "suxi"
    || strategy === "newapi";
}

function resolveLocalImageSurface(
  routeConfig: SecureProxyUserRouteConfigDto,
  modelId?: string,
): LocalResolvedImageSurface {
  const format = inferLocalRouteFormat(routeConfig);
  const isGeminiImage = isGeminiImageModel(modelId);
  const compatibilityMode = normalizeRouteString(routeConfig.compatibilityMode).toLowerCase();

  if (format === "gemini" && isGeminiImage) {
    return "gemini-native-image";
  }

  if (
    compatibilityMode === "chat"
    && !shouldBypassChatCompatibilityForImages(routeConfig)
  ) {
    return "chat-image";
  }

  if (shouldBypassChatCompatibilityForImages(routeConfig)) {
    return "provider-images";
  }

  if (isGeminiImage) {
    return "chat-image";
  }

  return "provider-images";
}

function resolveLocalRouteEndpointType(routeConfig: SecureProxyUserRouteConfigDto): LocalResolvedRouteEndpointType {
  return inferLocalRouteFormat(routeConfig);
}

function getBaseModelId(modelId: string): string {
  return String(modelId || "").split("@")[0]?.trim() || "";
}

function getUpstreamModelId(modelId: string): string {
  return getBaseModelId(modelId).split("|")[0]?.trim() || "";
}

function applyQueryApiKey(url: string, apiKey: string): string {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set("key", apiKey);
  return parsedUrl.toString();
}

function getApiKeyToken(apiKey: string): string {
  return String(apiKey || "").trim().replace(/^Bearer\s+/i, "");
}

function isRouteSecretPlaceholder(apiKey: string | undefined): boolean {
  const normalized = String(apiKey || "").trim();
  return !normalized
    || normalized === CLIENT_VISIBLE_SECRET_PLACEHOLDER
    || normalized.startsWith("__kk_redacted__:");
}

function inferLocalAuthMethod(
  routeConfig: SecureProxyUserRouteConfigDto,
  format: LocalResolvedRouteFormat,
): LocalResolvedAuthMethod {
  if (routeConfig.authMethod === "query" || routeConfig.authMethod === "header") {
    return routeConfig.authMethod;
  }

  return format === "gemini" && (isGoogleOfficialGeminiBaseUrl(routeConfig.baseUrl) || is12AIBaseUrl(routeConfig.baseUrl))
    ? "query"
    : "header";
}

function inferLocalHeaderName(
  routeConfig: SecureProxyUserRouteConfigDto,
  format: LocalResolvedRouteFormat,
): string {
  const configured = normalizeRouteString(routeConfig.headerName);
  if (configured) {
    return configured;
  }

  if (format === "gemini") {
    if (isWuyinGeminiRoute(routeConfig) || isBearerGeminiCompatRoute(routeConfig)) {
      return "Authorization";
    }
    return "x-goog-api-key";
  }

  if (format === "claude") {
    return is12AIBaseUrl(routeConfig.baseUrl) ? "Authorization" : "x-api-key";
  }

  return "Authorization";
}

function inferLocalAuthorizationValueFormat(
  routeConfig: SecureProxyUserRouteConfigDto,
  format: LocalResolvedRouteFormat,
  headerName: string,
): LocalAuthorizationValueFormat {
  const normalizedHeader = headerName.toLowerCase();

  if (format === "gemini") {
    if (isBearerGeminiCompatRoute(routeConfig)) {
      return normalizedHeader === "authorization" ? "bearer" : "raw";
    }
    return "raw";
  }

  if (format === "claude") {
    return is12AIBaseUrl(routeConfig.baseUrl) ? "bearer" : "raw";
  }

  if (normalizedHeader !== "authorization") {
    return "raw";
  }

  return isWuyinGeminiRoute(routeConfig) ? "raw" : "bearer";
}

function formatAuthorizationHeaderValue(
  apiKey: string,
  valueFormat: LocalAuthorizationValueFormat,
): string {
  const token = getApiKeyToken(apiKey);
  if (valueFormat === "raw") {
    return token;
  }

  return /^Bearer\s+/i.test(apiKey) ? apiKey : `Bearer ${token}`;
}

function normalizeDirectOpenAIBaseUrl(url: string | undefined): string {
  let clean = normalizeRouteString(url) || "https://api.openai.com";
  clean = clean.replace(/\/+$/, "");
  clean = clean.replace(/\/(?:chat\/completions|images\/generations|images\/edits|responses|models)$/i, "");
  if (!/\/v\d[\w.-]*$/i.test(clean)) {
    clean = `${clean}/v1`;
  }
  return clean.replace(/\/+$/, "");
}

function buildDirectOpenAIEndpoint(baseUrl: string | undefined, endpoint: string): string {
  return `${normalizeDirectOpenAIBaseUrl(baseUrl)}/${endpoint.replace(/^\/+/, "")}`;
}

function normalizeDirectClaudeBaseUrl(url: string | undefined): string {
  let clean = normalizeRouteString(url) || "https://api.anthropic.com";
  clean = clean.replace(/\/+$/, "");
  clean = clean.replace(/\/(?:messages|models)$/i, "");
  if (!/\/v\d[\w.-]*$/i.test(clean)) {
    clean = `${clean}/v1`;
  }
  return clean.replace(/\/+$/, "");
}

function buildDirectClaudeEndpoint(baseUrl: string | undefined, endpoint: string): string {
  return `${normalizeDirectClaudeBaseUrl(baseUrl)}/${endpoint.replace(/^\/+/, "")}`;
}

function normalizeDirectGeminiBaseUrl(url: string | undefined): string {
  let clean = normalizeRouteString(url) || "https://generativelanguage.googleapis.com";
  clean = clean
    .replace(/\/v1beta\/models\/[^/?]+:(?:generateContent|streamGenerateContent)$/i, "")
    .replace(/\/v1\/models\/[^/?]+:(?:generateContent|streamGenerateContent)$/i, "")
    .replace(/\/+$/, "");

  const suffixes = ["/v1beta/models", "/v1/models", "/models", "/v1beta", "/v1"];
  let stripped = true;
  while (stripped) {
    stripped = false;
    const lower = clean.toLowerCase();
    for (const suffix of suffixes) {
      if (lower.endsWith(suffix)) {
        clean = clean.slice(0, -suffix.length).replace(/\/+$/, "");
        stripped = true;
        break;
      }
    }
  }

  return clean || "https://generativelanguage.googleapis.com";
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

function buildOpenAICompatAuth(
  url: string,
  routeConfig: SecureProxyUserRouteConfigDto,
  format: LocalResolvedRouteFormat = "openai",
): { url: string; headers: Record<string, string> } {
  const authMethod = inferLocalAuthMethod(routeConfig, format);
  if (authMethod === "query") {
    return {
      url: applyQueryApiKey(url, getApiKeyToken(routeConfig.apiKey)),
      headers: {},
    };
  }

  const headerName = inferLocalHeaderName(routeConfig, format);
  const authorizationValueFormat = inferLocalAuthorizationValueFormat(routeConfig, format, headerName);
  return {
    url,
    headers: {
      [headerName]: headerName.toLowerCase() === "authorization"
        ? formatAuthorizationHeaderValue(routeConfig.apiKey, authorizationValueFormat)
        : getApiKeyToken(routeConfig.apiKey),
    },
  };
}

function buildGeminiAuth(
  url: string,
  routeConfig: SecureProxyUserRouteConfigDto,
): { url: string; headers: Record<string, string> } {
  const format: LocalResolvedRouteFormat = "gemini";
  const authMethod = inferLocalAuthMethod(routeConfig, format);
  if (authMethod === "header") {
    const headerName = inferLocalHeaderName(routeConfig, format);
    const authorizationValueFormat = inferLocalAuthorizationValueFormat(routeConfig, format, headerName);
    return {
      url,
      headers: {
        [headerName]: headerName.toLowerCase() === "authorization"
          ? formatAuthorizationHeaderValue(routeConfig.apiKey, authorizationValueFormat)
          : getApiKeyToken(routeConfig.apiKey),
      },
    };
  }

  return {
    url: applyQueryApiKey(url, getApiKeyToken(routeConfig.apiKey)),
    headers: {},
  };
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

    if (!this.supabaseUrl || !this.authKey || !this.sharedSecret) {
      throw new LocalUserRouteProxyError("The local user-route proxy is not fully configured on this API server.", {
        code: "LOCAL_USER_ROUTE_PROXY_UNAVAILABLE",
        statusCode: 503,
      });
    }

    const effectiveMode = input.mode;
    let routeId = String(input.routeId || "").trim();
    let upstreamTaskId = String(input.taskId || "").trim();
    let decodedTask: LocalTaskPayload | undefined;

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

    if (requestId) {
      payload.requestId = requestId;
    }

    if (attemptId) {
      payload.attemptId = attemptId;
    }

    let response: LocalUserRouteProxyTransport;
    try {
      response = await this.invokeSecureProxy(accessToken, payload);
    } catch (error) {
      if (isHostedSecureProxyTransportFailure(error)) {
        if (effectiveMode === "image") {
          console.warn(
            "[local-user-route-proxy] Hosted secure-model-proxy failed, retrying image generation directly against the user route.",
            { routeId, provider: routeConfig.provider, modelId: input.modelId },
          );
          response = await this.invokeDirectImageRoute(routeConfig, input).catch((directError) => {
            throw wrapDirectFallbackError(effectiveMode, directError);
          });
        } else if (effectiveMode === "chat") {
          console.warn(
            "[local-user-route-proxy] Hosted secure-model-proxy failed, retrying chat generation directly against the user route.",
            { routeId, provider: routeConfig.provider, modelId: input.modelId },
          );
          response = await this.invokeDirectChatRoute(routeConfig, input).catch((directError) => {
            throw wrapDirectFallbackError(effectiveMode, directError);
          });
        } else if (effectiveMode === "video") {
          console.warn(
            "[local-user-route-proxy] Hosted secure-model-proxy failed, retrying video generation directly against the user route.",
            { routeId, provider: routeConfig.provider, modelId: input.modelId },
          );
          response = await this.invokeDirectVideoRoute(routeConfig, input).catch((directError) => {
            throw wrapDirectFallbackError(effectiveMode, directError);
          });
        } else if (effectiveMode === "audio") {
          console.warn(
            "[local-user-route-proxy] Hosted secure-model-proxy failed, retrying audio generation directly against the user route.",
            { routeId, provider: routeConfig.provider, modelId: input.modelId },
          );
          response = await this.invokeDirectAudioRoute(routeConfig, input).catch((directError) => {
            throw wrapDirectFallbackError(effectiveMode, directError);
          });
        } else {
          throw error instanceof LocalUserRouteProxyError
            ? error
            : new LocalUserRouteProxyError(
              `Hosted secure-model-proxy request failed: ${error instanceof Error ? error.message : String(error || "Unknown error.")}`,
              {
                code: "LOCAL_USER_ROUTE_PROXY_UNAVAILABLE",
                statusCode: 502,
              },
            );
        }
      } else if (error instanceof LocalUserRouteProxyError) {
        throw error;
      } else {
        throw new LocalUserRouteProxyError(
          `Hosted secure-model-proxy request failed: ${error instanceof Error ? error.message : String(error || "Unknown error.")}`,
          {
            code: "LOCAL_USER_ROUTE_PROXY_UNAVAILABLE",
            statusCode: 502,
          },
        );
      }
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
        "The upstream video route returned a local blob URL that cannot be served back through the local API. Please retry after restoring the hosted secure-model-proxy or switch to a provider that returns a public video URL.",
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

  private async invokeDirectImageRoute(
    routeConfig: SecureProxyUserRouteConfigDto,
    input: LocalUserRouteProxyRequest,
  ): Promise<SecureModelProxyImageTransportDto> {
    const endpointType = resolveLocalRouteEndpointType(routeConfig);
    const imageSurface = resolveLocalImageSurface(routeConfig, input.modelId);
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
