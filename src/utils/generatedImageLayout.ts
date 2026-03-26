import { AspectRatio, GenerationMode } from '../types';
import { FOOTER_HEIGHT, getCardDimensions } from './styleUtils';

export interface GeneratedImageLayoutItem {
    aspectRatio?: AspectRatio;
    exactDimensions?: { width: number; height: number } | null;
}

type ResolvedLayoutMetric = {
    width: number;
    height: number;
    aspectValue: number;
};

interface BuildGeneratedImageBatchPositionsOptions {
    basePosition: { x: number; y: number };
    items: GeneratedImageLayoutItem[];
    mode?: GenerationMode;
    isMobile?: boolean;
    gapToImages?: number;
    wideGap?: number;
    compactGap?: number;
    mobileGap?: number;
    pptGap?: number;
    pptCompactGap?: number;
    columns?: number;
}

const clampGap = (value: number, min: number, max: number) => (
    Math.round(Math.min(max, Math.max(min, value)))
);

const resolveAspectRatioValue = (item: GeneratedImageLayoutItem, fallbackWidth: number, fallbackHeight: number) => {
    const exactWidth = item.exactDimensions?.width;
    const exactHeight = item.exactDimensions?.height;

    if (exactWidth && exactHeight && exactWidth > 0 && exactHeight > 0) {
        return exactWidth / exactHeight;
    }

    const ratioText = item.aspectRatio;
    if (ratioText && ratioText !== AspectRatio.AUTO) {
        const match = ratioText.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
        if (match?.[1] && match?.[2]) {
            const numerator = Number(match[1]);
            const denominator = Number(match[2]);
            if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
                return numerator / denominator;
            }
        }
    }

    return fallbackWidth / Math.max(1, fallbackHeight - FOOTER_HEIGHT);
};

const resolveGeneratedImageCardMetrics = (item: GeneratedImageLayoutItem): ResolvedLayoutMetric => {
    const { width: fallbackWidth, totalHeight: fallbackHeight } = getCardDimensions(item.aspectRatio, true);
    const exactWidth = item.exactDimensions?.width;
    const exactHeight = item.exactDimensions?.height;
    const fallbackAspectValue = resolveAspectRatioValue(item, fallbackWidth, fallbackHeight);

    if (!exactWidth || !exactHeight) {
        return {
            width: fallbackWidth,
            height: fallbackHeight,
            aspectValue: fallbackAspectValue,
        };
    }

    const aspect = exactWidth / exactHeight;
    if (!Number.isFinite(aspect) || aspect <= 0) {
        return {
            width: fallbackWidth,
            height: fallbackHeight,
            aspectValue: fallbackAspectValue,
        };
    }

    const { width: renderedWidth } = getCardDimensions(item.aspectRatio, false);
    return {
        width: renderedWidth,
        height: (renderedWidth / aspect) + FOOTER_HEIGHT,
        aspectValue: aspect,
    };
};

const resolveDesktopHorizontalGap = (
    rowMetrics: ResolvedLayoutMetric[],
    wideGap: number,
    compactGap: number
) => {
    const maxWidth = Math.max(...rowMetrics.map((metric) => metric.width));
    const hasPortraitCard = rowMetrics.some((metric) => metric.aspectValue <= 0.82);
    const hasUltraTallCard = rowMetrics.some((metric) => metric.aspectValue <= 0.5);
    const hasUltraWideCard = rowMetrics.some((metric) => metric.aspectValue >= 2.2);
    const baseGap = rowMetrics.some((metric) => metric.width < 260) ? compactGap : wideGap;
    const widthDrivenGap = maxWidth * 0.1;
    const portraitBoost = hasPortraitCard ? 6 : 0;
    const ultraTallBoost = hasUltraTallCard ? 10 : 0;
    const ultraWideBoost = hasUltraWideCard ? 10 : 0;

    return clampGap(
        Math.max(baseGap, widthDrivenGap) + portraitBoost + ultraTallBoost + ultraWideBoost,
        baseGap,
        hasUltraTallCard || hasUltraWideCard ? 60 : 48
    );
};

const resolveDesktopVerticalGap = (
    rowMetrics: ResolvedLayoutMetric[],
    wideGap: number,
    compactGap: number
) => {
    const maxHeight = Math.max(...rowMetrics.map((metric) => metric.height));
    const hasTallCard = rowMetrics.some((metric) => metric.height > 360);
    const hasUltraTallCard = rowMetrics.some((metric) => metric.aspectValue <= 0.5);
    const hasUltraWideCard = rowMetrics.some((metric) => metric.aspectValue >= 2.2);
    const baseGap = rowMetrics.some((metric) => metric.width < 260) ? compactGap : wideGap;
    const heightDrivenGap = maxHeight * 0.075;
    const tallCardBoost = hasTallCard ? 8 : 0;
    const ultraTallBoost = hasUltraTallCard ? 18 : 0;
    const ultraWideBoost = hasUltraWideCard ? 12 : 0;

    return clampGap(
        Math.max(baseGap, heightDrivenGap) + tallCardBoost + ultraTallBoost + ultraWideBoost,
        baseGap,
        hasUltraTallCard ? 88 : hasUltraWideCard ? 64 : 52
    );
};

export const buildGeneratedImageBatchPositions = ({
    basePosition,
    items,
    mode,
    isMobile = false,
    gapToImages = 80,
    wideGap = 28,
    compactGap = 24,
    mobileGap = 12,
    pptGap = 28,
    pptCompactGap = 18,
    columns = 2,
}: BuildGeneratedImageBatchPositionsOptions): Array<{ x: number; y: number }> => {
    if (!items.length) return [];

    const metrics = items.map(resolveGeneratedImageCardMetrics);

    if (mode === GenerationMode.PPT) {
        const verticalGap = metrics.some((metric) => metric.width < 260) ? pptCompactGap : pptGap;
        let currentTop = basePosition.y + gapToImages;

        return metrics.map((metric) => {
            const position = {
                x: basePosition.x,
                y: currentTop + metric.height
            };
            currentTop += metric.height + verticalGap;
            return position;
        });
    }

    if (isMobile) {
        let currentTop = basePosition.y + gapToImages;

        return metrics.map((metric) => {
            const hasExtremeAspect = metric.aspectValue <= 0.5 || metric.aspectValue >= 2.2;
            const stackedGap = clampGap(
                Math.max(
                    mobileGap,
                    metric.height * 0.04,
                    hasExtremeAspect ? 20 : mobileGap
                ),
                mobileGap,
                hasExtremeAspect ? 36 : 24
            );
            const position = {
                x: basePosition.x,
                y: currentTop + metric.height
            };
            currentTop += metric.height + stackedGap;
            return position;
        });
    }

    // Desktop: Grid Layout
    const safeColumns = items.length === 1 ? 1 : Math.max(1, columns);
    const positions: Array<{ x: number; y: number }> = new Array(metrics.length);
    let currentTop = basePosition.y + gapToImages;

    // 🎯 [Fix] 单列时直接返回居中位置，不使用复杂计算
    if (items.length === 1) {
        const metric = metrics[0];
        const position = {
            x: basePosition.x,
            y: currentTop + metric.height
        };
        console.log('[DEBUG] Single image layout:', {
            basePosition,
            metric,
            position,
            'metric.width': metric.width
        });
        return [position];
    }

    for (let rowStart = 0; rowStart < metrics.length; rowStart += safeColumns) {
        const rowMetrics = metrics.slice(rowStart, rowStart + safeColumns);
        // Use width- and height-aware gutters so portrait, square, and landscape mixes
        // all keep visible breathing room instead of sharing one cramped fixed gap.
        const columnGap = resolveDesktopHorizontalGap(rowMetrics, wideGap, compactGap);
        const rowGap = resolveDesktopVerticalGap(rowMetrics, wideGap, compactGap);
        const rowWidth = rowMetrics.reduce((sum, metric) => sum + metric.width, 0) + (rowMetrics.length - 1) * columnGap;
        const rowHeight = Math.max(...rowMetrics.map((metric) => metric.height));
        let currentLeft = basePosition.x - rowWidth / 2;

        rowMetrics.forEach((metric, indexInRow) => {
            positions[rowStart + indexInRow] = {
                x: currentLeft + metric.width / 2,
                y: currentTop + metric.height
            };
            currentLeft += metric.width + columnGap;
        });

        currentTop += rowHeight + rowGap;
    }

    return positions;
};
