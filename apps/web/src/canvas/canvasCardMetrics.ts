import type { CanvasCardPresentation, CanvasCardSizeToken } from '@kk/shared';

export const CANVAS_CARD_WIDTH_BY_SIZE: Record<CanvasCardSizeToken, number> = {
  compact: 280,
  standard: 320,
  wide: 420,
};

export const getCanvasCardWidth = (presentation?: Pick<CanvasCardPresentation, 'size'> | null): number => (
  CANVAS_CARD_WIDTH_BY_SIZE[presentation?.size || 'standard']
);
