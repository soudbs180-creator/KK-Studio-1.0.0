import React from 'react';
import { KK_LAYOUT } from '@kk/ui';

import {
  resolveCanvasV3ToolbarPlacement,
  type CanvasV3ScreenRect,
} from '../canvas/v3/edgeGeometry';
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

interface PositionedSelectionMenu extends SelectionMenuPosition {
  placement: SelectionMenuOverlay['placement'];
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

type FavoriteLookup = {
  promptIdBySourceId: Map<string, string>;
  promptIdByText: Map<string, string>;
  imageIdBySourceId: Map<string, string>;
  imageIdByStorageId: Map<string, string>;
  imageIdByOriginalUrl: Map<string, string>;
  imageIdByApiResultUrl: Map<string, string>;
  imageIdByUrl: Map<string, string>;
};

const buildFavoriteLookup = (items: unknown[]): FavoriteLookup => {
  const lookup: FavoriteLookup = {
    promptIdBySourceId: new Map(),
    promptIdByText: new Map(),
    imageIdBySourceId: new Map(),
    imageIdByStorageId: new Map(),
    imageIdByOriginalUrl: new Map(),
    imageIdByApiResultUrl: new Map(),
    imageIdByUrl: new Map(),
  };

  items.forEach((rawItem) => {
    const item = rawItem as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id : '';
    if (!id) return;

    if (item.kind === 'favorite-prompt') {
      if (typeof item.sourcePromptId === 'string' && item.sourcePromptId) {
        lookup.promptIdBySourceId.set(item.sourcePromptId, id);
      }
      if (typeof item.prompt === 'string') {
        const promptText = item.prompt.trim();
        if (promptText) {
          lookup.promptIdByText.set(promptText, id);
        }
      }
      return;
    }

    if (item.kind === 'favorite-image') {
      if (typeof item.sourceImageId === 'string' && item.sourceImageId) {
        lookup.imageIdBySourceId.set(item.sourceImageId, id);
      }
      if (typeof item.storageId === 'string' && item.storageId) {
        lookup.imageIdByStorageId.set(item.storageId, id);
      }
      if (typeof item.originalUrl === 'string' && item.originalUrl) {
        lookup.imageIdByOriginalUrl.set(item.originalUrl, id);
      }
      if (typeof item.apiResultUrl === 'string' && item.apiResultUrl) {
        lookup.imageIdByApiResultUrl.set(item.apiResultUrl, id);
      }
      if (typeof item.url === 'string' && item.url) {
        lookup.imageIdByUrl.set(item.url, id);
      }
    }
  });

  return lookup;
};

const getPromptFavoriteId = (lookup: FavoriteLookup, prompt: { id: string; prompt: string }) => (
  lookup.promptIdBySourceId.get(prompt.id)
  || lookup.promptIdByText.get(prompt.prompt.trim())
  || null
);

const getImageFavoriteId = (lookup: FavoriteLookup, image: {
  id: string;
  storageId?: string | null;
  originalUrl?: string | null;
  apiResultUrl?: string | null;
  url?: string | null;
}) => (
  lookup.imageIdBySourceId.get(image.id)
  || (image.storageId ? lookup.imageIdByStorageId.get(image.storageId) : undefined)
  || (image.originalUrl ? lookup.imageIdByOriginalUrl.get(image.originalUrl) : undefined)
  || (image.apiResultUrl ? lookup.imageIdByApiResultUrl.get(image.apiResultUrl) : undefined)
  || (image.url ? lookup.imageIdByUrl.get(image.url) : undefined)
  || null
);

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
  const favoriteLookup = React.useMemo(() => buildFavoriteLookup(favoriteItems), [favoriteItems]);

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
    const currentFavoriteLookup = buildFavoriteLookup(currentFavoriteItems);
    const prompts = activeCanvas.promptNodes.filter((node) => selectedNodeIdSet.has(node.id));
    const images = activeCanvas.imageNodes.filter((node) => selectedNodeIdSet.has(node.id));

    const itemsToRemoveFavoriteIds: string[] = [];

    prompts.forEach((prompt) => {
      const favId = getPromptFavoriteId(currentFavoriteLookup, prompt);
      if (favId) {
        itemsToRemoveFavoriteIds.push(favId);
      }
    });

    images.forEach((image) => {
      const favId = getImageFavoriteId(currentFavoriteLookup, image);
      if (favId) {
        itemsToRemoveFavoriteIds.push(favId);
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
        for (const prompt of prompts) {
          if (!getPromptFavoriteId(currentFavoriteLookup, prompt)) {
            await addPromptFavorite(prompt);
          }
        }
        for (const image of images) {
          if (!getImageFavoriteId(currentFavoriteLookup, image)) {
            await addImageFavorite(image);
          }
        }
        notify.success('收藏成功', '已将选中节点添加至收藏');
      }
    } catch (e) {
      console.error('[useSelectionMenuOverlay] 收藏操作失败:', e);
      notify.error('操作失败', '无法更新节点收藏状态');
    }
  }, [activeCanvas, selectedNodeIdSet, addPromptFavorite, addImageFavorite, removeFavorite]);

  const dynamicPosition = React.useMemo<PositionedSelectionMenu | null>(() => {
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
      return {
        ...selectionMenuPosition,
        placement: isMobile ? 'bottom' : 'right',
      };
    }

    const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight;
    const viewportInset = KK_LAYOUT.workspace.selectionToolbarViewportInset;
    const toolbarGap = KK_LAYOUT.workspace.selectionToolbarGap;
    const estimatedToolbarWidth = KK_LAYOUT.workspace.selectionToolbarEstimatedWidth;
    const estimatedToolbarHalfHeight = KK_LAYOUT.workspace.selectionToolbarEstimatedHalfHeight;
    const selectionRight = maxX * canvasTransform.scale + canvasTransform.x;
    const selectionLeft = minX * canvasTransform.scale + canvasTransform.x;
    const selectionTop = minY * canvasTransform.scale + canvasTransform.y;
    const selectionBottom = maxY * canvasTransform.scale + canvasTransform.y;
    const selectionCenterY = ((minY + maxY) / 2) * canvasTransform.scale + canvasTransform.y;
    const viewportTop = 48 + viewportInset;
    const viewportRight = viewportWidth - viewportInset;
    const viewportBottom = viewportHeight - viewportInset;
    const defaultCenterY = Math.min(
      viewportBottom - estimatedToolbarHalfHeight,
      Math.max(viewportTop + estimatedToolbarHalfHeight, selectionCenterY),
    );
    const blockedRects: CanvasV3ScreenRect[] = [];
    const addBlockedRect = (left: number, top: number, right: number, bottom: number) => {
      blockedRects.push({
        left: left * canvasTransform.scale + canvasTransform.x,
        top: top * canvasTransform.scale + canvasTransform.y,
        right: right * canvasTransform.scale + canvasTransform.x,
        bottom: bottom * canvasTransform.scale + canvasTransform.y,
      });
    };
    activeCanvas.promptNodes.filter((node) => !selectedNodeIdSet.has(node.id)).forEach((node) => {
      const width = getPromptNodeBoundsWidth(node, isMobile);
      addBlockedRect(
        node.position.x - width / 2,
        node.position.y - (node.height || 200),
        node.position.x + width / 2,
        node.position.y,
      );
    });
    activeCanvas.imageNodes.filter((node) => !selectedNodeIdSet.has(node.id)).forEach((node) => {
      const dimensions = getCardDimensions(node.aspectRatio, true);
      addBlockedRect(
        node.position.x - dimensions.width / 2,
        node.position.y - dimensions.totalHeight,
        node.position.x + dimensions.width / 2,
        node.position.y,
      );
    });
    (activeCanvas.workflow?.nodes || []).filter((node) => !selectedNodeIdSet.has(node.id)).forEach((node) => {
      const width = node.width || 284;
      addBlockedRect(
        node.position.x - width / 2,
        node.position.y - (node.height || 176),
        node.position.x + width / 2,
        node.position.y,
      );
    });

    if (isMobile) {
      return {
        x: selectionRight,
        y: defaultCenterY,
        placement: 'bottom',
      };
    }
    const toolbarHeight = estimatedToolbarHalfHeight * 2;
    const placement = resolveCanvasV3ToolbarPlacement(
      {
        left: selectionLeft,
        top: selectionTop,
        right: selectionRight,
        bottom: selectionBottom,
      },
      { width: estimatedToolbarWidth, height: toolbarHeight },
      {
        left: viewportInset,
        top: viewportTop,
        right: viewportRight,
        bottom: viewportBottom,
      },
      blockedRects,
    );
    return {
      x: placement.placement === 'left'
        ? placement.x + estimatedToolbarWidth + toolbarGap
        : placement.x - toolbarGap,
      y: placement.y + estimatedToolbarHalfHeight,
      placement: placement.placement,
    };
  }, [
    selectionMenuPosition,
    selectedNodeIds.length,
    activeCanvas,
    canvasTransform,
    isMobile,
    getCardDimensions,
    selectedNodeIdSet,
  ]);

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
    const promptFavCount = selectedPrompts.filter((prompt) => Boolean(getPromptFavoriteId(favoriteLookup, prompt))).length;
    const imageFavCount = selectedImages.filter((image) => Boolean(getImageFavoriteId(favoriteLookup, image))).length;
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
      placement: dynamicPosition?.placement || (isMobile ? 'bottom' : 'right'),
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
    favoriteLookup,
    handleDeleteSelectionMenuNodes,
    handleGroupSelectionMenuNodes,
    onTag,
    handleSelectionMenuMigrate,
    handleSelectionMenuArrange,
    handleFavoriteSelectionMenuNodes,
  ]);
}
