import type { CanvasDrawing } from '../types/index.ts';

export type CanvasDrawingBounds = { x: number; y: number; width: number; height: number };

export const DRAWING_WIDTH_MIN = 1;
export const DRAWING_WIDTH_MAX = 24;

export const normalizeDrawingHexColor = (value: string): string | null => {
  const normalized = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toLowerCase() : null;
};

export const clampDrawingWidth = (value: number): number => Math.min(DRAWING_WIDTH_MAX, Math.max(DRAWING_WIDTH_MIN, Math.round(value)));

export const getDrawingBounds = (drawing: CanvasDrawing): CanvasDrawingBounds | null => {
  if (!drawing.points?.length) return null;
  const minX = Math.min(...drawing.points.map((point) => point.x));
  const minY = Math.min(...drawing.points.map((point) => point.y));
  let maxX = Math.max(...drawing.points.map((point) => point.x));
  let maxY = Math.max(...drawing.points.map((point) => point.y));
  const padding = Math.max(4, drawing.width || 1);
  if (drawing.type === 'text') {
    maxX += Math.max(80, (drawing.fontSize || 16) * (drawing.text?.length || 2) * 0.62);
    maxY += (drawing.fontSize || 16) * 1.2;
  }
  return { x: minX - padding, y: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 };
};

const intersects = (a: CanvasDrawingBounds, b: CanvasDrawingBounds) => !(
  a.x > b.x + b.width
  || a.x + a.width < b.x
  || a.y > b.y + b.height
  || a.y + a.height < b.y
);

export const selectCanvasDrawingsInBounds = (
  drawings: readonly CanvasDrawing[],
  bounds: CanvasDrawingBounds,
): CanvasDrawing[] => drawings.filter((drawing) => {
  const drawingBounds = getDrawingBounds(drawing);
  if (!drawingBounds || !intersects(drawingBounds, bounds)) return false;
  if (drawing.type === 'pen' || drawing.type === 'marker') {
    return drawing.points.some((point) => (
      point.x >= bounds.x
      && point.x <= bounds.x + bounds.width
      && point.y >= bounds.y
      && point.y <= bounds.y + bounds.height
    ));
  }
  return true;
});
