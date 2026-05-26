import type { Canvas, GeneratedImage, PromptNode } from '../types';
import { resolvePromptChildImageIds } from './canvasPromptChildImages.ts';

export type CanvasNodeUpdateBatch = {
    promptNodes?: Array<{ id: string; updates: Partial<PromptNode> }>;
    imageNodes?: Array<{ id: string; updates: Partial<GeneratedImage> }>;
};

export function addCanvasPromptNode(canvas: Canvas, node: PromptNode): Canvas {
    if (canvas.promptNodes.some(existing => existing.id === node.id)) {
        return canvas;
    }

    const allZIndices = [
        ...canvas.promptNodes.map(existing => existing.zIndex ?? 0),
        ...canvas.imageNodes.map(image => image.zIndex ?? 0),
        ...(canvas.groups || []).map(group => group.zIndex ?? 0)
    ];
    const maxZ = allZIndices.length > 0 ? Math.max(...allZIndices) : 0;

    return {
        ...canvas,
        promptNodes: [...canvas.promptNodes, { ...node, zIndex: maxZ + 1 }]
    };
}

export function updateCanvasPromptNode(canvas: Canvas, node: PromptNode): Canvas {
    return {
        ...canvas,
        promptNodes: canvas.promptNodes.map(existing => {
            if (existing.id !== node.id) {
                return existing;
            }

            const merged: PromptNode = {
                ...existing,
                ...node,
                prompt: node.prompt && node.prompt.length > 0 ? node.prompt : existing.prompt,
                referenceImages: node.referenceImages && node.referenceImages.length > 0
                    ? node.referenceImages
                    : existing.referenceImages
            };

            const hasFinished = resolvePromptChildImageIds(existing, canvas.imageNodes).length > 0;
            const hasFailed = !!existing.error;

            if ((hasFinished || hasFailed) && node.isGenerating === true && existing.isGenerating === false) {
                merged.isGenerating = false;
                if (hasFailed && !merged.error && !('error' in node)) {
                    merged.error = existing.error;
                    merged.errorDetails = existing.errorDetails;
                }
            }

            return merged;
        })
    };
}

export function updateCanvasImageNodeDimensions(canvas: Canvas, id: string, dimensions: string): Canvas {
    return {
        ...canvas,
        imageNodes: canvas.imageNodes.map(img =>
            img.id === id ? { ...img, dimensions } : img
        )
    };
}

export function updateCanvasImageNode(canvas: Canvas, id: string, updates: Partial<GeneratedImage>): Canvas {
    return {
        ...canvas,
        imageNodes: canvas.imageNodes.map(img =>
            img.id === id ? { ...img, ...updates } : img
        )
    };
}

export function applyCanvasNodeBatchUpdates(canvas: Canvas, batch: CanvasNodeUpdateBatch): Canvas {
    let nextPromptNodes = [...canvas.promptNodes];
    let nextImageNodes = [...canvas.imageNodes];
    let changed = false;

    if (batch.promptNodes && batch.promptNodes.length > 0) {
        const updateMap = new Map(batch.promptNodes.map(u => [u.id, u.updates]));
        nextPromptNodes = nextPromptNodes.map(node => {
            const updates = updateMap.get(node.id);
            if (updates) {
                changed = true;
                return { ...node, ...updates };
            }
            return node;
        });
    }

    if (batch.imageNodes && batch.imageNodes.length > 0) {
        const updateMap = new Map(batch.imageNodes.map(u => [u.id, u.updates]));
        nextImageNodes = nextImageNodes.map(image => {
            const updates = updateMap.get(image.id);
            if (updates) {
                changed = true;
                return { ...image, ...updates };
            }
            return image;
        });
    }

    return changed ? { ...canvas, promptNodes: nextPromptNodes, imageNodes: nextImageNodes } : canvas;
}
