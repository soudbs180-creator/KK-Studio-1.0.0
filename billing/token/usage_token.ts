import type { BillingRequest } from '../router.ts'
import { logBillingEvent } from '../observability.ts'
import { tokenPool } from '../../config/db.ts'

export class TokenUsageHandler {
  private db: any

  constructor(db?: any) {
    this.db = db || tokenPool
  }

  async handleTokenUsage(req: BillingRequest): Promise<any> {
    const body = req.body || {}
    const userAccountId = body.user_account_id
    const tokensUsed = body.tokens_used
    const actionId = body.action_id || null
    const costUsd = body.cost_usd
    const usageId = body.usage_id || null
    const provider = req.headers?.['x-provider-id']
      || req.headers?.['X-Provider-Id']
      || body.provider_id
      || 'unknown'

    if (!userAccountId || typeof tokensUsed !== 'number' || typeof costUsd !== 'number') {
      throw new Error('Missing required fields: user_account_id, tokens_used, cost_usd')
    }

    logBillingEvent('token_usage_initiated', {
      provider,
      user_account_id: userAccountId,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      action_id: actionId,
      usage_id: usageId,
      mode: 'token'
    })

    const client = await this.db.connect()

    try {
      await client.query('BEGIN')

      const updateResult = await client.query(
        `UPDATE billing_token.token_accounts
         SET current_balance_usd = current_balance_usd - $1, updated_at = NOW()
         WHERE id = $2
         RETURNING current_balance_usd`,
        [costUsd, userAccountId]
      )

      if (!updateResult || updateResult.rows.length === 0) {
        throw new Error('Token account not found')
      }

      const newBalance = updateResult.rows[0].current_balance_usd

      await client.query(
        `INSERT INTO billing_token.token_usage
           (user_account_id, tokens_used, cost_usd, action_id, timestamp, engine_type)
         VALUES ($1, $2, $3, $4, NOW(), 'token')`,
        [userAccountId, tokensUsed, costUsd, actionId]
      )

      await client.query('COMMIT')

      logBillingEvent('token_usage_completed', {
        provider,
        user_account_id: userAccountId,
        tokens_used: tokensUsed,
        cost_usd: costUsd,
        new_balance_usd: newBalance,
        usage_id: usageId,
        mode: 'token'
      })

      return {
        ok: true,
        engine_type: 'token',
        usage_id: usageId,
        new_balance_usd: newBalance
      }
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
  }
}
