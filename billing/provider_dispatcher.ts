import type { BillingRequest } from './router.ts'
import { PointsChargeHandler } from './points/charge_points.ts'
import { TokenUsageHandler } from './token/usage_token.ts'
import { GoogleOfficialEngine } from './engines/google_official.ts'
import { ProxyVendorEngine } from './engines/proxy_vendor.ts'
import { ThirdPartyEngine } from './engines/third_party.ts'

export type ProviderId = string

export class ProviderDispatcher {
  private pointsEngine: PointsChargeHandler
  private tokenEngine: TokenUsageHandler
  private googleEngine: GoogleOfficialEngine
  private proxyVendorEngine: ProxyVendorEngine
  private thirdPartyEngines: Map<string, ThirdPartyEngine>

  constructor(
    pointsEngine: PointsChargeHandler,
    tokenEngine: TokenUsageHandler,
    googleEngine: GoogleOfficialEngine,
    proxyVendorEngine: ProxyVendorEngine
  ) {
    this.pointsEngine = pointsEngine
    this.tokenEngine = tokenEngine
    this.googleEngine = googleEngine
    this.proxyVendorEngine = proxyVendorEngine
    this.thirdPartyEngines = new Map()
  }

  async dispatchCharge(req: BillingRequest, providerId: ProviderId) {
    switch (providerId) {
      case 'embedded_points':
        return this.pointsEngine.handleChargePoints(req)
      case 'google_official':
        return this.googleEngine.handleChargePoints(req)
      case 'proxy_vendor':
        return this.proxyVendorEngine.handleChargePoints(req)
      default: {
        let engine = this.thirdPartyEngines.get(providerId)
        if (!engine) {
          engine = new ThirdPartyEngine(providerId)
          this.thirdPartyEngines.set(providerId, engine)
        }
        return engine.handleChargePoints(req)
      }
    }
  }
}
