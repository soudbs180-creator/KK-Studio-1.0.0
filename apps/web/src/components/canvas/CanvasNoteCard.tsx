import React, { useRef } from 'react';
import type { CanvasNoteNode, CanvasDrawing } from '../../types.ts';
import CanvasCardShell from './CanvasCardShell.tsx';
import CanvasDrawingsLayer from './CanvasDrawingsLayer.tsx';

export interface CanvasNoteCardProps {
  note: CanvasNoteNode;
  selected: boolean;
  zoomScale: number;
  onSelect: () => void;
  onDelete: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
}

export const CanvasNoteCard: React.FC<CanvasNoteCardProps> = ({
  note,
  selected,
  zoomScale,
  onSelect,
  onDelete,
  onPositionChange,
}) => {
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const drawings = note.elements as CanvasDrawing[];
  return (
    <CanvasCardShell
      id={note.id}
      position={note.position}
      presentation={note.presentation}
      height={note.height}
      zIndex={note.zIndex}
      selected={selected}
      className="pointer-events-auto bg-zinc-950/95"
    >
      <div
        className="flex h-9 cursor-grab items-center justify-between border-b border-white/10 px-3"
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, originX: note.position.x, originY: note.position.y };
          onSelect();
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          onPositionChange({
            x: drag.originX + (event.clientX - drag.x) / Math.max(zoomScale, 0.1),
            y: drag.originY + (event.clientY - drag.y) / Math.max(zoomScale, 0.1),
          });
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <span className="truncate text-xs font-medium text-zinc-200">{note.title}</span>
        <button
          type="button"
          aria-label="Delete notebook card"
          className="h-7 w-7 text-zinc-500 hover:text-red-300"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onDelete(); }}
        >
          &times;
        </button>
      </div>
      <svg width={note.width} height={note.height - 36} viewBox={`0 36 ${note.width} ${note.height - 36}`}>
        <CanvasDrawingsLayer drawings={drawings} />
      </svg>
    </CanvasCardShell>
  );
};

export default CanvasNoteCard;
