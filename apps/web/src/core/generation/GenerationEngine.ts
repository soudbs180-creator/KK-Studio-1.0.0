import type { GenerationIntent } from '../orchestration/taskIntent';
import { providerRouteEngine } from '../routing/ProviderRouteEngine.ts';
import { localRunnerClient } from '../../features/generation/localRunnerClient.ts';
import { cloudRelayClient } from '../../features/generation/cloudRelayClient.ts';
import { platformCreditClient } from '../../features/generation/platformCreditClient.ts';
import { accountLinkerClient } from '../../features/generation/accountLinkerClient.ts';
import { keyManager } from '../../services/auth/keyManager.ts';
import { buildSecureProxyUserRouteFromSlotId } from '../../services/model/secureModelProxy.ts';
import type { GenerationTelemetry } from '@kk/shared';

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
    const startTime = Date.now();
    let result: any = null;
    let errorOccurred: any = null;

    try {
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
          result = await localRunnerClient.generateImage({ ...payload, routeId });
        } else if (decision.mode === 'cloud-user-key') {
          result = await cloudRelayClient.generateImage({ ...payload, routeId });
        } else if (decision.mode === 'cloud-platform-key') {
          result = await platformCreditClient.generateImage(payload);
        } else if (decision.mode === 'account-bridge') {
          result = await accountLinkerClient.generateImage(payload);
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
          result = await localRunnerClient.chat({ ...payload, routeId });
        } else if (decision.mode === 'cloud-user-key') {
          result = await cloudRelayClient.chat({ ...payload, routeId });
        } else if (decision.mode === 'cloud-platform-key') {
          result = await platformCreditClient.chat(payload);
        } else if (decision.mode === 'account-bridge') {
          result = await accountLinkerClient.chat(payload);
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
          result = await localRunnerClient.generateVideo({ ...payload, routeId });
        } else if (decision.mode === 'cloud-user-key') {
          result = await cloudRelayClient.generateVideo({ ...payload, routeId });
        } else if (decision.mode === 'cloud-platform-key') {
          result = await platformCreditClient.generateVideo(payload);
        } else if (decision.mode === 'account-bridge') {
          result = await accountLinkerClient.generateVideo(payload);
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
          result = await localRunnerClient.generateAudio({ ...payload, routeId });
        } else if (decision.mode === 'cloud-user-key') {
          result = await cloudRelayClient.generateAudio({ ...payload, routeId });
        } else if (decision.mode === 'cloud-platform-key') {
          result = await platformCreditClient.generateAudio(payload);
        } else if (decision.mode === 'account-bridge') {
          result = await accountLinkerClient.generateAudio(payload);
        } else {
          throw new Error(`Browser direct provider calls are disabled for audio generation under mode: ${decision.mode}`);
        }
      } else {
        throw new Error(`Unsupported media type for GenerationEngine: ${intent.mediaType}`);
      }
      return result;
    } catch (e: any) {
      errorOccurred = e;
      throw e;
    } finally {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const telemetry: GenerationTelemetry = {
        jobId: intent.requestId || `job-${Date.now()}`,
        taskType: intent.mediaType === 'batch' ? 'image' : (intent.mediaType as any),
        model: {
          id: intent.modelId,
          name: intent.modelId,
          provider: keySlot?.provider || 'unknown',
          providerName: keySlot?.provider || 'unknown',
        },
        route: {
          sourceType: decision.mode === 'local-runner' ? 'api-user-local' :
                      decision.mode === 'cloud-user-key' ? 'api-user-cloud' :
                      decision.mode === 'account-bridge' ? 'official-oauth-openai' : 'api-platform',
          executionSide: decision.mode === 'local-runner' ? 'local' : 'cloud',
          keySlotId: keySlot?.id,
        },
        timing: {
          queuedAt: new Date(startTime).toISOString(),
          startedAt: new Date(startTime).toISOString(),
          firstByteAt: new Date(startTime + Math.min(200, duration)).toISOString(),
          completedAt: errorOccurred ? undefined : new Date(endTime).toISOString(),
          failedAt: errorOccurred ? new Date(endTime).toISOString() : undefined,
          queueDurationMs: 0,
          generationDurationMs: duration,
          totalDurationMs: duration,
        },
        usage: {
          promptTokens: result?.usage?.promptTokens || result?.promptTokens || 0,
          completionTokens: result?.usage?.completionTokens || result?.completionTokens || 0,
          totalTokens: result?.usage?.totalTokens || result?.tokens || 0,
          apiDurationMs: duration,
        },
        cost: {
          chargedCredits: result?.creditCost || result?.cost || (intent.mediaType === 'video' ? 15 : intent.mediaType === 'audio' ? 2 : 10),
          refundedCredits: errorOccurred ? (intent.mediaType === 'video' ? 15 : intent.mediaType === 'audio' ? 2 : 10) : 0,
          estimatedAmount: result?.cost || 0,
          chargedAmount: errorOccurred ? 0 : (result?.cost || 0),
          ledgerId: result?.ledgerId,
          billingTransactionId: result?.billingTransactionId || result?.paymentTransactionId,
          balanceAfter: result?.balanceAfter,
        },
        settings: {
          prompt: intent.prompt,
          negativePrompt: intent.params?.negativePrompt,
          aspectRatio: intent.params?.aspectRatio,
          size: intent.params?.imageSize || intent.params?.size,
          imageCount: intent.params?.imageCount,
        },
        result: {
          assetIds: result?.id ? [result.id] : [],
          canvasNodeIds: [intent.requestId || ''],
          urls: result?.urls || (result?.url ? [result.url] : []),
        },
        error: errorOccurred ? {
          code: errorOccurred.code || 'UNKNOWN_ERROR',
          message: errorOccurred.message || 'Unknown error during generation',
          retryable: errorOccurred.retryable !== false,
        } : undefined,
        retry: {
          previousJobIds: [],
          retryCount: 0,
        }
      };

      if (result) {
        result.telemetry = telemetry;
      }
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
