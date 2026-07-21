-- infrastructure/database/migrations/018_capability_graph_foundation.sql
-- 为 Capability Graph Phase 2a 增加规范化 Connection、能力绑定和 Asset lineage。
-- 该迁移仅新增表/索引/策略；关闭 feature flag 不回滚或删除业务数据。

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

CREATE TABLE IF NOT EXISTS public.provider_connections (
  connection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id text NOT NULL CHECK (length(provider_id) > 0),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  protocol_profile text NOT NULL CHECK (length(protocol_profile) BETWEEN 1 AND 100),
  endpoint_url text CHECK (endpoint_url IS NULL OR length(endpoint_url) <= 2048),
  secret_ref text NOT NULL CHECK (length(secret_ref) > 0),
  status text NOT NULL DEFAULT 'unverified' CHECK (
    status IN ('unverified', 'verifying', 'available', 'restricted', 'offline', 'error', 'revoked')
  ),
  verified_at timestamptz,
  verification_error_code text,
  verification_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, connection_id)
);

CREATE INDEX IF NOT EXISTS provider_connections_user_status_updated_idx
  ON public.provider_connections (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS provider_connections_user_provider_idx
  ON public.provider_connections (user_id, provider_id, updated_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.capability_bindings (
  binding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  model_id text NOT NULL CHECK (length(model_id) > 0),
  capability_id text NOT NULL CHECK (length(capability_id) > 0),
  channel text NOT NULL CHECK (
    channel IN ('byok', 'cloud-key', 'platform-credits', 'web-membership', 'setup-required')
  ),
  request_profile text NOT NULL DEFAULT 'default' CHECK (length(request_profile) > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'degraded')),
  constraints_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(constraints_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capability_bindings_connection_owner_fkey
    FOREIGN KEY (user_id, connection_id)
    REFERENCES public.provider_connections (user_id, connection_id)
    ON DELETE CASCADE,
  UNIQUE (user_id, connection_id, model_id, capability_id, channel, request_profile)
);

CREATE INDEX IF NOT EXISTS capability_bindings_user_capability_status_idx
  ON public.capability_bindings (user_id, capability_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS capability_bindings_connection_idx
  ON public.capability_bindings (user_id, connection_id);

CREATE TABLE IF NOT EXISTS public.asset_lineage_relations (
  lineage_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_asset_id text NOT NULL CHECK (length(source_asset_id) > 0),
  derived_asset_id text NOT NULL CHECK (length(derived_asset_id) > 0),
  relation text NOT NULL CHECK (relation IN ('derived-from', 'thumbnail-of', 'proxy-of', 'waveform-of')),
  params_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(params_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_asset_id, derived_asset_id, relation)
);

CREATE INDEX IF NOT EXISTS asset_lineage_user_derived_idx
  ON public.asset_lineage_relations (user_id, derived_asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS asset_lineage_user_source_idx
  ON public.asset_lineage_relations (user_id, source_asset_id, created_at DESC);

ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.capability_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.asset_lineage_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_lineage_relations FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'provider_connections'
      AND policyname = 'provider_connections_user_policy'
  ) THEN
    CREATE POLICY provider_connections_user_policy ON public.provider_connections
      FOR ALL USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'capability_bindings'
      AND policyname = 'capability_bindings_user_policy'
  ) THEN
    CREATE POLICY capability_bindings_user_policy ON public.capability_bindings
      FOR ALL USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'asset_lineage_relations'
      AND policyname = 'asset_lineage_relations_user_policy'
  ) THEN
    CREATE POLICY asset_lineage_relations_user_policy ON public.asset_lineage_relations
      FOR ALL USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
END $$;

COMMENT ON COLUMN public.provider_connections.secret_ref IS
  '服务端 AES-GCM 加密后的 opaque secret 引用；API、日志和 Capability Graph 永不返回该值';
COMMENT ON TABLE public.capability_bindings IS
  '用户 Connection 到 Model/Capability/Channel 的规范化绑定，作为路由与 Capability Graph 投影事实源';
COMMENT ON TABLE public.asset_lineage_relations IS
  '记录源资产和派生资产关系；资产 URL 与本地路径不得作为稳定 ID';

COMMIT;
