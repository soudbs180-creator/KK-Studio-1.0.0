import React, { useRef } from 'react';
import type { CanvasGroup, GeneratedImage, PromptNode } from '../types';
import { GenerationMode } from '../types';
import type { WorkflowUtilityCanvasNode } from './appCanvasTypes';
import type { CanvasPerformanceProfile } from '../canvas/performanceProfile';
import { useCanvasSpatialIndex } from './useCanvasSpatialIndex';
import type { CanvasSpatialIndex } from '../canvas/CanvasSpatialIndex';

// 简体中文：定义 canvasTransform 的类型
export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

export interface UseVisibleCanvasItemsDeps {
  activeCanvas: {
    promptNodes: PromptNode[];
    imageNodes: GeneratedImage[];
    groups: CanvasGroup[];
    workflow?: {
      nodes?: any[];
    };
  } | null | undefined;
  canvasPerformanceProfile: CanvasPerformanceProfile;
  canvasTransform: CanvasTransform;
  collapsedCanvasGroupNodeIds: Set<string>;
  getComputedGroupBounds: (group: CanvasGroup) => { x: number; y: number; width: number; height: number } | null | undefined;
  isNodeDragActive: boolean;
  isPptDeckChildImageNode: (node: GeneratedImage) => boolean;
  promptGroupLayerById: Map<string, number>;
  promptGroupStackZIndexById: Map<string, number>;
  standaloneImageStackZIndexById: Map<string, number>;
  isMobile: boolean;
  imageCardHeightById: Record<string, number>;
  selectedNodeIds: string[];
  draftNodeId: string | null;
  isCanvasTransforming: boolean;
}

export interface VisibleCanvasItemsResult {
  visiblePromptNodes: PromptNode[];
  visibleImageNodes: GeneratedImage[];
  visibleWorkflowUtilityNodes: WorkflowUtilityCanvasNode[];
  visibleGroups: CanvasGroup[];
  nowTimestamp: number;
}

export interface UseVisibleCanvasItemsNewDeps {
  spatialIndex: CanvasSpatialIndex;
  promptNodeById: Map<string, PromptNode>;
  imageNodeById: Map<string, GeneratedImage>;
  workflowNodeById: Map<string, WorkflowUtilityCanvasNode>;
  groupById: Map<string, CanvasGroup>;
  viewportBounds: { vLeft: number; vTop: number; vRight: number; vBottom: number };
  activeCanvas: UseVisibleCanvasItemsDeps['activeCanvas'];
  collapsedCanvasGroupNodeIds: Set<string>;
  getComputedGroupBounds: UseVisibleCanvasItemsDeps['getComputedGroupBounds'];
  isNodeDragActive: boolean;
  isCanvasTransforming: boolean;
  isPptDeckChildImageNode: (node: GeneratedImage) => boolean;
  promptGroupLayerById: Map<string, number>;
  promptGroupStackZIndexById: Map<string, number>;
  standaloneImageStackZIndexById: Map<string, number>;
  selectedNodeIds: string[];
  draftNodeId: string | null;
}

// 简体中文：新版解耦可视区过滤 Hook，完全避免了对大数组的 filter 遍历，实现了 O(1) 的空间查询到卡片实例的高效查找。
export function useVisibleCanvasItemsNew(deps: UseVisibleCanvasItemsNewDeps): VisibleCanvasItemsResult {
  const {
    spatialIndex,
    promptNodeById,
    imageNodeById,
    workflowNodeById,
    groupById,
    viewportBounds,
    activeCanvas,
    collapsedCanvasGroupNodeIds,
    getComputedGroupBounds,
    isNodeDragActive,
    isCanvasTransforming,
    isPptDeckChildImageNode,
    promptGroupLayerById,
    promptGroupStackZIndexById,
    standaloneImageStackZIndexById,
    selectedNodeIds,
    draftNodeId,
  } = deps;

  const stableVisibleCanvasSceneRef = useRef<VisibleCanvasItemsResult>({
    visiblePromptNodes: [],
    visibleImageNodes: [],
    visibleWorkflowUtilityNodes: [],
    visibleGroups: [],
    nowTimestamp: Date.now(),
  });

  return React.useMemo(() => {
    if (isNodeDragActive) {
      return stableVisibleCanvasSceneRef.current;
    }

    if (isCanvasTransforming) {
      return stableVisibleCanvasSceneRef.current;
    }

    if (!activeCanvas) {
      return {
        visiblePromptNodes: [],
        visibleImageNodes: [],
        visibleWorkflowUtilityNodes: [],
        visibleGroups: [],
        nowTimestamp: Date.now(),
      };
    }

    const { vLeft, vTop, vRight, vBottom } = viewportBounds;

    const getPromptGroupStackZIndex = (promptNode: PromptNode) => (
      promptGroupStackZIndexById.get(promptNode.id)
      ?? ((promptGroupLayerById.get(promptNode.id) ?? promptNode.zIndex ?? 0) * 100 + 10)
    );

    const getImageGroupStackZIndex = (imageNode: GeneratedImage) => (
      imageNode.parentPromptId
        ? (
          promptGroupStackZIndexById.get(imageNode.parentPromptId)
          ?? ((promptGroupLayerById.get(imageNode.parentPromptId) ?? imageNode.zIndex ?? 0) * 100 + 10)
        )
        : (
          standaloneImageStackZIndexById.get(imageNode.id)
          ?? ((imageNode.zIndex ?? 0) * 100 + 10)
        )
    );

    // 🚀 核心优化：只查询 viewport 覆盖的 bucket 节点集合，杜绝遍历节点大数组
    const visibleIds = spatialIndex.query(vLeft, vTop, vRight, vBottom);

    const rawVisiblePrompts: PromptNode[] = [];
    const rawVisibleImages: GeneratedImage[] = [];
    const rawVisibleWorkflows: WorkflowUtilityCanvasNode[] = [];
    const rawVisibleGroups: CanvasGroup[] = [];

    // O(1) 过滤与搜集可视卡片
    visibleIds.forEach((id) => {
      const promptNode = promptNodeById.get(id);
      if (promptNode) {
        rawVisiblePrompts.push(promptNode);
        return;
      }

      const imageNode = imageNodeById.get(id);
      if (imageNode) {
        rawVisibleImages.push(imageNode);
        return;
      }

      const workflowNode = workflowNodeById.get(id);
      if (workflowNode) {
        rawVisibleWorkflows.push(workflowNode);
        return;
      }

      const group = groupById.get(id);
      if (group) {
        rawVisibleGroups.push(group);
      }
    });

    // 强制把 selected 与正在编辑的 draft 节点加入可见集合，防 unmount 状态丢失
    selectedNodeIds.forEach((id) => {
      if (!visibleIds.has(id)) {
        const promptNode = promptNodeById.get(id);
        if (promptNode) {
          rawVisiblePrompts.push(promptNode);
          return;
        }

        const imageNode = imageNodeById.get(id);
        if (imageNode) {
          rawVisibleImages.push(imageNode);
          return;
        }

        const workflowNode = workflowNodeById.get(id);
        if (workflowNode) {
          rawVisibleWorkflows.push(workflowNode);
        }
      }
    });

    if (draftNodeId && !visibleIds.has(draftNodeId)) {
      const promptNode = promptNodeById.get(draftNodeId);
      if (promptNode) {
        rawVisiblePrompts.push(promptNode);
      }
    }

    // A. 筛选并排序 Prompt 节点
    const visiblePromptNodes = rawVisiblePrompts
      .filter((node) => {
        if (collapsedCanvasGroupNodeIds.has(node.id)) {
          return false;
        }
        if (node.isDraft && !node.isGenerating && node.id !== draftNodeId) {
          return false;
        }
        if (node.hiddenInCanvas) {
          return false;
        }
        if (
          node.mode === GenerationMode.ECOMMERCE
          && node.ecommerce?.frameworkId
          && node.ecommerce.kind === 'a-plus-group'
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const zDiff = getPromptGroupStackZIndex(a) - getPromptGroupStackZIndex(b);
        if (zDiff !== 0) return zDiff;
        return a.timestamp - b.timestamp;
      });

    // B. 筛选并排序 Image 节点
    const visibleImageNodes = rawVisibleImages
      .filter((n) => {
        if (collapsedCanvasGroupNodeIds.has(n.id)) {
          return false;
        }
        if (isPptDeckChildImageNode(n)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const zDiff = getImageGroupStackZIndex(a) - getImageGroupStackZIndex(b);
        if (zDiff !== 0) return zDiff;
        return a.timestamp - b.timestamp;
      });

    // C. 筛选并排序 Workflow 节点
    const visibleWorkflowUtilityNodes = rawVisibleWorkflows
      .filter((node) => !collapsedCanvasGroupNodeIds.has(node.id))
      .sort((left, right) => {
        const zDiff = (left.zIndex ?? 0) - (right.zIndex ?? 0);
        if (zDiff !== 0) return zDiff;
        return left.id.localeCompare(right.id);
      });

    // D. 筛选可见的 Group 边界 (保持视口碰撞)
    const visibleGroups = rawVisibleGroups
      .filter((g) => {
        if (!g.nodeIds || g.nodeIds.length === 0) {
          return false;
        }
        const resolvedGroupBounds = getComputedGroupBounds(g) || g.bounds;
        const groupViewportBounds = g.collapsed
          ? {
            x: resolvedGroupBounds.x,
            y: resolvedGroupBounds.y,
            width: Math.max(180, Math.min(320, resolvedGroupBounds.width)),
            height: 44,
          }
          : resolvedGroupBounds;
        const { x, y, width, height } = groupViewportBounds;
        return !(x > vRight || x + width < vLeft || y > vBottom || y + height < vTop);
      })
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    const nowTimestamp = Date.now();

    stableVisibleCanvasSceneRef.current = {
      visiblePromptNodes,
      visibleImageNodes,
      visibleWorkflowUtilityNodes,
      visibleGroups,
      nowTimestamp,
    };
    return stableVisibleCanvasSceneRef.current;
  }, [
    spatialIndex,
    promptNodeById,
    imageNodeById,
    workflowNodeById,
    viewportBounds,
    activeCanvas,
    collapsedCanvasGroupNodeIds,
    getComputedGroupBounds,
    isNodeDragActive,
    isCanvasTransforming,
    isPptDeckChildImageNode,
    promptGroupLayerById,
    promptGroupStackZIndexById,
    standaloneImageStackZIndexById,
    selectedNodeIds,
    draftNodeId,
  ]);
}

// 简体中文：向下兼容的经典可视区裁剪 Hook，内部桥接调用了新版的优化逻辑。
export function useVisibleCanvasItems(deps: UseVisibleCanvasItemsDeps): VisibleCanvasItemsResult {
  const {
    activeCanvas,
    canvasPerformanceProfile,
    canvasTransform,
    collapsedCanvasGroupNodeIds,
    getComputedGroupBounds,
    isNodeDragActive,
    isPptDeckChildImageNode,
    promptGroupLayerById,
    promptGroupStackZIndexById,
    standaloneImageStackZIndexById,
    isMobile,
    imageCardHeightById,
    selectedNodeIds,
    draftNodeId,
    isCanvasTransforming,
  } = deps;

  // 1. 构建空间索引与查找表
  const { spatialIndex, promptNodeById, imageNodeById, workflowNodeById, groupById } = useCanvasSpatialIndex({
    activeCanvas,
    isMobile,
    imageCardHeightById,
    getComputedGroupBounds,
  });

  // 2. 算视口范围与 buffer 缓存边界
  const RENDER_BUFFER = canvasPerformanceProfile.overscanBuffer;
  const VIRTUAL_BUFFER = Math.max(RENDER_BUFFER * 2.5, 2500);

  const viewportBounds = React.useMemo(() => {
    const vLeft = -canvasTransform.x / canvasTransform.scale - VIRTUAL_BUFFER;
    const vTop = -canvasTransform.y / canvasTransform.scale - VIRTUAL_BUFFER;
    const vRight = (window.innerWidth - canvasTransform.x) / canvasTransform.scale + VIRTUAL_BUFFER;
    const vBottom = (window.innerHeight - canvasTransform.y) / canvasTransform.scale + VIRTUAL_BUFFER;
    return { vLeft, vTop, vRight, vBottom };
  }, [canvasTransform.x, canvasTransform.y, canvasTransform.scale, VIRTUAL_BUFFER]);

  // 3. 桥接调用新版的 O(1) 极速裁剪查询
  return useVisibleCanvasItemsNew({
    spatialIndex,
    promptNodeById,
    imageNodeById,
    workflowNodeById,
    groupById,
    viewportBounds,
    activeCanvas,
    collapsedCanvasGroupNodeIds,
    getComputedGroupBounds,
    isNodeDragActive,
    isCanvasTransforming,
    isPptDeckChildImageNode,
    promptGroupLayerById,
    promptGroupStackZIndexById,
    standaloneImageStackZIndexById,
    selectedNodeIds,
    draftNodeId,
  });
}
