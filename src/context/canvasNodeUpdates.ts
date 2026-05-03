import type { Canvas, GeneratedImage, PromptNode } from '../types.ts';

export type CanvasNodeUpdateBatch = {
    promptNodes?: Array<{ id: string; updates: Partial<PromptNode> }>;
    imageNodes?: Array<{ id: string; updates: Partial<GeneratedImage> }>;
};

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
