import type {
  Canvas,
  CanvasWorkflow,
  GeneratedImage,
  PromptNode,
  WorkflowNode,
} from '../../types';
import { createEmptyWorkflowGraph } from '../types';

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

export const canvasToWorkflow = (canvas: Canvas): CanvasWorkflow => {
  const graph = createEmptyWorkflowGraph<WorkflowNode>();
  const edges = new Map<string, CanvasWorkflow['edges'][number]>();

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

  graph.edges = Array.from(edges.values());
  graph.metadata = {
    source: 'legacy-canvas',
    generatedAt: Date.now(),
    featureFlag: 'experimentalWorkflowGraph',
  };

  return graph;
};

export const syncCanvasWorkflow = (canvas: Canvas, enabled: boolean): Canvas =>
  enabled
    ? {
        ...canvas,
        workflow: canvasToWorkflow(canvas),
      }
    : canvas;
