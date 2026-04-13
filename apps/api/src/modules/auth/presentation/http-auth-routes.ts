import { randomUUID } from "node:crypto";

import {
  buildRequestMeta,
  type ApiErrorDetail,
  type ApiResponse,
  type LoginRequestDto,
  type LoginResponseDto,
  type ProfileDto,
  type RegisterRequestDto,
  type RegisterResponseDto,
  type UpdateProfileRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { validateAuthEmail } from "../domain/email-policy.ts";
import type { AuthRequestContext, AuthService } from "../application/auth-service.ts";

interface HttpAuthRouteResult<T> {
  statusCode: number;
  body: ApiResponse<T>;
}

function toRequestContext(ip: string): AuthRequestContext {
  return { ip };
}

function buildSuccessEnvelope<T>(
  requestId: string,
  clientVersion: string | undefined,
  statusCode: number,
  data: T,
): HttpAuthRouteResult<T> {
  return {
    statusCode,
    body: {
      success: true,
      data,
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function buildErrorEnvelope<T>(
  requestId: string,
  clientVersion: string | undefined,
  statusCode: number,
  message: string,
  details?: ApiErrorDetail[],
): HttpAuthRouteResult<T> {
  const code = statusCode === 429
    ? "RATE_LIMITED"
    : statusCode === 409
      ? "AUTH_CONFLICT"
      : statusCode === 401
        ? "AUTH_REQUIRED"
        : statusCode === 501 || statusCode === 410
          ? "AUTH_ROUTE_DISABLED"
          : statusCode === 403
            ? "TURNSTILE_FAILED"
            : "AUTH_INVALID_REQUEST";

  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

function validateRegisterRequest(body: RegisterRequestDto): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];

  if (!body || typeof body !== "object") {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  if (!body.email || typeof body.email !== "string") {
    details.push({ field: "email", reason: "email is required." });
  } else {
    const result = validateAuthEmail(body.email);
    if (result.ok === false) {
      details.push({ field: "email", reason: result.error });
    }
  }

  if (!body.password || typeof body.password !== "string") {
    details.push({ field: "password", reason: "password is required." });
  } else if (body.password.length < 8) {
    details.push({ field: "password", reason: "password must be at least 8 characters." });
  }

  if (!body.turnstileToken || typeof body.turnstileToken !== "string") {
    details.push({ field: "turnstileToken", reason: "turnstileToken is required." });
  }

  return details;
}

function validateLoginRequest(body: LoginRequestDto): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];

  if (!body || typeof body !== "object") {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  if (!body.email || typeof body.email !== "string") {
    details.push({ field: "email", reason: "email is required." });
  } else {
    const result = validateAuthEmail(body.email);
    if (result.ok === false) {
      details.push({ field: "email", reason: result.error });
    }
  }

  if (!body.password || typeof body.password !== "string") {
    details.push({ field: "password", reason: "password is required." });
  }

  return details;
}

function validateUpdateProfileRequest(body: unknown): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", reason: "Request body must be an object." }];
  }

  const candidate = body as UpdateProfileRequestDto;

  if (typeof candidate.nickname !== "undefined") {
    if (typeof candidate.nickname !== "string") {
      details.push({ field: "nickname", reason: "nickname must be a string when provided." });
    } else if (candidate.nickname.trim().length > 64) {
      details.push({ field: "nickname", reason: "nickname must be 64 characters or fewer." });
    }
  }

  if (typeof candidate.avatarUrl !== "undefined") {
    if (typeof candidate.avatarUrl !== "string") {
      details.push({ field: "avatarUrl", reason: "avatarUrl must be a string when provided." });
    } else {
      try {
        if (candidate.avatarUrl.trim()) {
          new URL(candidate.avatarUrl);
        }
      } catch {
        details.push({ field: "avatarUrl", reason: "avatarUrl must be a valid absolute URL." });
      }
    }
  }

  return details;
}

export async function handleVersionedRegister(
  service: AuthService,
  body: RegisterRequestDto,
  headers: Record<string, string>,
  ip: string,
): Promise<HttpAuthRouteResult<RegisterResponseDto>> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const validationErrors = validateRegisterRequest(body);
  if (validationErrors.length > 0) {
    return buildErrorEnvelope(requestId, clientVersion, 400, "Register request validation failed.", validationErrors);
  }

  const result = await service.register(body, toRequestContext(ip));
  if (!result.body.success) {
    return buildErrorEnvelope(requestId, clientVersion, result.statusCode, result.body.error || "Register failed.");
  }

  return buildSuccessEnvelope(
    requestId,
    clientVersion,
    result.statusCode,
    result.body.data as RegisterResponseDto,
  );
}

export async function handleVersionedLogin(
  service: AuthService,
  body: LoginRequestDto,
  headers: Record<string, string>,
  ip: string,
): Promise<HttpAuthRouteResult<LoginResponseDto>> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const validationErrors = validateLoginRequest(body);
  if (validationErrors.length > 0) {
    return buildErrorEnvelope(requestId, clientVersion, 400, "Login request validation failed.", validationErrors);
  }

  const result = await service.login(body, toRequestContext(ip));
  if (!result.body.success) {
    return buildErrorEnvelope(requestId, clientVersion, result.statusCode, result.body.error || "Login failed.");
  }

  return buildSuccessEnvelope(
    requestId,
    clientVersion,
    result.statusCode,
    result.body.data as LoginResponseDto,
  );
}

export async function handleGetProfile(
  service: AuthService,
  headers: Record<string, string>,
): Promise<HttpAuthRouteResult<ProfileDto>> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const profile = service.getProfile(headers);

  if (!profile) {
    return buildErrorEnvelope(requestId, clientVersion, 401, "Authentication is required to access the profile.");
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      data: profile,
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}

export async function handleUpdateProfile(
  service: AuthService,
  body: UpdateProfileRequestDto,
  headers: Record<string, string>,
): Promise<HttpAuthRouteResult<ProfileDto>> {
  const requestId = headers["x-request-id"] || randomUUID();
  const clientVersion = headers["x-client-version"];
  const validationErrors = validateUpdateProfileRequest(body);
  if (validationErrors.length > 0) {
    return buildErrorEnvelope(requestId, clientVersion, 400, "Profile request validation failed.", validationErrors);
  }

  const updated = service.updateProfile(headers, body);
  if (!updated) {
    return buildErrorEnvelope(requestId, clientVersion, 401, "Authentication is required to update the profile.");
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      data: updated,
      meta: buildRequestMeta(requestId, clientVersion),
    },
  };
}
