-- 28. 支付充值二次加固
-- 完整 Provider 交易号是人工核销的唯一事实；历史 Stripe 订单则由签名事件补齐真实币种。

ALTER TABLE public.recharge_submissions
  ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(64);

-- 027 以前只保存四位尾号，无法恢复完整交易号。为历史记录生成明确的兼容标识，
-- 保证旧申请仍可人工复核，同时避免它们占用任何真实 Provider 交易号。
UPDATE public.recharge_submissions
SET provider_transaction_id = 'LEGACY-' || UPPER(MD5(submission_id))
WHERE provider_transaction_id IS NULL
  AND transfer_reference_last4 IS NOT NULL;

-- 没有任何付款凭据的历史 paying/approved 行不得继续进入核销路径。
UPDATE public.recharge_submissions
SET status = 'pending'
WHERE status IN ('paying', 'approved')
  AND provider_transaction_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS recharge_submissions_provider_transaction_unique_idx
  ON public.recharge_submissions(manual_provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_recharge_submission_provider_transaction'
      AND conrelid = 'public.recharge_submissions'::regclass
  ) THEN
    ALTER TABLE public.recharge_submissions
      ADD CONSTRAINT chk_recharge_submission_provider_transaction
      CHECK (
        provider_transaction_id IS NULL
        OR provider_transaction_id ~ '^[0-9A-Z][0-9A-Z-]{6,62}[0-9A-Z]$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_recharge_submission_payable_proof'
      AND conrelid = 'public.recharge_submissions'::regclass
  ) THEN
    ALTER TABLE public.recharge_submissions
      ADD CONSTRAINT chk_recharge_submission_payable_proof
      CHECK (
        status NOT IN ('paying', 'approved', 'credited')
        OR provider_transaction_id IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_recharge_submission_reference_matches_provider'
      AND conrelid = 'public.recharge_submissions'::regclass
  ) THEN
    ALTER TABLE public.recharge_submissions
      ADD CONSTRAINT chk_recharge_submission_reference_matches_provider
      CHECK (
        provider_transaction_id IS NULL
        OR provider_transaction_id LIKE 'LEGACY-%'
        OR transfer_reference_last4 = RIGHT(REPLACE(provider_transaction_id, '-', ''), 4)
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_recharge_proof_rewrite()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.provider_transaction_id IS NOT NULL
    AND NEW.provider_transaction_id IS DISTINCT FROM OLD.provider_transaction_id THEN
    RAISE EXCEPTION 'Recharge provider transaction identifiers are immutable after submission'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recharge_submissions_immutable_proof_trigger
  ON public.recharge_submissions;
CREATE TRIGGER recharge_submissions_immutable_proof_trigger
BEFORE UPDATE OF provider_transaction_id ON public.recharge_submissions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_recharge_proof_rewrite();

-- 027 无法知道历史 Checkout Session 的真实币种，因此旧行先标记为未核验。
-- 新订单默认已核验；旧行将在签名 Webhook 到达时用 Stripe Session 币种原子补齐。
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.orders
  ALTER COLUMN currency_verified SET DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.legacy_payment_imports (
  source_digest CHAR(64) PRIMARY KEY,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exchange_rate_count INTEGER NOT NULL DEFAULT 0,
  recharge_submission_count INTEGER NOT NULL DEFAULT 0
);
