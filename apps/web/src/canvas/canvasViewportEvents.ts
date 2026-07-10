import type { CanvasSceneBounds } from '@kk/shared';

export const CANVAS_FOCUS_BOUNDS_EVENT = 'kk-canvas-focus-bounds';

export const requestCanvasBoundsFocus = (bounds: CanvasSceneBounds | null | undefined): void => {
  if (!bounds || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CANVAS_FOCUS_BOUNDS_EVENT, {
    detail: { bounds, minScale: 0.5, maxScale: 1.15, durationMs: 220 },
  }));
};
