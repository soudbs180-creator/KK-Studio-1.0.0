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
  moveSelectedNodesImmediate: (delta: Point, sourceNodeIdOrIds?: string | string[]) => void;
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
  commitPromptGroupDrag,
}: UsePromptGroupDragHandlersArgs) {
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
    if (shouldRegroup) {
      beginPromptGroupRegroup(node.id, childImages);
    } else {
      clearPromptGroupRegroup(node.id);
    }

    if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedNodeIds.length > 0 && selectedNodeIds.length > 1) {
      applyLiveNodeDeltaToDraggedSet(sourceNodeId, expandedSelectedNodeIds, delta);
      return;
    }

    if (shouldRegroup) {
      applyLiveNodeDeltaToDraggedSet(sourceNodeId, [sourceNodeId], delta);
      return;
    }

    applyLiveNodeDeltaToDraggedSet(sourceNodeId, groupNodeIds, delta);
  }, [
    applyLiveNodeDeltaToDraggedSet,
    beginPromptGroupRegroup,
    clearPromptGroupRegroup,
    expandedSelectedNodeIds,
    selectedNodeIds,
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

    if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedNodeIds.length > 0 && selectedNodeIds.length > 1) {
      clearPromptGroupRegroup(node.id);
      moveSelectedNodesImmediate(delta, expandedSelectedNodeIds);
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
    selectedNodeIds,
    shouldAutoRegroupPromptGroup,
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

    if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedNodeIds.length > 1) {
      applyLiveNodeDeltaToDraggedSet(sourceNodeId, expandedSelectedNodeIds, delta);
    }
  }, [
    applyLiveNodeDeltaToDraggedSet,
    clearPromptGroupRegroup,
    expandedSelectedNodeIds,
    selectedNodeIds,
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

    if (selectedNodeIds.includes(sourceNodeId) && expandedSelectedNodeIds.length > 1) {
      moveSelectedNodesImmediate(delta, expandedSelectedNodeIds);
      return;
    }

    moveSelectedNodesImmediate(delta, [sourceNodeId]);
  }, [
    clearPromptGroupRegroup,
    expandedSelectedNodeIds,
    moveSelectedNodesImmediate,
    selectedNodeIds,
  ]);

  return {
    handlePromptGroupDragDelta,
    handlePromptGroupDragCommit,
    handlePromptGroupChildDragDelta,
    handlePromptGroupChildDragCommit,
  };
}
