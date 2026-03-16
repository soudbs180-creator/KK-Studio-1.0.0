// Lightweight HTTP gateway for Billing routing (production-ready skeleton)
import { BillingRouter } from '../billing/router'
import { PointsChargeHandler } from '../billing/points/charge_points'
import { TokenUsageHandler } from '../billing/token/usage_token'
import { GoogleOfficialEngine } from '../billing/engines/google_official'
import { ProxyVendorEngine } from '../billing/engines/proxy_vendor'
import { ProviderGate } from '../billing/provider_gate'

function authorizeBillingRequest(req: any): { ok: true } | { ok: false; status: number; error: string } {
  const configuredToken = String(process.env.BILLING_INTERNAL_TOKEN || '').trim()
  if (!configuredToken) {
    return {
      ok: false,
      status: 503,
      error: 'Billing routes are disabled until BILLING_INTERNAL_TOKEN is configured.',
    }
  }

  const headerToken = String(
    req.headers?.['x-billing-internal-token']
      || req.headers?.['X-Billing-Internal-Token']
      || ''
  ).trim()
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '').trim()
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''
  const candidate = headerToken || bearerToken

  if (!candidate || candidate !== configuredToken) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized billing request.',
    }
  }

  return { ok: true }
}

function guardBillingRoute(req: any, res: any): boolean {
  const auth = authorizeBillingRequest(req)
  if (auth.ok) return true

  res.status(auth.status).json({
    success: false,
    error: auth.error,
  })
  return false
}

export function mountBillingRoutes(app: any) {
  // Initialize engine handlers
  const pointsHandler = new PointsChargeHandler()
  const tokenHandler = new TokenUsageHandler()
  // Initialize gateway with known engines (placeholders for now)
  const br = new BillingRouter(pointsHandler, tokenHandler)

  // Legacy generic endpoint
  app.post('/billing', async (req: any, res: any) => {
    if (!guardBillingRoute(req, res)) return
    const brReq = { headers: req.headers || {}, body: req.body || {} }
    try {
      const result = await br.route(brReq)
      res.json({ success: true, data: result })
    } catch (e: any) {
      res.status(400).json({ success: false, error: e?.message || String(e) })
    }
  })

  // Explicit provider endpoints (points path)
  app.post('/billing/points/charge', async (req: any, res: any) => {
    if (!guardBillingRoute(req, res)) return
    const brReq = { headers: req.headers || {}, body: Object.assign({}, req.body, { billing_mode: 'points' }) }
    try {
      const result = await br.route(brReq)
      res.json({ success: true, data: result })
    } catch (e: any) {
      res.status(400).json({ success: false, error: e?.message || String(e) })
    }
  })

  // Explicit provider endpoints (token path)
  app.post('/billing/token/use', async (req: any, res: any) => {
    if (!guardBillingRoute(req, res)) return
    const brReq = { headers: req.headers || {}, body: Object.assign({}, req.body, { billing_mode: 'token' }) }
    try {
      const result = await br.route(brReq)
      res.json({ success: true, data: result })
    } catch (e: any) {
      res.status(400).json({ success: false, error: e?.message || String(e) })
    }
  })
}
