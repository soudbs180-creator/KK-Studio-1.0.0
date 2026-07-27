-- 27. 支付与人工充值一致性
-- 人工充值、汇率和 Stripe 订单必须使用服务端持久化事实，避免本地 JSON 与生产数据库分叉。

CREATE TABLE IF NOT EXISTS public.credit_exchange_rates (
  currency_code VARCHAR(3) PRIMARY KEY,
  credits_per_unit NUMERIC(18, 6) NOT NULL,
  min_amount NUMERIC(18, 6),
  max_amount NUMERIC(18, 6),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.credit_exchange_rates (
  currency_code,
  credits_per_unit,
  min_amount,
  max_amount,
  is_active,
  updated_at
) VALUES
  ('CNY', 5, 5, 500, TRUE, NOW()),
  ('USD', 30, 1, 100, TRUE, NOW())
ON CONFLICT (currency_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.recharge_submissions (
  submission_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  base_amount NUMERIC(18, 2) NOT NULL,
  service_fee NUMERIC(18, 2) NOT NULL DEFAULT 0,
  payable_amount NUMERIC(18, 2) NOT NULL,
  base_credits BIGINT NOT NULL,
  bonus_credits BIGINT NOT NULL DEFAULT 0,
  credit_amount BIGINT NOT NULL,
  credits_per_unit NUMERIC(18, 6) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  payment_channel TEXT NOT NULL,
  manual_provider TEXT,
  transfer_reference_last4 VARCHAR(4),
  note TEXT,
  status TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  payment_marked_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  review_actor_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recharge_submissions_user_created_idx
  ON public.recharge_submissions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recharge_submissions_status_created_idx
  ON public.recharge_submissions(status, created_at DESC);

ALTER TABLE public.recharge_submissions
  ALTER COLUMN base_credits TYPE BIGINT USING base_credits::BIGINT,
  ALTER COLUMN bonus_credits TYPE BIGINT USING bonus_credits::BIGINT,
  ALTER COLUMN credit_amount TYPE BIGINT USING credit_amount::BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_recharge_submission_credit_amount_positive'
      AND conrelid = 'public.recharge_submissions'::regclass
  ) THEN
    ALTER TABLE public.recharge_submissions
      ADD CONSTRAINT chk_recharge_submission_credit_amount_positive
      CHECK (amount > 0 AND payable_amount > 0 AND credit_amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_recharge_submission_status'
      AND conrelid = 'public.recharge_submissions'::regclass
  ) THEN
    ALTER TABLE public.recharge_submissions
      ADD CONSTRAINT chk_recharge_submission_status
      CHECK (status IN ('created', 'pending', 'paying', 'approved', 'rejected', 'credited', 'expired'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_recharge_submission_manual_channel'
      AND conrelid = 'public.recharge_submissions'::regclass
  ) THEN
    ALTER TABLE public.recharge_submissions
      ADD CONSTRAINT chk_recharge_submission_manual_channel
      CHECK (
        currency_code IN ('CNY', 'USD')
        AND payment_channel = 'manual'
        AND manual_provider IN ('alipay', 'wechat')
        AND (
          transfer_reference_last4 IS NULL
          OR transfer_reference_last4 ~ '^[0-9A-Z]{4}$'
        )
        AND (
          status <> 'credited'
          OR transfer_reference_last4 IS NOT NULL
        )
      );
  END IF;
END $$;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';
