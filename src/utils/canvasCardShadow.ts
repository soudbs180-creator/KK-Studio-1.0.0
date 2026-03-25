export type CanvasCardAccent = 'blue' | 'gold' | 'red';

interface CanvasCardShadowOptions {
    accent?: CanvasCardAccent;
    boost?: boolean;
    zoomScale?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roundShadowValue = (value: number) => Number(value.toFixed(2));

const buildShadowLayer = (offsetY: number, blur: number, spread: number, opacity: number) =>
    `0 ${roundShadowValue(offsetY)}px ${roundShadowValue(blur)}px ${roundShadowValue(spread)}px rgba(0, 0, 0, ${opacity})`;

export const getCanvasCardShadow = (options: CanvasCardShadowOptions = {}) => {
    const boost = options.boost ?? false;
    const safeZoomScale = clamp(options.zoomScale ?? 1, 0.1, 3);
    const scaleCompensation = clamp(1 / safeZoomScale, 0.72, 1.85);

    const primaryOffset = (boost ? 7 : 5) * scaleCompensation;
    const primaryBlur = (boost ? 18 : 14) * scaleCompensation;
    const primarySpread = (boost ? -10 : -8) * scaleCompensation;
    const secondaryOffset = (boost ? 16 : 12) * scaleCompensation;
    const secondaryBlur = (boost ? 32 : 24) * scaleCompensation;
    const secondarySpread = (boost ? -18 : -16) * scaleCompensation;

    return [
        buildShadowLayer(primaryOffset, primaryBlur, primarySpread, boost ? 0.72 : 0.64),
        buildShadowLayer(secondaryOffset, secondaryBlur, secondarySpread, boost ? 0.44 : 0.36),
    ].join(', ');
};
