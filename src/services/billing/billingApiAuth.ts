export function isBillingAuthFailure(
  response: {
    success: boolean;
    error?: { code?: string | null } | null;
  },
): boolean {
  if (response.success) {
    return false;
  }

  const code = String(response.error?.code || "").trim().toUpperCase();
  return code === "AUTH_REQUIRED" || code === "HTTP_401" || code === "HTTP_403";
}
