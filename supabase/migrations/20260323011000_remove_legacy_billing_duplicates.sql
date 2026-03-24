BEGIN;

DO $$
DECLARE
  v_unmatched_usage_records INTEGER;
  v_duplicate_usage_mappings INTEGER;
  v_profiles_without_credit_account INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_unmatched_usage_records
  FROM public.usage_records AS ur
  LEFT JOIN public.credit_transactions AS ct
    ON ct.metadata ->> 'source_usage_record_id' = ur.id::TEXT
  WHERE ct.id IS NULL;

  IF v_unmatched_usage_records > 0 THEN
    RAISE EXCEPTION
      'Cannot remove public.usage_records: % rows have not been migrated into public.credit_transactions.',
      v_unmatched_usage_records;
  END IF;

  SELECT COUNT(*)
  INTO v_duplicate_usage_mappings
  FROM (
    SELECT ct.metadata ->> 'source_usage_record_id' AS source_usage_record_id
    FROM public.credit_transactions AS ct
    WHERE ct.metadata ->> 'source_usage_record_id' IS NOT NULL
    GROUP BY 1
    HAVING COUNT(*) > 1
  ) AS duplicate_usage_mappings;

  IF v_duplicate_usage_mappings > 0 THEN
    RAISE EXCEPTION
      'Cannot remove public.usage_records: % migrated usage rows map to more than one ledger row.',
      v_duplicate_usage_mappings;
  END IF;

  SELECT COUNT(*)
  INTO v_profiles_without_credit_account
  FROM public.profiles AS p
  LEFT JOIN public.user_credits AS uc
    ON uc.user_id = p.id
  WHERE uc.user_id IS NULL;

  IF v_profiles_without_credit_account > 0 THEN
    RAISE EXCEPTION
      'Cannot drop public.profiles.credits: % profile rows still lack a canonical public.user_credits account.',
      v_profiles_without_credit_account;
  END IF;
END;
$$;

UPDATE public.credit_transactions AS ct
SET metadata = COALESCE(ct.metadata, '{}'::JSONB)
  || jsonb_build_object(
    'legacy_usage_record_archive', to_jsonb(ur),
    'legacy_usage_record_archived_at', to_jsonb(NOW())
  )
FROM public.usage_records AS ur
WHERE ct.metadata ->> 'source_usage_record_id' = ur.id::TEXT
  AND ct.metadata -> 'legacy_usage_record_archive' IS NULL;

DO $$
DECLARE
  v_unarchived_usage_transactions INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_unarchived_usage_transactions
  FROM public.credit_transactions AS ct
  WHERE ct.metadata ->> 'source_usage_record_id' IS NOT NULL
    AND ct.metadata -> 'legacy_usage_record_archive' IS NULL;

  IF v_unarchived_usage_transactions > 0 THEN
    RAISE EXCEPTION
      'Legacy usage row archival incomplete: % migrated ledger rows are still missing the raw usage_records payload.',
      v_unarchived_usage_transactions;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_credits(amount NUMERIC, description TEXT DEFAULT 'consume')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_amount_int INTEGER;
  v_success BOOLEAN;
  v_new_balance INTEGER;
  v_transaction_id UUID;
  v_message TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RETURN FALSE;
  END IF;

  IF amount <> trunc(amount) THEN
    RAISE EXCEPTION 'Legacy consume_credits(amount, description) only supports whole-credit amounts. Received: %', amount;
  END IF;

  v_amount_int := amount::INTEGER;

  SELECT au.email
  INTO v_email
  FROM auth.users AS au
  WHERE au.id = v_user_id;

  PERFORM public.get_or_create_user_credits(v_user_id, v_email);

  SELECT success, new_balance, transaction_id, message
  INTO v_success, v_new_balance, v_transaction_id, v_message
  FROM public.consume_credits(
    v_user_id,
    v_amount_int,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    COALESCE(description, 'consume')
  );

  RETURN COALESCE(v_success, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP VIEW IF EXISTS public.billing_account_snapshot_v1;
CREATE VIEW public.billing_account_snapshot_v1
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
  uc.updated_at AS credit_account_updated_at
FROM public.profiles AS p
LEFT JOIN public.user_credits AS uc
  ON uc.user_id = p.id;

COMMENT ON VIEW public.billing_account_snapshot_v1 IS
  'Operational read model joining public.profiles with public.user_credits. Legacy mirrored profile credit fields have been removed.';

GRANT SELECT ON TABLE public.billing_account_snapshot_v1 TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_sync_profile_credit_mirror_from_user_credits ON public.user_credits;
DROP FUNCTION IF EXISTS public.sync_profile_credit_mirror_from_user_credits();

ALTER TABLE public.profiles
  DROP COLUMN credits;

COMMENT ON TABLE public.profiles IS
  'CANONICAL user profile/auth metadata. Runtime billing state lives in public.user_credits and public.credit_transactions.';

DROP TABLE public.usage_records;

COMMIT;
