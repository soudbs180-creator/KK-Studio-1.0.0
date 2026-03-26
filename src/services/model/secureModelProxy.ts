import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase';
import { tempUserService } from '../auth/tempUserService';
import { clearStoredAdminSession } from '../api/adminSession';
import { setKkApiAccessToken } from '../api/kkApiClient';

export interface SecureProxyChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SecureProxyChatRequest {
  modelId: string;
  messages: SecureProxyChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface SecureProxyChatResponse {
  content: string;
  deducted?: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  endpointType?: 'openai' | 'gemini';
}

export interface SecureProxyImageRequest {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  imageCount?: number;
  referenceImages?: Array<string | { data: string; mimeType: string }>;
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
  endpointType?: 'openai' | 'gemini';
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
}

export interface SecureProxyVideoResponse {
  taskId: string;
  status: 'pending' | 'success' | 'failed';
  url?: string;
  deducted?: boolean;
  endpointType?: 'openai' | 'gemini';
}

export interface SecureProxyAudioRequest {
  modelId: string;
  prompt: string;
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
  endpointType?: 'openai' | 'gemini';
}

export interface SecureProxyTaskStatusResponse {
  status: 'pending' | 'success' | 'failed';
  url?: string;
  deducted?: boolean;
}

export const SECURE_PROXY_SESSION_REAUTH_CODE = 'SESSION_REAUTH_REQUIRED';
export const SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE = 'GUEST_MODE_UNAVAILABLE';
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

type SecureProxyBoundaryErrorCode =
  | typeof SECURE_PROXY_SESSION_REAUTH_CODE
  | typeof SECURE_PROXY_GUEST_MODE_UNAVAILABLE_CODE;

type SecureProxyBoundaryError = Error & {
  code?: SecureProxyBoundaryErrorCode;
  status?: number;
  responseBody?: string;
  feature?: string;
};

let forcedReauthPromise: Promise<void> | null = null;

function getSecureProxyEndpoint(): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/secure-model-proxy`;
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

async function forceSecureProxyReauth(): Promise<void> {
  if (forcedReauthPromise) {
    return forcedReauthPromise;
  }

  forcedReauthPromise = (async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('[secureModelProxy] signOut failed during forced reauth:', error);
    }

    try {
      setKkApiAccessToken(undefined);
    } catch (error) {
      console.warn('[secureModelProxy] Failed to clear compatibility access token:', error);
    }

    try {
      clearStoredAdminSession();
    } catch (error) {
      console.warn('[secureModelProxy] Failed to clear stored admin session:', error);
    }

    try {
      tempUserService.clearCachedTempUser();
    } catch (error) {
      console.warn('[secureModelProxy] Failed to clear cached temp user:', error);
    }
  })().finally(() => {
    forcedReauthPromise = null;
  });

  return forcedReauthPromise;
}

async function buildSessionReauthError(
  feature: string,
  responseBody = ''
): Promise<SecureProxyBoundaryError> {
  await forceSecureProxyReauth();
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

async function resolveCloudSession(feature: string): Promise<CloudSessionResolution> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message || `Unable to verify login state for ${feature}.`);
  }

  let activeSession = session;
  const expiresAtMs = typeof activeSession?.expires_at === 'number'
    ? activeSession.expires_at * 1000
    : 0;
  const shouldRefresh = !activeSession?.access_token
    || (expiresAtMs > 0 && expiresAtMs <= Date.now() + 60_000);

  if (shouldRefresh) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('[secureModelProxy] refreshSession failed:', refreshError);
    }
    activeSession = !refreshError && refreshData.session?.access_token
      ? refreshData.session
      : null;
  }

  if (!activeSession?.access_token) {
    // secure-model-proxy is backed by Supabase auth and must never use the
    // legacy compatibility token from the web API login flow.
    const sessionError = buildCloudSessionError(feature);
    if (isSecureProxySessionReauthError(sessionError)) {
      await forceSecureProxyReauth();
    }
    throw sessionError;
  }

  return {
    accessToken: activeSession.access_token,
  };
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
  const response = await fetch(getSecureProxyEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

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
  const invokeWithToken = async (accessToken: string): Promise<SecureProxyInvokeResult> => (
    invokeSecureSystemProxyHttp(accessToken, body)
  );

  const session = await resolveCloudSession(feature);
  let result = await invokeWithToken(session.accessToken);

  if (result.response?.status === 401) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('[secureModelProxy] retry refreshSession failed:', refreshError);
    }
    if (!refreshError && refreshData.session?.access_token) {
      result = await invokeWithToken(refreshData.session.access_token);
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

export async function cancelSecureSystemProxyTask(taskId: string): Promise<boolean> {
  await invokeSecureSystemProxy('task cancel', {
    mode: 'cancel_task',
    taskId,
  });

  return true;
}

export async function deleteSecureSystemProxyTask(taskId: string): Promise<boolean> {
  await invokeSecureSystemProxy('task delete', {
    mode: 'delete_task',
    taskId,
  });

  return true;
}

export async function downloadSecureSystemProxyTaskContent(taskId: string): Promise<string> {
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
  const normalizedMessages = payload.messages.map((message) => ({
    role: message.role,
    content: normalizeMessageContent(message.content),
  }));

  const data = await invokeSecureSystemProxy('chat generation', {
    mode: 'chat',
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
  const data = await invokeSecureSystemProxy('image generation', {
    mode: 'image',
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
  const data = await invokeSecureSystemProxy('video generation', {
    mode: 'video',
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
  const data = await invokeSecureSystemProxy('audio generation', {
    mode: 'audio',
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
  const data = await invokeSecureSystemProxy('task status', {
    mode: 'task_status',
    taskId,
  });

  return {
    status: data.status || 'pending',
    url: data.url,
    deducted: Boolean(data.deducted),
  };
}
