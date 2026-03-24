CREATE TABLE IF NOT EXISTS public.external_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_appid TEXT NOT NULL,
    provider_unionid TEXT,
    provider_openid TEXT NOT NULL,
    nickname TEXT,
    avatar_url TEXT,
    raw_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT external_identities_provider_nonempty CHECK (length(trim(provider)) > 0),
    CONSTRAINT external_identities_provider_appid_nonempty CHECK (length(trim(provider_appid)) > 0),
    CONSTRAINT external_identities_provider_openid_nonempty CHECK (length(trim(provider_openid)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_identities_provider_user
    ON public.external_identities (provider, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_identities_provider_appid_openid
    ON public.external_identities (provider, provider_appid, provider_openid);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_identities_provider_unionid
    ON public.external_identities (provider, provider_unionid)
    WHERE provider_unionid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_external_identities_user_id
    ON public.external_identities (user_id);

ALTER TABLE public.external_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "external_identities_select_own" ON public.external_identities;

CREATE POLICY "external_identities_select_own"
    ON public.external_identities
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
    );
