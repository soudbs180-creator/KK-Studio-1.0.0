export type CanvasProjectSize = 'normal' | 'large' | 'huge';
export type CanvasZoomBand = 'near' | 'mid' | 'tiny';
export type CanvasCardDetailLevel = 'full' | 'compact' | 'thumbnail-shell';
export type CanvasRenderMode = 'standard' | 'performance' | 'interactive';

export interface CanvasPerformanceProfileInput {
  scale: number;
  isInteracting: boolean;
  nodeCount: number;
  connectionCount: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface CanvasPerformanceProfile {
  scale: number;
  isInteracting: boolean;
  nodeCount: number;
  connectionCount: number;
  viewportWidth: number;
  viewportHeight: number;
  projectSize: CanvasProjectSize;
  zoomBand: CanvasZoomBand;
  overscanBuffer: number;
  renderMode: CanvasRenderMode;
  edgeThrottleMs: number;
  cardDetailLevel: CanvasCardDetailLevel;
}

const PROJECT_OVERSCAN: Record<CanvasProjectSize, number> = {
  normal: 900,
  large: 500,
  huge: 220,
};

const PROJECT_EDGE_THROTTLE: Record<CanvasProjectSize, number> = {
  normal: 8,
  large: 16,
  huge: 32,
};

const lowerProjectSize = (projectSize: CanvasProjectSize): CanvasProjectSize => {
  switch (projectSize) {
    case 'normal':
      return 'large';
    case 'large':
      return 'huge';
    default:
      return 'huge';
  }
};

export const getCanvasProjectSize = (nodeCount: number): CanvasProjectSize => {
  if (nodeCount >= 200) return 'huge';
  if (nodeCount >= 80) return 'large';
  return 'normal';
};

export const getCanvasZoomBand = (scale: number): CanvasZoomBand => {
  if (scale < 0.35) return 'tiny';
  if (scale < 0.8) return 'mid';
  return 'near';
};

export const getCanvasPerformanceProfile = (
  input: CanvasPerformanceProfileInput
): CanvasPerformanceProfile => {
  const projectSize = getCanvasProjectSize(input.nodeCount);
  const zoomBand = getCanvasZoomBand(input.scale);
  const overscanProjectSize = input.isInteracting ? lowerProjectSize(projectSize) : projectSize;

  let cardDetailLevel: CanvasCardDetailLevel = 'full';
  if (zoomBand === 'tiny') {
    cardDetailLevel = 'thumbnail-shell';
  } else if (projectSize !== 'normal' && zoomBand === 'mid') {
    cardDetailLevel = 'compact';
  }

  const renderMode: CanvasRenderMode = input.isInteracting
    ? 'interactive'
    : cardDetailLevel === 'full'
      ? 'standard'
      : 'performance';

  return {
    ...input,
    projectSize,
    zoomBand,
    overscanBuffer: PROJECT_OVERSCAN[overscanProjectSize],
    renderMode,
    edgeThrottleMs: PROJECT_EDGE_THROTTLE[projectSize],
    cardDetailLevel,
  };
};

export const shouldSimplifyCard = (profile: CanvasPerformanceProfile): boolean =>
  profile.cardDetailLevel === 'thumbnail-shell';

export const shouldThrottleEdges = (profile: CanvasPerformanceProfile): boolean =>
  profile.isInteracting || profile.projectSize !== 'normal' || profile.zoomBand === 'tiny';
