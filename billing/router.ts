import { PointsChargeHandler } from './points/charge_points.ts'
import { TokenUsageHandler } from './token/usage_token.ts'
import { GoogleOfficialEngine } from './engines/google_official.ts'
import { ProxyVendorEngine } from './engines/proxy_vendor.ts'
import { ProviderGate } from './provider_gate.ts'

export interface BillingRequest {
  headers: Record<string, string>
  body: any
}

export type BillingMode = 'points' | 'token'

export interface PointsEngineHandler {
  handleChargePoints(req: BillingRequest): Promise<any>
}

export interface TokenEngineHandler {
  handleTokenUsage(req: BillingRequest): Promise<any>
}

export class BillingRouter {
  private pointsEngine: PointsEngineHandler
  private tokenEngine: TokenEngineHandler
  private providerGate: ProviderGate

  constructor(pointsEngine: PointsEngineHandler, tokenEngine: TokenEngineHandler) {
    this.pointsEngine = pointsEngine
    this.tokenEngine = tokenEngine
    this.providerGate = new ProviderGate(
      pointsEngine as PointsChargeHandler,
      new GoogleOfficialEngine(),
      new ProxyVendorEngine()
    )
  }

  async route(req: BillingRequest): Promise<any> {
    const providerHeader = req.headers?.['x-provider-id']
      || req.headers?.['X-Provider-Id']
      || req.body?.provider_id

    if (providerHeader) {
      return this.providerGate.dispatchCharge(req, providerHeader)
    }

    const mode = this.extractMode(req)

    if (mode === 'points') return this.pointsEngine.handleChargePoints(req)
    if (mode === 'token') return this.tokenEngine.handleTokenUsage(req)

    throw new Error('Invalid billing mode. Must be "points" or "token".')
  }

  private extractMode(req: BillingRequest): BillingMode | undefined {
    const modeHeader = req.headers?.['x-billing-mode'] || req.headers?.['X-Billing-Mode']
    if (modeHeader === 'points' || modeHeader === 'token') return modeHeader

    const mode = req.body?.billing_mode
    if (mode === 'points' || mode === 'token') return mode

    return undefined
  }
}
