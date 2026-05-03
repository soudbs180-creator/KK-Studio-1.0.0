import type { Canvas } from '../types.ts';
import { isWorkflowUtilityNodeKind } from '../workflow/schema.ts';

export type CanvasMoveDelta = { x: number; y: number };
export type CanvasMoveSource = string | string[] | undefined;

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
}): Canvas {
    const { canvas, delta, sourceNodeIdOrIds } = input;
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
                position: { x: node.position.x + delta.x, y: node.position.y + delta.y },
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
                position: { x: node.position.x + delta.x, y: node.position.y + delta.y },
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
                        position: { x: node.position.x + delta.x, y: node.position.y + delta.y },
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
