const crypto = require('crypto');

function hashOAuthState(state) {
  return crypto.createHash('sha256').update(String(state || '')).digest('hex');
}

async function createOAuthTransaction(pool, transaction) {
  const state = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + transaction.ttlSeconds * 1000);
  await pool.query(
    `WITH expired_transactions AS (
       DELETE FROM public.oauth_transactions
        WHERE expires_at < NOW() - INTERVAL '1 day'
        RETURNING state_hash
     )
     INSERT INTO public.oauth_transactions
      (state_hash, provider, mode, redirect_to, user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      hashOAuthState(state),
      transaction.provider,
      transaction.mode,
      transaction.redirectTo,
      transaction.userId || null,
      expiresAt,
    ],
  );
  return { state, expiresAt: expiresAt.toISOString() };
}

async function consumeOAuthTransaction(pool, provider, state) {
  if (!state || String(state).length > 256) {
    return null;
  }

  const result = await pool.query(
    `UPDATE public.oauth_transactions
       SET consumed_at = NOW()
     WHERE state_hash = $1
       AND provider = $2
       AND consumed_at IS NULL
       AND expires_at > NOW()
     RETURNING provider, mode, redirect_to, user_id, expires_at`,
    [hashOAuthState(state), provider],
  );
  return result.rows[0] || null;
}

module.exports = {
  consumeOAuthTransaction,
  createOAuthTransaction,
  hashOAuthState,
};
