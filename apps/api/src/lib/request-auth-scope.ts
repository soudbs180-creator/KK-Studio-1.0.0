function readBearerToken(headers: Record<string, string>): string | undefined {
  const authorization = String(headers.authorization || "").trim();
  if (!authorization) {
    return undefined;
  }

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || undefined;
  }

  return authorization;
}

export function isPublicRouteBypassingBearerAuth(pathname: string): boolean {
  return pathname === "/api/v1/model-catalog/active"
    || pathname === "/api/v1/model-catalog/active-credit-models"
    || pathname === "/api/v1/model-catalog/models";
}

export function shouldAttemptBearerAuthentication(
  pathname: string,
  headers: Record<string, string>,
): boolean {
  if (isPublicRouteBypassingBearerAuth(pathname)) {
    return false;
  }

  return Boolean(readBearerToken(headers));
}
