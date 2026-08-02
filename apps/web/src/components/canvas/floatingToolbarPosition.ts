export interface FloatingToolbarPoint {
  x: number;
  y: number;
}

export interface FloatingToolbarSize {
  width: number;
  height: number;
}

const FLOATING_TOOLBAR_MARGIN = 8;

/** Keeps a draggable toolbar fully reachable after a drag or viewport resize. */
export function clampFloatingToolbarPosition(
  point: FloatingToolbarPoint,
  toolbar: FloatingToolbarSize,
  viewport: FloatingToolbarSize,
): FloatingToolbarPoint {
  return {
    x: Math.min(Math.max(point.x, FLOATING_TOOLBAR_MARGIN), Math.max(FLOATING_TOOLBAR_MARGIN, viewport.width - toolbar.width - FLOATING_TOOLBAR_MARGIN)),
    y: Math.min(Math.max(point.y, FLOATING_TOOLBAR_MARGIN), Math.max(FLOATING_TOOLBAR_MARGIN, viewport.height - toolbar.height - FLOATING_TOOLBAR_MARGIN)),
  };
}
