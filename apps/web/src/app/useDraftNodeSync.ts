import React from 'react';

import type { InfiniteCanvasHandle } from '../components/canvas/InfiniteCanvas';
import type { GenerationConfig, PromptNode } from '../types';
import { getViewportPreferredPosition } from '../utils/canvasUtils';
import { resolvePromptModelPresentation } from './resolvePromptModelPresentation';

type DraftRouteState = Pick<PromptNode, 'keySlotId' | 'provider' | 'providerLabel'>;

interface UseDraftNodeSyncArgs {
  draftNodeId: string | null;
  draftPromptNode: PromptNode | null;
  activeSourceImage: string | null;
  config: GenerationConfig;
  canvasRef: React.RefObject<InfiniteCanvasHandle | null>;
  canvasTransform: { x: number; y: number; scale: number };
  isSidebarOpen: boolean;
  isChatOpen: boolean;
  isMobile: boolean;
  resolveNodeRouteState: (node: Pick<PromptNode, 'model' | 'keySlotId' | 'provider' | 'providerLabel'>) => DraftRouteState;
  updatePromptNode: (node: PromptNode) => void | Promise<void>;
  deletePromptNode: (nodeId: string) => void | Promise<void>;
  setDraftNodeId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useDraftNodeSync({
  draftNodeId,
  draftPromptNode,
  activeSourceImage,
  config,
  canvasRef,
  canvasTransform,
  isSidebarOpen,
  isChatOpen,
  isMobile,
  resolveNodeRouteState,
  updatePromptNode,
  deletePromptNode,
  setDraftNodeId,
}: UseDraftNodeSyncArgs) {
  React.useEffect(() => {
    if (!draftNodeId) {
      return;
    }

    if (!config.prompt.trim()) {
      if (draftPromptNode && !draftPromptNode.sourceImageId && !draftPromptNode.isGenerating) {
        deletePromptNode(draftNodeId);
        setDraftNodeId(null);
      }
      return;
    }

    if (!draftPromptNode) {
      setDraftNodeId(null);
      return;
    }

    const nextSourceImageId = activeSourceImage || undefined;
    const draftModelPresentation = resolvePromptModelPresentation(config.model, config.imageSize);
    const draftRouteState = resolveNodeRouteState({
      model: config.model,
      keySlotId: draftPromptNode.keySlotId,
      provider: draftPromptNode.provider,
      providerLabel: draftPromptNode.providerLabel,
    });
    const nextDraftModelLabel = draftModelPresentation.label;
    const nextDraftColorStart = draftModelPresentation.colorMeta.colorStart;
    const nextDraftColorEnd = draftModelPresentation.colorMeta.colorEnd;
    const nextDraftColorSecondary = draftModelPresentation.colorMeta.colorSecondary;
    const nextDraftTextColor = draftModelPresentation.colorMeta.textColor;
    const referenceImagesChanged = draftPromptNode.referenceImages !== config.referenceImages;
    const hasChanged = draftPromptNode.prompt !== config.prompt
      || draftPromptNode.model !== config.model
      || draftPromptNode.modelLabel !== nextDraftModelLabel
      || draftPromptNode.provider !== draftRouteState.provider
      || draftPromptNode.providerLabel !== draftRouteState.providerLabel
      || draftPromptNode.keySlotId !== draftRouteState.keySlotId
      || draftPromptNode.modelColorStart !== nextDraftColorStart
      || draftPromptNode.modelColorEnd !== nextDraftColorEnd
      || draftPromptNode.modelColorSecondary !== nextDraftColorSecondary
      || draftPromptNode.modelTextColor !== nextDraftTextColor
      || draftPromptNode.aspectRatio !== config.aspectRatio
      || draftPromptNode.imageSize !== config.imageSize
      || (draftPromptNode.thinkingMode || 'minimal') !== (config.thinkingMode || 'minimal')
      || !!draftPromptNode.enableGrounding !== !!config.enableGrounding
      || !!draftPromptNode.enableImageSearch !== !!config.enableImageSearch
      || draftPromptNode.mode !== config.mode
      || referenceImagesChanged
      || draftPromptNode.sourceImageId !== nextSourceImageId;

    const shouldAutoCenter = !draftPromptNode.userMoved && !draftPromptNode.sourceImageId;

    if (!hasChanged && !shouldAutoCenter) {
      return;
    }

    const currentTransform = canvasRef.current?.getCurrentTransform() || canvasTransform;
    const viewportRect = canvasRef.current?.getCanvasRect() || null;
    const leftOffset = isSidebarOpen && !isMobile ? 260 : (isMobile ? 0 : 60);
    const rightOffset = isChatOpen && !isMobile ? 420 : 0;
    const liveCenter = getViewportPreferredPosition(currentTransform, viewportRect, 180, {
      left: leftOffset,
      right: rightOffset,
    });
    const isPositionDifferent = Math.abs(draftPromptNode.position.x - liveCenter.x) > 1
      || Math.abs(draftPromptNode.position.y - liveCenter.y) > 1;

    if (!hasChanged && (!shouldAutoCenter || !isPositionDifferent)) {
      return;
    }

    const nextDraftNode: PromptNode = {
      ...draftPromptNode,
      prompt: config.prompt,
      aspectRatio: config.aspectRatio,
      imageSize: config.imageSize,
      model: config.model,
      modelLabel: nextDraftModelLabel,
      modelColorStart: nextDraftColorStart,
      modelColorEnd: nextDraftColorEnd,
      modelColorSecondary: nextDraftColorSecondary,
      modelTextColor: nextDraftTextColor,
      keySlotId: draftRouteState.keySlotId,
      provider: draftRouteState.provider,
      providerLabel: draftRouteState.providerLabel,
      thinkingMode: config.thinkingMode || 'minimal',
      enableGrounding: !!config.enableGrounding,
      enableImageSearch: !!config.enableImageSearch,
      referenceImages: referenceImagesChanged ? config.referenceImages : undefined,
      sourceImageId: nextSourceImageId,
      mode: config.mode,
      position: shouldAutoCenter ? liveCenter : draftPromptNode.position,
    };

    updatePromptNode(nextDraftNode);
  }, [
    activeSourceImage,
    canvasRef,
    canvasTransform,
    config.aspectRatio,
    config.enableGrounding,
    config.enableImageSearch,
    config.imageSize,
    config.mode,
    config.model,
    config.prompt,
    config.referenceImages,
    config.thinkingMode,
    deletePromptNode,
    draftNodeId,
    draftPromptNode,
    isChatOpen,
    isMobile,
    isSidebarOpen,
    resolveNodeRouteState,
    setDraftNodeId,
    updatePromptNode,
  ]);
}
