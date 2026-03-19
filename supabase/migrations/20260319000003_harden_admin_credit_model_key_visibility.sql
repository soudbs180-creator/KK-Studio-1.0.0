BEGIN;

CREATE OR REPLACE FUNCTION public.mask_admin_api_keys(p_api_keys TEXT[])
RETURNS TEXT[]
LANGUAGE SQL
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT
        CASE
          WHEN length(trimmed_key) <= 4 THEN repeat('*', length(trimmed_key))
          WHEN length(trimmed_key) <= 8 THEN repeat('*', GREATEST(length(trimmed_key) - 2, 1)) || right(trimmed_key, 2)
          ELSE left(trimmed_key, 4) || repeat('*', GREATEST(length(trimmed_key) - 8, 4)) || right(trimmed_key, 4)
        END
      FROM (
        SELECT NULLIF(btrim(raw_key), '') AS trimmed_key
        FROM unnest(COALESCE(p_api_keys, ARRAY[]::TEXT[])) AS raw_key
      ) masked_keys
      WHERE trimmed_key IS NOT NULL
    ),
    ARRAY[]::TEXT[]
  );
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
  WITH provider_groups AS (
    SELECT
      m.provider_id,
      COALESCE(MAX(m.provider_name), m.provider_id) AS provider_name,
      MAX(m.base_url) AS base_url,
      COALESCE(
        (
          SELECT existing.api_keys
          FROM public.admin_credit_models existing
          WHERE existing.provider_id = m.provider_id
            AND COALESCE(array_length(existing.api_keys, 1), 0) > 0
          ORDER BY existing.priority DESC NULLS LAST, existing.created_at DESC NULLS LAST
          LIMIT 1
        ),
        ARRAY[]::TEXT[]
      ) AS api_keys,
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
  )
  SELECT
    provider_groups.provider_id,
    provider_groups.provider_name,
    provider_groups.base_url,
    public.mask_admin_api_keys(provider_groups.api_keys) AS api_keys,
    provider_groups.models
  FROM provider_groups
  ORDER BY provider_groups.provider_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_credit_provider(
  p_provider_id TEXT,
  p_provider_name TEXT,
  p_base_url TEXT,
  p_api_keys TEXT[],
  p_models JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i INTEGER;
  v_model JSONB;
  v_color TEXT;
  v_color_secondary TEXT;
  v_text_color TEXT;
  v_raw_text_color TEXT;
  v_quality_pricing JSONB;
  v_existing_api_keys TEXT[] := ARRAY[]::TEXT[];
  v_effective_api_keys TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can modify credit providers';
  END IF;

  SELECT COALESCE(existing.api_keys, ARRAY[]::TEXT[])
  INTO v_existing_api_keys
  FROM public.admin_credit_models existing
  WHERE existing.provider_id = p_provider_id
    AND COALESCE(array_length(existing.api_keys, 1), 0) > 0
  ORDER BY existing.priority DESC NULLS LAST, existing.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT COALESCE(array_agg(trimmed_key), ARRAY[]::TEXT[])
  INTO v_effective_api_keys
  FROM (
    SELECT NULLIF(btrim(raw_key), '') AS trimmed_key
    FROM unnest(COALESCE(p_api_keys, ARRAY[]::TEXT[])) AS raw_key
  ) normalized_keys
  WHERE trimmed_key IS NOT NULL;

  IF COALESCE(array_length(v_effective_api_keys, 1), 0) = 0 THEN
    v_effective_api_keys := COALESCE(v_existing_api_keys, ARRAY[]::TEXT[]);
  END IF;

  IF COALESCE(array_length(v_effective_api_keys, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one provider key is required';
  END IF;

  DELETE FROM public.admin_credit_models
  WHERE provider_id = p_provider_id;

  IF p_models IS NULL OR jsonb_typeof(p_models) <> 'array' THEN
    RETURN;
  END IF;

  FOR i IN 0..jsonb_array_length(p_models) - 1 LOOP
    v_model := p_models->i;

    v_color := public.normalize_admin_hex_color(
      COALESCE(v_model->>'color', ''),
      '#3B82F6'
    );

    v_color_secondary := public.normalize_admin_hex_color(
      COALESCE(NULLIF(v_model->>'color_secondary', ''), ''),
      public.derive_admin_secondary_color(v_color)
    );

    v_raw_text_color := v_model->>'text_color';
    v_quality_pricing := COALESCE(v_model->'quality_pricing', '{}'::JSONB);

    IF v_raw_text_color IS NOT NULL AND lower(trim(v_raw_text_color)) IN ('white', 'black') THEN
      v_text_color := lower(trim(v_raw_text_color));
    ELSE
      v_text_color := public.infer_admin_text_color(v_color_secondary);
    END IF;

    INSERT INTO public.admin_credit_models (
      provider_id,
      provider_name,
      base_url,
      api_keys,
      model_id,
      display_name,
      description,
      color,
      color_secondary,
      text_color,
      gradient,
      endpoint_type,
      credit_cost,
      max_calls_limit,
      auto_pause_on_limit,
      priority,
      weight,
      is_active,
      call_count,
      total_credits_consumed,
      advanced_enabled,
      mix_with_same_model,
      quality_pricing
    ) VALUES (
      p_provider_id,
      p_provider_name,
      p_base_url,
      v_effective_api_keys,
      v_model->>'model_id',
      v_model->>'display_name',
      v_model->>'description',
      v_color,
      v_color_secondary,
      v_text_color,
      COALESCE(v_model->>'gradient', 'from-blue-500 to-indigo-600'),
      COALESCE(NULLIF(v_model->>'endpoint_type', ''), 'gemini'),
      COALESCE(NULLIF(v_model->>'credit_cost', '')::INTEGER, 1),
      NULLIF(NULLIF(v_model->>'max_calls_limit', '')::INTEGER, 0),
      COALESCE(NULLIF(v_model->>'auto_pause_on_limit', '')::BOOLEAN, TRUE),
      COALESCE(NULLIF(v_model->>'priority', '')::INTEGER, 10),
      COALESCE(NULLIF(v_model->>'weight', '')::INTEGER, 1),
      COALESCE(NULLIF(v_model->>'is_active', '')::BOOLEAN, TRUE),
      COALESCE(NULLIF(v_model->>'call_count', '')::INTEGER, 0),
      COALESCE(NULLIF(v_model->>'total_credits_consumed', '')::INTEGER, 0),
      COALESCE(NULLIF(v_model->>'advanced_enabled', '')::BOOLEAN, FALSE),
      COALESCE(NULLIF(v_model->>'mix_with_same_model', '')::BOOLEAN, FALSE),
      CASE
        WHEN jsonb_typeof(v_quality_pricing) = 'object' THEN v_quality_pricing
        ELSE '{}'::JSONB
      END
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.mask_admin_api_keys(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mask_admin_api_keys(TEXT[]) FROM anon;
REVOKE ALL ON FUNCTION public.mask_admin_api_keys(TEXT[]) FROM authenticated;

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

COMMIT;
