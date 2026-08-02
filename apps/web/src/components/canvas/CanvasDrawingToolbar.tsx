import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Circle,
  GripVertical,
  Minus,
  MousePointer2,
  PenTool,
  Redo2,
  Settings2,
  Shapes,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import {
  clampFloatingToolbarPosition,
  type FloatingToolbarPoint,
} from './floatingToolbarPosition';
import {
  clampDrawingWidth,
  DRAWING_WIDTH_MAX,
  DRAWING_WIDTH_MIN,
  normalizeDrawingHexColor,
} from '../../canvas/canvasDrawingUtils';

export type CanvasDrawingTool = 'idle' | 'pen' | 'rect' | 'circle' | 'line' | 'arrow' | 'text' | 'select';

export const DRAWING_TOOLBAR_STORAGE_KEY = 'kk:canvas-drawing-toolbar:v2';
// These palette values are persisted as drawing strokes, so they must remain concrete colors instead of theme tokens. // UI_TOKEN_EXCEPTION
export const DRAWING_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#111827', '#f9fafb']; // UI_TOKEN_EXCEPTION
export { clampDrawingWidth, normalizeDrawingHexColor } from '../../canvas/canvasDrawingUtils';

interface CanvasDrawingToolbarProps {
  activeTool: CanvasDrawingTool;
  activeColor: string;
  activeWidth: number;
  selectedDrawingCount?: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onToolChange: (tool: CanvasDrawingTool) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear: () => void;
}

const DRAWING_WIDTH_LABELS: Record<number, string> = { 1: 'Fine', 4: 'Medium', 8: 'Bold', 16: 'Heavy' };

function readStoredToolbarPosition(): FloatingToolbarPoint {
  if (typeof window === 'undefined') return { x: 16, y: 64 };
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAWING_TOOLBAR_STORAGE_KEY) || 'null');
    if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
  } catch {
    // A stale toolbar position is harmless; use the compact default.
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
      { width: rect?.width || 360, height: rect?.height || 42 },
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
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
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({ label, active = false, disabled = false, onClick, children }) => (
  <button
    type="button"
    className="kk-drawing-toolbar__control h-8 w-8"
    data-active={active ? 'true' : 'false'}
    aria-label={label}
    title={label}
    disabled={disabled}
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
      <ToolbarIconButton label="Shapes" active={shapeActive} onClick={() => setOpen((visible) => !visible)}><Shapes size={15} /></ToolbarIconButton>
      {open ? (
        <div className="kk-drawing-toolbar__shape-menu" role="menu" aria-label="Shape tools">
          <ToolbarIconButton label="Rectangle" active={activeTool === 'rect'} onClick={() => { onToolChange('rect'); setOpen(false); }}><Square size={15} /></ToolbarIconButton>
          <ToolbarIconButton label="Circle" active={activeTool === 'circle'} onClick={() => { onToolChange('circle'); setOpen(false); }}><Circle size={15} /></ToolbarIconButton>
          <ToolbarIconButton label="Line" active={activeTool === 'line'} onClick={() => { onToolChange('line'); setOpen(false); }}><Minus size={15} /></ToolbarIconButton>
          <ToolbarIconButton label="Arrow" active={activeTool === 'arrow'} onClick={() => { onToolChange('arrow'); setOpen(false); }}><ArrowRight size={15} /></ToolbarIconButton>
        </div>
      ) : null}
    </div>
  );
};

/** Compact drawing toolbar. It only changes the active tool; drawing starts after a tool is selected. */
export const CanvasDrawingToolbar: React.FC<CanvasDrawingToolbarProps> = ({
  activeTool,
  activeColor,
  activeWidth,
  selectedDrawingCount = 0,
  canUndo = false,
  canRedo = false,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onRedo,
  onClear,
}) => {
  const drag = useFloatingToolbarPosition();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hexValue, setHexValue] = useState(activeColor);

  useEffect(() => setHexValue(activeColor), [activeColor]);

  const commitHex = (value: string) => {
    const normalized = normalizeDrawingHexColor(value);
    if (normalized) {
      onColorChange(normalized);
      setHexValue(normalized);
    }
  };

  return (
    <div
      ref={drag.toolbarRef}
      className="kk-drawing-toolbar"
      style={{ left: drag.position.x, top: drag.position.y }}
      role="toolbar"
      aria-label="Canvas drawing tools"
    >
      <button
        type="button"
        data-drawing-toolbar-handle="true"
        className="kk-drawing-toolbar__handle h-8 w-5"
        aria-label="Drag drawing toolbar"
        title="Drag toolbar"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerUp}
      >
        <GripVertical size={13} />
      </button>
      <div className="kk-drawing-toolbar__group">
        <ToolbarIconButton label="Idle / select canvas" active={activeTool === 'idle'} onClick={() => onToolChange('idle')}><MousePointer2 size={15} /></ToolbarIconButton>
        <ToolbarIconButton label="Pen" active={activeTool === 'pen'} onClick={() => onToolChange('pen')}><PenTool size={15} /></ToolbarIconButton>
        <ToolbarIconButton label="Select drawings" active={activeTool === 'select'} onClick={() => onToolChange('select')}><Settings2 size={15} /></ToolbarIconButton>
        <ToolbarIconButton label="Text" active={activeTool === 'text'} onClick={() => onToolChange('text')}><Type size={15} /></ToolbarIconButton>
        <DrawingShapeControls activeTool={activeTool} onToolChange={onToolChange} />
      </div>
      <div className="kk-drawing-toolbar__group kk-drawing-toolbar__settings-group">
        <ToolbarIconButton label="Color and stroke settings" active={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}><span className="kk-drawing-toolbar__color-indicator" style={{ backgroundColor: activeColor }} /></ToolbarIconButton>
        {settingsOpen ? (
          <div className="kk-drawing-toolbar__settings-panel">
            {DRAWING_COLORS.map((color) => (
              <button key={color} type="button" className="kk-drawing-toolbar__swatch h-7 w-7" data-active={activeColor === color ? 'true' : 'false'} aria-label={`Color ${color}`} onClick={() => onColorChange(color)}>
                <span style={{ backgroundColor: color }} />
              </button>
            ))}
            <label className="kk-drawing-toolbar__hex-field">
              <span>#</span>
              <input value={hexValue.replace(/^#/, '')} maxLength={6} aria-label="Custom HEX color" onChange={(event) => setHexValue(`#${event.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6)}`)} onBlur={() => commitHex(hexValue)} onKeyDown={(event) => { if (event.key === 'Enter') commitHex(hexValue); }} />
            </label>
            <label className="kk-drawing-toolbar__range-field">
              <span>{Math.round(activeWidth)}px</span>
              <input type="range" min={DRAWING_WIDTH_MIN} max={DRAWING_WIDTH_MAX} step={1} value={activeWidth} aria-label="Stroke width" onChange={(event) => onWidthChange(clampDrawingWidth(Number(event.target.value)))} />
            </label>
          </div>
        ) : null}
      </div>
      <div className="kk-drawing-toolbar__group">
        <ToolbarIconButton label="Undo drawing change" disabled={!canUndo} onClick={() => onUndo?.()}><Undo2 size={15} /></ToolbarIconButton>
        <ToolbarIconButton label="Redo drawing change" disabled={!canRedo} onClick={() => onRedo?.()}><Redo2 size={15} /></ToolbarIconButton>
        <ToolbarIconButton label={`Clear all drawings${selectedDrawingCount ? ` (${selectedDrawingCount} selected)` : ''}`} onClick={onClear}><Trash2 size={15} /></ToolbarIconButton>
      </div>
    </div>
  );
};

export default CanvasDrawingToolbar;
