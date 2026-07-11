import type { MobileResultLayout, ResponsiveSurface, ResultViewMode } from '../types';

export const PHONE_MAX_WIDTH = 768;
export const TABLET_MAX_WIDTH = 1023;
export type CanvasWorkspaceSurface = 'phone-results' | 'tablet-portrait-results' | 'tablet-landscape-canvas' | 'desktop-canvas';
const RESULT_GRID_GAP_PX = 12;
const RESULT_GRID_ROW_HEIGHT_PX = 8;
const RESULT_GRID_VERTICAL_CHROME_PX = 12;
const RESULT_GRID_DETAIL_CHROME_PX = 44;

export interface AdaptiveResultTileGridMetrics {
  columnSpan: number;
  rowSpan: number;
}

export function resolveStableResponsiveViewport(
  previous: { width: number; height: number },
  next: { width: number; height: number },
  isTextEntryFocused: boolean,
): { width: number; height: number } {
  const widthIsStable = Math.abs(next.width - previous.width) < 2;
  const keyboardLikelyReducedHeight = next.height < previous.height - 120;
  return isTextEntryFocused && widthIsStable && keyboardLikelyReducedHeight
    ? { width: next.width, height: previous.height }
    : next;
}

export function resolveResponsiveSurface(width: number): ResponsiveSurface {
  if (width <= PHONE_MAX_WIDTH) {
    return 'phone';
  }

  if (width <= TABLET_MAX_WIDTH) {
    return 'tablet';
  }

  return 'desktop';
}

export function isCompactResponsiveSurface(surface: ResponsiveSurface): boolean {
  return surface !== 'desktop';
}

export function resolveCanvasWorkspaceSurface(width: number, height: number): CanvasWorkspaceSurface {
  const surface = resolveResponsiveSurface(width);
  if (surface === 'phone') return 'phone-results';
  if (surface === 'desktop') return 'desktop-canvas';
  return width > height ? 'tablet-landscape-canvas' : 'tablet-portrait-results';
}

export function isCanvasWorkspaceResultFlow(surface: CanvasWorkspaceSurface): boolean {
  return surface === 'phone-results' || surface === 'tablet-portrait-results';
}

export function getCanvasViewportSurfaceKey(surface: CanvasWorkspaceSurface): 'desktop' | 'tablet-landscape' {
  return surface === 'tablet-landscape-canvas' ? 'tablet-landscape' : 'desktop';
}

export function isPhoneResponsiveWidth(width: number): boolean {
  return resolveResponsiveSurface(width) === 'phone';
}

export function isCompactResponsiveWidth(width: number): boolean {
  return isCompactResponsiveSurface(resolveResponsiveSurface(width));
}

export function getAdaptiveResultColumnCount({
  surface,
  width,
  viewMode,
}: {
  surface: ResponsiveSurface;
  width: number;
  viewMode: ResultViewMode;
}): number {
  if (viewMode === 'detail') {
    return 1;
  }

  if (surface === 'phone') {
    if (width <= 360) {
      return 2;
    }

    if (width <= 560) {
      return 3;
    }

    return 4;
  }

  if (surface === 'tablet') {
    return width >= 960 ? 5 : 4;
  }

  return 6;
}

export function getAdaptiveResultTileGridMetrics({
  surface,
  width,
  viewMode,
  columnCount,
  aspectRatio,
  aspectCategory,
}: {
  surface: ResponsiveSurface;
  width: number;
  viewMode: ResultViewMode;
  columnCount: number;
  aspectRatio: number;
  aspectCategory: MobileResultLayout['aspectCategory'];
}): AdaptiveResultTileGridMetrics {
  const safeColumnCount = Math.max(1, Math.floor(columnCount));
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : surface === 'phone' ? PHONE_MAX_WIDTH : TABLET_MAX_WIDTH;

  if (viewMode === 'detail') {
    return {
      columnSpan: safeColumnCount,
      rowSpan: Math.max(28, Math.ceil((safeWidth / safeAspectRatio + RESULT_GRID_DETAIL_CHROME_PX) / RESULT_GRID_ROW_HEIGHT_PX)),
    };
  }

  const horizontalPadding = surface === 'phone' ? 24 : surface === 'tablet' ? 32 : 40;
  const availableWidth = Math.max(280, safeWidth - horizontalPadding);
  const baseColumnWidth =
    (availableWidth - RESULT_GRID_GAP_PX * (safeColumnCount - 1)) / safeColumnCount;
  const columnSpan = aspectCategory === 'wide' && safeColumnCount >= 3 ? 2 : 1;
  const tileWidth = baseColumnWidth * columnSpan + RESULT_GRID_GAP_PX * (columnSpan - 1);
  const visualHeight = tileWidth / safeAspectRatio + RESULT_GRID_VERTICAL_CHROME_PX;

  return {
    columnSpan,
    rowSpan: Math.max(12, Math.ceil(visualHeight / RESULT_GRID_ROW_HEIGHT_PX)),
  };
}
