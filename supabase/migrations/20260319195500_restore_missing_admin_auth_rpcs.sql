BEGIN;

CREATE OR REPLACE FUNCTION public.authenticate_admin(
  input_password TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  token TEXT,
  message TEXT,
  requires_password_change BOOLEAN
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
    RAISE EXCEPTION 'Only admins can authenticate admin password';
  END IF;

  IF NOT public.verify_admin_password(input_password) THEN
    RETURN QUERY
    SELECT
      FALSE,
      NULL::TEXT,
      'Invalid password'::TEXT,
      FALSE;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    TRUE,
    md5(random()::TEXT || clock_timestamp()::TEXT),
    'Authentication successful'::TEXT,
    FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_password_admin(
  input_password TEXT
)
RETURNS BOOLEAN
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
    RAISE EXCEPTION 'Only admins can verify admin password';
  END IF;

  RETURN public.verify_admin_password(input_password);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.authenticate_admin(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.authenticate_admin(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.authenticate_admin(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.verify_admin_password_admin(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_admin_password_admin(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_password_admin(TEXT) TO authenticated;

COMMIT;
