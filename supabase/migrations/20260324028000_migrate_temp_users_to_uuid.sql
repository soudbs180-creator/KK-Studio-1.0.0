-- temp_users now uses canonical UUID user identifiers.
-- Historical non-UUID rows were already cleaned up, so the table can be
-- migrated from legacy text ids to uuid without carrying dual formats.

DROP POLICY IF EXISTS "Allow public to create temp users" ON public.temp_users;

ALTER TABLE public.temp_users
  ALTER COLUMN id TYPE uuid
  USING id::uuid;

CREATE POLICY "Allow public to create temp users"
ON public.temp_users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  is_active = TRUE
  AND expires_at > NOW()
  AND expires_at <= NOW() + INTERVAL '24 hours'
  AND created_at >= NOW() - INTERVAL '5 minutes'
  AND created_at <= NOW() + INTERVAL '5 minutes'
  AND id IS NOT NULL
  AND (metadata IS NULL OR jsonb_typeof(metadata) = 'object')
);

CREATE OR REPLACE FUNCTION public.refund_user_credits(p_user_id uuid, p_refund_amount integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := p_user_id;
  v_amount integer := GREATEST(COALESCE(p_refund_amount, 0), 0);
  v_email text;
  v_subject_type text := 'registered';
  v_credit_row public.user_credits;
  v_new_balance integer;
  v_effective_email text;
  v_effective_subject_type text;
  v_is_temp_user boolean := FALSE;
BEGIN
  IF v_amount <= 0 THEN
    RETURN TRUE;
  END IF;

  SELECT p.email, 'registered'
  INTO v_email, v_subject_type
  FROM public.profiles AS p
  WHERE p.id = v_user_id;

  IF NOT FOUND THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.temp_users AS tu
      WHERE tu.id = v_user_id
        AND tu.is_active = TRUE
    )
    INTO v_is_temp_user;

    IF v_is_temp_user THEN
      RETURN TRUE;
    END IF;
  END IF;

  PERFORM 1
  FROM auth.users
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM public.get_or_create_user_credits(v_user_id, v_email);

  SELECT *
  INTO v_credit_row
  FROM public.user_credits
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.user_credits
  SET
    balance = balance + v_amount,
    total_spent = GREATEST(COALESCE(total_spent, 0) - v_amount, 0),
    version = COALESCE(version, 0) + 1,
    last_transaction_at = NOW(),
    updated_at = NOW(),
    email = COALESCE(v_email, email),
    subject_type = COALESCE(subject_type, v_subject_type)
  WHERE user_id = v_user_id
  RETURNING balance, email, subject_type
  INTO v_new_balance, v_effective_email, v_effective_subject_type;

  INSERT INTO public.credit_transactions (
    user_id,
    email,
    type,
    amount,
    balance_after,
    description,
    status,
    completed_at,
    metadata
  ) VALUES (
    v_user_id,
    COALESCE(v_effective_email, v_email, v_credit_row.email),
    'refund',
    v_amount,
    v_new_balance,
    '任务失败自动退款',
    'completed',
    NOW(),
    jsonb_build_object(
      'source', 'refund_user_credits_legacy_wrapper',
      'subject_type', COALESCE(v_effective_subject_type, v_credit_row.subject_type, v_subject_type)
    )
  );

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[refund_user_credits] %', SQLERRM;
  RETURN FALSE;
END;
$function$;

COMMENT ON COLUMN public.temp_users.id IS
  'Canonical temporary user UUID. Legacy text identifiers were retired after migration.';
