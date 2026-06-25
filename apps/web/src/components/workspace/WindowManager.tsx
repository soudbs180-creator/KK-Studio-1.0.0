// 简体中文：大画布顶级悬浮窗口多实例管理器 (WindowManager)
// 职责：管理并渲染所有通过 AI 助手或侧边栏创建的外部 Iframe / 内部 React 工具窗口

import React, { useRef, useEffect, useState, Suspense } from 'react';
import type { ToolWindowInstance } from '../../types';
import { X, Minus, Square } from 'lucide-react';

// Lazy 载入内置工具组件以保持性能与零循环依赖
const StressLab = React.lazy(() => 
  import('../../dev/StressLab').then(m => ({ default: m.StressLab }))
);
const BrowserAssistantView = React.lazy(() => 
  import('../settings/views/BrowserAssistantView').then(m => ({ default: m.BrowserAssistantView }))
);

interface WindowManagerProps {
  toolWindows: ToolWindowInstance[];
  onCloseWindow: (instanceId: string) => void;
  onMinimizeWindow: (instanceId: string, minimized: boolean) => void;
  onFocusWindow: (instanceId: string) => void;
  onUpdateWindowLayout: (instanceId: string, layout: Partial<ToolWindowInstance>) => void;
}

export function WindowManager({
  toolWindows,
  onCloseWindow,
  onMinimizeWindow,
  onFocusWindow,
  onUpdateWindowLayout,
}: WindowManagerProps) {
  if (!toolWindows || toolWindows.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9000 }} // 确保悬浮在大画布之上，但位于全局 modal 之下
    >
      {toolWindows.map((win) => (
        <FloatingWindow
          key={win.instanceId}
          win={win}
          onClose={() => onCloseWindow(win.instanceId)}
          onMinimize={(min) => onMinimizeWindow(win.instanceId, min)}
          onFocus={() => onFocusWindow(win.instanceId)}
          onUpdateLayout={(layout) => onUpdateWindowLayout(win.instanceId, layout)}
        />
      ))}
    </div>
  );
}

interface FloatingWindowProps {
  win: ToolWindowInstance;
  onClose: () => void;
  onMinimize: (min: boolean) => void;
  onFocus: () => void;
  onUpdateLayout: (layout: Partial<ToolWindowInstance>) => void;
}

function FloatingWindow({
  win,
  onClose,
  onMinimize,
  onFocus,
  onUpdateLayout,
}: FloatingWindowProps) {
  const { x, y, width, height, minimized, zIndex, title, toolId, url } = win;
  const windowRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; winX: number; winY: number } | null>(null);
  const resizeStartRef = useRef<{ clientX: number; clientY: number; winW: number; winH: number } | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevLayout, setPrevLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // 点击置顶
  const handleWindowClick = () => {
    onFocus();
  };

  // 鼠标拖拽移动逻辑
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return; // 最大化状态下禁止移动
    e.preventDefault();
    onFocus();
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      winX: x,
      winY: y,
    };
    window.addEventListener('mousemove', handleHeaderMouseMove);
    window.addEventListener('mouseup', handleHeaderMouseUp);
  };

  const handleHeaderMouseMove = (e: MouseEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    
    // 边界控制：限制窗口不要完全移出屏幕外
    const nextX = Math.max(10, Math.min(window.innerWidth - 100, dragStartRef.current.winX + dx));
    const nextY = Math.max(10, Math.min(window.innerHeight - 50, dragStartRef.current.winY + dy));
    
    onUpdateLayout({ x: nextX, y: nextY });
  };

  const handleHeaderMouseUp = () => {
    dragStartRef.current = null;
    window.removeEventListener('mousemove', handleHeaderMouseMove);
    window.removeEventListener('mouseup', handleHeaderMouseUp);
  };

  // 鼠标拉伸尺寸逻辑
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      winW: width,
      winH: height,
    };
    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (!resizeStartRef.current) return;
    const dw = e.clientX - resizeStartRef.current.clientX;
    const dh = e.clientY - resizeStartRef.current.clientY;

    const nextW = Math.max(300, Math.min(window.innerWidth - 50, resizeStartRef.current.winW + dw));
    const nextH = Math.max(200, Math.min(window.innerHeight - 50, resizeStartRef.current.winH + dh));

    onUpdateLayout({ width: nextW, height: nextH });
  };

  const handleResizeMouseUp = () => {
    resizeStartRef.current = null;
    window.removeEventListener('mousemove', handleResizeMouseMove);
    window.removeEventListener('mouseup', handleResizeMouseUp);
  };

  // 双击 Header 切换最大化
  const handleHeaderDoubleClick = () => {
    if (isMaximized) {
      // 还原
      if (prevLayout) {
        onUpdateLayout({
          x: prevLayout.x,
          y: prevLayout.y,
          width: prevLayout.width,
          height: prevLayout.height,
        });
      }
      setIsMaximized(false);
    } else {
      // 保存旧状态并最大化
      setPrevLayout({ x, y, width, height });
      onUpdateLayout({
        x: 16,
        y: 16,
        width: window.innerWidth - 32,
        height: window.innerHeight - 32,
      });
      setIsMaximized(true);
    }
  };

  // 渲染工具窗口的具体内容
  const renderContent = () => {
    if (toolId === 'stress-lab') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full text-xs opacity-50">载入中...</div>}>
          <StressLab />
        </Suspense>
      );
    }

    if (toolId === 'browser-assistant') {
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-full text-xs opacity-50">载入中...</div>}>
          <BrowserAssistantView />
        </Suspense>
      );
    }

    // 默认外部 iframe 工具
    if (url) {
      return (
        <iframe
          src={url}
          className="w-full h-full border-none bg-black select-none pointer-events-auto"
          title={title}
        />
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-xs text-red-500 font-medium">
        [未知工具，无可用 URL]
      </div>
    );
  };

  if (minimized) return null;

  return (
    <div
      ref={windowRef}
      onMouseDown={handleWindowClick}
      className="absolute flex flex-col pointer-events-auto transition-shadow duration-300"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: zIndex,
        background: 'var(--frost-card-framework-bg)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        border: '1px solid var(--frost-card-framework-border)',
        borderRadius: '16px',
        boxShadow: 'var(--frost-card-framework-shadow)',
        overflow: 'hidden',
      }}
    >
      {/* Window Header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        onDoubleClick={handleHeaderDoubleClick}
        className="flex items-center px-4 py-2 select-none cursor-move border-b border-[var(--frost-card-sub-border)]"
        style={{
          background: 'color-mix(in srgb, var(--frost-card-sub-bg) 40%, transparent)',
        }}
      >
        <span className="text-[12px] font-bold tracking-tight truncate max-w-[70%]" style={{ color: 'var(--text-primary)' }}>
          {title || toolId}
        </span>
        
        {/* 控制按钮组 */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => onMinimize(true)}
            className="p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-[var(--frost-card-sub-border)] transition-all outline-none"
            title="最小化"
          >
            <Minus size={11} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={handleHeaderDoubleClick}
            className="p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-[var(--frost-card-sub-border)] transition-all outline-none"
            title={isMaximized ? '还原' : '最大化'}
          >
            <Square size={10} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-red-500 hover:text-white transition-all outline-none"
            title="关闭"
          >
            <X size={11} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-auto min-h-0 bg-[var(--frost-card-sub-bg)] relative">
        {renderContent()}
      </div>

      {/* Resize Handle */}
      {!isMaximized && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5"
          style={{ zIndex: 100 }} // Z_INDEX_EXCEPTION
        >
          {/* 三道斜线拉伸手柄 SVG */}
          <svg width="8" height="8" viewBox="0 0 8 8" className="opacity-40 hover:opacity-80 transition-opacity">
            <line x1="6" y1="0" x2="0" y2="6" stroke="var(--text-secondary)" strokeWidth="1" />
            <line x1="8" y1="2" x2="2" y2="8" stroke="var(--text-secondary)" strokeWidth="1" />
            <line x1="8" y1="5" x2="5" y2="8" stroke="var(--text-secondary)" strokeWidth="1" />
          </svg>
        </div>
      )}
    </div>
  );
}
