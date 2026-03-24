export interface BillingAuthorizationResult {
  ok: boolean;
  status: number;
  error?: string;
}

export function authorizeInternalBillingRequest(req: any): BillingAuthorizationResult {
  const configuredToken = String(process.env.BILLING_INTERNAL_TOKEN || "").trim();
  if (!configuredToken) {
    return {
      ok: false,
      status: 503,
      error: "Billing routes are disabled until BILLING_INTERNAL_TOKEN is configured.",
    };
  }

  const headerToken = String(
    req.headers?.["x-billing-internal-token"] || req.headers?.["X-Billing-Internal-Token"] || "",
  ).trim();
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const candidate = headerToken || bearerToken;

  if (!candidate || candidate !== configuredToken) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized billing request.",
    };
  }

  return {
    ok: true,
    status: 200,
  };
}
