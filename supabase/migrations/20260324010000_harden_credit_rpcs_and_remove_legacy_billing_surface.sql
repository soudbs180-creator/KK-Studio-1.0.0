BEGIN;

-- Remove the last legacy billing read-model now that runtime reads are on
-- public.user_credits + public.credit_transactions directly.
DROP VIEW IF EXISTS public.billing_account_snapshot_v1;

-- Remove legacy overloads kept only for backward compatibility during migration.
DROP FUNCTION IF EXISTS public.check_user_credits(uuid, numeric);
DROP FUNCTION IF EXISTS public.consume_credits(numeric, text);
DROP FUNCTION IF EXISTS public.deduct_user_credits(uuid, numeric, text);

-- Keep the canonical deduct RPC but align its safety checks with consume_credits.
CREATE OR REPLACE FUNCTION public.deduct_user_credits(
    p_user_id UUID,
    p_credits INTEGER,
    p_model_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_credits public.user_credits;
    v_email TEXT;
    v_new_balance INTEGER;
    v_model_name TEXT;
    v_provider_id TEXT;
BEGIN
    IF p_credits IS NULL OR p_credits <= 0 THEN
        RAISE EXCEPTION 'p_credits must be a positive integer';
    END IF;

    SELECT email
    INTO v_email
    FROM auth.users
    WHERE id = p_user_id;

    SELECT display_name, provider_id
    INTO v_model_name, v_provider_id
    FROM public.admin_credit_models
    WHERE model_id = p_model_id
    LIMIT 1;

    SELECT *
    INTO v_credits
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_credits.balance, 0) < p_credits THEN
        RAISE EXCEPTION '积分不足或用户不存在';
    END IF;

    UPDATE public.user_credits
    SET
        balance = balance - p_credits,
        total_spent = COALESCE(total_spent, 0) + p_credits,
        version = COALESCE(version, 0) + 1,
        last_transaction_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO public.credit_transactions (
        user_id,
        email,
        type,
        amount,
        balance_after,
        model_id,
        model_name,
        provider_id,
        description,
        status,
        completed_at
    ) VALUES (
        p_user_id,
        v_email,
        'consumption',
        -p_credits,
        v_new_balance,
        p_model_id,
        v_model_name,
        v_provider_id,
        '模型调用消耗: ' || COALESCE(p_model_id, 'unknown'),
        'completed',
        NOW()
    );
END;
$function$;

-- These RPCs accept explicit target user IDs and are only safe behind server-side
-- service-role calls. Keep direct browser access closed.
REVOKE ALL ON FUNCTION public.check_user_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_credits(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.deduct_user_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_user_credits(uuid, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.refund_credits(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO service_role;

COMMIT;
