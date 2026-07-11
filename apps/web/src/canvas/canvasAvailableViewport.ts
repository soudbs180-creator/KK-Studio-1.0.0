export type CanvasViewportInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CanvasAvailableViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type CanvasViewportRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const readCssPixels = (styles: CSSStyleDeclaration, property: string): number => {
  const value = Number.parseFloat(styles.getPropertyValue(property));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

export const measureCanvasViewportInsets = (rect: CanvasViewportRect): CanvasViewportInsets => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const rootStyles = getComputedStyle(document.documentElement);
  const safeTop = readCssPixels(rootStyles, '--kk-safe-area-top');
  const safeRight = readCssPixels(rootStyles, '--kk-safe-area-right');
  const safeBottom = readCssPixels(rootStyles, '--kk-safe-area-bottom');
  const safeLeft = readCssPixels(rootStyles, '--kk-safe-area-left');
  const rail = document.getElementById('project-manager-container')?.getBoundingClientRect();
  const topChrome = document.querySelector<HTMLElement>('.desktop-left-chrome')?.getBoundingClientRect();
  const navigation = document.querySelector<HTMLElement>('.desktop-navigation-panel')?.getBoundingClientRect();
  const promptBar = document.getElementById('prompt-bar-container')?.getBoundingClientRect();
  const visualViewport = window.visualViewport;
  const keyboardBottomInset = visualViewport
    ? Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
    : 0;
  return {
    left: Math.max(safeLeft, rail ? rail.right - rect.left + 12 : 0),
    right: Math.max(safeRight, navigation ? rect.right - navigation.left + 12 : 0),
    top: Math.max(safeTop, topChrome ? topChrome.bottom - rect.top + 12 : 0),
    bottom: Math.max(
      safeBottom + keyboardBottomInset,
      promptBar ? rect.bottom - promptBar.top + 12 : 0,
    ),
  };
};

export const getAvailableCanvasViewport = (
  viewport: { width: number; height: number },
  insets: Partial<CanvasViewportInsets> = {},
): CanvasAvailableViewport => {
  const left = Math.max(0, Math.min(viewport.width, insets.left || 0));
  const right = Math.max(0, Math.min(viewport.width - left, insets.right || 0));
  const top = Math.max(0, Math.min(viewport.height, insets.top || 0));
  const bottom = Math.max(0, Math.min(viewport.height - top, insets.bottom || 0));
  const width = Math.max(1, viewport.width - left - right);
  const height = Math.max(1, viewport.height - top - bottom);
  return {
    x: left,
    y: top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
};

export const canvasScreenPointToWorld = (
  point: { x: number; y: number },
  transform: { x: number; y: number; scale: number },
): { x: number; y: number } => ({
  x: (point.x - transform.x) / transform.scale,
  y: (point.y - transform.y) / transform.scale,
});
