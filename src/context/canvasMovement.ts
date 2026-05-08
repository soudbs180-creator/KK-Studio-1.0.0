import type { Canvas } from '../types.ts';
import { snapCanvasPointToGrid } from '../utils/canvasSnapToGrid.ts';
import { isWorkflowUtilityNodeKind } from '../workflow/schema.ts';

export type CanvasMoveDelta = { x: number; y: number };
export type CanvasMoveSource = string | string[] | undefined;
export type CanvasMoveOptions = { snapToGrid?: boolean };

const moveCanvasPoint = (
    position: { x: number; y: number },
    delta: CanvasMoveDelta,
    options?: CanvasMoveOptions,
) => snapCanvasPointToGrid({
    x: position.x + delta.x,
    y: position.y + delta.y,
}, { enabled: options?.snapToGrid });

export function resolveMoveSelectedCanvasNodeIds(
    selectedNodeIds: string[],
    sourceNodeIdOrIds?: CanvasMoveSource,
): string[] {
    if (Array.isArray(sourceNodeIdOrIds) && sourceNodeIdOrIds.length > 0) {
        return sourceNodeIdOrIds;
    }

    if (typeof sourceNodeIdOrIds === 'string' && sourceNodeIdOrIds) {
        return selectedNodeIds.includes(sourceNodeIdOrIds) ? selectedNodeIds : [sourceNodeIdOrIds];
    }

    return selectedNodeIds;
}

export function moveSelectedCanvasNodes(input: {
    canvas: Canvas;
    selectedNodeIds: string[];
    delta: CanvasMoveDelta;
    sourceNodeIdOrIds?: CanvasMoveSource;
    options?: CanvasMoveOptions;
    snapToGrid?: boolean;
}): Canvas {
    const { canvas, delta, sourceNodeIdOrIds } = input;
    const options = input.options ?? { snapToGrid: input.snapToGrid };
    const selectedIds = resolveMoveSelectedCanvasNodeIds(input.selectedNodeIds, sourceNodeIdOrIds);
    if (selectedIds.length === 0) return canvas;

    const selectedSet = new Set(selectedIds);
    const movedPromptIds = new Set(
        canvas.promptNodes
            .filter((node) => selectedSet.has(node.id))
            .map((node) => node.id)
    );

    const promptNodes = canvas.promptNodes.map(node => {
        if (selectedSet.has(node.id)) {
            return {
                ...node,
                position: moveCanvasPoint(node.position, delta, options),
                userMoved: true,
            };
        }
        return node;
    });

    const imageNodes = canvas.imageNodes.map(node => {
        const isDirectlyMovedImage = selectedSet.has(node.id);
        const isMovingWithPromptGroup = Boolean(node.parentPromptId && movedPromptIds.has(node.parentPromptId));
        if (isDirectlyMovedImage || isMovingWithPromptGroup) {
            return {
                ...node,
                position: moveCanvasPoint(node.position, delta, options),
                userMoved: selectedSet.has(node.id) ? true : node.userMoved,
            };
        }
        return node;
    });

    const workflow = canvas.workflow
        ? {
            ...canvas.workflow,
            nodes: canvas.workflow.nodes.map(node => {
                if (selectedSet.has(node.id) && isWorkflowUtilityNodeKind(node.kind)) {
                    return {
                        ...node,
                        position: moveCanvasPoint(node.position, delta, options),
                    };
                }
                return node;
            }),
        }
        : canvas.workflow;

    return {
        ...canvas,
        promptNodes,
        imageNodes,
        workflow,
    };
}
