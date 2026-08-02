import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Circle,
  GripVertical,
  Minus,
  MousePointer2,
  PenTool,
  Scissors,
  Shapes,
  Square,
  Trash2,
  Type,
} from 'lucide-react';

import {
  clampFloatingToolbarPosition,
  type FloatingToolbarPoint,
} from './floatingToolbarPosition';

export type CanvasDrawingTool = 'pen' | 'rect' | 'circle' | 'line' | 'arrow' | 'text' | 'select';

export const DRAWING_TOOLBAR_STORAGE_KEY = 'kk:canvas-drawing-toolbar:v1';

interface CanvasDrawingToolbarProps {
  activeTool: CanvasDrawingTool;
  activeColor: string;
  activeWidth: number;
  onToolChange: (tool: CanvasDrawingTool) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onClear: () => void;
}

const DRAWING_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#111827', '#f9fafb']; // UI_TOKEN_EXCEPTION
const DRAWING_WIDTHS = [2, 4, 8];

function readStoredToolbarPosition(): FloatingToolbarPoint {
  if (typeof window === 'undefined') return { x: 16, y: 64 };
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAWING_TOOLBAR_STORAGE_KEY) || 'null');
    if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
  } catch {
    // Invalid legacy layout is ignored and replaced on the next successful drag.
  }
  return { x: 16, y: 64 };
}

function useFloatingToolbarPosition() {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; origin: FloatingToolbarPoint } | null>(null);
  const [position, setPosition] = useState(readStoredToolbarPosition);
  const clamp = useCallback((next: FloatingToolbarPoint) => {
    const rect = toolbarRef.current?.getBoundingClientRect();
    return clampFloatingToolbarPosition(
      next,
      { width: rect?.width || 420, height: rect?.height || 44 },
      { width: window.innerWidth, height: window.innerHeight },
    );
  }, []);

  useEffect(() => {
    const handleResize = () => setPosition((current) => clamp(current));
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clamp]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: position };
  }, [position]);
  const onPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(clamp({ x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y }));
  }, [clamp]);
  const onPointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setPosition((current) => {
      localStorage.setItem(DRAWING_TOOLBAR_STORAGE_KEY, JSON.stringify(current));
      return current;
    });
  }, []);
  return { toolbarRef, position, onPointerDown, onPointerMove, onPointerUp };
}

interface ToolbarIconButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({ label, active = false, onClick, children }) => (
  <button
    type="button"
    className="kk-drawing-toolbar__control h-9 w-9"
    data-active={active ? 'true' : 'false'}
    aria-label={label}
    title={label}
    onClick={onClick}
  >
    {children}
  </button>
);

const DrawingShapeControls: React.FC<Pick<CanvasDrawingToolbarProps, 'activeTool' | 'onToolChange'>> = ({ activeTool, onToolChange }) => {
  const [open, setOpen] = useState(false);
  const shapeActive = ['rect', 'circle', 'line', 'arrow'].includes(activeTool);
  return (
    <div className="kk-drawing-toolbar__shape-wrap">
      <ToolbarIconButton label="形状工具" active={shapeActive} onClick={() => setOpen((visible) => !visible)}>
        <Shapes size={16} />
      </ToolbarIconButton>
      {open ? (
        <div className="kk-drawing-toolbar__shape-menu" role="menu" aria-label="选择形状">
          <ToolbarIconButton label="矩形" active={activeTool === 'rect'} onClick={() => { onToolChange('rect'); setOpen(false); }}><Square size={16} /></ToolbarIconButton>
          <ToolbarIconButton label="圆形" active={activeTool === 'circle'} onClick={() => { onToolChange('circle'); setOpen(false); }}><Circle size={16} /></ToolbarIconButton>
          <ToolbarIconButton label="直线" active={activeTool === 'line'} onClick={() => { onToolChange('line'); setOpen(false); }}><Minus size={16} /></ToolbarIconButton>
          <ToolbarIconButton label="箭头" active={activeTool === 'arrow'} onClick={() => { onToolChange('arrow'); setOpen(false); }}><ArrowRight size={16} /></ToolbarIconButton>
        </div>
      ) : null}
    </div>
  );
};

/** Compact, draggable desktop toolbar for board-mode drawing. */
export const CanvasDrawingToolbar: React.FC<CanvasDrawingToolbarProps> = ({
  activeTool,
  activeColor,
  activeWidth,
  onToolChange,
  onColorChange,
  onWidthChange,
  onClear,
}) => {
  const drag = useFloatingToolbarPosition();
  return (
    <div
      ref={drag.toolbarRef}
      className="kk-drawing-toolbar"
      style={{ left: drag.position.x, top: drag.position.y }}
      role="toolbar"
      aria-label="画板工具"
    >
      <button
        type="button"
        data-drawing-toolbar-handle="true"
        className="kk-drawing-toolbar__handle h-9 w-6"
        aria-label="拖动画板工具栏"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerUp}
      >
        <GripVertical size={15} />
      </button>
      <div className="kk-drawing-toolbar__group">
        <ToolbarIconButton label="自由画笔" active={activeTool === 'pen'} onClick={() => onToolChange('pen')}><PenTool size={16} /></ToolbarIconButton>
        <ToolbarIconButton label="框选为参考" active={activeTool === 'select'} onClick={() => onToolChange('select')}><Scissors size={16} /></ToolbarIconButton>
        <ToolbarIconButton label="文本" active={activeTool === 'text'} onClick={() => onToolChange('text')}><Type size={16} /></ToolbarIconButton>
        <DrawingShapeControls activeTool={activeTool} onToolChange={onToolChange} />
      </div>
      <div className="kk-drawing-toolbar__group" aria-label="颜色">
        {DRAWING_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="kk-drawing-toolbar__swatch h-9 w-6"
            data-active={activeColor === color ? 'true' : 'false'}
            aria-label={`选择颜色 ${color}`}
            onClick={() => onColorChange(color)}
          >
            <span style={{ backgroundColor: color }} />
          </button>
        ))}
      </div>
      <div className="kk-drawing-toolbar__group" aria-label="线宽">
        {DRAWING_WIDTHS.map((width) => (
          <button
            key={width}
            type="button"
            className="kk-drawing-toolbar__width h-9"
            data-active={activeWidth === width ? 'true' : 'false'}
            onClick={() => onWidthChange(width)}
          >
            {width === 2 ? '细' : width === 4 ? '中' : '粗'}
          </button>
        ))}
      </div>
      <ToolbarIconButton label="清除画板" onClick={onClear}><Trash2 size={16} /></ToolbarIconButton>
    </div>
  );
};
