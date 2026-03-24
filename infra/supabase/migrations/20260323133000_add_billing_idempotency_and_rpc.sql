BEGIN;

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS business_ref_type text,
  ADD COLUMN IF NOT EXISTS business_ref_id text;

COMMENT ON COLUMN public.credit_transactions.idempotency_key IS
  'Canonical idempotency key used by the migrated billing API for debit and settlement operations.';

COMMENT ON COLUMN public.credit_transactions.business_ref_type IS
  'Business reference type exposed by the API contract, for example generation_task or payment_order.';

COMMENT ON COLUMN public.credit_transactions.business_ref_id IS
  'Business reference identifier exposed by the API contract.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_credit_transactions_user_type_idempotency_key
  ON public.credit_transactions (user_id, type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_business_reference
  ON public.credit_transactions (business_ref_type, business_ref_id)
  WHERE business_ref_type IS NOT NULL AND business_ref_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.api_record_credit_debit_v1(
  p_user_id uuid,
  p_ledger_id uuid,
  p_business_ref_type text,
  p_business_ref_id text,
  p_credit_amount integer,
  p_idempotency_key text,
  p_model_code text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_account_row public.user_credits%ROWTYPE;
  v_ledger_row public.credit_transactions%ROWTYPE;
  v_existing_row public.credit_transactions%ROWTYPE;
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'AUTH_REQUIRED',
      'message', 'A user id is required for credit debit persistence.'
    );
  END IF;

  IF COALESCE(p_credit_amount, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_CREDIT_AMOUNT',
      'message', 'creditAmount must be a positive integer.'
    );
  END IF;

  IF COALESCE(NULLIF(BTRIM(p_idempotency_key), ''), '') = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_IDEMPOTENCY_KEY',
      'message', 'idempotencyKey is required.'
    );
  END IF;

  SELECT *
  INTO v_existing_row
  FROM public.credit_transactions
  WHERE user_id = p_user_id
    AND type = 'consumption'
    AND idempotency_key = p_idempotency_key
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT *
    INTO v_account_row
    FROM public.user_credits
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'deduplicated', true,
      'account', jsonb_build_object(
        'account_id', p_user_id,
        'user_id', p_user_id,
        'balance', COALESCE(v_account_row.balance, v_existing_row.balance_after)::integer,
        'frozen_balance', COALESCE(v_account_row.frozen, 0),
        'created_at', COALESCE(v_account_row.created_at, v_existing_row.created_at, NOW()),
        'updated_at', COALESCE(v_account_row.updated_at, v_existing_row.completed_at, v_existing_row.created_at, NOW())
      ),
      'ledger', jsonb_build_object(
        'ledger_id', v_existing_row.id,
        'user_id', v_existing_row.user_id,
        'business_ref_type', COALESCE(v_existing_row.business_ref_type, p_business_ref_type),
        'business_ref_id', COALESCE(v_existing_row.business_ref_id, p_business_ref_id),
        'credit_amount', ABS(v_existing_row.amount)::integer,
        'model_code', COALESCE(v_existing_row.model_id, p_model_code),
        'idempotency_key', COALESCE(v_existing_row.idempotency_key, p_idempotency_key),
        'balance_after', v_existing_row.balance_after,
        'transaction_type', 'debit',
        'created_at', COALESCE(v_existing_row.completed_at, v_existing_row.created_at)
      )
    );
  END IF;

  SELECT au.email
  INTO v_email
  FROM auth.users AS au
  WHERE au.id = p_user_id;

  INSERT INTO public.user_credits (
    user_id,
    email,
    balance
  ) VALUES (
    p_user_id,
    v_email,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO v_account_row
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'BILLING_ACCOUNT_NOT_FOUND',
      'message', 'No credit account could be created for the requested user.'
    );
  END IF;

  IF COALESCE(v_account_row.balance, 0) < p_credit_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CREDIT_BALANCE_INSUFFICIENT',
      'message', 'The current credit balance is insufficient for this debit request.',
      'balance', COALESCE(v_account_row.balance, 0)::integer
    );
  END IF;

  UPDATE public.user_credits
  SET
    balance = COALESCE(balance, 0) - p_credit_amount,
    total_spent = COALESCE(total_spent, 0) + p_credit_amount,
    version = COALESCE(version, 0) + 1,
    last_transaction_at = NOW(),
    updated_at = NOW(),
    email = COALESCE(v_email, email)
  WHERE user_id = p_user_id
  RETURNING * INTO v_account_row;

  INSERT INTO public.credit_transactions (
    id,
    user_id,
    email,
    type,
    amount,
    balance_after,
    model_id,
    description,
    status,
    metadata,
    completed_at,
    idempotency_key,
    business_ref_type,
    business_ref_id
  ) VALUES (
    p_ledger_id,
    p_user_id,
    COALESCE(v_email, v_account_row.email),
    'consumption',
    -p_credit_amount,
    COALESCE(v_account_row.balance, 0)::integer,
    p_model_code,
    'API debit for ' || COALESCE(NULLIF(BTRIM(p_business_ref_type), ''), 'business_ref') || ':' || COALESCE(NULLIF(BTRIM(p_business_ref_id), ''), 'unknown'),
    'completed',
    jsonb_strip_nulls(jsonb_build_object(
      'canonical_transaction_type', 'debit',
      'idempotency_key', p_idempotency_key,
      'business_ref_type', p_business_ref_type,
      'business_ref_id', p_business_ref_id,
      'model_code', p_model_code
    )),
    NOW(),
    p_idempotency_key,
    p_business_ref_type,
    p_business_ref_id
  )
  RETURNING * INTO v_ledger_row;

  RETURN jsonb_build_object(
    'success', true,
    'deduplicated', false,
    'account', jsonb_build_object(
      'account_id', p_user_id,
      'user_id', p_user_id,
      'balance', COALESCE(v_account_row.balance, 0)::integer,
      'frozen_balance', COALESCE(v_account_row.frozen, 0),
      'created_at', COALESCE(v_account_row.created_at, NOW()),
      'updated_at', COALESCE(v_account_row.updated_at, NOW())
    ),
    'ledger', jsonb_build_object(
      'ledger_id', v_ledger_row.id,
      'user_id', v_ledger_row.user_id,
      'business_ref_type', COALESCE(v_ledger_row.business_ref_type, p_business_ref_type),
      'business_ref_id', COALESCE(v_ledger_row.business_ref_id, p_business_ref_id),
      'credit_amount', p_credit_amount,
      'model_code', p_model_code,
      'idempotency_key', p_idempotency_key,
      'balance_after', v_ledger_row.balance_after,
      'transaction_type', 'debit',
      'created_at', COALESCE(v_ledger_row.completed_at, v_ledger_row.created_at)
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT *
    INTO v_existing_row
    FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND type = 'consumption'
      AND idempotency_key = p_idempotency_key
    ORDER BY completed_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF FOUND THEN
      SELECT *
      INTO v_account_row
      FROM public.user_credits
      WHERE user_id = p_user_id;

      RETURN jsonb_build_object(
        'success', true,
        'deduplicated', true,
        'account', jsonb_build_object(
          'account_id', p_user_id,
          'user_id', p_user_id,
          'balance', COALESCE(v_account_row.balance, v_existing_row.balance_after)::integer,
          'frozen_balance', COALESCE(v_account_row.frozen, 0),
          'created_at', COALESCE(v_account_row.created_at, v_existing_row.created_at, NOW()),
          'updated_at', COALESCE(v_account_row.updated_at, v_existing_row.completed_at, v_existing_row.created_at, NOW())
        ),
        'ledger', jsonb_build_object(
          'ledger_id', v_existing_row.id,
          'user_id', v_existing_row.user_id,
          'business_ref_type', COALESCE(v_existing_row.business_ref_type, p_business_ref_type),
          'business_ref_id', COALESCE(v_existing_row.business_ref_id, p_business_ref_id),
          'credit_amount', ABS(v_existing_row.amount)::integer,
          'model_code', COALESCE(v_existing_row.model_id, p_model_code),
          'idempotency_key', COALESCE(v_existing_row.idempotency_key, p_idempotency_key),
          'balance_after', v_existing_row.balance_after,
          'transaction_type', 'debit',
          'created_at', COALESCE(v_existing_row.completed_at, v_existing_row.created_at)
        )
      );
    END IF;

    RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.api_record_payment_settlement_v1(
  p_user_id uuid,
  p_ledger_id uuid,
  p_payment_order_id text,
  p_credit_amount integer,
  p_callback_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_account_row public.user_credits%ROWTYPE;
  v_ledger_row public.credit_transactions%ROWTYPE;
  v_existing_row public.credit_transactions%ROWTYPE;
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'AUTH_REQUIRED',
      'message', 'A user id is required for payment settlement persistence.'
    );
  END IF;

  IF COALESCE(p_credit_amount, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_CREDIT_AMOUNT',
      'message', 'creditAmount must be a positive integer.'
    );
  END IF;

  IF COALESCE(NULLIF(BTRIM(p_callback_id), ''), '') = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_CALLBACK_ID',
      'message', 'callbackId is required.'
    );
  END IF;

  SELECT *
  INTO v_existing_row
  FROM public.credit_transactions
  WHERE user_id = p_user_id
    AND type = 'recharge'
    AND idempotency_key = p_callback_id
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT *
    INTO v_account_row
    FROM public.user_credits
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'deduplicated', true,
      'account', jsonb_build_object(
        'account_id', p_user_id,
        'user_id', p_user_id,
        'balance', COALESCE(v_account_row.balance, v_existing_row.balance_after)::integer,
        'frozen_balance', COALESCE(v_account_row.frozen, 0),
        'created_at', COALESCE(v_account_row.created_at, v_existing_row.created_at, NOW()),
        'updated_at', COALESCE(v_account_row.updated_at, v_existing_row.completed_at, v_existing_row.created_at, NOW())
      ),
      'ledger', jsonb_build_object(
        'ledger_id', v_existing_row.id,
        'user_id', v_existing_row.user_id,
        'business_ref_type', COALESCE(v_existing_row.business_ref_type, 'payment_order'),
        'business_ref_id', COALESCE(v_existing_row.business_ref_id, p_payment_order_id),
        'credit_amount', ABS(v_existing_row.amount)::integer,
        'idempotency_key', COALESCE(v_existing_row.idempotency_key, p_callback_id),
        'balance_after', v_existing_row.balance_after,
        'transaction_type', 'recharge',
        'created_at', COALESCE(v_existing_row.completed_at, v_existing_row.created_at)
      )
    );
  END IF;

  SELECT au.email
  INTO v_email
  FROM auth.users AS au
  WHERE au.id = p_user_id;

  INSERT INTO public.user_credits (
    user_id,
    email,
    balance
  ) VALUES (
    p_user_id,
    v_email,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_credits
  SET
    balance = COALESCE(balance, 0) + p_credit_amount,
    total_earned = COALESCE(total_earned, 0) + p_credit_amount,
    version = COALESCE(version, 0) + 1,
    last_transaction_at = NOW(),
    updated_at = NOW(),
    email = COALESCE(v_email, email)
  WHERE user_id = p_user_id
  RETURNING * INTO v_account_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'BILLING_ACCOUNT_NOT_FOUND',
      'message', 'No credit account could be created for the requested user.'
    );
  END IF;

  INSERT INTO public.credit_transactions (
    id,
    user_id,
    email,
    type,
    amount,
    balance_after,
    description,
    status,
    metadata,
    completed_at,
    idempotency_key,
    business_ref_type,
    business_ref_id
  ) VALUES (
    p_ledger_id,
    p_user_id,
    COALESCE(v_email, v_account_row.email),
    'recharge',
    p_credit_amount,
    COALESCE(v_account_row.balance, 0)::integer,
    'Payment settlement for ' || COALESCE(NULLIF(BTRIM(p_payment_order_id), ''), 'payment_order'),
    'completed',
    jsonb_strip_nulls(jsonb_build_object(
      'canonical_transaction_type', 'recharge',
      'idempotency_key', p_callback_id,
      'business_ref_type', 'payment_order',
      'business_ref_id', p_payment_order_id,
      'payment_order_id', p_payment_order_id,
      'callback_id', p_callback_id
    )),
    NOW(),
    p_callback_id,
    'payment_order',
    p_payment_order_id
  )
  RETURNING * INTO v_ledger_row;

  RETURN jsonb_build_object(
    'success', true,
    'deduplicated', false,
    'account', jsonb_build_object(
      'account_id', p_user_id,
      'user_id', p_user_id,
      'balance', COALESCE(v_account_row.balance, 0)::integer,
      'frozen_balance', COALESCE(v_account_row.frozen, 0),
      'created_at', COALESCE(v_account_row.created_at, NOW()),
      'updated_at', COALESCE(v_account_row.updated_at, NOW())
    ),
    'ledger', jsonb_build_object(
      'ledger_id', v_ledger_row.id,
      'user_id', v_ledger_row.user_id,
      'business_ref_type', COALESCE(v_ledger_row.business_ref_type, 'payment_order'),
      'business_ref_id', COALESCE(v_ledger_row.business_ref_id, p_payment_order_id),
      'credit_amount', p_credit_amount,
      'idempotency_key', p_callback_id,
      'balance_after', v_ledger_row.balance_after,
      'transaction_type', 'recharge',
      'created_at', COALESCE(v_ledger_row.completed_at, v_ledger_row.created_at)
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT *
    INTO v_existing_row
    FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND type = 'recharge'
      AND idempotency_key = p_callback_id
    ORDER BY completed_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF FOUND THEN
      SELECT *
      INTO v_account_row
      FROM public.user_credits
      WHERE user_id = p_user_id;

      RETURN jsonb_build_object(
        'success', true,
        'deduplicated', true,
        'account', jsonb_build_object(
          'account_id', p_user_id,
          'user_id', p_user_id,
          'balance', COALESCE(v_account_row.balance, v_existing_row.balance_after)::integer,
          'frozen_balance', COALESCE(v_account_row.frozen, 0),
          'created_at', COALESCE(v_account_row.created_at, v_existing_row.created_at, NOW()),
          'updated_at', COALESCE(v_account_row.updated_at, v_existing_row.completed_at, v_existing_row.created_at, NOW())
        ),
        'ledger', jsonb_build_object(
          'ledger_id', v_existing_row.id,
          'user_id', v_existing_row.user_id,
          'business_ref_type', COALESCE(v_existing_row.business_ref_type, 'payment_order'),
          'business_ref_id', COALESCE(v_existing_row.business_ref_id, p_payment_order_id),
          'credit_amount', ABS(v_existing_row.amount)::integer,
          'idempotency_key', COALESCE(v_existing_row.idempotency_key, p_callback_id),
          'balance_after', v_existing_row.balance_after,
          'transaction_type', 'recharge',
          'created_at', COALESCE(v_existing_row.completed_at, v_existing_row.created_at)
        )
      );
    END IF;

    RAISE;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.api_record_credit_debit_v1(uuid, uuid, text, text, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.api_record_credit_debit_v1(uuid, uuid, text, text, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.api_record_credit_debit_v1(uuid, uuid, text, text, integer, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.api_record_credit_debit_v1(uuid, uuid, text, text, integer, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.api_record_payment_settlement_v1(uuid, uuid, text, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.api_record_payment_settlement_v1(uuid, uuid, text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.api_record_payment_settlement_v1(uuid, uuid, text, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.api_record_payment_settlement_v1(uuid, uuid, text, integer, text) TO service_role;

COMMENT ON FUNCTION public.api_record_credit_debit_v1(uuid, uuid, text, text, integer, text, text) IS
  'Atomic server-side billing debit writer for the migrated main API. Persists idempotent debit entries into user_credits and credit_transactions.';

COMMENT ON FUNCTION public.api_record_payment_settlement_v1(uuid, uuid, text, integer, text) IS
  'Atomic server-side payment settlement writer for the migrated main API. Persists idempotent recharge entries into user_credits and credit_transactions.';

COMMIT;
