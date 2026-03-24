-- Backfill canonical profile/credit rows for historical auth.users records and
-- keep auth -> profile linkage synchronized for future inserts and email updates.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_nickname text := NULLIF(
    btrim(
      COALESCE(
        NEW.raw_user_meta_data ->> 'nickname',
        NEW.raw_user_meta_data ->> 'full_name',
        ''
      )
    ),
    ''
  );
  v_avatar_url text := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')), '');
BEGIN
  IF COALESCE(NEW.is_anonymous, FALSE) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    nickname,
    avatar_url,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_nickname,
    v_avatar_url,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    nickname = COALESCE(EXCLUDED.nickname, public.profiles.nickname),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE OF email, raw_user_meta_data, is_anonymous ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (
  id,
  email,
  nickname,
  avatar_url,
  created_at,
  updated_at
)
SELECT
  u.id,
  u.email,
  NULLIF(
    btrim(
      COALESCE(
        u.raw_user_meta_data ->> 'nickname',
        u.raw_user_meta_data ->> 'full_name',
        ''
      )
    ),
    ''
  ) AS nickname,
  NULLIF(btrim(COALESCE(u.raw_user_meta_data ->> 'avatar_url', '')), '') AS avatar_url,
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users AS u
LEFT JOIN public.profiles AS p
  ON p.id = u.id
WHERE p.id IS NULL
  AND COALESCE(u.is_anonymous, FALSE) = FALSE
ON CONFLICT (id) DO UPDATE
SET
  email = COALESCE(EXCLUDED.email, public.profiles.email),
  nickname = COALESCE(EXCLUDED.nickname, public.profiles.nickname),
  avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
  updated_at = NOW();

INSERT INTO public.user_credits (
  user_id,
  email,
  balance,
  subject_type,
  created_at,
  updated_at
)
SELECT
  p.id,
  p.email,
  0,
  'registered',
  COALESCE(p.created_at, NOW()),
  NOW()
FROM public.profiles AS p
LEFT JOIN public.user_credits AS uc
  ON uc.user_id = p.id
WHERE uc.user_id IS NULL
ON CONFLICT (user_id) DO UPDATE
SET
  email = COALESCE(EXCLUDED.email, public.user_credits.email),
  subject_type = COALESCE(public.user_credits.subject_type, 'registered'),
  updated_at = NOW();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Canonical auth.users sync hook. Keeps public.profiles aligned for non-anonymous users and lets profile triggers maintain public.user_credits.';
