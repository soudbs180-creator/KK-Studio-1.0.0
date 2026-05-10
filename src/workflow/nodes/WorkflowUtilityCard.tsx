import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { WorkflowNode } from '../../types';
import { getCanvasCardShadow } from '../../utils/canvasCardShadow';
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

const getWorkflowCardStackZIndex = (node: UtilityCardNode, isSelected: boolean) => {
  const persistedOrder = (node.zIndex ?? 0) * 100;
  if (isSelected) return persistedOrder + 20;
  return persistedOrder + 10;
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
  snapToGrid = false,
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

      const nextPosition = snapCanvasPointToGrid({
        x: dragState.originX + (pointer.x - dragState.startX) / Math.max(zoomScale, 0.0001),
        y: dragState.originY + (pointer.y - dragState.startY) / Math.max(zoomScale, 0.0001),
      }, { enabled: snapToGrid });
      onPositionChange(node.id, nextPosition);
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
        background: 'var(--frost-card-main-bg)',
        borderColor: isSelected ? 'var(--accent-coral)' : 'var(--frost-card-main-border)',
        boxShadow: isSelected
          ? 'var(--frost-card-main-shadow)'
          : getCanvasCardShadow({ accent: 'coral', boost: true, zoomScale }),
        backdropFilter: 'blur(var(--frost-card-main-blur)) saturate(160%)',
        WebkitBackdropFilter: 'blur(var(--frost-card-main-blur)) saturate(160%)',
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
        style={{ borderColor: 'var(--frost-card-main-border)' }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--frost-card-sub-bg)] text-[var(--accent-coral)]">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</div>
            <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{subtitle}</div>
          </div>
        </div>

        <button
          type="button"
          className="rounded-xl p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-red-400"
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
                className="rounded-2xl border px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]"
                style={{
                  borderColor: 'var(--frost-card-sub-border)',
                  background: 'var(--frost-card-sub-bg)',
                  boxShadow: 'var(--frost-card-sub-shadow)',
                  backdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(150%)',
                  WebkitBackdropFilter: 'blur(var(--frost-card-sub-blur)) saturate(150%)',
                }}
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
              background: 'linear-gradient(135deg, var(--accent-coral) 0%, var(--clay-brand-peach) 100%)',
              boxShadow: '0 10px 24px rgb(255 107 90 / 0.16)',
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
