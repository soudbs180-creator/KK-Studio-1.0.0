import type { BillingRequest } from './router.ts'
import { PointsChargeHandler } from './points/charge_points.ts'
import { GoogleOfficialEngine } from './engines/google_official.ts'
import { ProxyVendorEngine } from './engines/proxy_vendor.ts'
import { ThirdPartyEngine } from './engines/third_party.ts'

export class ProviderGate {
  private pointsEngine: PointsChargeHandler
  private googleEngine: GoogleOfficialEngine
  private proxyVendorEngine: ProxyVendorEngine
  private thirdPartyEngines: Map<string, ThirdPartyEngine> = new Map()

  constructor(
    pointsEngine: PointsChargeHandler,
    googleEngine: GoogleOfficialEngine,
    proxyVendorEngine: ProxyVendorEngine
  ) {
    this.pointsEngine = pointsEngine
    this.googleEngine = googleEngine
    this.proxyVendorEngine = proxyVendorEngine
  }

  async dispatchCharge(req: BillingRequest, providerId: string) {
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
