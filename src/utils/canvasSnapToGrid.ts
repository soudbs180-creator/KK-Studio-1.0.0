export const CANVAS_GRID_SIZE = 16;

export type CanvasPoint = { x: number; y: number };

const snapValueToGrid = (value: number, gridSize: number): number => {
  if (!Number.isFinite(value)) return value;
  return Math.round(value / gridSize) * gridSize;
};

export function snapCanvasPointToGrid(
  point: CanvasPoint,
  options: { enabled?: boolean; gridSize?: number } = {},
): CanvasPoint {
  const gridSize = options.gridSize ?? CANVAS_GRID_SIZE;
  if (
    !options.enabled
    || !Number.isFinite(gridSize)
    || gridSize <= 0
    || !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
  ) {
    return point;
  }

  return {
    x: snapValueToGrid(point.x, gridSize),
    y: snapValueToGrid(point.y, gridSize),
  };
}
