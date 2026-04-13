import { supabase } from '../../lib/supabase';
import { tempUserService } from '../auth/tempUserService';
import {
  getLatestAuthSessionChange,
  requestAuthSessionInvalidation,
  waitForAuthSessionChange,
} from '../auth/authSessionEvents';
import { getPreferredKkApiAccessToken, refreshPreferredKkApiAccessToken } from '../api/authAccessToken';
import { resolveKkApiBaseUrl } from '../api/kkApiClient';

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
  endpointType?: 'openai' | 'gemini' | 'claude';
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
  endpointType?: 'openai' | 'gemini' | 'claude';
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
  requestId?: string;
  attemptId?: string;
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

function getLocalUserRouteApiEndpoint(): string {
  return `${resolveKkApiBaseUrl().replace(/\/+$/, '')}/api/v1/model-proxy/user`;
}

function getLocalSystemProxyEndpoint(): string {
  return `${resolveKkApiBaseUrl().replace(/\/+$/, '')}/api/v1/model-proxy/system`;
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
  feature: string,
  routeKind: SecureProxyRouteKind,
  forceRefresh = false,
): Promise<CloudSessionResolution | null> {
  const latestAuthSession = getLatestAuthSessionChange();
  if (!latestAuthSession?.hasSession || latestAuthSession.isTempUser) {
    return null;
  }

  const cachedAccessToken = String(latestAuthSession.accessToken || '').trim();
  const cachedRefreshToken = String(latestAuthSession.refreshToken || '').trim();

  if (!cachedAccessToken || !cachedRefreshToken) {
    return !forceRefresh && cachedAccessToken
      ? { accessToken: cachedAccessToken }
      : null;
  }

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: cachedAccessToken,
      refresh_token: cachedRefreshToken,
    });

    if (error) {
      console.warn(
        `[secureModelProxy] Failed to restore auth event session during ${feature} (${routeKind}):`,
        error,
      );
    }

    if (data.session?.access_token) {
      return {
        accessToken: data.session.access_token,
      };
    }
  } catch (error) {
    console.warn(
      `[secureModelProxy] Restoring auth event session failed during ${feature} (${routeKind}):`,
      error,
    );
  }

  return !forceRefresh && cachedAccessToken
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

async function readCloudSession(feature: string) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message || `Unable to verify login state for ${feature}.`);
  }

  return session;
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
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('[secureModelProxy] refreshSession failed:', refreshError);
    }

    const refreshedSession = !refreshError && refreshData.session?.access_token
      ? refreshData.session
      : null;

    if (refreshedSession?.access_token) {
      return {
        accessToken: refreshedSession.access_token,
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
      accessToken: session.access_token,
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
    // secure-model-proxy is backed by Supabase auth and must never use the
    // stale in-memory browser session object alone. If we fail to recover a
    // valid access token here, surface a reauth error without
    // force-clearing the browser's local session cache.
    const reason = sessionReadError instanceof Error
      ? `Unable to recover Supabase session for ${feature}: ${sessionReadError.message}`
      : `Unable to recover Supabase session for ${feature}`;
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
      // Preserve the browser's local session cache here. Supabase can briefly
      // return transient 401s during refresh races or platform hiccups, and
      // force-signing the user out on the first miss is too disruptive.
      console.warn(
        '[secureModelProxy] Reauth is required, but preserving the local Supabase session cache to avoid an unexpected sign-out:',
        reason,
      );
      lastCloudSessionInvalidationWarningAt = now;
    }
  })().finally(() => {
    invalidateCloudSessionPromise = null;
  });

  return invalidateCloudSessionPromise;
}

async function buildInvocationError(
  feature: string,
  error: any,
  response?: Response
): Promise<Error> {
  if (isSecureProxySessionReauthError(error) || isSecureProxyGuestModeError(error)) {
    return error;
  }

  const status = response?.status;
  let responseBody = '';

  if (response) {
    try {
      responseBody = await response.clone().text();
    } catch {
      responseBody = '';
    }
  }

  let message = error?.message || 'System proxy invocation failed';
  if (status === 401) {
    // A proxy-side 401 does not always mean the local Supabase session is gone.
    // It can also happen when the Edge Function deployment/config drifts from the
    // frontend auth project. Keep the local session intact here so users see a
    // recoverable auth error instead of being force-signed-out mid-generation.
    return buildSessionReauthError(feature, responseBody, 'system');
  } else if (status === 403) {
    message = `System credit ${feature} is not available for the current account.`;
  } else if (responseBody) {
    try {
      const parsed = JSON.parse(responseBody);
      message = parsed?.error || parsed?.message || message;
    } catch {
      message = responseBody || message;
    }
  }

  return buildSecureProxyBoundaryError(message, {
    status,
    responseBody,
    feature,
  });
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
    const { data, error } = await supabase.auth.getUser(accessToken);
    return error || !data.user ? 'invalid' : 'valid';
  } catch (error) {
    console.warn('[secureModelProxy] Failed to verify current Supabase user after Invalid JWT:', error);
    return 'unknown';
  }
}

async function handleInvalidJwtSessionState(feature: string): Promise<InvalidJwtLocalSessionState> {
  const localSessionState = await inspectLocalSessionForInvalidJwt();
  console.warn(
    `[secureModelProxy] Local Supabase session state after Invalid JWT during ${feature}: ${localSessionState}`,
  );

  if (localSessionState === 'invalid' || localSessionState === 'no-session') {
    requestAuthSessionInvalidation(`${feature}: local-user-route-api returned Invalid JWT`);
  }

  return localSessionState;
}

async function invokeLocalUserRouteApiHttp(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<LocalUserRouteProxyHttpResult> {
  const response = await fetchWithTransientProxyRetry(getLocalUserRouteApiEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  }, 'local-user-route-api');

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
): Promise<LocalSystemProxyHttpResult> {
  const response = await fetchWithTransientProxyRetry(getLocalSystemProxyEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  }, 'local-system-proxy');

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
  const session = await resolveCloudSession(feature, { routeKind: 'user-route' });
  let activeAccessToken = session.accessToken;
  const failureLabel = 'local KK API user-route proxy';

  let result: LocalUserRouteProxyHttpResult;
  try {
    result = await invokeLocalUserRouteApiHttp(activeAccessToken, body);
  } catch (error: any) {
    throw buildSecureProxyBoundaryError(
      isRetryableProxyFetchError(error)
        ? `${failureLabel} is temporarily unavailable. Please try again.`
        : error?.message || `Failed to reach the ${failureLabel}.`,
      {
        code: LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE,
        status: 502,
        feature,
      },
    );
  }

  const shouldRetryWithFreshSession = (
    result.response?.status === 401
    || isInvalidJwtResponse(result.responseBody, result.payload)
  );

  if (shouldRetryWithFreshSession) {
    console.warn(
      `[secureModelProxy] ${failureLabel} returned 401/Invalid JWT, forcing session refresh before retry`,
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
    const errorMessage =
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
      // Keep the local session only when the browser's own Supabase client can
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
  const invokeWithToken = async (accessToken: string): Promise<LocalSystemProxyHttpResult> => {
    try {
      return await invokeLocalSystemProxyHttp(accessToken, body);
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
  let result = await invokeWithToken(session.accessToken);

  if (result.response?.status === 401 || isInvalidJwtResponse(result.responseBody, result.payload)) {
    try {
      console.warn('[secureModelProxy] Local system proxy returned 401/Invalid JWT, forcing session refresh before retry');
      const recoveredSession = await resolveCloudSession(feature, { forceRefresh: true, routeKind: 'system' });
      if (recoveredSession.accessToken) {
        result = await invokeWithToken(recoveredSession.accessToken);
      }
    } catch (error) {
      console.warn('[secureModelProxy] Cloud session recovery failed after local system proxy 401:', error);
      if (isSecureProxySessionReauthError(error) || isSecureProxyGuestModeError(error)) {
        throw error;
      }
    }
  }

  if (!result.response?.ok || !result.payload?.success) {
    const errorMessage =
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

  const data = await invokeLocalSystemProxy('image generation', {
    mode: 'image',
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    imageSize: payload.imageSize,
    imageCount: payload.imageCount ?? 1,
    referenceImages: payload.referenceImages ?? [],
  });

  return {
    urls: Array.isArray(data.urls) ? data.urls : [],
    ...extractSecureProxyBillingMetadata(data),
    usage: data.usage,
    endpointType: data.endpointType,
  };
}

export async function callLocalUserRouteProxyImage(
  payload: SecureProxyImageRequest & { routeId: string },
): Promise<SecureProxyImageResponse> {
  const data = await invokeLocalUserRouteProxy('local image generation', {
    mode: 'image',
    routeId: payload.routeId,
    modelId: payload.modelId,
    requestId: payload.requestId,
    attemptId: payload.attemptId,
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    imageSize: payload.imageSize,
    imageCount: payload.imageCount ?? 1,
    referenceImages: payload.referenceImages ?? [],
  });

  return {
    urls: Array.isArray(data.urls) ? data.urls : [],
    ...extractSecureProxyBillingMetadata(data),
    usage: data.usage,
    endpointType: data.endpointType,
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
    ...extractSecureProxyBillingMetadata(data),
    endpointType: data.endpointType,
  };
}

export async function callLocalUserRouteProxyVideo(
  payload: SecureProxyVideoRequest & { routeId: string },
): Promise<SecureProxyVideoResponse> {
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
    ...extractSecureProxyBillingMetadata(data),
    endpointType: data.endpointType,
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
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    attemptId: typeof data.attemptId === 'string' ? data.attemptId : undefined,
    ...extractSecureProxyBillingMetadata(data),
  };
}

export async function checkLocalUserRouteProxyTaskStatus(
  localTaskId: string,
): Promise<SecureProxyTaskStatusResponse> {
  const data = await invokeLocalUserRouteProxy('local task status', {
    mode: 'task_status',
    localTaskId,
  });

  return {
    status: data.status || 'pending',
    url: data.url,
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    attemptId: typeof data.attemptId === 'string' ? data.attemptId : undefined,
    ...extractSecureProxyBillingMetadata(data),
  };
}
