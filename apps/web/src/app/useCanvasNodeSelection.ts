import React from 'react';

import type { AspectRatio, Canvas } from '../types';
import { getPromptNodeBoundsWidth } from '../utils/promptNodeCardWidth';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';

interface CanvasTransformState {
  x: number;
  y: number;
  scale: number;
}

interface SelectionMenuPosition {
  x: number;
  y: number;
}

interface SelectionCardDimensions {
  width: number;
  totalHeight: number;
}

interface UseCanvasNodeSelectionArgs {
  activeCanvas: Canvas | null | undefined;
  canvasTransform: CanvasTransformState;
  isMobile: boolean;
  getCardDimensions: (aspectRatio?: AspectRatio, includeFooter?: boolean) => SelectionCardDimensions;
  resolvePromptGroupIdForNodeId: (nodeId: string) => string | null;
  selectNodes: (ids: string[], mode?: 'replace' | 'toggle' | 'add' | 'remove') => void;
  setFocusedGroupId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectionMenuPosition: React.Dispatch<React.SetStateAction<SelectionMenuPosition | null>>;
}

type NodeSelectionOptions = {
  focusGroupId?: string | null;
  resolveFocusGroup?: boolean;
};

type CanvasNodeSelectionApi = {
  getSelectionScreenCenter: (nodeIds: string[]) => SelectionMenuPosition | null;
  openSelectionMenuForNodeIds: (nodeIds: string[]) => void;
  selectNodeFromCurrentEvent: (nodeId: string, options?: NodeSelectionOptions) => void;
  handleCanvasNodeSelect: (nodeId: string) => void;
};

export function useCanvasNodeSelection({
  activeCanvas,
  canvasTransform,
  isMobile,
  getCardDimensions,
  resolvePromptGroupIdForNodeId,
  selectNodes,
  setFocusedGroupId,
  setSelectionMenuPosition,
}: UseCanvasNodeSelectionArgs): CanvasNodeSelectionApi {
  const getSelectionScreenCenter = React.useCallback((nodeIds: string[]) => {
    if (!activeCanvas || nodeIds.length === 0) return null;

    const nodeIdSet = new Set(nodeIds);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasNodes = false;

    activeCanvas.promptNodes
      .filter((node) => nodeIdSet.has(node.id))
      .forEach((node) => {
        const width = getPromptNodeBoundsWidth(node, isMobile);
        const height = node.height || 200;
        minX = Math.min(minX, node.position.x - width / 2);
        maxX = Math.max(maxX, node.position.x + width / 2);
        minY = Math.min(minY, node.position.y - height);
        maxY = Math.max(maxY, node.position.y);
        hasNodes = true;
      });

    activeCanvas.imageNodes
      .filter((node) => nodeIdSet.has(node.id))
      .forEach((node) => {
        const { width, totalHeight } = getCardDimensions(node.aspectRatio, true);
        minX = Math.min(minX, node.position.x - width / 2);
        maxX = Math.max(maxX, node.position.x + width / 2);
        minY = Math.min(minY, node.position.y - totalHeight);
        maxY = Math.max(maxY, node.position.y);
        hasNodes = true;
      });

    (activeCanvas.workflow?.nodes || [])
      .filter((node) => nodeIdSet.has(node.id) && isWorkflowUtilityNodeKind(node.kind))
      .forEach((node) => {
        const width = node.width || 284;
        const height = node.height || 176;
        minX = Math.min(minX, node.position.x - width / 2);
        maxX = Math.max(maxX, node.position.x + width / 2);
        minY = Math.min(minY, node.position.y - height);
        maxY = Math.max(maxY, node.position.y);
        hasNodes = true;
      });

    if (!hasNodes) return null;

    const centerX = (minX + maxX) / 2;
    const topY = minY;

    return {
      x: centerX * canvasTransform.scale + canvasTransform.x,
      y: topY * canvasTransform.scale + canvasTransform.y,
    };
  }, [activeCanvas, canvasTransform.scale, canvasTransform.x, canvasTransform.y, getCardDimensions, isMobile]);

  const openSelectionMenuForNodeIds = React.useCallback((nodeIds: string[]) => {
    const position = getSelectionScreenCenter(nodeIds);
    setSelectionMenuPosition(position);
  }, [getSelectionScreenCenter, setSelectionMenuPosition]);

  const selectNodeFromCurrentEvent = React.useCallback((nodeId: string, options?: NodeSelectionOptions) => {
    if (options?.resolveFocusGroup) {
      setFocusedGroupId(resolvePromptGroupIdForNodeId(nodeId));
    } else if (Object.prototype.hasOwnProperty.call(options || {}, 'focusGroupId')) {
      setFocusedGroupId(options?.focusGroupId ?? null);
    }

    const currentEvent = window.event as MouseEvent | undefined;
    const selectionMode = currentEvent?.shiftKey ? 'toggle' : 'replace';
    selectNodes([nodeId], selectionMode);

    if (currentEvent?.button === 2) {
      openSelectionMenuForNodeIds([nodeId]);
    }
  }, [
    openSelectionMenuForNodeIds,
    resolvePromptGroupIdForNodeId,
    selectNodes,
    setFocusedGroupId,
  ]);

  const handleCanvasNodeSelect = React.useCallback((nodeId: string) => {
    selectNodeFromCurrentEvent(nodeId, { resolveFocusGroup: true });
  }, [selectNodeFromCurrentEvent]);

  return {
    getSelectionScreenCenter,
    openSelectionMenuForNodeIds,
    selectNodeFromCurrentEvent,
    handleCanvasNodeSelect,
  };
}
