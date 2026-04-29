import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { GenerationMode, type GeneratedImage, type PromptNode } from '../types';
import {
  buildPromptGroupLiveSceneSnapshot,
  type CanvasInteractionPhase,
  type LiveSceneSnapshot,
  type PromptGroupLayoutMode,
} from '../canvas/liveScene';
import { getCardDimensions } from '../utils/styleUtils';
import {
  buildDockedPromptChildRegroupLayout,
  buildGeneratedImageBatchPositions,
  resolveRegroupTargetSlotIndices,
} from '../utils/generatedImageLayout';
import { traceLocalPerformance } from '../services/system/localPerformanceTrace';
import type {
  Point,
  PromptGroupLayoutPresentationState,
  PromptGroupRegroupLayout,
  PromptGroupTier,
  PromptGroupView,
  WorkflowUtilityCanvasNode,
} from './appCanvasTypes';

type PromptGroupBounds = { x: number; y: number; width: number; height: number };
type SelectNodes = (ids: string[], mode?: 'replace' | 'add' | 'remove' | 'toggle') => void;

const EMPTY_CHILD_IMAGES_BY_PROMPT_ID = new Map<string, GeneratedImage[]>();
const EMPTY_GENERATING_GROUP_IDS: string[] = [];
const EMPTY_GROUP_OVERLAP_MAP: Record<string, string[]> = {};
const EMPTY_IMAGE_NODES_BY_ID = new Map<string, GeneratedImage>();
const EMPTY_LOCKED_GROUP_BOUNDS_BY_ID: Record<string, PromptGroupBounds> = {};
const EMPTY_PROMPT_GROUP_LAYER_BY_ID = new Map<string, number>();
const EMPTY_PROMPT_NODES_BY_ID = new Map<string, PromptNode>();
const EMPTY_VISIBLE_IMAGE_NODES: GeneratedImage[] = [];
const EMPTY_VISIBLE_PROMPT_NODES: PromptNode[] = [];
const EMPTY_WORKFLOW_UTILITY_NODES_BY_ID = new Map<string, WorkflowUtilityCanvasNode>();

const PROMPT_GROUP_REGROUP_FAST_MS = 110;
const PROMPT_GROUP_REGROUP_SLOW_MS = 180;
const PROMPT_GROUP_REGROUP_TOTAL_MS = PROMPT_GROUP_REGROUP_FAST_MS + PROMPT_GROUP_REGROUP_SLOW_MS;
const PROMPT_GROUP_REGROUP_SETTLE_MS = 180;

const PROMPT_GROUP_TIER_WEIGHT: Record<PromptGroupTier, number> = {
  base: 1,
  focused: 2,
  generating: 3,
};

const boundsIntersect = (
  left: PromptGroupBounds,
  right: PromptGroupBounds,
) => !(
  left.x + left.width <= right.x
  || right.x + right.width <= left.x
  || left.y + left.height <= right.y
  || right.y + right.height <= left.y
);

interface UsePromptGroupLayoutDeps {
  activeCanvas: { id: string; promptNodes: PromptNode[]; imageNodes: GeneratedImage[] } | null | undefined;
  canvasInteractionPhase: CanvasInteractionPhase;
  focusedGroupId: string | null | undefined;
  generatingGroupIds: string[] | null | undefined;
  groupOverlapMap: Record<string, string[]> | null | undefined;
  imageNodesById: Map<string, GeneratedImage> | null | undefined;
  isMobile: boolean;
  isNodeDragActive: boolean;
  liveDerivedNodeIdsByOwnerRef: RefObject<Record<string, string[]>>;
  lockedGroupBoundsById: Record<string, PromptGroupBounds> | null | undefined;
  liveNodePositionByIdRef: RefObject<Record<string, { x: number; y: number }>>;
  liveNodePositionVersion: number;
  parseImageDimensions: (dimensions?: string | null) => { width: number; height: number } | undefined;
  promptGroupLayerById: Map<string, number> | null | undefined;
  promptGroupLayoutStateByIdRef: RefObject<Record<string, PromptGroupLayoutPresentationState>>;
  promptGroupLayoutVersion: number;
  promptNodesById: Map<string, PromptNode> | null | undefined;
  resolveCurrentPromptChildImages: (
    promptNode: PromptNode | undefined | null,
    imageNodes: GeneratedImage[],
  ) => GeneratedImage[];
  selectNodes: SelectNodes;
  setFocusedGroupId: Dispatch<SetStateAction<string | null>>;
  setGroupOverlapMap: Dispatch<SetStateAction<Record<string, string[]>>>;
  setImageCardHeightById: Dispatch<SetStateAction<Record<string, number>>>;
  setPromptGroupLayoutVersion: Dispatch<SetStateAction<number>>;
  setLiveNodePositionVersion: Dispatch<SetStateAction<number>>;
  updateImageNodePosition: (
    imageId: string,
    position: Point,
    options?: { ignoreSelection?: boolean }
  ) => void;
  visibleImageNodes: GeneratedImage[] | null | undefined;
  visiblePromptNodes: PromptNode[] | null | undefined;
  workflowUtilityNodesById: Map<string, WorkflowUtilityCanvasNode> | null | undefined;
}

interface UsePromptGroupLayoutResult {
  liveSceneInteractionPhase: CanvasInteractionPhase;
  liveSceneState: LiveSceneSnapshot;
  liveSceneRef: RefObject<LiveSceneSnapshot>;
  actualChildImagesByPromptId: Map<string, GeneratedImage[]>;
  actualChildImageIdsByPromptId: Map<string, string[]>;
  promptGroupNodeIdsById: Map<string, string[]>;
  promptGroupRegroupLayoutsById: Map<string, Map<string, PromptGroupRegroupLayout>>;
  promptGroupBoundsById: Map<string, PromptGroupBounds>;
  promptGroupViews: PromptGroupView[];
  visiblePromptGroupViews: PromptGroupView[];
  syncLiveNodePositionState: () => void;
  resolvePromptGroupIdForNodeId: (nodeId: string) => string | null;
  resolveCanvasNodePositionForLiveDrag: (nodeId: string) => Point | null;
  applyLiveNodeDeltaToDraggedSet: (
    ownerId: string,
    nodeIds: string[] | null | undefined,
    delta: Point | null | undefined
  ) => void;
  handleImageCardHeightChange: (imageId: string, height: number) => void;
  handleFocusPromptGroup: (
    groupId: string | null,
    options?: { nodeIds?: string[]; keepSelection?: boolean }
  ) => void;
  beginPromptGroupRegroup: (groupId: string, childImages: GeneratedImage[]) => void;
  settlePromptGroupRegroup: (groupId: string) => void;
  clearPromptGroupRegroup: (groupId: string) => void;
}

export function usePromptGroupLayout(deps: UsePromptGroupLayoutDeps): UsePromptGroupLayoutResult {
  const {
    activeCanvas,
    canvasInteractionPhase,
    focusedGroupId,
    generatingGroupIds,
    groupOverlapMap,
    imageNodesById,
    isMobile,
    isNodeDragActive,
    liveDerivedNodeIdsByOwnerRef,
    lockedGroupBoundsById,
    liveNodePositionByIdRef,
    liveNodePositionVersion,
    parseImageDimensions,
    promptGroupLayerById,
    promptGroupLayoutStateByIdRef,
    promptGroupLayoutVersion,
    promptNodesById,
    resolveCurrentPromptChildImages,
    selectNodes,
    setFocusedGroupId,
    setGroupOverlapMap,
    setImageCardHeightById,
    setPromptGroupLayoutVersion,
    setLiveNodePositionVersion,
    updateImageNodePosition,
    visibleImageNodes,
    visiblePromptNodes,
    workflowUtilityNodesById,
  } = deps;

  const currentGeneratingGroupIds = generatingGroupIds ?? EMPTY_GENERATING_GROUP_IDS;
  const currentGroupOverlapMap = groupOverlapMap ?? EMPTY_GROUP_OVERLAP_MAP;
  const currentImageNodesById = imageNodesById ?? EMPTY_IMAGE_NODES_BY_ID;
  const currentLockedGroupBoundsById = lockedGroupBoundsById ?? EMPTY_LOCKED_GROUP_BOUNDS_BY_ID;
  const currentPromptGroupLayerById = promptGroupLayerById ?? EMPTY_PROMPT_GROUP_LAYER_BY_ID;
  const currentPromptNodesById = promptNodesById ?? EMPTY_PROMPT_NODES_BY_ID;
  const currentVisibleImageNodes = visibleImageNodes ?? EMPTY_VISIBLE_IMAGE_NODES;
  const currentVisiblePromptNodes = visiblePromptNodes ?? EMPTY_VISIBLE_PROMPT_NODES;
  const currentWorkflowUtilityNodesById = workflowUtilityNodesById ?? EMPTY_WORKFLOW_UTILITY_NODES_BY_ID;
  const liveSceneFrameRef = useRef<number | null>(null);
  const promptGroupRegroupFrameRef = useRef<number | null>(null);
  const stablePromptGroupBoundsByIdRef = useRef(new Map<string, PromptGroupBounds>());
  const stablePromptGroupViewsRef = useRef<PromptGroupView[]>([]);
  const groupOverlapStateSignatureRef = useRef('');
  const autoRepairedPromptLayoutKeysRef = useRef<Set<string>>(new Set());

  const actualChildImagesByPromptId = useMemo(() => {
    const childMap = new Map<string, GeneratedImage[]>();
    if (!activeCanvas) return childMap;

    activeCanvas.promptNodes.forEach((promptNode) => {
      const childImages = resolveCurrentPromptChildImages(promptNode, activeCanvas.imageNodes);
      if (childImages.length > 0) {
        childMap.set(promptNode.id, childImages);
      }
    });

    return childMap;
  }, [activeCanvas, resolveCurrentPromptChildImages]);

  const actualChildImageIdsByPromptId = useMemo(() => {
    const childIdMap = new Map<string, string[]>();

    actualChildImagesByPromptId.forEach((images, promptId) => {
      childIdMap.set(promptId, images.map((imageNode) => imageNode.id));
    });

    return childIdMap;
  }, [actualChildImagesByPromptId]);

  const promptGroupNodeIdsById = useMemo(() => {
    const nodeIdsByGroupId = new Map<string, string[]>();

    activeCanvas?.promptNodes.forEach((promptNode) => {
      if (promptNode.isDraft && !promptNode.isGenerating) {
        return;
      }
      nodeIdsByGroupId.set(promptNode.id, [
        promptNode.id,
        ...(actualChildImageIdsByPromptId.get(promptNode.id) || []),
      ]);
    });

    return nodeIdsByGroupId;
  }, [activeCanvas, actualChildImageIdsByPromptId]);

  const childImagesByPromptId = actualChildImagesByPromptId ?? EMPTY_CHILD_IMAGES_BY_PROMPT_ID;

  const liveSceneInteractionPhase: CanvasInteractionPhase = Object.values(promptGroupLayoutStateByIdRef.current).some((state) => state.layoutMode === 'docked')
    ? 'regroup-settle'
    : isNodeDragActive
      ? 'node-drag'
      : canvasInteractionPhase;

  const buildPromptGroupRegroupLayouts = useCallback((
    promptNode: PromptNode,
    childImages: GeneratedImage[],
    promptPosition: { x: number; y: number },
    layoutState: PromptGroupLayoutPresentationState | undefined,
  ) => {
    if (!layoutState || childImages.length === 0) {
      return new Map<string, PromptGroupRegroupLayout>();
    }

    const fastPhaseRatio = PROMPT_GROUP_REGROUP_FAST_MS / PROMPT_GROUP_REGROUP_TOTAL_MS;
    const fastRegroupProgress = layoutState.layoutMode === 'docked'
      ? 0
      : Math.min(1, layoutState.regroupProgress / fastPhaseRatio);
    const settleRegroupProgress = layoutState.layoutMode === 'docked'
      ? layoutState.regroupProgress
      : layoutState.regroupProgress <= fastPhaseRatio
        ? 0
        : Math.min(1, (layoutState.regroupProgress - fastPhaseRatio) / (1 - fastPhaseRatio));

    const liveStartPositions = childImages.map((imageNode) => (
      liveNodePositionByIdRef.current[imageNode.id] ?? imageNode.position
    ));
    const layouts = buildDockedPromptChildRegroupLayout({
      basePosition: promptPosition,
      items: childImages.map((imageNode) => ({
        aspectRatio: imageNode.aspectRatio,
        exactDimensions: imageNode.exactDimensions || parseImageDimensions(imageNode.dimensions),
      })),
      mode: promptNode.mode,
      isMobile,
      regroupStartPositions: liveStartPositions,
      fastRegroupProgress,
      settleRegroupProgress,
      targetSlotIndices: childImages.map((imageNode) => layoutState.targetSlotIndicesByChildId[imageNode.id]),
    });

    return new Map<string, PromptGroupRegroupLayout>(
      childImages.map((imageNode, index) => {
        const liveStartPosition = liveStartPositions[index] ?? imageNode.position;
        const layout = layouts[index];
        const renderPosition = !layout
          ? liveStartPosition
          : layout.position;
        const settledPosition = !layout
          ? liveStartPosition
          : layout.settledPosition;

        return [imageNode.id, { renderPosition, settledPosition }] as const;
      })
    );
  }, [isMobile, liveNodePositionByIdRef, parseImageDimensions]);

  const promptGroupRegroupLayoutsById = useMemo(() => {
    const promptGroupLayoutEntries = Object.entries(promptGroupLayoutStateByIdRef.current);
    return traceLocalPerformance('canvas-interaction.prompt-group-regroup-layouts', () => {
      const regroupLayoutMap = new Map<string, Map<string, PromptGroupRegroupLayout>>();
      if (promptGroupLayoutEntries.length === 0) {
        return regroupLayoutMap;
      }

      promptGroupLayoutEntries.forEach(([promptNodeId, layoutState]) => {
        const promptNode = currentPromptNodesById.get(promptNodeId);
        if (!promptNode) {
          return;
        }

        const childImages = childImagesByPromptId.get(promptNodeId) || [];
        if (childImages.length === 0) {
          return;
        }

        const promptPosition = liveNodePositionByIdRef.current[promptNodeId] ?? promptNode.position;
        regroupLayoutMap.set(
          promptNodeId,
          buildPromptGroupRegroupLayouts(
            promptNode,
            childImages,
            promptPosition,
            layoutState,
          ),
        );
      });

      return regroupLayoutMap;
    }, {
      activeLayoutStateCount: promptGroupLayoutEntries.length,
      liveNodePositionVersion,
      promptGroupLayoutVersion,
    });
  }, [
    buildPromptGroupRegroupLayouts,
    childImagesByPromptId,
    currentPromptNodesById,
    liveNodePositionByIdRef,
    liveNodePositionVersion,
    promptGroupLayoutStateByIdRef,
    promptGroupLayoutVersion,
  ]);

  const syncLiveNodePositionState = useCallback(() => {
    const hasActivePromptGroupDragPresentation = isNodeDragActive
      && Object.values(promptGroupLayoutStateByIdRef.current).some((state) => (
        state.layoutMode === 'regrouping' || state.layoutMode === 'docked'
      ));

    if (hasActivePromptGroupDragPresentation) {
      if (liveSceneFrameRef.current !== null) {
        return;
      }
      liveSceneFrameRef.current = requestAnimationFrame(() => {
        liveSceneFrameRef.current = null;
        setLiveNodePositionVersion((prev) => prev + 1);
      });
      return;
    }

    if (liveSceneFrameRef.current !== null) {
      return;
    }

    liveSceneFrameRef.current = requestAnimationFrame(() => {
      liveSceneFrameRef.current = null;
      setLiveNodePositionVersion((prev) => prev + 1);
    });
  }, [isNodeDragActive, promptGroupLayoutStateByIdRef, setLiveNodePositionVersion]);

  const resolvePromptGroupIdForNodeId = useCallback((nodeId: string) => {
    if (!nodeId) {
      return null;
    }

    if (currentPromptNodesById.has(nodeId)) {
      return nodeId;
    }

    return currentImageNodesById.get(nodeId)?.parentPromptId || null;
  }, [currentImageNodesById, currentPromptNodesById]);

  const resolveCanvasNodePositionForLiveDrag = useCallback((nodeId: string) => {
    if (!nodeId) {
      return null;
    }

    const livePosition = liveNodePositionByIdRef.current[nodeId];
    if (livePosition) {
      return livePosition;
    }

    const promptNode = currentPromptNodesById.get(nodeId);
    if (promptNode) {
      return promptNode.position;
    }

    const imageNode = currentImageNodesById.get(nodeId);
    if (imageNode) {
      return imageNode.position;
    }

    const workflowNode = currentWorkflowUtilityNodesById.get(nodeId);
    return workflowNode?.position ?? null;
  }, [
    currentImageNodesById,
    currentPromptNodesById,
    currentWorkflowUtilityNodesById,
    liveNodePositionByIdRef,
  ]);

  const applyLiveNodeDeltaToDraggedSet = useCallback((
    ownerId: string,
    nodeIds: string[] | null | undefined,
    delta: Point | null | undefined,
  ) => {
    const currentNodeIds = nodeIds ?? [];
    if (!ownerId || currentNodeIds.length === 0 || !delta || (delta.x === 0 && delta.y === 0)) {
      return;
    }

    const companionIds = Array.from(new Set(
      currentNodeIds.filter((nodeId) => Boolean(nodeId) && nodeId !== ownerId)
    ));

    const previousCompanionIds = liveDerivedNodeIdsByOwnerRef.current[ownerId] || [];
    let nextLivePositions = liveNodePositionByIdRef.current;
    let hasLivePositionChanged = false;

    previousCompanionIds.forEach((nodeId) => {
      if (companionIds.includes(nodeId) || !(nodeId in nextLivePositions)) {
        return;
      }

      if (nextLivePositions === liveNodePositionByIdRef.current) {
        nextLivePositions = { ...nextLivePositions };
      }
      delete nextLivePositions[nodeId];
      hasLivePositionChanged = true;
    });

    companionIds.forEach((nodeId) => {
      const basePosition = resolveCanvasNodePositionForLiveDrag(nodeId);
      if (!basePosition) {
        return;
      }

      const nextPosition = {
        x: basePosition.x + delta.x,
        y: basePosition.y + delta.y,
      };
      const previousPosition = nextLivePositions[nodeId];

      if (!previousPosition || previousPosition.x !== nextPosition.x || previousPosition.y !== nextPosition.y) {
        if (nextLivePositions === liveNodePositionByIdRef.current) {
          nextLivePositions = { ...nextLivePositions };
        }
        nextLivePositions[nodeId] = nextPosition;
        hasLivePositionChanged = true;
      }
    });

    liveDerivedNodeIdsByOwnerRef.current = {
      ...liveDerivedNodeIdsByOwnerRef.current,
      [ownerId]: companionIds,
    };

    if (hasLivePositionChanged) {
      liveNodePositionByIdRef.current = nextLivePositions;
      syncLiveNodePositionState();
    }
  }, [
    liveDerivedNodeIdsByOwnerRef,
    liveNodePositionByIdRef,
    resolveCanvasNodePositionForLiveDrag,
    syncLiveNodePositionState,
  ]);

  const handleImageCardHeightChange = useCallback((imageId: string, height: number) => {
    if (!(height > 0)) return;

    setImageCardHeightById((prev) => {
      const previousHeight = prev[imageId];
      if (previousHeight && Math.abs(previousHeight - height) <= 1) {
        return prev;
      }

      return {
        ...prev,
        [imageId]: height,
      };
    });
  }, [setImageCardHeightById]);

  const handleFocusPromptGroup = useCallback((
    groupId: string | null,
    options?: { nodeIds?: string[]; keepSelection?: boolean }
  ) => {
    setFocusedGroupId(groupId);
    if (!groupId || options?.keepSelection || !options?.nodeIds?.length) {
      return;
    }
    selectNodes(options.nodeIds, 'replace');
  }, [selectNodes, setFocusedGroupId]);

  useEffect(() => {
    autoRepairedPromptLayoutKeysRef.current.clear();
  }, [activeCanvas?.id]);

  useEffect(() => {
    if (!activeCanvas || isNodeDragActive) return;

    const repairKeys = autoRepairedPromptLayoutKeysRef.current;
    const activeCanvasId = activeCanvas.id;

    activeCanvas.promptNodes.forEach((promptNode) => {
      const childImages = actualChildImagesByPromptId.get(promptNode.id) || [];
      if (childImages.length === 0) return;

      const hasLiveDragInGroup = Boolean(liveNodePositionByIdRef.current[promptNode.id])
        || childImages.some((imageNode) => Boolean(liveNodePositionByIdRef.current[imageNode.id]));
      const hasManualLayoutOverride = Boolean(promptNode.userMoved)
        || childImages.some((imageNode) => Boolean(imageNode.userMoved));
      const hasPromptGroupPresentationState = Boolean(promptGroupLayoutStateByIdRef.current[promptNode.id]);

      if (hasLiveDragInGroup || hasManualLayoutOverride || hasPromptGroupPresentationState) return;

      const repairKey = [
        activeCanvasId,
        promptNode.id,
        promptNode.position.x,
        promptNode.position.y,
        childImages.map((imageNode) => imageNode.id).join(','),
      ].join(':');

      if (repairKeys.has(repairKey)) return;

      const expectedPositions = buildGeneratedImageBatchPositions({
        basePosition: promptNode.position,
        items: childImages.map((imageNode) => ({
          aspectRatio: imageNode.aspectRatio,
          exactDimensions: imageNode.exactDimensions || parseImageDimensions(imageNode.dimensions),
        })),
        mode: promptNode.mode,
        isMobile,
      });

      const hasSevereLayoutDrift = childImages.some((imageNode, index) => {
        const expectedPosition = expectedPositions[index];
        if (!expectedPosition) return false;

        const dx = Math.abs(imageNode.position.x - expectedPosition.x);
        const dy = Math.abs(imageNode.position.y - expectedPosition.y);

        return dx > 220 || dy > 260;
      });

      if (!hasSevereLayoutDrift) return;

      repairKeys.add(repairKey);
      expectedPositions.forEach((expectedPosition, index) => {
        const imageNode = childImages[index];
        if (!imageNode || !expectedPosition) return;
        updateImageNodePosition(imageNode.id, expectedPosition, { ignoreSelection: true });
      });
    });
  }, [activeCanvas, actualChildImagesByPromptId, isMobile, isNodeDragActive, liveNodePositionVersion, parseImageDimensions, promptGroupLayoutVersion, updateImageNodePosition]);

  const syncPromptGroupLayoutState = useCallback((
    updater: Record<string, PromptGroupLayoutPresentationState>
    | ((prev: Record<string, PromptGroupLayoutPresentationState>) => Record<string, PromptGroupLayoutPresentationState>)
  ) => {
    const prev = promptGroupLayoutStateByIdRef.current;
    const next = typeof updater === 'function'
      ? updater(prev)
      : updater;
    if (next === prev) {
      return;
    }
    promptGroupLayoutStateByIdRef.current = next;
    setPromptGroupLayoutVersion((version) => version + 1);
  }, [promptGroupLayoutStateByIdRef, setPromptGroupLayoutVersion]);

  const schedulePromptGroupRegroupAnimation = useCallback(() => {
    if (promptGroupRegroupFrameRef.current !== null) {
      return;
    }

    promptGroupRegroupFrameRef.current = requestAnimationFrame(() => {
      promptGroupRegroupFrameRef.current = null;
      const now = performance.now();

      syncPromptGroupLayoutState((prev) => {
        let next = prev;

        Object.entries(prev).forEach(([groupId, state]) => {
          if (state.layoutMode === 'regrouping') {
            const nextProgress = Math.min(1, Math.max(state.regroupProgress, (now - state.startedAt) / PROMPT_GROUP_REGROUP_TOTAL_MS));
            if (nextProgress !== state.regroupProgress) {
              if (next === prev) next = { ...prev };
              next[groupId] = {
                ...state,
                regroupProgress: nextProgress,
              };
            }
            return;
          }

          if (state.layoutMode === 'docked' && state.settleUntil !== null) {
            const settleDuration = Math.max(1, state.settleUntil - state.startedAt);
            const nextProgress = Math.min(1, Math.max(state.regroupProgress, (now - state.startedAt) / settleDuration));

            if (nextProgress !== state.regroupProgress) {
              if (next === prev) next = { ...prev };
              next[groupId] = {
                ...state,
                regroupProgress: nextProgress,
              };
            }

            if (now >= state.settleUntil) {
              if (next === prev) next = { ...prev };
              delete next[groupId];
            }
          }
        });

        return next;
      });

      const hasAnimatedGroup = Object.values(promptGroupLayoutStateByIdRef.current).some((state) => (
        state.layoutMode === 'regrouping'
        || (state.layoutMode === 'docked' && state.settleUntil !== null)
      ));

      if (hasAnimatedGroup) {
        schedulePromptGroupRegroupAnimation();
      }
    });
  }, [promptGroupLayoutStateByIdRef, syncPromptGroupLayoutState]);

  const beginPromptGroupRegroup = useCallback((groupId: string, childImages: GeneratedImage[]) => {
    const now = performance.now();
    const promptNode = activeCanvas?.promptNodes.find((candidate) => candidate.id === groupId) ?? null;
    syncPromptGroupLayoutState((prev) => {
      const existing = prev[groupId];
      const hasStableTargetSlots = Boolean(existing?.targetSlotIndicesByChildId)
        && childImages.every((imageNode) => typeof existing?.targetSlotIndicesByChildId?.[imageNode.id] === 'number');
      const regroupStartPositions = childImages.map((imageNode) => (
        liveNodePositionByIdRef.current[imageNode.id] ?? imageNode.position
      ));
      const targetSlotIndices = hasStableTargetSlots
        ? childImages.map((imageNode) => existing!.targetSlotIndicesByChildId[imageNode.id])
        : resolveRegroupTargetSlotIndices(
            regroupStartPositions,
            isMobile || promptNode?.mode === GenerationMode.PPT ? 1 : childImages.length,
            childImages.length,
          );
      const targetSlotIndicesByChildId = childImages.reduce<Record<string, number>>((acc, imageNode, index) => {
        acc[imageNode.id] = targetSlotIndices[index] ?? index;
        return acc;
      }, {});
      const hasSameTargetSlots = Boolean(existing?.targetSlotIndicesByChildId)
        && childImages.every((imageNode) => (
          existing?.targetSlotIndicesByChildId?.[imageNode.id] === targetSlotIndicesByChildId[imageNode.id]
        ));

      if (
        existing
        && existing.layoutMode === 'regrouping'
        && existing.settleUntil === null
        && hasSameTargetSlots
      ) {
        return prev;
      }

      return {
        ...prev,
        [groupId]: {
          layoutMode: 'regrouping',
          regroupProgress: existing?.regroupProgress ?? 0,
          startedAt: existing?.startedAt ?? now,
          settleUntil: null,
          targetSlotIndicesByChildId,
        },
      };
    });
    schedulePromptGroupRegroupAnimation();
  }, [activeCanvas, isMobile, liveNodePositionByIdRef, schedulePromptGroupRegroupAnimation, syncPromptGroupLayoutState]);

  const settlePromptGroupRegroup = useCallback((groupId: string) => {
    const now = performance.now();
    syncPromptGroupLayoutState((prev) => {
      const existing = prev[groupId];
      if (!existing) {
        return prev;
      }

      return {
        ...prev,
        [groupId]: {
          ...existing,
          layoutMode: 'docked',
          regroupProgress: 0,
          startedAt: now,
          settleUntil: now + PROMPT_GROUP_REGROUP_SETTLE_MS,
        },
      };
    });
    schedulePromptGroupRegroupAnimation();
  }, [schedulePromptGroupRegroupAnimation, syncPromptGroupLayoutState]);

  const clearPromptGroupRegroup = useCallback((groupId: string) => {
    syncPromptGroupLayoutState((prev) => {
      if (!(groupId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }, [syncPromptGroupLayoutState]);

  useEffect(() => () => {
    if (liveSceneFrameRef.current !== null) {
      cancelAnimationFrame(liveSceneFrameRef.current);
      liveSceneFrameRef.current = null;
    }
    if (promptGroupRegroupFrameRef.current !== null) {
      cancelAnimationFrame(promptGroupRegroupFrameRef.current);
      promptGroupRegroupFrameRef.current = null;
    }
  }, []);

  const promptGroupBoundsById = useMemo(() => {
    if (isNodeDragActive && stablePromptGroupBoundsByIdRef.current.size > 0) {
      return stablePromptGroupBoundsByIdRef.current;
    }

    const boundsMap = new Map<string, PromptGroupBounds>();
    if (!activeCanvas) return boundsMap;

    const PADDING = 40;
    const TOP_EXTRA = 40;
    const BOTTOM_EXTRA = 40;

    activeCanvas.promptNodes.forEach((promptNode) => {
      if (promptNode.isDraft && !promptNode.isGenerating) {
        return;
      }

      const lockedBounds = currentLockedGroupBoundsById[promptNode.id];
      if (lockedBounds) {
        boundsMap.set(promptNode.id, lockedBounds);
        return;
      }

      const childImages = childImagesByPromptId.get(promptNode.id) || [];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      const addRect = (x: number, y: number, width: number, height: number) => {
        minX = Math.min(minX, x - width / 2);
        maxX = Math.max(maxX, x + width / 2);
        minY = Math.min(minY, y - height);
        maxY = Math.max(maxY, y);
      };

      const livePromptPosition = liveNodePositionByIdRef.current[promptNode.id]
        ?? promptNode.position;
      addRect(livePromptPosition.x, livePromptPosition.y, 380, promptNode.height || 200);

      childImages.forEach((imageNode) => {
        const { width, totalHeight } = getCardDimensions(imageNode.aspectRatio, true);
        const liveImagePosition = liveNodePositionByIdRef.current[imageNode.id] ?? imageNode.position;
        addRect(liveImagePosition.x, liveImagePosition.y, width, totalHeight);
        const renderPosition = promptGroupRegroupLayoutsById.get(promptNode.id)?.get(imageNode.id)?.renderPosition;
        if (renderPosition && (renderPosition.x !== liveImagePosition.x || renderPosition.y !== liveImagePosition.y)) {
          addRect(renderPosition.x, renderPosition.y, width, totalHeight);
        }
      });

      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return;
      }

      boundsMap.set(promptNode.id, {
        x: minX - PADDING,
        y: minY - (PADDING + TOP_EXTRA),
        width: (maxX - minX) + PADDING * 2,
        height: (maxY - minY) + PADDING + TOP_EXTRA + BOTTOM_EXTRA,
      });
    });

    stablePromptGroupBoundsByIdRef.current = boundsMap;
    return boundsMap;
  }, [
    activeCanvas,
    childImagesByPromptId,
    currentLockedGroupBoundsById,
    isNodeDragActive,
    liveNodePositionByIdRef,
    liveNodePositionVersion,
    promptGroupRegroupLayoutsById,
  ]);

  const computedGroupOverlapMap = useMemo(() => {
    if (isNodeDragActive) {
      return currentGroupOverlapMap;
    }

    const nextOverlapMap: Record<string, string[]> = {};
    const entries = Array.from(promptGroupBoundsById.entries());

    entries.forEach(([groupId]) => {
      nextOverlapMap[groupId] = [];
    });

    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      const [leftId, leftBounds] = entries[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const [rightId, rightBounds] = entries[rightIndex];
        if (!boundsIntersect(leftBounds, rightBounds)) continue;
        nextOverlapMap[leftId].push(rightId);
        nextOverlapMap[rightId].push(leftId);
      }
    }

    return nextOverlapMap;
  }, [currentGroupOverlapMap, isNodeDragActive, promptGroupBoundsById]);

  useEffect(() => {
    const normalized = Object.keys(computedGroupOverlapMap)
      .sort()
      .map((groupId) => `${groupId}:${(computedGroupOverlapMap[groupId] || []).slice().sort().join(',')}`)
      .join('|');

    if (groupOverlapStateSignatureRef.current === normalized) {
      return;
    }
    groupOverlapStateSignatureRef.current = normalized;
    setGroupOverlapMap(computedGroupOverlapMap);
  }, [computedGroupOverlapMap, setGroupOverlapMap]);

  const promptGroupViews = useMemo<PromptGroupView[]>(() => {
    if (isNodeDragActive && stablePromptGroupViewsRef.current.length > 0) {
      return stablePromptGroupViewsRef.current;
    }

    if (!activeCanvas) return [];

    const nextPromptGroupViews = activeCanvas.promptNodes
      .filter((promptNode) => !(promptNode.isDraft && !promptNode.isGenerating))
      .filter((promptNode) => !promptNode.hiddenInCanvas)
      .filter((promptNode) => !(
        promptNode.mode === GenerationMode.ECOMMERCE
        && promptNode.ecommerce?.frameworkId
        && promptNode.ecommerce.kind !== 'framework'
      ))
      .map((promptNode) => {
        const childImages = childImagesByPromptId.get(promptNode.id) || [];
        const bounds = promptGroupBoundsById.get(promptNode.id);
        if (!bounds) {
          return null;
        }

        const isOverlapping = (currentGroupOverlapMap[promptNode.id] || []).length > 0;
        const tier: PromptGroupTier = focusedGroupId === promptNode.id && isOverlapping
          ? 'focused'
          : currentGeneratingGroupIds.includes(promptNode.id)
            ? 'generating'
            : 'base';

        return {
          id: promptNode.id,
          rootPrompt: promptNode,
          childImages,
          intraGroupEdges: childImages.map((childNode) => ({ fromId: promptNode.id, toId: childNode.id })),
          bounds,
          baseOrder: currentPromptGroupLayerById.get(promptNode.id) ?? promptNode.zIndex ?? 0,
          tier,
          isOverlapping,
        } satisfies PromptGroupView;
      })
      .filter((groupView): groupView is PromptGroupView => Boolean(groupView));
    stablePromptGroupViewsRef.current = nextPromptGroupViews;
    return nextPromptGroupViews;
  }, [
    activeCanvas,
    childImagesByPromptId,
    currentGeneratingGroupIds,
    currentGroupOverlapMap,
    currentPromptGroupLayerById,
    focusedGroupId,
    isNodeDragActive,
    promptGroupBoundsById,
  ]);

  const visiblePromptGroupViews = useMemo(() => {
    const promptIdSet = new Set(currentVisiblePromptNodes.map((promptNode) => promptNode.id));
    const imageIdSet = new Set(currentVisibleImageNodes.map((imageNode) => imageNode.id));

    return promptGroupViews
      .filter((groupView) => {
        const isPromptVisible = promptIdSet.has(groupView.rootPrompt.id);
        const hasVisibleChild = groupView.childImages.some((imageNode) => imageIdSet.has(imageNode.id));
        return isPromptVisible || hasVisibleChild || groupView.tier !== 'base';
      })
      .sort((left, right) => {
        const tierDiff = PROMPT_GROUP_TIER_WEIGHT[left.tier] - PROMPT_GROUP_TIER_WEIGHT[right.tier];
        if (tierDiff !== 0) return tierDiff;
        const orderDiff = left.baseOrder - right.baseOrder;
        if (orderDiff !== 0) return orderDiff;
        return left.rootPrompt.timestamp - right.rootPrompt.timestamp;
      });
  }, [currentVisibleImageNodes, currentVisiblePromptNodes, promptGroupViews]);

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
      const childImages = childImagesByPromptId.get(promptNode.id) || [];
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
    canvasInteractionPhase,
    childImagesByPromptId,
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
    actualChildImagesByPromptId,
    actualChildImageIdsByPromptId,
    promptGroupNodeIdsById,
    promptGroupRegroupLayoutsById,
    promptGroupBoundsById,
    promptGroupViews,
    visiblePromptGroupViews,
    syncLiveNodePositionState,
    resolvePromptGroupIdForNodeId,
    resolveCanvasNodePositionForLiveDrag,
    applyLiveNodeDeltaToDraggedSet,
    handleImageCardHeightChange,
    handleFocusPromptGroup,
    beginPromptGroupRegroup,
    settlePromptGroupRegroup,
    clearPromptGroupRegroup,
  };
}
