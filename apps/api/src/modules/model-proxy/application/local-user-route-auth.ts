import type { SecureProxyUserRouteConfigDto } from "../../../../../../packages/contracts/src/index.ts";

export type LocalResolvedRouteEndpointType = "openai" | "gemini" | "claude";
export type LocalResolvedRouteFormat = "openai" | "gemini" | "claude";
type LocalResolvedAuthMethod = "query" | "header";
type LocalAuthorizationValueFormat = "bearer" | "raw";
export type LocalResolvedImageSurface = "chat-image" | "provider-images" | "gemini-native-image" | "async-image";

export function normalizeRouteString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function is12AIBaseUrl(baseUrl: string | undefined): boolean {
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

export function isWuyinGeminiRoute(routeConfig: SecureProxyUserRouteConfigDto): boolean {
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

export function shouldForceHeaderAuthForProvider(provider: string | undefined, baseUrl: string | undefined): boolean {
  const normalizedProvider = normalizeRouteString(provider).toLowerCase();
  const normalizedBaseUrl = normalizeRouteString(baseUrl).toLowerCase();
  return normalizedProvider === "gpt-best"
    || normalizedProvider === "gptbest"
    || normalizedBaseUrl.includes("gpt-best")
    || normalizedBaseUrl.includes("gptbest");
}

export function detectLocalRouteStrategy(routeConfig: SecureProxyUserRouteConfigDto): string {
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

export function inferLocalRouteFormat(routeConfig: SecureProxyUserRouteConfigDto): LocalResolvedRouteFormat {
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

function is12AIAsyncImageModel(modelId?: string): boolean {
  const normalized = String(modelId || "").trim().toLowerCase();
  if (!normalized) return false;

  return normalized.includes("gemini-2.5-flash-image")
    || normalized.includes("gemini-3.1-flash-image-preview")
    || normalized.includes("gemini-3-pro-image-preview")
    || normalized.includes("nano-banana")
    || normalized.includes("nanobanana");
}

function shouldUse12AIAsyncImageRoute(
  routeConfig: SecureProxyUserRouteConfigDto,
  modelId?: string,
  imageCount?: number,
): boolean {
  if (detectLocalRouteStrategy(routeConfig) !== "12ai") {
    return false;
  }

  if (!is12AIAsyncImageModel(modelId)) {
    return false;
  }

  return Math.max(1, Number(imageCount || 1)) > 1;
}

function shouldBypassChatCompatibilityForImages(routeConfig: SecureProxyUserRouteConfigDto): boolean {
  const strategy = detectLocalRouteStrategy(routeConfig);
  return strategy === "12ai"
    || strategy === "gpt-best"
    || strategy === "suxi"
    || strategy === "newapi";
}

export function resolveLocalImageSurface(
  routeConfig: SecureProxyUserRouteConfigDto,
  modelId?: string,
  imageCount?: number,
): LocalResolvedImageSurface {
  const format = inferLocalRouteFormat(routeConfig);
  const isGeminiImage = isGeminiImageModel(modelId);
  const compatibilityMode = normalizeRouteString(routeConfig.compatibilityMode).toLowerCase();

  if (shouldUse12AIAsyncImageRoute(routeConfig, modelId, imageCount)) {
    return "async-image";
  }

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

export function resolveLocalRouteEndpointType(routeConfig: SecureProxyUserRouteConfigDto): LocalResolvedRouteEndpointType {
  return inferLocalRouteFormat(routeConfig);
}

function applyQueryApiKey(url: string, apiKey: string): string {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set("key", apiKey);
  return parsedUrl.toString();
}

export function getApiKeyToken(apiKey: string): string {
  return String(apiKey || "").trim().replace(/^Bearer\s+/i, "");
}

export function inferLocalAuthMethod(
  routeConfig: SecureProxyUserRouteConfigDto,
  format: LocalResolvedRouteFormat,
): LocalResolvedAuthMethod {
  if (shouldForceHeaderAuthForProvider(routeConfig.provider, routeConfig.baseUrl)) {
    return "header";
  }

  if (routeConfig.authMethod === "query" || routeConfig.authMethod === "header") {
    return routeConfig.authMethod;
  }

  return format === "gemini" && (isGoogleOfficialGeminiBaseUrl(routeConfig.baseUrl) || is12AIBaseUrl(routeConfig.baseUrl))
    ? "query"
    : "header";
}

export function inferLocalHeaderName(
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

export function inferLocalAuthorizationValueFormat(
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

export function formatAuthorizationHeaderValue(
  apiKey: string,
  valueFormat: LocalAuthorizationValueFormat,
): string {
  const token = getApiKeyToken(apiKey);
  if (valueFormat === "raw") {
    return token;
  }

  return /^Bearer\s+/i.test(apiKey) ? apiKey : `Bearer ${token}`;
}

export function buildOpenAICompatAuth(
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

export function buildGeminiAuth(
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
