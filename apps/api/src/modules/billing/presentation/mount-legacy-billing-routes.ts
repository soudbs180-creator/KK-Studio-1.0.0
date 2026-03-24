import { BillingService } from "../application/billing-service.ts";
import { authorizeInternalBillingRequest } from "../domain/billing-auth-policy.ts";

interface LegacyApp {
  post(path: string, handler: (req: any, res: any) => Promise<void> | void): void;
}

function guardBillingRoute(req: any, res: any): boolean {
  const auth = authorizeInternalBillingRequest(req);
  if (auth.ok) return true;

  res.status(auth.status).json({
    success: false,
    error: auth.error,
  });
  return false;
}

function normalizeHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (Array.isArray(value)) {
      normalized[key] = String(value[0] || "");
    } else if (typeof value !== "undefined") {
      normalized[key] = String(value);
    }
  }
  return normalized;
}

export function mountLegacyBillingRoutes(app: LegacyApp, billingService: BillingService) {
  app.post("/billing", async (req: any, res: any) => {
    if (!guardBillingRoute(req, res)) return;
    const result = await billingService.route(req.body || {}, normalizeHeaders(req.headers));
    res.status(result.statusCode).json(result.body);
  });

  app.post("/billing/points/charge", async (req: any, res: any) => {
    if (!guardBillingRoute(req, res)) return;
    const body = Object.assign({}, req.body, { billing_mode: "points" });
    const result = await billingService.route(body, normalizeHeaders(req.headers));
    res.status(result.statusCode).json(result.body);
  });

  app.post("/billing/token/use", async (req: any, res: any) => {
    if (!guardBillingRoute(req, res)) return;
    const body = Object.assign({}, req.body, { billing_mode: "token" });
    const result = await billingService.route(body, normalizeHeaders(req.headers));
    res.status(result.statusCode).json(result.body);
  });
}
