BEGIN;

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

COMMIT;
