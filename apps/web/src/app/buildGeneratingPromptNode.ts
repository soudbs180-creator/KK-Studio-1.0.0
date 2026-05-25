import type { GenerationConfig, PromptNode, ReferenceImage } from '../types';
import { buildPptDeckModuleState } from '../utils/pptDeckModules';

type PreviewModelMetaLike = {
  colorEnd?: string;
  colorSecondary?: string;
  colorStart?: string;
  textColor?: 'white' | 'black';
};

interface BuildGeneratingPromptNodeArgs {
  billingAttemptId?: string;
  billingMode: NonNullable<PromptNode['billingMode']>;
  cost: number;
  creditCost?: number;
  creditRouteSpecId?: string;
  creditRouteUnitId?: string;
  creditSettlement: NonNullable<PromptNode['creditSettlement']>;
  executionLane?: PromptNode['executionLane'];
  isNew: boolean;
  isPaymentProcessed: boolean;
  keySlotId?: string;
  parallelCount: number;
  paymentTransactionId?: string;
  position: PromptNode['position'];
  previewModelLabel: string;
  previewModelMeta?: PreviewModelMetaLike | null;
  previewProvider: string;
  previewProviderLabel: string;
  prompt: string;
  promptNodeId: string;
  promptOptimizationEnabled: boolean;
  promptOptimizerResult?: PromptNode['promptOptimizerResult'];
  pptSlides: string[];
  referenceImages: ReferenceImage[];
  sourceImageId?: string;
  config: GenerationConfig;
  optimizedPromptEn?: string;
  optimizedPromptZh?: string;
}

export function buildGeneratingPromptNode({
  billingAttemptId,
  billingMode,
  cost,
  creditCost,
  creditRouteSpecId,
  creditRouteUnitId,
  creditSettlement,
  executionLane,
  isNew,
  isPaymentProcessed,
  keySlotId,
  parallelCount,
  paymentTransactionId,
  position,
  previewModelLabel,
  previewModelMeta,
  previewProvider,
  previewProviderLabel,
  prompt,
  promptNodeId,
  promptOptimizationEnabled,
  promptOptimizerResult,
  pptSlides,
  referenceImages,
  sourceImageId,
  config,
  optimizedPromptEn,
  optimizedPromptZh,
}: BuildGeneratingPromptNodeArgs): PromptNode {
  const nextNode: PromptNode = {
    id: promptNodeId,
    prompt,
    originalPrompt: prompt,
    optimizedPromptEn,
    optimizedPromptZh,
    promptOptimizerResult,
    promptOptimizationEnabled,
    position,
    aspectRatio: config.aspectRatio,
    imageSize: config.imageSize,
    model: config.model,
    modelLabel: previewModelLabel,
    modelColorStart: previewModelMeta?.colorStart,
    modelColorEnd: previewModelMeta?.colorEnd,
    modelColorSecondary: previewModelMeta?.colorSecondary,
    modelTextColor: previewModelMeta?.textColor,
    thinkingMode: config.thinkingMode || 'minimal',
    enableGrounding: !!config.enableGrounding,
    enableImageSearch: !!config.enableImageSearch,
    provider: previewProvider,
    providerLabel: previewProviderLabel,
    keySlotId,
    childImageIds: [],
    lastGenerationSuccessCount: undefined,
    lastGenerationFailCount: undefined,
    lastGenerationTotalCount: undefined,
    referenceImages,
    timestamp: Date.now(),
    isGenerating: true,
    error: undefined,
    errorDetails: undefined,
    refundStatus: undefined,
    creditSettlement,
    executionLane,
    billingAttemptId,
    creditRouteSpecId,
    creditRouteUnitId,
    paymentTransactionId,
    isNew,
    parallelCount,
    sourceImageId,
    mode: config.mode,
    isDraft: false,
    videoResolution: config.videoResolution,
    videoDuration: config.videoDuration,
    videoAudio: config.videoAudio,
    pptSlides,
    pptStyleLocked: config.pptStyleLocked !== false,
    cost,
    billingMode,
    creditCost,
    isPaymentProcessed,
    generationMetadata: {
      pendingTaskIds: [],
    },
  };

  if (config.mode === 'ppt') {
    nextNode.pptDeck = buildPptDeckModuleState(nextNode);
  }

  return nextNode;
}
