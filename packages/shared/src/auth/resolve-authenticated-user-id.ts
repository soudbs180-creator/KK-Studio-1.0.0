export const AUTHENTICATED_USER_ID_HEADER = "x-authenticated-user-id";
export const AUTHENTICATED_USER_EMAIL_HEADER = "x-authenticated-user-email";
export const AUTHENTICATED_USER_ROLE_HEADER = "x-authenticated-user-role";
export const ADMIN_SESSION_TOKEN_HEADER = "x-admin-session-token";
export const AUTHENTICATED_ADMIN_SESSION_HEADER = "x-authenticated-admin-session";
export const AUTHENTICATED_ADMIN_SESSION_EXPIRES_AT_HEADER = "x-authenticated-admin-session-expires-at";
export const TEMP_USER_ID_HEADER = "x-kk-temp-user-id";

export interface AuthenticatedAdminSession {
  active: boolean;
  expiresAt?: string;
}

function readInternalHeader(
  headers: Record<string, string>,
  headerName: string,
): string | undefined {
  const value = String(headers[headerName] || "").trim();
  return value || undefined;
}

export function resolveAuthenticatedUserId(
  headers: Record<string, string>,
  options?: { fallbackUserId?: string },
): string | undefined {
  const authenticatedUserId = readInternalHeader(headers, AUTHENTICATED_USER_ID_HEADER);
  if (authenticatedUserId) {
    return authenticatedUserId;
  }

  const fallbackUserId = String(options?.fallbackUserId || "").trim();
  if (fallbackUserId) {
    return fallbackUserId;
  }

  return undefined;
}

export function resolveAuthenticatedUserEmail(
  headers: Record<string, string>,
): string | undefined {
  return readInternalHeader(headers, AUTHENTICATED_USER_EMAIL_HEADER);
}

export function resolveAuthenticatedUserRole(
  headers: Record<string, string>,
): string | undefined {
  return readInternalHeader(headers, AUTHENTICATED_USER_ROLE_HEADER);
}

export function resolveAdminSessionToken(
  headers: Record<string, string>,
): string | undefined {
  return readInternalHeader(headers, ADMIN_SESSION_TOKEN_HEADER);
}

export function resolveTempUserId(
  headers: Record<string, string>,
): string | undefined {
  return readInternalHeader(headers, TEMP_USER_ID_HEADER);
}

export function resolveAuthenticatedAdminSession(
  headers: Record<string, string>,
): AuthenticatedAdminSession {
  const active = String(headers[AUTHENTICATED_ADMIN_SESSION_HEADER] || "").trim().toLowerCase() === "true";
  if (!active) {
    return {
      active: false,
    };
  }

  return {
    active: true,
    expiresAt: readInternalHeader(headers, AUTHENTICATED_ADMIN_SESSION_EXPIRES_AT_HEADER),
  };
}
