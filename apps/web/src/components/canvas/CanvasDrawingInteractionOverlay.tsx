import React, { useEffect, useRef, useState } from 'react';
import { KK_LAYER } from '@kk/ui';
import type { CanvasDrawing } from '../../types/index.ts';
import type { InfiniteCanvasHandle } from './InfiniteCanvas.tsx';
import { notify } from '../../services/system/notificationService.ts';
import { clientPointToCanvasPoint } from '../../canvas/canvasCoordinates.ts';

interface CanvasDrawingInteractionOverlayProps {
  canvasRef: React.RefObject<InfiniteCanvasHandle | null>;
  canvasMode: 'normal' | 'board';
  activeTool: 'pen' | 'rect' | 'circle' | 'line' | 'arrow' | 'text' | 'select';
  activeColor: string;
  activeWidth: number;
  drawings: CanvasDrawing[];
  addCanvasDrawing: (drawing: CanvasDrawing) => void;
  onConvertDrawingsToNote?: (drawingIds: string[]) => void;
  promptNodes?: any[];
  imageNodes?: any[];
}

const CANVAS_DRAWING_OVERLAY_LAYER = KK_LAYER.nodeSelected;
const CANVAS_DRAWING_TEXT_INPUT_LAYER = KK_LAYER.floating;
const CANVAS_DRAWING_OVERLAY_ORIGIN_OFFSET = 100000;

type Point = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };

const intersects = (a: Bounds, b: Bounds) => !(
  a.x > b.x + b.width
  || a.x + a.width < b.x
  || a.y > b.y + b.height
  || a.y + a.height < b.y
);

const getDrawingBounds = (drawing: CanvasDrawing): Bounds | null => {
  if (!drawing.points?.length) return null;
  const minX = Math.min(...drawing.points.map((point) => point.x));
  const minY = Math.min(...drawing.points.map((point) => point.y));
  let maxX = Math.max(...drawing.points.map((point) => point.x));
  let maxY = Math.max(...drawing.points.map((point) => point.y));
  if (drawing.type === 'text') {
    maxX += (drawing.fontSize || 16) * (drawing.text?.length || 2);
    maxY += (drawing.fontSize || 16) * 1.2;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

export const selectCanvasDrawingsInBounds = (
  drawings: readonly CanvasDrawing[],
  bounds: Bounds,
): CanvasDrawing[] => drawings.filter((drawing) => {
  const drawingBounds = getDrawingBounds(drawing);
  if (!drawingBounds || !intersects(drawingBounds, bounds)) return false;
  if (drawing.type === 'pen' || drawing.type === 'marker') {
    return drawing.points.some((point) => (
      point.x >= bounds.x
      && point.x <= bounds.x + bounds.width
      && point.y >= bounds.y
      && point.y <= bounds.y + bounds.height
    ));
  }
  return true;
});

export const CanvasDrawingInteractionOverlay: React.FC<CanvasDrawingInteractionOverlayProps> = ({
  canvasRef,
  canvasMode,
  activeTool,
  activeColor,
  activeWidth,
  drawings,
  addCanvasDrawing,
  onConvertDrawingsToNote,
  promptNodes = [],
  imageNodes = [],
}) => {
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const previewPathRef = useRef<SVGPathElement>(null);
  const previewRectRef = useRef<SVGRectElement>(null);
  const previewCircleRef = useRef<SVGCircleElement>(null);
  const previewLineRef = useRef<SVGLineElement>(null);
  const previewArrowGroupRef = useRef<SVGGElement>(null);
  const previewArrowLineRef = useRef<SVGLineElement>(null);
  const previewArrowWing1Ref = useRef<SVGLineElement>(null);
  const previewArrowWing2Ref = useRef<SVGLineElement>(null);
  const previewSelectRef = useRef<SVGRectElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [textInputPos, setTextInputPos] = useState<Point | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getCanvasRect();
    const transform = canvasRef.current?.getCurrentTransform();
    return rect && transform
      ? clientPointToCanvasPoint({ x: clientX, y: clientY }, rect, transform)
      : null;
  };

  const hideAllPreviews = () => {
    [previewPathRef, previewRectRef, previewCircleRef, previewLineRef, previewArrowGroupRef, previewSelectRef]
      .forEach((ref) => { if (ref.current) ref.current.style.display = 'none'; });
  };

  const updatePreviewStyles = () => {
    [previewPathRef, previewRectRef, previewCircleRef, previewLineRef, previewArrowLineRef, previewArrowWing1Ref, previewArrowWing2Ref]
      .forEach((ref) => {
        ref.current?.setAttribute('stroke', activeColor);
        ref.current?.setAttribute('stroke-width', String(activeWidth));
      });
  };

  const findBindingNodeId = (points: Point[]): string | undefined => {
    if (points.length === 0) return undefined;
    const bounds = getDrawingBounds({ id: 'binding', type: 'line', points, color: '', width: 1 } as CanvasDrawing);
    if (!bounds) return undefined;
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    let match: { id: string; distance: number } | null = null;
    const candidates = [
      ...promptNodes.map((node) => ({ id: node.id, position: node.position, width: node.width || 320, height: node.height || 160 })),
      ...imageNodes.map((node) => ({ id: node.id, position: node.position, width: node.exactDimensions?.width || 280, height: node.exactDimensions?.height || 320 })),
    ];
    for (const candidate of candidates) {
      const candidateBounds = {
        x: candidate.position.x - candidate.width / 2,
        y: candidate.position.y - candidate.height,
        width: candidate.width,
        height: candidate.height,
      };
      if (!intersects(bounds, candidateBounds)) continue;
      const distance = Math.hypot(center.x - candidate.position.x, center.y - (candidate.position.y - candidate.height / 2));
      if (!match || distance < match.distance) match = { id: candidate.id, distance };
    }
    return match?.id;
  };

  const submitText = () => {
    if (textInputPos && textInputValue.trim()) {
      addCanvasDrawing({
        id: `draw_${Math.random().toString(36).slice(2, 9)}`,
        type: 'text',
        points: [textInputPos],
        color: activeColor,
        width: activeWidth,
        text: textInputValue.trim(),
        fontSize: activeWidth * 5 + 12,
        bindingNodeId: findBindingNodeId([textInputPos]),
      });
    }
    setTextInputPos(null);
    setTextInputValue('');
  };

  useEffect(() => {
    if (textInputPos) inputRef.current?.focus();
  }, [textInputPos]);

  useEffect(() => {
    if (!textInputPos) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTextInputPos(null);
        setTextInputValue('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [textInputPos]);

  if (canvasMode !== 'board') return null;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (textInputPos) submitText();
    const point = getCanvasCoords(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    if (activeTool === 'text') {
      setTextInputPos(point);
      setTextInputValue('');
      activePointerIdRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    isDrawingRef.current = true;
    pointsRef.current = [point];
    updatePreviewStyles();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current || activePointerIdRef.current !== event.pointerId) return;
    const point = getCanvasCoords(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    const points = pointsRef.current;
    const start = points[0];
    if (activeTool === 'pen') {
      const last = points[points.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) <= 4) return;
      points.push(point);
      previewPathRef.current?.setAttribute('d', `M ${points.map((item) => `${item.x} ${item.y}`).join(' L ')}`);
      if (previewPathRef.current) previewPathRef.current.style.display = 'block';
      return;
    }
    points[1] = point;
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    const width = Math.abs(point.x - start.x);
    const height = Math.abs(point.y - start.y);
    if (activeTool === 'rect' || activeTool === 'select') {
      const ref = activeTool === 'select' ? previewSelectRef.current : previewRectRef.current;
      ref?.setAttribute('x', String(x));
      ref?.setAttribute('y', String(y));
      ref?.setAttribute('width', String(width));
      ref?.setAttribute('height', String(height));
      if (ref) ref.style.display = 'block';
    } else if (activeTool === 'circle') {
      previewCircleRef.current?.setAttribute('cx', String((start.x + point.x) / 2));
      previewCircleRef.current?.setAttribute('cy', String((start.y + point.y) / 2));
      previewCircleRef.current?.setAttribute('r', String(Math.hypot(point.x - start.x, point.y - start.y) / 2));
      if (previewCircleRef.current) previewCircleRef.current.style.display = 'block';
    } else if (activeTool === 'line') {
      previewLineRef.current?.setAttribute('x1', String(start.x));
      previewLineRef.current?.setAttribute('y1', String(start.y));
      previewLineRef.current?.setAttribute('x2', String(point.x));
      previewLineRef.current?.setAttribute('y2', String(point.y));
      if (previewLineRef.current) previewLineRef.current.style.display = 'block';
    } else if (activeTool === 'arrow') {
      const angle = Math.atan2(point.y - start.y, point.x - start.x);
      const length = 14 + activeWidth * 1.5;
      const wings = [angle - Math.PI / 6, angle + Math.PI / 6];
      previewArrowLineRef.current?.setAttribute('x1', String(start.x));
      previewArrowLineRef.current?.setAttribute('y1', String(start.y));
      previewArrowLineRef.current?.setAttribute('x2', String(point.x));
      previewArrowLineRef.current?.setAttribute('y2', String(point.y));
      [previewArrowWing1Ref, previewArrowWing2Ref].forEach((ref, index) => {
        ref.current?.setAttribute('x1', String(point.x));
        ref.current?.setAttribute('y1', String(point.y));
        ref.current?.setAttribute('x2', String(point.x - length * Math.cos(wings[index])));
        ref.current?.setAttribute('y2', String(point.y - length * Math.sin(wings[index])));
      });
      if (previewArrowGroupRef.current) previewArrowGroupRef.current.style.display = 'block';
    }
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    activePointerIdRef.current = null;
    isDrawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    hideAllPreviews();
    const points = pointsRef.current;
    pointsRef.current = [];
    if (cancelled || points.length < 2) return;
    const [start, end] = points;
    if (activeTool === 'select') {
      const bounds = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      };
      if (bounds.width <= 10 || bounds.height <= 10) return;
      const selected = selectCanvasDrawingsInBounds(drawings, bounds);
      if (selected.length > 0 && onConvertDrawingsToNote) {
        onConvertDrawingsToNote(selected.map((drawing) => drawing.id));
        notify.success('已创建记事本卡片', '框选内容已移动到可继续编辑的矢量卡片。');
      } else {
        notify.warning('无法转换', '框选区域内没有可转换的绘图内容。');
      }
      return;
    }
    addCanvasDrawing({
      id: `draw_${Math.random().toString(36).slice(2, 9)}`,
      type: activeTool,
      points: [...points],
      color: activeColor,
      width: activeWidth,
      bindingNodeId: findBindingNodeId(points),
    });
  };

  return (
    <div
      className="kk-canvas-drawing-overlay absolute"
      style={{ zIndex: CANVAS_DRAWING_OVERLAY_LAYER, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointer(event)}
      onPointerCancel={(event) => finishPointer(event, true)}
    >
      <svg className="absolute inset-0 overflow-visible pointer-events-none" style={{ width: '100%', height: '100%' }}>
        <g transform={`translate(${CANVAS_DRAWING_OVERLAY_ORIGIN_OFFSET} ${CANVAS_DRAWING_OVERLAY_ORIGIN_OFFSET})`}>
          <path ref={previewPathRef} strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ display: 'none' }} />
          <rect ref={previewRectRef} fill="none" rx={4} ry={4} style={{ display: 'none' }} />
          <circle ref={previewCircleRef} fill="none" style={{ display: 'none' }} />
          <line ref={previewLineRef} strokeLinecap="round" fill="none" style={{ display: 'none' }} />
          <g ref={previewArrowGroupRef} style={{ display: 'none' }}>
            <line ref={previewArrowLineRef} strokeLinecap="round" fill="none" />
            <line ref={previewArrowWing1Ref} strokeLinecap="round" fill="none" />
            <line ref={previewArrowWing2Ref} strokeLinecap="round" fill="none" />
          </g>
          <rect
            ref={previewSelectRef}
            stroke="var(--kk-canvas-drawing-selection-stroke)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="var(--kk-canvas-drawing-selection-fill)"
            rx={2}
            ry={2}
            style={{ display: 'none' }}
          />
        </g>
      </svg>
      {textInputPos && (
        <div
          className="kk-canvas-drawing-text-input-anchor"
          style={{
            left: textInputPos.x + CANVAS_DRAWING_OVERLAY_ORIGIN_OFFSET,
            top: textInputPos.y + CANVAS_DRAWING_OVERLAY_ORIGIN_OFFSET,
            transformOrigin: 'top left',
            zIndex: CANVAS_DRAWING_TEXT_INPUT_LAYER,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={textInputValue}
            onChange={(event) => setTextInputValue(event.target.value)}
            onBlur={submitText}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitText();
              }
            }}
            className="kk-canvas-drawing-text-input"
            style={{ color: activeColor, fontSize: `${activeWidth * 5 + 12}px` }}
            placeholder="输入文字，回车确认"
          />
        </div>
      )}
    </div>
  );
};

export default CanvasDrawingInteractionOverlay;
