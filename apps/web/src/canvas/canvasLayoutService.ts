import type { CanvasLayoutMode, CanvasSceneBounds } from '@kk/shared';

export type CanvasLayoutItem = {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  visualCenter?: { x: number; y: number };
};

export type CanvasLayoutOptions = {
  mode: CanvasLayoutMode;
  gap: number;
  columns?: number;
};

export type CanvasLayoutResult = {
  positions: Record<string, { x: number; y: number }>;
  bounds: CanvasSceneBounds | null;
};

const getVisualCenter = (item: CanvasLayoutItem) => item.visualCenter || {
  x: item.position.x,
  y: item.position.y - item.height / 2,
};

export const resolveCanvasLayoutBounds = (
  items: readonly CanvasLayoutItem[],
  positions?: Readonly<Record<string, { x: number; y: number }>>,
): CanvasSceneBounds | null => {
  if (items.length === 0) return null;

  const left = Math.min(...items.map((item) => (positions?.[item.id]?.x ?? item.position.x) - item.width / 2));
  const right = Math.max(...items.map((item) => (positions?.[item.id]?.x ?? item.position.x) + item.width / 2));
  const top = Math.min(...items.map((item) => (positions?.[item.id]?.y ?? item.position.y) - item.height));
  const bottom = Math.max(...items.map((item) => positions?.[item.id]?.y ?? item.position.y));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

export const arrangeCanvasLayoutItems = (
  sourceItems: readonly CanvasLayoutItem[],
  options: CanvasLayoutOptions,
): CanvasLayoutResult => {
  if (sourceItems.length === 0) {
    return { positions: {}, bounds: null };
  }

  const items = [...sourceItems];
  const gap = Number.isFinite(options.gap) ? Math.max(0, options.gap) : 0;
  const positions: Record<string, { x: number; y: number }> = {};

  if (options.mode === 'row') {
    items.sort((a, b) => getVisualCenter(a).x - getVisualCenter(b).x);
    const centerY = items.reduce((sum, item) => sum + getVisualCenter(item).y, 0) / items.length;
    let left = Math.min(...items.map((item) => getVisualCenter(item).x - item.width / 2));

    items.forEach((item) => {
      positions[item.id] = { x: left + item.width / 2, y: centerY + item.height / 2 };
      left += item.width + gap;
    });
  } else if (options.mode === 'column') {
    items.sort((a, b) => getVisualCenter(a).y - getVisualCenter(b).y);
    const centerX = items.reduce((sum, item) => sum + item.position.x, 0) / items.length;
    let top = Math.min(...items.map((item) => getVisualCenter(item).y - item.height / 2));

    items.forEach((item) => {
      top += item.height;
      positions[item.id] = { x: centerX, y: top };
      top += gap;
    });
  } else {
    items.sort((a, b) => {
      const aCenter = getVisualCenter(a);
      const bCenter = getVisualCenter(b);
      if (Math.abs(aCenter.y - bCenter.y) > 200) return aCenter.y - bCenter.y;
      return aCenter.x - bCenter.x;
    });

    const columns = Math.min(
      items.length,
      Math.max(1, Math.floor(Number.isFinite(options.columns) ? Number(options.columns) : 1)),
    );
    const centerX = items.reduce((sum, item) => sum + item.position.x, 0) / items.length;
    const centerY = items.reduce((sum, item) => sum + item.position.y, 0) / items.length;
    const maxWidth = Math.max(...items.map((item) => item.width));
    const maxHeight = Math.max(...items.map((item) => item.height));
    const cellWidth = maxWidth + gap;
    const cellHeight = maxHeight + gap;
    const rowCount = Math.ceil(items.length / columns);
    const startX = centerX - (columns * cellWidth) / 2 + cellWidth / 2;
    const startY = centerY - (rowCount * cellHeight) / 2 + cellHeight;

    items.forEach((item, index) => {
      positions[item.id] = {
        x: startX + (index % columns) * cellWidth,
        y: startY + Math.floor(index / columns) * cellHeight,
      };
    });
  }

  return {
    positions,
    bounds: resolveCanvasLayoutBounds(items, positions),
  };
};
