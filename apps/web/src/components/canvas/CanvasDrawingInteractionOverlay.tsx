import React, { useEffect, useRef, useState } from 'react';
import { KK_LAYER } from '@kk/ui';
import type { CanvasDrawing } from '../../types/index.ts';
import type { InfiniteCanvasHandle } from './InfiniteCanvas.tsx';
import type { CanvasDrawingTool } from './CanvasDrawingToolbar';
import { clientPointToCanvasPoint } from '../../canvas/canvasCoordinates.ts';
import { getDrawingBounds, selectCanvasDrawingsInBounds, type CanvasDrawingBounds } from '../../canvas/canvasDrawingUtils';

interface CanvasDrawingInteractionOverlayProps {
  canvasRef: React.RefObject<InfiniteCanvasHandle | null>;
  canvasMode: 'normal' | 'board';
  activeTool: CanvasDrawingTool;
  activeColor: string;
  activeWidth: number;
  drawings: CanvasDrawing[];
  addCanvasDrawing: (drawing: CanvasDrawing) => void;
  updateCanvasDrawing?: (id: string, updates: Partial<CanvasDrawing>) => void;
  moveCanvasDrawings?: (ids: string[], delta: { x: number; y: number }) => void;
  onSelectionChange?: (ids: string[]) => void;
  promptNodes?: any[];
  imageNodes?: any[];
}

const CANVAS_DRAWING_OVERLAY_LAYER = KK_LAYER.nodeSelected;
const CANVAS_DRAWING_TEXT_INPUT_LAYER = KK_LAYER.floating;
const CANVAS_DRAWING_OVERLAY_ORIGIN_OFFSET = 100000;

type Point = { x: number; y: number };
const DRAWING_TOOLS = ['pen', 'rect', 'circle', 'line', 'arrow'] as const;
type DrawableDrawingTool = typeof DRAWING_TOOLS[number];

const isDrawableTool = (tool: CanvasDrawingTool): tool is DrawableDrawingTool => (
  DRAWING_TOOLS.some((candidate) => candidate === tool)
);

export { getDrawingBounds, selectCanvasDrawingsInBounds } from '../../canvas/canvasDrawingUtils';

const intersects = (a: CanvasDrawingBounds, b: CanvasDrawingBounds) => !(
  a.x > b.x + b.width
  || a.x + a.width < b.x
  || a.y > b.y + b.height
  || a.y + a.height < b.y
);

const isPointInBounds = (point: Point, bounds: CanvasDrawingBounds, tolerance = 10) => (
  point.x >= bounds.x - tolerance
  && point.x <= bounds.x + bounds.width + tolerance
  && point.y >= bounds.y - tolerance
  && point.y <= bounds.y + bounds.height + tolerance
);

export const CanvasDrawingInteractionOverlay: React.FC<CanvasDrawingInteractionOverlayProps> = ({
  canvasRef,
  canvasMode,
  activeTool,
  activeColor,
  activeWidth,
  drawings,
  addCanvasDrawing,
  updateCanvasDrawing,
  moveCanvasDrawings,
  onSelectionChange,
  promptNodes = [],
  imageNodes = [],
}) => {
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const touchPointersRef = useRef(new Map<number, Point>());
  const touchGestureRef = useRef<{ distance: number; worldX: number; worldY: number; scale: number } | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const selectionActionRef = useRef<'box' | 'move' | null>(null);
  const selectedDrawingIdsRef = useRef<string[]>([]);
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
  const [editingDrawingId, setEditingDrawingId] = useState<string | null>(null);

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
    const bounds = getDrawingBounds({ id: 'binding', type: 'line', points, color: '', width: 1 });
    if (!bounds) return undefined;
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const candidates = [
      ...promptNodes.map((node) => ({ id: node.id, position: node.position, width: node.width || 320, height: node.height || 160 })),
      ...imageNodes.map((node) => ({ id: node.id, position: node.position, width: node.exactDimensions?.width || 280, height: node.exactDimensions?.height || 320 })),
    ];
    let match: { id: string; distance: number } | null = null;
    for (const candidate of candidates) {
      const candidateBounds = { x: candidate.position.x - candidate.width / 2, y: candidate.position.y - candidate.height, width: candidate.width, height: candidate.height };
      if (!intersects(bounds, candidateBounds)) continue;
      const distance = Math.hypot(center.x - candidate.position.x, center.y - (candidate.position.y - candidate.height / 2));
      if (!match || distance < match.distance) match = { id: candidate.id, distance };
    }
    return match?.id;
  };

  const findDrawingAtPoint = (point: Point) => [...drawings].reverse().find((drawing) => {
    const bounds = getDrawingBounds(drawing);
    return bounds ? isPointInBounds(point, bounds, Math.max(8, drawing.width * 2)) : false;
  });

  const setSelectedDrawingIds = (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    selectedDrawingIdsRef.current = uniqueIds;
    onSelectionChange?.(uniqueIds);
  };

  const submitText = () => {
    const value = textInputValue.trim();
    if (editingDrawingId) {
      if (value && updateCanvasDrawing) updateCanvasDrawing(editingDrawingId, { text: value, color: activeColor, width: activeWidth, fontSize: activeWidth * 5 + 12 });
    } else if (textInputPos && value) {
      addCanvasDrawing({
        id: `draw_${Math.random().toString(36).slice(2, 9)}`,
        type: 'text',
        points: [textInputPos],
        color: activeColor,
        width: activeWidth,
        text: value,
        fontSize: activeWidth * 5 + 12,
        bindingNodeId: findBindingNodeId([textInputPos]),
      });
    }
    setTextInputPos(null);
    setTextInputValue('');
    setEditingDrawingId(null);
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
        setEditingDrawingId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [textInputPos]);

  if (canvasMode !== 'board') return null;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'idle' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (event.pointerType === 'touch') touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const point = getCanvasCoords(event.clientX, event.clientY);
    if (!point) return;
    if (textInputPos) submitText();
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    if (event.pointerType === 'touch' && touchPointersRef.current.size >= 2) {
      const [first, second] = Array.from(touchPointersRef.current.values()).slice(0, 2);
      const rect = canvasRef.current?.getCanvasRect();
      const transform = canvasRef.current?.getCurrentTransform();
      if (rect && transform) {
        const midpoint = { x: (first.x + second.x) / 2 - rect.left, y: (first.y + second.y) / 2 - rect.top };
        touchGestureRef.current = { distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)), worldX: (midpoint.x - transform.x) / transform.scale, worldY: (midpoint.y - transform.y) / transform.scale, scale: transform.scale };
      }
      isDrawingRef.current = false;
      pointsRef.current = [];
      hideAllPreviews();
      return;
    }

    activePointerIdRef.current = event.pointerId;
    if (activeTool === 'select') {
      const hit = findDrawingAtPoint(point);
      if (hit) {
        const nextIds = event.shiftKey
          ? (selectedDrawingIdsRef.current.includes(hit.id) ? selectedDrawingIdsRef.current.filter((id) => id !== hit.id) : [...selectedDrawingIdsRef.current, hit.id])
          : [hit.id];
        setSelectedDrawingIds(nextIds);
        selectionActionRef.current = 'move';
        pointsRef.current = [point];
        isDrawingRef.current = true;
        if (hit.type === 'text' && event.detail >= 2) {
          setEditingDrawingId(hit.id);
          setTextInputPos(hit.points[0]);
          setTextInputValue(hit.text || '');
          isDrawingRef.current = false;
        }
      } else {
        setSelectedDrawingIds([]);
        selectionActionRef.current = 'box';
        pointsRef.current = [point];
        isDrawingRef.current = true;
      }
      updatePreviewStyles();
      return;
    }
    if (activeTool === 'text') {
      setEditingDrawingId(null);
      setTextInputPos(point);
      setTextInputValue('');
      activePointerIdRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    isDrawingRef.current = true;
    pointsRef.current = [point];
    updatePreviewStyles();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && touchPointersRef.current.has(event.pointerId)) touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchGestureRef.current && touchPointersRef.current.size >= 2) {
      const [first, second] = Array.from(touchPointersRef.current.values()).slice(0, 2);
      const rect = canvasRef.current?.getCanvasRect();
      if (!rect) return;
      event.preventDefault();
      event.stopPropagation();
      const gesture = touchGestureRef.current;
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const scale = Math.min(3, Math.max(0.1, gesture.scale * (distance / gesture.distance)));
      const midpoint = { x: (first.x + second.x) / 2 - rect.left, y: (first.y + second.y) / 2 - rect.top };
      canvasRef.current?.setView(midpoint.x - gesture.worldX * scale, midpoint.y - gesture.worldY * scale, scale);
      return;
    }
    if (!isDrawingRef.current || activePointerIdRef.current !== event.pointerId) return;
    const point = getCanvasCoords(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    const points = pointsRef.current;
    const start = points[0];
    if (activeTool === 'select' && selectionActionRef.current === 'move') {
      points[1] = point;
      const selectedBounds = drawings.filter((drawing) => selectedDrawingIdsRef.current.includes(drawing.id)).map(getDrawingBounds).filter((bounds): bounds is CanvasDrawingBounds => Boolean(bounds));
      if (selectedBounds.length > 0) {
        const minX = Math.min(...selectedBounds.map((bounds) => bounds.x)) + point.x - start.x;
        const minY = Math.min(...selectedBounds.map((bounds) => bounds.y)) + point.y - start.y;
        const maxX = Math.max(...selectedBounds.map((bounds) => bounds.x + bounds.width)) + point.x - start.x;
        const maxY = Math.max(...selectedBounds.map((bounds) => bounds.y + bounds.height)) + point.y - start.y;
        previewSelectRef.current?.setAttribute('x', String(minX));
        previewSelectRef.current?.setAttribute('y', String(minY));
        previewSelectRef.current?.setAttribute('width', String(maxX - minX));
        previewSelectRef.current?.setAttribute('height', String(maxY - minY));
        if (previewSelectRef.current) previewSelectRef.current.style.display = 'block';
      }
      return;
    }
    if (activeTool === 'select' && selectionActionRef.current === 'box') {
      points[1] = point;
      const bounds = {
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y),
      };
      previewSelectRef.current?.setAttribute('x', String(bounds.x));
      previewSelectRef.current?.setAttribute('y', String(bounds.y));
      previewSelectRef.current?.setAttribute('width', String(bounds.width));
      previewSelectRef.current?.setAttribute('height', String(bounds.height));
      if (previewSelectRef.current) previewSelectRef.current.style.display = 'block';
      return;
    }
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
    if (activeTool === 'rect') {
      previewRectRef.current?.setAttribute('x', String(x)); previewRectRef.current?.setAttribute('y', String(y)); previewRectRef.current?.setAttribute('width', String(width)); previewRectRef.current?.setAttribute('height', String(height));
      if (previewRectRef.current) previewRectRef.current.style.display = 'block';
    } else if (activeTool === 'circle') {
      previewCircleRef.current?.setAttribute('cx', String((start.x + point.x) / 2)); previewCircleRef.current?.setAttribute('cy', String((start.y + point.y) / 2)); previewCircleRef.current?.setAttribute('r', String(Math.hypot(point.x - start.x, point.y - start.y) / 2));
      if (previewCircleRef.current) previewCircleRef.current.style.display = 'block';
    } else if (activeTool === 'line') {
      previewLineRef.current?.setAttribute('x1', String(start.x)); previewLineRef.current?.setAttribute('y1', String(start.y)); previewLineRef.current?.setAttribute('x2', String(point.x)); previewLineRef.current?.setAttribute('y2', String(point.y));
      if (previewLineRef.current) previewLineRef.current.style.display = 'block';
    } else if (activeTool === 'arrow') {
      const angle = Math.atan2(point.y - start.y, point.x - start.x);
      const length = 14 + activeWidth * 1.5;
      const wings = [angle - Math.PI / 6, angle + Math.PI / 6];
      previewArrowLineRef.current?.setAttribute('x1', String(start.x)); previewArrowLineRef.current?.setAttribute('y1', String(start.y)); previewArrowLineRef.current?.setAttribute('x2', String(point.x)); previewArrowLineRef.current?.setAttribute('y2', String(point.y));
      [previewArrowWing1Ref, previewArrowWing2Ref].forEach((ref, index) => { ref.current?.setAttribute('x1', String(point.x)); ref.current?.setAttribute('y1', String(point.y)); ref.current?.setAttribute('x2', String(point.x - length * Math.cos(wings[index]))); ref.current?.setAttribute('y2', String(point.y - length * Math.sin(wings[index]))); });
      if (previewArrowGroupRef.current) previewArrowGroupRef.current.style.display = 'block';
    }
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (event.pointerType === 'touch') touchPointersRef.current.delete(event.pointerId);
    if (touchGestureRef.current) {
      touchGestureRef.current = touchPointersRef.current.size >= 2 ? touchGestureRef.current : null;
      isDrawingRef.current = false;
      pointsRef.current = [];
      hideAllPreviews();
      return;
    }
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    activePointerIdRef.current = null;
    isDrawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    hideAllPreviews();
    const points = pointsRef.current;
    pointsRef.current = [];
    if (cancelled || points.length < 1) return;
    const point = points[points.length - 1];
    const start = points[0];
    if (activeTool === 'select') {
      if (selectionActionRef.current === 'move') {
        const delta = { x: point.x - start.x, y: point.y - start.y };
        if (moveCanvasDrawings && (delta.x !== 0 || delta.y !== 0)) moveCanvasDrawings(selectedDrawingIdsRef.current, delta);
      } else if (selectionActionRef.current === 'box' && points.length >= 2) {
        const bounds = { x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) };
        if (bounds.width > 10 && bounds.height > 10) setSelectedDrawingIds(selectCanvasDrawingsInBounds(drawings, bounds).map((drawing) => drawing.id));
      }
      selectionActionRef.current = null;
      return;
    }
    if (points.length < 2 || !isDrawableTool(activeTool)) return;
    addCanvasDrawing({ id: `draw_${Math.random().toString(36).slice(2, 9)}`, type: activeTool, points: [...points], color: activeColor, width: activeWidth, bindingNodeId: findBindingNodeId(points) });
  };

  return (
    <div
      className="kk-canvas-drawing-overlay absolute"
      style={{ zIndex: CANVAS_DRAWING_OVERLAY_LAYER, touchAction: 'none', pointerEvents: activeTool === 'idle' ? 'none' : 'auto' }}
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
          <rect ref={previewSelectRef} stroke="var(--kk-canvas-drawing-selection-stroke)" strokeWidth={1.5} strokeDasharray="4 4" fill="var(--kk-canvas-drawing-selection-fill)" rx={2} style={{ display: 'none' }} />
        </g>
      </svg>
      {textInputPos && (
        <div className="kk-canvas-drawing-text-input-anchor" style={{ left: textInputPos.x + CANVAS_DRAWING_OVERLAY_ORIGIN_OFFSET, top: textInputPos.y + CANVAS_DRAWING_OVERLAY_ORIGIN_OFFSET, transformOrigin: 'top left', zIndex: CANVAS_DRAWING_TEXT_INPUT_LAYER }}>
          <input
            ref={inputRef}
            type="text"
            value={textInputValue}
            onChange={(event) => setTextInputValue(event.target.value)}
            onBlur={submitText}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitText(); } }}
            className="kk-canvas-drawing-text-input"
            style={{ color: activeColor, fontSize: `${activeWidth * 5 + 12}px` }}
            placeholder="Type and press Enter"
          />
        </div>
      )}
    </div>
  );
};

export default CanvasDrawingInteractionOverlay;
