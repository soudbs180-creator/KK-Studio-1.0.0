import type { ResponsiveSurface, ResultViewMode } from '../types';

export const PHONE_MAX_WIDTH = 768;
export const TABLET_MAX_WIDTH = 1024;

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
