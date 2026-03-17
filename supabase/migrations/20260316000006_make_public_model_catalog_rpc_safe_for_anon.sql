-- Make the sanitized public model catalog RPC usable before session restore.
-- The function only returns public metadata and never exposes upstream secrets.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_active_credit_models()
RETURNS TABLE (
  provider_id TEXT,
  provider_name TEXT,
  base_url TEXT,
  api_keys TEXT[],
  models JSONB
)
LANGUAGE SQL
SECURITY DEFINER
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

REVOKE ALL ON FUNCTION public.get_active_credit_models() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_credit_models() FROM anon;
REVOKE ALL ON FUNCTION public.get_active_credit_models() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_credit_models() TO anon;
GRANT EXECUTE ON FUNCTION public.get_active_credit_models() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_credit_models() TO service_role;

COMMIT;
