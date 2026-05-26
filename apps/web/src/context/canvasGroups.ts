import type { Canvas, CanvasGroup } from '../types';

function resolveNextGroupZIndex(canvas: Canvas): number {
    return Math.max(
        0,
        ...canvas.promptNodes.map(node => node.zIndex ?? 0),
        ...canvas.imageNodes.map(node => node.zIndex ?? 0),
        ...(canvas.groups || []).map(group => group.zIndex ?? 0)
    ) + 1;
}

export function addCanvasGroupToCanvas(canvas: Canvas, group: CanvasGroup): Canvas {
    const nextGroup = group.zIndex !== undefined
        ? group
        : {
            ...group,
            zIndex: resolveNextGroupZIndex(canvas),
        };

    return {
        ...canvas,
        groups: [
            ...(canvas.groups || []),
            nextGroup,
        ],
    };
}

export function removeCanvasGroupFromCanvas(canvas: Canvas, id: string): Canvas {
    return {
        ...canvas,
        groups: (canvas.groups || []).filter(group => group.id !== id),
    };
}

export function updateCanvasGroupInCanvas(canvas: Canvas, group: CanvasGroup): Canvas {
    return {
        ...canvas,
        groups: (canvas.groups || []).map(existingGroup => existingGroup.id === group.id ? group : existingGroup),
    };
}
