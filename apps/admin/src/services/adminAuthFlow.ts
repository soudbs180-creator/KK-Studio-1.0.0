import type { KkApiClient } from '../../../../packages/contracts/src/index.ts';
import { isAdminBrowserSessionExpired, type AdminBrowserSession } from './adminBrowserSession.ts';

export async function performAdminLogin(
  input: { email: string; password: string; adminPassword: string },
  deps: { client: KkApiClient },
): Promise<AdminBrowserSession> {
  const login = await deps.client.login({
    email: input.email.trim(),
    password: input.password,
  });
  if (!login.success) {
    throw new Error(login.error?.message || 'LOGIN_FAILED');
  }

  const access = await deps.client.getAdminAccess({
    accessToken: login.data.accessToken,
  });
  if (!access.success || access.data.isAdmin !== true) {
    throw new Error('ADMIN_FORBIDDEN');
  }

  const verified = await deps.client.verifyAdminPassword(
    { password: input.adminPassword },
    { accessToken: login.data.accessToken },
  );
  if (!verified.success) {
    throw new Error(verified.error?.message || 'ADMIN_PASSWORD_INVALID');
  }

  const accessTokenExpiresAt = new Date(Date.now() + login.data.expiresIn * 1000).toISOString();

  return {
    accessToken: login.data.accessToken,
    refreshToken: login.data.refreshToken,
    adminSessionToken: verified.data.adminSessionToken,
    accessTokenExpiresAt,
    adminSessionExpiresAt: verified.data.adminSessionExpiresAt,
    userId: login.data.profile.id,
    email: login.data.profile.email,
  };
}

export function canUseAdminRoute(session: AdminBrowserSession | null): boolean {
  if (!session) {
    return false;
  }

  return !isAdminBrowserSessionExpired(session.accessTokenExpiresAt)
    && !isAdminBrowserSessionExpired(session.adminSessionExpiresAt)
    && session.accessToken.length > 0
    && session.adminSessionToken.length > 0;
}
