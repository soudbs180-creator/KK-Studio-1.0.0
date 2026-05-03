import type { Canvas } from '../types.ts';

export function deleteCanvasImageNode(canvas: Canvas, id: string): Canvas {
    return {
        ...canvas,
        imageNodes: canvas.imageNodes.filter(node => node.id !== id),
        promptNodes: canvas.promptNodes.map(prompt => ({
            ...prompt,
            childImageIds: prompt.childImageIds.filter(childId => childId !== id),
            sourceImageId: prompt.sourceImageId === id ? undefined : prompt.sourceImageId,
        })),
    };
}

export function deleteCanvasPromptNode(canvas: Canvas, id: string): Canvas {
    return {
        ...canvas,
        promptNodes: canvas.promptNodes.filter(node => node.id !== id),
        imageNodes: canvas.imageNodes.map(image =>
            image.parentPromptId === id
                ? { ...image, parentPromptId: '' }
                : image
        ),
    };
}

export function linkCanvasPromptToImage(canvas: Canvas, promptId: string, imageId: string): Canvas {
    const promptNode = canvas.promptNodes.find(prompt => prompt.id === promptId);
    if (!promptNode || promptNode.childImageIds.includes(imageId)) {
        return canvas;
    }

    return {
        ...canvas,
        promptNodes: canvas.promptNodes.map(prompt =>
            prompt.id === promptId
                ? { ...prompt, childImageIds: [...prompt.childImageIds, imageId] }
                : prompt
        ),
        imageNodes: canvas.imageNodes.map(image =>
            image.id === imageId
                ? { ...image, parentPromptId: promptId }
                : image
        ),
    };
}

export function unlinkCanvasPromptFromImage(canvas: Canvas, promptId: string, imageId: string): Canvas {
    return {
        ...canvas,
        promptNodes: canvas.promptNodes.map(prompt =>
            prompt.id === promptId
                ? { ...prompt, childImageIds: prompt.childImageIds.filter(id => id !== imageId) }
                : prompt
        ),
        imageNodes: canvas.imageNodes.map(image =>
            image.id === imageId
                ? { ...image, parentPromptId: '' }
                : image
        ),
    };
}
