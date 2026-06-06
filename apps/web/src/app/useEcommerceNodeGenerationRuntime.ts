import { useCallback, type RefObject } from 'react';

import { getModelCapabilities } from '../services/model/modelCapabilities.ts';
import { buildEcommerceRenderTask } from '../services/ecommerce/renderTaskBuilder.ts';
import { mergeEcommerceTaskState } from '../services/ecommerce/taskMerger.ts';
import {
  AspectRatio,
  GenerationMode,
  ImageSize,
  type EcommerceEditableTaskState,
  type GeneratedImage,
  type PromptNode,
  type ReferenceImage,
} from '../types';
import { optimizeGenerationPrompt, summarizePromptOptimizationError } from './optimizeGenerationPrompt.ts';
import type { ApplyEffectiveSizingToEcommerceTaskState } from './useEcommerceBuildRuntime.ts';
import type { EcommerceNodeGenerationSettings } from './useEcommerceSheetSettingsRuntime.ts';

export interface EcommerceNodeGenerationCanvasSnapshot {
  promptNodes: PromptNode[];
  imageNodes?: GeneratedImage[];
}

export interface EcommerceNodeGenerationRuntimeState {
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
}

export type SetEcommerceNodeGenerationRuntimeState = (
  updater: (previousState: EcommerceNodeGenerationRuntimeState) => Partial<EcommerceNodeGenerationRuntimeState> | null
) => void;

export type UpdateEcommerceGeneratedPromptNode = (node: PromptNode) => Promise<void> | void;

export type EcommerceNodeGenerationTarget = 'sheet' | 'desktop' | 'mobile';

export interface EcommerceNodeGenerationOptions {
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  generationTarget?: EcommerceNodeGenerationTarget;
  promptSuffix?: string;
  stagePatch?: Partial<NonNullable<PromptNode['ecommerce']>>;
  successPatch?: Partial<NonNullable<PromptNode['ecommerce']>>;
  failurePatch?: Partial<NonNullable<PromptNode['ecommerce']>>;
  promptAssistMode?: 'auto' | 'disabled' | 'regenerate-feedback';
}

export type UpdateEcommerceNodeState = (
  nodeId: string,
  patch: Partial<NonNullable<PromptNode['ecommerce']>>,
  nodePatch?: Partial<PromptNode>,
) => void;

export interface UseEcommerceNodeGenerationRuntimeDeps {
  activeCanvasRef: RefObject<EcommerceNodeGenerationCanvasSnapshot | null | undefined>;
  ecommerceState: EcommerceNodeGenerationRuntimeState;
  setEcommerceNodeGenerationRuntimeState: SetEcommerceNodeGenerationRuntimeState;
  enablePromptOptimization: boolean;
  promptOptimizerArchetype?: string;
  configPrompt: string;
  updatePromptNode: UpdateEcommerceGeneratedPromptNode;
  handleRetryNode: (node: PromptNode) => Promise<void>;
  applyEffectiveSizingToTaskState: ApplyEffectiveSizingToEcommerceTaskState;
  resolveEcommerceNodeGenerationSettings: (
    node: PromptNode,
    generationTarget?: EcommerceNodeGenerationTarget
  ) => EcommerceNodeGenerationSettings;
  resolveEffectiveEcommerceThinkingMode: () => 'minimal' | 'high';
}

export interface UseEcommerceNodeGenerationRuntimeResult {
  updateEcommerceNodeState: UpdateEcommerceNodeState;
  runEcommerceNodeGeneration: (
    node: PromptNode,
    options?: EcommerceNodeGenerationOptions
  ) => Promise<void>;
  handleGenerateEcommerceNode: (node: PromptNode) => Promise<void>;
  handleOptimizeEcommerceTaskPrompt: (node: PromptNode) => Promise<void>;
  handleRegenerateUnsatisfiedEcommerceNode: (node: PromptNode) => Promise<void>;
  handleConfirmEcommerceDesktop: (node: PromptNode) => void;
  handleRetryEcommerceModule: (node: PromptNode) => Promise<void>;
}

function resolveLatestGeneratedFeedbackReference(
  node: PromptNode,
  snapshot?: EcommerceNodeGenerationCanvasSnapshot | null,
): ReferenceImage | null {
  const latestImageId = [...(node.childImageIds || [])].reverse()[0];
  if (!latestImageId) return null;

  const image = snapshot?.imageNodes?.find((item) => item.id === latestImageId);
  const data = image?.originalUrl || image?.apiResultUrl || image?.url || '';
  if (!image || !data) return null;

  return {
    id: `feedback-${image.id}`,
    storageId: image.storageId,
    data,
    url: data,
    mimeType: image.mimeType || 'image/png',
  };
}

const regenerateFeedbackPromptSuffix = [
  '用户对上一版生成结果不满意。',
  '请结合上一版坏图先反推问题：可能是场景不好看、产品不够突出、版式不统一、文案层级不清晰或风格偏离参考。',
  '在不更换产品、不改文案、不破坏系列风格的前提下，重新优化本张提示词，让画面更统一、更高级、更符合电商展示。',
].join('\n');

const aPlusMobilePromptSuffix = '请把这张 A+ 桌面版画面改成 4:3 手机端版本。产品主体、文案内容、品牌风格、色调和核心场景保持一致；只根据 4:3 比例重新压缩布局，让画面更紧凑、更适合手机浏览。不要更换产品，不要改文案，不要改变主视觉风格.继续按照 @产品主图、@风格参考 等参考图职责执行。输出必须符合 600*450 比例，可以是 600*450 或任意等比例高分辨率倍数。';

export function useEcommerceNodeGenerationRuntime({
  activeCanvasRef,
  ecommerceState,
  setEcommerceNodeGenerationRuntimeState,
  enablePromptOptimization,
  promptOptimizerArchetype,
  configPrompt,
  updatePromptNode,
  handleRetryNode,
  applyEffectiveSizingToTaskState,
  resolveEcommerceNodeGenerationSettings,
  resolveEffectiveEcommerceThinkingMode,
}: UseEcommerceNodeGenerationRuntimeDeps): UseEcommerceNodeGenerationRuntimeResult {
  const updateEcommerceNodeState = useCallback<UpdateEcommerceNodeState>((nodeId, patch, nodePatch = {}) => {
    const latestNode = activeCanvasRef.current?.promptNodes.find((node) => node.id === nodeId);
    if (!latestNode?.ecommerce) return;
    updatePromptNode({
      ...latestNode,
      ...nodePatch,
      ecommerce: {
        ...latestNode.ecommerce,
        ...patch,
      },
    });
  }, [activeCanvasRef, updatePromptNode]);

  const syncActiveEcommerceTask = useCallback((nodeId: string, taskState: EcommerceEditableTaskState) => {
    setEcommerceNodeGenerationRuntimeState((previousState) => {
      if (previousState.activeTaskNodeId !== nodeId) {
        return null;
      }

      return {
        activeTaskState: taskState,
      };
    });
  }, [setEcommerceNodeGenerationRuntimeState]);

  const runEcommerceNodeGeneration = useCallback(async (
    node: PromptNode,
    options?: EcommerceNodeGenerationOptions,
  ) => {
    const latestNode = activeCanvasRef.current?.promptNodes.find((item) => item.id === node.id) || node;
    if (!latestNode.ecommerce) return;

    const nextGenerationSettings = resolveEcommerceNodeGenerationSettings(latestNode, options?.generationTarget);
    const nextAspectRatio = options?.aspectRatio || nextGenerationSettings.aspectRatio;
    const nextImageSize = options?.imageSize || nextGenerationSettings.imageSize;
    const activeDraft = ecommerceState.activeTaskNodeId === node.id
      ? ecommerceState.activeTaskState
      : null;
    const baseTaskState = activeDraft || latestNode.ecommerce.editableTask;
    const seriesTemplate = latestNode.ecommerce.seriesTemplate;
    const mergedTaskState = (baseTaskState && seriesTemplate)
      ? applyEffectiveSizingToTaskState(mergeEcommerceTaskState({
          baseTask: {
            ...baseTaskState,
            assetRoles: baseTaskState.assetRoles,
          },
          seriesTemplate,
          sparseIntent: ecommerceState.activeTaskNodeId === node.id
            ? (String(configPrompt || '').trim() || baseTaskState.sparseUserIntent || '')
            : (baseTaskState.sparseUserIntent || ''),
          productName: latestNode.ecommerce.productImageRef?.label || latestNode.ecommerce.theme || '',
        }))
      : null;
    const renderTask = mergedTaskState && seriesTemplate
      ? buildEcommerceRenderTask({
          taskState: mergedTaskState,
          seriesTemplate,
          aspectRatio: String(nextAspectRatio),
          imageSize: String(nextImageSize),
        })
      : null;
    const activeDeliveryKind = options?.generationTarget === 'mobile'
      ? 'mobile'
      : (latestNode.ecommerce.effectiveSizePolicy || latestNode.ecommerce.sizePolicy) === 'desktop-then-mobile'
        ? 'desktop'
        : 'default';
    const promptAssistMode = options?.promptAssistMode || 'auto';
    const isFailureRetry = latestNode.ecommerce.stage === 'failed'
      || (options?.generationTarget === 'desktop' && latestNode.ecommerce.desktopStage === 'failed')
      || (options?.generationTarget === 'mobile' && latestNode.ecommerce.mobileStage === 'failed');
    const forceRegenerateFeedback = promptAssistMode === 'regenerate-feedback';
    const promptAssistEnabled = enablePromptOptimization
      && promptAssistMode !== 'disabled'
      && !(promptAssistMode === 'auto' && isFailureRetry)
      && (
        forceRegenerateFeedback
        || renderTask?.taskState.promptAssistState?.optimized === true
      );
    const feedbackReference = forceRegenerateFeedback
      ? resolveLatestGeneratedFeedbackReference(latestNode, activeCanvasRef.current)
      : null;
    const optimizerReferenceImages = feedbackReference
      ? [...(latestNode.referenceImages || []), feedbackReference]
      : (latestNode.referenceImages || []);
    let nextPrompt = [
      renderTask?.prompt || latestNode.originalPrompt || latestNode.prompt,
      options?.promptSuffix || '',
      forceRegenerateFeedback && promptAssistEnabled ? regenerateFeedbackPromptSuffix : '',
    ].filter(Boolean).join('\n');
    const {
      optimizedPrompt: optimizedNextPrompt,
      optimizedPromptEn,
      optimizedPromptZh,
      promptOptimizerResult,
    } = await optimizeGenerationPrompt({
      enabled: promptAssistEnabled && !!nextPrompt,
      rawPrompt: nextPrompt,
      referenceImages: optimizerReferenceImages,
      options: {
        preferredModelId: latestNode.model,
        preferredArchetypeId: promptOptimizerArchetype,
        aspectRatio: String(nextAspectRatio),
        imageSize: String(nextImageSize),
        mode: GenerationMode.ECOMMERCE,
        supportsThinking: !!getModelCapabilities(latestNode.model)?.supportsThinking,
        thinkingMode: resolveEffectiveEcommerceThinkingMode(),
        ecommerceContext: renderTask && seriesTemplate ? {
          taskState: renderTask.taskState,
          seriesTemplate,
          assetRoles: renderTask.taskState.assetRoles,
          outputTarget: {
            label: renderTask.displayLabel,
            aspectRatio: String(nextAspectRatio),
            imageSize: String(nextImageSize),
          },
        } : undefined,
      },
      onError: (error) => {
        console.warn('[runEcommerceNodeGeneration] Prompt optimization failed, fallback to render task prompt.', summarizePromptOptimizationError(error));
      },
    });
    nextPrompt = optimizedNextPrompt;

    const executionNode: PromptNode = {
      ...latestNode,
      prompt: nextPrompt,
      originalPrompt: renderTask?.prompt || latestNode.originalPrompt || latestNode.prompt,
      optimizedPromptEn,
      optimizedPromptZh,
      promptOptimizerResult,
      imageSize: nextImageSize,
      thinkingMode: resolveEffectiveEcommerceThinkingMode(),
      mode: GenerationMode.ECOMMERCE,
      aspectRatio: nextAspectRatio,
      ecommerce: {
        ...latestNode.ecommerce,
        editableTask: renderTask?.taskState
          ? {
              ...renderTask.taskState,
              promptAssistState: promptAssistEnabled
                ? {
                    ...renderTask.taskState.promptAssistState,
                    optimized: true,
                    source: forceRegenerateFeedback
                      ? 'regenerate-feedback'
                      : (promptOptimizerResult ? 'manual' : renderTask.taskState.promptAssistState?.source),
                    updatedAt: promptOptimizerResult ? Date.now() : renderTask.taskState.promptAssistState?.updatedAt,
                    error: promptOptimizerResult ? undefined : renderTask.taskState.promptAssistState?.error,
                  }
                : renderTask.taskState.promptAssistState,
            }
          : latestNode.ecommerce.editableTask,
        displayLabel: renderTask?.displayLabel || latestNode.ecommerce.displayLabel,
        currentAspectRatio: nextAspectRatio,
        activeDeliveryKind,
        stage: 'generating',
        ...options?.stagePatch,
      },
    };

    if (renderTask?.taskState) {
      syncActiveEcommerceTask(node.id, renderTask.taskState);
    }

    await handleRetryNode(executionNode);

    const finalizedNode = activeCanvasRef.current?.promptNodes.find((item) => item.id === node.id) || executionNode;
    const succeeded = !finalizedNode.error && (finalizedNode.childImageIds?.length || 0) > 0;
    updateEcommerceNodeState(node.id, succeeded ? {
      stage: 'generated',
      ...options?.successPatch,
    } : {
      stage: 'failed',
      ...options?.failurePatch,
    });
  }, [
    activeCanvasRef,
    applyEffectiveSizingToTaskState,
    configPrompt,
    ecommerceState.activeTaskNodeId,
    ecommerceState.activeTaskState,
    enablePromptOptimization,
    handleRetryNode,
    resolveEcommerceNodeGenerationSettings,
    resolveEffectiveEcommerceThinkingMode,
    syncActiveEcommerceTask,
    updateEcommerceNodeState,
  ]);

  const handleGenerateEcommerceNode = useCallback(async (node: PromptNode) => {
    if (!node.ecommerce) return;
    if (node.ecommerce.kind === 'main-image') {
      await runEcommerceNodeGeneration(node, {
        generationTarget: 'sheet',
        promptAssistMode: node.ecommerce.stage === 'failed' ? 'disabled' : undefined,
      });
      return;
    }

    if (node.ecommerce.kind === 'a-plus-module') {
      const effectiveSizePolicy = node.ecommerce.effectiveSizePolicy || node.ecommerce.sizePolicy;
      const effectiveSizeTier = node.ecommerce.effectiveSizeTier || node.ecommerce.sizeTier;
      const isDesktopThenMobile = effectiveSizePolicy === 'desktop-then-mobile';
      const desktopPromptSuffix = effectiveSizeTier === '1464x600'
        ? '先生成 1464*600 桌面端母版，保留后续转 600*450 手机端的安全排版空间。'
        : effectiveSizeTier === '600x450'
          ? '先生成可收敛到 600*450 手机端成品的紧凑母版，保持主体与文案一致。'
          : '先生成桌面端 A+ 模块版本。';
      await runEcommerceNodeGeneration(node, {
        generationTarget: isDesktopThenMobile ? 'desktop' : 'sheet',
        promptSuffix: isDesktopThenMobile ? desktopPromptSuffix : undefined,
        stagePatch: isDesktopThenMobile ? { desktopStage: 'generating' } : undefined,
        successPatch: isDesktopThenMobile ? { desktopStage: 'generated', mobileStage: 'locked' } : undefined,
        failurePatch: isDesktopThenMobile ? { desktopStage: 'failed' } : undefined,
        promptAssistMode: (isDesktopThenMobile ? node.ecommerce.desktopStage === 'failed' : node.ecommerce.stage === 'failed')
          ? 'disabled'
          : undefined,
      });
    }
  }, [runEcommerceNodeGeneration]);

  const handleOptimizeEcommerceTaskPrompt = useCallback(async (node: PromptNode) => {
    const latestNode = activeCanvasRef.current?.promptNodes.find((item) => item.id === node.id) || node;
    if (!latestNode.ecommerce || !latestNode.ecommerce.editableTask || !latestNode.ecommerce.seriesTemplate) {
      return;
    }

    const nextGenerationSettings = resolveEcommerceNodeGenerationSettings(latestNode);
    const baseTaskState = ecommerceState.activeTaskNodeId === latestNode.id
      ? (ecommerceState.activeTaskState || latestNode.ecommerce.editableTask)
      : latestNode.ecommerce.editableTask;
    const seriesTemplate = latestNode.ecommerce.seriesTemplate;
    const mergedTaskState = applyEffectiveSizingToTaskState(mergeEcommerceTaskState({
      baseTask: {
        ...baseTaskState,
        assetRoles: baseTaskState.assetRoles,
      },
      seriesTemplate,
      sparseIntent: ecommerceState.activeTaskNodeId === latestNode.id
        ? (String(configPrompt || '').trim() || baseTaskState.sparseUserIntent || '')
        : (baseTaskState.sparseUserIntent || ''),
      productName: latestNode.ecommerce.productImageRef?.label || latestNode.ecommerce.theme || '',
    }));
    const renderTask = buildEcommerceRenderTask({
      taskState: mergedTaskState,
      seriesTemplate,
      aspectRatio: String(nextGenerationSettings.aspectRatio),
      imageSize: String(nextGenerationSettings.imageSize),
    });
    const pendingTaskState: EcommerceEditableTaskState = {
      ...renderTask.taskState,
      promptAssistState: {
        ...renderTask.taskState.promptAssistState,
        optimized: true,
        source: 'manual',
        updatedAt: Date.now(),
        error: undefined,
      },
    };

    updateEcommerceNodeState(latestNode.id, {
      editableTask: pendingTaskState,
      displayLabel: renderTask.displayLabel,
    });
    syncActiveEcommerceTask(latestNode.id, pendingTaskState);

    const {
      optimizedPrompt,
      optimizedPromptEn,
      optimizedPromptZh,
      promptOptimizerResult,
    } = await optimizeGenerationPrompt({
      enabled: true,
      rawPrompt: renderTask.prompt,
      referenceImages: latestNode.referenceImages || [],
      options: {
        preferredModelId: latestNode.model,
        preferredArchetypeId: promptOptimizerArchetype,
        aspectRatio: String(nextGenerationSettings.aspectRatio),
        imageSize: String(nextGenerationSettings.imageSize),
        mode: GenerationMode.ECOMMERCE,
        supportsThinking: !!getModelCapabilities(latestNode.model)?.supportsThinking,
        thinkingMode: resolveEffectiveEcommerceThinkingMode(),
        ecommerceContext: {
          taskState: renderTask.taskState,
          seriesTemplate,
          assetRoles: renderTask.taskState.assetRoles,
          outputTarget: {
            label: renderTask.displayLabel,
            aspectRatio: String(nextGenerationSettings.aspectRatio),
            imageSize: String(nextGenerationSettings.imageSize),
          },
        },
      },
      onError: (error) => {
        console.warn('[handleOptimizeEcommerceTaskPrompt] Prompt optimization failed, fallback to render task prompt.', summarizePromptOptimizationError(error));
      },
    });
    const optimizedSource = promptOptimizerResult?.meta?.engine === 'local-rulebook'
      ? 'local-rulebook'
      : 'manual';
    const optimizedTaskState: EcommerceEditableTaskState = {
      ...renderTask.taskState,
      promptOverride: optimizedPrompt,
      resolvedPromptPreview: optimizedPrompt,
      lastRenderPrompt: optimizedPrompt,
      promptAssistState: {
        optimized: true,
        source: optimizedSource,
        updatedAt: Date.now(),
        error: undefined,
      },
    };

    updatePromptNode({
      ...latestNode,
      prompt: optimizedPrompt,
      originalPrompt: renderTask.prompt,
      optimizedPromptEn,
      optimizedPromptZh,
      promptOptimizerResult,
      ecommerce: {
        ...latestNode.ecommerce,
        editableTask: optimizedTaskState,
        displayLabel: renderTask.displayLabel,
      },
    });
    syncActiveEcommerceTask(latestNode.id, optimizedTaskState);
  }, [
    activeCanvasRef,
    applyEffectiveSizingToTaskState,
    configPrompt,
    ecommerceState.activeTaskNodeId,
    ecommerceState.activeTaskState,
    resolveEffectiveEcommerceThinkingMode,
    resolveEcommerceNodeGenerationSettings,
    syncActiveEcommerceTask,
    updateEcommerceNodeState,
    updatePromptNode,
  ]);

  const handleRegenerateUnsatisfiedEcommerceNode = useCallback(async (node: PromptNode) => {
    if (!node.ecommerce) return;

    if (node.ecommerce.kind === 'main-image') {
      await runEcommerceNodeGeneration(node, {
        generationTarget: 'sheet',
        promptAssistMode: 'regenerate-feedback',
      });
      return;
    }

    if (node.ecommerce.kind !== 'a-plus-module') {
      return;
    }

    const effectiveSizePolicy = node.ecommerce.effectiveSizePolicy || node.ecommerce.sizePolicy;
    const isDesktopThenMobile = effectiveSizePolicy === 'desktop-then-mobile';
    const shouldRegenerateMobile = isDesktopThenMobile && node.ecommerce.desktopStage === 'confirmed';

    await runEcommerceNodeGeneration(node, {
      generationTarget: shouldRegenerateMobile ? 'mobile' : (isDesktopThenMobile ? 'desktop' : 'sheet'),
      stagePatch: shouldRegenerateMobile
        ? { mobileStage: 'generating' }
        : (isDesktopThenMobile ? { desktopStage: 'generating' } : undefined),
      successPatch: shouldRegenerateMobile
        ? { mobileStage: 'generated' }
        : (isDesktopThenMobile ? { desktopStage: 'generated', mobileStage: 'locked' } : undefined),
      failurePatch: shouldRegenerateMobile
        ? { mobileStage: 'failed' }
        : (isDesktopThenMobile ? { desktopStage: 'failed' } : undefined),
      promptSuffix: shouldRegenerateMobile ? aPlusMobilePromptSuffix : undefined,
      promptAssistMode: 'regenerate-feedback',
    });
  }, [runEcommerceNodeGeneration]);

  const handleConfirmEcommerceDesktop = useCallback((node: PromptNode) => {
    if (!node.ecommerce || node.ecommerce.kind !== 'a-plus-module' || node.ecommerce.desktopStage !== 'generated') return;
    updateEcommerceNodeState(node.id, {
      desktopStage: 'confirmed',
      mobileStage: 'pending',
      stage: 'ready',
    });
  }, [updateEcommerceNodeState]);

  const handleRetryEcommerceModule = useCallback(async (node: PromptNode) => {
    if (!node.ecommerce || node.ecommerce.kind !== 'a-plus-module' || node.ecommerce.desktopStage !== 'confirmed') return;
    await runEcommerceNodeGeneration(node, {
      generationTarget: 'mobile',
      stagePatch: { mobileStage: 'generating' },
      successPatch: { mobileStage: 'generated' },
      failurePatch: { mobileStage: 'failed' },
      promptSuffix: aPlusMobilePromptSuffix,
      promptAssistMode: node.ecommerce.mobileStage === 'failed' ? 'disabled' : undefined,
    });
  }, [runEcommerceNodeGeneration]);

  return {
    updateEcommerceNodeState,
    runEcommerceNodeGeneration,
    handleGenerateEcommerceNode,
    handleOptimizeEcommerceTaskPrompt,
    handleRegenerateUnsatisfiedEcommerceNode,
    handleConfirmEcommerceDesktop,
    handleRetryEcommerceModule,
  };
}
