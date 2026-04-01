import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { HttpError } from './http.ts';

type ProfileRoleRow = {
  role?: string | null;
};

type AdminSessionRow = {
  expires_at?: string | null;
};

function normalizeRole(role: unknown): string {
  return String(role || '').trim().toLowerCase();
}

export function createSupabaseFunctionClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new HttpError(500, 'Supabase function env vars are missing.');
  }

  const authHeader = req.headers.get('Authorization') || '';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  return {
    userClient,
    serviceClient,
  };
}

export async function requireAuthenticatedUser(
  userClient: ReturnType<typeof createClient>,
) {
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    throw new HttpError(401, 'Unauthorized');
  }

  return user;
}

export async function requireAdminUser(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<ProfileRoleRow>();

  if (error) {
    throw new HttpError(500, error.message || 'Failed to resolve user role.');
  }

  if (normalizeRole(data?.role) !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }
}

async function hashAdminSessionToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function requireElevatedAdminSession(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  adminSessionToken: string | null,
) {
  const normalizedToken = String(adminSessionToken || '').trim();
  if (!normalizedToken) {
    throw new HttpError(403, 'Admin elevation required');
  }

  const sessionTokenHash = await hashAdminSessionToken(normalizedToken);
  const now = new Date().toISOString();
  const { data, error } = await serviceClient
    .from('admin_sessions')
    .select('expires_at')
    .eq('admin_user_id', userId)
    .eq('session_token_hash', sessionTokenHash)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .maybeSingle<AdminSessionRow>();

  if (error) {
    throw new HttpError(500, error.message || 'Failed to resolve admin session.');
  }

  if (!data?.expires_at) {
    throw new HttpError(403, 'Admin elevation required');
  }
}
