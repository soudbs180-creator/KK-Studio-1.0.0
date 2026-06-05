import {
    PROVIDER_PRESETS,
    WUYIN_PRESET_LOGO_URL,
    WUYIN_PRESET_MODELS,
} from './keyManagerProviderPresets.ts';

export type CanonicalApiRecordKind = 'slot' | 'provider' | 'entry';
type JsonRecord = Record<string, unknown>;

export const API_CHANNEL_ID_PREFIXES: Record<string, string> = {
    zhipu: '1001',
    wanqing: '1002',
    sambanova: '1003',
    openclaw: '1004',
    t8star: '1005',
    volcengine: '1006',
    deepseek: '1007',
    moonshot: '1008',
    siliconflow: '1009',
    '12ai': '1010',
    antigravity: '1011',
    '12ai-nanobanana': '1012',
    flow2api: '1013',
    'wuyinkeji-nanobanana2': '1014',
    'wuyinkeji-google-omni': '1015',
    'gpt-best': '1016',
    google: '1017',
    openai: '1018',
    anthropic: '1019',
    custom: '2000',
};

export const CANONICAL_API_RECORD_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}-\d+$/;
export const WUYIN_PROVIDER_NAME = '速创 API';
export const WUYIN_PROVIDER_BASE_URL = 'https://api.wuyinkeji.com';
export const WUYIN_CANONICAL_CHANNEL = 'wuyinkeji-google-omni';

function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function decodeMaybe(value: unknown): string {
    const raw = String(value || '').trim();
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

function normalizeToken(value: unknown): string {
    return decodeMaybe(value)
        .toLowerCase()
        .replace(/\/+$/, '')
        .replace(/[_\s.]+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function normalizeText(value: unknown): string {
    return decodeMaybe(value).toLowerCase().trim();
}

function getStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    values.forEach((value) => {
        const normalized = String(value || '').trim();
        const key = normalized.toLowerCase();
        if (!normalized || seen.has(key)) {
            return;
        }
        seen.add(key);
        result.push(normalized);
    });

    return result;
}

function normalizeLegacyIds(value: unknown, nextId: string, previousId?: string): string[] {
    const values = [
        ...getStringArray(value),
        String(previousId || '').trim(),
    ];
    const normalizedNextId = String(nextId || '').trim().toLowerCase();

    return uniqueStrings(values)
        .filter((id) => id.toLowerCase() !== normalizedNextId);
}

export function getApiRecordLegacyIds(record: unknown): string[] {
    return isRecord(record) ? getStringArray(record.legacyIds) : [];
}

export function getApiRecordIdAliases(record: unknown): string[] {
    if (!isRecord(record)) {
        return [];
    }

    return uniqueStrings([
        String(record.id || '').trim(),
        ...getApiRecordLegacyIds(record),
    ]);
}

export function apiRecordMatchesIdOrLegacy(record: unknown, id: string): boolean {
    const target = String(id || '').trim().toLowerCase();
    if (!target) {
        return false;
    }

    return getApiRecordIdAliases(record).some((alias) => alias.toLowerCase() === target);
}

export function isCanonicalApiRecordId(value: unknown): boolean {
    return CANONICAL_API_RECORD_ID_PATTERN.test(String(value || '').trim().toLowerCase());
}

export function isWuyinApiRecord(input: {
    id?: unknown;
    name?: unknown;
    provider?: unknown;
    baseUrl?: unknown;
}): boolean {
    const combined = [
        input.id,
        input.name,
        input.provider,
        input.baseUrl,
    ].map((value) => normalizeText(value)).join(' ');

    return (
        combined.includes('wuyin')
        || combined.includes('wuyinkeji')
        || combined.includes('api.wuyinkeji.com')
        || combined.includes('速创')
        || combined.includes('五音')
    );
}

export function resolveCanonicalApiChannel(input: {
    id?: unknown;
    name?: unknown;
    provider?: unknown;
    baseUrl?: unknown;
}): { channel: string; prefix: string } {
    if (isWuyinApiRecord(input)) {
        return {
            channel: WUYIN_CANONICAL_CHANNEL,
            prefix: API_CHANNEL_ID_PREFIXES[WUYIN_CANONICAL_CHANNEL],
        };
    }

    const source = [
        input.id,
        input.name,
        input.provider,
        input.baseUrl,
    ].map((value) => normalizeToken(value)).join(' ');

    const presetKeys = Object.keys(PROVIDER_PRESETS)
        .filter((key) => key !== 'custom')
        .sort((left, right) => right.length - left.length);

    for (const key of presetKeys) {
        const preset = PROVIDER_PRESETS[key];
        const presetName = normalizeToken(preset.name);
        const presetUrl = normalizeToken(preset.baseUrl);
        const keyToken = normalizeToken(key);
        if (
            source.includes(keyToken)
            || (presetName && source.includes(presetName))
            || (presetUrl && source.includes(presetUrl))
        ) {
            return {
                channel: key,
                prefix: API_CHANNEL_ID_PREFIXES[key] || API_CHANNEL_ID_PREFIXES.custom,
            };
        }
    }

    if (source.includes('google') || source.includes('gemini')) {
        return { channel: 'google', prefix: API_CHANNEL_ID_PREFIXES.google };
    }
    if (source.includes('openai')) {
        return { channel: 'openai', prefix: API_CHANNEL_ID_PREFIXES.openai };
    }
    if (source.includes('anthropic') || source.includes('claude')) {
        return { channel: 'anthropic', prefix: API_CHANNEL_ID_PREFIXES.anthropic };
    }
    if (source.includes('deepseek')) {
        return { channel: 'deepseek', prefix: API_CHANNEL_ID_PREFIXES.deepseek };
    }

    return { channel: 'custom', prefix: API_CHANNEL_ID_PREFIXES.custom };
}

function isLegacyGeneratedApiRecordId(value: string): boolean {
    return /^(key|provider|slot)_/i.test(value);
}

function shouldPreserveNonLegacyId(input: {
    id?: unknown;
    name?: unknown;
    provider?: unknown;
    baseUrl?: unknown;
}, expectedStart: string): boolean {
    const currentId = String(input.id || '').trim().toLowerCase();
    if (!currentId) {
        return false;
    }
    if (isWuyinApiRecord(input)) {
        return false;
    }
    if (isCanonicalApiRecordId(currentId)) {
        return currentId.startsWith(expectedStart);
    }
    return !isLegacyGeneratedApiRecordId(currentId);
}

export function buildCanonicalApiRecordId(
    input: {
        id?: unknown;
        name?: unknown;
        provider?: unknown;
        baseUrl?: unknown;
    },
    reservedIds: Iterable<string | undefined | null> = [],
    options?: {
        preserveNonLegacyId?: boolean;
    },
): string {
    const currentId = String(input.id || '').trim().toLowerCase();
    const { channel, prefix } = resolveCanonicalApiChannel(input);
    const expectedStart = `${channel}-${prefix}-`;
    const used = new Set(
        Array.from(reservedIds)
            .map((id) => String(id || '').trim().toLowerCase())
            .filter(Boolean),
    );

    used.delete(currentId);

    if (options?.preserveNonLegacyId && shouldPreserveNonLegacyId(input, expectedStart)) {
        return currentId;
    }

    if (
        currentId
        && isCanonicalApiRecordId(currentId)
        && currentId.startsWith(expectedStart)
        && !used.has(currentId)
    ) {
        return currentId;
    }

    let suffix = 1;
    let candidate = `${expectedStart}${suffix}`;
    while (used.has(candidate)) {
        suffix += 1;
        candidate = `${expectedStart}${suffix}`;
    }

    return candidate;
}

function setIfChanged(record: JsonRecord, key: string, value: unknown): boolean {
    if (record[key] === value) {
        return false;
    }
    record[key] = value;
    return true;
}

function setStringArrayIfChanged(record: JsonRecord, key: string, value: string[]): boolean {
    const current = getStringArray(record[key]);
    if (current.length === value.length && current.every((item, index) => item === value[index])) {
        return false;
    }
    record[key] = value;
    return true;
}

function mergeWuyinModels(value: unknown): string[] {
    return uniqueStrings([
        ...WUYIN_PRESET_MODELS,
        ...getStringArray(value),
    ]);
}

export function applyLatestApiRecordRequirements<TRecord extends JsonRecord>(
    record: TRecord,
    kind: CanonicalApiRecordKind,
): { record: TRecord; changed: boolean } {
    const next = { ...record } as TRecord;
    let changed = false;

    if (!isWuyinApiRecord({
        id: record.id,
        name: record.name,
        provider: record.provider,
        baseUrl: record.baseUrl ?? record.base_url,
    })) {
        return { record: next, changed };
    }

    changed = setIfChanged(next, 'name', WUYIN_PROVIDER_NAME) || changed;
    changed = setIfChanged(next, 'baseUrl', WUYIN_PROVIDER_BASE_URL) || changed;
    changed = setIfChanged(next, 'format', 'openai') || changed;

    if (kind === 'provider') {
        changed = setIfChanged(next, 'icon', WUYIN_PRESET_LOGO_URL) || changed;
        changed = setStringArrayIfChanged(next, 'models', mergeWuyinModels(record.models)) || changed;
    }

    if (kind === 'slot') {
        changed = setIfChanged(next, 'provider', 'Wuyin') || changed;
        changed = setIfChanged(next, 'type', 'third-party') || changed;
        changed = setIfChanged(next, 'authMethod', 'header') || changed;
        changed = setIfChanged(next, 'headerName', 'Authorization') || changed;
        changed = setIfChanged(next, 'compatibilityMode', 'standard') || changed;
        changed = setStringArrayIfChanged(next, 'supportedModels', mergeWuyinModels(record.supportedModels)) || changed;
    }

    if (kind === 'entry') {
        changed = setIfChanged(next, 'type', 'proxy') || changed;
        changed = setStringArrayIfChanged(next, 'supportedModels', mergeWuyinModels(record.supportedModels)) || changed;
    }

    return { record: next, changed };
}

export function canonicalizeApiRecordsForLatestRequirements<TRecord extends unknown>(
    records: TRecord[],
    kind: CanonicalApiRecordKind,
): {
    records: TRecord[];
    changed: boolean;
    idMap: Record<string, string>;
} {
    const originalCanonicalIds = records
        .filter((record): record is TRecord & JsonRecord => isRecord(record))
        .map((record) => String(record.id || '').trim().toLowerCase())
        .filter((id) => isCanonicalApiRecordId(id));
    const assignedIds: string[] = [];
    const idMap: Record<string, string> = {};
    let changed = false;

    const nextRecords = records.map((item) => {
        if (!isRecord(item)) {
            return item;
        }

        const record = item as JsonRecord;
        const upgraded = applyLatestApiRecordRequirements(record, kind);
        const originalId = String(record.id || '').trim();
        const canonicalId = buildCanonicalApiRecordId(
            {
                id: upgraded.record.id,
                name: upgraded.record.name,
                provider: upgraded.record.provider,
                baseUrl: upgraded.record.baseUrl ?? upgraded.record.base_url,
            },
            [...originalCanonicalIds, ...assignedIds],
            { preserveNonLegacyId: true },
        );

        assignedIds.push(canonicalId);
        const nextRecord: JsonRecord = { ...upgraded.record, id: canonicalId };

        if (originalId && originalId.toLowerCase() !== canonicalId.toLowerCase()) {
            idMap[originalId] = canonicalId;
            const legacyIds = normalizeLegacyIds(record.legacyIds, canonicalId, originalId);
            if (legacyIds.length > 0) {
                nextRecord.legacyIds = legacyIds;
            } else {
                delete nextRecord.legacyIds;
            }
            changed = true;
        }

        if (upgraded.changed) {
            changed = true;
        }

        return nextRecord as TRecord;
    });

    return {
        records: nextRecords,
        changed,
        idMap,
    };
}

export function upgradeUserApisEnvelopeForLatestRequirements<TEnvelope extends {
    version: number;
    slots: unknown[];
    providers: unknown[];
    entries: unknown[];
}>(
    payload: TEnvelope,
): {
    payload: TEnvelope;
    changed: boolean;
    idMap: {
        slots: Record<string, string>;
        providers: Record<string, string>;
        entries: Record<string, string>;
    };
} {
    const slots = canonicalizeApiRecordsForLatestRequirements(payload.slots, 'slot');
    const providers = canonicalizeApiRecordsForLatestRequirements(payload.providers, 'provider');
    const entries = canonicalizeApiRecordsForLatestRequirements(payload.entries, 'entry');

    return {
        payload: {
            ...payload,
            slots: slots.records,
            providers: providers.records,
            entries: entries.records,
        },
        changed: slots.changed || providers.changed || entries.changed,
        idMap: {
            slots: slots.idMap,
            providers: providers.idMap,
            entries: entries.idMap,
        },
    };
}
