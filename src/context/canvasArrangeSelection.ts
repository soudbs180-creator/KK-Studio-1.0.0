import type { Canvas } from '../types.ts';
import { GenerationMode, type AspectRatio } from '../types.ts';
import { getCardDimensions } from '../utils/styleUtils.ts';

export type CanvasSubCardLayout = 'row' | 'grid' | 'column';

export type ArrangeSinglePromptChildrenResult = {
    canvas: Canvas;
    subCardLayoutMode: CanvasSubCardLayout;
};

export type ArrangeSinglePromptChildrenOptions = {
    now?: () => number;
};

const AUTO_ARRANGE_SUB_COLUMNS = 20;
const AUTO_ARRANGE_SUB_IMAGE_GAP = 32;
const AUTO_ARRANGE_PROMPT_TO_SUB_GAP = 56;

const getImageDims = (aspectRatio?: string) => {
    const { width, totalHeight } = getCardDimensions(aspectRatio as AspectRatio, true);
    return { w: width, h: totalHeight };
};

export function arrangeSingleSelectedPromptChildren(
    canvas: Canvas,
    selectedIds: string[],
    mode: CanvasSubCardLayout,
    options: ArrangeSinglePromptChildrenOptions = {}
): ArrangeSinglePromptChildrenResult | null {
    if (selectedIds.length === 0) {
        return null;
    }

    const selectedPrompts = canvas.promptNodes.filter(prompt => selectedIds.includes(prompt.id));
    const selectedImages = canvas.imageNodes.filter(image => selectedIds.includes(image.id));
    const isPromptOnly = selectedPrompts.length > 0 && selectedImages.length === 0;
    if (!isPromptOnly || selectedPrompts.length !== 1) {
        return null;
    }

    const prompt = selectedPrompts[0];
    const childImages = canvas.imageNodes.filter(image => image.parentPromptId === prompt.id);
    if (childImages.length === 0) {
        return null;
    }

    const targetMode: CanvasSubCardLayout = prompt.mode === GenerationMode.PPT ? 'column' : mode;
    const imageDims = childImages.map(image => getImageDims(image.aspectRatio));
    const avgWidth = imageDims.reduce((sum, dims) => sum + dims.w, 0) / imageDims.length;
    const avgHeight = imageDims.reduce((sum, dims) => sum + dims.h, 0) / imageDims.length;
    const newImagePositions: Record<string, { x: number; y: number }> = {};
    const promptCenterX = prompt.position.x;
    const promptBottom = prompt.position.y;

    if (targetMode === 'row') {
        const totalWidth = childImages.length * avgWidth + (childImages.length - 1) * AUTO_ARRANGE_SUB_IMAGE_GAP;
        let currentX = promptCenterX - totalWidth / 2 + avgWidth / 2;
        const y = promptBottom + AUTO_ARRANGE_PROMPT_TO_SUB_GAP + avgHeight;

        childImages.forEach((image, index) => {
            const dims = imageDims[index];
            newImagePositions[image.id] = { x: currentX, y };
            currentX += dims.w + AUTO_ARRANGE_SUB_IMAGE_GAP;
        });
    } else if (targetMode === 'grid') {
        const columns = Math.min(AUTO_ARRANGE_SUB_COLUMNS, childImages.length);
        const totalWidth = columns * avgWidth + (columns - 1) * AUTO_ARRANGE_SUB_IMAGE_GAP;
        const startX = promptCenterX - totalWidth / 2 + avgWidth / 2;
        const startY = promptBottom + AUTO_ARRANGE_PROMPT_TO_SUB_GAP + avgHeight;

        childImages.forEach((image, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            newImagePositions[image.id] = {
                x: startX + col * (avgWidth + AUTO_ARRANGE_SUB_IMAGE_GAP),
                y: startY + row * (avgHeight + AUTO_ARRANGE_SUB_IMAGE_GAP),
            };
        });
    } else {
        let currentY = promptBottom + AUTO_ARRANGE_PROMPT_TO_SUB_GAP + avgHeight;

        childImages.forEach((image, index) => {
            const dims = imageDims[index];
            newImagePositions[image.id] = { x: promptCenterX, y: currentY };
            currentY += dims.h + AUTO_ARRANGE_SUB_IMAGE_GAP;
        });
    }

    return {
        canvas: {
            ...canvas,
            imageNodes: canvas.imageNodes.map(image =>
                newImagePositions[image.id]
                    ? { ...image, position: newImagePositions[image.id] }
                    : image
            ),
            lastModified: (options.now ?? Date.now)(),
        },
        subCardLayoutMode: targetMode,
    };
}
