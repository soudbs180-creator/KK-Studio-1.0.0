import type {
  Canvas,
  GeneratedImage,
  PromptNode,
  WorkflowNode,
} from '../../types';

const indexWorkflowEdges = (nodes: WorkflowNode[]) => {
  const incoming = new Map<string, WorkflowNode[]>();
  const outgoing = new Map<string, WorkflowNode[]>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return {
    nodeById,
    attachOutgoing(nodeId: string, targetId: string) {
      const target = nodeById.get(targetId);
      if (!target) return;
      const bucket = outgoing.get(nodeId) || [];
      bucket.push(target);
      outgoing.set(nodeId, bucket);
    },
    attachIncoming(nodeId: string, sourceId: string) {
      const source = nodeById.get(sourceId);
      if (!source) return;
      const bucket = incoming.get(nodeId) || [];
      bucket.push(source);
      incoming.set(nodeId, bucket);
    },
    incoming,
    outgoing,
  };
};

export const workflowToLegacyCanvas = (canvas: Canvas): Canvas => {
  if (!canvas.workflow || (!canvas.workflow.nodes?.length && !canvas.workflow.edges?.length)) {
    return canvas;
  }

  const hasLegacyData = (canvas.promptNodes?.length || 0) > 0 || (canvas.imageNodes?.length || 0) > 0;
  if (hasLegacyData) {
    return canvas;
  }

  const workflowNodes = canvas.workflow.nodes || [];
  const edgeIndex = indexWorkflowEdges(workflowNodes);

  (canvas.workflow.edges || []).forEach((edge) => {
    edgeIndex.attachOutgoing(edge.from, edge.to);
    edgeIndex.attachIncoming(edge.to, edge.from);
  });

  const promptNodes = workflowNodes
    .filter((node): node is Extract<WorkflowNode, { kind: 'prompt' }> => node.kind === 'prompt')
    .map((node): PromptNode => {
      const childImageIdsFromEdges = (edgeIndex.outgoing.get(node.id) || [])
        .filter((target): target is Extract<WorkflowNode, { kind: 'image' }> => target.kind === 'image')
        .map((target) => target.id);

      const sourceImage = (edgeIndex.incoming.get(node.id) || [])
        .find((source): source is Extract<WorkflowNode, { kind: 'image' }> => source.kind === 'image');

      return {
        ...node.data,
        id: node.id,
        position: node.position,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
        tags: node.tags || node.data.tags,
        childImageIds: Array.from(new Set([
          ...(node.data.childImageIds || []),
          ...childImageIdsFromEdges,
        ])),
        sourceImageId: node.data.sourceImageId || sourceImage?.id,
      };
    });

  const promptIds = new Set(promptNodes.map((node) => node.id));
  const imageNodes = workflowNodes
    .filter((node): node is Extract<WorkflowNode, { kind: 'image' }> => node.kind === 'image')
    .map((node): GeneratedImage => {
      const parentPrompt = (edgeIndex.incoming.get(node.id) || [])
        .find((source): source is Extract<WorkflowNode, { kind: 'prompt' }> => source.kind === 'prompt');

      const nextParentPromptId = node.data.parentPromptId || parentPrompt?.id || '';

      return {
        ...node.data,
        id: node.id,
        position: node.position,
        zIndex: node.zIndex,
        tags: node.tags || node.data.tags,
        parentPromptId: nextParentPromptId,
        canvasId: node.data.canvasId || canvas.id,
        orphaned: node.data.orphaned || (nextParentPromptId ? !promptIds.has(nextParentPromptId) : node.data.orphaned),
      };
    });

  return {
    ...canvas,
    promptNodes,
    imageNodes,
    groups: canvas.groups || [],
    drawings: canvas.drawings || [],
  };
};
