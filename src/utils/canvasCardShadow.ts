export type CanvasCardAccent = 'blue' | 'gold' | 'red';

interface CanvasCardShadowOptions {
    accent?: CanvasCardAccent;
    boost?: boolean;
    zoomScale?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Number(value.toFixed(2));

const buildShadow = (offsetX: number, offsetY: number, blur: number, spread: number, color: string) =>
    `${round(offsetX)}px ${round(offsetY)}px ${round(blur)}px ${round(spread)}px ${color}`;

export const getCanvasCardShadow = (options: CanvasCardShadowOptions = {}) => {
    const boost = options.boost ?? false;
    const safeZoomScale = clamp(options.zoomScale ?? 1, 0.1, 3);
    const scale = clamp(1 / safeZoomScale, 0.75, 1.5);

    // Airtable canvas card shadow: shallow depth plus a crisp rim, not cinematic glow.
    const baseShadows = [
        buildShadow(0, 10 * scale, 24 * scale, -12 * scale, 'rgba(24, 29, 38, 0.10)'),
        buildShadow(0, 2 * scale, 8 * scale, -4 * scale, 'rgba(0, 0, 0, 0.18)'),
        buildShadow(0, 0, 0, 1, 'rgba(255, 255, 255, 0.06)')
    ];

    if (!options.accent) {
        if (boost) {
            baseShadows.push(buildShadow(0, 14 * scale, 30 * scale, -14 * scale, 'rgba(24, 29, 38, 0.14)'));
            baseShadows.push(buildShadow(0, 0, 0, 1, 'rgba(255, 255, 255, 0.10)'));
        }
        return baseShadows.join(', ');
    }

    let colorRgb = '27, 97, 201';
    if (options.accent === 'red') colorRgb = '185, 28, 28';
    if (options.accent === 'gold') colorRgb = '180, 83, 9';

    const glowOpacity = boost ? 0.14 : 0.08;
    const rimOpacity = boost ? 0.42 : 0.28;

    return [
        ...baseShadows,
        buildShadow(0, 6 * scale, 16 * scale, -8 * scale, `rgba(${colorRgb}, ${glowOpacity})`),
        buildShadow(0, 0, 0, 1.5, `rgba(${colorRgb}, ${rimOpacity})`)
    ].join(', ');
};
