import React, { useState, useCallback, useEffect, startTransition } from 'react';
import { type InfiniteCanvasHandle } from '../components/canvas/InfiniteCanvas';
import { type CanvasInteractionPhase } from '../canvas/liveScene';
import { type WorkflowUtilityCanvasNode } from '../app/appCanvasTypes';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';
import { createCanvasFitTransform } from '../canvas/canvasViewportPersistence.ts';
import { CANVAS_FOCUS_BOUNDS_EVENT } from '../canvas/canvasViewportEvents.ts';
import {
  canvasScreenPointToWorld,
  getAvailableCanvasViewport,
  type CanvasViewportInsets,
} from '../canvas/canvasAvailableViewport.ts';

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
  const viewAnimationFrameRef = React.useRef<number | null>(null);
  const canvasTransformRef = React.useRef(canvasTransform);
  canvasTransformRef.current = canvasTransform;

  const getViewportInsets = useCallback((rect: DOMRect): CanvasViewportInsets => {
    const rail = document.getElementById('project-manager-container')?.getBoundingClientRect();
    const topChrome = document.querySelector<HTMLElement>('.desktop-left-chrome')?.getBoundingClientRect();
    const promptBar = document.getElementById('prompt-bar-container')?.getBoundingClientRect();
    return {
      left: rail ? Math.max(0, rail.right - rect.left + 12) : 0,
      right: 0,
      top: topChrome ? Math.max(0, topChrome.bottom - rect.top + 12) : 0,
      bottom: promptBar ? Math.max(0, rect.bottom - promptBar.top + 12) : 0,
    };
  }, []);

  const getUsableViewport = useCallback(() => {
    const rect = canvasRef.current?.getCanvasRect();
    if (!rect) return null;
    return {
      rect,
      available: getAvailableCanvasViewport(rect, getViewportInsets(rect)),
    };
  }, [canvasRef, getViewportInsets]);

  const animateToView = useCallback((target: { x: number; y: number; scale: number }, durationMs = 220) => {
    if (viewAnimationFrameRef.current !== null) {
      cancelAnimationFrame(viewAnimationFrameRef.current);
      viewAnimationFrameRef.current = null;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const start = canvas.getCurrentTransform();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || durationMs <= 0) {
      canvas.setView(target.x, target.y, target.scale);
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      canvas.setView(
        start.x + (target.x - start.x) * eased,
        start.y + (target.y - start.y) * eased,
        start.scale + (target.scale - start.scale) * eased,
      );
      if (progress < 1) {
        viewAnimationFrameRef.current = requestAnimationFrame(step);
      } else {
        viewAnimationFrameRef.current = null;
      }
    };
    viewAnimationFrameRef.current = requestAnimationFrame(step);
  }, [canvasRef]);

  useEffect(() => () => {
    if (viewAnimationFrameRef.current !== null) cancelAnimationFrame(viewAnimationFrameRef.current);
  }, []);

  const syncViewportCenter = useCallback(() => {
    const usable = getUsableViewport();
    const center = usable?.available || {
      centerX: window.innerWidth / 2,
      centerY: window.innerHeight / 2,
    };
    setViewportCenter(canvasScreenPointToWorld({
      x: center.centerX,
      y: center.centerY,
    }, canvasTransformRef.current));
  }, [getUsableViewport, setViewportCenter]);

  useEffect(() => {
    syncViewportCenter();
  }, [canvasTransform, syncViewportCenter]);

  // Keep creation and focus commands centered in the canvas area not covered by app chrome.
  useEffect(() => {
    window.addEventListener('resize', syncViewportCenter);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncViewportCenter) : null;
    const canvas = document.getElementById('canvas-container');
    const promptBar = document.getElementById('prompt-bar-container');
    if (canvas) observer?.observe(canvas);
    if (promptBar) observer?.observe(promptBar);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncViewportCenter);
    };
  }, [canvasRef, syncViewportCenter]);

  // 简体中文：AI接管平滑定位画布事件处理器
  useEffect(() => {
    const handleCenterOnNode = (e: Event) => {
      const { x, y, nodeId } = (e as CustomEvent).detail;
      const usable = getUsableViewport();
      const current = canvasRef.current?.getCurrentTransform();
      if (usable && current) {
        animateToView({
          x: usable.available.centerX - x * current.scale,
          y: usable.available.centerY - y * current.scale,
          scale: current.scale,
        });
      }
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
  }, [animateToView, canvasRef, getUsableViewport]);

  useEffect(() => {
    const handleFocusBounds = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const usable = getUsableViewport();
      if (!usable || !detail?.bounds) return;
      const target = createCanvasFitTransform([detail.bounds], {
        width: usable.available.width,
        height: usable.available.height,
      }, {
        padding: 56,
        minScale: detail.minScale ?? 0.5,
        maxScale: detail.maxScale ?? 1.15,
      });
      if (target) animateToView({
        ...target,
        x: target.x + usable.available.x,
        y: target.y + usable.available.y,
      }, detail.durationMs ?? 220);
    };
    window.addEventListener(CANVAS_FOCUS_BOUNDS_EVENT, handleFocusBounds);
    return () => window.removeEventListener(CANVAS_FOCUS_BOUNDS_EVENT, handleFocusBounds);
  }, [animateToView, getUsableViewport]);

  // 干净的平滑导航定位逻辑
  const handleNavigateToNode = useCallback((targetX: number, targetY: number, id?: string) => {
    const available = getUsableViewport()?.available;
    const screenCenterX = available?.centerX ?? window.innerWidth / 2;
    const screenCenterY = available?.centerY ?? window.innerHeight / 2;

    // 计算居中目标所需的新位置
    // 我们希望: targetX * scale + transformX = screenCenterX
    // 所以: transformX = screenCenterX - targetX * scale

    // 用户请求“平移并缩放”。
    const targetScale = 1; // 重置为 1:1 视图

    const newX = screenCenterX - targetX * targetScale;
    const newY = screenCenterY - targetY * targetScale;

    // 命令式更新: 通知 InfiniteCanvas 移动
    animateToView({ x: newX, y: newY, scale: targetScale });

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
  }, [animateToView, getUsableViewport]);

  // 重置视图：优先选中选中的组，否则退回到最新节点
  const handleResetView = useCallback(() => {
    if (!activeCanvas) return;

    // 1. 如果有选中，先将视图居中于选中的组/节点
    if (selectedNodeIds.length > 0) {
      const selectedNodeIdSet = new Set(selectedNodeIds);
      const allPositions = [
        ...activeCanvas.promptNodes
          .filter((p: any) => selectedNodeIdSet.has(p.id))
          .map((p: any) => p.position),
        ...activeCanvas.imageNodes
          .filter((img: any) => selectedNodeIdSet.has(img.id))
          .map((img: any) => img.position),
        ...(activeCanvas.workflow?.nodes || [])
          .filter((node: any): node is WorkflowUtilityCanvasNode => (
            selectedNodeIdSet.has(node.id) && isWorkflowUtilityNodeKind(node.kind)
          ))
          .map((node: WorkflowUtilityCanvasNode) => node.position),
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
      let latestImage: any | null = null;
      activeCanvas.imageNodes.forEach((image: any) => {
        if (!latestImage || (image.timestamp || 0) > (latestImage.timestamp || 0)) {
          latestImage = image;
        }
      });

      if (latestImage) {
        handleNavigateToNode(latestImage.position.x, latestImage.position.y);
        return;
      }
      handleNavigateToNode(0, 0);
      return;
    }

    let latestPrompt: any | null = null;
    prompts.forEach((prompt: any) => {
      if (!latestPrompt || (prompt.timestamp || 0) > (latestPrompt.timestamp || 0)) {
        latestPrompt = prompt;
      }
    });

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
