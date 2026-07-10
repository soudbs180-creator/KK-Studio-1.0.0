export type CanvasTransform = { x: number; y: number; scale: number };

export const clientPointToCanvasPoint = (
  clientPoint: { x: number; y: number },
  canvasRect: Pick<DOMRect, 'left' | 'top'>,
  transform: CanvasTransform,
): { x: number; y: number } | null => {
  if (!Number.isFinite(transform.scale) || transform.scale <= 0) return null;
  return {
    x: (clientPoint.x - canvasRect.left - transform.x) / transform.scale,
    y: (clientPoint.y - canvasRect.top - transform.y) / transform.scale,
  };
};
