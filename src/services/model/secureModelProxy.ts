import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase';
import { tempUserService } from '../auth/tempUserService';
import { waitForAuthSessionChange } from '../auth/authSessionEvents';
import { resolveKkApiBaseUrl, shouldUseLegacyWebApiFallback } from '../api/kkApiClient';

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
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  userRoute?: SecureProxyUserRoute;
}

export interface SecureProxyChatResponse {
  content: string;
  deducted?: boolean;
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
  aspectRatio?: string;
  imageSize?: string;
  imageCount?: number;
  referenceImages?: Array<string | { data: string; mimeType: string }>;
  userRoute?: SecureProxyUserRoute;
}

export interface SecureProxyImageResponse {
  urls: string[];
  deducted?: boolean;
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
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  videoDuration?: string;
  imageUrl?: string;
  imageTailUrl?: string;
  userRoute?: SecureProxyUserRoute;
}

export interface SecureProxyVideoResponse {
  taskId: string;
  status: 'pending' | 'success' | 'failed';
  url?: string;
  deducted?: boolean;
  endpointType?: 'openai' | 'gemini' | 'claude';
}

export interface SecureProxyAudioRequest {
  modelId: string;
  prompt: string;
  userRoute?: SecureProxyUserRoute;
}

export interface SecureProxyAudioResponse {
  url: string;
  deducted?: boolean;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
  endpointType?: 'openai' | 'gemini' | 'claude';
}

export interface SecureProxyTaskStatusResponse {
  status: 'pending' | 'success' | 'failed';
  url?: string;
  deducted?: boolean;
}

export const SECURE_PROXY_SESSION_REAUTH_CODE = 'SESSION_REAUTH_REQUIRED';
export const SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE = 'GUEST_MODE_UNAVAILABLE';
export const LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE = 'LOCAL_USER_ROUTE_PROXY_UNAVAILABLE';
export const LOCAL_USER_ROUTE_NOT_FOUND_CODE = 'USER_ROUTE_NOT_FOUND';
export const SECURE_PROXY_SESSION_REAUTH_MESSAGE = '登录已过期，请重新登录后继续使用系统积分模型。';
export const SECURE_PROXY_GUEST_MODE_MESSAGE = '游客模式不支持云同步和系统积分模型，请先登录正式账号。';

type SecureProxyInvokeResult = {
  data: any;
  error: any;
  response?: Response;
};

type CloudSessionResolution = {
  accessToken: string;
};

type ResolveCloudSessionOptions = {
  forceRefresh?: boolean;
};

type SecureProxyBoundaryErrorCode =
  | typeof SECURE_PROXY_SESSION_REAUTH_CODE
  | typeof SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE
  | typeof LOCAL_USER_ROUTE_PROXY_UNAVAILABLE_CODE
  | typeof LOCAL_USER_ROUTE_NOT_FOUND_CODE;

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

function getSecureProxyEndpoint(): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/secure-model-proxy`;
}

function getLocalUserRouteProxyEndpoint(): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/user-route-proxy`;
}

function getLocalSystemProxyEndpoint(): string {
  return `${resolveKkApiBaseUrl().replace(/\/+$/, '')}/api/v1/model-proxy/system`;
}

function shouldUseLocalSystemProxy(): boolean {
  return shouldUseLegacyWebApiFallback();
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
  responseBody = ''
): SecureProxyBoundaryError {
  return buildSecureProxyBoundaryError(SECURE_PROXY_SESSION_REAUTH_MESSAGE, {
    code: SECURE_PROXY_SESSION_REAUTH_CODE,
    status: 401,
    responseBody,
    feature,
  });
}

function buildCloudSessionError(feature: string): SecureProxyBoundaryError {
  if (tempUserService.getCachedTempUser()) {
    return buildSecureProxyBoundaryError(SECURE_PROXY_GUEST_MODE_MESSAGE, {
      code: SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE,
      status: 403,
      feature,
    });
  }

  return buildSecureProxyBoundaryError(SECURE_PROXY_SESSION_REAUTH_MESSAGE, {
    code: SECURE_PROXY_SESSION_REAUTH_CODE,
    status: 401,
    feature,
  });
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

  return Boolean(
    session?.access_token
    && (expiresAtMs <= 0 || expiresAtMs > Date.now() + 60_000),
  );
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
  const session = await readCloudSession(feature);
  const shouldForceRefresh = options.forceRefresh === true;

  if (!shouldForceRefresh && hasUsableCloudSession(session)) {
    return {
      accessToken: session.access_token,
    };
  }

  const resolvedSession = await recoverCloudSession(feature);
  if (!resolvedSession?.accessToken && !shouldForceRefresh && session?.access_token) {
    return {
      accessToken: session.access_token,
    };
  }

  if (!resolvedSession?.accessToken) {
    // secure-model-proxy is backed by Supabase auth and must never use the
    // legacy compatibility token from the web API login flow. If we fail to
    // recover a valid cloud session here, surface a reauth error without
    // force-clearing the browser's local session cache.
    await invalidateCloudSession(`Unable to recover Supabase session for ${feature}`);
    throw buildCloudSessionError(feature);
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
    return buildSessionReauthError(feature, responseBody);
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

async function invokeSecureSystemProxyHttp(
  accessToken: string,
  body: Record<string, unknown>
): Promise<SecureProxyInvokeResult> {
  const response = await fetchWithTransientProxyRetry(getSecureProxyEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  }, 'secure-model-proxy');

  let data: any = null;
  let parseError: Error | null = null;

  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { error: text } : null;
    }
  } catch (error) {
    parseError = error instanceof Error ? error : new Error(String(error));
  }

  if (!response.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : parseError?.message || `secure-model-proxy request failed with status ${response.status}`;

    return {
      data,
      error: new Error(message),
      response,
    };
  }

  if (parseError) {
    return {
      data: null,
      error: parseError,
      response,
    };
  }

  return {
    data,
    error: null,
    response,
  };
}

async function invokeSecureSystemProxy(
  feature: string,
  body: Record<string, unknown>
): Promise<any> {
  const invokeWithToken = async (accessToken: string): Promise<SecureProxyInvokeResult> => {
    try {
      return await invokeSecureSystemProxyHttp(accessToken, body);
    } catch (error) {
      if (isRetryableProxyFetchError(error)) {
        throw buildSecureProxyBoundaryError('System proxy is temporarily unavailable. Please try again.', {
          status: 502,
          feature,
        });
      }

      throw error;
    }
  };

  const session = await resolveCloudSession(feature);
  let result = await invokeWithToken(session.accessToken);

  if (result.response?.status === 401) {
    try {
      console.warn('[secureModelProxy] Proxy returned 401, forcing session refresh before retry');
      const recoveredSession = await resolveCloudSession(feature, { forceRefresh: true });
      if (recoveredSession.accessToken) {
        result = await invokeWithToken(recoveredSession.accessToken);
      }
    } catch (error) {
      console.warn('[secureModelProxy] Cloud session recovery failed after proxy 401:', error);
    }
  }

  if (result.error) {
    throw await buildInvocationError(feature, result.error, result.response);
  }

  if (!result.data?.success) {
    throw new Error(result.data?.error || 'System proxy returned error');
  }

  return result.data;
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

async function invokeLocalUserRouteProxyHttp(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<LocalUserRouteProxyHttpResult> {
  const response = await fetchWithTransientProxyRetry(getLocalUserRouteProxyEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  }, 'user-route-proxy');

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
  const session = await resolveCloudSession(feature);

  let result: LocalUserRouteProxyHttpResult;
  try {
    result = await invokeLocalUserRouteProxyHttp(session.accessToken, body);
  } catch (error: any) {
    throw buildSecureProxyBoundaryError(
      isRetryableProxyFetchError(error)
        ? 'User-route proxy is temporarily unavailable. Please try again.'
        : error?.message || 'Failed to reach the user-route proxy.',
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
    try {
      console.warn('[secureModelProxy] User-route proxy returned 401/Invalid JWT, forcing session refresh before retry');
      const recoveredSession = await resolveCloudSession(feature, { forceRefresh: true });
      if (recoveredSession.accessToken) {
        result = await invokeLocalUserRouteProxyHttp(recoveredSession.accessToken, body);
      }
    } catch (error) {
      console.warn('[secureModelProxy] Cloud session recovery failed after user-route proxy 401:', error);
      if (isSecureProxySessionReauthError(error) || isSecureProxyGuestModeError(error)) {
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
      // Preserve the current local session for the same reason as the secure
      // system proxy path above: a backend-side auth mismatch should not kick
      // the user back to the login screen while their browser session still exists.
      throw buildSessionReauthError(feature, result.responseBody);
    }

    throw buildSecureProxyBoundaryError(errorMessage, {
      code: errorCode === LOCAL_USER_ROUTE_NOT_FOUND_CODE
        ? LOCAL_USER_ROUTE_NOT_FOUND_CODE
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

  const session = await resolveCloudSession(feature);
  let result = await invokeWithToken(session.accessToken);

  if (result.response?.status === 401 || isInvalidJwtResponse(result.responseBody, result.payload)) {
    try {
      console.warn('[secureModelProxy] Local system proxy returned 401/Invalid JWT, forcing session refresh before retry');
      const recoveredSession = await resolveCloudSession(feature, { forceRefresh: true });
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
      throw buildSessionReauthError(feature, result.responseBody);
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

  if (shouldUseLocalSystemProxy()) {
    await invokeLocalSystemProxy('task cancel', {
      mode: 'cancel_task',
      taskId,
    });

    return true;
  }

  await invokeSecureSystemProxy('task cancel', {
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

  if (shouldUseLocalSystemProxy()) {
    await invokeLocalSystemProxy('task delete', {
      mode: 'delete_task',
      taskId,
    });

    return true;
  }

  await invokeSecureSystemProxy('task delete', {
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

  if (shouldUseLocalSystemProxy()) {
    const data = await invokeLocalSystemProxy('task download', {
      mode: 'download_task',
      taskId,
    });

    return String(data.url || '');
  }

  const data = await invokeSecureSystemProxy('task download', {
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

  const data = shouldUseLocalSystemProxy()
    ? await invokeLocalSystemProxy('chat generation', {
      mode: 'chat',
      modelId: payload.modelId,
      messages: normalizedMessages,
      temperature: payload.temperature,
      maxTokens: payload.maxTokens,
      stream: payload.stream ?? false,
    })
    : await invokeSecureSystemProxy('chat generation', {
      mode: 'chat',
      modelId: payload.modelId,
      userRoute: payload.userRoute,
      messages: normalizedMessages,
      temperature: payload.temperature,
      maxTokens: payload.maxTokens,
      stream: payload.stream ?? false,
    });

  return {
    content: data.content || '',
    deducted: Boolean(data.deducted),
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
    messages: normalizedMessages,
    temperature: payload.temperature,
    maxTokens: payload.maxTokens,
    stream: payload.stream ?? false,
  });

  return {
    content: data.content || '',
    deducted: Boolean(data.deducted),
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

  const data = shouldUseLocalSystemProxy()
    ? await invokeLocalSystemProxy('image generation', {
      mode: 'image',
      modelId: payload.modelId,
      prompt: payload.prompt,
      aspectRatio: payload.aspectRatio,
      imageSize: payload.imageSize,
      imageCount: payload.imageCount ?? 1,
      referenceImages: payload.referenceImages ?? [],
    })
    : await invokeSecureSystemProxy('image generation', {
      mode: 'image',
      modelId: payload.modelId,
      userRoute: payload.userRoute,
      prompt: payload.prompt,
      aspectRatio: payload.aspectRatio,
      imageSize: payload.imageSize,
      imageCount: payload.imageCount ?? 1,
      referenceImages: payload.referenceImages ?? [],
    });

  return {
    urls: Array.isArray(data.urls) ? data.urls : [],
    deducted: Boolean(data.deducted),
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
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    imageSize: payload.imageSize,
    imageCount: payload.imageCount ?? 1,
    referenceImages: payload.referenceImages ?? [],
  });

  return {
    urls: Array.isArray(data.urls) ? data.urls : [],
    deducted: Boolean(data.deducted),
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

  const data = shouldUseLocalSystemProxy()
    ? await invokeLocalSystemProxy('video generation', {
      mode: 'video',
      modelId: payload.modelId,
      prompt: payload.prompt,
      aspectRatio: payload.aspectRatio,
      resolution: payload.resolution,
      duration: payload.duration,
      videoDuration: payload.videoDuration,
      imageUrl: payload.imageUrl,
      imageTailUrl: payload.imageTailUrl,
    })
    : await invokeSecureSystemProxy('video generation', {
      mode: 'video',
      modelId: payload.modelId,
      userRoute: payload.userRoute,
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
    deducted: Boolean(data.deducted),
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
    deducted: Boolean(data.deducted),
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

  const data = shouldUseLocalSystemProxy()
    ? await invokeLocalSystemProxy('audio generation', {
      mode: 'audio',
      modelId: payload.modelId,
      prompt: payload.prompt,
    })
    : await invokeSecureSystemProxy('audio generation', {
      mode: 'audio',
      modelId: payload.modelId,
      userRoute: payload.userRoute,
      prompt: payload.prompt,
    });

  return {
    url: data.url || '',
    deducted: Boolean(data.deducted),
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
    prompt: payload.prompt,
  });

  return {
    url: data.url || '',
    deducted: Boolean(data.deducted),
    usage: data.usage,
    endpointType: data.endpointType,
  };
}

export async function checkSecureSystemProxyTaskStatus(taskId: string): Promise<SecureProxyTaskStatusResponse> {
  const data = shouldUseLocalSystemProxy()
    ? await invokeLocalSystemProxy('task status', {
      mode: 'task_status',
      taskId,
    })
    : await invokeSecureSystemProxy('task status', {
      mode: 'task_status',
      taskId,
    });

  return {
    status: data.status || 'pending',
    url: data.url,
    deducted: Boolean(data.deducted),
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
    deducted: Boolean(data.deducted),
  };
}
