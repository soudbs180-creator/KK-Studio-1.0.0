-- 7. 管理员模型积分与供应商缓存表
-- 中文注释：模型积分参数属于商业化配置，必须进入迁移目录，避免业务代码隐式创建 schema。
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_credit_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL,
  provider_name text NOT NULL,
  base_url text NOT NULL,
  api_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_id text NOT NULL,
  display_name text NOT NULL,
  description text,
  endpoint_type text NOT NULL DEFAULT 'openai',
  credit_cost integer NOT NULL DEFAULT 1 CHECK (credit_cost >= 0),
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
  visibility text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_credit_models_provider_model_unique UNIQUE (provider_id, model_id)
);

ALTER TABLE public.admin_credit_models
  ADD COLUMN IF NOT EXISTS request_profile_id text,
  ADD COLUMN IF NOT EXISTS route_strategy text,
  ADD COLUMN IF NOT EXISTS auto_pause_on_limit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

CREATE UNIQUE INDEX IF NOT EXISTS admin_credit_models_provider_model_idx
  ON public.admin_credit_models(provider_id, model_id);

CREATE INDEX IF NOT EXISTS admin_credit_models_provider_idx
  ON public.admin_credit_models(provider_id, priority DESC, model_id);

CREATE INDEX IF NOT EXISTS admin_credit_models_active_idx
  ON public.admin_credit_models(is_active, visibility, priority DESC);

CREATE TABLE IF NOT EXISTS public.provider_pricing_cache (
  provider_id text PRIMARY KEY,
  pricing_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  cached_at timestamptz
);

ALTER TABLE public.provider_pricing_cache
  ADD COLUMN IF NOT EXISTS pricing_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cached_at timestamptz;
