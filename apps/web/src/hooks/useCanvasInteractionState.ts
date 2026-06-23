import React, { useState, useCallback } from 'react';
import { useCanvasSelectionBox } from '../app/useCanvasSelectionBox';
import { useCanvasDragConnection } from '../app/useCanvasDragConnection';

export interface UseCanvasInteractionStateProps {
  activeCanvas: any;
  canvasTransform: { x: number; y: number; scale: number };
  isMobile: boolean;
  selectedNodeIds: string[];
  getCardDimensions: any;
  selectNodes: any;
  clearSelection: any;
  setSelectionMenuPosition: any;
  linkNodes: any;
}

export function useCanvasInteractionState({
  activeCanvas,
  canvasTransform,
  isMobile,
  selectedNodeIds,
  getCardDimensions,
  selectNodes,
  clearSelection,
  setSelectionMenuPosition,
  linkNodes,
}: UseCanvasInteractionStateProps) {
  // 框选相关的 hook
  const {
    selectionBox,
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  } = useCanvasSelectionBox({
    activeCanvas,
    canvasTransform,
    isMobile,
    selectedNodeIds,
    getCardDimensions,
    selectNodes,
    clearSelection,
    closeSelectionMenu: () => setSelectionMenuPosition(null),
    setSelectionMenuPosition: setSelectionMenuPosition as any,
  });

  // 连线相关的 hook
  const {
    dragConnection,
    handleConnectStart,
    handleConnectEnd,
    handleDragConnectionMouseMove,
    handleDragConnectionMouseUp,
  } = useCanvasDragConnection({
    canvasTransform,
    linkNodes,
  });

  // 节点拖动激活状态
  const [isNodeDragActive, setIsNodeDragActive] = useState(false);

  // 整合后的根节点鼠标移动处理器
  const handleRootMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleSelectionMouseMove(e);
      handleDragConnectionMouseMove(e);
    },
    [handleSelectionMouseMove, handleDragConnectionMouseMove]
  );

  // 整合后的根节点鼠标抬起处理器
  const handleRootMouseUp = useCallback(
    (e: React.MouseEvent) => {
      handleSelectionMouseUp(e);

      // 智能连线物理吸附与释放完成判定
      if (dragConnection?.active) {
        const targetEl = document.elementFromPoint(e.clientX, e.clientY);
        if (targetEl) {
          const cardEl = targetEl.closest('[id^="prompt-card-"], [id^="image-card-"], [id^="workflow-card-"]');
          if (cardEl) {
            const match = cardEl.id.match(/^(prompt-card|image-card|workflow-card)-(.*)$/);
            if (match) {
              const targetId = match[2];
              handleConnectEnd(targetId);
              return;
            }
          }
        }
      }

      handleDragConnectionMouseUp();
    },
    [handleSelectionMouseUp, handleDragConnectionMouseUp, dragConnection, handleConnectEnd]
  );

  return {
    selectionBox,
    handleSelectionMouseDown,
    dragConnection,
    handleConnectStart,
    handleConnectEnd,
    isNodeDragActive,
    setIsNodeDragActive,
    handleRootMouseMove,
    handleRootMouseUp,
  };
}
