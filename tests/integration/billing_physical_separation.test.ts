import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import { BillingRouter } from '../../billing/router.ts'
import { PointsChargeHandler } from '../../billing/points/charge_points.ts'
import { TokenUsageHandler } from '../../billing/token/usage_token.ts'
import { calculateSnapshotCost, resolveImageCostWithResolver, type ImageCostResolver } from '../../src/services/billing/imageCostCore.ts'

class MockDb {
  query(_text: string, _params?: any[]) { return Promise.resolve({ rows: [] }) }

  connect() {
    return Promise.resolve({
      query: async (text: string, _params?: any[]) => {
        if (text.includes('RETURNING balance_points')) {
          return { rows: [{ balance_points: 100 }] }
        }
        if (text.includes('RETURNING current_balance_usd')) {
          return { rows: [{ current_balance_usd: 99.5 }] }
        }
        return { rows: [] }
      },
      release() {},
    })
  }

  end() {}
}

describe('Billing Physical Separation - Routing', () => {
  const router = new BillingRouter(new PointsChargeHandler(new MockDb() as any), new TokenUsageHandler(new MockDb() as any))

  test('route to points engine when billing_mode=points', async () => {
    const req: any = {
      headers: { 'x-billing-mode': 'points' },
      body: { account_id: 'acct-1', amount_points: -5 },
    }
    const res = await router.route(req)
    assert.equal(res.engine_type, 'points')
  })

  test('route to token engine when billing_mode=token', async () => {
    const req: any = {
      headers: { 'x-billing-mode': 'token' },
      body: { user_account_id: 'acct-1', tokens_used: 1200, cost_usd: 0.5 },
    }
    const res = await router.route(req)
    assert.equal(res.engine_type, 'token')
  })
})

describe('Billing Physical Separation - Image Cost Resolution', () => {
  const createResolver = (): ImageCostResolver => ({
    getEffectiveKey: () => ({ id: 'slot-1', group: 'default' } as any),
    getKey: () => ({ id: 'slot-1', group: 'default' } as any),
    getProviderForKeySlot: () => undefined,
  })

  afterEach(() => {
    // No shared singleton state to reset when using the pure resolver.
  })

  test('prefers pricing snapshot over upstream or stored subcard cost', () => {
    const resolver = createResolver()
    resolver.getProviderForKeySlot = () => ({
      pricingSnapshot: {
        modelPrices: { 'nano-banana': 0.13 },
        sizeRatios: {
          'nano-banana': {
            '4K': 1,
          },
        },
      },
    })

    const resolved = resolveImageCostWithResolver({
      model: 'nano-banana',
      imageSize: '4K',
      prompt: 'prompt',
      keySlotId: 'slot-1',
      explicitCost: 0.195,
      storedCost: 0.195,
    }, resolver)

    assert.equal(resolved.source, 'snapshot')
    assert.equal(resolved.cost, 0.13)
  })

  test('falls back to explicit upstream cost when no pricing snapshot is available', () => {
    const resolver = createResolver()

    const resolved = resolveImageCostWithResolver({
      model: 'nano-banana',
      imageSize: '4K',
      prompt: 'prompt',
      keySlotId: 'slot-1',
      explicitCost: 0.195,
      storedCost: 0.13,
    }, resolver)

    assert.equal(resolved.source, 'explicit')
    assert.equal(resolved.cost, 0.195)
  })

  test('matches 4K aliases when applying snapshot size ratios', () => {
    const resolver = createResolver()
    resolver.getProviderForKeySlot = () => ({
      pricingSnapshot: {
        modelPrices: { 'nano-banana': 0.13 },
        sizeRatios: {
          'nano-banana': {
            '4K': 1,
            '4096x4096': 1,
          },
        },
      },
    })

    const normalized4k = calculateSnapshotCost('nano-banana', '4K', 1, 0, 0, 'slot-1', resolver)
    const raw4096 = calculateSnapshotCost('nano-banana', '4096x4096' as any, 1, 0, 0, 'slot-1', resolver)
    const lowercase4k = calculateSnapshotCost('nano-banana', '4k' as any, 1, 0, 0, 'slot-1', resolver)

    assert.equal(normalized4k?.cost, 0.13)
    assert.equal(raw4096?.cost, 0.13)
    assert.equal(lowercase4k?.cost, 0.13)
  })
})
