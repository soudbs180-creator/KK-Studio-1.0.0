import type {
    AudioGenerationOptions,
    AudioGenerationResult,
    ChatOptions,
    ImageGenerationOptions,
    ImageGenerationResult,
    LLMAdapter,
    VideoGenerationOptions,
    VideoGenerationResult,
} from './LLMAdapter';
import type { KeySlot } from '../auth/keyManager';
import { GoogleAdapter, buildGeminiNativeGroundingTools, buildInlineImagePart } from './GoogleAdapter';
import { OpenAICompatibleAdapter } from './OpenAICompatibleAdapter';
import { VideoCompatibleAdapter } from './VideoCompatibleAdapter';
import { AudioCompatibleAdapter } from './AudioCompatibleAdapter';
import { resolveProviderRuntime } from '../api/providerStrategy';
import { GenerationMode } from '../../types';
import {
    buildGeminiEndpoint,
    type AuthMethod,
} from '../api/apiConfig';
import { assertNoDirectCall } from '../../utils/security';
import { forwardUserRouteGenericRequest } from '../model/secureModelProxy';

export class GeminiNativeAdapter implements LLMAdapter {
    id = 'gemini-native-adapter';
    provider = 'GeminiNative';

    private googleAdapter = new GoogleAdapter();
    private openAICompatibleAdapter = new OpenAICompatibleAdapter();
    private videoCompatibleAdapter = new VideoCompatibleAdapter();
    private audioCompatibleAdapter = new AudioCompatibleAdapter();

    supports(modelId: string): boolean {
        return this.googleAdapter.supports(modelId);
    }

    private resolveRuntime(keySlot: KeySlot, modelId?: string) {
        return resolveProviderRuntime({
            provider: keySlot.provider,
            baseUrl: keySlot.baseUrl,
            format: 'gemini',
            authMethod: keySlot.authMethod,
            headerName: keySlot.headerName,
            compatibilityMode: keySlot.compatibilityMode,
            modelId,
        });
    }

    async chat(options: ChatOptions, keySlot: KeySlot): Promise<string> {
        const runtime = this.resolveRuntime(keySlot, options.modelId);
        const authMethod = runtime.authMethod as AuthMethod;
        const useSnakeCase = runtime.strategyId === '12ai';
        const systemInstructionTexts = [
            options.systemPrompt,
            ...options.messages
                .filter((message) => message.role === 'system')
                .map((message) => typeof message.content === 'string' ? message.content : JSON.stringify(message.content)),
        ]
            .map((value) => String(value || '').trim())
            .filter((value) => value.length > 0);

        // 步骤 A: 传入空字符串作为 apiKey，完全防止 URL 拼接明文 key
        const endpoint = buildGeminiEndpoint(
            keySlot.baseUrl,
            options.modelId,
            'generateContent',
            '',
            authMethod,
            keySlot.provider,
        );

        // 步骤 C: 安全守卫
        assertNoDirectCall(endpoint);

        const contents = options.messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: typeof message.content === 'string' ? message.content : JSON.stringify(message.content) }],
            }));
        if (options.inlineData?.length) {
            const lastUserIdx = contents.map((message) => message.role).lastIndexOf('user');
            if (lastUserIdx >= 0) {
                options.inlineData.forEach((media) => {
                    contents[lastUserIdx].parts.push(buildInlineImagePart(media.data, media.mimeType, useSnakeCase));
                });
            }
        }
        const generationConfig: Record<string, unknown> = {
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens || 2048,
        };
        if (options.providerConfig?.google?.thinkingConfig?.thinkingLevel) {
            generationConfig.thinkingConfig = {
                thinkingLevel: options.providerConfig.google.thinkingConfig.thinkingLevel,
            };
        }
        if (options.providerConfig?.google?.responseModalities?.length) {
            generationConfig.responseModalities = options.providerConfig.google.responseModalities;
        }
        const payload: Record<string, unknown> = {
            contents: contents.length > 0
                ? contents
                : [{ role: 'user', parts: [{ text: 'Hello' }] }],
            generationConfig,
        };
        if (systemInstructionTexts.length > 0) {
            payload[useSnakeCase ? 'system_instruction' : 'systemInstruction'] = {
                parts: systemInstructionTexts.map((text) => ({ text })),
            };
        }
        if (options.providerConfig?.google?.safetySettings) {
            payload.safetySettings = options.providerConfig.google.safetySettings;
        }
        const groundingTools = buildGeminiNativeGroundingTools(options.providerConfig?.google?.tools, useSnakeCase);
        if (groundingTools?.length) {
            payload.tools = groundingTools;
        }

        // 步骤 B & A: 改为使用 forwardUserRouteGenericRequest 代理中转，只传 keySlot.id
        const response = await forwardUserRouteGenericRequest({
            provider: 'gemini',
            keyId: keySlot.id,
            url: endpoint,
            method: 'POST',
            rawBody: payload,
            headers: { 'Content-Type': 'application/json' },
            signal: options.signal,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Gemini-native chat failed (${response.status}): ${errorText || response.statusText}`);
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        return parts
            .map((part: any) => String(part?.text || ''))
            .join('');
    }

    async generateImage(options: ImageGenerationOptions, keySlot: KeySlot): Promise<ImageGenerationResult> {
        const runtime = this.resolveRuntime(keySlot, options.modelId);
        if (runtime.providerFamily === 'google-official') {
            return this.googleAdapter.generateImage(options, keySlot);
        }

        return this.openAICompatibleAdapter.generateImage(options, keySlot);
    }

    async generateVideo(options: VideoGenerationOptions, keySlot: KeySlot): Promise<VideoGenerationResult> {
        const runtime = this.resolveRuntime(keySlot, options.modelId);
        if (runtime.providerFamily === 'google-official') {
            return this.googleAdapter.generateVideo!(options, keySlot);
        }

        return this.videoCompatibleAdapter.generateVideo!(options, keySlot);
    }

    async generateAudio(options: AudioGenerationOptions, keySlot: KeySlot): Promise<AudioGenerationResult> {
        const runtime = this.resolveRuntime(keySlot, options.modelId);
        if (runtime.providerFamily === 'google-official') {
            return this.googleAdapter.generateAudio!(options, keySlot);
        }

        return this.audioCompatibleAdapter.generateAudio!(options, keySlot);
    }

    async checkTaskStatus(taskId: string, mode: GenerationMode, keySlot: KeySlot): Promise<any> {
        const runtime = this.resolveRuntime(keySlot);
        if (runtime.providerFamily === 'google-official') {
            return this.googleAdapter.checkTaskStatus!(taskId, mode, keySlot);
        }

        if (mode === GenerationMode.IMAGE) {
            return this.openAICompatibleAdapter.checkTaskStatus!(taskId, mode, keySlot);
        }

        throw new Error(`Polling not supported for ${mode} on non-Google Gemini-native channels`);
    }
}
