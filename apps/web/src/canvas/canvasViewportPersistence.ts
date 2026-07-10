import type { CanvasSceneBounds } from '@kk/shared';
import { unionCanvasSceneBounds } from './canvasSceneGeometry.ts';

export const CANVAS_MIN_SCALE = 0.1;
export const CANVAS_MAX_SCALE = 3;

export type CanvasViewportTransform = { x: number; y: number; scale: number };
export type CanvasResponsiveSurface = 'phone' | 'tablet-portrait' | 'tablet-landscape' | 'desktop';

export const getCanvasViewportStorageKey = (
  canvasId: string,
  surface: CanvasResponsiveSurface,
): string => `kk_canvas_view:${canvasId || 'default'}:${surface}`;

export const isValidCanvasViewportTransform = (value: unknown): value is CanvasViewportTransform => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CanvasViewportTransform>;
  return Number.isFinite(candidate.x)
    && Number.isFinite(candidate.y)
    && Number.isFinite(candidate.scale)
    && Math.abs(Number(candidate.x)) <= 200000
    && Math.abs(Number(candidate.y)) <= 200000
    && Number(candidate.scale) >= CANVAS_MIN_SCALE
    && Number(candidate.scale) <= CANVAS_MAX_SCALE;
};

export const doesViewportIntersectScene = (
  transform: CanvasViewportTransform,
  viewport: { width: number; height: number },
  sceneBounds: readonly CanvasSceneBounds[],
): boolean => {
  const scene = unionCanvasSceneBounds(sceneBounds);
  if (!scene) return true;
  const visible = {
    x: -transform.x / transform.scale,
    y: -transform.y / transform.scale,
    width: viewport.width / transform.scale,
    height: viewport.height / transform.scale,
  };
  return visible.x < scene.x + scene.width
    && visible.x + visible.width > scene.x
    && visible.y < scene.y + scene.height
    && visible.y + visible.height > scene.y;
};

export const createCanvasFitTransform = (
  sceneBounds: readonly CanvasSceneBounds[],
  viewport: { width: number; height: number },
  options: { padding?: number; minScale?: number; maxScale?: number } = {},
): CanvasViewportTransform | null => {
  const scene = unionCanvasSceneBounds(sceneBounds);
  if (!scene || viewport.width <= 0 || viewport.height <= 0) return null;
  const padding = Math.max(0, options.padding ?? 72);
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const minScale = Math.max(CANVAS_MIN_SCALE, options.minScale ?? CANVAS_MIN_SCALE);
  const maxScale = Math.min(CANVAS_MAX_SCALE, options.maxScale ?? 1);
  const scale = Math.min(
    maxScale,
    Math.max(minScale, Math.min(availableWidth / scene.width, availableHeight / scene.height)),
  );
  const centerX = scene.x + scene.width / 2;
  const centerY = scene.y + scene.height / 2;
  return {
    x: viewport.width / 2 - centerX * scale,
    y: viewport.height / 2 - centerY * scale,
    scale,
  };
};
