import { createHmac, timingSafeEqual } from "node:crypto";

const LOCAL_PROXY_TASK_PREFIX = "local_proxy:";
const DEFAULT_LOCAL_ROUTE_TASK_SECRET = "kkai-local-route-task-secret";

export type LocalUserRouteTaskPayload = {
  v: 1;
  userId: string;
  routeId: string;
  taskId: string;
  mode?: "image" | "video";
  requestId?: string;
  attemptId?: string;
};

export type LocalUserRouteTaskSigningSecretConfig = {
  taskSigningSecret?: string;
  allowInsecureLocalTaskSigningFallback?: boolean;
};

export type LocalUserRouteTaskSigningSecretResult =
  | { ok: true; secret: string }
  | {
      ok: false;
      code: "TASK_SIGNING_SECRET_REQUIRED";
      statusCode: 500;
      message: string;
    };

export type LocalUserRouteTaskTokenResult =
  | { ok: true; payload: LocalUserRouteTaskPayload }
  | {
      ok: false;
      code: "INVALID_TASK_ID";
      statusCode: 400;
      message: string;
    };

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const normalized = String(input || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${"=".repeat(padLength)}`, "base64");
}

export function resolveLocalUserRouteTaskSigningSecret(
  config: LocalUserRouteTaskSigningSecretConfig,
): LocalUserRouteTaskSigningSecretResult {
  const explicitSecret = String(config.taskSigningSecret || "").trim();
  if (explicitSecret) {
    return { ok: true, secret: explicitSecret };
  }

  if (config.allowInsecureLocalTaskSigningFallback === true) {
    return { ok: true, secret: DEFAULT_LOCAL_ROUTE_TASK_SECRET };
  }

  return {
    ok: false,
    code: "TASK_SIGNING_SECRET_REQUIRED",
    statusCode: 500,
    message: "Local user-route task signing secret is not configured.",
  };
}

export function encodeLocalUserRouteTaskToken(
  payload: LocalUserRouteTaskPayload,
  taskSigningSecret: string,
): string {
  const serialized = JSON.stringify(payload);
  const encodedPayload = toBase64Url(serialized);
  const signature = toBase64Url(
    createHmac("sha256", taskSigningSecret)
      .update(encodedPayload)
      .digest(),
  );
  return `${LOCAL_PROXY_TASK_PREFIX}${encodedPayload}.${signature}`;
}

export function decodeLocalUserRouteTaskToken(
  token: string,
  expectedUserId: string,
  taskSigningSecret: string,
): LocalUserRouteTaskTokenResult {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken.startsWith(LOCAL_PROXY_TASK_PREFIX)) {
    return {
      ok: false,
      code: "INVALID_TASK_ID",
      statusCode: 400,
      message: "Invalid local task id.",
    };
  }

  const signedPayload = normalizedToken.slice(LOCAL_PROXY_TASK_PREFIX.length);
  const separatorIndex = signedPayload.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return {
      ok: false,
      code: "INVALID_TASK_ID",
      statusCode: 400,
      message: "Invalid local task token signature.",
    };
  }

  const encodedPayload = signedPayload.slice(0, separatorIndex);
  const providedSignature = signedPayload.slice(separatorIndex + 1);
  const expectedSignature = toBase64Url(
    createHmac("sha256", taskSigningSecret)
      .update(encodedPayload)
      .digest(),
  );

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return {
      ok: false,
      code: "INVALID_TASK_ID",
      statusCode: 400,
      message: "Local task token verification failed.",
    };
  }

  let payload: LocalUserRouteTaskPayload | null = null;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as LocalUserRouteTaskPayload;
  } catch {
    payload = null;
  }

  if (
    !payload
    || payload.v !== 1
    || String(payload.userId || "").trim() !== expectedUserId
    || !String(payload.routeId || "").trim()
    || !String(payload.taskId || "").trim()
  ) {
    return {
      ok: false,
      code: "INVALID_TASK_ID",
      statusCode: 400,
      message: "Local task token payload is invalid.",
    };
  }

  return {
    ok: true,
    payload,
  };
}
