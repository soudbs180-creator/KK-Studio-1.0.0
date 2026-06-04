import { type LLMAdapter, type ChatOptions, type ImageGenerationOptions, type ImageGenerationResult, extractRefImageData } from './LLMAdapter';
import { type KeySlot, getModelMetadata, keyManager } from '../auth/keyManager';
import {
    type AuthMethod,
    applyOpenAICompatAuthToUrl,
    buildOpenAIEndpoint,
    buildGeminiEndpoint,
    buildGeminiHeaders,
    buildProxyHeaders,
    formatAuthorizationHeaderValue,
    normalizeGeminiBaseUrl,
    normalizeGeminiModelId,
} from '../api/apiConfig';
import {
    buildResponsesPayload,
    extractOpenAITextPayload,
    extractResponsesStreamDelta,
    shouldRetryWithResponsesApi,
} from '../api/openaiResponses';
import { resolveChatSurface, resolveImageSurface } from '../api/providerSurfaceRouter';
import {
    isLikelyDocumentationBaseUrl,
    resolveProviderRuntime,
    shouldBypassChatCompatibilityForImages,
} from '../api/providerStrategy';
import { GenerationMode } from '../../types';
import { logError } from '../system/systemLogService';
import { buildInlineImagePart, buildGeminiNativeGroundingTools } from './GoogleAdapter';
import { RegionService } from '../system/RegionService';
import {
    type SyncImageBridgeParserType,
    isSyncImageBridgeSupported,
    startSyncImageBridgeRequest,
    waitForSyncImageBridgeResult
} from './syncImageBridge';
import { buildChatCompletionsBody, buildOpenAICompatibleMessages } from './openAICompatibleChatPayload';
import { forwardUserRouteGenericRequest } from '../model/secureModelProxy';
import { buildSafeFormDataPreview, buildSafeRequestBodyPreview } from './openAICompatibleDiagnostics';
import {
    buildOpenAICompatibleHttpError,
    buildOpenAICompatibleImageCompatibilityModeError,
} from './openAICompatibleErrors';
import { buildNewApiGoogleExtraBody, mergeExtraBody } from './openAICompatibleGoogleExtraBody';
import { resolveOpenAICompatibleImageDispatch } from './openAICompatibleImageDispatch';
import { extractImageUrlsFromPayload, extractOpenAICompatibleChatImageUrls } from './openAICompatibleImagePayload';
import {
    buildOpenAICompatibleImageContentParts,
    formatOpenAICompatibleReferenceImage,
    formatOpenAICompatibleReferenceImages,
} from './openAICompatibleImageReferences';
import {
    clampImageCount,
    getOpenAIImageProfile,
    normalizeGeminiImageSize,
    normalizeRequestedAspectRatio,
    resolveOpenAIEditSize,
    resolveOpenAIImageSize,
} from './openAICompatibleImageSizing';
import {
    buildOpenAICompatiblePolledTaskResult,
    extractGenericTaskId,
    extractProviderMessage,
    extractTaskItemsFromPayload,
    mapGenericTaskStatus,
} from './openAICompatibleTaskPayload';
import { isChatEndpointCompatibilityError, isImageEndpointCompatibilityError } from './openAICompatibleImageRoutingErrors';
import {
    WUYIN_ASYNC_DETAIL_PATH,
    extractWuyinStatusCode,
    extractWuyinTaskId,
    mapWuyinStatus,
    normalizeWuyinAspectRatio,
    normalizeWuyinBaseUrl,
    normalizeWuyinImageSize,
    normalizeWuyinReferenceImage,
    resolveWuyinRequestRoute,
    extractWuyinOutputUrls,
    buildWuyinImageSubmitBody,
    findWuyinCatalogItem,
    serializeWuyinSubmitBody,
} from './openAICompatibleWuyinRoute';
import { WUYIN_DEFAULT_BASE_URL } from './wuyinCatalog';

function getWuyinCatalogFromKeySlot(keySlot: any): any[] {
  const snapshot = keySlot.pricingSnapshot;
  if (!snapshot) return [];
  const rows = snapshot.rows || snapshot._rawData;
  return Array.isArray(rows) && rows.length > 0 ? rows : [];
}
import {
    normalizeAceDataBaseUrl,
    normalizeAceDataReferenceImage,
    resolveAceDataCandidateRoutes,
    resolveAceDataImageRoute,
    resolveAceDataImageSize,
} from './openAICompatibleAceDataRoute';
import {
    is12AIAsyncImageModel,
    normalize12AIAsyncReferenceImage,
    normalize12AIBaseUrl,
    resolve12AIAsyncImageQuality,
    resolve12AIAsyncImageSize,
    shouldUse12AIAsyncImageRoute,
} from './openAICompatible12AIAsyncRoute';

export class OpenAICompatibleAdapter implements LLMAdapter {
    id = 'openai-compatible-adapter';
    provider = 'OpenAI'; // Can be overridden or used for generic

    supports(_modelId: string): boolean {
        // Supports basically everything that isn't strictly Google-only
        return true;
    }

    private getTimeoutMs(keySlot: KeySlot, fallbackMs: number = 120000): number {
        const raw = keySlot.timeout;
        if (!raw || Number.isNaN(raw)) return fallbackMs;
        const bounded = Math.max(15000, Math.min(raw, 240000));
        return Math.max(fallbackMs, bounded);
    }

    private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, maxRetries: number = 3): Promise<Response> {
        let lastError: Error | null = null;
        let lastResponse: Response | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            const abortFromParent = () => controller.abort(init.signal?.reason || new Error('Request aborted by parent signal'));
            const timeoutId = setTimeout(() => {
                controller.abort(new Error(`Request timeout after ${timeoutMs}ms`));
            }, timeoutMs);

            if (init.signal?.aborted) {
                abortFromParent();
            } else if (init.signal) {
                init.signal.addEventListener('abort', abortFromParent, { once: true });
            }

            try {
                const response = await fetch(url, {
                    ...init,
                    signal: controller.signal
                });

                // 🚀 [Fix] 401/403 鉴权错误立即返回，不重试
                if (response.ok || [401, 403].includes(response.status)) {
                    return response;
                }
                // 其他非重试错误也立即返回
                if (![429, 500, 502, 503, 504].includes(response.status)) {
                    return response;
                }

                lastResponse = response;
                // It's a retryable HTTP error (e.g. 503 "no available channels"). Throw so the catch block handles delay.
                throw new Error(`HTTP ${response.status} - Transient error`);

            } catch (err: any) {
                if (
                    (err?.name === 'AbortError' || controller.signal.aborted) &&
                    !init.signal?.aborted &&
                    !String(err?.message || '').includes('timeout')
                ) {
                    err = new Error(`Request timeout after ${timeoutMs}ms`);
                }
                lastError = err;

                // If this is the last attempt, don't wait, just break and throw
                if (attempt === maxRetries) {
                    break;
                }

                // If the request was aborted manually or timed out, don't retry a non-idempotent call.
                if (err.name === 'AbortError' || controller.signal.aborted || init.signal?.aborted) {
                    break;
                }

                // Exponential backoff: 1500ms, 3000ms...
                const delayMs = 1500 * Math.pow(2, attempt - 1);
                console.warn(`[OpenAICompatibleAdapter] fetchWithTimeout: Attempt ${attempt} failed for ${this.getRequestPathFromUrl(url)}. Error: ${err.message}. Retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } finally {
                clearTimeout(timeoutId);
                if (init.signal) {
                    init.signal.removeEventListener('abort', abortFromParent);
                }
            }
        }

        // If we exhausted retries and have a valid (but failing) Response object, return it so the caller can handle/log it natively
        if (lastResponse) {
            return lastResponse;
        }

        // Otherwise it was a pure network/timeout failure
        throw lastError || new Error('Fetch failed completely after retries');
    }

    private applyCustomHeaders(headers: Record<string, string>, keySlot: KeySlot): Record<string, string> {
        const merged: Record<string, string> = { ...headers };
        const custom = keySlot.customHeaders;
        if (!custom || typeof custom !== 'object') return merged;
        Object.entries(custom).forEach(([k, v]) => {
            if (!k) return;
            merged[String(k)] = String(v ?? '');
        });
        return merged;
    }

    private applyCustomBody(base: any, keySlot: KeySlot): any {
        const custom = keySlot.customBody;
        if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return base;
        return { ...base, ...custom };
    }

    private getAuthorizationHeaderValue(rawKey: string, keySlot?: KeySlot): string {
        const token = String(rawKey || '').trim();
        if (!token) return 'Bearer ';
        const runtime = keySlot
            ? this.resolveChannelRuntime(keySlot.baseUrl || '', keySlot)
            : null;
        return formatAuthorizationHeaderValue(token, runtime?.authorizationValueFormat);
    }

    private getQueryApiKey(rawKey: string): string {
        const token = String(rawKey || '').trim();
        if (!token) return '';
        return token.replace(/^Bearer\s+/i, '').trim();
    }

    private getRequestPathFromUrl(url: string): string {
        try {
            return new URL(url).pathname;
        } catch {
            return url;
        }
    }

    private buildOpenAICompatRequestTarget(
        url: string,
        keySlot: KeySlot,
        options: {
            includeJsonContentType?: boolean;
            includeAccept?: boolean;
        } = {},
    ): { url: string; headers: Record<string, string>; requestPath: string } {
        const includeJsonContentType = options.includeJsonContentType !== false;
        const includeAccept = options.includeAccept !== false;
        const runtime = this.resolveChannelRuntime(keySlot.baseUrl || '', keySlot);
        let headers: Record<string, string> = {
            ...(includeAccept ? { Accept: 'application/json' } : {}),
            ...buildProxyHeaders(
                runtime.authMethod as AuthMethod,
                keySlot.key,
                runtime.headerName,
                keySlot.group,
                runtime.authorizationValueFormat,
            ),
        };

        headers = this.applyCustomHeaders(headers, keySlot);

        if (!includeJsonContentType) {
            delete headers['Content-Type'];
            delete headers['content-type'];
        }

        if (runtime.authMethod === 'query') {
            delete headers['Authorization'];
            delete headers['authorization'];

            const runtimeHeaderName = String(runtime.headerName || '').trim();
            if (runtimeHeaderName) {
                delete headers[runtimeHeaderName];
                delete headers[runtimeHeaderName.toLowerCase()];
            }
        }

        return {
            url: applyOpenAICompatAuthToUrl(url, runtime.authMethod as AuthMethod, keySlot.key),
            headers,
            requestPath: this.getRequestPathFromUrl(url),
        };
    }

    private async executeRecoverableSyncImageRequest(params: {
        options: ImageGenerationOptions;
        parserType: SyncImageBridgeParserType;
        url: string;
        method?: string;
        headers: Record<string, string>;
        body?: string;
        timeoutMs: number;
        requestPath: string;
        requestBodyPreview?: string;
        provider?: string;
    }): Promise<{
        urls: string[];
        responseStatus?: number;
        responseBodyPreview?: string;
        startedAt?: number;
        completedAt?: number;
        apiDurationMs?: number;
    } | null> {
        const { options, parserType, url, method = 'POST', headers, body, timeoutMs } = params;
        const requestId = String(options.syncBridgeRequestId || '').trim();
        if (!requestId || !isSyncImageBridgeSupported()) {
            return null;
        }

        const startResult = await startSyncImageBridgeRequest({
            requestId,
            parserType,
            url,
            method,
            headers,
            body,
            timeoutMs,
        });
        let result = startResult;

        if (startResult.status === 'pending') {
            try {
                options.onSyncBridgeRegistered?.(requestId, startResult.startedAt);
            } catch (error) {
                console.warn('[OpenAICompatibleAdapter] Failed to register sync bridge request early:', error);
            }

            result = await waitForSyncImageBridgeResult(requestId, {
                signal: options.signal,
                timeoutMs,
            });
        }

        if (result.status === 'success') {
            const apiDurationMs = typeof result.startedAt === 'number'
                && typeof result.completedAt === 'number'
                && result.completedAt >= result.startedAt
                ? result.completedAt - result.startedAt
                : undefined;
            return {
                urls: result.urls,
                responseStatus: result.responseStatus,
                responseBodyPreview: result.responseBodyPreview,
                startedAt: result.startedAt,
                completedAt: result.completedAt,
                apiDurationMs,
            };
        }

        if (result.status === 'error') {
            throw buildOpenAICompatibleHttpError({
                message: result.responseStatus
                    ? `[${result.responseStatus}] ${result.error}`
                    : result.error,
                status: result.responseStatus,
                requestPath: params.requestPath,
                requestBody: params.requestBodyPreview,
                responseBody: result.responseBodyPreview,
                provider: params.provider,
            });
        }

        return null;
    }

    // AceData image tasks appear to follow the same retrieve / retrieve_batch task pattern
    // used across other AceData services such as Luma.
    private async fetchAceDataTaskDetail(
        taskId: string,
        keySlot: KeySlot,
        modelId?: string,
        signal?: AbortSignal
    ): Promise<{ payload: any; requestPath: string }> {
        const cleanBase = normalizeAceDataBaseUrl(keySlot.baseUrl || '');
        const candidateRoutes = resolveAceDataCandidateRoutes(keySlot.baseUrl || '', modelId);
        let lastError: any = null;

        for (const route of candidateRoutes) {
            try {
                const requestPath = route.taskPath;
                return await this.fetchJsonTaskResponse({
                    url: `${cleanBase}${route.taskPath}`,
                    keySlot,
                    method: 'POST',
                    body: JSON.stringify({ id: taskId, action: 'retrieve' }),
                    signal,
                    requestPath,
                });
            } catch (error: any) {
                lastError = error;
                const status = Number(error?.status);
                if (status === 400 || status === 404) {
                    continue;
                }
                throw error;
            }
        }

        throw lastError || new Error(`AceData task lookup failed for task ${taskId}`);
    }

    private async fetchAceDataTaskDetails(
        taskIds: string[],
        keySlot: KeySlot,
        modelId?: string,
        signal?: AbortSignal
    ): Promise<{ payload: any; requestPath: string }> {
        const route = resolveAceDataImageRoute(keySlot.baseUrl || '', modelId);
        const cleanBase = normalizeAceDataBaseUrl(keySlot.baseUrl || '');
        return this.fetchJsonTaskResponse({
            url: `${cleanBase}${route.taskPath}`,
            keySlot,
            method: 'POST',
            body: JSON.stringify({ ids: taskIds, action: 'retrieve_batch' }),
            signal,
            requestPath: route.taskPath,
        });
    }

    private async pollAceDataImageTask(
        taskId: string,
        keySlot: KeySlot,
        options: ImageGenerationOptions,
        requestMeta?: { submitPath?: string; requestBodyPreview?: string }
    ): Promise<ImageGenerationResult> {
        const startTime = Date.now();
        const maxDurationMs = 10 * 60 * 1000;
        let pollIntervalMs = 2500;
        const maxIntervalMs = 12000;

        while (Date.now() - startTime < maxDurationMs) {
            if (options.signal?.aborted) {
                throw new Error('Image generation cancelled');
            }

            const { payload, requestPath } = await this.fetchAceDataTaskDetail(taskId, keySlot, options.modelId, options.signal);
            const status = mapGenericTaskStatus(payload);
            const message = extractProviderMessage(payload);

            if (status === 'success') {
                const urls = extractImageUrlsFromPayload(payload);
                if (!urls.length) {
                    throw buildOpenAICompatibleHttpError({
                        message: 'AceData task completed, but no image URL was returned',
                        requestPath,
                        requestBody: requestMeta?.requestBodyPreview,
                        responseBody: JSON.stringify(payload).slice(0, 1600),
                        provider: keySlot.provider,
                    });
                }

                keyManager.reportCallResult(keySlot.id, true);
                return {
                    urls,
                    taskId,
                    provider: keySlot.provider,
                    providerName: keySlot.name,
                    model: options.modelId,
                    imageSize: options.imageSize || resolveAceDataImageSize(options),
                    keySlotId: keySlot.id,
                    metadata: {
                        requestPath: requestMeta?.submitPath || requestPath,
                        requestBodyPreview: requestMeta?.requestBodyPreview,
                        apiDurationMs: Date.now() - startTime,
                    }
                };
            }

            if (status === 'failed') {
                const errorMessage = message || 'AceData image generation failed';
                keyManager.reportCallResult(keySlot.id, false, errorMessage);
                throw buildOpenAICompatibleHttpError({
                    message: errorMessage,
                    requestPath,
                    requestBody: requestMeta?.requestBodyPreview,
                    responseBody: JSON.stringify(payload).slice(0, 1600),
                    provider: keySlot.provider,
                });
            }

            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            pollIntervalMs = Math.min(Math.round(pollIntervalMs * 1.4), maxIntervalMs);
        }

        throw buildOpenAICompatibleHttpError({
            message: 'AceData image generation timed out after 10 minutes',
            requestPath: requestMeta?.submitPath || '/tasks',
            requestBody: requestMeta?.requestBodyPreview,
            provider: keySlot.provider,
        });
    }

    private normalizePollingApiBase(baseUrl: string, withV1: boolean): string {
        const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
        if (!normalized) {
            return withV1 ? 'https://api.openai.com/v1' : 'https://api.openai.com';
        }

        const withoutV1 = normalized.replace(/\/v1$/i, '');
        return withV1 ? `${withoutV1}/v1` : withoutV1;
    }

    private async fetchJsonTaskResponse(params: {
        url: string;
        keySlot: KeySlot;
        method?: 'GET' | 'POST';
        body?: string;
        signal?: AbortSignal;
        requestPath?: string;
        headers?: Record<string, string>;
    }): Promise<{ payload: any; requestPath: string }> {
        const target = params.headers
            ? {
                url: params.url,
                headers: { ...params.headers },
                requestPath: params.requestPath || this.getRequestPathFromUrl(params.url),
            }
            : this.buildOpenAICompatRequestTarget(params.url, params.keySlot, {
                includeJsonContentType: true,
                includeAccept: true,
            });
        const headers = target.headers;
        if (params.method === 'POST') {
            headers['Content-Type'] = 'application/json';
        }

        const response = await this.fetchWithTimeout(target.url, {
            method: params.method || 'GET',
            headers,
            body: params.body,
            signal: params.signal,
        }, this.getTimeoutMs(params.keySlot, 120000), 1);

        const requestPath = target.requestPath;
        const raw = await response.text().catch(() => '');

        if (!response.ok) {
            throw buildOpenAICompatibleHttpError({
                message: `[${response.status}] ${raw.slice(0, 500) || 'Task request failed'}`,
                status: response.status,
                requestPath,
                responseBody: raw.slice(0, 1600),
                provider: params.keySlot.provider,
            });
        }

        try {
            return {
                payload: raw ? JSON.parse(raw) : {},
                requestPath,
            };
        } catch {
            throw buildOpenAICompatibleHttpError({
                message: 'Task endpoint returned non-JSON payload',
                requestPath,
                responseBody: raw.slice(0, 1600),
                provider: params.keySlot.provider,
            });
        }
    }

    private async fetchGenericImageTaskDetail(
        taskId: string,
        keySlot: KeySlot,
        signal?: AbortSignal
    ): Promise<{ payload: any; requestPath: string }> {
        const cleanBase = this.normalizePollingApiBase(keySlot.baseUrl || '', true);
        const url = `${cleanBase}/images/tasks/${encodeURIComponent(taskId)}`;
        return this.fetchJsonTaskResponse({
            url,
            keySlot,
            signal,
            requestPath: `/v1/images/tasks/${encodeURIComponent(taskId)}`,
        });
    }

    private async fetchMidjourneyTaskDetail(
        taskId: string,
        keySlot: KeySlot,
        signal?: AbortSignal
    ): Promise<{ payload: any; requestPath: string }> {
        const cleanBase = this.normalizePollingApiBase(keySlot.baseUrl || '', false);
        const url = `${cleanBase}/mj/task/${encodeURIComponent(taskId)}/fetch`;
        return this.fetchJsonTaskResponse({
            url,
            keySlot,
            signal,
            requestPath: `/mj/task/${encodeURIComponent(taskId)}/fetch`,
        });
    }

    private async fetchMidjourneyTasksByIds(
        taskIds: string[],
        keySlot: KeySlot,
        signal?: AbortSignal
    ): Promise<{ payload: any; requestPath: string }> {
        const cleanBase = this.normalizePollingApiBase(keySlot.baseUrl || '', false);
        const url = `${cleanBase}/mj/task/list-by-condition`;
        return this.fetchJsonTaskResponse({
            url,
            keySlot,
            method: 'POST',
            body: JSON.stringify({ ids: taskIds }),
            signal,
            requestPath: '/mj/task/list-by-condition',
        });
    }

    private async fetch12AIAsyncImageTaskDetail(
        taskId: string,
        keySlot: KeySlot,
        signal?: AbortSignal
    ): Promise<{ payload: any; requestPath: string }> {
        const cleanBase = normalize12AIBaseUrl(keySlot.baseUrl || '');
        const requestPath = `/v1/images/async/generations/${encodeURIComponent(taskId)}`;
        const url = `${cleanBase}${requestPath}`;

        return this.fetchJsonTaskResponse({
            url,
            keySlot,
            signal,
            requestPath,
            headers: this.build12AIAsyncImageHeaders(keySlot),
        });
    }

    private async poll12AIAsyncImageTask(
        taskId: string,
        keySlot: KeySlot,
        options: ImageGenerationOptions,
        requestMeta?: {
            submitPath?: string;
            requestBodyPreview?: string;
            imageSize?: string;
        }
    ): Promise<ImageGenerationResult> {
        const startTime = Date.now();
        const maxDurationMs = 10 * 60 * 1000;
        let pollIntervalMs = 2500;
        const maxIntervalMs = 12000;

        while (Date.now() - startTime < maxDurationMs) {
            if (options.signal?.aborted) {
                throw new Error('Image generation cancelled');
            }

            const { payload, requestPath } = await this.fetch12AIAsyncImageTaskDetail(taskId, keySlot, options.signal);
            const result = buildOpenAICompatiblePolledTaskResult({
                payload,
                taskId: extractGenericTaskId(payload) || taskId,
                requestPath,
                keySlot,
            });

            if (result.status === 'success') {
                const urls = Array.isArray(result.urls) ? result.urls : [];
                if (!urls.length) {
                    throw buildOpenAICompatibleHttpError({
                        message: '12AI async task completed, but no image URL was returned',
                        requestPath,
                        requestBody: requestMeta?.requestBodyPreview,
                        responseBody: JSON.stringify(payload).slice(0, 1600),
                        provider: keySlot.provider,
                    });
                }

                keyManager.reportCallResult(keySlot.id, true);
                return {
                    urls,
                    taskId,
                    provider: keySlot.provider,
                    providerName: keySlot.name,
                    model: options.modelId,
                    imageSize: requestMeta?.imageSize || options.imageSize || resolve12AIAsyncImageSize(options),
                    keySlotId: keySlot.id,
                    metadata: {
                        requestPath: requestMeta?.submitPath || requestPath,
                        requestBodyPreview: requestMeta?.requestBodyPreview,
                        apiDurationMs: Date.now() - startTime,
                    }
                };
            }

            if (result.status === 'failed') {
                const message = String(result.metadata?.responseMessage || extractProviderMessage(payload) || '12AI async image generation failed').trim();
                keyManager.reportCallResult(keySlot.id, false, message);
                throw buildOpenAICompatibleHttpError({
                    message,
                    requestPath,
                    requestBody: requestMeta?.requestBodyPreview,
                    responseBody: JSON.stringify(payload).slice(0, 1600),
                    provider: keySlot.provider,
                });
            }

            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            pollIntervalMs = Math.min(Math.round(pollIntervalMs * 1.4), maxIntervalMs);
        }

        throw buildOpenAICompatibleHttpError({
            message: '12AI async image generation timed out after 10 minutes',
            requestPath: requestMeta?.submitPath || '/v1/images/async/generations',
            requestBody: requestMeta?.requestBodyPreview,
            provider: keySlot.provider,
        });
    }

    private async generateImage12AIAsync(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        const cleanBase = normalize12AIBaseUrl(keySlot.baseUrl || '');
        const requestPath = '/v1/images/async/generations';
        const url = `${cleanBase}${requestPath}`;
        const size = resolve12AIAsyncImageSize(options);
        const body: Record<string, any> = {
            model: options.modelId,
            prompt: options.prompt,
            n: clampImageCount(options.imageCount, 10),
            size,
        };
        const quality = resolve12AIAsyncImageQuality(options);
        if (quality) {
            body.quality = quality;
        }

        if (options.referenceImages?.length) {
            const refs = options.referenceImages
                .map((ref) => normalize12AIAsyncReferenceImage(ref))
                .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

            if (refs.length === 1) {
                body.image = refs[0];
            } else if (refs.length > 1) {
                body.images = refs;
            }
        }

        const payload = this.applyCustomBody(body, keySlot);
        const requestBodyPreview = buildSafeRequestBodyPreview(payload);
        const response = await this.fetchWithTimeout(url, {
            method: 'POST',
            headers: this.build12AIAsyncImageHeaders(keySlot),
            body: JSON.stringify(payload),
            signal: options.signal,
        }, this.getTimeoutMs(keySlot, 120000), 1);

        const raw = await response.text().catch(() => '');
        if (!response.ok) {
            keyManager.reportCallResult(keySlot.id, false, raw.slice(0, 300) || `HTTP ${response.status}`);
            throw buildOpenAICompatibleHttpError({
                message: `[${response.status}] ${raw.slice(0, 500) || '12AI async image request failed'}`,
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        let submitPayload: any = {};
        try {
            submitPayload = raw ? JSON.parse(raw) : {};
        } catch {
            throw buildOpenAICompatibleHttpError({
                message: '12AI async image submit endpoint returned non-JSON payload',
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        const immediateUrls = extractImageUrlsFromPayload(submitPayload);
        if (immediateUrls.length > 0) {
            keyManager.reportCallResult(keySlot.id, true);
            return {
                urls: immediateUrls,
                taskId: extractGenericTaskId(submitPayload) || undefined,
                provider: keySlot.provider,
                providerName: keySlot.name,
                model: options.modelId,
                imageSize: size,
                keySlotId: keySlot.id,
                metadata: {
                    requestPath,
                    requestBodyPreview,
                }
            };
        }

        const taskId = extractGenericTaskId(submitPayload);
        if (!taskId) {
            const message = extractProviderMessage(submitPayload) || '12AI async submit succeeded but no task ID was returned';
            throw buildOpenAICompatibleHttpError({
                message,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        options.onTaskId?.(taskId);
        return this.poll12AIAsyncImageTask(taskId, keySlot, options, {
            submitPath: requestPath,
            requestBodyPreview,
            imageSize: size,
        });
    }

    private async fetchWuyinTaskDetail(
        taskId: string,
        keySlot: KeySlot,
        signal?: AbortSignal
    ): Promise<{ payload: any; requestPath: string }> {
        const cleanBase = normalizeWuyinBaseUrl(keySlot.baseUrl || '');
        const detailUrl = new URL(`${cleanBase}${WUYIN_ASYNC_DETAIL_PATH}`);
        detailUrl.searchParams.set('id', taskId);
        
        const response = await forwardUserRouteGenericRequest({
            url: detailUrl.toString(),
            method: 'GET',
            keyId: keySlot.id,
            apiKey: keySlot.key,
            headers: {
                Accept: 'application/json',
            },
            signal,
        });

        const requestPath = `${WUYIN_ASYNC_DETAIL_PATH}?id=${encodeURIComponent(taskId)}`;
        const raw = await response.text().catch(() => '');

        if (!response.ok) {
            throw buildOpenAICompatibleHttpError({
                message: `[${response.status}] ${raw.slice(0, 500) || 'Wuyin detail request failed'}`,
                status: response.status,
                requestPath,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        let payload: any = {};
        try {
            payload = raw ? JSON.parse(raw) : {};
        } catch {
            throw buildOpenAICompatibleHttpError({
                message: 'Wuyin detail endpoint returned non-JSON payload',
                requestPath,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        const logicalCode = Number(payload?.code);
        if (Number.isFinite(logicalCode) && logicalCode !== 200 && logicalCode !== 0) {
            const message = extractProviderMessage(payload) || `Wuyin detail error code ${logicalCode}`;
            throw buildOpenAICompatibleHttpError({
                message,
                requestPath,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        return { payload, requestPath };
    }

    private async pollWuyinImageTask(
        taskId: string,
        keySlot: KeySlot,
        options: ImageGenerationOptions,
        requestMeta?: { submitPath?: string; requestBodyPreview?: string; endpointModelId?: string }
    ): Promise<ImageGenerationResult> {
        const startTime = Date.now();
        const maxDurationMs = 10 * 60 * 1000;
        let pollIntervalMs = 2500;
        const maxIntervalMs = 12000;

        while (Date.now() - startTime < maxDurationMs) {
            if (options.signal?.aborted) {
                throw new Error('Image generation cancelled');
            }

            const { payload, requestPath } = await this.fetchWuyinTaskDetail(taskId, keySlot, options.signal);
            const statusCode = extractWuyinStatusCode(payload);
            const status = mapWuyinStatus(statusCode);

            if (status === 'success') {
                const urls = extractImageUrlsFromPayload(payload);
                if (!urls.length) {
                    throw buildOpenAICompatibleHttpError({
                        message: 'Wuyin task completed, but no image URL was returned',
                        requestPath,
                        requestBody: requestMeta?.requestBodyPreview,
                        responseBody: JSON.stringify(payload).slice(0, 1600),
                        provider: keySlot.provider,
                    });
                }

                keyManager.reportCallResult(keySlot.id, true);
                return {
                    urls,
                    taskId,
                    provider: keySlot.provider,
                    providerName: keySlot.name,
                    model: options.modelId,
                    imageSize: normalizeWuyinImageSize(options.imageSize),
                    metadata: {
                        requestPath: requestMeta?.submitPath || requestPath,
                        requestBodyPreview: requestMeta?.requestBodyPreview,
                        apiDurationMs: Date.now() - startTime,
                    }
                };
            }

            if (status === 'failed') {
                const message = extractProviderMessage(payload) || 'Wuyin image generation failed';
                keyManager.reportCallResult(keySlot.id, false, message);
                throw buildOpenAICompatibleHttpError({
                    message,
                    requestPath,
                    requestBody: requestMeta?.requestBodyPreview,
                    responseBody: JSON.stringify(payload).slice(0, 1600),
                    provider: keySlot.provider,
                });
            }

            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            pollIntervalMs = Math.min(Math.round(pollIntervalMs * 1.4), maxIntervalMs);
        }

        throw buildOpenAICompatibleHttpError({
            message: 'Wuyin image generation timed out after 10 minutes',
            requestPath: requestMeta?.submitPath || WUYIN_ASYNC_DETAIL_PATH,
            requestBody: requestMeta?.requestBodyPreview,
            provider: keySlot.provider,
        });
    }

    private async generateImageWuyinAsync(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        const catalog = getWuyinCatalogFromKeySlot(keySlot);
        const route = resolveWuyinRequestRoute({
            baseUrl: keySlot.baseUrl || '',
            modelId: options.modelId,
            provider: keySlot as any,
            catalog,
        });
        const item = findWuyinCatalogItem(route.endpointModelId, catalog) || findWuyinCatalogItem(options.modelId, catalog);
        if (!item) throw new Error(`速创模型不存在：${options.modelId}`);
        if (item.kind !== 'image') throw new Error(`当前模型不是图片模型：${item.name}`);

        const url = `${normalizeWuyinBaseUrl(keySlot.baseUrl || WUYIN_DEFAULT_BASE_URL)}${route.endpointPath}`;
        const body = buildWuyinImageSubmitBody({
            prompt: options.prompt,
            modelId: route.endpointModelId,
            endpointPath: route.endpointPath,
            imageSize: options.imageSize,
            aspectRatio: options.aspectRatio,
            referenceImages: options.referenceImages,
        });
        const submitContentType = item.contentType || item.submitContentType || route.contentType || 'application/json';

        const response = await forwardUserRouteGenericRequest({
            url,
            method: item.method,
            keyId: keySlot.id,
            apiKey: keySlot.key,
            body: serializeWuyinSubmitBody(body, submitContentType),
            headers: {
                'Content-Type': submitContentType,
                Accept: 'application/json',
            },
            signal: options.signal,
        });

        const raw = await response.text().catch(() => '');
        if (!response.ok) {
            keyManager.reportCallResult(keySlot.id, false, raw.slice(0, 300) || `HTTP ${response.status}`);
            throw buildOpenAICompatibleHttpError({
                message: `[${response.status}] ${raw.slice(0, 500) || 'Wuyin image request failed'}`,
                status: response.status,
                requestPath: route.endpointPath,
                requestBody: JSON.stringify(body),
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        let submitPayload: any = {};
        try {
            submitPayload = raw ? JSON.parse(raw) : {};
        } catch {
            throw buildOpenAICompatibleHttpError({
                message: 'Wuyin image submit endpoint returned non-JSON payload',
                requestPath: route.endpointPath,
                requestBody: JSON.stringify(body),
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        const logicalCode = Number(submitPayload?.code);
        if (Number.isFinite(logicalCode) && logicalCode !== 200 && logicalCode !== 0) {
            const message = extractProviderMessage(submitPayload) || `Wuyin submit error code ${logicalCode}`;
            keyManager.reportCallResult(keySlot.id, false, message);
            throw buildOpenAICompatibleHttpError({
                message,
                requestPath: route.endpointPath,
                requestBody: JSON.stringify(body),
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        const immediateUrls = extractWuyinOutputUrls(submitPayload);
        if (immediateUrls.length > 0) {
            keyManager.reportCallResult(keySlot.id, true);
            return {
                urls: immediateUrls,
                provider: keySlot.provider,
                providerName: keySlot.name,
                model: options.modelId,
                imageSize: normalizeWuyinImageSize(options.imageSize),
                keySlotId: keySlot.id,
                metadata: {
                    requestPath: route.endpointPath,
                    requestBodyPreview: JSON.stringify(body),
                }
            };
        }

        const taskId = extractWuyinTaskId(submitPayload);
        if (!taskId) {
            throw buildOpenAICompatibleHttpError({
                message: 'Wuyin submit succeeded but no task ID was returned',
                requestPath: route.endpointPath,
                requestBody: JSON.stringify(body),
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        options.onTaskId?.(taskId);
        const finalResult = await this.pollWuyinImageTask(taskId, keySlot, options, {
            submitPath: route.endpointPath,
            requestBodyPreview: JSON.stringify(body),
            endpointModelId: route.endpointModelId,
        });

        if (!finalResult.model) {
            finalResult.model = options.modelId;
        }
        if (!finalResult.providerName) {
            finalResult.providerName = keySlot.name;
        }
        if (!finalResult.keySlotId) {
            finalResult.keySlotId = keySlot.id;
        }

        return finalResult;
    }

    private async generateImageAceData(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        const cleanBase = normalizeAceDataBaseUrl(keySlot.baseUrl || '');
        const route = resolveAceDataImageRoute(keySlot.baseUrl || '', options.modelId);
        const url = `${cleanBase}${route.endpointPath}`;
        const requestPath = route.endpointPath;
        const resolvedSize = resolveAceDataImageSize(options);
        const count = clampImageCount(options.imageCount, 10);
        const normalizedRefs = Array.isArray(options.referenceImages)
            ? options.referenceImages.map((ref, index) =>
                normalizeAceDataReferenceImage(ref as { data: string; mimeType: string; url?: string }, index)
            )
            : [];

        const body: Record<string, any> = {
            action: route.serviceId === 'flux' && normalizedRefs.length > 0 ? 'edits' : 'generate',
            prompt: options.prompt,
            model: options.modelId,
            size: resolvedSize,
        };

        if (count > 1) {
            body.count = count;
        }

        if (normalizedRefs.length > 0) {
            if (route.serviceId === 'flux') {
                body.image_url = normalizedRefs[0];
                if (normalizedRefs.length > 1) {
                    body.image_urls = normalizedRefs;
                }
            } else if (normalizedRefs.length === 1) {
                body.image_url = normalizedRefs[0];
            } else {
                body.image_urls = normalizedRefs;
            }
        }

        const target = this.buildOpenAICompatRequestTarget(url, keySlot, {
            includeJsonContentType: true,
            includeAccept: true,
        });
        const payload = this.applyCustomBody(body, keySlot);
        const payloadStr = JSON.stringify(payload);
        const requestBodyPreview = buildSafeRequestBodyPreview(payload);

        const bridgedResult = await this.executeRecoverableSyncImageRequest({
            options,
            parserType: 'openai-compatible-image',
            url: target.url,
            headers: target.headers,
            body: payloadStr,
            timeoutMs: this.getTimeoutMs(keySlot, 400000),
            requestPath,
            requestBodyPreview,
            provider: keySlot.provider,
        });
        if (bridgedResult) {
            return {
                urls: bridgedResult.urls,
                provider: keySlot.provider,
                providerName: keySlot.name,
                model: options.modelId,
                imageSize: resolvedSize,
                keySlotId: keySlot.id,
                metadata: {
                    apiDurationMs: bridgedResult.apiDurationMs,
                    requestPath,
                    requestBodyPreview,
                    referenceImages: normalizedRefs.length > 0
                        ? {
                            input: normalizedRefs.length,
                            used: normalizedRefs.length,
                            dropped: 0,
                            maxAllowed: normalizedRefs.length,
                        }
                        : undefined,
                }
            };
        }

        const response = await this.fetchWithTimeout(target.url, {
            method: 'POST',
            headers: target.headers,
            body: payloadStr,
            signal: options.signal,
        }, this.getTimeoutMs(keySlot, 400000), 1);

        const raw = await response.text().catch(() => '');
        if (!response.ok) {
            keyManager.reportCallResult(keySlot.id, false, raw.slice(0, 300) || `HTTP ${response.status}`);
            throw buildOpenAICompatibleHttpError({
                message: `[${response.status}] ${raw.slice(0, 500) || 'AceData image request failed'}`,
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        let submitPayload: any = {};
        try {
            submitPayload = raw ? JSON.parse(raw) : {};
        } catch {
            throw buildOpenAICompatibleHttpError({
                message: 'AceData image endpoint returned non-JSON payload',
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        if (submitPayload?.success === false) {
            const errorMessage = extractProviderMessage(submitPayload) || 'AceData image generation failed';
            keyManager.reportCallResult(keySlot.id, false, errorMessage);
            throw buildOpenAICompatibleHttpError({
                message: errorMessage,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        const taskId = extractGenericTaskId(submitPayload);
        const immediateUrls = extractImageUrlsFromPayload(submitPayload);
        if (immediateUrls.length > 0) {
            keyManager.reportCallResult(keySlot.id, true);
            return {
                urls: immediateUrls,
                taskId: taskId || undefined,
                provider: keySlot.provider,
                providerName: keySlot.name,
                model: options.modelId,
                imageSize: resolvedSize,
                keySlotId: keySlot.id,
                metadata: {
                    requestPath,
                    requestBodyPreview,
                    referenceImages: normalizedRefs.length > 0
                        ? {
                            input: normalizedRefs.length,
                            used: normalizedRefs.length,
                            dropped: 0,
                            maxAllowed: normalizedRefs.length,
                        }
                        : undefined,
                }
            };
        }

        if (!taskId) {
            throw buildOpenAICompatibleHttpError({
                message: 'AceData submit succeeded but no image URL or task ID was returned',
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        options.onTaskId?.(taskId);
        return this.pollAceDataImageTask(taskId, keySlot, options, {
            submitPath: requestPath,
            requestBodyPreview,
        });
    }

    private isLegacyGeminiChatGateway(baseUrl: string): boolean {
        return resolveProviderRuntime({ baseUrl }).strategyId === 'antigravity';
    }

    private resolveChannelRuntime(baseUrl: string, keySlot: KeySlot, modelId?: string, format?: string) {
        return resolveProviderRuntime({
            provider: this.getResolvedProviderName(keySlot),
            baseUrl,
            format: format ?? keySlot.format,
            authMethod: keySlot.authMethod,
            headerName: keySlot.headerName,
            compatibilityMode: keySlot.compatibilityMode,
            modelId,
        });
    }

    private build12AIAsyncImageHeaders(keySlot: KeySlot): Record<string, string> {
        const token = String(keySlot.key || '').trim();
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': formatAuthorizationHeaderValue(token, 'bearer'),
        };

        if (keySlot.headerName && keySlot.headerName !== 'Authorization') {
            delete headers.Authorization;
            delete headers.authorization;
            headers[keySlot.headerName] = token;
        }

        return this.applyCustomHeaders(headers, keySlot);
    }

    private applyCustomFormData(formData: FormData, keySlot: KeySlot): FormData {
        const custom = keySlot.customBody;
        if (!custom || typeof custom !== 'object' || Array.isArray(custom)) {
            return formData;
        }

        Object.entries(custom).forEach(([key, value]) => {
            if (value === undefined || value === null) return;

            if (value instanceof Blob) {
                formData.append(key, value);
                return;
            }

            if (typeof value === 'string') {
                formData.append(key, value);
                return;
            }

            formData.append(key, JSON.stringify(value));
        });

        return formData;
    }

    private shouldUseOpenAIEditsEndpoint(options: ImageGenerationOptions, baseUrl: string): boolean {
        const hasReferenceImages = Array.isArray(options.referenceImages) && options.referenceImages.length > 0;
        if (!hasReferenceImages) return false;
        if (options.editMode) return true;

        const profile = getOpenAIImageProfile(options.modelId);
        return baseUrl.includes('api.openai.com') || profile !== 'generic';
    }

    private async buildMultipartBlob(
        source: string | { data: string; mimeType: string },
        fallbackBaseName: string
    ): Promise<{ blob: Blob; fileName: string }> {
        const { data, mimeType } = extractRefImageData(source);
        const raw = String(data || '');

        let blob: Blob;
        let resolvedMimeType = mimeType || 'image/png';

        if (/^https?:\/\//i.test(raw)) {
            const response = await fetch(raw);
            if (!response.ok) {
                throw new Error(`Failed to download multipart input: HTTP ${response.status}`);
            }
            blob = await response.blob();
            resolvedMimeType = blob.type || resolvedMimeType;
        } else {
            const normalized = raw.startsWith('data:')
                ? raw
                : `data:${resolvedMimeType};base64,${raw.replace(/^data:[^;]+;base64,/, '')}`;
            const response = await fetch(normalized);
            blob = await response.blob();
            resolvedMimeType = blob.type || resolvedMimeType;
        }

        const extension = resolvedMimeType.includes('jpeg')
            ? 'jpg'
            : resolvedMimeType.includes('webp')
                ? 'webp'
                : resolvedMimeType.includes('gif')
                    ? 'gif'
                    : 'png';

        return {
            blob,
            fileName: `${fallbackBaseName}.${extension}`
        };
    }

    private async appendMultipartImageField(
        formData: FormData,
        fieldName: string,
        source: string | { data: string; mimeType: string },
        fallbackBaseName: string
    ): Promise<void> {
        const { blob, fileName } = await this.buildMultipartBlob(source, fallbackBaseName);
        formData.append(fieldName, blob, fileName);
    }

    private getResolvedProviderName(keySlot: KeySlot): string {
        if (keySlot.provider === 'Custom' && keySlot.name) {
            return keySlot.name;
        }
        return keySlot.provider;
    }

    private buildOpenAICompatibleBaseUrl(baseUrl?: string): string {
        return String(baseUrl || 'https://api.openai.com').trim().replace(/\/+$/, '');
    }

    private assertOpenAICompatibleRuntimeBaseUrl(keySlot: KeySlot, surface: 'chat' | 'images', format?: string): void {
        const runtime = this.resolveChannelRuntime(keySlot.baseUrl || '', keySlot, undefined, format);
        const rawBaseUrl = String(keySlot.baseUrl || '').trim();
        const allowOfficialDefault = runtime.strategyId === 'openai'
            || runtime.strategyId === '12ai'
            || (format === 'gemini' && runtime.providerFamily === 'google-official');

        if (runtime.strategyId !== 'openai' && !allowOfficialDefault && !rawBaseUrl) {
            const surfaceLabel = surface === 'chat' ? 'Chat' : 'Images';
            throw new Error(`${runtime.strategy.label || runtime.strategyId} ${surfaceLabel} 路由缺少 Base URL。请先填写该供应商工作台提供的真实 Base URL，不能回退到 OpenAI 官方地址。`);
        }
    }

    private buildResponsesApiBody(options: ChatOptions, messages: any[], stream: boolean, keySlot: KeySlot): any {
        const body = buildResponsesPayload({
            model: options.modelId,
            messages,
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens || 20480,
            stream,
            extraBody: options.extraBody,
        });

        return this.applyCustomBody(body, keySlot);
    }

    private async parseOpenAIJsonResponse(
        response: Response,
        url: string,
        keySlot: KeySlot,
        requestBody: any,
    ): Promise<any> {
        const rawText = await response.text().catch(() => '');
        const requestPath = this.getRequestPathFromUrl(url);
        const requestBodyPreview = buildSafeRequestBodyPreview(requestBody);

        if (!response.ok) {
            let errMsg = `HTTP ${response.status}`;
            try {
                const err = JSON.parse(rawText || '{}');
                errMsg = err.error?.message || err.message || errMsg;
            } catch {
                errMsg = rawText.substring(0, 500) || errMsg;
            }

            throw buildOpenAICompatibleHttpError({
                message: errMsg,
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: rawText.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        if (!rawText.trim()) {
            return {};
        }

        try {
            return JSON.parse(rawText);
        } catch {
            throw buildOpenAICompatibleHttpError({
                message: 'Invalid JSON response from provider',
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: rawText.slice(0, 1600),
                provider: keySlot.provider,
            });
        }
    }

    private async chatWuyinCustom(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        const lastMessage = [...options.messages].reverse().find((m) => m.role === 'user');
        const userInput = lastMessage ? lastMessage.content : '';
        const modelId = options.modelId || 'gemini-3-pro';

        const url = 'https://api.wuyinkeji.com/api/chat/index';
        const params = new URLSearchParams();
        params.append('content', userInput);
        params.append('model', modelId);
        params.append('stream', 'false');

        const requestBodyPreview = params.toString();
        const requestPath = '/api/chat/index';

        const response = await forwardUserRouteGenericRequest({
            url,
            method: 'POST',
            body: params.toString(),
            keyId: keySlot.id,
            apiKey: keySlot.key,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                Accept: 'application/json',
            },
            signal: options.signal,
        });

        const raw = await response.text().catch(() => '');
        if (!response.ok) {
            const status = response.status;
            let errorMessage = `HTTP ${status}`;
            if (status === 404 || raw.toLowerCase().includes('<!doctype html>') || raw.toLowerCase().includes('<html>')) {
                errorMessage = '请求地址错误 (HTTP 404 / HTML)';
            } else if (status === 401 || status === 403) {
                errorMessage = 'Authorization 密钥错误或权限不足';
            } else if (status === 400 || status === 422) {
                errorMessage = 'content 或 model 参数缺失或格式错误';
            } else {
                errorMessage = raw.slice(0, 500) || `请求失败 (${status})`;
            }

            keyManager.reportCallResult(keySlot.id, false, errorMessage);
            throw buildOpenAICompatibleHttpError({
                message: errorMessage,
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        let payload: any = {};
        try {
            payload = raw ? JSON.parse(raw) : {};
        } catch {
            throw buildOpenAICompatibleHttpError({
                message: '速创 API 响应非 JSON 格式',
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider,
            });
        }

        // 提取模型回复内容
        let textPreview = '';
        if (typeof payload === 'string') {
            textPreview = payload;
        } else if (payload && typeof payload === 'object') {
            textPreview = payload.content || payload.text || payload.message || 
                          payload.data?.content || payload.data?.text || 
                          payload.data?.message || '';
            if (!textPreview) {
                textPreview = JSON.stringify(payload);
            }
        }

        keyManager.reportCallResult(keySlot.id, true);
        return textPreview;
    }

    private async chatStreamWuyinCustom(options: ChatOptions, keySlot: KeySlot): Promise<void> {
        const content = await this.chatWuyinCustom(options, keySlot);
        if (content && options.onStream) {
            options.onStream(content);
        }
    }

    private async chatWithCompatibleResponses(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        const runtime = this.resolveChannelRuntime(keySlot.baseUrl || '', keySlot, options.modelId);
        if (runtime.strategyId === 'wuyinkeji') {
            return this.chatWuyinCustom(options, keySlot);
        }
        this.assertOpenAICompatibleRuntimeBaseUrl(keySlot, 'chat');
        const baseUrl = this.buildOpenAICompatibleBaseUrl(keySlot.baseUrl);
        const chatTarget = this.buildOpenAICompatRequestTarget(buildOpenAIEndpoint(baseUrl, '/chat/completions'), keySlot, {
            includeJsonContentType: true,
            includeAccept: false,
        });
        const responsesTarget = this.buildOpenAICompatRequestTarget(buildOpenAIEndpoint(baseUrl, '/responses'), keySlot, {
            includeJsonContentType: true,
            includeAccept: false,
        });
        const messages = buildOpenAICompatibleMessages(options);
        const chatBody = this.applyCustomBody(buildChatCompletionsBody(options, messages), keySlot);
        const responsesBody = this.buildResponsesApiBody(options, messages, false, keySlot);
        const preferResponses = resolveChatSurface({
            runtime,
            modelId: options.modelId,
        }) === 'openai-responses';

        const executeJsonRequest = async (
            target: { url: string; headers: Record<string, string>; requestPath: string },
            body: any,
        ): Promise<any> => {
            const payloadStr = JSON.stringify(body);
            if (payloadStr.length > 48 * 1024 * 1024) {
                console.error(`[OpenAICompatibleAdapter] Chat request payload (${(payloadStr.length / 1024 / 1024).toFixed(2)}MB) is close to the 50MB limit.`);
            }

            const response = await this.fetchWithTimeout(target.url, {
                method: 'POST',
                headers: target.headers,
                body: payloadStr,
                signal: options.signal
            }, this.getTimeoutMs(keySlot, 120000), 1);

            return this.parseOpenAIJsonResponse(response, target.requestPath, keySlot, body);
        };

        try {
            const data = preferResponses
                ? await executeJsonRequest(responsesTarget, responsesBody)
                : await executeJsonRequest(chatTarget, chatBody);
            keyManager.reportCallResult(keySlot.id, true);
            return extractOpenAITextPayload(data) || '';
        } catch (error: any) {
            const combinedErrorText = [error?.message, error?.responseBody].filter(Boolean).join('\n');

            if (!preferResponses && shouldRetryWithResponsesApi(error?.status, combinedErrorText)) {
                try {
                    const data = await executeJsonRequest(responsesTarget, responsesBody);
                    keyManager.reportCallResult(keySlot.id, true);
                    return extractOpenAITextPayload(data) || '';
                } catch (responsesError: any) {
                    const finalMessage = responsesError?.message || error?.message || 'Request failed';
                    keyManager.reportCallResult(keySlot.id, false, finalMessage);
                    logError(
                        'OpenAIAdapter',
                        responsesError instanceof Error ? responsesError : new Error(finalMessage),
                        `Path: ${responsesTarget.requestPath}\nStatus: ${responsesError?.status ?? 'unknown'}\nRaw Response: ${String(responsesError?.responseBody || '').slice(0, 500)}`,
                    );
                    throw responsesError;
                }
            }

            const errMsg = error?.message || 'Request failed';
            keyManager.reportCallResult(keySlot.id, false, errMsg);
            logError(
                'OpenAIAdapter',
                error instanceof Error ? error : new Error(errMsg),
                `Path: ${preferResponses ? responsesTarget.requestPath : chatTarget.requestPath}\nStatus: ${error?.status ?? 'unknown'}\nRaw Response: ${String(error?.responseBody || '').slice(0, 500)}`,
            );
            throw error;
        }
    }

    private async chatStreamWithCompatibleResponses(options: ChatOptions, keySlot: KeySlot): Promise<void> {
        const runtime = this.resolveChannelRuntime(keySlot.baseUrl || '', keySlot, options.modelId);
        if (runtime.strategyId === 'wuyinkeji') {
            return this.chatStreamWuyinCustom(options, keySlot);
        }
        this.assertOpenAICompatibleRuntimeBaseUrl(keySlot, 'chat');
        const baseUrl = this.buildOpenAICompatibleBaseUrl(keySlot.baseUrl);
        const chatTarget = this.buildOpenAICompatRequestTarget(buildOpenAIEndpoint(baseUrl, '/chat/completions'), keySlot, {
            includeJsonContentType: true,
            includeAccept: false,
        });
        const responsesTarget = this.buildOpenAICompatRequestTarget(buildOpenAIEndpoint(baseUrl, '/responses'), keySlot, {
            includeJsonContentType: true,
            includeAccept: false,
        });
        const messages = buildOpenAICompatibleMessages(options);
        const chatBody = this.applyCustomBody({
            ...buildChatCompletionsBody(options, messages),
            stream: true
        }, keySlot);
        const responsesBody = this.buildResponsesApiBody(options, messages, true, keySlot);
        const preferResponses = resolveChatSurface({
            runtime,
            modelId: options.modelId,
        }) === 'openai-responses';

        const streamRequest = async (
            target: { url: string; headers: Record<string, string>; requestPath: string },
            body: any,
            mode: 'chat' | 'responses',
        ): Promise<void> => {
            const response = await this.fetchWithTimeout(target.url, {
                method: 'POST',
                headers: target.headers,
                body: JSON.stringify(body),
                signal: options.signal
            }, this.getTimeoutMs(keySlot, 120000), 1);

            if (!response.ok || !response.body) {
                const text = await response.text().catch(() => '');
                throw buildOpenAICompatibleHttpError({
                    message: text || `HTTP ${response.status}`,
                    status: response.status,
                    requestPath: target.requestPath,
                    requestBody: buildSafeRequestBodyPreview(body),
                    responseBody: text.slice(0, 1600),
                    provider: keySlot.provider,
                });
            }

            keyManager.reportCallResult(keySlot.id, true);
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line || !line.startsWith('data:')) continue;

                    const payload = line.slice(5).trim();
                    if (payload === '[DONE]') return;

                    try {
                        const json = JSON.parse(payload);
                        const chunk = mode === 'responses'
                            ? extractResponsesStreamDelta(json)
                            : json.choices?.[0]?.delta?.content;
                        if (chunk) {
                            options.onStream?.(chunk);
                        }
                    } catch {
                        // ignore malformed stream chunks
                    }
                }
            }
        };

        try {
            await streamRequest(
                preferResponses ? responsesTarget : chatTarget,
                preferResponses ? responsesBody : chatBody,
                preferResponses ? 'responses' : 'chat',
            );
        } catch (error: any) {
            const combinedErrorText = [error?.message, error?.responseBody].filter(Boolean).join('\n');
            if (!preferResponses && shouldRetryWithResponsesApi(error?.status, combinedErrorText)) {
                try {
                    await streamRequest(responsesTarget, responsesBody, 'responses');
                    return;
                } catch (responsesError: any) {
                    keyManager.reportCallResult(keySlot.id, false, responsesError?.message || error?.message || 'Streaming request failed');
                    throw responsesError;
                }
            }

            keyManager.reportCallResult(keySlot.id, false, error?.message || 'Streaming request failed');
            throw error;
        }
    }

    async chat(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        return this.chatWithCompatibleResponses(options, keySlot);
    }

    async chatStream(options: ChatOptions, keySlot: KeySlot): Promise<void> {
        return this.chatStreamWithCompatibleResponses(options, keySlot);
    }

    async generateImage(options: ImageGenerationOptions, keySlot: KeySlot): Promise<ImageGenerationResult> {
        // [Note] 内置加速服务 (SystemProxy) 逻辑已移除

        const modelLower = options.modelId.toLowerCase();
        const rawBaseUrl = keySlot.baseUrl || '';
        if (isLikelyDocumentationBaseUrl(rawBaseUrl)) {
            throw new Error(`当前 Base URL 看起来是文档地址 (${rawBaseUrl})，不是供应商 API 地址。请改成供应商工作台里显示的真实 Base URL。`);
        }
        const baseUrl = rawBaseUrl.toLowerCase();

        const isGeminiImage = modelLower.includes('gemini') && modelLower.includes('image') ||
            modelLower.includes('nano-banana') ||
            modelLower.includes('banana');

        // 🚀 [Protocol Routing]
        // 12AI + Gemini 图片模型：强制走 Gemini Native（严格对齐 12AI 文档），
        // 忽略 compatibilityMode='chat'，避免命中 Chat-to-Image 信道导致 503。
        const channelRuntime = this.resolveChannelRuntime(baseUrl, keySlot, options.modelId);
        if (channelRuntime.strategyId === 'wuyinkeji') {
            console.log(`[OpenAICompatibleAdapter] 使用 Wuyin async image API -> ${keySlot.name}`);
            return this.generateImageWuyinAsync(options, keySlot);
        }
        if (channelRuntime.strategyId === 'acedata') {
            console.log(`[OpenAICompatibleAdapter] 使用 AceData image API -> ${keySlot.name}`);
            return this.generateImageAceData(options, keySlot);
        }
        const prefer12AIAsync = shouldUse12AIAsyncImageRoute(options);
        const modelMetadata = getModelMetadata(options.modelId);
        const imageSurface = resolveImageSurface({
            runtime: channelRuntime,
            modelId: options.modelId,
            compatibilityMode: keySlot.compatibilityMode,
            endpointTypes: modelMetadata?.endpointTypes,
            preferAsync: prefer12AIAsync,
            isAsyncImageModel: is12AIAsyncImageModel,
        });

        if (keySlot.compatibilityMode === 'chat' && shouldBypassChatCompatibilityForImages(channelRuntime)) {
            console.log(`[OpenAICompatibleAdapter] 忽略 compatibilityMode='chat'，优先使用供应商独立图片路由 -> ${keySlot.name}`);
        }

        const dispatchPlan = resolveOpenAICompatibleImageDispatch({
            runtime: channelRuntime,
            imageSurface,
            isGeminiImage,
            endpointTypes: modelMetadata?.endpointTypes,
            legacyGeminiChatGateway: this.isLegacyGeminiChatGateway(baseUrl),
            antigravityUsesChat: modelLower.includes('gemini') && modelLower.includes('image'),
            useChatEndpoint: Boolean(options.providerConfig?.openai?.useChatEndpoint),
        });

        if (dispatchPlan.kind === 'async-image') {
            console.log(`[OpenAICompatibleAdapter] 使用 12AI async image API -> ${keySlot.name}`);
            return this.generateImage12AIAsync(options, keySlot);
        }

        if (dispatchPlan.kind === 'chat-strict' || dispatchPlan.kind === 'chat') {
            console.log(`[OpenAICompatibleAdapter] 使用 Chat API (显式 compatibilityMode='chat') -> ${keySlot.name}`);
            if (dispatchPlan.kind === 'chat-strict') {
                return this.generateImageViaChatStrict(options, keySlot);
            }
            return this.generateImageViaChat(options, keySlot);
        }

        if (dispatchPlan.kind === 'gemini-native') {
            console.log(`[OpenAICompatibleAdapter] 使用原生 Gemini 图片协议 -> ${keySlot.name}`);
            return this.generateImageGeminiNative(options, keySlot);
        }

        if (dispatchPlan.kind === 'antigravity-chat' || dispatchPlan.kind === 'antigravity-extended-with-native-fallback') {
            if (dispatchPlan.kind === 'antigravity-chat') {
                console.log(`[OpenAICompatibleAdapter] 使用 Chat API (Antigravity + Gemini模型) -> ${keySlot.name}`);
                return this.generateImageViaChat(options, keySlot);
            }
            console.log(`[OpenAICompatibleAdapter] 使用 GPT_Best_Extended API (Antigravity) -> ${keySlot.name}`);
            try {
                return await this.generateImageStandard_GPT_Best_Extended(options, keySlot);
            } catch (extendedErr: any) {
                if (!isImageEndpointCompatibilityError(extendedErr)) {
                    throw extendedErr;
                }
                console.warn(`[OpenAICompatibleAdapter] GPT Best extended payload fallback -> native images API (${keySlot.name})`);
                return this.generateImageStandard_GPT_Best_Native(options, keySlot);
            }
        }

        if (dispatchPlan.kind === 'openai-strict') {
            console.log(`[OpenAICompatibleAdapter] 使用 OpenAI_Strict API -> ${keySlot.name}`);
            return this.generateImageStandard_OpenAI_Strict(options, keySlot);
        }

        if (dispatchPlan.kind === 'siliconflow') {
            console.log(`[OpenAICompatibleAdapter] 使用 SiliconFlow API -> ${keySlot.name}`);
            return this.generateImageStandard_SiliconFlow(options, keySlot);
        }

        if (dispatchPlan.kind === 'gpt-best-native') {
            console.log(`[OpenAICompatibleAdapter] 使用 GPT Best 文档安全 Images API -> ${keySlot.name}`);
            return this.generateImageStandard_GPT_Best_Native(options, keySlot);
        }

        if (dispatchPlan.kind === '12ai-openai-strict') {
            console.log(`[OpenAICompatibleAdapter] 使用 OpenAI_Strict API (12AI) -> ${keySlot.name}`);
            return this.generateImageStandard_OpenAI_Strict(options, keySlot);
        }

        if (dispatchPlan.kind === 'suxi-openai-strict') {
            console.log(`[OpenAICompatibleAdapter] suxi 网关默认走 OpenAI Images API -> ${keySlot.name}`);
            return this.generateImageStandard_OpenAI_Strict(options, keySlot);
        }

        if (dispatchPlan.kind === 'gemini-chat-strict-fail-closed') {
            console.log(`[OpenAICompatibleAdapter] Gemini模型优先尝试 Chat API (严格 new-api 兼容层) -> ${keySlot.name}`);
            try {
                return await this.generateImageViaChatStrict(options, keySlot);
            } catch (chatErr: any) {
                if (!isChatEndpointCompatibilityError(chatErr)) {
                    throw chatErr;
                }
                console.warn(`[OpenAICompatibleAdapter] Chat API compatibility fallback disabled for billing safety -> ${keySlot.name}`);
                throw buildOpenAICompatibleImageCompatibilityModeError('chat', chatErr, keySlot.provider);
            }
        }

        if (dispatchPlan.kind === 'provider-chat') {
            return this.generateImageViaChat(options, keySlot);
        }

        if (dispatchPlan.kind === 'comfly-openai-strict') {
            return this.generateImageStandard_OpenAI_Strict(options, keySlot);
        }

        try {
            return await this.generateImageStandard_OpenAI_Strict(options, keySlot);
        } catch (imagesErr: any) {
            if (!isImageEndpointCompatibilityError(imagesErr)) {
                throw imagesErr;
            }
            console.warn(`[OpenAICompatibleAdapter] Images compatibility fallback disabled for billing safety -> ${keySlot.name}`);
            throw buildOpenAICompatibleImageCompatibilityModeError('standard', imagesErr, keySlot.provider);
        }
    }

    private async generateImageViaChat(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        this.assertOpenAICompatibleRuntimeBaseUrl(keySlot, 'chat');
        const baseUrl = (keySlot.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const cleanBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const url = `${cleanBase}/chat/completions`;
        const is4K = options.imageSize?.toUpperCase().includes('4K');
        const is2K = options.imageSize?.toUpperCase().includes('2K');
        const is05K = options.imageSize?.includes('0.5K') || options.imageSize?.includes('512');

        let dim = 1024;
        if (is4K) dim = 4096;
        else if (is2K) dim = 2048;
        else if (is05K) dim = 512;

        const parts = (options.aspectRatio || '1:1').split(':');
        const ratio = parseFloat(parts[0]) / parseFloat(parts[1]);

        let sizeString = `${dim}x${dim}`;
        if (ratio > 1) sizeString = `${dim}x${Math.round(dim / ratio)}`;
        else if (ratio < 1) sizeString = `${Math.round(dim * ratio)}x${dim}`;

        let nativeQuality = 'standard';
        if (is4K) nativeQuality = 'hd';
        else if (is2K) nativeQuality = 'medium';

        const contentParts = buildOpenAICompatibleImageContentParts(options.prompt, options.referenceImages);
        if (options.referenceImages?.length) {
            console.log(`[OpenAICompatibleAdapter] Injected ${options.referenceImages.length} reference images into chat completion`);
        }

        // 🚀 Generate Antigravity Native Params
        const body: any = {
            model: options.modelId,
            messages: [{
                role: 'user',
                content: contentParts
            }],
            // 🚀 [Universal] 全参数传递 — 兼容所有 Gemini 协议代理
            size: sizeString,             // "4096x4096" — 像素尺寸
            quality: nativeQuality,        // "hd" / "medium" / "standard"
            imageSize: is4K ? '4K' : (is2K ? '2K' : '1K'),  // 🚀 Antigravity 最高优先级参数
            aspect_ratio: options.aspectRatio || '1:1',       // 宽高比 (蛇形)
            aspectRatio: options.aspectRatio || '1:1',        // 宽高比 (驼峰 - 增强兼容性)
            max_tokens: 65535,
            maxtokens: 65535,
            maxOutputTokens: 65535,
            stream: false
        };

        // 🚀 [12AI 对齐] 转发高级功能参数
        if (options.providerConfig?.google?.thinkingConfig?.thinkingLevel) {
            body.thinking_mode = options.providerConfig.google.thinkingConfig.thinkingLevel;
        }
        if (options.providerConfig?.google?.tools) {
            const googleSearchTool = options.providerConfig.google.tools.find(t => t.googleSearch);
            if (googleSearchTool) {
                body.google_search = true;
                if (googleSearchTool.googleSearch.searchTypes?.imageSearch) {
                    body.image_search = true;
                }
            }
        }

        const requestPath = '/v1/chat/completions';

        console.log(`[OpenAICompatibleAdapter] Chat Image Request -> ${keySlot.name}: size=${sizeString}, quality=${nativeQuality}, imageSize=${body.imageSize}, aspectRatio=${options.aspectRatio || '1:1'}`);

        // 🚀 [12AI 对齐] 为 Gemini 协议代理设置安全钳位
        if (body.maxOutputTokens > 65535) body.maxOutputTokens = 65535;
        if (body.maxtokens > 65535) body.maxtokens = 65535;

        let headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': this.getAuthorizationHeaderValue(keySlot.key, keySlot)
        };
        if (keySlot.headerName && keySlot.headerName !== 'Authorization') {
            delete headers.Authorization;
            delete headers.authorization;
            headers[keySlot.headerName] = keySlot.key;
        }

        headers = this.applyCustomHeaders(headers, keySlot);

        // 🚀 [12AI 对齐] 负载体积检查
        const requestBody = this.applyCustomBody(body, keySlot);
        const requestBodyPreview = buildSafeRequestBodyPreview(requestBody);
        const pythonSnippet = `import requests\n\nurl = "${url}"\nheaders = {"Authorization": "Bearer <API_KEY>", "Content-Type": "application/json"}\npayload = ${requestBodyPreview}\nresp = requests.post(url, headers=headers, json=payload, timeout=150)\nprint(resp.status_code)\nprint(resp.text[:1000])`;
        const payloadStr = JSON.stringify(requestBody);
        if (payloadStr.length > 48 * 1024 * 1024) {
            console.error(`[OpenAICompatibleAdapter] Chat-Image 请求体积 (${(payloadStr.length / 1024 / 1024).toFixed(2)}MB) 接近 50MB 上限!`);
        }

        const bridgedResult = await this.executeRecoverableSyncImageRequest({
            options,
            parserType: 'openai-chat-best-image',
            url,
            headers,
            body: payloadStr,
            timeoutMs: this.getTimeoutMs(keySlot, 400000),
            requestPath,
            requestBodyPreview,
            provider: keySlot.provider,
        });
        if (bridgedResult) {
            return {
                urls: bridgedResult.urls,
                provider: 'OpenAI-Chat',
                model: options.modelId,
                imageSize: sizeString,
                metadata: {
                    apiDurationMs: bridgedResult.apiDurationMs,
                    requestPath,
                    requestBodyPreview,
                    pythonSnippet
                }
            };
        }

        const response = await this.fetchWithTimeout(url, {
            method: 'POST',
            headers,
            body: payloadStr,
            signal: options.signal
        }, this.getTimeoutMs(keySlot, 400000), 1);

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw buildOpenAICompatibleHttpError({
                message: `Chat-to-Image Error (${response.status}): ${text.substring(0, 200)}`,
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: text.substring(0, 1200),
                provider: keySlot.provider
            });
        }

        const data = await response.json();

        const extractedUrls = extractOpenAICompatibleChatImageUrls(data);
        if (extractedUrls.length > 0) {
            return {
                urls: extractedUrls,
                provider: 'OpenAI-Chat',
                model: options.modelId,
                imageSize: sizeString,
                metadata: {
                    requestPath,
                    requestBodyPreview,
                    pythonSnippet
                }
            };
        }

        // Fallback: If no markdown image found, maybe it's raw base64 or a URL?
        // But 12AI/Gemini Proxies typically return Markdown
        const content = String(data?.choices?.[0]?.message?.content || '');
        throw new Error('Failed to extract image from chat response. Content starts with: ' + content.substring(0, 50));
    }

    // ============================================================================
    // 严格模式 (Official OpenAI) - 不带任何额外多余参数，避免 400 Bad Request
    // ============================================================================
    private async generateImageViaChatStrict(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        this.assertOpenAICompatibleRuntimeBaseUrl(keySlot, 'chat');
        const baseUrl = (keySlot.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const cleanBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const url = `${cleanBase}/chat/completions`;
        const requestPath = '/v1/chat/completions';

        const contentParts = buildOpenAICompatibleImageContentParts(options.prompt, options.referenceImages);

        const aspectRatio = normalizeRequestedAspectRatio(
            options.providerConfig?.google?.imageConfig?.aspectRatio || options.aspectRatio
        );
        const reportedImageSize = options.imageSize || normalizeGeminiImageSize(
            options.providerConfig?.google?.imageConfig?.imageSize || options.imageSize
        );

        const body: any = {
            model: options.modelId,
            messages: [{
                role: 'user',
                content: contentParts
            }],
            stream: false
        };

        body.extra_body = mergeExtraBody(body.extra_body, buildNewApiGoogleExtraBody(options));
        if (options.providerConfig?.google?.tools?.length) {
            body.tools = options.providerConfig.google.tools;
        }

        let headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': this.getAuthorizationHeaderValue(keySlot.key, keySlot)
        };
        if (keySlot.headerName && keySlot.headerName !== 'Authorization') {
            delete headers.Authorization;
            delete headers.authorization;
            headers[keySlot.headerName] = keySlot.key;
        }
        headers = this.applyCustomHeaders(headers, keySlot);

        const requestBody = this.applyCustomBody(body, keySlot);
        const requestBodyPreview = buildSafeRequestBodyPreview(requestBody);
        const pythonSnippet = `import requests\n\nurl = "${url}"\nheaders = {"Authorization": "Bearer <API_KEY>", "Content-Type": "application/json"}\npayload = ${requestBodyPreview}\nresp = requests.post(url, headers=headers, json=payload, timeout=150)\nprint(resp.status_code)\nprint(resp.text[:1000])`;
        const payloadStr = JSON.stringify(requestBody);

        const bridgedResult = await this.executeRecoverableSyncImageRequest({
            options,
            parserType: 'openai-chat-best-image',
            url,
            headers,
            body: payloadStr,
            timeoutMs: this.getTimeoutMs(keySlot, 400000),
            requestPath,
            requestBodyPreview,
            provider: keySlot.provider,
        });
        if (bridgedResult) {
            return {
                urls: bridgedResult.urls,
                provider: 'OpenAI-Chat',
                model: options.modelId,
                imageSize: reportedImageSize,
                metadata: {
                    aspectRatio,
                    apiDurationMs: bridgedResult.apiDurationMs,
                    requestPath,
                    requestBodyPreview,
                    pythonSnippet
                }
            };
        }

        const response = await this.fetchWithTimeout(url, {
            method: 'POST',
            headers,
            body: payloadStr,
            signal: options.signal
        }, this.getTimeoutMs(keySlot, 400000), 1);

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw buildOpenAICompatibleHttpError({
                message: `Chat-to-Image Error (${response.status}): ${text.substring(0, 200)}`,
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: text.substring(0, 1200),
                provider: keySlot.provider
            });
        }

        const data = await response.json();
        const extractedUrls = extractOpenAICompatibleChatImageUrls(data);
        if (extractedUrls.length > 0) {
            return {
                urls: extractedUrls,
                provider: 'OpenAI-Chat',
                model: options.modelId,
                imageSize: reportedImageSize,
                metadata: {
                    aspectRatio,
                    requestPath,
                    requestBodyPreview: buildSafeRequestBodyPreview(requestBody),
                    pythonSnippet
                }
            };
        }

        const content = String(data?.choices?.[0]?.message?.content || '');
        throw new Error('Failed to extract image from strict chat response. Content starts with: ' + String(content).substring(0, 50));
    }

    private async generateImageStandard_OpenAI_Strict_DocSafe(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        this.assertOpenAICompatibleRuntimeBaseUrl(keySlot, 'images');
        const baseUrl = (keySlot.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const cleanBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const profile = getOpenAIImageProfile(options.modelId);

        if (this.shouldUseOpenAIEditsEndpoint(options, baseUrl)) {
            return this.generateImageStandard_OpenAI_Edits(options, keySlot);
        }

        const url = `${cleanBase}/images/generations`;
        const body: any = {
            model: options.modelId,
            prompt: options.prompt,
            n: clampImageCount(options.imageCount, profile === 'dall-e-3' ? 1 : 10),
            size: resolveOpenAIImageSize(options, profile),
            response_format: 'b64_json'
        };

        if (profile === 'dall-e-3') {
            body.quality = options.providerConfig?.openai?.quality
                || (String(options.imageSize || '').toUpperCase().includes('2K')
                    || String(options.imageSize || '').toUpperCase().includes('4K')
                    ? 'hd'
                    : 'standard');

            if (options.providerConfig?.openai?.style) {
                body.style = options.providerConfig.openai.style;
            }
        }

        if (options.referenceImages?.length) {
            const dataUrl = formatOpenAICompatibleReferenceImage(options.referenceImages[0], { preserveHttpUrl: true });
            body.image = dataUrl;

            if (options.modelId.toLowerCase().includes('midjourney') || options.modelId.toLowerCase().includes('mj-')) {
                body.prompt = `${dataUrl} ${body.prompt}`;
            }
        }

        console.log(`[OpenAICompatibleAdapter] OpenAI_Strict -> size=${body.size}${body.quality ? `, quality=${body.quality}` : ''}`);
        return this.executeImageRequest(url, body, keySlot, options);
    }

    private async generateImageStandard_OpenAI_Edits(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        this.assertOpenAICompatibleRuntimeBaseUrl(keySlot, 'images');
        const baseUrl = (keySlot.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const cleanBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const url = `${cleanBase}/images/edits`;
        const sizeString = resolveOpenAIEditSize(options);
        const formData = new FormData();

        formData.append('model', options.modelId);
        formData.append('prompt', options.prompt);
        formData.append('n', String(clampImageCount(options.imageCount, 10)));
        formData.append('size', sizeString);
        formData.append('response_format', 'b64_json');

        if (!options.referenceImages?.length) {
            throw new Error('OpenAI image edits require at least one reference image.');
        }

        await this.appendMultipartImageField(formData, 'image', options.referenceImages[0], 'openai-image');

        if (options.maskUrl) {
            await this.appendMultipartImageField(formData, 'mask', options.maskUrl, 'openai-mask');
        }

        console.log(`[OpenAICompatibleAdapter] OpenAI_Edits -> size=${sizeString}`);
        return this.executeImageFormRequest(url, formData, keySlot, options, sizeString);
    }

    private async generateImageStandard_OpenAI_Strict(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        return this.generateImageStandard_OpenAI_Strict_DocSafe(options, keySlot);
    }

    // ============================================================================
    // 特殊模式 (SiliconFlow) - 需要专用的 image_size 字段
    // ============================================================================
    private async generateImageStandard_SiliconFlow(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        const baseUrl = (keySlot.baseUrl || '').replace(/\/+$/, '');
        const cleanBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const url = `${cleanBase}/images/generations`;

        // 计算物理像素
        let baseDim = 1024;
        const is4K = options.imageSize === '4K' || options.imageSize === 'SIZE_4K';
        const is2K = options.imageSize === '2K' || options.imageSize === 'SIZE_2K';
        if (is4K) baseDim = 4096; else if (is2K) baseDim = 2048;

        const parts = (options.aspectRatio || '1:1').split(':');
        const ratio = parseFloat(parts[0]) / parseFloat(parts[1]);

        let sizeStr = `${baseDim}x${baseDim}`;
        if (ratio > 1) sizeStr = `${baseDim}x${Math.round(baseDim / ratio)}`;
        else if (ratio < 1) sizeStr = `${Math.round(baseDim * ratio)}x${baseDim}`;

        const body: any = {
            model: options.modelId,
            prompt: options.prompt,
            n: options.imageCount || 1,
            image_size: sizeStr, // SiliconFlow 特有字段
            response_format: 'b64_json'
        };

        if (options.referenceImages && options.referenceImages.length > 0) {
            body.image = formatOpenAICompatibleReferenceImages(options.referenceImages, { preserveHttpUrl: true });
        }

        console.log(`[OpenAICompatibleAdapter] SiliconFlow -> image_size=${body.image_size}`);
        return this.executeImageRequest(url, body, keySlot, options);
    }

    // ============================================================================
    // 兼容扩展模式 (GPT-Best / Antigravity / Flux / MJ) 
    // 支持多类别的辅助加强参数，比如 imageSize 4K 等。
    // ============================================================================
    private async generateImageStandard_GPT_Best_Extended(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        const baseUrl = (keySlot.baseUrl || '').replace(/\/+$/, '');
        const cleanBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const url = `${cleanBase}/images/generations`;

        const is4K = options.imageSize === '4K' || options.imageSize === 'SIZE_4K';
        const is2K = options.imageSize === '2K' || options.imageSize === 'SIZE_2K';

        // 🚀 [关键修复] 模型 ID 分辨率后缀自动映射
        // 部分代理商 (如 gpt-best) 将不同分辨率拆成独立的模型 ID：
        //   nano-banana-2 (1K) → nano-banana-2-2k (2K) → nano-banana-2-4k (4K)
        //   gemini-3-pro-image-preview -> gemini-3-pro-image-preview-4k
        //   gemini-3.1-flash-image-preview -> gemini-3.1-flash-image-preview-4k
        // 适应此代理商广泛使用的分辨率命名规则
        const is12AIChannel = this.resolveChannelRuntime(baseUrl, keySlot, options.modelId).strategyId === '12ai';
        const effectiveModelId = is12AIChannel ? options.modelId : normalizeGeminiModelId(options.modelId);

        let baseDim = 1024;
        if (is4K) baseDim = 4096; else if (is2K) baseDim = 2048;

        const parts = (options.aspectRatio || '1:1').split(':');
        const ratio = parseFloat(parts[0]) / parseFloat(parts[1]);

        let sizeStr = `${baseDim}x${baseDim}`;
        if (ratio > 1) sizeStr = `${baseDim}x${Math.round(baseDim / ratio)}`;
        else if (ratio < 1) sizeStr = `${Math.round(baseDim * ratio)}x${baseDim}`;

        let parsedWidth = baseDim;
        let parsedHeight = baseDim;
        const sizeMatch = sizeStr.match(/^(\d+)x(\d+)$/);
        if (sizeMatch) {
            parsedWidth = parseInt(sizeMatch[1], 10);
            parsedHeight = parseInt(sizeMatch[2], 10);
        }

        // 🚀 关键修复: 在提示词中嵌入尺寸提示
        // 部分第三方代理忽略 size/imageSize/aspect_ratio 等参数
        // 嵌入提示词可以让模型本身理解目标分辨率
        const aspectRatioStr = options.aspectRatio || '1:1';

        const body: any = {
            model: effectiveModelId,
            prompt: options.prompt,
            n: options.imageCount || 1,
            size: sizeStr,
            quality: is4K ? 'hd' : (is2K ? 'medium' : 'standard'),
            imageSize: is4K ? '4K' : (is2K ? '2K' : '1K'), // Antigravity 最高级别指令
            aspect_ratio: aspectRatioStr,
            width: parsedWidth,
            height: parsedHeight,
            response_format: 'b64_json'
        };

        // 处理编辑和参考图
        if (options.editMode) {
            body.editMode = options.editMode;
            if (options.editMode === 'inpaint' && options.maskUrl) {
                body.mask = options.maskUrl.startsWith('http') ? options.maskUrl : `data:image/png;base64,${options.maskUrl}`;
            }
        }

        if (options.referenceImages && options.referenceImages.length > 0) {
            const isFluxKontext = options.modelId.toLowerCase().includes('flux-kontext');
            const isDoubao = options.modelId.toLowerCase().includes('doubao');
            const referenceImageUrls = formatOpenAICompatibleReferenceImages(options.referenceImages, { preserveHttpUrl: true });

            if (isFluxKontext) {
                const imgLinks = referenceImageUrls.join(' ');
                body.prompt = `${body.prompt} ${imgLinks}`;
                body.image = referenceImageUrls;
            } else if (isDoubao && options.editMode === 'inpaint') {
                body.image = referenceImageUrls[0];
            } else {
                body.image = referenceImageUrls;
                body.image_url = referenceImageUrls[0];
            }
        }

        console.log(`[OpenAICompatibleAdapter] GPT_Best_Extended -> size=${body.size}, imageSize=${body.imageSize}, quality=${body.quality}`);
        return this.executeImageRequest(url, body, keySlot, options);
    }

    // ============================================================================
    // 🚀 [NEW] gpt-best 代理商专用模式 — 标准 DALL-E 参数 + 提示词内嵌尺寸
    // 该代理只识别标准参数 (model, prompt, n, size, response_format)
    // 额外参数 (imageSize, aspect_ratio, width, height) 会被静默忽略
    // 所以在提示词开头嵌入尺寸和宽高比提示，让模型本身理解目标分辨率
    // ============================================================================
    private async generateImageStandard_GPT_Best_Native(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        this.assertOpenAICompatibleRuntimeBaseUrl(keySlot, 'images');
        const baseUrl = (keySlot.baseUrl || '').replace(/\/+$/, '');
        const cleanBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const url = `${cleanBase}/images/generations`;

        const is4K = options.imageSize === '4K' || options.imageSize === 'SIZE_4K';
        const is2K = options.imageSize === '2K' || options.imageSize === 'SIZE_2K';

        // 🚀 [关键修复] 模型 ID 分辨率后缀自动映射
        const effectiveModelId = normalizeGeminiModelId(options.modelId);

        // 计算基准尺寸
        let baseDim = 1024;
        if (is4K) baseDim = 4096;
        else if (is2K) baseDim = 2048;

        // 根据宽高比计算实际像素尺寸
        const parts = (options.aspectRatio || '1:1').split(':');
        const ratio = parseFloat(parts[0]) / parseFloat(parts[1]);

        let w = baseDim;
        let h = baseDim;
        if (ratio > 1) {
            w = baseDim;
            h = Math.round(baseDim / ratio);
        } else if (ratio < 1) {
            w = Math.round(baseDim * ratio);
            h = baseDim;
        }

        const sizeStr = `${w}x${h}`;
        const aspectRatioStr = options.aspectRatio || '1:1';
        const requestedImageSize = String(options.imageSize || '').trim().toUpperCase();
        const supportsImageSize = /nano-banana-2|gemini-3-pro-image-preview|gemini-3\.1-flash-image-preview/i.test(effectiveModelId);

        const body: any = {
            model: effectiveModelId,
            prompt: options.prompt,
            n: options.imageCount || 1,
            size: sizeStr,
            aspect_ratio: aspectRatioStr,
            response_format: 'url'
        };

        if (supportsImageSize && (requestedImageSize === '2K' || requestedImageSize === '4K')) {
            body.image_size = requestedImageSize;
        }

        if (options.referenceImages && options.referenceImages.length > 0) {
            const refs = formatOpenAICompatibleReferenceImages(options.referenceImages, { preserveHttpUrl: true });
            body.image = refs;
        }

        // Preserve legacy edit hints for existing callers until the edits surface is refactored.
        if (options.editMode) {
            body.editMode = options.editMode;
            if (options.editMode === 'inpaint' && options.maskUrl) {
                body.mask = options.maskUrl.startsWith('http') ? options.maskUrl : `data:image/png;base64,${options.maskUrl}`;
            }
        }

        console.log(`[OpenAICompatibleAdapter] GPT_Best_Native -> size=${body.size}, aspect_ratio=${body.aspect_ratio}, model=${options.modelId}`);
        return this.executeImageRequest(url, body, keySlot, options);
    }

    // ============================================================================
    // 通用 Request 执行包装
    // ============================================================================
    // ============================================================================
    // 🚀 [12AI 对齐] 原生 Gemini 协议 (NanoBanana / generateContent)
    // 严格遵循 https://doc.12ai.org/api/#gemini 文档要求
    // ============================================================================
    private async generateImageGeminiNative(
        options: ImageGenerationOptions,
        keySlot: KeySlot
    ): Promise<ImageGenerationResult> {
        this.assertOpenAICompatibleRuntimeBaseUrl(keySlot, 'images', 'gemini');
        const initialRuntime = this.resolveChannelRuntime(keySlot.baseUrl || '', keySlot, options.modelId, 'gemini');
        const is12AIChannel = initialRuntime.strategyId === '12ai';
        const rawBase = keySlot.baseUrl || (is12AIChannel ? RegionService.get12AIBaseUrl() : '');
        const cleanBase = is12AIChannel
            ? normalize12AIBaseUrl(rawBase).replace(/\/+$/, '')
            : normalizeGeminiBaseUrl(rawBase).replace(/\/+$/, '');
        const runtime = this.resolveChannelRuntime(cleanBase, keySlot, options.modelId, 'gemini');
        const authMethod = runtime.authMethod;

        const effectiveModelId = normalizeGeminiModelId(options.modelId);
        const requestedImageSize = normalizeGeminiImageSize(
            options.providerConfig?.google?.imageConfig?.imageSize || options.imageSize
        );

        const normalizedKey = String(keySlot.key || '').trim();
        if (!normalizedKey) {
            throw new Error('Gemini API Key / Token 不能为空');
        }
        const queryKey = this.getQueryApiKey(normalizedKey);
        if (!queryKey) {
            throw new Error('12AI API Key is empty or invalid');
        }
        const url = is12AIChannel
            ? `${cleanBase}/v1beta/models/${effectiveModelId}:generateContent?key=${encodeURIComponent(queryKey)}`
            : buildGeminiEndpoint(cleanBase, effectiveModelId, 'generateContent', normalizedKey, authMethod, keySlot.provider);

        const parts: any[] = [];

        // 参考图支持
        if (options.referenceImages?.length) {
            for (const refImg of options.referenceImages) {
                const { data: imgData, mimeType } = extractRefImageData(refImg);
                // 确保是纯 base64 (无前缀)
                const base64 = imgData.replace(/^data:[^;]+;base64,/, '');
                parts.push(buildInlineImagePart(base64, mimeType || 'image/png', is12AIChannel));
            }
        }

        // 🚀 [Critical] 12AI 对齐：构造干净的负载，确保字段名与官方文档严格一致
        parts.push({ text: options.prompt });

        const requestedAspectRatio = normalizeRequestedAspectRatio(
            options.providerConfig?.google?.imageConfig?.aspectRatio || options.aspectRatio
        );
        const imageConfig: any = {
            imageSize: requestedImageSize
        };
        if (requestedAspectRatio) {
            imageConfig.aspectRatio = requestedAspectRatio;
        }

        const payload: any = {
            contents: [{ parts }],
            generationConfig: {
                responseModalities: ["IMAGE"],
                imageConfig
            }
        };

        if (options.providerConfig?.google?.thinkingConfig?.thinkingLevel) {
            payload.generationConfig.thinkingConfig = {
                thinkingLevel: options.providerConfig.google.thinkingConfig.thinkingLevel,
                includeThoughts: false
            };
        }

        const groundingTools = buildGeminiNativeGroundingTools(options.providerConfig?.google?.tools, is12AIChannel);
        if (groundingTools?.length) {
            payload.tools = groundingTools;
        }

        const payloadStr = JSON.stringify(payload);
        const requestPath = `/v1beta/models/${is12AIChannel ? options.modelId : effectiveModelId}:generateContent`;
        const requestTimeoutMs = this.getTimeoutMs(keySlot, 400000);
        let headers: Record<string, string> = is12AIChannel
            ? {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            : buildGeminiHeaders(authMethod, normalizedKey, runtime.headerName, runtime.authorizationValueFormat);

        headers = this.applyCustomHeaders(headers, keySlot);
        if (is12AIChannel || authMethod === 'query') {
            delete headers['x-goog-api-key'];
            delete headers['Authorization'];
            delete headers['authorization'];
        }

        const startTime = Date.now();
        const safeUrl = url.replace(/key=[^&]+/, 'key=***'); // 用于日志的安全 URL
        const maskedKey = queryKey.length > 8
            ? `${queryKey.slice(0, 4)}***${queryKey.slice(-4)}`
            : '***';
        console.log(`[OpenAICompatibleAdapter] ${is12AIChannel ? '12AI Native' : 'Gemini Native'} Request -> ${safeUrl} | slot=${keySlot.id} | channel=${keySlot.name} | auth=${is12AIChannel ? 'query' : authMethod} | refs=${options.referenceImages?.length || 0} | key=${maskedKey}`);

        const bridgedResult = await this.executeRecoverableSyncImageRequest({
            options,
            parserType: 'gemini-native-image',
            url,
            headers,
            body: payloadStr,
            timeoutMs: requestTimeoutMs,
            requestPath,
            requestBodyPreview: buildSafeRequestBodyPreview(payload),
            provider: keySlot.provider,
        });
        if (bridgedResult) {
            return {
                urls: bridgedResult.urls,
                provider: is12AIChannel ? '12AI-Native' : 'Gemini-Native',
                model: is12AIChannel ? options.modelId : effectiveModelId,
                imageSize: requestedImageSize,
                metadata: {
                    apiDurationMs: bridgedResult.apiDurationMs,
                    requestPath,
                    requestBodyPreview: buildSafeRequestBodyPreview(payload)
                }
            };
        }

        const response = await this.fetchWithTimeout(url, {
            method: 'POST',
            headers,
            body: payloadStr,
            signal: options.signal
        }, requestTimeoutMs, 1);

        const duration = Date.now() - startTime;

        if (!response.ok) {
            const raw = await response.text().catch(() => '');
            let detail = `${is12AIChannel ? '12AI Native' : 'Gemini Native'} Error: ${response.status}`;
            try {
                const err = JSON.parse(raw || '{}');
                detail = err.error?.message || err.message || detail;
            } catch {
                if (raw) detail = raw.slice(0, 500);
            }
            keyManager.reportCallResult(keySlot.id, false, detail);
            throw new Error(`[${response.status}] ${detail}`);
        }

        const data = await response.json();
        keyManager.reportCallResult(keySlot.id, true);
        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error(is12AIChannel ? '12AI API returned no candidate content' : 'Gemini native API returned no candidate content');

        const candidateParts = candidate.content?.parts || [];
        const imagePart = candidateParts.find((p: any) => p.inlineData || p.inline_data);

        if (!imagePart) {
            const textPart = candidateParts.find((p: any) => p.text);
            if (textPart?.text) throw new Error(`生成失败: ${textPart.text}`);
            throw new Error('响应中未找到图片数据');
        }

        const inlineData = imagePart.inlineData || imagePart.inline_data;
        const mime = inlineData.mimeType || inlineData.mime_type || 'image/png';
        const b64 = String(inlineData.data || '').replace(/\s+/g, '');

        return {
            urls: [`data:${mime};base64,${b64}`],
            provider: is12AIChannel ? '12AI-Native' : 'Gemini-Native',
            model: is12AIChannel ? options.modelId : effectiveModelId,
            imageSize: requestedImageSize,
            metadata: {
                requestPath,
                apiDurationMs: duration,
                requestBodyPreview: buildSafeRequestBodyPreview(payload)
            }
        };
    }

    async checkTaskStatus(taskId: string, mode: GenerationMode, keySlot: KeySlot, modelId?: string): Promise<any> {
        const runtime = this.resolveChannelRuntime(keySlot.baseUrl || '', keySlot);
        const normalizedModelId = String(modelId || '').trim().toLowerCase();
        const isMidjourneyModel = normalizedModelId.includes('midjourney')
            || normalizedModelId.startsWith('mj-')
            || normalizedModelId.startsWith('mj_');

        if (mode === GenerationMode.IMAGE && runtime.strategyId === 'wuyinkeji') {
            const { payload, requestPath } = await this.fetchWuyinTaskDetail(taskId, keySlot);
            const statusCode = extractWuyinStatusCode(payload);
            const status = mapWuyinStatus(statusCode);
            const message = extractProviderMessage(payload);
            const urls = status === 'success' ? extractImageUrlsFromPayload(payload) : [];
            const effectiveStatus = status === 'success' && urls.length === 0 ? 'processing' : status;

            return {
                urls,
                taskId,
                status: effectiveStatus,
                provider: keySlot.provider,
                providerName: keySlot.name,
                keySlotId: keySlot.id,
                metadata: {
                    requestPath,
                    responseMessage: message,
                }
            };
        }

        if (mode === GenerationMode.IMAGE && runtime.strategyId === '12ai' && is12AIAsyncImageModel(modelId)) {
            const { payload, requestPath } = await this.fetch12AIAsyncImageTaskDetail(taskId, keySlot);
            return buildOpenAICompatiblePolledTaskResult({
                payload,
                taskId: extractGenericTaskId(payload) || taskId,
                requestPath,
                keySlot,
            });
        }

        if (mode === GenerationMode.IMAGE && runtime.strategyId === 'acedata') {
            const { payload, requestPath } = await this.fetchAceDataTaskDetail(taskId, keySlot, modelId);
            return buildOpenAICompatiblePolledTaskResult({
                payload,
                taskId: extractGenericTaskId(payload) || taskId,
                requestPath,
                keySlot,
            });
        }

        if (mode === GenerationMode.IMAGE && runtime.strategyId === 'gpt-best' && isMidjourneyModel) {
            const { payload, requestPath } = await this.fetchMidjourneyTaskDetail(taskId, keySlot);
            return buildOpenAICompatiblePolledTaskResult({
                payload,
                taskId: extractGenericTaskId(payload) || taskId,
                requestPath,
                keySlot,
            });
        }

        if (mode === GenerationMode.IMAGE && runtime.strategyId === 'gpt-best') {
            const { payload, requestPath } = await this.fetchGenericImageTaskDetail(taskId, keySlot);
            return buildOpenAICompatiblePolledTaskResult({
                payload,
                taskId: extractGenericTaskId(payload) || taskId,
                requestPath,
                keySlot,
            });
        }

        throw new Error(`Adapter for ${keySlot.provider} does not support task polling for ${mode}`);
    }

    async checkTaskStatuses(taskIds: string[], mode: GenerationMode, keySlot: KeySlot, modelId?: string): Promise<any[]> {
        const normalizedTaskIds = Array.from(new Set(
            (taskIds || []).filter((taskId): taskId is string => typeof taskId === 'string' && taskId.trim().length > 0)
        ));
        if (!normalizedTaskIds.length) {
            return [];
        }

        const runtime = this.resolveChannelRuntime(keySlot.baseUrl || '', keySlot);
        const normalizedModelId = String(modelId || '').trim().toLowerCase();
        const isMidjourneyModel = normalizedModelId.includes('midjourney')
            || normalizedModelId.startsWith('mj-')
            || normalizedModelId.startsWith('mj_');

        if (mode === GenerationMode.IMAGE && runtime.strategyId === 'acedata' && normalizedTaskIds.length > 1) {
            try {
                const { payload, requestPath } = await this.fetchAceDataTaskDetails(normalizedTaskIds, keySlot, modelId);
                const taskItems = extractTaskItemsFromPayload(payload);
                const taskMap = new Map<string, any>();

                taskItems.forEach((item) => {
                    const itemTaskId = extractGenericTaskId(item);
                    if (!itemTaskId) return;
                    taskMap.set(itemTaskId, item);
                });

                return normalizedTaskIds.map((currentTaskId) => buildOpenAICompatiblePolledTaskResult({
                    payload: taskMap.get(currentTaskId) || { taskId: currentTaskId, status: 'pending' },
                    taskId: currentTaskId,
                    requestPath,
                    keySlot,
                }));
            } catch (error) {
                console.warn('[OpenAICompatibleAdapter] AceData batch polling failed, falling back to single fetch:', error);
            }
        }

        if (mode === GenerationMode.IMAGE && runtime.strategyId === 'gpt-best' && isMidjourneyModel && normalizedTaskIds.length > 1) {
            try {
                const { payload, requestPath } = await this.fetchMidjourneyTasksByIds(normalizedTaskIds, keySlot);
                const taskItems = extractTaskItemsFromPayload(payload);
                const taskMap = new Map<string, any>();

                taskItems.forEach((item) => {
                    const itemTaskId = extractGenericTaskId(item);
                    if (!itemTaskId) return;
                    taskMap.set(itemTaskId, item);
                });

                return normalizedTaskIds.map((taskId) => buildOpenAICompatiblePolledTaskResult({
                    payload: taskMap.get(taskId) || { taskId, status: 'pending' },
                    taskId,
                    requestPath,
                    keySlot,
                }));
            } catch (error) {
                console.warn('[OpenAICompatibleAdapter] Midjourney batch polling failed, falling back to single fetch:', error);
            }
        }

        return Promise.all(
            normalizedTaskIds.map((taskId) => this.checkTaskStatus(taskId, mode, keySlot, modelId))
        );
    }

    private async executeImageFormRequest(
        url: string,
        formData: FormData,
        keySlot: KeySlot,
        options: ImageGenerationOptions,
        reportedImageSize: string
    ): Promise<ImageGenerationResult> {
        const target = this.buildOpenAICompatRequestTarget(url, keySlot, {
            includeJsonContentType: false,
            includeAccept: true,
        });
        const requestBody = this.applyCustomFormData(formData, keySlot);
        const requestBodyPreview = buildSafeFormDataPreview(requestBody);

        const response = await this.fetchWithTimeout(target.url, {
            method: 'POST',
            headers: target.headers,
            body: requestBody,
            signal: options.signal
        }, this.getTimeoutMs(keySlot, 400000), 1);

        const requestPath = this.getRequestPathFromUrl(url);

        if (!response.ok) {
            const raw = await response.text().catch(() => '');
            let detail = `OpenAI Image Error: ${response.status}`;
            try {
                const err = JSON.parse(raw || '{}');
                const errorObj = err.error || err;
                detail = errorObj.message || (typeof errorObj === 'string' ? errorObj : JSON.stringify(errorObj));
            } catch {
                if (raw) detail = raw.slice(0, 500);
            }

            keyManager.reportCallResult(keySlot.id, false, detail);
            logError('OpenAIAdapter', new Error(detail), `Path: ${requestPath}\nStatus: ${response.status}\nRaw Response: ${raw.slice(0, 500)}`);
            throw buildOpenAICompatibleHttpError({
                message: `[${response.status}] ${detail}`,
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider
            });
        }

        const data = await response.json();
        keyManager.reportCallResult(keySlot.id, true);
        const urls = extractImageUrlsFromPayload(data);

        if (!urls.length) {
            const rawPreview = JSON.stringify(data || {}).slice(0, 1600);
            throw buildOpenAICompatibleHttpError({
                message: '接口已返回成功状态，但未找到可用图片数据',
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: rawPreview,
                provider: keySlot.provider
            });
        }

        return {
            urls,
            provider: 'OpenAI',
            providerName: keySlot.name,
            model: options.modelId,
            imageSize: reportedImageSize,
            metadata: {
                requestPath,
                requestBodyPreview,
                pythonSnippet: `import requests\n\nurl = "${url}"\nheaders = {"Authorization": "Bearer <API_KEY>"}\nfiles = {"image": open("input.png", "rb")}\ndata = {"model": ${JSON.stringify(options.modelId)}, "prompt": "<omitted:prompt>", "size": "${reportedImageSize}", "response_format": "b64_json"}\nresp = requests.post(url, headers=headers, files=files, data=data, timeout=150)\nprint(resp.status_code)\nprint(resp.text[:1000])`
            }
        };
    }

    private async executeImageRequest(url: string, body: any, keySlot: KeySlot, options: ImageGenerationOptions): Promise<ImageGenerationResult> {
        const target = this.buildOpenAICompatRequestTarget(url, keySlot, {
            includeJsonContentType: true,
            includeAccept: true,
        });
        let headers = target.headers;

        body = this.applyCustomBody(body, keySlot);

        const payloadStr = JSON.stringify(body);
        if (payloadStr.length > 48 * 1024 * 1024) {
            console.error(`[OpenAICompatibleAdapter] Image 请求体积 (${(payloadStr.length / 1024 / 1024).toFixed(2)}MB) 接近 50MB 上限!`);
        }

        const requestPath = this.getRequestPathFromUrl(url);
        const requestBodyPreview = buildSafeRequestBodyPreview(body);
        const bridgedResult = await this.executeRecoverableSyncImageRequest({
            options,
            parserType: 'openai-compatible-image',
            url: target.url,
            headers,
            body: payloadStr,
            timeoutMs: this.getTimeoutMs(keySlot, 400000),
            requestPath,
            requestBodyPreview,
            provider: keySlot.provider,
        });
        if (bridgedResult) {
            return {
                urls: bridgedResult.urls,
                provider: 'OpenAI',
                providerName: keySlot.name,
                model: options.modelId,
                imageSize: body.size || body.image_size || 'Unknown',
                metadata: {
                    apiDurationMs: bridgedResult.apiDurationMs,
                    requestPath,
                    requestBodyPreview,
                    pythonSnippet: `import requests\n\nurl = "${url}"\nheaders = {"Authorization": "Bearer <API_KEY>", "Content-Type": "application/json"}\npayload = ${requestBodyPreview}\nresp = requests.post(url, headers=headers, json=payload, timeout=150)\nprint(resp.status_code)\nprint(resp.text[:1000])`
                }
            };
        }

        const response = await this.fetchWithTimeout(target.url, {
            method: 'POST',
            headers,
            body: payloadStr,
            signal: options.signal
        }, this.getTimeoutMs(keySlot, 400000), 1);

        if (!response.ok) {
            const raw = await response.text().catch(() => '');
            let detail = `OpenAI Image Error: ${response.status}`;
            try {
                const err = JSON.parse(raw || '{}');
                const errorObj = err.error || err;
                detail = errorObj.message || (typeof errorObj === 'string' ? errorObj : JSON.stringify(errorObj));
            } catch {
                if (raw) detail = raw.slice(0, 500);
            }
            keyManager.reportCallResult(keySlot.id, false, detail);
            logError('OpenAIAdapter', new Error(detail), `Path: ${requestPath}\nStatus: ${response.status}\nRaw Response: ${raw.slice(0, 500)}`);
            throw buildOpenAICompatibleHttpError({
                message: `[${response.status}] ${detail}`,
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: raw.slice(0, 1600),
                provider: keySlot.provider
            });
        }

        const data = await response.json();
        keyManager.reportCallResult(keySlot.id, true);
        const firstDataArray = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.images) ? data.images : null);

        // 🚀 [诊断] 打印代理返回的原始数据结构
        if (firstDataArray && firstDataArray.length > 0) {
            const firstItem = firstDataArray[0];
            const responseKeys = Object.keys(firstItem);
            const hasB64 = !!firstItem.b64_json;
            const hasUrl = !!firstItem.url;
            console.log(`[OpenAICompatibleAdapter] 响应数据字段: [${responseKeys.join(', ')}], b64=${hasB64}, url=${hasUrl}${hasUrl ? `, url_preview=${firstItem.url?.substring(0, 80)}...` : ''}`);

        }

        const urls = extractImageUrlsFromPayload(data);
        if (!urls.length) {
            const rawPreview = JSON.stringify(data || {}).slice(0, 1600);
            throw buildOpenAICompatibleHttpError({
                message: '接口已返回成功状态，但未找到可用图片数据',
                status: response.status,
                requestPath,
                requestBody: requestBodyPreview,
                responseBody: rawPreview,
                provider: keySlot.provider
            });
        }

        return {
            urls,
            provider: 'OpenAI',
            providerName: keySlot.name,
            model: options.modelId,
            imageSize: body.size || body.image_size || 'Unknown',
            metadata: {
                requestPath,
                requestBodyPreview,
                pythonSnippet: `import requests\n\nurl = "${url}"\nheaders = {"Authorization": "Bearer <API_KEY>", "Content-Type": "application/json"}\npayload = ${requestBodyPreview}\nresp = requests.post(url, headers=headers, json=payload, timeout=150)\nprint(resp.status_code)\nprint(resp.text[:1000])`
            }
        };
    }
}





