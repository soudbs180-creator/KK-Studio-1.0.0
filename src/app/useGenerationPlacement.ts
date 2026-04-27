import React from 'react';

import type { InfiniteCanvasHandle } from '../components/canvas/InfiniteCanvas';
import type { PromptNode } from '../types';
import { getPromptBarFrontPosition, getViewportOffsets } from '../utils/canvasCenter';
import type { Point } from './appCanvasTypes';

type ReservedRegion = {
  bounds: { x: number; y: number; width: number; height: number };
  timestamp: number;
};

interface ResolveGenerationPlacementArgs {
  isFollowUp: boolean;
  promptNodeId: string;
  hasReusablePromptDraft: boolean;
}

interface ResolveGenerationPlacementResult {
  currentPos: Point;
  promptNodeId: string;
}

interface UseGenerationPlacementArgs {
  activeCanvasRef: React.RefObject<{ promptNodes: PromptNode[] } | undefined>;
  canvasRef: React.RefObject<InfiniteCanvasHandle | null>;
  canvasTransform: { x: number; y: number; scale: number };
  isSidebarOpen: boolean;
  isChatOpen: boolean;
  isMobile: boolean;
  chatSidebarWidth: number;
  reservedRegionsRef: React.MutableRefObject<ReservedRegion[]>;
  updatePromptNode: (node: PromptNode) => void | Promise<void>;
}

const createPromptNodeId = () => `node_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

export function useGenerationPlacement({
  activeCanvasRef,
  canvasRef,
  canvasTransform,
  isSidebarOpen,
  isChatOpen,
  isMobile,
  chatSidebarWidth,
  reservedRegionsRef,
  updatePromptNode,
}: UseGenerationPlacementArgs) {
  return React.useCallback(({
    isFollowUp,
    promptNodeId,
    hasReusablePromptDraft,
  }: ResolveGenerationPlacementArgs): ResolveGenerationPlacementResult => {
    const currentTransform = canvasRef.current?.getCurrentTransform() || canvasTransform;
    const viewportRect = canvasRef.current?.getCanvasRect() || null;
    const viewportOffsets = getViewportOffsets(isSidebarOpen, isChatOpen, isMobile, chatSidebarWidth);
    const liveCenter = getPromptBarFrontPosition(currentTransform, viewportRect, viewportOffsets, 200, 48);
    let currentPos = { ...liveCenter };

    if (!isFollowUp) {
      console.log('[handleGenerate] Normal mode - locked to current viewport center:', currentPos);
      return { currentPos, promptNodeId };
    }

    if (!hasReusablePromptDraft) {
      console.log('[handleGenerate] Follow-up mode without draft, using computed center:', currentPos);
      return { currentPos, promptNodeId };
    }

    const draft = activeCanvasRef.current?.promptNodes.find((node) => node.id === promptNodeId);
    if (!draft) {
      const nextPromptNodeId = createPromptNodeId();
      console.log('[handleGenerate] Creating new node at view center (Stale ID):', currentPos);
      return { currentPos, promptNodeId: nextPromptNodeId };
    }

    currentPos = draft.position;

    const shouldAutoCenter = !draft.userMoved && !draft.sourceImageId && !draft.isGenerating;
    if (shouldAutoCenter) {
      console.log('[handleGenerate] Auto-centering draft to latest viewCenter for precise placement');
      currentPos = { ...liveCenter };
    } else {
      const currentTransformForVisibility = canvasRef.current?.getCurrentTransform() || canvasTransform;
      const vLeft = -currentTransformForVisibility.x / currentTransformForVisibility.scale;
      const vTop = -currentTransformForVisibility.y / currentTransformForVisibility.scale;
      const vWidth = window.innerWidth / currentTransformForVisibility.scale;
      const vHeight = window.innerHeight / currentTransformForVisibility.scale;
      const margin = 100;
      const isVisible = currentPos.x >= vLeft - margin
        && currentPos.x <= vLeft + vWidth + margin
        && currentPos.y >= vTop - margin
        && currentPos.y <= vTop + vHeight + margin;

      if (!isVisible) {
        console.warn('[handleGenerate] Draft is off-screen, moving to center:', {
          currentPos,
          viewCenter: liveCenter,
          viewport: { vLeft, vRight: vLeft + vWidth, vTop, vBottom: vTop + vHeight },
        });
        currentPos = { ...liveCenter };
      } else {
        console.log('[handleGenerate] Reusing draft at position (Visible):', currentPos);
      }
    }

    const now = Date.now();
    reservedRegionsRef.current = reservedRegionsRef.current.filter((region) => now - region.timestamp < 3000);

    const finalPos = {
      x: Math.round(currentPos.x),
      y: Math.round(currentPos.y),
    };
    reservedRegionsRef.current.push({
      timestamp: now,
      bounds: { x: finalPos.x, y: finalPos.y, width: 380, height: 200 },
    });

    if (finalPos.x !== draft.position.x || finalPos.y !== draft.position.y) {
      console.log('[handleGenerate] Persisting adjusted draft position:', finalPos);
      updatePromptNode({ ...draft, position: finalPos });
    }

    return {
      currentPos: finalPos,
      promptNodeId,
    };
  }, [
    activeCanvasRef,
    canvasRef,
    canvasTransform,
    chatSidebarWidth,
    isChatOpen,
    isMobile,
    isSidebarOpen,
    reservedRegionsRef,
    updatePromptNode,
  ]);
}
