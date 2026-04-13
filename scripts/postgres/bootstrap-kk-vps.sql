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

CREATE TABLE IF NOT EXISTS admin_auth (
  id integer PRIMARY KEY,
  password_hash text NOT NULL,
  requires_password_change boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS temp_users (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS temp_users_active_idx
  ON temp_users(expires_at DESC)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS external_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
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

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_sessions_active_lookup_idx
  ON admin_sessions(admin_user_id, session_token_hash, expires_at DESC)
  WHERE revoked_at IS NULL;

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
  cost_usd numeric(18,6),
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
  credit_cost integer NOT NULL,
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
  quality_pricing jsonb
);

CREATE INDEX IF NOT EXISTS admin_credit_models_provider_idx
  ON admin_credit_models(provider_id, priority DESC, model_id);

CREATE TABLE IF NOT EXISTS provider_pricing_cache (
  provider_id text PRIMARY KEY,
  pricing jsonb NOT NULL DEFAULT '[]'::jsonb,
  cached_at timestamptz
);

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

CREATE TABLE IF NOT EXISTS payment_orders (
  id uuid PRIMARY KEY,
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
  payment_order_id uuid NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  provider_code text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  trade_status text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  settlement_status text NOT NULL,
  settlement_error text,
  received_at timestamptz NOT NULL,
  processed_at timestamptz
);

COMMIT;
