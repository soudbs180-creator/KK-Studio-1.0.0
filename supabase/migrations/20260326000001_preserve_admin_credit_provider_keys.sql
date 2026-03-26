-- Keep cloud-managed credit provider keys and runtime counters stable when
-- saving from the direct Supabase admin console flow.

BEGIN;

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
  v_existing_rows JSONB := '[]'::JSONB;
  v_existing_model JSONB := '{}'::JSONB;
  v_color TEXT;
  v_color_secondary TEXT;
  v_text_color TEXT;
  v_raw_text_color TEXT;
  v_quality_pricing JSONB;
  v_existing_api_keys TEXT[] := ARRAY[]::TEXT[];
  v_effective_api_keys TEXT[] := ARRAY[]::TEXT[];
  v_existing_gradient TEXT;
  v_existing_visibility TEXT;
  v_existing_call_count INTEGER;
  v_existing_total_credits_consumed INTEGER;
  v_existing_max_calls_limit INTEGER;
  v_existing_auto_pause_on_limit BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can modify credit providers';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(existing.*)), '[]'::JSONB)
  INTO v_existing_rows
  FROM public.admin_credit_models AS existing
  WHERE existing.provider_id = p_provider_id;

  SELECT COALESCE(existing.api_keys, ARRAY[]::TEXT[])
  INTO v_existing_api_keys
  FROM public.admin_credit_models AS existing
  WHERE existing.provider_id = p_provider_id
    AND COALESCE(array_length(existing.api_keys, 1), 0) > 0
  ORDER BY existing.priority DESC NULLS LAST, existing.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT COALESCE(array_agg(merged_key ORDER BY first_position), ARRAY[]::TEXT[])
  INTO v_effective_api_keys
  FROM (
    SELECT trimmed_key AS merged_key, MIN(position_index) AS first_position
    FROM (
      SELECT NULLIF(btrim(raw_key), '') AS trimmed_key, ordinality AS position_index
      FROM unnest(COALESCE(v_existing_api_keys, ARRAY[]::TEXT[])) WITH ORDINALITY AS existing_keys(raw_key, ordinality)

      UNION ALL

      SELECT NULLIF(btrim(raw_key), '') AS trimmed_key, 1000000 + ordinality AS position_index
      FROM unnest(COALESCE(p_api_keys, ARRAY[]::TEXT[])) WITH ORDINALITY AS new_keys(raw_key, ordinality)
    ) AS merged_keys
    WHERE trimmed_key IS NOT NULL
    GROUP BY trimmed_key
  ) AS deduped_keys;

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
    v_existing_model := '{}'::JSONB;

    SELECT existing_model
    INTO v_existing_model
    FROM jsonb_array_elements(v_existing_rows) AS existing_model
    WHERE existing_model->>'model_id' = COALESCE(v_model->>'model_id', '')
    LIMIT 1;

    v_color := public.normalize_admin_hex_color(
      COALESCE(v_model->>'color', ''),
      '#3B82F6'
    );

    v_color_secondary := public.normalize_admin_hex_color(
      COALESCE(NULLIF(v_model->>'color_secondary', ''), NULLIF(v_existing_model->>'color_secondary', ''), ''),
      public.derive_admin_secondary_color(v_color)
    );

    v_raw_text_color := v_model->>'text_color';
    v_quality_pricing := COALESCE(v_model->'quality_pricing', '{}'::JSONB);
    v_existing_gradient := NULLIF(v_existing_model->>'gradient', '');
    v_existing_visibility := NULLIF(v_existing_model->>'visibility', '');
    v_existing_call_count := COALESCE(NULLIF(v_existing_model->>'call_count', '')::INTEGER, 0);
    v_existing_total_credits_consumed := COALESCE(NULLIF(v_existing_model->>'total_credits_consumed', '')::INTEGER, 0);
    v_existing_max_calls_limit := NULLIF(v_existing_model->>'max_calls_limit', '')::INTEGER;
    v_existing_auto_pause_on_limit := COALESCE(NULLIF(v_existing_model->>'auto_pause_on_limit', '')::BOOLEAN, TRUE);

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
      quality_pricing,
      visibility
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
      COALESCE(NULLIF(v_model->>'gradient', ''), v_existing_gradient, 'from-blue-500 to-indigo-600'),
      COALESCE(NULLIF(v_model->>'endpoint_type', ''), 'gemini'),
      COALESCE(NULLIF(v_model->>'credit_cost', '')::INTEGER, 1),
      COALESCE(NULLIF(v_model->>'max_calls_limit', '')::INTEGER, v_existing_max_calls_limit),
      COALESCE(NULLIF(v_model->>'auto_pause_on_limit', '')::BOOLEAN, v_existing_auto_pause_on_limit, TRUE),
      COALESCE(NULLIF(v_model->>'priority', '')::INTEGER, 10),
      COALESCE(NULLIF(v_model->>'weight', '')::INTEGER, 1),
      COALESCE(NULLIF(v_model->>'is_active', '')::BOOLEAN, TRUE),
      COALESCE(NULLIF(v_model->>'call_count', '')::INTEGER, v_existing_call_count, 0),
      COALESCE(NULLIF(v_model->>'total_credits_consumed', '')::INTEGER, v_existing_total_credits_consumed, 0),
      COALESCE(NULLIF(v_model->>'advanced_enabled', '')::BOOLEAN, FALSE),
      COALESCE(NULLIF(v_model->>'mix_with_same_model', '')::BOOLEAN, FALSE),
      CASE
        WHEN jsonb_typeof(v_quality_pricing) = 'object' THEN v_quality_pricing
        ELSE '{}'::JSONB
      END,
      COALESCE(NULLIF(v_model->>'visibility', ''), v_existing_visibility, 'public')
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_credit_provider(TEXT, TEXT, TEXT, TEXT[], JSONB) TO service_role;

COMMIT;
