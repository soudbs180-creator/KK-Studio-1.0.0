-- Repair the admin_login(text, text) entrypoint after simplifying admin_auth.
-- The runtime should keep the two-argument signature and remove the accidental
-- single-argument overload.

DROP FUNCTION IF EXISTS public.admin_login(text);

CREATE OR REPLACE FUNCTION public.admin_login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_admin_profile public.profiles;
    v_admin_auth public.admin_auth;
    v_normalized_email text := NULLIF(btrim(COALESCE(p_email, '')), '');
BEGIN
    SELECT *
    INTO v_admin_profile
    FROM public.profiles
    WHERE role = 'admin'
      AND v_normalized_email IS NOT NULL
      AND email IS NOT NULL
      AND lower(email) = lower(v_normalized_email)
    ORDER BY created_at ASC NULLS FIRST, id ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Invalid email or password');
    END IF;

    SELECT *
    INTO v_admin_auth
    FROM public.admin_auth
    ORDER BY id ASC
    LIMIT 1;

    IF NOT FOUND OR v_admin_auth.password_hash IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Invalid email or password');
    END IF;

    IF v_admin_auth.password_hash = md5(COALESCE(p_password, '')) THEN
        RETURN json_build_object(
            'success', true,
            'requires_password_change', COALESCE(v_admin_auth.requires_password_change, true),
            'id', v_admin_auth.id
        );
    END IF;

    RETURN json_build_object('success', false, 'message', 'Invalid email or password');
END;
$function$;
