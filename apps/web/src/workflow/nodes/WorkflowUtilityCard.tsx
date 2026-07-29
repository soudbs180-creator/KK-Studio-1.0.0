import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WorkflowNode } from '../../types';
import { canvasLivePositionStore } from '../../app/canvasLivePositionStore';
import { createWorkflowCardViewModel } from '../../canvas/v3/adapters.ts';
import CanvasV3Card from '../../canvas/v3/CanvasV3Card.tsx';
import { elevateCanvasStackZIndex } from '../../utils/canvasUtils';
import { snapCanvasPointToGrid } from '../../utils/canvasSnapToGrid';

type UtilityCardNode = Extract<WorkflowNode, { kind: 'preview' | 'save' | 'agent' }>;

interface WorkflowUtilityCardProps<TNode extends UtilityCardNode = UtilityCardNode> {
  node: TNode;
  title: string;
  subtitle: string;
  accentClassName: string;
  icon: ReactNode;
  actionLabel?: string;
  infoRows?: string[];
  isSelected?: boolean;
  highlighted?: boolean;
  zoomScale?: number;
  snapToGrid?: boolean;
  onSelect?: () => void;
  onBringToFront?: () => void;
  onDelete?: (id: string) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onAction?: (node: TNode) => void;
}

interface DragState {
  originX: number;
  originY: number;
  startX: number;
  startY: number;
}

const snapCanvasCoordinate = (value: number, scale = 1): number => (
  Math.round(value * scale) / scale
);

const getStackZIndex = (node: UtilityCardNode, selected: boolean): number => (
  elevateCanvasStackZIndex((node.zIndex ?? 0) * 100 + (selected ? 20 : 10), false)
);

const WorkflowUtilityCard = <TNode extends UtilityCardNode>({
  node,
  title,
  subtitle,
  icon,
  actionLabel,
  infoRows = [],
  isSelected = false,
  zoomScale = 1,
  snapToGrid = false,
  onSelect,
  onBringToFront,
  onPositionChange,
  onAction,
}: WorkflowUtilityCardProps<TNode>) => {
  const containerRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const viewModel = useMemo(() => createWorkflowCardViewModel({
    ...node,
    label: title,
    data: { ...node.data, summary: subtitle },
  }), [node, subtitle, title]);
  const visibleRows = useMemo(() => infoRows.filter(Boolean).slice(0, 3), [infoRows]);

  const flushDrag = () => {
    frameRef.current = null;
    const drag = dragRef.current;
    const pointer = latestPointerRef.current;
    if (!drag || !pointer) return;
    onPositionChange(node.id, snapCanvasPointToGrid({
      x: drag.originX + (pointer.x - drag.startX) / Math.max(zoomScale, 0.1),
      y: drag.originY + (pointer.y - drag.startY) / Math.max(zoomScale, 0.1),
    }, { enabled: snapToGrid }));
  };

  const scheduleDrag = (event: PointerEvent) => {
    if (!dragRef.current || event.pointerId !== pointerIdRef.current) return;
    latestPointerRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(flushDrag);
  };

  const stopDrag = (event: PointerEvent) => {
    if (event.pointerId !== pointerIdRef.current) return;
    if (event.type === 'pointerup') {
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    flushDrag();
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    pointerIdRef.current = null;
    dragRef.current = null;
    latestPointerRef.current = null;
    setIsDragging(false);
  };

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerIdRef.current = event.pointerId;
    dragRef.current = {
      originX: node.position.x,
      originY: node.position.y,
      startX: event.clientX,
      startY: event.clientY,
    };
    onSelect?.();
    onBringToFront?.();
    setIsDragging(true);
    window.addEventListener('pointermove', scheduleDrag);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', scheduleDrag);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  };

  useEffect(() => {
    const width = viewModel.width;
    return canvasLivePositionStore.subscribe(node.id, (position) => {
      if (!containerRef.current) return;
      if (!position) {
        containerRef.current.style.transform = '';
        return;
      }
      const left = snapCanvasCoordinate(position.x - width / 2, zoomScale);
      const top = snapCanvasCoordinate(position.y, zoomScale);
      containerRef.current.style.transform = `translate3d(${left - (node.position.x - width / 2)}px, ${top - node.position.y}px, 0)`;
    });
  }, [node.id, node.position.x, node.position.y, viewModel.width, zoomScale]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
  }, []);

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: node.position.x - viewModel.width / 2,
        top: node.position.y - 176,
        width: viewModel.width,
        zIndex: getStackZIndex(node, isSelected),
      }}
    >
      <CanvasV3Card
        ref={containerRef}
        viewModel={viewModel}
        renderState={{ detailLevel: 'full', selected: isSelected, dragging: isDragging, mobile: false }}
        onPointerDown={startDrag}
        onAction={(action) => {
          if (action.id === 'run' || action.id === 'open' || action.id === 'export') {
            onAction?.(node);
          }
        }}
      >
        <div className="kk-canvas-v3-utility-card__content">
          <div className="kk-canvas-v3-utility-card__lead">
            <span className="kk-canvas-v3-utility-card__icon">{icon}</span>
            <p>{subtitle}</p>
          </div>
          {visibleRows.length > 0 && (
            <ul>
              {visibleRows.map((row) => <li key={row}>{row}</li>)}
            </ul>
          )}
          {actionLabel && onAction && (
            <button
              type="button"
              className="kk-morphic-function-button"
              onClick={() => onAction(node)}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </CanvasV3Card>
    </div>
  );
};

export default WorkflowUtilityCard;
