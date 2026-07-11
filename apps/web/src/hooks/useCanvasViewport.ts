import React, { useState, useCallback, useEffect, startTransition } from 'react';
import { type InfiniteCanvasHandle } from '../components/canvas/InfiniteCanvas';
import { type CanvasInteractionPhase } from '../canvas/liveScene';
import { type WorkflowUtilityCanvasNode } from '../app/appCanvasTypes';
import { isWorkflowUtilityNodeKind } from '../workflow/schema';
import { createCanvasFitTransform } from '../canvas/canvasViewportPersistence.ts';
import { CANVAS_FOCUS_BOUNDS_EVENT } from '../canvas/canvasViewportEvents.ts';
import { getCanvasSceneBounds, unionCanvasSceneBounds } from '../canvas/canvasSceneGeometry.ts';
import {
  canvasScreenPointToWorld,
  getAvailableCanvasViewport,
  measureCanvasViewportInsets,
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

  const getViewportInsets = useCallback((rect: DOMRect) => measureCanvasViewportInsets(rect), []);

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
    const rail = document.getElementById('project-manager-container');
    const topChrome = document.querySelector<HTMLElement>('.desktop-left-chrome');
    const navigation = document.querySelector<HTMLElement>('.desktop-navigation-panel');
    if (canvas) observer?.observe(canvas);
    if (promptBar) observer?.observe(promptBar);
    if (rail) observer?.observe(rail);
    if (topChrome) observer?.observe(topChrome);
    if (navigation) observer?.observe(navigation);
    window.visualViewport?.addEventListener('resize', syncViewportCenter);
    window.visualViewport?.addEventListener('scroll', syncViewportCenter);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncViewportCenter);
      window.visualViewport?.removeEventListener('resize', syncViewportCenter);
      window.visualViewport?.removeEventListener('scroll', syncViewportCenter);
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
        ...(activeCanvas.noteNodes || [])
          .filter((node: any) => selectedNodeIdSet.has(node.id))
          .map((node: any) => node.position),
        ...(activeCanvas.groups || [])
          .filter((group: any) => selectedNodeIdSet.has(group.id))
          .map((group: any) => ({
            x: group.bounds.x + group.bounds.width / 2,
            y: group.bounds.y + group.bounds.height / 2,
          })),
      ];

      if (allPositions.length > 0) {
        const avgX = allPositions.reduce((sum, pos) => sum + pos.x, 0) / allPositions.length;
        const avgY = allPositions.reduce((sum, pos) => sum + pos.y, 0) / allPositions.length;
        handleNavigateToNode(avgX, avgY);
        return;
      }
    }

    const candidates = [
      ...activeCanvas.promptNodes.map((node: any) => ({ position: node.position, timestamp: node.timestamp || 0 })),
      ...activeCanvas.imageNodes.map((node: any) => ({ position: node.position, timestamp: node.timestamp || 0 })),
      ...(activeCanvas.noteNodes || []).map((node: any) => ({ position: node.position, timestamp: node.updatedAt || node.createdAt || 0 })),
      ...(activeCanvas.workflow?.nodes || []).map((node: any, index: number) => ({
        position: node.position,
        timestamp: Number(node.data?.updatedAt || node.data?.createdAt || index),
      })),
    ].sort((a, b) => b.timestamp - a.timestamp);
    if (candidates[0]) {
      handleNavigateToNode(candidates[0].position.x, candidates[0].position.y);
      return;
    }
    const scene = unionCanvasSceneBounds(getCanvasSceneBounds(activeCanvas));
    handleNavigateToNode(
      scene ? scene.x + scene.width / 2 : 0,
      scene ? scene.y + scene.height / 2 : 0,
    );
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
