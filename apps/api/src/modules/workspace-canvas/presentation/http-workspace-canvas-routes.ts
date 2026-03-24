import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type SaveCanvasLayoutRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  resolveAuthenticatedUserId,
} from "../../../../../../packages/shared/src/index.ts";
import type { WorkspaceCanvasService } from "../application/workspace-canvas-service.ts";

export async function handleGetWorkspaceCanvas(
  service: WorkspaceCanvasService,
  workspaceId: string,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const result = await service.getCanvasSummary(workspaceId, requestId, headers["x-client-version"]);

  return {
    statusCode: result.success ? 200 : 404,
    body: result,
  };
}

function buildUnauthorizedResult(requestId: string, clientVersion?: string) {
  return {
    statusCode: 401,
    body: {
      success: false as const,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required for workspace layout sync.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export function validateSaveCanvasLayoutRequest(body: unknown): ApiErrorDetail[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as Partial<SaveCanvasLayoutRequestDto>;
  if (!Array.isArray(candidate.canvases)) {
    return [{ field: "canvases", reason: "canvases must be an array." }];
  }

  return [];
}

export async function handleGetWorkspaceLayout(
  service: WorkspaceCanvasService,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  return {
    statusCode: 200,
    body: await service.getCanvasLayout(userId, requestId, clientVersion),
  };
}

export async function handleSaveWorkspaceLayout(
  service: WorkspaceCanvasService,
  body: SaveCanvasLayoutRequestDto,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  const validationErrors = validateSaveCanvasLayoutRequest(body);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Workspace layout request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  return {
    statusCode: 200,
    body: await service.saveCanvasLayout(userId, body, requestId, clientVersion),
  };
}

export async function handleCleanupCloudImages(
  service: WorkspaceCanvasService,
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const userId = resolveAuthenticatedUserId(headers);

  if (!userId) {
    return buildUnauthorizedResult(requestId, clientVersion);
  }

  return {
    statusCode: 200,
    body: await service.cleanupCloudImages(userId, requestId, clientVersion),
  };
}
