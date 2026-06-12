import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Minus, Plus, Minimize2, Map } from 'lucide-react';

// 简体中文：定义导航面板的 Props 接口
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

  // 小地图的固定物理尺寸
  const miniWidth = 200;
  const miniHeight = 120;
  const padding = 150; // 包围盒的外边距 padding，防止内容顶格

  if (isMobile || !activeCanvas) return null;

  const scale = canvasTransform.scale || 1;
  const zoomPercent = Math.round(scale * 100);

  // 1. 获取所有可见卡片的绝对位置
  const promptNodes = activeCanvas.promptNodes || [];
  const imageNodes = activeCanvas.imageNodes || [];

  const visibleNodes = [
    ...promptNodes.filter((n: any) => !n.hiddenInCanvas),
    ...imageNodes,
  ];

  // 2. 确定大画布容器的实际尺寸，若无法获取则回退默认值
  const canvasRect = canvasRef.current?.getCanvasRect();
  const containerWidth = canvasRect?.width || window.innerWidth;
  const containerHeight = canvasRect?.height || window.innerHeight;

  // 避免容器宽高计算为 0 导致缩放比例计算出错
  const safeContainerWidth = containerWidth <= 0 || isNaN(containerWidth) ? 800 : containerWidth;
  const safeContainerHeight = containerHeight <= 0 || isNaN(containerHeight) ? 600 : containerHeight;

  // 3. 计算视口（Viewport）在真实世界坐标系中的边界
  const safeScale = scale <= 0 || isNaN(scale) ? 1 : scale;
  const viewportMinX = -canvasTransform.x / safeScale;
  const viewportMinY = -canvasTransform.y / safeScale;
  const viewportMaxX = (safeContainerWidth - canvasTransform.x) / safeScale;
  const viewportMaxY = (safeContainerHeight - canvasTransform.y) / safeScale;

  // 4. 汇总所有元素（卡片 + 视口）计算总的真实坐标包围盒
  let minX = isNaN(viewportMinX) ? 0 : viewportMinX;
  let maxX = isNaN(viewportMaxX) ? 100 : viewportMaxX;
  let minY = isNaN(viewportMinY) ? 0 : viewportMinY;
  let maxY = isNaN(viewportMaxY) ? 100 : viewportMaxY;

  visibleNodes.forEach((node: any) => {
    // 估算卡片占用的真实尺寸（Prompt 卡片约 500x300，图片卡片约 380x380）
    const isImage = node.url || node.storageId;
    const w = isImage ? 380 : 500;
    const h = isImage ? 380 : 300;

    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x + w);
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y + h);
  });

  // 加上 padding，让视口边缘有呼吸感
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;

  // 强防零值及 NaN，防止小地图缩放计算除以零导致坐标系崩溃
  const safeTotalWidth = totalWidth <= 0 || isNaN(totalWidth) ? 1 : totalWidth;
  const safeTotalHeight = totalHeight <= 0 || isNaN(totalHeight) ? 1 : totalHeight;

  // 5. 计算等比例缩放至小地图 (200x120) 的比例因子
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

  // 6. 真实坐标映射至小地图相对坐标的辅助函数
  const mapToMini = (X: number, Y: number) => {
    const xVal = (X - minX) * scaleMini + safeDx;
    const yVal = (Y - minY) * scaleMini + safeDy;
    return {
      x: isNaN(xVal) ? 0 : xVal,
      y: isNaN(yVal) ? 0 : yVal,
    };
  };

  // 7. 小地图鼠标定位平移大画布的处理函数
  const handleMapAction = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // 逆映射：小地图坐标 (mx, my) 映射回真实画布坐标 (canvasX, canvasY)
    const canvasX = (mx - safeDx) / scaleMini + minX;
    const canvasY = (my - safeDy) / scaleMini + minY;

    // 平移大画布：将所点击/拖动的位置重定心至屏幕物理中心
    const newX = safeContainerWidth / 2 - (isNaN(canvasX) ? 0 : canvasX) * scale;
    const newY = safeContainerHeight / 2 - (isNaN(canvasY) ? 0 : canvasY) * scale;

    const finalX = isNaN(newX) ? 0 : newX;
    const finalY = isNaN(newY) ? 0 : newY;

    canvasRef.current?.setView(finalX, finalY, scale);
  }, [safeDx, scaleMini, minX, minY, safeContainerWidth, safeContainerHeight, scale, canvasRef]);

  // 8. 拖动小地图视口框的交互处理
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

  // 9. 计算视口框在小地图中的绘制参数
  const miniViewportPos = mapToMini(viewportMinX, viewportMinY);
  const miniViewportW = (viewportMaxX - viewportMinX) * scaleMini;
  const miniViewportH = (viewportMaxY - viewportMinY) * scaleMini;

  // 10. 缩放控制器的交互行为
  // 计算进度百分比以映射 CSS Slider 填充进度 (10% - 300%)
  const zoomProgress = Math.max(0, Math.min(100, (zoomPercent - 10) / 290 * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newScale = parseInt(e.target.value, 10) / 100;
    
    if (canvasRef.current) {
      if (typeof canvasRef.current.zoomTo === 'function') {
        canvasRef.current.zoomTo(newScale);
      } else {
        // 兜底方案：如果 zoomTo 未暴露，使用 setView 针对中心进行缩放
        const container = document.getElementById('canvas-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          
          const scaleRatio = newScale / scale;
          const newX = centerX - (centerX - canvasTransform.x) * scaleRatio;
          const newY = centerY - (centerY - canvasTransform.y) * scaleRatio;
          
          canvasRef.current.setView(newX, newY, newScale);
        }
      }
    }
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    canvasRef.current?.zoomIn?.();
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    canvasRef.current?.zoomOut?.();
  };

  return (
    <div
      className="kk-workspace-chrome-surface canvas-nav-panel flex flex-col gap-2 rounded-2xl border p-2 select-none"
      style={{
        width: '218px',
      }}
    >
      {/* 简体中文：小地图 SVG 画面层 — 仅在未折叠状态下才向下展开渲染，不占头部空间 */}
      {!isCollapsed && (
        <div className="relative overflow-hidden rounded-xl">
          <svg
            ref={svgRef}
            width={miniWidth}
            height={miniHeight}
            onMouseDown={handleMouseDown}
            className="kk-workspace-canvas-minimap cursor-crosshair overflow-hidden"
          >
            {/* 背景网格装饰，提供空间感 */}
            <defs>
              <pattern id="minimap-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--kk-workspace-minimap-grid-stroke)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={miniWidth} height={miniHeight} fill="url(#minimap-grid)" />

            {/* 渲染所有卡片小方块 */}
            {visibleNodes.map((node: any) => {
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
                  rx={Math.max(1, scaleMini * 24)} // 等比例圆角
                  fill={isImage ? 'var(--kk-workspace-minimap-image-bg)' : 'var(--kk-workspace-minimap-node-bg)'}
                  stroke={isImage ? 'var(--kk-workspace-minimap-image-stroke)' : 'var(--kk-workspace-minimap-node-stroke)'}
                  strokeWidth="0.5"
                />
              );
            })}

            {/* 渲染当前视口聚焦边界框 */}
            <rect
              x={miniViewportPos.x}
              y={miniViewportPos.y}
              width={Math.max(6, miniViewportW)}
              height={Math.max(6, miniViewportH)}
              rx="2"
              fill="var(--kk-workspace-minimap-viewport-bg)"
              stroke="var(--accent-coral)"
              strokeWidth="1.2"
              style={{
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: isDragging ? 'none' : 'x 0.1s ease-out, y 0.1s ease-out, width 0.1s ease-out, height 0.1s ease-out',
              }}
            />
          </svg>
        </div>
      )}

      {/* 简体中文：常驻横向缩放及折叠控制栏（折叠时容器自适应缩减高度成为精致的胶囊控制条） */}
      <div className="flex items-center justify-between gap-1.5 px-0.5">
        {/* 折叠切换按钮 */}
        <button
          onClick={toggleCollapsed}
          className="kk-workspace-icon-control rounded-lg active:scale-90 outline-none cursor-pointer"
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
          className="kk-workspace-icon-control rounded-lg active:scale-90 outline-none cursor-pointer"
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
            value={zoomPercent}
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
          className="kk-workspace-icon-control rounded-lg active:scale-90 outline-none cursor-pointer"
          title="放大"
        >
          <Plus size={13} />
        </button>

        {/* 缩放比百分比 */}
        <span
          className="text-[10px] text-[var(--accent-coral)] font-black tracking-tighter text-right select-none min-w-[32px]"
          title="当前缩放比"
        >
          {zoomPercent}%
        </span>
      </div>
    </div>
  );
};

export default AppCanvasNavigationPanel;
