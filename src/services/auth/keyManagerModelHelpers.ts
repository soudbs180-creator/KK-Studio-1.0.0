/**
 * Helper: Parse "id(name, description)" format.
 */
export function parseModelString(input: string): { id: string; name?: string; description?: string; provider?: string } {
    if (input.includes('|')) {
        const parts = input.split('|');
        let id = parts[0]?.trim() || '';
        let name = parts[1]?.trim() || undefined;
        const provider = parts[2]?.trim() || undefined;

        const idLikeRegex = /^[a-z0-9-.:/]+$/;
        const firstLooksLikeName = /\s/.test(id) || !idLikeRegex.test(id);
        const secondLooksLikeId = !!name && idLikeRegex.test(name);
        if (secondLooksLikeId && firstLooksLikeName) {
            const tmp = id;
            id = name!;
            name = tmp;
        }

        return {
            id,
            name,
            provider,
        };
    }

    const normalized = input.replace(/（/g, '(').replace(/）/g, ')');
    const match = normalized.match(/^([^()]+)(?:\(([^/]+)(?:\/\s*(.+))?\))?$/);

    if (!match) return { id: input.trim() };

    let id = match[1].trim();
    let name = match[2]?.trim();
    const description = match[3]?.trim();
    const idLikeRegex = /^[a-z0-9-.:]+$/;
    const hasSpace = /\s/.test(id);

    if (name && idLikeRegex.test(name) && (hasSpace || !idLikeRegex.test(id))) {
        const temp = id;
        id = name;
        name = temp;
    }

    return {
        id,
        name,
        description,
    };
}

/**
 * Canonical model migration map used to upgrade old saved model IDs to the current equivalents.
 */
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

/**
 * Deprecated model IDs kept for backward-compatibility checks.
 */
export const DEPRECATED_MODELS = Object.keys(MODEL_MIGRATION_MAP);

/**
 * Normalize a legacy model ID to the current canonical ID.
 * @param modelId - Raw model ID from persisted state or user input
 * @returns Canonical model ID when a migration mapping exists; otherwise the original ID
 */
export function normalizeModelId(modelId: string): string {
    const raw = (modelId || '').trim();
    const parsedVariant = parseModelVariantMeta(raw);
    const variantCanonical = String(parsedVariant.canonicalId || '').trim();
    if (variantCanonical && variantCanonical !== raw) {
        return MODEL_MIGRATION_MAP[variantCanonical]
            || MODEL_MIGRATION_MAP[variantCanonical.toLowerCase()]
            || variantCanonical;
    }

    const normalized = MODEL_MIGRATION_MAP[raw];
    if (normalized) {
        return normalized;
    }

    const lowerRaw = raw.toLowerCase();
    const lowerMapped = MODEL_MIGRATION_MAP[lowerRaw];
    if (lowerMapped) {
        return lowerMapped;
    }

    const dashed = lowerRaw.replace(/\s+/g, '-');
    const dashedMapped = MODEL_MIGRATION_MAP[dashed];
    if (dashedMapped) {
        return dashedMapped;
    }

    return raw;
}

export interface ModelVariantMeta {
    baseId: string;
    canonicalId: string;
    speed?: 'fast' | 'slow';
    quality?: '512px' | '4k' | '2k' | '1k' | 'high' | 'hd' | 'ultra' | 'medium' | 'low' | 'standard';
    ratio?: string;
}

/**
 * Parse vendor-specific suffix patterns and extract variant metadata.
 * - Keeps speed tier (fast/slow) as model-differentiating signal.
 * - Treats resolution/quality/ratio suffix as parameter-like signal.
 */
export function parseModelVariantMeta(modelId: string): ModelVariantMeta {
    const raw = (modelId || '').trim();
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

export function appendModelVariantLabel(baseName: string, modelId: string): string {
    const parsed = parseModelVariantMeta(modelId);
    const tags: string[] = [];

    if (parsed.speed) {
        tags.push(parsed.speed === 'fast' ? 'Fast' : 'Slow');
    }

    if (parsed.quality) {
        const qualityMap: Record<string, string> = {
            '512px': '512px',
            '4k': '4K',
            '2k': '2K',
            '1k': '1K',
            high: 'High',
            hd: 'HD',
            ultra: 'Ultra',
            medium: 'Medium',
            low: 'Low',
            standard: 'Standard',
        };
        tags.push(qualityMap[parsed.quality] || parsed.quality);
    }

    if (tags.length === 0) return baseName;
    return `${baseName} (${tags.join(' · ')})`;
}
