import type { KeySlot } from '../auth/keyManager.ts';
import type { LLMAdapter, AudioGenerationOptions, AudioGenerationResult } from './LLMAdapter.ts';
import { 
    getMaxAudioDuration,
    supportsCustomLyrics,
    supportsInstrumental,
    supportsAudioContinuation 
} from '../model/audioModelCapabilities.ts';
import { assertNoDirectCall } from '../../utils/security';
import { forwardUserRouteGenericRequest } from '../model/secureModelProxy';
import { AsyncTaskPoller, PollCancelledError } from '../http/AsyncTaskPoller';
import { resolveProviderRuntime } from '../api/providerStrategy';
import {
    extractWuyinStatusCode,
    extractWuyinTaskId,
    mapWuyinStatus,
    buildWuyinAudioSubmitBody,
    extractWuyinOutputUrls,
    extractWuyinFailureMessage,
    WUYIN_ASYNC_DETAIL_PATH,
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

/**
 * 音频生成适配器
 * 严格使用 OpenAI 兼容格式 (/v1/audio/generations)
 * 
 * 支持：Suno 全场景 (文生歌/翻版/续写)、MiniMax 语音合成、通用 TTS
 * v2 统一格式状态码：NOT_START / SUBMITTED / QUEUED / IN_PROGRESS / SUCCESS / FAILURE
 */
export class AudioCompatibleAdapter implements LLMAdapter {
    id = 'audio-compatible-adapter';
    provider = 'AudioProxy';

    supports(modelId: string): boolean {
        const lower = modelId.toLowerCase();
        return lower.includes('suno') ||
            lower.includes('minimax') ||
            lower.includes('audio') ||
            lower.includes('tts') ||
            lower.includes('udio') ||
            lower.includes('riffusion');
    }

    async chat(): Promise<string> {
        throw new Error('音频适配器不支持聊天');
    }

    async generateImage(): Promise<any> {
        throw new Error('音频适配器不支持图像生成');
    }

    async generateAudio(options: AudioGenerationOptions, keySlot: KeySlot): Promise<AudioGenerationResult> {
        const runtime = resolveProviderRuntime({
            provider: keySlot.provider === 'Custom' && keySlot.name ? keySlot.name : keySlot.provider,
            baseUrl: keySlot.baseUrl || '',
            format: keySlot.format,
            authMethod: keySlot.authMethod,
            headerName: keySlot.headerName,
            compatibilityMode: keySlot.compatibilityMode,
            modelId: options.modelId,
        });

        if (runtime.strategyId === 'wuyinkeji') {
            return this.generateAudioWuyin(options, keySlot);
        }

        const baseUrl = (keySlot.baseUrl || 'https://api.openai.com').replace(/\/+$/, '');
        const cleanBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
        const submitUrl = `${cleanBase}/audio/generations`;
        const pollBaseUrl = submitUrl;

        // 安全守卫：禁止直连外部
        assertNoDirectCall(submitUrl);

        // 获取模型音频能力
        const maxDuration = getMaxAudioDuration(options.modelId);
        
        // 构建请求体
        const body: any = {
            model: options.modelId,
            prompt: options.prompt,
        };

        // 🚀 Duration 参数处理 - 确保在模型支持的范围内
        if (options.audioDuration) {
            // 解析 duration（可能是字符串 "120s" 或数字）
            let durationValue: number;
            if (typeof options.audioDuration === 'string') {
                const match = options.audioDuration.match(/^(\d+)/);
                durationValue = match ? parseInt(match[1], 10) : 120;
            } else {
                durationValue = options.audioDuration;
            }
            
            // 限制在最大值内
            durationValue = Math.min(durationValue, maxDuration);
            body.duration = durationValue;
        }

        // 🎵 Lyrics 参数 - 检查模型是否支持自定义歌词
        if (options.audioLyrics && supportsCustomLyrics(options.modelId)) {
            body.lyrics = options.audioLyrics;
            body.custom_lyrics = options.audioLyrics; // 部分平台用此字段
            body.prompt_lyrics = options.audioLyrics; // 备用字段
        }

        // 🎨 Style/Tags 参数
        if (options.audioStyle) {
            body.style = options.audioStyle;
            body.tags = options.audioStyle; // Suno 用 tags 描述风格
            body.genre = options.audioStyle; // 备用字段
        }

        // 📝 Title 参数
        if (options.audioTitle) {
            body.title = options.audioTitle;
        }

        // 🎸 Instrumental 模式（纯音乐）
        if (options.providerConfig?.audio?.instrumental && supportsInstrumental(options.modelId)) {
            body.instrumental = true;
            body.make_instrumental = true; // 备用字段
        }

        // 🎤 Suno 灵感模式 vs 自定义模式
        if (options.audioMode) {
            body.mode = options.audioMode; // 'inspiration' | 'custom'
        }

        // ⏩ 续写/Extend 参数
        if (options.audioExtendFrom && supportsAudioContinuation(options.modelId)) {
            body.extend_from = options.audioExtendFrom;
            body.continue_from = options.audioExtendFrom; // 备用字段
            body.task_id = options.audioExtendFrom;
        }

        // 🔊 MiniMax TTS 参数
        if (options.voiceId) {
            body.voice_id = options.voiceId;
            body.voice = options.voiceId; // 备用字段
        }
        if (options.speed !== undefined && options.speed !== null) {
            body.speed = options.speed;
            body.speed_ratio = options.speed; // 备用字段
        }

        // 🌐 Language 参数（部分模型支持）
        if (options.providerConfig?.audio?.language) {
            body.language = options.providerConfig.audio.language;
        }

        // 🎚️ Quality 参数（部分模型支持）
        if (options.providerConfig?.audio?.quality) {
            body.quality = options.providerConfig.audio.quality;
        }

        // 📝 Callback URL（用于异步通知）
        if (options.providerConfig?.audio?.callbackUrl) {
            body.callback_url = options.providerConfig.audio.callbackUrl;
        }

        // 🔗 Reference Audio（风格参考）
        if (options.providerConfig?.audio?.referenceAudioUrl) {
            body.reference_audio = options.providerConfig.audio.referenceAudioUrl;
        }

        try {
            console.log(`[AudioAdapter] 提交音频生成: ${submitUrl}, 模型: ${options.modelId}`);
            
            // 步骤 B & A: 改为使用 forwardUserRouteGenericRequest 代理中转提交任务
            const response = await forwardUserRouteGenericRequest(
                submitUrl,
                'POST',
                keySlot.id,
                JSON.stringify(body),
                { 'Content-Type': 'application/json' },
                options.signal,
            );

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`音频 API 错误 ${response.status}: ${errText.slice(0, 300)}`);
            }

            let data = await response.json();

            let taskId = data.task_id || data.id || data.data?.task_id;
            let audioUrl = data.audio_url || data.audio?.url || data.data?.audio_url ||
                data.data?.output || '';
            let status = data.status || data.data?.status || 'pending';
            let metadata: any = {};

            // 封面图
            if (data.image_url || data.data?.image_url) {
                metadata.coverUrl = data.image_url || data.data?.image_url;
            }

            // 同步返回
            if (this.isSuccessStatus(status) && audioUrl) {
                return {
                    url: audioUrl, taskId, status: 'success',
                    provider: this.provider,
                    providerName: keySlot.name || this.provider,
                    model: options.modelId, metadata
                };
            }

            // 异步轮询 - AsyncTaskPoller 替换
            if (taskId) {
                const pollUrl = `${pollBaseUrl}/${taskId}`;

                const poller = new AsyncTaskPoller<any, any>({
                    submitFn: async () => ({ taskId }),
                    pollFn: async (id, signal) => {
                        const pollResponse = await forwardUserRouteGenericRequest(
                            pollUrl,
                            'GET',
                            keySlot.id,
                            undefined,
                            undefined,
                            signal,
                        );
                        if (!pollResponse.ok) {
                            throw new Error(`音频轮询请求错误: ${pollResponse.status}`);
                        }
                        return await pollResponse.json().catch(() => ({}));
                    },
                    extractId: (submit) => submit.taskId,
                    isDone: (result) => {
                        const s = result.status || result.data?.status || status;
                        return this.isSuccessStatus(s);
                    },
                    isFailed: (result) => {
                        const s = result.status || result.data?.status || status;
                        return this.isFailureStatus(s);
                    },
                    interval: (count) => Math.min(2000 * Math.pow(1.5, count - 1), 10000),
                    maxWait: 10 * 60 * 1000, // 10 分钟
                });

                // 联动取消信号
                let onAbort: (() => void) | undefined;
                if (options.signal) {
                    if (options.signal.aborted) {
                        poller.cancel();
                        throw new PollCancelledError();
                    }
                    onAbort = () => poller.cancel();
                    options.signal.addEventListener('abort', onAbort);
                }

                try {
                    const pollResult = await poller.start();
                    status = pollResult.status || pollResult.data?.status || status;
                    
                    audioUrl = pollResult.audio_url || pollResult.data?.audio_url ||
                        pollResult.data?.output ||
                        pollResult.audio?.url ||
                        (pollResult.data?.outputs && pollResult.data.outputs[0]) ||
                        audioUrl;

                    if (pollResult.image_url || pollResult.data?.image_url) {
                        metadata.coverUrl = pollResult.image_url || pollResult.data?.image_url;
                    }
                    if (pollResult.data?.title) metadata.title = pollResult.data.title;
                    if (pollResult.data?.lyrics) metadata.lyrics = pollResult.data.lyrics;
                    if (pollResult.data?.duration) metadata.duration = pollResult.data.duration;

                    if (!this.isSuccessStatus(status)) {
                        throw new Error(`音频生成未完成。状态: ${status}`);
                    }
                    if (!audioUrl) {
                        throw new Error('任务完成但未返回音频 URL');
                    }
                } catch (pollErr: any) {
                    if (pollErr instanceof PollCancelledError) {
                        throw pollErr;
                    }
                    throw new Error(`音频生成轮询失败: ${pollErr.message || pollErr}`);
                } finally {
                    if (options.signal && onAbort) {
                        options.signal.removeEventListener('abort', onAbort);
                    }
                }
            }

            return {
                url: audioUrl, taskId, status: 'success',
                provider: this.provider,
                providerName: keySlot.name || this.provider,
                model: options.modelId, metadata
            };

        } catch (e: any) {
            console.error('[AudioCompatibleAdapter] 失败:', e);
            throw new Error(e.message || String(e));
        }
    }

    private isSuccessStatus(status: string): boolean {
        const s = status.toUpperCase();
        return s === 'SUCCESS' || s === 'COMPLETED' || s === 'SUCCEED';
    }

    private isFailureStatus(status: string): boolean {
        const s = status.toUpperCase();
        return s === 'FAILURE' || s === 'FAILED' || s === 'ERROR';
    }

    private async generateAudioWuyin(options: AudioGenerationOptions, keySlot: KeySlot): Promise<AudioGenerationResult> {
        const item = findWuyinCatalogItem(options.modelId, getWuyinCatalogFromKeySlot(keySlot));
        if (!item) throw new Error(`速创模型不存在：${options.modelId}`);
        if (item.kind !== 'audio') throw new Error(`当前模型不是音频模型：${item.name}`);

        const submitUrl = `${WUYIN_DEFAULT_BASE_URL}${item.endpointPath}`;
        
        const body = buildWuyinAudioSubmitBody({
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
            throw new Error(`Wuyin audio API error ${response.status}: ${errText.slice(0, 300)}`);
        }

        const payload = await response.json().catch(() => ({}));
        const logicalCode = Number(payload?.code);
        if (Number.isFinite(logicalCode) && logicalCode !== 200 && logicalCode !== 0) {
            throw new Error(`Wuyin audio API error ${logicalCode}: ${extractWuyinFailureMessage(payload)}`);
        }

        const taskId = extractWuyinTaskId(payload);
        const immediateUrls = extractWuyinOutputUrls(payload);
        const status = mapWuyinStatus(extractWuyinStatusCode(payload));
        
        const metadata: any = {};
        if (taskId) {
            options.onTaskId?.(taskId);
        }

        if (immediateUrls.length > 0 && (status === 'success' || !item.detailPath)) {
            return {
                url: immediateUrls[0],
                taskId,
                status: 'success',
                provider: this.provider,
                providerName: keySlot.name || this.provider,
                model: options.modelId,
                metadata,
            };
        }

        if (!taskId) {
            if (immediateUrls.length > 0) {
                return {
                    url: immediateUrls[0],
                    status: 'success',
                    provider: this.provider,
                    providerName: keySlot.name || this.provider,
                    model: options.modelId,
                    metadata,
                };
            }
            throw new Error('Wuyin audio API returned success without a task id or output URL.');
        }

        return this.pollWuyinAudioTask(taskId, item.detailPath || WUYIN_ASYNC_DETAIL_PATH, options, keySlot);
    }

    private async pollWuyinAudioTask(
        taskId: string,
        detailPath: string,
        options: AudioGenerationOptions,
        keySlot: KeySlot,
    ): Promise<AudioGenerationResult> {
        const maxDurationMs = 10 * 60 * 1000;
        const startTime = Date.now();
        let pollInterval = 3000;
        const maxInterval = 10000;

        const pollUrl = `${WUYIN_DEFAULT_BASE_URL}${detailPath}?id=${encodeURIComponent(String(taskId).trim())}`;

        while (Date.now() - startTime < maxDurationMs) {
            if (options.signal?.aborted) {
                throw new Error('Audio generation was aborted.');
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
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
                throw new Error(`Wuyin audio poll error ${response.status}: ${errText.slice(0, 200)}`);
            }

            const payload = await response.json().catch(() => ({}));
            const logicalCode = Number(payload?.code);
            if (Number.isFinite(logicalCode) && logicalCode !== 200 && logicalCode !== 0) {
                throw new Error(`Wuyin audio API error ${logicalCode}: ${extractWuyinFailureMessage(payload)}`);
            }

            const status = mapWuyinStatus(extractWuyinStatusCode(payload));
            if (status === 'success') {
                const audioUrls = extractWuyinOutputUrls(payload);
                if (audioUrls.length > 0) {
                    return {
                        url: audioUrls[0],
                        taskId,
                        status: 'success',
                        provider: this.provider,
                        providerName: keySlot.name || this.provider,
                        model: options.modelId,
                        metadata: {},
                    };
                }
                throw new Error('Wuyin audio task completed without a usable output URL.');
            }

            if (status === 'failed') {
                const reason = extractWuyinFailureMessage(payload);
                throw new Error(`Wuyin audio generation failed: ${reason}`);
            }
        }

        throw new Error('Wuyin audio generation timed out after 10 minutes.');
    }
}
