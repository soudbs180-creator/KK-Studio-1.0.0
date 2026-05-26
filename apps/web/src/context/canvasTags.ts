import type { Canvas } from '../types';

export function setCanvasNodeTags(canvas: Canvas, ids: string[], tags: string[]): Canvas {
    return {
        ...canvas,
        promptNodes: canvas.promptNodes.map(node => ids.includes(node.id) ? { ...node, tags } : node),
        imageNodes: canvas.imageNodes.map(node => ids.includes(node.id) ? { ...node, tags } : node),
    };
}
