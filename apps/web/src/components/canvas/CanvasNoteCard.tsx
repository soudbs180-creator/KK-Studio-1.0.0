import React from 'react';
import type { CanvasNoteNode, CanvasDrawing } from '../../types.ts';
import CanvasCardShell from './CanvasCardShell.tsx';
import type { CanvasCardDetailLevel } from '../../canvas/performanceProfile.ts';
import CanvasDrawingsLayer from './CanvasDrawingsLayer.tsx';
import { Link2, Pencil, Trash2 } from 'lucide-react';
import { useTransientCanvasCardDrag } from './useTransientCanvasCardDrag.ts';

export interface CanvasNoteCardProps {
  note: CanvasNoteNode;
  selected: boolean;
  zoomScale: number;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onUseAsReference: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
  detailLevel?: CanvasCardDetailLevel;
}

export const CanvasNoteCard: React.FC<CanvasNoteCardProps> = ({
  note,
  selected,
  zoomScale,
  onSelect,
  onDelete,
  onEdit,
  onUseAsReference,
  onPositionChange,
  detailLevel = 'full',
}) => {
  const drawings = note.elements as CanvasDrawing[];
  const { cardRef, dragHandleProps } = useTransientCanvasCardDrag({
    position: note.position,
    zoomScale,
    onSelect,
    onPositionChange,
  });

  return (
    <CanvasCardShell
      ref={cardRef}
      id={note.id}
      position={note.position}
      presentation={note.presentation}
      height={note.height}
      zIndex={note.zIndex}
      selected={selected}
      detailLevel={detailLevel}
      className="pointer-events-auto bg-zinc-950/95"
    >
      <div
        className="flex h-11 cursor-grab items-center justify-between border-b border-white/10 px-3"
        {...dragHandleProps}
      >
        <span className="truncate text-xs font-medium text-zinc-200">{note.title}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Use notebook card as AI reference"
            title="Use as AI reference"
            className="flex h-11 w-11 items-center justify-center text-zinc-500 hover:text-emerald-300"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onUseAsReference(); }}
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Edit notebook card"
            title="Edit notebook card"
            className="flex h-11 w-11 items-center justify-center text-zinc-500 hover:text-zinc-200"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onEdit(); }}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Delete notebook card"
            title="Delete notebook card"
            className="flex h-11 w-11 items-center justify-center text-zinc-500 hover:text-red-300"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <svg width={note.width} height={note.height - 44} viewBox={`0 44 ${note.width} ${note.height - 44}`}>
        <CanvasDrawingsLayer drawings={drawings} />
      </svg>
    </CanvasCardShell>
  );
};

export default CanvasNoteCard;
