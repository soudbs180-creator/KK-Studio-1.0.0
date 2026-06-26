import React from 'react';

import type { GeneratedImage, PromptNode } from '../types';
import type { Point } from './appCanvasTypes';

interface UsePromptGroupDragHandlersArgs {
  selectedNodeIds: string[];
  expandedSelectedNodeIds: string[];
  shouldAutoRegroupPromptGroup: (node: PromptNode, childImages: GeneratedImage[], sourceNodeId: string) => boolean;
  beginPromptGroupRegroup: (groupId: string, childImages: GeneratedImage[]) => void;
  clearPromptGroupRegroup: (groupId: string) => void;
  applyLiveNodeDeltaToDraggedSet: (sourceNodeId: string, nodeIds: string[], delta: Point) => void;
  moveSelectedNodesImmediate: (delta: Point, sourceNodeIdOrIds?: string | string[], options?: { snapToGrid?: boolean }) => void;
  snapToGrid?: boolean;
  commitPromptGroupDrag: (
    node: PromptNode,
    childImages: GeneratedImage[],
    finalPosition: Point,
    shouldRegroup: boolean,
  ) => void;
}

interface PromptGroupDragDeltaArgs {
  node: PromptNode;
  childImages: GeneratedImage[];
  groupNodeIds: string[];
  delta: Point;
  sourceNodeId?: string;
}

interface PromptGroupDragCommitArgs {
  node: PromptNode;
  childImages: GeneratedImage[];
  delta: Point;
  sourceNodeId?: string;
  finalPosition?: Point | null;
}

interface PromptGroupChildDragArgs {
  groupId: string;
  delta: Point;
  sourceNodeId?: string;
}

export function usePromptGroupDragHandlers({
  selectedNodeIds,
  expandedSelectedNodeIds,
  shouldAutoRegroupPromptGroup,
  beginPromptGroupRegroup,
  clearPromptGroupRegroup,
  applyLiveNodeDeltaToDraggedSet,
  moveSelectedNodesImmediate,
  snapToGrid = false,
  commitPromptGroupDrag,
}: UsePromptGroupDragHandlersArgs) {
  const selectedNodeIdSet = React.useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const handlePromptGroupDragDelta = React.useCallback(({
    node,
    childImages,
    groupNodeIds,
    delta,
    sourceNodeId,
  }: PromptGroupDragDeltaArgs) => {
    if (!sourceNodeId) {
      return;
    }

    const shouldRegroup = shouldAutoRegroupPromptGroup(node, childImages, sourceNodeId);
    console.log('[prompt-group-debug] drag-delta ' + JSON.stringify({
      promptId: node.id,
      sourceNodeId,
      childCount: childImages.length,
      selectedCount: selectedNodeIds.length,
      shouldRegroup,
      delta,
    }));
    if (shouldRegroup) {
      beginPromptGroupRegroup(node.id, childImages);
      applyLiveNodeDeltaToDraggedSet(sourceNodeId, [sourceNodeId], delta);
      return;
    } else {
      clearPromptGroupRegroup(node.id);
    }

    if (selectedNodeIdSet.has(sourceNodeId) && expandedSelectedNodeIds.length > 0 && selectedNodeIds.length > 1) {
      applyLiveNodeDeltaToDraggedSet(sourceNodeId, expandedSelectedNodeIds, delta);
      return;
    }

    applyLiveNodeDeltaToDraggedSet(sourceNodeId, groupNodeIds, delta);
  }, [
    applyLiveNodeDeltaToDraggedSet,
    beginPromptGroupRegroup,
    clearPromptGroupRegroup,
    expandedSelectedNodeIds,
    selectedNodeIdSet,
    selectedNodeIds.length,
    shouldAutoRegroupPromptGroup,
  ]);

  const handlePromptGroupDragCommit = React.useCallback(({
    node,
    childImages,
    delta,
    sourceNodeId,
    finalPosition,
  }: PromptGroupDragCommitArgs) => {
    if (!sourceNodeId || !finalPosition) {
      return;
    }

    if (selectedNodeIdSet.has(sourceNodeId) && expandedSelectedNodeIds.length > 0 && selectedNodeIds.length > 1) {
      clearPromptGroupRegroup(node.id);
      moveSelectedNodesImmediate(delta, expandedSelectedNodeIds, { snapToGrid });
      return;
    }

    commitPromptGroupDrag(
      node,
      childImages,
      finalPosition,
      shouldAutoRegroupPromptGroup(node, childImages, sourceNodeId),
    );
  }, [
    clearPromptGroupRegroup,
    commitPromptGroupDrag,
    expandedSelectedNodeIds,
    moveSelectedNodesImmediate,
    selectedNodeIdSet,
    selectedNodeIds.length,
    shouldAutoRegroupPromptGroup,
    snapToGrid,
  ]);

  const handlePromptGroupChildDragDelta = React.useCallback(({
    groupId,
    delta,
    sourceNodeId,
  }: PromptGroupChildDragArgs) => {
    if (!sourceNodeId) {
      return;
    }

    clearPromptGroupRegroup(groupId);

    if (selectedNodeIdSet.has(sourceNodeId) && expandedSelectedNodeIds.length > 1) {
      applyLiveNodeDeltaToDraggedSet(sourceNodeId, expandedSelectedNodeIds, delta);
    }
  }, [
    applyLiveNodeDeltaToDraggedSet,
    clearPromptGroupRegroup,
    expandedSelectedNodeIds,
    selectedNodeIdSet,
  ]);

  const handlePromptGroupChildDragCommit = React.useCallback(({
    groupId,
    delta,
    sourceNodeId,
  }: PromptGroupChildDragArgs) => {
    if (!sourceNodeId) {
      return;
    }

    clearPromptGroupRegroup(groupId);

    if (selectedNodeIdSet.has(sourceNodeId) && expandedSelectedNodeIds.length > 1) {
      moveSelectedNodesImmediate(delta, expandedSelectedNodeIds, { snapToGrid });
      return;
    }

    moveSelectedNodesImmediate(delta, [sourceNodeId], { snapToGrid });
  }, [
    clearPromptGroupRegroup,
    expandedSelectedNodeIds,
    moveSelectedNodesImmediate,
    selectedNodeIdSet,
    snapToGrid,
  ]);

  return {
    handlePromptGroupDragDelta,
    handlePromptGroupDragCommit,
    handlePromptGroupChildDragDelta,
    handlePromptGroupChildDragCommit,
  };
}
