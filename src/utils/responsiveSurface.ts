import type { MobileResultLayout, ResponsiveSurface, ResultViewMode } from '../types';

export const PHONE_MAX_WIDTH = 768;
export const TABLET_MAX_WIDTH = 1023;
const RESULT_GRID_GAP_PX = 12;
const RESULT_GRID_ROW_HEIGHT_PX = 8;
const RESULT_GRID_STANDARD_MIN_ROWS = 6;
const RESULT_GRID_DETAIL_MIN_ROWS = 14;

export interface AdaptiveResultTileGridMetrics {
  columnSpan: number;
  rowSpan: number;
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

  // 🚀 全平台使用 12 列精细网格，以确保比例整除与防缝隙排版
  return 12;
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
    const horizontalPadding = surface === 'phone' ? 24 : surface === 'tablet' ? 32 : 40;
    const availableWidth = Math.max(280, safeWidth - horizontalPadding);
    const visualHeight = (availableWidth / safeAspectRatio) + 110;
    return {
      columnSpan: safeColumnCount,
      rowSpan: getGridRowSpan(visualHeight, RESULT_GRID_DETAIL_MIN_ROWS),
    };
  }

  // 🚀 12列网格系统下的自适应 span 分配
  let columnSpan = 3; // 默认占 3/12 (一排 4 个)

  if (safeAspectRatio >= 2.0) {
    // 21:9 超宽图 (放 1 个，占 12/12)
    columnSpan = 12;
  } else if (safeAspectRatio >= 1.45) {
    // 16:9 宽图 (放 2 个，占 6/12)
    columnSpan = 6;
  } else {
    // 其他普通比例：放 3 个到 4 个
    if (surface === 'phone') {
      if (safeWidth <= 480) {
        columnSpan = 4; // 窄屏放 3 个 (占 4/12)
      } else {
        columnSpan = 3; // 宽屏放 4 个 (占 3/12)
      }
    } else {
      // 平板和桌面端放 4 个 (占 3/12)
      columnSpan = 3;
    }
  }

  const horizontalPadding = surface === 'phone' ? 24 : surface === 'tablet' ? 32 : 40;
  const availableWidth = Math.max(280, safeWidth - horizontalPadding);
  const baseColumnWidth =
    (availableWidth - RESULT_GRID_GAP_PX * (safeColumnCount - 1)) / safeColumnCount;
  const tileWidth = baseColumnWidth * columnSpan + RESULT_GRID_GAP_PX * (columnSpan - 1);
  const visualHeight = tileWidth / safeAspectRatio;

  return {
    columnSpan,
    rowSpan: getGridRowSpan(visualHeight, RESULT_GRID_STANDARD_MIN_ROWS),
  };
}

function getGridRowSpan(visualHeight: number, minimumRows: number): number {
  const safeVisualHeight = Number.isFinite(visualHeight) && visualHeight > 0 ? visualHeight : 0;
  const rowSpan = Math.ceil(
    (safeVisualHeight + RESULT_GRID_GAP_PX) / (RESULT_GRID_ROW_HEIGHT_PX + RESULT_GRID_GAP_PX),
  );
  return Math.max(minimumRows, rowSpan);
}
