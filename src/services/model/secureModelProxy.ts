import { supabase } from '../../lib/supabase';
import { tempUserService } from '../auth/tempUserService';

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

type SecureProxyInvokeResult = {
  data: any;
  error: any;
  response?: Response;
};

type CloudSessionResolution = {
  accessToken: string;
};

function buildCloudSessionError(feature: string): Error {
  if (tempUserService.getCachedTempUser()) {
    return new Error('Guest mode does not have a real Supabase session, so cloud sync and system credit models are unavailable.');
  }

  return new Error(`Please sign in before using ${feature}.`);
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
    if (!refreshError && refreshData.session?.access_token) {
      activeSession = refreshData.session;
    }
  }

  if (!activeSession?.access_token) {
    throw buildCloudSessionError(feature);
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
    message = `System credit ${feature} failed because your login session expired. Please sign in again and retry.`;
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

  const normalized = new Error(message);
  if (status !== undefined) {
    (normalized as Error & { status?: number }).status = status;
  }
  if (responseBody) {
    (normalized as Error & { responseBody?: string }).responseBody = responseBody;
  }

  return normalized;
}

async function invokeSecureSystemProxy(
  feature: string,
  body: Record<string, unknown>
): Promise<any> {
  const invokeWithToken = async (accessToken: string): Promise<SecureProxyInvokeResult> => (
    supabase.functions.invoke('secure-model-proxy', {
      body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  );

  const session = await resolveCloudSession(feature);
  let result = await invokeWithToken(session.accessToken);

  if (result.response?.status === 401) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
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
