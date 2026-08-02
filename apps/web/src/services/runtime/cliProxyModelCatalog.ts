import { getModelCapabilities } from '../model/modelCapabilities';

const CLI_PROXY_MODELS_URL = 'http://127.0.0.1:9099/api/provider-runtime/models';
const REQUEST_TIMEOUT_MS = 4_000;
const MAX_MODELS = 1_000;

export interface CliProxyModelFeatureSet {
  web: boolean;
  reasoning: boolean;
  imageSearch: boolean;
  visionReferences: boolean;
  declaration: 'declared' | 'pending';
}

export interface CliProxyCatalogModel {
  id: string;
  ownedBy?: string;
  features: CliProxyModelFeatureSet;
}

export interface CliProxyCatalogSnapshot {
  models: CliProxyCatalogModel[];
  webModelCount: number;
  reasoningModelCount: number;
  pendingModelCount: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Maps CLIProxyAPI model IDs into the existing KK Studio capability source of truth. */
export function resolveCliProxyModelFeatures(modelId: string): CliProxyModelFeatureSet {
  const capabilities = getModelCapabilities(modelId);
  if (!capabilities) {
    return { web: false, reasoning: false, imageSearch: false, visionReferences: false, declaration: 'pending' };
  }
  return {
    web: capabilities.supportsGrounding,
    reasoning: capabilities.supportsThinking === true,
    imageSearch: capabilities.supportsImageSearch === true,
    visionReferences: capabilities.supportsReferenceImages !== false && (capabilities.maxRefImages || 0) > 0,
    declaration: 'declared',
  };
}

function parseCatalog(payload: unknown): CliProxyCatalogModel[] {
  const rawModels = asRecord(payload).models;
  if (!Array.isArray(rawModels) || rawModels.length > MAX_MODELS) {
    throw new TypeError('CLIProxyAPI model catalog response is invalid.');
  }
  return rawModels.map((value) => {
    const model = asRecord(value);
    const id = typeof model.id === 'string' ? model.id.trim() : '';
    if (!id || id.length > 256) throw new TypeError('CLIProxyAPI returned an invalid model ID.');
    const ownedBy = typeof model.ownedBy === 'string' && model.ownedBy.trim()
      ? model.ownedBy.trim().slice(0, 128)
      : undefined;
    return { id, ...(ownedBy ? { ownedBy } : {}), features: resolveCliProxyModelFeatures(id) };
  });
}

function summarizeCatalog(models: CliProxyCatalogModel[]): CliProxyCatalogSnapshot {
  return {
    models,
    webModelCount: models.filter((model) => model.features.web).length,
    reasoningModelCount: models.filter((model) => model.features.reasoning).length,
    pendingModelCount: models.filter((model) => model.features.declaration === 'pending').length,
  };
}

/** Reads the secret-free catalog projection through Local Runner, never from CLIProxyAPI directly. */
export async function getCliProxyModelCatalog(): Promise<CliProxyCatalogSnapshot> {
  const token = window.localStorage.getItem('kk_local_runner_token')?.trim() || '';
  if (!token) throw new Error('Local Runner pairing is required before reading the CLIProxyAPI model catalog.');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(CLI_PROXY_MODELS_URL, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('CLIProxyAPI model catalog is unavailable.');
    return summarizeCatalog(parseCatalog(await response.json()));
  } finally {
    window.clearTimeout(timeoutId);
  }
}
