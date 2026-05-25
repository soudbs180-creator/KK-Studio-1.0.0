import type {
  Canvas,
  CanvasWorkflow,
  GeneratedImage,
  PromptNode,
  WorkflowNode,
} from '../../types';
import { isLegacyWorkflowNodeKind } from '../schema.ts';
import { normalizeWorkflowGraph } from '../persistence/workflowSerializer.ts';
import { createEmptyWorkflowGraph } from '../types.ts';

const toPromptWorkflowNode = (node: PromptNode): WorkflowNode => ({
  id: node.id,
  kind: 'prompt',
  position: node.position,
  width: node.width,
  height: node.height,
  zIndex: node.zIndex,
  tags: node.tags,
  label: node.prompt.slice(0, 48),
  data: node,
});

const toImageWorkflowNode = (node: GeneratedImage): WorkflowNode => ({
  id: node.id,
  kind: 'image',
  position: node.position,
  zIndex: node.zIndex,
  tags: node.tags,
  label: node.fileName || node.prompt.slice(0, 48),
  data: node,
});

const mergeLegacyNodesIntoWorkflow = (
  canvas: Canvas,
  existingWorkflow?: CanvasWorkflow,
): CanvasWorkflow => {
  const graph = createEmptyWorkflowGraph<WorkflowNode>();
  const edges = new Map<string, CanvasWorkflow['edges'][number]>();
  const normalizedExistingWorkflow = normalizeWorkflowGraph(existingWorkflow);
  const legacyNodeIds = new Set<string>([
    ...canvas.promptNodes.map((node) => node.id),
    ...canvas.imageNodes.map((node) => node.id),
  ]);

  canvas.promptNodes.forEach((node) => {
    graph.nodes.push(toPromptWorkflowNode(node));

    (node.childImageIds || []).forEach((imageId, index) => {
      if (!imageId) return;
      const edgeId = `edge:${node.id}:result:${imageId}:${index}`;
      edges.set(edgeId, {
        id: edgeId,
        from: node.id,
        to: imageId,
        role: 'result',
      });
    });

    if (node.sourceImageId) {
      const edgeId = `edge:${node.sourceImageId}:input:${node.id}`;
      edges.set(edgeId, {
        id: edgeId,
        from: node.sourceImageId,
        to: node.id,
        role: 'input',
      });
    }
  });

  canvas.imageNodes.forEach((node) => {
    graph.nodes.push(toImageWorkflowNode(node));

    if (node.parentPromptId) {
      const edgeId = `edge:${node.parentPromptId}:result:${node.id}`;
      edges.set(edgeId, {
        id: edgeId,
        from: node.parentPromptId,
        to: node.id,
        role: 'result',
      });
    }
  });

  (normalizedExistingWorkflow?.nodes || []).forEach((node) => {
    if (!isLegacyWorkflowNodeKind(node.kind)) {
      graph.nodes.push(node);
    }
  });

  const validNodeIds = new Set(graph.nodes.map((node) => node.id));
  (normalizedExistingWorkflow?.edges || []).forEach((edge) => {
    const fromIsLegacy = legacyNodeIds.has(edge.from);
    const toIsLegacy = legacyNodeIds.has(edge.to);
    const isLegacyOnlyEdge = fromIsLegacy && toIsLegacy;

    if (isLegacyOnlyEdge && edge.role !== 'control' && edge.role !== 'sequence') {
      const fromIsUtility = graph.nodes.some((node) => node.id === edge.from && !isLegacyWorkflowNodeKind(node.kind));
      const toIsUtility = graph.nodes.some((node) => node.id === edge.to && !isLegacyWorkflowNodeKind(node.kind));
      if (!fromIsUtility && !toIsUtility) {
        return;
      }
    }

    if (validNodeIds.has(edge.from) && validNodeIds.has(edge.to)) {
      edges.set(edge.id, edge);
    }
  });

  graph.edges = Array.from(edges.values());
  graph.metadata = {
    ...normalizedExistingWorkflow?.metadata,
    source: normalizedExistingWorkflow?.metadata?.source || 'legacy-canvas',
    generatedAt: Date.now(),
    featureFlag: normalizedExistingWorkflow?.metadata?.featureFlag || 'experimentalWorkflowGraph',
  };

  return graph;
};

export const canvasToWorkflow = (canvas: Canvas): CanvasWorkflow => (
  mergeLegacyNodesIntoWorkflow(canvas, canvas.workflow)
);

export const syncCanvasWorkflow = (canvas: Canvas, enabled: boolean): Canvas =>
  (enabled || !!canvas.workflow)
    ? {
        ...canvas,
        workflow: mergeLegacyNodesIntoWorkflow(canvas, canvas.workflow),
      }
    : canvas;
