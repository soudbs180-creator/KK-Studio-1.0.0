import type { BillingRequest } from '../router.ts'
import { logBillingEvent } from '../observability.ts'
import { pointsPool } from '../../config/db.ts'

export class PointsChargeHandler {
  private db: any

  constructor(db?: any) {
    this.db = db || pointsPool
  }

  async handleChargePoints(req: BillingRequest): Promise<any> {
    const body = req.body || {}
    const provider = req.headers?.['x-provider-id']
      || req.headers?.['X-Provider-Id']
      || body.provider_id
      || 'unknown'
    const idempotentKey = this.extractIdempotentKey(req)
    const accountId = body.account_id
    const amountPoints = body.amount_points
    const action = body.action || 'points_deduction'
    const referenceId = body.reference_id || null

    if (!accountId || typeof amountPoints !== 'number') {
      throw new Error('Missing required fields: account_id and numeric amount_points')
    }

    let newBalance: number | null = null
    const client = await this.db.connect()

    try {
      logBillingEvent('points_charge_initiated', {
        provider,
        account_id: accountId,
        amount_points: amountPoints,
        idempotentKey,
        mode: 'points'
      })

      await client.query('BEGIN')

      const updateResult = await client.query(
        `UPDATE billing_points.points_accounts
         SET balance_points = balance_points + $1, updated_at = NOW()
         WHERE id = $2
         RETURNING balance_points`,
        [amountPoints, accountId]
      )

      if (!updateResult || updateResult.rows.length === 0) {
        throw new Error('Points account not found')
      }

      newBalance = updateResult.rows[0].balance_points

      await client.query(
        `INSERT INTO billing_points.points_transactions
           (account_id, amount_points, reason, reference_id, timestamp, engine_type)
         VALUES ($1, $2, $3, $4, NOW(), 'points')`,
        [accountId, amountPoints, action, referenceId]
      )

      await client.query('COMMIT')

      logBillingEvent('points_charge_completed', {
        provider,
        account_id: accountId,
        amount_points: amountPoints,
        new_balance_points: newBalance,
        mode: 'points'
      })
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Ignore rollback failures so we can rethrow the original error.
      }
      throw error
    } finally {
      client.release()
    }

    return {
      ok: true,
      engine_type: 'points',
      id: idempotentKey,
      new_balance_points: newBalance
    }
  }

  private extractIdempotentKey(req: BillingRequest): string {
    const body = req.body || {}
    if (body.points_request_id) return body.points_request_id

    return req.headers?.['x-points-request-id']
      || req.headers?.['X-Points-Request-Id']
      || 'unknown'
  }
}
