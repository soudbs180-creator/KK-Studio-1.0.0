-- Simple fix for admin_credit_models color constraint
-- Run this in Supabase SQL Editor

-- Step 1: Check current constraint
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid = 'admin_credit_models'::regclass 
AND conname LIKE '%color%';

-- Step 2: Drop the problematic constraint if it exists
ALTER TABLE admin_credit_models 
DROP CONSTRAINT IF EXISTS admin_credit_models_color_hex_check;

-- Step 3: Add a more permissive constraint that accepts both 6 and 8 char hex
ALTER TABLE admin_credit_models 
ADD CONSTRAINT admin_credit_models_color_hex_check 
CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$' OR color ~ '^#[0-9A-Fa-f]{8}$');

-- Step 4: Fix any existing invalid colors
UPDATE admin_credit_models 
SET color = '#3B82F6' 
WHERE color IS NULL OR color = '' OR (color !~ '^#[0-9A-Fa-f]{6}$' AND color !~ '^#[0-9A-Fa-f]{8}$');

UPDATE admin_credit_models 
SET color_secondary = NULL 
WHERE color_secondary IS NOT NULL AND color_secondary !~ '^#[0-9A-Fa-f]{6}$' AND color_secondary !~ '^#[0-9A-Fa-f]{8}$';

UPDATE admin_credit_models 
SET text_color = 'white' 
WHERE text_color IS NULL OR text_color = '' OR text_color NOT IN ('white', 'black');

-- Step 5: Create a simple save function
CREATE OR REPLACE FUNCTION save_credit_provider(
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
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can modify credit providers';
  END IF;

  DELETE FROM admin_credit_models
  WHERE provider_id = p_provider_id;

  IF p_models IS NULL OR jsonb_typeof(p_models) <> 'array' THEN
    RETURN;
  END IF;

  FOR i IN 0..jsonb_array_length(p_models) - 1 LOOP
    v_model := p_models->i;
    
    -- Simple color validation: if invalid, use default
    v_color := COALESCE(NULLIF(v_model->>'color', ''), '#3B82F6');
    IF v_color !~ '^#[0-9A-Fa-f]{6}$' AND v_color !~ '^#[0-9A-Fa-f]{8}$' THEN
      v_color := '#3B82F6';
    END IF;
    
    -- Secondary color
    v_color_secondary := v_model->>'color_secondary';
    IF v_color_secondary IS NOT NULL AND v_color_secondary <> '' THEN
      IF v_color_secondary !~ '^#[0-9A-Fa-f]{6}$' AND v_color_secondary !~ '^#[0-9A-Fa-f]{8}$' THEN
        v_color_secondary := NULL;
      END IF;
    ELSE
      v_color_secondary := NULL;
    END IF;
    
    -- Text color
    v_text_color := lower(COALESCE(NULLIF(v_model->>'text_color', ''), 'white'));
    IF v_text_color NOT IN ('white', 'black') THEN
      v_text_color := 'white';
    END IF;

    INSERT INTO admin_credit_models (
      provider_id, provider_name, base_url, api_keys,
      model_id, display_name, description,
      color, color_secondary, text_color,
      gradient, endpoint_type, credit_cost,
      max_calls_limit, auto_pause_on_limit,
      priority, weight, is_active
    ) VALUES (
      p_provider_id, p_provider_name, p_base_url, COALESCE(p_api_keys, ARRAY[]::TEXT[]),
      v_model->>'model_id', v_model->>'display_name', v_model->>'description',
      v_color, v_color_secondary, v_text_color,
      COALESCE(v_model->>'gradient', 'from-blue-500 to-indigo-600'),
      COALESCE(NULLIF(v_model->>'endpoint_type', ''), 'gemini'),
      COALESCE((v_model->>'credit_cost')::INTEGER, 1),
      NULLIF((v_model->>'max_calls_limit')::INTEGER, 0),
      COALESCE((v_model->>'auto_pause_on_limit')::BOOLEAN, TRUE),
      COALESCE((v_model->>'priority')::INTEGER, 10),
      COALESCE((v_model->>'weight')::INTEGER, 1),
      COALESCE((v_model->>'is_active')::BOOLEAN, TRUE)
    );
  END LOOP;
END;
$$;

-- Verify the fix
SELECT 'Fix applied successfully!' as status;
