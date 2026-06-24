import React, { useRef } from 'react';
import type { CanvasGroup, GeneratedImage, PromptNode } from '../types';
import { GenerationMode } from '../types';
import type { WorkflowUtilityCanvasNode } from './appCanvasTypes';
import type { CanvasPerformanceProfile } from '../canvas/performanceProfile';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';
import { getPromptNodeBoundsWidth } from '../utils/promptNodeCardWidth';
import { getCardDimensions } from '../utils/styleUtils';
import { CanvasSpatialIndex } from '../canvas/CanvasSpatialIndex';

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

  // 简体中文：缓存上一次计算出来的可视场景，拖动中不触发可见性集重新生成以防节点 unmount 闪烁
  const stableVisibleCanvasSceneRef = useRef<VisibleCanvasItemsResult>({
    visiblePromptNodes: [],
    visibleImageNodes: [],
    visibleWorkflowUtilityNodes: [],
    visibleGroups: [],
    nowTimestamp: Date.now(),
  });

  // 简体中文：1. 构建基于网格桶（Grid Bucket）的空间索引，仅在节点数组或高度改变时重新构建
  const spatialIndex = React.useMemo(() => {
    const index = new CanvasSpatialIndex(1000);
    if (!activeCanvas) return index;

    // 简体中文：插入 Prompt 节点
    activeCanvas.promptNodes.forEach((node) => {
      const width = getPromptNodeBoundsWidth(node, isMobile);
      const height = node.height || 200;
      const x = node.position.x - width / 2;
      const y = node.position.y - height;
      index.updateNode(node.id, { x, y, width, height });
    });

    // 简体中文：插入 Image 节点
    activeCanvas.imageNodes.forEach((node) => {
      const { width, totalHeight } = getCardDimensions(node.aspectRatio, true);
      const height = imageCardHeightById[node.id] ?? totalHeight;
      const x = node.position.x - width / 2;
      const y = node.position.y - height;
      index.updateNode(node.id, { x, y, width, height });
    });

    // 简体中文：插入 Workflow 节点
    const workflowNodes = activeCanvas.workflow?.nodes || [];
    workflowNodes.forEach((node) => {
      if (isWorkflowUtilityNodeKind(node.kind)) {
        const width = node.width || 284;
        const height = node.height || 176;
        const x = node.position.x - width / 2;
        const y = node.position.y - height;
        index.updateNode(node.id, { x, y, width, height });
      }
    });

    return index;
  }, [
    activeCanvas?.promptNodes,
    activeCanvas?.imageNodes,
    activeCanvas?.workflow?.nodes,
    isMobile,
    imageCardHeightById,
  ]);

  // 简体中文：2. 视口裁剪逻辑
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

    // 简体中文：RENDER_BUFFER 视口外的缓存范围
    const RENDER_BUFFER = canvasPerformanceProfile.overscanBuffer;
    const VIRTUAL_BUFFER = Math.max(RENDER_BUFFER * 2.5, 2500);

    const vLeft = -canvasTransform.x / canvasTransform.scale - VIRTUAL_BUFFER;
    const vTop = -canvasTransform.y / canvasTransform.scale - VIRTUAL_BUFFER;
    const vRight = (window.innerWidth - canvasTransform.x) / canvasTransform.scale + VIRTUAL_BUFFER;
    const vBottom = (window.innerHeight - canvasTransform.y) / canvasTransform.scale + VIRTUAL_BUFFER;

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

    // 简体中文：通过空间索引查询可能在可视视口内的节点 ID 集合
    const visibleIds = spatialIndex.query(vLeft, vTop, vRight, vBottom);

    // 简体中文：为了防止 unmount 丢失输入状态，强制将 selected 节点以及正在编辑的 draft 节点视作可见
    selectedNodeIds.forEach((id) => visibleIds.add(id));
    if (draftNodeId) {
      visibleIds.add(draftNodeId);
    }

    // 简体中文：A. 筛选可见的 Prompt 节点并排序
    const visiblePromptNodes = activeCanvas.promptNodes
      .filter((n) => {
        if (collapsedCanvasGroupNodeIds.has(n.id)) {
          return false;
        }

        if (n.isDraft && !n.isGenerating && n.id !== draftNodeId) {
          return false;
        }

        if (n.hiddenInCanvas) {
          return false;
        }

        if (
          n.mode === GenerationMode.ECOMMERCE
          && n.ecommerce?.frameworkId
          && n.ecommerce.kind === 'a-plus-group'
        ) {
          return false;
        }

        return visibleIds.has(n.id);
      })
      .sort((a, b) => {
        const zDiff = getPromptGroupStackZIndex(a) - getPromptGroupStackZIndex(b);
        if (zDiff !== 0) return zDiff;
        return a.timestamp - b.timestamp;
      });

    // 简体中文：B. 筛选可见的 Image 节点并排序
    const visibleImageNodes = activeCanvas.imageNodes
      .filter((n) => {
        if (collapsedCanvasGroupNodeIds.has(n.id)) {
          return false;
        }

        if (isPptDeckChildImageNode(n)) {
          return false;
        }

        return visibleIds.has(n.id);
      })
      .sort((a, b) => {
        const zDiff = getImageGroupStackZIndex(a) - getImageGroupStackZIndex(b);
        if (zDiff !== 0) return zDiff;
        return a.timestamp - b.timestamp;
      });

    // 简体中文：C. 筛选可见的 Workflow 节点并排序
    const visibleWorkflowUtilityNodes = (activeCanvas.workflow?.nodes || [])
      .filter((node): node is WorkflowUtilityCanvasNode => isWorkflowUtilityNodeKind(node.kind))
      .filter((node) => {
        if (collapsedCanvasGroupNodeIds.has(node.id)) {
          return false;
        }

        return visibleIds.has(node.id);
      })
      .sort((left, right) => {
        const zDiff = (left.zIndex ?? 0) - (right.zIndex ?? 0);
        if (zDiff !== 0) return zDiff;
        return left.id.localeCompare(right.id);
      });

    // 简体中文：D. 筛选可见的 Group 边界
    const visibleGroups = activeCanvas.groups
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
    activeCanvas,
    canvasPerformanceProfile.overscanBuffer,
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
    spatialIndex,
    isCanvasTransforming,
  ]);
}
