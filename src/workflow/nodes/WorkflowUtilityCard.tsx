import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { WorkflowNode } from '../../types';
import { getCanvasCardShadow } from '../../utils/canvasCardShadow';
import { elevateCanvasStackZIndex } from '../../utils/canvasUtils';

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
  onSelect?: () => void;
  onBringToFront?: () => void;
  onDelete?: (id: string) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onAction?: (node: TNode) => void;
}

const getWorkflowCardStackZIndex = (node: UtilityCardNode, isSelected: boolean) => {
  const persistedOrder = (node.zIndex ?? 0) * 100;
  if (isSelected) return persistedOrder + 20;
  return persistedOrder + 10;
};

const snapCanvasCoordinate = (value: number, scale: number = 1) => {
  if (!Number.isFinite(value) || !Number.isFinite(scale) || scale <= 0) return value;
  return Math.round(value * scale) / scale;
};

const WorkflowUtilityCard = <TNode extends UtilityCardNode>({
  node,
  title,
  subtitle,
  accentClassName,
  icon,
  actionLabel,
  infoRows = [],
  isSelected = false,
  highlighted = false,
  zoomScale = 1,
  onSelect,
  onBringToFront,
  onDelete,
  onPositionChange,
  onAction,
}: WorkflowUtilityCardProps<TNode>) => {
  const width = node.width || 284;
  const height = node.height || 176;
  const dragStateRef = useRef<{
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleDragEnd = () => {
    dragStateRef.current = null;
    latestPointerRef.current = null;
    setIsDragging(false);
    document.body.style.userSelect = '';
  };

  const schedulePositionUpdate = () => {
    if (rafRef.current !== null) return;

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const dragState = dragStateRef.current;
      const pointer = latestPointerRef.current;
      if (!dragState || !pointer) return;

      const nextX = snapCanvasCoordinate(
        dragState.originX + (pointer.x - dragState.startX) / Math.max(zoomScale, 0.0001),
        zoomScale,
      );
      const nextY = snapCanvasCoordinate(
        dragState.originY + (pointer.y - dragState.startY) / Math.max(zoomScale, 0.0001),
        zoomScale,
      );

      onPositionChange(node.id, { x: nextX, y: nextY });
    });
  };

  const handleDragMove = (event: MouseEvent | TouchEvent) => {
    if (!dragStateRef.current) return;
    const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0]?.clientY : event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    latestPointerRef.current = { x: clientX as number, y: clientY as number };
    schedulePositionUpdate();
  };

  const handleDragStart = (event: React.MouseEvent | React.TouchEvent) => {
    if ('button' in event && event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;

    const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0]?.clientY : event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    dragStateRef.current = {
      originX: node.position.x,
      originY: node.position.y,
      startX: clientX as number,
      startY: clientY as number,
    };

    onSelect?.();
    onBringToFront?.();
    setIsDragging(true);
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleWindowMouseUp);
  };

  const handleWindowMouseUp = () => {
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
    window.removeEventListener('touchmove', handleDragMove);
    window.removeEventListener('touchend', handleWindowMouseUp);
    handleDragEnd();
  };

  const contentRows = useMemo(
    () => infoRows.filter((row): row is string => typeof row === 'string' && row.trim().length > 0).slice(0, 3),
    [infoRows],
  );
  const stackZIndex = elevateCanvasStackZIndex(getWorkflowCardStackZIndex(node, isSelected), isDragging);

  return (
    <div
      className={`absolute rounded-[22px] border transition-all ${accentClassName} ${highlighted ? 'ring-2 ring-amber-300/70' : ''} ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
      style={{
        left: node.position.x - width / 2,
        top: node.position.y - height,
        width,
        minHeight: height,
        zIndex: stackZIndex,
        background: 'linear-gradient(180deg, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.86) 100%)',
        borderColor: isSelected ? 'rgba(96, 165, 250, 0.72)' : 'rgba(148, 163, 184, 0.18)',
        boxShadow: isSelected
          ? getCanvasCardShadow({ accent: 'blue', boost: true, zoomScale })
          : getCanvasCardShadow({ boost: true, zoomScale }),
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <div
        className="flex items-start justify-between gap-3 rounded-t-[22px] border-b px-4 py-3"
        style={{ borderColor: 'rgba(148, 163, 184, 0.16)' }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-300">{subtitle}</div>
          </div>
        </div>

        <button
          type="button"
          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/6 hover:text-red-300"
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(node.id);
          }}
          aria-label="删除附加卡"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        {contentRows.length > 0 && (
          <div className="space-y-2">
            {contentRows.map((row) => (
              <div
                key={row}
                className="rounded-2xl border px-3 py-2 text-xs leading-5 text-slate-300"
                style={{ borderColor: 'rgba(148, 163, 184, 0.14)', backgroundColor: 'rgba(15, 23, 42, 0.36)' }}
              >
                {row}
              </div>
            ))}
          </div>
        )}

        {actionLabel && onAction && (
          <button
            type="button"
            className="w-full rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.92) 0%, rgba(14, 165, 233, 0.88) 100%)',
              boxShadow: '0 14px 32px rgba(14, 165, 233, 0.18)',
            }}
            onClick={(event) => {
              event.stopPropagation();
              onAction(node);
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkflowUtilityCard;
