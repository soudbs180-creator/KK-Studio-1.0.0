import React from 'react';

// 简体中文：画布缩放控制组件的属性接口 (移除了 version 属性)
interface AppZoomControlProps {
  scale: number; // 当前缩放比例
  transform: { x: number; y: number; scale: number }; // 画布实时的变换位置
  canvasRef: React.RefObject<any>; // 无限画布实例的引用，用于触发 zoomIn / zoomOut / setView
}

const AppZoomControl: React.FC<AppZoomControlProps> = ({
  scale,
  transform,
  canvasRef,
}) => {
  // 简体中文：计算缩放滑块的进度百分比，对应 10% - 300% 范围，映射到 0% - 100% 用于 CSS 样式
  const zoomSliderProgress = Math.max(0, Math.min(100, ((scale * 100) - 10) / 290 * 100));

  // 简体中文：垂直方向加减，上方为放大 (+)
  const handleZoomIn = (event: React.MouseEvent) => {
    event.stopPropagation();
    canvasRef.current?.zoomIn();
  };

  // 简体中文：下方为缩小 (-)
  const handleZoomOut = (event: React.MouseEvent) => {
    event.stopPropagation();
    canvasRef.current?.zoomOut();
  };

  // 简体中文：拖动滑块调整缩放，基于画布几何中心点计算，防止画面偏移
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseInt(event.target.value, 10) / 100;
    const container = document.getElementById('canvas-container');
    if (!container || !canvasRef.current) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const scaleRatio = newScale / scale;
    const newX = centerX - (centerX - transform.x) * scaleRatio;
    const newY = centerY - (centerY - transform.y) * scaleRatio;

    canvasRef.current.setView(newX, newY, newScale);
  };

  return (
    <div
      className="w-10 py-3 px-1 flex flex-col items-center gap-3 transition-all duration-300 select-none rounded-2xl border"
      style={{
        background: 'var(--frost-card-framework-bg)',
        border: '1px solid var(--frost-card-framework-border)',
        boxShadow: 'var(--frost-card-framework-shadow)',
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
      }}
    >
      {/* 简体中文：上方为放大 (+) */}
      <button
        onClick={handleZoomIn}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-90 transition-all outline-none"
        title="放大"
        tabIndex={-1}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* 简体中文：垂直 Slider 包装区域 (高度 100px) */}
      <div className="h-[100px] flex items-center justify-center relative w-full">
        <input
          type="range"
          min="10"
          max="300"
          value={Math.round(scale * 100)}
          onChange={handleSliderChange}
          className="zoom-slider cursor-pointer origin-center -rotate-90"
          style={{
            '--zoom-slider-progress': `${zoomSliderProgress}%`,
            width: '92px',
            position: 'absolute',
          } as React.CSSProperties}
        />
      </div>

      {/* 简体中文：下方为缩小 (-) */}
      <button
        onClick={handleZoomOut}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-90 transition-all outline-none"
        title="缩小"
        tabIndex={-1}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* 简体中文：缩放百分比数值 (粗体，高可读性，作为卡片底部完美的收尾) */}
      <span className="text-[9px] text-[var(--accent-coral)] font-bold tracking-tight leading-none text-center">
        {Math.round(scale * 100)}%
      </span>
    </div>
  );
};

export default AppZoomControl;
