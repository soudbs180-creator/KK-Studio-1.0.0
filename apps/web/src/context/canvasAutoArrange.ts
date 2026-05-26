import type { Canvas, GeneratedImage, PromptNode } from '../types/index.ts';
import { type AspectRatio } from '../types/index.ts';
import { getCardDimensions } from '../utils/styleUtils.ts';

export type CanvasAutoArrangePositions = Record<string, { x: number; y: number }>;

type LayoutGroupType = 'normal' | 'orphan-prompt' | 'orphan-image' | 'error';

type LayoutGroup = {
    type: LayoutGroupType;
    prompt?: PromptNode;
    images: GeneratedImage[];
    width: number;
    height: number;
    sourcePromptId?: string;
    layoutHeight?: number;
};

const PROMPT_WIDTH = 320;
const ECOMMERCE_FRAMEWORK_PROMPT_WIDTH = 920;
const GROUPS_PER_ROW = 20;
const SUB_COLUMNS = 20;
const GROUP_GAP_X = 56;
const GROUP_GAP_Y = 120;
const SUB_IMAGE_GAP = 32;
const PROMPT_TO_SUB_GAP = 56;
const START_X = -2000;
const START_Y = 200;

const getImageDims = (aspectRatio?: string) => {
    const { width, totalHeight } = getCardDimensions(aspectRatio as AspectRatio, true);
    return { w: width, h: totalHeight };
};

const getPromptWidth = (prompt?: PromptNode): number => (
    prompt?.mode === 'ecommerce' && prompt.ecommerce?.kind === 'framework'
        ? ECOMMERCE_FRAMEWORK_PROMPT_WIDTH
        : PROMPT_WIDTH
);

const getEcommerceFrameworkSortKey = (group: LayoutGroup): {
    frameworkId: string;
    rank: number;
} | null => {
    const ecommerce = group.prompt?.ecommerce;
    if (!group.prompt || !ecommerce) {
        return null;
    }

    if (ecommerce.kind === 'framework') {
        return { frameworkId: group.prompt.id, rank: 2 };
    }

    if (!ecommerce.frameworkId) {
        return null;
    }

    const sheetRank = ecommerce.sourceSheet === 'A+' ? 1 : 0;
    return { frameworkId: ecommerce.frameworkId, rank: sheetRank };
};

const compareRootLayoutGroups = (
    a: LayoutGroup,
    b: LayoutGroup,
    rootOrder: Map<LayoutGroup, number>,
    frameworkFirstOrder: Map<string, number>,
): number => {
    const leftOrder = rootOrder.get(a) ?? 0;
    const rightOrder = rootOrder.get(b) ?? 0;
    const leftKey = getEcommerceFrameworkSortKey(a);
    const rightKey = getEcommerceFrameworkSortKey(b);
    const leftBucketOrder = leftKey ? (frameworkFirstOrder.get(leftKey.frameworkId) ?? leftOrder) : leftOrder;
    const rightBucketOrder = rightKey ? (frameworkFirstOrder.get(rightKey.frameworkId) ?? rightOrder) : rightOrder;
    const bucketDiff = leftBucketOrder - rightBucketOrder;

    if (bucketDiff !== 0) {
        return bucketDiff;
    }

    if (leftKey && rightKey) {
        const frameworkDiff = leftKey.frameworkId.localeCompare(rightKey.frameworkId);
        if (frameworkDiff !== 0) {
            return frameworkDiff;
        }

        const rankDiff = leftKey.rank - rightKey.rank;
        if (rankDiff !== 0) {
            return rankDiff;
        }
    }

    return leftOrder - rightOrder;
};

export function resolveCanvasAutoArrangePositions(canvas: Canvas): CanvasAutoArrangePositions {
    const errorPrompts = canvas.promptNodes.filter(prompt => prompt.error);
    const errorPromptIds = new Set(errorPrompts.map(prompt => prompt.id));

    const normalPrompts = canvas.promptNodes.filter(prompt =>
        !errorPromptIds.has(prompt.id) &&
        canvas.imageNodes.some(image => image.parentPromptId === prompt.id)
    );

    const orphanPrompts = canvas.promptNodes.filter(prompt =>
        !errorPromptIds.has(prompt.id) &&
        !canvas.imageNodes.some(image => image.parentPromptId === prompt.id)
    );

    const orphanImages = canvas.imageNodes.filter(image =>
        !image.parentPromptId ||
        !canvas.promptNodes.some(prompt => prompt.id === image.parentPromptId)
    );

    const layoutGroups: LayoutGroup[] = [];
    const promptById = new Map(canvas.promptNodes.map(prompt => [prompt.id, prompt]));
    const imageById = new Map(canvas.imageNodes.map(image => [image.id, image]));

    normalPrompts.forEach(prompt => {
        const childImages = canvas.imageNodes.filter(image => image.parentPromptId === prompt.id);
        const promptHeight = prompt.height || 200;
        const sourceImage = prompt.sourceImageId ? imageById.get(prompt.sourceImageId) : undefined;
        const sourcePromptId = sourceImage?.parentPromptId && promptById.has(sourceImage.parentPromptId)
            ? sourceImage.parentPromptId
            : undefined;

        let maxSubWidth = 0;
        let maxSubHeight = 0;
        childImages.forEach(image => {
            const dims = getImageDims(image.aspectRatio);
            maxSubWidth = Math.max(maxSubWidth, dims.w);
            maxSubHeight = Math.max(maxSubHeight, dims.h);
        });

        const actualColumns = Math.min(SUB_COLUMNS, childImages.length);
        const rows = Math.ceil(childImages.length / SUB_COLUMNS);
        const subBlockWidth = actualColumns > 0
            ? actualColumns * maxSubWidth + (actualColumns - 1) * SUB_IMAGE_GAP
            : 0;
        const subBlockHeight = rows > 0
            ? rows * maxSubHeight + (rows - 1) * SUB_IMAGE_GAP
            : 0;

        const groupWidth = Math.max(getPromptWidth(prompt), subBlockWidth);
        const groupHeight = promptHeight + (childImages.length > 0 ? PROMPT_TO_SUB_GAP + subBlockHeight : 0);

        layoutGroups.push({
            type: 'normal',
            prompt,
            images: childImages,
            width: groupWidth,
            height: groupHeight,
            sourcePromptId,
        });
    });

    orphanPrompts.forEach(prompt => {
        const sourceImage = prompt.sourceImageId ? imageById.get(prompt.sourceImageId) : undefined;
        const sourcePromptId = sourceImage?.parentPromptId && promptById.has(sourceImage.parentPromptId)
            ? sourceImage.parentPromptId
            : undefined;
        layoutGroups.push({
            type: 'orphan-prompt',
            prompt,
            images: [],
            width: getPromptWidth(prompt),
            height: prompt.height || 200,
            sourcePromptId,
        });
    });

    orphanImages.forEach(image => {
        const dims = getImageDims(image.aspectRatio);
        layoutGroups.push({
            type: 'orphan-image',
            images: [image],
            width: dims.w,
            height: dims.h,
        });
    });

    const followUpGroups = layoutGroups.filter(group => !!group.sourcePromptId && group.prompt);
    const rootLayoutGroups = layoutGroups.filter(group => !group.sourcePromptId);
    const rootOrder = new Map(rootLayoutGroups.map((group, index) => [group, index] as const));
    const frameworkFirstOrder = new Map<string, number>();
    rootLayoutGroups.forEach((group) => {
        const key = getEcommerceFrameworkSortKey(group);
        if (!key) return;
        const order = rootOrder.get(group) ?? 0;
        const previous = frameworkFirstOrder.get(key.frameworkId);
        if (previous === undefined || order < previous) {
            frameworkFirstOrder.set(key.frameworkId, order);
        }
    });
    rootLayoutGroups.sort((a, b) => compareRootLayoutGroups(a, b, rootOrder, frameworkFirstOrder));
    const followUpChildrenMap = new Map<string, LayoutGroup[]>();
    followUpGroups.forEach(group => {
        const sourcePromptId = group.sourcePromptId!;
        const existing = followUpChildrenMap.get(sourcePromptId) || [];
        existing.push(group);
        followUpChildrenMap.set(sourcePromptId, existing);
    });
    followUpChildrenMap.forEach(groups => {
        groups.sort((a, b) => (a.prompt?.timestamp || 0) - (b.prompt?.timestamp || 0));
    });

    const computeLayoutHeight = (group: LayoutGroup, stack = new Set<string>()): number => {
        const promptId = group.prompt?.id;
        if (!promptId || stack.has(promptId)) return group.height;
        const nextStack = new Set(stack);
        nextStack.add(promptId);
        const children = followUpChildrenMap.get(promptId) || [];
        return children.length === 0
            ? group.height
            : Math.max(group.height, ...children.map(child => computeLayoutHeight(child, nextStack)));
    };

    rootLayoutGroups.forEach(group => {
        group.layoutHeight = computeLayoutHeight(group);
    });

    const rows: Array<{
        groups: LayoutGroup[];
        maxPromptHeight: number;
        maxTotalHeight: number;
        startX: number;
    }> = [];
    let currentRow: typeof rows[0] = { groups: [], maxPromptHeight: 0, maxTotalHeight: 0, startX: START_X };

    rootLayoutGroups.forEach(group => {
        if (currentRow.groups.length >= GROUPS_PER_ROW) {
            rows.push(currentRow);
            currentRow = { groups: [], maxPromptHeight: 0, maxTotalHeight: 0, startX: START_X };
        }

        currentRow.groups.push(group);
        const promptHeight = group.prompt?.height || 200;
        currentRow.maxPromptHeight = Math.max(currentRow.maxPromptHeight, promptHeight);
        currentRow.maxTotalHeight = Math.max(currentRow.maxTotalHeight, group.layoutHeight || group.height);
    });

    if (currentRow.groups.length > 0) {
        rows.push(currentRow);
    }

    const positions: CanvasAutoArrangePositions = {};
    const placedBounds = new Map<string, { left: number; top: number; right: number; bottom: number; width: number; height: number }>();
    const followUpRightEdge = new Map<string, number>();
    let currentY = START_Y;

    const placeGroup = (group: LayoutGroup, left: number, top: number) => {
        const groupCenterX = left + group.width / 2;
        const promptHeight = group.prompt?.height || 200;
        const subCardsStartY = top + promptHeight + PROMPT_TO_SUB_GAP;

        if (group.type === 'normal' && group.prompt) {
            positions[group.prompt.id] = {
                x: groupCenterX,
                y: top + promptHeight,
            };

            if (group.images.length > 0) {
                const imageDims = group.images.map(image => getImageDims(image.aspectRatio));
                const maxWidth = Math.max(...imageDims.map(dim => dim.w));
                const maxHeight = Math.max(...imageDims.map(dim => dim.h));
                const actualColumns = Math.min(SUB_COLUMNS, group.images.length);
                const blockWidth = actualColumns * maxWidth + (actualColumns - 1) * SUB_IMAGE_GAP;
                const blockStartX = groupCenterX - blockWidth / 2;

                group.images.forEach((image, index) => {
                    const col = index % SUB_COLUMNS;
                    const row = Math.floor(index / SUB_COLUMNS);
                    const cardCenterX = blockStartX + col * (maxWidth + SUB_IMAGE_GAP) + maxWidth / 2;
                    const cardTopY = subCardsStartY + row * (maxHeight + SUB_IMAGE_GAP);
                    const dims = imageDims[index];
                    positions[image.id] = {
                        x: cardCenterX,
                        y: cardTopY + dims.h,
                    };
                });
            }
        } else if (group.type === 'orphan-prompt' && group.prompt) {
            positions[group.prompt.id] = {
                x: groupCenterX,
                y: top + promptHeight,
            };
        } else if (group.type === 'orphan-image' && group.images[0]) {
            const image = group.images[0];
            const dims = getImageDims(image.aspectRatio);
            positions[image.id] = {
                x: groupCenterX,
                y: subCardsStartY + dims.h,
            };
        }

        if (group.prompt?.id) {
            placedBounds.set(group.prompt.id, {
                left,
                top,
                right: left + group.width,
                bottom: top + group.height,
                width: group.width,
                height: group.height,
            });
        }
    };

    rows.forEach(row => {
        let rowX = START_X;

        row.groups.forEach(group => {
            placeGroup(group, rowX, currentY);
            rowX += group.width + GROUP_GAP_X;
        });

        currentY += row.maxTotalHeight + GROUP_GAP_Y;
    });

    const pendingFollowUps = [...followUpGroups];
    let guard = 0;

    while (pendingFollowUps.length > 0 && guard < 1000) {
        guard += 1;
        let placedInLoop = 0;

        for (let index = 0; index < pendingFollowUps.length; index += 1) {
            const group = pendingFollowUps[index];
            const sourcePromptId = group.sourcePromptId;

            if (!sourcePromptId) {
                continue;
            }

            const anchorBounds = placedBounds.get(sourcePromptId);
            if (!anchorBounds) {
                continue;
            }

            const left = followUpRightEdge.get(sourcePromptId) ?? (anchorBounds.right + GROUP_GAP_X);
            placeGroup(group, left, anchorBounds.top);

            if (group.prompt?.id) {
                const placed = placedBounds.get(group.prompt.id);
                if (placed) {
                    followUpRightEdge.set(sourcePromptId, placed.right + GROUP_GAP_X);
                }
            }

            pendingFollowUps.splice(index, 1);
            index -= 1;
            placedInLoop += 1;
        }

        if (placedInLoop === 0) {
            pendingFollowUps.forEach(group => {
                placeGroup(group, START_X, currentY);
                currentY += (group.layoutHeight || group.height) + GROUP_GAP_Y;
            });
            pendingFollowUps.length = 0;
        }
    }

    if (errorPrompts.length > 0) {
        let errorX = START_X;
        let errorRowMaxHeight = 0;
        let errorGroupsInRow = 0;
        currentY += GROUP_GAP_Y + 50;
        const errorGapX = 40;

        errorPrompts.forEach(prompt => {
            const promptHeight = prompt.height || 200;
            const childImages = canvas.imageNodes.filter(image => image.parentPromptId === prompt.id);
            let groupWidth = PROMPT_WIDTH;
            let groupHeight = promptHeight;

            if (childImages.length > 0) {
                let maxSubWidth = 0;
                let maxSubHeight = 0;
                childImages.forEach(image => {
                    const dims = getImageDims(image.aspectRatio);
                    maxSubWidth = Math.max(maxSubWidth, dims.w);
                    maxSubHeight = Math.max(maxSubHeight, dims.h);
                });
                const actualColumns = Math.min(SUB_COLUMNS, childImages.length);
                const rows = Math.ceil(childImages.length / SUB_COLUMNS);
                const subBlockWidth = actualColumns * maxSubWidth + (actualColumns - 1) * SUB_IMAGE_GAP;
                const subBlockHeight = rows * maxSubHeight + (rows - 1) * SUB_IMAGE_GAP;
                groupWidth = Math.max(PROMPT_WIDTH, subBlockWidth);
                groupHeight = promptHeight + PROMPT_TO_SUB_GAP + subBlockHeight;
            }

            if (errorGroupsInRow >= GROUPS_PER_ROW) {
                errorX = START_X;
                currentY += errorRowMaxHeight + GROUP_GAP_Y;
                errorRowMaxHeight = 0;
                errorGroupsInRow = 0;
            }

            const groupCenterX = errorX + groupWidth / 2;
            positions[prompt.id] = {
                x: groupCenterX,
                y: currentY + promptHeight,
            };

            if (childImages.length > 0) {
                const promptBottom = currentY + promptHeight + PROMPT_TO_SUB_GAP;
                const imageDims = childImages.map(image => getImageDims(image.aspectRatio));
                const maxWidth = Math.max(...imageDims.map(dim => dim.w));
                const maxHeight = Math.max(...imageDims.map(dim => dim.h));
                const actualColumns = Math.min(SUB_COLUMNS, childImages.length);
                const blockWidth = actualColumns * maxWidth + (actualColumns - 1) * SUB_IMAGE_GAP;
                const blockStartX = groupCenterX - blockWidth / 2;

                childImages.forEach((image, index) => {
                    const col = index % SUB_COLUMNS;
                    const row = Math.floor(index / SUB_COLUMNS);
                    const cardCenterX = blockStartX + col * (maxWidth + SUB_IMAGE_GAP) + maxWidth / 2;
                    const cardTopY = promptBottom + row * (maxHeight + SUB_IMAGE_GAP);
                    const dims = imageDims[index];
                    positions[image.id] = {
                        x: cardCenterX,
                        y: cardTopY + dims.h,
                    };
                });
            }

            errorX += groupWidth + errorGapX;
            errorRowMaxHeight = Math.max(errorRowMaxHeight, groupHeight);
            errorGroupsInRow += 1;
        });
    }

    return positions;
}
