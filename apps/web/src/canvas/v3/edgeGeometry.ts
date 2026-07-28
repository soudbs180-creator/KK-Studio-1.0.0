import { UI_SYSTEM_TOKENS } from '@kk/ui/core';
import { KK_LAYOUT } from '@kk/ui/layout';
import type { CanvasCardStatus } from './types.ts';

export interface CanvasV3Point {
  x: number;
  y: number;
}

export interface CanvasV3ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CanvasV3ToolbarSize {
  width: number;
  height: number;
}

export interface CanvasV3ToolbarPlacement {
  x: number;
  y: number;
  placement: 'right' | 'left' | 'bottom';
}

const TOOLBAR_GAP = KK_LAYOUT.workspace.selectionToolbarGap;

const overlaps = (first: CanvasV3ScreenRect, second: CanvasV3ScreenRect): boolean => !(
  first.right <= second.left
  || first.left >= second.right
  || first.bottom <= second.top
  || first.top >= second.bottom
);

const inside = (rect: CanvasV3ScreenRect, viewport: CanvasV3ScreenRect): boolean => (
  rect.left >= viewport.left
  && rect.right <= viewport.right
  && rect.top >= viewport.top
  && rect.bottom <= viewport.bottom
);

const shiftRightPastBlockedRects = (
  candidate: CanvasV3ScreenRect,
  blocked: CanvasV3ScreenRect[],
): CanvasV3ScreenRect => {
  const shifted = { ...candidate };
  [...blocked]
    .sort((first, second) => first.left - second.left)
    .forEach((block) => {
      if (!overlaps(shifted, block)) return;
      const delta = block.right + TOOLBAR_GAP - shifted.left;
      shifted.left += delta;
      shifted.right += delta;
    });
  return shifted;
};

/**
 * Uses a restrained cubic whose handles scale with distance, avoiding both
 * sharp elbows and exaggerated loops on short card connections.
 */
export function buildCanvasV3EdgePath(source: CanvasV3Point, target: CanvasV3Point): string {
  const horizontal = Math.max(48, Math.abs(target.x - source.x) * 0.44);
  return `M ${source.x} ${source.y} C ${source.x + horizontal} ${source.y}, ${target.x - horizontal} ${target.y}, ${target.x} ${target.y}`;
}

export function getCanvasV3EdgeStyle(
  state: 'default' | 'selected' | 'disabled' | CanvasCardStatus,
): { stroke: string; strokeWidth: number } {
  if (state === 'selected') {
    return {
      stroke: UI_SYSTEM_TOKENS.canvas.edge.selected,
      strokeWidth: KK_LAYOUT.workspace.canvasEdgeSelectedWidth,
    };
  }
  if (state === 'disabled' || state === 'cancelled') {
    return {
      stroke: UI_SYSTEM_TOKENS.canvas.edge.disabled,
      strokeWidth: KK_LAYOUT.workspace.canvasEdgeWidth,
    };
  }
  return {
    stroke: UI_SYSTEM_TOKENS.canvas.edge.idle,
    strokeWidth: KK_LAYOUT.workspace.canvasEdgeWidth,
  };
}

export function getCanvasV3PortHitSize(mobile: boolean): number {
  return mobile
    ? KK_LAYOUT.workspace.canvasPortMobileHitSize
    : KK_LAYOUT.workspace.canvasPortHitSize;
}

const candidateRect = (
  x: number,
  y: number,
  toolbar: CanvasV3ToolbarSize,
): CanvasV3ScreenRect => ({
  left: x,
  top: y,
  right: x + toolbar.width,
  bottom: y + toolbar.height,
});

/**
 * Right, right-top, right-bottom, then left mirrors the approved interaction
 * priority while clamping only as a final fallback.
 */
export function resolveCanvasV3ToolbarPlacement(
  card: CanvasV3ScreenRect,
  toolbar: CanvasV3ToolbarSize,
  viewport: CanvasV3ScreenRect,
  blocked: CanvasV3ScreenRect[],
): CanvasV3ToolbarPlacement {
  const centerY = (card.top + card.bottom - toolbar.height) / 2;
  const candidates = [
    { placement: 'right' as const, rect: shiftRightPastBlockedRects(candidateRect(card.right + TOOLBAR_GAP, centerY, toolbar), blocked) },
    { placement: 'right' as const, rect: shiftRightPastBlockedRects(candidateRect(card.right + TOOLBAR_GAP, card.top, toolbar), blocked) },
    { placement: 'right' as const, rect: shiftRightPastBlockedRects(candidateRect(card.right + TOOLBAR_GAP, card.bottom - toolbar.height, toolbar), blocked) },
    { placement: 'left' as const, rect: candidateRect(card.left - TOOLBAR_GAP - toolbar.width, centerY, toolbar) },
  ];
  const resolved = candidates.find(({ rect }) => inside(rect, viewport) && !blocked.some((item) => overlaps(rect, item)));
  if (resolved) return { x: resolved.rect.left, y: resolved.rect.top, placement: resolved.placement };
  return {
    x: Math.max(viewport.left + TOOLBAR_GAP, Math.min(card.right + TOOLBAR_GAP, viewport.right - toolbar.width - TOOLBAR_GAP)),
    y: Math.max(viewport.top + TOOLBAR_GAP, Math.min(centerY, viewport.bottom - toolbar.height - TOOLBAR_GAP)),
    placement: 'right',
  };
}
