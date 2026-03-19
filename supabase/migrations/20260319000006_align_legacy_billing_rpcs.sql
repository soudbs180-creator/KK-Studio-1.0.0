BEGIN;

CREATE OR REPLACE FUNCTION public.consume_user_credits(
  p_user_id uuid,
  p_consume_amount numeric,
  p_feature text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := p_user_id;
  v_amount integer := GREATEST(CEIL(COALESCE(p_consume_amount, 0)), 0)::integer;
  v_result record;
BEGIN
  IF v_amount <= 0 THEN
    RETURN TRUE;
  END IF;

  SELECT *
  INTO v_result
  FROM public.consume_credits(
    p_user_id := v_user_id,
    p_amount := v_amount,
    p_model_id := NULL,
    p_model_name := NULL,
    p_provider_id := NULL,
    p_description := COALESCE(NULLIF(btrim(p_feature), ''), '模型调用')
  );

  RETURN COALESCE(v_result.success, FALSE);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[consume_user_credits] %', SQLERRM;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_user_credits(
  p_user_id uuid,
  p_refund_amount integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := p_user_id;
  v_amount integer := GREATEST(COALESCE(p_refund_amount, 0), 0);
  v_email text;
  v_subject_type text := 'registered';
  v_credit_row public.user_credits;
  v_new_balance integer;
BEGIN
  IF v_amount <= 0 THEN
    RETURN TRUE;
  END IF;

  SELECT p.email, 'registered'
  INTO v_email, v_subject_type
  FROM public.profiles AS p
  WHERE p.id = v_user_id;

  IF NOT FOUND THEN
    SELECT tu.email, 'temporary'
    INTO v_email, v_subject_type
    FROM public.temp_users AS tu
    WHERE tu.id = v_user_id;
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
    version = version + 1,
    last_transaction_at = NOW(),
    updated_at = NOW(),
    email = COALESCE(v_email, email),
    subject_type = COALESCE(subject_type, v_subject_type)
  WHERE id = v_credit_row.id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.credit_transactions (
    user_id,
    email,
    subject_type,
    type,
    amount,
    balance_after,
    description,
    status,
    completed_at,
    metadata
  ) VALUES (
    v_user_id,
    COALESCE(v_email, v_credit_row.email),
    COALESCE(v_credit_row.subject_type, v_subject_type),
    'refund',
    v_amount,
    v_new_balance,
    '任务失败自动退款',
    'completed',
    NOW(),
    jsonb_build_object('source', 'refund_user_credits_legacy_wrapper')
  );

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[refund_user_credits] %', SQLERRM;
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.consume_user_credits(uuid, numeric, text) IS
  'Compatibility wrapper that routes legacy client billing into the canonical credit_transactions ledger.';

COMMENT ON FUNCTION public.refund_user_credits(uuid, integer) IS
  'Compatibility wrapper that records legacy refunds in credit_transactions instead of deprecated tables.';

COMMIT;
