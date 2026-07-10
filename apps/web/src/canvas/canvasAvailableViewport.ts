export type CanvasViewportInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CanvasAvailableViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export const getAvailableCanvasViewport = (
  viewport: { width: number; height: number },
  insets: Partial<CanvasViewportInsets> = {},
): CanvasAvailableViewport => {
  const left = Math.max(0, Math.min(viewport.width, insets.left || 0));
  const right = Math.max(0, Math.min(viewport.width - left, insets.right || 0));
  const top = Math.max(0, Math.min(viewport.height, insets.top || 0));
  const bottom = Math.max(0, Math.min(viewport.height - top, insets.bottom || 0));
  const width = Math.max(1, viewport.width - left - right);
  const height = Math.max(1, viewport.height - top - bottom);
  return {
    x: left,
    y: top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
};

export const canvasScreenPointToWorld = (
  point: { x: number; y: number },
  transform: { x: number; y: number; scale: number },
): { x: number; y: number } => ({
  x: (point.x - transform.x) / transform.scale,
  y: (point.y - transform.y) / transform.scale,
});
