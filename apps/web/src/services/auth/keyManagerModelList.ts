import { resolveProviderModelCompatibilityIssue } from '../api/providerStrategy.ts';
import { GOOGLE_IMAGE_WHITELIST } from './keyManagerDefaultModels.ts';
import {
    MODEL_MIGRATION_MAP,
    normalizeModelId,
} from './keyManagerModelHelpers.ts';

/**
 * Blacklisted model patterns that should never surface in the UI.
 */
export const BLACKLIST_MODELS = [
    // Imagen dated preview builds
    /^imagen-[34]\.0-(ultra-)?generate-preview-\d{2}-\d{2}$/,
    /^imagen-[34]\.0-(fast-)?generate-preview-\d{2}-\d{2}$/,
    // Older Imagen generate-001 aliases
    /^imagen-[34]\.0-.*generate-001$/,
];

/**
 * Determine whether a model should be filtered from the available model list.
 */
function shouldFilterModel(modelId: string): boolean {
    // Strict mode: explicit whitelist entries always win over block rules.
    // If model is explicitly in our whitelist, DO NOT FILTER IT, even if it matches a ban pattern below.
    if (GOOGLE_IMAGE_WHITELIST.includes(modelId)) return false;

    // Filter dated Imagen preview builds
    if (/imagen-[34]\.0-.*-preview-\d{2}-\d{2}/.test(modelId)) {
        console.log(`[ModelFilter] Filtering Imagen preview: ${modelId}`);
        return true;
    }

    // Filter old Imagen generate-001 aliases, except the strict whitelist
    if (/imagen-[34]\.0-.*generate-001$/.test(modelId)) {
        console.log(`[ModelFilter] Filtering old Imagen: ${modelId}`);
        return true;
    }

    // Filter deprecated Gemini 2.0 image-generation model IDs
    if (modelId === 'gemini-2.0-flash-exp-image-generation') {
        console.log(`[ModelFilter] Filtering deprecated model: ${modelId}`);
        return true;
    }

    return false;
}

/**
 * Normalize a model list, applying migrations, deduplication, and the official Google whitelist.
 * @param provider Optional provider label used to decide whether official Google rules apply
 */
export function normalizeModelList(models: string[], provider?: string, baseUrl?: string): string[] {
    const isOfficialGoogle = provider === 'Google';

    // 1. Migrate & Normalize
    const normalized = models.map(id => {
        const raw = (id || '').trim();

        // Non-official Google-style provider routes should keep their raw model IDs.
        // For example, channel-specific aliases such as "nano-banana-2" may be valid upstream names.
        if (!isOfficialGoogle) {
            return raw;
        }

        // Official Google providers should migrate aliases into canonical model IDs
        const target = MODEL_MIGRATION_MAP[raw];
        if (target) return target;
        return normalizeModelId(raw);
    });

    // 2. Filter, Remove Duplicates & Apply Strict Whitelist
    const unique = Array.from(new Set(normalized)).filter(id => {
        // Always filter explicit blacklist (malformed previews)
        if (shouldFilterModel(id)) return false;

        // Strict check: ONLY for official Google provider
        // If it looks like a Google image model, it MUST be in the whitelist
        if (isOfficialGoogle) {
            const isGoogleImageLike = id.includes('image') || id.includes('nano') || id.includes('banana') || id.includes('imagen');
            if (isGoogleImageLike && !GOOGLE_IMAGE_WHITELIST.includes(id)) {
                return false;
            }
        }

        if (resolveProviderModelCompatibilityIssue({ provider, baseUrl, modelId: id })) {
            return false;
        }

        // Fix: If it is 'nano-banana' (which shouldn't exist after step 1), kill it.
        if (id === 'nano-banana' || id === 'nano-banana-pro') return false;

        return true;
    });

    return unique;
}
