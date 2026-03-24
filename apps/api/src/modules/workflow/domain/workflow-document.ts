import { randomUUID } from "node:crypto";

import type {
  EntityId,
  SaveWorkflowRequestDto,
  WorkflowDocumentDto,
  WorkflowEdgeDto,
  WorkflowNodeDto,
} from "../../../../../../packages/contracts/src/index.ts";

const allowedWorkflowNodeKinds = new Set([
  "prompt",
  "image",
  "video-input",
  "video-analyze",
  "storyboard",
  "preview",
  "save",
  "agent",
]);

function dedupeNodes(nodes: WorkflowNodeDto[]): WorkflowNodeDto[] {
  const map = new Map<string, WorkflowNodeDto>();
  for (const node of nodes) {
    if (!node?.id || !allowedWorkflowNodeKinds.has(node.nodeType)) continue;
    map.set(node.id, node);
  }
  return Array.from(map.values());
}

function dedupeEdges(edges: WorkflowEdgeDto[], validNodeIds: Set<string>): WorkflowEdgeDto[] {
  const map = new Map<string, WorkflowEdgeDto>();
  for (const edge of edges) {
    if (!edge?.from || !edge?.to) continue;
    if (!validNodeIds.has(edge.from) || !validNodeIds.has(edge.to)) continue;
    const id = edge.id || `${edge.from}:${edge.role || "link"}:${edge.to}:${edge.state || "active"}`;
    if (!map.has(id)) {
      map.set(id, { ...edge, id });
    }
  }
  return Array.from(map.values());
}

export function normalizeWorkflowDocument(
  document: WorkflowDocumentDto,
): WorkflowDocumentDto {
  const nodes = dedupeNodes(document.nodes || []);
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const edges = dedupeEdges(document.edges || [], validNodeIds);

  return {
    ...document,
    nodes,
    edges,
  };
}

export function createWorkflowDocument(
  input: SaveWorkflowRequestDto,
  context: {
    workflowId?: EntityId;
    workspaceId: EntityId;
    canvasId: EntityId;
    createdAt?: string;
    updatedAt?: string;
  },
): WorkflowDocumentDto {
  const updatedAt = context.updatedAt || new Date().toISOString();
  const createdAt = context.createdAt || updatedAt;
  return normalizeWorkflowDocument({
    id: context.workflowId || randomUUID(),
    workspaceId: context.workspaceId,
    canvasId: context.canvasId,
    name: input.name,
    status: input.status || "draft",
    version: input.version,
    nodes: input.nodes,
    edges: input.edges || [],
    createdAt,
    updatedAt,
  });
}
