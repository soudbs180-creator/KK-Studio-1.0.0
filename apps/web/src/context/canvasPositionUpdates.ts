import type { Canvas } from '../types.ts';

export type PromptPositionUpdateOptions = {
    moveChildren?: boolean;
    ignoreSelection?: boolean;
};

export type ImagePositionUpdateOptions = {
    ignoreSelection?: boolean;
};

export function updateCanvasPromptNodePosition(
    canvas: Canvas,
    selectedNodeIds: string[],
    id: string,
    pos: { x: number; y: number },
    options?: PromptPositionUpdateOptions,
): Canvas {
    const node = canvas.promptNodes.find(n => n.id === id);
    if (!node) return canvas;

    const dx = pos.x - node.position.x;
    const dy = pos.y - node.position.y;
    const moveChildren = options?.moveChildren !== false;
    const ignoreSelection = options?.ignoreSelection === true;

    if (!ignoreSelection) {
        const selectedIds = new Set(selectedNodeIds || []);
        if (selectedIds.has(id)) {
            const promptNodes = canvas.promptNodes.map(prompt =>
                selectedIds.has(prompt.id)
                    ? { ...prompt, position: { x: prompt.position.x + dx, y: prompt.position.y + dy } }
                    : prompt
            );
            const movedPromptIds = new Set(canvas.promptNodes.filter(prompt => selectedIds.has(prompt.id)).map(prompt => prompt.id));
            const imageNodes = canvas.imageNodes.map(image =>
                selectedIds.has(image.id) || (image.parentPromptId && movedPromptIds.has(image.parentPromptId))
                    ? { ...image, position: { x: image.position.x + dx, y: image.position.y + dy } }
                    : image
            );

            return { ...canvas, promptNodes, imageNodes };
        }
    }

    if (!moveChildren) {
        return {
            ...canvas,
            promptNodes: canvas.promptNodes.map(prompt => prompt.id === id ? { ...prompt, position: pos } : prompt)
        };
    }

    return {
        ...canvas,
        promptNodes: canvas.promptNodes.map(prompt => prompt.id === id ? { ...prompt, position: pos } : prompt),
        imageNodes: canvas.imageNodes.map(image => (
            image.parentPromptId === id
                ? { ...image, position: { x: image.position.x + dx, y: image.position.y + dy } }
                : image
        ))
    };
}

export function updateCanvasImageNodePosition(
    canvas: Canvas,
    selectedNodeIds: string[],
    id: string,
    pos: { x: number; y: number },
    options?: ImagePositionUpdateOptions,
): Canvas {
    const node = canvas.imageNodes.find(n => n.id === id);
    if (!node) return canvas;

    const dx = pos.x - node.position.x;
    const dy = pos.y - node.position.y;
    const ignoreSelection = options?.ignoreSelection === true;

    if (!ignoreSelection) {
        const selectedIds = new Set(selectedNodeIds || []);
        if (selectedIds.has(id)) {
            const promptNodes = canvas.promptNodes.map(prompt =>
                selectedIds.has(prompt.id)
                    ? { ...prompt, position: { x: prompt.position.x + dx, y: prompt.position.y + dy } }
                    : prompt
            );
            const movedPromptIds = new Set(canvas.promptNodes.filter(prompt => selectedIds.has(prompt.id)).map(prompt => prompt.id));
            const imageNodes = canvas.imageNodes.map(image =>
                selectedIds.has(image.id) || (image.parentPromptId && movedPromptIds.has(image.parentPromptId))
                    ? { ...image, position: { x: image.position.x + dx, y: image.position.y + dy } }
                    : image
            );

            return { ...canvas, promptNodes, imageNodes };
        }
    }

    return {
        ...canvas,
        promptNodes: canvas.promptNodes,
        imageNodes: canvas.imageNodes.map(image =>
            image.id === id ? { ...image, position: pos } : image
        )
    };
}
