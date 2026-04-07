export type ApiManagementTab = 'official' | 'third-party';

export interface ApiManagementListState {
  source: 'api-management';
  activeTab: ApiManagementTab;
  highlightOfficialId?: string;
  highlightProviderId?: string;
}

const API_MANAGEMENT_SOURCE = 'api-management';
const API_MANAGEMENT_OFFICIAL_PREFIX = '/settings/api-management/official/';
const API_MANAGEMENT_PROVIDER_PREFIX = '/settings/api-management/provider/';
const ROUTE_NEW_ITEM = 'new';

function normalizeNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeTab(value: unknown): ApiManagementTab | null {
  return value === 'official' || value === 'third-party' ? value : null;
}

function decodeRouteValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildApiManagementListState(
  activeTab: ApiManagementTab,
  options: {
    highlightOfficialId?: string | null;
    highlightProviderId?: string | null;
  } = {},
): ApiManagementListState {
  const nextState: ApiManagementListState = {
    source: API_MANAGEMENT_SOURCE,
    activeTab,
  };

  const highlightOfficialId = normalizeNonEmptyString(options.highlightOfficialId);
  const highlightProviderId = normalizeNonEmptyString(options.highlightProviderId);

  if (activeTab === 'official' && highlightOfficialId) {
    nextState.highlightOfficialId = highlightOfficialId;
  }

  if (activeTab === 'third-party' && highlightProviderId) {
    nextState.highlightProviderId = highlightProviderId;
  }

  return nextState;
}

export function readApiManagementListState(value: unknown): ApiManagementListState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = 'source' in value ? value.source : null;
  const activeTab = 'activeTab' in value ? normalizeTab(value.activeTab) : null;
  if (source !== API_MANAGEMENT_SOURCE || !activeTab) {
    return null;
  }

  return buildApiManagementListState(activeTab, {
    highlightOfficialId: 'highlightOfficialId' in value ? normalizeNonEmptyString(value.highlightOfficialId) : undefined,
    highlightProviderId: 'highlightProviderId' in value ? normalizeNonEmptyString(value.highlightProviderId) : undefined,
  });
}

export function deriveApiManagementListStateFromPath(pathname: string): ApiManagementListState | null {
  if (!pathname.startsWith('/settings/api-management/')) {
    return null;
  }

  if (pathname.startsWith(API_MANAGEMENT_OFFICIAL_PREFIX)) {
    const routeValue = decodeRouteValue(pathname.slice(API_MANAGEMENT_OFFICIAL_PREFIX.length)).trim();
    return buildApiManagementListState('official', {
      highlightOfficialId: routeValue && routeValue !== ROUTE_NEW_ITEM ? routeValue : undefined,
    });
  }

  if (pathname.startsWith(API_MANAGEMENT_PROVIDER_PREFIX)) {
    const routeValue = decodeRouteValue(pathname.slice(API_MANAGEMENT_PROVIDER_PREFIX.length)).trim();
    return buildApiManagementListState('third-party', {
      highlightProviderId: routeValue && routeValue !== ROUTE_NEW_ITEM ? routeValue : undefined,
    });
  }

  return null;
}

export function isApiManagementEditorRoute(pathname: string): boolean {
  return deriveApiManagementListStateFromPath(pathname) !== null;
}
