export type CanvasProjectSize = 'normal' | 'large' | 'huge';
export type CanvasZoomBand = 'near' | 'mid' | 'tiny';
export type CanvasCardDetailLevel = 'full' | 'compact' | 'thumbnail-shell';
export type CanvasRenderMode = 'standard' | 'performance' | 'interactive';
export type CanvasDeviceTier = 'low' | 'medium' | 'high';
export type CanvasInteractionPhase = 'idle' | 'pan' | 'zoom';
export type CanvasEdgeMode = 'full' | 'throttled' | 'minimal';
export type CanvasOverscanMode = 'wide' | 'balanced' | 'tight';

export interface CanvasPerformanceProfileInput {
  scale: number;
  isInteracting: boolean;
  interactionPhase?: CanvasInteractionPhase;
  isDragging?: boolean;
  isZooming?: boolean;
  hardwareConcurrency?: number | null;
  deviceMemory?: number | null;
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
  deviceTier: CanvasDeviceTier;
  interactionPhase: CanvasInteractionPhase;
  projectSize: CanvasProjectSize;
  zoomBand: CanvasZoomBand;
  frameBudgetMs: number;
  edgeMode: CanvasEdgeMode;
  overscanMode: CanvasOverscanMode;
  detailHysteresisMs: number;
  overscanBuffer: number;
  renderMode: CanvasRenderMode;
  edgeThrottleMs: number;
  cardDetailLevel: CanvasCardDetailLevel;
}

export interface CanvasTextSofteningProfile {
  active: boolean;
  progress: number;
  primaryBlurPx: number;
  secondaryBlurPx: number;
  primaryOpacity: number;
  secondaryOpacity: number;
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

const FRAME_BUDGET_BY_DEVICE_TIER: Record<CanvasDeviceTier, number> = {
  high: 12,
  medium: 10,
  low: 8,
};

const DETAIL_HYSTERESIS_BY_DEVICE_TIER: Record<CanvasDeviceTier, number> = {
  high: 120,
  medium: 160,
  low: 220,
};

const EDGE_THROTTLE_MULTIPLIER: Record<CanvasEdgeMode, number> = {
  full: 1,
  throttled: 1,
  minimal: 2,
};

const normalizePositiveHint = (value?: number | null): number | undefined => (
  Number.isFinite(value) && (value as number) > 0 ? Number(value) : undefined
);

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

export const getCanvasDeviceTier = ({
  hardwareConcurrency,
  deviceMemory,
}: Pick<CanvasPerformanceProfileInput, 'hardwareConcurrency' | 'deviceMemory'>): CanvasDeviceTier => {
  const normalizedHardwareConcurrency = normalizePositiveHint(hardwareConcurrency);
  const normalizedDeviceMemory = normalizePositiveHint(deviceMemory);

  if (
    (normalizedHardwareConcurrency !== undefined && normalizedHardwareConcurrency <= 4)
    || (normalizedDeviceMemory !== undefined && normalizedDeviceMemory <= 4)
  ) {
    return 'low';
  }

  if (
    (normalizedHardwareConcurrency !== undefined && normalizedHardwareConcurrency >= 12)
    || (normalizedDeviceMemory !== undefined && normalizedDeviceMemory >= 8)
  ) {
    return 'high';
  }

  return 'medium';
};

export const resolveCanvasInteractionPhase = ({
  interactionPhase,
  isDragging = false,
  isZooming = false,
  isInteracting = false,
}: Pick<
  CanvasPerformanceProfileInput,
  'interactionPhase' | 'isDragging' | 'isZooming' | 'isInteracting'
>): CanvasInteractionPhase => {
  if (interactionPhase === 'idle' || interactionPhase === 'pan' || interactionPhase === 'zoom') {
    return interactionPhase;
  }

  if (isZooming) return 'zoom';
  if (isDragging || isInteracting) return 'pan';
  return 'idle';
};

export const getCanvasInteractionIdleRelaxationMs = (
  interactionPhase: CanvasInteractionPhase,
  deviceTier: CanvasDeviceTier = 'medium'
): number => {
  if (interactionPhase === 'idle') {
    return 0;
  }

  return DETAIL_HYSTERESIS_BY_DEVICE_TIER[deviceTier] + (interactionPhase === 'zoom' ? 60 : 0);
};

const getCanvasOverscanMode = (
  interactionPhase: CanvasInteractionPhase,
  deviceTier: CanvasDeviceTier,
  zoomBand: CanvasZoomBand,
  projectSize: CanvasProjectSize
): CanvasOverscanMode => {
  if (interactionPhase !== 'idle' || deviceTier === 'low' || zoomBand === 'tiny') {
    return 'tight';
  }

  if (deviceTier === 'high' && projectSize === 'normal' && zoomBand === 'near') {
    return 'wide';
  }

  return 'balanced';
};

const getCanvasEdgeMode = (
  interactionPhase: CanvasInteractionPhase,
  deviceTier: CanvasDeviceTier,
  projectSize: CanvasProjectSize,
  zoomBand: CanvasZoomBand
): CanvasEdgeMode => {
  if (
    zoomBand === 'tiny'
    && (interactionPhase === 'zoom' || projectSize === 'huge' || deviceTier === 'low')
  ) {
    return 'minimal';
  }

  if (
    interactionPhase !== 'idle'
    || projectSize !== 'normal'
    || zoomBand === 'tiny'
    || deviceTier === 'low'
  ) {
    return 'throttled';
  }

  return 'full';
};

const getCanvasFrameBudgetMs = (
  interactionPhase: CanvasInteractionPhase,
  deviceTier: CanvasDeviceTier,
  projectSize: CanvasProjectSize,
  zoomBand: CanvasZoomBand
): number => {
  let nextBudget = FRAME_BUDGET_BY_DEVICE_TIER[deviceTier];

  if (interactionPhase === 'pan') {
    nextBudget -= 1;
  } else if (interactionPhase === 'zoom') {
    nextBudget -= 2;
  }

  if (projectSize === 'huge' || zoomBand === 'tiny') {
    nextBudget -= 1;
  }

  return Math.max(4, nextBudget);
};

export const getCanvasPerformanceProfile = (
  input: CanvasPerformanceProfileInput
): CanvasPerformanceProfile => {
  const projectSize = getCanvasProjectSize(input.nodeCount);
  const zoomBand = getCanvasZoomBand(input.scale);
  const deviceTier = getCanvasDeviceTier(input);
  const interactionPhase = resolveCanvasInteractionPhase(input);
  const overscanMode = getCanvasOverscanMode(interactionPhase, deviceTier, zoomBand, projectSize);
  const edgeMode = getCanvasEdgeMode(interactionPhase, deviceTier, projectSize, zoomBand);
  const overscanProjectSize = overscanMode === 'tight' ? lowerProjectSize(projectSize) : projectSize;
  const isInteracting = interactionPhase !== 'idle';

  let cardDetailLevel: CanvasCardDetailLevel = 'full';
  if (zoomBand === 'tiny') {
    cardDetailLevel = 'thumbnail-shell';
  } else if (projectSize !== 'normal' && zoomBand === 'mid') {
    cardDetailLevel = 'compact';
  }

  const renderMode: CanvasRenderMode = cardDetailLevel === 'thumbnail-shell'
    ? 'performance'
    : isInteracting
      ? 'interactive'
      : cardDetailLevel === 'full' && edgeMode === 'full'
      ? 'standard'
      : 'performance';

  return {
    scale: input.scale,
    isInteracting,
    nodeCount: input.nodeCount,
    connectionCount: input.connectionCount,
    viewportWidth: input.viewportWidth,
    viewportHeight: input.viewportHeight,
    deviceTier,
    interactionPhase,
    projectSize,
    zoomBand,
    frameBudgetMs: getCanvasFrameBudgetMs(interactionPhase, deviceTier, projectSize, zoomBand),
    edgeMode,
    overscanMode,
    detailHysteresisMs: getCanvasInteractionIdleRelaxationMs(interactionPhase, deviceTier),
    overscanBuffer: PROJECT_OVERSCAN[overscanProjectSize],
    renderMode,
    edgeThrottleMs: Math.round(
      PROJECT_EDGE_THROTTLE[projectSize] * EDGE_THROTTLE_MULTIPLIER[edgeMode]
    ),
    cardDetailLevel,
  };
};

export const shouldSimplifyCard = (profile: CanvasPerformanceProfile): boolean =>
  profile.cardDetailLevel === 'thumbnail-shell';

export const shouldThrottleEdges = (profile: CanvasPerformanceProfile): boolean =>
  profile.edgeMode !== 'full';

export const getCanvasTextSofteningProfile = (
  scale: number,
  enabled: boolean
): CanvasTextSofteningProfile => {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  if (!enabled || safeScale >= 1) {
    return {
      active: false,
      progress: 0,
      primaryBlurPx: 0,
      secondaryBlurPx: 0,
      primaryOpacity: 1,
      secondaryOpacity: 1,
    };
  }

  const clampedScale = Math.max(0.5, Math.min(1, safeScale));
  const linearProgress = (1 - clampedScale) / 0.5;
  const progress = linearProgress * linearProgress * (3 - 2 * linearProgress);

  return {
    active: progress > 0.001,
    progress,
    primaryBlurPx: Number((0.72 * progress).toFixed(3)),
    secondaryBlurPx: Number((0.96 * progress).toFixed(3)),
    primaryOpacity: Number((1 - 0.1 * progress).toFixed(3)),
    secondaryOpacity: Number((1 - 0.3 * progress).toFixed(3)),
  };
};
