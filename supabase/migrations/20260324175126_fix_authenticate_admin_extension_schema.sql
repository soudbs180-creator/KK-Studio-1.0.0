-- Fix authenticate_admin to explicitly use pgcrypto functions from the
-- extensions schema. The RPC intentionally pins search_path to public/pg_temp,
-- so unqualified pgcrypto calls fail on Supabase where pgcrypto lives under
-- extensions.

CREATE OR REPLACE FUNCTION public.authenticate_admin(input_password text)
RETURNS TABLE(success boolean, token text, message text, requires_password_change boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_admin_user_id uuid := auth.uid();
    v_now timestamptz := now();
    v_expires_at timestamptz := v_now + interval '30 minutes';
    v_requires_password_change boolean := true;
    v_token text;
    v_token_hash text;
BEGIN
    IF v_admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = v_admin_user_id
          AND p.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only admins can authenticate admin password';
    END IF;

    SELECT COALESCE(aa.requires_password_change, true)
    INTO v_requires_password_change
    FROM public.admin_auth AS aa
    ORDER BY aa.id ASC
    LIMIT 1;

    IF NOT COALESCE(public.verify_admin_password(input_password), false) THEN
        RETURN QUERY
        SELECT
            false,
            null::text,
            'Invalid password'::text,
            COALESCE(v_requires_password_change, true);
        RETURN;
    END IF;

    UPDATE public.admin_sessions
    SET revoked_at = v_now
    WHERE admin_user_id = v_admin_user_id
      AND revoked_at IS NULL;

    v_token := 'adm_' || encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

    INSERT INTO public.admin_sessions (
        admin_user_id,
        session_token_hash,
        expires_at,
        created_at
    ) VALUES (
        v_admin_user_id,
        v_token_hash,
        v_expires_at,
        v_now
    );

    RETURN QUERY
    SELECT
        true,
        v_token,
        'Authentication successful'::text,
        COALESCE(v_requires_password_change, true);
END;
$function$;

