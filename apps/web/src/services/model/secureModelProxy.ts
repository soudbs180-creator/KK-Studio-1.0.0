import { tempUserService } from '../auth/tempUserService';
import { getLatestAuthSessionChange, requestAuthSessionInvalidation, waitForAuthSessionChange } from '../auth/authSessionEvents';
import { getPreferredKkApiAccessToken, refreshPreferredKkApiAccessToken } from '../api/authAccessToken';
import { type StandardizedProxyRequest } from './ProxyRequestBuilder';
import { resolveKkApiModelProxyBaseUrl } from '../api/kkApiClient';
import { compressReferenceImagesIfNeeded } from '../../utils/imageUtils';
import { kernelFetch } from '../http/requestKernel';

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
  if (value == null) return '';
  if (isEncryptedSecretEnvelope(value)) return JSON.stringify(value);
  if (typeof value !== 'string') return '';

  const token = value.trim();
  if (
    !token
    || token === READONLY_SECRET_PLACEHOLDER
    || token.startsWith(REDACTED_SECRET_PREFIX)
    || token === '[object Object]'
    || /^\[object\s+[^\]]+\]$/.test(token)
    || /[\u2022\u25cf\u25e6\u2219\u2027\u2026]/.test(token)
    || token.includes('...')
  ) {
    return '';
  }

  return isEncryptedSecretJsonString(token) ? token : token;
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

export interface SecureProxyBillingMetadata {
  deducted?: boolean;
  ledgerId?: string;
  balanceAfter?: number;
  refundApplied?: boolean;
  refundBalanceAfter?: number;
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

export interface SecureProxyChatResponse extends SecureProxyBillingMetadata {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  endpointType?: string;
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
  endpointType?: string;
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
  endpointType?: string;
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
  endpointType?: string;
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
export const SECURE_PROXY_SESSION_REAUTH_MESSAGE = '登录会话已过期，请重新登录后再试。';
export const SECURE_PROXY_GUEST_MODE_MESSAGE = '游客模式暂不支持当前受保护代理，请先登录正式账号。';

export type SecureProxyRouteKind = 'system' | 'user-route';

type CloudSessionResolution = {
  accessToken: string;
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
  code?: SecureProxyBoundaryErrorCode | string;
  status?: number;
  responseBody?: string;
  feature?: string;
};

const TRANSIENT_PROXY_RETRY_STATUS_CODES = new Set([502, 503, 504]);
const MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS = 2;
const TRANSIENT_PROXY_RETRY_BASE_DELAY_MS = 250;
let refreshCloudSessionPromise: Promise<CloudSessionResolution | null> | null = null;

function getLocalUserRouteApiEndpoint(useVpsFallback = false): string {
  const baseUrl = useVpsFallback
    ? 'https://172-245-156-16.sslip.io'
    : resolveKkApiModelProxyBaseUrl();
  return `${baseUrl.replace(/\/+$/, '')}/api/v1/model-proxy/user`;
}

function getLocalSystemProxyEndpoint(useVpsFallback = false): string {
  const baseUrl = useVpsFallback
    ? 'https://172-245-156-16.sslip.io'
    : resolveKkApiModelProxyBaseUrl();
  return `${baseUrl.replace(/\/+$/, '')}/api/v1/model-proxy/system`;
}

function buildSecureProxyBoundaryError(
  message: string,
  meta?: {
    code?: SecureProxyBoundaryErrorCode | string;
    status?: number;
    responseBody?: string;
    feature?: string;
  },
): SecureProxyBoundaryError {
  const normalized = new Error(message) as SecureProxyBoundaryError;
  if (meta?.code) normalized.code = meta.code;
  if (meta?.status !== undefined) normalized.status = meta.status;
  if (meta?.responseBody) normalized.responseBody = meta.responseBody;
  if (meta?.feature) normalized.feature = meta.feature;
  return normalized;
}

export function isSecureProxySessionReauthError(error: unknown): error is SecureProxyBoundaryError {
  return Boolean(error && typeof error === 'object' && (error as SecureProxyBoundaryError).code === SECURE_PROXY_SESSION_REAUTH_CODE);
}

export function isSecureProxyGuestModeError(error: unknown): error is SecureProxyBoundaryError {
  return Boolean(error && typeof error === 'object' && (error as SecureProxyBoundaryError).code === SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE);
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
      boundaryCode === LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE
      || boundaryCode === LOCAL_USER_ROUTE_NOT_FOUND_CODE
      || (((error as SecureProxyBoundaryError).status || 0) >= 500)
    ),
  );
}

export function getSecureProxySessionReauthMessage(routeKind: SecureProxyRouteKind): string {
  if (routeKind === 'user-route') {
    return '登录会话已过期，请重新登录后继续使用你配置的 API 路由。';
  }
  return '登录已过期，请重新登录后继续使用系统积分模型。';
}

export function getSecureProxyGuestModeMessage(routeKind: SecureProxyRouteKind): string {
  if (routeKind === 'user-route') {
    return '游客模式不支持云同步和你配置的 API 路由，请先登录正式账号。';
  }
  return '游客模式不支持云同步和系统积分模型，请先登录正式账号。';
}

function buildSessionReauthError(feature: string, routeKind: SecureProxyRouteKind): SecureProxyBoundaryError {
  return buildSecureProxyBoundaryError(getSecureProxySessionReauthMessage(routeKind), {
    code: SECURE_PROXY_SESSION_REAUTH_CODE,
    status: 401,
    feature,
  });
}

function buildGuestModeError(feature: string, routeKind: SecureProxyRouteKind): SecureProxyBoundaryError {
  return buildSecureProxyBoundaryError(getSecureProxyGuestModeMessage(routeKind), {
    code: SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE,
    status: 403,
    feature,
  });
}

function isRetryableProxyFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return false;
  const message = String(error.message || '').trim().toLowerCase();
  return error.name === 'TypeError'
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed');
}

function shouldRetryProxyResponse(response?: Response): boolean {
  return Boolean(response && TRANSIENT_PROXY_RETRY_STATUS_CODES.has(response.status));
}

function waitForProxyRetry(attempt: number): Promise<void> {
  const delayMs = Math.max(0, TRANSIENT_PROXY_RETRY_BASE_DELAY_MS * attempt);
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
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
      console.warn(`[secureModelProxy] ${proxyName} returned ${response.status}; retrying (${attempt}/${MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS})`);
    } catch (error) {
      if (!isRetryableProxyFetchError(error) || attempt >= MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS) {
        throw error;
      }
      console.warn(`[secureModelProxy] ${proxyName} request failed; retrying (${attempt}/${MAX_TRANSIENT_PROXY_FETCH_ATTEMPTS})`, error);
    }
    await waitForProxyRetry(attempt);
  }
  throw new Error(`${proxyName} request failed after retrying.`);
}

async function resolveRuntimeAccessTokenFromAuthEvent(forceRefresh = false): Promise<string | null> {
  const latestAuthSession = getLatestAuthSessionChange();
  if (latestAuthSession?.hasSession && !latestAuthSession.isTempUser) {
    const authEventAccessToken = String(latestAuthSession.accessToken || '').trim();
    if (authEventAccessToken) return authEventAccessToken;
  }

  if (!forceRefresh) return null;
  const sessionEvent = await waitForAuthSessionChange(
    (detail) => detail.hasSession && !detail.isTempUser && Boolean(String(detail.accessToken || '').trim()),
    1500,
  );
  return String(sessionEvent?.accessToken || '').trim() || null;
}

async function resolveStoredCloudAccessToken(forceRefresh = false): Promise<string | null> {
  const token = forceRefresh
    ? await refreshPreferredKkApiAccessToken()
    : await getPreferredKkApiAccessToken();
  return String(token || '').trim() || null;
}

async function resolvePreferredRuntimeAccessToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    const refreshedAccessToken = await resolveStoredCloudAccessToken(true);
    if (refreshedAccessToken) return refreshedAccessToken;
    return await resolveRuntimeAccessTokenFromAuthEvent(true);
  }

  const authEventAccessToken = await resolveRuntimeAccessTokenFromAuthEvent(false);
  if (authEventAccessToken) return authEventAccessToken;
  return await resolveStoredCloudAccessToken(false);
}

async function recoverCloudSession(feature: string): Promise<CloudSessionResolution | null> {
  if (refreshCloudSessionPromise) return refreshCloudSessionPromise;
  refreshCloudSessionPromise = (async () => {
    const refreshedAccessToken = await resolveStoredCloudAccessToken(true);
    if (refreshedAccessToken) return { accessToken: refreshedAccessToken };
    const authEventAccessToken = await resolveRuntimeAccessTokenFromAuthEvent(true);
    if (authEventAccessToken) return { accessToken: authEventAccessToken };
    console.warn(`[secureModelProxy] Unable to recover KK API session for ${feature}.`);
    return null;
  })().finally(() => {
    refreshCloudSessionPromise = null;
  });
  return refreshCloudSessionPromise;
}

async function resolveCloudSession(feature: string, routeKind: SecureProxyRouteKind): Promise<CloudSessionResolution> {
  const token = await resolvePreferredRuntimeAccessToken(false);
  if (token) return { accessToken: token };

  const recovered = await recoverCloudSession(feature);
  if (recovered?.accessToken) return recovered;

  if (tempUserService.getCachedTempUser()) {
    throw buildGuestModeError(feature, routeKind);
  }
  throw buildSessionReauthError(feature, routeKind);
}

function extractProxyErrorMessage(responseBody = '', payload: any = null): string {
  const parsedError = payload?.error;
  if (typeof parsedError === 'string' && parsedError.trim()) return parsedError.trim();
  if (parsedError && typeof parsedError === 'object' && typeof parsedError.message === 'string' && parsedError.message.trim()) {
    return parsedError.message.trim();
  }
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  return String(responseBody || '').trim();
}

type ProxyHttpResult = {
  response: Response;
  payload: any;
  responseBody: string;
};

async function readProxyHttpResult(response: Response): Promise<ProxyHttpResult> {
  let responseBody = '';
  let payload: any = null;
  try {
    responseBody = await response.clone().text();
    payload = responseBody ? JSON.parse(responseBody) : null;
  } catch {
    payload = null;
  }
  return { response, payload, responseBody };
}

async function invokeProxyHttp(
  endpoint: string,
  accessToken: string,
  body: Record<string, unknown>,
  proxyName: string,
): Promise<ProxyHttpResult> {
  const response = await fetchWithTransientProxyRetry(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  }, proxyName);
  return readProxyHttpResult(response);
}

function extractSecureProxyBillingMetadata(data: any): SecureProxyBillingMetadata {
  return {
    deducted: Boolean(data?.deducted),
    ledgerId: typeof data?.ledgerId === 'string' ? data.ledgerId : undefined,
    balanceAfter: typeof data?.balanceAfter === 'number' ? data.balanceAfter : undefined,
    refundApplied: data?.refundApplied === true,
    refundBalanceAfter: typeof data?.refundBalanceAfter === 'number' ? data.refundBalanceAfter : undefined,
  };
}

async function invokeModelProxy(
  routeKind: SecureProxyRouteKind,
  feature: string,
  body: Record<string, unknown>,
): Promise<any> {
  const session = await resolveCloudSession(feature, routeKind);
  const endpointResolver = routeKind === 'user-route' ? getLocalUserRouteApiEndpoint : getLocalSystemProxyEndpoint;
  const proxyName = routeKind === 'user-route' ? 'local-user-route-api' : 'local-system-proxy';
  let result: ProxyHttpResult;

  try {
    result = await invokeProxyHttp(endpointResolver(false), session.accessToken, body, proxyName);
  } catch (error) {
    console.warn(`[secureModelProxy] ${proxyName} unavailable, trying VPS fallback...`, error);
    try {
      result = await invokeProxyHttp(endpointResolver(true), session.accessToken, body, `${proxyName}-vps`);
    } catch (fallbackError: any) {
      throw buildSecureProxyBoundaryError(
        isRetryableProxyFetchError(fallbackError)
          ? `${proxyName} is temporarily unavailable. Please try again.`
          : fallbackError?.message || `${proxyName} request failed.`,
        {
          code: routeKind === 'user-route' ? LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE : undefined,
          status: 502,
          feature,
        },
      );
    }
  }

  if (result.response.status === 401 || result.response.status === 403) {
    const recovered = await recoverCloudSession(feature);
    if (recovered?.accessToken) {
      result = await invokeProxyHttp(endpointResolver(false), recovered.accessToken, body, proxyName);
    }
  }

  if (!result.response.ok || !result.payload?.success) {
    const upstreamMessage = extractProxyErrorMessage(result.responseBody, result.payload);
    const errorCode = String(result.payload?.error?.code || '').trim();

    if (result.response.status === 401 || /invalid jwt/i.test(result.responseBody)) {
      requestAuthSessionInvalidation(`${feature}: ${proxyName} rejected the current session`);
      throw buildSessionReauthError(feature, routeKind);
    }

    throw buildSecureProxyBoundaryError(
      upstreamMessage || `${proxyName} failed with status ${result.response.status}`,
      {
        code: errorCode || (routeKind === 'user-route' ? LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE : undefined),
        status: result.response.status,
        responseBody: result.responseBody,
        feature,
      },
    );
  }

  return result.payload.data;
}

function normalizeMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join('\n');
  }
  if (content == null) return '';
  return String(content);
}

function normalizeChatMessages(messages: SecureProxyChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: normalizeMessageContent(message.content),
  }));
}

export async function callSecureSystemProxyChat(payload: SecureProxyChatRequest): Promise<SecureProxyChatResponse> {
  if (payload.userRoute?.kind === 'key-slot' && payload.userRoute.id) {
    return callLocalUserRouteProxyChat({ ...payload, routeId: payload.userRoute.id });
  }

  const data = await invokeModelProxy('system', 'chat generation', {
    mode: 'chat',
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    messages: normalizeChatMessages(payload.messages),
    temperature: payload.temperature,
    maxTokens: payload.maxTokens,
    stream: payload.stream ?? false,
  });

  return {
    content: data?.content || '',
    ...extractSecureProxyBillingMetadata(data),
    usage: data?.usage,
    endpointType: data?.endpointType,
  };
}

export async function callLocalUserRouteProxyChat(payload: SecureProxyChatRequest & { routeId: string }): Promise<SecureProxyChatResponse> {
  const data = await invokeModelProxy('user-route', 'local chat generation', {
    mode: 'chat',
    routeId: payload.routeId,
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    messages: normalizeChatMessages(payload.messages),
    temperature: payload.temperature,
    maxTokens: payload.maxTokens,
    stream: payload.stream ?? false,
  });

  return {
    content: data?.content || '',
    ...extractSecureProxyBillingMetadata(data),
    usage: data?.usage,
    endpointType: data?.endpointType,
  };
}

export async function callSecureSystemProxyImage(payload: SecureProxyImageRequest): Promise<SecureProxyImageResponse> {
  if (payload.userRoute?.kind === 'key-slot' && payload.userRoute.id) {
    return callLocalUserRouteProxyImage({ ...payload, routeId: payload.userRoute.id });
  }

  const compressedRefs = await compressReferenceImagesIfNeeded(payload.referenceImages || []);
  const data = await invokeModelProxy('system', 'image generation', {
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

  return normalizeImageResponse(data);
}

export async function callLocalUserRouteProxyImage(payload: SecureProxyImageRequest & { routeId: string }): Promise<SecureProxyImageResponse> {
  const compressedRefs = await compressReferenceImagesIfNeeded(payload.referenceImages || []);
  const data = await invokeModelProxy('user-route', 'local image generation', {
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

  return normalizeImageResponse(data);
}

function normalizeImageResponse(data: any): SecureProxyImageResponse {
  return {
    urls: Array.isArray(data?.urls) ? data.urls : [],
    ...extractSecureProxyBillingMetadata(data),
    usage: data?.usage,
    taskId: typeof data?.taskId === 'string' ? data.taskId : undefined,
    status: data?.status === 'success' || data?.status === 'failed' ? data.status : 'pending',
    requestId: typeof data?.requestId === 'string' ? data.requestId : undefined,
    attemptId: typeof data?.attemptId === 'string' ? data.attemptId : undefined,
    endpointType: data?.endpointType,
    execTime: typeof data?.execTime === 'number' ? data.execTime : undefined,
  };
}

export async function callSecureSystemProxyVideo(payload: SecureProxyVideoRequest): Promise<SecureProxyVideoResponse> {
  if (payload.userRoute?.kind === 'key-slot' && payload.userRoute.id) {
    return callLocalUserRouteProxyVideo({ ...payload, routeId: payload.userRoute.id });
  }

  const data = await invokeModelProxy('system', 'video generation', {
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

  return normalizeVideoResponse(data);
}

export async function callLocalUserRouteProxyVideo(payload: SecureProxyVideoRequest & { routeId: string }): Promise<SecureProxyVideoResponse> {
  const data = await invokeModelProxy('user-route', 'local video generation', {
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

  return normalizeVideoResponse(data);
}

function normalizeVideoResponse(data: any): SecureProxyVideoResponse {
  return {
    taskId: data?.taskId || '',
    status: data?.status || 'pending',
    url: data?.url,
    message: typeof data?.message === 'string' ? data.message : undefined,
    error: typeof data?.error === 'string' ? data.error : undefined,
    ...extractSecureProxyBillingMetadata(data),
    endpointType: data?.endpointType,
    execTime: typeof data?.execTime === 'number' ? data.execTime : undefined,
  };
}

export async function callSecureSystemProxyAudio(payload: SecureProxyAudioRequest): Promise<SecureProxyAudioResponse> {
  if (payload.userRoute?.kind === 'key-slot' && payload.userRoute.id) {
    return callLocalUserRouteProxyAudio({ ...payload, routeId: payload.userRoute.id });
  }

  const data = await invokeModelProxy('system', 'audio generation', {
    mode: 'audio',
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    prompt: payload.prompt,
  });

  return {
    url: data?.url || '',
    ...extractSecureProxyBillingMetadata(data),
    usage: data?.usage,
    endpointType: data?.endpointType,
  };
}

export async function callLocalUserRouteProxyAudio(payload: SecureProxyAudioRequest & { routeId: string }): Promise<SecureProxyAudioResponse> {
  const data = await invokeModelProxy('user-route', 'local audio generation', {
    mode: 'audio',
    routeId: payload.routeId,
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    prompt: payload.prompt,
  });

  return {
    url: data?.url || '',
    ...extractSecureProxyBillingMetadata(data),
    usage: data?.usage,
    endpointType: data?.endpointType,
  };
}

export async function checkSecureSystemProxyTaskStatus(taskId: string): Promise<SecureProxyTaskStatusResponse> {
  const data = await invokeModelProxy('system', 'task status', {
    mode: 'task_status',
    taskId,
  });

  return normalizeTaskStatusResponse(data);
}

export async function checkLocalUserRouteProxyTaskStatus(localTaskId: string): Promise<SecureProxyTaskStatusResponse> {
  const data = await invokeModelProxy('user-route', 'local task status', {
    mode: 'task_status',
    localTaskId,
  });

  return normalizeTaskStatusResponse(data);
}

function normalizeTaskStatusResponse(data: any): SecureProxyTaskStatusResponse {
  return {
    status: data?.status || 'pending',
    url: data?.url,
    urls: Array.isArray(data?.urls) ? data.urls : undefined,
    message: typeof data?.message === 'string' ? data.message : undefined,
    error: typeof data?.error === 'string' ? data.error : undefined,
    requestId: typeof data?.requestId === 'string' ? data.requestId : undefined,
    attemptId: typeof data?.attemptId === 'string' ? data.attemptId : undefined,
    execTime: typeof data?.execTime === 'number' ? data.execTime : undefined,
    ...extractSecureProxyBillingMetadata(data),
  };
}

export async function cancelSecureSystemProxyTask(taskId: string): Promise<boolean> {
  if (String(taskId || '').startsWith('local_proxy:')) {
    await invokeModelProxy('user-route', 'task cancel', { mode: 'cancel_task', localTaskId: taskId });
  } else {
    await invokeModelProxy('system', 'task cancel', { mode: 'cancel_task', taskId });
  }
  return true;
}

export async function deleteSecureSystemProxyTask(taskId: string): Promise<boolean> {
  if (String(taskId || '').startsWith('local_proxy:')) {
    await invokeModelProxy('user-route', 'task delete', { mode: 'delete_task', localTaskId: taskId });
  } else {
    await invokeModelProxy('system', 'task delete', { mode: 'delete_task', taskId });
  }
  return true;
}

export async function downloadSecureSystemProxyTaskContent(taskId: string): Promise<string> {
  const data = String(taskId || '').startsWith('local_proxy:')
    ? await invokeModelProxy('user-route', 'task download', { mode: 'download_task', localTaskId: taskId })
    : await invokeModelProxy('system', 'task download', { mode: 'download_task', taskId });
  return String(data?.url || '');
}

export async function callZeroKeyModelProxyChat(payload: StandardizedProxyRequest): Promise<string> {
  const token = await resolvePreferredRuntimeAccessToken(false);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

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
    if (Array.isArray(data?.content)) return data.content.map((block: any) => block?.text || block || '').join('');
  }
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data?.output?.text) return data.output.text;
  return JSON.stringify(data);
}

export async function callZeroKeyModelProxyChatStream(
  payload: StandardizedProxyRequest,
  onStream?: (chunk: string) => void,
): Promise<void> {
  const token = await resolvePreferredRuntimeAccessToken(false);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch('/api/secure-proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (response.status === 401) throw new Error('Unauthorized: 匿名用户无法直接访问模型代理，请先登录。');
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy stream failed (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body has no reader for stream');
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
        const dataLine = lines.find((line) => line.startsWith('data:'));
        if (!dataLine) continue;
        const raw = dataLine.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          const chunk = payload.provider === 'claude'
            ? parsed?.delta?.text || parsed?.content_block?.text || parsed?.content?.[0]?.text || (parsed?.type === 'content_block_delta' ? parsed?.delta?.text : '')
            : parsed?.choices?.[0]?.delta?.content || parsed?.output?.choices?.[0]?.message?.content || '';
          if (chunk && onStream) onStream(chunk);
        } catch {
          // Ignore malformed stream frames.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

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
  if (token) proxyHeaders.Authorization = `Bearer ${token}`;
  if (targetApiKey) proxyHeaders['X-Proxy-Api-Key'] = targetApiKey;

  return kernelFetch(getLocalUserRouteApiEndpoint(), {
    method: targetMethod,
    headers: proxyHeaders,
    body: targetBody,
    signal: targetSignal,
  });
}
