import { AspectRatio, GenerationMode } from '../types';
import { FOOTER_HEIGHT, getCardDimensions } from './styleUtils';

export interface GeneratedImageLayoutItem {
    aspectRatio?: AspectRatio;
    exactDimensions?: { width: number; height: number } | null;
}

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

const resolveGeneratedImageCardMetrics = (item: GeneratedImageLayoutItem) => {
    const { width: fallbackWidth, totalHeight: fallbackHeight } = getCardDimensions(item.aspectRatio, true);
    const exactWidth = item.exactDimensions?.width;
    const exactHeight = item.exactDimensions?.height;

    if (!exactWidth || !exactHeight) {
        return { width: fallbackWidth, height: fallbackHeight };
    }

    const aspect = exactWidth / exactHeight;
    if (!Number.isFinite(aspect) || aspect <= 0) {
        return { width: fallbackWidth, height: fallbackHeight };
    }

    const { width: renderedWidth } = getCardDimensions(item.aspectRatio, false);
    return {
        width: renderedWidth,
        height: (renderedWidth / aspect) + FOOTER_HEIGHT
    };
};

export const buildGeneratedImageBatchPositions = ({
    basePosition,
    items,
    mode,
    isMobile = false,
    gapToImages = 80,
    wideGap = 20,
    compactGap = 12,
    mobileGap = 8,
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
            const position = {
                x: basePosition.x,
                y: currentTop + metric.height
            };
            currentTop += metric.height + mobileGap;
            return position;
        });
    }

    const safeColumns = Math.max(1, columns);
    const positions: Array<{ x: number; y: number }> = new Array(metrics.length);
    let currentTop = basePosition.y + gapToImages;

    for (let rowStart = 0; rowStart < metrics.length; rowStart += safeColumns) {
        const rowMetrics = metrics.slice(rowStart, rowStart + safeColumns);
        const rowGap = rowMetrics.some((metric) => metric.width < 260) ? compactGap : wideGap;
        const rowWidth = rowMetrics.reduce((sum, metric) => sum + metric.width, 0) + (rowMetrics.length - 1) * rowGap;
        const rowHeight = Math.max(...rowMetrics.map((metric) => metric.height));
        let currentLeft = basePosition.x - rowWidth / 2;

        rowMetrics.forEach((metric, indexInRow) => {
            positions[rowStart + indexInRow] = {
                x: currentLeft + metric.width / 2,
                y: currentTop + metric.height
            };
            currentLeft += metric.width + rowGap;
        });

        currentTop += rowHeight + rowGap;
    }

    return positions;
};
