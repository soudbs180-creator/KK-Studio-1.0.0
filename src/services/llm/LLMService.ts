import { LLMAdapter, ChatOptions, ImageGenerationOptions, ImageGenerationResult, VideoGenerationOptions, VideoGenerationResult, AudioGenerationOptions, AudioGenerationResult, ProviderConfig } from './LLMAdapter';
import { GenerationMode } from '../../types';
import { GeminiNativeAdapter } from './GeminiNativeAdapter';
import { OpenAICompatibleAdapter } from './OpenAICompatibleAdapter';
import { ClaudeNativeAdapter } from './ClaudeNativeAdapter';
import { VideoCompatibleAdapter } from './VideoCompatibleAdapter';
import { AudioCompatibleAdapter } from './AudioCompatibleAdapter';
import { KeyManager, KeySlot, getModelMetadata } from '../auth/keyManager';
import { keyManager } from '../auth/keyManager';
import * as costService from '../billing/costService';
import { logWarning } from '../system/systemLogService';
import { ImageSize, Provider } from '../../types';
import { getProviderCapability, modelSupportedByProvider, ProviderCapabilityProfile } from './providerCapabilities';
import {
    buildSecureProxyUserRouteFromSlotId,
    callLocalUserRouteProxyAudio,
    callLocalUserRouteProxyChat,
    callLocalUserRouteProxyImage,
    callLocalUserRouteProxyVideo,
    callSecureSystemProxyChat,
    callSecureSystemProxyImage,
    callSecureSystemProxyVideo,
    callSecureSystemProxyAudio,
    checkLocalUserRouteProxyTaskStatus,
    checkSecureSystemProxyTaskStatus,
    isLocalUserRouteProxyFallbackError,
    isSecureProxyGuestModeError,
    isSecureProxySessionReauthError,
} from '../model/secureModelProxy';
import { resolveKkApiBaseUrl } from '../api/kkApiClient';
import { resolveProviderRuntime } from '../api/providerStrategy';
import { resolveProviderIdentity } from '../../utils/providerDisplay';
import { getModelPricing } from '../model/modelPricing';

export class LLMService {
    private static instance: LLMService;
    private openAICompatibleAdapter: OpenAICompatibleAdapter;
    private geminiNativeAdapter: GeminiNativeAdapter;
    private claudeNativeAdapter: ClaudeNativeAdapter;
    private videoAdapter: VideoCompatibleAdapter;
    private audioAdapter: AudioCompatibleAdapter;

    private constructor() {
        this.geminiNativeAdapter = new GeminiNativeAdapter();
        this.openAICompatibleAdapter = new OpenAICompatibleAdapter();
        this.claudeNativeAdapter = new ClaudeNativeAdapter();

        this.videoAdapter = new VideoCompatibleAdapter();
        this.audioAdapter = new AudioCompatibleAdapter();
    }

    public static getInstance(): LLMService {
        if (!LLMService.instance) {
            LLMService.instance = new LLMService();
        }
        return LLMService.instance;
    }

    private getAdapterForSlot(keySlot: KeySlot, modelId?: string): LLMAdapter {
        const runtime = resolveProviderRuntime({
            provider: keySlot.provider,
            baseUrl: keySlot.baseUrl,
            format: keySlot.format,
            authMethod: keySlot.authMethod,
            headerName: keySlot.headerName,
            compatibilityMode: keySlot.compatibilityMode,
            modelId,
        });

        if (runtime.protocolFamily === 'claude-native') {
            return this.claudeNativeAdapter;
        }

        if (runtime.protocolFamily === 'gemini-native') {
            return this.geminiNativeAdapter;
        }

        return this.openAICompatibleAdapter;
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

    private resolveSystemBaseModelId(modelId: string): string {
        const [baseModelId] = (modelId || '').split('@');
        return baseModelId.trim();
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

    private shouldFallbackToCloudUserRouteAfterLocalProxy(
        error: unknown,
    ): boolean {
        void error;
        return false;
    }

    private createCloudFallbackNotice(action: string, keySlot: Pick<KeySlot, 'name' | 'provider'>): string {
        const providerLabel = String(keySlot.name || keySlot.provider || 'provider').trim();
        return `[LLMService] Local user-route proxy unavailable for ${providerLabel}, falling back to cloud ${action}.`;
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

    private async runDirectChat(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        const adapter = this.getAdapterForSlot(keySlot, options.modelId);
        if (options.stream && adapter.chatStream) {
            await adapter.chatStream(options, keySlot);
            return '';
        }

        const content = await adapter.chat(options, keySlot);
        if (options.stream && typeof options.onStream === 'function' && content) {
            options.onStream(content);
        }

        return content;
    }

    private async runDirectImage(options: ImageGenerationOptions, keySlot: KeySlot): Promise<ImageGenerationResult> {
        const adapter = this.getAdapterForSlot(keySlot, options.modelId);
        return adapter.generateImage(options, keySlot);
    }

    private async runDirectVideo(options: VideoGenerationOptions, keySlot: KeySlot): Promise<VideoGenerationResult> {
        const adapter = this.getAdapterForSlot(keySlot, options.modelId);
        if (!adapter.generateVideo) {
            throw new Error(`Provider ${keySlot.name || keySlot.provider} does not support direct video generation.`);
        }

        return adapter.generateVideo(options, keySlot);
    }

    private async runDirectAudio(options: AudioGenerationOptions, keySlot: KeySlot): Promise<AudioGenerationResult> {
        const adapter = this.getAdapterForSlot(keySlot, options.modelId);
        if (!adapter.generateAudio) {
            throw new Error(`Provider ${keySlot.name || keySlot.provider} does not support direct audio generation.`);
        }

        return adapter.generateAudio(options, keySlot);
    }

    private async runDirectTaskStatus(
        taskId: string,
        mode: GenerationMode,
        keySlot: KeySlot,
        modelId?: string,
    ): Promise<any> {
        const adapter = this.getAdapterForSlot(keySlot, modelId);
        if (!adapter.checkTaskStatus) {
            throw new Error(`Provider ${keySlot.name || keySlot.provider} does not support direct task status checks.`);
        }

        return adapter.checkTaskStatus(taskId, mode, keySlot, modelId);
    }

    private async runDirectTaskStatuses(
        taskIds: string[],
        mode: GenerationMode,
        keySlot: KeySlot,
        modelId?: string,
    ): Promise<any[]> {
        const adapter = this.getAdapterForSlot(keySlot, modelId);
        if (adapter.checkTaskStatuses) {
            return adapter.checkTaskStatuses(taskIds, mode, keySlot, modelId);
        }

        if (!adapter.checkTaskStatus) {
            throw new Error(`Provider ${keySlot.name || keySlot.provider} does not support direct task status checks.`);
        }

        return Promise.all(taskIds.map((taskId) => adapter.checkTaskStatus!(taskId, mode, keySlot, modelId)));
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
        const providers: Provider[] = ['Google', 'OpenAI', 'Anthropic', 'Aliyun', 'Tencent', 'Volcengine', 'SiliconFlow', 'Custom'];
        return providers
            .map(item => getProviderCapability(item))
            .filter((item): item is ProviderCapabilityProfile => !!item);
    }

    public canProviderHandleModel(provider: Provider, modelId: string): boolean {
        return modelSupportedByProvider(provider, modelId);
    }

    public async chat(options: ChatOptions): Promise<string> {
        let lastError: any;
        const maxAttempts = 1;

        for (let i = 0; i < maxAttempts; i++) {
            const keySlot = this.resolveKey(options.modelId, options.preferredKeyId);
            if (!keySlot) {
                if (i === 0) throw new Error(`No available key for model: ${options.modelId} `);
                break;
            }

            try {
                if (keySlot.provider === 'SystemProxy') {
                    const response = await callSecureSystemProxyChat({
                        modelId: options.modelId,
                        messages: options.messages.map((message) => ({
                            role: message.role as 'system' | 'user' | 'assistant',
                            content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
                        })),
                        temperature: options.temperature,
                        maxTokens: options.maxTokens,
                        stream: false,
                    });

                    keyManager.reportSuccess(keySlot.id);
                    return response.content;
                }

                if (this.shouldUseSecureProxyUserRoute(keySlot)) {
                    const routeId = this.buildUserRouteForKeySlot(keySlot);
                    const normalizedMessages = options.messages.map((message) => ({
                        role: message.role as 'system' | 'user' | 'assistant',
                        content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
                    }));

                    let response;
                    try {
                        response = await callLocalUserRouteProxyChat({
                            routeId,
                            modelId: options.modelId,
                            messages: normalizedMessages,
                            temperature: options.temperature,
                            maxTokens: options.maxTokens,
                            stream: false,
                        });
                    } catch (error) {
                        if (!this.shouldFallbackToCloudUserRouteAfterLocalProxy(error)) {
                            throw error;
                        }

                        console.warn(this.createCloudFallbackNotice('chat routing', keySlot), error);
                        try {
                            response = await callSecureSystemProxyChat({
                                modelId: options.modelId,
                                userRoute: buildSecureProxyUserRouteFromSlotId(routeId),
                                messages: normalizedMessages,
                                temperature: options.temperature,
                                maxTokens: options.maxTokens,
                                stream: false,
                            });
                        } catch (cloudError) {
                            throw this.buildUserRouteFallbackFailureError(keySlot, error, cloudError);
                        }
                    }

                    keyManager.reportSuccess(keySlot.id);
                    const inputLen = options.messages.reduce((acc, m) => acc + m.content.length, 0);
                    const outputLen = response.content.length;
                    const tokens = response.usage?.totalTokens || Math.ceil((inputLen + outputLen) * 0.3);

                    keyManager.addUsage(keySlot.id, tokens);
                    if (keySlot.creditCost !== undefined) {
                        keyManager.addCost(keySlot.id, keySlot.creditCost);
                    }

                    if (options.stream && typeof options.onStream === 'function' && response.content) {
                        options.onStream(response.content);
                    }

                    return response.content;
                }

                this.throwBrowserDirectProviderCallBlocked('chat routing', keySlot);
            } catch (error: any) {
                lastError = error;
                console.warn(`[LLMService] Chat attempt ${i + 1} failed: `, error);

                logWarning('LLMService', `Chat attempt ${i + 1} failed(${keySlot.name})`,
                    `Model: ${options.modelId} \nProvider: ${keySlot.provider} \nError: ${error.message} `);

                keyManager.reportFailure(keySlot.id, error.message);
            }
        }
        throw lastError || new Error("Chat generation failed after retries");
    }
    public async generateImage(options: ImageGenerationOptions, onTaskId?: (id: string) => void): Promise<import('./LLMAdapter').ImageGenerationResult> {
        let lastError: any;
        const maxAttempts = 1;

        for (let i = 0; i < maxAttempts; i++) {
            let keySlot = this.resolveKey(options.modelId, options.preferredKeyId);
            if (!keySlot) {
                if (i === 0) throw new Error(`No available key for model: ${options.modelId} `);
                break;
            }

            try {
                if (keySlot.provider === 'SystemProxy') {
                    const response = await callSecureSystemProxyImage({
                        modelId: options.modelId,
                        prompt: options.prompt,
                        aspectRatio: options.aspectRatio,
                        imageSize: options.imageSize,
                        imageCount: options.imageCount,
                        referenceImages: options.referenceImages,
                    });

                    const cleanModelId = options.modelId.split('@')[0];
                    return {
                        urls: response.urls,
                        usage: response.usage,
                        provider: 'SystemProxy',
                        providerName: '系统积分模型',
                        modelName: getModelMetadata(options.modelId)?.name || cleanModelId,
                        model: options.modelId,
                        keySlotId: keySlot.id,
                    };
                }

                const fullBaseId = options.modelId.split('@')[0];
                const cleanModelId = fullBaseId.split('|')[0]; // Strip Provider/Name metadata

                let result: ImageGenerationResult | null = null;
                if (this.shouldUseSecureProxyUserRoute(keySlot)) {
                    const routeId = this.buildUserRouteForKeySlot(keySlot);
                    let proxyResponse;
                    try {
                        proxyResponse = await callLocalUserRouteProxyImage({
                            routeId,
                            modelId: options.modelId,
                            prompt: options.prompt,
                            aspectRatio: options.aspectRatio,
                            imageSize: options.imageSize,
                            imageCount: options.imageCount,
                            referenceImages: options.referenceImages,
                        });
                    } catch (error) {
                        if (!this.shouldFallbackToCloudUserRouteAfterLocalProxy(error)) {
                            throw error;
                        }

                        console.warn(this.createCloudFallbackNotice('image routing', keySlot), error);
                        try {
                            proxyResponse = await callSecureSystemProxyImage({
                                modelId: options.modelId,
                                userRoute: buildSecureProxyUserRouteFromSlotId(routeId),
                                prompt: options.prompt,
                                aspectRatio: options.aspectRatio,
                                imageSize: options.imageSize,
                                imageCount: options.imageCount,
                                referenceImages: options.referenceImages,
                            });
                        } catch (cloudError) {
                            throw this.buildUserRouteFallbackFailureError(keySlot, error, cloudError);
                        }
                    }

                    result = {
                        urls: proxyResponse.urls,
                        usage: proxyResponse.usage,
                        provider: keySlot.provider,
                        providerName: keySlot.name,
                        modelName: getModelMetadata(options.modelId)?.name || cleanModelId,
                        model: options.modelId,
                        keySlotId: keySlot.id,
                    };
                } else {
                    this.throwBrowserDirectProviderCallBlocked('image routing', keySlot);
                }
                keyManager.reportSuccess(keySlot.id);

                this.applyProviderIdentity(result, keySlot);

                // Track Cost & Usage
                // If Adapter returns usage, use it. Else estimate.

                let tokensForStats = result.usage?.totalTokens || 0;
                let costForStats = result.usage?.cost || 0;
                const promptTokens = result.usage?.promptTokens;
                const completionTokens = Number.isFinite(result.usage?.completionTokens)
                    ? result.usage?.completionTokens
                    : (Number.isFinite(result.usage?.totalTokens) && Number.isFinite(promptTokens))
                        ? Math.max(0, (result.usage?.totalTokens || 0) - (promptTokens || 0))
                        : undefined;

                const sizeRaw = (options.imageSize) || ImageSize.SIZE_1K;
                // Note: options.imageSize is now string, locally we often use Enum '1K','2K'. 
                // Adapter returns real size used in result.imageSize

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
                    // Get estimate fallback using costService
                    try {
                        const est = costService.calculateCost(result.model || options.modelId, sizeRaw as ImageSize, count, options.prompt.length, refCount, keySlot.id);
                        if (tokensForStats === 0) tokensForStats = est.tokens;
                        if (costForStats === 0) costForStats = keySlot.creditCost !== undefined ? keySlot.creditCost : est.cost;
                    } catch (e) {
                        // Ignore est error
                        if (costForStats === 0 && keySlot.creditCost !== undefined) costForStats = keySlot.creditCost;
                    }
                } else if (keySlot.creditCost !== undefined) {
                    // Override with user custom cost if provided
                    costForStats = keySlot.creditCost;
                }

                const settledKeyId = result.keySlotId || keySlot.id;
                keyManager.addUsage(settledKeyId, tokensForStats);
                keyManager.addCost(settledKeyId, costForStats);

                // Ensure result has usage populated for caller
                if (!result.usage) {
                    result.usage = { totalTokens: tokensForStats, cost: costForStats };
                } else {
                    if (!result.usage.cost) result.usage.cost = costForStats;
                    if (!result.usage.totalTokens) result.usage.totalTokens = tokensForStats;
                }

                // 𨱅?Populate Names for Display
                if (!result.modelName) {
                    const metadata = getModelMetadata(result.model || options.modelId);
                    result.modelName = metadata?.name || cleanModelId;
                }

                return result;
            } catch (error: any) {
                lastError = error;
                console.warn(`[LLMService] Image attempt ${i + 1} failed: `, error);

                // Record each failed attempt so diagnostics keep the full retry trail
                logWarning('LLMService', `Image generation attempt ${i + 1} failed(${keySlot.name})`,
                    `Model: ${options.modelId} \nProvider: ${keySlot.provider} \nError: ${error.message} `);

                keyManager.reportFailure(keySlot.id, error.message);
            }
        }
        throw lastError || new Error("Image generation failed after retries");
    }

    public resolveKey(modelId: string, preferredKeyId?: string): KeySlot | null {
        const lowerModelId = modelId.toLowerCase();
        const isSystemRoute = lowerModelId.includes('@system');

        if (isSystemRoute) {
            // For system credit models, return a virtual slot
            // Never honor a persisted external preferredKeyId here, otherwise
            // system credit models can silently bypass server-side billing.
            const now = Date.now();
            return {
                id: 'system_proxy_slot',
                key: 'system_proxy_key', // Placeholder, will be replaced by adapter
                name: 'System Proxy',
                provider: 'SystemProxy' as Provider,
                type: 'proxy',
                format: 'openai',
                baseUrl: '', // Will be determined by adapter
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

    public async generateVideo(options: VideoGenerationOptions, onTaskId?: (id: string) => void): Promise<VideoGenerationResult> {
        let lastError: any;
        const maxAttempts = 1;

        for (let i = 0; i < maxAttempts; i++) {
            let keySlot = this.resolveKey(options.modelId, options.preferredKeyId);
            if (!keySlot) {
                if (i === 0) throw new Error(`No available key for model: ${options.modelId} `);
                break;
            }

            try {
                if (keySlot.provider === 'SystemProxy') {
                    const cleanModelId = options.modelId.split('@')[0];
                    const response = await callSecureSystemProxyVideo({
                        modelId: options.modelId,
                        prompt: options.prompt,
                        aspectRatio: options.aspectRatio,
                        resolution: options.resolution,
                        duration: options.duration,
                        videoDuration: options.videoDuration,
                        imageUrl: options.imageUrl,
                        imageTailUrl: options.imageTailUrl,
                    });

                    if (response.taskId) {
                        onTaskId?.(response.taskId);
                    }

                    return {
                        url: response.url || '',
                        taskId: response.taskId,
                        status: response.status,
                        provider: 'SystemProxy',
                        providerName: '系统积分模型',
                        modelName: getModelMetadata(options.modelId)?.name || cleanModelId,
                        model: options.modelId,
                        keySlotId: keySlot.id,
                    };
                }

                if (this.shouldUseSecureProxyUserRoute(keySlot)) {
                    const cleanModelId = options.modelId.split('@')[0];
                    const routeId = this.buildUserRouteForKeySlot(keySlot);
                    let response;
                    try {
                        response = await callLocalUserRouteProxyVideo({
                            routeId,
                            modelId: options.modelId,
                            prompt: options.prompt,
                            aspectRatio: options.aspectRatio,
                            resolution: options.resolution,
                            duration: options.duration,
                            videoDuration: options.videoDuration,
                            imageUrl: options.imageUrl,
                            imageTailUrl: options.imageTailUrl,
                        });
                    } catch (error) {
                        if (!this.shouldFallbackToCloudUserRouteAfterLocalProxy(error)) {
                            throw error;
                        }

                        console.warn(this.createCloudFallbackNotice('video routing', keySlot), error);
                        try {
                            response = await callSecureSystemProxyVideo({
                                modelId: options.modelId,
                                userRoute: buildSecureProxyUserRouteFromSlotId(routeId),
                                prompt: options.prompt,
                                aspectRatio: options.aspectRatio,
                                resolution: options.resolution,
                                duration: options.duration,
                                videoDuration: options.videoDuration,
                                imageUrl: options.imageUrl,
                                imageTailUrl: options.imageTailUrl,
                            });
                        } catch (cloudError) {
                            throw this.buildUserRouteFallbackFailureError(keySlot, error, cloudError);
                        }
                    }

                    if (response.taskId) {
                        onTaskId?.(response.taskId);
                    }

                    const proxyResult: VideoGenerationResult = {
                        url: response.url || '',
                        taskId: response.taskId,
                        status: response.status,
                        provider: keySlot.provider,
                        providerName: keySlot.name,
                        modelName: getModelMetadata(options.modelId)?.name || cleanModelId,
                        model: options.modelId,
                        keySlotId: keySlot.id,
                    };
                    this.applyProviderIdentity(proxyResult, keySlot);
                    keyManager.reportSuccess(keySlot.id);

                    if (keySlot.creditCost !== undefined) {
                        keyManager.addCost(keySlot.id, keySlot.creditCost);
                    }

                    return proxyResult;
                }

                this.throwBrowserDirectProviderCallBlocked('video routing', keySlot);
            } catch (error: any) {
                lastError = error;
                console.warn(`[LLMService] Video attempt ${i + 1} failed: `, error);

                // Record each failed attempt so diagnostics keep the full retry trail
                logWarning('LLMService', `Video generation attempt ${i + 1} failed(${keySlot.name})`,
                    `Model: ${options.modelId} \nProvider: ${keySlot.provider} \nError: ${error.message} `);

                keyManager.reportFailure(keySlot.id, error.message);
            }
        }
        throw lastError || new Error("Video generation failed after retries");
    }

    public async generateAudio(options: AudioGenerationOptions, onTaskId?: (id: string) => void): Promise<AudioGenerationResult> {
        let lastError: any;
        const maxAttempts = 3;

        for (let i = 0; i < maxAttempts; i++) {
            let keySlot = this.resolveKey(options.modelId, options.preferredKeyId);
            if (!keySlot) {
                if (i === 0) throw new Error(`No available key for model: ${options.modelId} `);
                break;
            }

            try {
                if (keySlot.provider === 'SystemProxy') {
                    const cleanModelId = options.modelId.split('@')[0];
                    const response = await callSecureSystemProxyAudio({
                        modelId: options.modelId,
                        prompt: options.prompt,
                    });

                    return {
                        url: response.url,
                        status: 'success',
                        usage: response.usage,
                        provider: 'SystemProxy',
                        providerName: '系统积分模型',
                        modelName: getModelMetadata(options.modelId)?.name || cleanModelId,
                        model: options.modelId,
                        keySlotId: keySlot.id,
                    };
                }

                if (this.shouldUseSecureProxyUserRoute(keySlot)) {
                    const cleanModelId = options.modelId.split('@')[0];
                    const routeId = this.buildUserRouteForKeySlot(keySlot);
                    let response;
                    try {
                        response = await callLocalUserRouteProxyAudio({
                            routeId,
                            modelId: options.modelId,
                            prompt: options.prompt,
                        });
                    } catch (error) {
                        if (!this.shouldFallbackToCloudUserRouteAfterLocalProxy(error)) {
                            throw error;
                        }

                        console.warn(this.createCloudFallbackNotice('audio routing', keySlot), error);
                        try {
                            response = await callSecureSystemProxyAudio({
                                modelId: options.modelId,
                                userRoute: buildSecureProxyUserRouteFromSlotId(routeId),
                                prompt: options.prompt,
                            });
                        } catch (cloudError) {
                            throw this.buildUserRouteFallbackFailureError(keySlot, error, cloudError);
                        }
                    }

                    const proxyResult: AudioGenerationResult = {
                        url: response.url,
                        status: 'success',
                        usage: response.usage,
                        provider: keySlot.provider,
                        providerName: keySlot.name,
                        modelName: getModelMetadata(options.modelId)?.name || cleanModelId,
                        model: options.modelId,
                        keySlotId: keySlot.id,
                    };
                    this.applyProviderIdentity(proxyResult, keySlot);
                    keyManager.reportSuccess(keySlot.id);

                    if (keySlot.creditCost !== undefined) {
                        keyManager.addCost(keySlot.id, keySlot.creditCost);
                    }

                    return proxyResult;
                }

                this.throwBrowserDirectProviderCallBlocked('audio routing', keySlot);
            } catch (error: any) {
                lastError = error;
                console.warn(`[LLMService] Audio attempt ${i + 1} failed: `, error);

                // Record each failed attempt so diagnostics keep the full retry trail
                logWarning('LLMService', `Audio generation attempt ${i + 1} failed(${keySlot.name})`,
                    `Model: ${options.modelId} \nProvider: ${keySlot.provider} \nError: ${error.message} `);

                keyManager.reportFailure(keySlot.id, error.message);
            }
        }
        throw lastError || new Error("Audio generation failed after retries");
    }

    /**
     * Check status or poll background tasks until they complete.
     */
    public async checkTaskStatus(
        taskId: string,
        mode: GenerationMode,
        preferredKeyId?: string | { id?: string },
        modelId?: string
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

export const llmService = LLMService.getInstance();


