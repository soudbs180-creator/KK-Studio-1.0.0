import React from 'react';

import { type AspectRatio, type Canvas, type CanvasGroup } from '../types';
import type { ArrangeMode } from '../context/CanvasContext';
import { getPromptNodeBoundsWidth } from '../utils/promptNodeCardWidth';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';
import type { SelectionMenuOverlay } from './AppCanvasOverlays';
import { useFavoritesStore } from '../features/favorites';
import { notify } from '../services/system/notificationService';

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
  canvasTransform: { x: number; y: number; scale: number };
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
  canvasTransform,
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
  const favoriteItems = useFavoritesStore((state) => state.items);
  const favoritesLoaded = useFavoritesStore((state) => state.loaded);
  const loadFavorites = useFavoritesStore((state) => state.load);
  const addImageFavorite = useFavoritesStore((state) => state.addImageFavorite);
  const addPromptFavorite = useFavoritesStore((state) => state.addPromptFavorite);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);

  const selectedNodeIdSet = React.useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  React.useEffect(() => {
    if (!selectionMenuPosition || selectedNodeIds.length === 0 || favoritesLoaded) {
      return;
    }

    void loadFavorites();
  }, [favoritesLoaded, loadFavorites, selectionMenuPosition, selectedNodeIds.length]);

  const handleDeleteSelectionMenuNodes = React.useCallback(() => {
    if (!activeCanvas) {
      return;
    }

    const prompts = activeCanvas.promptNodes.filter((node) => selectedNodeIdSet.has(node.id));
    const images = activeCanvas.imageNodes.filter((node) => selectedNodeIdSet.has(node.id));
    const workflowNodes = (activeCanvas.workflow?.nodes || []).filter((node) => (
      selectedNodeIdSet.has(node.id) && isWorkflowUtilityNodeKind(node.kind)
    ));

    prompts.forEach((node) => deletePromptNode(node.id));
    images.forEach((node) => deleteImageNode(node.id));
    workflowNodes.forEach((node) => deleteWorkflowNode(node.id));
    clearSelection();
    closeSelectionMenu();
  }, [
    activeCanvas,
    selectedNodeIdSet,
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

    const prompts = activeCanvas.promptNodes.filter((node) => selectedNodeIdSet.has(node.id));
    const childImageIdSet = new Set(prompts.flatMap((promptNode) => actualChildImageIdsByPromptId.get(promptNode.id) || []));
    const images = activeCanvas.imageNodes.filter((node) => (
      selectedNodeIdSet.has(node.id) || childImageIdSet.has(node.id)
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
      color: '#ffffff',
      type: 'custom',
    };

    addGroup(group);
    clearSelection();
    closeSelectionMenu();
  }, [
    activeCanvas,
    selectedNodeIdSet,
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

  const handleFavoriteSelectionMenuNodes = React.useCallback(async () => {
    if (!activeCanvas) return;
    if (!useFavoritesStore.getState().loaded) {
      await useFavoritesStore.getState().load();
    }

    const currentFavoriteItems = useFavoritesStore.getState().items;
    const prompts = activeCanvas.promptNodes.filter((node) => selectedNodeIdSet.has(node.id));
    const images = activeCanvas.imageNodes.filter((node) => selectedNodeIdSet.has(node.id));

    // 计算哪些已被收藏
    const itemsToRemoveFavoriteIds: string[] = [];

    prompts.forEach(p => {
      const fav = currentFavoriteItems.find(item => (
        item.kind === 'favorite-prompt'
        && (
          item.sourcePromptId === p.id
          || item.prompt.trim() === p.prompt.trim()
        )
      ));
      if (fav) {
        itemsToRemoveFavoriteIds.push(fav.id);
      }
    });

    images.forEach(img => {
      const fav = currentFavoriteItems.find(item => (
        item.kind === 'favorite-image'
        && (
          item.sourceImageId === img.id
          || (!!img.storageId && item.storageId === img.storageId)
          || (!!img.originalUrl && item.originalUrl === img.originalUrl)
          || (!!img.apiResultUrl && item.apiResultUrl === img.apiResultUrl)
          || (!!img.url && item.url === img.url)
        )
      ));
      if (fav) {
        itemsToRemoveFavoriteIds.push(fav.id);
      }
    });

    const isAllFav = (prompts.length + images.length) > 0 && (itemsToRemoveFavoriteIds.length === prompts.length + images.length);

    try {
      if (isAllFav) {
        // 全部取消收藏
        for (const favId of itemsToRemoveFavoriteIds) {
          await removeFavorite(favId);
        }
        notify.success('取消收藏成功', '已取消收藏选中节点');
      } else {
        // 收藏未收藏的
        for (const p of prompts) {
          const fav = currentFavoriteItems.find(item => (
            item.kind === 'favorite-prompt'
            && (
              item.sourcePromptId === p.id
              || item.prompt.trim() === p.prompt.trim()
            )
          ));
          if (!fav) {
            await addPromptFavorite(p);
          }
        }
        for (const img of images) {
          const fav = currentFavoriteItems.find(item => (
            item.kind === 'favorite-image'
            && (
              item.sourceImageId === img.id
              || (!!img.storageId && item.storageId === img.storageId)
              || (!!img.originalUrl && item.originalUrl === img.originalUrl)
              || (!!img.apiResultUrl && item.apiResultUrl === img.apiResultUrl)
              || (!!img.url && item.url === img.url)
            )
          ));
          if (!fav) {
            await addImageFavorite(img);
          }
        }
        notify.success('收藏成功', '已将选中节点添加至收藏');
      }
    } catch (e) {
      console.error('[useSelectionMenuOverlay] 收藏操作失败:', e);
      notify.error('操作失败', '无法更新节点收藏状态');
    }
  }, [activeCanvas, selectedNodeIdSet, addPromptFavorite, addImageFavorite, removeFavorite]);

  const dynamicPosition = React.useMemo(() => {
    if (!selectionMenuPosition || selectedNodeIds.length === 0 || !activeCanvas) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasNodes = false;

    activeCanvas.promptNodes
      .filter((node) => selectedNodeIdSet.has(node.id))
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
      .filter((node) => selectedNodeIdSet.has(node.id))
      .forEach((node) => {
        const { width, totalHeight } = getCardDimensions(node.aspectRatio, true);
        minX = Math.min(minX, node.position.x - width / 2);
        maxX = Math.max(maxX, node.position.x + width / 2);
        minY = Math.min(minY, node.position.y - totalHeight);
        maxY = Math.max(maxY, node.position.y);
        hasNodes = true;
      });

    const workflowNodes = activeCanvas.workflow?.nodes || [];
    workflowNodes
      .filter((node) => selectedNodeIdSet.has(node.id) && isWorkflowUtilityNodeKind(node.kind))
      .forEach((node) => {
        const width = node.width || 284;
        const height = node.height || 176;
        minX = Math.min(minX, node.position.x - width / 2);
        maxX = Math.max(maxX, node.position.x + width / 2);
        minY = Math.min(minY, node.position.y - height);
        maxY = Math.max(maxY, node.position.y);
        hasNodes = true;
      });

    if (!hasNodes) {
      return selectionMenuPosition;
    }

    const centerX = (minX + maxX) / 2;
    const topY = minY;

    return {
      x: centerX * canvasTransform.scale + canvasTransform.x,
      y: topY * canvasTransform.scale + canvasTransform.y,
    };
  }, [selectionMenuPosition, selectedNodeIds.length, activeCanvas, canvasTransform, isMobile, getCardDimensions, selectedNodeIdSet]);

  return React.useMemo(() => {
    if (!selectionMenuPosition || selectedNodeIds.length === 0 || !activeCanvas) {
      return null;
    }

    const selectedPrompts = activeCanvas.promptNodes.filter((node) => selectedNodeIdSet.has(node.id));
    const selectedImages = activeCanvas.imageNodes.filter((node) => selectedNodeIdSet.has(node.id));
    const selectedImageParentPromptIdSet = new Set(selectedImages.map((image) => image.parentPromptId).filter(Boolean));
    const selectedPromptIdSet = new Set(selectedPrompts.map((prompt) => prompt.id));

    // 计算卡组、提示词和结果数量
    const groupPrompts = selectedPrompts.filter((prompt) => selectedImageParentPromptIdSet.has(prompt.id));
    const cardGroupCount = groupPrompts.length;

    const isolatedPrompts = selectedPrompts.filter((prompt) => !selectedImageParentPromptIdSet.has(prompt.id));
    const isolatedPromptCount = isolatedPrompts.length;

    const isolatedImages = selectedImages.filter((image) => !image.parentPromptId || !selectedPromptIdSet.has(image.parentPromptId));
    const isolatedResultCount = isolatedImages.length;

    // 计算是否全部已收藏
    const promptFavCount = selectedPrompts.filter(p => {
      return favoriteItems.some(item => (
        item.kind === 'favorite-prompt'
        && (
          item.sourcePromptId === p.id
          || item.prompt.trim() === p.prompt.trim()
        )
      ));
    }).length;
    const imageFavCount = selectedImages.filter(img => {
      return favoriteItems.some(item => (
        item.kind === 'favorite-image'
        && (
          item.sourceImageId === img.id
          || (!!img.storageId && item.storageId === img.storageId)
          || (!!img.originalUrl && item.originalUrl === img.originalUrl)
          || (!!img.apiResultUrl && item.apiResultUrl === img.apiResultUrl)
          || (!!img.url && item.url === img.url)
        )
      ));
    }).length;
    const totalSelected = selectedPrompts.length + selectedImages.length;
    const isAllFavorite = totalSelected > 0 && (promptFavCount + imageFavCount === totalSelected);

    // 简体中文注释：计算当前选区是否允许整理排列
    const canArrange = (() => {
      // 情况 1：仅选中了 1 个 prompt 卡片，且该 prompt 卡片有生成的子图片，那么可以通过整理来重新排列它的子卡片
      if (selectedPrompts.length === 1 && selectedImages.length === 0) {
        const promptNode = selectedPrompts[0];
        const childImages = activeCanvas.imageNodes.filter((image) => image.parentPromptId === promptNode.id);
        if (childImages.length > 0) return true;
      }

      // 情况 2：计算独立的“根”节点总数。
      const promptById = new Map(activeCanvas.promptNodes.map((node) => [node.id, node]));
      const imageById = new Map(activeCanvas.imageNodes.map((node) => [node.id, node]));
      const uniqueRoots = new Set<string>();

      selectedNodeIds.forEach((id) => {
        const prompt = promptById.get(id);
        if (prompt) {
          uniqueRoots.add(prompt.id);
          return;
        }
        const image = imageById.get(id);
        if (!image) return;
        // 如果图片的 parentPromptId 也在选区中，它们同属于一个 root 组
        if (image.parentPromptId && selectedPromptIdSet.has(image.parentPromptId)) {
          uniqueRoots.add(image.parentPromptId);
        } else {
          uniqueRoots.add(image.id);
        }
      });

      return uniqueRoots.size >= 2;
    })();

    return {
      position: dynamicPosition || selectionMenuPosition,
      selectedCount: selectedNodeIds.length,
      cardGroupCount,
      isolatedPromptCount,
      isolatedResultCount,
      onDelete: handleDeleteSelectionMenuNodes,
      onGroup: handleGroupSelectionMenuNodes,
      onTag,
      onMigrate: handleSelectionMenuMigrate,
      onArrange: handleSelectionMenuArrange,
      canArrange,
      onFavorite: handleFavoriteSelectionMenuNodes,
      isAllFavorite,
    } satisfies SelectionMenuOverlay;
  }, [
    selectionMenuPosition,
    dynamicPosition,
    selectedNodeIds,
    selectedNodeIdSet,
    activeCanvas,
    favoriteItems,
    handleDeleteSelectionMenuNodes,
    handleGroupSelectionMenuNodes,
    onTag,
    handleSelectionMenuMigrate,
    handleSelectionMenuArrange,
    handleFavoriteSelectionMenuNodes,
  ]);
}
