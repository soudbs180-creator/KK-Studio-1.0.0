import {
  createKkApiClient,
  type KkApiClient,
} from '../../../../packages/contracts/src/index.ts';
import { ADMIN_SESSION_TOKEN_HEADER } from '../../../../packages/shared/src/index.ts';

import { resolveAdminApiBaseUrl, resolveAdminAppBaseUrl } from '../config/adminRuntime';
import { normalizeAdminBrowserSession } from './adminBrowserSession';

const STORAGE_KEY = 'kk_admin_browser_session';

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeAdminBrowserSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function createAdminApiClient(): KkApiClient {
  const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const adminAppBaseUrl = resolveAdminAppBaseUrl({
    configuredAdminUrl: import.meta.env.VITE_KK_ADMIN_URL,
    runtimeOrigin,
  });
  const baseUrl = resolveAdminApiBaseUrl({
    configuredApiUrl: import.meta.env.VITE_KK_ADMIN_API_BASE_URL,
    adminAppBaseUrl,
  });

  return createKkApiClient({
    baseUrl,
    getAccessToken: () => readStoredSession()?.accessToken,
    getDefaultHeaders: () => ({
      [ADMIN_SESSION_TOKEN_HEADER]: readStoredSession()?.adminSessionToken,
    }),
    getClientVersion: () => 'kk-admin-web',
  });
}
