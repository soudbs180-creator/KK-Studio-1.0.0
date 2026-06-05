import React from 'react';

import { GenerationMode, type AspectRatio, type Canvas, type CanvasGroup } from '../types';
import type { ArrangeMode } from '../context/CanvasContext';
import { getPromptNodeBoundsWidth } from '../utils/promptNodeCardWidth';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';
import type { SelectionMenuOverlay } from './AppCanvasOverlays';

interface SelectionMenuPosition {
  x: number;
  y: number;
}

interface SelectionCardDimensions {
  width: number;
  totalHeight: number;
}

interface UseSelectionMenuOverlayArgs {
  activeCanvas: Canvas | null | undefined;
  selectedNodeIds: string[];
  selectionMenuPosition: SelectionMenuPosition | null;
  isMobile: boolean;
  closeSelectionMenu: () => void;
  actualChildImageIdsByPromptId: Map<string, string[]>;
  deletePromptNode: (nodeId: string) => void;
  deleteImageNode: (nodeId: string) => void;
  deleteWorkflowNode: (nodeId: string) => void;
  removeGroup: (groupId: string) => void;
  addGroup: (group: CanvasGroup) => void;
  clearSelection: () => void;
  arrangeAllNodes: (mode: ArrangeMode) => void;
  getCardDimensions: (aspectRatio?: AspectRatio, includeFooter?: boolean) => SelectionCardDimensions;
  onTag: () => void;
  onOpenMigrate: () => void;
}

export function useSelectionMenuOverlay({
  activeCanvas,
  selectedNodeIds,
  selectionMenuPosition,
  isMobile,
  closeSelectionMenu,
  actualChildImageIdsByPromptId,
  deletePromptNode,
  deleteImageNode,
  deleteWorkflowNode,
  removeGroup,
  addGroup,
  clearSelection,
  arrangeAllNodes,
  getCardDimensions,
  onTag,
  onOpenMigrate,
}: UseSelectionMenuOverlayArgs): SelectionMenuOverlay | null {
  const handleDeleteSelectionMenuNodes = React.useCallback(() => {
    if (!activeCanvas) {
      return;
    }

    const prompts = activeCanvas.promptNodes.filter((node) => selectedNodeIds.includes(node.id));
    const images = activeCanvas.imageNodes.filter((node) => selectedNodeIds.includes(node.id));
    const workflowNodes = (activeCanvas.workflow?.nodes || []).filter((node) => (
      selectedNodeIds.includes(node.id) && isWorkflowUtilityNodeKind(node.kind)
    ));

    prompts.forEach((node) => deletePromptNode(node.id));
    images.forEach((node) => deleteImageNode(node.id));
    workflowNodes.forEach((node) => deleteWorkflowNode(node.id));
    clearSelection();
    closeSelectionMenu();
  }, [
    activeCanvas,
    selectedNodeIds,
    deletePromptNode,
    deleteImageNode,
    deleteWorkflowNode,
    clearSelection,
    closeSelectionMenu,
  ]);

  const handleGroupSelectionMenuNodes = React.useCallback(() => {
    if (!activeCanvas) {
      return;
    }

    const prompts = activeCanvas.promptNodes.filter((node) => selectedNodeIds.includes(node.id));
    const childImageIds = prompts.flatMap((promptNode) => actualChildImageIdsByPromptId.get(promptNode.id) || []);
    const images = activeCanvas.imageNodes.filter((node) => (
      selectedNodeIds.includes(node.id) || childImageIds.includes(node.id)
    ));

    const selectedNodeSet = new Set([...prompts.map((node) => node.id), ...images.map((node) => node.id)]);
    const existingGroupsInSelection = activeCanvas.groups.filter((group) => (
      group.nodeIds.some((nodeId) => selectedNodeSet.has(nodeId))
    ));

    const allMergedNodeIds = new Set<string>();
    existingGroupsInSelection.forEach((group) => group.nodeIds.forEach((nodeId) => allMergedNodeIds.add(nodeId)));
    selectedNodeSet.forEach((nodeId) => allMergedNodeIds.add(nodeId));

    const existingLabels = existingGroupsInSelection
      .map((group) => group.label?.trim())
      .filter((label): label is string => !!label && label !== 'Group');
    const uniqueLabels = [...new Set(existingLabels)];
    const mergedLabel = uniqueLabels.length === 0
      ? undefined
      : uniqueLabels.length === 1
        ? uniqueLabels[0]
        : uniqueLabels.join(' + ');

    existingGroupsInSelection.forEach((group) => removeGroup(group.id));

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const allPrompts = activeCanvas.promptNodes.filter((node) => allMergedNodeIds.has(node.id));
    const allImages = activeCanvas.imageNodes.filter((node) => allMergedNodeIds.has(node.id));

    allPrompts.forEach((node) => {
      const width = getPromptNodeBoundsWidth(node, isMobile);
      const height = node.height || 200;
      minX = Math.min(minX, node.position.x - width / 2);
      maxX = Math.max(maxX, node.position.x + width / 2);
      minY = Math.min(minY, node.position.y - height);
      maxY = Math.max(maxY, node.position.y);
    });

    allImages.forEach((node) => {
      const { width, totalHeight } = getCardDimensions(node.aspectRatio, true);
      minX = Math.min(minX, node.position.x - width / 2);
      maxX = Math.max(maxX, node.position.x + width / 2);
      minY = Math.min(minY, node.position.y - totalHeight);
      maxY = Math.max(maxY, node.position.y);
    });

    if (minX === Infinity) {
      closeSelectionMenu();
      return;
    }

    const padding = 40;
    const topExtra = 40;
    const bottomExtra = 40;
    const group: CanvasGroup = {
      id: Date.now().toString(),
      nodeIds: [...allMergedNodeIds],
      bounds: {
        x: minX - padding,
        y: minY - (padding + topExtra),
        width: (maxX - minX) + padding * 2,
        height: (maxY - minY) + padding + topExtra + bottomExtra,
      },
      label: mergedLabel,
      type: 'custom',
    };

    addGroup(group);
    clearSelection();
    closeSelectionMenu();
  }, [
    activeCanvas,
    selectedNodeIds,
    actualChildImageIdsByPromptId,
    removeGroup,
    getCardDimensions,
    isMobile,
    addGroup,
    clearSelection,
    closeSelectionMenu,
  ]);

  const handleSelectionMenuMigrate = React.useCallback(() => {
    closeSelectionMenu();
    onOpenMigrate();
  }, [closeSelectionMenu, onOpenMigrate]);

  const handleSelectionMenuArrange = React.useCallback((mode: ArrangeMode) => {
    arrangeAllNodes(mode);
    closeSelectionMenu();
  }, [arrangeAllNodes, closeSelectionMenu]);

  return React.useMemo(() => {
    if (!selectionMenuPosition || selectedNodeIds.length === 0 || !activeCanvas) {
      return null;
    }

    const selectedPrompts = activeCanvas.promptNodes.filter((node) => selectedNodeIds.includes(node.id));
    const selectedImages = activeCanvas.imageNodes.filter((node) => selectedNodeIds.includes(node.id));
    const videoCount = selectedImages.filter((imageNode) => (
      imageNode.mode === GenerationMode.VIDEO
      || imageNode.url?.includes('.mp4')
      || imageNode.url?.startsWith('data:video')
    )).length;

    // 简体中文注释：计算当前选区是否允许整理排列
    const canArrange = (() => {
      // 情况 1：仅选中了 1 个 prompt 卡片，且该 prompt 卡片有生成的子图片，那么可以通过整理来重新排列它的子卡片
      if (selectedPrompts.length === 1 && selectedImages.length === 0) {
        const promptNode = selectedPrompts[0];
        const childImages = activeCanvas.imageNodes.filter((image) => image.parentPromptId === promptNode.id);
        if (childImages.length > 0) return true;
      }

      // 情况 2：计算独立的“根”节点总数。
      const promptIdsSet = new Set(selectedPrompts.map((n) => n.id));
      const uniqueRoots = new Set<string>();

      selectedNodeIds.forEach((id) => {
        const prompt = activeCanvas.promptNodes.find((n) => n.id === id);
        if (prompt) {
          uniqueRoots.add(prompt.id);
          return;
        }
        const image = activeCanvas.imageNodes.find((n) => n.id === id);
        if (!image) return;
        // 如果图片的 parentPromptId 也在选区中，它们同属于一个 root 组
        if (image.parentPromptId && promptIdsSet.has(image.parentPromptId)) {
          uniqueRoots.add(image.parentPromptId);
        } else {
          uniqueRoots.add(image.id);
        }
      });

      return uniqueRoots.size >= 2;
    })();

    return {
      position: selectionMenuPosition,
      selectedCount: selectedNodeIds.length,
      groupCount: selectedPrompts.length,
      imageCount: selectedImages.length - videoCount,
      videoCount,
      onDelete: handleDeleteSelectionMenuNodes,
      onGroup: handleGroupSelectionMenuNodes,
      onTag,
      onMigrate: handleSelectionMenuMigrate,
      onArrange: handleSelectionMenuArrange,
      canArrange,
    } satisfies SelectionMenuOverlay;
  }, [
    selectionMenuPosition,
    selectedNodeIds,
    activeCanvas,
    handleDeleteSelectionMenuNodes,
    handleGroupSelectionMenuNodes,
    onTag,
    handleSelectionMenuMigrate,
    handleSelectionMenuArrange,
  ]);
}
