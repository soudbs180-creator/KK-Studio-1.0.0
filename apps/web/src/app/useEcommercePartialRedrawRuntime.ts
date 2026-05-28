import { useCallback, type RefObject } from 'react';

import { GenerationMode, type EcommerceEditableTaskState, type GeneratedImage, type PromptNode } from '../types';

type EcommercePartialRedrawCanvasSnapshot = {
  imageNodes: GeneratedImage[];
  promptNodes: PromptNode[];
};

type UpdateImageNode = (imageId: string, patch: Partial<GeneratedImage>) => Promise<void> | void;
type UpdatePromptNode = (node: PromptNode) => Promise<void> | void;
type DeletePromptNode = (nodeId: string) => void;

export interface EcommercePartialRedrawContext {
  inheritedTaskState?: EcommerceEditableTaskState;
  inheritedDisplayLabel?: string;
  inheritedDeliveryKind?: GeneratedImage['ecommerceDeliveryKind'];
}

export interface FinalizeEcommercePartialRedrawResultParams {
  parentPrompt: PromptNode | null | undefined;
  sourceImage: GeneratedImage;
  redrawNode: PromptNode;
  latestRedrawResultId: string | null | undefined;
  inheritedDeliveryKind?: GeneratedImage['ecommerceDeliveryKind'];
}

export interface UseEcommercePartialRedrawRuntimeDeps {
  activeCanvasRef: RefObject<EcommercePartialRedrawCanvasSnapshot | null | undefined>;
  updateImageNode: UpdateImageNode;
  updatePromptNode: UpdatePromptNode;
  deletePromptNode: DeletePromptNode;
}

export interface UseEcommercePartialRedrawRuntimeResult {
  resolveEcommercePartialRedrawContext: (
    sourceImage: GeneratedImage,
    parentPrompt: PromptNode | null | undefined,
  ) => EcommercePartialRedrawContext;
  finalizeEcommercePartialRedrawResult: (params: FinalizeEcommercePartialRedrawResultParams) => Promise<void>;
}

export function useEcommercePartialRedrawRuntime({
  activeCanvasRef,
  updateImageNode,
  updatePromptNode,
  deletePromptNode,
}: UseEcommercePartialRedrawRuntimeDeps): UseEcommercePartialRedrawRuntimeResult {
  const resolveEcommercePartialRedrawContext = useCallback((
    sourceImage: GeneratedImage,
    parentPrompt: PromptNode | null | undefined,
  ): EcommercePartialRedrawContext => ({
    inheritedTaskState: parentPrompt?.ecommerce?.editableTask
      || sourceImage.redraw?.inheritedTaskState
      || sourceImage.partialRedraw?.inheritedTaskState
      || undefined,
    inheritedDisplayLabel: parentPrompt?.ecommerce?.displayLabel
      || sourceImage.redraw?.inheritedDisplayLabel
      || sourceImage.partialRedraw?.inheritedDisplayLabel,
    inheritedDeliveryKind: sourceImage.ecommerceDeliveryKind
      || sourceImage.redraw?.inheritedDeliveryKind
      || sourceImage.partialRedraw?.inheritedDeliveryKind
      || parentPrompt?.ecommerce?.activeDeliveryKind,
  }), []);

  const finalizeEcommercePartialRedrawResult = useCallback(async ({
    parentPrompt,
    sourceImage,
    redrawNode,
    latestRedrawResultId,
    inheritedDeliveryKind,
  }: FinalizeEcommercePartialRedrawResultParams): Promise<void> => {
    if (parentPrompt?.mode !== GenerationMode.ECOMMERCE || !latestRedrawResultId) {
      return;
    }

    const redrawResultImage = activeCanvasRef.current?.imageNodes.find((imageNode) => imageNode.id === latestRedrawResultId);
    if (!redrawResultImage) {
      return;
    }

    await updateImageNode(redrawResultImage.id, {
      parentPromptId: parentPrompt.id,
      position: { ...sourceImage.position },
      ecommerceDeliveryKind: inheritedDeliveryKind || redrawResultImage.ecommerceDeliveryKind,
    });

    const latestParentPrompt = activeCanvasRef.current?.promptNodes.find((promptNode) => promptNode.id === parentPrompt.id) || parentPrompt;
    if (!latestParentPrompt.childImageIds.includes(latestRedrawResultId)) {
      await updatePromptNode({
        ...latestParentPrompt,
        childImageIds: [...latestParentPrompt.childImageIds, latestRedrawResultId],
      });
    }

    const latestRedrawPrompt = activeCanvasRef.current?.promptNodes.find((promptNode) => promptNode.id === redrawNode.id) || redrawNode;
    await updatePromptNode({
      ...latestRedrawPrompt,
      childImageIds: [],
    });

    deletePromptNode(redrawNode.id);
  }, [activeCanvasRef, deletePromptNode, updateImageNode, updatePromptNode]);

  return {
    resolveEcommercePartialRedrawContext,
    finalizeEcommercePartialRedrawResult,
  };
}
