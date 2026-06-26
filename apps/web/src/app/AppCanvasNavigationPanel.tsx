import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Minus, Plus, Minimize2, Map } from 'lucide-react';

// 简体中文：定义导航面板 of Props 接口
interface AppCanvasNavigationPanelProps {
  activeCanvas: any; // 当前激活的画布数据
  canvasTransform: { x: number; y: number; scale: number }; // 画布实时变换
  canvasRef: React.RefObject<any>; // 大画布实例引用
  isMobile: boolean; // 是否是移动端
}

const AppCanvasNavigationPanel: React.FC<AppCanvasNavigationPanelProps> = ({
  activeCanvas,
  canvasTransform,
  canvasRef,
  isMobile,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const lastTargetCenterRef = useRef<{ x: number; y: number } | null>(null);
  const activeDragFrameRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kk_canvas_minimap_collapsed') === 'true';
    }
    return false;
  });

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
  const [targetScale, setTargetScale] = useState(1);

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
  const miniWidth = 200;
  const miniHeight = 90; // 简体中文：优化高度，使之更矮平精致

  const scale = canvasTransform.scale || 1;

  // 3. 获取所有可见卡片的绝对位置
  const promptNodes = activeCanvas?.promptNodes || [];
  const imageNodes = activeCanvas?.imageNodes || [];

  const visibleNodes = [
    ...promptNodes.filter((n: any) => !n.hiddenInCanvas),
    ...imageNodes,
  ];

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


  const currentTargetScale = isEdited ? targetScale : scale;
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

  // ⚠️ Rules of Hooks: 必须在所有 Hook 声明完毕后进行条件性提前返回
  if (isMobile || !activeCanvas) return null;

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

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newScale = parseInt(e.target.value, 10) / 100;
    setTargetScale(newScale);
    
    if (isCollapsed && canvasRef.current) {
      const center = {
        x: viewportMinX + (viewportMaxX - viewportMinX) / 2,
        y: viewportMinY + (viewportMaxY - viewportMinY) / 2
      };
      const newX = safeContainerWidth / 2 - center.x * newScale;
      const newY = safeContainerHeight / 2 - center.y * newScale;
      canvasRef.current.setView(isNaN(newX) ? 0 : newX, isNaN(newY) ? 0 : newY, newScale);
      setIsEdited(false);
    } else {
      setIsEdited(true);
    }
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextScale = Math.min(3, currentTargetScale + 0.1);
    setTargetScale(nextScale);
    
    if (isCollapsed && canvasRef.current) {
      const center = {
        x: viewportMinX + (viewportMaxX - viewportMinX) / 2,
        y: viewportMinY + (viewportMaxY - viewportMinY) / 2
      };
      const newX = safeContainerWidth / 2 - center.x * nextScale;
      const newY = safeContainerHeight / 2 - center.y * nextScale;
      canvasRef.current.setView(isNaN(newX) ? 0 : newX, isNaN(newY) ? 0 : newY, nextScale);
      setIsEdited(false);
    } else {
      setIsEdited(true);
    }
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextScale = Math.max(0.1, currentTargetScale - 0.1);
    setTargetScale(nextScale);
    
    if (isCollapsed && canvasRef.current) {
      const center = {
        x: viewportMinX + (viewportMaxX - viewportMinX) / 2,
        y: viewportMinY + (viewportMaxY - viewportMinY) / 2
      };
      const newX = safeContainerWidth / 2 - center.x * nextScale;
      const newY = safeContainerHeight / 2 - center.y * nextScale;
      canvasRef.current.setView(isNaN(newX) ? 0 : newX, isNaN(newY) ? 0 : newY, nextScale);
      setIsEdited(false);
    } else {
      setIsEdited(true);
    }
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

  // 折叠状态下，在右上角渲染成扁平横向缩放控制栏
  if (isCollapsed) {
    return (
      <div
        className="kk-workspace-chrome-surface canvas-nav-panel flex items-center gap-2 rounded-2xl border px-3 py-1 select-none transition-all duration-300 ease-in-out"
        style={{
          width: '224px',
          maxWidth: '224px',
          boxSizing: 'border-box',
          height: '38px',
          boxShadow: 'var(--frost-card-framework-shadow)',
          background: 'var(--frost-card-framework-bg)',
          border: '1px solid var(--frost-card-framework-border)',
          WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
          backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        }}
      >
        {/* 展开按钮，用带有 Map 图标的按钮 */}
        <button
          onClick={toggleCollapsed}
          className="kk-workspace-icon-control w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 outline-none cursor-pointer transition-colors"
          style={{
            background: 'rgba(255, 77, 139, 0.1)',
            borderColor: 'rgba(255, 77, 139, 0.25)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
          title="展开小地图"
        >
          <Map size={13} style={{ color: 'var(--accent-coral)' }} />
        </button>

        {/* 缩小按钮 */}
        <button
          onClick={handleZoomOut}
          className="kk-workspace-icon-control w-6 h-6 rounded-md flex items-center justify-center active:scale-90 outline-none cursor-pointer"
          title="缩小"
        >
          <Minus size={11} />
        </button>

        {/* 横向滑块 */}
        <div className="flex-1 flex items-center justify-center relative min-w-0">
          <input
            type="range"
            min="10"
            max="300"
            value={displayZoomPercent}
            onChange={handleSliderChange}
            onMouseDown={(e) => e.stopPropagation()}
            className="zoom-slider cursor-pointer w-full min-w-0 h-1"
            style={{
              '--zoom-slider-progress': `${zoomProgress}%`,
            } as React.CSSProperties}
          />
        </div>

        {/* 放大按钮 */}
        <button
          onClick={handleZoomIn}
          className="kk-workspace-icon-control w-6 h-6 rounded-md flex items-center justify-center active:scale-90 outline-none cursor-pointer"
          title="放大"
        >
          <Plus size={11} />
        </button>

        {/* 缩放百分比数值 */}
        <span
          className={`inline-flex items-center justify-end text-[10px] font-black tracking-tighter text-right select-none min-w-[44px] whitespace-nowrap transition-colors ${
            isEdited ? 'text-[var(--accent-coral)] animate-pulse' : 'text-[var(--text-secondary)]'
          }`}
          style={{ height: '24px', lineHeight: '24px' }}
          title={isEdited ? "当前拟定位缩放比（未保存）" : "当前实际缩放比"}
        >
          {displayZoomPercent}%{isEdited && '*'}
        </span>
      </div>
    );
  }

  return (
    <div
      className="kk-workspace-chrome-surface canvas-nav-panel flex flex-col gap-1.5 rounded-2xl border p-3 select-none transition-all duration-300 ease-in-out"
      style={{
        width: '224px',
        maxWidth: '224px',
        boxSizing: 'border-box',
        boxShadow: 'var(--frost-card-framework-shadow)',
        background: 'var(--frost-card-framework-bg)',
        border: '1px solid var(--frost-card-framework-border)',
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
      }}
    >
      {/* 顶部标题栏 (仅在展开状态下使用) */}
      <div className="flex items-center justify-between gap-1.5 h-7 border-b border-[var(--kk-workspace-minimap-border)]/20 pb-1.5 mb-0.5">
        <div className="flex items-center gap-1.5 select-none">
          <Map size={12} className="text-[var(--accent-coral)]" />
          <span className="text-[10px] font-bold tracking-tight text-[var(--text-secondary)]">导航小地图</span>
        </div>
        <div className="w-11 flex justify-center items-center">
          <button
            onClick={toggleCollapsed}
            className="kk-workspace-icon-control w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 outline-none cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="收起小地图"
          >
            <Minimize2 size={13} className="text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>

      <div className="w-full flex flex-col gap-1.5 transition-all">
        <div className="w-full relative overflow-hidden rounded-xl border border-[var(--kk-workspace-minimap-border)] bg-[var(--kk-workspace-minimap-bg)]">
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
              .filter((node: any) => {
                const isImage = node.url || node.storageId;
                const w = isImage ? 380 : 500;
                const h = isImage ? 380 : 300;
                return (
                  node.position.x + w >= minX &&
                  node.position.x <= maxX &&
                  node.position.y + h >= minY &&
                  node.position.y <= maxY
                );
              })
              .map((node: any) => {
                const isImage = node.url || node.storageId;
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
        </div>

        {/* 缩放控制栏 (移至小地图下方，不再受折叠按钮挤压，使滑块拥有充足的可操作宽度) */}
        <div className="flex items-center justify-between gap-1.5 h-7 mt-0.5">
          {/* 缩小按钮 */}
          <button
            onClick={handleZoomOut}
            className="kk-workspace-icon-control w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 outline-none cursor-pointer"
            title="缩小"
          >
            <Minus size={13} />
          </button>

          {/* 横向滑块 */}
          <div className="flex-1 flex items-center justify-center relative min-w-0">
            <input
              type="range"
              min="10"
              max="300"
              value={displayZoomPercent}
              onChange={handleSliderChange}
              onMouseDown={(e) => e.stopPropagation()}
              className="zoom-slider cursor-pointer w-full min-w-0 h-1"
              style={{
                '--zoom-slider-progress': `${zoomProgress}%`,
              } as React.CSSProperties}
            />
          </div>

          {/* 放大按钮 */}
          <button
            onClick={handleZoomIn}
            className="kk-workspace-icon-control w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 outline-none cursor-pointer"
            title="放大"
          >
            <Plus size={13} />
          </button>

          {/* 缩放百分比数值 */}
          <span
            className={`inline-flex items-center justify-center text-[10px] font-black tracking-tighter text-center select-none w-11 whitespace-nowrap transition-colors ${
              isEdited ? 'text-[var(--accent-coral)] animate-pulse' : 'text-[var(--text-secondary)]'
            }`}
            style={{ height: '28px', lineHeight: '28px' }}
            title={isEdited ? "当前拟定位缩放比（未保存）" : "当前实际缩放比"}
          >
            {displayZoomPercent}%{isEdited && '*'}
          </span>
        </div>

        {/* 确认与重置按钮栏，展开状态下始终常驻，由 disabled 状态平滑过渡 */}
        <div className="flex gap-1.5 mt-0.5">
          <button
            disabled={!isEdited}
            onClick={handleConfirmLocation}
            className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg text-center outline-none transition-all shadow-sm ${
              isEdited
                ? 'bg-[var(--accent-coral)] text-white hover:opacity-90 active:scale-95 cursor-pointer'
                : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-600 cursor-not-allowed border border-neutral-200/40 dark:border-neutral-800/40'
            }`}
          >
            确认定位
          </button>
          <button
            disabled={!isEdited}
            onClick={handleCancelLocation}
            className={`w-11 text-[11px] font-medium py-1.5 rounded-lg text-center outline-none transition-all ${
              isEdited
                ? 'bg-neutral-200 dark:bg-neutral-800 text-[var(--text-secondary)] hover:opacity-90 active:scale-95 cursor-pointer'
                : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-600 cursor-not-allowed border border-neutral-200/40 dark:border-neutral-800/40'
            }`}
            title="取消更改，回到当前位置"
          >
            重置
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
    prev.activeCanvas === next.activeCanvas
  );
});
