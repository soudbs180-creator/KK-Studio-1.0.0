import {
    DEFAULT_GOOGLE_MODELS,
    GOOGLE_IMAGE_WHITELIST,
} from './keyManagerDefaultModels.ts';
import { parseModelVariantMeta } from './keyManagerModelHelpers.ts';

type UnknownRecord = Record<string, unknown>;

export type OpenAICompatModelDiscoveryMetadata = {
    name?: string;
    provider?: string;
    description?: string;
    endpointType?: string;
    endpointTypes?: string[];
};

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

function normalizeStringList(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
        const normalized = value
            .map((entry) => String(entry || '').trim())
            .filter(Boolean);

        return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const normalized = String(value)
            .split(/[\s,|]+/)
            .map((entry) => entry.trim())
            .filter(Boolean);

        return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
    }

    return undefined;
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

function buildOpenAICompatModelMetadata(
    rawModels: UnknownRecord[],
    modelId: string,
): OpenAICompatModelDiscoveryMetadata | undefined {
    const canonicalObj = rawModels.find((candidate) => readTrimmedString(candidate, 'id') === modelId);
    if (!canonicalObj) {
        return undefined;
    }

    const endpointTypes = normalizeStringList(
        canonicalObj.endpoint_types
        ?? canonicalObj.endpointTypes
        ?? canonicalObj.supported_endpoint_types
        ?? canonicalObj.supportedEndpointTypes
        ?? canonicalObj.endpoint_type
        ?? canonicalObj.endpointType,
    );
    const endpointType = readTrimmedString(canonicalObj, 'endpoint_type', 'endpointType') || endpointTypes?.[0];
    const metadata: OpenAICompatModelDiscoveryMetadata = {
        name: readTrimmedString(canonicalObj, 'name', 'title', 'display_name') || undefined,
        provider: readTrimmedString(canonicalObj, 'owned_by', 'provider') || undefined,
        description: readTrimmedString(canonicalObj, 'description') || undefined,
        endpointType,
        endpointTypes,
    };

    return Object.values(metadata).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value))
        ? metadata
        : undefined;
}

export function buildOpenAICompatModelDiscoveryResult(payload: unknown): {
    rawCount: number;
    firstModel: unknown;
    hasObjectField: boolean;
    hasDataArray: boolean;
    models: string[];
    metadataByModelId: Record<string, OpenAICompatModelDiscoveryMetadata>;
} {
    const record = asRecord(payload);
    const rawModels = readRecordArray(payload, 'data');
    const rawSet = new Set(rawModels.map((model) => readTrimmedString(model, 'id')).filter(Boolean));
    const deduped = new Map<string, string>();
    const metadataByModelId: Record<string, OpenAICompatModelDiscoveryMetadata> = {};

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
            const metadata = buildOpenAICompatModelMetadata(rawModels, canonical);
            if (metadata) {
                metadataByModelId[canonical] = metadata;
            }
            return;
        }

        if (!deduped.has(canonical)) {
            deduped.set(canonical, formattedModel);
            const metadata = buildOpenAICompatModelMetadata(rawModels, modelId);
            if (metadata) {
                metadataByModelId[canonical] = metadata;
            }
        }
    });

    const firstRecord = rawModels[0];

    return {
        rawCount: rawModels.length,
        firstModel: firstRecord ? readTrimmedString(firstRecord, 'id') || firstRecord : null,
        hasObjectField: Boolean(record?.object),
        hasDataArray: Array.isArray(record?.data),
        models: Array.from(new Set(deduped.values())),
        metadataByModelId,
    };
}
