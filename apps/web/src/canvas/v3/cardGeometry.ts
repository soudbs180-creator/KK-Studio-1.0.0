import type { CanvasCardSizeToken } from '@kk/shared';
import { KK_LAYOUT } from '@kk/ui/layout';
import type { CanvasV3CardRenderState } from './types.ts';

export const CANVAS_V3_CARD_WIDTH: Record<CanvasCardSizeToken, number> = {
  ...KK_LAYOUT.workspace.canvasCardWidths,
};

/**
 * Keeps every renderer on the three approved width tokens so card-specific
 * business content cannot silently create a second geometry system.
 */
export function getCanvasV3CardWidth(size: CanvasCardSizeToken): number {
  return CANVAS_V3_CARD_WIDTH[size];
}

/**
 * Zoom LOD is resolved in screen space because readability, not persisted
 * card data, determines when secondary text should disappear.
 */
export function resolveCanvasV3DetailLevel(
  scale: number,
): CanvasV3CardRenderState['detailLevel'] {
  if (scale <= 0.2) return 'thumbnail-shell';
  if (scale <= 0.55) return 'compact';
  return 'full';
}
