import {
    DEFAULT_GOOGLE_MODELS,
    GOOGLE_IMAGE_WHITELIST,
} from './keyManagerDefaultModels.ts';
import { parseModelVariantMeta } from './keyManagerModelHelpers.ts';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as UnknownRecord
        : null;
}

function readRecordArray(payload: unknown, key: string): UnknownRecord[] {
    const record = asRecord(payload);
    const value = record?.[key];
    return Array.isArray(value)
        ? value.map(asRecord).filter((item): item is UnknownRecord => item !== null)
        : [];
}

function readTrimmedString(item: UnknownRecord, ...keys: string[]): string {
    for (const key of keys) {
        const value = item[key];
        if (value !== undefined && value !== null) {
            const trimmed = String(value).trim();
            if (trimmed) {
                return trimmed;
            }
        }
    }

    return '';
}

function isAllowedGoogleDiscoveryModel(modelId: string): boolean {
    const lower = modelId.toLowerCase();

    if (
        lower.includes('embedding')
        || lower.includes('audio')
        || lower.includes('robotics')
        || lower.includes('code-execution')
        || lower.includes('computer-use')
        || lower.includes('aqa')
        || lower.includes('tts')
    ) {
        return false;
    }

    const allowedPatterns = [
        ...GOOGLE_IMAGE_WHITELIST.map((id) => new RegExp(`^${id}$`)),
        /^veo-3\.1-generate-preview$/,
        /^veo-3\.1-fast-generate-preview$/,
        /^gemini-2\.5-(flash|pro|flash-lite)$/,
        /^gemini-3-(pro|flash)-preview$/,
    ];

    return allowedPatterns.some((pattern) => pattern.test(modelId));
}

export function buildGoogleModelDiscoveryResult(payload: unknown): {
    strictModels: string[];
    finalModels: string[];
} {
    const strictModels = readRecordArray(payload, 'models')
        .map((model) => readTrimmedString(model, 'name').replace(/^models\//, ''))
        .filter((modelId) => modelId && isAllowedGoogleDiscoveryModel(modelId));

    return {
        strictModels,
        finalModels: Array.from(new Set([
            ...DEFAULT_GOOGLE_MODELS,
            ...strictModels,
        ])),
    };
}

export function extractGeminiCompatModelIds(payload: unknown): string[] {
    const record = asRecord(payload);
    const rawModels = Array.isArray(record?.models)
        ? record.models
        : Array.isArray(record?.data)
            ? record.data
            : [];

    return Array.from(new Set(
        rawModels
            .map(asRecord)
            .filter((model): model is UnknownRecord => model !== null)
            .map((model) => readTrimmedString(model, 'name', 'id', 'model').replace(/^models\//i, ''))
            .filter(Boolean),
    ));
}

function formatOpenAICompatModelEntry(rawModels: UnknownRecord[], modelId: string): string {
    const canonicalObj = rawModels.find((candidate) => readTrimmedString(candidate, 'id') === modelId);
    const modelName = canonicalObj
        ? readTrimmedString(canonicalObj, 'name', 'title', 'display_name')
        : '';
    const modelProvider = canonicalObj
        ? readTrimmedString(canonicalObj, 'owned_by', 'provider')
        : '';

    return modelName || modelProvider
        ? `${modelId}|${modelName}|${modelProvider}`
        : modelId;
}

export function buildOpenAICompatModelDiscoveryResult(payload: unknown): {
    rawCount: number;
    firstModel: unknown;
    hasObjectField: boolean;
    hasDataArray: boolean;
    models: string[];
} {
    const record = asRecord(payload);
    const rawModels = readRecordArray(payload, 'data');
    const rawSet = new Set(rawModels.map((model) => readTrimmedString(model, 'id')).filter(Boolean));
    const deduped = new Map<string, string>();

    rawModels.forEach((model) => {
        const modelId = readTrimmedString(model, 'id');
        if (!modelId) {
            return;
        }

        const parsed = parseModelVariantMeta(modelId);
        const canonical = parsed.canonicalId || modelId;
        const formattedModel = formatOpenAICompatModelEntry(rawModels, modelId);

        if (rawSet.has(canonical)) {
            deduped.set(canonical, formatOpenAICompatModelEntry(rawModels, canonical));
            return;
        }

        if (!deduped.has(canonical)) {
            deduped.set(canonical, formattedModel);
        }
    });

    const firstRecord = rawModels[0];

    return {
        rawCount: rawModels.length,
        firstModel: firstRecord ? readTrimmedString(firstRecord, 'id') || firstRecord : null,
        hasObjectField: Boolean(record?.object),
        hasDataArray: Array.isArray(record?.data),
        models: Array.from(new Set(deduped.values())),
    };
}
