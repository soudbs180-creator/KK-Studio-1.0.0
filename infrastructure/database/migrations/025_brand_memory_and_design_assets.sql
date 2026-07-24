-- Migration 025: Brand Memory and Creative Studio Assets (G2)
-- Owner-scoped brand profile storage for cross-session AI Memory.

CREATE TABLE IF NOT EXISTS brand_profiles (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    slogan TEXT,
    industry TEXT,
    target_audience TEXT,
    logo_asset_id TEXT,
    palette JSONB NOT NULL DEFAULT '{}'::jsonb,
    typography JSONB NOT NULL DEFAULT '{}'::jsonb,
    guidelines JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_owner_id ON brand_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_default ON brand_profiles(owner_id, is_default);
