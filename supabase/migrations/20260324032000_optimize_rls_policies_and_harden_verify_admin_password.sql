-- Remove duplicated/less efficient SELECT policies and tighten the internal
-- admin password helper so clients must go through the authenticated wrappers.

REVOKE EXECUTE ON FUNCTION public.verify_admin_password(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_admin_password(TEXT) FROM authenticated;

COMMENT ON FUNCTION public.verify_admin_password(TEXT) IS
  'Internal helper for admin password verification. Direct client execute grants are intentionally removed; use authenticated admin wrappers instead.';

DROP POLICY IF EXISTS "Admins full access to credit models" ON public.admin_credit_models;
DROP POLICY IF EXISTS "Authenticated users can view public model metadata" ON public.admin_credit_models;

CREATE POLICY admin_credit_models_select_visible_to_authenticated
ON public.admin_credit_models
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND (
    COALESCE((SELECT public.is_admin()), FALSE)
    OR (
      is_active = TRUE
      AND COALESCE(visibility, 'public') = 'public'
    )
  )
);

CREATE POLICY admin_credit_models_admin_insert
ON public.admin_credit_models
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND COALESCE((SELECT public.is_admin()), FALSE)
);

CREATE POLICY admin_credit_models_admin_update
ON public.admin_credit_models
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND COALESCE((SELECT public.is_admin()), FALSE)
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND COALESCE((SELECT public.is_admin()), FALSE)
);

CREATE POLICY admin_credit_models_admin_delete
ON public.admin_credit_models
FOR DELETE
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND COALESCE((SELECT public.is_admin()), FALSE)
);

DROP POLICY IF EXISTS "Admins can read all exchange rates" ON public.credit_exchange_rates;
DROP POLICY IF EXISTS "Authenticated users can read active exchange rates" ON public.credit_exchange_rates;

CREATE POLICY credit_exchange_rates_select_visible_to_authenticated
ON public.credit_exchange_rates
FOR SELECT
TO authenticated
USING (
  COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND (
    COALESCE((SELECT public.is_admin()), FALSE)
    OR is_active = TRUE
  )
);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY profiles_select_self_or_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (
  COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  AND (
    id = (SELECT auth.uid())
    OR COALESCE((SELECT public.is_admin()), FALSE)
  )
);

DROP POLICY IF EXISTS external_identities_select_own ON public.external_identities;

CREATE POLICY external_identities_select_own
ON public.external_identities
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);
