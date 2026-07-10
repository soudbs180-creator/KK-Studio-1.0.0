type CubicBezierSegment = {
  startX: number;
  startY: number;
  control1X: number;
  control1Y: number;
  control2X: number;
  control2Y: number;
  endX: number;
  endY: number;
};

function getSoftConnectorControlPoints(startX: number, startY: number, endX: number, endY: number) {
  const deltaX = endX - startX;
  const distanceX = Math.abs(deltaX);
  const distanceY = Math.abs(endY - startY);
  const directionX = deltaX === 0 ? 0 : Math.sign(deltaX);
  const horizontalPull = Math.min(distanceX * 0.22, 64) * directionX;
  const startPullY = Math.min(Math.max(distanceY * 0.42, 24), Math.max(distanceY * 0.72, 24));
  const endPullY = Math.min(Math.max(distanceY * 0.24, 18), Math.max(distanceY * 0.44, 18));

  return {
    control1X: startX + horizontalPull,
    control1Y: startY + startPullY,
    control2X: endX - horizontalPull,
    control2Y: endY - endPullY,
  };
}

function getSoftConnectorBezierSegment(startX: number, startY: number, endX: number, endY: number): CubicBezierSegment {
  return {
    startX,
    startY,
    ...getSoftConnectorControlPoints(startX, startY, endX, endY),
    endX,
    endY,
  };
}

function getCubicBezierPoint(start: number, control1: number, control2: number, end: number, t: number) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return (mt * mt2 * start) + (3 * mt2 * t * control1) + (3 * mt * t2 * control2) + (t * t2 * end);
}

export function buildSoftConnectorPath(startX: number, startY: number, endX: number, endY: number) {
  const segment = getSoftConnectorBezierSegment(startX, startY, endX, endY);

  return `M${segment.startX},${segment.startY} C${segment.control1X},${segment.control1Y} ${segment.control2X},${segment.control2Y} ${segment.endX},${segment.endY}`;
}

export function buildDockedVerticalConnectorPath(startX: number, startY: number, endX: number, endY: number) {
  const deltaY = endY - startY;
  const directionY = deltaY === 0 ? 1 : Math.sign(deltaY);
  const distanceY = Math.abs(deltaY);
  const startPullY = Math.max(28, Math.min(distanceY * 0.5, 140)) * directionY;
  const endPullY = Math.max(24, Math.min(distanceY * 0.34, 112)) * directionY;

  return `M${startX},${startY} C${startX},${startY + startPullY} ${endX},${endY - endPullY} ${endX},${endY}`;
}

export function buildDockedHorizontalConnectorPath(startX: number, startY: number, endX: number, endY: number) {
  const deltaX = endX - startX;
  const directionX = deltaX === 0 ? 1 : Math.sign(deltaX);
  const distanceX = Math.abs(deltaX);
  const startPullX = Math.max(28, Math.min(distanceX * 0.5, 140)) * directionX;
  const endPullX = Math.max(24, Math.min(distanceX * 0.34, 112)) * directionX;

  return `M${startX},${startY} C${startX + startPullX},${startY} ${endX - endPullX},${endY} ${endX},${endY}`;
}

export function getSoftConnectorPointAt(startX: number, startY: number, endX: number, endY: number, t: number) {
  const { control1X, control1Y, control2X, control2Y } = getSoftConnectorControlPoints(startX, startY, endX, endY);

  return {
    x: getCubicBezierPoint(startX, control1X, control2X, endX, t),
    y: getCubicBezierPoint(startY, control1Y, control2Y, endY, t),
  };
}
