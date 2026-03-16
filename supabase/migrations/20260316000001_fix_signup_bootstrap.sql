-- Repair the auth signup bootstrap chain so new users can be created reliably.
-- This specifically addresses Supabase returning "Database error saving new user"
-- when the auth trigger, profile bootstrap, or credit bootstrap is out of sync.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    credits NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT,
    balance INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    frozen INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    last_transaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    subject_type TEXT DEFAULT 'registered'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_credits_user_id_unique
    ON public.user_credits(user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS credits NUMERIC DEFAULT 0;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_with_check" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_on_signup" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, credits, created_at, updated_at)
    VALUES (NEW.id, NEW.email, 0, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role';
    END IF;
END $$;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_credits
    ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_credits
    ADD COLUMN IF NOT EXISTS balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.user_credits
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_credits
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_credits
    ADD COLUMN IF NOT EXISTS subject_type TEXT DEFAULT 'registered';

UPDATE public.user_credits
SET subject_type = 'registered'
WHERE subject_type IS NULL;

GRANT SELECT ON public.user_credits TO authenticated;
REVOKE ALL ON public.user_credits FROM anon;

DROP POLICY IF EXISTS "user_credits_select_own" ON public.user_credits;
CREATE POLICY "user_credits_select_own" ON public.user_credits
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ensure_user_credits_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.user_credits (user_id, email, balance, subject_type, created_at, updated_at)
    VALUES (NEW.id, NEW.email, 0, 'registered', NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET
        email = COALESCE(EXCLUDED.email, public.user_credits.email),
        subject_type = 'registered',
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_user_credits ON public.profiles;
CREATE TRIGGER trg_ensure_user_credits
    AFTER INSERT OR UPDATE OF email ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.ensure_user_credits_exists();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.ensure_user_credits_exists() TO service_role';
    END IF;
END $$;

INSERT INTO public.user_credits (user_id, email, balance, subject_type, created_at, updated_at)
SELECT p.id, p.email, 0, 'registered', NOW(), NOW()
FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE
SET
    email = EXCLUDED.email,
    subject_type = 'registered',
    updated_at = NOW();

COMMIT;
