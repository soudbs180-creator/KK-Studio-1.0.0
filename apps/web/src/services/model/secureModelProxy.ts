import { tempUserService } from '../auth/tempUserService';
import {
  getLatestAuthSessionChange,
  requestAuthSessionInvalidation,
  waitForAuthSessionChange,
} from '../auth/authSessionEvents';
import { getPreferredKkApiAccessToken, refreshPreferredKkApiAccessToken } from '../api/authAccessToken';
import { type StandardizedProxyRequest} from './ProxyRequestBuilder';
import { kkWebApiClient, resolveKkApiModelProxyBaseUrl } from '../api/kkApiClient';
import { compressReferenceImagesIfNeeded } from '../../utils/imageUtils';
import { kernelFetch } from '../http/requestKernel';
import { keyManager } from '../auth/keyManager';
import { normalizeWuyinImageSize, normalizeWuyinAspectRatio, normalizeWuyinReferenceImage } from '../llm/openAICompatibleWuyinRoute';

const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';
const REDACTED_SECRET_PREFIX = '__kk_redacted__:';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEncryptedSecretEnvelope(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.__kkUserApiSecret === true) return true;

  const keys = Object.keys(value).map((key) => key.toLowerCase());
  const hasCipher = keys.some((key) => key === 'ciphertext' || key === 'cipher_text' || key === 'cipher');
  const hasIv = keys.includes('iv') || keys.includes('nonce');
  return hasCipher && hasIv;
}

function isEncryptedSecretJsonString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    return isEncryptedSecretEnvelope(JSON.parse(trimmed));
  } catch {
    return false;
  }
}

function normalizeUserApiSecretForTransport(value: unknown): string {
  if (value == null || isEncryptedSecretEnvelope(value) || typeof value !== 'string') {
    return '';
  }

  const token = value.trim();
  if (
    !token
    || token === READONLY_SECRET_PLACEHOLDER
    || token.startsWith(REDACTED_SECRET_PREFIX)
    || token === '[object Object]'
    || /^\[object\s+[^\]]+\]$/.test(token)
    || /[\u2022\u25cf\u25e6\u2219\u2027\u2026]/.test(token)
    || token.includes('...')
    || isEncryptedSecretJsonString(token)
  ) {
    return '';
  }

  return token;
}

export interface SecureProxyChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SecureProxyUserRoute {
  kind: 'key-slot';
  id: string;
}

export function buildSecureProxyUserRouteFromSlotId(slotId: string): SecureProxyUserRoute {
  return {
    kind: 'key-slot',
    id: String(slotId || '').trim(),
  };
}

function getWuyinRouteDetails(routeId: string) {
  if (!routeId) return null;
  try {
    const provider = keyManager.getProvider(routeId) || keyManager.getProviderForKeySlot(routeId);
    if (provider) {
      const isWuyin = provider.name === '速创 API' || /wuyinkeji/i.test(provider.baseUrl || '');
      if (isWuyin && provider.apiKey) {
        const apiKey = normalizeUserApiSecretForTransport(provider.apiKey);
        // 简体中文注释：若 API 密钥已经被脱敏，则说明前端无真实物理 Key，此时不满足前端直连条件，应返回 null 触发代理路由
        if (!apiKey) {
          return null;
        }
        return {
          apiKey,
          baseUrl: provider.baseUrl || 'https://api.wuyinkeji.com'
        };
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function checkIsWuyinClientDirect(routeIdOrTaskId: string): boolean {
  if (!routeIdOrTaskId) return false;
  const routeId = routeIdOrTaskId.startsWith('local_proxy:')
    ? decodeURIComponent(routeIdOrTaskId.slice('local_proxy:'.length).split(':')[0] || '')
    : routeIdOrTaskId;
  const route = getWuyinRouteDetails(routeId);
  return route !== null;
}

function extractUrlsFromPayload(val: any): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (item: any) => {
    if (!item) return;
    if (typeof item === 'string') {
      const matches = item.match(/https?:\/\/[^\s"'<>]+/g) || [];
      for (const u of matches) {
        if (!seen.has(u)) {
          seen.add(u);
          out.push(u);
        }
      }
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (typeof item === 'object') {
      const keys = ['result', 'results', 'url', 'urls', 'image_url', 'video_url', 'audio_url', 'output', 'outputs', 'data'];
      keys.forEach(k => visit(item[k]));
      for (const k in item) {
        if (Object.prototype.hasOwnProperty.call(item, k) && !keys.includes(k)) {
          visit(item[k]);
        }
      }
    }
  };
  visit(val);
  return out;
}

export async function callWuyinClientDirectImage(
  payload: SecureProxyImageRequest & { routeId: string }
): Promise<SecureProxyImageResponse> {
  const route = getWuyinRouteDetails(payload.routeId);
  if (!route) throw new Error('Wuyin route details missing');
  
  const apiKey = route.apiKey;
  const baseUrl = route.baseUrl.replace(/\/+$/, '');
  
  const modelId = payload.modelId.split('@')[0];
  const endpointPath = `/api/async/${modelId}`;
  const targetUrl = `${baseUrl}${endpointPath}`;
  
  const size = normalizeWuyinImageSize(payload.imageSize);
  const aspectRatio = normalizeWuyinAspectRatio(payload.aspectRatio);
  const body: Record<string, any> = {
    prompt: payload.prompt,
    size,
    aspectRatio
  };
  
  const rawRefs = payload.referenceImages || [];
  if (rawRefs.length > 0) {
    body.urls = rawRefs.map((r, index) => normalizeWuyinReferenceImage(r, index).value);
  }
  
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP 错误 ${response.status}`);
  }
  
  const payloadData = await response.json();
  if (payloadData.code !== 200 && payloadData.code !== 0) {
    throw new Error(payloadData.msg || JSON.stringify(payloadData));
  }
  
  const providerTaskId = payloadData.data?.id;
  if (!providerTaskId) {
    throw new Error('速创 API 响应未返回有效的任务 ID');
  }
  
  const localTaskId = `local_proxy:${encodeURIComponent(payload.routeId)}:${encodeURIComponent(providerTaskId)}`;
  
  return {
    urls: [],
    taskId: localTaskId,
    status: 'pending',
    endpointType: 'wuyin-async-image'
  };
}

export async function callWuyinClientDirectVideo(
  payload: SecureProxyVideoRequest & { routeId: string }
): Promise<SecureProxyVideoResponse> {
  const route = getWuyinRouteDetails(payload.routeId);
  if (!route) throw new Error('Wuyin route details missing');
  
  const apiKey = route.apiKey;
  const baseUrl = route.baseUrl.replace(/\/+$/, '');
  
  const modelId = payload.modelId.split('@')[0];
  const endpointPath = `/api/async/${modelId}`;
  const targetUrl = `${baseUrl}${endpointPath}`;
  
  const body: Record<string, any> = {
    prompt: payload.prompt || '',
    size: payload.resolution || '1280x720',
    duration: String(payload.duration || '10'),
    aspectRatio: payload.aspectRatio || '16:9'
  };
  
  const images: string[] = [];
  if (payload.imageUrl) images.push(payload.imageUrl);
  if (payload.imageTailUrl) images.push(payload.imageTailUrl);
  if (images.length > 0) {
    body.images = images.join(',');
  }
  
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP 错误 ${response.status}`);
  }
  
  const payloadData = await response.json();
  if (payloadData.code !== 200 && payloadData.code !== 0) {
    throw new Error(payloadData.msg || JSON.stringify(payloadData));
  }
  
  const providerTaskId = payloadData.data?.id;
  if (!providerTaskId) {
    throw new Error('速创 API 响应未返回有效的任务 ID');
  }
  
  const localTaskId = `local_proxy:${encodeURIComponent(payload.routeId)}:${encodeURIComponent(providerTaskId)}`;
  
  return {
    taskId: localTaskId,
    status: 'pending',
    endpointType: 'openai'
  };
}

export async function checkWuyinClientDirectTaskStatus(
  localTaskId: string
): Promise<SecureProxyTaskStatusResponse> {
  const parts = localTaskId.slice('local_proxy:'.length).split(':');
  const routeId = decodeURIComponent(parts[0] || '');
  const providerTaskId = decodeURIComponent(parts[1] || '');
  
  const route = getWuyinRouteDetails(routeId);
  if (!route) throw new Error('Wuyin route details missing');
  
  const apiKey = route.apiKey;
  const baseUrl = route.baseUrl.replace(/\/+$/, '');
  
  const detailPath = '/api/async/detail';
  let detailUrl = `${baseUrl}${detailPath}`;
  
  const parsed = new URL(detailUrl);
  parsed.searchParams.set('id', providerTaskId);
  parsed.searchParams.set('key', apiKey);
  detailUrl = parsed.toString();
  
  const response = await fetch(detailUrl, {
    method: 'GET',
    headers: {
      'Authorization': apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP 错误 ${response.status}`);
  }
  
  const payloadData = await response.json();
  if (payloadData.code !== 200 && payloadData.code !== 0) {
    throw new Error(payloadData.msg || JSON.stringify(payloadData));
  }
  
  const rawStatus = payloadData.data?.status;
  let status: 'success' | 'failed' | 'processing' = 'processing';
  
  // 2=success, 3=failed, 0 or 1 = processing
  const n = Number(rawStatus);
  if (n === 2) status = 'success';
  else if (n === 3) status = 'failed';
  
  let urls: string[] = [];
  if (status === 'success') {
    urls = extractUrlsFromPayload(payloadData);
    if (urls.length === 0) {
      status = 'processing';
    }
  }
  
  const message = status === 'failed' ? (payloadData.data?.message || payloadData.msg || 'Wuyin task failed.') : undefined;
  
  return {
    status: status === 'processing' ? 'pending' : status,
    url: urls[0],
    urls: urls.length > 0 ? urls : undefined,
    message,
    error: status === 'failed' ? message : undefined
  };
}

export interface SecureProxyChatRequest {
  modelId: string;
  messages: SecureProxyChatMessage[];
  requestId?: string;
  attemptId?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  userRoute?: SecureProxyUserRoute;
}

export interface SecureProxyBillingMetadata {
  deducted?: boolean;
  ledgerId?: string;
  balanceAfter?: number;
  refundApplied?: boolean;
  refundBalanceAfter?: number;
}

export interface SecureProxyChatResponse extends SecureProxyBillingMetadata {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  endpointType?: 'openai' | 'gemini' | 'claude';
}

export interface SecureProxyImageRequest {
  modelId: string;
  prompt: string;
  requestId?: string;
  attemptId?: string;
  creditRouteSpecId?: string;
  creditRouteUnitId?: string;
  aspectRatio?: string;
  imageSize?: string;
  imageCount?: number;
  referenceImages?: Array<string | { data: string; mimeType: string }>;
  userRoute?: SecureProxyUserRoute;
}

export interface SecureProxyImageResponse extends SecureProxyBillingMetadata {
  urls: string[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
  taskId?: string;
  status?: 'pending' | 'success' | 'failed';
  requestId?: string;
  attemptId?: string;
  endpointType?: 'openai' | 'gemini' | 'claude' | 'wuyin-async-image' | 'wuyin-async-video' | 'wuyin-async-audio';
  execTime?: number;
}

export interface SecureProxyVideoRequest {
  modelId: string;
  prompt: string;
  requestId?: string;
  attemptId?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  videoDuration?: string;
  imageUrl?: string;
  imageTailUrl?: string;
  userRoute?: SecureProxyUserRoute;
}

export interface SecureProxyVideoResponse extends SecureProxyBillingMetadata {
  taskId: string;
  status: 'pending' | 'success' | 'failed';
  url?: string;
  message?: string;
  error?: string;
  endpointType?: 'openai' | 'gemini' | 'claude';
  execTime?: number;
}

export interface SecureProxyAudioRequest {
  modelId: string;
  prompt: string;
  requestId?: string;
  attemptId?: string;
  userRoute?: SecureProxyUserRoute;
}

export interface SecureProxyAudioResponse extends SecureProxyBillingMetadata {
  url: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
  endpointType?: 'openai' | 'gemini' | 'claude';
}

export interface SecureProxyTaskStatusResponse extends SecureProxyBillingMetadata {
  status: 'pending' | 'success' | 'failed';
  url?: string;
  urls?: string[];
  message?: string;
  error?: string;
  requestId?: string;
  attemptId?: string;
  execTime?: number;
}

export const SECURE_PROXY_SESSION_REAUTH_CODE = 'SESSION_REAUTH_REQUIRED';
export const SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE = 'GUEST_MODE_UNAVAILABLE';
export const LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE = 'LOCAL_USER_ROUTE_PROXY_UNAVAILABLE';
export const LOCAL_USER_ROUTE_NOT_FOUND_CODE = 'USER_ROUTE_NOT_FOUND';
export const LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR_CODE = 'LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR';
export const LOCAL_USER_ROUTE_SECRET_REQUIRED_CODE = 'USER_ROUTE_SECRET_REQUIRED';
export const LOCAL_USER_ROUTE_INVALID_REQUEST_CODE = 'INVALID_REQUEST';
export const LOCAL_USER_ROUTE_UNSUPPORTED_ROUTE_CODE = 'UNSUPPORTED_ROUTE';
export const SECURE_PROXY_SESSION_REAUTH_MESSAGE = '\u767b\u5f55\u4f1a\u8bdd\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u540e\u518d\u8bd5\u3002';
export const SECURE_PROXY_GUEST_MODE_MESSAGE = '\u6e38\u5ba2\u6a21\u5f0f\u6682\u4e0d\u652f\u6301\u5f53\u524d\u53d7\u4fdd\u62a4\u4ee3\u7406\uff0c\u8bf7\u5148\u767b\u5f55\u6b63\u5f0f\u8d26\u53f7\u3002';

export type SecureProxyRouteKind = 'system' | 'user-route';

type CloudSessionResolution = {
  accessToken: string;
};

type InvalidJwtLocalSessionState = 'no-session' | 'invalid' | 'valid' | 'unknown';

type ResolveCloudSessionOptions = {
  forceRefresh?: boolean;
  routeKind?: SecureProxyRouteKind;
};

type SecureProxyBoundaryErrorCode =
  | typeof SECURE_PROXY_SESSION_REAUTH_CODE
  | typeof SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE
  | typeof LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE
  | typeof LOCAL_USER_ROUTE_NOT_FOUND_CODE
  | typeof LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR_CODE
  | typeof LOCAL_USER_ROUTE_SECRET_REQUIRED_CODE
  | typeof LOCAL_USER_ROUTE_INVALID_REQUEST_CODE
  | typeof LOCAL_USER_ROUTE_UNSUPPORTED_ROUTE_CODE;

type SecureProxyBoundaryError = Error & {
  code?: SecureProxyBoundaryErrorCode;
  status?: number;
  responseBody?: string;
  feature?: string;
};

let refreshCloudSessionPromise: Promise<CloudSessionResolution | null> | null = null;
let invalidateCloudSessionPromise: Promise<void> | null = null;
let lastCloudSessionInvalidationWarningAt = 0;

const TRANSIENT_PROXY_RETRY_STATUS_CODES = new Set([502, 503, 504]);
const MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS = 2;
const TRANSIENT_PROXY_RETRY_BASE_DELAY_MS = 250;

function getLocalUserRouteApiEndpoint(useVpsFallback = false): string {
  const baseUrl = useVpsFallback
    ? "https://172-245-156-16.sslip.io"
    : resolveKkApiModelProxyBaseUrl();
  return `${baseUrl.replace(/\/+$/, '')}/api/v1/model-proxy/user`;
}

function getLocalSystemProxyEndpoint(useVpsFallback = false): string {
  const baseUrl = useVpsFallback
    ? "https://172-245-156-16.sslip.io"
    : resolveKkApiModelProxyBaseUrl();
  return `${baseUrl.replace(/\/+$/, '')}/api/v1/model-proxy/system`;
}

function shouldUseLocalSystemProxy(): boolean {
  return true;
}

function shouldUseLocalUserRouteApi(): boolean {
  return true;
}

function isRetryableProxyFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === 'AbortError') {
    return false;
  }

  const message = String(error.message || '').trim().toLowerCase();
  return (
    error.name === 'TypeError'
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
  );
}

function shouldRetryProxyResponse(response?: Response): boolean {
  return Boolean(response && TRANSIENT_PROXY_RETRY_STATUS_CODES.has(response.status));
}

function waitForProxyRetry(attempt: number): Promise<void> {
  const delayMs = Math.max(0, TRANSIENT_PROXY_RETRY_BASE_DELAY_MS * attempt);
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

async function fetchWithTransientProxyRetry(
  url: string,
  init: RequestInit,
  proxyName: string,
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!shouldRetryProxyResponse(response) || attempt >= MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS) {
        return response;
      }

      console.warn(
        `[secureModelProxy] ${proxyName} returned ${response.status}; retrying (${attempt}/${MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS})`,
      );
    } catch (error) {
      if (!isRetryableProxyFetchError(error) || attempt >= MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS) {
        throw error;
      }

      console.warn(
        `[secureModelProxy] ${proxyName} request failed; retrying (${attempt}/${MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS})`,
        error,
      );
    }

    await waitForProxyRetry(attempt);
  }

  throw new Error(`${proxyName} request failed after retrying.`);
}

function buildSecureProxyBoundaryError(
  message: string,
  meta?: {
    code?: SecureProxyBoundaryErrorCode;
    status?: number;
    responseBody?: string;
    feature?: string;
  }
): SecureProxyBoundaryError {
  const normalized = new Error(message) as SecureProxyBoundaryError;
  if (meta?.code) {
    normalized.code = meta.code;
  }
  if (meta?.status !== undefined) {
    normalized.status = meta.status;
  }
  if (meta?.responseBody) {
    normalized.responseBody = meta.responseBody;
  }
  if (meta?.feature) {
    normalized.feature = meta.feature;
  }
  return normalized;
}

export function isSecureProxySessionReauthError(error: unknown): error is SecureProxyBoundaryError {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (error as SecureProxyBoundaryError).code === SECURE_PROXY_SESSION_REAUTH_CODE
  );
}

export function isSecureProxyGuestModeError(error: unknown): error is SecureProxyBoundaryError {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (error as SecureProxyBoundaryError).code === SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE
  );
}

export function isLocalUserRouteProxyFallbackError(error: unknown): error is SecureProxyBoundaryError {
  const boundaryCode = error && typeof error === 'object'
    ? (error as SecureProxyBoundaryError).code
    : undefined;

  if (
    boundaryCode === LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR_CODE
    || boundaryCode === LOCAL_USER_ROUTE_SECRET_REQUIRED_CODE
    || boundaryCode === LOCAL_USER_ROUTE_INVALID_REQUEST_CODE
    || boundaryCode === LOCAL_USER_ROUTE_UNSUPPORTED_ROUTE_CODE
  ) {
    return false;
  }

  return Boolean(
    error
    && typeof error === 'object'
    && (
      (error as SecureProxyBoundaryError).code === LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE
      || (error as SecureProxyBoundaryError).code === LOCAL_USER_ROUTE_NOT_FOUND_CODE
      || (((error as SecureProxyBoundaryError).status || 0) >= 500)
    )
  );
}

function buildSessionReauthError(
  feature: string,
  responseBody = '',
  routeKind: SecureProxyRouteKind = 'user-route',
  localSessionState: InvalidJwtLocalSessionState = 'unknown',
): SecureProxyBoundaryError {
  const message = routeKind === 'user-route'
    ? (
      isInvalidJwtResponse(responseBody, null)
        ? getSecureProxyUserRouteInvalidJwtDiagnosticMessage(responseBody, localSessionState)
        : getSecureProxyUserRouteAuthRejectedMessage(responseBody)
    )
    : getSecureProxySessionReauthMessage(routeKind);

  return buildSecureProxyBoundaryError(message, {
    code: SECURE_PROXY_SESSION_REAUTH_CODE,
    status: 401,
    responseBody,
    feature,
  });
}

function buildCloudSessionError(
  feature: string,
  routeKind: SecureProxyRouteKind = 'user-route',
): SecureProxyBoundaryError {
  if (tempUserService.getCachedTempUser()) {
    return buildSecureProxyBoundaryError(getSecureProxyGuestModeMessage(routeKind), {
      code: SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE,
      status: 403,
      feature,
    });
  }

  return buildSecureProxyBoundaryError(getSecureProxySessionReauthMessage(routeKind), {
    code: SECURE_PROXY_SESSION_REAUTH_CODE,
    status: 401,
    feature,
  });
}

export function getSecureProxySessionReauthMessage(routeKind: SecureProxyRouteKind): string {
  if (routeKind === 'user-route') {
    return '\u767b\u5f55\u4f1a\u8bdd\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u540e\u7ee7\u7eed\u4f7f\u7528\u4f60\u914d\u7f6e\u7684 API \u8def\u7531\u3002';
  }

  return '\u767b\u5f55\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u540e\u7ee7\u7eed\u4f7f\u7528\u7cfb\u7edf\u79ef\u5206\u6a21\u578b\u3002';
}

export function getSecureProxyGuestModeMessage(routeKind: SecureProxyRouteKind): string {
  if (routeKind === 'user-route') {
    return '\u6e38\u5ba2\u6a21\u5f0f\u4e0d\u652f\u6301\u4e91\u540c\u6b65\u548c\u4f60\u914d\u7f6e\u7684 API \u8def\u7531\uff0c\u8bf7\u5148\u767b\u5f55\u6b63\u5f0f\u8d26\u53f7\u3002';
  }

  return '\u6e38\u5ba2\u6a21\u5f0f\u4e0d\u652f\u6301\u4e91\u540c\u6b65\u548c\u7cfb\u7edf\u79ef\u5206\u6a21\u578b\uff0c\u8bf7\u5148\u767b\u5f55\u6b63\u5f0f\u8d26\u53f7\u3002';
}

function extractProxyErrorMessage(responseBody = ''): string {
  const rawBody = String(responseBody || '').trim();
  if (!rawBody) {
    return '';
  }

  try {
    const parsed = JSON.parse(rawBody) as {
      error?: string | { message?: string };
      message?: string;
    };
    const parsedError = parsed?.error;

    if (typeof parsedError === 'string' && parsedError.trim()) {
      return parsedError.trim();
    }

    if (
      parsedError
      && typeof parsedError === 'object'
      && typeof parsedError.message === 'string'
      && parsedError.message.trim()
    ) {
      return parsedError.message.trim();
    }

    if (typeof parsed?.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Ignore JSON parse failures and fall back to the raw body below.
  }

  return rawBody;
}

function getSecureProxyUserRouteAuthRejectedMessage(responseBody = ''): string {
  const upstreamMessage = extractProxyErrorMessage(responseBody);
  if (
    upstreamMessage
    && !/unauthorized/i.test(upstreamMessage)
    && !/invalid jwt/i.test(upstreamMessage)
  ) {
    return `\u7528\u6237 API \u8def\u7531\u9274\u6743\u5931\u8d25\uff1a${upstreamMessage}`;
  }

  return '\u5f53\u524d\u767b\u5f55\u6001\u672a\u88ab\u672c\u5730 KK API user-route \u63a5\u53e3\u63a5\u53d7\u3002\u8bf7\u5148\u91cd\u65b0\u767b\u5f55\u540e\u91cd\u8bd5\uff1b\u5982\u679c\u91cd\u65b0\u767b\u5f55\u540e\u4ecd\u7136\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u672c\u5730 API \u670d\u52a1\u4e0e\u8ba4\u8bc1\u4ee4\u724c\u662f\u5426\u4e00\u81f4\u3002';
}

function getSecureProxyUserRouteInvalidJwtDiagnosticMessage(
  responseBody = '',
  localSessionState: InvalidJwtLocalSessionState = 'unknown',
): string {
  const upstreamMessage = extractProxyErrorMessage(responseBody);

  if (
    upstreamMessage
    && !/unauthorized/i.test(upstreamMessage)
    && !/invalid jwt/i.test(upstreamMessage)
  ) {
    return `\u7528\u6237 API \u8def\u7531\u9274\u6743\u5931\u8d25\uff1a${upstreamMessage}`;
  }

  if (localSessionState === 'valid') {
    return '\u5f53\u524d\u672c\u5730 KK \u4f1a\u8bdd\u5728\u672c\u5730\u4ecd\u7136\u6709\u6548\uff0c\u4f46\u672c\u5730 KK API user-route \u63a5\u53e3\u8fd4\u56de\u4e86 Invalid JWT\u3002\u8fd9\u901a\u5e38\u610f\u5473\u7740\u672c\u5730 API \u8ba4\u8bc1\u72b6\u6001\u4e0e\u5f53\u524d\u524d\u7aef\u4ee4\u724c\u4e0d\u4e00\u81f4\u3002';
  }

  if (localSessionState === 'invalid' || localSessionState === 'no-session') {
    return '\u5f53\u524d\u672c\u5730 KK \u767b\u5f55\u6001\u4e5f\u5df2\u65e0\u6548\uff0c\u5e76\u4e14\u672c\u5730 KK API user-route \u63a5\u53e3\u8fd4\u56de\u4e86 Invalid JWT\u3002\u8bf7\u91cd\u65b0\u767b\u5f55\u540e\u518d\u8bd5\u3002';
  }

  return getSecureProxyUserRouteAuthRejectedMessage(responseBody);
}

async function restoreCloudSessionFromAuthEvent(
  _feature: string,
  _routeKind: SecureProxyRouteKind,
  _forceRefresh = false,
): Promise<CloudSessionResolution | null> {
  const latestAuthSession = getLatestAuthSessionChange();
  if (!latestAuthSession?.hasSession || latestAuthSession.isTempUser) {
    return null;
  }

  const cachedAccessToken = String(latestAuthSession.accessToken || '').trim();
  return cachedAccessToken
    ? { accessToken: cachedAccessToken }
    : null;
}

async function resolveStoredCloudAccessToken(forceRefresh = false): Promise<string | null> {
  const token = forceRefresh
    ? await refreshPreferredKkApiAccessToken()
    : await getPreferredKkApiAccessToken();

  return String(token || '').trim() || null;
}

async function resolveRuntimeAccessTokenFromAuthEvent(
  forceRefresh = false,
): Promise<string | null> {
  const latestAuthSession = getLatestAuthSessionChange();
  if (latestAuthSession?.hasSession && !latestAuthSession.isTempUser) {
    const authEventAccessToken = String(latestAuthSession.accessToken || '').trim();
    if (authEventAccessToken) {
      return authEventAccessToken;
    }
  }

  if (!forceRefresh) {
    return null;
  }

  const sessionEvent = await waitForAuthSessionChange(
    (detail) => detail.hasSession && !detail.isTempUser && Boolean(String(detail.accessToken || '').trim()),
    1500,
  );

  return String(sessionEvent?.accessToken || '').trim() || null;
}

async function resolvePreferredRuntimeAccessToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    const refreshedAccessToken = await resolveStoredCloudAccessToken(true);
    if (refreshedAccessToken) {
      return refreshedAccessToken;
    }

    return await resolveRuntimeAccessTokenFromAuthEvent(true);
  }

  const authEventAccessToken = await resolveRuntimeAccessTokenFromAuthEvent(false);
  if (authEventAccessToken) {
    return authEventAccessToken;
  }

  return await resolveStoredCloudAccessToken(false);
}

type CloudSessionSnapshot = {
  access_token?: string;
  expires_at?: number;
} | null;

async function readCloudSession(_feature: string): Promise<CloudSessionSnapshot> {
  const accessToken = await resolvePreferredRuntimeAccessToken(false);
  if (!accessToken) {
    return null;
  }

  return {
    access_token: accessToken,
  };
}

function hasUsableCloudSession(session: Awaited<ReturnType<typeof readCloudSession>>): session is NonNullable<Awaited<ReturnType<typeof readCloudSession>>> {
  const expiresAtMs = typeof session?.expires_at === 'number'
    ? session.expires_at * 1000
    : 0;

  const isUsable = Boolean(
    session?.access_token
    && (expiresAtMs <= 0 || expiresAtMs > Date.now() + 60_000),
  );

  if (!isUsable && session?.access_token) {
    const remainingMs = expiresAtMs - Date.now();
    console.warn(`[secureModelProxy] Session not usable. Expires in ${remainingMs}ms, expires_at: ${session.expires_at}`);
  }

  return isUsable;
}

async function recoverCloudSession(feature: string): Promise<CloudSessionResolution | null> {
  if (refreshCloudSessionPromise) {
    return refreshCloudSessionPromise;
  }

  refreshCloudSessionPromise = (async () => {
    const refreshedAccessToken = await refreshPreferredKkApiAccessToken();
    if (refreshedAccessToken) {
      return {
        accessToken: refreshedAccessToken,
      };
    }

    const sessionEvent = await waitForAuthSessionChange(
      (detail) => detail.hasSession && !detail.isTempUser,
      1500,
    );

    if (sessionEvent?.accessToken) {
      return {
        accessToken: sessionEvent.accessToken,
      };
    }

    try {
      const recoveredSession = await readCloudSession(feature);
      if (recoveredSession?.access_token) {
        return {
          accessToken: recoveredSession.access_token,
        };
      }
    } catch (error) {
      console.warn('[secureModelProxy] Failed to re-read session after refresh attempt:', error);
    }

    return null;
  })().finally(() => {
    refreshCloudSessionPromise = null;
  });

  return refreshCloudSessionPromise;
}

async function resolveCloudSession(
  feature: string,
  options: ResolveCloudSessionOptions = {},
): Promise<CloudSessionResolution> {
  const shouldForceRefresh = options.forceRefresh === true;
  const routeKind = options.routeKind || 'user-route';
  const preferredRuntimeAccessToken = await resolvePreferredRuntimeAccessToken(shouldForceRefresh);
  if (preferredRuntimeAccessToken) {
    return {
      accessToken: preferredRuntimeAccessToken,
    };
  }

  let session: Awaited<ReturnType<typeof readCloudSession>> | null = null;
  let sessionReadError: unknown = null;

  try {
    session = await readCloudSession(feature);
  } catch (error) {
    sessionReadError = error;
    console.warn('[secureModelProxy] Failed to read current cloud session, falling back to token recovery:', error);
  }

  if (!shouldForceRefresh && hasUsableCloudSession(session)) {
    return {
      accessToken: session.access_token!,
    };
  }

  const resolvedSession = await recoverCloudSession(feature);
  if (resolvedSession?.accessToken) {
    return resolvedSession;
  }

  const restoredAuthEventSession = await restoreCloudSessionFromAuthEvent(
    feature,
    routeKind,
    shouldForceRefresh,
  );
  if (restoredAuthEventSession?.accessToken) {
    return restoredAuthEventSession;
  }

  if (!shouldForceRefresh) {
    const storedAccessToken = await resolveStoredCloudAccessToken(false);
    if (storedAccessToken) {
      return {
        accessToken: storedAccessToken,
      };
    }
  }

  if (!shouldForceRefresh && session?.access_token) {
    return {
      accessToken: session.access_token,
    };
  }

  if (!resolvedSession?.accessToken) {
    // secure-model-proxy is backed by the KK API runtime session and must
    // never rely on stale browser cache alone. If we fail to recover a valid
    // access token here, surface a reauth error without force-clearing the
    // local runtime session state immediately.
    const reason = sessionReadError instanceof Error
      ? `Unable to recover KK API session for ${feature}: ${sessionReadError.message}`
      : `Unable to recover KK API session for ${feature}`;
    await invalidateCloudSession(reason);
    throw buildCloudSessionError(feature, routeKind);
  }

  return resolvedSession;
}

async function invalidateCloudSession(reason: string): Promise<void> {
  if (invalidateCloudSessionPromise) {
    return invalidateCloudSessionPromise;
  }

  invalidateCloudSessionPromise = (async () => {
    const now = Date.now();
    if (now - lastCloudSessionInvalidationWarningAt >= 10_000) {
      // Preserve the browser's local session cache here. The KK API can briefly
      // return transient 401s during refresh races or local runtime hiccups,
      // and force-signing the user out on the first miss is too disruptive.
      console.warn(
        '[secureModelProxy] Reauth is required, but preserving the local KK runtime session cache to avoid an unexpected sign-out:',
        reason,
      );
      lastCloudSessionInvalidationWarningAt = now;
    }
  })().finally(() => {
    invalidateCloudSessionPromise = null;
  });

  return invalidateCloudSessionPromise;
}

type LocalUserRouteProxyHttpResult = {
  response?: Response;
  payload: any;
  responseBody: string;
};

type LocalSystemProxyHttpResult = {
  response?: Response;
  payload: any;
  responseBody: string;
};

function extractSecureProxyBillingMetadata(data: any): SecureProxyBillingMetadata {
  return {
    deducted: Boolean(data.deducted),
    ledgerId: typeof data.ledgerId === 'string' ? data.ledgerId : undefined,
    balanceAfter: typeof data.balanceAfter === 'number' ? data.balanceAfter : undefined,
    refundApplied: data.refundApplied === true,
    refundBalanceAfter: typeof data.refundBalanceAfter === 'number' ? data.refundBalanceAfter : undefined,
  };
}

function isInvalidJwtResponse(responseBody: string, payload: any): boolean {
  const joinedMessage = [
    payload?.error?.message,
    payload?.message,
    responseBody,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join('\n');

  return joinedMessage.includes('invalid jwt');
}

async function inspectLocalSessionForInvalidJwt(): Promise<InvalidJwtLocalSessionState> {
  const latestAuthSession = getLatestAuthSessionChange();
  if (!latestAuthSession?.hasSession || latestAuthSession.isTempUser) {
    return 'no-session';
  }

  const accessToken = String(latestAuthSession.accessToken || '').trim();
  if (!accessToken) {
    return 'no-session';
  }

  try {
    const profileResponse = await kkWebApiClient.getProfile({ accessToken });
    if (profileResponse.success) {
      return 'valid';
    }

    const errorCode = String(profileResponse.error?.code || '').trim().toUpperCase();
    return errorCode === SECURE_PROXY_SESSION_REAUTH_CODE || errorCode === 'AUTH_REQUIRED'
      ? 'invalid'
      : 'unknown';
  } catch (error) {
    console.warn('[secureModelProxy] Failed to verify current KK API profile after Invalid JWT:', error);
    return 'unknown';
  }
}

async function handleInvalidJwtSessionState(feature: string): Promise<InvalidJwtLocalSessionState> {
  const localSessionState = await inspectLocalSessionForInvalidJwt();
  console.warn(
    `[secureModelProxy] Local KK session state after Invalid JWT during ${feature}: ${localSessionState}`,
  );

  if (localSessionState === 'invalid' || localSessionState === 'no-session') {
    requestAuthSessionInvalidation(`${feature}: local-user-route-api returned Invalid JWT`);
  }

  return localSessionState;
}

async function invokeLocalUserRouteApiHttp(
  accessToken: string,
  body: Record<string, unknown>,
  useVpsFallback = false,
): Promise<LocalUserRouteProxyHttpResult> {
  const response = await fetchWithTransientProxyRetry(getLocalUserRouteApiEndpoint(useVpsFallback), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  }, useVpsFallback ? 'vps-user-route-api' : 'local-user-route-api');

  let payload: any = null;
  let responseBody = '';
  try {
    responseBody = await response.clone().text();
    payload = responseBody ? JSON.parse(responseBody) : null;
  } catch {
    payload = null;
  }

  return {
    response,
    payload,
    responseBody,
  };
}

async function invokeLocalSystemProxyHttp(
  accessToken: string,
  body: Record<string, unknown>,
  useVpsFallback = false,
): Promise<LocalSystemProxyHttpResult> {
  const response = await fetchWithTransientProxyRetry(getLocalSystemProxyEndpoint(useVpsFallback), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  }, useVpsFallback ? 'vps-system-proxy' : 'local-system-proxy');

  let payload: any = null;
  let responseBody = '';
  try {
    responseBody = await response.clone().text();
    payload = responseBody ? JSON.parse(responseBody) : null;
  } catch {
    payload = null;
  }

  return {
    response,
    payload,
    responseBody,
  };
}

async function invokeLocalUserRouteProxy(
  feature: string,
  body: Record<string, unknown>,
): Promise<any> {
  if (!shouldUseLocalUserRouteApi()) {
    throw buildSecureProxyBoundaryError('Local user-route proxy is disabled.', {
      code: LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE,
      status: 503,
      feature,
    });
  }

  const session = await resolveCloudSession(feature, { routeKind: 'user-route' });
  let activeAccessToken = session.accessToken;
  let result: LocalUserRouteProxyHttpResult;
  try {
    result = await invokeLocalUserRouteApiHttp(activeAccessToken, body, false);
    if (result.response && !result.response.ok && result.response.status !== 401 && result.response.status !== 403) {
      throw new Error(`Local proxy returned error status: ${result.response.status}`);
    }
  } catch (error: any) {
    console.warn('[secureModelProxy] 本地 API 连接失败，尝试通过 VPS 兜底...', error);
    try {
      result = await invokeLocalUserRouteApiHttp(activeAccessToken, body, true);
    } catch (vpsError: any) {
      throw buildSecureProxyBoundaryError(
        isRetryableProxyFetchError(vpsError)
          ? `VPS user-route proxy is temporarily unavailable. Please try again.`
          : vpsError?.message || `Failed to reach the VPS user-route proxy.`,
        {
          code: LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE,
          status: 502,
          feature,
        },
      );
    }
  }

  const shouldRetryWithFreshSession = (
    result.response?.status === 401
    || isInvalidJwtResponse(result.responseBody, result.payload)
  );

  if (shouldRetryWithFreshSession) {
    console.warn(
      `[secureModelProxy] Local user-route proxy returned 401/Invalid JWT, forcing session refresh before retry`,
    );
    try {
      const recoveredSession = await resolveCloudSession(feature, { forceRefresh: true, routeKind: 'user-route' });
      if (recoveredSession.accessToken) {
        console.log('[secureModelProxy] Session refreshed successfully, retrying request...');
        activeAccessToken = recoveredSession.accessToken;
        result = await invokeLocalUserRouteApiHttp(activeAccessToken, body);
      } else {
        console.warn('[secureModelProxy] Failed to recover session - no access token');
      }
    } catch (error) {
      console.warn('[secureModelProxy] Cloud session recovery failed after user-route proxy 401:', error);
      if (isSecureProxySessionReauthError(error)) {
        if (isInvalidJwtResponse(result.responseBody, result.payload)) {
          const localSessionState = await handleInvalidJwtSessionState(feature);
          throw buildSessionReauthError(feature, result.responseBody, 'user-route', localSessionState);
        }
        throw buildSessionReauthError(feature, result.responseBody, 'user-route');
      }
      if (isSecureProxyGuestModeError(error)) {
        throw error;
      }
    }
  }

  if (!result.response?.ok || !result.payload?.success) {
    const errorCode = String(result.payload?.error?.code || '').trim();
    let errorMessage =
      result.payload?.error?.message
      || result.responseBody
      || `User-route proxy failed with status ${result.response?.status ?? 500}`;



    if (
      result.response?.status === 401
      || isInvalidJwtResponse(result.responseBody, result.payload)
    ) {
      if (isInvalidJwtResponse(result.responseBody, result.payload)) {
        const localSessionState = await handleInvalidJwtSessionState(feature);
        throw buildSessionReauthError(feature, result.responseBody, 'user-route', localSessionState);
      }
      // Keep the local session only when the browser's own KK API auth state can
      // still validate it. If the local client also rejects the JWT, request a
      // clean local sign-out via AuthContext to break the stale-token loop.
      throw buildSessionReauthError(feature, result.responseBody, 'user-route');
    }

    throw buildSecureProxyBoundaryError(errorMessage, {
      code: errorCode === LOCAL_USER_ROUTE_NOT_FOUND_CODE
        ? LOCAL_USER_ROUTE_NOT_FOUND_CODE
        : errorCode === LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR_CODE
          ? LOCAL_USER_ROUTE_PROXY_UPSTREAM_ERROR_CODE
          : errorCode === LOCAL_USER_ROUTE_SECRET_REQUIRED_CODE
            ? LOCAL_USER_ROUTE_SECRET_REQUIRED_CODE
            : errorCode === LOCAL_USER_ROUTE_INVALID_REQUEST_CODE
              ? LOCAL_USER_ROUTE_INVALID_REQUEST_CODE
              : errorCode === LOCAL_USER_ROUTE_UNSUPPORTED_ROUTE_CODE
                ? LOCAL_USER_ROUTE_UNSUPPORTED_ROUTE_CODE
                : LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE,
      status: result.response?.status,
      responseBody: result.responseBody,
      feature,
    });
  }

  return result.payload.data;
}

async function invokeLocalSystemProxy(
  feature: string,
  body: Record<string, unknown>,
): Promise<any> {
  if (!shouldUseLocalSystemProxy()) {
    throw buildSecureProxyBoundaryError('Local system proxy is disabled.', {
      status: 503,
      feature,
    });
  }

  const invokeWithToken = async (accessToken: string, useVps = false): Promise<LocalSystemProxyHttpResult> => {
    try {
      return await invokeLocalSystemProxyHttp(accessToken, body, useVps);
    } catch (error) {
      if (isRetryableProxyFetchError(error)) {
        throw buildSecureProxyBoundaryError('Local system proxy is temporarily unavailable. Please try again.', {
          status: 502,
          feature,
        });
      }

      throw error;
    }
  };

  const session = await resolveCloudSession(feature, { routeKind: 'system' });
  let isUsingVps = false;
  let result;
  try {
    result = await invokeWithToken(session.accessToken, false);
  } catch (error) {
    console.warn('[secureModelProxy] 本地系统代理不可用，尝试使用 VPS 兜底...', error);
    try {
      result = await invokeWithToken(session.accessToken, true);
      isUsingVps = true;
    } catch (vpsError) {
      throw error;
    }
  }

  if (result.response?.status === 401 || isInvalidJwtResponse(result.responseBody, result.payload)) {
    try {
      console.warn('[secureModelProxy] Local system proxy returned 401/Invalid JWT, forcing session refresh before retry');
      const recoveredSession = await resolveCloudSession(feature, { forceRefresh: true, routeKind: 'system' });
      if (recoveredSession.accessToken) {
        result = await invokeWithToken(recoveredSession.accessToken, isUsingVps);
      }
    } catch (error) {
      console.warn('[secureModelProxy] Cloud session recovery failed after local system proxy 401:', error);
      if (isSecureProxySessionReauthError(error) || isSecureProxyGuestModeError(error)) {
        throw error;
      }
    }
  }

  if (!result.response?.ok || !result.payload?.success) {
    let errorMessage =
      result.payload?.error?.message
      || result.responseBody
      || `Local system proxy failed with status ${result.response?.status ?? 500}`;



    if (
      result.response?.status === 401
      || isInvalidJwtResponse(result.responseBody, result.payload)
    ) {
      await invalidateCloudSession(`local-system-proxy returned 401 during ${feature}`);
      throw buildSessionReauthError(feature, result.responseBody, 'system');
    }

    throw buildSecureProxyBoundaryError(errorMessage, {
      status: result.response?.status,
      responseBody: result.responseBody,
      feature,
    });
  }

  return result.payload.data;
}

export async function cancelSecureSystemProxyTask(taskId: string): Promise<boolean> {
  if (String(taskId || '').startsWith('local_proxy:')) {
    await invokeLocalUserRouteProxy('task cancel', {
      mode: 'cancel_task',
      localTaskId: taskId,
    });

    return true;
  }

  await invokeLocalSystemProxy('task cancel', {
    mode: 'cancel_task',
    taskId,
  });

  return true;
}

export async function deleteSecureSystemProxyTask(taskId: string): Promise<boolean> {
  if (String(taskId || '').startsWith('local_proxy:')) {
    await invokeLocalUserRouteProxy('task delete', {
      mode: 'delete_task',
      localTaskId: taskId,
    });

    return true;
  }

  await invokeLocalSystemProxy('task delete', {
    mode: 'delete_task',
    taskId,
  });

  return true;
}

export async function downloadSecureSystemProxyTaskContent(taskId: string): Promise<string> {
  if (String(taskId || '').startsWith('local_proxy:')) {
    const data = await invokeLocalUserRouteProxy('task download', {
      mode: 'download_task',
      localTaskId: taskId,
    });

    return String(data.url || '');
  }

  const data = await invokeLocalSystemProxy('task download', {
    mode: 'download_task',
    taskId,
  });

  return String(data.url || '');
}

function normalizeMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
      .join('\n');
  }
  if (content == null) return '';
  return String(content);
}

export async function callSecureSystemProxyChat(
  payload: SecureProxyChatRequest
): Promise<SecureProxyChatResponse> {
  if (payload.userRoute?.kind === 'key-slot' && payload.userRoute.id) {
    return callLocalUserRouteProxyChat({
      ...payload,
      routeId: payload.userRoute.id,
    });
  }

  const normalizedMessages = payload.messages.map((message) => ({
    role: message.role,
    content: normalizeMessageContent(message.content),
  }));

  const data = await invokeLocalSystemProxy('chat generation', {
    mode: 'chat',
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    messages: normalizedMessages,
    temperature: payload.temperature,
    maxTokens: payload.maxTokens,
    stream: payload.stream ?? false,
  });

  return {
    content: data.content || '',
    ...extractSecureProxyBillingMetadata(data),
    usage: data.usage,
    endpointType: data.endpointType,
  };
}

export async function callLocalUserRouteProxyChat(
  payload: SecureProxyChatRequest & { routeId: string },
): Promise<SecureProxyChatResponse> {
  const normalizedMessages = payload.messages.map((message) => ({
    role: message.role,
    content: normalizeMessageContent(message.content),
  }));

  const data = await invokeLocalUserRouteProxy('local chat generation', {
    mode: 'chat',
    routeId: payload.routeId,
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    messages: normalizedMessages,
    temperature: payload.temperature,
    maxTokens: payload.maxTokens,
    stream: payload.stream ?? false,
  });

  return {
    content: data.content || '',
    ...extractSecureProxyBillingMetadata(data),
    usage: data.usage,
    endpointType: data.endpointType,
  };
}

export async function callSecureSystemProxyImage(
  payload: SecureProxyImageRequest
): Promise<SecureProxyImageResponse> {
  if (payload.userRoute?.kind === 'key-slot' && payload.userRoute.id) {
    return callLocalUserRouteProxyImage({
      ...payload,
      routeId: payload.userRoute.id,
    });
  }

  const compressedRefs = await compressReferenceImagesIfNeeded(payload.referenceImages || []);
  const data = await invokeLocalSystemProxy('image generation', {
    mode: 'image',
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    creditRouteSpecId: payload.creditRouteSpecId,
    creditRouteUnitId: payload.creditRouteUnitId,
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    imageSize: payload.imageSize,
    imageCount: payload.imageCount ?? 1,
    referenceImages: compressedRefs,
  });

  return {
    urls: Array.isArray(data.urls) ? data.urls : [],
    ...extractSecureProxyBillingMetadata(data),
    usage: data.usage,
    taskId: typeof data.taskId === 'string' ? data.taskId : undefined,
    status: data.status === 'success' || data.status === 'failed' ? data.status : 'pending',
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    attemptId: typeof data.attemptId === 'string' ? data.attemptId : undefined,
    endpointType: data.endpointType,
  };
}

export async function callLocalUserRouteProxyImage(
  payload: SecureProxyImageRequest & { routeId: string },
): Promise<SecureProxyImageResponse> {
  const isClientDirect = checkIsWuyinClientDirect(payload.routeId);
  if (isClientDirect) {
    try {
      console.log('[secureModelProxy] Wuyin image direct route matched, calling locally...');
      return await callWuyinClientDirectImage(payload);
    } catch (e) {
      console.warn('[secureModelProxy] Wuyin image direct route failed, falling back to server proxy...', e);
    }
  }

  const compressedRefs = await compressReferenceImagesIfNeeded(payload.referenceImages || []);
  const data = await invokeLocalUserRouteProxy('local image generation', {
    mode: 'image',
    routeId: payload.routeId,
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    creditRouteSpecId: payload.creditRouteSpecId,
    creditRouteUnitId: payload.creditRouteUnitId,
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    imageSize: payload.imageSize,
    imageCount: payload.imageCount ?? 1,
    referenceImages: compressedRefs,
  });

  return {
    urls: Array.isArray(data.urls) ? data.urls : [],
    ...extractSecureProxyBillingMetadata(data),
    usage: data.usage,
    taskId: typeof data.taskId === 'string' ? data.taskId : undefined,
    status: data.status === 'success' || data.status === 'failed' ? data.status : 'pending',
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    attemptId: typeof data.attemptId === 'string' ? data.attemptId : undefined,
    endpointType: data.endpointType,
    execTime: typeof data.execTime === 'number' ? data.execTime : undefined,
  };
}

export async function callSecureSystemProxyVideo(
  payload: SecureProxyVideoRequest
): Promise<SecureProxyVideoResponse> {
  if (payload.userRoute?.kind === 'key-slot' && payload.userRoute.id) {
    return callLocalUserRouteProxyVideo({
      ...payload,
      routeId: payload.userRoute.id,
    });
  }

  const data = await invokeLocalSystemProxy('video generation', {
    mode: 'video',
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    resolution: payload.resolution,
    duration: payload.duration,
    videoDuration: payload.videoDuration,
    imageUrl: payload.imageUrl,
    imageTailUrl: payload.imageTailUrl,
  });

  return {
    taskId: data.taskId || '',
    status: data.status || 'pending',
    url: data.url,
    message: typeof data.message === 'string' ? data.message : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
    ...extractSecureProxyBillingMetadata(data),
    endpointType: data.endpointType,
    execTime: typeof data.execTime === 'number' ? data.execTime : undefined,
  };
}

export async function callLocalUserRouteProxyVideo(
  payload: SecureProxyVideoRequest & { routeId: string },
): Promise<SecureProxyVideoResponse> {
  const isClientDirect = checkIsWuyinClientDirect(payload.routeId);
  if (isClientDirect) {
    try {
      console.log('[secureModelProxy] Wuyin video direct route matched, calling locally...');
      return await callWuyinClientDirectVideo(payload);
    } catch (e) {
      console.warn('[secureModelProxy] Wuyin video direct route failed, falling back to server proxy...', e);
    }
  }

  const data = await invokeLocalUserRouteProxy('local video generation', {
    mode: 'video',
    routeId: payload.routeId,
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    resolution: payload.resolution,
    duration: payload.duration,
    videoDuration: payload.videoDuration,
    imageUrl: payload.imageUrl,
    imageTailUrl: payload.imageTailUrl,
  });

  return {
    taskId: data.taskId || '',
    status: data.status || 'pending',
    url: data.url,
    message: typeof data.message === 'string' ? data.message : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
    ...extractSecureProxyBillingMetadata(data),
    endpointType: data.endpointType,
    execTime: typeof data.execTime === 'number' ? data.execTime : undefined,
  };
}

export async function callSecureSystemProxyAudio(
  payload: SecureProxyAudioRequest
): Promise<SecureProxyAudioResponse> {
  if (payload.userRoute?.kind === 'key-slot' && payload.userRoute.id) {
    return callLocalUserRouteProxyAudio({
      ...payload,
      routeId: payload.userRoute.id,
    });
  }

  const data = await invokeLocalSystemProxy('audio generation', {
    mode: 'audio',
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    prompt: payload.prompt,
  });

  return {
    url: data.url || '',
    ...extractSecureProxyBillingMetadata(data),
    usage: data.usage,
    endpointType: data.endpointType,
  };
}

export async function callLocalUserRouteProxyAudio(
  payload: SecureProxyAudioRequest & { routeId: string },
): Promise<SecureProxyAudioResponse> {
  const data = await invokeLocalUserRouteProxy('local audio generation', {
    mode: 'audio',
    routeId: payload.routeId,
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    prompt: payload.prompt,
  });

  return {
    url: data.url || '',
    ...extractSecureProxyBillingMetadata(data),
    usage: data.usage,
    endpointType: data.endpointType,
  };
}

export async function checkSecureSystemProxyTaskStatus(taskId: string): Promise<SecureProxyTaskStatusResponse> {
  const data = await invokeLocalSystemProxy('task status', {
    mode: 'task_status',
    taskId,
  });

  return {
    status: data.status || 'pending',
    url: data.url,
    message: typeof data.message === 'string' ? data.message : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    attemptId: typeof data.attemptId === 'string' ? data.attemptId : undefined,
    execTime: typeof data.execTime === 'number' ? data.execTime : undefined,
    ...extractSecureProxyBillingMetadata(data),
  };
}

export async function checkLocalUserRouteProxyTaskStatus(
  localTaskId: string,
): Promise<SecureProxyTaskStatusResponse> {
  const isClientDirect = checkIsWuyinClientDirect(localTaskId);
  if (isClientDirect) {
    try {
      console.log('[secureModelProxy] Wuyin task status direct route matched, polling locally...');
      return await checkWuyinClientDirectTaskStatus(localTaskId);
    } catch (e) {
      console.warn('[secureModelProxy] Wuyin task status direct route failed, falling back to server proxy...', e);
    }
  }

  const data = await invokeLocalUserRouteProxy('local task status', {
    mode: 'task_status',
    localTaskId,
  });

  return {
    status: data.status || 'pending',
    url: data.url,
    urls: Array.isArray(data.urls) ? data.urls : undefined,
    message: typeof data.message === 'string' ? data.message : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    attemptId: typeof data.attemptId === 'string' ? data.attemptId : undefined,
    execTime: typeof data.execTime === 'number' ? data.execTime : undefined,
    ...extractSecureProxyBillingMetadata(data),
  };
}

export async function callZeroKeyModelProxyChat(
  payload: StandardizedProxyRequest
): Promise<string> {
  const token = await resolvePreferredRuntimeAccessToken(false);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/secure-proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    throw new Error('Unauthorized: 匿名用户无法直接访问模型代理，请先登录。');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy chat failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  if (payload.provider === 'claude') {
    if (typeof data?.content === 'string') return data.content;
    if (Array.isArray(data?.content)) {
      return data.content
        .map((block: any) => block?.text || block || '')
        .join('');
    }
  }
  
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  if (data?.output?.text) {
    return data.output.text;
  }

  return JSON.stringify(data);
}

export async function callZeroKeyModelProxyChatStream(
  payload: StandardizedProxyRequest,
  onStream?: (chunk: string) => void
): Promise<void> {
  const token = await resolvePreferredRuntimeAccessToken(false);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/secure-proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    throw new Error('Unauthorized: 匿名用户无法直接访问模型代理，请先登录。');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy stream failed (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body has no reader for stream');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventChunk of events) {
        const lines = eventChunk.split('\n');
        const dataLine = lines.find(line => line.startsWith('data:'));
        if (!dataLine) continue;

        const raw = dataLine.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;

        try {
          const parsed = JSON.parse(raw);
          let chunk = '';
          
          if (payload.provider === 'claude') {
            chunk = parsed?.delta?.text || 
                    parsed?.content_block?.text || 
                    parsed?.content?.[0]?.text || 
                    (parsed?.type === 'content_block_delta' ? parsed?.delta?.text : '');
          } else {
            chunk = parsed?.choices?.[0]?.delta?.content || parsed?.output?.choices?.[0]?.message?.content || '';
          }

          if (chunk && onStream) {
            onStream(chunk);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 用户路由代理中转接口配置项
 */
export interface ForwardUserRouteGenericRequestOptions {
  provider?: string;
  model?: string;
  messages?: any[];
  keyId?: string;
  apiKey?: string;
  stream?: boolean;
  rawBody?: any;
  signal?: AbortSignal;
  url?: string;
  method?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
}

/**
 * 通用的用户路由代理透传请求转发 (支持 GET/POST FormData 等，兼容位置参数与 options 传参)
 */
export async function forwardUserRouteGenericRequest(
  optionsOrUrl: ForwardUserRouteGenericRequestOptions | string,
  method?: string,
  keySlotId?: string,
  body?: BodyInit,
  headers?: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response> {
  let targetUrl = '';
  let targetMethod = 'GET';
  let targetKeyId = '';
  let targetApiKey = '';
  let targetBody: BodyInit | undefined;
  let targetHeaders: Record<string, string> | undefined;
  let targetSignal: AbortSignal | undefined;

  if (typeof optionsOrUrl === 'string') {
    targetUrl = optionsOrUrl;
    targetMethod = method || 'GET';
    targetKeyId = keySlotId || '';
    targetBody = body;
    targetHeaders = headers;
    targetSignal = signal;
  } else {
    targetUrl = optionsOrUrl.url || '';
    targetMethod = optionsOrUrl.method || 'POST';
    targetKeyId = optionsOrUrl.keyId || '';
    const rawTargetApiKey = optionsOrUrl.apiKey || '';
    targetApiKey = normalizeUserApiSecretForTransport(rawTargetApiKey);
    if (rawTargetApiKey && !targetApiKey) {
      throw buildSecureProxyBoundaryError('Saved user API key is not available for transport. Re-enter or reveal the real API key before retrying.', {
        code: LOCAL_USER_ROUTE_SECRET_REQUIRED_CODE,
        status: 400,
        feature: 'generic user-route forwarding',
      });
    }
    targetHeaders = optionsOrUrl.headers;
    const rawContentType = String(targetHeaders?.['Content-Type'] || targetHeaders?.['content-type'] || '');
    if (optionsOrUrl.body) {
      targetBody = optionsOrUrl.body;
    } else if (optionsOrUrl.rawBody) {
      if (typeof optionsOrUrl.rawBody === 'string') {
        targetBody = optionsOrUrl.rawBody;
      } else if (/application\/x-www-form-urlencoded/i.test(rawContentType)) {
        targetBody = new URLSearchParams(optionsOrUrl.rawBody).toString();
      } else {
        targetBody = JSON.stringify(optionsOrUrl.rawBody);
      }
    }
    targetSignal = optionsOrUrl.signal;
  }

  const token = await resolvePreferredRuntimeAccessToken(false);
  const proxyHeaders: Record<string, string> = {
    ...targetHeaders,
    'X-Proxy-Target-Url': targetUrl,
    'X-Key-Slot-Id': targetKeyId,
  };

  if (token) {
    proxyHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (targetApiKey) {
    proxyHeaders['X-Proxy-Api-Key'] = targetApiKey;
  }

  const proxyUrl = getLocalUserRouteApiEndpoint();
  return await kernelFetch(proxyUrl, {
    method: targetMethod,
    headers: proxyHeaders,
    body: targetBody,
    signal: targetSignal,
  });
}
