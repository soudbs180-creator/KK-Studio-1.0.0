import type { KeySlot } from '../auth/keyManager.ts';
import { formatAuthorizationHeaderValue } from '../api/apiConfig.ts';
import { isLikelyDocumentationBaseUrl, resolveProviderRuntime, type ProviderStrategyVideoApiStyle } from '../api/providerStrategy.ts';
import type { LLMAdapter, VideoGenerationOptions, VideoGenerationResult } from './LLMAdapter.ts';
import { AsyncTaskPoller, PollCancelledError } from '../http/AsyncTaskPoller';
import { forwardUserRouteGenericRequest } from '../model/secureModelProxy';
import {
    extractWuyinStatusCode,
    extractWuyinTaskId,
    mapWuyinStatus,
    buildWuyinVideoSubmitBody,
    extractWuyinOutputUrls,
    extractWuyinFailureMessage,
    WUYIN_ASYNC_DETAIL_PATH,
    findWuyinCatalogItem,
    normalizeWuyinBaseUrl,
    serializeWuyinSubmitBody,
} from './openAICompatibleWuyinRoute';
import { WUYIN_DEFAULT_BASE_URL } from './wuyinCatalog';

function getWuyinCatalogFromKeySlot(keySlot: any): any[] {
  const snapshot = keySlot.pricingSnapshot;
  if (!snapshot) return [];
  const rows = snapshot.rows || snapshot._rawData;
  return Array.isArray(rows) && rows.length > 0 ? rows : [];
}

export class VideoCompatibleAdapter implements LLMAdapter {
    id = 'video-compatible-adapter';
    provider = 'VideoProxy';

    supports(modelId: string): boolean {
        const lower = modelId.toLowerCase();
        return lower.includes('runway')
            || lower.includes('luma')
            || lower.includes('kling')
            || lower.includes('wan')
            || lower.includes('pika')
            || lower.includes('minimax')
            || lower.includes('vidu')
            || lower.includes('sora')
            || lower.includes('veo')
            || lower.includes('seedance')
            || lower.includes('higgsfield')
            || lower.includes('pixverse')
            || lower.includes('cogvideo')
            || lower.includes('zhipu')
            || lower.includes('qwen-video')
            || lower.includes('hailuo');
    }

    async chat(): Promise<string> {
        throw new Error('Video adapter does not support chat');
    }

    async generateImage(): Promise<any> {
        throw new Error('Video adapter does not support image generation');
    }

    async generateVideo(options: VideoGenerationOptions, keySlot: KeySlot): Promise<VideoGenerationResult> {
        const rawBase = String(keySlot.baseUrl || 'https://api.openai.com').trim().replace(/\/+$/, '');
        if (isLikelyDocumentationBaseUrl(rawBase)) {
            throw new Error(`当前 Base URL 看起来是文档地址 (${rawBase})，不是供应商 API 地址。请改成供应商工作台里显示的真实 Base URL。`);
        }
        const runtime = this.resolveRuntime(rawBase, keySlot, options.modelId);
        if (runtime.videoApiStyle === 'wuyin-async-video') {
            return this.generateVideoViaWuyinAsync(options, keySlot, rawBase);
        }

        const cleanBase = this.normalizeBaseUrl(rawBase, runtime.videoApiStyle);

        if (runtime.videoApiStyle === 'unified-v2-generations') {
            return this.generateVideoViaUnifiedV2(options, keySlot, cleanBase);
        }

        if (runtime.videoApiStyle === 'openai-v1-videos') {
            return this.generateVideoViaNewApi(options, keySlot, cleanBase);
        }

        try {
            return await this.generateVideoViaNewApi(options, keySlot, cleanBase);
        } catch (error: any) {
            if (!this.isNewApiCompatibilityError(error)) {
                throw error;
            }
            return this.generateVideoViaLegacyProxy(options, keySlot, cleanBase);
        }
    }

    private getResolvedProviderName(keySlot: KeySlot): string {
        if (keySlot.provider === 'Custom' && keySlot.name) {
            return keySlot.name;
        }
        return keySlot.provider;
    }

    private resolveRuntime(baseUrl: string, keySlot: KeySlot, modelId?: string) {
        return resolveProviderRuntime({
            provider: this.getResolvedProviderName(keySlot),
            baseUrl,
            format: keySlot.format,
            authMethod: keySlot.authMethod,
            headerName: keySlot.headerName,
            compatibilityMode: keySlot.compatibilityMode,
            modelId,
        });
    }

    private normalizeBaseUrl(baseUrl: string, style: ProviderStrategyVideoApiStyle): string {
        if (style === 'wuyin-async-video') {
            return normalizeWuyinBaseUrl(baseUrl);
        }

        let clean = String(baseUrl || 'https://api.openai.com').trim().replace(/\/+$/, '');
        clean = clean
            .replace(/\/v2\/videos\/generations(?:\/[^/?#]+)?$/i, '')
            .replace(/\/v1\/videos(?:\/[^/?#]+)?$/i, '')
            .replace(/\/v1\/videos\/generations(?:\/[^/?#]+)?$/i, '')
            .replace(/\/videos(?:\/generations)?(?:\/[^/?#]+)?$/i, '')
            .replace(/\/video\/generations(?:\/[^/?#]+)?$/i, '')
            .replace(/\/+$/, '');

        if (style === 'unified-v2-generations') {
            return clean.replace(/\/v2$/i, '').replace(/\/+$/, '');
        }

        const withoutVersion = clean.replace(/\/v1$/i, '').replace(/\/+$/, '');
        return `${withoutVersion}/v1`;
    }

    private isNewApiCompatibilityError(error: any): boolean {
        const message = String(error?.message || '').toLowerCase();
        return message.includes('/videos')
            || message.includes('not found')
            || message.includes('404')
            || message.includes('405')
            || message.includes('415')
            || message.includes('unsupported')
            || message.includes('invalid request');
    }

    private buildHeaders(
        keySlot: KeySlot,
        includeJsonContentType: boolean,
        cleanBase: string,
        modelId?: string,
    ): Record<string, string> {
        const token = String(keySlot.key || '').trim();
        const runtime = this.resolveRuntime(cleanBase, keySlot, modelId);
        const headerName = keySlot.headerName || runtime.headerName || 'Authorization';
        const headers: Record<string, string> = {};

        if (includeJsonContentType) {
            headers['Content-Type'] = 'application/json';
        }

        headers[headerName] = headerName === 'Authorization'
            ? formatAuthorizationHeaderValue(token, runtime.authorizationValueFormat)
            : keySlot.key;

        return headers;
    }

    private getDurationSeconds(options: VideoGenerationOptions): number | undefined {
        if (typeof options.duration === 'number' && Number.isFinite(options.duration) && options.duration > 0) {
            return Math.round(options.duration);
        }

        const legacyDuration = Number.parseInt(String(options.videoDuration || '').trim(), 10);
        if (Number.isFinite(legacyDuration) && legacyDuration > 0) {
            return legacyDuration;
        }

        return undefined;
    }

    private getNormalizedAspectRatio(options: VideoGenerationOptions): '16:9' | '9:16' | '1:1' | undefined {
        const raw = String(options.aspectRatio || '').trim();
        if (!raw || raw.toLowerCase() === 'auto') {
            return undefined;
        }

        if (raw === '16:9' || raw === '9:16' || raw === '1:1') {
            return raw;
        }

        return undefined;
    }

    private getVideoSizeString(options: VideoGenerationOptions): string | undefined {
        const explicitSize = String(options.size || '').trim();
        if (/^\d+x\d+$/i.test(explicitSize)) {
            return explicitSize;
        }

        const resolution = String(options.resolution || '').trim().toLowerCase();
        const aspectRatio = this.getNormalizedAspectRatio(options) || '16:9';

        const sizeMap: Record<string, Record<'16:9' | '9:16' | '1:1', string>> = {
            '480p': {
                '16:9': '854x480',
                '9:16': '480x854',
                '1:1': '480x480',
            },
            '720p': {
                '16:9': '1280x720',
                '9:16': '720x1280',
                '1:1': '720x720',
            },
            '1080p': {
                '16:9': '1920x1080',
                '9:16': '1080x1920',
                '1:1': '1080x1080',
            },
            '4k': {
                '16:9': '3840x2160',
                '9:16': '2160x3840',
                '1:1': '2160x2160',
            },
        };

        return sizeMap[resolution]?.[aspectRatio];
    }

    private extractTaskId(payload: any): string | undefined {
        return payload?.task_id
            || payload?.id
            || payload?.data?.task_id
            || payload?.data?.id;
    }

    private extractStatus(payload: any): string {
        return String(
            payload?.status
            || payload?.data?.status
            || payload?.state
            || payload?.data?.state
            || '',
        );
    }

    private extractVideoUrl(payload: any): string {
        const candidates = [
            payload?.video_url,
            payload?.url,
            payload?.output,
            payload?.video?.url,
            payload?.data?.video_url,
            payload?.data?.url,
            payload?.data?.output,
            payload?.data?.video?.url,
            payload?.outputs?.[0],
            payload?.outputs?.[0]?.url,
            payload?.data?.outputs?.[0],
            payload?.data?.outputs?.[0]?.url,
        ];

        const match = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
        return typeof match === 'string' ? match.trim() : '';
    }

    private isSuccessStatus(status: string): boolean {
        const normalized = status.trim().toUpperCase();
        return normalized === 'SUCCESS'
            || normalized === 'SUCCEEDED'
            || normalized === 'COMPLETED'
            || normalized === 'DONE'
            || normalized === 'FINISHED';
    }

    private isFailureStatus(status: string): boolean {
        const normalized = status.trim().toUpperCase();
        return normalized === 'FAILURE'
            || normalized === 'FAILED'
            || normalized === 'ERROR'
            || normalized === 'CANCELLED'
            || normalized === 'REJECTED';
    }

    private buildResult(
        options: VideoGenerationOptions,
        keySlot: KeySlot,
        params: { url: string; taskId?: string; status: 'processing' | 'success' | 'failed' },
    ): VideoGenerationResult {
        return {
            url: params.url,
            taskId: params.taskId,
            status: params.status,
            provider: this.provider,
            providerName: keySlot.name || this.provider,
            model: options.modelId,
            keySlotId: keySlot.id,
        };
    }

    private async delay(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private buildUnifiedV2Body(options: VideoGenerationOptions): Record<string, any> {
        const body: Record<string, any> = {
            model: options.modelId,
            prompt: options.prompt,
        };

        if (options.aspectRatio && String(options.aspectRatio).toLowerCase() !== 'auto') {
            body.aspect_ratio = options.aspectRatio;
        }
        if (options.resolution) {
            body.resolution = options.resolution;
        }
        if (options.size) {
            body.size = options.size;
        }

        const duration = this.getDurationSeconds(options);
        if (duration) {
            body.duration = duration;
        }

        const images = [options.imageUrl, options.imageTailUrl].filter((value): value is string => Boolean(value));
        if (images.length > 0) {
            body.images = images;
        }

        if (options.videoUrl) {
            body.videos = [options.videoUrl];
        }
        if (options.watermark !== undefined) {
            body.watermark = options.watermark;
        }

        return body;
    }

    private async appendInputReference(formData: FormData, imageSource: string): Promise<void> {
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
            console.warn('[VideoCompatibleAdapter] Falling back to raw image URL for input_reference.');
        }

        formData.append('image', imageSource);
    }

    private async generateVideoViaWuyinAsync(
        options: VideoGenerationOptions,
        keySlot: KeySlot,
        rawBase: string,
    ): Promise<VideoGenerationResult> {
        // 简体中文：通过 wuyinAsyncVideoRoute 中的 buildWuyinVideoSubmitUrl 逻辑，速创接口应该被单独隔离处理。
        const item = findWuyinCatalogItem(options.modelId, getWuyinCatalogFromKeySlot(keySlot));
        if (!item) throw new Error(`速创模型不存在：${options.modelId}`);
        if (item.kind !== 'video') throw new Error(`当前模型不是视频模型：${item.name}`);

        const submitUrl = `${WUYIN_DEFAULT_BASE_URL}${item.endpointPath}`;
        const body = buildWuyinVideoSubmitBody({
            ...options,
            modelId: item.id,
            endpointPath: item.endpointPath,
        });
        const submitContentType = item.contentType || item.submitContentType || 'application/json';

        const response = await forwardUserRouteGenericRequest({
            url: submitUrl,
            method: item.method,
            keyId: keySlot.id,
            body: serializeWuyinSubmitBody(body, submitContentType),
            headers: {
                'Content-Type': submitContentType,
                Accept: 'application/json',
            },
            signal: options.signal,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Wuyin video API error ${response.status}: ${errText.slice(0, 300)}`);
        }

        const payload = await response.json().catch(() => ({}));
        const logicalCode = Number(payload?.code);
        if (Number.isFinite(logicalCode) && logicalCode !== 200 && logicalCode !== 0) {
            throw new Error(`Wuyin video API error ${logicalCode}: ${extractWuyinFailureMessage(payload)}`);
        }

        const taskId = extractWuyinTaskId(payload);
        const immediateUrls = extractWuyinOutputUrls(payload);
        const status = mapWuyinStatus(extractWuyinStatusCode(payload));

        if (taskId) {
            options.onTaskId?.(taskId);
        }

        if (immediateUrls.length > 0 && status === 'success') {
            return this.buildResult(options, keySlot, { url: immediateUrls[0], taskId, status: 'success' });
        }

        if (!taskId) {
            if (immediateUrls.length > 0) {
                return this.buildResult(options, keySlot, { url: immediateUrls[0], status: 'success' });
            }
            throw new Error('Wuyin video API returned success without a task id or output URL.');
        }

        return this.pollWuyinVideoTask(taskId, item.detailPath || WUYIN_ASYNC_DETAIL_PATH, options, keySlot);
    }

    private async pollWuyinVideoTask(
        taskId: string,
        detailPath: string,
        options: VideoGenerationOptions,
        keySlot: KeySlot,
    ): Promise<VideoGenerationResult> {
        const maxDurationMs = 30 * 60 * 1000;
        const startTime = Date.now();
        let pollInterval = 3000;
        const maxInterval = 15000;

        const pollUrl = `${WUYIN_DEFAULT_BASE_URL}${detailPath}?id=${encodeURIComponent(String(taskId).trim())}`;

        while (Date.now() - startTime < maxDurationMs) {
            if (options.signal?.aborted) {
                throw new Error('Video generation was aborted.');
            }

            await this.delay(pollInterval);
            pollInterval = Math.min(Math.round(pollInterval * 1.5), maxInterval);

            const response = await forwardUserRouteGenericRequest({
                url: pollUrl,
                method: 'GET',
                keyId: keySlot.id,
                headers: {
                    Accept: 'application/json',
                },
                signal: options.signal,
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                if (response.status >= 500 || response.status === 404) {
                    continue;
                }
                throw new Error(`Wuyin video poll error ${response.status}: ${errText.slice(0, 200)}`);
            }

            const payload = await response.json().catch(() => ({}));
            const logicalCode = Number(payload?.code);
            if (Number.isFinite(logicalCode) && logicalCode !== 200 && logicalCode !== 0) {
                throw new Error(`Wuyin video API error ${logicalCode}: ${extractWuyinFailureMessage(payload)}`);
            }

            const status = mapWuyinStatus(extractWuyinStatusCode(payload));
            if (status === 'success') {
                const videoUrls = extractWuyinOutputUrls(payload);
                if (videoUrls.length > 0) {
                    return this.buildResult(options, keySlot, { url: videoUrls[0], taskId, status: 'success' });
                }
                throw new Error('Wuyin video task completed without a usable output URL.');
            }

            if (status === 'failed') {
                const reason = extractWuyinFailureMessage(payload);
                throw new Error(`Wuyin video generation failed: ${reason}`);
            }
        }

        throw new Error('Wuyin video generation timed out after 30 minutes.');
    }

    private async fetchContentUrlViaProxy(
        cleanBase: string,
        taskId: string,
        keySlotId: string,
        signal?: AbortSignal,
    ): Promise<string> {
        const contentUrls = [
            `${cleanBase}/videos/${encodeURIComponent(taskId)}/content`,
            `${cleanBase}/video/generations/${encodeURIComponent(taskId)}/content`,
        ];

        for (const contentUrl of contentUrls) {
            try {
                // 改为调用 forwardUserRouteGenericRequest 代理中转
                const response = await forwardUserRouteGenericRequest(
                    contentUrl,
                    'GET',
                    keySlotId,
                    undefined,
                    undefined,
                    signal,
                );
                if (!response.ok) {
                    continue;
                }

                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const payload = await response.json().catch(() => ({}));
                    const videoUrl = this.extractVideoUrl(payload);
                    if (videoUrl) {
                        return videoUrl;
                    }
                    continue;
                }

                const blob = await response.blob();
                if (!blob.size || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
                    continue;
                }

                return URL.createObjectURL(blob);
            } catch (error) {
                console.warn(`[VideoCompatibleAdapter] Failed to fetch content URL via proxy: ${contentUrl}`, error);
            }
        }

        return '';
    }

    private async generateVideoViaNewApi(
        options: VideoGenerationOptions,
        keySlot: KeySlot,
        cleanBase: string,
    ): Promise<VideoGenerationResult> {
        const submitUrl = `${cleanBase}/videos`;

        const formData = new FormData();
        formData.append('model', options.modelId);
        formData.append('prompt', options.prompt);

        const seconds = this.getDurationSeconds(options);
        if (seconds) {
            formData.append('seconds', String(seconds));
        }

        const size = this.getVideoSizeString(options);
        if (size) {
            formData.append('size', size);
        }

        if (options.imageUrl) {
            await this.appendInputReference(formData, options.imageUrl);
        }

        // 改为使用 forwardUserRouteGenericRequest 提交任务到代理
        const response = await forwardUserRouteGenericRequest(
            submitUrl,
            'POST',
            keySlot.id,
            formData,
            undefined,
            options.signal,
        );

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Video API error ${response.status}: ${errText.slice(0, 300)}`);
        }

        const payload = await response.json().catch(() => ({}));
        const taskId = this.extractTaskId(payload);
        const directUrl = this.extractVideoUrl(payload);
        const status = this.extractStatus(payload);

        if (taskId) {
            options.onTaskId?.(taskId);
        }

        if (directUrl && (!status || this.isSuccessStatus(status))) {
            return this.buildResult(options, keySlot, { url: directUrl, taskId, status: 'success' });
        }

        if (!taskId) {
            throw new Error('Video API returned success without a task id or output URL.');
        }

        // 轮询 URL 列表 (有序)
        const pollUrls = [
            `${cleanBase}/videos/${encodeURIComponent(taskId)}`,
            `${cleanBase}/video/generations/${encodeURIComponent(taskId)}`,
        ];

        let lastError: Error | null = null;
        for (const pollUrl of pollUrls) {
            try {
                // 在外部按需捕获并重新实例化 Poller 执行轮询
                return await this.runPollerWithUrl(taskId, pollUrl, options, keySlot, cleanBase);
            } catch (error: any) {
                if (error instanceof PollCancelledError || options.signal?.aborted) {
                    throw error;
                }
                lastError = error;
                console.warn(`[VideoCompatibleAdapter] Poll failed for URL ${pollUrl}, attempting fallback. Error:`, error);
            }
        }

        throw lastError || new Error('Video generation polling failed on all configured URLs.');
    }

    private async runPollerWithUrl(
        taskId: string,
        pollUrl: string,
        options: VideoGenerationOptions,
        keySlot: KeySlot,
        cleanBase: string,
    ): Promise<VideoGenerationResult> {
        // 轮询查询函数，只负责处理单个 URL 的网络请求，通过 forwardUserRouteGenericRequest 代理
        const pollFn = async (id: string, signal?: AbortSignal) => {
            const response = await forwardUserRouteGenericRequest(
                pollUrl,
                'GET',
                keySlot.id,
                undefined,
                undefined,
                signal,
            );

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`Video poll error ${response.status}: ${errText.slice(0, 200)}`);
            }

            return await response.json().catch(() => ({}));
        };

        // 实例化通用的轮询管理器 AsyncTaskPoller
        const poller = new AsyncTaskPoller<any, any>({
            submitFn: async () => ({ taskId }), // 模拟已提交的任务
            pollFn: (id, signal) => pollFn(id, signal),
            extractId: (submit) => submit.taskId,
            isDone: (result) => {
                const status = this.extractStatus(result);
                const directUrl = this.extractVideoUrl(result);
                return (directUrl && this.isSuccessStatus(status || 'SUCCESS')) || this.isSuccessStatus(status);
            },
            isFailed: (result) => {
                const status = this.extractStatus(result);
                return this.isFailureStatus(status);
            },
            // 使用自定义的指数退避轮询间隔，最大 15 秒
            interval: (pollCount) => {
                let interval = 3000;
                for (let i = 0; i < pollCount; i++) {
                    interval = Math.min(Math.round(interval * 1.5), 15000);
                }
                return interval;
            },
            // 最大等待时间限制 (30分钟)
            maxWait: 30 * 60 * 1000,
        });

        // 联动外部取消信号
        let onAbort: (() => void) | undefined;
        if (options.signal) {
            if (options.signal.aborted) {
                poller.cancel();
                throw new PollCancelledError();
            }
            onAbort = () => {
                poller.cancel();
            };
            options.signal.addEventListener('abort', onAbort);
        }

        try {
            const pollResult = await poller.start();
            const status = this.extractStatus(pollResult);
            const directUrl = this.extractVideoUrl(pollResult);

            if (directUrl && this.isSuccessStatus(status || 'SUCCESS')) {
                return this.buildResult(options, keySlot, { url: directUrl, taskId, status: 'success' });
            }

            if (this.isSuccessStatus(status)) {
                // 若状态为成功但无直接链接，从内容接口代理获取
                const contentUrl = await this.fetchContentUrlViaProxy(cleanBase, taskId, keySlot.id, options.signal);
                if (contentUrl) {
                    return this.buildResult(options, keySlot, { url: contentUrl, taskId, status: 'success' });
                }
                throw new Error('Video task completed without a usable output URL.');
            }

            throw new Error('Video task failed with unknown status.');
        } finally {
            // 清理取消监听
            if (options.signal && onAbort) {
                options.signal.removeEventListener('abort', onAbort);
            }
        }
    }

    private async generateVideoViaUnifiedV2(
        options: VideoGenerationOptions,
        keySlot: KeySlot,
        cleanBase: string,
    ): Promise<VideoGenerationResult> {
        const submitUrl = `${cleanBase}/v2/videos/generations`;
        const headers = this.buildHeaders(keySlot, true, cleanBase, options.modelId);
        const body = this.buildUnifiedV2Body(options);

        const response = await fetch(submitUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: options.signal,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Video API error ${response.status}: ${errText.slice(0, 300)}`);
        }

        const payload = await response.json().catch(() => ({}));
        const taskId = this.extractTaskId(payload);
        const directUrl = this.extractVideoUrl(payload);
        const status = this.extractStatus(payload);

        if (taskId) {
            options.onTaskId?.(taskId);
        }

        if (directUrl && (!status || this.isSuccessStatus(status))) {
            return this.buildResult(options, keySlot, { url: directUrl, taskId, status: 'success' });
        }

        if (!taskId) {
            return this.buildResult(options, keySlot, {
                url: directUrl || '',
                status: directUrl ? 'success' : 'processing',
            });
        }

        return this.pollUnifiedV2Task(taskId, options, keySlot, cleanBase);
    }

    private async pollUnifiedV2Task(
        taskId: string,
        options: VideoGenerationOptions,
        keySlot: KeySlot,
        cleanBase: string,
    ): Promise<VideoGenerationResult> {
        const pollUrl = `${cleanBase}/v2/videos/generations/${encodeURIComponent(taskId)}`;
        const headers = this.buildHeaders(keySlot, false, cleanBase, options.modelId);
        const maxDurationMs = 30 * 60 * 1000;
        const startTime = Date.now();
        let pollInterval = 3000;
        const maxInterval = 15000;

        while (Date.now() - startTime < maxDurationMs) {
            if (options.signal?.aborted) {
                throw new Error('Video generation was aborted.');
            }

            await this.delay(pollInterval);
            pollInterval = Math.min(Math.round(pollInterval * 1.5), maxInterval);

            const response = await fetch(pollUrl, {
                headers,
                signal: options.signal,
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                if (response.status >= 500 || response.status === 404) {
                    continue;
                }
                throw new Error(`Video poll error ${response.status}: ${errText.slice(0, 200)}`);
            }

            const payload = await response.json().catch(() => ({}));
            const status = this.extractStatus(payload);
            const directUrl = this.extractVideoUrl(payload);

            if (directUrl && this.isSuccessStatus(status || 'SUCCESS')) {
                return this.buildResult(options, keySlot, { url: directUrl, taskId, status: 'success' });
            }

            if (this.isSuccessStatus(status)) {
                throw new Error('Video task completed without a usable output URL.');
            }

            if (this.isFailureStatus(status)) {
                const reason = payload?.error || payload?.message || payload?.data?.error || JSON.stringify(payload);
                throw new Error(`Video generation failed: ${reason}`);
            }
        }

        throw new Error('Video generation timed out after 30 minutes.');
    }

    private async generateVideoViaLegacyProxy(
        options: VideoGenerationOptions,
        keySlot: KeySlot,
        cleanBase: string,
    ): Promise<VideoGenerationResult> {
        const submitUrl = `${cleanBase}/videos/generations`;
        const headers = this.buildHeaders(keySlot, true, cleanBase, options.modelId);
        const body = this.buildUnifiedV2Body(options);

        const response = await fetch(submitUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: options.signal,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Video API error ${response.status}: ${errText.slice(0, 300)}`);
        }

        const payload = await response.json().catch(() => ({}));
        const taskId = this.extractTaskId(payload);
        const directUrl = this.extractVideoUrl(payload);
        const status = this.extractStatus(payload);

        if (taskId) {
            options.onTaskId?.(taskId);
        }

        if (directUrl && (!status || this.isSuccessStatus(status))) {
            return this.buildResult(options, keySlot, { url: directUrl, taskId, status: 'success' });
        }

        if (!taskId) {
            return this.buildResult(options, keySlot, {
                url: directUrl || '',
                status: directUrl ? 'success' : 'processing',
            });
        }

        const pollHeaders = this.buildHeaders(keySlot, false, cleanBase, options.modelId);
        const pollUrl = `${submitUrl}/${encodeURIComponent(taskId)}`;
        const maxDurationMs = 30 * 60 * 1000;
        const startTime = Date.now();
        let pollInterval = 3000;
        const maxInterval = 15000;

        while (Date.now() - startTime < maxDurationMs) {
            if (options.signal?.aborted) {
                throw new Error('Video generation was aborted.');
            }

            await this.delay(pollInterval);
            pollInterval = Math.min(Math.round(pollInterval * 1.5), maxInterval);

            const pollResponse = await fetch(pollUrl, {
                headers: pollHeaders,
                signal: options.signal,
            });

            if (!pollResponse.ok) {
                if (pollResponse.status >= 500) {
                    continue;
                }
                const errText = await pollResponse.text().catch(() => '');
                throw new Error(`Video poll error ${pollResponse.status}: ${errText.slice(0, 200)}`);
            }

            const pollPayload = await pollResponse.json().catch(() => ({}));
            const pollStatus = this.extractStatus(pollPayload);
            const pollVideoUrl = this.extractVideoUrl(pollPayload);

            if (pollVideoUrl && this.isSuccessStatus(pollStatus || 'SUCCESS')) {
                return this.buildResult(options, keySlot, { url: pollVideoUrl, taskId, status: 'success' });
            }

            if (this.isFailureStatus(pollStatus)) {
                const reason = pollPayload?.error || pollPayload?.message || pollPayload?.data?.error || JSON.stringify(pollPayload);
                throw new Error(`Video generation failed: ${reason}`);
            }
        }

        throw new Error('Video generation timed out after 30 minutes.');
    }
}
