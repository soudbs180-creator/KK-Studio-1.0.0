import {
  CANONICAL_PROVIDER_CATALOG,
  type CanonicalProviderDefinition,
  type ProviderConnectionDto,
} from '@kk/shared';

type ProtocolFamily = CanonicalProviderDefinition['protocolFamilies'][number];

export interface LegacyProviderRouteMetadata {
  [field: string]: unknown;
  id?: unknown;
  name?: unknown;
  provider?: unknown;
  baseUrl?: unknown;
  protocolFamily?: unknown;
  disabled?: unknown;
  isActive?: unknown;
}

export interface ProviderConnectionMigrationCandidate {
  legacyRouteId: string;
  providerId: string;
  displayName: string;
  protocolProfile: string;
  endpoint: string;
  requiresSecretReentry: true;
}

interface MigrationProjectionOptions {
  providerIds?: readonly string[];
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIdentity(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeEndpoint(value: unknown): string {
  try {
    const endpoint = new URL(normalizeText(value));
    if (!['http:', 'https:'].includes(endpoint.protocol)) return '';
    if (endpoint.username || endpoint.password) return '';
    endpoint.hash = '';
    endpoint.search = '';
    return endpoint.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function matchesProviderIdentity(record: LegacyProviderRouteMetadata, provider: CanonicalProviderDefinition): boolean {
  const identity = normalizeIdentity(record.provider);
  if (!identity) return false;
  return [provider.id, provider.label, provider.uiIdentity, provider.runtimeStrategyId]
    .some((candidate) => normalizeIdentity(candidate) === identity);
}

function matchesProviderHost(endpoint: string, provider: CanonicalProviderDefinition): boolean {
  if (!endpoint) return false;
  const host = new URL(endpoint).host.toLowerCase();
  return provider.knownHosts.some((knownHost) => {
    const normalizedHost = knownHost.toLowerCase();
    return host === normalizedHost || host.endsWith(`.${normalizedHost}`);
  });
}

function resolveProvider(record: LegacyProviderRouteMetadata): CanonicalProviderDefinition | undefined {
  const endpoint = normalizeEndpoint(record.baseUrl);
  const identityProvider = CANONICAL_PROVIDER_CATALOG.find((provider) => matchesProviderIdentity(record, provider));
  const endpointProvider = CANONICAL_PROVIDER_CATALOG.find((provider) => matchesProviderHost(endpoint, provider));
  // A canonical host conflict could send a newly entered secret to the wrong Provider.
  if (identityProvider && endpointProvider && identityProvider.id !== endpointProvider.id) return undefined;
  return identityProvider || endpointProvider;
}

function resolveProtocolProfile(record: LegacyProviderRouteMetadata, provider: CanonicalProviderDefinition): string {
  const requestedFamily = normalizeText(record.protocolFamily) as ProtocolFamily;
  const family = provider.protocolFamilies.includes(requestedFamily)
    ? requestedFamily
    : provider.protocolFamilies[0];
  return provider.id === 'google' && family === 'gemini-native' ? 'google-official' : family;
}

function buildCandidate(record: LegacyProviderRouteMetadata): ProviderConnectionMigrationCandidate | null {
  const legacyRouteId = normalizeText(record.id);
  const provider = resolveProvider(record);
  if (!legacyRouteId || !provider || record.disabled === true || record.isActive === false) return null;
  const endpoint = normalizeEndpoint(record.baseUrl || provider.defaultBaseUrl);
  if (!endpoint) return null;
  return {
    legacyRouteId,
    providerId: provider.id,
    displayName: normalizeText(record.name) || provider.label,
    protocolProfile: resolveProtocolProfile(record, provider),
    endpoint,
    requiresSecretReentry: true,
  };
}

function migrationIdentity(candidate: Pick<ProviderConnectionMigrationCandidate, 'providerId' | 'displayName' | 'endpoint'>): string {
  return [candidate.providerId, normalizeIdentity(candidate.displayName), normalizeEndpoint(candidate.endpoint)].join('|');
}

/**
 * Projects only safe legacy metadata; secret-bearing fields are deliberately ignored.
 */
export function buildProviderConnectionMigrationCandidates(
  legacyRoutes: readonly LegacyProviderRouteMetadata[],
  connections: readonly ProviderConnectionDto[],
  options: MigrationProjectionOptions = {},
): ProviderConnectionMigrationCandidate[] {
  const allowedProviders = options.providerIds ? new Set(options.providerIds) : null;
  const migrated = new Set(connections.map((connection) => migrationIdentity({
    providerId: connection.providerId,
    displayName: connection.displayName,
    endpoint: connection.endpoint || '',
  })));
  return legacyRoutes
    .map(buildCandidate)
    .filter((candidate): candidate is ProviderConnectionMigrationCandidate => Boolean(candidate))
    .filter((candidate) => !allowedProviders || allowedProviders.has(candidate.providerId))
    .filter((candidate) => !migrated.has(migrationIdentity(candidate)));
}
