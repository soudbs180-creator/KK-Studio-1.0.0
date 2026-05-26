import type { Canvas, GeneratedImage, PromptNode } from '../types';
import { GenerationMode, type AspectRatio } from '../types';
import { getCardDimensions } from '../utils/styleUtils.ts';

export type CanvasSubCardLayout = 'row' | 'grid' | 'column';

export type ArrangeSinglePromptChildrenResult = {
    canvas: Canvas;
    subCardLayoutMode: CanvasSubCardLayout;
};

export type ArrangeSelectedRootNodesResult = {
    canvas: Canvas;
};

export type ArrangeSelectedGroupedNodesResult = {
    canvas: Canvas;
    subCardLayoutMode: CanvasSubCardLayout;
};

export type ArrangeSinglePromptChildrenOptions = {
    now?: () => number;
};

export type ArrangeSelectedRootNodesOptions = {
    now?: () => number;
};

export type ArrangeSelectedGroupedNodesOptions = {
    now?: () => number;
};

type ArrangeRootSeed =
    | { id: string; type: 'prompt'; obj: PromptNode }
    | { id: string; type: 'image'; obj: GeneratedImage };

type ArrangeRoot = ArrangeRootSeed & {
    x: number;
    y: number;
    width: number;
    height: number;
    visualCx: number;
    visualCy: number;
};

type SelectedGroup = {
    prompt?: PromptNode;
    images: GeneratedImage[];
    originalX: number;
    originalY: number;
};

type SelectedImagePlacement = {
    id: string;
    xOffset: number;
    bottomOffset: number;
};

type SelectedGroupLayout = {
    promptHeight: number;
    width: number;
    height: number;
    imageLayoutHeight: number;
    imagePlacements: SelectedImagePlacement[];
};

type PositionedSelectedGroup = SelectedGroup & { layout: SelectedGroupLayout };

const PROMPT_WIDTH = 320;
const SELECTED_ROOT_GAP = 120;
const SELECTED_ROOT_GRID_COLUMNS = 6;
const AUTO_ARRANGE_GROUPS_PER_ROW = 20;
const AUTO_ARRANGE_GROUP_GAP_X = 56;
const AUTO_ARRANGE_GROUP_GAP_Y = 120;
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

function buildSelectionImageLayout(
    images: GeneratedImage[],
    layoutMode: CanvasSubCardLayout
): { width: number; height: number; placements: SelectedImagePlacement[] } {
    if (images.length === 0) {
        return { width: 0, height: 0, placements: [] };
    }

    const imageDims = images.map(image => getImageDims(image.aspectRatio));

    if (layoutMode === 'column') {
        const maxWidth = Math.max(...imageDims.map(dim => dim.w));
        const totalHeight = imageDims.reduce((sum, dim) => sum + dim.h, 0) + (imageDims.length - 1) * AUTO_ARRANGE_SUB_IMAGE_GAP;
        let currentTop = 0;
        const placements = images.map((image, index) => {
            const dims = imageDims[index];
            const placement = {
                id: image.id,
                xOffset: 0,
                bottomOffset: currentTop + dims.h,
            };
            currentTop += dims.h + AUTO_ARRANGE_SUB_IMAGE_GAP;
            return placement;
        });
        return { width: maxWidth, height: totalHeight, placements };
    }

    if (layoutMode === 'row') {
        const totalWidth = imageDims.reduce((sum, dim) => sum + dim.w, 0) + (imageDims.length - 1) * AUTO_ARRANGE_SUB_IMAGE_GAP;
        const maxHeight = Math.max(...imageDims.map(dim => dim.h));
        let currentLeft = -totalWidth / 2;
        const placements = images.map((image, index) => {
            const dims = imageDims[index];
            const placement = {
                id: image.id,
                xOffset: currentLeft + dims.w / 2,
                bottomOffset: dims.h,
            };
            currentLeft += dims.w + AUTO_ARRANGE_SUB_IMAGE_GAP;
            return placement;
        });
        return { width: totalWidth, height: maxHeight, placements };
    }

    const maxWidth = Math.max(...imageDims.map(dim => dim.w));
    const maxHeight = Math.max(...imageDims.map(dim => dim.h));
    const columns = Math.min(AUTO_ARRANGE_SUB_COLUMNS, imageDims.length);
    const totalWidth = columns * maxWidth + (columns - 1) * AUTO_ARRANGE_SUB_IMAGE_GAP;
    const totalHeight = Math.ceil(imageDims.length / columns) * maxHeight + (Math.ceil(imageDims.length / columns) - 1) * AUTO_ARRANGE_SUB_IMAGE_GAP;
    const startOffsetX = -totalWidth / 2;
    const placements = images.map((image, index) => {
        const dims = imageDims[index];
        const col = index % columns;
        const row = Math.floor(index / columns);
        return {
            id: image.id,
            xOffset: startOffsetX + col * (maxWidth + AUTO_ARRANGE_SUB_IMAGE_GAP) + maxWidth / 2,
            bottomOffset: row * (maxHeight + AUTO_ARRANGE_SUB_IMAGE_GAP) + dims.h,
        };
    });

    return { width: totalWidth, height: totalHeight, placements };
}

export function arrangeSelectedGroupedNodes(
    canvas: Canvas,
    selectedIds: string[],
    mode: CanvasSubCardLayout,
    options: ArrangeSelectedGroupedNodesOptions = {}
): ArrangeSelectedGroupedNodesResult | null {
    if (selectedIds.length === 0) {
        return null;
    }

    const selectedPrompts = canvas.promptNodes.filter(prompt => selectedIds.includes(prompt.id));
    const selectedImages = canvas.imageNodes.filter(image => selectedIds.includes(image.id));
    const selectedCount = selectedPrompts.length + selectedImages.length;
    if (selectedCount <= 1) {
        return null;
    }

    const selectedGroupsForArrange: SelectedGroup[] = [];
    const groupedImageIds = new Set<string>();

    selectedPrompts.forEach(prompt => {
        const childImages = canvas.imageNodes.filter(image => image.parentPromptId === prompt.id);
        childImages.forEach(image => groupedImageIds.add(image.id));
        selectedGroupsForArrange.push({
            prompt,
            images: childImages,
            originalX: prompt.position.x,
            originalY: prompt.position.y,
        });
    });

    selectedImages
        .filter(image => !groupedImageIds.has(image.id))
        .forEach(image => {
            selectedGroupsForArrange.push({
                images: [image],
                originalX: image.position.x,
                originalY: image.position.y,
            });
        });

    if (selectedGroupsForArrange.length === 0) {
        return null;
    }

    selectedGroupsForArrange.sort((a, b) => {
        const rowDiff = Math.floor(a.originalY / 200) - Math.floor(b.originalY / 200);
        if (rowDiff !== 0) return rowDiff;
        return a.originalX - b.originalX;
    });

    const selectionCenterX = selectedGroupsForArrange.reduce((sum, group) => sum + group.originalX, 0) / selectedGroupsForArrange.length;
    const selectionCenterY = selectedGroupsForArrange.reduce((sum, group) => sum + group.originalY, 0) / selectedGroupsForArrange.length;

    const positionedSelectionGroups: PositionedSelectedGroup[] = selectedGroupsForArrange.map(group => {
        const layoutMode: CanvasSubCardLayout = group.prompt?.mode === GenerationMode.PPT ? 'column' : mode;
        const imageLayout = buildSelectionImageLayout(group.images, layoutMode);
        const promptHeight = group.prompt?.height || 0;
        const width = group.prompt ? Math.max(PROMPT_WIDTH, imageLayout.width) : imageLayout.width;
        const height = group.prompt
            ? promptHeight + (imageLayout.height > 0 ? AUTO_ARRANGE_PROMPT_TO_SUB_GAP + imageLayout.height : 0)
            : imageLayout.height;

        return {
            ...group,
            layout: {
                promptHeight,
                width,
                height,
                imageLayoutHeight: imageLayout.height,
                imagePlacements: imageLayout.placements,
            },
        };
    });

    const selectionStrategy: 'matrix' | 'row' | 'column' = mode === 'grid' ? 'matrix' : mode;
    const selectionRows: Array<{ groups: PositionedSelectedGroup[]; maxPromptHeight: number; maxTotalHeight: number; rowWidth: number }> = [];
    const createSelectionRow = () => ({ groups: [] as PositionedSelectedGroup[], maxPromptHeight: 0, maxTotalHeight: 0, rowWidth: 0 });
    const pushGroupIntoRow = (
        row: { groups: PositionedSelectedGroup[]; maxPromptHeight: number; maxTotalHeight: number; rowWidth: number },
        group: PositionedSelectedGroup
    ) => {
        row.rowWidth += (row.groups.length > 0 ? AUTO_ARRANGE_GROUP_GAP_X : 0) + group.layout.width;
        row.groups.push(group);
        row.maxPromptHeight = Math.max(row.maxPromptHeight, group.layout.promptHeight);
        row.maxTotalHeight = Math.max(
            row.maxTotalHeight,
            group.prompt
                ? row.maxPromptHeight + (group.layout.imageLayoutHeight > 0 ? AUTO_ARRANGE_PROMPT_TO_SUB_GAP + group.layout.imageLayoutHeight : 0)
                : group.layout.height
        );
    };

    if (selectionStrategy === 'row') {
        const row = createSelectionRow();
        positionedSelectionGroups.forEach(group => pushGroupIntoRow(row, group));
        if (row.groups.length > 0) selectionRows.push(row);
    } else if (selectionStrategy === 'column') {
        positionedSelectionGroups.forEach(group => {
            const row = createSelectionRow();
            pushGroupIntoRow(row, group);
            selectionRows.push(row);
        });
    } else {
        const gridColumns = Math.min(AUTO_ARRANGE_GROUPS_PER_ROW, Math.max(1, positionedSelectionGroups.length));
        let currentSelectionRow = createSelectionRow();
        positionedSelectionGroups.forEach(group => {
            if (currentSelectionRow.groups.length >= gridColumns) {
                selectionRows.push(currentSelectionRow);
                currentSelectionRow = createSelectionRow();
            }
            pushGroupIntoRow(currentSelectionRow, group);
        });
        if (currentSelectionRow.groups.length > 0) selectionRows.push(currentSelectionRow);
    }

    const totalSelectionHeight = selectionRows.reduce((sum, row) => sum + row.maxTotalHeight, 0) + (selectionRows.length - 1) * AUTO_ARRANGE_GROUP_GAP_Y;
    let currentTopY = selectionCenterY - totalSelectionHeight / 2;
    const arrangedPositions: Record<string, { x: number; y: number }> = {};

    selectionRows.forEach(row => {
        let currentLeftX = selectionCenterX - row.rowWidth / 2;
        const rowTopY = currentTopY;
        const rowSubCardsTopY = rowTopY + row.maxPromptHeight + AUTO_ARRANGE_PROMPT_TO_SUB_GAP;

        row.groups.forEach(group => {
            const groupCenterX = currentLeftX + group.layout.width / 2;

            if (group.prompt) {
                arrangedPositions[group.prompt.id] = {
                    x: groupCenterX,
                    y: rowTopY + group.layout.promptHeight,
                };
            }

            const imageTopY = group.prompt ? rowSubCardsTopY : rowTopY;
            group.layout.imagePlacements.forEach(placement => {
                arrangedPositions[placement.id] = {
                    x: groupCenterX + placement.xOffset,
                    y: imageTopY + placement.bottomOffset,
                };
            });

            currentLeftX += group.layout.width + AUTO_ARRANGE_GROUP_GAP_X;
        });

        currentTopY += row.maxTotalHeight + AUTO_ARRANGE_GROUP_GAP_Y;
    });

    return {
        canvas: {
            ...canvas,
            promptNodes: canvas.promptNodes.map(prompt =>
                arrangedPositions[prompt.id] ? { ...prompt, position: arrangedPositions[prompt.id] } : prompt
            ),
            imageNodes: canvas.imageNodes.map(image =>
                arrangedPositions[image.id] ? { ...image, position: arrangedPositions[image.id] } : image
            ),
            lastModified: (options.now ?? Date.now)(),
        },
        subCardLayoutMode: mode,
    };
}

export function arrangeSelectedRootNodes(
    canvas: Canvas,
    selectedIds: string[],
    mode: CanvasSubCardLayout,
    options: ArrangeSelectedRootNodesOptions = {}
): ArrangeSelectedRootNodesResult | null {
    if (selectedIds.length === 0) {
        return null;
    }

    const selectedPrompts = canvas.promptNodes.filter(prompt => selectedIds.includes(prompt.id));
    const selectedImages = canvas.imageNodes.filter(image => selectedIds.includes(image.id));
    const isPromptOnly = selectedPrompts.length > 0 && selectedImages.length === 0;
    const isImageOnly = selectedPrompts.length === 0 && selectedImages.length > 0;

    let roots: ArrangeRoot[] = [];
    let syncChildren = false;

    if (isPromptOnly) {
        roots = selectedPrompts.map(prompt => {
            const height = prompt.height || 200;
            return {
                id: prompt.id,
                type: 'prompt',
                obj: prompt,
                x: prompt.position.x,
                y: prompt.position.y,
                width: PROMPT_WIDTH,
                height,
                visualCx: prompt.position.x,
                visualCy: prompt.position.y - height / 2,
            };
        });
        syncChildren = true;
    } else if (isImageOnly) {
        roots = selectedImages.map(image => {
            const dims = getImageDims(image.aspectRatio);
            return {
                id: image.id,
                type: 'image',
                obj: image,
                x: image.position.x,
                y: image.position.y,
                width: dims.w,
                height: dims.h,
                visualCx: image.position.x,
                visualCy: image.position.y - dims.h / 2,
            };
        });
    } else {
        syncChildren = true;
        const promptById = new Map(canvas.promptNodes.map(prompt => [prompt.id, prompt]));
        const imageById = new Map(canvas.imageNodes.map(image => [image.id, image]));
        const uniqueRootsMap = new Map<string, ArrangeRootSeed>();

        selectedIds.forEach(id => {
            const prompt = promptById.get(id);
            if (prompt) {
                uniqueRootsMap.set(prompt.id, { id: prompt.id, type: 'prompt', obj: prompt });
                return;
            }

            const image = imageById.get(id);
            if (!image) {
                return;
            }

            if (image.parentPromptId) {
                const parentPrompt = promptById.get(image.parentPromptId);
                if (parentPrompt) {
                    uniqueRootsMap.set(parentPrompt.id, { id: parentPrompt.id, type: 'prompt', obj: parentPrompt });
                    return;
                }
            }

            uniqueRootsMap.set(image.id, { id: image.id, type: 'image', obj: image });
        });

        roots = Array.from(uniqueRootsMap.values()).map(root => {
            let width: number;
            let height: number;

            if (root.type === 'prompt') {
                const prompt = root.obj;
                const children = canvas.imageNodes.filter(image => image.parentPromptId === prompt.id);
                const promptHeight = prompt.height || 200;
                let minTop = prompt.position.y - promptHeight;
                let maxBottom = prompt.position.y;
                let minLeft = prompt.position.x - PROMPT_WIDTH / 2;
                let maxRight = prompt.position.x + PROMPT_WIDTH / 2;

                children.forEach(child => {
                    const dims = getImageDims(child.aspectRatio);
                    const childTop = child.position.y - dims.h;
                    const childBottom = child.position.y;
                    const childLeft = child.position.x - dims.w / 2;
                    const childRight = child.position.x + dims.w / 2;

                    if (childTop < minTop) minTop = childTop;
                    if (childBottom > maxBottom) maxBottom = childBottom;
                    if (childLeft < minLeft) minLeft = childLeft;
                    if (childRight > maxRight) maxRight = childRight;
                });

                width = maxRight - minLeft;
                height = maxBottom - minTop;
            } else {
                const image = root.obj;
                const dims = getImageDims(image.aspectRatio);
                width = dims.w;
                height = dims.h;
            }

            return {
                ...root,
                x: root.obj.position.x,
                y: root.obj.position.y,
                width,
                height,
                visualCx: root.obj.position.x,
                visualCy: root.obj.position.y - height / 2,
            };
        });
    }

    if (roots.length < 2) {
        return null;
    }

    const strategy: 'matrix' | 'row' | 'column' = mode === 'grid' ? 'matrix' : mode;
    const newPositions: Record<string, { x: number; y: number }> = {};

    if (strategy === 'matrix') {
        roots.sort((a, b) => {
            if (Math.abs(a.visualCy - b.visualCy) > 200) return a.visualCy - b.visualCy;
            return a.visualCx - b.visualCx;
        });

        const avgX = roots.reduce((sum, root) => sum + root.x, 0) / roots.length;
        const avgY = roots.reduce((sum, root) => sum + root.y, 0) / roots.length;
        const maxWidth = Math.max(...roots.map(root => root.width));
        const maxHeight = Math.max(...roots.map(root => root.height));
        const cellWidth = maxWidth + SELECTED_ROOT_GAP;
        const cellHeight = maxHeight + SELECTED_ROOT_GAP;
        const gridWidth = SELECTED_ROOT_GRID_COLUMNS * cellWidth;
        const rows = Math.ceil(roots.length / SELECTED_ROOT_GRID_COLUMNS);
        const gridHeight = rows * cellHeight;
        const startX = avgX - gridWidth / 2 + cellWidth / 2;
        const startY = avgY - gridHeight / 2 + cellHeight;

        roots.forEach((root, index) => {
            const col = index % SELECTED_ROOT_GRID_COLUMNS;
            const row = Math.floor(index / SELECTED_ROOT_GRID_COLUMNS);
            newPositions[root.id] = {
                x: startX + col * cellWidth,
                y: startY + row * cellHeight,
            };
        });
    } else if (strategy === 'column') {
        roots.sort((a, b) => a.visualCy - b.visualCy);
        const avgX = roots.reduce((sum, root) => sum + root.x, 0) / roots.length;
        const topY = Math.min(...roots.map(root => root.visualCy - root.height / 2));
        let currentY = topY;

        roots.forEach(root => {
            currentY += root.height;
            newPositions[root.id] = { x: avgX, y: currentY };
            currentY += SELECTED_ROOT_GAP;
        });
    } else {
        roots.sort((a, b) => a.visualCx - b.visualCx);
        const avgCy = roots.reduce((sum, root) => sum + root.visualCy, 0) / roots.length;
        let currentLeft = Math.min(...roots.map(root => root.visualCx - root.width / 2));

        roots.forEach(root => {
            const newX = currentLeft + root.width / 2;
            newPositions[root.id] = { x: newX, y: avgCy + root.height / 2 };
            currentLeft += root.width + SELECTED_ROOT_GAP;
        });
    }

    const rootById = new Map(roots.map(root => [root.id, root]));
    const getRootDelta = (rootId: string) => {
        const target = newPositions[rootId];
        const original = rootById.get(rootId);
        if (!target || !original) {
            return { x: 0, y: 0 };
        }
        return { x: target.x - original.x, y: target.y - original.y };
    };

    return {
        canvas: {
            ...canvas,
            promptNodes: canvas.promptNodes.map(prompt =>
                newPositions[prompt.id] ? { ...prompt, position: newPositions[prompt.id] } : prompt
            ),
            imageNodes: canvas.imageNodes.map(image => {
                if (newPositions[image.id]) {
                    return { ...image, position: newPositions[image.id] };
                }
                if (syncChildren && image.parentPromptId && newPositions[image.parentPromptId]) {
                    const delta = getRootDelta(image.parentPromptId);
                    return { ...image, position: { x: image.position.x + delta.x, y: image.position.y + delta.y } };
                }
                return image;
            }),
            lastModified: (options.now ?? Date.now)(),
        },
    };
}
