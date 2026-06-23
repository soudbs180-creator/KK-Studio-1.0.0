import React from 'react';

import type { AspectRatio, Canvas } from '../types';
import { getPromptNodeBoundsWidth } from '../utils/promptNodeCardWidth';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';
import type { Point, SelectionBoxState } from './appCanvasTypes';

interface CanvasTransformState {
  x: number;
  y: number;
  scale: number;
}

interface SelectionCardDimensions {
  width: number;
  totalHeight: number;
}

interface SelectionMenuPosition {
  x: number;
  y: number;
}

interface UseCanvasSelectionBoxArgs {
  activeCanvas: Canvas | null | undefined;
  canvasTransform: CanvasTransformState;
  isMobile: boolean;
  selectedNodeIds: string[];
  getCardDimensions: (aspectRatio?: AspectRatio, includeFooter?: boolean) => SelectionCardDimensions;
  selectNodes: (ids: string[], mode?: 'replace' | 'add' | 'remove' | 'toggle') => void;
  clearSelection: () => void;
  closeSelectionMenu: () => void;
  setSelectionMenuPosition: React.Dispatch<React.SetStateAction<SelectionMenuPosition | null>>;
}

interface UseCanvasSelectionBoxResult {
  selectionBox: SelectionBoxState;
  handleSelectionMouseDown: (event: React.MouseEvent) => void;
  handleSelectionMouseMove: (event: React.MouseEvent) => void;
  handleSelectionMouseUp: (event: React.MouseEvent) => void;
}

const BACKGROUND_BLOCKING_SELECTOR = '.prompt-node, .image-node, .group-container, button, input';

function intersectsRect(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (
    left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
  );
}

export function useCanvasSelectionBox({
  activeCanvas,
  canvasTransform,
  isMobile,
  selectedNodeIds,
  getCardDimensions,
  selectNodes,
  clearSelection,
  closeSelectionMenu,
  setSelectionMenuPosition,
}: UseCanvasSelectionBoxArgs): UseCanvasSelectionBoxResult {
  const [selectionBox, setSelectionBox] = React.useState<SelectionBoxState>(null);
  const selectionBoxRef = React.useRef<SelectionBoxState>(null);
  const selectionBoxFrameRef = React.useRef<number | null>(null);
  const pendingSelectionPointRef = React.useRef<Point>({ x: 0, y: 0 });
  const hasPendingSelectionPointRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    selectionBoxRef.current = selectionBox;
  }, [selectionBox]);

  React.useEffect(() => (
    () => {
      if (selectionBoxFrameRef.current !== null) {
        cancelAnimationFrame(selectionBoxFrameRef.current);
      }
    }
  ), []);

  const flushPendingSelectionBox = React.useCallback(() => {
    if (selectionBoxFrameRef.current !== null) {
      cancelAnimationFrame(selectionBoxFrameRef.current);
      selectionBoxFrameRef.current = null;
    }

    const currentSelection = selectionBoxRef.current;
    if (!currentSelection || !hasPendingSelectionPointRef.current) return currentSelection;

    const pendingPoint = pendingSelectionPointRef.current;
    currentSelection.current.x = pendingPoint.x;
    currentSelection.current.y = pendingPoint.y;
    hasPendingSelectionPointRef.current = false;

    // 原生 DOM 层面同步更新样式，以确保 flush 时位置正确
    const boxEl = document.getElementById('canvas-selection-box');
    if (boxEl) {
      const left = Math.min(currentSelection.start.x, currentSelection.current.x);
      const top = Math.min(currentSelection.start.y, currentSelection.current.y);
      const width = Math.abs(currentSelection.current.x - currentSelection.start.x);
      const height = Math.abs(currentSelection.current.y - currentSelection.start.y);

      boxEl.style.left = `${left}px`;
      boxEl.style.top = `${top}px`;
      boxEl.style.width = `${width}px`;
      boxEl.style.height = `${height}px`;
    }

    return currentSelection;
  }, []);

  const resolveSelectionMenuPosition = React.useCallback((nodeIds: string[]) => {
    if (!activeCanvas || nodeIds.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasNodes = false;

    activeCanvas.promptNodes
      .filter((node) => nodeIds.includes(node.id))
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
      .filter((node) => nodeIds.includes(node.id))
      .forEach((node) => {
        const { width, totalHeight } = getCardDimensions(node.aspectRatio, true);
        minX = Math.min(minX, node.position.x - width / 2);
        maxX = Math.max(maxX, node.position.x + width / 2);
        minY = Math.min(minY, node.position.y - totalHeight);
        maxY = Math.max(maxY, node.position.y);
        hasNodes = true;
      });

    if (!hasNodes) {
      return null;
    }

    return {
      x: ((minX + maxX) / 2) * canvasTransform.scale + canvasTransform.x,
      y: minY * canvasTransform.scale + canvasTransform.y,
    };
  }, [activeCanvas, canvasTransform, getCardDimensions, isMobile]);

  const handleSelectionMouseDown = React.useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const isNode = target.closest(BACKGROUND_BLOCKING_SELECTOR);

    if (event.button !== 2) {
      closeSelectionMenu();
    }

    if (event.button === 2 && !isNode) {
      event.preventDefault();
      event.stopPropagation();
      closeSelectionMenu();
      const nextSelectionBox = {
        start: { x: event.clientX, y: event.clientY },
        current: { x: event.clientX, y: event.clientY },
        active: true,
      };
      selectionBoxRef.current = nextSelectionBox;
      hasPendingSelectionPointRef.current = false;
      setSelectionBox(nextSelectionBox);
    }
  }, [closeSelectionMenu]);

  const handleSelectionMouseMove = React.useCallback((event: React.MouseEvent) => {
    const currentSelection = selectionBoxRef.current;
    if (!currentSelection || !currentSelection.active) return;

    pendingSelectionPointRef.current.x = event.clientX;
    pendingSelectionPointRef.current.y = event.clientY;
    hasPendingSelectionPointRef.current = true;
    if (selectionBoxFrameRef.current !== null) return;

    selectionBoxFrameRef.current = window.requestAnimationFrame(() => {
      selectionBoxFrameRef.current = null;
      if (!hasPendingSelectionPointRef.current) return;
      hasPendingSelectionPointRef.current = false;
      const pendingPoint = pendingSelectionPointRef.current;
      const currentSelection = selectionBoxRef.current;
      if (!currentSelection) return;

      currentSelection.current.x = pendingPoint.x;
      currentSelection.current.y = pendingPoint.y;

      // 0-Rerender 性能优化：直接操纵原生 DOM 元素，绕过 React Rerender 阻碍
      const boxEl = document.getElementById('canvas-selection-box');
      if (boxEl) {
        const left = Math.min(currentSelection.start.x, currentSelection.current.x);
        const top = Math.min(currentSelection.start.y, currentSelection.current.y);
        const width = Math.abs(currentSelection.current.x - currentSelection.start.x);
        const height = Math.abs(currentSelection.current.y - currentSelection.start.y);

        boxEl.style.left = `${left}px`;
        boxEl.style.top = `${top}px`;
        boxEl.style.width = `${width}px`;
        boxEl.style.height = `${height}px`;
      }
    });
  }, []);

  const handleSelectionMouseUp = React.useCallback((event: React.MouseEvent) => {
    const currentSelectionBox = flushPendingSelectionBox() ?? selectionBoxRef.current;
    if (!currentSelectionBox?.active) {
      return;
    }

    const startX = Math.min(currentSelectionBox.start.x, currentSelectionBox.current.x);
    const startY = Math.min(currentSelectionBox.start.y, currentSelectionBox.current.y);
    const endX = Math.max(currentSelectionBox.start.x, currentSelectionBox.current.x);
    const endY = Math.max(currentSelectionBox.start.y, currentSelectionBox.current.y);
    const width = endX - startX;
    const height = endY - startY;
    let nextSelectionIds: string[] = [];

    if (width > 5 || height > 5) {
      const canvasSelectionRect = {
        x: (startX - canvasTransform.x) / canvasTransform.scale,
        y: (startY - canvasTransform.y) / canvasTransform.scale,
        width: width / canvasTransform.scale,
        height: height / canvasTransform.scale,
      };

      const ids: string[] = [];

      activeCanvas?.promptNodes.forEach((node) => {
        const nodeWidth = getPromptNodeBoundsWidth(node, isMobile);
        const nodeHeight = node.height || 200;
        const nodeRect = {
          x: node.position.x - nodeWidth / 2,
          y: node.position.y - nodeHeight,
          width: nodeWidth,
          height: nodeHeight,
        };

        if (intersectsRect(nodeRect, canvasSelectionRect)) {
          ids.push(node.id);
        }
      });

      activeCanvas?.imageNodes.forEach((node) => {
        const { width: nodeWidth, totalHeight: nodeHeight } = getCardDimensions(node.aspectRatio, true);
        const nodeRect = {
          x: node.position.x - nodeWidth / 2,
          y: node.position.y - nodeHeight,
          width: nodeWidth,
          height: nodeHeight,
        };

        if (intersectsRect(nodeRect, canvasSelectionRect)) {
          ids.push(node.id);
        }
      });

      (activeCanvas?.workflow?.nodes || []).forEach((node) => {
        if (!isWorkflowUtilityNodeKind(node.kind)) return;
        const nodeWidth = node.width || 284;
        const nodeHeight = node.height || 176;
        const nodeRect = {
          x: node.position.x - nodeWidth / 2,
          y: node.position.y - nodeHeight,
          width: nodeWidth,
          height: nodeHeight,
        };

        if (intersectsRect(nodeRect, canvasSelectionRect)) {
          ids.push(node.id);
        }
      });

      nextSelectionIds = ids;
      if (ids.length > 0) {
        const selectionMode = event.ctrlKey ? 'remove' : (event.shiftKey ? 'add' : 'replace');
        selectNodes(ids, selectionMode);
      } else if (!event.shiftKey && !event.ctrlKey) {
        clearSelection();
      }
    } else if (event.button !== 2 && !event.shiftKey) {
      clearSelection();
    }

    if (event.button === 2) {
      const allSelectedIds = nextSelectionIds.length > 0 ? nextSelectionIds : selectedNodeIds;
      if (allSelectedIds.length > 0) {
        setSelectionMenuPosition(resolveSelectionMenuPosition(allSelectedIds));
      } else {
        closeSelectionMenu();
      }
    } else {
      closeSelectionMenu();
    }

    selectionBoxRef.current = null;
    hasPendingSelectionPointRef.current = false;
    setSelectionBox(null);
  }, [
    flushPendingSelectionBox,
    canvasTransform,
    activeCanvas,
    getCardDimensions,
    isMobile,
    selectNodes,
    clearSelection,
    closeSelectionMenu,
    resolveSelectionMenuPosition,
    setSelectionMenuPosition,
    selectedNodeIds,
  ]);

  return {
    selectionBox,
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  };
}
