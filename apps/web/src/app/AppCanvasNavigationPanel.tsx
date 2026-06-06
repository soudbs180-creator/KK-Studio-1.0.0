import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Home, Minus, Plus } from 'lucide-react';

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

  // 小地图的固定物理物理尺寸
  const miniWidth = 200;
  const miniHeight = 120;
  const padding = 150; // 包围盒的外边距 padding，防止内容顶格

  if (isMobile || !activeCanvas) return null;

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

  // 3. 计算视口（Viewport）在真实世界坐标系中的边界
  const scale = canvasTransform.scale || 1;
  const viewportMinX = -canvasTransform.x / scale;
  const viewportMinY = -canvasTransform.y / scale;
  const viewportMaxX = (containerWidth - canvasTransform.x) / scale;
  const viewportMaxY = (containerHeight - canvasTransform.y) / scale;

  // 4. 汇总所有元素（卡片 + 视口）计算总的真实坐标包围盒
  let minX = viewportMinX;
  let maxX = viewportMaxX;
  let minY = viewportMinY;
  let maxY = viewportMaxY;

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

  // 5. 计算等比例缩放至小地图 (200x120) 的比例因子
  const scaleMiniX = miniWidth / totalWidth;
  const scaleMiniY = miniHeight / totalHeight;
  const scaleMini = Math.min(scaleMiniX, scaleMiniY);

  // 让内容在小地图中居中的偏移值
  const contentWidth = totalWidth * scaleMini;
  const contentHeight = totalHeight * scaleMini;
  const dx = (miniWidth - contentWidth) / 2;
  const dy = (miniHeight - contentHeight) / 2;

  // 6. 真实坐标映射至小地图相对坐标的辅助函数
  const mapToMini = (X: number, Y: number) => {
    return {
      x: (X - minX) * scaleMini + dx,
      y: (Y - minY) * scaleMini + dy,
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
    const canvasX = (mx - dx) / scaleMini + minX;
    const canvasY = (my - dy) / scaleMini + minY;

    // 平移大画布：将所点击/拖动的位置重定心至屏幕物理中心
    const newX = containerWidth / 2 - canvasX * scale;
    const newY = containerHeight / 2 - canvasY * scale;

    canvasRef.current?.setView(newX, newY, scale);
  }, [dx, dy, scaleMini, minX, minY, containerWidth, containerHeight, scale, canvasRef]);

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
  const zoomPercent = Math.round(scale * 100);
  // 计算进度百分比以映射 CSS Slider 填充进度 (10% - 300%)
  const zoomProgress = Math.max(0, Math.min(100, (zoomPercent - 10) / 290 * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseInt(e.target.value, 10) / 100;
    canvasRef.current?.zoomTo(newScale);
  };

  const handleZoomIn = () => {
    canvasRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    canvasRef.current?.zoomOut();
  };

  const handleFitToAll = () => {
    canvasRef.current?.fitToAll();
  };

  return (
    <div
      className="canvas-nav-panel flex flex-col gap-2 rounded-2xl border p-2 select-none"
      style={{
        width: '218px',
        background: 'var(--frost-card-framework-bg)',
        border: '1px solid var(--frost-card-framework-border)',
        boxShadow: 'var(--frost-card-framework-shadow)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.2)',
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.2)',
      }}
    >
      {/* 简体中文：小地图 SVG 渲染层 */}
      <svg
        ref={svgRef}
        width={miniWidth}
        height={miniHeight}
        onMouseDown={handleMouseDown}
        className="rounded-xl cursor-crosshair overflow-hidden"
        style={{
          background: 'rgba(0, 0, 0, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* 背景网格装饰，提供高端空间感 */}
        <defs>
          <pattern id="minimap-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1" />
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
              fill={isImage ? 'rgba(129, 140, 248, 0.35)' : 'rgba(244, 63, 94, 0.35)'}
              stroke={isImage ? 'rgba(129, 140, 248, 0.5)' : 'rgba(244, 63, 94, 0.5)'}
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
          fill="rgba(255, 82, 64, 0.08)"
          stroke="var(--accent-coral)"
          strokeWidth="1.2"
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'x 0.1s ease-out, y 0.1s ease-out, width 0.1s ease-out, height 0.1s ease-out',
          }}
        />
      </svg>

      {/* 简体中文：横向缩放及定位控制栏 */}
      <div className="flex items-center justify-between gap-1.5 px-0.5">
        {/* 全览定位按钮 */}
        <button
          onClick={handleFitToAll}
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-all outline-none"
          title="定位全览 (Home)"
        >
          <Home size={13} />
        </button>

        {/* 缩小按钮 */}
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-all outline-none"
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
            className="zoom-slider cursor-pointer w-full h-1"
            style={{
              '--zoom-slider-progress': `${zoomProgress}%`,
            } as React.CSSProperties}
          />
        </div>

        {/* 放大按钮 */}
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-all outline-none"
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
