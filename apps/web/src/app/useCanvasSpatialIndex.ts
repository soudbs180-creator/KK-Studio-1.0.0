import React, { useMemo } from 'react';
import type { CanvasGroup, GeneratedImage, PromptNode } from '../types';
import { CanvasSpatialIndex } from '../canvas/CanvasSpatialIndex';
import { getPromptNodeBoundsWidth } from '../utils/promptNodeCardWidth';
import { getCardDimensions } from '../utils/styleUtils';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';
import type { WorkflowUtilityCanvasNode } from './appCanvasTypes';

export interface UseCanvasSpatialIndexDeps {
  activeCanvas: {
    promptNodes: PromptNode[];
    imageNodes: GeneratedImage[];
    groups: CanvasGroup[];
    workflow?: {
      nodes?: any[];
    };
  } | null | undefined;
  isMobile: boolean;
  imageCardHeightById: Record<string, number>;
  getComputedGroupBounds: (group: CanvasGroup) => { x: number; y: number; width: number; height: number } | null | undefined;
}

export interface CanvasSpatialIndexResult {
  spatialIndex: CanvasSpatialIndex;
  promptNodeById: Map<string, PromptNode>;
  imageNodeById: Map<string, GeneratedImage>;
  workflowNodeById: Map<string, WorkflowUtilityCanvasNode>;
  groupById: Map<string, CanvasGroup>;
}

// 简体中文：空间索引构建 Hook。在此 Hook 中为所有节点建立网格桶空间索引，并生成 ID 对应节点的 Lookup Map，供视口裁剪实现 O(1) 查询。
export function useCanvasSpatialIndex(deps: UseCanvasSpatialIndexDeps): CanvasSpatialIndexResult {
  const { activeCanvas, isMobile, imageCardHeightById, getComputedGroupBounds } = deps;

  return useMemo(() => {
    const index = new CanvasSpatialIndex(1000);
    const promptNodeById = new Map<string, PromptNode>();
    const imageNodeById = new Map<string, GeneratedImage>();
    const workflowNodeById = new Map<string, WorkflowUtilityCanvasNode>();
    const groupById = new Map<string, CanvasGroup>();

    if (!activeCanvas) {
      return {
        spatialIndex: index,
        promptNodeById,
        imageNodeById,
        workflowNodeById,
        groupById,
      };
    }

    // 1. 插入 Prompt 节点
    activeCanvas.promptNodes.forEach((node) => {
      promptNodeById.set(node.id, node);
      const width = getPromptNodeBoundsWidth(node, isMobile);
      const height = node.height || 200;
      const x = node.position.x - width / 2;
      const y = node.position.y - height;
      index.updateNode(node.id, { x, y, width, height });
    });

    // 2. 插入 Image 节点
    activeCanvas.imageNodes.forEach((node) => {
      imageNodeById.set(node.id, node);
      const { width, totalHeight } = getCardDimensions(node.aspectRatio, true);
      const height = imageCardHeightById[node.id] ?? totalHeight;
      const x = node.position.x - width / 2;
      const y = node.position.y - height;
      index.updateNode(node.id, { x, y, width, height });
    });

    // 3. 插入 Workflow 节点
    const workflowNodes = activeCanvas.workflow?.nodes || [];
    workflowNodes.forEach((node) => {
      if (isWorkflowUtilityNodeKind(node.kind)) {
        workflowNodeById.set(node.id, node as WorkflowUtilityCanvasNode);
        const width = node.width || 284;
        const height = node.height || 176;
        const x = node.position.x - width / 2;
        const y = node.position.y - height;
        index.updateNode(node.id, { x, y, width, height });
      }
    });

    // 4. 插入 Group 节点
    activeCanvas.groups.forEach((group) => {
      if (!group.nodeIds || group.nodeIds.length === 0) {
        return;
      }
      groupById.set(group.id, group);
      const bounds = getComputedGroupBounds(group) || group.bounds;
      if (bounds) {
        index.updateNode(group.id, bounds);
      }
    });

    return {
      spatialIndex: index,
      promptNodeById,
      imageNodeById,
      workflowNodeById,
      groupById,
    };
  }, [
    activeCanvas?.promptNodes,
    activeCanvas?.imageNodes,
    activeCanvas?.workflow?.nodes,
    activeCanvas?.groups,
    isMobile,
    imageCardHeightById,
    getComputedGroupBounds,
  ]);
}
