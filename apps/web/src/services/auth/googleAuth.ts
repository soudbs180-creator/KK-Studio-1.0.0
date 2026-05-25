import { resolveAuthRedirectOrigin } from '../../config/authRedirect.ts';
import { kkWebApiClient } from '../api/kkApiClient.ts';

type GoogleAuthClient = Pick<typeof kkWebApiClient, 'startGoogleLogin'>;

export function buildGoogleSignInRedirectUrl(origin = resolveAuthRedirectOrigin()): string {
  return new URL('/auth/callback', origin).toString();
}

export async function startGoogleSignIn(
  client: GoogleAuthClient = kkWebApiClient,
  origin = resolveAuthRedirectOrigin(),
): Promise<void> {
  const redirectTo = buildGoogleSignInRedirectUrl(origin);
  const response = await client.startGoogleLogin(redirectTo);
  if (!response.success) {
    throw new Error(response.error.message || 'Google OAuth disabled');
  }

  const authorizationUrl = String(response.data.authorizationUrl || '').trim();
  if (!authorizationUrl) {
    throw new Error('Google OAuth authorization URL is unavailable');
  }

  window.location.assign(authorizationUrl);
}
