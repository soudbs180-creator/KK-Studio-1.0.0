type JsonRecord = Record<string, unknown>;

type LegacyArrayKind = 'slots' | 'entries' | 'unknown';

const USER_APIS_PAYLOAD_SAFE_MAX_BYTES = 900 * 1024;
const SLOT_PERSISTED_KEYS = [
  "id",
  "key",
  "name",
  "provider",
  "type",
  "format",
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
  "name",
  "baseUrl",
  "apiKey",
  "group",
  "models",
  "format",
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
  "key",
  "name",
  "provider",
  "type",
  "format",
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

type TransportEnvelope = {
  version: number;
  slots: unknown[];
  providers: unknown[];
  entries: unknown[];
};

type ModelArrayBudget = {
  slotLimit: number;
  providerLimit: number;
  entryLimit: number;
};

const TRANSPORT_MODEL_ARRAY_BUDGETS: ModelArrayBudget[] = [
  { slotLimit: Number.POSITIVE_INFINITY, providerLimit: Number.POSITIVE_INFINITY, entryLimit: Number.POSITIVE_INFINITY },
  { slotLimit: 256, providerLimit: 128, entryLimit: 64 },
  { slotLimit: 128, providerLimit: 64, entryLimit: 32 },
  { slotLimit: 64, providerLimit: 32, entryLimit: 16 },
  { slotLimit: 32, providerLimit: 16, entryLimit: 8 },
  { slotLimit: 16, providerLimit: 8, entryLimit: 0 },
  { slotLimit: 8, providerLimit: 0, entryLimit: 0 },
  { slotLimit: 0, providerLimit: 0, entryLimit: 0 },
];

function trimNormalizedStringArray(value: unknown, maxItems: number): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = normalizeStringArray(value) || [];
  if (!Number.isFinite(maxItems)) {
    return normalized;
  }

  if (maxItems <= 0) {
    return [];
  }

  return normalized.slice(0, maxItems);
}

function applyModelArrayBudget(
  payload: TransportEnvelope,
  budget: ModelArrayBudget,
): TransportEnvelope {
  return {
    version: payload.version,
    slots: payload.slots.map((slot) => {
      if (!isRecord(slot)) {
        return slot;
      }

      const nextSlot = { ...slot };
      if (Array.isArray(slot.supportedModels)) {
        nextSlot.supportedModels = trimNormalizedStringArray(slot.supportedModels, budget.slotLimit) || [];
      }
      return nextSlot;
    }),
    providers: payload.providers.map((provider) => {
      if (!isRecord(provider)) {
        return provider;
      }

      const nextProvider = { ...provider };
      if (Array.isArray(provider.models)) {
        nextProvider.models = trimNormalizedStringArray(provider.models, budget.providerLimit) || [];
      }
      return nextProvider;
    }),
    entries: payload.entries.map((entry) => {
      if (!isRecord(entry)) {
        return entry;
      }

      const nextEntry = { ...entry };
      if (Array.isArray(entry.supportedModels)) {
        nextEntry.supportedModels = trimNormalizedStringArray(entry.supportedModels, budget.entryLimit) || [];
      }
      return nextEntry;
    }),
  };
}

export function compactUserApisPayloadForTransport(
  rawPayload: unknown,
  options?: {
    maxBytes?: number;
  },
): {
  version: number;
  slots: unknown[];
  providers: unknown[];
  entries: unknown[];
} {
  const maxBytes = options?.maxBytes ?? USER_APIS_PAYLOAD_SAFE_MAX_BYTES;
  const sanitized = sanitizeUserApisEnvelope(rawPayload);
  const candidate: TransportEnvelope = {
    version: Number(sanitized.version || 2),
    slots: toArray(sanitized.slots),
    providers: toArray(sanitized.providers),
    entries: toArray(sanitized.entries),
  };

  if (!Number.isFinite(maxBytes)) {
    return candidate;
  }

  for (const budget of TRANSPORT_MODEL_ARRAY_BUDGETS) {
    const transportPayload = applyModelArrayBudget(candidate, budget);
    if (estimateJsonSize(transportPayload) <= maxBytes) {
      return transportPayload;
    }
  }

  const fallbackPayload = applyModelArrayBudget(
    candidate,
    TRANSPORT_MODEL_ARRAY_BUDGETS[TRANSPORT_MODEL_ARRAY_BUDGETS.length - 1],
  );
  console.warn(
    "[userApiPayload] User API payload still exceeds the safe transport size after trimming supported model arrays.",
  );
  return fallbackPayload;
}
