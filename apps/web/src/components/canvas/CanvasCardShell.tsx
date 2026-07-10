import React from 'react';
import type { CanvasCardPresentation } from '@kk/shared';
import type { CanvasCardDetailLevel } from '../../canvas/performanceProfile.ts';

const CARD_WIDTH_BY_SIZE: Record<CanvasCardPresentation['size'], number> = {
  compact: 280,
  standard: 320,
  wide: 420,
};

export interface CanvasCardShellProps {
  id: string;
  position: { x: number; y: number };
  presentation: CanvasCardPresentation;
  height?: number;
  zIndex?: number;
  selected?: boolean;
  detailLevel?: CanvasCardDetailLevel;
  className?: string;
  children?: React.ReactNode;
}

export const CanvasCardShell: React.FC<CanvasCardShellProps> = ({
  id,
  position,
  presentation,
  height = 180,
  zIndex = 1,
  selected = false,
  detailLevel = 'full',
  className = '',
  children,
}) => {
  const width = CARD_WIDTH_BY_SIZE[presentation.size];
  const isGhost = detailLevel === 'ghost' || detailLevel === 'skeleton' || detailLevel === 'thumbnail-shell';
  return (
    <section
      id={`canvas-card-${id}`}
      data-card-kind={presentation.kind}
      data-layout-mode={presentation.layoutMode}
      data-detail-level={detailLevel}
      aria-label={presentation.kind === 'unknown' ? 'Unknown canvas card' : undefined}
      className={`canvas-card-shell absolute overflow-hidden border bg-zinc-950 text-zinc-100 ${selected ? 'border-sky-400 shadow-lg' : 'border-white/10'} ${className}`}
      style={{
        left: position.x - width / 2,
        top: position.y - height,
        width,
        minHeight: height,
        zIndex,
        borderRadius: 8,
        opacity: isGhost ? 0.72 : 1,
        transition: 'left 220ms ease, top 220ms ease, opacity 180ms ease, border-color 180ms ease',
      }}
    >
      {children}
    </section>
  );
};

export default CanvasCardShell;
