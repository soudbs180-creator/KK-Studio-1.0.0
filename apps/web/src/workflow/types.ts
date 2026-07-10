import type { CanvasCardPresentation } from '@kk/shared';

export const WORKFLOW_GRAPH_VERSION = 1 as const;

export type WorkflowNodeKind =
  | 'prompt'
  | 'image'
  | 'video-input'
  | 'video-analyze'
  | 'storyboard'
  | 'agent'
  | 'preview'
  | 'save'
  | 'workflow-panel';

export type WorkflowEdgeRole =
  | 'input'
  | 'result'
  | 'reference'
  | 'control'
  | 'sequence';

export type WorkflowEdgeState = 'active' | 'disabled';

export interface WorkflowNodeBase<
  TKind extends WorkflowNodeKind = WorkflowNodeKind,
  TData = unknown,
> {
  id: string;
  kind: TKind;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  zIndex?: number;
  tags?: string[];
  label?: string;
  presentation?: CanvasCardPresentation;
  data: TData;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  role?: WorkflowEdgeRole;
  state?: WorkflowEdgeState;
  label?: string;
}

export interface WorkflowGraph<TNode extends WorkflowNodeBase = WorkflowNodeBase> {
  version: typeof WORKFLOW_GRAPH_VERSION;
  nodes: TNode[];
  edges: WorkflowEdge[];
  metadata?: {
    source?: 'legacy-canvas' | 'workflow-native';
    generatedAt?: number;
    featureFlag?: string;
    largeCanvasLegacyNodesStripped?: boolean;
    promptNodeCount?: number;
    imageNodeCount?: number;
  };
}

export const createEmptyWorkflowGraph = <
  TNode extends WorkflowNodeBase = WorkflowNodeBase,
>(): WorkflowGraph<TNode> => ({
  version: WORKFLOW_GRAPH_VERSION,
  nodes: [],
  edges: [],
});
