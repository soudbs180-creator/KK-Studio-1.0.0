import type { AspectRatio, GenerationMode } from '../types.ts';
import { FOOTER_HEIGHT, getCardDimensions } from './styleUtils.ts';

const coerceAspectRatio = (value: string): AspectRatio => value as unknown as AspectRatio;
const coerceGenerationMode = (value: string): GenerationMode => value as unknown as GenerationMode;

const ASPECT_RATIO_AUTO = coerceAspectRatio('auto');
const GENERATION_MODE_PPT = coerceGenerationMode('ppt');

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

export interface DockedPromptChildRegroupLayoutItem {
    index: number;
    row: number;
    column: number;
    width: number;
    height: number;
    dockedPosition: { x: number; y: number };
    settledPosition: { x: number; y: number };
    position: { x: number; y: number };
}

interface BuildDockedPromptChildRegroupLayoutOptions {
    basePosition: { x: number; y: number };
    items: GeneratedImageLayoutItem[];
    mode?: GenerationMode;
    isMobile?: boolean;
    gapToPrompt?: number;
    dockGapToPrompt?: number;
    settledGap?: number;
    dockedGap?: number;
    columns?: number;
    regroupStartPositions?: Array<{ x: number; y: number } | undefined>;
    fastRegroupProgress?: number;
    settleRegroupProgress?: number;
    targetSlotIndices?: number[];
}

const clampGap = (value: number, min: number, max: number) => (
    Math.round(Math.min(max, Math.max(min, value)))
);

const clampUnitProgress = (value: number | undefined, fallback: number) => {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(1, Math.max(0, value as number));
};

const lerp = (from: number, to: number, progress: number) => from + ((to - from) * progress);

const lerpPoint = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    progress: number
) => ({
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
});

const measurePointDistance = (
    left: { x: number; y: number },
    right: { x: number; y: number },
) => Math.hypot(left.x - right.x, left.y - right.y);

const normalizeRangeValue = (value: number, min: number, max: number) => {
    if (!Number.isFinite(value)) return 0.5;

    const range = max - min;
    if (range <= 1) return 0.5;

    return Math.min(1, Math.max(0, (value - min) / range));
};

const resolveLayeredRegroupProgress = (
    progress: number,
    travelDistance: number,
    minTravelDistance: number,
    maxTravelDistance: number,
) => {
    const normalizedDistance = normalizeRangeValue(
        travelDistance,
        minTravelDistance,
        maxTravelDistance,
    );
    const midMotionEnvelope = 4 * progress * (1 - progress);
    const progressOffset = (normalizedDistance - 0.5) * 0.24 * midMotionEnvelope;

    return clampUnitProgress(progress + progressOffset, progress);
};

const compareRegroupVisualOrder = (
    left: { index: number; position: { x: number; y: number } | undefined },
    right: { index: number; position: { x: number; y: number } | undefined },
    columns: number,
    itemCount: number,
) => {
    const leftPosition = left.position ?? { x: 0, y: 0 };
    const rightPosition = right.position ?? { x: 0, y: 0 };
    const xDiff = leftPosition.x - rightPosition.x;
    const yDiff = leftPosition.y - rightPosition.y;

    if (columns <= 1) {
        if (Math.abs(yDiff) > 1) return yDiff;
        if (Math.abs(xDiff) > 1) return xDiff;
        return left.index - right.index;
    }

    if (columns >= itemCount) {
        if (Math.abs(xDiff) > 1) return xDiff;
        if (Math.abs(yDiff) > 1) return yDiff;
        return left.index - right.index;
    }

    if (Math.abs(yDiff) > 1) return yDiff;
    if (Math.abs(xDiff) > 1) return xDiff;
    return left.index - right.index;
};

const buildRegroupTargetSlotIndexByItem = (
    regroupStartPositions: Array<{ x: number; y: number } | undefined> | undefined,
    columns: number,
    itemCount: number,
) => {
    const slotIndexByItem = new Map<number, number>();
    const indexedPositions = Array.from({ length: itemCount }, (_, index) => ({
        index,
        position: regroupStartPositions?.[index],
    }));

    indexedPositions
        .sort((left, right) => compareRegroupVisualOrder(left, right, columns, itemCount))
        .forEach((entry, slotIndex) => {
            slotIndexByItem.set(entry.index, slotIndex);
        });

    return slotIndexByItem;
};

const isValidTargetSlotIndices = (
    targetSlotIndices: number[] | undefined,
    itemCount: number,
): targetSlotIndices is number[] => {
    if (!targetSlotIndices || targetSlotIndices.length !== itemCount) {
        return false;
    }

    const uniqueIndices = new Set(targetSlotIndices);
    if (uniqueIndices.size !== itemCount) {
        return false;
    }

    return targetSlotIndices.every((value) => Number.isInteger(value) && value >= 0 && value < itemCount);
};

export const resolveRegroupTargetSlotIndices = (
    regroupStartPositions: Array<{ x: number; y: number } | undefined> | undefined,
    columns: number,
    itemCount: number,
    targetSlotIndices?: number[],
): number[] => {
    if (isValidTargetSlotIndices(targetSlotIndices, itemCount)) {
        return [...targetSlotIndices];
    }

    const slotIndexByItem = buildRegroupTargetSlotIndexByItem(
        regroupStartPositions,
        columns,
        itemCount,
    );

    return Array.from({ length: itemCount }, (_, index) => slotIndexByItem.get(index) ?? index);
};

const resolveAspectRatioValue = (item: GeneratedImageLayoutItem, fallbackWidth: number, fallbackHeight: number) => {
    const exactWidth = item.exactDimensions?.width;
    const exactHeight = item.exactDimensions?.height;

    if (exactWidth && exactHeight && exactWidth > 0 && exactHeight > 0) {
        return exactWidth / exactHeight;
    }

    const ratioText = item.aspectRatio;
    if (ratioText && ratioText !== ASPECT_RATIO_AUTO) {
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

const buildCenteredLayoutPositions = (
    metrics: ResolvedLayoutMetric[],
    {
        basePosition,
        columns,
        topGap,
        horizontalGap,
        verticalGap,
        widthCap,
    }: {
        basePosition: { x: number; y: number };
        columns: number;
        topGap: number;
        horizontalGap: number;
        verticalGap: number;
        widthCap?: number;
    }
) => {
    const safeColumns = Math.max(1, columns);
    const positions: Array<{ x: number; y: number; row: number; column: number }> = new Array(metrics.length);
    let currentTop = basePosition.y + topGap;

    for (let rowStart = 0; rowStart < metrics.length; rowStart += safeColumns) {
        const rowMetrics = metrics.slice(rowStart, rowStart + safeColumns);
        const rowWidths = rowMetrics.map((metric) => (
            typeof widthCap === 'number' ? Math.min(metric.width, widthCap) : metric.width
        ));
        const rowWidth = rowWidths.reduce((sum, width) => sum + width, 0) + ((rowMetrics.length - 1) * horizontalGap);
        const rowHeight = Math.max(...rowMetrics.map((metric) => metric.height));
        let currentLeft = basePosition.x - (rowWidth / 2);

        rowMetrics.forEach((metric, indexInRow) => {
            const effectiveWidth = rowWidths[indexInRow] ?? metric.width;
            positions[rowStart + indexInRow] = {
                x: currentLeft + (effectiveWidth / 2),
                y: currentTop + metric.height,
                row: Math.floor(rowStart / safeColumns),
                column: indexInRow,
            };
            currentLeft += effectiveWidth + horizontalGap;
        });

        currentTop += rowHeight + verticalGap;
    }

    return positions;
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

    if (mode === GENERATION_MODE_PPT) {
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

export const buildDockedPromptChildRegroupLayout = ({
    basePosition,
    items,
    mode,
    isMobile = false,
    gapToPrompt = 56,
    dockGapToPrompt = 56,
    settledGap = 32,
    dockedGap = 24,
    columns,
    regroupStartPositions,
    fastRegroupProgress,
    settleRegroupProgress,
    targetSlotIndices,
}: BuildDockedPromptChildRegroupLayoutOptions): DockedPromptChildRegroupLayoutItem[] => {
    if (!items.length) return [];

    const metrics = items.map(resolveGeneratedImageCardMetrics);
    const defaultColumns = mode === GENERATION_MODE_PPT || isMobile
        ? 1
        : items.length;
    const resolvedColumns = Math.min(items.length, Math.max(1, columns ?? defaultColumns));
    const resolvedFastProgress = clampUnitProgress(
        fastRegroupProgress,
        regroupStartPositions?.some(Boolean) ? 1 : 1
    );
    const resolvedSettleProgress = clampUnitProgress(settleRegroupProgress, 1);
    const resolvedTargetSlotIndices = resolveRegroupTargetSlotIndices(
        regroupStartPositions,
        resolvedColumns,
        metrics.length,
        targetSlotIndices,
    );

    const dockedPositions = buildCenteredLayoutPositions(metrics, {
        basePosition,
        columns: resolvedColumns,
        topGap: dockGapToPrompt,
        horizontalGap: dockedGap,
        verticalGap: dockedGap,
    });

    const settledPositions = buildCenteredLayoutPositions(metrics, {
        basePosition,
        columns: resolvedColumns,
        topGap: gapToPrompt,
        horizontalGap: settledGap,
        verticalGap: settledGap,
    });
    const regroupTravelDistances = metrics.map((_, index) => {
        const targetSlotIndex = resolvedTargetSlotIndices[index] ?? index;
        const dockedPosition = dockedPositions[targetSlotIndex];

        if (!dockedPosition) {
            throw new Error(`Missing docked regroup position for child index ${index}.`);
        }

        const startPosition = regroupStartPositions?.[index] ?? dockedPosition;
        return measurePointDistance(startPosition, dockedPosition);
    });
    const minRegroupTravelDistance = regroupTravelDistances.length
        ? Math.min(...regroupTravelDistances)
        : 0;
    const maxRegroupTravelDistance = regroupTravelDistances.length
        ? Math.max(...regroupTravelDistances)
        : 0;

    return metrics.map((metric, index) => {
        const targetSlotIndex = resolvedTargetSlotIndices[index] ?? index;
        const dockedPosition = dockedPositions[targetSlotIndex];
        const settledPosition = settledPositions[targetSlotIndex];

        if (!dockedPosition || !settledPosition) {
            throw new Error(`Missing regroup layout position for child index ${index}.`);
        }

        const startPosition = regroupStartPositions?.[index] ?? dockedPosition;
        const layeredFastProgress = resolveLayeredRegroupProgress(
            resolvedFastProgress,
            regroupTravelDistances[index] ?? 0,
            minRegroupTravelDistance,
            maxRegroupTravelDistance,
        );
        const afterFastDock = lerpPoint(startPosition, dockedPosition, layeredFastProgress);
        const currentPosition = lerpPoint(afterFastDock, settledPosition, resolvedSettleProgress);

        return {
            index,
            row: settledPosition.row,
            column: settledPosition.column,
            width: metric.width,
            height: metric.height,
            dockedPosition: {
                x: dockedPosition.x,
                y: dockedPosition.y,
            },
            settledPosition: {
                x: settledPosition.x,
                y: settledPosition.y,
            },
            position: currentPosition,
        };
    });
};
