import { randomUUID } from "node:crypto";

import {
  WorkflowNodeType,
  buildRequestMeta,
  type ApiErrorDetail,
  type SaveWorkflowRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { WorkflowService } from "../application/workflow-service.ts";

const allowedWorkflowNodeTypes = new Set<string>(Object.values(WorkflowNodeType));

export function validateSaveWorkflowRequest(body: unknown): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];
  if (!body || typeof body !== "object") {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<SaveWorkflowRequestDto>;

  if (!candidate.name || typeof candidate.name !== "string") {
    details.push({ field: "name", reason: "name is required." });
  }

  if (typeof candidate.version !== "number" || !Number.isInteger(candidate.version) || candidate.version < 1) {
    details.push({ field: "version", reason: "version must be a positive integer." });
  }

  if (!Array.isArray(candidate.nodes)) {
    details.push({ field: "nodes", reason: "nodes is required and must be an array." });
  } else {
    candidate.nodes.forEach((node, index) => {
      if (!node || typeof node !== "object") {
        details.push({ field: `nodes[${index}]`, reason: "node must be an object." });
        return;
      }

      if (!node.id || typeof node.id !== "string") {
        details.push({ field: `nodes[${index}].id`, reason: "id is required." });
      }

      if (!node.nodeType || typeof node.nodeType !== "string" || !allowedWorkflowNodeTypes.has(node.nodeType)) {
        details.push({
          field: `nodes[${index}].nodeType`,
          reason: `nodeType must be one of: ${Array.from(allowedWorkflowNodeTypes).join(", ")}.`,
        });
      }

      if (!node.position || typeof node.position !== "object") {
        details.push({ field: `nodes[${index}].position`, reason: "position is required." });
      } else {
        const position = node.position as { x?: unknown; y?: unknown };
        if (typeof position.x !== "number" || typeof position.y !== "number") {
          details.push({ field: `nodes[${index}].position`, reason: "position.x and position.y must be numbers." });
        }
      }

      if (!node.config || typeof node.config !== "object" || Array.isArray(node.config)) {
        details.push({ field: `nodes[${index}].config`, reason: "config must be an object." });
      }
    });
  }

  if (typeof candidate.edges !== "undefined") {
    if (!Array.isArray(candidate.edges)) {
      details.push({ field: "edges", reason: "edges must be an array when provided." });
    } else {
      candidate.edges.forEach((edge, index) => {
        if (!edge || typeof edge !== "object") {
          details.push({ field: `edges[${index}]`, reason: "edge must be an object." });
          return;
        }

        if (!edge.from || typeof edge.from !== "string") {
          details.push({ field: `edges[${index}].from`, reason: "from is required." });
        }

        if (!edge.to || typeof edge.to !== "string") {
          details.push({ field: `edges[${index}].to`, reason: "to is required." });
        }
      });
    }
  }

  return details;
}

export async function handleSaveWorkflow(
  service: WorkflowService,
  workspaceId: string,
  workflowId: string,
  body: SaveWorkflowRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const validationErrors = validateSaveWorkflowRequest(body);
  if (validationErrors.length > 0) {
    return {
      success: false as const,
      error: {
        code: "INVALID_REQUEST",
        message: "Workflow request validation failed.",
        details: validationErrors,
      },
      meta: buildRequestMeta(requestId, headers["x-client-version"]),
    };
  }

  return service.saveWorkflow(workflowId, workspaceId, body, requestId, headers["x-client-version"]);
}

export async function handleGetWorkflow(
  service: WorkflowService,
  workspaceId: string,
  workflowId: string,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  return service.getWorkflow(workspaceId, workflowId, requestId, headers["x-client-version"]);
}
