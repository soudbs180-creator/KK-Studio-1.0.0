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
  const [isDragging, setIsDragging] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kk_canvas_minimap_collapsed') === 'true';
    }
    return false;
  });

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

  // 监听大画布变化，当没有处于手动编辑（待确认）状态时同步目标中心点 and 缩放比
  useEffect(() => {
    if (!isEdited) {
      const realCenterX = viewportMinX + (viewportMaxX - viewportMinX) / 2;
      const realCenterY = viewportMinY + (viewportMaxY - viewportMinY) / 2;
      setTargetCenter({
        x: isNaN(realCenterX) ? 0 : realCenterX,
        y: isNaN(realCenterY) ? 0 : realCenterY,
      });
      setTargetScale(scale);
    }
  }, [canvasTransform, safeContainerWidth, safeContainerHeight, isEdited, scale, viewportMinX, viewportMaxX, viewportMinY, viewportMaxY]);

  const currentTargetScale = isEdited ? targetScale : scale;
  const displayZoomPercent = Math.round(currentTargetScale * 100);

  // 6. 简体中文：重构小地图世界包围盒，基于当前实际视口宽高乘 3.0，保持聚焦框适中尺寸
  const viewportW = isNaN(viewportMaxX - viewportMinX) ? 800 : (viewportMaxX - viewportMinX);
  const viewportH = isNaN(viewportMaxY - viewportMinY) ? 600 : (viewportMaxY - viewportMinY);
  
  const currentCenterX = viewportMinX + viewportW / 2;
  const currentCenterY = viewportMinY + viewportH / 2;

  const totalWidth = viewportW * 3;
  const totalHeight = viewportH * 3;

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
  const handleMapAction = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // 逆映射：小地图坐标 (mx, my) 映射回真实画布坐标 (canvasX, canvasY)
    const canvasX = (mx - safeDx) / scaleMini + minX;
    const canvasY = (my - safeDy) / scaleMini + minY;

    setTargetCenter({
      x: isNaN(canvasX) ? 0 : canvasX,
      y: isNaN(canvasY) ? 0 : canvasY,
    });
    setIsEdited(true);
  }, [safeDx, scaleMini, minX, minY]);

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
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // ⚠️ Rules of Hooks: 必须在所有 Hook 声明完毕后进行条件性提前返回
  if (isMobile || !activeCanvas) return null;

  // 折叠状态下，在左下角渲染成一个极其精致的 Map 图标高亮悬浮小圆钮 (36x36)
  if (isCollapsed) {
    return (
      <button
        onClick={toggleCollapsed}
        className="flex items-center justify-center rounded-xl border transition-all active:scale-90 outline-none cursor-pointer hover:bg-opacity-95"
        style={{
          width: '36px',
          height: '36px',
          boxShadow: '0 4px 14px rgba(255, 77, 139, 0.22)',
          background: 'rgba(255, 77, 139, 0.15)',
          borderColor: 'rgba(255, 77, 139, 0.42)',
          WebkitBackdropFilter: 'blur(12px)',
          backdropFilter: 'blur(12px)',
        }}
        title="展开小地图"
      >
        <Map size={16} style={{ color: 'var(--accent-coral)' }} />
      </button>
    );
  }

  // 9. 计算视口框在小地图中 of 绘制参数
  // 9.1 当前实际大画布位置（虚线框）
  const miniActualViewportPos = mapToMini(viewportMinX, viewportMinY);
  const miniActualViewportW = (viewportMaxX - viewportMinX) * scaleMini;
  const miniActualViewportH = (viewportMaxY - viewportMinY) * scaleMini;

  // 9.2 目标定位视口位置（橙红实线框）
  const effectiveCenter = targetCenter || {
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
    setIsEdited(true);
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextScale = Math.min(3, currentTargetScale + 0.1);
    setTargetScale(nextScale);
    setIsEdited(true);
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextScale = Math.max(0.1, currentTargetScale - 0.1);
    setTargetScale(nextScale);
    setIsEdited(true);
  };

  // 小地图 SVG 区域上 of 鼠标滚轮缩放事件
  const handleSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = -e.deltaY;
    const zoomFactor = delta > 0 ? 1.05 : 0.95;
    const nextScale = Math.max(0.1, Math.min(3, currentTargetScale * zoomFactor));
    setTargetScale(nextScale);
    setIsEdited(true);
  };

  // 确认定位
  const handleConfirmLocation = () => {
    if (targetCenter && canvasRef.current) {
      const newX = safeContainerWidth / 2 - targetCenter.x * currentTargetScale;
      const newY = safeContainerHeight / 2 - targetCenter.y * currentTargetScale;
      
      const finalX = isNaN(newX) ? 0 : newX;
      const finalY = isNaN(newY) ? 0 : newY;
      
      canvasRef.current.setView(finalX, finalY, currentTargetScale);
      setIsEdited(false);
    }
  };

  // 取消并重置
  const handleCancelLocation = () => {
    setIsEdited(false);
  };

  return (
    <div
      className="kk-workspace-chrome-surface canvas-nav-panel flex flex-col gap-1.5 rounded-2xl border py-1.5 px-2 select-none transition-all duration-300 ease-in-out"
      style={{
        width: '224px',
        boxShadow: 'var(--frost-card-framework-shadow)',
        background: 'var(--frost-card-framework-bg)',
        border: '1px solid var(--frost-card-framework-border)',
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
      }}
    >
      {/* 简体中文：常驻极窄高度横向缩放及折叠控制栏（与顶栏头像按钮高度 32px 保持视觉一致） */}
      <div className="flex items-center justify-between gap-1.5 px-0.5 h-7">
        {/* 折叠切换按钮 (自定义 28px 精致圆角微标) */}
        <button
          onClick={toggleCollapsed}
          className="kk-workspace-icon-control w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 outline-none cursor-pointer"
          title={isCollapsed ? "展开小地图" : "收起小地图"}
        >
          {isCollapsed ? (
            <Map size={13} className="text-[var(--accent-coral)]" />
          ) : (
            <Minimize2 size={13} />
          )}
        </button>

        {/* 缩小按钮 */}
        <button
          onClick={handleZoomOut}
          className="kk-workspace-icon-control w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 outline-none cursor-pointer"
          title="缩小"
        >
          <Minus size={13} />
        </button>

        {/* 横向滑块 */}
        <div className="flex-1 flex items-center justify-center relative">
          <input
            type="range"
            min="10"
            max="300"
            value={displayZoomPercent}
            onChange={handleSliderChange}
            onMouseDown={(e) => e.stopPropagation()}
            className="zoom-slider cursor-pointer w-full h-1"
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
          className={`text-[10px] font-black tracking-tighter text-right select-none min-w-[36px] transition-colors ${
            isEdited ? 'text-[var(--accent-coral)] animate-pulse' : 'text-[var(--text-secondary)]'
          }`}
          title={isEdited ? "当前拟定位缩放比（未保存）" : "当前实际缩放比"}
        >
          {displayZoomPercent}%{isEdited && '*'}
        </span>
      </div>

      {/* 简体中文：小地图 SVG 画面层 — 展开状态下在下方打开 */}
      {!isCollapsed && (
        <div className="flex flex-col gap-1.5 transition-all">
          <div className="relative overflow-hidden rounded-xl border border-[var(--kk-workspace-minimap-border)] bg-[var(--kk-workspace-minimap-bg)]">
            <svg
              ref={svgRef}
              width={miniWidth}
              height={miniHeight}
              onMouseDown={handleMouseDown}
              onWheel={handleSvgWheel}
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
              className={`px-2.5 text-[11px] font-medium py-1.5 rounded-lg text-center outline-none transition-all ${
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
      )}
    </div>
  );
};

export default AppCanvasNavigationPanel;
