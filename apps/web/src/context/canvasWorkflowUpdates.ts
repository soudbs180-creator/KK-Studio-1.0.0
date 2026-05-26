import type { Canvas, WorkflowNode } from '../types';
import { canvasToWorkflow } from '../workflow/adapters/canvasToWorkflow.ts';
import { dedupeWorkflowEdges, isWorkflowUtilityNodeKind } from '../workflow/schema.ts';
import { getWorkflowSourceNodeIds } from './canvasWorkflowSourceNodeIds.ts';

export function addCanvasWorkflowNode(canvas: Canvas, node: WorkflowNode): Canvas {
    if (!isWorkflowUtilityNodeKind(node.kind)) {
        return canvas;
    }

    const workflow = canvasToWorkflow(canvas);
    const existingNode = workflow.nodes.find(existing => existing.id === node.id);
    if (existingNode) {
        return canvas;
    }

    return {
        ...canvas,
        workflow: {
            ...workflow,
            nodes: [...workflow.nodes, node],
            edges: dedupeWorkflowEdges([
                ...workflow.edges,
                ...getWorkflowSourceNodeIds(node)
                    .filter(sourceId => workflow.nodes.some(existing => existing.id === sourceId))
                    .map(sourceId => ({
                        id: `edge:${sourceId}:control:${node.id}`,
                        from: sourceId,
                        to: node.id,
                        role: 'control' as const,
                    })),
            ]),
        },
    };
}

export function updateCanvasWorkflowNode(
    canvas: Canvas,
    id: string,
    updates: Partial<WorkflowNode>,
): Canvas {
    const workflow = canvasToWorkflow(canvas);
    if (!workflow.nodes.length && !workflow.edges.length) return canvas;

    let changed = false;
    const nodes = workflow.nodes.map((node) => {
        if (node.id !== id) return node;
        changed = true;
        return {
            ...node,
            ...updates,
            id: node.id,
            kind: node.kind,
        } as WorkflowNode;
    });

    if (!changed) return canvas;

    const updatedNode = nodes.find(node => node.id === id);
    const validNodeIds = new Set(nodes.map(node => node.id));
    const edges = dedupeWorkflowEdges([
        ...workflow.edges.filter((edge) => {
            if (!validNodeIds.has(edge.from) || !validNodeIds.has(edge.to)) {
                return false;
            }

            if (edge.to !== id) {
                return true;
            }

            return edge.from === id;
        }),
        ...(updatedNode
            ? getWorkflowSourceNodeIds(updatedNode)
                .filter(sourceId => validNodeIds.has(sourceId))
                .map(sourceId => ({
                    id: `edge:${sourceId}:control:${id}`,
                    from: sourceId,
                    to: id,
                    role: 'control' as const,
                }))
            : []),
    ]);

    return {
        ...canvas,
        workflow: {
            ...workflow,
            nodes,
            edges,
        },
    };
}

export function updateCanvasWorkflowNodePosition(
    canvas: Canvas,
    id: string,
    position: { x: number; y: number },
): Canvas {
    if (!canvas.workflow) return canvas;
    let changed = false;

    const nodes = canvas.workflow.nodes.map((node) => {
        if (node.id !== id) return node;
        changed = true;
        return {
            ...node,
            position,
        };
    });

    if (!changed) return canvas;

    return {
        ...canvas,
        workflow: {
            ...canvas.workflow,
            nodes,
        },
    };
}

export function deleteCanvasWorkflowNode(canvas: Canvas, id: string): Canvas {
    const workflow = canvasToWorkflow(canvas);
    if (!workflow.nodes.length && !workflow.edges.length) return canvas;

    const nodes = workflow.nodes.filter((node) => node.id !== id);
    if (nodes.length === workflow.nodes.length) {
        return canvas;
    }

    const validNodeIds = new Set(nodes.map((node) => node.id));
    const edges = workflow.edges.filter((edge) => (
        edge.from !== id
        && edge.to !== id
        && validNodeIds.has(edge.from)
        && validNodeIds.has(edge.to)
    ));

    return {
        ...canvas,
        workflow: {
            ...workflow,
            nodes,
            edges,
        },
    };
}
