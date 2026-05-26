import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { resolveEcommercePromptNodeMetadata } from '../services/ecommerce/ecommercePromptNodeMetadata.ts';
import {
  normalizeEcommerceModelId,
  resolveEcommerceAspectPolicy,
  resolveEffectiveEcommerceAPlusPolicy,
} from '../services/ecommerce/ecommerceModelPolicy.ts';
import type {
  EcommerceAnalysisAPlusModule,
  EcommerceAnalysisAsset,
  EcommerceAnalysisMainImageItem,
  EcommerceAnalysisResult,
} from '../services/ecommerce/types';
import { buildEcommerceRenderTask } from '../services/ecommerce/renderTaskBuilder.ts';
import { buildEcommerceCanvasGroupLayout } from '../services/ecommerce/groupCanvasLayout.ts';
import { buildEcommerceAssetRoleBindings } from '../services/ecommerce/assetRoleBindings.ts';
import { buildInitialEcommerceGroupSlotState, type EcommerceGroupSlotState } from '../services/ecommerce/groupSlotState.ts';
import { mergeEcommerceTaskState } from '../services/ecommerce/taskMerger.ts';
import { localizeUserFacingText, pickByDocumentLanguage } from '../utils/localeText.ts';
import {
  createDefaultEcommerceFrameworkSchedulerConfig,
  createEcommerceFrameworkRuntimeState,
} from '../services/ecommerce/frameworkRuntime.ts';
import {
  AspectRatio,
  GenerationMode,
  ImageSize,
  type EcommerceAPlusControlMode,
  type EcommerceEditableTaskState,
  type EcommerceFrameworkRuntimeState,
  type EcommerceGroupSheet,
  type EcommerceSheetSetting,
  type EcommerceTaskAssetRoleBinding,
  type GenerationConfig,
  type PromptNode,
  type ReferenceImage,
} from '../types';
import { createDefaultEcommerceSheetSettings } from './useEcommerceSheetSettingsRuntime.ts';
import type {
  EcommerceManualReferenceBinding,
  EcommerceUploadReferenceBundle,
} from './useEcommerceUploadReferenceRuntime.ts';

export interface EcommerceBuildRuntimeState {
  requirementFile: File | null;
  productFiles: File[];
  extraReferenceFiles: File[];
  itemReferenceFiles: Record<string, EcommerceManualReferenceBinding[]>;
  analysis: EcommerceAnalysisResult | null;
  analysisConfirmed: boolean;
  selectedItems: Record<string, boolean>;
  taskStates: Record<string, EcommerceEditableTaskState>;
  sheetSettings: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
  groupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
  activeFrameworkId: string | null;
  activeGroupSheet: EcommerceGroupSheet | null;
  frameworkRuntime: Record<string, EcommerceFrameworkRuntimeState>;
  isConfirmingAnalysis: boolean;
}

export type SetEcommerceBuildRuntimeState = (
  updater: (previousState: EcommerceBuildRuntimeState) => Partial<EcommerceBuildRuntimeState> | null
) => void;

export type AddEcommercePromptNode = (node: PromptNode) => Promise<void>;
export type UpdateEcommercePromptNode = (node: PromptNode) => Promise<void> | void;
export type CreateEcommerceEphemeralId = (prefix: string) => string;
export type FindNextEcommerceGroupPosition = () => { x: number; y: number };
export type ApplyEffectiveSizingToEcommerceTaskState = (
  taskState: EcommerceEditableTaskState,
  options?: { controlMode?: EcommerceAPlusControlMode }
) => EcommerceEditableTaskState;

export interface UseEcommerceBuildRuntimeDeps {
  ecommerceState: EcommerceBuildRuntimeState;
  configModel: GenerationConfig['model'];
  configPrompt: GenerationConfig['prompt'];
  setConfig: Dispatch<SetStateAction<GenerationConfig>>;
  setEcommerceBuildRuntimeState: SetEcommerceBuildRuntimeState;
  addPromptNode: AddEcommercePromptNode;
  updatePromptNode: UpdateEcommercePromptNode;
  bringNodesToFront: (nodeIds: string[]) => void;
  findNextGroupPosition: FindNextEcommerceGroupPosition;
  createEphemeralId: CreateEcommerceEphemeralId;
  buildCurrentEcommerceUploadReferences: () => Promise<EcommerceUploadReferenceBundle>;
  createReferenceImageFromAsset: (asset: EcommerceAnalysisAsset) => ReferenceImage | null;
  extractEcommerceManualReferenceBindings: (
    taskState?: EcommerceEditableTaskState | null
  ) => EcommerceManualReferenceBinding[];
  applyEffectiveSizingToTaskState: ApplyEffectiveSizingToEcommerceTaskState;
  resolveEcommerceAPlusControlMode: (sheetSetting?: EcommerceSheetSetting) => EcommerceAPlusControlMode;
}

export interface UseEcommerceBuildRuntimeResult {
  handleConfirmEcommerceAnalysis: () => Promise<void>;
}

async function notifyBuildSuccess(count: number): Promise<void> {
  const { notify } = await import('../services/system/notificationService');
  notify.success(
    pickByDocumentLanguage('建卡完成', 'Build complete'),
    pickByDocumentLanguage(`已创建 ${count} 张电商卡片。`, `Created ${count} ecommerce cards.`),
  );
}

async function notifyBuildFailure(error: unknown): Promise<void> {
  const { notify } = await import('../services/system/notificationService');
  notify.error(
    pickByDocumentLanguage('建卡失败', 'Build failed'),
    error instanceof Error
      ? (localizeUserFacingText(error.message) || error.message)
      : pickByDocumentLanguage('请稍后重试。', 'Please try again later.'),
  );
}

function reportBuildSuccess(count: number): void {
  void notifyBuildSuccess(count).catch(() => undefined);
}

async function reportBuildFailure(error: unknown): Promise<void> {
  try {
    await notifyBuildFailure(error);
  } catch {
    // Notification delivery should not change the build runtime state.
  }
}

function createBuildResetGroupSlots(): Record<EcommerceGroupSheet, EcommerceGroupSlotState[]> {
  return {
    '主图': [],
    'A+': [],
  };
}

function buildRuntimeEcommerceAssetRoles(params: {
  rowAssets: EcommerceAnalysisAsset[];
  rowMentions: Array<{ assetId: string; label: string; mentionTokens: string[]; notes?: string }>;
  manualReferences: EcommerceManualReferenceBinding[];
  productReferences: ReferenceImage[];
  extraReferences: ReferenceImage[];
}): EcommerceTaskAssetRoleBinding[] {
  return buildEcommerceAssetRoleBindings({
    rowAssets: params.rowAssets,
    rowMentions: params.rowMentions,
    manualReferences: params.manualReferences,
    productReferences: params.productReferences,
    extraReferences: params.extraReferences,
  });
}

export function useEcommerceBuildRuntime({
  ecommerceState,
  configModel,
  configPrompt,
  setConfig,
  setEcommerceBuildRuntimeState,
  addPromptNode,
  updatePromptNode,
  bringNodesToFront,
  findNextGroupPosition,
  createEphemeralId,
  buildCurrentEcommerceUploadReferences,
  createReferenceImageFromAsset,
  extractEcommerceManualReferenceBindings,
  applyEffectiveSizingToTaskState,
  resolveEcommerceAPlusControlMode,
}: UseEcommerceBuildRuntimeDeps): UseEcommerceBuildRuntimeResult {
  const buildEcommerceFrameworkNode = useCallback((
    analysis: EcommerceAnalysisResult,
    position: { x: number; y: number },
  ): PromptNode => {
    const productName = analysis.projectMeta.productName;
    const label = pickByDocumentLanguage(
      `${productName || '电商'} 框架`,
      `${productName || 'Ecommerce'} Framework`,
    );
    const schedulerConfig = createDefaultEcommerceFrameworkSchedulerConfig();
    const sharedInputSummary = [
      analysis.projectMeta.projectName || label,
      analysis.projectMeta.productName ? `产品：${analysis.projectMeta.productName}` : '',
      ecommerceState.requirementFile?.name ? `需求文档：${ecommerceState.requirementFile.name}` : '',
      ecommerceState.productFiles.length > 0 ? `产品图：${ecommerceState.productFiles.length}` : '',
      ecommerceState.extraReferenceFiles.length > 0 ? `参考图：${ecommerceState.extraReferenceFiles.length}` : '',
      String(configPrompt || '').trim() ? `补充要求：${String(configPrompt || '').trim()}` : '',
    ].filter(Boolean);
    const summary = [
      analysis.projectMeta.projectName || label,
      analysis.projectMeta.productName ? `产品：${analysis.projectMeta.productName}` : '',
      '主图',
      ...(analysis.mainImageItems || []).map((item, index) => {
        const selected = ecommerceState.selectedItems[item.itemId] !== false ? '保留' : '跳过';
        return `${index + 1}. [${selected}] ${item.theme || item.type}${item.designRequirements ? ` - ${item.designRequirements}` : ''}`;
      }),
      'A+',
      ...(analysis.aPlusGroup?.modules || []).map((item, index) => {
        const selected = ecommerceState.selectedItems[item.moduleId] !== false ? '保留' : '跳过';
        return `${index + 1}. [${selected}] ${item.moduleName}${item.designRequirements ? ` - ${item.designRequirements}` : ''}`;
      }),
    ].filter(Boolean).join('\n');

    return {
      id: createEphemeralId('ecom-framework'),
      prompt: summary,
      originalPrompt: summary,
      position,
      aspectRatio: AspectRatio.LANDSCAPE_16_9,
      imageSize: ImageSize.SIZE_1K,
      model: normalizeEcommerceModelId(configModel) || 'gemini-3.1-flash-image-preview',
      childImageIds: [],
      timestamp: Date.now(),
      mode: GenerationMode.ECOMMERCE,
      parallelCount: 1,
      thinkingMode: 'high',
      referenceImages: [],
      ecommerce: {
        kind: 'framework',
        sourceSheet: '主图',
        sourceRowKey: 'framework-root',
        selectedForGeneration: false,
        stage: 'ready',
        theme: label,
        displayLabel: label,
        desktopStage: 'not_applicable',
        mobileStage: 'not_applicable',
        allowedAspectRatios: [AspectRatio.LANDSCAPE_16_9],
        currentAspectRatio: AspectRatio.LANDSCAPE_16_9,
        frameworkMeta: {
          activeSheet: '主图',
          groupIds: {},
          taskNodeIds: [],
          inputSummary: sharedInputSummary,
          schedulerConfig,
        },
      },
    };
  }, [configModel, configPrompt, createEphemeralId, ecommerceState.extraReferenceFiles.length, ecommerceState.productFiles.length, ecommerceState.requirementFile?.name, ecommerceState.selectedItems]);

  const buildEcommerceGroupNode = useCallback((
    productName: string,
    sourceSheet: '主图' | 'A+',
    position: { x: number; y: number },
    frameworkId?: string,
  ): PromptNode => {
    const sheetSetting = ecommerceState.sheetSettings[sourceSheet] || createDefaultEcommerceSheetSettings(configModel)[sourceSheet];

    return {
      id: createEphemeralId(sourceSheet === '主图' ? 'ecom-main-group' : 'ecom-group'),
      prompt: `${productName || '电商'} ${sourceSheet}组卡`,
      originalPrompt: `${productName || '电商'} ${sourceSheet}组卡`,
      position,
      aspectRatio: sheetSetting.aspectRatio,
      imageSize: sheetSetting.imageSize,
      model: normalizeEcommerceModelId(configModel) || 'gemini-3.1-flash-image-preview',
      childImageIds: [],
      timestamp: Date.now(),
      mode: GenerationMode.ECOMMERCE,
      hiddenInCanvas: Boolean(frameworkId),
      parallelCount: 1,
      thinkingMode: 'high',
      ecommerce: {
        kind: 'a-plus-group',
        sourceSheet,
        sourceRowKey: sourceSheet === '主图' ? 'main-group' : 'aplus-group',
        frameworkId,
        parentNodeId: frameworkId,
        selectedForGeneration: false,
        stage: 'analysis_ready',
        theme: `${productName || '电商'} ${sourceSheet}组卡`,
        sizePolicy: 'sheet-native',
        allowedAspectRatios: [sheetSetting.aspectRatio],
        currentAspectRatio: sheetSetting.aspectRatio,
        desktopStage: 'pending',
        mobileStage: 'locked',
      },
    };
  }, [configModel, createEphemeralId, ecommerceState.sheetSettings]);

  const buildEcommercePromptNode = useCallback(async (params: ({
    item: EcommerceAnalysisMainImageItem;
    kind: 'main-image';
    position: { x: number; y: number };
    groupId?: string;
    frameworkId?: string;
    selected: boolean;
    analysis: EcommerceAnalysisResult;
    uploadReferences?: EcommerceUploadReferenceBundle;
  } | {
    item: EcommerceAnalysisAPlusModule;
    kind: 'a-plus-module';
    position: { x: number; y: number };
    groupId?: string;
    frameworkId?: string;
    selected: boolean;
    analysis: EcommerceAnalysisResult;
    uploadReferences?: EcommerceUploadReferenceBundle;
  })): Promise<PromptNode> => {
    const modelId = normalizeEcommerceModelId(configModel) || 'gemini-3.1-flash-image-preview';
    const policy = resolveEcommerceAspectPolicy({
      kind: params.kind,
      modelId,
      declaredDimensions: 'declaredSizeText' in params.item ? params.item.declaredSizeText : undefined,
      designRequirements: params.item.designRequirements,
      copyText: params.item.copyText,
    });
    const referenceAssetIds = params.item.referenceAssetIds || [];
    const referenceMentions = params.item.referenceMentions || [];
    const rowAssets = (params.analysis.assets?.referenceAssets || []).filter((asset) => referenceAssetIds.includes(asset.assetId));
    const {
      productReferences,
      extraReferences,
      productImageRef,
    } = params.uploadReferences || await buildCurrentEcommerceUploadReferences();
    const rowReferences = rowAssets.map(createReferenceImageFromAsset).filter((item): item is ReferenceImage => Boolean(item));
    const sourceMetadata = params.kind === 'main-image'
      ? resolveEcommercePromptNodeMetadata({
          kind: 'main-image',
          item: params.item,
        })
      : resolveEcommercePromptNodeMetadata({
          kind: 'a-plus-module',
          item: params.item,
        });
    const sourceKey = params.kind === 'main-image' ? params.item.itemId : params.item.moduleId;
    const sheetSetting = ecommerceState.sheetSettings[sourceMetadata.sourceSheet]
      || createDefaultEcommerceSheetSettings(modelId)[sourceMetadata.sourceSheet];
    const aPlusEffectivePolicy = params.kind === 'a-plus-module'
      ? resolveEffectiveEcommerceAPlusPolicy({
          detectedSizeTier: policy.sizeTier,
          controlMode: resolveEcommerceAPlusControlMode(sheetSetting),
        })
      : null;
    const resolvedNodeAspectRatio = (sourceMetadata.sourceSheet === 'A+'
      ? (aPlusEffectivePolicy?.runtimeAspectRatio || policy.defaultAspectRatio)
      : sheetSetting.aspectRatio) as AspectRatio;
    const taskStateSeed = ecommerceState.taskStates[sourceKey]
      || params.item.editableTask;
    const taskManualReferences = extractEcommerceManualReferenceBindings(taskStateSeed);
    const referenceImages = [...rowReferences, ...taskManualReferences.map((reference) => reference.referenceImage), ...productReferences, ...extraReferences];
    const runtimeAssetRoles = buildRuntimeEcommerceAssetRoles({
      rowAssets,
      rowMentions: referenceMentions,
      manualReferences: taskManualReferences,
      productReferences,
      extraReferences,
    });
    const mergedTaskState = applyEffectiveSizingToTaskState(mergeEcommerceTaskState({
      baseTask: {
        ...(taskStateSeed || {
          taskId: `task-${sourceMetadata.sourceRowKey}`,
          templateId: params.analysis.seriesTemplate.templateId,
          sourceKind: params.kind,
          sourceSheet: sourceMetadata.sourceSheet,
          sourceRowKey: sourceMetadata.sourceRowKey,
          declaredSizeText: 'declaredSizeText' in params.item ? params.item.declaredSizeText : undefined,
          sizeTier: policy.sizeTier,
          effectiveSizePolicy: aPlusEffectivePolicy?.effectiveSizePolicy,
          effectiveSizeTier: aPlusEffectivePolicy?.effectiveSizeTier,
          sizeControlOverride: null,
          theme: sourceMetadata.theme,
          outputTypeLabel: params.kind === 'main-image' ? '主图' : 'A+',
          imageRoleSummary: runtimeAssetRoles.map((item) => item.normalizedLabel),
          sparseUserIntent: '',
          copy: { headline: '', subheadline: '', highlight: '', featureTags: [], cta: '' },
          style: { tone: '', atmosphere: '', effect: '', backgroundType: '' },
          layout: { productSize: 'balanced', textPosition: 'top-left', accessoryPolicy: 'auto' },
          inherit: {
            keepSeriesStyle: true,
            keepFontStyle: true,
            keepLayoutStyle: true,
            keepCopyStyle: true,
            keepPalette: true,
          },
          assetRoles: runtimeAssetRoles,
          consistencyChecks: [],
          missingFields: [],
          resolvedPromptPreview: '',
          displayLabel: '',
          promptOverride: '',
        }),
        assetRoles: runtimeAssetRoles,
      },
      seriesTemplate: params.analysis.seriesTemplate,
      sparseIntent: String(configPrompt || '').trim() || taskStateSeed?.sparseUserIntent || '',
      productName: params.analysis.projectMeta.productName,
    }), {
      controlMode: resolveEcommerceAPlusControlMode(sheetSetting),
    });
    const renderTask = buildEcommerceRenderTask({
      taskState: mergedTaskState,
      seriesTemplate: params.analysis.seriesTemplate,
      aspectRatio: resolvedNodeAspectRatio,
      imageSize: sheetSetting.imageSize,
    });

    return {
      id: createEphemeralId(params.kind === 'main-image' ? 'ecom-main' : 'ecom-module'),
      prompt: renderTask.prompt,
      originalPrompt: renderTask.prompt,
      position: params.position,
      aspectRatio: resolvedNodeAspectRatio,
      imageSize: sheetSetting.imageSize,
      model: modelId,
      childImageIds: [],
      referenceImages,
      timestamp: Date.now(),
      mode: GenerationMode.ECOMMERCE,
      hiddenInCanvas: Boolean(params.frameworkId),
      parallelCount: 1,
      thinkingMode: 'high',
      ecommerce: {
        kind: params.kind,
        sourceSheet: sourceMetadata.sourceSheet,
        sourceRowKey: sourceMetadata.sourceRowKey,
        groupId: params.groupId,
        frameworkId: params.frameworkId,
        parentNodeId: params.groupId || params.frameworkId,
        selectedForGeneration: params.selected,
        productImageRef,
        referenceBindings: referenceMentions,
        copyText: params.item.copyText,
        designRequirements: params.item.designRequirements,
        theme: sourceMetadata.theme,
        sizePolicy: aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy,
        sizeTier: policy.sizeTier,
        effectiveSizePolicy: aPlusEffectivePolicy?.effectiveSizePolicy,
        effectiveSizeTier: aPlusEffectivePolicy?.effectiveSizeTier,
        allowedAspectRatios: (aPlusEffectivePolicy?.allowedAspectRatios || policy.allowedAspectRatios) as AspectRatio[],
        currentAspectRatio: resolvedNodeAspectRatio,
        activeDeliveryKind: (aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy) === 'desktop-then-mobile' ? 'desktop' : 'default',
        aPlusControlMode: resolveEcommerceAPlusControlMode(sheetSetting),
        sizeControlOverride: mergedTaskState.sizeControlOverride ?? null,
        stage: 'analysis_ready',
        desktopStage: (aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy) === 'desktop-then-mobile' ? 'pending' : 'not_applicable',
        mobileStage: (aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy) === 'desktop-then-mobile' ? 'locked' : 'not_applicable',
        declaredSizeText: 'declaredSizeText' in params.item ? params.item.declaredSizeText : undefined,
        desktopAspectRatio: (aPlusEffectivePolicy?.effectiveSizePolicy || policy.sizePolicy) === 'desktop-then-mobile' ? resolvedNodeAspectRatio : undefined,
        mobileAspectRatio: (aPlusEffectivePolicy?.mobileAspectRatio || policy.mobileAspectRatio) as AspectRatio | undefined,
        needsReview: params.item.needsReview,
        reviewWarnings: params.item.reviewWarnings || [],
        seriesTemplate: params.analysis.seriesTemplate,
        editableTask: renderTask.taskState,
        displayLabel: renderTask.displayLabel,
      },
    };
  }, [
    buildCurrentEcommerceUploadReferences,
    configModel,
    configPrompt,
    createEphemeralId,
    createReferenceImageFromAsset,
    ecommerceState.sheetSettings,
    ecommerceState.taskStates,
    extractEcommerceManualReferenceBindings,
    applyEffectiveSizingToTaskState,
    resolveEcommerceAPlusControlMode,
  ]);

  const handleConfirmEcommerceAnalysis = useCallback(async (): Promise<void> => {
    if (!ecommerceState.analysis || ecommerceState.isConfirmingAnalysis) return;
    setEcommerceBuildRuntimeState(() => ({
      isConfirmingAnalysis: true,
    }));

    try {
      const analysis = ecommerceState.analysis;
      if (!analysis) {
        return;
      }

      const currentUploadReferences = await buildCurrentEcommerceUploadReferences();
      const basePosition = findNextGroupPosition();
      const createdNodeIds: string[] = [];
      const taskNodeIds: string[] = [];
      const mainImageItems = analysis.mainImageItems || [];
      const aPlusModules = analysis.aPlusGroup?.modules || [];
      const layoutPlan = buildEcommerceCanvasGroupLayout({
        basePosition,
        mainSlotKeys: mainImageItems.map((item) => item.itemId),
        aPlusSlotKeys: aPlusModules.map((item) => item.moduleId),
      });
      const mainSlotPositionByKey = new Map(
        layoutPlan.mainGroup.slots.map((slot) => [slot.sourceKey, slot.position] as const),
      );
      const aPlusSlotPositionByKey = new Map(
        layoutPlan.aPlusGroup.slots.map((slot) => [slot.sourceKey, slot.position] as const),
      );
      const initialGroupSlots = {
        '主图': buildInitialEcommerceGroupSlotState({
          groupKey: 'main',
          slots: layoutPlan.mainGroup.slots.map((slot) => ({
            slotId: slot.slotId,
            sourceKey: slot.sourceKey,
          })),
          selectedItems: ecommerceState.selectedItems,
        }),
        'A+': buildInitialEcommerceGroupSlotState({
          groupKey: 'aplus',
          slots: layoutPlan.aPlusGroup.slots.map((slot) => ({
            slotId: slot.slotId,
            sourceKey: slot.sourceKey,
            deliveryKinds: (ecommerceState.taskStates[slot.sourceKey]?.effectiveSizePolicy
              || aPlusModules.find((item) => item.moduleId === slot.sourceKey)?.sizePolicy) === 'desktop-then-mobile'
              ? ['desktop', 'mobile']
              : ['default'],
          })),
          selectedItems: ecommerceState.selectedItems,
        }),
      };
      void initialGroupSlots;

      const frameworkNode = buildEcommerceFrameworkNode(analysis, {
        x: basePosition.x + 260,
        y: basePosition.y - 260,
      });
      await addPromptNode(frameworkNode);
      createdNodeIds.push(frameworkNode.id);

      const mainGroupNode = buildEcommerceGroupNode(
        analysis.projectMeta.productName,
        '主图',
        layoutPlan.mainGroup.position,
        frameworkNode.id,
      );
      await addPromptNode(mainGroupNode);
      createdNodeIds.push(mainGroupNode.id);

      const aPlusGroupNode = buildEcommerceGroupNode(
        analysis.projectMeta.productName,
        'A+',
        layoutPlan.aPlusGroup.position,
        frameworkNode.id,
      );
      await addPromptNode(aPlusGroupNode);
      createdNodeIds.push(aPlusGroupNode.id);

      for (let index = 0; index < mainImageItems.length; index += 1) {
        const item = mainImageItems[index];
        const node = await buildEcommercePromptNode({
          item,
          kind: 'main-image',
          position: mainSlotPositionByKey.get(item.itemId) || {
            x: layoutPlan.mainGroup.position.x,
            y: layoutPlan.mainGroup.position.y + 180 + index * 220,
          },
          groupId: mainGroupNode.id,
          frameworkId: frameworkNode.id,
          selected: ecommerceState.selectedItems[item.itemId] !== false,
          analysis,
          uploadReferences: currentUploadReferences,
        });
        await addPromptNode(node);
        createdNodeIds.push(node.id);
        taskNodeIds.push(node.id);
      }

      for (let index = 0; index < aPlusModules.length; index += 1) {
        const item = aPlusModules[index];
        const node = await buildEcommercePromptNode({
          item,
          kind: 'a-plus-module',
          groupId: aPlusGroupNode.id,
          frameworkId: frameworkNode.id,
          position: aPlusSlotPositionByKey.get(item.moduleId) || {
            x: layoutPlan.aPlusGroup.position.x,
            y: layoutPlan.aPlusGroup.position.y + 180 + index * 220,
          },
          selected: ecommerceState.selectedItems[item.moduleId] !== false,
          analysis,
          uploadReferences: currentUploadReferences,
        });
        await addPromptNode(node);
        createdNodeIds.push(node.id);
        taskNodeIds.push(node.id);
      }

      const frameworkSchedulerConfig = frameworkNode.ecommerce?.frameworkMeta?.schedulerConfig;
      const node = frameworkNode;
      if (node.ecommerce?.frameworkMeta) {
        await updatePromptNode({
          ...node,
          ecommerce: {
            ...node.ecommerce,
            frameworkMeta: {
              activeSheet: '主图',
              groupIds: {
                '主图': mainGroupNode.id,
                'A+': aPlusGroupNode.id,
              },
              taskNodeIds,
              inputSummary: node.ecommerce.frameworkMeta.inputSummary,
              schedulerConfig: frameworkSchedulerConfig,
            },
          },
        });
      }

      const initialFrameworkRuntime = createEcommerceFrameworkRuntimeState({
        frameworkId: frameworkNode.id,
        activeSheet: '主图',
        config: frameworkSchedulerConfig,
      });

      bringNodesToFront(createdNodeIds);
      setEcommerceBuildRuntimeState((previousState) => ({
        requirementFile: null,
        productFiles: [],
        extraReferenceFiles: [],
        itemReferenceFiles: {},
        analysis: null,
        analysisConfirmed: false,
        selectedItems: {},
        taskStates: {},
        groupSlots: createBuildResetGroupSlots(),
        activeTaskNodeId: null,
        activeTaskState: null,
        activeFrameworkId: null,
        activeGroupSheet: null,
        frameworkRuntime: {
          ...previousState.frameworkRuntime,
          [frameworkNode.id]: initialFrameworkRuntime,
        },
      }));
      setConfig((previousConfig) => ({
        ...previousConfig,
        prompt: '',
        referenceImages: [],
      }));
      reportBuildSuccess(1);
    } catch (error: unknown) {
      await reportBuildFailure(error);
    } finally {
      setEcommerceBuildRuntimeState(() => ({
        isConfirmingAnalysis: false,
      }));
    }
  }, [
    addPromptNode,
    bringNodesToFront,
    buildCurrentEcommerceUploadReferences,
    buildEcommerceFrameworkNode,
    buildEcommerceGroupNode,
    buildEcommercePromptNode,
    ecommerceState.analysis,
    ecommerceState.isConfirmingAnalysis,
    ecommerceState.selectedItems,
    ecommerceState.taskStates,
    findNextGroupPosition,
    setConfig,
    setEcommerceBuildRuntimeState,
    updatePromptNode,
  ]);

  return {
    handleConfirmEcommerceAnalysis,
  };
}
