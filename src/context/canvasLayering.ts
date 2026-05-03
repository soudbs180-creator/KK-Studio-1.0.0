import type { Canvas, CanvasGroup } from '../types.ts';
import { isWorkflowUtilityNodeKind } from '../workflow/schema.ts';

export function bringCanvasNodesToFront(canvas: Canvas, nodeIds: string[]): Canvas {
    if (nodeIds.length === 0) return canvas;

    const promptById = new Map(canvas.promptNodes.map(node => [node.id, node]));
    const imageById = new Map(canvas.imageNodes.map(node => [node.id, node]));
    const workflowById = new Map(
        (canvas.workflow?.nodes || [])
            .filter(node => isWorkflowUtilityNodeKind(node.kind))
            .map(node => [node.id, node])
    );
    const canvasGroupsByNodeId = new Map<string, CanvasGroup[]>();
    canvas.groups.forEach(group => {
        group.nodeIds.forEach(id => {
            const linkedGroups = canvasGroupsByNodeId.get(id) || [];
            linkedGroups.push(group);
            canvasGroupsByNodeId.set(id, linkedGroups);
        });
    });

    const orderedNodeIds: string[] = [];
    const orderedNodeIdSet = new Set<string>();
    const expandedPromptIds = new Set<string>();
    const expandedCanvasGroupIds = new Set<string>();

    const pushNodeId = (id?: string) => {
        if (!id || orderedNodeIdSet.has(id)) return;
        orderedNodeIdSet.add(id);
        orderedNodeIds.push(id);

        const linkedGroups = canvasGroupsByNodeId.get(id) || [];
        linkedGroups.forEach(pushCanvasGroup);
    };

    const getPromptGroupImageIds = (promptId: string) => {
        const prompt = promptById.get(promptId);
        if (!prompt) return [] as string[];

        const childImageIds = new Set<string>(
            (prompt.childImageIds || []).filter((id): id is string => Boolean(id))
        );

        canvas.imageNodes.forEach(image => {
            if (image.parentPromptId === promptId) {
                childImageIds.add(image.id);
            }
        });

        return Array.from(childImageIds);
    };

    const pushPromptGroup = (promptId: string) => {
        if (expandedPromptIds.has(promptId)) return;
        expandedPromptIds.add(promptId);

        const prompt = promptById.get(promptId);
        if (!prompt) return;

        pushNodeId(prompt.id);
        getPromptGroupImageIds(promptId).forEach(pushNodeId);
    };

    function pushCanvasGroup(group: CanvasGroup) {
        if (expandedCanvasGroupIds.has(group.id)) return;
        expandedCanvasGroupIds.add(group.id);

        group.nodeIds.forEach(memberId => {
            const prompt = promptById.get(memberId);
            if (prompt) {
                pushPromptGroup(prompt.id);
                return;
            }

            const image = imageById.get(memberId);
            if (image?.parentPromptId) {
                pushPromptGroup(image.parentPromptId);
                return;
            }

            pushNodeId(memberId);
        });
    }

    nodeIds.forEach(id => {
        const prompt = promptById.get(id);
        if (prompt) {
            pushPromptGroup(prompt.id);
            return;
        }

        const image = imageById.get(id);
        if (image) {
            if (image.parentPromptId) {
                pushPromptGroup(image.parentPromptId);
            } else {
                pushNodeId(image.id);
            }
            return;
        }

        if (workflowById.has(id)) {
            pushNodeId(id);
            return;
        }

        pushNodeId(id);
    });

    const nodeIdSet = new Set(orderedNodeIds);
    const allZIndices = [
        ...canvas.promptNodes.map(node => node.zIndex ?? 0),
        ...canvas.imageNodes.map(node => node.zIndex ?? 0),
        ...(canvas.workflow?.nodes || []).map(node => node.zIndex ?? 0),
        ...canvas.groups.map(group => group.zIndex ?? 0),
    ];
    let maxZ = allZIndices.length > 0 ? Math.max(...allZIndices) : 0;
    const nextZIndexById = new Map<string, number>();
    const promotedPromptGroupIds = new Set<string>();

    orderedNodeIds.forEach(id => {
        const prompt = promptById.get(id);
        if (prompt) {
            if (promotedPromptGroupIds.has(prompt.id)) return;
            promotedPromptGroupIds.add(prompt.id);
            const groupZIndex = ++maxZ;
            nextZIndexById.set(prompt.id, groupZIndex);
            getPromptGroupImageIds(prompt.id).forEach(childImageId => {
                nextZIndexById.set(childImageId, groupZIndex);
            });
            return;
        }

        const image = imageById.get(id);
        if (image?.parentPromptId && promptById.has(image.parentPromptId)) {
            if (promotedPromptGroupIds.has(image.parentPromptId)) return;
            promotedPromptGroupIds.add(image.parentPromptId);
            const groupZIndex = ++maxZ;
            nextZIndexById.set(image.parentPromptId, groupZIndex);
            getPromptGroupImageIds(image.parentPromptId).forEach(childImageId => {
                nextZIndexById.set(childImageId, groupZIndex);
            });
            return;
        }

        if (!nextZIndexById.has(id)) {
            nextZIndexById.set(id, ++maxZ);
        }
    });

    const promptNodes = canvas.promptNodes.map(node => {
        const nextZIndex = nextZIndexById.get(node.id);
        return nextZIndex !== undefined ? { ...node, zIndex: nextZIndex } : node;
    });

    const imageNodes = canvas.imageNodes.map(node => {
        const nextZIndex = nextZIndexById.get(node.id);
        return nextZIndex !== undefined ? { ...node, zIndex: nextZIndex } : node;
    });

    const workflow = canvas.workflow
        ? {
            ...canvas.workflow,
            nodes: canvas.workflow.nodes.map(node => {
                const nextZIndex = nextZIndexById.get(node.id);
                return nextZIndex !== undefined ? { ...node, zIndex: nextZIndex } : node;
            }),
        }
        : canvas.workflow;

    const groups = canvas.groups.map(group => {
        const hasSelectedNode = group.nodeIds.some(id => nodeIdSet.has(id));
        return hasSelectedNode ? { ...group, zIndex: ++maxZ } : group;
    });

    return {
        ...canvas,
        promptNodes,
        imageNodes,
        workflow,
        groups,
    };
}
