import { resolveKkApiBaseUrl } from './kkApiClient.ts';

export type KkApiRepositoryBackend = 'supabase' | 'memory' | 'local-file' | 'custom' | 'unknown';

interface RawHealthEnvelope {
  success?: boolean;
  data?: {
    service?: unknown;
    status?: unknown;
    config?: Record<string, unknown> | null;
    repositories?: Record<string, unknown> | null;
    persistence?: Record<string, unknown> | null;
  } | null;
}

export interface KkApiServerHealth {
  reachable: boolean;
  verified: boolean;
  service: string;
  status: string;
  config: {
    hasSupabaseUrl: boolean;
    hasServiceRoleKey: boolean;
    hasAuthKey: boolean;
    hasUserApiEncryptionSecret: boolean;
    usingPublicUrlFallback: boolean;
  };
  repositories: {
    adminConsole: KkApiRepositoryBackend;
    authData: KkApiRepositoryBackend;
    creditAccounts: KkApiRepositoryBackend;
    creditProviders: KkApiRepositoryBackend;
    workspaceLayout: KkApiRepositoryBackend;
  };
  persistence: {
    userApiKeys: boolean;
    keyManager: boolean;
    credits: boolean;
    creditProviders: boolean;
    workspaceLayout: boolean;
  };
  fetchedAt: number;
  errorMessage?: string;
}

const HEALTH_CACHE_TTL_MS = 10_000;

let cachedHealth: KkApiServerHealth | null = null;
let cachedHealthAt = 0;
let inFlightHealthRequest: Promise<KkApiServerHealth> | null = null;

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeBackend(value: unknown): KkApiRepositoryBackend {
  return value === 'supabase' || value === 'memory' || value === 'local-file' || value === 'custom'
    ? value
    : 'unknown';
}

function createUnavailableHealth(message: string): KkApiServerHealth {
  return {
    reachable: false,
    verified: false,
    service: 'kk-studio-api',
    status: 'unavailable',
    config: {
      hasSupabaseUrl: false,
      hasServiceRoleKey: false,
      hasAuthKey: false,
      hasUserApiEncryptionSecret: false,
      usingPublicUrlFallback: false,
    },
    repositories: {
      adminConsole: 'unknown',
      authData: 'unknown',
      creditAccounts: 'unknown',
      creditProviders: 'unknown',
      workspaceLayout: 'unknown',
    },
    persistence: {
      userApiKeys: false,
      keyManager: false,
      credits: false,
      creditProviders: false,
      workspaceLayout: false,
    },
    fetchedAt: Date.now(),
    errorMessage: message,
  };
}

function normalizeHealthPayload(payload: unknown): KkApiServerHealth {
  const envelope = (payload && typeof payload === 'object' ? payload : {}) as RawHealthEnvelope;
  const data = (envelope.data && typeof envelope.data === 'object' ? envelope.data : null);
  if (!data) {
    return createUnavailableHealth('Local API server returned an invalid health payload.');
  }

  const repositories = data.repositories || {};
  const config = data.config || {};
  const persistence = data.persistence || {};
  const normalizedRepositories = {
    adminConsole: normalizeBackend(repositories.adminConsole),
    authData: normalizeBackend(repositories.authData),
    creditAccounts: normalizeBackend(repositories.creditAccounts),
    creditProviders: normalizeBackend(repositories.creditProviders),
    workspaceLayout: normalizeBackend(repositories.workspaceLayout),
  };
  const verified = Object.values(normalizedRepositories).some((value) => value !== 'unknown');

  return {
    reachable: true,
    verified,
    service: typeof data.service === 'string' && data.service.trim() ? data.service : 'kk-studio-api',
    status: typeof data.status === 'string' && data.status.trim() ? data.status : 'ok',
    config: {
      hasSupabaseUrl: normalizeBoolean(config.hasSupabaseUrl),
      hasServiceRoleKey: normalizeBoolean(config.hasServiceRoleKey),
      hasAuthKey: normalizeBoolean(config.hasAuthKey),
      hasUserApiEncryptionSecret: normalizeBoolean(config.hasUserApiEncryptionSecret),
      usingPublicUrlFallback: normalizeBoolean(config.usingPublicUrlFallback),
    },
    repositories: normalizedRepositories,
    persistence: {
      userApiKeys: normalizeBoolean(persistence.userApiKeys),
      keyManager: normalizeBoolean(persistence.keyManager),
      credits: normalizeBoolean(persistence.credits),
      creditProviders: normalizeBoolean(persistence.creditProviders),
      workspaceLayout: normalizeBoolean(persistence.workspaceLayout),
    },
    fetchedAt: Date.now(),
  };
}

async function fetchKkApiServerHealth(): Promise<KkApiServerHealth> {
  const baseUrl = resolveKkApiBaseUrl();
  const healthUrl = new URL('/healthz', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return createUnavailableHealth(`Local API server health check failed with HTTP ${response.status}.`);
    }

    return normalizeHealthPayload(await response.json());
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Failed to reach the local API server.';
    return createUnavailableHealth(message);
  }
}

export async function getKkApiServerHealth(options?: { forceRefresh?: boolean }): Promise<KkApiServerHealth> {
  const now = Date.now();
  if (!options?.forceRefresh && cachedHealth && now - cachedHealthAt < HEALTH_CACHE_TTL_MS) {
    return cachedHealth;
  }

  if (!options?.forceRefresh && inFlightHealthRequest) {
    return inFlightHealthRequest;
  }

  inFlightHealthRequest = fetchKkApiServerHealth()
    .then((health) => {
      cachedHealth = health;
      cachedHealthAt = Date.now();
      return health;
    })
    .finally(() => {
      inFlightHealthRequest = null;
    });

  return inFlightHealthRequest;
}

export class KkApiPersistenceUnavailableError extends Error {
  readonly code = 'KK_API_PERSISTENCE_UNAVAILABLE';
  readonly health: KkApiServerHealth;

  constructor(message: string, health: KkApiServerHealth) {
    super(message);
    this.name = 'KkApiPersistenceUnavailableError';
    this.health = health;
  }
}

export function isKkApiPersistenceUnavailableError(
  error: unknown,
): error is KkApiPersistenceUnavailableError {
  return Boolean(
    error
    && typeof error === 'object'
    && (
      error instanceof KkApiPersistenceUnavailableError
      || (error as { code?: unknown }).code === 'KK_API_PERSISTENCE_UNAVAILABLE'
    ),
  );
}

export async function assertKkApiUserDataWritable(): Promise<KkApiServerHealth> {
  const health = await getKkApiServerHealth();

  if (!health.reachable) {
    throw new KkApiPersistenceUnavailableError(
      'Local API server is unavailable. User API settings need the API server to persist encrypted data.',
      health,
    );
  }

  if (!health.verified) {
    throw new KkApiPersistenceUnavailableError(
      'Local API server health details are outdated. Restart the API server before saving user API settings.',
      health,
    );
  }

  const userDataPersisted =
    (health.repositories.authData === 'supabase' || health.repositories.authData === 'local-file')
    && health.persistence.userApiKeys
    && health.persistence.keyManager;

  if (!userDataPersisted) {
    throw new KkApiPersistenceUnavailableError(
      'Local API server is not persisting user API data yet. Restart the API server with local-file or Supabase-backed auth storage enabled before saving user API settings.',
      health,
    );
  }

  if (!health.config.hasUserApiEncryptionSecret) {
    throw new KkApiPersistenceUnavailableError(
      'Local API server is missing USER_API_ENCRYPTION_SECRET. Restart the API server with encrypted profile storage enabled before saving user API settings.',
      health,
    );
  }

  return health;
}

export async function isKkApiBillingPersistedViaSupabase(): Promise<boolean> {
  const health = await getKkApiServerHealth();
  return health.reachable && health.verified && health.repositories.creditAccounts === 'supabase' && health.persistence.credits;
}
