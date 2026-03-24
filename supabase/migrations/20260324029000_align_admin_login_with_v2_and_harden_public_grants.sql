-- Route the legacy admin_login entrypoint through admin_login_v2 so only the
-- v2 logic owns the admin-profile lookup behavior. Also remove unnecessary
-- PUBLIC execute grants from login-related RPCs while keeping anon/authenticated.

CREATE OR REPLACE FUNCTION public.admin_login(p_email text, p_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN public.admin_login_v2(
    p_user_email := p_email,
    p_user_id := NULL,
    p_password := p_password
  );
END;
$function$;

COMMENT ON FUNCTION public.admin_login(text, text) IS
  'Legacy compatibility RPC. Delegates to public.admin_login_v2 so admin login rules live in one canonical function.';

COMMENT ON FUNCTION public.admin_login_v2(text, uuid, text) IS
  'Canonical admin login RPC. Validates the admin profile plus the singleton second-factor password state.';

REVOKE EXECUTE ON FUNCTION public.admin_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_login(TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_login_v2(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login_v2(TEXT, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_login_v2(TEXT, UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.verify_admin_password(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin_password(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_password(TEXT) TO authenticated;
