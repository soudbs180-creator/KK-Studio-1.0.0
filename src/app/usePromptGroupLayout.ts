import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { GeneratedImage, PromptNode } from '../types';
import {
  buildPromptGroupLiveSceneSnapshot,
  type CanvasInteractionPhase,
  type LiveSceneSnapshot,
  type PromptGroupLayoutMode,
} from '../canvas/liveScene';
import type { PromptGroupLayoutPresentationState, PromptGroupRegroupLayout } from './appCanvasTypes';

interface UsePromptGroupLayoutDeps {
  activeCanvas: { promptNodes: PromptNode[] } | null | undefined;
  actualChildImagesByPromptId: Map<string, GeneratedImage[]>;
  canvasInteractionPhase: CanvasInteractionPhase;
  isNodeDragActive: boolean;
  liveNodePositionByIdRef: RefObject<Record<string, { x: number; y: number }>>;
  liveNodePositionVersion: number;
  promptGroupLayoutStateByIdRef: RefObject<Record<string, PromptGroupLayoutPresentationState>>;
  promptGroupLayoutVersion: number;
  promptGroupRegroupLayoutsById: Map<string, Map<string, PromptGroupRegroupLayout>>;
}

interface UsePromptGroupLayoutResult {
  liveSceneInteractionPhase: CanvasInteractionPhase;
  liveSceneState: LiveSceneSnapshot;
  liveSceneRef: RefObject<LiveSceneSnapshot>;
}

export function usePromptGroupLayout(deps: UsePromptGroupLayoutDeps): UsePromptGroupLayoutResult {
  const {
    activeCanvas,
    actualChildImagesByPromptId,
    canvasInteractionPhase,
    isNodeDragActive,
    liveNodePositionByIdRef,
    liveNodePositionVersion,
    promptGroupLayoutStateByIdRef,
    promptGroupLayoutVersion,
    promptGroupRegroupLayoutsById,
  } = deps;

  const liveSceneInteractionPhase: CanvasInteractionPhase = Object.values(promptGroupLayoutStateByIdRef.current).some((state) => state.layoutMode === 'docked')
    ? 'regroup-settle'
    : isNodeDragActive
      ? 'node-drag'
      : canvasInteractionPhase;

  const liveSceneState = useMemo<LiveSceneSnapshot>(() => {
    const liveNodePositions = liveNodePositionByIdRef.current;
    const promptGroups: LiveSceneSnapshot['promptGroups'] = {};
    const nodeRenderPositionById: LiveSceneSnapshot['nodeRenderPositionById'] = {};

    if (!activeCanvas) {
      return {
        interactionPhase: liveSceneInteractionPhase,
        liveNodePositionById: liveNodePositions,
        nodeRenderPositionById,
        promptGroups,
      };
    }

    activeCanvas.promptNodes.forEach((promptNode) => {
      const childImages = actualChildImagesByPromptId.get(promptNode.id) || [];
      if (childImages.length === 0) {
        return;
      }

      const promptPosition = liveNodePositions[promptNode.id] ?? promptNode.position;
      const regroupLayoutsById = promptGroupRegroupLayoutsById.get(promptNode.id) ?? new Map();
      const groupSnapshot = buildPromptGroupLiveSceneSnapshot({
        promptId: promptNode.id,
        promptPosition,
        interactionPhase: liveSceneInteractionPhase,
        layoutMode: (promptGroupLayoutStateByIdRef.current[promptNode.id]?.layoutMode ?? 'expanded') as PromptGroupLayoutMode,
        regroupProgress: promptGroupLayoutStateByIdRef.current[promptNode.id]?.regroupProgress ?? 0,
        liveNodePositionById: liveNodePositions,
        childNodes: childImages.map((imageNode) => {
          const livePosition = liveNodePositionByIdRef.current[imageNode.id] ?? imageNode.position;
          const regroupLayout = regroupLayoutsById.get(imageNode.id);

          return {
            id: imageNode.id,
            logicalPosition: livePosition,
            dockedPosition: regroupLayout?.settledPosition ?? livePosition,
            renderPosition: regroupLayout?.renderPosition,
          };
        }),
      });

      Object.assign(promptGroups, groupSnapshot.promptGroups);
      Object.assign(nodeRenderPositionById, groupSnapshot.nodeRenderPositionById);
    });

    return {
      interactionPhase: liveSceneInteractionPhase,
      liveNodePositionById: liveNodePositions,
      nodeRenderPositionById,
      promptGroups,
    };
  }, [
    activeCanvas,
    actualChildImagesByPromptId,
    canvasInteractionPhase,
    isNodeDragActive,
    liveNodePositionVersion,
    liveSceneInteractionPhase,
    liveNodePositionByIdRef,
    promptGroupRegroupLayoutsById,
    promptGroupLayoutStateByIdRef,
    promptGroupLayoutVersion,
  ]);

  const liveSceneRef = useRef(liveSceneState);

  useEffect(() => {
    liveSceneRef.current = liveSceneState;
  }, [liveSceneState]);

  return {
    liveSceneInteractionPhase,
    liveSceneState,
    liveSceneRef,
  };
}
