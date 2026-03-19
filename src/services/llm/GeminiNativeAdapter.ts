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
import { GoogleAdapter } from './GoogleAdapter';
import { OpenAICompatibleAdapter } from './OpenAICompatibleAdapter';
import { VideoCompatibleAdapter } from './VideoCompatibleAdapter';
import { AudioCompatibleAdapter } from './AudioCompatibleAdapter';
import { resolveProviderRuntime } from '../api/providerStrategy';
import { GenerationMode } from '../../types';
import {
    buildGeminiEndpoint,
    buildGeminiHeaders,
    type AuthMethod,
} from '../api/apiConfig';

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
        const systemInstructionTexts = [
            options.systemPrompt,
            ...options.messages
                .filter((message) => message.role === 'system')
                .map((message) => typeof message.content === 'string' ? message.content : JSON.stringify(message.content)),
        ]
            .map((value) => String(value || '').trim())
            .filter((value) => value.length > 0);
        const endpoint = buildGeminiEndpoint(
            keySlot.baseUrl,
            options.modelId,
            'generateContent',
            keySlot.key,
            authMethod,
            keySlot.provider,
        );

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: buildGeminiHeaders(authMethod, keySlot.key, runtime.headerName, runtime.authorizationValueFormat),
            body: JSON.stringify({
                ...(systemInstructionTexts.length > 0
                    ? {
                        systemInstruction: {
                            parts: systemInstructionTexts.map((text) => ({ text })),
                        },
                    }
                    : {}),
                contents: [
                    ...options.messages
                        .filter((message) => message.role !== 'system')
                        .map((message) => ({
                        role: message.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: typeof message.content === 'string' ? message.content : JSON.stringify(message.content) }],
                    })),
                ],
                generationConfig: {
                    temperature: options.temperature,
                    maxOutputTokens: options.maxTokens || 2048,
                },
            }),
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
