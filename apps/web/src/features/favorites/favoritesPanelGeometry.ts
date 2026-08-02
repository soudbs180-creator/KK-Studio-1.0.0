export const FAVORITES_PANEL_SCHEMA_VERSION = 2 as const;
export const FAVORITES_PANEL_MARGIN = 12;
export const FAVORITES_PANEL_MIN_WIDTH = 420;
export const FAVORITES_PANEL_MIN_HEIGHT = 360;

export interface FavoritesPanelGeometry {
  schemaVersion: typeof FAVORITES_PANEL_SCHEMA_VERSION;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FavoritesPanelViewport {
  width: number;
  height: number;
}

export type FavoritesPanelResizeMode = 'width' | 'height' | 'proportional';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function clampFavoritesPanelGeometry(
  geometry: FavoritesPanelGeometry,
  viewport: FavoritesPanelViewport,
): FavoritesPanelGeometry {
  const maxWidth = Math.max(FAVORITES_PANEL_MIN_WIDTH, viewport.width - FAVORITES_PANEL_MARGIN * 2);
  const maxHeight = Math.max(FAVORITES_PANEL_MIN_HEIGHT, viewport.height - FAVORITES_PANEL_MARGIN * 2);
  const width = clamp(geometry.width, FAVORITES_PANEL_MIN_WIDTH, maxWidth);
  const height = clamp(geometry.height, FAVORITES_PANEL_MIN_HEIGHT, maxHeight);
  return {
    schemaVersion: FAVORITES_PANEL_SCHEMA_VERSION,
    width,
    height,
    x: clamp(geometry.x, FAVORITES_PANEL_MARGIN, viewport.width - width - FAVORITES_PANEL_MARGIN),
    y: clamp(geometry.y, FAVORITES_PANEL_MARGIN, viewport.height - height - FAVORITES_PANEL_MARGIN),
  };
}

export function resizeFavoritesPanelGeometry(
  start: FavoritesPanelGeometry,
  mode: FavoritesPanelResizeMode,
  deltaX: number,
  deltaY: number,
  viewport: FavoritesPanelViewport,
): FavoritesPanelGeometry {
  if (mode === 'width') {
    return clampFavoritesPanelGeometry({ ...start, width: start.width + deltaX }, viewport);
  }
  if (mode === 'height') {
    return clampFavoritesPanelGeometry({ ...start, height: start.height + deltaY }, viewport);
  }
  const requestedScale = Math.max(
    (start.width + deltaX) / start.width,
    (start.height + deltaY) / start.height,
  );
  const minScale = Math.max(
    FAVORITES_PANEL_MIN_WIDTH / start.width,
    FAVORITES_PANEL_MIN_HEIGHT / start.height,
  );
  const maxScale = Math.min(
    (viewport.width - start.x - FAVORITES_PANEL_MARGIN) / start.width,
    (viewport.height - start.y - FAVORITES_PANEL_MARGIN) / start.height,
  );
  const scale = clamp(requestedScale, minScale, maxScale);
  return clampFavoritesPanelGeometry({
    ...start,
    width: Math.round(start.width * scale),
    height: Math.round(start.height * scale),
  }, viewport);
}
