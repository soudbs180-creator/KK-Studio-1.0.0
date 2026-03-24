-- Restore the provider_pricing_cache runtime write path for authenticated
-- admins and seed a minimal cache payload for the currently active Gemini
-- image provider when the cache is empty.

DROP POLICY IF EXISTS "provider_pricing_cache_admin_insert" ON public.provider_pricing_cache;
CREATE POLICY "provider_pricing_cache_admin_insert"
    ON public.provider_pricing_cache
    FOR INSERT
    TO authenticated
    WITH CHECK (
        ((SELECT auth.uid()) IS NOT NULL)
        AND (COALESCE((((SELECT auth.jwt()) ->> 'is_anonymous'))::boolean, false) = false)
        AND COALESCE((SELECT is_admin()), false)
    );

DROP POLICY IF EXISTS "provider_pricing_cache_admin_update" ON public.provider_pricing_cache;
CREATE POLICY "provider_pricing_cache_admin_update"
    ON public.provider_pricing_cache
    FOR UPDATE
    TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL)
        AND (COALESCE((((SELECT auth.jwt()) ->> 'is_anonymous'))::boolean, false) = false)
        AND COALESCE((SELECT is_admin()), false)
    )
    WITH CHECK (
        ((SELECT auth.uid()) IS NOT NULL)
        AND (COALESCE((((SELECT auth.jwt()) ->> 'is_anonymous'))::boolean, false) = false)
        AND COALESCE((SELECT is_admin()), false)
    );

UPDATE public.admin_credit_models
SET
    display_name = 'Nano Banana 2',
    description = CASE
        WHEN COALESCE(NULLIF(btrim(description), ''), '') = ''
            THEN '最新预览版，适合通用创作，并支持 0.5K 到 4K 画质。'
        ELSE description
    END,
    updated_at = now()
WHERE model_id = 'gemini-3.1-flash-image-preview'
  AND (
      display_name IS DISTINCT FROM 'Nano Banana 2'
      OR COALESCE(NULLIF(btrim(description), ''), '') = ''
  );

WITH provider_seed AS (
    SELECT
        provider_id,
        MAX(base_url) AS base_url
    FROM public.admin_credit_models
    WHERE model_id IN (
        'gemini-2.5-flash-image',
        'gemini-3-pro-image-preview',
        'gemini-3.1-flash-image-preview'
    )
    GROUP BY provider_id
)
INSERT INTO public.provider_pricing_cache (
    provider_id,
    pricing,
    cached_at
)
SELECT
    provider_seed.provider_id,
    jsonb_build_array(
        jsonb_build_object(
            'modelId', 'gemini-2.5-flash-image',
            'modelName', 'Nano Banana',
            'inputPrice', 0.0387,
            'outputPrice', 0,
            'isPerToken', false,
            'groupRatio', 1,
            'currency', 'USD',
            'billingUnit', 'request',
            'displayPrice', '$0.0387 / request',
            'supportsGroups', false,
            'endpointUrl', provider_seed.base_url
        ),
        jsonb_build_object(
            'modelId', 'gemini-3-pro-image-preview',
            'modelName', 'Nano Banana Pro',
            'inputPrice', 0.134,
            'outputPrice', 0,
            'isPerToken', false,
            'groupRatio', 1,
            'currency', 'USD',
            'billingUnit', 'request',
            'displayPrice', '$0.1340 / request',
            'supportsGroups', false,
            'endpointUrl', provider_seed.base_url
        ),
        jsonb_build_object(
            'modelId', 'gemini-3.1-flash-image-preview',
            'modelName', 'Nano Banana 2',
            'inputPrice', 0.066667,
            'outputPrice', 0,
            'isPerToken', false,
            'groupRatio', 1,
            'currency', 'USD',
            'billingUnit', 'request',
            'displayPrice', '$0.0667 / request',
            'supportsGroups', false,
            'endpointUrl', provider_seed.base_url
        )
    ),
    now()
FROM provider_seed
ON CONFLICT (provider_id) DO UPDATE
SET
    pricing = EXCLUDED.pricing,
    cached_at = EXCLUDED.cached_at
WHERE CASE
    WHEN public.provider_pricing_cache.pricing IS NULL THEN true
    WHEN jsonb_typeof(public.provider_pricing_cache.pricing) <> 'array' THEN true
    ELSE jsonb_array_length(public.provider_pricing_cache.pricing) = 0
END;
