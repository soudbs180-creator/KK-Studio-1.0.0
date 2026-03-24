-- Simplify admin_auth into a singleton second-factor password store.
-- Runtime admin identity already lives in public.profiles.role, and
-- admin elevation sessions live in public.admin_sessions.

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

CREATE OR REPLACE FUNCTION public.admin_login_v2(p_user_email text, p_user_id uuid, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_admin_profile public.profiles;
    v_admin_auth public.admin_auth;
    v_normalized_email text := NULLIF(btrim(COALESCE(p_user_email, '')), '');
BEGIN
    SELECT *
    INTO v_admin_profile
    FROM public.profiles
    WHERE role = 'admin'
      AND (
        (p_user_id IS NOT NULL AND id = p_user_id)
        OR (
            v_normalized_email IS NOT NULL
            AND email IS NOT NULL
            AND lower(email) = lower(v_normalized_email)
        )
      )
    ORDER BY
        CASE WHEN p_user_id IS NOT NULL AND id = p_user_id THEN 0 ELSE 1 END,
        created_at ASC NULLS FIRST,
        id ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', '您没有管理员权限或账户未激活');
    END IF;

    SELECT *
    INTO v_admin_auth
    FROM public.admin_auth
    ORDER BY id ASC
    LIMIT 1;

    IF NOT FOUND OR v_admin_auth.password_hash IS NULL THEN
        RETURN json_build_object('success', false, 'message', '您没有管理员权限或账户未激活');
    END IF;

    IF v_admin_auth.password_hash = md5(COALESCE(p_password, '')) THEN
        RETURN json_build_object(
            'success', true,
            'requires_password_change', COALESCE(v_admin_auth.requires_password_change, true),
            'id', v_admin_auth.id,
            'message', '登录成功'
        );
    END IF;

    RETURN json_build_object('success', false, 'message', '密码错误');
END;
$function$;

DROP INDEX IF EXISTS public.idx_admin_auth_admin_user_id;

ALTER TABLE public.admin_auth
    DROP CONSTRAINT IF EXISTS admin_auth_admin_user_id_fkey,
    DROP CONSTRAINT IF EXISTS admin_auth_email_key,
    DROP COLUMN IF EXISTS admin_user_id,
    DROP COLUMN IF EXISTS email,
    DROP COLUMN IF EXISTS is_active;

COMMENT ON TABLE public.admin_auth IS
    'SINGLETON admin second-factor password config. Runtime admin identity lives in public.profiles.role and elevation sessions live in public.admin_sessions.';
