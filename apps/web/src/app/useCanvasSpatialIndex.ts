import React, { useMemo } from 'react';
import type { CanvasGroup, CanvasNoteNode, GeneratedImage, PromptNode } from '../types';
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
    noteNodes?: CanvasNoteNode[];
    workflow?: {
      nodes?: any[];
    };
  } | null | undefined;
  isMobile: boolean;
  imageCardHeightById: Record<string, number>;
  getComputedGroupBounds: (group: CanvasGroup) => { x: number; y: number; width: number; height: number } | null | undefined;
  excludedNodeIds?: ReadonlySet<string>;
}

export interface CanvasSpatialIndexResult {
  spatialIndex: CanvasSpatialIndex;
  promptNodeById: Map<string, PromptNode>;
  imageNodeById: Map<string, GeneratedImage>;
  workflowNodeById: Map<string, WorkflowUtilityCanvasNode>;
  noteNodeById: Map<string, CanvasNoteNode>;
  groupById: Map<string, CanvasGroup>;
}

// 简体中文：空间索引构建 Hook。在此 Hook 中为所有节点建立网格桶空间索引，并生成 ID 对应节点的 Lookup Map，供视口裁剪实现 O(1) 查询。
export function useCanvasSpatialIndex(deps: UseCanvasSpatialIndexDeps): CanvasSpatialIndexResult {
  const { activeCanvas, isMobile, imageCardHeightById, getComputedGroupBounds, excludedNodeIds } = deps;

  return useMemo(() => {
    const smokePerfEnabled = typeof window !== 'undefined' && Boolean((window as any).__KK_LARGE_CANVAS_SMOKE__);
    const startedAt = smokePerfEnabled ? performance.now() : 0;
    let stageStartedAt = startedAt;
    const logStage = (stage: string) => {
      if (!smokePerfEnabled) {
        return;
      }
      const now = performance.now();
      console.log(`[Workspace10k] spatial-index:${stage} stage=${Math.round(now - stageStartedAt)} total=${Math.round(now - startedAt)}`);
      stageStartedAt = now;
    };

    const index = new CanvasSpatialIndex(1000);
    const promptNodeById = new Map<string, PromptNode>();
    const imageNodeById = new Map<string, GeneratedImage>();
    const workflowNodeById = new Map<string, WorkflowUtilityCanvasNode>();
    const noteNodeById = new Map<string, CanvasNoteNode>();
    const groupById = new Map<string, CanvasGroup>();

    if (!activeCanvas) {
      return {
        spatialIndex: index,
        promptNodeById,
        imageNodeById,
        workflowNodeById,
        noteNodeById,
        groupById,
      };
    }

    // 1. 插入 Prompt 节点
    activeCanvas.promptNodes.forEach((node) => {
      promptNodeById.set(node.id, node);
      if (excludedNodeIds?.has(node.id)) return;
      const width = getPromptNodeBoundsWidth(node, isMobile);
      const height = node.height || 200;
      const x = node.position.x - width / 2;
      const y = node.position.y - height;
      index.updateNode(node.id, { x, y, width, height });
    });
    logStage(`prompts:${activeCanvas.promptNodes.length}`);

    // 2. 插入 Image 节点
    activeCanvas.imageNodes.forEach((node) => {
      imageNodeById.set(node.id, node);
      if (excludedNodeIds?.has(node.id)) return;
      const { width, totalHeight } = getCardDimensions(node.aspectRatio, true);
      const height = imageCardHeightById[node.id] ?? totalHeight;
      const x = node.position.x - width / 2;
      const y = node.position.y - height;
      index.updateNode(node.id, { x, y, width, height });
    });
    logStage(`images:${activeCanvas.imageNodes.length}`);

    // 3. 插入 Workflow 节点
    const workflowNodes = activeCanvas.workflow?.nodes || [];
    workflowNodes.forEach((node) => {
      if (isWorkflowUtilityNodeKind(node.kind)) {
        workflowNodeById.set(node.id, node as WorkflowUtilityCanvasNode);
        if (excludedNodeIds?.has(node.id)) return;
        const width = node.width || 284;
        const height = node.height || 176;
        const x = node.position.x - width / 2;
        const y = node.position.y - height;
        index.updateNode(node.id, { x, y, width, height });
      }
    });
    logStage(`workflow:${workflowNodes.length}`);

    (activeCanvas.noteNodes || []).forEach((note) => {
      noteNodeById.set(note.id, note);
      if (excludedNodeIds?.has(note.id)) return;
      index.updateNode(note.id, {
        x: note.position.x - note.width / 2,
        y: note.position.y - note.height,
        width: note.width,
        height: note.height,
      });
    });
    logStage(`notes:${activeCanvas.noteNodes?.length || 0}`);

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
    logStage(`groups:${activeCanvas.groups.length}`);

    return {
      spatialIndex: index,
      promptNodeById,
      imageNodeById,
      workflowNodeById,
      noteNodeById,
      groupById,
    };
  }, [
    activeCanvas?.promptNodes,
    activeCanvas?.imageNodes,
    activeCanvas?.workflow?.nodes,
    activeCanvas?.noteNodes,
    activeCanvas?.groups,
    isMobile,
    imageCardHeightById,
    getComputedGroupBounds,
    excludedNodeIds,
  ]);
}
