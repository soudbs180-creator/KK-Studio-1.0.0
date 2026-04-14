import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ProxyRequest = {
  mode: 'chat' | 'image' | 'video' | 'audio' | 'task_status' | 'cancel_task' | 'delete_task' | 'download_task';
  routeId?: string;
  localTaskId?: string;
  taskId?: string;
  userRoute?: {
    kind: 'key-slot';
    id: string;
  };
  modelId?: string;
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

function shouldForceHeaderAuthForProvider(provider: string, baseUrl: string): boolean {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const normalizedBaseUrl = String(baseUrl || '').trim().toLowerCase();
  return normalizedProvider === 'gpt-best'
    || normalizedProvider === 'gptbest'
    || normalizedBaseUrl.includes('gpt-best')
    || normalizedBaseUrl.includes('gptbest');
}

type EncodedUserTask = {
  kind: 'user-video';
  userId: string;
  routeId: string;
  modelId: string;
  endpointType: 'openai' | 'gemini' | 'claude';
  operationName: string;
};

type SignedUserTask = EncodedUserTask & {
  sig: string;
};

const USER_API_SECRET_ARRAY_FIELDS = {
  slots: ['key'],
  providers: ['apiKey'],
  entries: ['key'],
} as const;

const LOCAL_PROXY_TASK_PREFIX = 'local_proxy:';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  return Promise.all(value.map(async (item) => {
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

function normalizeClaudeBaseUrl(baseUrl: string): string {
  return String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/i, '');
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
  routeId: string,
  secretSeed: string,
): Promise<ResolvedUserRoute | null> {
  const normalizedRouteId = String(routeId || '').trim();
  if (!normalizedRouteId) {
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
    slots.find((item) => String(item.id || '').trim() === normalizedRouteId)
    || providers.find((item) => String(item.id || '').trim() === normalizedRouteId)
    || entries.find((item) => String(item.id || '').trim() === normalizedRouteId);

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
  const authMethod = shouldForceHeaderAuthForProvider(provider, baseUrl)
    ? 'header'
    : matchedRecord.authMethod === 'query'
      ? 'query'
      : 'header';

  return {
    routeId: normalizedRouteId,
    provider,
    providerName: String(matchedRecord.name || provider).trim() || provider,
    baseUrl,
    apiKey,
    format,
    authMethod,
    headerName: typeof matchedRecord.headerName === 'string' ? matchedRecord.headerName.trim() : undefined,
    compatibilityMode:
      matchedRecord.compatibilityMode === 'chat'
        ? 'chat'
        : matchedRecord.compatibilityMode === 'standard'
          ? 'standard'
          : undefined,
  };
}

function getBaseModelId(modelId: string): string {
  return String(modelId || '').split('@')[0]?.trim() || '';
}

function getUpstreamModelId(modelId: string): string {
  return getBaseModelId(modelId).split('|')[0]?.trim() || '';
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

function normalizeImageSize(imageSize?: string): string {
  const raw = String(imageSize || '1K').toUpperCase();
  if (raw.includes('4K')) return '4K';
  if (raw.includes('2K')) return '2K';
  if (raw.includes('0.5K') || raw.includes('512')) return '0.5K';
  return '1K';
}

function normalizeAspectRatio(aspectRatio?: string): string | undefined {
  const value = String(aspectRatio || '').trim();
  if (!value || value.toLowerCase() === 'auto') return undefined;
  return value;
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
  return (lower.includes('gemini') && lower.includes('image'))
    || lower.includes('nano-banana')
    || lower.includes('banana');
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

async function downloadVideoAsDataUrl(videoUrl: string, headers: HeadersInit): Promise<string> {
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

  return `data:video/mp4;base64,${btoa(binary)}`;
}

async function signTaskPayload(secret: string, payload: EncodedUserTask): Promise<string> {
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

async function encodeTaskPayload(payload: EncodedUserTask, secret: string): Promise<string> {
  const sig = await signTaskPayload(secret, payload);
  return `${LOCAL_PROXY_TASK_PREFIX}${btoa(JSON.stringify({ ...payload, sig } satisfies SignedUserTask))}`;
}

async function decodeTaskPayload(taskId: string, secret: string): Promise<EncodedUserTask | null> {
  if (!taskId.startsWith(LOCAL_PROXY_TASK_PREFIX)) return null;

  try {
    const raw = atob(taskId.slice(LOCAL_PROXY_TASK_PREFIX.length));
    const parsed = JSON.parse(raw) as Partial<SignedUserTask>;
    if (
      !parsed
      || parsed.kind !== 'user-video'
      || typeof parsed.userId !== 'string'
      || typeof parsed.routeId !== 'string'
      || typeof parsed.modelId !== 'string'
      || typeof parsed.endpointType !== 'string'
      || typeof parsed.operationName !== 'string'
      || typeof parsed.sig !== 'string'
    ) {
      return null;
    }

    const payload: EncodedUserTask = {
      kind: 'user-video',
      userId: parsed.userId,
      routeId: parsed.routeId,
      modelId: parsed.modelId,
      endpointType: parsed.endpointType === 'gemini'
        ? 'gemini'
        : parsed.endpointType === 'claude'
          ? 'claude'
          : 'openai',
      operationName: parsed.operationName,
    };
    const expectedSig = await signTaskPayload(secret, payload);
    if (expectedSig !== parsed.sig) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function handleTaskOperation(
  route: ResolvedUserRoute,
  body: ProxyRequest,
  taskPayload: EncodedUserTask,
): Promise<Response> {
  const endpointType = taskPayload.endpointType;
  const operationName = taskPayload.operationName;
  const baseUrl = endpointType === 'claude'
    ? normalizeClaudeBaseUrl(route.baseUrl)
    : String(route.baseUrl || '').replace(/\/$/, '');
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
      const auth = buildGeminiAuth(`${apiBase}/${operationName}`, route);
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
        const auth = buildOpenAICompatAuth(candidateUrl, route);
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
    const auth = buildGeminiAuth(`${apiBase}/${operationName}:cancel`, route);
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
      const auth = buildOpenAICompatAuth(candidateUrl, route);
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
    const auth = buildGeminiAuth(`${apiBase}/${operationName}`, route);
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
      statusData?.error?.message
      || statusData?.response?.error?.message
      || '',
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
      const mediaAuth = buildGeminiAuth(generatedVideo.uri, route);
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
  let sawRetryableContent = false;

  for (const candidateUrl of candidateUrls) {
    const auth = buildOpenAICompatAuth(candidateUrl, route);
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
      || 'pending',
    ).toLowerCase();
    const contentUrl = String(
      statusData?.video_url
      || statusData?.url
      || statusData?.video?.url
      || statusData?.data?.video_url
      || statusData?.data?.output
      || '',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const taskSecret = Deno.env.get('SYSTEM_PROXY_TASK_SECRET') || serviceRoleKey;
    const userApiSecretSeed =
      Deno.env.get('USER_API_ENCRYPTION_SECRET')
      || Deno.env.get('PROFILE_USER_APIS_ENCRYPTION_SECRET')
      || serviceRoleKey;

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !taskSecret || !userApiSecretSeed) {
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
    if (!body || !['chat', 'image', 'video', 'audio', 'task_status', 'cancel_task', 'delete_task', 'download_task'].includes(body.mode)) {
      return json({ success: false, error: 'Unsupported mode' }, 400);
    }

    if (body.mode === 'task_status' || body.mode === 'cancel_task' || body.mode === 'delete_task' || body.mode === 'download_task') {
      const taskPayload = await decodeTaskPayload(
        String(body.localTaskId || body.taskId || '').trim(),
        taskSecret,
      );
      if (!taskPayload) {
        return json({ success: false, error: 'Invalid task id' }, 400);
      }

      if (taskPayload.userId !== user.id) {
        return json({ success: false, error: 'Forbidden task access' }, 403);
      }

      const route = await resolveSecureProxyUserRoute(
        serviceClient,
        user.id,
        taskPayload.routeId,
        userApiSecretSeed,
      );
      if (!route) {
        return json({ success: false, error: 'User route not found' }, 404);
      }

      return await handleTaskOperation(route, body, taskPayload);
    }

    const routeId = String(body.routeId || body.userRoute?.id || '').trim();
    if (!routeId) {
      return json({ success: false, error: 'routeId is required' }, 400);
    }

    const route = await resolveSecureProxyUserRoute(
      serviceClient,
      user.id,
      routeId,
      userApiSecretSeed,
    );
    if (!route) {
      return json({ success: false, error: 'User route not found' }, 404);
    }

    const modelId = getUpstreamModelId(String(body.modelId || ''));
    if (!modelId) {
      return json({ success: false, error: 'modelId is required' }, 400);
    }

    const endpointType = resolveUserRouteEndpointType(route);
    const baseUrl = endpointType === 'claude'
      ? normalizeClaudeBaseUrl(route.baseUrl)
      : String(route.baseUrl || '').replace(/\/$/, '');

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

      const auth = buildGeminiAuth(`${baseUrl}/v1beta/models/${modelId}:generateContent`, route);
      const geminiResponse = await fetch(auth.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth.headers as Record<string, string>),
        },
        body: JSON.stringify(payload),
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

      const auth = buildClaudeAuth(`${baseUrl}/v1/messages`, route);
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
      const chatAuth = buildOpenAICompatAuth(`${baseUrl}/v1/chat/completions`, route);
      const responsesAuth = buildOpenAICompatAuth(`${baseUrl}/v1/responses`, route);
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

      const auth = buildGeminiAuth(`${baseUrl}/v1beta/models/${modelId}:generateContent`, route);
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

        const auth = buildOpenAICompatAuth(`${baseUrl}/v1/chat/completions`, route);
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
        const auth = buildOpenAICompatAuth(`${baseUrl}/v1/images/generations`, route);
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
      const auth = buildGeminiAuth(`${apiBase}/models/${modelId}:predictLongRunning`, route);
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
        taskId: await encodeTaskPayload({
          kind: 'user-video',
          userId: user.id,
          routeId: route.routeId,
          modelId,
          endpointType,
          operationName,
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

        const auth = buildOpenAICompatAuth(`${openaiBase}/videos`, route);
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
          const auth = buildOpenAICompatAuth(`${openaiBase}/videos/generations`, route);
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
          taskId: await encodeTaskPayload({
            kind: 'user-video',
            userId: user.id,
            routeId: route.routeId,
            modelId,
            endpointType: 'openai',
            operationName: taskId,
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
        route,
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
      const audioPart = result?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData || part?.inline_data);
      const inline = audioPart?.inlineData || audioPart?.inline_data;
      const mimeType = inline?.mimeType || inline?.mime_type || 'audio/wav';
      const audioData = String(inline?.data || '').replace(/\s+/g, '');
      if (!audioData) {
        return json({ success: false, error: 'No audio data returned from upstream' }, 502);
      }
      audioUrl = `data:${mimeType};base64,${audioData}`;
    } else if (body.mode === 'audio') {
      const auth = buildOpenAICompatAuth(`${baseUrl}/v1/audio/generations`, route);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ success: false, error: message }, 500);
  }
});
