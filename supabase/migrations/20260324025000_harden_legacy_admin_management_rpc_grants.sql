-- Harden legacy admin-management compatibility RPC grants.
-- These RPCs now require auth.uid() and admin role checks internally, so
-- anonymous execute grants are unnecessary and increase the exposed surface.

REVOKE EXECUTE ON FUNCTION public.admin_add_user(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_add_user(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_add_user(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_change_password(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_change_password(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_change_password(TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_delete_user(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
