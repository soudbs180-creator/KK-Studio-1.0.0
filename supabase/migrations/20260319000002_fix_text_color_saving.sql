-- Fix text_color saving issue in save_credit_provider function
-- The problem: COALESCE with automatic inference can override user selection

BEGIN;

-- Fix the save_credit_provider function to properly respect user text color choice
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

  DELETE FROM public.admin_credit_models
  WHERE provider_id = p_provider_id;

  IF p_models IS NULL OR jsonb_typeof(p_models) <> 'array' THEN
    RETURN;
  END IF;

  FOR i IN 0..jsonb_array_length(p_models) - 1 LOOP
    v_model := p_models->i;
    
    -- Ensure color is always valid (6 or 8 char hex with #)
    v_color := public.normalize_admin_hex_color(
      COALESCE(v_model->>'color', ''),
      '#3B82F6'
    );
    
    -- Ensure secondary color is always valid
    v_color_secondary := public.normalize_admin_hex_color(
      COALESCE(NULLIF(v_model->>'color_secondary', ''), ''),
      public.derive_admin_secondary_color(v_color)
    );
    
    -- Get raw text color from input
    v_raw_text_color := v_model->>'text_color';
    
    -- Validate text color: use user choice if valid, otherwise infer from background
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
      is_active
    ) VALUES (
      p_provider_id,
      p_provider_name,
      p_base_url,
      COALESCE(p_api_keys, ARRAY[]::TEXT[]),
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
      COALESCE(NULLIF(v_model->>'is_active', '')::BOOLEAN, TRUE)
    );
  END LOOP;
END;
$$;

COMMIT;
