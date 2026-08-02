import React, { useRef, useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Map, Minimize2, Minus, Plus } from 'lucide-react';
import { PROJECT_MANAGER_ACTIONS } from '../components/settings/settingsModuleActions';
import type { Canvas } from '../types';
import type { InfiniteCanvasHandle } from '../components/canvas/InfiniteCanvas';
import { buildMinimapSpatialIndex, selectMinimapVisibleNodes, type MinimapIndexedNode } from './minimapSpatialIndex';
import { computeCenteredZoomTransform } from './canvasNavigationMath';
import { setWorkspaceNavigationPanelWidth } from './workspaceLayoutRegistry';

// 简体中文：定义导航面板 of Props 接口
interface AppCanvasNavigationPanelProps {
  activeCanvas: Canvas | null | undefined; // 当前激活的画布数据
  canvasTransform: { x: number; y: number; scale: number }; // 画布实时变换
  canvasRef: React.RefObject<InfiniteCanvasHandle | null>; // 大画布实例引用
  isMobile: boolean; // 是否是移动端
  onFitToAll: () => void;
  onResetView: () => void;
  onAutoArrange: () => void;
}

const AppCanvasNavigationPanel: React.FC<AppCanvasNavigationPanelProps> = ({
  activeCanvas,
  canvasTransform,
  canvasRef,
  isMobile,
  onAutoArrange,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const lastTargetCenterRef = useRef<{ x: number; y: number } | null>(null);
  const activeDragFrameRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedCollapsedState = localStorage.getItem('kk_canvas_minimap_collapsed');
      return savedCollapsedState === null ? true : savedCollapsedState === 'true';
    }
    return true;
  });

  useEffect(() => {
    const panelWidth = isMobile || !activeCanvas ? 0 : isCollapsed ? 296 : 304;
    setWorkspaceNavigationPanelWidth(panelWidth);
    return () => setWorkspaceNavigationPanelWidth(0);
  }, [activeCanvas, isCollapsed, isMobile]);

  const [minimapScaleMultiplier, setMinimapScaleMultiplier] = useState(3.0);
  const [minimapCenterOffset, setMinimapCenterOffset] = useState<{ x: number; y: number } | null>(null);

  const minimapScaleMultiplierRef = useRef(3.0);
  const minimapCenterOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const setMinimapScale = (val: number) => {
    setMinimapScaleMultiplier(val);
    minimapScaleMultiplierRef.current = val;
  };

  const setMinimapOffset = (val: { x: number; y: number } | null) => {
    setMinimapCenterOffset(val);
    minimapCenterOffsetRef.current = val;
  };

  const toggleCollapsed = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('kk_canvas_minimap_collapsed', String(next));
  };

  // 1. 缓存大画布的实际尺寸，避免在渲染期调用 getCanvasRect() 引起 Forced Reflow
  const [containerSize, setContainerSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  }));

  const updateContainerSize = useCallback(() => {
    const rect = canvasRef.current?.getCanvasRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, [canvasRef]);

  // 2. 简体中文：新引入的延迟定位状态管理
  const [isEdited, setIsEdited] = useState(false);
  const [targetCenter, setTargetCenter] = useState<{ x: number; y: number } | null>(null);

  // 监听窗口尺寸变化，更新缓存宽高尺寸
  useEffect(() => {
    updateContainerSize();
    const handleResize = () => {
      updateContainerSize();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateContainerSize]);

  // 小地图的固定物理尺寸
  const miniWidth = 280;
  const miniHeight = 156;

  const scale = canvasTransform.scale || 1;

  // 3. 获取所有可见卡片的绝对位置
  const minimapSpatialIndex = React.useMemo(
    () => buildMinimapSpatialIndex(activeCanvas?.promptNodes, activeCanvas?.imageNodes),
    [activeCanvas?.promptNodes, activeCanvas?.imageNodes],
  );

  // 4. 确定大画布容器的实际尺寸，使用缓存值
  const containerWidth = containerSize.width;
  const containerHeight = containerSize.height;

  // 避免容器宽高计算为 0 导致缩放比例计算出错
  const safeContainerWidth = containerWidth <= 0 || isNaN(containerWidth) ? 800 : containerWidth;
  const safeContainerHeight = containerHeight <= 0 || isNaN(containerHeight) ? 600 : containerHeight;

  // 5. 计算视口（Viewport）在真实世界坐标系中的边界
  const safeScale = scale <= 0 || isNaN(scale) ? 1 : scale;
  const viewportMinX = -canvasTransform.x / safeScale;
  const viewportMinY = -canvasTransform.y / safeScale;
  const viewportMaxX = (safeContainerWidth - canvasTransform.x) / safeScale;
  const viewportMaxY = (safeContainerHeight - canvasTransform.y) / safeScale;


  const currentTargetScale = scale;
  const displayZoomPercent = Math.round(currentTargetScale * 100);

  // 6. 简体中文：重构小地图世界包围盒，基于当前实际视口宽高乘小地图自身倍数，保持聚焦框适中尺寸
  const viewportW = isNaN(viewportMaxX - viewportMinX) ? 800 : (viewportMaxX - viewportMinX);
  const viewportH = isNaN(viewportMaxY - viewportMinY) ? 600 : (viewportMaxY - viewportMinY);
  
  const viewportCenterX = viewportMinX + viewportW / 2;
  const viewportCenterY = viewportMinY + viewportH / 2;

  const currentCenterX = viewportCenterX + (minimapCenterOffset?.x || 0);
  const currentCenterY = viewportCenterY + (minimapCenterOffset?.y || 0);

  const totalWidth = viewportW * minimapScaleMultiplier;
  const totalHeight = viewportH * minimapScaleMultiplier;

  const minX = currentCenterX - totalWidth / 2;
  const maxX = currentCenterX + totalWidth / 2;
  const minY = currentCenterY - totalHeight / 2;
  const maxY = currentCenterY + totalHeight / 2;

  const safeTotalWidth = totalWidth <= 0 || isNaN(totalWidth) ? 1 : totalWidth;
  const safeTotalHeight = totalHeight <= 0 || isNaN(totalHeight) ? 1 : totalHeight;

  const visibleNodes = React.useMemo(
    () => selectMinimapVisibleNodes(minimapSpatialIndex, minX, minY, maxX, maxY),
    [minimapSpatialIndex, minX, minY, maxX, maxY],
  );

  // 7. 计算等比例缩放至小地图 (200x90) 的比例因子
  const scaleMiniX = miniWidth / safeTotalWidth;
  const scaleMiniY = miniHeight / safeTotalHeight;
  let scaleMini = Math.min(scaleMiniX, scaleMiniY);
  if (isNaN(scaleMini) || scaleMini === Infinity || scaleMini <= 0) {
    scaleMini = 0.1;
  }

  // 让内容在小地图中居中的偏移值
  const contentWidth = safeTotalWidth * scaleMini;
  const contentHeight = safeTotalHeight * scaleMini;
  const dx = (miniWidth - contentWidth) / 2;
  const dy = (miniHeight - contentHeight) / 2;

  const safeDx = isNaN(dx) ? 0 : dx;
  const safeDy = isNaN(dy) ? 0 : dy;

  // 8. 真实坐标映射至小地图相对坐标 of 辅助函数
  const mapToMini = (X: number, Y: number) => {
    const xVal = (X - minX) * scaleMini + safeDx;
    const yVal = (Y - minY) * scaleMini + safeDy;
    return {
      x: isNaN(xVal) ? 0 : xVal,
      y: isNaN(yVal) ? 0 : yVal,
    };
  };

  // 9. 小地图鼠标定位处理函数（点击或拖拽仅修改目标虚拟中心）
  const handleMapAction = useCallback((clientX: number, clientY: number, forceStateSync = false) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // 逆映射：小地图坐标 (mx, my) 映射回真实画布坐标 (canvasX, canvasY)
    const canvasX = (mx - safeDx) / scaleMini + minX;
    const canvasY = (my - safeDy) / scaleMini + minY;

    const targetX = isNaN(canvasX) ? 0 : canvasX;
    const targetY = isNaN(canvasY) ? 0 : canvasY;

    lastTargetCenterRef.current = { x: targetX, y: targetY };

    if (forceStateSync) {
      setTargetCenter({ x: targetX, y: targetY });
      setIsEdited(true);
    } else {
      // 🚀 0-Rerender DOM 优化：通过 RAF 原生修改聚焦框属性
      if (activeDragFrameRef.current !== null) {
        cancelAnimationFrame(activeDragFrameRef.current);
      }
      activeDragFrameRef.current = requestAnimationFrame(() => {
        activeDragFrameRef.current = null;
        const targetViewportEl = document.getElementById('minimap-target-viewport');
        if (targetViewportEl) {
          const targetViewportW = safeContainerWidth / currentTargetScale;
          const targetViewportH = safeContainerHeight / currentTargetScale;
          const miniTargetViewportPos = mapToMini(targetX - targetViewportW / 2, targetY - targetViewportH / 2);
          const miniTargetViewportW = targetViewportW * scaleMini;
          const miniTargetViewportH = targetViewportH * scaleMini;

          targetViewportEl.setAttribute('x', String(miniTargetViewportPos.x));
          targetViewportEl.setAttribute('y', String(miniTargetViewportPos.y));
          targetViewportEl.setAttribute('width', String(Math.max(6, miniTargetViewportW)));
          targetViewportEl.setAttribute('height', String(Math.max(6, miniTargetViewportH)));
        }
      });
    }
  }, [safeDx, scaleMini, minX, minY, safeContainerWidth, safeContainerHeight, currentTargetScale, mapToMini]);

  // 10. 拖动小地图视口框 of 交互处理
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    handleMapAction(e.clientX, e.clientY);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    handleMapAction(e.clientX, e.clientY);
  }, [isDragging, handleMapAction]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (activeDragFrameRef.current !== null) {
      cancelAnimationFrame(activeDragFrameRef.current);
      activeDragFrameRef.current = null;
    }
    if (lastTargetCenterRef.current) {
      setTargetCenter(lastTargetCenterRef.current);
      setIsEdited(true);
    }
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (activeDragFrameRef.current !== null) {
        cancelAnimationFrame(activeDragFrameRef.current);
        activeDragFrameRef.current = null;
      }
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 折叠状态下，在左下角渲染成一个极其精致的 Map 图标高亮悬浮小圆钮 (36x36)
  // 折叠状态逻辑已下移到 return 前

  // 9. 计算视口框在小地图中 of 绘制参数
  // 9.1 当前实际大画布位置（虚线框）
  const miniActualViewportPos = mapToMini(viewportMinX, viewportMinY);
  const miniActualViewportW = (viewportMaxX - viewportMinX) * scaleMini;
  const miniActualViewportH = (viewportMaxY - viewportMinY) * scaleMini;

  // 9.2 目标定位视口位置（橙红实线框）
  const effectiveCenter = isEdited && targetCenter ? targetCenter : {
    x: viewportMinX + (viewportMaxX - viewportMinX) / 2,
    y: viewportMinY + (viewportMaxY - viewportMinY) / 2
  };
  const targetViewportW = safeContainerWidth / currentTargetScale;
  const targetViewportH = safeContainerHeight / currentTargetScale;
  const miniTargetViewportPos = mapToMini(effectiveCenter.x - targetViewportW / 2, effectiveCenter.y - targetViewportH / 2);
  const miniTargetViewportW = targetViewportW * scaleMini;
  const miniTargetViewportH = targetViewportH * scaleMini;

  // 10. 缩放控制器 of 交互行为 (只改变拟定位状态)
  const zoomProgress = Math.max(0, Math.min(100, (displayZoomPercent - 10) / 290 * 100));

  const applyZoomToCanvas = (newScale: number) => {
    if (!canvasRef.current) return;
    const next = computeCenteredZoomTransform({
      centerX: viewportCenterX,
      centerY: viewportCenterY,
      viewportWidth: safeContainerWidth,
      viewportHeight: safeContainerHeight,
      scale: newScale,
    });
    canvasRef.current.setView(next.x, next.y, next.scale);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newScale = parseInt(e.target.value, 10) / 100;
    applyZoomToCanvas(newScale);
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextScale = Math.min(3, currentTargetScale + 0.1);
    applyZoomToCanvas(nextScale);
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextScale = Math.max(0.1, currentTargetScale - 0.1);
    applyZoomToCanvas(nextScale);
  };

  // 小地图 SVG 区域上 of 鼠标滚轮缩放事件（根据鼠标的位置来局部缩放小地图内容）
  const handleSvgWheel = useCallback((e: WheelEvent) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const currentMultiplier = minimapScaleMultiplierRef.current;
    const currentOffset = minimapCenterOffsetRef.current;

    // 实时计算出当前的 totalWidth, totalHeight 等
    const currentTotalWidth = viewportW * currentMultiplier;
    const currentTotalHeight = viewportH * currentMultiplier;

    const currentCenterX = viewportCenterX + (currentOffset?.x || 0);
    const currentCenterY = viewportCenterY + (currentOffset?.y || 0);

    const currentMinX = currentCenterX - currentTotalWidth / 2;
    const currentMinY = currentCenterY - currentTotalHeight / 2;

    // 计算 scaleMini
    const currentScaleMiniX = miniWidth / (currentTotalWidth <= 0 ? 1 : currentTotalWidth);
    const currentScaleMiniY = miniHeight / (currentTotalHeight <= 0 ? 1 : currentTotalHeight);
    let currentScaleMini = Math.min(currentScaleMiniX, currentScaleMiniY);
    if (isNaN(currentScaleMini) || currentScaleMini === Infinity || currentScaleMini <= 0) {
      currentScaleMini = 0.1;
    }

    const currentContentWidth = currentTotalWidth * currentScaleMini;
    const currentContentHeight = currentTotalHeight * currentScaleMini;
    const currentDx = (miniWidth - currentContentWidth) / 2;
    const currentDisplayDy = (miniHeight - currentContentHeight) / 2;
    const currentSafeDx = isNaN(currentDx) ? 0 : currentDx;
    const currentSafeDy = isNaN(currentDisplayDy) ? 0 : currentDisplayDy;

    // 1. 计算鼠标当前位置在真实大画布坐标系下的世界坐标
    const mouseXInWorld = (mx - currentSafeDx) / currentScaleMini + currentMinX;
    const mouseYInWorld = (my - currentSafeDy) / currentScaleMini + currentMinY;

    // 2. 算新的 scale multiplier
    const delta = -e.deltaY;
    const zoomFactor = delta > 0 ? 0.9 : 1.1; // 向上滚是放大（视野变窄，细节变大），向下滚是缩小（视野变宽，细节变小）
    const nextMultiplier = Math.max(1.0, Math.min(10.0, currentMultiplier * zoomFactor));

    // 3. 计算新的 totalWidth 和 totalHeight
    const totalWidth_new = viewportW * nextMultiplier;
    const totalHeight_new = viewportH * nextMultiplier;

    // 4. 计算新的 scaleMini_new 以及安全的 dx_new 和 dy_new
    const scaleMiniX_new = miniWidth / (totalWidth_new <= 0 ? 1 : totalWidth_new);
    const scaleMiniY_new = miniHeight / (totalHeight_new <= 0 ? 1 : totalHeight_new);
    let scaleMini_new = Math.min(scaleMiniX_new, scaleMiniY_new);
    if (isNaN(scaleMini_new) || scaleMini_new === Infinity || scaleMini_new <= 0) {
      scaleMini_new = 0.1;
    }

    const contentWidth_new = totalWidth_new * scaleMini_new;
    const contentHeight_new = totalHeight_new * scaleMini_new;
    const dx_new = (miniWidth - contentWidth_new) / 2;
    const dy_new = (miniHeight - contentHeight_new) / 2;
    const safeDx_new = isNaN(dx_new) ? 0 : dx_new;
    const safeDy_new = isNaN(dy_new) ? 0 : dy_new;

    // 5. 算新的 minX_new 和 minY_new 以锁定鼠标指向点
    const minX_new = mouseXInWorld - (mx - safeDx_new) / scaleMini_new;
    const minY_new = mouseYInWorld - (my - safeDy_new) / scaleMini_new;

    // 6. 反推新的小地图中心并计算新的偏移量
    const centerX_new = minX_new + totalWidth_new / 2;
    const centerY_new = minY_new + totalHeight_new / 2;

    const offsetX = centerX_new - viewportCenterX;
    const offsetY = centerY_new - viewportCenterY;

    // 7. 更新状态
    setMinimapScale(nextMultiplier);
    setMinimapOffset({ x: offsetX, y: offsetY });
  }, [viewportW, viewportH, viewportCenterX, viewportCenterY, miniWidth, miniHeight]);

  // 绑定小地图原生 wheel 事件，用 passive: false 以便 preventDefault 彻底阻断大画布和页面滚动
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleSvgWheel(e);
    };

    svg.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', handleNativeWheel);
    };
  }, [handleSvgWheel]);

  // 确认定位
  const handleConfirmLocation = () => {
    const center = targetCenter || {
      x: viewportMinX + (viewportMaxX - viewportMinX) / 2,
      y: viewportMinY + (viewportMaxY - viewportMinY) / 2
    };
    if (canvasRef.current) {
      const newX = safeContainerWidth / 2 - center.x * currentTargetScale;
      const newY = safeContainerHeight / 2 - center.y * currentTargetScale;
      
      const finalX = isNaN(newX) ? 0 : newX;
      const finalY = isNaN(newY) ? 0 : newY;
      
      canvasRef.current.setView(finalX, finalY, currentTargetScale);
      setIsEdited(false);
      setMinimapOffset(null); // 重置视野偏移
    }
  };

  // 取消并重置
  const handleCancelLocation = () => {
    setIsEdited(false);
    setMinimapOffset(null); // 重置视野偏移
  };

  if (isMobile || !activeCanvas) return null;

  // 折叠状态下，在右上角渲染成扁平横向缩放控制栏
  if (isCollapsed) {
    return (
      <div
        data-canvas-navigation-dock="true"
        data-canvas-navigation-bar="true"
        className="kk-workspace-chrome-surface canvas-nav-panel canvas-nav-panel--compact flex items-center gap-1.5 rounded-2xl border px-2 py-1 select-none transition-all duration-300 ease-in-out"
        style={{
          width: '296px',
          maxWidth: '296px',
          boxSizing: 'border-box',
          height: '38px',
          boxShadow: 'var(--frost-card-framework-shadow)',
          background: 'var(--frost-card-framework-bg)',
          border: '1px solid var(--frost-card-framework-border)',
          WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
          backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        }}
      >
        <div data-canvas-zoom-control="true" className="flex min-w-0 flex-1 items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="kk-workspace-icon-control h-6 w-6 rounded-md"
            title="缩小"
            aria-label="缩小"
          >
            <Minus size={11} />
          </button>
          <div className="flex min-w-0 flex-1 items-center">
            <input
              type="range"
              min="10"
              max="300"
              value={displayZoomPercent}
              onChange={handleSliderChange}
              onMouseDown={(event) => event.stopPropagation()}
              className="zoom-slider h-1 w-full min-w-0 cursor-pointer"
              aria-label="画布缩放"
              style={{ '--zoom-slider-progress': `${zoomProgress}%` } as React.CSSProperties}
            />
          </div>
          <button
            onClick={handleZoomIn}
            className="kk-workspace-icon-control h-6 w-6 rounded-md"
            title="放大"
            aria-label="放大"
          >
            <Plus size={11} />
          </button>
          <span className="min-w-[38px] text-right text-[10px] font-black text-[var(--text-secondary)]">
            {displayZoomPercent}%
          </span>
        </div>
        <button
          type="button"
          data-canvas-navigation-action="autoArrange"
          data-project-manager-action={PROJECT_MANAGER_ACTIONS.autoArrange.uiAction}
          onClick={onAutoArrange}
          className="kk-workspace-icon-control h-7 w-7 rounded-lg"
          title="自动整理卡片"
          aria-label="自动整理卡片"
        >
          <LayoutDashboard size={13} />
        </button>
        <button
          type="button"
          data-canvas-minimap-toggle="true"
          onClick={toggleCollapsed}
          className="kk-workspace-icon-control h-7 w-7 rounded-lg"
          title="展开小地图"
          aria-label="展开小地图"
        >
          <Map size={13} className="text-[var(--accent-coral)]" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-canvas-navigation-dock="true"
      data-canvas-minimap-popover="true"
      className="kk-workspace-chrome-surface canvas-nav-panel flex flex-col gap-1.5 rounded-2xl border p-3 select-none transition-all duration-300 ease-in-out"
      style={{
        width: '304px',
        maxWidth: '304px',
        boxSizing: 'border-box',
        boxShadow: 'var(--frost-card-framework-shadow)',
        background: 'var(--frost-card-framework-bg)',
        border: '1px solid var(--frost-card-framework-border)',
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
      }}
    >
      <div className="w-full flex flex-col gap-1.5 transition-all">
        <div className="relative w-full overflow-hidden rounded-xl border border-[var(--kk-workspace-minimap-border)] bg-[var(--kk-workspace-minimap-bg)]">
          <svg
            ref={svgRef}
            width={miniWidth}
            height={miniHeight}
            onMouseDown={handleMouseDown}
            className="kk-workspace-canvas-minimap cursor-crosshair overflow-hidden"
          >
            {/* 背景网格装饰 */}
            <defs>
              <pattern id="minimap-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--kk-workspace-minimap-grid-stroke)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={miniWidth} height={miniHeight} fill="url(#minimap-grid)" />

            {/* 渲染视口范围内的卡片小方块（只展示空白卡片占位，低饱和度半透明中性色彩） */}
            {visibleNodes
              .map((node: MinimapIndexedNode) => {
                const isImage = node.minimapKind === 'image';
                const w = isImage ? 380 : 500;
                const h = isImage ? 380 : 300;

                const pos = mapToMini(node.position.x, node.position.y);
                const rw = w * scaleMini;
                const rh = h * scaleMini;

                return (
                  <rect
                    key={node.id}
                    x={pos.x}
                    y={pos.y}
                    width={Math.max(2, rw)}
                    height={Math.max(2, rh)}
                    rx={Math.max(1, scaleMini * 24)}
                    fill={isImage ? 'var(--kk-workspace-minimap-image-bg)' : 'var(--kk-workspace-minimap-node-bg)'}
                    stroke={isImage ? 'var(--kk-workspace-minimap-image-stroke)' : 'var(--kk-workspace-minimap-node-stroke)'}
                    strokeWidth="0.5"
                  />
                );
              })}

            {/* 渲染当前大画布的实际位置框（仅在待确认编辑状态下显示，灰色虚线框表示） */}
            {isEdited && (
              <rect
                x={miniActualViewportPos.x}
                y={miniActualViewportPos.y}
                width={Math.max(6, miniActualViewportW)}
                height={Math.max(6, miniActualViewportH)}
                rx="2"
                fill="none"
                stroke="rgba(156, 163, 175, 0.6)"
                strokeWidth="1.2"
                strokeDasharray="2,2"
              />
            )}

            {/* 渲染目标定位聚焦框（珊瑚色实线框，可以拖拽移动） */}
            <rect
              id="minimap-target-viewport"
              x={miniTargetViewportPos.x}
              y={miniTargetViewportPos.y}
              width={Math.max(6, miniTargetViewportW)}
              height={Math.max(6, miniTargetViewportH)}
              rx="2"
              fill="var(--kk-workspace-minimap-viewport-bg)"
              stroke="var(--accent-coral)"
              strokeWidth="1.5"
              style={{
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: isDragging ? 'none' : 'x 0.1s ease-out, y 0.1s ease-out, width 0.1s ease-out, height 0.1s ease-out',
              }}
            />
          </svg>
          {isEdited ? (
            <div
              data-minimap-confirmation="true"
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-xl border border-[var(--frost-card-framework-border)] bg-[var(--frost-card-framework-bg)] p-1 shadow-lg backdrop-blur-xl"
            >
              <button
                type="button"
                onClick={handleCancelLocation}
                className="kk-workspace-icon-control h-7 rounded-lg px-2 text-[11px] font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="h-7 rounded-lg bg-[var(--accent-coral)] px-2.5 text-[11px] font-bold text-white"
              >
                确认
              </button>
            </div>
          ) : null}
        </div>
        <div data-canvas-navigation-bar="true" className="mt-0.5 flex h-8 items-center gap-1.5">
          <div data-canvas-zoom-control="true" className="flex min-w-0 flex-1 items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="kk-workspace-icon-control h-7 w-7 rounded-lg"
            title="缩小"
            aria-label="缩小"
          >
            <Minus size={13} />
          </button>
          <div className="flex min-w-0 flex-1 items-center">
            <input
              type="range"
              min="10"
              max="300"
              value={displayZoomPercent}
              onChange={handleSliderChange}
              onMouseDown={(e) => e.stopPropagation()}
              className="zoom-slider cursor-pointer w-full min-w-0 h-1"
              aria-label="画布缩放"
              style={{
                '--zoom-slider-progress': `${zoomProgress}%`,
              } as React.CSSProperties}
            />
          </div>

          <button
            onClick={handleZoomIn}
            className="kk-workspace-icon-control h-7 w-7 rounded-lg"
            title="放大"
            aria-label="放大"
          >
            <Plus size={13} />
          </button>

          <span
            className="inline-flex w-10 items-center justify-end whitespace-nowrap text-[10px] font-black text-[var(--text-secondary)]"
            style={{ height: '28px', lineHeight: '28px' }}
            title="当前实际缩放比"
          >
            {displayZoomPercent}%
          </span>
          </div>
          <button
            type="button"
            data-canvas-navigation-action="autoArrange"
            data-project-manager-action={PROJECT_MANAGER_ACTIONS.autoArrange.uiAction}
            onClick={onAutoArrange}
            className="kk-workspace-icon-control h-7 w-7 rounded-lg"
            title="自动整理卡片"
            aria-label="自动整理卡片"
          >
            <LayoutDashboard size={13} />
          </button>
          <button
            type="button"
            data-canvas-minimap-toggle="true"
            onClick={toggleCollapsed}
            className="kk-workspace-icon-control h-7 w-7 rounded-lg"
            title="收起小地图"
            aria-label="收起小地图"
          >
            <Minimize2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AppCanvasNavigationPanel, (prev, next) => {
  return (
    prev.isMobile === next.isMobile &&
    prev.canvasTransform.x === next.canvasTransform.x &&
    prev.canvasTransform.y === next.canvasTransform.y &&
    prev.canvasTransform.scale === next.canvasTransform.scale &&
    prev.activeCanvas === next.activeCanvas &&
    prev.onFitToAll === next.onFitToAll &&
    prev.onResetView === next.onResetView &&
    prev.onAutoArrange === next.onAutoArrange
  );
});
