import type { WorkflowEdge, WorkflowNodeBase, WorkflowNodeKind } from './types';

export const LEGACY_WORKFLOW_NODE_KINDS = ['prompt', 'image'] as const;
export const WORKFLOW_UTILITY_NODE_KINDS = ['preview', 'save', 'agent', 'workflow-panel'] as const;
export const WORKFLOW_HIGH_RISK_NODE_KINDS = ['video-input', 'video-analyze', 'storyboard'] as const;

export type LegacyWorkflowNodeKind = typeof LEGACY_WORKFLOW_NODE_KINDS[number];
export type WorkflowUtilityNodeKind = typeof WORKFLOW_UTILITY_NODE_KINDS[number];
export type WorkflowHighRiskNodeKind = typeof WORKFLOW_HIGH_RISK_NODE_KINDS[number];
export type WorkflowRenderableNodeKind = LegacyWorkflowNodeKind | WorkflowUtilityNodeKind;

const LEGACY_WORKFLOW_NODE_KIND_SET = new Set<string>(LEGACY_WORKFLOW_NODE_KINDS);
const WORKFLOW_UTILITY_NODE_KIND_SET = new Set<string>(WORKFLOW_UTILITY_NODE_KINDS);
const WORKFLOW_HIGH_RISK_NODE_KIND_SET = new Set<string>(WORKFLOW_HIGH_RISK_NODE_KINDS);

export const isLegacyWorkflowNodeKind = (
  kind: WorkflowNodeKind | string,
): kind is LegacyWorkflowNodeKind => LEGACY_WORKFLOW_NODE_KIND_SET.has(kind);

export const isWorkflowUtilityNodeKind = (
  kind: WorkflowNodeKind | string,
): kind is WorkflowUtilityNodeKind => WORKFLOW_UTILITY_NODE_KIND_SET.has(kind);

export const isWorkflowHighRiskNodeKind = (
  kind: WorkflowNodeKind | string,
): kind is WorkflowHighRiskNodeKind => WORKFLOW_HIGH_RISK_NODE_KIND_SET.has(kind);

export const isWorkflowRenderableNodeKind = (
  kind: WorkflowNodeKind | string,
): kind is WorkflowRenderableNodeKind => (
  isLegacyWorkflowNodeKind(kind) || isWorkflowUtilityNodeKind(kind)
);

export const isWorkflowUtilityNode = <TNode extends WorkflowNodeBase>(
  node: TNode,
): boolean => isWorkflowUtilityNodeKind(node.kind);

export const createWorkflowEntityId = (prefix: string = 'wf'): string => (
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
);

export const dedupeWorkflowEdges = (edges: WorkflowEdge[]): WorkflowEdge[] => {
  const seen = new Map<string, WorkflowEdge>();

  edges.forEach((edge) => {
    if (!edge.from || !edge.to) return;
    const signature = edge.id || `${edge.from}:${edge.role || 'link'}:${edge.to}:${edge.state || 'active'}`;
    if (!seen.has(signature)) {
      seen.set(signature, edge.id ? edge : { ...edge, id: signature });
    }
  });

  return Array.from(seen.values());
};
