import { useEffect } from 'react';

import { buildEcommerceAssetRoleBindings } from '../services/ecommerce/assetRoleBindings.ts';
import { resolvePreferredEcommerceImageSize } from '../services/ecommerce/ecommerceModelPolicy.ts';
import { buildEcommerceRenderTask } from '../services/ecommerce/renderTaskBuilder.ts';
import { mergeEcommerceTaskState } from '../services/ecommerce/taskMerger.ts';
import type {
  EcommerceAnalysisAPlusModule,
  EcommerceAnalysisAsset,
  EcommerceAnalysisMainImageItem,
  EcommerceAnalysisResult,
} from '../services/ecommerce/types';
import {
  AspectRatio,
  GenerationMode,
  ImageSize,
  type Canvas,
  type EcommerceEditableTaskState,
  type EcommerceImageRef,
  type EcommerceTaskAssetRoleBinding,
  type PromptNode,
  type ReferenceImage,
} from '../types';
import type {
  EcommerceManualReferenceBinding,
  EcommerceUploadReferenceBundle,
} from './useEcommerceUploadReferenceRuntime.ts';
import type { ApplyEffectiveSizingToEcommerceTaskState } from './useEcommerceBuildRuntime.ts';

type EcommerceAnalysisItem = EcommerceAnalysisMainImageItem | EcommerceAnalysisAPlusModule;

export interface EcommercePostBuildSyncState {
  analysis: EcommerceAnalysisResult | null;
  analysisConfirmed: boolean;
  taskStates: Record<string, EcommerceEditableTaskState>;
  activeTaskNodeId: string | null;
  activeTaskState: EcommerceEditableTaskState | null;
}

export type SetEcommercePostBuildSyncState = (
  updater: (previousState: EcommercePostBuildSyncState) => Partial<EcommercePostBuildSyncState> | null
) => void;

export interface UseEcommercePostBuildSyncRuntimeDeps {
  activeCanvas?: Pick<Canvas, 'id' | 'promptNodes'> | null;
  ecommerceState: EcommercePostBuildSyncState;
  setEcommercePostBuildSyncState: SetEcommercePostBuildSyncState;
  updatePromptNode: (node: PromptNode) => Promise<void> | void;
  buildCurrentEcommerceUploadReferences: () => Promise<EcommerceUploadReferenceBundle>;
  buildReferenceImageSignature: (referenceImages: ReferenceImage[]) => string;
  buildEcommerceImageRefSignature: (reference?: EcommerceImageRef) => string;
  buildTaskStateSyncSignature: (taskState?: EcommerceEditableTaskState | null) => string;
  createReferenceImageFromAsset: (asset: EcommerceAnalysisAsset) => ReferenceImage | null;
  extractEcommerceManualReferenceBindings: (taskStateSeed?: EcommerceEditableTaskState | null) => EcommerceManualReferenceBinding[];
  applyEffectiveSizingToTaskState: ApplyEffectiveSizingToEcommerceTaskState;
}

export interface UseEcommercePostBuildSyncRuntimeResult {}

const EMPTY_RESULT: UseEcommercePostBuildSyncRuntimeResult = {};

export function findEcommerceAnalysisItemBySourceKey(
  analysis: EcommerceAnalysisResult | null | undefined,
  sourceKey: string,
): EcommerceAnalysisItem | null {
  if (!analysis || !sourceKey) {
    return null;
  }

  return (analysis.mainImageItems || []).find((item) => item.itemId === sourceKey)
    || (analysis.aPlusGroup?.modules || []).find((item) => item.moduleId === sourceKey)
    || null;
}

export function buildRuntimeEcommerceAssetRoles(params: {
  rowAssets?: EcommerceAnalysisAsset[];
  rowMentions?: Array<{ assetId: string; label: string; mentionTokens: string[]; notes?: string }>;
  manualReferences?: EcommerceManualReferenceBinding[];
  productReferences?: ReferenceImage[];
  extraReferences?: ReferenceImage[];
}): EcommerceTaskAssetRoleBinding[] {
  return buildEcommerceAssetRoleBindings({
    rowAssets: params.rowAssets || [],
    rowMentions: params.rowMentions || [],
    manualReferences: params.manualReferences || [],
    productReferences: params.productReferences || [],
    extraReferences: params.extraReferences || [],
  });
}

export function useEcommercePostBuildSyncRuntime({
  activeCanvas,
  ecommerceState,
  setEcommercePostBuildSyncState,
  updatePromptNode,
  buildCurrentEcommerceUploadReferences,
  buildReferenceImageSignature,
  buildEcommerceImageRefSignature,
  buildTaskStateSyncSignature,
  createReferenceImageFromAsset,
  extractEcommerceManualReferenceBindings,
  applyEffectiveSizingToTaskState,
}: UseEcommercePostBuildSyncRuntimeDeps): UseEcommercePostBuildSyncRuntimeResult {
  useEffect(() => {
    if (!ecommerceState.activeTaskNodeId || !ecommerceState.activeTaskState) {
      return;
    }

    const latestNode = activeCanvas?.promptNodes.find((node) => node.id === ecommerceState.activeTaskNodeId);
    if (!latestNode?.ecommerce?.seriesTemplate) {
      return;
    }

    const mergedTaskState = applyEffectiveSizingToTaskState(mergeEcommerceTaskState({
      baseTask: ecommerceState.activeTaskState,
      seriesTemplate: latestNode.ecommerce.seriesTemplate,
      sparseIntent: ecommerceState.activeTaskState.sparseUserIntent,
      productName: latestNode.ecommerce.productImageRef?.label || latestNode.ecommerce.theme || '',
    }));
    const nextAspectRatio = latestNode.ecommerce.currentAspectRatio || latestNode.aspectRatio || AspectRatio.SQUARE;
    const nextImageSize = latestNode.imageSize || (resolvePreferredEcommerceImageSize(latestNode.model) as ImageSize);
    const renderTask = buildEcommerceRenderTask({
      taskState: mergedTaskState,
      seriesTemplate: latestNode.ecommerce.seriesTemplate,
      aspectRatio: String(nextAspectRatio),
      imageSize: String(nextImageSize),
    });

    if (
      latestNode.originalPrompt === renderTask.prompt
      && latestNode.ecommerce.displayLabel === renderTask.displayLabel
      && latestNode.ecommerce.editableTask?.taskId === renderTask.taskState.taskId
      && latestNode.ecommerce.editableTask?.resolvedPromptPreview === renderTask.taskState.resolvedPromptPreview
    ) {
      return;
    }

    updatePromptNode({
      ...latestNode,
      prompt: renderTask.prompt,
      originalPrompt: renderTask.prompt,
      imageSize: nextImageSize,
      ecommerce: {
        ...latestNode.ecommerce,
        editableTask: renderTask.taskState,
        displayLabel: renderTask.displayLabel,
      },
    });
  }, [activeCanvas, applyEffectiveSizingToTaskState, ecommerceState.activeTaskNodeId, ecommerceState.activeTaskState, updatePromptNode]);

  useEffect(() => {
    const analysis = ecommerceState.analysis;
    if (!ecommerceState.analysisConfirmed || !analysis || !activeCanvas?.promptNodes.length) {
      return;
    }

    const ecommercePromptNodes = activeCanvas.promptNodes.filter(
      (node) => node.mode === GenerationMode.ECOMMERCE && node.ecommerce?.kind !== 'a-plus-group',
    );
    if (ecommercePromptNodes.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const {
        productReferences: nextProductReferences,
        extraReferences: nextExtraReferences,
        productImageRef: nextProductImageRef,
      } = await buildCurrentEcommerceUploadReferences();
      if (cancelled) {
        return;
      }

      const nextTaskStatesBySourceKey: Record<string, EcommerceEditableTaskState> = {};
      const nextActiveTaskCandidates = new Map<string, EcommerceEditableTaskState>();

      ecommercePromptNodes.forEach((node) => {
        if (!node.ecommerce?.seriesTemplate) {
          return;
        }

        const sourceItem = findEcommerceAnalysisItemBySourceKey(analysis, node.ecommerce.sourceRowKey);
        if (!sourceItem) {
          return;
        }

        const rowAssets = (analysis.assets?.referenceAssets || []).filter((asset) => (
          (sourceItem.referenceAssetIds || []).includes(asset.assetId)
        ));
        const rowReferences = rowAssets
          .map(createReferenceImageFromAsset)
          .filter((referenceImage): referenceImage is ReferenceImage => Boolean(referenceImage));
        const taskStateSeed = ecommerceState.taskStates[node.ecommerce.sourceRowKey] || node.ecommerce.editableTask;
        const manualReferences = extractEcommerceManualReferenceBindings(taskStateSeed);
        const nextImageSize = node.imageSize || (resolvePreferredEcommerceImageSize(node.model) as ImageSize);
        const nextAspectRatio = node.ecommerce.currentAspectRatio || node.aspectRatio || AspectRatio.SQUARE;
        const nextReferenceImages = [...rowReferences, ...manualReferences.map((reference) => reference.referenceImage), ...nextProductReferences, ...nextExtraReferences];
        const nextAssetRoles = buildRuntimeEcommerceAssetRoles({
          rowAssets,
          rowMentions: sourceItem.referenceMentions,
          manualReferences,
          productReferences: nextProductReferences,
          extraReferences: nextExtraReferences,
        });
        const nextTaskState = taskStateSeed
          ? applyEffectiveSizingToTaskState({
              ...taskStateSeed,
              assetRoles: nextAssetRoles,
            })
          : null;
        const nextRenderTask = nextTaskState
          ? buildEcommerceRenderTask({
              taskState: mergeEcommerceTaskState({
                baseTask: nextTaskState,
                seriesTemplate: node.ecommerce.seriesTemplate,
                sparseIntent: nextTaskState.sparseUserIntent,
                productName: analysis.projectMeta.productName,
              }),
              seriesTemplate: node.ecommerce.seriesTemplate,
              aspectRatio: String(nextAspectRatio),
              imageSize: String(nextImageSize),
            })
          : null;

        if (nextRenderTask) {
          nextTaskStatesBySourceKey[node.ecommerce.sourceRowKey] = nextRenderTask.taskState;
          nextActiveTaskCandidates.set(nextRenderTask.taskState.taskId, nextRenderTask.taskState);
          nextActiveTaskCandidates.set(node.ecommerce.sourceRowKey, nextRenderTask.taskState);
        }

        const nextEditableTask = nextRenderTask?.taskState || node.ecommerce.editableTask;
        const nextDisplayLabel = nextRenderTask?.displayLabel || node.ecommerce.displayLabel;
        const referenceImagesChanged = buildReferenceImageSignature(node.referenceImages || [])
          !== buildReferenceImageSignature(nextReferenceImages);
        const productImageRefChanged = buildEcommerceImageRefSignature(node.ecommerce.productImageRef)
          !== buildEcommerceImageRefSignature(nextProductImageRef);
        const taskStateChanged = buildTaskStateSyncSignature(node.ecommerce.editableTask)
          !== buildTaskStateSyncSignature(nextEditableTask);
        const displayLabelChanged = (node.ecommerce.displayLabel || '') !== (nextDisplayLabel || '');

        if (!referenceImagesChanged && !productImageRefChanged && !taskStateChanged && !displayLabelChanged) {
          return;
        }

        updatePromptNode({
          ...node,
          prompt: nextRenderTask?.prompt || node.prompt,
          originalPrompt: nextRenderTask?.prompt || node.originalPrompt || node.prompt,
          referenceImages: nextReferenceImages,
          ecommerce: {
            ...node.ecommerce,
            productImageRef: nextProductImageRef,
            editableTask: nextEditableTask,
            displayLabel: nextDisplayLabel,
          },
        });
      });

      if (Object.keys(nextTaskStatesBySourceKey).length === 0) {
        return;
      }

      setEcommercePostBuildSyncState((previousState) => ({
        taskStates: {
          ...previousState.taskStates,
          ...nextTaskStatesBySourceKey,
        },
        activeTaskState: previousState.activeTaskState
          ? nextActiveTaskCandidates.get(previousState.activeTaskState.taskId)
            || nextActiveTaskCandidates.get(previousState.activeTaskState.sourceRowKey)
            || previousState.activeTaskState
          : previousState.activeTaskState,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeCanvas?.id,
    activeCanvas?.promptNodes.length,
    buildCurrentEcommerceUploadReferences,
    buildEcommerceImageRefSignature,
    buildReferenceImageSignature,
    buildTaskStateSyncSignature,
    applyEffectiveSizingToTaskState,
    createReferenceImageFromAsset,
    extractEcommerceManualReferenceBindings,
    ecommerceState.analysis,
    ecommerceState.analysisConfirmed,
    ecommerceState.taskStates,
    setEcommercePostBuildSyncState,
    updatePromptNode,
  ]);

  return EMPTY_RESULT;
}
