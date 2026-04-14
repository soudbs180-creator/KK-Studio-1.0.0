import type {
  SecureProxyUserRouteConfigDto,
  UserApiProtocolFormat,
  UserRouteConnectivityCheckDto,
  UserRoutePricingSyncDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { AuthDataService } from "./auth-data-service.ts";

type JsonRecord = Record<string, unknown>;
type ResolvedRouteFormat = Exclude<UserApiProtocolFormat, "auto">;
type ResolvedAuthMethod = "query" | "header";
type AuthorizationValueFormat = "bearer" | "raw";

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com";
const GOOGLE_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const CLAUDE_DEFAULT_BASE_URL = "https://api.anthropic.com";
const TWELVE_AI_DOCUMENTED_MODELS = [
  "gpt-5.1",
  "gemini-2.5-pro",
  "gemini-2.5-pro-c",
  "gemini-2.5-flash",
  "gemini-2.5-flash-c",
  "gemini-3.1-pro-preview",
  "gemini-3.1-pro-preview-c",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-image-c",
  "gemini-3-pro-image-preview",
  "gemini-3-pro-image-preview-c",
  "claude-4-sonnet",
  "runway-gen3",
  "luma-video",
  "kling-v1",
  "sv3d",
  "flux-kontext-max",
  "recraft-v3-svg",
  "ideogram-v2",
  "suno-v3.5",
  "minimax-t2a-01",
];

export class UserRouteDiagnosticsError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, options?: { code?: string; statusCode?: number }) {
    super(message);
    this.name = "UserRouteDiagnosticsError";
    this.code = options?.code || "USER_ROUTE_DIAGNOSTICS_ERROR";
    this.statusCode = options?.statusCode || 500;
  }
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getApiKeyToken(apiKey: string): string {
  return String(apiKey || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r?\n|\r|\t/g, "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/\s+/g, "")
    .trim();
}

function formatAuthorizationHeaderValue(
  apiKey: string,
  valueFormat: AuthorizationValueFormat,
): string {
  const token = getApiKeyToken(apiKey);
  if (valueFormat === "raw") {
    return token;
  }

  return /^Bearer\s+/i.test(apiKey) ? apiKey : `Bearer ${token}`;
}

function inferRouteFormat(routeConfig: SecureProxyUserRouteConfigDto): ResolvedRouteFormat {
  const explicitFormat = routeConfig.format;
  if (explicitFormat === "openai" || explicitFormat === "gemini" || explicitFormat === "claude") {
    return explicitFormat;
  }

  const provider = normalizeString(routeConfig.provider).toLowerCase();
  const baseUrl = normalizeString(routeConfig.baseUrl).toLowerCase();
  if (provider === "google" || provider === "gemini" || baseUrl.includes("googleapis.com")) {
    return "gemini";
  }
  if (provider.includes("anthropic") || baseUrl.includes("anthropic.com")) {
    return "claude";
  }

  return "openai";
}

function is12AIBaseUrl(baseUrl: string | undefined): boolean {
  const normalized = normalizeString(baseUrl);
  if (!normalized) return false;

  try {
    const candidate = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    const host = new URL(candidate).hostname.toLowerCase();
    return /(^|\.)12ai\.(org|xyz|io|net)$/i.test(host);
  } catch {
    return false;
  }
}

function isGoogleOfficialGeminiBaseUrl(baseUrl: string | undefined): boolean {
  const normalized = normalizeString(baseUrl).toLowerCase();
  return normalized.includes("googleapis.com") || normalized.includes("generativelanguage.googleapis.com");
}

function shouldForceHeaderAuthForProvider(provider: string, baseUrl: string): boolean {
  const normalizedProvider = normalizeString(provider).toLowerCase();
  const normalizedBaseUrl = normalizeString(baseUrl).toLowerCase();
  return normalizedProvider === "gpt-best"
    || normalizedProvider === "gptbest"
    || normalizedBaseUrl.includes("gpt-best")
    || normalizedBaseUrl.includes("gptbest");
}

function inferAuthMethod(
  routeConfig: SecureProxyUserRouteConfigDto,
  format: ResolvedRouteFormat,
): ResolvedAuthMethod {
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

function inferHeaderName(
  routeConfig: SecureProxyUserRouteConfigDto,
  format: ResolvedRouteFormat,
): string {
  const configured = normalizeString(routeConfig.headerName);
  if (configured) {
    return configured;
  }

  if (format === "gemini") {
    return "x-goog-api-key";
  }
  if (format === "claude") {
    return is12AIBaseUrl(routeConfig.baseUrl) ? "Authorization" : "x-api-key";
  }

  return "Authorization";
}

function inferAuthorizationValueFormat(
  routeConfig: SecureProxyUserRouteConfigDto,
  format: ResolvedRouteFormat,
  headerName: string,
): AuthorizationValueFormat {
  const baseUrl = normalizeString(routeConfig.baseUrl).toLowerCase();
  const provider = normalizeString(routeConfig.provider).toLowerCase();
  const normalizedHeader = headerName.toLowerCase();
  const is12AI = is12AIBaseUrl(routeConfig.baseUrl);

  if (format === "gemini" || format === "claude") {
    if (format === "claude" && is12AI) {
      return "bearer";
    }
    return "raw";
  }

  if (normalizedHeader !== "authorization") {
    return "raw";
  }

  if (baseUrl.includes("wuyinkeji") || provider.includes("wuyin")) {
    return "raw";
  }

  return "bearer";
}

function normalizeOpenAIBaseUrl(url: string | undefined): string {
  let clean = normalizeString(url) || OPENAI_DEFAULT_BASE_URL;
  clean = clean.replace(/\/+$/, "");
  clean = clean.replace(/\/(?:chat\/completions|images\/generations|images\/edits|responses|models)$/i, "");
  if (!/\/v\d[\w.-]*$/i.test(clean)) {
    clean = `${clean}/v1`;
  }
  return clean.replace(/\/+$/, "");
}

function buildOpenAIEndpoint(baseUrl: string | undefined, endpoint: string): string {
  return `${normalizeOpenAIBaseUrl(baseUrl)}/${endpoint.replace(/^\/+/, "")}`;
}

function normalizeClaudeBaseUrl(url: string | undefined): string {
  let clean = normalizeString(url) || CLAUDE_DEFAULT_BASE_URL;
  clean = clean.replace(/\/+$/, "");
  clean = clean.replace(/\/(?:messages|models)$/i, "");
  if (!/\/v\d[\w.-]*$/i.test(clean)) {
    clean = `${clean}/v1`;
  }
  return clean.replace(/\/+$/, "");
}

function buildClaudeEndpoint(baseUrl: string | undefined, endpoint: string): string {
  return `${normalizeClaudeBaseUrl(baseUrl)}/${endpoint.replace(/^\/+/, "")}`;
}

function normalizeGeminiBaseUrl(url: string | undefined): string {
  let clean = normalizeString(url) || GOOGLE_DEFAULT_BASE_URL;
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

  return clean || GOOGLE_DEFAULT_BASE_URL;
}

function buildGeminiModelsEndpoint(
  baseUrl: string | undefined,
  apiKey: string,
  authMethod: ResolvedAuthMethod,
): string {
  const endpoint = `${normalizeGeminiBaseUrl(baseUrl)}/v1beta/models`;
  if (authMethod === "query") {
    return `${endpoint}?key=${encodeURIComponent(getApiKeyToken(apiKey))}`;
  }
  return endpoint;
}

function buildGeminiGenerateContentEndpoint(
  baseUrl: string | undefined,
  modelId: string,
  apiKey: string,
  authMethod: ResolvedAuthMethod,
): string {
  const endpoint = `${normalizeGeminiBaseUrl(baseUrl)}/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;
  if (authMethod === "query") {
    return `${endpoint}?key=${encodeURIComponent(getApiKeyToken(apiKey))}`;
  }
  return endpoint;
}

function buildHeaders(
  routeConfig: SecureProxyUserRouteConfigDto,
  format: ResolvedRouteFormat,
  authMethod: ResolvedAuthMethod,
  headerName: string,
  authorizationValueFormat: AuthorizationValueFormat,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (format === "claude") {
    headers["anthropic-version"] = "2023-06-01";
  }

  if (authMethod !== "header") {
    return headers;
  }

  headers[headerName] = headerName.toLowerCase() === "authorization"
    ? formatAuthorizationHeaderValue(routeConfig.apiKey, authorizationValueFormat)
    : getApiKeyToken(routeConfig.apiKey);

  return headers;
}

function normalizeModels(payload: unknown): string[] {
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as JsonRecord
    : null;
  const models = Array.isArray(record?.data)
    ? record.data
    : Array.isArray(record?.models)
      ? record.models
      : [];

  return models
    .map((item: any) => String(item?.id || item?.name || item?.model || "").replace(/^models\//i, ""))
    .filter(Boolean);
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload) {
    return fallback;
  }

  if (typeof payload === "string") {
    return payload.trim() || fallback;
  }

  if (typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as JsonRecord;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
    if (record.error && typeof record.error === "object" && !Array.isArray(record.error)) {
      const nested = record.error as JsonRecord;
      if (typeof nested.message === "string" && nested.message.trim()) {
        return nested.message.trim();
      }
      if (typeof nested.error === "string" && nested.error.trim()) {
        return nested.error.trim();
      }
    }
  }

  return fallback;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizePricingBaseUrl(baseUrl: string): string {
  const raw = normalizeString(baseUrl);
  if (!raw) return "";
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed.replace(/(\/(pricing|models))(\/.*)?$/i, "") || trimmed;
}

function buildPricingEndpointCandidates(baseUrl: string): string[] {
  const cleanUrl = normalizePricingBaseUrl(baseUrl);
  if (!cleanUrl) return [];

  const rootUrl = cleanUrl.replace(/\/v1$/i, "");
  let originUrl = cleanUrl;

  try {
    const parsed = new URL(cleanUrl);
    originUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    originUrl = rootUrl;
  }

  const baseCandidates = Array.from(new Set([cleanUrl, rootUrl, originUrl].filter(Boolean)));
  const suffixes = ["/pricing", "/pricing.html", "/models", "/api/pricing", "/price", "/api/price"];
  return Array.from(
    new Set(
      baseCandidates.flatMap((candidate) => suffixes.map((suffix) => `${candidate}${suffix}`)),
    ),
  );
}

function isPricingLikeObject(item: unknown): item is JsonRecord {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return false;
  }

  const keys = Object.keys(item).map((key) => key.toLowerCase());
  const hasModel = keys.some((key) => key.includes("model") || key === "id" || key.includes("name"));
  const hasPrice = keys.some((key) => key.includes("price") || key.includes("ratio") || key.includes("quota") || key.includes("cost"));
  return hasModel && hasPrice;
}

function extractPricingPayloadRows(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isPricingLikeObject);
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as JsonRecord;
  if (Array.isArray(record.data)) {
    return record.data.filter(isPricingLikeObject);
  }
  if (Array.isArray(record.prices)) {
    return record.prices.filter(isPricingLikeObject);
  }
  if (Array.isArray(record.models)) {
    return record.models.filter(isPricingLikeObject);
  }

  for (const value of Object.values(record)) {
    const nested = extractPricingPayloadRows(value);
    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

function extractGroupRatioMap(payload: unknown): Record<string, number> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const record = payload as JsonRecord;
  const source = record.group_ratio ?? record.groupRatio ?? record.groups ?? null;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }

  return Object.entries(source as JsonRecord).reduce<Record<string, number>>((acc, [key, value]) => {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) {
      acc[key] = numeric;
    }
    return acc;
  }, {});
}

function supportsPricingSync(routeConfig: SecureProxyUserRouteConfigDto, format: ResolvedRouteFormat): boolean {
  const baseUrl = normalizeString(routeConfig.baseUrl).toLowerCase();
  if (format === "gemini" && baseUrl.includes("googleapis.com")) {
    return false;
  }
  if (format === "claude" && baseUrl.includes("anthropic.com")) {
    return false;
  }
  return true;
}

export class UserRouteDiagnosticsService {
  private readonly authDataService: AuthDataService;

  constructor(authDataService: AuthDataService) {
    this.authDataService = authDataService;
  }

  async checkConnectivity(
    userId: string,
    email: string | undefined,
    routeId: string,
    accessToken?: string,
  ): Promise<UserRouteConnectivityCheckDto> {
    const routeConfig = await this.resolveRouteConfig(userId, email, routeId, accessToken);
    const format = inferRouteFormat(routeConfig);
    const authMethod = inferAuthMethod(routeConfig, format);
    const headerName = inferHeaderName(routeConfig, format);
    const authorizationValueFormat = inferAuthorizationValueFormat(routeConfig, format, headerName);
    const is12AI = is12AIBaseUrl(routeConfig.baseUrl);
    const endpointUrl =
      is12AI
        ? (
          format === "gemini"
            ? buildGeminiGenerateContentEndpoint(routeConfig.baseUrl, "gemini-2.5-flash", routeConfig.apiKey, authMethod)
            : format === "claude"
              ? buildClaudeEndpoint(routeConfig.baseUrl, "messages")
              : buildOpenAIEndpoint(routeConfig.baseUrl, "chat/completions")
        )
        : (
          format === "gemini"
            ? buildGeminiModelsEndpoint(routeConfig.baseUrl, routeConfig.apiKey, authMethod)
            : format === "claude"
              ? buildClaudeEndpoint(routeConfig.baseUrl, "models")
              : buildOpenAIEndpoint(routeConfig.baseUrl, "models")
        );
    const headers = buildHeaders(
      routeConfig,
      format,
      authMethod,
      headerName,
      authorizationValueFormat,
    );

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("Connectivity check timed out."), 15000);

    try {
      const response = await fetch(endpointUrl, {
        method: is12AI ? "POST" : "GET",
        headers,
        body: is12AI
          ? JSON.stringify(
            format === "gemini"
              ? {
                  contents: [{ role: "user", parts: [{ text: "Connectivity check" }] }],
                }
              : format === "claude"
                ? {
                    model: "claude-4-sonnet",
                    messages: [{ role: "user", content: [{ type: "text", text: "Connectivity check" }] }],
                    max_tokens: 16,
                  }
                : {
                    model: "gpt-5.1",
                    messages: [{ role: "user", content: [{ type: "text", text: "Connectivity check" }] }],
                    max_tokens: 16,
                    stream: false,
                  },
          )
          : undefined,
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;
      const payload = await parseResponsePayload(response);

      if (!response.ok) {
        return {
          routeId,
          ok: false,
          message: extractErrorMessage(
            payload,
            `HTTP ${response.status}: ${response.statusText || "Connectivity check failed."}`,
          ),
          endpointUrl,
          latencyMs,
          resolvedFormat: format,
          models: [],
        };
      }

      return {
        routeId,
        ok: true,
        message: undefined,
        endpointUrl,
        latencyMs,
        resolvedFormat: format,
        models: is12AI ? TWELVE_AI_DOCUMENTED_MODELS : normalizeModels(payload),
      };
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Request timed out while checking connectivity."
          : error instanceof Error
            ? error.message
            : "Connectivity check failed.";

      return {
        routeId,
        ok: false,
        message,
        endpointUrl,
        latencyMs: Date.now() - startedAt,
        resolvedFormat: format,
        models: [],
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async syncPricing(
    userId: string,
    email: string | undefined,
    routeId: string,
    accessToken?: string,
  ): Promise<UserRoutePricingSyncDto> {
    const routeConfig = await this.resolveRouteConfig(userId, email, routeId, accessToken);
    const format = inferRouteFormat(routeConfig);
    const authMethod = inferAuthMethod(routeConfig, format);
    const headerName = inferHeaderName(routeConfig, format);
    const authorizationValueFormat = inferAuthorizationValueFormat(routeConfig, format, headerName);

    if (!supportsPricingSync(routeConfig, format)) {
      return {
        routeId,
        ok: false,
        message: `供应商 ${routeConfig.provider} 当前没有可抓取的价格端点。`,
        count: 0,
        pricingData: [],
        groupRatio: {},
      };
    }

    const headers = buildHeaders(
      routeConfig,
      format,
      authMethod,
      headerName,
      authorizationValueFormat,
    );
    const attemptedUrls: string[] = [];
    let lastMessage = "No pricing data is available right now.";

    for (const endpointUrl of buildPricingEndpointCandidates(routeConfig.baseUrl)) {
      attemptedUrls.push(endpointUrl);
      try {
        const response = await fetch(endpointUrl, {
          method: "GET",
          headers,
        });
        const payload = await parseResponsePayload(response);
        if (!response.ok) {
          lastMessage = extractErrorMessage(
            payload,
            `HTTP ${response.status}: ${response.statusText || "Pricing sync failed."}`,
          );
          continue;
        }

        const pricingData = extractPricingPayloadRows(payload);
        if (pricingData.length === 0) {
          lastMessage = "Pricing endpoint returned no usable pricing rows.";
          continue;
        }

        return {
          routeId,
          ok: true,
          message: `已同步 ${pricingData.length} 条价格数据。`,
          endpointUrl,
          attemptedUrls,
          count: pricingData.length,
          pricingData,
          groupRatio: extractGroupRatioMap(payload),
        };
      } catch (error) {
        lastMessage = error instanceof Error ? error.message : "Pricing sync failed.";
      }
    }

    return {
      routeId,
      ok: false,
      message: lastMessage,
      endpointUrl: attemptedUrls[attemptedUrls.length - 1],
      attemptedUrls,
      count: 0,
      pricingData: [],
      groupRatio: {},
    };
  }

  private async resolveRouteConfig(
    userId: string,
    email: string | undefined,
    routeId: string,
    accessToken?: string,
  ): Promise<SecureProxyUserRouteConfigDto> {
    const normalizedRouteId = String(routeId || "").trim();
    if (!normalizedRouteId) {
      throw new UserRouteDiagnosticsError("routeId is required.", {
        code: "INVALID_REQUEST",
        statusCode: 400,
      });
    }

    const routeConfig = await this.authDataService.resolveSecureProxyUserRouteConfig(
      userId,
      email,
      normalizedRouteId,
      accessToken,
    );
    if (!routeConfig) {
      throw new UserRouteDiagnosticsError("The selected user route could not be resolved.", {
        code: "USER_ROUTE_NOT_FOUND",
        statusCode: 404,
      });
    }

    return routeConfig;
  }
}
