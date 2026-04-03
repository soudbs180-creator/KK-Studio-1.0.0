import type { SecureProxyUserRouteConfigDto } from "../../../../../../packages/contracts/src/index.ts";

type JsonRecord = Record<string, unknown>;

type LegacyArrayKind = "slots" | "entries" | "unknown";

const REDACTED_SECRET_PREFIX = "__kk_redacted__:";
const SECRET_ARRAY_FIELDS = {
  slots: ["key"],
  providers: ["apiKey"],
  entries: ["key"],
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasAnyKey(value: unknown, keys: string[]): boolean {
  if (!isRecord(value)) return false;
  return keys.some((key) => key in value);
}

function detectLegacyArrayKind(raw: unknown[]): LegacyArrayKind {
  if (!raw.length) return "unknown";

  const slotOnlyKeys = [
    "authMethod",
    "headerName",
    "compatibilityMode",
    "proxyConfig",
    "creditCost",
    "quota",
    "weight",
    "timeout",
    "maxRetries",
    "retryDelay",
    "cooldownUntil",
    "customHeaders",
    "customBody",
  ];

  const entryOnlyKeys = [
    "api_key_encrypted",
    "is_active",
    "created_at",
    "updated_at",
    "call_count",
    "total_cost",
  ];

  if (raw.some((item) => hasAnyKey(item, slotOnlyKeys))) {
    return "slots";
  }

  if (raw.some((item) => hasAnyKey(item, entryOnlyKeys))) {
    return "entries";
  }

  return "unknown";
}

function getRecordId(value: unknown): string {
  if (!isRecord(value)) return "";
  return String(value.id || "").trim();
}

function isRedactedSecretPlaceholder(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(REDACTED_SECRET_PREFIX);
}

function shouldPreservePersistedSecret(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();
  return normalized.length === 0 || isRedactedSecretPlaceholder(normalized);
}

function buildRedactedSecretPlaceholder(recordId: string, field: string): string {
  const normalizedId = String(recordId || "configured").trim() || "configured";
  const normalizedField = String(field || "secret").trim() || "secret";
  return `${REDACTED_SECRET_PREFIX}${normalizedField}:${normalizedId}`;
}

function redactArrayRecordSecrets(
  items: unknown[],
  fields: readonly string[],
): JsonRecord[] {
  return items
    .filter(isRecord)
    .map((item) => {
      const id = getRecordId(item);
      const nextItem: JsonRecord = { ...item };

      fields.forEach((field) => {
        const rawValue = nextItem[field];
        if (typeof rawValue === "string" && rawValue.trim().length > 0) {
          nextItem[field] = buildRedactedSecretPlaceholder(id, field);
        }
      });

      return nextItem;
    });
}

function mergeArrayRecordsById(
  existing: unknown[],
  next: unknown[],
  secretFields: readonly string[] = [],
): unknown[] {
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
    if (!persisted) {
      return item;
    }

    const merged: JsonRecord = { ...persisted, ...item };
    secretFields.forEach((field) => {
      if (!(field in persisted)) {
        return;
      }

      const nextValue = item[field];
      if (shouldPreservePersistedSecret(nextValue)) {
        merged[field] = persisted[field];
      }
    });

    return merged;
  });
}

export function isUserApisEnvelope(value: unknown): value is JsonRecord {
  if (!isRecord(value)) return false;
  return "slots" in value || "providers" in value || "entries" in value;
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
  return kind === "unknown" || kind === "entries" || kind === "slots" ? legacy : [];
}

export function extractUserApiProvidersFromPayload(raw: unknown): unknown[] {
  if (!isUserApisEnvelope(raw)) return [];
  return toArray(raw.providers);
}

export function extractUserApisPayloadVersion(raw: unknown): number {
  if (!isRecord(raw)) return 2;

  const version = raw.version;
  if (typeof version === "number" && Number.isFinite(version)) {
    return version;
  }

  return 2;
}

export function extractKeyManagerCloudState(raw: unknown): {
  version: number;
  slots: JsonRecord[];
  providers: JsonRecord[];
  entries: JsonRecord[];
} {
  return {
    version: extractUserApisPayloadVersion(raw),
    slots: extractKeyManagerCloudSlots(raw).filter(isRecord),
    providers: extractUserApiProvidersFromPayload(raw).filter(isRecord),
    entries: extractUserApiEntriesFromPayload(raw).filter(isRecord),
  };
}

export function sanitizeUserApiEntriesForClient(raw: unknown): JsonRecord[] {
  return redactArrayRecordSecrets(
    extractUserApiEntriesFromPayload(raw),
    SECRET_ARRAY_FIELDS.entries,
  );
}

export function sanitizeKeyManagerCloudStateForClient(raw: unknown): {
  version: number;
  slots: JsonRecord[];
  providers: JsonRecord[];
  entries: JsonRecord[];
} {
  return {
    version: extractUserApisPayloadVersion(raw),
    slots: redactArrayRecordSecrets(
      extractKeyManagerCloudSlots(raw),
      SECRET_ARRAY_FIELDS.slots,
    ),
    providers: redactArrayRecordSecrets(
      extractUserApiProvidersFromPayload(raw),
      SECRET_ARRAY_FIELDS.providers,
    ),
    entries: sanitizeUserApiEntriesForClient(raw),
  };
}

export function mergeUserApisPayload(
  existingRaw: unknown,
  updates: {
    version?: number;
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
      ? mergeArrayRecordsById(existingSlots, updates.slots, SECRET_ARRAY_FIELDS.slots)
      : existingSlots;
  const nextProviders =
    updates.providers !== undefined
      ? mergeArrayRecordsById(existingProviders, updates.providers, SECRET_ARRAY_FIELDS.providers)
      : existingProviders;
  const nextEntries =
    updates.entries !== undefined
      ? mergeArrayRecordsById(existingEntries, updates.entries, SECRET_ARRAY_FIELDS.entries)
      : existingEntries;
  const nextVersion =
    typeof updates.version === "number" && Number.isFinite(updates.version)
      ? updates.version
      : extractUserApisPayloadVersion(existingRaw);

  return {
    version: nextVersion,
    slots: nextSlots,
    providers: nextProviders,
    entries: nextEntries,
  };
}

function resolveDefaultRouteBaseUrl(
  provider: string,
  baseUrl: string,
  format: "openai" | "gemini" | "claude" | "auto",
): string {
  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (normalizedBaseUrl) {
    return normalizedBaseUrl.replace(/\/+$/, "");
  }

  const normalizedProvider = String(provider || "").trim().toLowerCase();
  if (format === "claude" || normalizedProvider.includes("anthropic")) {
    return "https://api.anthropic.com";
  }

  if (format === "gemini" || normalizedProvider === "google" || normalizedProvider === "gemini") {
    return "https://generativelanguage.googleapis.com";
  }

  if (normalizedProvider === "openai") {
    return "https://api.openai.com";
  }

  return normalizedBaseUrl;
}

function resolveRouteConfigFromRecord(
  routeId: string,
  rawRecord: unknown,
): SecureProxyUserRouteConfigDto | null {
  if (!isRecord(rawRecord)) {
    return null;
  }

  const apiKey = String(rawRecord.apiKey ?? rawRecord.key ?? "").trim();
  if (!apiKey) {
    return null;
  }

  const formatValue = String(rawRecord.format || "").trim().toLowerCase();
  const format: SecureProxyUserRouteConfigDto["format"] =
    formatValue === "gemini"
      ? "gemini"
      : formatValue === "claude"
        ? "claude"
        : formatValue === "openai"
          ? "openai"
          : "auto";

  const provider = String(rawRecord.provider || rawRecord.name || "Custom").trim() || "Custom";
  const baseUrl = resolveDefaultRouteBaseUrl(
    provider,
    String(rawRecord.baseUrl || rawRecord.base_url || "").trim(),
    format,
  );

  return {
    routeId,
    provider,
    baseUrl,
    apiKey,
    format,
    authMethod: rawRecord.authMethod === "query" ? "query" : "header",
    headerName: typeof rawRecord.headerName === "string" ? rawRecord.headerName.trim() : undefined,
    compatibilityMode:
      rawRecord.compatibilityMode === "chat"
        ? "chat"
        : rawRecord.compatibilityMode === "standard"
          ? "standard"
          : undefined,
  };
}

export function resolveSecureProxyUserRouteConfig(
  raw: unknown,
  routeId: string,
): SecureProxyUserRouteConfigDto | null {
  const normalizedRouteId = String(routeId || "").trim();
  if (!normalizedRouteId) {
    return null;
  }

  const slots = extractKeyManagerCloudSlots(raw).filter(isRecord);
  const providers = extractUserApiProvidersFromPayload(raw).filter(isRecord);
  const entries = extractUserApiEntriesFromPayload(raw).filter(isRecord);
  const matchedRecord =
    slots.find((item) => String(item.id || "").trim() === normalizedRouteId)
    || providers.find((item) => String(item.id || "").trim() === normalizedRouteId)
    || entries.find((item) => String(item.id || "").trim() === normalizedRouteId);

  if (!matchedRecord) {
    return null;
  }

  return resolveRouteConfigFromRecord(normalizedRouteId, matchedRecord);
}
