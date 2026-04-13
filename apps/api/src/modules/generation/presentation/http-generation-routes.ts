import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type CreateGenerationTaskRequestDto,
  type GenerationTaskType,
} from "../../../../../../packages/contracts/src/index.ts";
import { resolveAuthenticatedUserId } from "../../../../../../packages/shared/src/index.ts";
import type { GenerationService } from "../application/generation-service.ts";

const supportedGenerationTaskTypes = new Set<GenerationTaskType>(["image", "video", "audio", "document"]);

function resolveRequesterId(headers: Record<string, string>): string | undefined {
  return resolveAuthenticatedUserId(headers);
}

export function validateCreateGenerationTaskRequest(body: unknown): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];
  if (!body || typeof body !== "object") {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<CreateGenerationTaskRequestDto>;

  if (!candidate.workspaceId || typeof candidate.workspaceId !== "string") {
    details.push({ field: "workspaceId", reason: "workspaceId is required." });
  }

  if (!candidate.workflowId || typeof candidate.workflowId !== "string") {
    details.push({ field: "workflowId", reason: "workflowId is required." });
  }

  if (!candidate.modelCode || typeof candidate.modelCode !== "string") {
    details.push({ field: "modelCode", reason: "modelCode is required." });
  }

  if (!candidate.prompt || typeof candidate.prompt !== "string") {
    details.push({ field: "prompt", reason: "prompt is required." });
  }

  if (!candidate.idempotencyKey || typeof candidate.idempotencyKey !== "string") {
    details.push({ field: "idempotencyKey", reason: "idempotencyKey is required." });
  }

  if (typeof candidate.attemptId !== "undefined" && typeof candidate.attemptId !== "string") {
    details.push({ field: "attemptId", reason: "attemptId must be a string when provided." });
  }

  if (!candidate.taskType || typeof candidate.taskType !== "string") {
    details.push({ field: "taskType", reason: "taskType is required." });
  } else if (!supportedGenerationTaskTypes.has(candidate.taskType)) {
    details.push({
      field: "taskType",
      reason: `taskType must be one of: ${Array.from(supportedGenerationTaskTypes).join(", ")}.`,
    });
  }

  if (typeof candidate.references !== "undefined") {
    if (!Array.isArray(candidate.references)) {
      details.push({ field: "references", reason: "references must be an array when provided." });
    } else if (candidate.references.some((reference) => typeof reference !== "string" || reference.length === 0)) {
      details.push({ field: "references", reason: "references must contain non-empty string ids." });
    }
  }

  return details;
}

export async function handleCreateGenerationTask(
  service: GenerationService,
  body: CreateGenerationTaskRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const requesterId = resolveRequesterId(headers);
  if (!requesterId) {
    return {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required to create generation tasks.",
      },
      meta: buildRequestMeta(requestId, headers["x-client-version"]),
    };
  }

  const validationErrors = validateCreateGenerationTaskRequest(body);
  if (validationErrors.length > 0) {
    return {
      success: false as const,
      error: {
        code: "INVALID_REQUEST",
        message: "Generation task request validation failed.",
        details: validationErrors,
      },
      meta: buildRequestMeta(requestId, headers["x-client-version"]),
    };
  }

  return service.createTask(body, requesterId, requestId, headers["x-client-version"]);
}

export async function handleGetGenerationTask(
  service: GenerationService,
  taskId: string,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const requesterId = resolveRequesterId(headers);
  if (!requesterId) {
    return {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required to view generation tasks.",
      },
      meta: buildRequestMeta(requestId, headers["x-client-version"]),
    };
  }

  return service.getTask(taskId, requesterId, requestId, headers["x-client-version"]);
}
