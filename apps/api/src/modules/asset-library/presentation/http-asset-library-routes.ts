import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type AssetKind,
} from "../../../../../../packages/contracts/src/index.ts";
import { resolveAuthenticatedUserId } from "../../../../../../packages/shared/src/index.ts";
import type { AssetLibraryService } from "../application/asset-library-service.ts";

const supportedAssetKinds = new Set<AssetKind>(["image", "video", "audio", "document"]);

function hasAssetAccess(headers: Record<string, string>): boolean {
  return Boolean(resolveAuthenticatedUserId(headers));
}

export function validateListAssetsQuery(input: {
  kind?: string;
  cursor?: string;
  limit?: string;
}): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];

  if (typeof input.kind !== "undefined" && !supportedAssetKinds.has(input.kind as AssetKind)) {
    details.push({ field: "kind", reason: `kind must be one of: ${Array.from(supportedAssetKinds).join(", ")}.` });
  }

  if (typeof input.cursor !== "undefined" && Number.isNaN(Number.parseInt(input.cursor, 10))) {
    details.push({ field: "cursor", reason: "cursor must be a numeric string when provided." });
  }

  if (typeof input.limit !== "undefined") {
    const parsedLimit = Number.parseInt(input.limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      details.push({ field: "limit", reason: "limit must be between 1 and 100." });
    }
  }

  return details;
}

export async function handleListAssets(
  service: AssetLibraryService,
  query: { kind?: string; cursor?: string; limit?: string },
  headers: Record<string, string>,
) {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];

  if (!hasAssetAccess(headers)) {
    return {
      statusCode: 401,
      body: {
        success: false as const,
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication is required to access assets.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const validationErrors = validateListAssetsQuery(query);
  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false as const,
        error: {
          code: "INVALID_REQUEST",
          message: "Asset list request validation failed.",
          details: validationErrors,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      },
    };
  }

  const result = await service.listAssets({
    kind: query.kind as AssetKind | undefined,
    cursor: query.cursor,
    limit: query.limit ? Number.parseInt(query.limit, 10) : 20,
  }, requestId, clientVersion);

  return {
    statusCode: 200,
    body: result,
  };
}
