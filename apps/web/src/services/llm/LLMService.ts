/**
 * @deprecated 建议直接从 './generationService' 导入 generationService。
 * 本类仅为了向前兼容，将所有调用代理分流至 generationService。
 */
import { generationService } from './generationService';
import { type ChatOptions, type ImageGenerationOptions, type VideoGenerationOptions, type AudioGenerationOptions } from './LLMAdapter';
import { type KeySlot } from '../auth/keyManager';
import { GenerationMode, type Provider } from '../../types';
import { type ProviderCapabilityProfile } from './providerCapabilities';

export class LLMService {
    private static instance: LLMService;

    public static getInstance(): LLMService {
        if (!LLMService.instance) {
            LLMService.instance = new LLMService();
        }
        return LLMService.instance;
    }

    public getProviderProfile(provider: Provider): ProviderCapabilityProfile | null {
        return generationService.getProviderProfile(provider);
    }

    public getProviderProfiles(): ProviderCapabilityProfile[] {
        return generationService.getProviderProfiles();
    }

    public canProviderHandleModel(provider: Provider, modelId: string): boolean {
        return generationService.canProviderHandleModel(provider, modelId);
    }

    public async chat(options: ChatOptions): Promise<string> {
        return generationService.chat(options);
    }

    public async generateImage(options: ImageGenerationOptions, onTaskId?: (id: string) => void): Promise<any> {
        return generationService.generateImageRaw(options, onTaskId);
    }

    public resolveKey(modelId: string, preferredKeyId?: string): KeySlot | null {
        return generationService.resolveKey(modelId, preferredKeyId);
    }

    public async generateVideo(options: VideoGenerationOptions, onTaskId?: (id: string) => void): Promise<any> {
        return generationService.generateVideo(options, onTaskId);
    }

    public async generateAudio(options: AudioGenerationOptions, _onTaskId?: (id: string) => void): Promise<any> {
        return generationService.generateAudio(options, _onTaskId);
    }

    public async checkTaskStatus(
        taskId: string,
        mode: GenerationMode,
        preferredKeyId?: string | { id?: string },
        modelId?: string
    ): Promise<any> {
        return generationService.checkTaskStatus(taskId, mode, preferredKeyId, modelId);
    }

    public async checkTaskStatuses(
        taskIds: string[],
        mode: GenerationMode,
        preferredKeyId?: string | { id?: string },
        modelId?: string
    ): Promise<any[]> {
        return generationService.checkTaskStatuses(taskIds, mode, preferredKeyId, modelId);
    }
}

export const llmService = LLMService.getInstance();
