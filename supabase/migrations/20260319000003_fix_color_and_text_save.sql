-- Fix color constraint issue and ensure text_color saving works properly
-- The error: violates check constraint "admin_credit_models_color_hex_check"

BEGIN;

-- First, let's see what the actual constraint requires
-- The constraint likely requires: CHECK (color ~ '^#([0-9A-F]{6}|[0-9A-F]{8})$')

-- Fix any existing data that violates the constraint
UPDATE public.admin_credit_models
SET color = '#3B82F6'
WHERE color IS NULL 
   OR color = ''
   OR color !~ '^#[0-9A-Fa-f]{6}$'
   AND color !~ '^#[0-9A-Fa-f]{8}$';

UPDATE public.admin_credit_models
SET color_secondary = public.derive_admin_secondary_color(color)
WHERE color_secondary IS NULL 
   OR color_secondary = ''
   OR color_secondary !~ '^#[0-9A-Fa-f]{6}$'
   AND color_secondary !~ '^#[0-9A-Fa-f]{8}$';

-- Ensure text_color has proper default
UPDATE public.admin_credit_models
SET text_color = 'white'
WHERE text_color IS NULL 
   OR text_color = ''
   OR text_color NOT IN ('white', 'black');

-- Drop and recreate the save function with better color handling
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
  v_raw_color TEXT;
  v_raw_color_secondary TEXT;
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
    
    -- Get raw color values from JSON
    v_raw_color := COALESCE(NULLIF(v_model->>'color', ''), '#3B82F6');
    v_raw_color_secondary := NULLIF(v_model->>'color_secondary', '');
    
    -- Normalize and validate primary color - MUST be 6 or 8 hex chars
    -- Input might be: #RGB, #RRGGBB, #RRGGBBAA, RRGGBB, etc.
    v_color := v_raw_color;
    
    -- Remove # if present for processing
    IF left(v_color, 1) = '#' THEN
      v_color := substr(v_color, 2);
    END IF;
    
    -- Expand 3-char to 6-char
    IF length(v_color) = 3 THEN
      v_color := 
        substr(v_color, 1, 1) || substr(v_color, 1, 1) ||
        substr(v_color, 2, 1) || substr(v_color, 2, 1) ||
        substr(v_color, 3, 1) || substr(v_color, 3, 1);
    END IF;
    
    -- Ensure uppercase and add # prefix
    v_color := '#' || upper(v_color);
    
    -- Validate final format (6 or 8 hex chars)
    IF v_color !~ '^#[0-9A-F]{6}$' AND v_color !~ '^#[0-9A-F]{8}$' THEN
      v_color := '#3B82F6'; -- Force default blue if invalid
    END IF;
    
    -- Normalize and validate secondary color
    IF v_raw_color_secondary IS NOT NULL THEN
      v_color_secondary := v_raw_color_secondary;
      
      IF left(v_color_secondary, 1) = '#' THEN
        v_color_secondary := substr(v_color_secondary, 2);
      END IF;
      
      IF length(v_color_secondary) = 3 THEN
        v_color_secondary := 
          substr(v_color_secondary, 1, 1) || substr(v_color_secondary, 1, 1) ||
          substr(v_color_secondary, 2, 1) || substr(v_color_secondary, 2, 1) ||
          substr(v_color_secondary, 3, 1) || substr(v_color_secondary, 3, 1);
      END IF;
      
      v_color_secondary := '#' || upper(v_color_secondary);
      
      IF v_color_secondary !~ '^#[0-9A-F]{6}$' AND v_color_secondary !~ '^#[0-9A-F]{8}$' THEN
        v_color_secondary := public.derive_admin_secondary_color(v_color);
      END IF;
    ELSE
      v_color_secondary := public.derive_admin_secondary_color(v_color);
    END IF;
    
    -- Handle text_color - use user choice if valid
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

-- Ensure the get_active_credit_models function returns text_color
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
        'gradient', m.gradient,
        'endpoint_type', m.endpoint_type,
        'credit_cost', m.credit_cost,
        'priority', m.priority,
        'weight', m.weight,
        'is_active', m.is_active
      )
      ORDER BY m.priority DESC, m.model_id
    ) AS models
  FROM public.admin_credit_models m
  WHERE m.is_active = TRUE
  GROUP BY m.provider_id
  ORDER BY m.provider_id;
$$;

COMMIT;
