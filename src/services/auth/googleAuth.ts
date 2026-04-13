import { resolveAuthRedirectOrigin } from '../../config/authRedirect.ts';
import { supabase } from '../../lib/supabase.ts';

type GoogleAuthClient = Pick<typeof supabase, 'auth'>;

export function buildGoogleSignInRedirectUrl(origin = resolveAuthRedirectOrigin()): string {
  return new URL('/auth/callback', origin).toString();
}

export async function startGoogleSignIn(
  client: GoogleAuthClient = supabase,
  origin = resolveAuthRedirectOrigin(),
): Promise<void> {
  const redirectTo = buildGoogleSignInRedirectUrl(origin);
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }
}
