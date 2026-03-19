import type { BillingRequest } from '../router.ts'

export class ProxyVendorEngine {
  async handleChargePoints(_req: BillingRequest): Promise<any> {
    // Placeholder for proxy-vendor points billing.
    return { ok: true, engine_type: 'points', provider: 'proxy_vendor' }
  }

  async handleTokenUsage(_req: BillingRequest): Promise<any> {
    // Placeholder for proxy-vendor token billing.
    return { ok: true, engine_type: 'token', provider: 'proxy_vendor' }
  }
}
