import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type React from 'react';

interface CanvasCardPosition {
  x: number;
  y: number;
}

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  latestX: number;
  latestY: number;
  origin: CanvasCardPosition;
  scale: number;
}

interface UseTransientCanvasCardDragInput {
  position: CanvasCardPosition;
  zoomScale: number;
  onSelect: () => void;
  onPositionChange: (position: CanvasCardPosition) => void;
}

interface CardDragRefs {
  cardRef: React.RefObject<HTMLDivElement | null>;
  dragRef: React.RefObject<DragSession | null>;
  frameRef: React.RefObject<number | null>;
  committedPositionRef: React.RefObject<CanvasCardPosition | null>;
}

const resolveDragPosition = (drag: DragSession): CanvasCardPosition => ({
  x: drag.origin.x + (drag.latestX - drag.startX) / drag.scale,
  y: drag.origin.y + (drag.latestY - drag.startY) / drag.scale,
});

const clearTransientStyle = (element: HTMLDivElement | null) => {
  if (!element) return;
  element.style.transform = '';
  element.style.willChange = '';
  element.removeAttribute('data-dragging');
};

const beginDrag = (
  event: React.PointerEvent<HTMLElement>,
  refs: CardDragRefs,
  position: CanvasCardPosition,
  zoomScale: number,
  onSelect: () => void,
) => {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  refs.dragRef.current = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    latestX: event.clientX,
    latestY: event.clientY,
    origin: position,
    scale: Math.max(zoomScale, 0.1),
  };
  refs.committedPositionRef.current = null;
  if (refs.cardRef.current) {
    refs.cardRef.current.style.willChange = 'transform';
    refs.cardRef.current.dataset.dragging = 'true';
  }
  onSelect();
};

const updateDrag = (
  event: React.PointerEvent<HTMLElement>,
  refs: CardDragRefs,
  flushPendingTransform: () => void,
) => {
  const drag = refs.dragRef.current;
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.latestX = event.clientX;
  drag.latestY = event.clientY;
  if (refs.frameRef.current === null) {
    refs.frameRef.current = window.requestAnimationFrame(flushPendingTransform);
  }
};

const completeDrag = (
  event: React.PointerEvent<HTMLElement>,
  refs: CardDragRefs,
  position: CanvasCardPosition,
  flushPendingTransform: () => void,
  onPositionChange: (position: CanvasCardPosition) => void,
) => {
  const drag = refs.dragRef.current;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (event.type === 'pointerup') {
    drag.latestX = event.clientX;
    drag.latestY = event.clientY;
  }
  if (refs.frameRef.current !== null) window.cancelAnimationFrame(refs.frameRef.current);
  flushPendingTransform();
  const finalPosition = resolveDragPosition(drag);
  refs.committedPositionRef.current = finalPosition;
  refs.dragRef.current = null;
  onPositionChange(finalPosition);
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  if (finalPosition.x === position.x && finalPosition.y === position.y) {
    clearTransientStyle(refs.cardRef.current);
    refs.committedPositionRef.current = null;
  }
};

const useTransientStyleCleanup = (
  refs: CardDragRefs,
  position: CanvasCardPosition,
) => {
  useLayoutEffect(() => {
    if (!refs.committedPositionRef.current) return;
    clearTransientStyle(refs.cardRef.current);
    refs.committedPositionRef.current = null;
  }, [position.x, position.y, refs.cardRef, refs.committedPositionRef]);

  useEffect(() => () => {
    if (refs.frameRef.current !== null) {
      window.cancelAnimationFrame(refs.frameRef.current);
    }
  }, [refs.frameRef]);
};

/**
 * Keeps high-frequency auxiliary-card movement outside React and commits the
 * final world position once, preventing workspace rerenders during a drag.
 */
export function useTransientCanvasCardDrag({
  position,
  zoomScale,
  onSelect,
  onPositionChange,
}: UseTransientCanvasCardDragInput) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const frameRef = useRef<number | null>(null);
  const committedPositionRef = useRef<CanvasCardPosition | null>(null);
  const dragRefs = { cardRef, dragRef, frameRef, committedPositionRef };

  const flushPendingTransform = useCallback(() => {
    frameRef.current = null;
    const drag = dragRef.current;
    const element = cardRef.current;
    if (!drag || !element) return;
    const nextPosition = resolveDragPosition(drag);
    element.style.transform = `translate3d(${nextPosition.x - drag.origin.x}px, ${nextPosition.y - drag.origin.y}px, 0)`;
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => (
    beginDrag(event, dragRefs, position, zoomScale, onSelect)
  );
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => (
    updateDrag(event, dragRefs, flushPendingTransform)
  );
  const finishDrag = (event: React.PointerEvent<HTMLElement>) => completeDrag(
    event,
    dragRefs,
    position,
    flushPendingTransform,
    onPositionChange,
  );

  useTransientStyleCleanup(dragRefs, position);

  const dragHandleProps: React.HTMLAttributes<HTMLElement> = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    style: { touchAction: 'none' },
  };

  return { cardRef, dragHandleProps };
}
