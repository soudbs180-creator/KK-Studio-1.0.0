-- Migration 026: Google / WeChat OAuth identity and one-time state storage.
-- OAuth 凭据只在服务端换取，不持久化 provider access token 或原始用户资料。

ALTER TABLE public.users
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS public.auth_identities (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL CHECK (provider IN ('google', 'wechat')),
  provider_app_id VARCHAR(255) NOT NULL,
  provider_subject VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  openid VARCHAR(255),
  unionid VARCHAR(255),
  display_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_identities_provider_subject_unique
    UNIQUE (provider, provider_app_id, provider_subject)
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_identities_provider_unionid_unique
  ON public.auth_identities (provider, unionid)
  WHERE unionid IS NOT NULL;

CREATE INDEX IF NOT EXISTS auth_identities_user_id_idx
  ON public.auth_identities (user_id);

CREATE TABLE IF NOT EXISTS public.oauth_transactions (
  state_hash CHAR(64) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL CHECK (provider IN ('google', 'wechat')),
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('login', 'bind')),
  redirect_to TEXT NOT NULL,
  user_id VARCHAR(255) REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_transactions_expiry_idx
  ON public.oauth_transactions (expires_at)
  WHERE consumed_at IS NULL;
