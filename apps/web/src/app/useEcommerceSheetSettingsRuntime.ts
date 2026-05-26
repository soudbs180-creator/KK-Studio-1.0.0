import { startTransition, useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';

import { resolveEffectiveEcommerceAPlusPolicy, resolvePreferredEcommerceImageSize, normalizeEcommerceModelId } from '../services/ecommerce/ecommerceModelPolicy.ts';
import { buildEcommerceRenderTask } from '../services/ecommerce/renderTaskBuilder.ts';
import {
  AspectRatio,
  GenerationMode,
  ImageSize,
  type EcommerceAPlusControlMode,
  type EcommerceEditableTaskState,
  type EcommerceGroupSheet,
  type EcommerceSheetSetting,
  type EcommerceSheetSettingPatch,
  type GenerationConfig,
  type PromptNode,
} from '../types';

export interface EcommerceSheetSettingsCanvasSnapshot {
  promptNodes: PromptNode[];
}

export interface EcommerceSheetSettingsState {
  sheetSettings: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
  taskStates: Record<string, EcommerceEditableTaskState>;
  activeTaskState: EcommerceEditableTaskState | null;
}

export type SetEcommerceSheetSettingsState = (
  updater: (previousState: EcommerceSheetSettingsState) => Partial<EcommerceSheetSettingsState> | null
) => void;

export type UpdateEcommercePromptNode = (node: PromptNode) => void | Promise<void>;

export interface EcommerceNodeGenerationSettings {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
}

export interface UseEcommerceSheetSettingsRuntimeDeps {
  activeCanvasRef: RefObject<EcommerceSheetSettingsCanvasSnapshot | null | undefined>;
  configMode: GenerationConfig['mode'];
  configModel: GenerationConfig['model'];
  ecommerceState: EcommerceSheetSettingsState;
  setConfig: Dispatch<SetStateAction<GenerationConfig>>;
  setEcommerceSheetSettingsState: SetEcommerceSheetSettingsState;
  updatePromptNode: UpdateEcommercePromptNode;
}

export interface UseEcommerceSheetSettingsRuntimeResult {
  resolveEcommerceAPlusControlMode: (sheetSetting?: EcommerceSheetSetting) => EcommerceAPlusControlMode;
  applyEffectiveSizingToTaskState: (
    taskState: EcommerceEditableTaskState,
    options?: { controlMode?: EcommerceAPlusControlMode }
  ) => EcommerceEditableTaskState;
  resolveEcommerceNodeGenerationSettings: (
    node: PromptNode,
    generationTarget?: 'sheet' | 'desktop' | 'mobile'
  ) => EcommerceNodeGenerationSettings;
  handleUpdateEcommerceSheetSetting: (sheet: EcommerceGroupSheet, patch: EcommerceSheetSettingPatch) => void;
}

export function createDefaultEcommerceSheetSettings(modelId: string): Record<EcommerceGroupSheet, EcommerceSheetSetting> {
  const preferredImageSize = resolvePreferredEcommerceImageSize(normalizeEcommerceModelId(modelId) || modelId) as ImageSize;

  return {
    '主图': {
      aspectRatio: AspectRatio.AUTO,
      imageSize: preferredImageSize,
    },
    'A+': {
      aspectRatio: AspectRatio.LANDSCAPE_16_9,
      imageSize: ImageSize.SIZE_4K,
      aPlusControlMode: 'auto',
    },
  };
}

export function resolveEcommerceAPlusControlModeValue(sheetSetting?: EcommerceSheetSetting): EcommerceAPlusControlMode {
  return sheetSetting?.aPlusControlMode || 'auto';
}

export function applyEffectiveSizingToEcommerceTaskState(input: {
  taskState: EcommerceEditableTaskState;
  sheetSettings?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
  modelId: string;
  controlMode?: EcommerceAPlusControlMode;
}): EcommerceEditableTaskState {
  const { taskState } = input;
  if (taskState.sourceSheet !== 'A+' || taskState.sourceKind !== 'a-plus-module') {
    return {
      ...taskState,
      effectiveSizePolicy: taskState.effectiveSizePolicy,
      effectiveSizeTier: taskState.effectiveSizeTier || taskState.sizeTier,
    };
  }

  const activeSheetSetting = input.sheetSettings?.['A+'] || createDefaultEcommerceSheetSettings(input.modelId)['A+'];
  const effectivePolicy = resolveEffectiveEcommerceAPlusPolicy({
    detectedSizeTier: taskState.sizeTier,
    controlMode: taskState.sizeControlOverride ?? input.controlMode ?? resolveEcommerceAPlusControlModeValue(activeSheetSetting),
  });

  return {
    ...taskState,
    effectiveSizePolicy: effectivePolicy.effectiveSizePolicy,
    effectiveSizeTier: effectivePolicy.effectiveSizeTier,
  };
}

export function resolveEcommerceNodeGenerationSettingsForSheet(input: {
  node: PromptNode;
  sheetSettings?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
  generationTarget?: 'sheet' | 'desktop' | 'mobile';
}): EcommerceNodeGenerationSettings {
  const { node } = input;
  const fallbackSheetSettings = createDefaultEcommerceSheetSettings(node.model);
  const sheetSettings = node.ecommerce
    ? (input.sheetSettings?.[node.ecommerce.sourceSheet] || fallbackSheetSettings[node.ecommerce.sourceSheet])
    : fallbackSheetSettings['主图'];

  if (!node.ecommerce) {
    return {
      aspectRatio: node.aspectRatio || sheetSettings.aspectRatio,
      imageSize: node.imageSize || sheetSettings.imageSize,
    };
  }

  if (input.generationTarget === 'mobile') {
    return {
      aspectRatio: (node.ecommerce.mobileAspectRatio || AspectRatio.LANDSCAPE_4_3) as AspectRatio,
      imageSize: sheetSettings.imageSize,
    };
  }

  const effectiveSizePolicy = node.ecommerce.effectiveSizePolicy || node.ecommerce.sizePolicy;

  if (node.ecommerce.kind === 'a-plus-module' && effectiveSizePolicy === 'desktop-then-mobile') {
    return {
      aspectRatio: (node.ecommerce.desktopAspectRatio || node.ecommerce.currentAspectRatio || node.aspectRatio || AspectRatio.LANDSCAPE_21_9) as AspectRatio,
      imageSize: sheetSettings.imageSize,
    };
  }

  return {
    aspectRatio: (
      node.ecommerce.kind === 'a-plus-module'
        ? (node.ecommerce.currentAspectRatio || node.aspectRatio || AspectRatio.LANDSCAPE_16_9)
        : (sheetSettings.aspectRatio || node.ecommerce.currentAspectRatio || node.aspectRatio || AspectRatio.SQUARE)
    ) as AspectRatio,
    imageSize: sheetSettings.imageSize || node.imageSize || (resolvePreferredEcommerceImageSize(node.model) as ImageSize),
  };
}

export function resolveNextEcommerceSheetSetting(input: {
  sheet: EcommerceGroupSheet;
  patch: EcommerceSheetSettingPatch;
  sheetSettings?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
  modelId: string;
}): EcommerceSheetSetting | null {
  const previousSetting = input.sheetSettings?.[input.sheet] || createDefaultEcommerceSheetSettings(input.modelId)[input.sheet];
  const mergedSetting: EcommerceSheetSetting = {
    ...previousSetting,
    ...input.patch,
  };
  const nextSetting: EcommerceSheetSetting = input.sheet === 'A+'
    ? { ...mergedSetting, imageSize: ImageSize.SIZE_4K }
    : mergedSetting;

  if (
    previousSetting.aspectRatio === nextSetting.aspectRatio
    && previousSetting.imageSize === nextSetting.imageSize
    && previousSetting.aPlusControlMode === nextSetting.aPlusControlMode
  ) {
    return null;
  }

  return nextSetting;
}

export function useEcommerceSheetSettingsRuntime({
  activeCanvasRef,
  configMode,
  configModel,
  ecommerceState,
  setConfig,
  setEcommerceSheetSettingsState,
  updatePromptNode,
}: UseEcommerceSheetSettingsRuntimeDeps): UseEcommerceSheetSettingsRuntimeResult {
  const resolveEcommerceAPlusControlMode = useCallback(resolveEcommerceAPlusControlModeValue, []);

  const applyEffectiveSizingToTaskState = useCallback((
    taskState: EcommerceEditableTaskState,
    options?: { controlMode?: EcommerceAPlusControlMode },
  ): EcommerceEditableTaskState => (
    applyEffectiveSizingToEcommerceTaskState({
      taskState,
      sheetSettings: ecommerceState.sheetSettings,
      modelId: configModel,
      controlMode: options?.controlMode,
    })
  ), [configModel, ecommerceState.sheetSettings]);

  const resolveEcommerceNodeGenerationSettings = useCallback((
    node: PromptNode,
    generationTarget?: 'sheet' | 'desktop' | 'mobile',
  ): EcommerceNodeGenerationSettings => (
    resolveEcommerceNodeGenerationSettingsForSheet({
      node,
      sheetSettings: ecommerceState.sheetSettings,
      generationTarget,
    })
  ), [ecommerceState.sheetSettings]);

  const handleUpdateEcommerceSheetSetting = useCallback((
    sheet: EcommerceGroupSheet,
    patch: EcommerceSheetSettingPatch,
  ) => {
    const nextSetting = resolveNextEcommerceSheetSetting({
      sheet,
      patch,
      sheetSettings: ecommerceState.sheetSettings,
      modelId: configModel,
    });
    if (!nextSetting) {
      return;
    }

    setEcommerceSheetSettingsState((previousState) => {
      const nextTaskStates = Object.fromEntries(
        Object.entries(previousState.taskStates || {}).map(([rowKey, taskState]) => [
          rowKey,
          taskState && taskState.sourceSheet === sheet
            ? applyEffectiveSizingToTaskState(taskState, { controlMode: nextSetting.aPlusControlMode })
            : taskState,
        ]),
      ) as Record<string, EcommerceEditableTaskState>;

      const nextActiveTaskState = previousState.activeTaskState && previousState.activeTaskState.sourceSheet === sheet
        ? applyEffectiveSizingToTaskState(previousState.activeTaskState, { controlMode: nextSetting.aPlusControlMode })
        : previousState.activeTaskState;

      return {
        taskStates: nextTaskStates,
        activeTaskState: nextActiveTaskState,
        sheetSettings: {
          ...(previousState.sheetSettings || {}),
          [sheet]: nextSetting,
        },
      };
    });

    if (configMode === GenerationMode.ECOMMERCE) {
      setConfig((previousConfig) => ({
        ...previousConfig,
        aspectRatio: sheet !== 'A+' ? nextSetting.aspectRatio : previousConfig.aspectRatio,
        imageSize: nextSetting.imageSize,
        thinkingMode: 'high',
      }));
    }

    startTransition(() => {
      const promptNodes = activeCanvasRef.current?.promptNodes || [];
      promptNodes
        .filter((node) => (
          node.mode === GenerationMode.ECOMMERCE
          && node.ecommerce?.sourceSheet === sheet
          && node.ecommerce.kind !== 'a-plus-group'
        ))
        .forEach((node) => {
          if (!node.ecommerce) {
            return;
          }

          const effectivePolicy = node.ecommerce.kind === 'a-plus-module'
            ? resolveEffectiveEcommerceAPlusPolicy({
                detectedSizeTier: node.ecommerce.sizeTier,
                controlMode: node.ecommerce.sizeControlOverride ?? nextSetting.aPlusControlMode,
              })
            : null;
          const nextNodeAspectRatio = node.ecommerce.sourceSheet === 'A+'
            ? (effectivePolicy?.runtimeAspectRatio || node.ecommerce.currentAspectRatio || node.aspectRatio)
            : nextSetting.aspectRatio;
          const nextNodeImageSize = nextSetting.imageSize;
          const nextEffectiveSizePolicy = effectivePolicy?.effectiveSizePolicy || node.ecommerce.sizePolicy;
          const nextTaskState = node.ecommerce.editableTask
            ? applyEffectiveSizingToTaskState(node.ecommerce.editableTask, { controlMode: nextSetting.aPlusControlMode })
            : node.ecommerce.editableTask;
          const nextRenderTask = nextTaskState && node.ecommerce.seriesTemplate
            ? buildEcommerceRenderTask({
                taskState: nextTaskState,
                seriesTemplate: node.ecommerce.seriesTemplate,
                aspectRatio: String(nextNodeAspectRatio),
                imageSize: String(nextNodeImageSize),
                productName: node.ecommerce.productImageRef?.label || node.ecommerce.theme || '',
              })
            : null;

          void updatePromptNode({
            ...node,
            prompt: nextRenderTask?.prompt || node.prompt,
            originalPrompt: nextRenderTask?.prompt || node.originalPrompt,
            aspectRatio: nextNodeAspectRatio as AspectRatio,
            imageSize: nextNodeImageSize,
            ecommerce: {
              ...node.ecommerce,
              aPlusControlMode: node.ecommerce.sourceSheet === 'A+' ? resolveEcommerceAPlusControlMode(nextSetting) : node.ecommerce.aPlusControlMode,
              currentAspectRatio: nextNodeAspectRatio as AspectRatio,
              sizePolicy: nextEffectiveSizePolicy,
              effectiveSizePolicy: effectivePolicy?.effectiveSizePolicy || node.ecommerce.effectiveSizePolicy,
              effectiveSizeTier: effectivePolicy?.effectiveSizeTier || node.ecommerce.effectiveSizeTier,
              allowedAspectRatios: (effectivePolicy?.allowedAspectRatios || node.ecommerce.allowedAspectRatios) as AspectRatio[] | undefined,
              activeDeliveryKind: nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? (node.ecommerce.activeDeliveryKind === 'mobile' ? 'mobile' : 'desktop')
                : 'default',
              desktopStage: nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? node.ecommerce.desktopStage
                : 'not_applicable',
              mobileStage: nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? node.ecommerce.mobileStage
                : 'not_applicable',
              desktopAspectRatio: node.ecommerce.kind === 'a-plus-module' && nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? nextNodeAspectRatio as AspectRatio
                : undefined,
              mobileAspectRatio: nextEffectiveSizePolicy === 'desktop-then-mobile'
                ? ((effectivePolicy?.mobileAspectRatio || node.ecommerce.mobileAspectRatio) as AspectRatio | undefined)
                : undefined,
              editableTask: nextRenderTask?.taskState || nextTaskState,
              displayLabel: nextRenderTask?.displayLabel || node.ecommerce.displayLabel,
            },
          });
        });
    });
  }, [
    activeCanvasRef,
    applyEffectiveSizingToTaskState,
    configMode,
    configModel,
    ecommerceState.sheetSettings,
    resolveEcommerceAPlusControlMode,
    setConfig,
    setEcommerceSheetSettingsState,
    updatePromptNode,
  ]);

  return {
    resolveEcommerceAPlusControlMode,
    applyEffectiveSizingToTaskState,
    resolveEcommerceNodeGenerationSettings,
    handleUpdateEcommerceSheetSetting,
  };
}
