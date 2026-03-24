-- Harden remaining legacy compatibility RPCs that still expose mutation paths too broadly.

CREATE OR REPLACE FUNCTION public.consume_user_credits(
  p_user_id uuid,
  p_consume_amount numeric,
  p_feature text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := COALESCE(auth.role(), '');
  v_user_id uuid := p_user_id;
  v_amount integer := GREATEST(CEIL(COALESCE(p_consume_amount, 0)), 0)::integer;
  v_result record;
BEGIN
  IF v_amount <= 0 THEN
    RETURN TRUE;
  END IF;

  IF v_actor_role <> 'service_role'
     AND (
       v_actor_user_id IS NULL
       OR v_actor_user_id <> v_user_id
     ) THEN
    RETURN FALSE;
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
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_user_credits(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_user_credits(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_user_credits(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_user_credits(uuid, numeric, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_recharge_credits(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_recharge_credits(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_recharge_credits(uuid, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_recharge_credits_by_identity(text, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_recharge_credits_by_identity(text, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_recharge_credits_by_identity(text, integer, text) TO authenticated;
