export interface CenteredZoomInput {
  centerX: number;
  centerY: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
}

/** Keeps the visible world-space center fixed while applying a new zoom. */
export function computeCenteredZoomTransform(input: CenteredZoomInput) {
  return {
    x: input.viewportWidth / 2 - input.centerX * input.scale,
    y: input.viewportHeight / 2 - input.centerY * input.scale,
    scale: input.scale,
  };
}
