import type { Canvas } from '../types.ts';

export type MergeCanvasIntoState = {
    canvases: Canvas[];
    activeCanvasId: string;
    selectedNodeIds: string[];
};

export type MergeCanvasIntoOptions = {
    deleteSource?: boolean;
    now?: () => number;
};

export type MergeCanvasIntoSummary = {
    movedPrompts: number;
    movedImages: number;
    deletedSource: boolean;
};

export type MergeCanvasIntoResult<T extends MergeCanvasIntoState> = {
    state: T;
    summary: MergeCanvasIntoSummary;
};

const EMPTY_MERGE_SUMMARY: MergeCanvasIntoSummary = {
    movedPrompts: 0,
    movedImages: 0,
    deletedSource: false,
};

export function mergeCanvasIntoState<T extends MergeCanvasIntoState>(
    state: T,
    sourceCanvasId: string,
    targetCanvasId: string,
    options: MergeCanvasIntoOptions = {}
): MergeCanvasIntoResult<T> {
    if (sourceCanvasId === targetCanvasId) {
        return { state, summary: EMPTY_MERGE_SUMMARY };
    }

    const sourceCanvas = state.canvases.find(canvas => canvas.id === sourceCanvasId);
    const targetCanvas = state.canvases.find(canvas => canvas.id === targetCanvasId);
    if (!sourceCanvas || !targetCanvas) {
        return { state, summary: EMPTY_MERGE_SUMMARY };
    }

    const deleteSource = options.deleteSource !== false;
    const now = options.now ?? Date.now;
    const targetPromptIds = new Set(targetCanvas.promptNodes.map(node => node.id));
    const targetImageIds = new Set(targetCanvas.imageNodes.map(node => node.id));
    const targetGroupIds = new Set((targetCanvas.groups || []).map(group => group.id));
    const targetMaxX = Math.max(
        0,
        ...targetCanvas.promptNodes.map(node => node.position.x || 0),
        ...targetCanvas.imageNodes.map(node => node.position.x || 0)
    );
    const offsetX = targetCanvas.promptNodes.length > 0 || targetCanvas.imageNodes.length > 0
        ? targetMaxX + 500
        : 0;

    const movedPrompts = sourceCanvas.promptNodes
        .filter(node => !targetPromptIds.has(node.id))
        .map(node => ({
            ...node,
            position: { x: node.position.x + offsetX, y: node.position.y },
        }));

    const movedImages = sourceCanvas.imageNodes
        .filter(node => !targetImageIds.has(node.id))
        .map(node => ({
            ...node,
            canvasId: targetCanvasId,
            position: { x: node.position.x + offsetX, y: node.position.y },
        }));

    const movedNodeIds = new Set<string>([
        ...movedPrompts.map(node => node.id),
        ...movedImages.map(node => node.id),
    ]);

    const movedGroups = (sourceCanvas.groups || [])
        .filter(group => !targetGroupIds.has(group.id))
        .map(group => ({
            ...group,
            nodeIds: (group.nodeIds || []).filter(nodeId => movedNodeIds.has(nodeId)),
        }))
        .filter(group => group.nodeIds.length > 0);

    const updatedCanvases = state.canvases
        .map(canvas => {
            if (canvas.id === targetCanvasId) {
                return {
                    ...canvas,
                    promptNodes: [...canvas.promptNodes, ...movedPrompts],
                    imageNodes: [...canvas.imageNodes, ...movedImages],
                    groups: [...(canvas.groups || []), ...movedGroups],
                    lastModified: now(),
                };
            }

            if (canvas.id === sourceCanvasId && !deleteSource) {
                return {
                    ...canvas,
                    promptNodes: [],
                    imageNodes: [],
                    groups: [],
                    lastModified: now(),
                };
            }

            return canvas;
        })
        .filter(canvas => !(deleteSource && canvas.id === sourceCanvasId));

    return {
        state: {
            ...state,
            canvases: updatedCanvases,
            activeCanvasId: state.activeCanvasId === sourceCanvasId && deleteSource
                ? targetCanvasId
                : state.activeCanvasId,
            selectedNodeIds: [],
        },
        summary: {
            movedPrompts: movedPrompts.length,
            movedImages: movedImages.length,
            deletedSource: deleteSource,
        },
    };
}
