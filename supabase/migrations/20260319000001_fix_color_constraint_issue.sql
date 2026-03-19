-- Fix color normalization for admin_credit_models to ensure strict compliance with check constraints
-- The issue: CHECK (color ~ '^#([0-9A-F]{6}|[0-9A-F]{8})$') requires exactly 6 or 8 hex digits after #

BEGIN;

-- Recreate the normalize function with stricter validation
CREATE OR REPLACE FUNCTION public.normalize_admin_hex_color(
  p_input TEXT,
  p_fallback TEXT DEFAULT '#3B82F6'
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_color TEXT := trim(COALESCE(NULLIF(p_input, ''), ''));
  v_normalized TEXT;
  v_fallback TEXT := COALESCE(NULLIF(trim(p_fallback), ''), '#3B82F6');
BEGIN
  -- If input is empty or null, use fallback
  IF v_color = '' THEN
    v_color := v_fallback;
  END IF;

  -- Convert to lowercase for processing
  v_normalized := lower(v_color);
  
  -- Handle various formats and normalize
  IF v_normalized !~ '^#?[0-9a-f]+$' THEN
    -- Invalid characters, use fallback
    v_normalized := lower(v_fallback);
  END IF;
  
  -- Remove # prefix for processing
  IF left(v_normalized, 1) = '#' THEN
    v_normalized := substr(v_normalized, 2);
  END IF;
  
  -- Expand 3-char hex to 6-char
  IF length(v_normalized) = 3 THEN
    v_normalized := 
      substr(v_normalized, 1, 1) || substr(v_normalized, 1, 1) ||
      substr(v_normalized, 2, 1) || substr(v_normalized, 2, 1) ||
      substr(v_normalized, 3, 1) || substr(v_normalized, 3, 1);
  END IF;
  
  -- Pad to 6 chars if shorter (shouldn't happen with valid input, but be safe)
  IF length(v_normalized) < 6 THEN
    v_normalized := rpad(v_normalized, 6, '0');
  END IF;
  
  -- Truncate to 8 chars if longer, or to 6 if between 7-7
  IF length(v_normalized) = 7 THEN
    v_normalized := left(v_normalized, 6);
  ELSIF length(v_normalized) > 8 THEN
    v_normalized := left(v_normalized, 8);
  END IF;
  
  -- If still not 6 or 8 chars, force to 6
  IF length(v_normalized) NOT IN (6, 8) THEN
    v_normalized := '3b82f6'; -- Default blue
  END IF;
  
  -- Return with # prefix and uppercase
  RETURN '#' || upper(v_normalized);
END;
$$;

-- Fix existing data that may have invalid colors
UPDATE public.admin_credit_models
SET color = public.normalize_admin_hex_color(color, '#3B82F6')
WHERE color IS NOT NULL 
  AND color !~ '^#([0-9A-F]{6}|[0-9A-F]{8})$';

UPDATE public.admin_credit_models
SET color_secondary = public.normalize_admin_hex_color(
  COALESCE(NULLIF(color_secondary, ''), public.derive_admin_secondary_color(color)),
  public.derive_admin_secondary_color(color)
)
WHERE color_secondary IS NOT NULL
  AND color_secondary !~ '^#([0-9A-F]{6}|[0-9A-F]{8})$';

-- Ensure defaults are set correctly
ALTER TABLE public.admin_credit_models
  ALTER COLUMN color SET DEFAULT '#3B82F6',
  ALTER COLUMN color_secondary SET DEFAULT '#2563EB',
  ALTER COLUMN text_color SET DEFAULT 'white';

-- Update save_credit_provider function to ensure colors are always valid
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
    
    -- Ensure text color is valid
    v_text_color := lower(COALESCE(NULLIF(v_model->>'text_color', ''), ''));
    IF v_text_color NOT IN ('white', 'black') THEN
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
