import type { CanvasWorkflow, PromptNode, WorkflowNode } from '../../types';
import { normalizeReferenceImagesStorage } from '../../utils/referenceImageStorage.ts';
import { dedupeWorkflowEdges } from '../schema.ts';
import { createEmptyWorkflowGraph } from '../types';

const stripReferenceImageData = (
  referenceImages: PromptNode['referenceImages'],
  aggressive: boolean,
): PromptNode['referenceImages'] => (
  normalizeReferenceImagesStorage(referenceImages)?.map((ref) => {
    const shouldKeep = !aggressive && ref.data && ref.data.length < 500000;
    return {
      ...ref,
      data: shouldKeep ? ref.data : '',
    };
  })
);

export const stripWorkflowNodeTransientData = (
  node: WorkflowNode,
  aggressive: boolean,
): WorkflowNode => {
  if (node.kind === 'image') {
    return {
      ...node,
      data: {
        ...node.data,
        url: '',
        originalUrl: '',
      },
    };
  }

  if (node.kind === 'prompt') {
    return {
      ...node,
      data: {
        ...node.data,
        referenceImages: stripReferenceImageData(node.data.referenceImages, aggressive),
      },
    };
  }

  return node;
};

export const normalizeWorkflowGraph = (
  workflow?: CanvasWorkflow,
): CanvasWorkflow | undefined => {
  if (!workflow) return undefined;

  const normalized = createEmptyWorkflowGraph<WorkflowNode>();
  const nodes = new Map<string, WorkflowNode>();

  (workflow.nodes || []).forEach((node) => {
    if (!node?.id || !node?.kind) return;
    nodes.set(node.id, node);
  });

  const validNodeIds = new Set(nodes.keys());
  const edges = dedupeWorkflowEdges(
    (workflow.edges || []).filter((edge) => (
      !!edge?.from && !!edge?.to && validNodeIds.has(edge.from) && validNodeIds.has(edge.to)
    )),
  );

  return {
    ...normalized,
    ...workflow,
    nodes: Array.from(nodes.values()),
    edges,
    metadata: workflow.metadata ? { ...workflow.metadata } : workflow.metadata,
  };
};

export const sanitizeWorkflowForStorage = (
  workflow?: CanvasWorkflow,
  aggressive: boolean = false,
): CanvasWorkflow | undefined => {
  const normalized = normalizeWorkflowGraph(workflow);
  if (!normalized) return undefined;

  return {
    ...normalized,
    nodes: normalized.nodes.map((node) => stripWorkflowNodeTransientData(node, aggressive)),
  };
};
