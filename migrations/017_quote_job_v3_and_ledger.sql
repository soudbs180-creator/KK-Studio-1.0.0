-- migrations/017_quote_job_v3_and_ledger.sql
-- 简体中文：为 AI 创作核心升级 Phase 1 引入报价、Job v3、Item 级计费与分类账。
-- 约束：不破坏 generation_jobs v2 只读兼容；新字段均有合理默认值。

BEGIN;

-- 1. 报价表：冻结通道、价格、Provider 快照
CREATE TABLE IF NOT EXISTS public.generation_quotes (
  quote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'ppt', 'browser')),
  model text NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK (count > 0),
  channel text NOT NULL CHECK (channel IN ('byok', 'cloud-key', 'platform-credits', 'web-membership', 'setup-required')),
  cost_credits integer,
  cost_provider_quota integer,
  price_version text NOT NULL,
  route_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generation_quotes_cost_check CHECK (
    (channel = 'platform-credits' AND cost_credits IS NOT NULL AND cost_credits >= 0)
    OR (channel IN ('byok', 'cloud-key', 'web-membership') AND cost_provider_quota IS NOT NULL AND cost_provider_quota >= 0)
    OR (channel = 'setup-required')
  )
);

CREATE INDEX IF NOT EXISTS generation_quotes_user_status_idx ON public.generation_quotes(user_id, status);
CREATE INDEX IF NOT EXISTS generation_quotes_expires_idx ON public.generation_quotes(expires_at);

-- 2. 扩展 generation_jobs 到 v3（保持 v2 只读兼容）
ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.generation_quotes(quote_id),
  ADD COLUMN IF NOT EXISTS channel text CHECK (channel IN ('byok', 'cloud-key', 'platform-credits', 'web-membership', 'setup-required')),
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model_code text,
  ADD COLUMN IF NOT EXISTS capability_version text,
  ADD COLUMN IF NOT EXISTS anonymous_key_slot_id text,
  ADD COLUMN IF NOT EXISTS total_cost_credits integer,
  ADD COLUMN IF NOT EXISTS total_cost_provider_quota integer;

-- 新创建的行默认使用 schema_version = 3；已有 v2 行保持不变
ALTER TABLE public.generation_jobs ALTER COLUMN schema_version SET DEFAULT 3;

-- 3. Job Item 表：每个子任务独立计费、对账、失败、重试
CREATE TABLE IF NOT EXISTS public.generation_job_items (
  item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.generation_jobs(job_id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'running', 'completed', 'failed', 'cancelled')),
  reservation_id uuid,
  ledger_id uuid,
  provider_task_id text,
  reconciliation_status text NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'matched', 'mismatch', 'resolved')),
  asset_id text,
  canvas_node_id text,
  error_code text,
  error_message text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, sequence)
);

CREATE INDEX IF NOT EXISTS generation_job_items_job_idx ON public.generation_job_items(job_id);
CREATE INDEX IF NOT EXISTS generation_job_items_status_idx ON public.generation_job_items(status);

-- 4. 分类账表：预扣、结算、退款、调整全部落账
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  ledger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.generation_quotes(quote_id),
  item_id uuid REFERENCES public.generation_job_items(item_id),
  job_id uuid REFERENCES public.generation_jobs(job_id),
  type text NOT NULL CHECK (type IN ('reserve', 'charge', 'refund', 'adjust')),
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'credits',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'committed', 'failed', 'reversed')),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_user_idx ON public.ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS ledger_entries_quote_idx ON public.ledger_entries(quote_id);
CREATE INDEX IF NOT EXISTS ledger_entries_item_idx ON public.ledger_entries(item_id);
CREATE INDEX IF NOT EXISTS ledger_entries_job_idx ON public.ledger_entries(job_id);

-- 5. 为已有 generation_jobs 行回填兼容字段（可选，幂等）
UPDATE public.generation_jobs
SET model_code = model_code
WHERE model_code IS NULL;

COMMIT;
