import React from 'react';
import type { CanvasCardPresentation } from '@kk/shared';
import type { CanvasCardDetailLevel } from '../../canvas/performanceProfile.ts';
import { getCanvasCardWidth } from '../../canvas/canvasCardMetrics.ts';

export type CanvasCardPositioning = 'world' | 'origin-transform' | 'flow';

export interface CanvasCardShellProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'id'> {
  id: string;
  domId?: string;
  position: { x: number; y: number };
  origin?: { x: number; y: number };
  presentation: CanvasCardPresentation;
  width?: number;
  height?: number;
  zIndex?: number;
  selected?: boolean;
  detailLevel?: CanvasCardDetailLevel;
  positioning?: CanvasCardPositioning;
  surface?: boolean;
  renderDetailPlaceholder?: boolean;
}

export const CanvasCardShell = React.forwardRef<HTMLDivElement, CanvasCardShellProps>(({
  id,
  domId,
  position,
  origin = { x: 0, y: 0 },
  presentation,
  width: widthOverride,
  height = 180,
  zIndex = 1,
  selected = false,
  detailLevel = 'full',
  positioning = 'world',
  surface = true,
  renderDetailPlaceholder = true,
  className = '',
  style,
  children,
  ...elementProps
}, ref) => {
  const width = widthOverride ?? getCanvasCardWidth(presentation);
  const isGhost = detailLevel === 'ghost' || detailLevel === 'skeleton' || detailLevel === 'thumbnail-shell';
  const positionStyle: React.CSSProperties = positioning === 'flow'
    ? { position: 'relative' }
    : positioning === 'origin-transform'
      ? {
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate3d(${position.x - width / 2 - origin.x}px, ${position.y - height - origin.y}px, 0)`,
      }
      : {
        position: 'absolute',
        left: position.x - width / 2,
        top: position.y - height,
      };
  const surfaceClassName = surface
    ? `overflow-hidden border bg-zinc-950 text-zinc-100 ${selected ? 'border-sky-400 shadow-lg' : 'border-white/10'}`
    : '';

  return (
    <div
      {...elementProps}
      ref={ref}
      id={domId || `canvas-card-${id}`}
      data-card-id={id}
      data-card-kind={presentation.kind}
      data-layout-mode={presentation.layoutMode}
      data-card-size={presentation.size}
      data-detail-level={detailLevel}
      aria-label={elementProps['aria-label'] || (presentation.kind === 'unknown' ? 'Unknown canvas card' : undefined)}
      className={`canvas-card-shell ${surfaceClassName} ${className}`}
      style={{
        ...positionStyle,
        width,
        minHeight: height,
        zIndex,
        borderRadius: surface ? 8 : undefined,
        opacity: isGhost ? 0.72 : 1,
        transition: 'var(--canvas-card-transition, left 220ms ease, top 220ms ease, transform 220ms ease, opacity 180ms ease, border-color 180ms ease)',
        ...style,
      }}
    >
      {isGhost && renderDetailPlaceholder ? (
        <div className="flex h-full min-h-[96px] items-center justify-between gap-3 px-3 py-2 text-[11px] text-zinc-400">
          <span className="truncate">{presentation.kind}</span>
          <span className="shrink-0 text-zinc-600">{detailLevel}</span>
        </div>
      ) : children}
    </div>
  );
});

CanvasCardShell.displayName = 'CanvasCardShell';

export default CanvasCardShell;
