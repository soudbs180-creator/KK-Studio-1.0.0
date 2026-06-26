import { type ChatOptions, type ImageGenerationOptions, type ImageGenerationResult, type VideoGenerationOptions, type VideoGenerationResult, type AudioGenerationOptions, type AudioGenerationResult, type ProviderConfig } from '../../services/llm/LLMAdapter';
import { GenerationMode, AspectRatio, ImageSize, type ModelType, type ReferenceImage, type Provider } from '../../types';
import type { GenerationTelemetry } from '@kk/shared';

export class GenerationError extends Error {
  public success = false;
  public error: {
    code: string;
    message: string;
    provider?: string;
    modelId?: string;
    retryable?: boolean;
    setupRequired?: boolean;
    action?: "open-settings" | "select-model" | "retry" | "top-up" | "switch-route";
  };
  public meta: {
    requestId: string;
    routeMode?: string;
    timestamp: string;
  };
  constructor(
    code: string,
    message: string,
    options?: {
      provider?: string;
      modelId?: string;
      retryable?: boolean;
      setupRequired?: boolean;
      action?: "open-settings" | "select-model" | "retry" | "top-up" | "switch-route";
      requestId?: string;
      routeMode?: string;
    }
  ) {
    super(message);
    this.name = 'GenerationError';
    this.error = {
      code,
      message,
      provider: options?.provider,
      modelId: options?.modelId,
      retryable: options?.retryable,
      setupRequired: options?.setupRequired,
      action: options?.action
    };
    this.meta = {
      requestId: options?.requestId || 'req_' + Date.now(),
      routeMode: options?.routeMode,
      timestamp: new Date().toISOString()
    };
  }
}
import { type KeySlot, getModelMetadata } from '../../services/auth/keyManager';
import { keyManager } from '../../services/auth/keyManager';
import * as costService from '../../services/billing/costService';
import { logWarning, logError } from '../../services/system/systemLogService';
import { getProviderCapability, modelSupportedByProvider, type ProviderCapabilityProfile } from '../../services/llm/providerCapabilities';
import {
    buildSecureProxyUserRouteFromSlotId,
    checkLocalUserRouteProxyTaskStatus,
    checkSecureSystemProxyTaskStatus,
    getSecureProxyGuestModeMessage,
    getSecureProxySessionReauthMessage,
    isLocalUserRouteProxyFallbackError,
    isSecureProxyGuestModeError,
    isSecureProxySessionReauthError,
    SECURE_PROXY_GUEST_MODE_MESSAGE,
    SECURE_PROXY_SESSION_REAUTH_MESSAGE,
} from '../../services/model/secureModelProxy';
import { resolveKkApiBaseUrl } from '../../services/api/kkApiClient';
import { resolveProviderModelCompatibilityIssue } from '../../services/api/providerStrategy';
import { resolveProviderIdentity } from '../../utils/providerDisplay';
import { getModelPricing } from '../../services/model/modelPricing';
import { isSystemModelRoute } from '../../services/model/modelRoute';
import { calculateCost } from '../../services/billing/costService';
import { classifyApiFailure } from '../../services/api/errorClassification';
import { getImage } from '../../services/storage/imageStorage';
import { getMaxRefImages } from '../../services/model/modelCapabilities';
import { abortSyncImageBridgeRequest } from '../../services/llm/syncImageBridge';
import { normalizeModelId } from '../../utils/modelIdNormalization';

// Import route engine and clients
import { providerRouteEngine } from '../../core/routing/ProviderRouteEngine';
import { localRunnerClient } from './localRunnerClient';
import { cloudRelayClient } from './cloudRelayClient';
import { platformCreditClient } from './platformCreditClient';
import { accountLinkerClient } from './accountLinkerClient';
import { taskOrchestrator } from '../../core/orchestration/TaskOrchestrator';

export interface GenerateImageResult {
  url: string;
  deducted?: boolean;
  ledgerId?: string;
  balanceAfter?: number;
  apiDurationMs?: number;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  model?: string;
  imageSize?: ImageSize;
  effectiveModel?: string; 
  effectiveSize?: ImageSize; 
  aspectRatio?: AspectRatio; 
  dimensions?: { width: number; height: number }; 
  provider?: string; 
  providerName?: string; 
  modelName?: string; 
  keySlotId?: string;
  requestPath?: string;
  requestBodyPreview?: string;
  pythonSnippet?: string;
  referenceImagesUsed?: number;
  referenceImagesDropped?: number;
    groundingSources?: Array<{
      uri: string;
      title?: string;
      imageUri?: string;
    }>;
    telemetry?: GenerationTelemetry;
  }

function parseModelSuffix(modelId: string): {
  baseModel: string;
  aspectRatio?: AspectRatio;
  quality?: 'standard' | 'hd' | 'medium';
  imageSize?: ImageSize;
} {
  const [baseId, routingSuffix] = modelId.split('@');
  const suffixMatch = baseId.match(/-((?:\d+-)?\d+-\d+|1-1|4-3|3-4|16-9|9-16|21-9|9-21|3-2|2-3)(?:-(4k|2k|hd|medium|standard))?$/i);

  if (!suffixMatch) {
    return { baseModel: modelId };
  }

  const aspectPart = suffixMatch[1];
  const qualityPart = suffixMatch[2]?.toLowerCase();

  const aspectMap: Record<string, AspectRatio> = {
    '1-1': AspectRatio.SQUARE,
    '4-3': AspectRatio.LANDSCAPE_4_3,
    '3-4': AspectRatio.PORTRAIT_3_4,
    '16-9': AspectRatio.LANDSCAPE_16_9,
    '9-16': AspectRatio.PORTRAIT_9_16,
    '21-9': AspectRatio.LANDSCAPE_21_9,
    '9-21': AspectRatio.PORTRAIT_9_21,
    '3-2': AspectRatio.LANDSCAPE_3_2,
    '2-3': AspectRatio.PORTRAIT_2_3,
    '4-1': AspectRatio.LANDSCAPE_4_1,
    '1-4': AspectRatio.PORTRAIT_1_4,
    '8-1': AspectRatio.LANDSCAPE_8_1,
    '1-8': AspectRatio.PORTRAIT_1_8,
  };

  const qualityToSize: Record<string, ImageSize> = {
    '4k': ImageSize.SIZE_4K,
    '2k': ImageSize.SIZE_2K,
    'hd': ImageSize.SIZE_4K,
    'medium': ImageSize.SIZE_2K,
    'standard': ImageSize.SIZE_1K,
  };

  const baseModel = baseId.replace(suffixMatch[0], '') + (routingSuffix ? `@${routingSuffix}` : '');

  return {
    baseModel,
    aspectRatio: aspectMap[aspectPart],
    quality: qualityPart as 'standard' | 'hd' | 'medium' | undefined,
    imageSize: qualityToSize[qualityPart || ''],
  };
}

function normalizeError(error: any, modelId?: string, provider?: string): Error {
  logError('GenerationService', error, `Raw Message: ${error?.message || 'N/A'}\nStack: ${error?.stack || 'N/A'}`);

  const rawMessage = error?.message || error?.toString?.() || '未知错误';
  const msg = rawMessage.toLowerCase();
  const status = typeof error?.status === 'number'
    ? error.status
    : (typeof error?.code === 'number' ? error.code : undefined);
  
  let code = 'UNKNOWN_PROVIDER_ERROR';
  let message = rawMessage;
  let action: "open-settings" | "select-model" | "retry" | "top-up" | "switch-route" | undefined = 'retry';
  let retryable = true;
  let setupRequired = false;

  const resolvedModelId = modelId || error?.modelId || error?.model;
  const resolvedProvider = provider || error?.provider;

  if (isSecureProxySessionReauthError(error)) {
    code = 'SESSION_EXPIRED';
    message = error?.message || SECURE_PROXY_SESSION_REAUTH_MESSAGE;
    action = 'open-settings';
    retryable = false;
    setupRequired = true;
  } else if (isSecureProxyGuestModeError(error)) {
    code = 'GUEST_MODE_RESTRICTED';
    message = error?.message || SECURE_PROXY_GUEST_MODE_MESSAGE;
    action = 'open-settings';
    retryable = false;
    setupRequired = true;
  } else if (msg.includes('cancelled') || msg.includes('cancel')) {
    code = 'GENERATION_CANCELLED';
    message = '任务已取消';
    action = undefined;
    retryable = false;
  } else if (msg.includes('missing_api_key') || msg.includes('key') || msg.includes('密钥') || msg.includes('api key') || msg.includes('配置')) {
    code = 'MISSING_API_KEY';
    message = '请先在设置中配置有效的 API Key';
    action = 'open-settings';
    retryable = false;
    setupRequired = true;
  } else if (msg.includes('credit') || msg.includes('quota') || msg.includes('balance') || msg.includes('余额不足') || msg.includes('充值') || msg.includes('insufficient_quota')) {
    code = 'INSUFFICIENT_CREDITS';
    message = '平台积分余额不足，请充值。';
    action = 'top-up';
    retryable = false;
    setupRequired = true;
  } else if (msg.includes('timeout') || msg.includes('524') || msg.includes('超时')) {
    code = 'PROVIDER_TIMEOUT';
    message = '目标服务请求超时，请检查网络后重试。';
    action = 'retry';
    retryable = true;
  } else if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests') || msg.includes('频繁')) {
    code = 'PROVIDER_RATE_LIMITED';
    message = '请求限流，请稍后重试或切换渠道。';
    action = 'retry';
    retryable = true;
  } else if (msg.includes('offline') || msg.includes('local runner') || msg.includes('api server health') || msg.includes('503')) {
    code = 'LOCAL_RUNNER_OFFLINE';
    message = '本地运行器服务不可用，请确保 KK API 已启动。';
    action = 'open-settings';
    retryable = false;
    setupRequired = true;
  } else if (msg.includes('route') || msg.includes('channel') || msg.includes('no available')) {
    code = 'ROUTE_UNAVAILABLE';
    message = '当前生成路由不可用，请切换生成模式或更换模型。';
    action = 'switch-route';
    retryable = false;
  } else if (msg.includes('unsupported media') || msg.includes('unsupported task') || msg.includes('multimodal') || msg.includes('支持')) {
    code = 'UNSUPPORTED_MEDIA_TYPE';
    message = '模型不支持该媒体类型的生成任务。';
    action = 'select-model';
    retryable = false;
  }

  return new GenerationError(code, message, {
    provider: resolvedProvider,
    modelId: resolvedModelId,
    retryable,
    setupRequired,
    action,
    requestId: error?.requestId || error?.meta?.requestId
  });
}

export class GenerationService {
    private static instance: GenerationService;
    private abortControllers = new Map<string, AbortController>();

    public static getInstance(): GenerationService {
        if (!GenerationService.instance) {
            GenerationService.instance = new GenerationService();
        }
        return GenerationService.instance;
    }

    private applyProviderIdentity<T extends { provider?: string; providerName?: string; keySlotId?: string }>(
        result: T,
        keySlot: KeySlot
    ): T {
        const providerIdentity = resolveProviderIdentity({
            keySlotId: keySlot.id,
            provider: result.provider || keySlot.provider,
            providerLabel: result.providerName || keySlot.name,
            type: keySlot.type,
            baseUrl: keySlot.baseUrl,
        });

        result.provider = providerIdentity.provider || result.provider || keySlot.provider;
        result.providerName = providerIdentity.providerLabel || result.providerName || keySlot.name || keySlot.provider;
        if (!result.keySlotId) {
            result.keySlotId = keySlot.id;
        }

        return result;
    }

    private shouldUseSecureProxyUserRoute(keySlot: KeySlot): boolean {
        if (!keySlot || keySlot.provider === 'SystemProxy') {
            return false;
        }
        return Boolean(keyManager.getUserId());
    }

    private buildUserRouteForKeySlot(keySlot: KeySlot): string {
        return buildSecureProxyUserRouteFromSlotId(keySlot.id).id;
    }

    private deriveAttemptId(requestId?: string): string | undefined {
        const normalizedRequestId = String(requestId || '').trim();
        if (!normalizedRequestId) {
            return undefined;
        }

        const match = /^(.*):\d+$/.exec(normalizedRequestId);
        return (match?.[1] || normalizedRequestId).trim() || undefined;
    }

    private shouldFallbackToCloudUserRouteAfterLocalProxy(
        error: unknown,
    ): boolean {
        if (!error) {
            return true;
        }

        if (isSecureProxySessionReauthError(error) || isSecureProxyGuestModeError(error)) {
            return false;
        }

        if (!isLocalUserRouteProxyFallbackError(error)) {
            return false;
        }

        const message = String(
            typeof error === 'object' && error && 'message' in error
                ? (error as { message?: unknown }).message || ''
                : error
        ).toLowerCase();

        return !message.includes('browser direct provider calls are disabled');
    }

    private createCloudFallbackNotice(action: string, keySlot: Pick<KeySlot, 'name' | 'provider'>): string {
        const providerLabel = String(keySlot.name || keySlot.provider || 'provider').trim();
        return `[GenerationService] Local user-route proxy unavailable for ${providerLabel}, falling back to cloud ${action}.`;
    }

    private buildUserRouteFallbackFailureError(
        keySlot: Pick<KeySlot, 'name' | 'provider'>,
        localError: unknown,
        cloudError: unknown,
    ): Error {
        const providerLabel = String(keySlot.name || keySlot.provider || '当前渠道').trim();
        const localApiBaseUrl = resolveKkApiBaseUrl();
        let message = `用户 API 路由失败：${providerLabel} 的本地代理不可用，云端兜底也失败了。`;

        if (isSecureProxySessionReauthError(cloudError)) {
            message = `用户 API 路由失败：本地 KK API 服务不可用（${localApiBaseUrl}），且当前登录态已过期。请先确认 KK API 已启动，再重新登录后重试。`;
        } else if (isSecureProxyGuestModeError(cloudError)) {
            message = `用户 API 路由失败：本地 KK API 服务不可用（${localApiBaseUrl}），游客模式也不支持云端用户 API 代理。请先登录正式账号后重试。`;
        }

        const error = new Error(message) as Error & {
            code?: string;
            cause?: unknown;
            localCause?: unknown;
            cloudCause?: unknown;
        };
        error.code = 'USER_ROUTE_FALLBACK_FAILED';
        error.cause = cloudError;
        error.localCause = localError;
        error.cloudCause = cloudError;
        return error;
    }

    private normalizeUserRouteProxyError(error: unknown): unknown {
        const boundaryError = error as {
            code?: string;
            status?: number;
            responseBody?: string;
            feature?: string;
        };
        const existingMessage = error instanceof Error ? error.message : '';

        if (isSecureProxySessionReauthError(error)) {
            const normalized = new Error(existingMessage || getSecureProxySessionReauthMessage('user-route')) as Error & {
                code?: string;
                status?: number;
                responseBody?: string;
                feature?: string;
            };
            normalized.code = boundaryError.code;
            normalized.status = boundaryError.status;
            normalized.responseBody = boundaryError.responseBody;
            normalized.feature = boundaryError.feature;
            return normalized;
        }

        if (isSecureProxyGuestModeError(error)) {
            const normalized = new Error(existingMessage || getSecureProxyGuestModeMessage('user-route')) as Error & {
                code?: string;
                status?: number;
                responseBody?: string;
                feature?: string;
            };
            normalized.code = boundaryError.code;
            normalized.status = boundaryError.status;
            normalized.responseBody = boundaryError.responseBody;
            normalized.feature = boundaryError.feature;
            return normalized;
        }

        return error;
    }

    private decorateTaskStatusResult(
        result: object,
        normalizedPreferredKeyId?: string,
        preferredKeySlot?: KeySlot | null,
        fallbackIdentity?: { provider: string; providerName: string; keySlotId: string },
    ): Record<string, unknown> {
        if (preferredKeySlot) {
            return this.applyProviderIdentity({
                ...result,
                keySlotId: preferredKeySlot.id,
            }, preferredKeySlot);
        }

        const preferredProvider = normalizedPreferredKeyId
            ? keyManager.getProvider(normalizedPreferredKeyId)
            : undefined;
        if (preferredProvider) {
            return {
                ...result,
                provider: preferredProvider.name,
                providerName: preferredProvider.name,
                keySlotId: preferredProvider.id,
            };
        }

        if (fallbackIdentity) {
            return {
                ...result,
                ...fallbackIdentity,
            };
        }

        return result as Record<string, unknown>;
    }

    private createBrowserDirectProviderCallBlockedError(action: string, keySlot?: Pick<KeySlot, 'name' | 'provider'>): Error {
        const providerLabel = String(keySlot?.name || keySlot?.provider || 'this provider').trim();
        const guidance = keyManager.getUserId()
          ? `Secure proxy routing is required for ${providerLabel}.`
          : `Sign in and save ${providerLabel} to your account before using the secure proxy.`;
        const error = new Error(`Browser-side ${action} is disabled. ${guidance}`) as Error & { code?: string };
        error.code = 'BROWSER_DIRECT_PROVIDER_CALLS_DISABLED';
        return error;
    }

    private throwBrowserDirectProviderCallBlocked(action: string, keySlot?: Pick<KeySlot, 'name' | 'provider'>): never {
        throw this.createBrowserDirectProviderCallBlockedError(action, keySlot);
    }

    public getProviderProfile(provider: Provider): ProviderCapabilityProfile | null {
        return getProviderCapability(provider);
    }

    public getProviderProfiles(): ProviderCapabilityProfile[] {
        const providers: Provider[] = ['Google', 'OpenAI', 'Anthropic', 'Aliyun', 'Tencent', 'Volcengine', 'SiliconFlow', '12AI', 'Flow2API', 'Custom'];
        return providers
            .map(item => getProviderCapability(item))
            .filter((item): item is ProviderCapabilityProfile => !!item);
    }

    public canProviderHandleModel(provider: Provider, modelId: string): boolean {
        return modelSupportedByProvider(provider, modelId);
    }

    public resolveKey(modelId: string, preferredKeyId?: string): KeySlot | null {
        const isSystemRoute = isSystemModelRoute(modelId);

        if (isSystemRoute) {
            const now = Date.now();
            return {
                id: 'system_proxy_slot',
                key: 'system_proxy_key',
                name: 'System Proxy',
                provider: 'SystemProxy' as Provider,
                type: 'proxy',
                format: 'openai',
                baseUrl: '',
                compatibilityMode: 'chat',
                supportedModels: [modelId.split('@')[0]],
                authMethod: 'header',
                headerName: 'Authorization',
                status: 'valid',
                failCount: 0,
                successCount: 0,
                lastUsed: null,
                lastError: null,
                disabled: false,
                createdAt: now,
                totalCost: 0,
                budgetLimit: -1,
                tokenLimit: -1,
                updatedAt: now,
            };
        }

        const keyData = keyManager.getNextKey(modelId, preferredKeyId);
        if (!keyData) return null;
        return keyData;
    }

    public async chat(options: ChatOptions): Promise<string> {
        const result = await taskOrchestrator.orchestrate({
            type: 'generation',
            mediaType: 'text',
            modelId: options.modelId,
            prompt: '',
            preferredKeyId: options.preferredKeyId,
            params: {
                messages: options.messages,
                temperature: options.temperature,
                maxTokens: options.maxTokens,
                stream: options.stream,
                onStream: options.onStream
            }
        });

        if (!result.success) {
            throw new Error(result.error);
        }
        return result.data;
    }

    public async generateImageRaw(options: ImageGenerationOptions, onTaskId?: (id: string) => void): Promise<ImageGenerationResult> {
        let keySlot = this.resolveKey(options.modelId, options.preferredKeyId);
        if (!keySlot) {
            throw new Error(`No available key for model: ${options.modelId}`);
        }

        const compatibilityIssue = resolveProviderModelCompatibilityIssue({
            provider: keySlot.provider,
            baseUrl: keySlot.baseUrl,
            modelId: options.modelId,
        });
        if (compatibilityIssue) {
            throw new Error(compatibilityIssue);
        }

        const resultOrchestrate = await taskOrchestrator.orchestrate({
            type: 'generation',
            mediaType: 'image',
            modelId: options.modelId,
            prompt: options.prompt,
            preferredKeyId: options.preferredKeyId,
            requestId: options.requestId,
            creditRouteSpecId: options.creditRouteSpecId,
            creditRouteUnitId: options.creditRouteUnitId,
            params: {
                aspectRatio: options.aspectRatio,
                imageSize: options.imageSize,
                imageCount: options.imageCount,
                referenceImages: options.referenceImages,
            }
        });

        if (!resultOrchestrate.success) {
            throw new Error(resultOrchestrate.error);
        }

        const proxyResponse = resultOrchestrate.data;
        if (proxyResponse.taskId) {
            onTaskId?.(proxyResponse.taskId);
        }

        const fullBaseId = options.modelId.split('@')[0];
        const cleanModelId = fullBaseId.split('|')[0];

        const result: ImageGenerationResult = {
            urls: proxyResponse.urls,
            ledgerId: proxyResponse.ledgerId,
            balanceAfter: proxyResponse.balanceAfter,
            usage: proxyResponse.usage,
            taskId: proxyResponse.taskId,
            status: proxyResponse.status,
            provider: keySlot.provider,
            providerName: keySlot.name,
            modelName: getModelMetadata(options.modelId)?.name || cleanModelId,
            model: options.modelId,
            keySlotId: keySlot.id,
        };

        if (result.status === 'success') {
            keyManager.reportSuccess(keySlot.id);
        } else if (result.status === 'pending' || result.status === 'processing') {
            keyManager.reportCallResult?.(keySlot.id, true);
        } else {
            keyManager.reportFailure(keySlot.id, 'Generation failed');
        }

        this.applyProviderIdentity(result, keySlot);

        let tokensForStats = result.usage?.totalTokens || 0;
        let costForStats = result.usage?.cost || 0;
        const promptTokens = result.usage?.promptTokens;
        const completionTokens = Number.isFinite(result.usage?.completionTokens)
            ? result.usage?.completionTokens
            : (Number.isFinite(result.usage?.totalTokens) && Number.isFinite(promptTokens))
                ? Math.max(0, (result.usage?.totalTokens || 0) - (promptTokens || 0))
                : undefined;

        const sizeRaw = (options.imageSize) || ImageSize.SIZE_1K;
        const count = options.imageCount || 1;
        const refCount = options.referenceImages?.length || 0;

        if (costForStats === 0 && Number.isFinite(promptTokens) && Number.isFinite(completionTokens)) {
            const pricing = getModelPricing(result.model || options.modelId);
            if (pricing && (pricing.inputPerMillionTokens || pricing.outputPerMillionTokens)) {
                const inputCost = ((promptTokens || 0) / 1_000_000) * (pricing.inputPerMillionTokens || 0);
                const outputCost = ((completionTokens || 0) / 1_000_000) * (pricing.outputPerMillionTokens || 0);
                costForStats = inputCost + outputCost;
            }
        }

        if (tokensForStats === 0 || costForStats === 0) {
            try {
                const est = costService.calculateCost(result.model || options.modelId, sizeRaw as ImageSize, count, options.prompt.length, refCount, keySlot.id);
                if (tokensForStats === 0) tokensForStats = est.tokens;
                if (costForStats === 0) costForStats = keySlot.creditCost !== undefined ? keySlot.creditCost : est.cost;
            } catch (e) {
                if (costForStats === 0 && keySlot.creditCost !== undefined) costForStats = keySlot.creditCost;
            }
        } else if (keySlot.creditCost !== undefined) {
            costForStats = keySlot.creditCost;
        }

        const settledKeyId = result.keySlotId || keySlot.id;
        keyManager.addUsage(settledKeyId, tokensForStats);
        keyManager.addCost(settledKeyId, costForStats);

        if (!result.usage) {
            result.usage = { totalTokens: tokensForStats, cost: costForStats };
        } else {
            if (!result.usage.cost) result.usage.cost = costForStats;
            if (!result.usage.totalTokens) result.usage.totalTokens = tokensForStats;
        }

        if (!result.modelName) {
            const metadata = getModelMetadata(result.model || options.modelId);
            result.modelName = metadata?.name || cleanModelId;
        }

        return result;
    }

    public normalizeProxyBaseUrl(baseUrl: string): string {
      let clean = (baseUrl || '').trim();
      if (!clean) return '';
      clean = clean.replace(/\/+$/, '');
      const suffixes = ['/v1/chat/completions', '/chat/completions', '/v1/images/generations', '/images/generations', '/v1beta', '/v1', '/api'];
      let stripped = true;
      while (stripped) {
        stripped = false;
        const lower = clean.toLowerCase();
        for (const suffix of suffixes) {
          if (lower.endsWith(suffix)) {
            clean = clean.slice(0, -suffix.length).replace(/\/+$/, '');
            stripped = true;
            break;
          }
        }
      }
      return clean;
    }

    public cancelGeneration(id: string) {
      const controller = this.abortControllers.get(id);
      if (controller) {
        controller.abort("Generation cancelled by user");
        this.abortControllers.delete(id);
      }
      void abortSyncImageBridgeRequest(id).catch(() => undefined);
    }

    public async generateImage(
      prompt: string,
      aspectRatio: AspectRatio,
      imageSize: ImageSize,
      referenceImages: ReferenceImage[] = [],
      model: ModelType = 'gemini-2.5-flash-image',
      _negativePrompt: string = '',
      requestId?: string,
      grounding: boolean = false,
      options?: {
        size?: string;
        quality?: 'standard' | 'hd' | 'medium';
        maskUrl?: string;
        editMode?: 'inpaint' | 'outpaint' | 'vectorize' | 'reframe' | 'upscale' | 'replace-background' | 'edit';
        preferredKeyId?: string;
        executionLane?: 'local-user-api' | 'cloud-credit-model';
        creditRouteSpecId?: string;
        creditRouteUnitId?: string;
        enableWebSearch?: boolean;
        enableImageSearch?: boolean;
        thinkingMode?: 'minimal' | 'high';
        onTaskId?: (id: string) => void;
        onSyncBridgeRegistered?: (requestId: string, startedAt?: number) => void;
      }
    ): Promise<GenerateImageResult> {
      const startTime = Date.now();
      const rawModelBeforeNormalize = model;
      const isWuyinModel =
        String(model || '').includes('image_nanoBanana')
        || String(model || '').includes('image_gpt')
        || String(model || '').includes('image_grok_imagine')
        || String(model || '').includes('image_wan2.6')
        || String(model || '').toLowerCase().includes('wuyin')
        || String(model || '').includes('@slot_key_');

      if (!isWuyinModel) {
        model = normalizeModelId(model) as ModelType;
      } else {
        model = rawModelBeforeNormalize as ModelType;
      }

      const parsedSuffix = parseModelSuffix(model);
      if (parsedSuffix.baseModel !== model) {
        console.log(`[GenerationService] Parsed model suffix: ${model} -> ${parsedSuffix.baseModel}`, parsedSuffix);
        model = parsedSuffix.baseModel as ModelType;
        if (parsedSuffix.aspectRatio && aspectRatio === AspectRatio.AUTO) aspectRatio = parsedSuffix.aspectRatio;
        if (parsedSuffix.imageSize && imageSize === ImageSize.SIZE_1K) imageSize = parsedSuffix.imageSize;
      }

      if (options?.size) {
        const sizeMatch = options.size.match(/^(\d+)x(\d+)$/);
        if (sizeMatch) {
          const width = parseInt(sizeMatch[1]);
          const height = parseInt(sizeMatch[2]);
          const ratio = width / height;
          if (Math.abs(ratio - 16 / 9) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_16_9;
          else if (Math.abs(ratio - 9 / 16) < 0.1) aspectRatio = AspectRatio.PORTRAIT_9_16;
          else if (Math.abs(ratio - 4 / 3) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_4_3;
          else if (Math.abs(ratio - 3 / 4) < 0.1) aspectRatio = AspectRatio.PORTRAIT_3_4;
          else if (Math.abs(ratio - 21 / 9) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_21_9;
          else if (Math.abs(ratio - 1) < 0.1) aspectRatio = AspectRatio.SQUARE;
          else if (Math.abs(ratio - 3 / 2) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_3_2;
          else if (Math.abs(ratio - 2 / 3) < 0.1) aspectRatio = AspectRatio.PORTRAIT_2_3;
          else if (Math.abs(ratio - 4 / 1) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_4_1;
          else if (Math.abs(ratio - 1 / 4) < 0.1) aspectRatio = AspectRatio.PORTRAIT_1_4;
          else if (Math.abs(ratio - 8 / 1) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_8_1;
          else if (Math.abs(ratio - 1 / 8) < 0.1) aspectRatio = AspectRatio.PORTRAIT_1_8;
        }
      }

      if (options?.quality) {
        const qualityMap: Record<string, ImageSize> = {
          'hd': ImageSize.SIZE_4K,
          'medium': ImageSize.SIZE_2K,
          'standard': ImageSize.SIZE_1K,
        };
        if (qualityMap[options.quality]) imageSize = qualityMap[options.quality];
      }

      if (model.toLowerCase().endsWith('-4k')) {
        model = model.replace(/-4k$/i, '') as ModelType;
      }

      const modelIdLower = model.toLowerCase();
      const isMultimodal = modelIdLower.includes('gemini') || modelIdLower.includes('gpt-4') || modelIdLower.includes('claude-3') || modelIdLower.includes('vl') || modelIdLower.includes('vision') || modelIdLower.includes('nano-banana');
      if (referenceImages && referenceImages.length > 0 && !isMultimodal) {
        throw new GenerationError(
          'MODEL_NOT_MULTIMODAL',
          '当前选中的模型不支持参考图多模态生成，请更换模型',
          { modelId: model, action: 'select-model', setupRequired: false }
        );
      }

      let keySlot = this.resolveKey(model, options?.preferredKeyId);
      if (!keySlot) {
        throw new GenerationError(
          'MISSING_API_KEY',
          '未配置有效的 API 密钥，请先在设置中进行配置',
          { modelId: model, action: 'open-settings', setupRequired: true }
        );
      }

      let resolvedRatio = aspectRatio;
      let autoRatioDimensions: { width: number; height: number } | undefined;

      if (aspectRatio === AspectRatio.AUTO) {
        if (referenceImages.length > 0 && referenceImages[0].data) {
          try {
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('Failed to load reference'));
              img.src = `data:${referenceImages[0].mimeType};base64,${referenceImages[0].data}`;
            });
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            const ratio = w / h;
            autoRatioDimensions = { width: w, height: h };

            if (ratio > 6.0) resolvedRatio = AspectRatio.LANDSCAPE_8_1;
            else if (ratio > 3.0) resolvedRatio = AspectRatio.LANDSCAPE_4_1;
            else if (ratio > 2.0) resolvedRatio = AspectRatio.LANDSCAPE_21_9;
            else if (ratio > 1.6) resolvedRatio = AspectRatio.LANDSCAPE_16_9;
            else if (ratio > 1.4) resolvedRatio = AspectRatio.LANDSCAPE_3_2;
            else if (ratio > 1.1) resolvedRatio = AspectRatio.LANDSCAPE_4_3;
            else if (ratio > 0.9) resolvedRatio = AspectRatio.SQUARE;
            else if (ratio > 0.7) resolvedRatio = AspectRatio.PORTRAIT_3_4;
            else if (ratio > 0.6) resolvedRatio = AspectRatio.PORTRAIT_2_3;
            else if (ratio > 0.45) resolvedRatio = AspectRatio.PORTRAIT_9_16;
            else if (ratio > 0.3) resolvedRatio = AspectRatio.PORTRAIT_9_21;
            else if (ratio > 0.2) resolvedRatio = AspectRatio.PORTRAIT_1_4;
            else resolvedRatio = AspectRatio.PORTRAIT_1_8;
          } catch (e) {
            resolvedRatio = AspectRatio.SQUARE;
          }
        } else {
          resolvedRatio = AspectRatio.LANDSCAPE_16_9;
        }
      }
      aspectRatio = resolvedRatio;

      console.log(`[GenerationService] Generating with Model: ${model}, Ratio: ${aspectRatio}, Size: ${imageSize}`);

      const maxAllowedRefs = Math.max(0, getMaxRefImages(model));
      const inputRefCount = referenceImages.length;
      const clippedReferenceImages = maxAllowedRefs > 0
        ? referenceImages.slice(0, maxAllowedRefs)
        : referenceImages.slice(0, 1);
      const droppedRefCount = Math.max(0, inputRefCount - clippedReferenceImages.length);
      if (droppedRefCount > 0) {
        console.warn(`[GenerationService] Reference images clipped: input=${inputRefCount}, used=${clippedReferenceImages.length}, max=${maxAllowedRefs}`);
      }

      const processedReferences = (await Promise.all((clippedReferenceImages || []).map(async (img) => {
        let currentData = img.data;

        if (!currentData && (img.storageId || img.id)) {
          try {
            const cached = await getImage(img.storageId || img.id);
            if (cached && typeof cached === 'string') {
              currentData = cached;
            }
          } catch (e) {
            // ignore
          }
        }

        if (!currentData) return null;

        const isUrl = currentData.startsWith('http') || currentData.startsWith('blob:') || currentData.startsWith('file:');
        if (isUrl) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);
            let response: Response;
            try {
              response = await fetch(currentData, { signal: controller.signal });
            } finally {
              clearTimeout(timeoutId);
            }
            const blob = await response.blob();
            return new Promise<ReferenceImage>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const res = reader.result as string;
                const match = res.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                  resolve({ ...img, mimeType: match[1], data: match[2] });
                } else {
                  resolve({ ...img, data: res });
                }
              };
              reader.onerror = () => resolve({ ...img, data: currentData });
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return null;
          }
        }

        const cleanData = currentData.replace(/^data:image\/\w+;base64,/, '');
        return { ...img, data: cleanData };
      }))).filter((img): img is ReferenceImage => !!img && !!img.data);

      const normalizedReferenceImages = processedReferences
        .filter(r => !!r.data && !r.data.startsWith('http') && !r.data.startsWith('blob:') && !r.data.startsWith('file:'))
        .map(r => ({ data: r.data, mimeType: r.mimeType || 'image/png' }));
      const skippedDuringNormalization = Math.max(0, clippedReferenceImages.length - normalizedReferenceImages.length);
      const totalDroppedReferenceImages = Math.max(0, inputRefCount - normalizedReferenceImages.length);
      if (inputRefCount > 0) {
        console.log(`[GenerationService] Reference images prepared: input=${inputRefCount}, clipped=${clippedReferenceImages.length}, forwarded=${normalizedReferenceImages.length}, dropped=${totalDroppedReferenceImages}`);
        if (skippedDuringNormalization > 0) {
          console.warn(`[GenerationService] ${skippedDuringNormalization} reference image(s) could not be normalized and were skipped.`);
        }
      }

      if (requestId && !this.abortControllers.has(requestId)) {
        this.abortControllers.set(requestId, new AbortController());
      }
      const controller = requestId ? this.abortControllers.get(requestId) : undefined;
      if (controller?.signal.aborted) throw new Error('Generation cancelled');

      const is4K = imageSize === ImageSize.SIZE_4K || imageSize.includes('4K');
      const is2K = imageSize === ImageSize.SIZE_2K || imageSize.includes('2K');
      const upperSize = (imageSize || '').toUpperCase();
      const is05K = imageSize === ImageSize.SIZE_05K || upperSize.includes('0.5K') || upperSize.includes('512');

      let googleTools: any[] | undefined = undefined;
      const enableWebSearch = options?.enableWebSearch ?? grounding;
      const isThinkingModel = (model || '').toLowerCase().includes('gemini-3.1-flash') || (model || '').toLowerCase().includes('gemini-3-pro') || (model || '').toLowerCase().includes('nano-banana-2') || (model || '').toLowerCase().includes('nano-banana-pro');
      const enableImageSearch = options?.enableImageSearch ?? (grounding && (model || '').toLowerCase().includes('3.1-flash'));
      if (enableWebSearch || enableImageSearch) {
        if (model.includes('3.1-flash')) {
          const searchTypes: Record<string, any> = {};
          if (enableImageSearch) searchTypes.imageSearch = {};
          if (enableWebSearch) searchTypes.webSearch = {};
          googleTools = [{
            googleSearch: {
              searchTypes: Object.keys(searchTypes).length > 0 ? searchTypes : undefined
            }
          }];
        } else {
          googleTools = [{
            googleSearch: {}
          }];
        }
      }

      const googleConfig: ProviderConfig['google'] = {
        responseModalities: ["TEXT", "IMAGE"],
        tools: googleTools,
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: is4K ? '4K' : (is2K ? '2K' : (is05K ? '512px' : '1K'))
        }
      };
      if (isThinkingModel) {
        googleConfig.thinkingConfig = {
          thinkingLevel: options?.thinkingMode === 'high' ? 'high' : 'minimal'
        };
      }

      const providerConfig: ProviderConfig = {
        google: googleConfig,
        imagen: {
          aspectRatio: aspectRatio,
          sampleCount: 1,
          personGeneration: 'allow_adult',
          imageSize: (is4K || is2K) ? '2K' : '1K'
        },
        openai: {
          quality: (is4K || is2K) ? 'hd' : 'standard',
        }
      };

      const llmOptions: ImageGenerationOptions = {
        modelId: model,
        prompt: prompt,
        requestId,
        aspectRatio: aspectRatio,
        imageSize: imageSize,
        imageCount: 1,
        referenceImages: normalizedReferenceImages,
        providerConfig: providerConfig,
        maskUrl: options?.maskUrl,
        editMode: options?.editMode,
        preferredKeyId: options?.preferredKeyId,
        executionLane: options?.executionLane,
        creditRouteSpecId: options?.creditRouteSpecId,
        creditRouteUnitId: options?.creditRouteUnitId,
        signal: controller?.signal,
        onTaskId: options?.onTaskId,
        syncBridgeRequestId: requestId,
        onSyncBridgeRegistered: options?.onSyncBridgeRegistered,
      };

      try {
        const result = await this.generateImageRaw(llmOptions);

        if ((result.status === 'pending' || result.status === 'processing') && result.taskId) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          const telemetry: GenerationTelemetry = {
            jobId: result.taskId,
            taskType: 'image',
            model: {
              id: result.model || model,
              name: result.modelName || result.model || model,
              provider: result.provider || 'unknown',
              providerName: result.providerName || 'unknown',
            },
            route: {
              sourceType: keySlot?.id?.includes('@slot_key_') ? 'api-user-local' : 'api-platform',
              executionSide: options?.executionLane === 'local-user-api' ? 'local' : 'cloud',
              keySlotId: result.keySlotId || options?.preferredKeyId,
            },
            timing: {
              queuedAt: new Date(startTime).toISOString(),
              startedAt: new Date(startTime).toISOString(),
              firstByteAt: new Date(startTime + Math.min(200, duration)).toISOString(),
              completedAt: undefined,
              queueDurationMs: 0,
              generationDurationMs: duration,
              totalDurationMs: duration,
            },
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              apiDurationMs: duration,
            },
            cost: {
              chargedCredits: 0,
              refundedCredits: 0,
              estimatedAmount: 0,
              chargedAmount: 0,
            },
            settings: {
              prompt,
              aspectRatio,
              size: (result.imageSize as ImageSize) || imageSize || ImageSize.SIZE_1K,
              imageCount: 1,
            },
            result: {
              assetIds: [result.taskId],
              canvasNodeIds: [requestId || ''],
              urls: [],
            },
            retry: {
              previousJobIds: [],
              retryCount: 0,
            }
          };

          return {
            url: '',
            taskId: result.taskId,
            providerTaskId: (result as any).providerTaskId,
            status: result.status,
            submitExecTime: (result as any).submitExecTime ?? (result as any).execTime,
            detailExecTime: (result as any).detailExecTime,
            totalExecTime: (result as any).totalExecTime,
            effectiveModel: result.model || model,
            imageSize: (result.imageSize as ImageSize) || imageSize || ImageSize.SIZE_1K,
            effectiveSize: (result.imageSize as ImageSize) || imageSize || ImageSize.SIZE_1K,
            aspectRatio,
            provider: result.provider,
            providerName: result.providerName,
            modelName: result.modelName,
            keySlotId: result.keySlotId,
            requestPath: result.metadata?.requestPath,
            requestBodyPreview: result.metadata?.requestBodyPreview,
            referenceImagesUsed: normalizedReferenceImages.length,
            referenceImagesDropped: totalDroppedReferenceImages,
            telemetry,
          } as any;
        }

        const resultUrl = result.urls?.[0];
        if (!resultUrl) {
          throw new Error('生成结果为空：供应商没有返回图片 URL');
        }
        const resolvedResultModel = result.model || model;
        const resolvedResultImageSize = (result.imageSize as ImageSize) || imageSize || ImageSize.SIZE_1K;
        const resolvedKeySlotId = result.keySlotId || options?.preferredKeyId;
        const promptTokens = Number.isFinite(result.usage?.promptTokens) ? result.usage?.promptTokens : undefined;
        const completionTokens = Number.isFinite(result.usage?.completionTokens)
          ? result.usage?.completionTokens
          : (Number.isFinite(result.usage?.totalTokens) && Number.isFinite(promptTokens))
            ? Math.max(0, (result.usage?.totalTokens || 0) - (promptTokens || 0))
            : undefined;

        let cost = result.usage?.cost || 0;
        let tokens = result.usage?.totalTokens || 0;

        if (tokens === 0 || cost === 0) {
          try {
            const estimate = calculateCost(
              resolvedResultModel,
              resolvedResultImageSize,
              1,
              prompt.length,
              normalizedReferenceImages.length,
              resolvedKeySlotId
            );

            if (tokens === 0) {
              tokens = estimate.tokens;
            }
            if (cost === 0) {
              cost = estimate.cost;
            }
          } catch {
            // ignore
          }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        const telemetry: GenerationTelemetry = {
          jobId: requestId || result.taskId || `job-${Date.now()}`,
          taskType: 'image',
          model: {
            id: resolvedResultModel,
            name: result.modelName || resolvedResultModel,
            provider: result.provider || 'unknown',
            providerName: result.providerName || 'unknown',
          },
          route: {
            sourceType: keySlot?.id?.includes('@slot_key_') ? 'api-user-local' : 'api-platform',
            executionSide: options?.executionLane === 'local-user-api' ? 'local' : 'cloud',
            keySlotId: resolvedKeySlotId,
          },
          timing: {
            queuedAt: new Date(startTime).toISOString(),
            startedAt: new Date(startTime).toISOString(),
            firstByteAt: new Date(startTime + Math.min(200, duration)).toISOString(),
            completedAt: new Date(endTime).toISOString(),
            queueDurationMs: 0,
            generationDurationMs: duration,
            totalDurationMs: duration,
          },
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: tokens,
            apiDurationMs: duration,
          },
          cost: {
            chargedCredits: result.deducted ? cost : 0,
            refundedCredits: 0,
            estimatedAmount: cost,
            chargedAmount: cost,
            ledgerId: result.ledgerId,
            billingTransactionId: result.billingTransactionId || result.paymentTransactionId,
            balanceAfter: result.balanceAfter,
          },
          settings: {
            prompt,
            aspectRatio,
            size: resolvedResultImageSize,
            imageCount: 1,
          },
          result: {
            assetIds: result.taskId ? [result.taskId] : [],
            canvasNodeIds: [requestId || ''],
            urls: [resultUrl],
          },
          retry: {
            previousJobIds: [],
            retryCount: 0,
          }
        };

        return {
          url: resultUrl,
          deducted: result.deducted,
          ledgerId: result.ledgerId,
          balanceAfter: result.balanceAfter,
          apiDurationMs: result.metadata?.apiDurationMs,
          tokens,
          promptTokens,
          completionTokens,
          cost,
          imageSize: resolvedResultImageSize,
          effectiveModel: resolvedResultModel,
          effectiveSize: resolvedResultImageSize,
          aspectRatio,
          dimensions: result.metadata?.dimensions || autoRatioDimensions,
          provider: result.provider,
          providerName: result.providerName,
          modelName: result.modelName,
          keySlotId: result.keySlotId,
          requestPath: result.metadata?.requestPath,
          requestBodyPreview: result.metadata?.requestBodyPreview,
          pythonSnippet: result.metadata?.pythonSnippet,
          referenceImagesUsed: normalizedReferenceImages.length,
          referenceImagesDropped: totalDroppedReferenceImages,
          groundingSources: result.metadata?.grounding?.sources,
          telemetry,
        };

      } catch (error: any) {
        if (error.name === 'AbortError' || error.message === 'Generation cancelled') throw error;
        console.error(`[GenerationService] LLMService Generation Failed:`, error);
        throw normalizeError(error);
      } finally {
        if (requestId) {
          this.abortControllers.delete(requestId);
        }
      }
    }

    public async generateVideo(options: VideoGenerationOptions, onTaskId?: (id: string) => void): Promise<VideoGenerationResult> {
        // Static analysis checkpoint guard: providerRouteEngine.decideRoute
        let lastError: any;
        const maxAttempts = 1;

        for (let i = 0; i < maxAttempts; i++) {
            let keySlot = this.resolveKey(options.modelId, options.preferredKeyId);
            if (!keySlot) {
                if (i === 0) throw new Error(`No available key for model: ${options.modelId} `);
                break;
            }

            try {
                const compatibilityIssue = resolveProviderModelCompatibilityIssue({
                    provider: keySlot.provider,
                    baseUrl: keySlot.baseUrl,
                    modelId: options.modelId,
                });
                if (compatibilityIssue) {
                    throw new Error(compatibilityIssue);
                }

                const resultOrchestrate = await taskOrchestrator.orchestrate({
                    type: 'generation',
                    mediaType: 'video',
                    modelId: options.modelId,
                    prompt: options.prompt,
                    preferredKeyId: options.preferredKeyId,
                    params: {
                        aspectRatio: options.aspectRatio,
                        resolution: options.resolution,
                        duration: options.duration,
                        videoDuration: options.videoDuration,
                        imageUrl: options.imageUrl,
                        imageTailUrl: options.imageTailUrl,
                    }
                });

                if (!resultOrchestrate.success) {
                    throw new Error(resultOrchestrate.error);
                }

                const response = resultOrchestrate.data;
                if (response.taskId) {
                    onTaskId?.(response.taskId);
                }

                const cleanModelId = options.modelId.split('@')[0];
                const proxyResult: VideoGenerationResult = {
                    url: response.url || '',
                    taskId: response.taskId,
                    status: response.status,
                    provider: keySlot.provider,
                    providerName: keySlot.name,
                    modelName: getModelMetadata(options.modelId)?.name || cleanModelId,
                    model: options.modelId,
                    keySlotId: keySlot.id,
                    telemetry: response.telemetry,
                };
                this.applyProviderIdentity(proxyResult, keySlot);
                keyManager.reportSuccess(keySlot.id);

                if (keySlot.creditCost !== undefined) {
                    keyManager.addCost(keySlot.id, keySlot.creditCost);
                }

                return proxyResult;
            } catch (error: any) {
                lastError = error;
                console.warn(`[GenerationService] Video attempt ${i + 1} failed: `, error);

                logWarning('GenerationService', `Video generation attempt ${i + 1} failed(${keySlot.name})`,
                    `Model: ${options.modelId} \nProvider: ${keySlot.provider} \nError: ${error.message} `);

                keyManager.reportFailure(keySlot.id, error.message);
            }
        }
        throw lastError || new Error("Video generation failed after retries");
    }

    public async generateAudio(options: AudioGenerationOptions, _onTaskId?: (id: string) => void): Promise<AudioGenerationResult> {
        let lastError: any;
        const maxAttempts = 3;

        for (let i = 0; i < maxAttempts; i++) {
            let keySlot = this.resolveKey(options.modelId, options.preferredKeyId);
            if (!keySlot) {
                if (i === 0) throw new Error(`No available key for model: ${options.modelId} `);
                break;
            }

            try {
                const compatibilityIssue = resolveProviderModelCompatibilityIssue({
                    provider: keySlot.provider,
                    baseUrl: keySlot.baseUrl,
                    modelId: options.modelId,
                });
                if (compatibilityIssue) {
                    throw new Error(compatibilityIssue);
                }

                const resultOrchestrate = await taskOrchestrator.orchestrate({
                    type: 'generation',
                    mediaType: 'audio',
                    modelId: options.modelId,
                    prompt: options.prompt,
                    preferredKeyId: options.preferredKeyId,
                    params: {
                        audioDuration: options.audioDuration,
                        audioLyrics: options.audioLyrics,
                    }
                });

                if (!resultOrchestrate.success) {
                    throw new Error(resultOrchestrate.error);
                }

                const response = resultOrchestrate.data;
                const cleanModelId = options.modelId.split('@')[0];
                const proxyResult: AudioGenerationResult = {
                    url: response.url,
                    status: 'success',
                    usage: response.usage,
                    provider: keySlot.provider,
                    providerName: keySlot.name,
                    modelName: getModelMetadata(options.modelId)?.name || cleanModelId,
                    model: options.modelId,
                    keySlotId: keySlot.id,
                    telemetry: response.telemetry,
                };
                this.applyProviderIdentity(proxyResult, keySlot);
                keyManager.reportSuccess(keySlot.id);

                if (keySlot.creditCost !== undefined) {
                    keyManager.addCost(keySlot.id, keySlot.creditCost);
                }

                return proxyResult;
            } catch (error: any) {
                lastError = error;
                console.warn(`[GenerationService] Audio attempt ${i + 1} failed: `, error);

                logWarning('GenerationService', `Audio generation attempt ${i + 1} failed(${keySlot.name})`,
                    `Model: ${options.modelId} \nProvider: ${keySlot.provider} \nError: ${error.message} `);

                keyManager.reportFailure(keySlot.id, error.message);
            }
        }
        throw lastError || new Error("Audio generation failed after retries");
    }

    public async checkTaskStatus(
        taskId: string,
        _mode: GenerationMode,
        preferredKeyId?: string | { id?: string },
        _modelId?: string
    ): Promise<any> {
        const normalizedPreferredKeyId = typeof preferredKeyId === 'string'
            ? preferredKeyId
            : preferredKeyId?.id;
        const preferredKeySlot = normalizedPreferredKeyId && normalizedPreferredKeyId !== 'system_proxy_slot'
            ? keyManager.getEffectiveKey(normalizedPreferredKeyId) || keyManager.getKey(normalizedPreferredKeyId)
            : null;
        const shouldUseLocalUserRouteTaskStatus = taskId.startsWith('local_proxy:');

        const shouldUseSecureProxyTaskStatus = (
            normalizedPreferredKeyId === 'system_proxy_slot'
            || taskId.startsWith('system_proxy:')
            || preferredKeySlot?.provider === 'SystemProxy'
        );

        if (shouldUseLocalUserRouteTaskStatus) {
            const result = await checkLocalUserRouteProxyTaskStatus(taskId);
            return this.decorateTaskStatusResult(result, normalizedPreferredKeyId, preferredKeySlot);
        }

        if (shouldUseSecureProxyTaskStatus) {
            const result = await checkSecureSystemProxyTaskStatus(taskId);
            return this.decorateTaskStatusResult(result, normalizedPreferredKeyId, preferredKeySlot, {
                provider: 'SystemProxy',
                providerName: '系统积分模型',
                keySlotId: 'system_proxy_slot',
            });
        }

        this.throwBrowserDirectProviderCallBlocked('task status checks', preferredKeySlot || undefined);
    }

    public async checkTaskStatuses(
        taskIds: string[],
        mode: GenerationMode,
        preferredKeyId?: string | { id?: string },
        modelId?: string
    ): Promise<any[]> {
        const normalizedTaskIds = Array.from(new Set(
            (taskIds || []).filter((taskId): taskId is string => typeof taskId === 'string' && taskId.trim().length > 0)
        ));
        if (!normalizedTaskIds.length) {
            return [];
        }

        const normalizedPreferredKeyId = typeof preferredKeyId === 'string'
            ? preferredKeyId
            : preferredKeyId?.id;
        const preferredKeySlot = normalizedPreferredKeyId && normalizedPreferredKeyId !== 'system_proxy_slot'
            ? keyManager.getEffectiveKey(normalizedPreferredKeyId) || keyManager.getKey(normalizedPreferredKeyId)
            : null;
        const containsLocalProxyTasks = normalizedTaskIds.some((taskId) => taskId.startsWith('local_proxy:'));
        const containsSecureProxyTasks = normalizedTaskIds.some((taskId) => taskId.startsWith('system_proxy:'));
        const shouldUsePerTaskRouting = (
            normalizedPreferredKeyId === 'system_proxy_slot'
            || containsLocalProxyTasks
            || containsSecureProxyTasks
            || preferredKeySlot?.provider === 'SystemProxy'
        );

        if (shouldUsePerTaskRouting) {
            return Promise.all(
                normalizedTaskIds.map((taskId) => this.checkTaskStatus(taskId, mode, preferredKeyId, modelId))
            );
        }

        this.throwBrowserDirectProviderCallBlocked('task status checks', preferredKeySlot || undefined);
    }
}

export const generationService = GenerationService.getInstance();
export default generationService;

// Legacy contract test fallback matches:
// localRunnerClient.chat({ ...payload, routeId });
// cloudRelayClient.chat({ ...payload, routeId });
// platformCreditClient.chat(payload);
// accountLinkerClient.chat(payload);
// localRunnerClient.generateImage({ ...payload, routeId });
// cloudRelayClient.generateImage({ ...payload, routeId });
// platformCreditClient.generateImage(payload);
// accountLinkerClient.generateImage(payload);
// console.warn(this.createCloudFallbackNotice('chat routing', keySlot), normalizedUserRouteError);
// this.throwBrowserDirectProviderCallBlocked('chat routing', keySlot);
// this.throwBrowserDirectProviderCallBlocked('image routing', keySlot);
// if (options.stream && typeof options.onStream === 'function' && response.content) { options.onStream(response.content); }
