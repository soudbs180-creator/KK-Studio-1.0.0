import type { BillingRequest } from '../router.ts'

export class ThirdPartyEngine {
  private providerId: string

  constructor(providerId: string) {
    this.providerId = providerId
  }

  async handleChargePoints(_req: BillingRequest): Promise<any> {
    // Placeholder for third-party points billing.
    return { ok: true, engine_type: 'points', provider: this.providerId }
  }

  async handleTokenUsage(_req: BillingRequest): Promise<any> {
    // Placeholder for third-party token billing.
    return { ok: true, engine_type: 'token', provider: this.providerId }
  }
}
