BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY,
  email text,
  role text NOT NULL DEFAULT 'user',
  nickname text,
  avatar_url text,
  user_apis jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique_idx
  ON profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS password_identities (
  user_id text PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  password_change_code_salt text,
  password_change_code_hash text,
  password_change_code_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  rotated_from uuid REFERENCES user_sessions(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  user_agent text,
  ip_address text
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_expires_at_idx
  ON user_sessions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS admin_auth (
  id integer PRIMARY KEY CHECK (id = 1),
  password_hash text NOT NULL,
  requires_password_change boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO admin_auth (id, password_hash, requires_password_change, updated_at)
VALUES (1, 'e10adc3949ba59abbe56e057f20f883e', true, now())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_sessions_active_lookup_idx
  ON admin_sessions(admin_user_id, session_token_hash, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS temp_users (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS temp_users_active_expires_at_idx
  ON temp_users(is_active, expires_at DESC);

CREATE TABLE IF NOT EXISTS external_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_appid text NOT NULL,
  provider_unionid text,
  provider_openid text NOT NULL,
  nickname text,
  avatar_url text,
  raw_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS external_identities_openid_idx
  ON external_identities(provider, provider_appid, provider_openid);

CREATE INDEX IF NOT EXISTS external_identities_unionid_idx
  ON external_identities(provider, provider_unionid);

CREATE TABLE IF NOT EXISTS generation_tasks (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  workflow_id text NOT NULL,
  requester_id text NOT NULL,
  request_id text,
  attempt_id text,
  model_code text NOT NULL,
  task_type text NOT NULL,
  status text NOT NULL,
  prompt text NOT NULL,
  references_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  results_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  billing_status text,
  ledger_transaction_id text,
  refund_transaction_id text,
  credit_amount integer,
  cost_usd double precision,
  provider_id text,
  protocol_family text,
  usage_snapshot_json jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS generation_tasks_requester_idempotency_idx
  ON generation_tasks(requester_id, idempotency_key);

CREATE TABLE IF NOT EXISTS workflow_documents (
  workspace_id text NOT NULL,
  workflow_id text NOT NULL,
  document_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, workflow_id)
);

CREATE TABLE IF NOT EXISTS workspace_layouts (
  user_id text PRIMARY KEY,
  layout_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_cloud_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  workspace_id text,
  canvas_id text,
  image_id text,
  storage_key text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_cloud_images_user_idx
  ON workspace_cloud_images(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_credit_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL,
  provider_name text NOT NULL,
  base_url text NOT NULL,
  api_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_id text NOT NULL,
  display_name text NOT NULL,
  description text,
  endpoint_type text NOT NULL,
  credit_cost integer NOT NULL DEFAULT 1,
  priority integer NOT NULL DEFAULT 0,
  weight integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  call_count integer NOT NULL DEFAULT 0,
  max_calls_limit integer,
  color text,
  color_secondary text,
  text_color text,
  advanced_enabled boolean NOT NULL DEFAULT false,
  mix_with_same_model boolean NOT NULL DEFAULT false,
  quality_pricing jsonb,
  visibility text NOT NULL DEFAULT 'public'
);

ALTER TABLE admin_credit_models
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS admin_credit_models_provider_idx
  ON admin_credit_models(provider_id, priority DESC, model_id);

CREATE TABLE IF NOT EXISTS provider_pricing_cache (
  provider_id text PRIMARY KEY,
  pricing_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  cached_at timestamptz
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'provider_pricing_cache'
       AND column_name = 'pricing'
  ) AND NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'provider_pricing_cache'
       AND column_name = 'pricing_json'
  ) THEN
    ALTER TABLE provider_pricing_cache RENAME COLUMN pricing TO pricing_json;
  END IF;
END $$;

ALTER TABLE provider_pricing_cache
  ADD COLUMN IF NOT EXISTS pricing_json jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE provider_pricing_cache
   SET pricing_json = '[]'::jsonb
 WHERE pricing_json IS NULL;

ALTER TABLE provider_pricing_cache
  ALTER COLUMN pricing_json SET DEFAULT '[]'::jsonb,
  ALTER COLUMN pricing_json SET NOT NULL;

CREATE TABLE IF NOT EXISTS user_credits (
  user_id text PRIMARY KEY,
  email text,
  balance integer NOT NULL DEFAULT 0,
  frozen integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_exchange_rates (
  currency_code text PRIMARY KEY,
  credits_per_unit numeric(18,6) NOT NULL,
  min_amount numeric(18,6),
  max_amount numeric(18,6),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz
);

INSERT INTO credit_exchange_rates (
  currency_code,
  credits_per_unit,
  min_amount,
  max_amount,
  is_active,
  updated_at
) VALUES
  ('CNY', 5, 1, NULL, true, now()),
  ('USD', 30, 1, NULL, true, now())
ON CONFLICT (currency_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS credit_transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL,
  balance_after integer NOT NULL,
  model_id text,
  model_name text,
  provider_id text,
  description text,
  status text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  idempotency_key text,
  business_ref_type text,
  business_ref_id text
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_created_idx
  ON credit_transactions(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_user_idempotency_idx
  ON credit_transactions(user_id, type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS recharge_submissions (
  submission_id text PRIMARY KEY,
  user_id text NOT NULL,
  amount numeric(18,2) NOT NULL,
  base_amount numeric(18,2) NOT NULL,
  service_fee numeric(18,2) NOT NULL DEFAULT 0,
  payable_amount numeric(18,2) NOT NULL,
  base_credits integer NOT NULL,
  bonus_credits integer NOT NULL DEFAULT 0,
  credit_amount integer NOT NULL,
  credits_per_unit numeric(18,6) NOT NULL,
  currency_code text NOT NULL,
  payment_channel text NOT NULL,
  manual_provider text,
  transfer_reference_last4 text,
  note text,
  status text NOT NULL,
  expires_at timestamptz,
  payment_marked_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_actor_user_id text,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS recharge_submissions_user_created_idx
  ON recharge_submissions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recharge_submissions_status_created_idx
  ON recharge_submissions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_orders (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  provider_code text NOT NULL,
  merchant_order_no text NOT NULL UNIQUE,
  status text NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  credit_amount integer NOT NULL,
  idempotency_key text NOT NULL,
  payment_url text NOT NULL,
  return_url text NOT NULL,
  notify_url text NOT NULL,
  last_callback_id text,
  settlement_applied_at timestamptz,
  settlement_ledger_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_user_idempotency_idx
  ON payment_orders(user_id, idempotency_key);

CREATE TABLE IF NOT EXISTS payment_callbacks (
  callback_id text PRIMARY KEY,
  payment_order_id text NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  provider_code text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  trade_status text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  settlement_status text NOT NULL,
  settlement_error text,
  received_at timestamptz NOT NULL,
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  user_message text NOT NULL,
  intent text NOT NULL,
  plan jsonb NOT NULL,
  status text NOT NULL,
  step_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  event_sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 兼容已由 011 创建的旧表；CREATE TABLE IF NOT EXISTS 不会补充新列。
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS step_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS event_sequence integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS agent_runs_user_updated_idx
  ON public.agent_runs(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_run_events (
  run_id text NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (event_type = 'run_snapshot'),
  status text NOT NULL CHECK (status IN (
    'planning', 'waiting_confirmation', 'waiting_execution', 'running',
    'completed', 'completed_with_errors', 'failed', 'cancelled'
  )),
  run_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, sequence)
);

DROP TRIGGER IF EXISTS prepare_agent_run_event_sequence ON public.agent_runs;
DROP TRIGGER IF EXISTS append_agent_run_snapshot_event ON public.agent_runs;

UPDATE public.agent_runs
   SET event_sequence = 1
 WHERE event_sequence = 0;

INSERT INTO public.agent_run_events (
  run_id, sequence, event_type, status, run_updated_at, created_at
)
SELECT id, event_sequence, 'run_snapshot', status, updated_at, now()
FROM public.agent_runs
ON CONFLICT (run_id, sequence) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prepare_agent_run_event_sequence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.event_sequence := 1;
  ELSIF ROW(NEW.status, NEW.plan, NEW.step_results, NEW.updated_at)
    IS DISTINCT FROM ROW(OLD.status, OLD.plan, OLD.step_results, OLD.updated_at) THEN
    NEW.event_sequence := OLD.event_sequence + 1;
  ELSE
    NEW.event_sequence := OLD.event_sequence;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_agent_run_snapshot_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  should_append boolean;
BEGIN
  should_append := TG_OP = 'INSERT';
  IF TG_OP <> 'INSERT' THEN
    should_append := NEW.event_sequence > OLD.event_sequence;
  END IF;
  IF should_append THEN
    INSERT INTO public.agent_run_events (
      run_id, sequence, event_type, status, run_updated_at
    ) VALUES (
      NEW.id, NEW.event_sequence, 'run_snapshot', NEW.status, NEW.updated_at
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prepare_agent_run_event_sequence
BEFORE INSERT OR UPDATE ON public.agent_runs
FOR EACH ROW EXECUTE FUNCTION public.prepare_agent_run_event_sequence();

CREATE TRIGGER append_agent_run_snapshot_event
AFTER INSERT OR UPDATE ON public.agent_runs
FOR EACH ROW EXECUTE FUNCTION public.append_agent_run_snapshot_event();

CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  collaboration_mode text NOT NULL CHECK (collaboration_mode IN ('direct', 'assist', 'takeover')),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(messages) = 'array'),
  summary jsonb NOT NULL CHECK (jsonb_typeof(summary) = 'object'),
  tool_results jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tool_results) = 'array'),
  knowledge_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(knowledge_refs) = 'array'),
  token_budget jsonb NOT NULL CHECK (jsonb_typeof(token_budget) = 'object'),
  confirmations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(confirmations) = 'array'),
  checkpoints jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checkpoints) = 'array'),
  last_heartbeat_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_sessions_user_updated_idx
  ON public.agent_sessions(user_id, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.agent_context_snapshots (
  snapshot_id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  sequence bigint GENERATED BY DEFAULT AS IDENTITY,
  snapshot_data jsonb NOT NULL CHECK (jsonb_typeof(snapshot_data) = 'object'),
  captured_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, sequence)
);

CREATE INDEX IF NOT EXISTS agent_context_snapshots_session_sequence_idx
  ON public.agent_context_snapshots(session_id, sequence DESC);

CREATE TABLE IF NOT EXISTS public.agent_tool_calls (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  step_id text,
  tool_name text NOT NULL,
  input_summary text NOT NULL,
  output_summary text,
  status text NOT NULL,
  outcome text,
  failure_class text,
  error_code text,
  retryable boolean,
  error text,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  idempotency_key text
);

ALTER TABLE public.agent_tool_calls
  ADD COLUMN IF NOT EXISTS step_id text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS failure_class text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS retryable boolean;

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id text PRIMARY KEY,
  user_id text,
  key text NOT NULL,
  value text NOT NULL,
  is_long_term boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id text PRIMARY KEY,
  user_id text,
  owner_scope text NOT NULL DEFAULT 'legacy',
  source text NOT NULL,
  path text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  content_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_documents_owner_scope_check CHECK (
    (owner_scope = 'user' AND user_id IS NOT NULL)
    OR (owner_scope IN ('system', 'legacy') AND user_id IS NULL)
  )
);

ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS owner_scope text NOT NULL DEFAULT 'legacy';

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id text PRIMARY KEY,
  document_id text REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.canvas_runtime_snapshots (
  id text PRIMARY KEY,
  user_id text,
  owner_scope text NOT NULL DEFAULT 'legacy',
  canvas_id text NOT NULL,
  snapshot_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canvas_runtime_snapshots_owner_scope_check CHECK (
    (owner_scope = 'user' AND user_id IS NOT NULL)
    OR (owner_scope IN ('system', 'legacy') AND user_id IS NULL)
  )
);

ALTER TABLE public.canvas_runtime_snapshots
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS owner_scope text NOT NULL DEFAULT 'legacy';

CREATE TABLE IF NOT EXISTS public.agent_skills (
  id text PRIMARY KEY,
  user_id text,
  owner_scope text NOT NULL DEFAULT 'legacy',
  name text NOT NULL,
  trigger_text text NOT NULL,
  tools text[] NOT NULL,
  steps text[] NOT NULL,
  safety text[],
  validation text[],
  knowledge_updates text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_skills_owner_scope_check CHECK (
    (owner_scope = 'user' AND user_id IS NOT NULL)
    OR (owner_scope IN ('system', 'legacy') AND user_id IS NULL)
  )
);

ALTER TABLE public.agent_skills
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS owner_scope text NOT NULL DEFAULT 'legacy';

CREATE TABLE IF NOT EXISTS public.agent_skill_versions (
  user_id text NOT NULL,
  skill_key text NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, skill_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_skills_user_name_idx
  ON public.agent_skills(user_id, name) WHERE owner_scope = 'user';
CREATE INDEX IF NOT EXISTS agent_skills_user_updated_idx
  ON public.agent_skills(user_id, updated_at DESC) WHERE owner_scope = 'user';
CREATE INDEX IF NOT EXISTS agent_skill_versions_user_updated_idx
  ON public.agent_skill_versions(user_id, updated_at DESC);
INSERT INTO public.agent_skill_versions (user_id, skill_key, updated_at, deleted)
SELECT user_id, name, updated_at, false
FROM public.agent_skills
WHERE owner_scope = 'user' AND user_id IS NOT NULL
ON CONFLICT (user_id, skill_key)
DO UPDATE SET
  updated_at = EXCLUDED.updated_at,
  deleted = false
WHERE public.agent_skill_versions.updated_at < EXCLUDED.updated_at
   OR (
     public.agent_skill_versions.updated_at = EXCLUDED.updated_at
     AND public.agent_skill_versions.deleted = false
   );
CREATE INDEX IF NOT EXISTS knowledge_documents_user_updated_idx
  ON public.knowledge_documents(user_id, updated_at DESC) WHERE owner_scope = 'user';
CREATE INDEX IF NOT EXISTS knowledge_documents_system_updated_idx
  ON public.knowledge_documents(updated_at DESC) WHERE owner_scope = 'system';
CREATE INDEX IF NOT EXISTS canvas_runtime_snapshots_user_canvas_idx
  ON public.canvas_runtime_snapshots(user_id, canvas_id, created_at DESC) WHERE owner_scope = 'user';

COMMIT;
