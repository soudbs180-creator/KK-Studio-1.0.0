type JsonRecord = Record<string, unknown>;

type LegacyArrayKind = 'slots' | 'entries' | 'unknown';

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasAnyKey(value: unknown, keys: string[]): boolean {
  if (!isRecord(value)) return false;
  return keys.some((key) => key in value);
}

function detectLegacyArrayKind(raw: unknown[]): LegacyArrayKind {
  if (!raw.length) return 'unknown';

  const slotOnlyKeys = [
    'authMethod',
    'headerName',
    'compatibilityMode',
    'proxyConfig',
    'creditCost',
    'quota',
    'weight',
    'timeout',
    'maxRetries',
    'retryDelay',
    'cooldownUntil',
    'customHeaders',
    'customBody',
  ];

  const entryOnlyKeys = [
    'api_key_encrypted',
    'is_active',
    'created_at',
    'updated_at',
    'call_count',
    'total_cost',
  ];

  if (raw.some((item) => hasAnyKey(item, slotOnlyKeys))) {
    return 'slots';
  }

  if (raw.some((item) => hasAnyKey(item, entryOnlyKeys))) {
    return 'entries';
  }

  return 'unknown';
}

function getRecordId(value: unknown): string {
  if (!isRecord(value)) return '';
  return String(value.id || '').trim();
}

function mergeArrayRecordsById(existing: unknown[], next: unknown[]): unknown[] {
  const existingById = new Map<string, JsonRecord>();

  existing.forEach((item) => {
    const id = getRecordId(item);
    if (id && isRecord(item)) {
      existingById.set(id, item);
    }
  });

  return next.map((item) => {
    if (!isRecord(item)) return item;

    const id = getRecordId(item);
    if (!id) return item;

    const persisted = existingById.get(id);
    return persisted ? { ...persisted, ...item } : item;
  });
}

export function isUserApisEnvelope(value: unknown): value is JsonRecord {
  if (!isRecord(value)) return false;
  return 'slots' in value || 'providers' in value || 'entries' in value;
}

export function extractKeyManagerCloudSlots(raw: unknown): unknown[] {
  if (isUserApisEnvelope(raw)) {
    return toArray(raw.slots);
  }

  return toArray(raw);
}

export function extractUserApiEntriesFromPayload(raw: unknown): unknown[] {
  if (isUserApisEnvelope(raw)) {
    return toArray(raw.entries);
  }

  const legacy = toArray(raw);
  const kind = detectLegacyArrayKind(legacy);
  return kind === 'unknown' || kind === 'entries' || kind === 'slots' ? legacy : [];
}

export function extractUserApiProvidersFromPayload(raw: unknown): unknown[] {
  if (!isUserApisEnvelope(raw)) return [];
  return toArray(raw.providers);
}

export function mergeUserApisPayload(
  existingRaw: unknown,
  updates: {
    slots?: unknown[];
    providers?: unknown[];
    entries?: unknown[];
  },
): unknown {
  const existingSlots = extractKeyManagerCloudSlots(existingRaw);
  const existingProviders = extractUserApiProvidersFromPayload(existingRaw);
  const existingEntries = extractUserApiEntriesFromPayload(existingRaw);

  const nextSlots =
    updates.slots !== undefined
      ? mergeArrayRecordsById(existingSlots, updates.slots)
      : existingSlots;
  const nextProviders = updates.providers ?? existingProviders;
  const nextEntries =
    updates.entries !== undefined
      ? mergeArrayRecordsById(existingEntries, updates.entries)
      : existingEntries;

  return {
    version: 2,
    slots: nextSlots,
    providers: nextProviders,
    entries: nextEntries,
  };
}
