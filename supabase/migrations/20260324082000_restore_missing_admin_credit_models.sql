-- Restore canonical Gemini image model routes when a previous migration
-- or manual cleanup left only one Nano Banana variant in the live catalog.
--
-- This migration intentionally reuses the currently active provider config
-- (base_url, api_keys, visibility, limits, etc.) from the existing
-- gemini-3.1-flash-image-preview row, so we do not hardcode secrets or
-- accidentally drift the live provider wiring.

DO $$
DECLARE
    source_row public.admin_credit_models%ROWTYPE;
    flash25_color text;
    flash25_secondary text;
    flash25_text text;
    pro_color text;
    pro_secondary text;
    pro_text text;
BEGIN
    SELECT *
    INTO source_row
    FROM public.admin_credit_models
    WHERE model_id = 'gemini-3.1-flash-image-preview'
    ORDER BY is_active DESC, priority DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    IF source_row.id IS NULL THEN
        RAISE NOTICE 'Skipped restore_missing_admin_credit_models: no gemini-3.1-flash-image-preview seed row found.';
        RETURN;
    END IF;

    flash25_color := public.normalize_admin_hex_color('#34A853', '#3B82F6');
    flash25_secondary := public.derive_admin_secondary_color(flash25_color);
    flash25_text := public.infer_admin_text_color(flash25_secondary);

    pro_color := public.normalize_admin_hex_color('#EA4335', '#3B82F6');
    pro_secondary := public.derive_admin_secondary_color(pro_color);
    pro_text := public.infer_admin_text_color(pro_secondary);

    INSERT INTO public.admin_credit_models (
        provider_id,
        provider_name,
        base_url,
        api_keys,
        model_id,
        display_name,
        description,
        color,
        color_secondary,
        text_color,
        gradient,
        endpoint_type,
        credit_cost,
        priority,
        weight,
        is_active,
        call_count,
        total_credits_consumed,
        created_at,
        updated_at,
        max_calls_limit,
        auto_pause_on_limit,
        advanced_enabled,
        mix_with_same_model,
        quality_pricing,
        visibility
    )
    SELECT
        source_row.provider_id,
        source_row.provider_name,
        source_row.base_url,
        source_row.api_keys,
        'gemini-2.5-flash-image',
        'Nano Banana',
        '专为速度和效率设计，适合高频快速出图场景。',
        flash25_color,
        flash25_secondary,
        flash25_text,
        'from-green-500 to-teal-600',
        COALESCE(NULLIF(source_row.endpoint_type, ''), 'gemini'),
        1,
        COALESCE(source_row.priority, 10),
        COALESCE(source_row.weight, 1),
        true,
        0,
        0,
        now(),
        now(),
        source_row.max_calls_limit,
        COALESCE(source_row.auto_pause_on_limit, true),
        true,
        COALESCE(source_row.mix_with_same_model, false),
        jsonb_build_object(
            '0.5K', jsonb_build_object('enabled', false, 'creditCost', 1),
            '1K', jsonb_build_object('enabled', true, 'creditCost', 1),
            '2K', jsonb_build_object('enabled', false, 'creditCost', 2),
            '4K', jsonb_build_object('enabled', false, 'creditCost', 4)
        ),
        COALESCE(source_row.visibility, 'public')
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.admin_credit_models existing
        WHERE existing.provider_id = source_row.provider_id
          AND existing.model_id = 'gemini-2.5-flash-image'
    );

    INSERT INTO public.admin_credit_models (
        provider_id,
        provider_name,
        base_url,
        api_keys,
        model_id,
        display_name,
        description,
        color,
        color_secondary,
        text_color,
        gradient,
        endpoint_type,
        credit_cost,
        priority,
        weight,
        is_active,
        call_count,
        total_credits_consumed,
        created_at,
        updated_at,
        max_calls_limit,
        auto_pause_on_limit,
        advanced_enabled,
        mix_with_same_model,
        quality_pricing,
        visibility
    )
    SELECT
        source_row.provider_id,
        source_row.provider_name,
        source_row.base_url,
        source_row.api_keys,
        'gemini-3-pro-image-preview',
        'Nano Banana Pro',
        '增强细节与构图，适合高质量预览与更复杂的图像指令。',
        pro_color,
        pro_secondary,
        pro_text,
        'from-red-500 to-orange-600',
        COALESCE(NULLIF(source_row.endpoint_type, ''), 'gemini'),
        2,
        COALESCE(source_row.priority, 10),
        COALESCE(source_row.weight, 1),
        true,
        0,
        0,
        now(),
        now(),
        source_row.max_calls_limit,
        COALESCE(source_row.auto_pause_on_limit, true),
        true,
        COALESCE(source_row.mix_with_same_model, false),
        jsonb_build_object(
            '0.5K', jsonb_build_object('enabled', false, 'creditCost', 1),
            '1K', jsonb_build_object('enabled', true, 'creditCost', 2),
            '2K', jsonb_build_object('enabled', true, 'creditCost', 4),
            '4K', jsonb_build_object('enabled', true, 'creditCost', 8)
        ),
        COALESCE(source_row.visibility, 'public')
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.admin_credit_models existing
        WHERE existing.provider_id = source_row.provider_id
          AND existing.model_id = 'gemini-3-pro-image-preview'
    );
END
$$;
