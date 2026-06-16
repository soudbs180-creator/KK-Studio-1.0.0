type JsonRecord = Record<string, unknown>;

type LegacyArrayKind = 'slots' | 'entries' | 'unknown';

const USER_APIS_PAYLOAD_SAFE_MAX_BYTES = 900 * 1024;
const SLOT_PERSISTED_KEYS = [
  "id",
  "legacyIds",
  "key",
  "name",
  "provider",
  "type",
  "format",
  "endpointType",
  "adapterId",
  "requestProfileId",
  "protocolFamily",
  "routeStrategy",
  "providerConfig",
  "baseUrl",
  "group",
  "compatibilityMode",
  "supportedModels",
  "proxyConfig",
  "authMethod",
  "headerName",
  "customHeaders",
  "customBody",
  "weight",
  "timeout",
  "maxRetries",
  "retryDelay",
  "status",
  "failCount",
  "successCount",
  "lastUsed",
  "lastError",
  "disabled",
  "createdAt",
  "avgResponseTime",
  "lastResponseTime",
  "successRate",
  "totalRequests",
  "usedTokens",
  "totalCost",
  "budgetLimit",
  "tokenLimit",
  "creditCost",
  "updatedAt",
  "quota",
  "cooldownUntil",
] as const;
const PROVIDER_PERSISTED_KEYS = [
  "id",
  "legacyIds",
  "name",
  "baseUrl",
  "apiKey",
  "group",
  "models",
  "format",
  "endpointType",
  "adapterId",
  "requestProfileId",
  "protocolFamily",
  "routeStrategy",
  "icon",
  "isActive",
  "providerColor",
  "badgeColor",
  "budgetLimit",
  "tokenLimit",
  "customCostMode",
  "customCostValue",
  "status",
  "lastError",
  "lastChecked",
  "createdAt",
  "updatedAt",
] as const;
const PROVIDER_USAGE_KEYS = [
  "totalTokens",
  "totalCost",
  "dailyTokens",
  "dailyCost",
  "lastReset",
] as const;
const PROVIDER_ACTIVITY_SUMMARY_KEYS = [
  "lastLatencyMs",
  "lastTokens",
  "lastAmount",
  "updatedAt",
] as const;
const USER_API_ENTRY_KEYS = [
  "id",
  "legacyIds",
  "key",
  "name",
  "provider",
  "type",
  "format",
  "endpointType",
  "adapterId",
  "requestProfileId",
  "protocolFamily",
  "routeStrategy",
  "baseUrl",
  "supportedModels",
  "disabled",
  "createdAt",
  "updatedAt",
  "status",
  "failCount",
  "successCount",
  "totalCost",
  "budgetLimit",
  "tokenLimit",
  "usedTokens",
  "lastUsed",
  "lastError",
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickRecordFields(value: JsonRecord, keys: readonly string[]): JsonRecord {
  return keys.reduce<JsonRecord>((acc, key) => {
    if (value[key] !== undefined) {
      acc[key] = value[key];
    }
    return acc;
  }, {});
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function sanitizeSlotRecord(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const nextSlot = pickRecordFields(value, SLOT_PERSISTED_KEYS);
  const supportedModels = normalizeStringArray(value.supportedModels);
  if (supportedModels) {
    nextSlot.supportedModels = supportedModels;
  }

  return nextSlot;
}

function sanitizeProviderRecord(
  value: unknown,
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const nextProvider = pickRecordFields(value, PROVIDER_PERSISTED_KEYS);
  const models = normalizeStringArray(value.models);
  if (models) {
    nextProvider.models = models;
  }

  if (isRecord(value.usage)) {
    nextProvider.usage = pickRecordFields(value.usage, PROVIDER_USAGE_KEYS);
  }

  if (isRecord(value.activitySummary)) {
    nextProvider.activitySummary = pickRecordFields(value.activitySummary, PROVIDER_ACTIVITY_SUMMARY_KEYS);
  }

  return nextProvider;
}

function sanitizeUserApiEntryRecord(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const nextEntry = pickRecordFields(value, USER_API_ENTRY_KEYS);
  const supportedModels = normalizeStringArray(value.supportedModels);
  if (supportedModels) {
    nextEntry.supportedModels = supportedModels;
  }

  return nextEntry;
}

function sanitizeUserApisEnvelope(
  rawPayload: unknown,
): JsonRecord {
  const version =
    isRecord(rawPayload) && typeof rawPayload.version === "number" && Number.isInteger(rawPayload.version)
      ? rawPayload.version
      : 2;

  return {
    version,
    slots: extractKeyManagerCloudSlots(rawPayload).map((slot) => sanitizeSlotRecord(slot)),
    providers: extractUserApiProvidersFromPayload(rawPayload).map((provider) => sanitizeProviderRecord(provider)),
    entries: extractUserApiEntriesFromPayload(rawPayload).map((entry) => sanitizeUserApiEntryRecord(entry)),
  };
}

function estimateJsonSize(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return 0;
    }

    return new TextEncoder().encode(serialized).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
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

function getRecordIdAliases(value: unknown): string[] {
  if (!isRecord(value)) return [];

  const aliases = [
    String(value.id || '').trim(),
    ...(Array.isArray(value.legacyIds)
      ? value.legacyIds.map((id) => String(id || '').trim())
      : []),
  ];

  return Array.from(new Set(aliases.filter(Boolean)));
}

function mergeArrayRecordsById(existing: unknown[], next: unknown[]): unknown[] {
  const existingById = new Map<string, JsonRecord>();

  existing.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    getRecordIdAliases(item).forEach((id) => {
      existingById.set(id, item);
    });
  });

  return next.map((item) => {
    if (!isRecord(item)) return item;

    const aliases = getRecordIdAliases(item);
    if (aliases.length === 0) return item;

    const persisted = aliases
      .map((alias) => existingById.get(alias))
      .find(Boolean);
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
  const nextProviders =
    updates.providers !== undefined
      ? mergeArrayRecordsById(existingProviders, updates.providers)
      : existingProviders;
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

export function compactUserApisPayloadForTransport(
  rawPayload: unknown,
  options?: {
    maxBytes?: number;
  },
): JsonRecord {
  const maxBytes = options?.maxBytes ?? USER_APIS_PAYLOAD_SAFE_MAX_BYTES;
  let sanitized = sanitizeUserApisEnvelope(rawPayload);

  if (estimateJsonSize(sanitized) <= maxBytes) {
    return sanitized;
  }

  // Drop low-value runtime diagnostics before sacrificing actual routes.
  sanitized = {
    ...sanitized,
    slots: toArray(sanitized.slots).map((slot) => {
      if (!isRecord(slot)) return slot;
      const { quota, cooldownUntil, customBody, customHeaders, proxyConfig, ...rest } = slot;
      return rest;
    }),
    providers: toArray(sanitized.providers).map((provider) => {
      if (!isRecord(provider)) return provider;
      const { activitySummary, usage, ...rest } = provider;
      return rest;
    }),
  };

  if (estimateJsonSize(sanitized) <= maxBytes) {
    return sanitized;
  }

  sanitized = {
    ...sanitized,
    slots: toArray(sanitized.slots).map((slot) => {
      if (!isRecord(slot)) return slot;
      const { avgResponseTime, lastResponseTime, successRate, totalRequests, ...rest } = slot;
      return rest;
    }),
  };

  if (estimateJsonSize(sanitized) <= maxBytes) {
    return sanitized;
  }

  sanitized = {
    ...sanitized,
    slots: toArray(sanitized.slots).map((slot) => {
      if (!isRecord(slot)) return slot;
      const { lastError, quota, cooldownUntil, ...rest } = slot;
      return rest;
    }),
  };

  if (estimateJsonSize(sanitized) <= maxBytes) {
    return sanitized;
  }

  // If still too large, iteratively truncate supportedModels or models lists
  // until it fits.
  let currentCompacted = { ...sanitized };
  let maxModelLength = 1000;

  while (estimateJsonSize(currentCompacted) > maxBytes && maxModelLength > 0) {
    maxModelLength = Math.floor(maxModelLength * 0.8);
    currentCompacted = {
      ...currentCompacted,
      slots: toArray(currentCompacted.slots).map((slot) => {
        if (!isRecord(slot) || !Array.isArray(slot.supportedModels)) return slot;
        return {
          ...slot,
          supportedModels: slot.supportedModels.slice(0, maxModelLength),
        };
      }),
      providers: toArray(currentCompacted.providers).map((provider) => {
        if (!isRecord(provider) || !Array.isArray(provider.models)) return provider;
        return {
          ...provider,
          models: provider.models.slice(0, maxModelLength),
        };
      }),
      entries: toArray(currentCompacted.entries).map((entry) => {
        if (!isRecord(entry) || !Array.isArray(entry.supportedModels)) return entry;
        return {
          ...entry,
          supportedModels: entry.supportedModels.slice(0, maxModelLength),
        };
      }),
    };
  }

  return currentCompacted;
}
