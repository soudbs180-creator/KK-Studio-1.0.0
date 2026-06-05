import { useCallback, type RefObject } from 'react';

import { buildEcommerceSlotPreviewBundle, type EcommerceGroupSlotState } from '../services/ecommerce/groupSlotState.ts';
import type { EcommerceGroupSheet, GeneratedImage, PromptNode } from '../types';

type EcommerceSlotHistoryCanvasSnapshot = {
  imageNodes: GeneratedImage[];
};

type EcommerceSlotHistoryStateSnapshot = {
  groupSlots: Record<EcommerceGroupSheet, EcommerceGroupSlotState[]>;
};

type SetWorkspaceSurface = (surface: 'workspace' | 'library' | 'favorites') => void;
type SetPreviewImages = (images: GeneratedImage[] | null) => void;
type SetPreviewInitialIndex = (index: number) => void;

export interface UseEcommerceSlotHistoryRuntimeDeps {
  activeCanvasRef: RefObject<EcommerceSlotHistoryCanvasSnapshot | null | undefined>;
  ecommerceState: EcommerceSlotHistoryStateSnapshot;
  setWorkspaceSurface: SetWorkspaceSurface;
  setPreviewImages: SetPreviewImages;
  setPreviewInitialIndex: SetPreviewInitialIndex;
}

export interface UseEcommerceSlotHistoryRuntimeResult {
  resolveEcommerceSlotState: (node: PromptNode) => EcommerceGroupSlotState | null;
  handlePreviewEcommerceSlotHistory: (
    sourceSheet: EcommerceGroupSheet,
    sourceKey: string,
    preferredImageId?: string,
  ) => void;
  handlePreviewEcommerceSlotHistoryForNode: (node: PromptNode, preferredImageId?: string) => void;
}

export function useEcommerceSlotHistoryRuntime({
  activeCanvasRef,
  ecommerceState,
  setWorkspaceSurface,
  setPreviewImages,
  setPreviewInitialIndex,
}: UseEcommerceSlotHistoryRuntimeDeps): UseEcommerceSlotHistoryRuntimeResult {
  const resolveEcommerceSlotState = useCallback((node: PromptNode): EcommerceGroupSlotState | null => {
    if (!node.ecommerce || node.ecommerce.kind === 'a-plus-group') {
      return null;
    }

    return (ecommerceState.groupSlots[node.ecommerce.sourceSheet] || []).find(
      (slot) => slot.sourceKey === node.ecommerce?.sourceRowKey,
    ) ?? null;
  }, [ecommerceState.groupSlots]);

  const handlePreviewEcommerceSlotHistory = useCallback((
    sourceSheet: EcommerceGroupSheet,
    sourceKey: string,
    preferredImageId?: string,
  ): void => {
    const canvas = activeCanvasRef.current;
    if (!canvas) {
      return;
    }

    const slotState = (ecommerceState.groupSlots[sourceSheet] || []).find((slot) => slot.sourceKey === sourceKey);
    if (!slotState) {
      return;
    }

    const imagesById = new Map(canvas.imageNodes.map((imageNode) => [imageNode.id, imageNode] as const));
    const previewBundle = buildEcommerceSlotPreviewBundle(slotState, imagesById, preferredImageId);
    if (!previewBundle) {
      return;
    }

    setWorkspaceSurface('workspace');
    setPreviewImages(previewBundle.images);
    setPreviewInitialIndex(previewBundle.initialIndex);
  }, [activeCanvasRef, ecommerceState.groupSlots, setPreviewImages, setPreviewInitialIndex, setWorkspaceSurface]);

  const handlePreviewEcommerceSlotHistoryForNode = useCallback((node: PromptNode, preferredImageId?: string): void => {
    if (!node.ecommerce || node.ecommerce.kind === 'a-plus-group') {
      return;
    }

    handlePreviewEcommerceSlotHistory(node.ecommerce.sourceSheet, node.ecommerce.sourceRowKey, preferredImageId);
  }, [handlePreviewEcommerceSlotHistory]);

  return {
    resolveEcommerceSlotState,
    handlePreviewEcommerceSlotHistory,
    handlePreviewEcommerceSlotHistoryForNode,
  };
}
