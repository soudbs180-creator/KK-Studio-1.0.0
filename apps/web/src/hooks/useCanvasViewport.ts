import React, { useState, useCallback, useEffect, startTransition } from 'react';
import { type InfiniteCanvasHandle } from '../components/canvas/InfiniteCanvas';
import { type CanvasInteractionPhase } from '../canvas/liveScene';
import { type WorkflowUtilityCanvasNode } from '../app/appCanvasTypes';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';

export interface UseCanvasViewportProps {
  canvasRef: React.RefObject<InfiniteCanvasHandle | null>;
  activeCanvas: any;
  selectedNodeIds: string[];
  isReady: boolean;
  setViewportCenter: (center: { x: number; y: number }) => void;
}

export function useCanvasViewport({
  canvasRef,
  activeCanvas,
  selectedNodeIds,
  isReady,
  setViewportCenter,
}: UseCanvasViewportProps) {
  // Canvas transform 状态 (用于在可视区域中定位)
  const [canvasTransform, setCanvasTransform] = useState<{ x: number; y: number; scale: number }>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    scale: 1,
  });
  const [isCanvasTransforming, setIsCanvasTransforming] = useState(false);
  const [canvasInteractionPhase, setCanvasInteractionPhase] = useState<CanvasInteractionPhase>('idle');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // 同步视口中心到 CanvasContext 中，用于优先级加载
  useEffect(() => {
    // 计算当前画布坐标系下的视口中心
    const centerX = (window.innerWidth / 2 - canvasTransform.x) / canvasTransform.scale;
    const centerY = (window.innerHeight / 2 - canvasTransform.y) / canvasTransform.scale;
    setViewportCenter({ x: centerX, y: centerY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasTransform]); // 排除 setViewportCenter 以避免无限循环

  // 简体中文：AI接管平滑定位画布事件处理器
  useEffect(() => {
    const handleCenterOnNode = (e: Event) => {
      const { x, y, nodeId } = (e as CustomEvent).detail;
      setCanvasTransform((prev) => ({
        ...prev,
        x: window.innerWidth / 2 - x * prev.scale,
        y: window.innerHeight / 2 - y * prev.scale,
      }));
      setTimeout(() => {
        const el = document.querySelector(`#prompt-card-${nodeId}`) as HTMLElement;
        if (el) {
          el.classList.add('highlight-glow-ring');
          setTimeout(() => {
            el.classList.remove('highlight-glow-ring');
          }, 3000);
        }
      }, 100);
    };
    window.addEventListener('canvas-center-on-node', handleCenterOnNode);
    return () => window.removeEventListener('canvas-center-on-node', handleCenterOnNode);
  }, []);

  // 干净的平滑导航定位逻辑
  const handleNavigateToNode = useCallback((targetX: number, targetY: number, id?: string) => {
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;

    // 计算居中目标所需的新位置
    // 我们希望: targetX * scale + transformX = screenCenterX
    // 所以: transformX = screenCenterX - targetX * scale

    // 用户请求“平移并缩放”。
    const targetScale = 1; // 重置为 1:1 视图

    const newX = screenCenterX - targetX * targetScale;
    const newY = screenCenterY - targetY * targetScale;

    // 命令式更新: 通知 InfiniteCanvas 移动
    canvasRef.current?.setView(newX, newY, targetScale);

    // 保持本地状态同步
    setCanvasTransform({
      x: newX,
      y: newY,
      scale: targetScale,
    });

    if (id) {
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 3000); // 高亮 3 秒
    }
  }, [canvasRef]);

  // 重置视图：优先选中选中的组，否则退回到最新节点
  const handleResetView = useCallback(() => {
    if (!activeCanvas) return;

    // 1. 如果有选中，先将视图居中于选中的组/节点
    if (selectedNodeIds.length > 0) {
      const selectedPrompts = activeCanvas.promptNodes.filter((p: any) => selectedNodeIds.includes(p.id));
      const selectedImages = activeCanvas.imageNodes.filter((img: any) => selectedNodeIds.includes(img.id));
      const selectedWorkflowNodes = (activeCanvas.workflow?.nodes || []).filter(
        (node: any): node is WorkflowUtilityCanvasNode =>
          selectedNodeIds.includes(node.id) && isWorkflowUtilityNodeKind(node.kind)
      );

      const allPositions = [
        ...selectedPrompts.map((p: any) => p.position),
        ...selectedImages.map((img: any) => img.position),
        ...selectedWorkflowNodes.map((node: any) => node.position),
      ];

      if (allPositions.length > 0) {
        const avgX = allPositions.reduce((sum, pos) => sum + pos.x, 0) / allPositions.length;
        const avgY = allPositions.reduce((sum, pos) => sum + pos.y, 0) / allPositions.length;
        handleNavigateToNode(avgX, avgY);
        return;
      }
    }

    // 2. 如果没有提示词卡片，跳转到最新的生成图片卡片。
    const prompts = activeCanvas.promptNodes;
    if (prompts.length === 0) {
      const latestImage = [...activeCanvas.imageNodes].sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      )[0];
      if (latestImage) {
        handleNavigateToNode(latestImage.position.x, latestImage.position.y);
        return;
      }
      handleNavigateToNode(0, 0);
      return;
    }
    // 按时间戳降序排序
    const latestPrompt = [...prompts].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];

    if (latestPrompt) {
      // 查找关联图片以计算包围盒
      const childImages = activeCanvas.imageNodes.filter((img: any) => img.parentPromptId === latestPrompt.id);

      let targetX = latestPrompt.position.x;
      let targetY = latestPrompt.position.y;

      if (childImages.length > 0) {
        // 查找最低图片的底部
        const maxY = Math.max(...childImages.map((img: any) => img.position.y));
        // 目标垂直中心介于提示词底部和图片底部之间
        targetY = (latestPrompt.position.y + maxY) / 2;
      } else {
        // 如果还没有图片，居中定位到卡片主体（锚点是 Bottom，所以向上移动）
        targetY = latestPrompt.position.y - 100;
      }

      handleNavigateToNode(targetX, targetY);
    }
  }, [activeCanvas, handleNavigateToNode, selectedNodeIds]);

  const handleFitToAll = useCallback(() => {
    canvasRef.current?.fitToAll();
  }, [canvasRef]);

  const handleCanvasTransformChange = useCallback((nextTransform: { x: number; y: number; scale: number }) => {
    startTransition(() => {
      setCanvasTransform(nextTransform);
    });
  }, []);

  const handleCanvasInteractionChange = useCallback(
    (state: {
      isDragging: boolean;
      isZooming: boolean;
      interactionPhase: CanvasInteractionPhase;
      idleRelaxationMs: number;
    }) => {
      const nextValue = state.isDragging || state.isZooming;
      setIsCanvasTransforming((prev) => (prev === nextValue ? prev : nextValue));
      setCanvasInteractionPhase(state.interactionPhase);
    },
    []
  );

  return {
    canvasTransform,
    isCanvasTransforming,
    canvasInteractionPhase,
    highlightedId,
    setCanvasTransform,
    setIsCanvasTransforming,
    setCanvasInteractionPhase,
    handleCanvasTransformChange,
    handleCanvasInteractionChange,
    handleNavigateToNode,
    handleResetView,
    handleFitToAll,
    setHighlightedId,
  };
}
