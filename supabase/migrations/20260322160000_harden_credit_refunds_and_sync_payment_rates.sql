BEGIN;

REVOKE EXECUTE ON FUNCTION public.refund_user_credits(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_user_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_user_credits(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_user_credits(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_payment_recharge(uuid, text, numeric, text, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_payment_recharge(uuid, text, numeric, text, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_payment_recharge(uuid, text, numeric, text, integer, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_recharge(uuid, text, numeric, text, integer, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.process_payment_recharge(
  p_user_id uuid DEFAULT NULL::uuid,
  p_transaction_id text DEFAULT NULL::text,
  p_amount numeric DEFAULT 0,
  p_currency text DEFAULT 'CNY'::text,
  p_credits_added integer DEFAULT NULL::integer,
  p_pay_type text DEFAULT 'alipay'::text,
  p_bill_no text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := p_user_id;
  v_email text;
  v_credits integer;
  v_new_balance integer;
  v_existing_balance integer;
  v_existing_credits integer;
  v_transaction_key text := NULLIF(BTRIM(p_transaction_id), '');
  v_final_bill_no text := COALESCE(NULLIF(BTRIM(p_bill_no), ''), NULLIF(BTRIM(p_transaction_id), ''));
  v_currency_code text := UPPER(COALESCE(NULLIF(BTRIM(p_currency), ''), 'CNY'));
  v_pay_type text := COALESCE(NULLIF(BTRIM(p_pay_type), ''), 'payment');
  v_credits_per_unit numeric;
  v_credit_source text := 'fallback_default';
BEGIN
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid();
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'user_not_identified');
  END IF;

  IF COALESCE(p_amount, 0) <= 0 AND COALESCE(p_credits_added, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'invalid_amount');
  END IF;

  SELECT
    ct.balance_after,
    COALESCE((ct.metadata ->> 'credits_added')::integer, ct.amount::integer)
  INTO
    v_existing_balance,
    v_existing_credits
  FROM public.credit_transactions AS ct
  WHERE ct.user_id = v_user_id
    AND ct.type = 'recharge'
    AND ct.status = 'completed'
    AND (
      (v_transaction_key IS NOT NULL AND ct.metadata ->> 'transaction_id' = v_transaction_key)
      OR (v_final_bill_no IS NOT NULL AND ct.metadata ->> 'bill_no' = v_final_bill_no)
    )
  ORDER BY ct.completed_at DESC NULLS LAST, ct.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'new_balance', v_existing_balance,
      'credits_added', v_existing_credits,
      'credit_source', 'duplicate',
      'deduplicated', true
    );
  END IF;

  SELECT email
  INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  SELECT cer.credits_per_unit
  INTO v_credits_per_unit
  FROM public.credit_exchange_rates AS cer
  WHERE UPPER(cer.currency_code) = v_currency_code
    AND cer.is_active = TRUE
  ORDER BY cer.updated_at DESC NULLS LAST
  LIMIT 1;

  IF p_credits_added IS NOT NULL THEN
    v_credits := GREATEST(p_credits_added, 0);
    v_credit_source := 'explicit';
  ELSIF v_credits_per_unit IS NOT NULL THEN
    v_credits := GREATEST(ROUND(p_amount * v_credits_per_unit)::integer, 0);
    v_credit_source := 'exchange_rate';
  ELSE
    v_credits := GREATEST(FLOOR(p_amount * 5)::integer, 0);
  END IF;

  IF v_credits <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'invalid_credit_amount');
  END IF;

  INSERT INTO public.user_credits (
    user_id,
    email,
    balance,
    total_earned,
    version,
    last_transaction_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_email,
    v_credits,
    v_credits,
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET balance = COALESCE(public.user_credits.balance, 0) + EXCLUDED.balance,
      total_earned = COALESCE(public.user_credits.total_earned, 0) + EXCLUDED.balance,
      version = COALESCE(public.user_credits.version, 0) + 1,
      last_transaction_at = NOW(),
      updated_at = NOW(),
      email = COALESCE(EXCLUDED.email, public.user_credits.email)
  RETURNING balance::integer INTO v_new_balance;

  INSERT INTO public.credit_transactions (
    user_id,
    email,
    type,
    amount,
    balance_after,
    description,
    status,
    metadata,
    completed_at
  ) VALUES (
    v_user_id,
    v_email,
    'recharge',
    v_credits,
    v_new_balance,
    'Online recharge: ' || v_pay_type || ' (' || COALESCE(v_final_bill_no, v_transaction_key, 'manual') || ')',
    'completed',
    jsonb_strip_nulls(jsonb_build_object(
      'bill_no', v_final_bill_no,
      'transaction_id', v_transaction_key,
      'currency', v_currency_code,
      'amount_raw', p_amount,
      'pay_type', v_pay_type,
      'credits_per_unit', v_credits_per_unit,
      'credits_added', v_credits,
      'credit_source', v_credit_source
    )),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'credits_added', v_credits,
    'credit_source', v_credit_source
  );
END;
$function$;

COMMIT;
