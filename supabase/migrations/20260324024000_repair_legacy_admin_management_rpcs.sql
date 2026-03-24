-- Repair legacy admin management RPCs after admin_auth was simplified into a
-- singleton second-factor password store.

CREATE OR REPLACE FUNCTION public.admin_change_password(
    p_email text,
    p_old_password text,
    p_new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_admin_user_id uuid := auth.uid();
    v_current_admin_email text;
    v_requested_email text := NULLIF(btrim(COALESCE(p_email, '')), '');
    v_new_password text := NULLIF(btrim(COALESCE(p_new_password, '')), '');
    v_admin_auth_id integer;
BEGIN
    IF v_admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT p.email
    INTO v_current_admin_email
    FROM public.profiles AS p
    WHERE p.id = v_admin_user_id
      AND p.role = 'admin'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Only admins can change the admin password');
    END IF;

    IF v_requested_email IS NOT NULL
       AND v_current_admin_email IS NOT NULL
       AND lower(v_current_admin_email) <> lower(v_requested_email) THEN
        RETURN json_build_object('success', false, 'message', 'Only the current admin can change the singleton admin password');
    END IF;

    IF v_new_password IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'New password cannot be empty');
    END IF;

    IF NOT COALESCE(public.verify_admin_password(p_old_password), false) THEN
        RETURN json_build_object('success', false, 'message', 'Incorrect old password');
    END IF;

    SELECT aa.id
    INTO v_admin_auth_id
    FROM public.admin_auth AS aa
    ORDER BY aa.id ASC
    LIMIT 1;

    IF v_admin_auth_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'The admin password store is not initialized');
    END IF;

    UPDATE public.admin_auth
    SET
        password_hash = md5(v_new_password),
        requires_password_change = false,
        updated_at = now()
    WHERE id = v_admin_auth_id;

    UPDATE public.admin_sessions
    SET revoked_at = now()
    WHERE revoked_at IS NULL;

    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_add_user(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_admin_user_id uuid := auth.uid();
    v_target public.profiles;
    v_requested_email text := NULLIF(btrim(COALESCE(p_email, '')), '');
BEGIN
    IF v_admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = v_admin_user_id
          AND p.role = 'admin'
    ) THEN
        RETURN json_build_object('success', false, 'message', 'Only admins can grant admin access');
    END IF;

    IF v_requested_email IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Email is required');
    END IF;

    SELECT *
    INTO v_target
    FROM public.profiles AS p
    WHERE p.email IS NOT NULL
      AND lower(p.email) = lower(v_requested_email)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Target profile was not found');
    END IF;

    UPDATE public.profiles
    SET
        role = 'admin',
        updated_at = now()
    WHERE id = v_target.id;

    RETURN json_build_object(
        'success', true,
        'id', v_target.id,
        'email', v_target.email
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_admin_user_id uuid := auth.uid();
    v_requires_password_change boolean := true;
    v_result json;
BEGIN
    IF v_admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = v_admin_user_id
          AND p.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only admins can list admin users';
    END IF;

    SELECT COALESCE(aa.requires_password_change, true)
    INTO v_requires_password_change
    FROM public.admin_auth AS aa
    ORDER BY aa.id ASC
    LIMIT 1;

    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'email', p.email,
            'is_active', true,
            'created_at', p.created_at,
            'requires_password_change', COALESCE(v_requires_password_change, true)
        )
        ORDER BY p.created_at ASC NULLS FIRST, p.id ASC
    )
    INTO v_result
    FROM public.profiles AS p
    WHERE p.role = 'admin';

    RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_admin_user_id uuid := auth.uid();
BEGIN
    IF v_admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = v_admin_user_id
          AND p.role = 'admin'
    ) THEN
        RETURN json_build_object('success', false, 'message', 'Only admins can remove admin access');
    END IF;

    RETURN json_build_object(
        'success', false,
        'message', 'Legacy admin_delete_user(integer) is no longer supported. Use the admin role management API to demote admins by user identity.'
    );
END;
$function$;

COMMENT ON FUNCTION public.admin_change_password(text, text, text) IS
    'Legacy compatibility RPC. Updates the singleton admin second-factor password and revokes active public.admin_sessions.';

COMMENT ON FUNCTION public.admin_add_user(text) IS
    'Legacy compatibility RPC. Promotes a profile to role=admin by email because admin identity now lives in public.profiles.';

COMMENT ON FUNCTION public.admin_list_users() IS
    'Legacy compatibility RPC. Lists current admin profiles from public.profiles instead of the retired multi-row public.admin_auth model.';

COMMENT ON FUNCTION public.admin_delete_user(integer) IS
    'Legacy compatibility RPC. The integer admin id model was retired, so this function now returns a deprecation message instead of mutating the singleton public.admin_auth row.';
