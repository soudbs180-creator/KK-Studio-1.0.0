import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ProxyRequest = {
  mode: 'chat' | 'image' | 'video' | 'audio' | 'task_status' | 'cancel_task' | 'delete_task' | 'download_task';
  modelId: string;
  requestId?: string;
  attemptId?: string;
  userRoute?: {
    kind: 'key-slot';
    id: string;
  };
  routeConfig?: unknown;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  prompt?: string;
  aspectRatio?: string;
  imageSize?: string;
  imageCount?: number;
  referenceImages?: Array<string | { data: string; mimeType?: string }>;
  resolution?: string;
  duration?: number;
  videoDuration?: string;
  imageUrl?: string;
  imageTailUrl?: string;
  taskId?: string;
};

type JsonRecord = Record<string, unknown>;

type EncryptedSecretEnvelope = {
  __kkUserApiSecret: true;
  alg: 'aes-256-gcm';
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

type ResolvedUserRoute = {
  routeId: string;
  provider: string;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  format: 'openai' | 'gemini' | 'claude' | 'auto';
  authMethod: 'header' | 'query';
  headerName?: string;
  compatibilityMode?: 'standard' | 'chat';
};

const RESPONSE_ONLY_MODEL_PATTERNS = [
  /^o3-pro$/i,
  /^codex-mini-latest$/i,
  /^o3-deep-research(?:-[\d-]+)?$/i,
];

const USER_API_SECRET_ARRAY_FIELDS = {
  slots: ['key'],
  providers: ['apiKey'],
  entries: ['key'],
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const INTERNAL_ROUTE_SECRET_HEADER = 'x-kk-internal-route-secret';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

type ParsedSystemModelRoute = {
  baseModelId: string;
  routeIndex: number | null;
  routeKey: string | null;
};

function parseSystemModelRoute(input: string): ParsedSystemModelRoute {
  const rawModelId = String(input || '').trim();
  const [baseModelId, rawSuffix = ''] = rawModelId.split('@');
  const suffix = rawSuffix.trim().toLowerCase();
  const systemMatch = suffix.match(/^system(?:_(.+))?$/);

  if (!systemMatch) {
    return {
      baseModelId: baseModelId.trim(),
      routeIndex: null,
      routeKey: null,
    };
  }

  const rawRouteToken = String(systemMatch[1] || '').trim();
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

function getBaseModelId(modelId: string): string {
  return String(modelId || '').split('@')[0]?.trim() || '';
}

function getUpstreamModelId(modelId: string): string {
  return getBaseModelId(modelId).split('|')[0]?.trim() || '';
}

function modelPrefersResponsesApi(modelId: string): boolean {
  const normalized = getUpstreamModelId(modelId).toLowerCase();
  return RESPONSE_ONLY_MODEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function shouldRetryWithResponsesApi(status: number | undefined, errorText: string | undefined): boolean {
  if (!errorText) return false;

  const text = String(errorText || '').toLowerCase();
  if (!text) return false;

  if (text.includes('/v1/responses') || text.includes('use /v1/responses')) {
    return true;
  }

  if ((text.includes('responses api') || text.includes('response api')) && !text.includes('image')) {
    return true;
  }

  if (
    (text.includes('chat/completions') || text.includes('/chat/completions'))
    && (text.includes('not supported') || text.includes('unsupported') || text.includes('invalid'))
  ) {
    return true;
  }

  if (
    status === 400
    && text.includes('responses')
    && (text.includes('model') || text.includes('endpoint'))
  ) {
    return true;
  }

  return false;
}

function normalizeClaudeBaseUrl(baseUrl: string): string {
  return String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/i, '');
}

function hasAnyKey(value: unknown, keys: string[]): boolean {
  if (!isRecord(value)) return false;
  return keys.some((key) => key in value);
}

function detectLegacyArrayKind(raw: unknown[]): 'slots' | 'entries' | 'unknown' {
  if (!raw.length) return 'unknown';

  const slotOnlyKeys = [
    'authMethod',
    'headerName',
    'compatibilityMode',
    'proxyConfig',
    'creditCost',
    'quota',
    'weight',
    'timeout',
    'maxRetries',
    'retryDelay',
    'cooldownUntil',
    'customHeaders',
    'customBody',
  ];
  const entryOnlyKeys = [
    'api_key_encrypted',
    'is_active',
    'created_at',
    'updated_at',
    'call_count',
    'total_cost',
  ];

  if (raw.some((item) => hasAnyKey(item, slotOnlyKeys))) {
    return 'slots';
  }
  if (raw.some((item) => hasAnyKey(item, entryOnlyKeys))) {
    return 'entries';
  }
  return 'unknown';
}

function isUserApisEnvelope(value: unknown): value is JsonRecord {
  if (!isRecord(value)) return false;
  return 'slots' in value || 'providers' in value || 'entries' in value;
}

function extractKeyManagerCloudSlots(raw: unknown): JsonRecord[] {
  if (isUserApisEnvelope(raw)) {
    return toArray(raw.slots).filter(isRecord);
  }
  return toArray(raw).filter(isRecord);
}

function extractUserApiEntriesFromPayload(raw: unknown): JsonRecord[] {
  if (isUserApisEnvelope(raw)) {
    return toArray(raw.entries).filter(isRecord);
  }

  const legacy = toArray(raw);
  const kind = detectLegacyArrayKind(legacy);
  return (kind === 'unknown' || kind === 'entries' || kind === 'slots')
    ? legacy.filter(isRecord)
    : [];
}

function extractUserApiProvidersFromPayload(raw: unknown): JsonRecord[] {
  if (!isUserApisEnvelope(raw)) return [];
  return toArray(raw.providers).filter(isRecord);
}

function isEncryptedSecretEnvelope(value: unknown): value is EncryptedSecretEnvelope {
  return (
    isRecord(value)
    && value.__kkUserApiSecret === true
    && value.alg === 'aes-256-gcm'
    && value.v === 1
    && typeof value.iv === 'string'
    && typeof value.tag === 'string'
    && typeof value.data === 'string'
  );
}

function base64ToUint8Array(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveUserApiEncryptionKey(secretSeed: string): Promise<CryptoKey> {
  const rawKey = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`kk-studio:user-api-secrets:${secretSeed}`),
  );

  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
}

async function decryptUserApiSecretValue(
  value: EncryptedSecretEnvelope,
  encryptionKey: CryptoKey,
): Promise<string> {
  const cipherBytes = base64ToUint8Array(value.data);
  const tagBytes = base64ToUint8Array(value.tag);
  const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
  combined.set(cipherBytes, 0);
  combined.set(tagBytes, cipherBytes.length);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToUint8Array(value.iv),
    },
    encryptionKey,
    combined,
  );

  return new TextDecoder().decode(decrypted);
}

async function transformArraySecretFields(
  value: unknown,
  fields: readonly string[],
  transform: (secret: unknown) => Promise<unknown>,
): Promise<unknown> {
  if (!Array.isArray(value)) {
    return value;
  }

  const nextItems = await Promise.all(value.map(async (item) => {
    if (!isRecord(item)) {
      return item;
    }

    const nextItem: JsonRecord = { ...item };
    for (const field of fields) {
      if (field in nextItem) {
        nextItem[field] = await transform(nextItem[field]);
      }
    }
    return nextItem;
  }));

  return nextItems;
}

async function transformUserApiPayloadSecrets(
  raw: unknown,
  transform: (secret: unknown) => Promise<unknown>,
): Promise<unknown> {
  if (Array.isArray(raw)) {
    return transformArraySecretFields(raw, ['key'], transform);
  }

  if (!isRecord(raw)) {
    return raw;
  }

  const nextPayload: JsonRecord = { ...raw };
  for (const collection of Object.keys(USER_API_SECRET_ARRAY_FIELDS) as Array<keyof typeof USER_API_SECRET_ARRAY_FIELDS>) {
    nextPayload[collection] = await transformArraySecretFields(
      nextPayload[collection],
      USER_API_SECRET_ARRAY_FIELDS[collection],
      transform,
    );
  }

  return nextPayload;
}

async function decryptUserApisPayload(raw: unknown, secretSeed: string): Promise<unknown> {
  const encryptionKey = await deriveUserApiEncryptionKey(secretSeed);

  return transformUserApiPayloadSecrets(raw, async (secret) => {
    if (isEncryptedSecretEnvelope(secret)) {
      return decryptUserApiSecretValue(secret, encryptionKey);
    }
    return secret;
  });
}

function resolveDefaultRouteBaseUrl(
  provider: string,
  baseUrl: string,
  format: 'openai' | 'gemini' | 'claude' | 'auto',
): string {
  const normalizedBaseUrl = String(baseUrl || '').trim();
  if (normalizedBaseUrl) {
    return normalizedBaseUrl.replace(/\/+$/, '');
  }

  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (format === 'claude' || normalizedProvider.includes('anthropic')) {
    return 'https://api.anthropic.com';
  }
  if (format === 'gemini' || normalizedProvider === 'google' || normalizedProvider === 'gemini') {
    return 'https://generativelanguage.googleapis.com';
  }
  if (normalizedProvider === 'openai') {
    return 'https://api.openai.com';
  }
  return normalizedBaseUrl;
}

function resolveUserRouteEndpointType(route: ResolvedUserRoute): 'openai' | 'gemini' | 'claude' {
  const normalizedFormat = String(route.format || '').trim().toLowerCase();
  const normalizedProvider = String(route.provider || '').trim().toLowerCase();
  const normalizedBaseUrl = String(route.baseUrl || '').trim().toLowerCase();

  if (
    normalizedFormat === 'claude'
    || normalizedProvider.includes('anthropic')
    || normalizedBaseUrl.includes('anthropic.com')
  ) {
    return 'claude';
  }

  if (
    normalizedFormat === 'gemini'
    || normalizedProvider === 'google'
    || normalizedProvider === 'gemini'
    || normalizedBaseUrl.includes('googleapis.com')
    || normalizedBaseUrl.includes('generativelanguage.googleapis.com')
  ) {
    return 'gemini';
  }

  return 'openai';
}

async function resolveSecureProxyUserRoute(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  route: { kind: 'key-slot'; id: string },
  secretSeed: string,
): Promise<ResolvedUserRoute | null> {
  const routeId = String(route.id || '').trim();
  if (!routeId) {
    return null;
  }

  const { data: profile, error } = await serviceClient
    .from('profiles')
    .select('user_apis')
    .eq('id', userId)
    .maybeSingle<{ user_apis: unknown }>();

  if (error) {
    throw error;
  }

  const decryptedPayload = await decryptUserApisPayload(profile?.user_apis ?? null, secretSeed);
  const slots = extractKeyManagerCloudSlots(decryptedPayload);
  const providers = extractUserApiProvidersFromPayload(decryptedPayload);
  const entries = extractUserApiEntriesFromPayload(decryptedPayload);
  const matchedRecord =
    slots.find((item) => String(item.id || '').trim() === routeId)
    || providers.find((item) => String(item.id || '').trim() === routeId)
    || entries.find((item) => String(item.id || '').trim() === routeId);

  if (!matchedRecord) {
    return null;
  }

  const apiKey = String(matchedRecord.apiKey ?? matchedRecord.key ?? '').trim();
  if (!apiKey) {
    return null;
  }

  const isDisabled =
    matchedRecord.disabled === true
    || matchedRecord.isActive === false
    || matchedRecord.is_active === false;
  if (isDisabled) {
    return null;
  }

  const formatValue = String(matchedRecord.format || '').trim().toLowerCase();
  const format: ResolvedUserRoute['format'] =
    formatValue === 'gemini'
      ? 'gemini'
      : formatValue === 'claude'
        ? 'claude'
        : formatValue === 'openai'
          ? 'openai'
          : 'auto';

  const provider = String(matchedRecord.provider || matchedRecord.name || 'Custom').trim() || 'Custom';
  const baseUrl = resolveDefaultRouteBaseUrl(
    provider,
    String(matchedRecord.baseUrl || matchedRecord.base_url || '').trim(),
    format,
  );

  return {
    routeId,
    provider,
    providerName: String(matchedRecord.name || provider).trim() || provider,
    baseUrl,
    apiKey,
    format,
    authMethod: matchedRecord.authMethod === 'query' ? 'query' : 'header',
    headerName: typeof matchedRecord.headerName === 'string' ? matchedRecord.headerName.trim() : undefined,
    compatibilityMode:
      matchedRecord.compatibilityMode === 'chat'
        ? 'chat'
        : matchedRecord.compatibilityMode === 'standard'
          ? 'standard'
          : undefined,
  };
}

function resolveInlineRouteConfig(raw: unknown): ResolvedUserRoute | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const routeId = String(candidate.routeId || '').trim();
  const apiKey = String(candidate.apiKey || '').trim();
  if (!routeId || !apiKey) {
    return null;
  }

  const formatValue = String(candidate.format || '').trim().toLowerCase();
  const format: ResolvedUserRoute['format'] =
    formatValue === 'gemini'
      ? 'gemini'
      : formatValue === 'claude'
        ? 'claude'
        : formatValue === 'openai'
          ? 'openai'
          : 'auto';
  const provider = String(candidate.provider || 'Custom').trim() || 'Custom';

  return {
    routeId,
    provider,
    providerName: String(candidate.providerName || candidate.provider || provider).trim() || provider,
    baseUrl: resolveDefaultRouteBaseUrl(
      provider,
      String(candidate.baseUrl || '').trim(),
      format,
    ),
    apiKey,
    format,
    authMethod: candidate.authMethod === 'query' ? 'query' : 'header',
    headerName: typeof candidate.headerName === 'string' ? candidate.headerName.trim() : undefined,
    compatibilityMode:
      candidate.compatibilityMode === 'chat'
        ? 'chat'
        : candidate.compatibilityMode === 'standard'
          ? 'standard'
          : undefined,
  };
}

function applyQueryApiKey(url: string, apiKey: string): string {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set('key', apiKey);
  return parsedUrl.toString();
}

function buildOpenAICompatAuth(
  url: string,
  route: ResolvedUserRoute,
  defaultHeaderName = 'Authorization',
): { url: string; headers: HeadersInit } {
  if (route.authMethod === 'query') {
    return {
      url: applyQueryApiKey(url, route.apiKey),
      headers: {},
    };
  }

  const headerName = String(route.headerName || defaultHeaderName).trim() || defaultHeaderName;
  return {
    url,
    headers: {
      [headerName]: headerName.toLowerCase() === 'authorization'
        ? `Bearer ${route.apiKey}`
        : route.apiKey,
    },
  };
}

function buildGeminiAuth(
  url: string,
  route: ResolvedUserRoute,
): { url: string; headers: HeadersInit } {
  if (route.authMethod === 'header') {
    return {
      url,
      headers: {
        [String(route.headerName || 'x-goog-api-key').trim() || 'x-goog-api-key']: route.apiKey,
      },
    };
  }

  return {
    url: applyQueryApiKey(url, route.apiKey),
    headers: {},
  };
}

function buildClaudeAuth(
  url: string,
  route: ResolvedUserRoute,
): { url: string; headers: HeadersInit } {
  const { url: resolvedUrl, headers } = buildOpenAICompatAuth(url, route, 'x-api-key');
  return {
    url: resolvedUrl,
    headers: {
      ...headers,
      'anthropic-version': '2023-06-01',
    },
  };
}

function pickRandomKey(keys: string[]): string | null {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  const valid = keys.filter((key) => typeof key === 'string' && key.trim().length > 0);
  if (valid.length === 0) return null;
  const index = Math.floor(Math.random() * valid.length);
  return valid[index];
}

function normalizeImageSize(imageSize?: string): string {
  const raw = String(imageSize || '1K').toUpperCase();
  if (raw.includes('4K')) return '4K';
  if (raw.includes('2K')) return '2K';
  if (raw.includes('0.5K') || raw.includes('512')) return '0.5K';
  return '1K';
}

type CreditModelRouteRow = {
  base_url?: string | null;
  api_keys?: string[] | null;
  endpoint_type?: string | null;
  model_id?: string | null;
  credit_cost?: number | null;
  display_name?: string | null;
  provider_id?: string | null;
  priority?: number | null;
  weight?: number | null;
  call_count?: number | null;
  advanced_enabled?: boolean | null;
  mix_with_same_model?: boolean | null;
  quality_pricing?: Record<string, { enabled?: boolean; creditCost?: number; credit_cost?: number } | null> | null;
};

function sortCreditModelRoutes(routes: CreditModelRouteRow[]): CreditModelRouteRow[] {
  return [...routes].sort((left, right) => {
    const priorityDiff = Number(right.priority || 0) - Number(left.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;

    const weightDiff = Number(right.weight || 0) - Number(left.weight || 0);
    if (weightDiff !== 0) return weightDiff;

    const providerDiff = String(left.provider_id || '').localeCompare(String(right.provider_id || ''));
    if (providerDiff !== 0) return providerDiff;

    return String(left.model_id || '').localeCompare(String(right.model_id || ''));
  });
}

function normalizeQualityPricing(
  pricing: CreditModelRouteRow['quality_pricing'],
  fallbackCost: number
): Record<string, { enabled: boolean; creditCost: number }> {
  const safeCost = Math.max(1, Number(fallbackCost || 1));
  const defaults = {
    '0.5K': { enabled: true, creditCost: Math.max(1, Math.floor(safeCost * 0.5)) },
    '1K': { enabled: true, creditCost: safeCost },
    '2K': { enabled: true, creditCost: safeCost * 2 },
    '4K': { enabled: true, creditCost: safeCost * 4 },
  };

  if (!pricing || typeof pricing !== 'object') {
    return defaults;
  }

  for (const size of ['0.5K', '1K', '2K', '4K']) {
    const item = pricing[size];
    if (!item || typeof item !== 'object') continue;
    defaults[size] = {
      enabled: item.enabled !== false,
      creditCost: Math.max(1, Number(item.creditCost || item.credit_cost || defaults[size].creditCost)),
    };
  }

  return defaults;
}

function isRouteQualityEnabled(route: CreditModelRouteRow, requestedSize: string): boolean {
  if (!route.advanced_enabled) return true;
  const pricing = normalizeQualityPricing(route.quality_pricing, Number(route.credit_cost || 1));
  return pricing[requestedSize]?.enabled !== false;
}

function getRouteCreditCost(route: CreditModelRouteRow, requestedSize: string): number {
  if (!route.advanced_enabled) {
    return Math.max(1, Number(route.credit_cost || 1));
  }

  const pricing = normalizeQualityPricing(route.quality_pricing, Number(route.credit_cost || 1));
  return Math.max(1, Number(pricing[requestedSize]?.creditCost || route.credit_cost || 1));
}

function pickRandomRoute<T>(routes: T[]): T | null {
  if (routes.length === 0) return null;
  if (routes.length === 1) return routes[0];

  const index = Math.floor(Math.random() * routes.length);
  return routes[index] ?? routes[0] ?? null;
}

function pickCheapestRoute(
  routes: CreditModelRouteRow[],
  requestedSize: string,
  options?: {
    onlyEnabledForRequestedSize?: boolean;
    useBaseCreditCost?: boolean;
  }
): { route: CreditModelRouteRow; requiredCredits: number } | null {
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
      ? Math.max(1, Number(route.credit_cost || 1))
      : getRouteCreditCost(route, requestedSize),
  }));

  const lowestCost = Math.min(...pricedRoutes.map((item) => item.requiredCredits));
  const cheapestRoutes = pricedRoutes.filter((item) => item.requiredCredits === lowestCost);
  return pickRandomRoute(cheapestRoutes);
}

function pickCreditModelRoute(
  routes: CreditModelRouteRow[],
  requestedSize: string,
  routeIndex: number | null,
  routeKey: string | null
): { route: CreditModelRouteRow; requiredCredits: number } | null {
  const sortedRoutes = sortCreditModelRoutes(routes);
  const mixedRoutes = sortedRoutes.filter((route) => route.mix_with_same_model === true);
  const eligibleRoutes = sortedRoutes.filter((route) => isRouteQualityEnabled(route, requestedSize));
  const eligibleMixedRoutes = mixedRoutes.filter((route) => isRouteQualityEnabled(route, requestedSize));

  if (routeKey) {
    const exactRoute = sortedRoutes.find(
      (route) => String(route.provider_id || '').trim().toLowerCase() === routeKey
    );
    if (!exactRoute || !isRouteQualityEnabled(exactRoute, requestedSize)) {
      return null;
    }

    return {
      route: exactRoute,
      requiredCredits: getRouteCreditCost(exactRoute, requestedSize),
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
    };
  }

  if (eligibleRoutes.length === 0) return null;
  const selectedRoute = eligibleRoutes[0];
  return {
    route: selectedRoute,
    requiredCredits: getRouteCreditCost(selectedRoute, requestedSize),
  };
}

function mapAspectRatioToOpenAI(aspectRatio?: string): string {
  switch (aspectRatio) {
    case '16:9': return '1792x1024';
    case '9:16': return '1024x1792';
    case '3:2': return '1536x1024';
    case '2:3': return '1024x1536';
    case '4:3': return '1024x768';
    case '3:4': return '768x1024';
    default: return '1024x1024';
  }
}

type EncodedSystemTask = {
  kind: 'video' | 'system-video';
  modelId: string;
  providerId?: string;
  endpointType: 'gemini' | 'openai';
  operationName: string;
  transactionId: string;
  userId: string;
  requestId?: string;
  attemptId?: string;
};

type EncodedUserTask = {
  kind: 'user-video';
  modelId: string;
  userRouteId: string;
  endpointType: 'gemini' | 'openai' | 'claude';
  operationName: string;
  userId: string;
  requestId?: string;
  attemptId?: string;
};

type EncodedTaskPayload = EncodedSystemTask | EncodedUserTask;

type SignedSystemTask = EncodedTaskPayload & {
  sig: string;
};

async function signTaskPayload(secret: string, payload: EncodedTaskPayload): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return Array.from(new Uint8Array(signature))
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

async function encodeTaskPayload(payload: EncodedTaskPayload, secret: string): Promise<string> {
  const sig = await signTaskPayload(secret, payload);
  return `system_proxy:${btoa(JSON.stringify({ ...payload, sig } satisfies SignedSystemTask))}`;
}

async function decodeTaskPayload(taskId: string, secret: string): Promise<EncodedTaskPayload | null> {
  if (!taskId.startsWith('system_proxy:')) return null;
  try {
    const raw = atob(taskId.slice('system_proxy:'.length));
    const parsed = JSON.parse(raw) as Partial<SignedSystemTask>;
    if (
      !parsed ||
      !['video', 'system-video', 'user-video'].includes(String(parsed.kind || '')) ||
      typeof parsed.modelId !== 'string' ||
      typeof parsed.endpointType !== 'string' ||
      typeof parsed.operationName !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.sig !== 'string'
    ) {
      return null;
    }

    let payload: EncodedTaskPayload | null = null;
    if (parsed.kind === 'user-video') {
      if (typeof parsed.userRouteId !== 'string') {
        return null;
      }

      payload = {
        kind: 'user-video',
        modelId: parsed.modelId,
        userRouteId: parsed.userRouteId,
        endpointType:
          parsed.endpointType === 'gemini'
            ? 'gemini'
            : parsed.endpointType === 'claude'
              ? 'claude'
              : 'openai',
        operationName: parsed.operationName,
        userId: parsed.userId,
        requestId: typeof parsed.requestId === 'string' ? parsed.requestId : undefined,
        attemptId: typeof parsed.attemptId === 'string' ? parsed.attemptId : undefined,
      };
    } else {
      if (
        (parsed.providerId !== undefined && typeof parsed.providerId !== 'string')
        || typeof parsed.transactionId !== 'string'
      ) {
        return null;
      }

      payload = {
        kind: parsed.kind === 'system-video' ? 'system-video' : 'video',
        modelId: parsed.modelId,
        providerId: typeof parsed.providerId === 'string' ? parsed.providerId : undefined,
        endpointType: parsed.endpointType === 'gemini' ? 'gemini' : 'openai',
        operationName: parsed.operationName,
        transactionId: parsed.transactionId,
        userId: parsed.userId,
        requestId: typeof parsed.requestId === 'string' ? parsed.requestId : undefined,
        attemptId: typeof parsed.attemptId === 'string' ? parsed.attemptId : undefined,
      };
    }

    const expectedSig = await signTaskPayload(secret, payload);
    if (expectedSig !== parsed.sig) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function normalizeAspectRatio(aspectRatio?: string): string | undefined {
  const value = String(aspectRatio || '').trim();
  if (!value || value.toLowerCase() === 'auto') return undefined;
  return value;
}

function getVideoDurationSeconds(body: ProxyRequest): number | undefined {
  if (typeof body.duration === 'number' && Number.isFinite(body.duration) && body.duration > 0) {
    return Math.round(body.duration);
  }

  const legacyValue = Number.parseInt(String(body.videoDuration || '').trim(), 10);
  if (Number.isFinite(legacyValue) && legacyValue > 0) {
    return legacyValue;
  }

  return undefined;
}

function isGeminiImageCompatModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (lower.includes('gemini') && lower.includes('image')) ||
    lower.includes('nano-banana') ||
    lower.includes('banana');
}

function toOpenAIImageUrl(ref: string | { data: string; mimeType?: string }): string | null {
  if (typeof ref === 'string') {
    if (ref.startsWith('data:')) return ref;
    return null;
  }

  const rawData = String(ref.data || '');
  if (!rawData) return null;
  if (rawData.startsWith('data:')) return rawData;
  return `data:${ref.mimeType || 'image/png'};base64,${rawData}`;
}

function extractImageUrlsFromOpenAICompatPayload(data: any): string[] {
  const urls: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      urls.push(value.trim());
    }
  };

  const candidates = [
    ...(Array.isArray(data?.data) ? data.data : []),
    ...(Array.isArray(data?.images) ? data.images : []),
    ...(Array.isArray(data?.choices?.[0]?.message?.images) ? data.choices[0].message.images : []),
  ];

  candidates.forEach((item: any) => {
    if (!item || typeof item !== 'object') return;
    const b64 = item.b64_json || item.b64 || item.base64;
    if (typeof b64 === 'string' && b64.trim()) {
      urls.push(`data:image/png;base64,${b64.replace(/\s+/g, '')}`);
      return;
    }
    push(item.url);
    push(item.image_url);
  });

  const content = String(data?.choices?.[0]?.message?.content || '');
  const markdownMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (markdownMatch?.[1]) {
    push(markdownMatch[1]);
  }
  const dataUrlMatch = content.match(/data:(image\/[^;]+);base64,([A-Za-z0-9+/=\s]+)/);
  if (dataUrlMatch?.[2]) {
    urls.push(`data:${dataUrlMatch[1]};base64,${dataUrlMatch[2].replace(/\s+/g, '')}`);
  }

  return Array.from(new Set(urls));
}

async function tryDeleteUpstreamVideoTask(
  endpointType: 'gemini' | 'openai',
  baseUrl: string,
  selectedKey: string,
  operationName: string
): Promise<void> {
  try {
    if (endpointType === 'gemini') {
      const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
      await fetch(`${apiBase}/${operationName}?key=${encodeURIComponent(selectedKey)}`, {
        method: 'DELETE',
        headers: {
          'x-goog-api-key': selectedKey,
        },
      }).catch(() => undefined);
      return;
    }

    const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
    const candidateUrls = [
      `${openaiBase}/videos/${operationName}`,
      `${openaiBase}/videos/generations/${operationName}`,
    ];
    for (const url of candidateUrls) {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${selectedKey}`,
        },
      }).catch(() => null);
      if (response && (response.ok || response.status === 404 || response.status === 409)) {
        break;
      }
    }
  } catch {
    // Best-effort cleanup only.
  }
}

async function downloadVideoAsDataUrl(
  videoUrl: string,
  headers: HeadersInit
): Promise<string> {
  const downloadResponse = await fetch(videoUrl, { headers });
  if (!downloadResponse.ok) {
    throw new Error('Failed to download generated video');
  }
  const videoBuffer = await downloadResponse.arrayBuffer();
  const bytes = new Uint8Array(videoBuffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64Video = btoa(binary);
  return `data:video/mp4;base64,${base64Video}`;
}

type GeminiGeneratedVideoPayload = {
  uri: string;
  mimeType: string;
  bytesBase64Encoded: string;
};

function extractGeminiGeneratedVideoPayload(payload: any): GeminiGeneratedVideoPayload | null {
  const candidates = [
    payload?.response?.generateVideoResponse?.generatedSamples?.[0]?.video,
    payload?.response?.generatedSamples?.[0]?.video,
    payload?.response?.video,
    payload?.generatedSamples?.[0]?.video,
    Array.isArray(payload?.response?.videos)
      ? payload.response.videos[0]?.video || payload.response.videos[0]
      : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const uri = String(candidate?.uri || '').trim();
    const bytesBase64Encoded = String(candidate?.bytesBase64Encoded || '').trim();
    if (!uri && !bytesBase64Encoded) continue;

    return {
      uri,
      mimeType: String(candidate?.mimeType || candidate?.mime_type || 'video/mp4').trim() || 'video/mp4',
      bytesBase64Encoded,
    };
  }

  return null;
}

function buildGoogleImageExtraBody(body: ProxyRequest): Record<string, unknown> | undefined {
  const imageConfig: Record<string, unknown> = {};
  const aspectRatio = normalizeAspectRatio(body.aspectRatio);
  if (aspectRatio) {
    imageConfig.aspect_ratio = aspectRatio;
  }
  if (body.imageSize) {
    imageConfig.image_size = normalizeImageSize(body.imageSize);
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

function buildResponsesRequestBody(body: ProxyRequest, modelId: string): Record<string, unknown> {
  return {
    model: modelId,
    input: (body.messages || []).map((message) => ({
      role: message.role,
      content: [
        {
          type: 'input_text',
          text: String(message.content || ''),
        },
      ],
    })),
    stream: false,
    temperature: body.temperature ?? 0.7,
    max_output_tokens: body.maxTokens ?? 2048,
  };
}

function extractTextFromResponsesPayload(payload: any): string {
  const directOutputText = String(payload?.output_text || '').trim();
  if (directOutputText) {
    return directOutputText;
  }

  if (!Array.isArray(payload?.output)) {
    return '';
  }

  const parts: string[] = [];
  for (const item of payload.output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      const text = String(block?.text || block?.content || '').trim();
      if (text) {
        parts.push(text);
      }
    }
  }

  return parts.join('').trim();
}

function extractOpenAIUsage(payload: any): { promptTokens: number; completionTokens: number; totalTokens: number } {
  const promptTokens = Number(payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens ?? 0) || 0;
  const completionTokens = Number(payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens ?? 0) || 0;
  const totalTokens = Number(payload?.usage?.total_tokens ?? (promptTokens + completionTokens)) || 0;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function is12AIGeminiBaseUrl(baseUrl: string): boolean {
  const normalizedBaseUrl = String(baseUrl || '').trim();
  if (!normalizedBaseUrl) return false;

  try {
    const candidate = /^https?:\/\//i.test(normalizedBaseUrl) ? normalizedBaseUrl : `https://${normalizedBaseUrl}`;
    const host = new URL(candidate).hostname.toLowerCase();
    return /(^|\.)12ai\.(org|xyz|io|net)$/i.test(host);
  } catch {
    return false;
  }
}

async function appendOpenAIVideoReference(formData: FormData, imageSource: string): Promise<void> {
  if (!imageSource) return;

  if (imageSource.startsWith('data:')) {
    const response = await fetch(imageSource);
    const blob = await response.blob();
    formData.append('input_reference', blob, 'reference-image.png');
    return;
  }

  try {
    const response = await fetch(imageSource);
    if (response.ok) {
      const blob = await response.blob();
      const fileName = blob.type.includes('jpeg') ? 'reference-image.jpg' : 'reference-image.png';
      formData.append('input_reference', blob, fileName);
      return;
    }
  } catch {
    // Fall through to string-based compatibility field.
  }

  formData.append('image', imageSource);
}

async function fetchJsonWithFallback(
  urls: string[],
  init?: RequestInit
): Promise<{ data: any; url: string }> {
  let lastErrorText = '';
  let lastStatus = 0;

  for (const url of urls) {
    const response = await fetch(url, init);
    if (response.ok) {
      return {
        data: await response.json(),
        url,
      };
    }
    lastStatus = response.status;
    lastErrorText = await response.text().catch(() => '');
  }

  throw new Error(`Upstream error: ${lastStatus} ${lastErrorText}`);
}

async function toInlineImagePart(ref: string | { data: string; mimeType?: string }, useSnakeCase = false) {
  if (typeof ref === 'string') {
    const match = ref.match(/^data:(.+?);base64,(.+)$/);
    if (match) {
      return {
        [useSnakeCase ? 'inline_data' : 'inlineData']: useSnakeCase
          ? {
              mime_type: match[1] || 'image/png',
              data: match[2] || '',
            }
          : {
              mimeType: match[1] || 'image/png',
              data: match[2] || '',
            },
      };
    }
    return null;
  }

  const rawData = String(ref.data || '');
  const match = rawData.match(/^data:(.+?);base64,(.+)$/);
  if (match) {
    return {
      [useSnakeCase ? 'inline_data' : 'inlineData']: useSnakeCase
        ? {
            mime_type: match[1] || ref.mimeType || 'image/png',
            data: match[2] || '',
          }
        : {
            mimeType: match[1] || ref.mimeType || 'image/png',
            data: match[2] || '',
          },
    };
  }

  return {
    [useSnakeCase ? 'inline_data' : 'inlineData']: useSnakeCase
      ? {
          mime_type: ref.mimeType || 'image/png',
          data: rawData,
        }
      : {
          mimeType: ref.mimeType || 'image/png',
          data: rawData,
        },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  let fatalRefund:
    | ((errorMessage: string, status?: number, refundReason?: string) => Promise<Response>)
    | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const taskSecret = Deno.env.get('SYSTEM_PROXY_TASK_SECRET') || serviceRoleKey;

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !taskSecret) {
      return json({ success: false, error: 'Supabase env vars are missing' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as ProxyRequest;
    const requestTraceId = String(body.requestId || body.attemptId || '').trim();
    if (requestTraceId) {
      console.log('[secure-model-proxy] request trace', {
        requestTraceId,
        mode: body.mode,
        modelId: body.modelId,
        routeKind: body.userRoute ? 'user-route' : 'system',
      });
    }
    if (!body || !['chat', 'image', 'video', 'audio', 'task_status', 'cancel_task', 'delete_task', 'download_task'].includes(body.mode)) {
      return json({ success: false, error: 'Unsupported mode' }, 400);
    }

    const userApiSecretSeed =
      Deno.env.get('USER_API_ENCRYPTION_SECRET')
      || Deno.env.get('PROFILE_USER_APIS_ENCRYPTION_SECRET')
      || serviceRoleKey;
    const internalRouteSecret =
      Deno.env.get('KK_INTERNAL_ROUTE_PROXY_SECRET')
      || userApiSecretSeed;
    const internalRouteHeader = String(req.headers.get(INTERNAL_ROUTE_SECRET_HEADER) || '').trim();
    const inlineRouteConfig = body.routeConfig
      ? (
        internalRouteSecret
        && internalRouteHeader
        && internalRouteHeader === internalRouteSecret
          ? resolveInlineRouteConfig(body.routeConfig)
          : null
      )
      : null;

    if (body.routeConfig && !inlineRouteConfig) {
      return json({ success: false, error: 'Inline routeConfig is disabled for secure proxy requests' }, 400);
    }

    if (body.mode === 'task_status' || body.mode === 'cancel_task' || body.mode === 'delete_task' || body.mode === 'download_task') {
      if (inlineRouteConfig) {
        const userRoute = inlineRouteConfig;
        const endpointType = resolveUserRouteEndpointType(userRoute);
        const operationName = String(body.taskId || '').trim();
        if (!operationName) {
          return json({ success: false, error: 'taskId is required' }, 400);
        }

        const baseUrl = String(userRoute.baseUrl || '').replace(/\/$/, '');
        const taskResultNotReady = (message = 'Task result is not ready yet') => (
          body.mode === 'download_task'
            ? json({ success: false, error: message }, 409)
            : json({ success: true, status: 'pending', deducted: false, endpointType })
        );

        if (endpointType === 'claude') {
          return json({ success: false, error: 'Claude routes do not support async video tasks' }, 400);
        }

        if (body.mode === 'delete_task') {
          if (endpointType === 'gemini') {
            const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
            const auth = buildGeminiAuth(`${apiBase}/${operationName}`, userRoute);
            await fetch(auth.url, {
              method: 'DELETE',
              headers: auth.headers,
            }).catch(() => undefined);
          } else {
            const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
            const candidateUrls = [
              `${openaiBase}/videos/${operationName}`,
              `${openaiBase}/videos/generations/${operationName}`,
            ];
            for (const candidateUrl of candidateUrls) {
              const auth = buildOpenAICompatAuth(candidateUrl, userRoute);
              const response = await fetch(auth.url, {
                method: 'DELETE',
                headers: auth.headers,
              }).catch(() => null);
              if (response && (response.ok || response.status === 404 || response.status === 409)) {
                break;
              }
            }
          }

          return json({ success: true, status: 'deleted', deducted: false, endpointType });
        }

        if (body.mode === 'cancel_task' && endpointType === 'gemini') {
          const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
          const auth = buildGeminiAuth(`${apiBase}/${operationName}:cancel`, userRoute);
          const cancelResponse = await fetch(auth.url, {
            method: 'POST',
            headers: auth.headers,
          });

          if (!cancelResponse.ok) {
            const errorText = await cancelResponse.text();
            return json({ success: false, error: `Cancel failed: ${cancelResponse.status} ${errorText}` }, 502);
          }

          return json({ success: true, status: 'failed', deducted: false, endpointType });
        }

        if (body.mode === 'cancel_task') {
          const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
          const candidateUrls = [
            `${openaiBase}/videos/${operationName}`,
            `${openaiBase}/videos/generations/${operationName}`,
          ];

          let cancelled = false;
          for (const candidateUrl of candidateUrls) {
            const auth = buildOpenAICompatAuth(candidateUrl, userRoute);
            const response = await fetch(auth.url, {
              method: 'DELETE',
              headers: auth.headers,
            }).catch(() => null);
            if (response && (response.ok || response.status === 404 || response.status === 409)) {
              cancelled = true;
              break;
            }
          }

          if (!cancelled) {
            return json({ success: false, error: 'Cancel failed for upstream video task' }, 502);
          }

          return json({ success: true, status: 'failed', deducted: false, endpointType });
        }

        if (endpointType === 'gemini') {
          const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
          const auth = buildGeminiAuth(`${apiBase}/${operationName}`, userRoute);
          const statusResponse = await fetch(auth.url, {
            headers: auth.headers,
          });

          if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            return json({ success: false, error: `Status polling failed: ${statusResponse.status} ${errorText}` }, 502);
          }

          const statusData = await statusResponse.json();
          if (!statusData.done) {
            return json({ success: true, status: 'pending', deducted: false, endpointType });
          }

          const taskErrorMessage = String(
            statusData?.error?.message ||
            statusData?.response?.error?.message ||
            ''
          ).trim();
          if (taskErrorMessage) {
            return json({ success: true, status: 'failed', deducted: false, endpointType });
          }

          const generatedVideo = extractGeminiGeneratedVideoPayload(statusData);
          if (!generatedVideo) {
            return taskResultNotReady();
          }

          if (generatedVideo.bytesBase64Encoded) {
            return json({
              success: true,
              status: 'success',
              url: `data:${generatedVideo.mimeType};base64,${generatedVideo.bytesBase64Encoded}`,
              deducted: false,
              endpointType,
            });
          }

          try {
            const mediaAuth = buildGeminiAuth(generatedVideo.uri, userRoute);
            const dataUrl = await downloadVideoAsDataUrl(mediaAuth.url, mediaAuth.headers);
            return json({
              success: true,
              status: 'success',
              url: dataUrl,
              deducted: false,
              endpointType,
            });
          } catch {
            return taskResultNotReady('Generated video is still processing');
          }
        }

        const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const candidateUrls = [
          `${openaiBase}/videos/${operationName}`,
          `${openaiBase}/videos/generations/${operationName}`,
        ];

        let status = 'pending';
        let contentUrl = '';
        let sawRetryableContent = false;

        for (const candidateUrl of candidateUrls) {
          const auth = buildOpenAICompatAuth(candidateUrl, userRoute);
          const statusResponse = await fetch(auth.url, {
            headers: auth.headers,
          }).catch(() => null);

          if (!statusResponse) {
            continue;
          }

          if (!statusResponse.ok) {
            const errorText = await statusResponse.text().catch(() => '');
            if (statusResponse.status === 404 || statusResponse.status === 409) {
              continue;
            }
            return json({ success: false, error: `Status polling failed: ${statusResponse.status} ${errorText}` }, 502);
          }

          const statusData = await statusResponse.json().catch(() => ({}));
          status = String(
            statusData?.status
            || statusData?.state
            || statusData?.task_status
            || statusData?.data?.status
            || 'pending'
          ).toLowerCase();
          contentUrl = String(
            statusData?.video_url
            || statusData?.url
            || statusData?.video?.url
            || statusData?.data?.video_url
            || statusData?.data?.output
            || ''
          ).trim();

          if (contentUrl) {
            if (body.mode === 'download_task') {
              return json({ success: true, url: contentUrl, deducted: false, endpointType });
            }

            return json({ success: true, status: 'success', url: contentUrl, deducted: false, endpointType });
          }

          if (['completed', 'succeeded', 'success'].includes(status)) {
            sawRetryableContent = true;
          }
        }

        if (sawRetryableContent) {
          return taskResultNotReady('Generated video is still processing');
        }

        if (['failure', 'failed', 'error'].includes(status)) {
          return json({ success: true, status: 'failed', deducted: false, endpointType });
        }

        if (body.mode === 'download_task') {
          return taskResultNotReady('Task content is not ready yet');
        }

        return json({ success: true, status: 'pending', deducted: false, endpointType });
      }

      const taskPayload = await decodeTaskPayload(String(body.taskId || ''), taskSecret);
      if (!taskPayload) {
        return json({ success: false, error: 'Invalid task id' }, 400);
      }

      if (taskPayload.userId !== user.id) {
        return json({ success: false, error: 'Forbidden task access' }, 403);
      }
      const taskTraceId = String(taskPayload.requestId || taskPayload.attemptId || '').trim();
      const taskTraceResult = {
        requestId: taskPayload.requestId,
        attemptId: taskPayload.attemptId,
      };
      if (taskTraceId) {
        console.log('[secure-model-proxy] task trace', {
          taskTraceId,
          mode: body.mode,
          modelId: taskPayload.modelId,
          routeKind: taskPayload.kind === 'user-video' ? 'user-route' : 'system',
          ledgerId: 'transactionId' in taskPayload ? taskPayload.transactionId : undefined,
        });
      }

      if (taskPayload.kind === 'user-video') {
        const userRoute = await resolveSecureProxyUserRoute(
          serviceClient,
          user.id,
          { kind: 'key-slot', id: taskPayload.userRouteId },
          userApiSecretSeed,
        );
        if (!userRoute) {
          return json({ success: false, error: 'User route not found' }, 404);
        }

        const baseUrl = String(userRoute.baseUrl || '').replace(/\/$/, '');
        const taskResultNotReady = (message = 'Task result is not ready yet') => (
          body.mode === 'download_task'
            ? json({ success: false, error: message }, 409)
            : json({ success: true, status: 'pending', deducted: false, endpointType: taskPayload.endpointType, ...taskTraceResult })
        );

        if (taskPayload.endpointType === 'claude') {
          return json({ success: false, error: 'Claude routes do not support async video tasks' }, 400);
        }

        if (body.mode === 'delete_task') {
          if (taskPayload.endpointType === 'gemini') {
            const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
            const auth = buildGeminiAuth(`${apiBase}/${taskPayload.operationName}`, userRoute);
            await fetch(auth.url, {
              method: 'DELETE',
              headers: auth.headers,
            }).catch(() => undefined);
          } else {
            const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
            const candidateUrls = [
              `${openaiBase}/videos/${taskPayload.operationName}`,
              `${openaiBase}/videos/generations/${taskPayload.operationName}`,
            ];
            for (const candidateUrl of candidateUrls) {
              const auth = buildOpenAICompatAuth(candidateUrl, userRoute);
              const response = await fetch(auth.url, {
                method: 'DELETE',
                headers: auth.headers,
              }).catch(() => null);
              if (response && (response.ok || response.status === 404 || response.status === 409)) {
                break;
              }
            }
          }

          return json({ success: true, status: 'deleted', deducted: false, endpointType: taskPayload.endpointType, ...taskTraceResult });
        }

        if (body.mode === 'cancel_task' && taskPayload.endpointType === 'gemini') {
          const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
          const auth = buildGeminiAuth(`${apiBase}/${taskPayload.operationName}:cancel`, userRoute);
          const cancelResponse = await fetch(auth.url, {
            method: 'POST',
            headers: auth.headers,
          });

          if (!cancelResponse.ok) {
            const errorText = await cancelResponse.text();
            return json({ success: false, error: `Cancel failed: ${cancelResponse.status} ${errorText}` }, 502);
          }

          return json({ success: true, status: 'failed', deducted: false, endpointType: taskPayload.endpointType, ...taskTraceResult });
        }

        if (body.mode === 'cancel_task') {
          const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
          const candidateUrls = [
            `${openaiBase}/videos/${taskPayload.operationName}`,
            `${openaiBase}/videos/generations/${taskPayload.operationName}`,
          ];

          let cancelled = false;
          for (const candidateUrl of candidateUrls) {
            const auth = buildOpenAICompatAuth(candidateUrl, userRoute);
            const response = await fetch(auth.url, {
              method: 'DELETE',
              headers: auth.headers,
            }).catch(() => null);
            if (response && (response.ok || response.status === 404 || response.status === 409)) {
              cancelled = true;
              break;
            }
          }

          if (!cancelled) {
            return json({ success: false, error: 'Cancel failed for upstream video task' }, 502);
          }

          return json({ success: true, status: 'failed', deducted: false, endpointType: taskPayload.endpointType, ...taskTraceResult });
        }

        if (taskPayload.endpointType === 'gemini') {
          const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
          const auth = buildGeminiAuth(`${apiBase}/${taskPayload.operationName}`, userRoute);
          const statusResponse = await fetch(auth.url, {
            headers: auth.headers,
          });

          if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            return json({ success: false, error: `Status polling failed: ${statusResponse.status} ${errorText}` }, 502);
          }

          const statusData = await statusResponse.json();
          if (!statusData.done) {
            return json({ success: true, status: 'pending', deducted: false, endpointType: taskPayload.endpointType, ...taskTraceResult });
          }

          const taskErrorMessage = String(
            statusData?.error?.message ||
            statusData?.response?.error?.message ||
            ''
          ).trim();
          if (taskErrorMessage) {
            return json({ success: true, status: 'failed', deducted: false, endpointType: taskPayload.endpointType, ...taskTraceResult });
          }

          const generatedVideo = extractGeminiGeneratedVideoPayload(statusData);
          if (!generatedVideo) {
            return taskResultNotReady();
          }

          if (generatedVideo.bytesBase64Encoded) {
            return json({
              success: true,
              status: 'success',
              url: `data:${generatedVideo.mimeType};base64,${generatedVideo.bytesBase64Encoded.replace(/\s+/g, '')}`,
              deducted: false,
              endpointType: taskPayload.endpointType,
              ...taskTraceResult,
            });
          }

          if (generatedVideo.uri) {
            const mediaAuth = buildGeminiAuth(generatedVideo.uri, userRoute);
            const base64Video = await downloadVideoAsDataUrl(mediaAuth.url, mediaAuth.headers);
            return json({
              success: true,
              status: 'success',
              url: base64Video,
              deducted: false,
              endpointType: taskPayload.endpointType,
              ...taskTraceResult,
            });
          }

          return taskResultNotReady();
        }

        const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const candidateUrls = [
          `${openaiBase}/videos/${taskPayload.operationName}`,
          `${openaiBase}/videos/generations/${taskPayload.operationName}`,
        ];

        let sawRetryableContent = false;
        for (const candidateUrl of candidateUrls) {
          const auth = buildOpenAICompatAuth(candidateUrl, userRoute);
          const statusResponse = await fetch(auth.url, {
            headers: auth.headers,
          });

          if (!statusResponse.ok) {
            continue;
          }

          const statusData = await statusResponse.json();
          const status = String(statusData?.status || statusData?.data?.status || '').toLowerCase();

          if (!status || ['queued', 'in_progress', 'processing', 'pending', 'submitted', 'running'].includes(status)) {
            return json({ success: true, status: 'pending', deducted: false, endpointType: taskPayload.endpointType });
          }

          if (['success', 'completed', 'succeeded', 'done'].includes(status)) {
            const directUrl = String(
              statusData?.video_url ||
              statusData?.url ||
              statusData?.video?.url ||
              statusData?.data?.video_url ||
              statusData?.data?.output ||
              (Array.isArray(statusData?.data?.outputs) ? statusData.data.outputs[0] : '')
            ).trim();

            if (body.mode !== 'download_task' && directUrl) {
          return json({ success: true, status: 'success', url: directUrl, deducted: false, endpointType: taskPayload.endpointType, ...taskTraceResult });
            }

            const contentCandidates = [
              directUrl,
              String(statusData?.content_url || statusData?.data?.content_url || '').trim(),
            ].filter((value) => value);

            for (const contentUrl of contentCandidates) {
              const mediaAuth = buildOpenAICompatAuth(contentUrl, userRoute);
              const contentResponse = await fetch(mediaAuth.url, {
                headers: mediaAuth.headers,
              });
              if (!contentResponse.ok) continue;
              try {
                const base64Video = await downloadVideoAsDataUrl(mediaAuth.url, mediaAuth.headers);
                return json({
                  success: true,
                  status: 'success',
                  url: base64Video,
                  deducted: false,
                  endpointType: taskPayload.endpointType,
                });
              } catch (_downloadError) {
                sawRetryableContent = true;
                continue;
              }
            }
            if (sawRetryableContent) {
              return taskResultNotReady('Generated video is still processing');
            }
          }

          if (['failure', 'failed', 'error'].includes(status)) {
          return json({ success: true, status: 'failed', deducted: false, endpointType: taskPayload.endpointType, ...taskTraceResult });
          }

          if (body.mode === 'download_task') {
            return taskResultNotReady('Task content is not ready yet');
          }

          return json({ success: true, status: 'pending', deducted: false, endpointType: taskPayload.endpointType });
        }

        if (body.mode === 'download_task') {
          return taskResultNotReady('Task content is not ready yet');
        }

        return json({ success: true, status: 'pending', deducted: false, endpointType: taskPayload.endpointType, ...taskTraceResult });
      }

      const { data: transactionRow, error: transactionError } = await serviceClient
        .from('credit_transactions')
        .select('id, user_id, model_id, status, balance_after')
        .eq('id', taskPayload.transactionId)
        .maybeSingle();

      if (transactionError || !transactionRow) {
        return json({ success: false, error: 'Task transaction not found' }, 404);
      }

      if (String(transactionRow.user_id || '') !== user.id || taskPayload.userId !== user.id) {
        return json({ success: false, error: 'Forbidden task access' }, 403);
      }

      if (String(transactionRow.model_id || '') !== taskPayload.modelId) {
        return json({ success: false, error: 'Task metadata mismatch' }, 400);
      }

      let creditModelQuery = serviceClient
        .from('admin_credit_models')
        .select('base_url, api_keys, endpoint_type, model_id')
        .eq('model_id', taskPayload.modelId)
        .eq('is_active', true);

      if (taskPayload.providerId) {
        creditModelQuery = creditModelQuery.eq('provider_id', taskPayload.providerId);
      }

      const { data: creditModel, error: modelError } = await creditModelQuery
        .order('priority', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (modelError || !creditModel) {
        return json({ success: false, error: 'Model route not found' }, 404);
      }

      const selectedKey = pickRandomKey(creditModel.api_keys || []);
      if (!selectedKey) {
        return json({ success: false, error: 'Provider key is not configured' }, 500);
      }
      const balanceAfter = Number(transactionRow?.balance_after ?? NaN);
      const billingResult = {
        deducted: true,
        ledgerId: taskPayload.transactionId,
        balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : undefined,
        requestId: taskPayload.requestId,
        attemptId: taskPayload.attemptId,
      };

      const refundTaskCredits = async (
        reason: string,
      ): Promise<{ success: boolean; message?: string; balanceAfter?: number }> => {
        const { data: refundRows, error: refundError } = await serviceClient.rpc('refund_credits', {
          p_transaction_id: taskPayload.transactionId,
          p_reason: reason,
        });
        const refundResult = Array.isArray(refundRows) ? refundRows[0] : refundRows;
        return {
          success: !refundError && Boolean(refundResult?.success),
          message: refundError?.message || refundResult?.message,
          balanceAfter: typeof refundResult?.new_balance === 'number' ? refundResult.new_balance : undefined,
        };
      };
      const refundedBillingResult = (refundResult: { success: boolean; message?: string; balanceAfter?: number }) => ({
        ...billingResult,
        refundApplied: refundResult.success,
        refundBalanceAfter: refundResult.balanceAfter,
      });
      const taskResultNotReady = (message = 'Task result is not ready yet') => (
        body.mode === 'download_task'
          ? json({ success: false, error: message }, 409)
          : json({ success: true, status: 'pending', ...billingResult })
      );

      const baseUrl = String(creditModel.base_url || '').replace(/\/$/, '');
      if (body.mode === 'delete_task') {
        await tryDeleteUpstreamVideoTask(taskPayload.endpointType, baseUrl, selectedKey, taskPayload.operationName);
        return json({ success: true, status: 'deleted', ...billingResult });
      }

      if (body.mode === 'cancel_task' && taskPayload.endpointType === 'gemini') {
        const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
        const cancelResponse = await fetch(`${apiBase}/${taskPayload.operationName}:cancel?key=${encodeURIComponent(selectedKey)}`, {
          method: 'POST',
          headers: {
            'x-goog-api-key': selectedKey,
          },
        });

        if (!cancelResponse.ok) {
          const errorText = await cancelResponse.text();
          return json({ success: false, error: `Cancel failed: ${cancelResponse.status} ${errorText}` }, 502);
        }

        const refundResult = await refundTaskCredits('video_generation_cancelled');
        if (!refundResult.success) {
          return json({ success: false, error: `Cancel succeeded but credit rollback failed: ${refundResult.message || 'unknown error'}` }, 500);
        }

        return json({ success: true, status: 'failed', ...refundedBillingResult(refundResult) });
      }

      if (body.mode === 'cancel_task') {
        const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const candidateUrls = [
          `${openaiBase}/videos/${taskPayload.operationName}`,
          `${openaiBase}/videos/generations/${taskPayload.operationName}`,
        ];

        let cancelled = false;
        for (const url of candidateUrls) {
          const response = await fetch(url, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${selectedKey}`,
            },
          });
          if (response.ok || response.status === 404 || response.status === 409) {
            cancelled = true;
            break;
          }
        }

        if (!cancelled) {
          return json({ success: false, error: 'Cancel failed for upstream video task' }, 502);
        }

        const refundResult = await refundTaskCredits('video_generation_cancelled');
        if (!refundResult.success) {
          return json({ success: false, error: `Cancel succeeded but credit rollback failed: ${refundResult.message || 'unknown error'}` }, 500);
        }

        return json({ success: true, status: 'failed', ...refundedBillingResult(refundResult) });
      }

      if (taskPayload.endpointType === 'gemini') {
        const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
        const statusResponse = await fetch(`${apiBase}/${taskPayload.operationName}?key=${encodeURIComponent(selectedKey)}`, {
          headers: {
            'x-goog-api-key': selectedKey,
          },
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          return json({ success: false, error: `Status polling failed: ${statusResponse.status} ${errorText}` }, 502);
        }

        const statusData = await statusResponse.json();
        if (!statusData.done) {
          return json({ success: true, status: 'pending', ...billingResult });
        }

        const taskErrorMessage = String(
          statusData?.error?.message ||
          statusData?.response?.error?.message ||
          ''
        ).trim();
        if (taskErrorMessage) {
          const refundResult = await refundTaskCredits('video_generation_failed');
          if (!refundResult.success) {
            return json({ success: false, error: `Task failed and credit rollback failed: ${refundResult.message || 'unknown error'}` }, 500);
          }
          return json({ success: true, status: 'failed', ...refundedBillingResult(refundResult) });
        }

        const videoUri =
          statusData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
          statusData.response?.generatedSamples?.[0]?.video?.uri ||
          statusData.response?.video?.uri ||
          statusData.response?.result?.video?.uri;
        if (!videoUri) {
          return taskResultNotReady('Task result is still being finalized');
        }

        let dataUrl = '';
        try {
          dataUrl = await downloadVideoAsDataUrl(videoUri, {
            'x-goog-api-key': selectedKey,
          });
        } catch (_downloadError) {
          return taskResultNotReady('Generated video is still processing');
        }
        await tryDeleteUpstreamVideoTask(taskPayload.endpointType, baseUrl, selectedKey, taskPayload.operationName);
        return json({
          success: true,
          status: 'success',
          url: dataUrl,
          ...billingResult,
        });
      }

      const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
      const { data: statusData } = await fetchJsonWithFallback(
        [
          `${openaiBase}/videos/${taskPayload.operationName}`,
          `${openaiBase}/videos/generations/${taskPayload.operationName}`,
        ],
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${selectedKey}`,
          },
        }
      );

      const status = String(statusData?.status || statusData?.data?.status || 'pending').toLowerCase();
      const directUrl =
        statusData?.video_url ||
        statusData?.url ||
        statusData?.video?.url ||
        statusData?.data?.video_url ||
        statusData?.data?.output ||
        (Array.isArray(statusData?.data?.outputs) ? statusData.data.outputs[0] : '');

      if (body.mode === 'download_task' && directUrl) {
        return json({ success: true, status: 'success', url: directUrl, ...billingResult });
      }

      if (['success', 'completed', 'succeed'].includes(status)) {
        if (directUrl) {
          await tryDeleteUpstreamVideoTask(taskPayload.endpointType, baseUrl, selectedKey, taskPayload.operationName);
          return json({ success: true, status: 'success', url: directUrl, ...billingResult });
        }
        const contentCandidates = [
          `${openaiBase}/videos/${taskPayload.operationName}/content`,
          `${openaiBase}/videos/generations/${taskPayload.operationName}/content`,
        ];
        let sawRetryableContent = false;
        for (const contentUrl of contentCandidates) {
          const contentResponse = await fetch(contentUrl, {
            headers: {
              Authorization: `Bearer ${selectedKey}`,
            },
          });
          if (!contentResponse.ok) continue;
          let base64Video = '';
          try {
            base64Video = await downloadVideoAsDataUrl(contentUrl, {
              Authorization: `Bearer ${selectedKey}`,
            });
          } catch (_downloadError) {
            sawRetryableContent = true;
            continue;
          }
          await tryDeleteUpstreamVideoTask(taskPayload.endpointType, baseUrl, selectedKey, taskPayload.operationName);
          return json({
            success: true,
            status: 'success',
            url: base64Video,
            ...billingResult,
          });
        }
        if (sawRetryableContent) {
          return taskResultNotReady('Generated video is still processing');
        }
      }

      if (['failure', 'failed', 'error'].includes(status)) {
        const refundResult = await refundTaskCredits('video_generation_failed');
        if (!refundResult.success) {
          return json({ success: false, error: `Task failed and credit rollback failed: ${refundResult.message || 'unknown error'}` }, 500);
        }
        return json({ success: true, status: 'failed', ...refundedBillingResult(refundResult) });
      }

      if (body.mode === 'download_task') {
        return taskResultNotReady('Task content is not ready yet');
      }

      return json({ success: true, status: 'pending', ...billingResult });
    }

    if (body.userRoute || inlineRouteConfig) {
      const userRoute = inlineRouteConfig || await resolveSecureProxyUserRoute(
        serviceClient,
        user.id,
        body.userRoute!,
        userApiSecretSeed,
      );
      if (!userRoute) {
        return json({ success: false, error: 'User route not found' }, 404);
      }
      const isInlineRouteRequest = Boolean(inlineRouteConfig);

      const modelId = getUpstreamModelId(body.modelId);
      if (!modelId) {
        return json({ success: false, error: 'modelId is required' }, 400);
      }

      const endpointType = resolveUserRouteEndpointType(userRoute);
      const baseUrl = endpointType === 'claude'
        ? normalizeClaudeBaseUrl(userRoute.baseUrl)
        : String(userRoute.baseUrl || '').replace(/\/$/, '');

      let content = '';
      let imageUrls: string[] = [];
      let audioUrl = '';
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      if (body.mode === 'chat' && endpointType === 'gemini') {
        const geminiMessages = (body.messages || []).map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content || '' }],
        }));

        const auth = buildGeminiAuth(`${baseUrl}/v1beta/models/${modelId}:generateContent`, userRoute);
        const geminiResponse = await fetch(auth.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth.headers as Record<string, string>),
          },
          body: JSON.stringify({
            contents: geminiMessages,
            generationConfig: {
              temperature: body.temperature ?? 0.7,
              maxOutputTokens: body.maxTokens ?? 2048,
            },
          }),
        });

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          return json({ success: false, error: `Upstream error: ${geminiResponse.status} ${errorText}` }, 502);
        }

        const result = await geminiResponse.json();
        content = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        usage = {
          promptTokens: Number(result?.usageMetadata?.promptTokenCount || 0),
          completionTokens: Number(result?.usageMetadata?.candidatesTokenCount || 0),
          totalTokens: Number(result?.usageMetadata?.totalTokenCount || 0),
        };
      } else if (body.mode === 'chat' && endpointType === 'claude') {
        const systemMessages = (body.messages || [])
          .filter((message) => message.role === 'system')
          .map((message) => String(message.content || '').trim())
          .filter(Boolean);
        const claudeMessages = (body.messages || [])
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: [{ type: 'text', text: message.content || '' }],
          }));

        const auth = buildClaudeAuth(`${baseUrl}/v1/messages`, userRoute);
        const chatResponse = await fetch(auth.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth.headers as Record<string, string>),
          },
          body: JSON.stringify({
            model: modelId,
            messages: claudeMessages.length > 0
              ? claudeMessages
              : [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
            system: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
            stream: false,
            temperature: body.temperature ?? 0.7,
            max_tokens: body.maxTokens ?? 2048,
          }),
        });

        if (!chatResponse.ok) {
          const errorText = await chatResponse.text();
          return json({ success: false, error: `Upstream error: ${chatResponse.status} ${errorText}` }, 502);
        }

        const result = await chatResponse.json();
        content = Array.isArray(result?.content)
          ? result.content
              .map((block: any) => typeof block?.text === 'string' ? block.text : '')
              .join('')
          : String(result?.content || '');
        usage = {
          promptTokens: Number(result?.usage?.input_tokens || 0),
          completionTokens: Number(result?.usage?.output_tokens || 0),
          totalTokens:
            Number(result?.usage?.input_tokens || 0)
            + Number(result?.usage?.output_tokens || 0),
        };
      } else if (body.mode === 'chat') {
        const chatAuth = buildOpenAICompatAuth(`${baseUrl}/v1/chat/completions`, userRoute);
        const responsesAuth = buildOpenAICompatAuth(`${baseUrl}/v1/responses`, userRoute);
        const chatBody = {
          model: modelId,
          messages: body.messages,
          max_tokens: body.maxTokens ?? 2048,
          temperature: body.temperature ?? 0.7,
          stream: false,
        };
        const responsesBody = buildResponsesRequestBody(body, modelId);
        const preferResponses = modelPrefersResponsesApi(modelId);

        const invokeOpenAIJson = async (
          auth: { url: string; headers: Record<string, string> },
          payload: Record<string, unknown>,
        ): Promise<any> => {
          const response = await fetch(auth.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(auth.headers as Record<string, string>),
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upstream error: ${response.status} ${errorText}`);
          }

          return response.json();
        };

        try {
          const result = preferResponses
            ? await invokeOpenAIJson(responsesAuth, responsesBody)
            : await invokeOpenAIJson(chatAuth, chatBody);
          content = preferResponses ? extractTextFromResponsesPayload(result) : (result?.choices?.[0]?.message?.content || '');
          usage = extractOpenAIUsage(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error || '');
          const statusMatch = message.match(/Upstream error:\s*(\d+)/i);
          const status = statusMatch?.[1] ? Number(statusMatch[1]) : undefined;

          if (!preferResponses && shouldRetryWithResponsesApi(status, message)) {
            try {
              const result = await invokeOpenAIJson(responsesAuth, responsesBody);
              content = extractTextFromResponsesPayload(result);
              usage = extractOpenAIUsage(result);
            } catch (responsesError) {
              const finalMessage = responsesError instanceof Error ? responsesError.message : String(responsesError || '');
              return json({ success: false, error: finalMessage }, 502);
            }
          } else {
            return json({ success: false, error: message }, 502);
          }
        }
      } else if (body.mode === 'image' && endpointType === 'gemini') {
        const parts: any[] = [];
        for (const ref of body.referenceImages || []) {
          const inlinePart = await toInlineImagePart(ref);
          if (inlinePart) parts.push(inlinePart);
        }
        parts.push({ text: body.prompt || '' });

        const generationConfig: Record<string, unknown> = {
          responseModalities: ['IMAGE'],
        };
        const imageConfig: Record<string, unknown> = {};
        const aspectRatio = normalizeAspectRatio(body.aspectRatio);
        if (aspectRatio) {
          imageConfig.aspectRatio = aspectRatio;
        }
        if (body.imageSize) {
          imageConfig.imageSize = normalizeImageSize(body.imageSize);
        }
        if (Object.keys(imageConfig).length) {
          generationConfig.imageConfig = imageConfig;
        }

        const auth = buildGeminiAuth(`${baseUrl}/v1beta/models/${modelId}:generateContent`, userRoute);
        const imageResponse = await fetch(auth.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth.headers as Record<string, string>),
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig,
          }),
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          return json({ success: false, error: `Upstream error: ${imageResponse.status} ${errorText}` }, 502);
        }

        const result = await imageResponse.json();
        const partsList = result?.candidates?.[0]?.content?.parts || [];
        const imagePart = partsList.find((part: any) => part?.inlineData || part?.inline_data);
        const inline = imagePart?.inlineData || imagePart?.inline_data;
        const mimeType = inline?.mimeType || inline?.mime_type || 'image/png';
        const imageData = String(inline?.data || '').replace(/\s+/g, '');

        if (!imageData) {
          return json({ success: false, error: 'No image data returned from upstream' }, 502);
        }

        usage = {
          promptTokens: Number(result?.usageMetadata?.promptTokenCount || 0),
          completionTokens: Number(result?.usageMetadata?.candidatesTokenCount || 0),
          totalTokens: Number(result?.usageMetadata?.totalTokenCount || 0),
        };
        imageUrls = [`data:${mimeType};base64,${imageData}`];
      } else if (body.mode === 'image' && endpointType === 'claude') {
        return json({ success: false, error: 'Claude routes do not support image generation in secure proxy' }, 400);
      } else if (body.mode === 'image') {
        if (isGeminiImageCompatModel(modelId)) {
          const contentParts: Array<Record<string, unknown>> = [{ type: 'text', text: body.prompt || '' }];
          for (const ref of body.referenceImages || []) {
            const dataUrl = toOpenAIImageUrl(ref);
            if (!dataUrl) continue;
            contentParts.push({
              type: 'image_url',
              image_url: { url: dataUrl },
            });
          }

          const requestBody: Record<string, unknown> = {
            model: modelId,
            messages: [
              {
                role: 'user',
                content: contentParts,
              },
            ],
            stream: false,
          };

          const extraBody = buildGoogleImageExtraBody(body);
          if (extraBody) {
            requestBody.extra_body = extraBody;
          }

          const auth = buildOpenAICompatAuth(`${baseUrl}/v1/chat/completions`, userRoute);
          const imageResponse = await fetch(auth.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(auth.headers as Record<string, string>),
            },
            body: JSON.stringify(requestBody),
          });

          if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            return json({ success: false, error: `Upstream error: ${imageResponse.status} ${errorText}` }, 502);
          }

          const result = await imageResponse.json();
          imageUrls = extractImageUrlsFromOpenAICompatPayload(result);

          if (!imageUrls.length) {
            return json({ success: false, error: 'No image data returned from upstream' }, 502);
          }

          usage = {
            promptTokens: Number(result?.usage?.prompt_tokens || 0),
            completionTokens: Number(result?.usage?.completion_tokens || 0),
            totalTokens: Number(result?.usage?.total_tokens || 0),
          };
        } else {
          const auth = buildOpenAICompatAuth(`${baseUrl}/v1/images/generations`, userRoute);
          const imageResponse = await fetch(auth.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(auth.headers as Record<string, string>),
            },
            body: JSON.stringify({
              model: modelId,
              prompt: body.prompt || '',
              n: Math.max(1, Number(body.imageCount || 1)),
              size: mapAspectRatioToOpenAI(normalizeAspectRatio(body.aspectRatio)),
              quality: normalizeImageSize(body.imageSize) === '1K' ? 'standard' : 'hd',
              response_format: 'b64_json',
            }),
          });

          if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            return json({ success: false, error: `Upstream error: ${imageResponse.status} ${errorText}` }, 502);
          }

          const result = await imageResponse.json();
          imageUrls = Array.isArray(result?.data)
            ? result.data
                .map((item: any) => item?.b64_json ? `data:image/png;base64,${String(item.b64_json).replace(/\s+/g, '')}` : null)
                .filter(Boolean)
            : [];

          if (!imageUrls.length) {
            return json({ success: false, error: 'No image data returned from upstream' }, 502);
          }

          usage = {
            promptTokens: Number(result?.usage?.prompt_tokens || 0),
            completionTokens: Number(result?.usage?.completion_tokens || 0),
            totalTokens: Number(result?.usage?.total_tokens || 0),
          };
        }
      } else if (body.mode === 'video' && endpointType === 'gemini') {
        const instance: Record<string, unknown> = {
          prompt: body.prompt || '',
        };
        if (body.imageUrl) {
          const match = String(body.imageUrl).match(/^data:image\/.+;base64,(.+)$/);
          if (match) {
            instance.image = { bytesBase64Encoded: match[1] };
          }
        }
        if (body.imageTailUrl) {
          const match = String(body.imageTailUrl).match(/^data:image\/.+;base64,(.+)$/);
          if (match) {
            instance.lastFrame = { bytesBase64Encoded: match[1] };
          }
        }

        const requestBody: Record<string, unknown> = { instances: [instance] };
        const parameters: Record<string, unknown> = {};
        const aspectRatio = normalizeAspectRatio(body.aspectRatio);
        if (aspectRatio) parameters.aspectRatio = aspectRatio;
        if (body.resolution) parameters.resolution = body.resolution;
        const durationSeconds = getVideoDurationSeconds(body);
        if (durationSeconds) parameters.seconds = durationSeconds;
        if (Object.keys(parameters).length) requestBody.parameters = parameters;

        const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
        const auth = buildGeminiAuth(`${apiBase}/models/${modelId}:predictLongRunning`, userRoute);
        const initResponse = await fetch(auth.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth.headers as Record<string, string>),
          },
          body: JSON.stringify(requestBody),
        });

        if (!initResponse.ok) {
          const errorText = await initResponse.text();
          return json({ success: false, error: `Upstream error: ${initResponse.status} ${errorText}` }, 502);
        }

        const initData = await initResponse.json();
        const operationName = String(initData?.name || '').trim();
        if (!operationName) {
          return json({ success: false, error: 'Missing operation name from upstream' }, 502);
        }

        return json({
          success: true,
          status: 'pending',
          taskId: isInlineRouteRequest
            ? operationName
            : await encodeTaskPayload({
              kind: 'user-video',
              modelId,
              userRouteId: userRoute.routeId,
              endpointType,
              operationName,
              userId: user.id,
              requestId: body.requestId,
              attemptId: body.attemptId,
            }, taskSecret),
          deducted: false,
          endpointType,
        });
      } else if (body.mode === 'video' && endpointType === 'claude') {
        return json({ success: false, error: 'Claude routes do not support video generation in secure proxy' }, 400);
      } else if (body.mode === 'video') {
        const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const durationSeconds = getVideoDurationSeconds(body);

        let submitData: any = null;
        let lastVideoError = '';

        try {
          const formData = new FormData();
          formData.append('model', modelId);
          formData.append('prompt', body.prompt || '');
          if (durationSeconds) {
            formData.append('seconds', String(durationSeconds));
          }
          if (body.imageUrl) {
            await appendOpenAIVideoReference(formData, body.imageUrl);
          }

          const auth = buildOpenAICompatAuth(`${openaiBase}/videos`, userRoute);
          const strictResponse = await fetch(auth.url, {
            method: 'POST',
            headers: auth.headers,
            body: formData,
          });

          if (strictResponse.ok) {
            submitData = await strictResponse.json();
          } else {
            lastVideoError = `Upstream error: ${strictResponse.status} ${await strictResponse.text().catch(() => '')}`;
          }
        } catch (error) {
          lastVideoError = error instanceof Error ? error.message : 'Unknown upstream error';
        }

        if (!submitData) {
          const legacyRequestBody: Record<string, unknown> = {
            model: modelId,
            prompt: body.prompt || '',
          };
          if (durationSeconds) legacyRequestBody.seconds = durationSeconds;
          const aspectRatio = normalizeAspectRatio(body.aspectRatio);
          if (aspectRatio) legacyRequestBody.aspect_ratio = aspectRatio;
          if (body.resolution) legacyRequestBody.resolution = body.resolution;
          if (body.imageUrl) legacyRequestBody.images = [body.imageUrl];
          if (body.imageTailUrl) legacyRequestBody.last_image = body.imageTailUrl;

          try {
            const auth = buildOpenAICompatAuth(`${openaiBase}/videos/generations`, userRoute);
            const legacyResponse = await fetch(auth.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(auth.headers as Record<string, string>),
              },
              body: JSON.stringify(legacyRequestBody),
            });

            if (!legacyResponse.ok) {
              const errorText = await legacyResponse.text().catch(() => '');
              return json({ success: false, error: lastVideoError || `Upstream error: ${legacyResponse.status} ${errorText}` }, 502);
            }

            submitData = await legacyResponse.json();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown upstream error';
            return json({ success: false, error: lastVideoError || message }, 502);
          }
        }

        const taskId = String(submitData?.id || submitData?.task_id || submitData?.data?.task_id || '').trim();
        const taskStatus = String(submitData?.status || submitData?.data?.status || 'pending').toLowerCase();
        const directUrl =
          submitData?.video_url ||
          submitData?.url ||
          submitData?.video?.url ||
          submitData?.data?.video_url ||
          submitData?.data?.output ||
          (Array.isArray(submitData?.data?.outputs) ? submitData.data.outputs[0] : '');

        if (taskId) {
          return json({
            success: true,
            status: ['success', 'completed', 'succeed'].includes(taskStatus) ? 'success' : 'pending',
            taskId: isInlineRouteRequest
              ? taskId
              : await encodeTaskPayload({
                kind: 'user-video',
                modelId,
                userRouteId: userRoute.routeId,
                endpointType: 'openai',
                operationName: taskId,
                userId: user.id,
                requestId: body.requestId,
                attemptId: body.attemptId,
              }, taskSecret),
            url: directUrl || undefined,
            deducted: false,
            endpointType: 'openai',
          });
        }

        if (directUrl) {
          return json({
            success: true,
            status: 'success',
            url: directUrl,
            deducted: false,
            endpointType: 'openai',
          });
        }

        return json({ success: false, error: 'Missing task id from upstream video API' }, 502);
      } else if (body.mode === 'audio' && endpointType === 'gemini') {
        const isLyria = modelId.toLowerCase().includes('lyria');
        const auth = buildGeminiAuth(
          `${baseUrl}/v1beta/models/${modelId}:generateContent`,
          userRoute,
        );

        const audioResponse = await fetch(auth.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth.headers as Record<string, string>),
          },
          body: JSON.stringify(
            isLyria
              ? {
                  contents: [{ role: 'user', parts: [{ text: body.prompt || '' }] }],
                  generationConfig: {
                    responseModalities: ['AUDIO', 'TEXT'],
                  },
                }
              : {
                  contents: [{ role: 'user', parts: [{ text: body.prompt || '' }] }],
                  generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                  },
                },
          ),
        });

        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          return json({ success: false, error: `Upstream error: ${audioResponse.status} ${errorText}` }, 502);
        }

        const result = await audioResponse.json();
        if (isLyria) {
          const audioPart = result?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData || part?.inline_data);
          const inline = audioPart?.inlineData || audioPart?.inline_data;
          const mimeType = inline?.mimeType || inline?.mime_type || 'audio/wav';
          const audioData = String(inline?.data || '').replace(/\s+/g, '');
          if (!audioData) {
            return json({ success: false, error: 'No audio data returned from upstream' }, 502);
          }
          audioUrl = `data:${mimeType};base64,${audioData}`;
        } else {
          const audioPart = result?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData || part?.inline_data);
          const inline = audioPart?.inlineData || audioPart?.inline_data;
          const mimeType = inline?.mimeType || inline?.mime_type || 'audio/wav';
          const audioData = String(inline?.data || '').replace(/\s+/g, '');
          if (!audioData) {
            return json({ success: false, error: 'No audio data returned from upstream' }, 502);
          }
          audioUrl = `data:${mimeType};base64,${audioData}`;
        }
      } else if (body.mode === 'audio') {
        const auth = buildOpenAICompatAuth(`${baseUrl}/v1/audio/generations`, userRoute);
        const audioResponse = await fetch(auth.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth.headers as Record<string, string>),
          },
          body: JSON.stringify({
            model: modelId,
            prompt: body.prompt || '',
          }),
        });

        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          return json({ success: false, error: `Upstream error: ${audioResponse.status} ${errorText}` }, 502);
        }

        const result = await audioResponse.json();
        audioUrl = String(
          result?.audio_url
          || result?.audio?.url
          || result?.data?.audio_url
          || result?.data?.output
          || '',
        ).trim();

        if (!audioUrl) {
          return json({ success: false, error: 'No audio data returned from upstream' }, 502);
        }
      } else {
        return json({ success: false, error: 'Unsupported mode' }, 400);
      }

      if (body.mode === 'chat') {
        return json({
          success: true,
          content,
          usage,
          endpointType,
          deducted: false,
        });
      }

      if (body.mode === 'image') {
        return json({
          success: true,
          urls: imageUrls,
          usage,
          endpointType,
          deducted: false,
        });
      }

      if (body.mode === 'audio') {
        return json({
          success: true,
          url: audioUrl,
          usage,
          endpointType,
          deducted: false,
        });
      }

      return json({ success: false, error: 'Unsupported mode' }, 400);
    }

    const modelRoute = parseSystemModelRoute(body.modelId);
    const modelId = modelRoute.baseModelId;
    if (!modelId) {
      return json({ success: false, error: 'modelId is required' }, 400);
    }

    const requestedImageSize = normalizeImageSize(body.imageSize);

    const { data: creditModels, error: modelError } = await serviceClient
      .from('admin_credit_models')
      .select('base_url, api_keys, endpoint_type, model_id, credit_cost, display_name, provider_id, priority, weight, advanced_enabled, mix_with_same_model, quality_pricing')
      .eq('model_id', modelId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('weight', { ascending: false });

    if (modelError || !creditModels || creditModels.length === 0) {
      return json({ success: false, error: 'Model route not found' }, 404);
    }

    const selectedRoute = pickCreditModelRoute(
      (creditModels || []) as CreditModelRouteRow[],
      requestedImageSize,
      modelRoute.routeIndex,
      modelRoute.routeKey
    );
    if (!selectedRoute) {
      return json({ success: false, error: `当前模型未启用 ${requestedImageSize} 画质` }, 409);
    }

    const creditModel = selectedRoute.route;

    const selectedKey = pickRandomKey(creditModel.api_keys || []);
    if (!selectedKey) {
      return json({ success: false, error: 'Provider key is not configured' }, 500);
    }

    const requiredCredits = Math.max(1, Number(selectedRoute.requiredCredits || creditModel.credit_cost || 1));

    const { data: balanceRow, error: balanceError } = await serviceClient
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentBalance = Number(balanceRow?.balance || 0);
    if (balanceError || currentBalance < requiredCredits) {
      return json({ success: false, error: 'Insufficient credits' }, 402);
    }

    const debitBusinessRefId = String(body.attemptId || body.requestId || `${modelId}:${Date.now()}`).trim();
    const debitIdempotencyKey = String(body.attemptId || body.requestId || crypto.randomUUID()).trim();

    const { data: consumePayload, error: consumeError } = await serviceClient.rpc('api_record_credit_debit_v1', {
      p_user_id: user.id,
      p_ledger_id: crypto.randomUUID(),
      p_business_ref_type: 'generation_task',
      p_business_ref_id: debitBusinessRefId,
      p_credit_amount: requiredCredits,
      p_idempotency_key: debitIdempotencyKey,
      p_model_code: modelId,
    });

    const transactionId = String(consumePayload?.ledger?.ledger_id || '');
    if (consumeError || !consumePayload?.success || !transactionId) {
      return json({ success: false, error: consumePayload?.message || consumeError?.message || 'Credit deduction failed' }, 402);
    }
    const balanceAfter = Number(consumePayload?.ledger?.balance_after ?? currentBalance - requiredCredits);
    const billingResult = {
      deducted: true,
      ledgerId: transactionId,
      balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : undefined,
    };

    const refundCredits = async (reason: string): Promise<boolean> => {
      const { data: refundRows, error: refundError } = await serviceClient.rpc('refund_credits', {
        p_transaction_id: transactionId,
        p_reason: reason,
      });
      const refundResult = Array.isArray(refundRows) ? refundRows[0] : refundRows;
      return !refundError && Boolean(refundResult?.success);
    };

    const failWithRefund = async (errorMessage: string, status = 502, refundReason = 'upstream_request_failed'): Promise<Response> => {
      const refunded = await refundCredits(refundReason);
      if (!refunded) {
        return json({ success: false, error: `${errorMessage} (credit rollback failed)` }, status);
      }
      return json({ success: false, error: errorMessage }, status);
    };
    fatalRefund = failWithRefund;

    const endpointType = creditModel.endpoint_type === 'gemini' ? 'gemini' : 'openai';
    const baseUrl = String(creditModel.base_url || '').replace(/\/$/, '');

    let content = '';
    let imageUrls: string[] = [];
    let audioUrl = '';
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    if (body.mode === 'chat' && endpointType === 'gemini') {
      const useSnakeCase = is12AIGeminiBaseUrl(baseUrl);
      const systemMessages = (body.messages || [])
        .filter((message) => message.role === 'system')
        .map((message) => String(message.content || '').trim())
        .filter(Boolean);
      const geminiMessages = (body.messages || [])
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content || '' }],
        }));
      const payload: Record<string, unknown> = {
        contents: geminiMessages.length > 0
          ? geminiMessages
          : [{ role: 'user', parts: [{ text: 'Hello' }] }],
        generationConfig: {
          temperature: body.temperature ?? 0.7,
          maxOutputTokens: body.maxTokens ?? 2048,
        },
      };
      if (systemMessages.length > 0) {
        payload[useSnakeCase ? 'system_instruction' : 'systemInstruction'] = {
          parts: systemMessages.map((text) => ({ text })),
        };
      }

      const geminiResponse = await fetch(
        `${baseUrl}/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(selectedKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        return await failWithRefund(`Upstream error: ${geminiResponse.status} ${errorText}`);
      }

      const result = await geminiResponse.json();
      content = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      usage = {
        promptTokens: Number(result?.usageMetadata?.promptTokenCount || 0),
        completionTokens: Number(result?.usageMetadata?.candidatesTokenCount || 0),
        totalTokens: Number(result?.usageMetadata?.totalTokenCount || 0),
      };
    } else if (body.mode === 'chat') {
      const chatUrl = `${baseUrl}/v1/chat/completions`;
      const responsesUrl = `${baseUrl}/v1/responses`;
      const chatBody = {
        model: modelId,
        messages: body.messages,
        max_tokens: body.maxTokens ?? 2048,
        temperature: body.temperature ?? 0.7,
        stream: false,
      };
      const responsesBody = buildResponsesRequestBody(body, modelId);
      const preferResponses = modelPrefersResponsesApi(modelId);

      const invokeOpenAIJson = async (url: string, payload: Record<string, unknown>): Promise<any> => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${selectedKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Upstream error: ${response.status} ${errorText}`);
        }

        return response.json();
      };

      try {
        const result = preferResponses
          ? await invokeOpenAIJson(responsesUrl, responsesBody)
          : await invokeOpenAIJson(chatUrl, chatBody);
        content = preferResponses ? extractTextFromResponsesPayload(result) : (result?.choices?.[0]?.message?.content || '');
        usage = extractOpenAIUsage(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || '');
        const statusMatch = message.match(/Upstream error:\s*(\d+)/i);
        const status = statusMatch?.[1] ? Number(statusMatch[1]) : undefined;

        if (!preferResponses && shouldRetryWithResponsesApi(status, message)) {
          try {
            const result = await invokeOpenAIJson(responsesUrl, responsesBody);
            content = extractTextFromResponsesPayload(result);
            usage = extractOpenAIUsage(result);
          } catch (responsesError) {
            const finalMessage = responsesError instanceof Error ? responsesError.message : String(responsesError || '');
            return await failWithRefund(finalMessage);
          }
        } else {
          return await failWithRefund(message);
        }
      }
    } else if (body.mode === 'image' && endpointType === 'gemini') {
      const useSnakeCase = is12AIGeminiBaseUrl(baseUrl);
      const parts: any[] = [];
      for (const ref of body.referenceImages || []) {
        const inlinePart = await toInlineImagePart(ref, useSnakeCase);
        if (inlinePart) parts.push(inlinePart);
      }
      parts.push({ text: body.prompt || '' });

      const generationConfig: Record<string, unknown> = {
        responseModalities: ['IMAGE'],
      };
      const imageConfig: Record<string, unknown> = {};
      const aspectRatio = normalizeAspectRatio(body.aspectRatio);
      if (aspectRatio) {
        imageConfig.aspectRatio = aspectRatio;
      }
      if (body.imageSize) {
        imageConfig.imageSize = normalizeImageSize(body.imageSize);
      }
      if (Object.keys(imageConfig).length) {
        generationConfig.imageConfig = imageConfig;
      }

      const imageResponse = await fetch(
        `${baseUrl}/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(selectedKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig,
          }),
        }
      );

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        return await failWithRefund(`Upstream error: ${imageResponse.status} ${errorText}`);
      }

      const result = await imageResponse.json();
      const partsList = result?.candidates?.[0]?.content?.parts || [];
      const imagePart = partsList.find((part: any) => part?.inlineData || part?.inline_data);
      const inline = imagePart?.inlineData || imagePart?.inline_data;
      const mimeType = inline?.mimeType || inline?.mime_type || 'image/png';
      const imageData = String(inline?.data || '').replace(/\s+/g, '');

      if (!imageData) {
        return await failWithRefund('No image data returned from upstream');
      }

      usage = {
        promptTokens: Number(result?.usageMetadata?.promptTokenCount || 0),
        completionTokens: Number(result?.usageMetadata?.candidatesTokenCount || 0),
        totalTokens: Number(result?.usageMetadata?.totalTokenCount || 0),
      };
      imageUrls = [`data:${mimeType};base64,${imageData}`];
    } else if (body.mode === 'image') {
      if (isGeminiImageCompatModel(modelId)) {
        const contentParts: Array<Record<string, unknown>> = [{ type: 'text', text: body.prompt || '' }];
        for (const ref of body.referenceImages || []) {
          const dataUrl = toOpenAIImageUrl(ref);
          if (!dataUrl) continue;
          contentParts.push({
            type: 'image_url',
            image_url: { url: dataUrl },
          });
        }

        const requestBody: Record<string, unknown> = {
          model: modelId,
          messages: [
            {
              role: 'user',
              content: contentParts,
            },
          ],
          stream: false,
        };

        const extraBody = buildGoogleImageExtraBody(body);
        if (extraBody) {
          requestBody.extra_body = extraBody;
        }

        const imageResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${selectedKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          return await failWithRefund(`Upstream error: ${imageResponse.status} ${errorText}`);
        }

        const result = await imageResponse.json();
        imageUrls = extractImageUrlsFromOpenAICompatPayload(result);

        if (!imageUrls.length) {
          return await failWithRefund('No image data returned from upstream');
        }

        usage = {
          promptTokens: Number(result?.usage?.prompt_tokens || 0),
          completionTokens: Number(result?.usage?.completion_tokens || 0),
          totalTokens: Number(result?.usage?.total_tokens || 0),
        };
      } else {
        const imageResponse = await fetch(`${baseUrl}/v1/images/generations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${selectedKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            prompt: body.prompt || '',
            n: Math.max(1, Number(body.imageCount || 1)),
            size: mapAspectRatioToOpenAI(normalizeAspectRatio(body.aspectRatio)),
            quality: normalizeImageSize(body.imageSize) === '1K' ? 'standard' : 'hd',
            response_format: 'b64_json',
          }),
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          return await failWithRefund(`Upstream error: ${imageResponse.status} ${errorText}`);
        }

        const result = await imageResponse.json();
        imageUrls = Array.isArray(result?.data)
          ? result.data
              .map((item: any) => item?.b64_json ? `data:image/png;base64,${String(item.b64_json).replace(/\s+/g, '')}` : null)
              .filter(Boolean)
          : [];

        if (!imageUrls.length) {
          return await failWithRefund('No image data returned from upstream');
        }

        usage = {
          promptTokens: Number(result?.usage?.prompt_tokens || 0),
          completionTokens: Number(result?.usage?.completion_tokens || 0),
          totalTokens: Number(result?.usage?.total_tokens || 0),
        };
      }
    } else if (body.mode === 'video' && endpointType === 'gemini') {
      const instance: Record<string, unknown> = {
        prompt: body.prompt || '',
      };
      if (body.imageUrl) {
        const match = String(body.imageUrl).match(/^data:image\/.+;base64,(.+)$/);
        if (match) {
          instance.image = { bytesBase64Encoded: match[1] };
        }
      }
      if (body.imageTailUrl) {
        const match = String(body.imageTailUrl).match(/^data:image\/.+;base64,(.+)$/);
        if (match) {
          instance.lastFrame = { bytesBase64Encoded: match[1] };
        }
      }

      const requestBody: Record<string, unknown> = { instances: [instance] };
      const parameters: Record<string, unknown> = {};
      const aspectRatio = normalizeAspectRatio(body.aspectRatio);
      if (aspectRatio) parameters.aspectRatio = aspectRatio;
      if (body.resolution) parameters.resolution = body.resolution;
      const durationSeconds = getVideoDurationSeconds(body);
      if (durationSeconds) parameters.seconds = durationSeconds;
      if (Object.keys(parameters).length) requestBody.parameters = parameters;

      const apiBase = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
      const initResponse = await fetch(
        `${apiBase}/models/${modelId}:predictLongRunning?key=${encodeURIComponent(selectedKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': selectedKey,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        return await failWithRefund(`Upstream error: ${initResponse.status} ${errorText}`);
      }

      const initData = await initResponse.json();
      const operationName = String(initData?.name || '');
      if (!operationName) {
        return await failWithRefund('Missing operation name from upstream');
      }

      return json({
        success: true,
        status: 'pending',
        taskId: await encodeTaskPayload({
          kind: 'video',
          modelId,
          providerId: String(creditModel.provider_id || ''),
          endpointType,
          operationName,
          transactionId,
          userId: user.id,
          requestId: body.requestId,
          attemptId: body.attemptId,
        }, taskSecret),
        endpointType,
        ...billingResult,
      });
    } else if (body.mode === 'video') {
      const openaiBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
      const durationSeconds = getVideoDurationSeconds(body);

      let submitData: any = null;
      let lastVideoError = '';

      try {
        const formData = new FormData();
        formData.append('model', modelId);
        formData.append('prompt', body.prompt || '');
        if (durationSeconds) {
          formData.append('seconds', String(durationSeconds));
        }
        if (body.imageUrl) {
          await appendOpenAIVideoReference(formData, body.imageUrl);
        }

        const strictResponse = await fetch(`${openaiBase}/videos`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${selectedKey}`,
          },
          body: formData,
        });

        if (strictResponse.ok) {
          submitData = await strictResponse.json();
        } else {
          lastVideoError = `Upstream error: ${strictResponse.status} ${await strictResponse.text().catch(() => '')}`;
        }
      } catch (error) {
        lastVideoError = error instanceof Error ? error.message : 'Unknown upstream error';
      }

      if (!submitData) {
        const legacyRequestBody: Record<string, unknown> = {
          model: modelId,
          prompt: body.prompt || '',
        };
        if (durationSeconds) legacyRequestBody.seconds = durationSeconds;
        const aspectRatio = normalizeAspectRatio(body.aspectRatio);
        if (aspectRatio) legacyRequestBody.aspect_ratio = aspectRatio;
        if (body.resolution) legacyRequestBody.resolution = body.resolution;
        if (body.imageUrl) legacyRequestBody.images = [body.imageUrl];
        if (body.imageTailUrl) legacyRequestBody.last_image = body.imageTailUrl;

        try {
          const legacyResponse = await fetch(`${openaiBase}/videos/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${selectedKey}`,
            },
            body: JSON.stringify(legacyRequestBody),
          });

          if (!legacyResponse.ok) {
            const errorText = await legacyResponse.text().catch(() => '');
            return await failWithRefund(lastVideoError || `Upstream error: ${legacyResponse.status} ${errorText}`);
          }

          submitData = await legacyResponse.json();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown upstream error';
          return await failWithRefund(lastVideoError || message);
        }
      }

      const taskId = String(submitData?.id || submitData?.task_id || submitData?.data?.task_id || '');
      const taskStatus = String(submitData?.status || submitData?.data?.status || 'pending').toLowerCase();
      const directUrl =
        submitData?.video_url ||
        submitData?.url ||
        submitData?.video?.url ||
        submitData?.data?.video_url ||
        submitData?.data?.output ||
        (Array.isArray(submitData?.data?.outputs) ? submitData.data.outputs[0] : '');

      if (taskId) {
        return json({
          success: true,
          status: ['success', 'completed', 'succeed'].includes(taskStatus) ? 'success' : 'pending',
          taskId: await encodeTaskPayload({
            kind: 'video',
            modelId,
            providerId: String(creditModel.provider_id || ''),
            endpointType: 'openai',
            operationName: taskId,
            transactionId,
            userId: user.id,
            requestId: body.requestId,
            attemptId: body.attemptId,
          }, taskSecret),
          url: directUrl || undefined,
          endpointType: 'openai',
          ...billingResult,
        });
      }

      if (directUrl) {
        return json({
          success: true,
          status: 'success',
          url: directUrl,
          endpointType: 'openai',
          ...billingResult,
        });
      }

      return await failWithRefund('Missing task id from upstream video API');
    } else if (body.mode === 'audio' && endpointType === 'gemini') {
      const isLyria = modelId.toLowerCase().includes('lyria');
      if (isLyria) {
        const audioResponse = await fetch(
          `${baseUrl}/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(selectedKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: body.prompt || '' }] }],
              generationConfig: {
                responseModalities: ['AUDIO', 'TEXT'],
              },
            }),
          }
        );

        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          return await failWithRefund(`Upstream error: ${audioResponse.status} ${errorText}`);
        }

        const result = await audioResponse.json();
        const audioPart = result?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData || part?.inline_data);
        const inline = audioPart?.inlineData || audioPart?.inline_data;
        const mimeType = inline?.mimeType || inline?.mime_type || 'audio/wav';
        const audioData = String(inline?.data || '').replace(/\s+/g, '');
        if (!audioData) {
          return await failWithRefund('No audio data returned from upstream');
        }
        audioUrl = `data:${mimeType};base64,${audioData}`;
      } else {
        const audioResponse = await fetch(
          `${baseUrl}/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(selectedKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: body.prompt || '' }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
              },
            }),
          }
        );

        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          return await failWithRefund(`Upstream error: ${audioResponse.status} ${errorText}`);
        }

        const result = await audioResponse.json();
        const audioPart = result?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData || part?.inline_data);
        const inline = audioPart?.inlineData || audioPart?.inline_data;
        const mimeType = inline?.mimeType || inline?.mime_type || 'audio/wav';
        const audioData = String(inline?.data || '').replace(/\s+/g, '');
        if (!audioData) {
          return await failWithRefund('No audio data returned from upstream');
        }
        audioUrl = `data:${mimeType};base64,${audioData}`;
      }
    } else {
      return await failWithRefund('Unsupported mode', 400, 'unsupported_mode');
    }

    if (body.mode === 'chat') {
      return json({
        success: true,
        content,
        usage,
        endpointType,
        ...billingResult,
      });
    }

    if (body.mode === 'image') {
      return json({
        success: true,
        urls: imageUrls,
        usage,
        endpointType,
        ...billingResult,
      });
    }

    if (body.mode === 'audio') {
      return json({
        success: true,
        url: audioUrl,
        usage,
        endpointType,
        ...billingResult,
      });
    }

    return json({ success: false, error: 'Unsupported mode' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (fatalRefund) {
      return await fatalRefund(message, 500, 'proxy_internal_error');
    }
    return json({ success: false, error: message }, 500);
  }
});
