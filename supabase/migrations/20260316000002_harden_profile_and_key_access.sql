-- Harden sensitive key access without breaking existing user-owned API usage.
-- 1. Disable legacy client-callable RPCs/views that can expose provider secrets.
-- 2. Remove the broad authenticated profile-read policy because profiles.user_apis
--    stores user-scoped API configuration for the current direct-browser flow.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.get_secure_model_route(text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_secure_model_route(TEXT, TEXT) FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_secure_model_route(TEXT, TEXT) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_secure_model_route(TEXT, TEXT) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_secure_model_route(TEXT, TEXT) TO service_role';
    EXECUTE $comment$
      COMMENT ON FUNCTION public.get_secure_model_route(TEXT, TEXT)
      IS 'Deprecated: authenticated client access removed because the legacy RPC can expose decrypted provider keys. Use secure-model-proxy instead.'
    $comment$;
  END IF;

  IF to_regprocedure('public.get_model_route_for_user(uuid,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_model_route_for_user(UUID, TEXT, TEXT) FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_model_route_for_user(UUID, TEXT, TEXT) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_model_route_for_user(UUID, TEXT, TEXT) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_model_route_for_user(UUID, TEXT, TEXT) TO service_role';
    EXECUTE $comment$
      COMMENT ON FUNCTION public.get_model_route_for_user(UUID, TEXT, TEXT)
      IS 'Deprecated: authenticated client access removed because the legacy RPC can expose admin model API keys. Use secure-model-proxy instead.'
    $comment$;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.admin_model_full_view') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.admin_model_full_view FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON TABLE public.admin_model_full_view FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.admin_model_full_view FROM authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.admin_model_full_view TO service_role';
    EXECUTE $comment$
      COMMENT ON VIEW public.admin_model_full_view
      IS 'Deprecated: authenticated client access removed because this legacy view can expose admin model secrets.'
    $comment$;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';

    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'profiles'
        AND policyname = 'profiles_select_all_for_authenticated'
    ) THEN
      EXECUTE 'DROP POLICY "profiles_select_all_for_authenticated" ON public.profiles';
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'user_apis'
  ) THEN
    EXECUTE $comment$
      COMMENT ON COLUMN public.profiles.user_apis
      IS 'Sensitive user-scoped API configuration. Do not expose via broad authenticated profile-read policies.'
    $comment$;
  END IF;
END
$$;

COMMIT;
