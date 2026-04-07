export const MODEL_MIGRATION_MAP: Record<string, string> = {
    'gemini-1.5-pro': 'gemini-2.5-pro',
    'gemini-1.5-pro-latest': 'gemini-2.5-pro',
    'gemini-1.5-flash': 'gemini-2.5-flash',
    'gemini-1.5-flash-latest': 'gemini-2.5-flash',
    'gemini-2.0-flash-exp': 'gemini-2.5-flash',
    'gemini-2.0-pro-exp': 'gemini-2.5-pro',
    'gemini-2.0-flash-exp-image-generation': 'gemini-2.5-flash-image',
    'nano-banana': 'gemini-2.5-flash-image',
    'nano banana': 'gemini-2.5-flash-image',
    'nano-banana-pro': 'gemini-3-pro-image-preview',
    'nano banana pro': 'gemini-3-pro-image-preview',
    'nano-banana-2': 'gemini-3.1-flash-image-preview',
    'nano banana 2': 'gemini-3.1-flash-image-preview',
    'gemini-2.5-flash-image-preview': 'gemini-2.5-flash-image',
    'gemini-flash-lite-latest': 'gemini-2.5-flash-lite',
    'gemini-flash-latest': 'gemini-2.5-flash',
    'gemini-pro-latest': 'gemini-2.5-pro',
    'gemini-3-pro-image': 'gemini-3-pro-image-preview',
};

export interface ModelVariantMeta {
    baseId: string;
    canonicalId: string;
    speed?: 'fast' | 'slow';
    quality?: '512px' | '4k' | '2k' | '1k' | 'high' | 'hd' | 'ultra' | 'medium' | 'low' | 'standard';
    ratio?: string;
}

export function parseModelVariantMeta(modelId: string): ModelVariantMeta {
    const raw = String(modelId || '').trim();
    let working = raw
        .replace(/-\*$/i, '')
        .replace(/-\d{8}$/i, '');

    const ratioRegex = /(16[x-]9|9[x-]16|1[x-]1|4[x-]3|3[x-]4|21[x-]9|9[x-]21|3[x-]2|2[x-]3|4[x-]5|5[x-]4)$/i;
    const qualityRegex = /(512px|4k|2k|1k|hd|high|ultra|medium|low|standard)$/i;
    const speedRegex = /(fast|slow)$/i;

    let ratio: string | undefined;
    let quality: ModelVariantMeta['quality'];
    let speed: ModelVariantMeta['speed'];

    const ratioMatch = working.match(new RegExp(`-${ratioRegex.source}`, 'i'));
    if (ratioMatch) {
        ratio = ratioMatch[1].toLowerCase();
        working = working.replace(new RegExp(`-${ratioRegex.source}$`, 'i'), '');
    }

    const qualityMatch = working.match(new RegExp(`-${qualityRegex.source}`, 'i'));
    if (qualityMatch) {
        quality = qualityMatch[1].toLowerCase() as ModelVariantMeta['quality'];
        working = working.replace(new RegExp(`-${qualityRegex.source}$`, 'i'), '');
    }

    const speedMatch = working.match(new RegExp(`-${speedRegex.source}`, 'i'));
    if (speedMatch) {
        speed = speedMatch[1].toLowerCase() as ModelVariantMeta['speed'];
    }

    return {
        baseId: raw,
        canonicalId: working,
        speed,
        quality,
        ratio,
    };
}

export function normalizeModelId(modelId: string): string {
    const raw = String(modelId || '').trim();
    const parsedVariant = parseModelVariantMeta(raw);
    const variantCanonical = String(parsedVariant.canonicalId || '').trim();
    if (variantCanonical && variantCanonical !== raw) {
        return MODEL_MIGRATION_MAP[variantCanonical]
            || MODEL_MIGRATION_MAP[variantCanonical.toLowerCase()]
            || variantCanonical;
    }

    return MODEL_MIGRATION_MAP[raw]
        || MODEL_MIGRATION_MAP[raw.toLowerCase()]
        || MODEL_MIGRATION_MAP[raw.toLowerCase().replace(/\s+/g, '-')]
        || raw;
}
