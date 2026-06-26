import type { GenerationIntent } from '../orchestration/taskIntent';
import { providerRouteEngine } from '../routing/ProviderRouteEngine';
import { localRunnerClient } from '../../features/generation/localRunnerClient';
import { cloudRelayClient } from '../../features/generation/cloudRelayClient';
import { platformCreditClient } from '../../features/generation/platformCreditClient';
import { accountLinkerClient } from '../../features/generation/accountLinkerClient';
import { keyManager } from '../../services/auth/keyManager';
import { buildSecureProxyUserRouteFromSlotId } from '../../services/model/secureModelProxy';

export class GenerationEngine {
  private static instance: GenerationEngine;

  private constructor() {}

  public static getInstance(): GenerationEngine {
    if (!GenerationEngine.instance) {
      GenerationEngine.instance = new GenerationEngine();
    }
    return GenerationEngine.instance;
  }

  /**
   * Run a media generation task based on GenerationIntent
   */
  public async generate(intent: GenerationIntent): Promise<any> {
    const keySlot = this.resolveKeySlot(intent.modelId, intent.preferredKeyId);
    if (!keySlot) {
      throw new Error(`No available key resolved for model: ${intent.modelId}`);
    }

    const decision = await providerRouteEngine.decideRoute({
      modelId: intent.modelId,
      taskType: intent.mediaType === 'batch' ? 'image' : (intent.mediaType as any),
      preferredKeyId: intent.preferredKeyId,
    });

    const routeId = this.buildUserRouteForKeySlot(keySlot);

    if (intent.mediaType === 'image' || intent.mediaType === 'batch') {
      const payload = {
        modelId: intent.modelId,
        prompt: intent.prompt,
        requestId: intent.requestId,
        attemptId: this.deriveAttemptId(intent.requestId),
        creditRouteSpecId: intent.creditRouteSpecId,
        creditRouteUnitId: intent.creditRouteUnitId,
        aspectRatio: intent.params?.aspectRatio,
        imageSize: intent.params?.imageSize,
        imageCount: intent.params?.imageCount || 1,
        referenceImages: intent.params?.referenceImages,
      };

      if (decision.mode === 'local-runner') {
        return await localRunnerClient.generateImage({ ...payload, routeId });
      } else if (decision.mode === 'cloud-user-key') {
        return await cloudRelayClient.generateImage({ ...payload, routeId });
      } else if (decision.mode === 'cloud-platform-key') {
        return await platformCreditClient.generateImage(payload);
      } else if (decision.mode === 'account-bridge') {
        return await accountLinkerClient.generateImage(payload);
      } else {
        throw new Error(`Browser direct provider calls are disabled for image generation under mode: ${decision.mode}`);
      }
    } else if (intent.mediaType === 'text') {
      const payload = {
        modelId: intent.modelId,
        messages: intent.params?.messages || [{ role: 'user', content: intent.prompt }],
        temperature: intent.params?.temperature,
        maxTokens: intent.params?.maxTokens,
        stream: intent.params?.stream || false,
      };

      if (decision.mode === 'local-runner') {
        return await localRunnerClient.chat({ ...payload, routeId });
      } else if (decision.mode === 'cloud-user-key') {
        return await cloudRelayClient.chat({ ...payload, routeId });
      } else if (decision.mode === 'cloud-platform-key') {
        return await platformCreditClient.chat(payload);
      } else if (decision.mode === 'account-bridge') {
        return await accountLinkerClient.chat(payload);
      } else {
        throw new Error(`Browser direct provider calls are disabled for chat under mode: ${decision.mode}`);
      }
    } else if (intent.mediaType === 'video') {
      const payload = {
        modelId: intent.modelId,
        prompt: intent.prompt,
        aspectRatio: intent.params?.aspectRatio,
        resolution: intent.params?.resolution,
        duration: intent.params?.duration,
        videoDuration: intent.params?.videoDuration,
        imageUrl: intent.params?.imageUrl,
        imageTailUrl: intent.params?.imageTailUrl,
      };

      if (decision.mode === 'local-runner') {
        return await localRunnerClient.generateVideo({ ...payload, routeId });
      } else if (decision.mode === 'cloud-user-key') {
        return await cloudRelayClient.generateVideo({ ...payload, routeId });
      } else if (decision.mode === 'cloud-platform-key') {
        return await platformCreditClient.generateVideo(payload);
      } else if (decision.mode === 'account-bridge') {
        return await accountLinkerClient.generateVideo(payload);
      } else {
        throw new Error(`Browser direct provider calls are disabled for video generation under mode: ${decision.mode}`);
      }
    } else if (intent.mediaType === 'audio') {
      const payload = {
        modelId: intent.modelId,
        prompt: intent.prompt,
        audioDuration: intent.params?.audioDuration,
        audioLyrics: intent.params?.audioLyrics,
      };

      if (decision.mode === 'local-runner') {
        return await localRunnerClient.generateAudio({ ...payload, routeId });
      } else if (decision.mode === 'cloud-user-key') {
        return await cloudRelayClient.generateAudio({ ...payload, routeId });
      } else if (decision.mode === 'cloud-platform-key') {
        return await platformCreditClient.generateAudio(payload);
      } else if (decision.mode === 'account-bridge') {
        return await accountLinkerClient.generateAudio(payload);
      } else {
        throw new Error(`Browser direct provider calls are disabled for audio generation under mode: ${decision.mode}`);
      }
    } else {
      throw new Error(`Unsupported media type for GenerationEngine: ${intent.mediaType}`);
    }
  }

  private resolveKeySlot(modelId: string, preferredKeyId?: string) {
    return keyManager.getNextKey(modelId, preferredKeyId);
  }

  private buildUserRouteForKeySlot(keySlot: any): string {
    return buildSecureProxyUserRouteFromSlotId(keySlot.id).id;
  }

  private deriveAttemptId(requestId?: string): string | undefined {
    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) return undefined;
    const match = /^(.*):\d+$/.exec(normalizedRequestId);
    return (match?.[1] || normalizedRequestId).trim() || undefined;
  }
}

export const generationEngine = GenerationEngine.getInstance();
