import { useCallback, type RefObject } from 'react';

import { getModelCapabilities } from '../services/model/modelCapabilities.ts';
import { buildEcommerceRenderTask } from '../services/ecommerce/renderTaskBuilder.ts';
import { mergeEcommerceTaskState } from '../services/ecommerce/taskMerger.ts';
import {
  AspectRatio,
  GenerationMode,
  ImageSize,
  type EcommerceEditableTaskState,
  type PromptNode,
} from '../types';
import { optimizeGenerationPrompt, summarizePromptOptimizationError } from './optimizeGenerationPrompt.ts';
import type { ApplyEffectiveSizingToEcommerceTaskState } from './useEcommerceBuildRuntime.ts';
import type { EcommerceNodeGenerationSettings } from './useEcommerceSheetSettingsRuntime.ts';

export interface EcommerceNodeGenerationCanvasSnapshot {
  promptNodes: PromptNode[];
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
  handleConfirmEcommerceDesktop: (node: PromptNode) => void;
  handleRetryEcommerceModule: (node: PromptNode) => Promise<void>;
}

export function useEcommerceNodeGenerationRuntime({
  activeCanvasRef,
  ecommerceState,
  setEcommerceNodeGenerationRuntimeState,
  enablePromptOptimization,
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
    let nextPrompt = [renderTask?.prompt || latestNode.originalPrompt || latestNode.prompt, options?.promptSuffix || ''].filter(Boolean).join('\n');
    const {
      optimizedPrompt: optimizedNextPrompt,
      optimizedPromptEn,
      optimizedPromptZh,
      promptOptimizerResult,
    } = await optimizeGenerationPrompt({
      enabled: enablePromptOptimization && !!nextPrompt,
      rawPrompt: nextPrompt,
      referenceImages: latestNode.referenceImages || [],
      options: {
        preferredModelId: latestNode.model,
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
        editableTask: renderTask?.taskState || latestNode.ecommerce.editableTask,
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
      });
    }
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
      promptSuffix: '将这个 A+ 画面转换成 600*450 手机端版本，排版更紧凑，保持主体、文案、风格与画面逻辑一致。',
    });
  }, [runEcommerceNodeGeneration]);

  return {
    updateEcommerceNodeState,
    runEcommerceNodeGeneration,
    handleGenerateEcommerceNode,
    handleConfirmEcommerceDesktop,
    handleRetryEcommerceModule,
  };
}
