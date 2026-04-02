-- Match current billing read paths with composite indexes so balance and
-- transaction history reads avoid broad scans/sorts on hot routes.

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id_created_at_desc
  ON public.credit_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id_type_created_at_desc
  ON public.credit_transactions (user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id_type_idempotency_key
  ON public.credit_transactions (user_id, type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_refund_source_lookup
  ON public.credit_transactions (
    user_id,
    type,
    ((metadata->>'source_transaction_id')),
    completed_at DESC,
    created_at DESC
  )
  WHERE type = 'refund';
