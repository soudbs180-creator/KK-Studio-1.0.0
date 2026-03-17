-- Consolidate runtime-facing Supabase contracts onto the current production schema.
-- This migration is forward-only and assumes the remote project is the source of truth.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep signup/bootstrap behavior aligned so new users always get profile + credits rows with email populated.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, credits, created_at, updated_at)
    VALUES (NEW.id, NEW.email, 0, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.ensure_user_credits_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.user_credits (user_id, email, balance, subject_type, created_at, updated_at)
    VALUES (NEW.id, NEW.email, 0, 'registered', NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET
        email = COALESCE(EXCLUDED.email, public.user_credits.email),
        subject_type = COALESCE(public.user_credits.subject_type, 'registered'),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_user_credits ON public.profiles;
CREATE TRIGGER trg_ensure_user_credits
    AFTER INSERT OR UPDATE OF email ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.ensure_user_credits_exists();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.ensure_user_credits_exists() TO service_role';
    END IF;
END
$$;

-- Backfill missing email fields from auth.users so profiles/user_credits become usable identifiers again.
UPDATE public.profiles AS p
SET
    email = au.email,
    updated_at = NOW()
FROM auth.users AS au
WHERE p.id = au.id
  AND au.email IS NOT NULL
  AND (p.email IS NULL OR btrim(p.email) = '');

UPDATE public.user_credits AS uc
SET
    email = COALESCE(p.email, au.email),
    updated_at = NOW(),
    subject_type = COALESCE(uc.subject_type, 'registered')
FROM public.profiles AS p
LEFT JOIN auth.users AS au
  ON au.id = p.id
WHERE uc.user_id = p.id
  AND (
    uc.email IS DISTINCT FROM COALESCE(p.email, au.email)
    OR uc.subject_type IS NULL
  );

UPDATE public.credit_transactions AS ct
SET email = COALESCE(ct.email, p.email, au.email)
FROM public.profiles AS p
LEFT JOIN auth.users AS au
  ON au.id = p.id
WHERE ct.user_id = p.id
  AND COALESCE(ct.email, '') = '';

-- Move legacy usage rows into the canonical ledger once, then freeze legacy table writes.
INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    description,
    created_at,
    email,
    metadata,
    completed_at,
    balance_after,
    status
)
SELECT
    ur.user_id,
    -ABS(COALESCE(ur.amount, 0)),
    'consumption',
    COALESCE(NULLIF(btrim(ur.feature), ''), 'Legacy usage record migration'),
    ur.created_at,
    COALESCE(NULLIF(btrim(ur.email), ''), p.email, au.email),
    jsonb_build_object(
        'source', 'usage_records',
        'source_usage_record_id', ur.id,
        'legacy_feature', ur.feature,
        'legacy_status', ur.status,
        'migrated_at', NOW()
    ),
    CASE
        WHEN lower(COALESCE(ur.status, '')) = 'success' THEN ur.created_at
        ELSE NULL
    END,
    CASE
        WHEN ur.balance_after IS NULL THEN 0
        ELSE ur.balance_after::integer
    END,
    CASE
        WHEN lower(COALESCE(ur.status, '')) = 'success' THEN 'completed'
        WHEN lower(COALESCE(ur.status, '')) = 'failed' THEN 'failed'
        ELSE COALESCE(ur.status, 'completed')
    END
FROM public.usage_records AS ur
LEFT JOIN public.profiles AS p
  ON p.id = ur.user_id
LEFT JOIN auth.users AS au
  ON au.id = ur.user_id
WHERE COALESCE(ur.amount, 0) <> 0
  AND NOT EXISTS (
      SELECT 1
      FROM public.credit_transactions AS ct
      WHERE ct.metadata ->> 'source_usage_record_id' = ur.id::text
  );

COMMENT ON TABLE public.usage_records IS
    'LEGACY usage log. Historical rows are migrated into public.credit_transactions; new application writes must target the canonical ledger only.';

REVOKE ALL ON TABLE public.usage_records FROM PUBLIC;
REVOKE ALL ON TABLE public.usage_records FROM anon;
REVOKE ALL ON TABLE public.usage_records FROM authenticated;
REVOKE ALL ON TABLE public.usage_records FROM service_role;
GRANT SELECT ON TABLE public.usage_records TO service_role;

COMMENT ON COLUMN public.profiles.credits IS
    'DEPRECATED. Keep for compatibility only; user_credits.balance is the canonical balance source of truth.';

-- Remove the security-definer model catalog and recreate it as a normal security-invoker view.
DROP VIEW IF EXISTS public.available_models_for_users;
CREATE VIEW public.available_models_for_users
WITH (security_invoker = true)
AS
SELECT
    m.id,
    m.model_id,
    m.display_name,
    m.description,
    m.color,
    m.endpoint_type,
    m.credit_cost,
    m.is_active
FROM public.admin_credit_models AS m
WHERE m.is_active = true;

GRANT SELECT ON public.available_models_for_users TO authenticated;
GRANT SELECT ON public.available_models_for_users TO service_role;

-- admin_auth is now legacy-only. Keep it accessible only to server-side callers and satisfy RLS linting.
ALTER TABLE public.admin_auth ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_auth_service_role_only" ON public.admin_auth;
CREATE POLICY "admin_auth_service_role_only"
ON public.admin_auth
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE ALL ON TABLE public.admin_auth FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_auth FROM anon;
REVOKE ALL ON TABLE public.admin_auth FROM authenticated;
REVOKE ALL ON TABLE public.admin_auth FROM service_role;
GRANT SELECT, UPDATE ON TABLE public.admin_auth TO service_role;

COMMENT ON TABLE public.admin_auth IS
    'LEGACY table. Admin identity is sourced from profiles.role; keep this table only for legacy password material used by RPCs.';

-- Pin public RPCs and admin helpers to a stable search_path.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.ensure_user_credits_exists() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_or_create_user_credits(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_user_credits(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_user_credits(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.consume_user_credits(uuid, numeric, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.refund_user_credits(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.consume_credits(uuid, integer, text, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.consume_credits(numeric, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.refund_credits(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.deduct_user_credits(uuid, integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.deduct_user_credits(uuid, numeric, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.process_payment_recharge(uuid, text, numeric, text, integer, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_active_credit_models() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_admin_password(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_recharge_credits(uuid, integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_login_v2(text, uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_login(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_change_password(text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_add_user(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_delete_user(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_list_users() SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_recharge_credits_by_identity(text, integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_on_login() SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_daily_consumption() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_model_credit_cost(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_credit_provider(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.normalize_admin_hex_color(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.derive_admin_secondary_color(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.infer_admin_text_color(text) SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.check_user_credits(uuid, numeric) IS
    'Legacy compatibility overload. New code should call check_user_credits(uuid, integer) with p_* argument names.';
COMMENT ON FUNCTION public.deduct_user_credits(uuid, numeric, text) IS
    'Legacy compatibility overload. New code should call deduct_user_credits(uuid, integer, text) with p_* argument names.';
COMMENT ON FUNCTION public.consume_credits(numeric, text) IS
    'Legacy compatibility overload retained for backward compatibility. New code should call consume_credits(uuid, integer, text, text, text, text).';

COMMIT;
