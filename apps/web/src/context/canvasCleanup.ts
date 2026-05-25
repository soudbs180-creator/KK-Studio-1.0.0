import type { Canvas, CanvasWorkflow, WorkflowNode } from '../types.ts';
import { dedupeWorkflowEdges, isWorkflowUtilityNodeKind } from '../workflow/schema.ts';
import { getWorkflowSourceNodeIds } from './canvasWorkflowSourceNodeIds.ts';

export type CleanupInvalidCardsSummary = {
    removedPrompts: number;
    removedImages: number;
    removedGroups: number;
};

export type CleanupInvalidCanvasCardsInput = {
    canvas: Canvas;
    selectedNodeIds?: string[];
    now?: () => number;
    toWorkflow: (canvas: Canvas) => CanvasWorkflow;
    syncCompatibility: (canvas: Canvas) => Canvas;
};

export type CleanupInvalidCanvasCardsResult = {
    canvas: Canvas;
    selectedNodeIds: string[];
    summary: CleanupInvalidCardsSummary;
    changed: boolean;
};

const EMPTY_CLEANUP_SUMMARY: CleanupInvalidCardsSummary = {
    removedPrompts: 0,
    removedImages: 0,
    removedGroups: 0,
};

export function cleanupInvalidCanvasCardsForCanvas(input: CleanupInvalidCanvasCardsInput): CleanupInvalidCanvasCardsResult {
    const { canvas, selectedNodeIds = [], toWorkflow, syncCompatibility } = input;
    const now = input.now ?? Date.now;

    const promptIds = new Set(canvas.promptNodes.map(node => node.id));
    const promptIdsToRemove = new Set(
        canvas.promptNodes
            .filter(node => !node.isGenerating && !!node.error && (node.childImageIds?.length || 0) === 0)
            .map(node => node.id)
    );

    const imageIdsToRemove = new Set(
        canvas.imageNodes
            .filter(node => {
                const hasBrokenParent = !!node.parentPromptId && !node.orphaned && !promptIds.has(node.parentPromptId);
                const hasBrokenContent = !node.isGenerating && !node.url && !node.originalUrl && !node.apiResultUrl;
                const hasErrorState = !node.isGenerating && !!node.error;
                return hasBrokenParent || hasBrokenContent || hasErrorState;
            })
            .map(node => node.id)
    );

    const nextPromptNodes = canvas.promptNodes
        .filter(node => !promptIdsToRemove.has(node.id))
        .map(node => ({
            ...node,
            childImageIds: (node.childImageIds || []).filter(childId => !imageIdsToRemove.has(childId))
        }));

    const nextPromptIds = new Set(nextPromptNodes.map(node => node.id));
    const nextImageNodes = canvas.imageNodes.filter(node => {
        if (imageIdsToRemove.has(node.id)) {
            return false;
        }
        if (!node.orphaned && node.parentPromptId && !nextPromptIds.has(node.parentPromptId)) {
            imageIdsToRemove.add(node.id);
            return false;
        }
        return true;
    });

    const workflow = toWorkflow(canvas);
    const validLegacyNodeIds = new Set<string>([
        ...nextPromptNodes.map(node => node.id),
        ...nextImageNodes.map(node => node.id),
    ]);
    const nextWorkflowNodes = workflow.nodes.map((node): WorkflowNode => {
        if (!isWorkflowUtilityNodeKind(node.kind)) {
            return node;
        }

        const sourceNodeIds = getWorkflowSourceNodeIds(node).filter(sourceId => validLegacyNodeIds.has(sourceId));
        const outputNodeIds = Array.isArray((node.data as { outputNodeIds?: unknown } | undefined)?.outputNodeIds)
            ? ((node.data as { outputNodeIds?: unknown[] }).outputNodeIds || []).filter((outputId): outputId is string => (
                typeof outputId === 'string' && validLegacyNodeIds.has(outputId)
            ))
            : undefined;

        return {
            ...node,
            data: {
                ...node.data,
                sourceNodeIds,
                ...(outputNodeIds ? { outputNodeIds } : {}),
            },
        } as WorkflowNode;
    });
    const validWorkflowNodeIds = new Set(nextWorkflowNodes.map(node => node.id));
    const nextWorkflowEdges = dedupeWorkflowEdges(
        workflow.edges.filter(edge => (
            validWorkflowNodeIds.has(edge.from)
            && validWorkflowNodeIds.has(edge.to)
            && !promptIdsToRemove.has(edge.from)
            && !promptIdsToRemove.has(edge.to)
            && !imageIdsToRemove.has(edge.from)
            && !imageIdsToRemove.has(edge.to)
        ))
    );

    const syncedCanvas = syncCompatibility({
        ...canvas,
        promptNodes: nextPromptNodes,
        imageNodes: nextImageNodes,
        groups: (canvas.groups || []).filter(group =>
            (group.nodeIds || []).some(nodeId => (
                validLegacyNodeIds.has(nodeId) || validWorkflowNodeIds.has(nodeId)
            ))
        ),
        workflow: {
            ...workflow,
            nodes: nextWorkflowNodes,
            edges: nextWorkflowEdges,
        },
        lastModified: now(),
    });

    const remainingNodeIds = new Set<string>([
        ...nextPromptNodes.map(node => node.id),
        ...nextImageNodes.map(node => node.id),
        ...((syncedCanvas.workflow?.nodes || []).map(node => node.id)),
    ]);
    const nextGroups = syncedCanvas.groups || [];
    const summary = {
        removedPrompts: canvas.promptNodes.length - nextPromptNodes.length,
        removedImages: canvas.imageNodes.length - nextImageNodes.length,
        removedGroups: (canvas.groups || []).length - nextGroups.length
    };

    if (summary.removedPrompts === 0 && summary.removedImages === 0 && summary.removedGroups === 0) {
        return {
            canvas,
            selectedNodeIds,
            summary: EMPTY_CLEANUP_SUMMARY,
            changed: false,
        };
    }

    return {
        canvas: syncedCanvas,
        selectedNodeIds: selectedNodeIds.filter(nodeId => remainingNodeIds.has(nodeId)),
        summary,
        changed: true,
    };
}
