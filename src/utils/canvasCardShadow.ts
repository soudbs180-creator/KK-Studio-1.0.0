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

    // Apple Cinematic Base Shadow: Deep, diffused, borderless feel
    const baseShadows = [
        buildShadow(0, 16 * scale, 48 * scale, -12 * scale, 'rgba(0, 0, 0, 0.45)'),
        buildShadow(0, 4 * scale, 16 * scale, -4 * scale, 'rgba(0, 0, 0, 0.25)'),
        // Very subtle rim for definition without solid borders
        buildShadow(0, 0, 0, 1, 'rgba(255, 255, 255, 0.05)')
    ];

    if (!options.accent) {
        if (boost) {
            // Hover/Boost state without accent
            baseShadows.push(buildShadow(0, 24 * scale, 64 * scale, -8 * scale, 'rgba(0, 0, 0, 0.6)'));
            baseShadows.push(buildShadow(0, 0, 0, 1, 'rgba(255, 255, 255, 0.1)')); // brighter rim
        }
        return baseShadows.join(', ');
    }

    // Colored Accent Glows
    let colorRgb = '10, 132, 255'; // Apple Blue
    if (options.accent === 'red') colorRgb = '255, 69, 58';
    if (options.accent === 'gold') colorRgb = '255, 214, 10';

    const glowOpacity = boost ? 0.35 : 0.15;
    const rimOpacity = boost ? 0.5 : 0.25;

    return [
        ...baseShadows,
        // The wide diffused glow
        buildShadow(0, 8 * scale, 48 * scale, 0, `rgba(${colorRgb}, ${glowOpacity})`),
        // The tight glowing rim to substitute physical borders
        buildShadow(0, 0, 0, 1.5, `rgba(${colorRgb}, ${rimOpacity})`)
    ].join(', ');
};
