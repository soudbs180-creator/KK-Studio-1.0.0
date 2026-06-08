const fs = require('fs/promises');
const path = require('path');

const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../../.kk-local/local-user-apis.json');

let cache = {
  signature: '',
  payload: { version: 2, profiles: {} },
  indexes: new Map(),
  readPromise: null,
};

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProfileState(value) {
  const source = isObjectRecord(value) ? value : {};
  return {
    version: Number.parseInt(source.version, 10) || 2,
    slots: Array.isArray(source.slots) ? source.slots : [],
    providers: Array.isArray(source.providers) ? source.providers : [],
    entries: Array.isArray(source.entries) ? source.entries : [],
  };
}

function safeString(value) {
  return String(value || '').trim();
}

function normalizeRouteValue(value) {
  return safeString(value).toLowerCase();
}

function normalizeProviderLinkValue(value) {
  return safeString(value).replace(/\/+$/, '').toLowerCase();
}

function resolveRouteIdCandidate(value) {
  const decoded = (() => {
    try {
      return decodeURIComponent(safeString(value));
    } catch {
      return safeString(value);
    }
  })();
  const normalized = decoded.toLowerCase();
  if (normalized.startsWith('slot_key_')) return normalized.slice(5);
  if (normalized.startsWith('slot_')) return normalized.slice(5);
  if (normalized.startsWith('provider_')) return normalized.slice('provider_'.length);
  return normalized;
}

function buildRouteLookupCandidates(routeId) {
  return Array.from(new Set([
    normalizeRouteValue(routeId),
    resolveRouteIdCandidate(routeId),
  ].filter(Boolean)));
}

function recordAliases(record) {
  return [
    safeString(record?.id),
    ...(Array.isArray(record?.legacyIds) ? record.legacyIds : []),
    safeString(record?.name),
  ].map(normalizeRouteValue).filter(Boolean);
}

function addRoute(index, route, options = {}) {
  for (const alias of recordAliases(route)) {
    const aliases = [alias, `provider_${alias}`, `slot_${alias}`, `slot_key_${alias}`];
    for (const item of aliases) {
      if (options.preserveExisting && index.routeByAlias.has(item)) continue;
      index.routeByAlias.set(item, route);
    }
  }
}

function buildRouteFromProvider(provider) {
  return {
    id: safeString(provider?.id),
    legacyIds: Array.isArray(provider?.legacyIds) ? provider.legacyIds : [],
    name: safeString(provider?.name),
    baseUrl: safeString(provider?.baseUrl),
    apiKey: safeString(provider?.apiKey),
    models: Array.isArray(provider?.models) ? provider.models : [],
    format: safeString(provider?.format || 'auto') || 'auto',
    endpointType: safeString(provider?.endpointType || provider?.adapterId),
    requestProfileId: safeString(provider?.requestProfileId || provider?.profileId),
    timeout: provider?.timeout,
    maxRetries: provider?.maxRetries,
  };
}

function buildRouteFromSlot(slot, linkedProvider) {
  return {
    id: safeString(slot?.id),
    legacyIds: Array.isArray(slot?.legacyIds) ? slot.legacyIds : [],
    name: safeString(linkedProvider?.name || slot?.name),
    baseUrl: safeString(linkedProvider?.baseUrl || slot?.baseUrl),
    apiKey: safeString(linkedProvider?.apiKey || slot?.key),
    models: Array.isArray(linkedProvider?.models)
      ? linkedProvider.models
      : Array.isArray(slot?.supportedModels)
        ? slot.supportedModels
        : [],
    format: safeString(linkedProvider?.format || slot?.format || 'auto') || 'auto',
    endpointType: safeString(linkedProvider?.endpointType || slot?.endpointType || linkedProvider?.adapterId),
    requestProfileId: safeString(linkedProvider?.requestProfileId || slot?.requestProfileId || linkedProvider?.profileId),
    timeout: linkedProvider?.timeout || slot?.timeout,
    maxRetries: linkedProvider?.maxRetries || slot?.maxRetries,
  };
}

function buildProfileRouteIndex(profileState) {
  const index = { routeByAlias: new Map() };
  const providers = Array.isArray(profileState.providers) ? profileState.providers : [];
  const slots = Array.isArray(profileState.slots) ? profileState.slots : [];
  const providersByBase = new Map();
  const providerByBaseAndKey = new Map();
  const providerByBaseAndName = new Map();

  for (const provider of providers) {
    const route = buildRouteFromProvider(provider);
    const base = normalizeProviderLinkValue(route.baseUrl);
    const key = safeString(route.apiKey);
    const name = normalizeRouteValue(route.name);

    addRoute(index, route);

    if (base) {
      const list = providersByBase.get(base) || [];
      list.push(route);
      providersByBase.set(base, list);
      if (key) providerByBaseAndKey.set(`${base}\n${key}`, route);
      if (name) providerByBaseAndName.set(`${base}\n${name}`, route);
    }
  }

  for (const slot of slots) {
    const base = normalizeProviderLinkValue(slot?.baseUrl);
    const key = safeString(slot?.key);
    const name = normalizeRouteValue(slot?.name);
    const sameBase = base ? providersByBase.get(base) || [] : [];
    const linkedProvider = (base && key ? providerByBaseAndKey.get(`${base}\n${key}`) : null)
      || (base && name ? providerByBaseAndName.get(`${base}\n${name}`) : null)
      || (sameBase.length === 1 ? sameBase[0] : null);

    addRoute(index, buildRouteFromSlot(slot, linkedProvider), { preserveExisting: true });
  }

  return index;
}

async function readLocalStorage() {
  async function doRead() {
    let signature = 'missing';
    try {
      const stat = await fs.stat(LOCAL_STORAGE_PATH);
      signature = `${stat.mtimeMs}:${stat.size}`;
    } catch {
      cache = {
        signature,
        payload: { version: 2, profiles: {} },
        indexes: new Map(),
        readPromise: null,
      };
      return cache.payload;
    }

    if (cache.signature === signature) return cache.payload;

    let parsed = { version: 2, profiles: {} };
    try {
      const raw = await fs.readFile(LOCAL_STORAGE_PATH, 'utf8');
      const candidate = JSON.parse(raw);
      parsed = isObjectRecord(candidate) ? candidate : { version: 2, profiles: {} };
    } catch {
      parsed = { version: 2, profiles: {} };
    }

    cache = {
      signature,
      payload: parsed,
      indexes: new Map(),
      readPromise: null,
    };
    return parsed;
  }

  if (!cache.readPromise) {
    cache.readPromise = doRead().finally(() => {
      cache.readPromise = null;
    });
  }
  return cache.readPromise;
}

async function resolveLocalUserRoute(userId, routeId) {
  const data = await readLocalStorage();
  if (!isObjectRecord(data.profiles)) data.profiles = {};

  const cacheKey = `${cache.signature}:${userId}`;
  let index = cache.indexes.get(cacheKey);
  if (!index) {
    const rawProfile = isObjectRecord(data.profiles[userId]) ? data.profiles[userId] : data;
    index = buildProfileRouteIndex(normalizeProfileState(rawProfile));
    cache.indexes.set(cacheKey, index);
  }

  for (const candidate of buildRouteLookupCandidates(routeId)) {
    const route = index.routeByAlias.get(candidate);
    if (route) return route;
  }
  return null;
}

module.exports = {
  resolveLocalUserRoute,
  readLocalStorage,
  normalizeProfileState,
  buildProfileRouteIndex,
};
