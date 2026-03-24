BEGIN;

COMMENT ON TABLE public.user_credits IS
  'CANONICAL runtime credit account. This is the source of truth for balances, totals, and credit locking state.';

COMMENT ON TABLE public.credit_transactions IS
  'CANONICAL runtime credit ledger. All new debit, refund, recharge, and settlement writes must land here.';

COMMENT ON TABLE public.profiles IS
  'CANONICAL user profile/auth metadata. public.profiles.credits is retained only as a compatibility mirror of public.user_credits.balance.';

COMMENT ON COLUMN public.profiles.credits IS
  'COMPATIBILITY MIRROR ONLY. Synced from public.user_credits.balance so legacy readers do not drift from the runtime source of truth.';

COMMENT ON TABLE public.usage_records IS
  'LEGACY usage log archive. Historical rows are preserved, but runtime billing must read/write public.credit_transactions only.';

COMMENT ON TABLE public.admin_auth IS
  'LEGACY admin password material. Runtime admin identity and elevation flow use profiles.role plus public.admin_sessions.';

CREATE OR REPLACE FUNCTION public.sync_profile_credit_mirror_from_user_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
  SET
    credits = COALESCE(NEW.balance, 0),
    updated_at = NOW()
  WHERE id = NEW.user_id
    AND COALESCE(credits, 0) IS DISTINCT FROM COALESCE(NEW.balance, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_credit_mirror_from_user_credits ON public.user_credits;
CREATE TRIGGER trg_sync_profile_credit_mirror_from_user_credits
AFTER INSERT OR UPDATE OF balance ON public.user_credits
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_credit_mirror_from_user_credits();

UPDATE public.profiles AS p
SET
  credits = COALESCE(uc.balance, 0),
  updated_at = NOW()
FROM public.user_credits AS uc
WHERE uc.user_id = p.id
  AND COALESCE(p.credits, 0) IS DISTINCT FROM COALESCE(uc.balance, 0);

CREATE OR REPLACE VIEW public.billing_account_snapshot_v1
WITH (security_invoker = true)
AS
SELECT
  p.id AS user_id,
  COALESCE(p.email, uc.email) AS email,
  p.nickname,
  p.avatar_url,
  p.role,
  COALESCE(uc.balance, 0) AS balance,
  COALESCE(uc.total_earned, 0) AS total_earned,
  COALESCE(uc.total_spent, 0) AS total_spent,
  COALESCE(uc.frozen, 0) AS frozen,
  COALESCE(uc.subject_type, 'registered') AS subject_type,
  COALESCE(uc.version, 1) AS version,
  uc.last_transaction_at,
  p.created_at AS profile_created_at,
  p.updated_at AS profile_updated_at,
  uc.created_at AS credit_account_created_at,
  uc.updated_at AS credit_account_updated_at,
  p.credits AS legacy_profile_credits_mirror
FROM public.profiles AS p
LEFT JOIN public.user_credits AS uc
  ON uc.user_id = p.id;

COMMENT ON VIEW public.billing_account_snapshot_v1 IS
  'Operational read model joining public.profiles with public.user_credits. Prefer this or the canonical base tables over deprecated profile credit fields.';

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_orders_select_own ON public.payment_orders;
DROP POLICY IF EXISTS payment_orders_service_role_only ON public.payment_orders;
CREATE POLICY payment_orders_service_role_only
ON public.payment_orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS payment_callbacks_service_role_only ON public.payment_callbacks;
CREATE POLICY payment_callbacks_service_role_only
ON public.payment_callbacks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS admin_sessions_select_own ON public.admin_sessions;
DROP POLICY IF EXISTS admin_sessions_service_role_only ON public.admin_sessions;
CREATE POLICY admin_sessions_service_role_only
ON public.admin_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE ALL ON TABLE public.payment_orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payment_callbacks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_sessions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_callbacks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_sessions TO service_role;
GRANT SELECT ON TABLE public.billing_account_snapshot_v1 TO service_role;

COMMIT;
