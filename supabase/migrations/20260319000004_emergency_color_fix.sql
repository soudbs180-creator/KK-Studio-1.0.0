-- Emergency fix for color constraint violations
-- This migration ensures all color values are properly formatted before saving

BEGIN;

-- Check current constraint definition
DO $$
DECLARE
  v_constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_constraint_def
  FROM pg_constraint
  WHERE conname = 'admin_credit_models_color_hex_check';
  
  RAISE NOTICE 'Current color constraint: %', v_constraint_def;
END $$;

-- Fix all existing invalid records
UPDATE public.admin_credit_models
SET 
  color = CASE 
    WHEN color IS NULL OR color = '' THEN '#3B82F6'
    WHEN color ~ '^#[0-9A-Fa-f]{6}$' THEN upper(color)
    WHEN color ~ '^#[0-9A-Fa-f]{8}$' THEN upper(color)
    WHEN color ~ '^[0-9A-Fa-f]{6}$' THEN '#' || upper(color)
    WHEN color ~ '^[0-9A-Fa-f]{8}$' THEN '#' || upper(color)
    ELSE '#3B82F6'
  END,
  color_secondary = CASE 
    WHEN color_secondary IS NULL OR color_secondary = '' THEN null
    WHEN color_secondary ~ '^#[0-9A-Fa-f]{6}$' THEN upper(color_secondary)
    WHEN color_secondary ~ '^#[0-9A-Fa-f]{8}$' THEN upper(color_secondary)
    WHEN color_secondary ~ '^[0-9A-Fa-f]{6}$' THEN '#' || upper(color_secondary)
    WHEN color_secondary ~ '^[0-9A-Fa-f]{8}$' THEN '#' || upper(color_secondary)
    ELSE null
  END,
  text_color = CASE 
    WHEN text_color IS NULL OR text_color = '' THEN 'white'
    WHEN lower(text_color) = 'black' THEN 'black'
    ELSE 'white'
  END
WHERE 
  color IS NULL 
  OR color = ''
  OR color !~ '^#[0-9A-Fa-f]{6}$' AND color !~ '^#[0-9A-Fa-f]{8}$'
  OR color_secondary !~ '^#[0-9A-Fa-f]{6}$' AND color_secondary !~ '^#[0-9A-Fa-f]{8}$'
  OR text_color IS NULL 
  OR text_color = ''
  OR text_color NOT IN ('white', 'black');

-- Recreate the save function with robust color validation
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
    
    -- Validate and normalize primary color
    v_color := COALESCE(NULLIF(v_model->>'color', ''), '#3B82F6');
    -- Remove # if present
    IF left(v_color, 1) = '#' THEN
      v_color := substr(v_color, 2);
    END IF;
    -- Must be 6 or 8 hex chars
    IF length(v_color) = 6 AND v_color ~ '^[0-9A-Fa-f]{6}$' THEN
      v_color := '#' || upper(v_color);
    ELSIF length(v_color) = 8 AND v_color ~ '^[0-9A-Fa-f]{8}$' THEN
      v_color := '#' || upper(v_color);
    ELSE
      v_color := '#3B82F6'; -- Default blue
    END IF;
    
    -- Validate and normalize secondary color
    v_color_secondary := v_model->>'color_secondary';
    IF v_color_secondary IS NOT NULL AND v_color_secondary <> '' THEN
      IF left(v_color_secondary, 1) = '#' THEN
        v_color_secondary := substr(v_color_secondary, 2);
      END IF;
      IF length(v_color_secondary) = 6 AND v_color_secondary ~ '^[0-9A-Fa-f]{6}$' THEN
        v_color_secondary := '#' || upper(v_color_secondary);
      ELSIF length(v_color_secondary) = 8 AND v_color_secondary ~ '^[0-9A-Fa-f]{8}$' THEN
        v_color_secondary := '#' || upper(v_color_secondary);
      ELSE
        v_color_secondary := null; -- Invalid, set to null
      END IF;
    ELSE
      v_color_secondary := null;
    END IF;
    
    -- Validate text color
    v_text_color := lower(COALESCE(NULLIF(v_model->>'text_color', ''), 'white'));
    IF v_text_color NOT IN ('white', 'black') THEN
      v_text_color := 'white';
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
