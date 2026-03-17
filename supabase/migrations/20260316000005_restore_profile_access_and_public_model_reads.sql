-- Restore profile self-access and public-safe model catalog reads after security hardening.
-- 1) Remove the profiles policy that references admin_auth directly.
-- 2) Keep admin profile access via the existing security-definer is_admin() helper.
-- 3) Allow anon clients to read sanitized public model metadata again.

BEGIN;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

REVOKE ALL ON FUNCTION public.get_active_credit_models() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_credit_models() FROM anon;
REVOKE ALL ON FUNCTION public.get_active_credit_models() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_credit_models() TO anon;
GRANT EXECUTE ON FUNCTION public.get_active_credit_models() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_credit_models() TO service_role;

REVOKE ALL ON TABLE public.available_models_for_users FROM PUBLIC;
REVOKE ALL ON TABLE public.available_models_for_users FROM anon;
REVOKE ALL ON TABLE public.available_models_for_users FROM authenticated;
GRANT SELECT ON TABLE public.available_models_for_users TO anon;
GRANT SELECT ON TABLE public.available_models_for_users TO authenticated;
GRANT SELECT ON TABLE public.available_models_for_users TO service_role;

COMMIT;
