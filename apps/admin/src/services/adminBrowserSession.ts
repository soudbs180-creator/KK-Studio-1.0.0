export interface AdminBrowserSession {
  accessToken: string;
  adminSessionToken: string;
  accessTokenExpiresAt: string;
  adminSessionExpiresAt: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
}

export function normalizeAdminBrowserSession(value: unknown): AdminBrowserSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const accessToken = String(candidate.accessToken || '').trim();
  const adminSessionToken = String(candidate.adminSessionToken || '').trim();
  const accessTokenExpiresAt = String(candidate.accessTokenExpiresAt || '').trim();
  const adminSessionExpiresAt = String(candidate.adminSessionExpiresAt || '').trim();

  if (!accessToken || !adminSessionToken || !accessTokenExpiresAt || !adminSessionExpiresAt) {
    return null;
  }

  const refreshToken = String(candidate.refreshToken || '').trim();
  const userId = String(candidate.userId || '').trim();
  const email = String(candidate.email || '').trim();

  return {
    accessToken,
    adminSessionToken,
    accessTokenExpiresAt,
    adminSessionExpiresAt,
    ...(refreshToken ? { refreshToken } : {}),
    ...(userId ? { userId } : {}),
    ...(email ? { email } : {}),
  };
}

export function isAdminBrowserSessionExpired(expiresAt?: string): boolean {
  const normalized = String(expiresAt || '').trim();
  if (!normalized) {
    return true;
  }

  const expiresAtMs = Date.parse(normalized);
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= Date.now();
}
