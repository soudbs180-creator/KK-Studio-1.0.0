-- Lock down credit model exposure without breaking the existing provider-management API surface.
-- 1) Remove public access to raw provider secrets.
-- 2) Keep admin save/delete RPC names unchanged.
-- 3) Add an admin-only read RPC so the dashboard no longer needs direct table reads.

BEGIN;

ALTER TABLE public.admin_credit_models ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_credit_models
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

UPDATE public.admin_credit_models
SET visibility = 'public'
WHERE visibility IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.admin_credit_models'::regclass
      AND conname = 'admin_credit_models_visibility_check'
  ) THEN
    ALTER TABLE public.admin_credit_models
      ADD CONSTRAINT admin_credit_models_visibility_check
      CHECK (visibility IN ('public', 'private', 'admin_only'));
  END IF;
END
$$;

COMMENT ON COLUMN public.admin_credit_models.api_keys
IS 'Sensitive provider API keys. Never expose to non-admin client queries.';

COMMENT ON COLUMN public.admin_credit_models.base_url
IS 'Sensitive upstream endpoint configuration. Access through admin-only RPCs or server-side routes.';

COMMENT ON COLUMN public.admin_credit_models.visibility
IS 'Model visibility: public, private, or admin_only.';

REVOKE ALL ON TABLE public.admin_credit_models FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_credit_models FROM anon;
REVOKE ALL ON TABLE public.admin_credit_models FROM authenticated;

GRANT SELECT (
  id,
  provider_id,
  provider_name,
  model_id,
  display_name,
  description,
  color,
  color_secondary,
  text_color,
  gradient,
  endpoint_type,
  credit_cost,
  priority,
  weight,
  is_active,
  call_count,
  max_calls_limit,
  advanced_enabled,
  mix_with_same_model,
  quality_pricing,
  visibility
) ON TABLE public.admin_credit_models TO authenticated;

GRANT ALL ON TABLE public.admin_credit_models TO service_role;

DROP POLICY IF EXISTS "Users view active models info" ON public.admin_credit_models;
DROP POLICY IF EXISTS "Users can view basic model info" ON public.admin_credit_models;
DROP POLICY IF EXISTS "Authenticated users can view public model metadata" ON public.admin_credit_models;
DROP POLICY IF EXISTS "Admins full access to credit models" ON public.admin_credit_models;
DROP POLICY IF EXISTS "Admins can view all credit models" ON public.admin_credit_models;
DROP POLICY IF EXISTS "Admins can view credit models" ON public.admin_credit_models;
DROP POLICY IF EXISTS "Admins can modify credit models" ON public.admin_credit_models;

CREATE POLICY "Authenticated users can view public model metadata"
ON public.admin_credit_models
FOR SELECT
TO authenticated
USING (
  is_active = TRUE
  AND COALESCE(visibility, 'public') = 'public'
);

CREATE POLICY "Admins full access to credit models"
ON public.admin_credit_models
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE OR REPLACE FUNCTION public.get_active_credit_models()
RETURNS TABLE (
  provider_id TEXT,
  provider_name TEXT,
  base_url TEXT,
  api_keys TEXT[],
  models JSONB
)
LANGUAGE SQL
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.provider_id,
    COALESCE(MAX(m.provider_name), m.provider_id) AS provider_name,
    NULL::TEXT AS base_url,
    NULL::TEXT[] AS api_keys,
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'model_id', m.model_id,
        'display_name', m.display_name,
        'description', m.description,
        'color', m.color,
        'color_secondary', m.color_secondary,
        'text_color', m.text_color,
        'endpoint_type', m.endpoint_type,
        'credit_cost', m.credit_cost,
        'priority', m.priority,
        'weight', m.weight,
        'call_count', m.call_count,
        'is_active', m.is_active,
        'advanced_enabled', m.advanced_enabled,
        'mix_with_same_model', m.mix_with_same_model,
        'quality_pricing', m.quality_pricing
      )
      ORDER BY m.priority DESC, m.model_id
    ) AS models
  FROM public.admin_credit_models m
  WHERE m.is_active = TRUE
    AND COALESCE(m.visibility, 'public') = 'public'
  GROUP BY m.provider_id
  ORDER BY m.provider_id;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_credit_models_full()
RETURNS TABLE (
  provider_id TEXT,
  provider_name TEXT,
  base_url TEXT,
  api_keys TEXT[],
  models JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can access full model configuration';
  END IF;

  RETURN QUERY
  SELECT
    m.provider_id,
    COALESCE(MAX(m.provider_name), m.provider_id) AS provider_name,
    MAX(m.base_url) AS base_url,
    COALESCE(MAX(m.api_keys), ARRAY[]::TEXT[]) AS api_keys,
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'model_id', m.model_id,
        'display_name', m.display_name,
        'description', m.description,
        'color', m.color,
        'color_secondary', m.color_secondary,
        'text_color', m.text_color,
        'endpoint_type', m.endpoint_type,
        'credit_cost', m.credit_cost,
        'priority', m.priority,
        'weight', m.weight,
        'is_active', m.is_active,
        'call_count', m.call_count,
        'max_calls_limit', m.max_calls_limit,
        'advanced_enabled', m.advanced_enabled,
        'mix_with_same_model', m.mix_with_same_model,
        'quality_pricing', m.quality_pricing
      )
      ORDER BY m.priority DESC, m.model_id
    ) AS models
  FROM public.admin_credit_models m
  GROUP BY m.provider_id
  ORDER BY m.provider_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_credit_provider(
  p_provider_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can delete credit providers';
  END IF;

  DELETE FROM public.admin_credit_models
  WHERE provider_id = p_provider_id;
END;
$$;

DROP VIEW IF EXISTS public.available_models_for_users;

CREATE VIEW public.available_models_for_users AS
SELECT
  m.id,
  m.model_id,
  m.display_name,
  m.description,
  m.color,
  m.color_secondary,
  m.text_color,
  m.gradient,
  m.endpoint_type,
  m.credit_cost,
  m.priority,
  m.is_active,
  COALESCE(m.visibility, 'public') AS visibility,
  'system'::TEXT AS source_type,
  m.provider_id AS source_provider
FROM public.admin_credit_models m
WHERE m.is_active = TRUE
  AND COALESCE(m.visibility, 'public') = 'public';

ALTER VIEW public.available_models_for_users SET (security_invoker = true);

COMMENT ON VIEW public.available_models_for_users
IS 'Sanitized public model catalog. Does not expose provider API keys or base URLs.';

REVOKE ALL ON TABLE public.available_models_for_users FROM PUBLIC;
REVOKE ALL ON TABLE public.available_models_for_users FROM anon;
REVOKE ALL ON TABLE public.available_models_for_users FROM authenticated;
GRANT SELECT ON TABLE public.available_models_for_users TO authenticated;

REVOKE ALL ON FUNCTION public.get_active_credit_models() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_credit_models() FROM anon;
REVOKE ALL ON FUNCTION public.get_active_credit_models() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_credit_models() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_credit_models() TO service_role;

REVOKE ALL ON FUNCTION public.get_admin_credit_models_full() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_credit_models_full() FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_credit_models_full() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_credit_models_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_credit_models_full() TO service_role;

REVOKE ALL ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.delete_credit_provider(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_credit_provider(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.delete_credit_provider(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_credit_provider(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_credit_provider(TEXT) TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.get_credit_model_for_call(text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_credit_model_for_call(TEXT) FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_credit_model_for_call(TEXT) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_credit_model_for_call(TEXT) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_credit_model_for_call(TEXT) TO service_role';
  END IF;
END
$$;

COMMIT;
